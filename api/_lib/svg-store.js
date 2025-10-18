'use strict';

const KEY_PREFIX = 'svg:';
const INDEX_KEY = 'svg:__slugs__';
const INJECTED_KV_CLIENT_KEY = '__MATH_VISUALS_KV_CLIENT__';

const globalScope = typeof globalThis === 'object' && globalThis ? globalThis : global;
const memoryStore = globalScope.__SVG_MEMORY_STORE__ || new Map();
const memoryIndex = globalScope.__SVG_MEMORY_INDEX__ || new Set();

globalScope.__SVG_MEMORY_STORE__ = memoryStore;
globalScope.__SVG_MEMORY_INDEX__ = memoryIndex;

let kvClientPromise = null;

class KvOperationError extends Error {
  constructor(message, options) {
    super(message);
    if (options && options.cause) {
      this.cause = options.cause;
    }
    this.code = options && options.code ? options.code : 'KV_OPERATION_FAILED';
  }
}

class KvConfigurationError extends Error {
  constructor(message) {
    super(message);
    this.code = 'KV_NOT_CONFIGURED';
  }
}

function isKvConfigured() {
  return Boolean(process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN);
}

function getStoreMode() {
  return isKvConfigured() ? 'kv' : 'memory';
}

function normalizeStoreMode(value) {
  if (typeof value !== 'string') return null;
  const normalized = value.trim().toLowerCase();
  if (!normalized) return null;
  if (normalized === 'kv' || normalized === 'vercel-kv') return 'kv';
  if (normalized === 'memory' || normalized === 'mem' || normalized === 'unconfigured') return 'memory';
  return null;
}

function applyStorageMetadata(entry, mode) {
  if (!entry || typeof entry !== 'object') return entry;
  const resolved = normalizeStoreMode(mode) || normalizeStoreMode(entry.mode) || normalizeStoreMode(entry.storage) || getStoreMode();
  const storageMode = resolved === 'kv' ? 'kv' : 'memory';
  entry.storage = storageMode;
  entry.mode = storageMode;
  entry.storageMode = storageMode;
  entry.persistent = storageMode === 'kv';
  entry.ephemeral = storageMode !== 'kv';
  return entry;
}

function getInjectedKvClient() {
  if (typeof globalScope !== 'object' || !globalScope) {
    return null;
  }
  const injected = globalScope[INJECTED_KV_CLIENT_KEY];
  return injected ? injected : null;
}

async function loadKvClient() {
  const injected = getInjectedKvClient();
  if (injected) {
    if (!kvClientPromise || !kvClientPromise.__mathVisualsInjected) {
      const resolved = Promise.resolve(injected).then(client => {
        if (!client) {
          throw new KvOperationError('Injected KV client is not available');
        }
        return client;
      });
      resolved.__mathVisualsInjected = true;
      kvClientPromise = resolved;
    }
    return kvClientPromise;
  }
  if (!isKvConfigured()) {
    throw new KvConfigurationError(
      'SVG storage KV is not configured. Set KV_REST_API_URL and KV_REST_API_TOKEN to enable persistent storage.'
    );
  }
  if (!kvClientPromise) {
    kvClientPromise = import('@vercel/kv')
      .then(mod => {
        if (mod && mod.kv) {
          return mod.kv;
        }
        throw new KvOperationError('Failed to load @vercel/kv client module');
      })
      .catch(error => {
        throw new KvOperationError('Unable to initialize Vercel KV client', { cause: error });
      });
  }
  return kvClientPromise;
}

function normalizeSlug(value) {
  if (typeof value !== 'string') return null;
  let slug = value.trim();
  if (!slug) return null;
  slug = slug.replace(/[\\]+/g, '/');
  slug = slug.replace(/\/+/g, '/');
  slug = slug.replace(/^\/+/, '');
  slug = slug.replace(/\/+$/, '');
  if (!slug) return null;
  const parts = slug.split('/');
  const normalizedParts = [];
  for (const segment of parts) {
    if (!segment) continue;
    let decoded = segment;
    try {
      decoded = decodeURIComponent(segment);
    } catch (error) {}
    if (typeof decoded === 'string') {
      decoded = decoded.toLowerCase();
    } else {
      decoded = String(segment).toLowerCase();
    }
    let encoded;
    try {
      encoded = encodeURIComponent(decoded);
    } catch (error) {
      encoded = decoded;
    }
    if (typeof encoded === 'string') {
      encoded = encoded.replace(/%[0-9a-f]{2}/gi, match => match.toUpperCase());
    }
    if (encoded) {
      normalizedParts.push(encoded);
    }
  }
  if (!normalizedParts.length) return null;
  let normalized = normalizedParts.join('/');
  if (normalized.length > 512) {
    normalized = normalized.slice(0, 512);
  }
  return normalized;
}

