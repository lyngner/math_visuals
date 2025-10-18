'use strict';

const { normalizePath } = require('../../api/_lib/examples-store');

const DEFAULT_HEADERS = { 'Content-Type': 'application/json' };
let currentMode = 'kv';

function normalizeStoreMode(value) {
  if (typeof value !== 'string') return null;
  const normalized = value.trim().toLowerCase();
  if (!normalized) return null;
  if (normalized === 'kv' || normalized === 'vercel-kv') return 'kv';
  if (normalized === 'memory' || normalized === 'mem' || normalized === 'unconfigured') return 'memory';
  return null;
}

function buildModeMetadata(modeHint) {
  const resolved = normalizeStoreMode(modeHint) || currentMode;
  const storage = resolved === 'kv' ? 'kv' : 'memory';
  return {
    storage,
    mode: storage,
    persistent: storage === 'kv',
    ephemeral: storage !== 'kv'
  };
}

function decorateEntry(entry, modeHint) {
  if (!entry || typeof entry !== 'object') return entry;
  const metadata = buildModeMetadata(modeHint || entry.mode || entry.storage);
  return { ...entry, ...metadata };
}

function buildHeaders(modeHint, extra = {}) {
  const metadata = buildModeMetadata(modeHint);
  return { ...DEFAULT_HEADERS, 'X-Examples-Store-Mode': metadata.mode, ...extra };
}

function clone(value) {
  if (value == null) return value;
  if (typeof globalThis.structuredClone === 'function') {
    try {
      return globalThis.structuredClone(value);
    } catch (_) {}
  }
  try {
    return JSON.parse(JSON.stringify(value));
  } catch (_) {}
  return deepClone(value, new WeakMap());
}

function deepClone(value, seen) {
  if (value == null || typeof value !== 'object') {
    return value;
  }
  const tag = Object.prototype.toString.call(value);
  if (tag === '[object Date]') {
    return new Date(value.getTime());
  }
  if (tag === '[object RegExp]') {
    return new RegExp(value.source, value.flags);
  }
  if (seen.has(value)) {
    return seen.get(value);
  }
  if (Array.isArray(value)) {
    const arr = [];
    seen.set(value, arr);
    for (let i = 0; i < value.length; i++) {
      arr[i] = deepClone(value[i], seen);
    }
    return arr;
  }
  const cloneObj = {};
  seen.set(value, cloneObj);
  Object.keys(value).forEach(key => {
    cloneObj[key] = deepClone(value[key], seen);
  });
  return cloneObj;
}

function ensureStore(shared) {
  if (shared && typeof shared === 'object') {
    if (!(shared.raw instanceof Map)) {
      shared.raw = shared.raw instanceof Map ? shared.raw : new Map();
    }
    if (!(shared.canonical instanceof Map)) {
      shared.canonical = shared.canonical instanceof Map ? shared.canonical : new Map();
    }
    return shared;
  }
  return { raw: new Map(), canonical: new Map() };
}

function buildEntry(rawPath, payload) {
  const canonical = normalizePath(rawPath);
  const canonicalPath = canonical || '/';
  const examples = Array.isArray(payload.examples) ? clone(payload.examples) : [];
  const deletedProvided = Array.isArray(payload.deletedProvided) ? clone(payload.deletedProvided) : [];
  const provided = Array.isArray(payload.provided) ? clone(payload.provided) : [];
  const updatedAt = typeof payload.updatedAt === 'string' ? payload.updatedAt : new Date().toISOString();
  const metadata = buildModeMetadata(payload.mode || payload.storage);
  return {
    rawPath,
    canonicalPath,
    data: {
      path: canonicalPath,
      examples,
      deletedProvided,
      updatedAt,
      ...metadata
    },
    provided
  };
}

const DEFAULT_EVENT_WAIT_TIMEOUT = 20000;

function resolveTimeoutValue(timeout, defaultValue) {
  if (timeout === undefined) {
    return defaultValue;
  }
  if (timeout === Infinity) {
    return Infinity;
  }
  const numeric = Number(timeout);
  if (!Number.isFinite(numeric) || numeric <= 0) {
    return defaultValue;
  }
  return numeric;
}

