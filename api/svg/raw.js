'use strict';

const { URL } = require('url');
const {
  normalizeSlug,
  getSvg,
  getStoreMode
} = require('../_lib/svg-store');

const CONTENT_TYPE = 'image/svg+xml; charset=utf-8';
const SHORT_CACHE_HEADER = 'public, max-age=5, s-maxage=5, stale-while-revalidate=30';
const LONG_CACHE_HEADER = 'public, max-age=60, s-maxage=86400, stale-while-revalidate=43200';

function buildOrigin(req) {
  const protocol = req && req.headers ? req.headers['x-forwarded-proto'] || 'http' : 'http';
  const host = req && req.headers ? req.headers.host || 'localhost' : 'localhost';
  return `${protocol}://${host}`;
}

function applyModeHeaders(res, entryMode) {
  if (!res || typeof res.setHeader !== 'function') {
    return;
  }
  const mode = (entryMode || '').toString().trim().toLowerCase();
  const normalized = mode === 'kv' ? 'kv' : mode === 'memory' ? 'memory' : getStoreMode();
  if (normalized) {
    res.setHeader('X-Svg-Store-Mode', normalized);
  }
}

function applyCacheHeader(res, entry) {
  if (!res || typeof res.setHeader !== 'function') {
    return;
  }
  const persistent = Boolean(entry && (entry.persistent || entry.storage === 'kv' || entry.mode === 'kv'));
  const headerValue = persistent ? LONG_CACHE_HEADER : SHORT_CACHE_HEADER;
  res.setHeader('Cache-Control', headerValue);
}

function sendNotFound(res) {
  if (res.headersSent) return;
  res.statusCode = 404;
  res.setHeader('Content-Type', 'text/plain; charset=utf-8');
  res.setHeader('Cache-Control', SHORT_CACHE_HEADER);
  res.end('Not Found');
}

function resolveSlugFromQuery(req, url) {
  if (!url) {
    return null;
  }
  const pathParam = url.searchParams.get('path') || url.searchParams.get('slug') || url.searchParams.get('s');
  const normalizedFromQuery = normalizeSlug(pathParam);
  if (normalizedFromQuery) {
    return normalizedFromQuery;
  }
  if (req && typeof req.query === 'object' && req.query) {
    if (typeof req.query.path === 'string') {
      const normalizedFromReq = normalizeSlug(req.query.path);
      if (normalizedFromReq) {
        return normalizedFromReq;
      }
    }
    if (typeof req.query.slug === 'string') {
      const normalizedFromReqSlug = normalizeSlug(req.query.slug);
      if (normalizedFromReqSlug) {
        return normalizedFromReqSlug;
      }
    }
  }
  return null;
}

module.exports = async function handler(req, res) {
  let url;
  try {
    url = new URL(req.url, buildOrigin(req));
  } catch (error) {
    res.statusCode = 400;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ error: 'Invalid request URL' }));
    return;
  }

  const normalizedSlug = resolveSlugFromQuery(req, url);
  if (!normalizedSlug) {
    sendNotFound(res);
    return;
  }

  if (req.method !== 'GET' && req.method !== 'HEAD') {
    res.statusCode = 405;
    res.setHeader('Allow', 'GET, HEAD');
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ error: 'Method Not Allowed' }));
    return;
  }

  try {
    const entry = await getSvg(normalizedSlug);
    if (!entry || typeof entry.svg !== 'string' || entry.svg.length === 0) {
      sendNotFound(res);
      return;
    }

    applyModeHeaders(res, entry.mode || entry.storageMode || entry.storage);
    applyCacheHeader(res, entry);
    res.setHeader('Content-Type', CONTENT_TYPE);
    res.setHeader('X-Svg-Slug', entry.slug || normalizedSlug);

    res.statusCode = 200;
    if (req.method === 'HEAD') {
      res.end();
      return;
    }
    res.end(entry.svg);
  } catch (error) {
    res.statusCode = 500;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ error: 'Failed to load SVG', message: error && error.message ? error.message : 'Unknown error' }));
  }
};
