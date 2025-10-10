'use strict';

const { URL } = require('url');
const {
  normalizePath,
  getEntry,
  setEntry,
  deleteEntry,
  listEntries,
  KvOperationError,
  KvConfigurationError,
  getStoreMode,
  getMemoryEntry,
  setMemoryEntry,
  deleteMemoryEntry,
  listMemoryEntries
} = require('../_lib/examples-store');
const { loadDefaultExampleEntries } = require('../_lib/examples-defaults');

const MEMORY_LIMITATION_NOTE = 'Denne instansen bruker midlertidig minnelagring. Eksempler tilbakestilles når serveren starter på nytt.';

function normalizeStoreMode(value) {
  if (typeof value !== 'string') return null;
  const normalized = value.trim().toLowerCase();
  if (!normalized) return null;
  if (normalized === 'kv' || normalized === 'vercel-kv') return 'kv';
  if (normalized === 'memory' || normalized === 'mem' || normalized === 'unconfigured') return 'memory';
  return null;
}

function buildModeMetadata(modeHint) {
  const resolved = normalizeStoreMode(modeHint) || normalizeStoreMode(getStoreMode()) || 'memory';
  const storage = resolved === 'kv' ? 'kv' : 'memory';
  return {
    storage,
    mode: storage,
    storageMode: storage,
    persistent: storage === 'kv',
    ephemeral: storage !== 'kv',
    limitation: storage === 'memory' ? MEMORY_LIMITATION_NOTE : undefined
  };
}

function augmentEntry(entry, fallbackMode) {
  if (!entry || typeof entry !== 'object') {
    return buildModeMetadata(fallbackMode);
  }
  const metadata = buildModeMetadata(entry.mode || entry.storage || fallbackMode);
  return { ...entry, ...metadata };
}

function augmentEntries(entries, fallbackMode) {
  if (!Array.isArray(entries)) return [];
  return entries.map(entry => augmentEntry(entry, fallbackMode));
}

function applyStoreModeHeader(res, mode) {
  if (!res || typeof res.setHeader !== 'function') return;
  const metadata = buildModeMetadata(mode);
  res.setHeader('X-Examples-Store-Mode', metadata.mode);
  return metadata;
}

function applyStorageResultHeader(res, mode) {
  if (!res || typeof res.setHeader !== 'function') return;
  if (!mode) return;
  res.setHeader('X-Examples-Storage-Result', mode);
}

function applyModeHeaders(res, mode) {
  const metadata = applyStoreModeHeader(res, mode);
  if (metadata && metadata.mode) {
    applyStorageResultHeader(res, metadata.mode);
  }
  return metadata;
}

function parseAllowedOrigins() {
  const envValue = process.env.EXAMPLES_ALLOWED_ORIGINS || process.env.ALLOWED_ORIGINS;
  if (!envValue) return ['*'];
  return envValue
    .split(',')
    .map(value => value.trim())
    .filter(Boolean);
}

const allowedOrigins = parseAllowedOrigins();

function resolveCorsOrigin(req) {
  if (allowedOrigins.includes('*')) return '*';
  const requestOrigin = req.headers.origin;
  if (requestOrigin && allowedOrigins.includes(requestOrigin)) {
    return requestOrigin;
  }
  return allowedOrigins[0] || '*';
}

function readJsonBody(req) {
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', chunk => {
      data += chunk;
      if (data.length > 5 * 1024 * 1024) {
        reject(new Error('Request body too large'));
        req.destroy();
      }
    });
    req.on('end', () => {
      if (!data) {
        resolve({});
        return;
      }
      try {
        resolve(JSON.parse(data));
      } catch (error) {
        reject(Object.assign(new Error('Invalid JSON body'), { cause: error }));
      }
    });
    req.on('error', reject);
  });
}

function sendJson(res, statusCode, payload) {
  res.statusCode = statusCode;
  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify(payload));
}

function buildOrigin(req) {
  const protocol = req.headers['x-forwarded-proto'] || 'http';
  const host = req.headers.host || 'localhost';
  return `${protocol}://${host}`;
}

function extractPathFromBody(body, fallback) {
  if (body && typeof body.path === 'string') {
    const normalized = normalizePath(body.path);
    if (normalized) return normalized;
  }
  return fallback || null;
}