function makeKey(slug) {
  return KEY_PREFIX + slug;
}

function clone(entry) {
  if (entry == null) return entry;
  try {
    return JSON.parse(JSON.stringify(entry));
  } catch (error) {
    return entry;
  }
}

function sanitizeOptionalText(value) {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  return trimmed ? trimmed : undefined;
}

function sanitizeRequiredText(value) {
  if (typeof value !== 'string') return '';
  return value.trim();
}

function sanitizeFilename(value, fallback) {
  if (typeof value !== 'string') return fallback;
  const trimmed = value.trim();
  if (!trimmed) return fallback;
  const parts = trimmed.split(/[\\/]+/);
  const name = parts[parts.length - 1];
  return name || fallback;
}

function resolveCanonicalSlug(input) {
  const normalized = normalizeSlug(input);
  if (!normalized) return null;
  if (/\.svg$/i.test(normalized)) {
    return normalized;
  }
  if (/\.png$/i.test(normalized)) {
    return normalizeSlug(normalized.replace(/\.png$/i, '.svg'));
  }
  return normalizeSlug(`${normalized}.svg`);
}

function deriveSlugMetadata(slug, payload, existing) {
  const canonicalSlug = resolveCanonicalSlug(slug || (existing && existing.slug));
  const fromExistingSlug = existing && typeof existing.slug === 'string' ? existing.slug : null;
  const finalSlug = canonicalSlug || resolveCanonicalSlug(fromExistingSlug) || fromExistingSlug || '';
  const slugBase = finalSlug ? finalSlug.replace(/\.svg$/i, '') : '';
  const slugSegments = finalSlug ? finalSlug.split('/') : [];
  const directorySegments = slugSegments.length > 1 ? slugSegments.slice(0, -1) : [];
  const directory = directorySegments.join('/');
  const filenameFallback = slugSegments.length ? slugSegments[slugSegments.length - 1] : '';
  const providedFilename = sanitizeFilename(payload && payload.filename, existing && existing.filename);
  const normalizedFilename = sanitizeFilename(providedFilename, filenameFallback) || filenameFallback;
  const svgFilename = normalizedFilename.toLowerCase().endsWith('.svg')
    ? normalizedFilename
    : normalizedFilename
      ? `${normalizedFilename}.svg`
      : filenameFallback;
  const baseFilename = svgFilename ? svgFilename.replace(/\.svg$/i, '') : slugBase.split('/').pop() || '';
  const pngFilename = baseFilename ? `${baseFilename}.png` : existing && existing.pngFilename ? existing.pngFilename : '';
  const pngSlugFromPayload = normalizeSlug(payload && payload.pngSlug);
  const pngSlug = pngSlugFromPayload
    ? pngSlugFromPayload
    : slugBase
      ? `${slugBase}.png`
      : existing && typeof existing.pngSlug === 'string'
        ? existing.pngSlug
        : '';

  return {
    slug: finalSlug,
    slugBase,
    slugDirectory: directory,
    filename: svgFilename || filenameFallback,
    filenameBase: baseFilename,
    slugExtension: 'svg',
    pngFilename,
    pngSlug,
    pngExtension: pngFilename ? 'png' : '',
    requestedSlug: slug
  };
}

function sanitizePayloadString(value, fallback) {
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (trimmed) {
      return trimmed;
    }
  }
  return typeof fallback === 'string' ? fallback : undefined;
}

function buildSvgEntry(slug, payload, existing) {
  const now = new Date().toISOString();
  const metadata = deriveSlugMetadata(slug, payload || {}, existing || {});
  const summary =
    payload && Object.prototype.hasOwnProperty.call(payload, 'summary')
      ? sanitizeOptionalText(payload.summary)
      : sanitizeOptionalText(existing && existing.summary);
  const description =
    payload && Object.prototype.hasOwnProperty.call(payload, 'description')
      ? sanitizeOptionalText(payload.description)
      : sanitizeOptionalText(existing && existing.description);
  const storedCreatedAt = existing && typeof existing.createdAt === 'string' ? existing.createdAt : null;
  const createdAt = sanitizePayloadString(payload && payload.createdAt, storedCreatedAt) || now;
  const entry = {
    slug: metadata.slug,
    slugBase: metadata.slugBase,
    slugDirectory: metadata.slugDirectory,
    slugExtension: metadata.slugExtension,
    filename: metadata.filename,
    filenameBase: metadata.filenameBase,
    pngFilename: metadata.pngFilename,
    pngSlug: metadata.pngSlug,
    pngExtension: metadata.pngExtension,
    title:
      payload && Object.prototype.hasOwnProperty.call(payload, 'title')
        ? sanitizeRequiredText(payload.title)
        : sanitizeRequiredText(existing && existing.title),
    tool:
      payload && Object.prototype.hasOwnProperty.call(payload, 'tool')
        ? sanitizeRequiredText(payload.tool)
        : sanitizeRequiredText(existing && existing.tool),
    toolId:
      payload && Object.prototype.hasOwnProperty.call(payload, 'toolId')
        ? sanitizeRequiredText(payload.toolId)
        : sanitizeRequiredText(existing && existing.toolId),
    description,
    summary,
    svg:
      payload && Object.prototype.hasOwnProperty.call(payload, 'svg') && typeof payload.svg === 'string'
        ? payload.svg
        : existing && typeof existing.svg === 'string'
          ? existing.svg
          : '',
    png:
      payload && Object.prototype.hasOwnProperty.call(payload, 'png') && typeof payload.png === 'string'
        ? payload.png
        : existing && typeof existing.png === 'string'
          ? existing.png
          : '',
    createdAt,
    updatedAt: now
  };
  if (metadata.slugBase && !entry.slugBase) {
    entry.slugBase = metadata.slugBase;
  }
  if (summary) {
    entry.summary = summary;
  } else if (entry.summary === undefined) {
    delete entry.summary;
  }
  if (description) {
    entry.description = description;
  } else if (entry.description === undefined) {
    delete entry.description;
  }
  return entry;
}

