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

function stripAssetExtension(slug) {
  if (typeof slug !== 'string') return slug;
  return slug.replace(/\.(?:svg|png)$/gi, '');
}

function normalizeEntrySlug(value) {
  const normalized = normalizeSlug(value);
  if (!normalized) return null;
  return stripAssetExtension(normalized);
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

function normalizeAltTextSource(value) {
  if (typeof value !== 'string') return undefined;
  const normalized = value.trim().toLowerCase();
  if (!normalized) return undefined;
  if (normalized === 'manual') return 'manual';
  if (normalized === 'auto') return 'auto';
  return undefined;
}

function parseExampleStateValue(raw) {
  if (raw == null) return undefined;
  let value = raw;
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) return undefined;
    try {
      value = JSON.parse(trimmed);
    } catch (error) {
      return undefined;
    }
  }
  if (typeof value !== 'object' || value === null) {
    return undefined;
  }
  try {
    return JSON.parse(JSON.stringify(value));
  } catch (error) {
    return undefined;
  }
}

function extractExampleState(payload, existing) {
  if (payload && Object.prototype.hasOwnProperty.call(payload, 'exampleState')) {
    const parsed = parseExampleStateValue(payload.exampleState);
    if (parsed !== undefined) {
      return parsed;
    }
  }
  if (existing && Object.prototype.hasOwnProperty.call(existing, 'exampleState')) {
    const parsed = parseExampleStateValue(existing.exampleState);
    if (parsed !== undefined) {
      return parsed;
    }
  }
  return undefined;
}

function sanitizeFileBaseName(value) {
  if (typeof value !== 'string') return '';
  const trimmed = value.trim();
  if (!trimmed) return '';
  const withoutExt = trimmed.replace(/\.[^/.]+$/g, '');
  const sanitized = withoutExt.replace(/[^a-z0-9._-]+/gi, '-').replace(/^-+|-+$/g, '');
  return sanitized || '';
}

function deriveFileBaseName(slug, payload, existing) {
  const fromPayload =
    sanitizeFileBaseName(payload.baseName) ||
    sanitizeFileBaseName(payload.filename) ||
    sanitizeFileBaseName(payload.svgFilename) ||
    sanitizeFileBaseName(payload.pngFilename);
  if (fromPayload) return fromPayload;

  if (existing && typeof existing === 'object') {
    const existingBase =
      sanitizeFileBaseName(existing.baseName) ||
      sanitizeFileBaseName(existing.filename) ||
      (existing.files && existing.files.svg && sanitizeFileBaseName(existing.files.svg.filename)) ||
      (existing.files && existing.files.png && sanitizeFileBaseName(existing.files.png.filename));
    if (existingBase) return existingBase;
  }

  if (typeof slug === 'string' && slug) {
    const parts = slug.split('/');
    const last = parts[parts.length - 1];
    const sanitized = sanitizeFileBaseName(last);
    if (sanitized) return sanitized;
  }

  return 'export';
}

function buildAssetSlug(baseSlug, extension) {
  if (!baseSlug) return null;
  const normalizedBase = stripAssetExtension(baseSlug);
  if (!normalizedBase) return null;
  const ext = extension === 'png' ? 'png' : 'svg';
  return `${normalizedBase}.${ext}`;
}

function buildAssetUrl(assetSlug) {
  if (!assetSlug) return null;
  const trimmed = assetSlug.replace(/^\/+/, '');
  if (trimmed.startsWith('bildearkiv/')) {
    return `/${trimmed}`;
  }
  return `/bildearkiv/${trimmed}`;
}

function parseDimension(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) return null;
  if (number <= 0) return null;
  return Math.round(number);
}