module.exports = async function handler(req, res) {
  const corsOrigin = resolveCorsOrigin(req);
  res.setHeader('Access-Control-Allow-Origin', corsOrigin);
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS');
  if (corsOrigin !== '*') {
    res.setHeader('Vary', 'Origin');
  }

  let currentMode = getStoreMode();
  const initialMetadata = applyStoreModeHeader(res, currentMode);
  if (initialMetadata && initialMetadata.mode) {
    currentMode = initialMetadata.mode;
  }

  if (req.method === 'OPTIONS') {
    res.statusCode = 204;
    res.end();
    return;
  }

  let url;
  try {
    url = new URL(req.url, buildOrigin(req));
  } catch (error) {
    sendJson(res, 400, { error: 'Invalid request URL' });
    return;
  }

  const queryPath = normalizePath(url.searchParams.get('path'));

  try {
    if (req.method === 'GET') {
      try {
        if (queryPath) {
          const entry = await getEntry(queryPath);
          if (!entry) {
            const metadata = applyModeHeaders(res, currentMode);
            sendJson(res, 404, { error: 'Not Found', ...metadata });
            return;
          }
          const payload = augmentEntry(entry, currentMode);
          applyModeHeaders(res, payload.mode);
          sendJson(res, 200, payload);
          return;
        }
        let entries = await listEntries();
        if (!Array.isArray(entries)) {
          entries = [];
        }
        if (!entries.length && normalizeStoreMode(currentMode) === 'memory') {
          const defaults = await loadDefaultExampleEntries();
          const seeded = [];
          for (const entry of defaults) {
            if (!entry || typeof entry !== 'object') continue;
            const { path, examples, deletedProvided } = entry;
            if (!path) continue;
            const stored = setMemoryEntry(path, { examples, deletedProvided });
            if (stored) {
              seeded.push(stored);
            }
          }
          if (seeded.length) {
            entries = seeded;
          }
        }
        const payloadEntries = augmentEntries(entries, currentMode);
        const effectiveMode = payloadEntries.length ? payloadEntries[0].mode : currentMode;
        const listMetadata = buildModeMetadata(effectiveMode);
        applyModeHeaders(res, listMetadata.mode);
        sendJson(res, 200, { ...listMetadata, entries: payloadEntries });
        return;
      } catch (error) {
        if (error instanceof KvConfigurationError) {
          const fallbackMode = 'memory';
          const metadata = applyModeHeaders(res, fallbackMode);
          if (queryPath) {
            const fallbackEntry = getMemoryEntry(queryPath);
            if (!fallbackEntry) {
              sendJson(res, 404, { error: 'Not Found', ...metadata });
              return;
            }
            const payload = augmentEntry(fallbackEntry, fallbackMode);
            sendJson(res, 200, payload);
            return;
          }
          const entries = listMemoryEntries();
          const payloadEntries = augmentEntries(entries, fallbackMode);
          sendJson(res, 200, { ...metadata, entries: payloadEntries });
          return;
        }
        throw error;
      }
    }

    if (req.method === 'DELETE') {
      const target = queryPath;
      if (!target) {
        sendJson(res, 400, { error: 'Missing path parameter' });
        return;
      }
      try {
        await deleteEntry(target);
        const metadata = applyModeHeaders(res, currentMode);
        sendJson(res, 200, { ok: true, ...metadata });
        return;
      } catch (error) {
        if (error instanceof KvConfigurationError) {
          deleteMemoryEntry(target);
          const metadata = applyModeHeaders(res, 'memory');
          sendJson(res, 200, { ok: true, ...metadata });
          return;
        }
        throw error;
      }
    }

    if (req.method === 'POST' || req.method === 'PUT') {
      let body;
      try {
        body = await readJsonBody(req);
      } catch (error) {
        sendJson(res, 400, { error: error.message || 'Invalid request body' });
        return;
      }
      const target = extractPathFromBody(body, queryPath);
      if (!target) {
        sendJson(res, 400, { error: 'Missing path' });
        return;
      }
      const payload = {
        examples: Array.isArray(body.examples) ? body.examples : [],
        deletedProvided: Array.isArray(body.deletedProvided) ? body.deletedProvided : [],
        updatedAt: typeof body.updatedAt === 'string' ? body.updatedAt : undefined
      };
      try {
        const entry = await setEntry(target, payload);
        const responseEntry = augmentEntry(entry, currentMode);
        applyModeHeaders(res, responseEntry.mode);
        sendJson(res, 200, responseEntry);
        return;
      } catch (error) {
        if (error instanceof KvConfigurationError) {
          const entry = setMemoryEntry(target, payload);
          const responseEntry = augmentEntry(entry, 'memory');
          applyModeHeaders(res, responseEntry.mode);
          sendJson(res, 200, responseEntry);
          return;
        }
        throw error;
      }
    }

    sendJson(res, 405, { error: 'Method Not Allowed' });
  } catch (error) {
    if (error instanceof KvConfigurationError) {
      const metadata = applyModeHeaders(res, 'memory');
      sendJson(res, 200, { ok: true, message: error.message, ...metadata });
      return;
    }
    if (error instanceof KvOperationError) {
      const metadata = applyModeHeaders(res, currentMode);
      sendJson(res, 503, {
        error: 'KVUnavailable',
        message: error.message,
        ...metadata
      });
      return;
    }
    sendJson(res, 500, {
      error: 'Internal Server Error',
      message: error && error.message ? error.message : 'Unknown error'
    });
  }
};