function createEventTracker(options = {}) {
  const defaultTimeout = resolveTimeoutValue(options.defaultTimeout, DEFAULT_EVENT_WAIT_TIMEOUT);
  const queue = new Map();
  const waiters = new Map();
  const normalize = value => normalizePath(value) || normalizePath('/') || '/';
  const push = (path, payload) => {
    const key = normalize(path);
    const pending = waiters.get(key);
    if (pending && pending.length > 0) {
      const waiter = pending.shift();
      if (pending.length === 0) {
        waiters.delete(key);
      }
      waiter.resolve(payload);
      return;
    }
    const existing = queue.get(key) || [];
    existing.push(payload);
    queue.set(key, existing);
  };
  const wait = (path, options = {}) => {
    const key = normalize(path);
    const existing = queue.get(key);
    if (existing && existing.length > 0) {
      const next = existing.shift();
      if (existing.length === 0) {
        queue.delete(key);
      }
      return Promise.resolve(next);
    }
    return new Promise((resolve, reject) => {
      const pending = waiters.get(key) || [];
      let timeoutId = null;
      const resolvedTimeout = resolveTimeoutValue(options.timeout, defaultTimeout);
      const description = typeof options.description === 'string' && options.description.trim()
        ? options.description.trim()
        : '';
      const cleanup = () => {
        if (timeoutId) {
          clearTimeout(timeoutId);
          timeoutId = null;
        }
        const current = waiters.get(key);
        if (!current) {
          return;
        }
        const index = current.indexOf(entry);
        if (index !== -1) {
          current.splice(index, 1);
        }
        if (current.length === 0) {
          waiters.delete(key);
        }
      };
      const entry = {
        resolve: payload => {
          cleanup();
          resolve(payload);
        },
        reject: error => {
          cleanup();
          reject(error);
        }
      };
      pending.push(entry);
      waiters.set(key, pending);

      if (resolvedTimeout !== Infinity && resolvedTimeout > 0) {
        timeoutId = setTimeout(() => {
          const message = typeof options.timeoutMessage === 'string' && options.timeoutMessage.trim()
            ? options.timeoutMessage.trim()
            : `Timed out waiting for event for ${key}${description ? ` (${description})` : ''}`;
          entry.reject(new Error(message));
        }, resolvedTimeout);
      }
    });
  };
  const dispose = () => {
    queue.clear();
    waiters.forEach(entries => {
      entries.forEach(entry => {
        try {
          entry.reject(new Error('Event tracker disposed'));
        } catch (_) {}
      });
    });
    waiters.clear();
  };
  return { push, wait, dispose };
}

function normalizeExamplePath(value, options = {}) {
  if (options && options.preserveCase) {
    if (typeof value !== 'string') return '/';
    let path = value.trim();
    if (!path) return '/';
    if (!path.startsWith('/')) path = '/' + path;
    path = path.replace(/\+/g, '/');
    path = path.replace(/\/+/g, '/');
    path = path.replace(/\/index\.html?$/i, '/');
    if (/\.html?$/i.test(path)) {
      path = path.replace(/\.html?$/i, '');
      if (!path) path = '/';
    }
    if (path.length > 1 && path.endsWith('/')) {
      path = path.slice(0, -1);
    }
    if (!path) return '/';
    let decoded = path;
    try {
      decoded = decodeURI(path);
    } catch (error) {}
    let encoded = decoded;
    try {
      encoded = encodeURI(decoded);
    } catch (error) {
      encoded = path;
    }
    if (!encoded) return '/';
    const normalized = encoded.replace(/%[0-9a-f]{2}/gi, match => match.toUpperCase());
    return normalized;
  }
  const normalized = normalizePath(value);
  return normalized || '/';
}

function computeExamplesStorageKey(path, options = {}) {
  const normalized = normalizeExamplePath(path, options);
  return `examples_${normalized}`;
}