function extractPngInfo(payload, existing) {
  const pngValue = payload ? payload.png : undefined;
  let dataUrl = '';
  let width = null;
  let height = null;

  if (typeof pngValue === 'string') {
    dataUrl = pngValue.trim();
  } else if (pngValue && typeof pngValue === 'object') {
    if (typeof pngValue.dataUrl === 'string') {
      dataUrl = pngValue.dataUrl.trim();
    }
    if (Number.isFinite(pngValue.width)) {
      width = parseDimension(pngValue.width);
    }
    if (Number.isFinite(pngValue.height)) {
      height = parseDimension(pngValue.height);
    }
  }

  if (!dataUrl && existing && typeof existing === 'object') {
    const existingPng = existing.png && typeof existing.png === 'string' ? existing.png.trim() : '';
    if (existingPng) {
      dataUrl = existingPng;
    }
  }

  if (width == null) {
    const fromPayload = parseDimension(payload && payload.pngWidth);
    if (fromPayload != null) {
      width = fromPayload;
    } else if (existing && existing.files && existing.files.png && existing.files.png.width) {
      const existingWidth = parseDimension(existing.files.png.width);
      if (existingWidth != null) width = existingWidth;
    }
  }

  if (height == null) {
    const fromPayload = parseDimension(payload && payload.pngHeight);
    if (fromPayload != null) {
      height = fromPayload;
    } else if (existing && existing.files && existing.files.png && existing.files.png.height) {
      const existingHeight = parseDimension(existing.files.png.height);
      if (existingHeight != null) height = existingHeight;
    }
  }

  return { dataUrl, width: width == null ? undefined : width, height: height == null ? undefined : height };
}

function buildFileMetadata(baseSlug, baseName, extension, overrides) {
  const slug = buildAssetSlug(baseSlug, extension);
  const filename = `${baseName}.${extension}`;
  const url = buildAssetUrl(slug);
  const result = {
    slug,
    filename,
    url,
    contentType: extension === 'png' ? 'image/png' : 'image/svg+xml'
  };
  if (overrides && typeof overrides === 'object') {
    if (overrides.width != null) result.width = overrides.width;
    if (overrides.height != null) result.height = overrides.height;
  }
  return result;
}

function ensureEntryShape(slug, payload, existing) {
  const baseName = deriveFileBaseName(slug, payload || {}, existing || {});
  const { dataUrl: pngDataUrl, width: pngWidth, height: pngHeight } = extractPngInfo(payload || {}, existing || {});
  const summary = sanitizeOptionalText(payload.summary);
  const description = sanitizeOptionalText(payload.description);

  const nowIso = new Date().toISOString();
  const storedCreatedAt = existing && typeof existing.createdAt === 'string' ? existing.createdAt : null;
  const createdAt = typeof payload.createdAt === 'string' && payload.createdAt.trim()
    ? payload.createdAt.trim()
    : storedCreatedAt || nowIso;
  const updatedAt = nowIso;

  const svgMarkup = typeof payload.svg === 'string' ? payload.svg : existing && typeof existing.svg === 'string' ? existing.svg : '';

  const svgFile = buildFileMetadata(slug, baseName, 'svg', existing && existing.files && existing.files.svg);
  const pngFileOverrides = existing && existing.files && existing.files.png ? existing.files.png : {};
  if (pngWidth != null) pngFileOverrides.width = pngWidth;
  if (pngHeight != null) pngFileOverrides.height = pngHeight;
  const pngFile = buildFileMetadata(slug, baseName, 'png', pngFileOverrides);

  const entry = {
    slug,
    baseName,
    title: sanitizeRequiredText(payload.title || (existing && existing.title)),
    tool: sanitizeRequiredText(payload.tool || (existing && existing.tool)),
    svg: svgMarkup,
    png: pngDataUrl,
    createdAt,
    updatedAt,
    filename: svgFile.filename,
    svgFilename: svgFile.filename,
    pngFilename: pngFile.filename,
    svgSlug: svgFile.slug,
    pngSlug: pngFile.slug,
    files: {
      svg: svgFile,
      png: pngFile
    },
    urls: {
      svg: svgFile.url,
      png: pngFile.url
    }
  };

  if (summary) {
    entry.summary = summary;
  }
  if (description) {
    entry.description = description;
  }
  const hasAltTextField = payload && Object.prototype.hasOwnProperty.call(payload, 'altText');
  const hasAltTextSourceField = payload && Object.prototype.hasOwnProperty.call(payload, 'altTextSource');
  const altTextValue = hasAltTextField ? sanitizeOptionalText(payload.altText) : undefined;
  const existingAltText = existing && typeof existing.altText === 'string' ? sanitizeRequiredText(existing.altText) : undefined;
  if (hasAltTextField) {
    if (altTextValue !== undefined) {
      entry.altText = altTextValue;
    } else {
      delete entry.altText;
    }
  } else if (existingAltText !== undefined) {
    entry.altText = existingAltText;
  }

  const existingAltTextSource = existing && typeof existing.altTextSource === 'string'
    ? normalizeAltTextSource(existing.altTextSource)
    : undefined;
  let resolvedAltTextSource = existingAltTextSource;

  if (hasAltTextField) {
    resolvedAltTextSource = altTextValue !== undefined ? 'manual' : 'auto';
  }

  if (hasAltTextSourceField) {
    const overrideSource = normalizeAltTextSource(payload.altTextSource);
    if (overrideSource) {
      resolvedAltTextSource = overrideSource;
    } else if (hasAltTextField && altTextValue === undefined) {
      resolvedAltTextSource = 'auto';
    }
  }

  if (resolvedAltTextSource) {
    entry.altTextSource = resolvedAltTextSource;
  } else if (hasAltTextField || hasAltTextSourceField) {
    entry.altTextSource = entry.altText ? 'manual' : 'auto';
  } else if (entry.altText && !existingAltTextSource) {
    entry.altTextSource = 'manual';
  }
  if (pngWidth != null) {
    entry.pngWidth = pngWidth;
  }
  if (pngHeight != null) {
    entry.pngHeight = pngHeight;
  }

  const exampleState = extractExampleState(payload || {}, existing || {});
  if (exampleState !== undefined) {
    entry.exampleState = exampleState;
  } else {
    delete entry.exampleState;
  }

  return entry;
}