function writeToMemory(slug, entry) {
  const key = makeKey(slug);
  memoryStore.set(key, clone(entry));
  memoryIndex.add(slug);
}

function deleteFromMemory(slug) {
  const key = makeKey(slug);
  memoryStore.delete(key);
  memoryIndex.delete(slug);
}

function readFromMemory(slug) {
  const key = makeKey(slug);
  const value = memoryStore.get(key);
  return value ? clone(value) : null;
}

async function writeToKv(slug, entry) {
  const kv = await loadKvClient();
  const key = makeKey(slug);
  try {
    await kv.set(key, entry);
    await kv.sadd(INDEX_KEY, slug);
  } catch (error) {
    throw new KvOperationError(`Failed to write SVG entry for slug ${slug}`, { cause: error });
  }
  try {
    const verification = await kv.get(key);
    if (verification == null) {
      throw new KvOperationError(`Failed to verify SVG entry after writing slug ${slug}`, {
        code: 'KV_WRITE_VERIFICATION_FAILED'
      });
    }
  } catch (error) {
    if (error instanceof KvOperationError) {
      throw error;
    }
    throw new KvOperationError(`Failed to verify SVG entry after writing slug ${slug}`, {
      cause: error,
      code: 'KV_WRITE_VERIFICATION_FAILED'
    });
  }
}

async function deleteFromKv(slug) {
  const kv = await loadKvClient();
  const key = makeKey(slug);
  try {
    await kv.del(key);
    await kv.srem(INDEX_KEY, slug);
  } catch (error) {
    throw new KvOperationError(`Failed to delete SVG entry for slug ${slug}`, { cause: error });
  }
}

async function readFromKv(slug) {
  const kv = await loadKvClient();
  const key = makeKey(slug);
  try {
    const value = await kv.get(key);
    if (value == null) return null;
    if (typeof value === 'string') {
      try {
        return JSON.parse(value);
      } catch (error) {
        throw new KvOperationError('Failed to parse SVG entry from KV', { cause: error });
      }
    }
    if (typeof value === 'object') {
      return value;
    }
    throw new KvOperationError('Unsupported KV payload type for SVG entry', {
      code: 'KV_UNSUPPORTED_VALUE_TYPE'
    });
  } catch (error) {
    if (error instanceof KvOperationError) {
      throw error;
    }
    throw new KvOperationError(`Failed to read SVG entry for slug ${slug}`, { cause: error });
  }
}

function resolveReadCandidates(slug) {
  const candidates = [];
  const normalized = normalizeSlug(slug);
  if (!normalized) {
    return candidates;
  }
  const canonical = resolveCanonicalSlug(normalized);
  if (canonical) {
    candidates.push(canonical);
  }
  if (normalized && normalized !== canonical) {
    candidates.push(normalized);
  }
  if (/\.png$/i.test(normalized)) {
    const svgVersion = resolveCanonicalSlug(normalized);
    if (svgVersion && !candidates.includes(svgVersion)) {
      candidates.push(svgVersion);
    }
  }
  return Array.from(new Set(candidates));
}

