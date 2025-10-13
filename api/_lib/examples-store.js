'use strict';

const KEY_PREFIX = 'examples:';
const INDEX_KEY = 'examples:__paths__';

const globalScope = typeof globalThis !== 'undefined' ? globalThis : global;
if (!globalScope.__EXAMPLES_MEMORY_STORE__) {
  globalScope.__EXAMPLES_MEMORY_STORE__ = new Map();
}
if (!globalScope.__EXAMPLES_MEMORY_INDEX__) {
  globalScope.__EXAMPLES_MEMORY_INDEX__ = new Set();
}

const memoryStore = globalScope.__EXAMPLES_MEMORY_STORE__;
const memoryIndex = globalScope.__EXAMPLES_MEMORY_INDEX__;

let kvClientPromise = null;

const EXAMPLE_VALUE_TYPE_KEY = '__mathVisualsType__';
const EXAMPLE_VALUE_DATA_KEY = '__mathVisualsValue__';

function serializeExampleValue(value, seen) {
  if (value == null) return value;
  const valueType = typeof value;
  if (valueType === 'function' || valueType === 'symbol') return undefined;
  if (valueType !== 'object') return value;
  if (seen.has(value)) return seen.get(value);
  const tag = Object.prototype.toString.call(value);
  if (tag === '[object Map]') {
    const entries = [];
    const marker = {
      [EXAMPLE_VALUE_TYPE_KEY]: 'map',
      [EXAMPLE_VALUE_DATA_KEY]: entries
    };
    seen.set(value, marker);
    value.forEach((entryValue, entryKey) => {
      entries.push([
        serializeExampleValue(entryKey, seen),
        serializeExampleValue(entryValue, seen)
      ]);
    });
    return marker;
  }
  if (tag === '[object Set]') {
    const items = [];
    const marker = {
      [EXAMPLE_VALUE_TYPE_KEY]: 'set',
      [EXAMPLE_VALUE_DATA_KEY]: items
    };
    seen.set(value, marker);
    value.forEach(entryValue => {
      items.push(serializeExampleValue(entryValue, seen));
    });
    return marker;
  }
  if (tag === '[object Date]') {
    return {
      [EXAMPLE_VALUE_TYPE_KEY]: 'date',
      [EXAMPLE_VALUE_DATA_KEY]: value.toISOString()
    };
  }
  if (tag === '[object RegExp]') {
    return {
      [EXAMPLE_VALUE_TYPE_KEY]: 'regexp',
      pattern: value.source,
      flags: value.flags || ''
    };
  }
  if (Array.isArray(value)) {
    const arr = [];
    seen.set(value, arr);
    for (let i = 0; i < value.length; i++) {
      arr[i] = serializeExampleValue(value[i], seen);
    }
    return arr;
  }
  if (value && typeof value === 'object' && Object.prototype.hasOwnProperty.call(value, EXAMPLE_VALUE_TYPE_KEY)) {
    const clone = {};
    seen.set(value, clone);
    Object.keys(value).forEach(key => {
      const encoded = serializeExampleValue(value[key], seen);
      if (encoded !== undefined) {
        clone[key] = encoded;
      }
    });
    return clone;
  }
  const obj = {};
  seen.set(value, obj);
  Object.keys(value).forEach(key => {
    const encoded = serializeExampleValue(value[key], seen);
    if (encoded !== undefined) {
      obj[key] = encoded;
    }
  });
  return obj;
}