function buildSvgEntry(slug, payload, existing) {
  const now = new Date().toISOString();
  const baseSlug = stripAssetExtension(slug);
  const entry = ensureEntryShape(baseSlug, payload, existing);
  entry.updatedAt = now;
  if (!entry.createdAt) {
    entry.createdAt = now;
  }
  return entry;
}

function writeToMemory(slug, entry) {
  const normalized = normalizeEntrySlug(slug);
  if (!normalized) return;
  const key = makeKey(normalized);
  memoryStore.set(key, clone(entry));
  memoryIndex.add(normalized);
}

function deleteFromMemory(slug) {
  const normalized = normalizeEntrySlug(slug);
  if (!normalized) return;
  const key = makeKey(normalized);
  memoryStore.delete(key);
  memoryIndex.delete(normalized);
}

function readFromMemory(slug) {
  const normalized = normalizeEntrySlug(slug);
  if (!normalized) return null;
  const key = makeKey(normalized);
  const value = memoryStore.get(key);
  return value ? clone(value) : null;
}

async function writeToKv(slug, entry) {
  const kv = await loadKvClient();
  const normalized = normalizeEntrySlug(slug);
  if (!normalized) {
    throw new KvOperationError('Invalid slug for KV write', { code: 'INVALID_SLUG' });
  }
  const key = makeKey(normalized);
  try {
    await kv.set(key, entry);
    await kv.sadd(INDEX_KEY, normalized);
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
  const normalized = normalizeEntrySlug(slug);
  if (!normalized) {
    throw new KvOperationError('Invalid slug for KV delete', { code: 'INVALID_SLUG' });
  }
  const key = makeKey(normalized);
  try {
    await kv.del(key);
    await kv.srem(INDEX_KEY, normalized);
  } catch (error) {
    throw new KvOperationError(`Failed to delete SVG entry for slug ${slug}`, { cause: error });
  }
}

async function readFromKv(slug) {
  const kv = await loadKvClient();
  const normalized = normalizeEntrySlug(slug);
  if (!normalized) {
    throw new KvOperationError('Invalid slug for KV read', { code: 'INVALID_SLUG' });
  }
  const key = makeKey(normalized);
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

async function getSvg(slug) {
  const normalized = normalizeEntrySlug(slug);
  if (!normalized) return null;
  const storeMode = getStoreMode();
  const useKv = storeMode === 'kv';
  if (useKv) {
    const kvValue = await readFromKv(normalized);
    if (kvValue) {
      const entry = buildSvgEntry(normalized, kvValue, kvValue);
      applyStorageMetadata(entry, 'kv');
      writeToMemory(normalized, entry);
      return clone(entry);
    }
  }
  const memoryValue = readFromMemory(normalized);
  if (memoryValue) {
    const shaped =
      memoryValue && memoryValue.files && memoryValue.files.svg && memoryValue.files.png && typeof memoryValue.png === 'string'
        ? memoryValue
        : buildSvgEntry(normalized, memoryValue, memoryValue);
    const entryMode = storeMode === 'memory'
      ? 'memory'
      : shaped.mode || shaped.storage || storeMode;
    const entry = applyStorageMetadata(clone(shaped), entryMode);
    writeToMemory(normalized, entry);
    return entry;
  }
  return null;
}

async function setSvg(slug, payload) {
  const normalized = normalizeEntrySlug(slug || (payload && payload.slug));
  if (!normalized) return null;
  const existing = readFromMemory(normalized);
  const entry = buildSvgEntry(normalized, payload || {}, existing || null);
  const storeMode = getStoreMode();
  if (storeMode === 'kv') {
    await writeToKv(normalized, entry);
    const annotated = applyStorageMetadata({ ...entry }, 'kv');
    writeToMemory(normalized, annotated);
    return clone(annotated);
  }
  const annotated = applyStorageMetadata(entry, storeMode);
  writeToMemory(normalized, annotated);
  return clone(annotated);
}

async function deleteSvg(slug) {
  const normalized = normalizeEntrySlug(slug);
  if (!normalized) return false;
  const storeMode = getStoreMode();
  if (storeMode === 'kv') {
    await deleteFromKv(normalized);
  }
  deleteFromMemory(normalized);
  return true;
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
      const normalized = normalizeEntrySlug(value);
      if (!normalized) continue;
      const stored = await readFromKv(normalized);
      if (!stored) continue;
      const entry = buildSvgEntry(normalized, stored, stored);
      applyStorageMetadata(entry, 'kv');
      writeToMemory(normalized, entry);
      entries.push(clone(entry));
    }
    return entries;
  }
  memoryIndex.forEach(slug => {
    const normalized = normalizeEntrySlug(slug);
    if (!normalized) return;
    const stored = readFromMemory(normalized);
    if (!stored) return;
    const shaped =
      stored && stored.files && stored.files.svg && stored.files.png && typeof stored.png === 'string'
        ? stored
        : buildSvgEntry(normalized, stored, stored);
    const annotated = applyStorageMetadata(shaped, storeMode);
    entries.push(clone(annotated));
  });
  return entries;
}

