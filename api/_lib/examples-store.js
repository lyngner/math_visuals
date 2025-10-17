'use strict';

const KEY_PREFIX = 'examples:';
const INDEX_KEY = 'examples:__paths__';
const TRASH_KEY = 'examples:__trash__';
const MAX_TRASH_ENTRIES = 200;

const memoryStore = new Map();
const memoryIndex = new Set();
let memoryTrashEntries = [];

let kvClientPromise = null;
const INJECTED_KV_CLIENT_KEY = '__MATH_VISUALS_KV_CLIENT__';

function getInjectedKvClient() {
  if (typeof globalThis !== 'object' || !globalThis) {
    return null;
  }
  const injected = globalThis[INJECTED_KV_CLIENT_KEY];
  return injected ? injected : null;
}

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
      'Examples KV is not configured. Set KV_REST_API_URL and KV_REST_API_TOKEN to enable persistent storage.'
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
  let decoded = path;
  try {
    decoded = decodeURI(path);
  } catch (error) {}
  if (typeof decoded === 'string') {
    decoded = decoded.toLowerCase();
  } else {
    decoded = String(path).toLowerCase();
  }
  let encodedPath = null;
  try {
    encodedPath = encodeURI(decoded || '/');
  } catch (error) {
    try {
      const fallbackSource = typeof decoded === 'string' && decoded ? decoded : String(path || '/');
      encodedPath = encodeURI(fallbackSource);
    } catch (_) {
      encodedPath = typeof path === 'string' && path ? path : '/';
    }
  }
  let normalized = encodedPath;
  if (typeof normalized === 'string') {
    normalized = normalized.replace(/%[0-9a-f]{2}/gi, match => match.toUpperCase());
  }
  if (!normalized) normalized = '/';
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
  return normalized;
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

function generateTrashId() {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).slice(2, 10);
  return `${timestamp}-${random}`;
}

function sanitizeTrashEntry(entry) {
  if (!entry || typeof entry !== 'object') return null;
  const serializedExample = serializeExampleValue(entry.example, new WeakMap());
  if (!serializedExample) return null;
  const now = new Date().toISOString();
  const sourcePathRaw = typeof entry.sourcePath === 'string' ? entry.sourcePath.trim() : '';
  const normalizedPath = sourcePathRaw ? normalizePath(sourcePathRaw) : null;
  const trimmedHref = typeof entry.sourceHref === 'string' ? entry.sourceHref.trim() : '';
  const trimmedTitle = typeof entry.sourceTitle === 'string' ? entry.sourceTitle : '';
  const trimmedReason = typeof entry.reason === 'string' ? entry.reason.trim() : 'delete';
  const trimmedLabel = typeof entry.label === 'string' ? entry.label : '';
  const deletedAt = typeof entry.deletedAt === 'string' && entry.deletedAt.trim() ? entry.deletedAt.trim() : now;
  const id = typeof entry.id === 'string' && entry.id.trim() ? entry.id.trim() : generateTrashId();
  const sanitized = {
    id,
    example: serializedExample,
    deletedAt,
    sourcePath: normalizedPath || null,
    sourcePathRaw: sourcePathRaw && sourcePathRaw !== (normalizedPath || '') ? sourcePathRaw : null,
    sourceHref: trimmedHref || null,
    sourceTitle: trimmedTitle || '',
    reason: trimmedReason,
    removedAtIndex: Number.isInteger(entry.removedAtIndex) ? entry.removedAtIndex : null,
    label: trimmedLabel || null,
    importedFromHistory: entry.importedFromHistory === true
  };
  if (entry.metadata && typeof entry.metadata === 'object') {
    sanitized.metadata = serializeExampleValue(entry.metadata, new WeakMap());
  }
  return sanitized;
}

function sanitizeTrashEntries(entries) {
  if (!Array.isArray(entries)) return [];
  const sanitized = [];
  const seenIds = new Set();
  entries.forEach(entry => {
    const normalized = sanitizeTrashEntry(entry);
    if (!normalized) return;
    const id = normalized.id;
    if (seenIds.has(id)) return;
    seenIds.add(id);
    sanitized.push(normalized);
  });
  return sanitized;
}

