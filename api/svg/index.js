'use strict';

const { URL } = require('url');
const {
  normalizeSlug,
  resolveCanonicalSlug,
  getSvg,
  setSvg,
  deleteSvg,
  listSvgs,
  KvOperationError,
  KvConfigurationError,
  getStoreMode
} = require('../_lib/svg-store');

const MEMORY_LIMITATION_NOTE = 'Denne instansen bruker midlertidig minnelagring. SVG-er tilbakestilles når serveren starter på nytt.';

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
  res.setHeader('X-Svg-Store-Mode', metadata.mode);
  return metadata;
}

function applyStorageResultHeader(res, mode) {
  if (!res || typeof res.setHeader !== 'function') return;
  if (!mode) return;
  res.setHeader('X-Svg-Storage-Result', mode);
}

function applyModeHeaders(res, mode) {
  const metadata = applyStoreModeHeader(res, mode);
  if (metadata && metadata.mode) {
    applyStorageResultHeader(res, metadata.mode);
  }
  return metadata;
}

function parseAllowedOrigins() {
  const envValue = process.env.SVG_ALLOWED_ORIGINS || process.env.ALLOWED_ORIGINS || process.env.EXAMPLES_ALLOWED_ORIGINS;
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

function buildFileUrls(entry) {
  if (!entry || typeof entry !== 'object') return { files: {}, svgUrl: undefined, pngUrl: undefined };
  const slug = typeof entry.slug === 'string' ? entry.slug : '';
  const slugBase = typeof entry.slugBase === 'string' && entry.slugBase
    ? entry.slugBase
    : slug
      ? slug.replace(/\.svg$/i, '')
      : '';
  const pngSlug = typeof entry.pngSlug === 'string' && entry.pngSlug
    ? entry.pngSlug
    : slugBase
      ? `${slugBase}.png`
      : '';
  const svgUrl = slug ? `/bildearkiv/${slug}` : undefined;
  const pngUrl = pngSlug ? `/bildearkiv/${pngSlug}` : undefined;
  return {
    files: {
      svg: svgUrl,
      png: pngUrl
    },
    svgUrl,
    pngUrl,
    slugBase,
    pngSlug
  };
}

function augmentEntry(entry) {
  if (!entry || typeof entry !== 'object') return entry;
  const cloned = { ...entry };
  const { files, svgUrl, pngUrl, slugBase, pngSlug } = buildFileUrls(cloned);
  cloned.files = files;
  cloned.urls = files;
  if (svgUrl) cloned.svgUrl = svgUrl;
  if (pngUrl) cloned.pngUrl = pngUrl;
  if (slugBase && !cloned.slugBase) cloned.slugBase = slugBase;
  if (pngSlug && !cloned.pngSlug) cloned.pngSlug = pngSlug;
  return cloned;
}

function augmentEntries(entries) {
  if (!Array.isArray(entries)) return [];
  return entries.map(entry => augmentEntry(entry));
}

function extractSlugFromBody(body, fallback) {
  if (body && typeof body.slug === 'string') {
    const canonical = resolveCanonicalSlug(body.slug);
    if (canonical) return canonical;
    const normalized = normalizeSlug(body.slug);
    if (normalized) {
      const resolved = resolveCanonicalSlug(normalized);
      return resolved || normalized;
    }
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

  const querySlugInput = url.searchParams.get('slug');
  const querySlug = resolveCanonicalSlug(querySlugInput) || normalizeSlug(querySlugInput);

  try {
    if (req.method === 'GET') {
      if (querySlug) {
        const entry = await getSvg(querySlug);
        if (!entry) {
          const metadata = applyModeHeaders(res, currentMode);
          sendJson(res, 404, { error: 'Not Found', ...metadata });
          return;
        }
        const payload = augmentEntry(entry);
        applyModeHeaders(res, payload.mode);
        sendJson(res, 200, payload);
        return;
      }
      let entries = await listSvgs();
      if (!Array.isArray(entries)) {
        entries = [];
      }
      const effectiveMode = entries.length ? entries[0].mode : currentMode;
      const listMetadata = buildModeMetadata(effectiveMode);
      applyModeHeaders(res, listMetadata.mode);
      sendJson(res, 200, { ...listMetadata, entries: augmentEntries(entries) });
      return;
    }

    if (req.method === 'POST' || req.method === 'PUT') {
      let body;
      try {
        body = await readJsonBody(req);
      } catch (error) {
        sendJson(res, 400, { error: error.message || 'Invalid request body' });
        return;
      }
      const slugFromBody = extractSlugFromBody(body, querySlug);
      if (!slugFromBody) {
        sendJson(res, 400, { error: 'Slug is required' });
        return;
      }
      if (!body || typeof body.svg !== 'string' || !body.svg.length) {
        sendJson(res, 400, { error: 'SVG data is required' });
        return;
      }
      if (!body || typeof body.png !== 'string' || !body.png.length) {
        sendJson(res, 400, { error: 'PNG data is required' });
        return;
      }
      body.slug = slugFromBody;
      const stored = await setSvg(slugFromBody, body);
      if (!stored) {
        sendJson(res, 400, { error: 'Unable to store SVG entry' });
        return;
      }
      applyModeHeaders(res, stored.mode);
      sendJson(res, 200, augmentEntry(stored));
      return;
    }

    if (req.method === 'DELETE') {
      let body = null;
      if (!querySlug) {
        try {
          body = await readJsonBody(req);
        } catch (error) {
          sendJson(res, 400, { error: error.message || 'Invalid request body' });
          return;
        }
      }
      const targetSlug = querySlug || extractSlugFromBody(body);
      if (!targetSlug) {
        sendJson(res, 400, { error: 'Slug is required' });
        return;
      }
      const deleted = await deleteSvg(targetSlug);
      if (!deleted) {
        const metadata = applyModeHeaders(res, currentMode);
        sendJson(res, 404, { error: 'Not Found', ...metadata });
        return;
      }
      applyModeHeaders(res, currentMode);
      sendJson(res, 200, { ok: true, slug: targetSlug });
      return;
    }

    res.setHeader('Allow', 'GET,POST,PUT,DELETE,OPTIONS');
    sendJson(res, 405, { error: 'Method Not Allowed' });
  } catch (error) {
    if (error instanceof KvConfigurationError) {
      const metadata = applyModeHeaders(res, 'memory');
      sendJson(res, 503, { error: 'KV storage not configured', ...metadata });
      return;
    }
    if (error instanceof KvOperationError) {
      const metadata = applyModeHeaders(res, currentMode);
      sendJson(res, 502, { error: error.message || 'KV operation failed', ...metadata });
      return;
    }
    const metadata = applyModeHeaders(res, currentMode);
    sendJson(res, 500, { error: 'Internal Server Error', ...metadata });
  }
};
