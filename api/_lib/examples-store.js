'use strict';

const nodePath = require('path');
const fsPromises = require('fs/promises');

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
let kvConfigWarningLogged = false;

const FALLBACK_DATA_DIR = process.env.EXAMPLES_FALLBACK_DIR
  ? nodePath.resolve(process.cwd(), process.env.EXAMPLES_FALLBACK_DIR)
  : nodePath.join(process.cwd(), '.data');
const FALLBACK_DATA_FILE = process.env.EXAMPLES_FALLBACK_FILE
  ? nodePath.resolve(process.cwd(), process.env.EXAMPLES_FALLBACK_FILE)
  : nodePath.join(FALLBACK_DATA_DIR, 'examples-store.json');

let fallbackStoreLoaded = false;
let fallbackStoreLoading = null;
let fallbackPersistenceEnabled = true;

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

function isKvConfigured() {
  return Boolean(process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN);
}

function getStoreMode() {
  if (isKvConfigured()) return 'kv';
  return fallbackPersistenceEnabled ? 'file' : 'memory';
}

async function loadKvClient() {
  if (!isKvConfigured()) {
    if (!kvConfigWarningLogged) {
      kvConfigWarningLogged = true;
      console.warn('[examples-store] KV client not configured – using in-memory fallback');
    }
    return null;
  }
  if (!kvClientPromise) {
    kvClientPromise = import('@vercel/kv').then(mod => mod && mod.kv ? mod.kv : null).catch(() => null);
  }
  return kvClientPromise;
}

async function ensureFallbackDirectoryExists() {
  if (!fallbackPersistenceEnabled) return false;
  try {
    await fsPromises.mkdir(nodePath.dirname(FALLBACK_DATA_FILE), { recursive: true });
    return true;
  } catch (error) {
    fallbackPersistenceEnabled = false;
    console.warn('[examples-store] Failed to create fallback data directory', {
      path: FALLBACK_DATA_FILE,
      error
    });
    return false;
  }
}

async function loadFallbackStore() {
  if (fallbackStoreLoaded || !fallbackPersistenceEnabled) return;
  if (!fallbackStoreLoading) {
    fallbackStoreLoading = (async () => {
      try {
        const raw = await fsPromises.readFile(FALLBACK_DATA_FILE, 'utf8');
        let parsed = null;
        try {
          parsed = JSON.parse(raw);
        } catch (error) {
          console.warn('[examples-store] Failed to parse fallback data file', {
            path: FALLBACK_DATA_FILE,
            error
          });
          parsed = null;
        }
        if (parsed && Array.isArray(parsed.entries)) {
          memoryStore.clear();
          memoryIndex.clear();
          parsed.entries.forEach(item => {
            if (!item || typeof item !== 'object') return;
            const normalized = normalizePath(item.path);
            if (!normalized) return;
            const entry = buildEntry(normalized, item);
            entry.storage = 'file';
            writeToMemory(normalized, entry);
          });
        }
      } catch (error) {
        if (error && error.code === 'ENOENT') {
          // Missing file is fine; nothing to load yet.
        } else {
          fallbackPersistenceEnabled = false;
          console.warn('[examples-store] Failed to read fallback data file', {
            path: FALLBACK_DATA_FILE,
            error
          });
        }
      } finally {
        fallbackStoreLoaded = true;
        fallbackStoreLoading = null;
      }
    })();
  }
  return fallbackStoreLoading;
}

async function ensureFallbackLoaded() {
  if (isKvConfigured()) return;
  await loadFallbackStore();
}

async function persistFallbackStore() {
  if (isKvConfigured() || !fallbackPersistenceEnabled) {
    return false;
  }
  const dirReady = await ensureFallbackDirectoryExists();
  if (!dirReady) {
    return false;
  }
  const entries = [];
  memoryIndex.forEach(pathValue => {
    const normalized = normalizePath(pathValue);
    if (!normalized) return;
    const stored = readFromMemory(normalized);
    if (!stored) return;
    const cloneValue = clone(stored);
    cloneValue.storage = 'file';
    entries.push(cloneValue);
  });
  const payload = {
    version: 1,
    updatedAt: new Date().toISOString(),
    entries
  };
  try {
    await fsPromises.writeFile(FALLBACK_DATA_FILE, JSON.stringify(payload, null, 2), 'utf8');
    return true;
  } catch (error) {
    fallbackPersistenceEnabled = false;
    console.warn('[examples-store] Failed to persist fallback data file', {
      path: FALLBACK_DATA_FILE,
      error
    });
    return false;
  }
}