function deserializeExampleValue(value, seen) {
  if (value == null || typeof value !== 'object') {
    return value;
  }
  if (seen.has(value)) {
    return seen.get(value);
  }
  if (Array.isArray(value)) {
    const arr = [];
    seen.set(value, arr);
    for (let i = 0; i < value.length; i++) {
      arr[i] = deserializeExampleValue(value[i], seen);
    }
    return arr;
  }
  const type = value[EXAMPLE_VALUE_TYPE_KEY];
  if (type === 'map') {
    const result = new Map();
    seen.set(value, result);
    const entries = Array.isArray(value[EXAMPLE_VALUE_DATA_KEY]) ? value[EXAMPLE_VALUE_DATA_KEY] : [];
    entries.forEach(entry => {
      if (!Array.isArray(entry) || entry.length < 2) return;
      const key = deserializeExampleValue(entry[0], seen);
      const entryValue = deserializeExampleValue(entry[1], seen);
      try {
        result.set(key, entryValue);
      } catch (_) {}
    });
    return result;
  }
  if (type === 'set') {
    const result = new Set();
    seen.set(value, result);
    const items = Array.isArray(value[EXAMPLE_VALUE_DATA_KEY]) ? value[EXAMPLE_VALUE_DATA_KEY] : [];
    items.forEach(item => {
      result.add(deserializeExampleValue(item, seen));
    });
    return result;
  }
  if (type === 'date') {
    const isoValue = value[EXAMPLE_VALUE_DATA_KEY];
    return typeof isoValue === 'string' ? new Date(isoValue) : new Date(NaN);
  }
  if (type === 'regexp') {
    const pattern = typeof value.pattern === 'string' ? value.pattern : '';
    const flags = typeof value.flags === 'string' ? value.flags : '';
    try {
      return new RegExp(pattern, flags);
    } catch (_) {
      try {
        return new RegExp(pattern);
      } catch (_) {
        return new RegExp('');
      }
    }
  }
  const obj = {};
  seen.set(value, obj);
  Object.keys(value).forEach(key => {
    obj[key] = deserializeExampleValue(value[key], seen);
  });
  return obj;
}

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