async function getSvg(slug) {
  const candidates = resolveReadCandidates(slug);
  if (!candidates.length) return null;
  const storeMode = getStoreMode();
  const useKv = storeMode === 'kv';
  if (useKv) {
    for (const candidate of candidates) {
      const kvValue = await readFromKv(candidate);
      if (kvValue) {
        const entry = buildSvgEntry(candidate, kvValue, kvValue);
        applyStorageMetadata(entry, 'kv');
        writeToMemory(entry.slug, entry);
        return clone(entry);
      }
    }
  }
  for (const candidate of candidates) {
    const memoryValue = readFromMemory(candidate);
    if (memoryValue) {
      const entryMode = storeMode === 'memory'
        ? 'memory'
        : memoryValue.mode || memoryValue.storage || storeMode;
      const entry = applyStorageMetadata(clone(memoryValue), entryMode);
      return entry;
    }
  }
  return null;
}

async function setSvg(slug, payload) {
  const payloadObject = payload || {};
  const inputSlug = typeof slug === 'string' ? slug : payloadObject.slug;
  const canonicalSlug = resolveCanonicalSlug(inputSlug || payloadObject.slug);
  if (!canonicalSlug) return null;
  const fallbackSlug = normalizeSlug(inputSlug || payloadObject.slug) || null;
  let existing = readFromMemory(canonicalSlug);
  if (!existing && fallbackSlug && fallbackSlug !== canonicalSlug) {
    existing = readFromMemory(fallbackSlug);
  }
  const entry = buildSvgEntry(canonicalSlug, payloadObject, existing || null);
  const storeMode = getStoreMode();
  if (storeMode === 'kv') {
    await writeToKv(entry.slug, entry);
    if (fallbackSlug && fallbackSlug !== entry.slug) {
      try {
        await deleteFromKv(fallbackSlug);
      } catch (error) {
        // ignore fallback cleanup failures
      }
    }
    const annotated = applyStorageMetadata({ ...entry }, 'kv');
    writeToMemory(entry.slug, annotated);
    if (fallbackSlug && fallbackSlug !== entry.slug) {
      deleteFromMemory(fallbackSlug);
    }
    return clone(annotated);
  }
  const annotated = applyStorageMetadata(entry, storeMode);
  writeToMemory(entry.slug, annotated);
  if (fallbackSlug && fallbackSlug !== entry.slug) {
    deleteFromMemory(fallbackSlug);
  }
  return clone(annotated);
}

async function deleteSvg(slug) {
  const candidates = resolveReadCandidates(slug);
  if (!candidates.length) return false;
  const storeMode = getStoreMode();
  const deletedCandidates = new Set();
  for (const candidate of candidates) {
    if (deletedCandidates.has(candidate)) continue;
    if (storeMode === 'kv') {
      await deleteFromKv(candidate);
    }
    deleteFromMemory(candidate);
    deletedCandidates.add(candidate);
  }
  return deletedCandidates.size > 0;
}

async function listSvgs() {
  const entries = [];
  const storeMode = getStoreMode();
  if (storeMode === 'kv') {
    const kv = await loadKvClient();
    let slugs = [];
    try {
      const raw = await kv.smembers(INDEX_KEY);
      if (Array.isArray(raw)) slugs = raw;
    } catch (error) {
      throw new KvOperationError('Failed to read SVG index from KV', { cause: error });
    }
    for (const value of slugs) {
      const canonical = resolveCanonicalSlug(value);
      const normalizedValue = normalizeSlug(value);
      const primarySlug = canonical || normalizedValue;
      if (!primarySlug) continue;
      let stored = await readFromKv(primarySlug);
      let sourceSlug = primarySlug;
      if (!stored && canonical && normalizedValue && canonical !== normalizedValue) {
        stored = await readFromKv(normalizedValue);
        if (stored) {
          sourceSlug = normalizedValue;
        }
      }
      if (!stored) continue;
      const entry = buildSvgEntry(sourceSlug, stored, stored);
      applyStorageMetadata(entry, 'kv');
      writeToMemory(entry.slug, entry);
      entries.push(clone(entry));
    }
    return entries;
  }
  memoryIndex.forEach(slug => {
    const canonical = resolveCanonicalSlug(slug);
    const normalized = canonical || normalizeSlug(slug);
    if (!normalized) return;
    let stored = readFromMemory(normalized);
    if (!stored && canonical && normalized !== canonical) {
      stored = readFromMemory(canonical);
    }
    if (!stored && slug !== normalized) {
      const fallback = normalizeSlug(slug);
      if (fallback && fallback !== normalized) {
        stored = readFromMemory(fallback);
      }
    }
    if (!stored) return;
    const normalizedEntry = buildSvgEntry(normalized, stored, stored);
    const annotated = applyStorageMetadata(normalizedEntry, storeMode);
    writeToMemory(annotated.slug || normalized, annotated);
    entries.push(clone(annotated));
  });
  return entries;
}

module.exports = {
  normalizeSlug,
  resolveCanonicalSlug,
  getSvg,
  setSvg,
  deleteSvg,
  listSvgs,
  KvOperationError,
  KvConfigurationError,
  isKvConfigured,
  getStoreMode
};