async function attachExamplesBackendMock(context, initialState = {}, sharedStoreOrOptions, maybeOptions) {
  let sharedStore = sharedStoreOrOptions;
  let options = maybeOptions;
  const sharedCandidate = sharedStoreOrOptions;
  const isSharedStoreCandidate =
    sharedCandidate &&
    typeof sharedCandidate === 'object' &&
    (sharedCandidate.raw instanceof Map || sharedCandidate.canonical instanceof Map);
  if (!isSharedStoreCandidate && sharedCandidate && typeof sharedCandidate === 'object' && maybeOptions === undefined) {
    options = sharedCandidate;
    sharedStore = undefined;
  }
  if (options && typeof options !== 'object') {
    options = undefined;
  }
  const usingSharedStore = Boolean(sharedStore);
  const store = ensureStore(sharedStore);
  const history = [];
  const putEvents = createEventTracker();
  const deleteEvents = createEventTracker();
  let requestFailureFactory = null;

  const applyRecordMode = (record, mode) => {
    if (!record || !record.data) return;
    const metadata = buildModeMetadata(mode);
    record.data = { ...record.data, ...metadata };
  };

  const synchronizeStoreMode = mode => {
    const resolved = normalizeStoreMode(mode) || currentMode;
    store.canonical.forEach(record => {
      applyRecordMode(record, resolved);
    });
  };

  const requestedMode = normalizeStoreMode(options && options.mode);
  currentMode = requestedMode || 'kv';
  synchronizeStoreMode(currentMode);

  const setEntry = (path, payload, options = {}) => {
    const rawPath = typeof path === 'string' && path.trim() ? path.trim() : '/';
    const entry = buildEntry(rawPath, payload || {});
    const canonicalKey = entry.canonicalPath;
    const providedList = Array.isArray(payload.provided) ? clone(payload.provided) : entry.provided;
    let record = store.canonical.get(canonicalKey);
    if (!record) {
      record = {
        data: entry.data,
        provided: providedList,
        rawPaths: new Set(),
        promoted: false
      };
    } else {
      record.data = entry.data;
      record.provided = providedList;
    }
    record.rawPaths = record.rawPaths || new Set();
    record.rawPaths.add(rawPath);
    const promote = options.promote !== undefined ? options.promote : rawPath === canonicalKey;
    if (promote) {
      record.promoted = true;
    }
    applyRecordMode(record, currentMode);
    store.canonical.set(canonicalKey, record);
    store.raw.set(rawPath, record);
  };

  const readEntry = path => {
    const rawPath = typeof path === 'string' && path.trim() ? path.trim() : '/';
    const direct = store.raw.get(rawPath);
    if (direct) {
      return {
        ...clone(direct.data),
        provided: clone(direct.provided)
      };
    }
    const normalized = normalizePath(rawPath);
    if (normalized && rawPath === normalized && store.canonical.has(normalized)) {
      const record = store.canonical.get(normalized);
      return {
        ...clone(record.data),
        provided: clone(record.provided)
      };
    }
    return undefined;
  };

  const deleteEntry = path => {
    const rawPath = typeof path === 'string' && path.trim() ? path.trim() : '/';
    const normalized = normalizePath(rawPath);
    let deleted = false;
    const record = store.raw.get(rawPath);
    if (record) {
      store.raw.delete(rawPath);
      if (record.rawPaths) {
        record.rawPaths.delete(rawPath);
      }
      deleted = true;
    }
    if (normalized && store.canonical.has(normalized)) {
      const canonicalRecord = store.canonical.get(normalized);
      if (rawPath === normalized) {
        store.canonical.delete(normalized);
        deleted = true;
      } else if (canonicalRecord && canonicalRecord.rawPaths && canonicalRecord.rawPaths.size === 0) {
        store.canonical.delete(normalized);
      }
    }
    return deleted;
  };

  const handleRequest = async route => {
    const request = route.request();
    const method = request.method();
    let url;
    try {
      url = new URL(request.url());
    } catch (error) {
      await route.fulfill({
        status: 400,
        headers: buildHeaders(),
        body: JSON.stringify({ error: 'Invalid request URL' })
      });
      return;
    }
    const rawPath = url.searchParams.get('path');
    const normalizedPath = rawPath ? normalizePath(rawPath) : null;

    const recordHistory = (type, payload) => {
      history.push({
        type,
        method,
        rawPath,
        path: normalizedPath,
        timestamp: Date.now(),
        ...payload
      });
    };

    if (requestFailureFactory) {
      const buildError = () => {
        try {
          const produced = typeof requestFailureFactory === 'function'
            ? requestFailureFactory({ route, request, rawPath, normalizedPath })
            : requestFailureFactory;
          if (produced instanceof Error) return produced;
          if (produced && typeof produced === 'object' && 'error' in produced) {
            const error = new Error(String(produced.error || 'Mock backend failure'));
            if (produced.status) error.status = produced.status;
            return error;
          }
          if (produced == null) return new Error('Mock backend failure');
          return produced instanceof Error ? produced : new Error(String(produced));
        } catch (error) {
          return error;
        }
      };

      const error = buildError();
      const numericStatus = typeof error.status === 'number' ? error.status : Number(error.status);
      const status = Number.isFinite(numericStatus) && numericStatus >= 400 ? numericStatus : 503;
      const message = error && typeof error.message === 'string'
        ? error.message
        : String(error || 'Mock backend failure');

      const failurePayload = { error: message, status };
      recordHistory('FAILURE', failurePayload);

      await route.fulfill({
        status,
        headers: buildHeaders(currentMode),
        body: JSON.stringify(failurePayload)
      });
      return;
    }

    if (method === 'GET') {
      if (!rawPath) {
        const entries = Array.from(store.canonical.values())
          .filter(record => record.promoted)
          .map(record => decorateEntry(clone(record.data)));
        recordHistory('GET', { entries: entries.map(entry => entry.path) });
        const metadata = buildModeMetadata();
        await route.fulfill({
          status: 200,
          headers: buildHeaders(metadata.mode),
          body: JSON.stringify({ ...metadata, entries })
        });
        return;
      }
      const direct = store.raw.get(rawPath);
      if (direct) {
        recordHistory('GET', { hit: true });
        const payload = decorateEntry(clone(direct.data));
        await route.fulfill({
          status: 200,
          headers: buildHeaders(payload.mode),
          body: JSON.stringify(payload)
        });
        return;
      }
      const canonicalRecord = normalizedPath ? store.canonical.get(normalizedPath) : null;
      if (canonicalRecord && canonicalRecord.promoted) {
        recordHistory('GET', { hit: true });
        const payload = decorateEntry(clone(canonicalRecord.data));
        await route.fulfill({
          status: 200,
          headers: buildHeaders(payload.mode),
          body: JSON.stringify(payload)
        });
        return;
      }
      recordHistory('GET', { hit: false });
      await route.fulfill({
        status: 404,
        headers: buildHeaders(),
        body: JSON.stringify({ error: 'Not Found' })
      });
      return;
    }

    if (method === 'DELETE') {
      if (!rawPath) {
        recordHistory('DELETE', { error: 'Missing path' });
        await route.fulfill({
          status: 400,
          headers: buildHeaders(),
          body: JSON.stringify({ error: 'Missing path parameter' })
        });
        return;
      }
      deleteEntry(rawPath);
      deleteEvents.push(rawPath, { path: normalizePath(rawPath) || rawPath, rawPath });
      recordHistory('DELETE', {});
      const metadata = buildModeMetadata();
      await route.fulfill({
        status: 200,
        headers: buildHeaders(metadata.mode, { 'X-Examples-Storage-Result': metadata.mode }),
        body: JSON.stringify({ ok: true, ...metadata })
      });
      return;
    }

    if (method === 'POST' || method === 'PUT') {
      let body;
      try {
        body = JSON.parse(request.postData() || '{}');
      } catch (error) {
        recordHistory('PUT', { error: 'Invalid JSON' });
        await route.fulfill({
          status: 400,
          headers: buildHeaders(),
          body: JSON.stringify({ error: 'Invalid JSON body' })
        });
        return;
      }
      const target = body && body.path ? normalizePath(body.path) : normalizedPath;
      if (!target) {
        recordHistory('PUT', { error: 'Missing path' });
        await route.fulfill({
          status: 400,
          headers: buildHeaders(),
          body: JSON.stringify({ error: 'Missing path' })
        });
        return;
      }
      const payload = {
        examples: Array.isArray(body.examples) ? body.examples : [],
        deletedProvided: Array.isArray(body.deletedProvided) ? body.deletedProvided : [],
        updatedAt: typeof body.updatedAt === 'string' ? body.updatedAt : undefined,
        storage: typeof body.storage === 'string' ? body.storage : undefined
      };
      setEntry(target, { ...payload, provided: body && Array.isArray(body.provided) ? body.provided : undefined }, { promote: true });
      const entry = readEntry(target);
      const responseEntry = toApiEntry(target) || decorateEntry({
        path: target,
        examples: payload.examples,
        deletedProvided: payload.deletedProvided
      });
      putEvents.push(target, { path: target, payload: clone(payload), entry: entry ? clone(entry) : undefined });
      recordHistory('PUT', { path: target, examples: payload.examples.length });
      await route.fulfill({
        status: 200,
        headers: buildHeaders(responseEntry.mode, { 'X-Examples-Storage-Result': responseEntry.mode }),
        body: JSON.stringify(responseEntry)
      });
      return;
    }

    recordHistory('UNHANDLED', {});
    await route.fulfill({
      status: 405,
      headers: buildHeaders(),
      body: JSON.stringify({ error: 'Method Not Allowed' })
    });
  };

  await context.addInitScript(() => {
    window.MATH_VISUALS_EXAMPLES_API_URL = '/api/examples';
  });
  const routePattern = '**/api/examples**';
  await context.route(routePattern, handleRequest);

  if (initialState && typeof initialState === 'object') {
    Object.entries(initialState).forEach(([path, payload]) => {
      const rawPath = typeof path === 'string' && path.trim() ? path.trim() : '/';
      const normalized = normalizePath(rawPath);
      const promote = rawPath === (normalized || rawPath);
      setEntry(rawPath, payload, { promote });
    });
  }

  function toApiEntry(path) {
    const entry = readEntry(path);
    if (!entry) return undefined;
    const { provided: _provided, ...rest } = entry;
    return decorateEntry(rest);
  }

  const client = {
    async list() {
      const entries = Array.from(store.canonical.entries())
        .filter(([, record]) => record && record.promoted)
        .map(([, record]) => decorateEntry(clone(record.data)));
      return { ...buildModeMetadata(), entries };
    },
    async get(path) {
      return toApiEntry(path);
    },
    async put(path, payload) {
      const rawPath = typeof path === 'string' && path.trim() ? path.trim() : '/';
      const normalized = normalizePath(rawPath);
      const target = normalized || rawPath;
      const entryPayload = {
        examples: Array.isArray(payload && payload.examples) ? payload.examples : [],
        deletedProvided: Array.isArray(payload && payload.deletedProvided) ? payload.deletedProvided : [],
        updatedAt: typeof (payload && payload.updatedAt) === 'string' ? payload.updatedAt : new Date().toISOString(),
        provided: payload && Array.isArray(payload.provided) ? payload.provided : undefined
      };
      setEntry(target, entryPayload, { promote: true });
      const entry = readEntry(target);
      putEvents.push(target, { path: target, payload: clone(entryPayload), entry: entry ? clone(entry) : undefined });
      return toApiEntry(target);
    },
    async delete(path) {
      const rawPath = typeof path === 'string' && path.trim() ? path.trim() : '/';
      deleteEntry(rawPath);
      deleteEvents.push(rawPath, { path: normalizePath(rawPath) || rawPath, rawPath });
      return { ok: true, ...buildModeMetadata() };
    }
  };

  const setMode = mode => {
    const normalized = normalizeStoreMode(mode);
    if (!normalized) return currentMode;
    currentMode = normalized;
    synchronizeStoreMode(currentMode);
    return currentMode;
  };

  return {
    seed: (path, payload, options) => {
      const rawPath = typeof path === 'string' && path.trim() ? path.trim() : '/';
      const normalized = normalizePath(rawPath);
      const promote = options && typeof options.promote === 'boolean'
        ? options.promote
        : rawPath === (normalized || rawPath);
      setEntry(rawPath, payload, { promote });
    },
    read: readEntry,
    waitForPut: (path, options) => putEvents.wait(path, options),
    waitForDelete: (path, options) => deleteEvents.wait(path, options),
    history,
    store,
    client,
    setMode,
    useMemoryMode: () => setMode('memory'),
    usePersistentMode: () => setMode('kv'),
    getMode: () => currentMode,
    simulateOutage: (factory = () => {
      const error = new Error('Mock examples backend outage');
      error.status = 500;
      return error;
    }) => {
      requestFailureFactory = factory;
    },
    clearOutage: () => {
      requestFailureFactory = null;
    },
    dispose: async () => {
      requestFailureFactory = null;
      if (putEvents && typeof putEvents.dispose === 'function') {
        try {
          putEvents.dispose();
        } catch (_) {}
      }
      if (deleteEvents && typeof deleteEvents.dispose === 'function') {
        try {
          deleteEvents.dispose();
        } catch (_) {}
      }
      if (history && history.length) {
        history.length = 0;
      }
      if (!usingSharedStore && store) {
        try {
          store.raw && typeof store.raw.clear === 'function' && store.raw.clear();
        } catch (_) {}
        try {
          store.canonical && typeof store.canonical.clear === 'function' && store.canonical.clear();
        } catch (_) {}
      }
      if (context && typeof context.unroute === 'function') {
        try {
          await context.unroute(routePattern, handleRequest);
        } catch (_) {}
      }
    }
  };
}

module.exports = {
  attachExamplesBackendMock,
  normalizeExamplePath,
  computeExamplesStorageKey
};
