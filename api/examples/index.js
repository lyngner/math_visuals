'use strict';

const { URL } = require('url');
const {
  normalizePath,
  getEntry,
  setEntry,
  deleteEntry,
  listEntries
} = require('../_lib/examples-store');

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
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS');

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
      if (queryPath) {
        const entry = await getEntry(queryPath);
        if (!entry) {
          sendJson(res, 404, { error: 'Not Found' });
          return;
        }
        sendJson(res, 200, entry);
        return;
      }
      const entries = await listEntries();
      sendJson(res, 200, { entries });
      return;
    }

    if (req.method === 'DELETE') {
      const target = queryPath;
      if (!target) {
        sendJson(res, 400, { error: 'Missing path parameter' });
        return;
      }
      await deleteEntry(target);
      sendJson(res, 200, { ok: true });
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
      const entry = await setEntry(target, payload);
      if (!entry) {
        sendJson(res, 500, { error: 'Failed to store entry' });
        return;
      }
      sendJson(res, 200, entry);
      return;
    }

    sendJson(res, 405, { error: 'Method Not Allowed' });
  } catch (error) {
    sendJson(res, 500, {
      error: 'Internal Server Error',
      message: error && error.message ? error.message : 'Unknown error'
    });
  }
};
