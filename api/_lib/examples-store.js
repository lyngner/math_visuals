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
let kvConfigWarningLogged = false;

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

function normalizePath(value) {
  if (typeof value !== 'string') return null;
  let path = value.trim();
  if (!path) return null;
  if (!path.startsWith('/')) path = '/' + path;
  path = path.replace(/[\\]+/g, '/');
  path = path.replace(/\/+/g, '/');
  path = path.replace(/\/index\.html?$/i, '/');
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
  try {
    return JSON.parse(JSON.stringify(value));
  } catch (error) {
    return value;
  }
}

function sanitizeExamples(arr) {
  if (!Array.isArray(arr)) return [];
  return arr.filter(item => item && typeof item === 'object').map(item => clone(item));
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

async function getEntry(path) {
  const normalized = normalizePath(path);
  if (!normalized) return null;
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

async function setEntry(path, payload) {
  const normalized = normalizePath(path);
  if (!normalized) return null;
  const entry = buildEntry(normalized, payload || {});
  const result = await writeToKv(normalized, entry);
  if (!result || result.reason === 'error') {
    throw new KvOperationError('Failed to write entry to KV', { cause: result && result.error });
  }
  writeToMemory(normalized, entry);
  const output = clone(entry);
  output.storage = result && result.ok ? 'kv' : 'memory';
  return output;
}

async function deleteEntry(path) {
  const normalized = normalizePath(path);
  if (!normalized) return false;
  const result = await deleteFromKv(normalized);
  if (!result || result.reason === 'error') {
    throw new KvOperationError('Failed to delete entry in KV', { cause: result && result.error });
  }
  deleteFromMemory(normalized);
  return true;
}

async function listEntries() {
  const kv = await loadKvClient();
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
  isKvConfigured
};