async function loadKvClient() {
  if (!isKvConfigured()) {
    throw new KvConfigurationError(
      'Examples KV is not configured. Set KV_REST_API_URL and KV_REST_API_TOKEN to enable persistent storage.'
    );
  }
  if (globalScope.__EXAMPLES_KV_CLIENT__ && typeof globalScope.__EXAMPLES_KV_CLIENT__ === 'object') {
    return globalScope.__EXAMPLES_KV_CLIENT__;
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

const SAFE_PATH_CHARS = new Set(
  "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_.~!$&'()*+,;=:@"
);

function uppercasePercentEncoding(value) {
  return value.replace(/%[0-9a-f]{2}/gi, match => match.toUpperCase());
}

function encodePathWithFallback(value) {
  if (typeof value !== 'string' || !value) {
    return null;
  }

  const tryEncode = candidate => {
    if (typeof candidate !== 'string' || !candidate) return null;
    try {
      return uppercasePercentEncoding(encodeURI(candidate));
    } catch (_) {
      return null;
    }
  };

  const encoded = tryEncode(value);
  if (encoded) return encoded;

  try {
    const parts = value.split('/');
    const encodedParts = parts.map((segment, index) => {
      if (index === 0 && segment === '') {
        return '';
      }
      return encodeURIComponent(segment);
    });
    const recombined = encodedParts.join('/');
    if (recombined) {
      return uppercasePercentEncoding(recombined);
    }
  } catch (_) {}

  try {
    let out = '';
    for (let index = 0; index < value.length;) {
      const char = value[index];
      if (char === '/') {
        out += char;
        index += 1;
        continue;
      }
      if (char === '%') {
        const nextTwo = value.slice(index + 1, index + 3);
        if (/^[0-9a-fA-F]{2}$/.test(nextTwo)) {
          out += `%${nextTwo.toUpperCase()}`;
          index += 3;
          continue;
        }
        out += '%25';
        index += 1;
        continue;
      }
      const codePoint = value.codePointAt(index);
      const character = String.fromCodePoint(codePoint);
      if (SAFE_PATH_CHARS.has(character)) {
        out += character;
        index += character.length;
        continue;
      }
      const bytes = Buffer.from(character);
      for (const byte of bytes) {
        out += `%${byte.toString(16).toUpperCase().padStart(2, '0')}`;
      }
      index += character.length;
    }
    if (out) {
      return out;
    }
  } catch (_) {}

  return null;
}

function lowercasePathPreservingPercentEncoding(value) {
  if (typeof value !== 'string' || !value) {
    return value;
  }
  return value.replace(/%[0-9A-F]{2}|[^%]+/g, segment =>
    segment.startsWith('%') ? segment : segment.toLowerCase(),
  );
}

function normalizePath(value) {
  if (typeof value !== 'string') return null;
  let path = value.trim();
  if (!path) return null;
  if (!path.startsWith('/')) path = '/' + path;
  path = path.replace(/[\\]+/g, '/');
  path = path.replace(/\/+/g, '/');
  path = path.replace(/\/index\.html?$/i, '/');
  if (/\.html?$/i.test(path)) {
    path = path.replace(/\.html?$/i, '');
    if (!path) path = '/';
  }
  if (path.length > 1 && path.endsWith('/')) {
    path = path.slice(0, -1);
  }
  if (!path) path = '/';
  const originalSanitized = uppercasePercentEncoding(path);
  const lowercasedSanitized = lowercasePathPreservingPercentEncoding(originalSanitized || '/');

  let decoded = path;
  try {
    decoded = decodeURI(path);
  } catch (error) {}
  if (typeof decoded === 'string') {
    decoded = decoded.toLowerCase();
  } else {
    decoded = String(path).toLowerCase();
  }

  let normalized = lowercasedSanitized;
  if (!normalized) {
    normalized = encodePathWithFallback(decoded || '/');
  }
  if (!normalized) {
    normalized = originalSanitized || '/';
  }

  if (/[^\u0000-\u007F]/.test(normalized)) {
    const ascii = encodePathWithFallback(normalized);
    if (ascii) {
      normalized = ascii;
    }
  }

  if (!normalized.startsWith('/')) {
    normalized = '/' + normalized;
  }
  if (normalized.length > 1 && normalized.endsWith('/')) {
    normalized = normalized.slice(0, -1);
  }
  if (!normalized) normalized = '/';
  if (normalized.length > 512) {
    normalized = normalized.slice(0, 512);
  }

  if (/[^A-Za-z0-9\-_.~!$&'()*+,;=:@/%]/.test(normalized)) {
    const reencoded = encodePathWithFallback(normalized);
    if (reencoded) {
      normalized = reencoded.startsWith('/') ? reencoded : `/${reencoded.replace(/^\/+/, '')}`;
    } else {
      normalized = originalSanitized || '/';
    }
    if (normalized.length > 1 && normalized.endsWith('/')) {
      normalized = normalized.slice(0, -1);
    }
  }

  normalized = lowercasePathPreservingPercentEncoding(uppercasePercentEncoding(normalized));

  return normalized;
}

function getStoragePathVariants(path) {
  const canonical = normalizePath(path);
  if (!canonical) return [];

  const seen = new Set();
  const ordered = [];
  const addVariant = candidate => {
    if (typeof candidate !== 'string' || !candidate) return;
    let variant = candidate;
    if (!variant.startsWith('/')) {
      variant = '/' + variant.replace(/^\\+/g, '');
    }
    if (variant.length > 1 && variant.endsWith('/')) {
      variant = variant.slice(0, -1);
    }
    if (!variant) {
      variant = '/';
    }
    if (!seen.has(variant)) {
      seen.add(variant);
      ordered.push(variant);
    }
  };

  addVariant(canonical);

  if (typeof path === 'string') {
    const trimmed = path.trim();
    if (trimmed) {
      addVariant(trimmed);
      const encodedOriginal = encodePathWithFallback(trimmed);
      if (encodedOriginal) {
        addVariant(encodedOriginal);
        addVariant(encodedOriginal.replace(/%[0-9A-F]{2}/g, match => match.toLowerCase()));
      }
    }
  }

  addVariant(canonical.replace(/%[0-9A-F]{2}/g, match => match.toLowerCase()));

  return ordered;
}

function decodeDisplayPath(path) {
  if (typeof path !== 'string') return null;
  let trimmed = path.trim();
  if (!trimmed) return null;
  if (!trimmed.startsWith('/')) {
    trimmed = '/' + trimmed.replace(/^\/+/g, '');
  }
  if (trimmed.length > 1 && trimmed.endsWith('/')) {
    trimmed = trimmed.slice(0, -1);
  }
  try {
    const decoded = decodeURI(trimmed);
    return decoded || '/';
  } catch (error) {
    return trimmed || '/';
  }
}

function ensureDisplayPath(entry) {
  if (!entry || typeof entry !== 'object') return entry;
  const existing = typeof entry.displayPath === 'string' ? entry.displayPath.trim() : '';
  if (existing) {
    entry.displayPath = existing.startsWith('/') ? existing : `/${existing.replace(/^\/+/g, '')}`;
    return entry;
  }
  const canonical = typeof entry.path === 'string' ? entry.path : null;
  if (!canonical) return entry;
  const decoded = decodeDisplayPath(canonical);
  if (decoded) {
    entry.displayPath = decoded;
  }
  return entry;
}

function makeKey(path) {
  return KEY_PREFIX + path;
}

function clone(value) {
  if (value == null) return value;
  const serialized = serializeExampleValue(value, new WeakMap());
  try {
    return JSON.parse(JSON.stringify(serialized));
  } catch (error) {
    return serialized;
  }
}

function sanitizeExamples(arr) {
  if (!Array.isArray(arr)) return [];
  return arr
    .filter(item => item && typeof item === 'object')
    .map(item => serializeExampleValue(item, new WeakMap()));
}

function sanitizeDeleted(list) {
  if (!Array.isArray(list)) return [];
  const seen = new Set();
  const out = [];
  list.forEach(value => {
    if (typeof value !== 'string') return;
    const trimmed = value.trim();
    if (!trimmed) return;
    if (seen.has(trimmed)) return;
    seen.add(trimmed);
    out.push(trimmed);
  });
  return out;
}

function buildEntry(path, payload) {
  const now = new Date().toISOString();
  const examples = sanitizeExamples(payload.examples);
  const deletedProvided = sanitizeDeleted(payload.deletedProvided);
  const entry = {
    path,
    displayPath: typeof payload.displayPath === 'string' ? payload.displayPath : undefined,
    examples,
    deletedProvided,
    updatedAt: typeof payload.updatedAt === 'string' ? payload.updatedAt : now
  };
  ensureDisplayPath(entry);
  return entry;
}

function annotateForMemory(entry) {
  if (!entry || typeof entry !== 'object') return entry;
  const annotated = applyStorageMetadata({ ...entry }, 'memory');
  ensureDisplayPath(annotated);
  return clone(annotated);
}

function getMemoryEntry(path) {
  const normalized = normalizePath(path);
  if (!normalized) return null;
  const stored = readFromMemory(normalized);
  if (!stored) return null;
  return annotateForMemory(stored);
}

function setMemoryEntry(path, payload) {
  const normalized = normalizePath(path);
  if (!normalized) return null;
  const entry = buildEntry(normalized, payload || {});
  const annotated = applyStorageMetadata({ ...entry }, 'memory');
  ensureDisplayPath(annotated);
  writeToMemory(normalized, annotated);
  return clone(annotated);
}

function deleteMemoryEntry(path) {
  const normalized = normalizePath(path);
  if (!normalized) return false;
  deleteFromMemory(normalized);
  return true;
}

function listMemoryEntries() {
  const entries = [];
  memoryIndex.forEach(path => {
    const normalized = normalizePath(path);
    if (!normalized) return;
    const stored = readFromMemory(normalized);
    if (!stored) return;
    const annotated = applyStorageMetadata({ ...stored }, 'memory');
    ensureDisplayPath(annotated);
    entries.push(clone(annotated));
  });
  return entries;
}

async function writeToKv(path, entry) {
  const kv = await loadKvClient();
  const variants = getStoragePathVariants(path);
  if (!variants.length) {
    throw new KvOperationError(`Failed to derive storage key variants for path ${path}`);
  }
  const [canonicalPath, ...legacyPaths] = variants;
  const canonicalKey = makeKey(canonicalPath);
  try {
    await kv.set(canonicalKey, entry);
    await kv.sadd(INDEX_KEY, canonicalPath);
  } catch (error) {
    throw new KvOperationError(`Failed to write entry to KV for path ${canonicalPath}`, { cause: error });
  }
  try {
    const verification = await kv.get(canonicalKey);
    if (verification == null) {
      throw new KvOperationError(`Failed to verify KV entry after writing path ${canonicalPath}`, {
        code: 'KV_WRITE_VERIFICATION_FAILED'
      });
    }
  } catch (error) {
    if (error instanceof KvOperationError) {
      throw error;
    }
    throw new KvOperationError(`Failed to verify entry in KV for path ${canonicalPath}`, {
      cause: error,
      code: 'KV_WRITE_VERIFICATION_FAILED'
    });
  }
  if (legacyPaths.length > 0) {
    for (const legacyPath of legacyPaths) {
      const legacyKey = makeKey(legacyPath);
      try {
        await kv.del(legacyKey);
      } catch (_) {}
      try {
        await kv.srem(INDEX_KEY, legacyPath);
      } catch (_) {}
    }
  }
}

async function deleteFromKv(path) {
  const kv = await loadKvClient();
  const variants = getStoragePathVariants(path);
  if (!variants.length) {
    throw new KvOperationError(`Failed to derive storage key variants for path ${path}`);
  }
  for (const variant of variants) {
    const key = makeKey(variant);
    try {
      await kv.del(key);
    } catch (error) {
      throw new KvOperationError(`Failed to delete entry in KV for path ${variant}`, { cause: error });
    }
    try {
      await kv.srem(INDEX_KEY, variant);
    } catch (_) {}
  }
}

async function readFromKv(path) {
  const kv = await loadKvClient();
  const variants = getStoragePathVariants(path);
  if (!variants.length) return null;
  const [canonicalPath, ...otherPaths] = variants;
  const canonicalKey = makeKey(canonicalPath);
  const candidateKeys = [canonicalKey, ...otherPaths.map(makeKey)];
  for (let i = 0; i < candidateKeys.length; i++) {
    const key = candidateKeys[i];
    try {
      const value = await kv.get(key);
      if (value == null) continue;
      if (i > 0) {
        try {
          await kv.set(canonicalKey, value);
          await kv.del(key);
        } catch (_) {}
        try {
          await kv.sadd(INDEX_KEY, canonicalPath);
          await kv.srem(INDEX_KEY, variants[i]);
        } catch (_) {}
      }
      if (typeof value === 'string') {
        try {
          return JSON.parse(value);
        } catch (error) {
          throw new KvOperationError('Failed to parse KV entry payload', { cause: error });
        }
      }
      if (typeof value === 'object') {
        return value;
      }
      throw new KvOperationError('Unsupported KV entry payload type', {
        code: 'KV_UNSUPPORTED_VALUE_TYPE'
      });
    } catch (error) {
      if (error instanceof KvOperationError) {
        throw error;
      }
      throw new KvOperationError(`Failed to read entry from KV for path ${variants[i]}`, { cause: error });
    }
  }
  return null;
}

function writeToMemory(path, entry) {
  const key = makeKey(path);
  memoryStore.set(key, clone(entry));
  memoryIndex.add(path);
}

function deleteFromMemory(path) {
  const key = makeKey(path);
  memoryStore.delete(key);
  memoryIndex.delete(path);
}

function readFromMemory(path) {
  const key = makeKey(path);
  const value = memoryStore.get(key);
  return value ? clone(value) : null;
}

async function getEntry(path) {
  const normalized = normalizePath(path);
  if (!normalized) return null;
  const storeMode = getStoreMode();
  const useKv = storeMode === 'kv';
  if (useKv) {
    const kvValue = await readFromKv(normalized);
    if (kvValue) {
      const entry = buildEntry(normalized, kvValue);
      applyStorageMetadata(entry, 'kv');
      ensureDisplayPath(entry);
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
    ensureDisplayPath(entry);
    return entry;
  }
  return null;
}

async function setEntry(path, payload) {
  const normalized = normalizePath(path);
  if (!normalized) return null;
  const entry = buildEntry(normalized, payload || {});
  const storeMode = getStoreMode();
  if (storeMode === 'kv') {
    await writeToKv(normalized, entry);
    const annotated = applyStorageMetadata({ ...entry }, 'kv');
    ensureDisplayPath(annotated);
    writeToMemory(normalized, annotated);
    return clone(annotated);
  }
  const annotated = applyStorageMetadata(entry, storeMode);
  ensureDisplayPath(annotated);
  writeToMemory(normalized, annotated);
  return clone(annotated);
}

async function deleteEntry(path) {
  const normalized = normalizePath(path);
  if (!normalized) return false;
  const storeMode = getStoreMode();
  if (storeMode === 'kv') {
    await deleteFromKv(normalized);
  }
  deleteFromMemory(normalized);
  return true;
}

async function listEntries() {
  const entries = [];
  const storeMode = getStoreMode();
  if (storeMode === 'kv') {
    const kv = await loadKvClient();
    let paths = [];
    try {
      const raw = await kv.smembers(INDEX_KEY);
      if (Array.isArray(raw)) paths = raw;
    } catch (error) {
      throw new KvOperationError('Failed to read index from KV', { cause: error });
    }
    for (const value of paths) {
      const normalized = normalizePath(value);
      if (!normalized) continue;
      const stored = await readFromKv(normalized);
      if (!stored) continue;
      const entry = buildEntry(normalized, stored);
      applyStorageMetadata(entry, 'kv');
      ensureDisplayPath(entry);
      writeToMemory(normalized, entry);
      entries.push(clone(entry));
    }
    return entries;
  }
  memoryIndex.forEach(path => {
    const normalized = normalizePath(path);
    if (!normalized) return;
    const stored = readFromMemory(normalized);
    if (!stored) return;
    const annotated = applyStorageMetadata(stored, storeMode);
    ensureDisplayPath(annotated);
    entries.push(clone(annotated));
  });
  return entries;
}

async function seedMemoryStoreWithDefaults(options = {}) {
  const resolvedOptions = options && typeof options === 'object' ? options : {};
  const overwriteExisting = resolvedOptions.overwriteExisting === true;
  const allowedPaths = Array.isArray(resolvedOptions.paths)
    ? new Set(
        resolvedOptions.paths
          .map(value => normalizePath(value))
          .filter(Boolean)
      )
    : null;

  let loadDefaultsFn = null;
  try {
    const defaultsModule = require('./examples-defaults');
    if (defaultsModule && typeof defaultsModule.loadDefaultExampleEntries === 'function') {
      loadDefaultsFn = defaultsModule.loadDefaultExampleEntries;
    }
  } catch (error) {
    if (resolvedOptions.throwOnError) {
      throw error;
    }
    return [];
  }

  if (typeof loadDefaultsFn !== 'function') {
    return [];
  }

  let defaults = [];
  try {
    defaults = await loadDefaultsFn();
  } catch (error) {
    if (resolvedOptions.throwOnError) {
      throw error;
    }
    return [];
  }

  const seeded = [];
  for (const entry of defaults) {
    if (!entry || typeof entry !== 'object') continue;
    const targetPath = normalizePath(entry.path);
    if (!targetPath) continue;
    if (allowedPaths && !allowedPaths.has(targetPath)) continue;
    if (!overwriteExisting) {
      const existing = readFromMemory(targetPath);
      if (existing) continue;
    }
    const payload = {
      examples: Array.isArray(entry.examples) ? clone(entry.examples) : [],
      deletedProvided: Array.isArray(entry.deletedProvided) ? entry.deletedProvided.slice() : [],
      updatedAt: typeof entry.updatedAt === 'string' ? entry.updatedAt : undefined
    };
    const stored = setMemoryEntry(entry.path, payload);
    if (stored) {
      seeded.push(stored);
    }
  }
  return seeded;
}

module.exports = {
  normalizePath,
  getEntry,
  setEntry,
  deleteEntry,
  listEntries,
  KvOperationError,
  KvConfigurationError,
  isKvConfigured,
  getStoreMode,
  getMemoryEntry,
  setMemoryEntry,
  deleteMemoryEntry,
  listMemoryEntries,
  seedMemoryStoreWithDefaults,
  __serializeExampleValue: value => serializeExampleValue(value, new WeakMap()),
  __deserializeExampleValue: value => deserializeExampleValue(value, new WeakMap())
};