function normalizePath(value, options) {
  if (typeof value !== 'string') return null;
  const opts = options || {};
  const stripHtml = opts.stripHtml !== false;
  let path = value.trim();
  if (!path) return null;
  if (!path.startsWith('/')) path = '/' + path;
  path = path.replace(/[\\]+/g, '/');
  path = path.replace(/\/+/g, '/');
  path = path.replace(/\/index\.html?$/i, '/');
  if (stripHtml && /\.html?$/i.test(path)) {
    path = path.replace(/\.html?$/i, '');
    if (!path) path = '/';
  }
  if (path.length > 1 && path.endsWith('/')) {
    path = path.slice(0, -1);
  }
  if (!path) path = '/';
  if (path.length > 512) {
    path = path.slice(0, 512);
  }
  return path;
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
    examples,
    deletedProvided,
    updatedAt: typeof payload.updatedAt === 'string' ? payload.updatedAt : now
  };
  return entry;
}

async function writeToKv(path, entry) {
  const kv = await loadKvClient();
  if (!kv) return { ok: false, reason: 'unconfigured' };
  const key = makeKey(path);
  try {
    await kv.set(key, entry);
    await kv.sadd(INDEX_KEY, path);
    return { ok: true };
  } catch (error) {
    console.error('[examples-store] Failed to write entry to KV', { path, error });
    return { ok: false, reason: 'error', error };
  }
}

async function deleteFromKv(path) {
  const kv = await loadKvClient();
  if (!kv) return { ok: false, reason: 'unconfigured' };
  const key = makeKey(path);
  try {
    await kv.del(key);
    await kv.srem(INDEX_KEY, path);
    return { ok: true };
  } catch (error) {
    console.error('[examples-store] Failed to delete entry in KV', { path, error });
    return { ok: false, reason: 'error', error };
  }
}

async function readFromKv(path) {
  const kv = await loadKvClient();
  if (!kv) return null;
  const key = makeKey(path);
  try {
    const value = await kv.get(key);
    if (value == null) return null;
    if (typeof value === 'string') {
      try {
        return JSON.parse(value);
      } catch (error) {
        return null;
      }
    }
    if (typeof value === 'object') {
      return value;
    }
    return null;
  } catch (error) {
    console.error('[examples-store] Failed to read entry from KV', { path, error });
    return null;
  }
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

async function getEntry(path, options) {
  const normalized = normalizePath(path, options);
  if (!normalized) return null;
  await ensureFallbackLoaded();
  const kvValue = await readFromKv(normalized);
  if (kvValue) {
    const entry = buildEntry(normalized, kvValue);
    entry.storage = 'kv';
    writeToMemory(normalized, entry);
    return clone(entry);
  }
  const memoryValue = readFromMemory(normalized);
  if (memoryValue) {
    const entry = clone(memoryValue);
    entry.storage = entry.storage || 'memory';
    return entry;
  }
  return null;
}

async function setEntry(path, payload, options) {
  const normalized = normalizePath(path, options);
  if (!normalized) return null;
  await ensureFallbackLoaded();
  const entry = buildEntry(normalized, payload || {});
  const result = await writeToKv(normalized, entry);
  if (!result || result.reason === 'error') {
    throw new KvOperationError('Failed to write entry to KV', { cause: result && result.error });
  }
  if (result && result.ok) {
    entry.storage = 'kv';
    writeToMemory(normalized, entry);
    return clone(entry);
  }
  entry.storage = 'file';
  writeToMemory(normalized, entry);
  const persisted = await persistFallbackStore();
  if (!persisted) {
    entry.storage = 'memory';
    writeToMemory(normalized, entry);
  }
  return clone(entry);
}

async function deleteEntry(path, options) {
  const normalized = normalizePath(path, options);
  if (!normalized) return false;
  await ensureFallbackLoaded();
  const result = await deleteFromKv(normalized);
  if (!result || result.reason === 'error') {
    throw new KvOperationError('Failed to delete entry in KV', { cause: result && result.error });
  }
  deleteFromMemory(normalized);
  if (!result.ok) {
    await persistFallbackStore();
  }
  return true;
}

async function listEntries() {
  const kv = await loadKvClient();
  await ensureFallbackLoaded();
  const entries = [];
  if (kv) {
    let paths = [];
    try {
      const raw = await kv.smembers(INDEX_KEY);
      if (Array.isArray(raw)) paths = raw;
    } catch (error) {
      paths = [];
    }
    for (const value of paths) {
      const normalized = normalizePath(value);
      if (!normalized) continue;
      const stored = await readFromKv(normalized);
      if (!stored) continue;
      const entry = buildEntry(normalized, stored);
      entry.storage = 'kv';
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
    const entry = clone(stored);
    entry.storage = entry.storage || 'memory';
    entries.push(entry);
  });
  return entries;
}

module.exports = {
  normalizePath,
  getEntry,
  setEntry,
  deleteEntry,
  listEntries,
  KvOperationError,
  isKvConfigured,
  getStoreMode,
  __serializeExampleValue: value => serializeExampleValue(value, new WeakMap()),
  __deserializeExampleValue: value => deserializeExampleValue(value, new WeakMap())
};
