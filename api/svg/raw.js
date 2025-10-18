'use strict';

const { URL } = require('url');
const {
  normalizeSlug,
  resolveCanonicalSlug,
  getSvg,
  getStoreMode
} = require('../_lib/svg-store');

const SVG_CONTENT_TYPE = 'image/svg+xml; charset=utf-8';
const PNG_CONTENT_TYPE = 'image/png';
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

function resolveAssetFromQuery(req, url) {
  const candidates = [];
  if (url) {
    const pathParam = url.searchParams.get('path') || url.searchParams.get('slug') || url.searchParams.get('s');
    if (pathParam) candidates.push(pathParam);
  }
  if (req && typeof req.query === 'object' && req.query) {
    if (typeof req.query.path === 'string') candidates.push(req.query.path);
    if (typeof req.query.slug === 'string') candidates.push(req.query.slug);
  }
  for (const candidate of candidates) {
    const normalized = normalizeSlug(candidate);
    if (!normalized) continue;
    const extensionMatch = normalized.match(/\.([a-z0-9]+)$/i);
    let canonicalSlug = null;
    let format = 'svg';
    if (extensionMatch) {
      const extension = extensionMatch[1].toLowerCase();
      if (extension === 'png') {
        const base = normalized.replace(/\.png$/i, '');
        const svgPath = `${base}.svg`;
        canonicalSlug = resolveCanonicalSlug(svgPath) || normalizeSlug(svgPath);
        format = 'png';
      } else if (extension === 'svg') {
        canonicalSlug = resolveCanonicalSlug(normalized) || normalized;
        format = 'svg';
      } else {
        continue;
      }
    } else {
      const svgPath = `${normalized}.svg`;
      canonicalSlug = resolveCanonicalSlug(svgPath) || normalizeSlug(svgPath);
      format = 'svg';
    }
    if (!canonicalSlug) continue;
    return {
      slug: canonicalSlug,
      format,
      requested: normalized
    };
  }
  return null;
}

function extractPngBuffer(pngString) {
  if (typeof pngString !== 'string') return null;
  const trimmed = pngString.trim();
  if (!trimmed) return null;
  const dataUrlMatch = trimmed.match(/^data:image\/png(?:;[^,]*)?,(.*)$/i);
  const base64 = dataUrlMatch ? dataUrlMatch[1] : trimmed;
  try {
    return Buffer.from(base64, 'base64');
  } catch (error) {
    return null;
  }
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

  const asset = resolveAssetFromQuery(req, url);
  if (!asset || !asset.slug) {
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
    const entry = await getSvg(asset.slug);
    if (!entry) {
      sendNotFound(res);
      return;
    }

    if (asset.format === 'png') {
      const buffer = extractPngBuffer(entry.png);
      if (!buffer || !buffer.length) {
        sendNotFound(res);
        return;
      }

      applyModeHeaders(res, entry.mode || entry.storageMode || entry.storage);
      applyCacheHeader(res, entry);
      res.setHeader('Content-Type', PNG_CONTENT_TYPE);
      res.setHeader('Content-Length', buffer.length);
      res.setHeader('X-Svg-Slug', entry.slug || asset.slug);
      res.setHeader('X-Svg-Asset-Format', 'png');

      res.statusCode = 200;
      if (req.method === 'HEAD') {
        res.end();
        return;
      }
      res.end(buffer);
      return;
    }

    const svgContent = typeof entry.svg === 'string' ? entry.svg : '';
    if (!svgContent.length) {
      sendNotFound(res);
      return;
    }

    applyModeHeaders(res, entry.mode || entry.storageMode || entry.storage);
    applyCacheHeader(res, entry);
    res.setHeader('Content-Type', SVG_CONTENT_TYPE);
    res.setHeader('X-Svg-Slug', entry.slug || asset.slug);
    res.setHeader('X-Svg-Asset-Format', 'svg');

    res.statusCode = 200;
    if (req.method === 'HEAD') {
      res.end();
      return;
    }
    res.end(svgContent);
  } catch (error) {
    res.statusCode = 500;
    res.setHeader('Content-Type', 'application/json');
    res.end(
      JSON.stringify({
        error: 'Failed to load asset',
        message: error && error.message ? error.message : 'Unknown error'
      })
    );
  }
};
