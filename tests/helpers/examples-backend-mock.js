'use strict';

const { normalizePath } = require('../../api/_lib/examples-store');

const DEFAULT_HEADERS = { 'Content-Type': 'application/json' };

function clone(value) {
  if (value == null) return value;
  try {
    return JSON.parse(JSON.stringify(value));
  } catch (error) {
    return value;
  }
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
  const storage = typeof payload.storage === 'string' ? payload.storage : 'memory';
  return {
    rawPath,
    canonicalPath,
    data: {
      path: canonicalPath,
      examples,
      deletedProvided,
      updatedAt,
      storage
    },
    provided
  };
}

function createEventTracker() {
  const queue = new Map();
  const waiters = new Map();
  const normalize = value => normalizePath(value) || normalizePath('/') || '/';
  const push = (path, payload) => {
    const key = normalize(path);
    const pending = waiters.get(key);
    if (pending && pending.length > 0) {
      const resolve = pending.shift();
      resolve(payload);
      return;
    }
    const existing = queue.get(key) || [];
    existing.push(payload);
    queue.set(key, existing);
  };
  const wait = path => {
    const key = normalize(path);
    const existing = queue.get(key);
    if (existing && existing.length > 0) {
      return Promise.resolve(existing.shift());
    }
    return new Promise(resolve => {
      const pending = waiters.get(key) || [];
      pending.push(resolve);
      waiters.set(key, pending);
    });
  };
  return { push, wait };
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

async function attachExamplesBackendMock(context, initialState = {}, sharedStore) {
  const store = ensureStore(sharedStore);
  const history = [];
  const putEvents = createEventTracker();
  const deleteEvents = createEventTracker();
  let requestFailureFactory = null;

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
        headers: DEFAULT_HEADERS,
        body: JSON.stringify({ error: 'Invalid request URL' })
      });
      return;
    }
    const rawPath = url.searchParams.get('path');
    const normalizedPath = rawPath ? normalizePath(rawPath) : null;

    if (requestFailureFactory) {
      const buildFailure = () => {
        try {
          const produced = typeof requestFailureFactory === 'function'
            ? requestFailureFactory({ route, request, rawPath, normalizedPath })
            : requestFailureFactory;

          if (produced instanceof Error) {
            return {
              status: typeof produced.status === 'number' ? produced.status : undefined,
              message: produced.message || 'Mock backend failure'
            };
          }

          if (produced && typeof produced === 'object') {
            if ('abort' in produced) {
              return { type: 'abort', errorCode: typeof produced.abort === 'string' ? produced.abort : 'failed' };
            }
            if ('body' in produced || 'status' in produced || 'headers' in produced) {
              return {
                status: typeof produced.status === 'number' ? produced.status : undefined,
                headers: produced.headers,
                body: produced.body,
                message: 'error' in produced ? String(produced.error || 'Mock backend failure') : undefined
              };
            }
            if ('error' in produced) {
              return {
                status: typeof produced.status === 'number' ? produced.status : undefined,
                message: String(produced.error || 'Mock backend failure')
              };
            }
          }

          if (produced == null) {
            return { message: 'Mock backend failure' };
          }

          return { message: String(produced) };
        } catch (error) {
          return {
            status: typeof error.status === 'number' ? error.status : 500,
            message: error.message || 'Mock backend failure'
          };
        }
      };

      const failure = buildFailure() || {};
      if (failure && failure.type === 'abort') {
        await route.abort(failure.errorCode || 'failed');
      } else {
        const status = typeof failure.status === 'number' ? failure.status : 503;
        const headers = {
          ...DEFAULT_HEADERS,
          ...(failure && failure.headers ? failure.headers : {})
        };
        const message = failure && failure.message ? failure.message : 'Mock backend failure';
        let body = failure && 'body' in failure ? failure.body : undefined;
        if (body == null) {
          body = { error: message };
        }
        if (!Buffer.isBuffer(body) && typeof body !== 'string') {
          body = JSON.stringify(body);
        }
        await route.fulfill({ status, headers, body });
      }
      return;
    }

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

    if (method === 'GET') {
      if (!rawPath) {
        const entries = Array.from(store.canonical.values())
          .filter(record => record.promoted)
          .map(record => clone(record.data));
        recordHistory('GET', { entries: entries.map(entry => entry.path) });
        await route.fulfill({ status: 200, headers: DEFAULT_HEADERS, body: JSON.stringify({ entries }) });
        return;
      }
      const direct = store.raw.get(rawPath);
      if (direct) {
        recordHistory('GET', { hit: true });
        await route.fulfill({ status: 200, headers: DEFAULT_HEADERS, body: JSON.stringify(clone(direct.data)) });
        return;
      }
      const canonicalRecord = normalizedPath ? store.canonical.get(normalizedPath) : null;
      if (canonicalRecord && canonicalRecord.promoted) {
        recordHistory('GET', { hit: true });
        await route.fulfill({ status: 200, headers: DEFAULT_HEADERS, body: JSON.stringify(clone(canonicalRecord.data)) });
        return;
      }
      recordHistory('GET', { hit: false });
      await route.fulfill({ status: 404, headers: DEFAULT_HEADERS, body: JSON.stringify({ error: 'Not Found' }) });
      return;
    }

    if (method === 'DELETE') {
      if (!rawPath) {
        recordHistory('DELETE', { error: 'Missing path' });
        await route.fulfill({ status: 400, headers: DEFAULT_HEADERS, body: JSON.stringify({ error: 'Missing path parameter' }) });
        return;
      }
      deleteEntry(rawPath);
      deleteEvents.push(rawPath, { path: normalizePath(rawPath) || rawPath, rawPath });
      recordHistory('DELETE', {});
      await route.fulfill({
        status: 200,
        headers: { ...DEFAULT_HEADERS, 'X-Examples-Storage-Result': 'memory' },
        body: JSON.stringify({ ok: true })
      });
      return;
    }

    if (method === 'POST' || method === 'PUT') {
      let body;
      try {
        body = JSON.parse(request.postData() || '{}');
      } catch (error) {
        recordHistory('PUT', { error: 'Invalid JSON' });
        await route.fulfill({ status: 400, headers: DEFAULT_HEADERS, body: JSON.stringify({ error: 'Invalid JSON body' }) });
        return;
      }
      const target = body && body.path ? normalizePath(body.path) : normalizedPath;
      if (!target) {
        recordHistory('PUT', { error: 'Missing path' });
        await route.fulfill({ status: 400, headers: DEFAULT_HEADERS, body: JSON.stringify({ error: 'Missing path' }) });
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
      const responseEntry = entry ? (() => {
        const { provided: _provided, ...rest } = entry;
        return rest;
      })() : { path: target, examples: payload.examples, deletedProvided: payload.deletedProvided };
      putEvents.push(target, { path: target, payload: clone(payload), entry: entry ? clone(entry) : undefined });
      recordHistory('PUT', { path: target, examples: payload.examples.length });
      await route.fulfill({
        status: 200,
        headers: { ...DEFAULT_HEADERS, 'X-Examples-Storage-Result': entry && entry.storage ? entry.storage : 'memory' },
        body: JSON.stringify(responseEntry)
      });
      return;
    }

    recordHistory('UNHANDLED', {});
    await route.fulfill({ status: 405, headers: DEFAULT_HEADERS, body: JSON.stringify({ error: 'Method Not Allowed' }) });
  };

  await context.addInitScript(() => {
    window.MATH_VISUALS_EXAMPLES_API_URL = '/api/examples';
  });
  await context.route('**/api/examples**', handleRequest);

  if (initialState && typeof initialState === 'object') {
    Object.entries(initialState).forEach(([path, payload]) => {
      const rawPath = typeof path === 'string' && path.trim() ? path.trim() : '/';
      const normalized = normalizePath(rawPath);
      const promote = rawPath === (normalized || rawPath);
      setEntry(rawPath, payload, { promote });
    });
  }

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
    waitForPut: path => putEvents.wait(path),
    waitForDelete: path => deleteEvents.wait(path),
    history,
    store,
    simulateOutage: (factory = () => {
      const error = new Error('Mock examples backend outage');
      error.status = 500;
      return error;
    }) => {
      requestFailureFactory = factory;
    },
    clearOutage: () => {
      requestFailureFactory = null;
    }
  };
}

module.exports = {
  attachExamplesBackendMock,
  normalizeExamplePath,
  computeExamplesStorageKey
};