async function updateSvgMetadata(slug, updates) {
  const normalized = normalizeEntrySlug(slug);
  if (!normalized) return null;

  let existing = readFromMemory(normalized);
  if (!existing) {
    existing = await getSvg(normalized);
  }
  if (!existing) {
    return null;
  }

  const entry = clone(existing);
  let changed = false;

  const hasAltTextField = updates && Object.prototype.hasOwnProperty.call(updates, 'altText');
  const hasAltTextSourceField = updates && Object.prototype.hasOwnProperty.call(updates, 'altTextSource');

  let sanitizedAltText;
  if (hasAltTextField) {
    sanitizedAltText = sanitizeOptionalText(updates.altText);
    if (sanitizedAltText !== undefined) {
      if (entry.altText !== sanitizedAltText) {
        changed = true;
      }
      entry.altText = sanitizedAltText;
    } else if (entry.altText) {
      changed = true;
      delete entry.altText;
    } else if (Object.prototype.hasOwnProperty.call(entry, 'altText')) {
      delete entry.altText;
    }
  }

  if (hasAltTextSourceField) {
    const normalizedSource = normalizeAltTextSource(updates.altTextSource);
    if (normalizedSource) {
      if (entry.altTextSource !== normalizedSource) {
        changed = true;
      }
      entry.altTextSource = normalizedSource;
    } else if (entry.altTextSource) {
      changed = true;
      delete entry.altTextSource;
    }
  }

  if (hasAltTextField && !hasAltTextSourceField) {
    const nextSource = sanitizedAltText ? 'manual' : 'auto';
    if (entry.altTextSource !== nextSource) {
      changed = true;
    }
    entry.altTextSource = nextSource;
  } else if (!entry.altTextSource && entry.altText) {
    entry.altTextSource = 'manual';
  }

  if (!changed) {
    return clone(entry);
  }

  const now = new Date().toISOString();
  entry.updatedAt = now;
  if (!entry.createdAt) {
    entry.createdAt = now;
  }

  const storeMode = getStoreMode();
  if (storeMode === 'kv') {
    await writeToKv(normalized, entry);
    const annotated = applyStorageMetadata({ ...entry }, 'kv');
    writeToMemory(normalized, annotated);
    return clone(annotated);
  }
  const annotated = applyStorageMetadata(entry, storeMode);
  writeToMemory(normalized, annotated);
  return clone(annotated);
}

module.exports = {
  normalizeSlug,
  getSvg,
  setSvg,
  deleteSvg,
  listSvgs,
  updateSvgMetadata,
  KvOperationError,
  KvConfigurationError,
  isKvConfigured,
  getStoreMode
};