function cloneTrashEntries(entries) {
  if (!Array.isArray(entries)) return [];
  return entries.map(entry => clone(entry));
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

function writeTrashToMemory(entries) {
  memoryTrashEntries = sanitizeTrashEntries(entries);
}

function readTrashFromMemory() {
  return cloneTrashEntries(memoryTrashEntries);
}

async function writeTrashToKv(entries) {
  const kv = await loadKvClient();
  try {
    await kv.set(TRASH_KEY, entries);
  } catch (error) {
    throw new KvOperationError('Failed to write trash entries to KV', { cause: error });
  }
  try {
    const verification = await kv.get(TRASH_KEY);
    if (verification == null) {
      throw new KvOperationError('Failed to verify trash entries in KV', {
        code: 'KV_WRITE_VERIFICATION_FAILED'
      });
    }
  } catch (error) {
    if (error instanceof KvOperationError) {
      throw error;
    }
    throw new KvOperationError('Unable to verify trash entries in KV', {
      cause: error,
      code: 'KV_WRITE_VERIFICATION_FAILED'
    });
  }
}

async function readTrashFromKv() {
  const kv = await loadKvClient();
  try {
    const value = await kv.get(TRASH_KEY);
    if (value == null) return [];
    if (Array.isArray(value)) return value;
    if (typeof value === 'string') {
      try {
        const parsed = JSON.parse(value);
        return Array.isArray(parsed) ? parsed : [];
      } catch (error) {
        throw new KvOperationError('Failed to parse trash entries from KV', { cause: error });
      }
    }
    if (typeof value === 'object' && value && Array.isArray(value.entries)) {
      return value.entries;
    }
    throw new KvOperationError('Unsupported KV payload for trash entries', {
      code: 'KV_UNSUPPORTED_VALUE_TYPE'
    });
  } catch (error) {
    if (error instanceof KvOperationError) {
      throw error;
    }
    throw new KvOperationError('Failed to read trash entries from KV', { cause: error });
  }
}

async function writeToKv(path, entry) {
  const kv = await loadKvClient();
  const key = makeKey(path);
  try {
    await kv.set(key, entry);
    await kv.sadd(INDEX_KEY, path);
  } catch (error) {
    throw new KvOperationError(`Failed to write entry to KV for path ${path}`, { cause: error });
  }
  try {
    const verification = await kv.get(key);
    if (verification == null) {
      throw new KvOperationError(`Failed to verify KV entry after writing path ${path}`, {
        code: 'KV_WRITE_VERIFICATION_FAILED'
      });
    }
  } catch (error) {
    if (error instanceof KvOperationError) {
      throw error;
    }
    throw new KvOperationError(`Failed to verify entry in KV for path ${path}`, {
      cause: error,
      code: 'KV_WRITE_VERIFICATION_FAILED'
    });
  }
}

async function deleteFromKv(path) {
  const kv = await loadKvClient();
  const key = makeKey(path);
  try {
    await kv.del(key);
    await kv.srem(INDEX_KEY, path);
  } catch (error) {
    throw new KvOperationError(`Failed to delete entry in KV for path ${path}`, { cause: error });
  }
}

async function readFromKv(path) {
  const kv = await loadKvClient();
  const key = makeKey(path);
  try {
    const value = await kv.get(key);
    if (value == null) return null;
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
    throw new KvOperationError(`Failed to read entry from KV for path ${path}`, { cause: error });
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
  const storeMode = getStoreMode();
  const useKv = storeMode === 'kv';
  if (useKv) {
    const kvValue = await readFromKv(normalized);
    if (kvValue) {
      const entry = buildEntry(normalized, kvValue);
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

async function setEntry(path, payload) {
  const normalized = normalizePath(path);
  if (!normalized) return null;
  const entry = buildEntry(normalized, payload || {});
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
    entries.push(clone(annotated));
  });
  return entries;
}

async function getTrashEntries() {
  const storeMode = getStoreMode();
  if (storeMode === 'kv') {
    const kvEntries = await readTrashFromKv();
    const sanitized = sanitizeTrashEntries(kvEntries);
    writeTrashToMemory(sanitized);
    return cloneTrashEntries(sanitized);
  }
  const memoryEntries = readTrashFromMemory();
  const sanitized = sanitizeTrashEntries(memoryEntries);
  writeTrashToMemory(sanitized);
  return cloneTrashEntries(sanitized);
}

async function setTrashEntries(entries) {
  const sanitized = sanitizeTrashEntries(entries).slice(0, MAX_TRASH_ENTRIES);
  const storeMode = getStoreMode();
  if (storeMode === 'kv') {
    await writeTrashToKv(sanitized);
    writeTrashToMemory(sanitized);
    return cloneTrashEntries(sanitized);
  }
  writeTrashToMemory(sanitized);
  return cloneTrashEntries(sanitized);
}

async function appendTrashEntries(entries, options) {
  const sanitizedNew = sanitizeTrashEntries(entries);
  if (!sanitizedNew.length) {
    return getTrashEntries();
  }
  const mode = options && options.mode === 'append' ? 'append' : 'prepend';
  const limit = Number.isInteger(options && options.limit)
    ? Math.max(1, options.limit)
    : MAX_TRASH_ENTRIES;
  const existing = await getTrashEntries();
  const existingList = Array.isArray(existing) ? existing : [];
  if (mode === 'append') {
    const entriesById = new Map();
    const appendedWithoutId = [];

    sanitizedNew.forEach(entry => {
      if (!entry || typeof entry !== 'object') return;
      const id = typeof entry.id === 'string' ? entry.id : null;
      if (id) {
        entriesById.set(id, entry);
        return;
      }
      appendedWithoutId.push(entry);
    });

    existingList.forEach(entry => {
      if (!entry || typeof entry !== 'object') return;
      const id = typeof entry.id === 'string' ? entry.id : null;
      if (!id || entriesById.has(id)) {
        return;
      }
      entriesById.set(id, entry);
    });

    const deduped = [];
    const usedIds = new Set();

    existingList.forEach(entry => {
      if (!entry || typeof entry !== 'object') return;
      const id = typeof entry.id === 'string' ? entry.id : null;
      if (!id) {
        deduped.push(entry);
        return;
      }
      if (entriesById.has(id) && !usedIds.has(id)) {
        deduped.push(entriesById.get(id));
        usedIds.add(id);
      }
    });

    appendedWithoutId.forEach(entry => {
      deduped.push(entry);
    });

    sanitizedNew.forEach(entry => {
      if (!entry || typeof entry !== 'object') return;
      const id = typeof entry.id === 'string' ? entry.id : null;
      if (!id || usedIds.has(id) || !entriesById.has(id)) {
        return;
      }
      deduped.push(entriesById.get(id));
      usedIds.add(id);
    });

    const truncated = deduped.slice(-limit);
    return setTrashEntries(truncated);
  }

  const combined = sanitizedNew.concat(existingList);
  const deduped = [];
  const seen = new Set();
  combined.forEach(entry => {
    if (!entry || typeof entry !== 'object') return;
    const id = typeof entry.id === 'string' ? entry.id : null;
    if (id && seen.has(id)) return;
    if (id) seen.add(id);
    deduped.push(entry);
  });
  const truncated = deduped.slice(0, limit);
  return setTrashEntries(truncated);
}

async function deleteTrashEntries(ids) {
  const values = Array.isArray(ids) ? ids : [ids];
  const targets = new Set();
  values.forEach(value => {
    if (typeof value !== 'string') return;
    const trimmed = value.trim();
    if (trimmed) {
      targets.add(trimmed);
    }
  });
  if (targets.size === 0) {
    const entries = await getTrashEntries();
    return { removed: 0, entries };
  }
  const existing = await getTrashEntries();
  const remaining = [];
  let removed = 0;
  existing.forEach(entry => {
    if (!entry || typeof entry.id !== 'string') {
      remaining.push(entry);
      return;
    }
    if (targets.has(entry.id)) {
      removed += 1;
      return;
    }
    remaining.push(entry);
  });
  const updated = await setTrashEntries(remaining);
  return { removed, entries: updated };
}

module.exports = {
  normalizePath,
  getEntry,
  setEntry,
  deleteEntry,
  listEntries,
  getTrashEntries,
  setTrashEntries,
  appendTrashEntries,
  deleteTrashEntries,
  KvOperationError,
  KvConfigurationError,
  isKvConfigured,
  getStoreMode,
  __serializeExampleValue: value => serializeExampleValue(value, new WeakMap()),
  __deserializeExampleValue: value => deserializeExampleValue(value, new WeakMap())
};
