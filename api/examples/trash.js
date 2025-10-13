'use strict';

const { URL } = require('url');
const {
  getTrashEntries,
  setTrashEntries,
  appendTrashEntries,
  deleteTrashEntries,
  normalizePath,
  getEntry,
  getStoreMode,
  KvOperationError,
  KvConfigurationError
} = require('../_lib/examples-store');

const MEMORY_LIMITATION_NOTE =
  'Denne instansen bruker midlertidig minnelagring. Eksempler tilbakestilles når serveren starter på nytt.';

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

function normalizeTrashItem(entry) {
  if (!entry || typeof entry !== 'object') return null;
  const normalized = { ...entry };
  normalized.id = typeof entry.id === 'string' ? entry.id : null;
  normalized.deletedAt = typeof entry.deletedAt === 'string' ? entry.deletedAt : null;
  normalized.sourcePath = typeof entry.sourcePath === 'string' ? normalizePath(entry.sourcePath) : null;
  normalized.sourcePathRaw = typeof entry.sourcePathRaw === 'string' ? entry.sourcePathRaw : null;
  normalized.sourceHref = typeof entry.sourceHref === 'string' ? entry.sourceHref : null;
  normalized.sourceTitle = typeof entry.sourceTitle === 'string' ? entry.sourceTitle : '';
  normalized.reason = typeof entry.reason === 'string' ? entry.reason : 'delete';
  normalized.removedAtIndex = Number.isInteger(entry.removedAtIndex) ? entry.removedAtIndex : null;
  normalized.label = typeof entry.label === 'string' ? entry.label : null;
  normalized.importedFromHistory = entry.importedFromHistory === true;
  normalized.metadata = entry.metadata && typeof entry.metadata === 'object' ? entry.metadata : null;
  return normalized.id && normalized.example ? normalized : null;
}

async function augmentTrashEntries(entries) {
  if (!Array.isArray(entries)) return [];
  const sanitized = [];
  const pathSet = new Set();
  entries.forEach(entry => {
    const normalized = normalizeTrashItem(entry);
    if (!normalized) return;
    sanitized.push(normalized);
    if (typeof normalized.sourcePath === 'string' && normalized.sourcePath) {
      pathSet.add(normalized.sourcePath);
    }
  });
  const pathStatus = new Map();
  for (const path of pathSet) {
    try {
      const sourceEntry = await getEntry(path);
      const hasExamples = sourceEntry && Array.isArray(sourceEntry.examples) && sourceEntry.examples.length > 0;
      pathStatus.set(path, { sourceActive: hasExamples, sourceArchived: !hasExamples });
    } catch (error) {
      pathStatus.set(path, { sourceActive: false, sourceArchived: true });
    }
  }
  return sanitized.map(entry => {
    const status = entry.sourcePath ? pathStatus.get(entry.sourcePath) : null;
    return {
      ...entry,
      sourceActive: status ? status.sourceActive : false,
      sourceArchived: status ? status.sourceArchived : false
    };
  });
}

function buildTrashApiUrl(req) {
  try {
    const url = new URL(req.url, buildOrigin(req));
    return url;
  } catch (error) {
    return null;
  }
}

module.exports = async function handler(req, res) {
  const corsOrigin = resolveCorsOrigin(req);
  res.setHeader('Access-Control-Allow-Origin', corsOrigin);
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,DELETE,OPTIONS');
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

  const requestUrl = buildTrashApiUrl(req);
  if (!requestUrl) {
    sendJson(res, 400, { error: 'Invalid request URL' });
    return;
  }

  try {
    if (req.method === 'GET') {
      try {
        const entries = await getTrashEntries();
        const augmented = await augmentTrashEntries(entries);
        const metadata = applyModeHeaders(res, currentMode);
        sendJson(res, 200, { ...metadata, entries: augmented });
        return;
      } catch (error) {
        if (error instanceof KvConfigurationError) {
          const metadata = applyModeHeaders(res, 'memory');
          sendJson(res, 200, { ...metadata, entries: [] });
          return;
        }
        throw error;
      }
    }

    if (req.method === 'POST') {
      let body;
      try {
        body = await readJsonBody(req);
      } catch (error) {
        sendJson(res, 400, { error: error.message || 'Invalid request body' });
        return;
      }
      const entries = Array.isArray(body.entries) ? body.entries : [];
      const mode = typeof body.mode === 'string' ? body.mode : null;
      const limit = Number.isInteger(body.limit) ? body.limit : undefined;
      const replace = body.replace === true;
      try {
        const stored = replace
          ? await setTrashEntries(entries)
          : await appendTrashEntries(entries, { mode, limit });
        const augmented = await augmentTrashEntries(stored);
        const metadata = applyModeHeaders(res, currentMode);
        sendJson(res, 200, { ...metadata, entries: augmented });
        return;
      } catch (error) {
        if (error instanceof KvConfigurationError) {
          const metadata = applyModeHeaders(res, 'memory');
          sendJson(res, 503, { error: 'KVUnavailable', message: error.message, ...metadata });
          return;
        }
        throw error;
      }
    }

    if (req.method === 'DELETE') {
      let body;
      try {
        body = await readJsonBody(req);
      } catch (error) {
        sendJson(res, 400, { error: error.message || 'Invalid request body' });
        return;
      }
      const ids = Array.isArray(body.ids) ? body.ids : [];
      try {
        const result = await deleteTrashEntries(ids);
        const augmented = await augmentTrashEntries(result.entries);
        const metadata = applyModeHeaders(res, currentMode);
        sendJson(res, 200, { ...metadata, removed: result.removed, entries: augmented });
        return;
      } catch (error) {
        if (error instanceof KvConfigurationError) {
          const metadata = applyModeHeaders(res, 'memory');
          sendJson(res, 503, { error: 'KVUnavailable', message: error.message, ...metadata });
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
