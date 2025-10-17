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

function buildSvgEntry(slug, payload, existing) {
  const now = new Date().toISOString();
  const summary = sanitizeOptionalText(payload.summary);
  const storedCreatedAt = existing && typeof existing.createdAt === 'string' ? existing.createdAt : null;
  const createdAt = typeof payload.createdAt === 'string' && payload.createdAt.trim()
    ? payload.createdAt.trim()
    : storedCreatedAt || now;
  const entry = {
    slug,
    title: sanitizeRequiredText(payload.title),
    tool: sanitizeRequiredText(payload.tool),
    svg: typeof payload.svg === 'string' ? payload.svg : '',
    createdAt
  };
  if (summary) {
    entry.summary = summary;
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

async function getSvg(slug) {
  const normalized = normalizeSlug(slug);
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
    const entryMode = storeMode === 'memory'
      ? 'memory'
      : memoryValue.mode || memoryValue.storage || storeMode;
    const entry = applyStorageMetadata(clone(memoryValue), entryMode);
    return entry;
  }
  return null;
}

async function setSvg(slug, payload) {
  const normalized = normalizeSlug(slug || (payload && payload.slug));
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
  const normalized = normalizeSlug(slug);
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
      const normalized = normalizeSlug(value);
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
    const normalized = normalizeSlug(slug);
    if (!normalized) return;
    const stored = readFromMemory(normalized);
    if (!stored) return;
    const annotated = applyStorageMetadata(stored, storeMode);
    entries.push(clone(annotated));
  });
  return entries;
}

module.exports = {
  normalizeSlug,
  getSvg,
  setSvg,
  deleteSvg,
  listSvgs,
  KvOperationError,
  KvConfigurationError,
  isKvConfigured,
  getStoreMode
};
