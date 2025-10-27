'use strict';

const crypto = require('crypto');
const {
  getSettings,
  setSettings,
  resetSettings,
  getStoreMode,
  KvConfigurationError,
  KvOperationError
} = require('../_lib/settings-store');

function readJsonBody(req) {
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', chunk => {
      data += chunk;
      if (data.length > 2 * 1024 * 1024) {
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

function applyStoreHeaders(res, mode) {
  if (!res || typeof res.setHeader !== 'function') return;
  if (mode) {
    res.setHeader('X-Settings-Storage-Mode', mode);
    res.setHeader('X-Settings-Storage-Persistent', mode === 'kv' ? '1' : '0');
  }
}

function normalizePayload(body) {
  if (body && typeof body === 'object' && body.settings && typeof body.settings === 'object') {
    return body.settings;
  }
  return body;
}

function resolveMutationToken() {
  const token =
    process.env.MATH_VISUALS_SETTINGS_MUTATION_TOKEN ||
    process.env.SETTINGS_MUTATION_TOKEN ||
    process.env.SETTINGS_API_TOKEN ||
    '';
  const trimmed = typeof token === 'string' ? token.trim() : '';
  return trimmed ? trimmed : null;
}

function extractProvidedToken(req) {
  if (!req || !req.headers) return null;
  const header = req.headers.authorization;
  if (typeof header === 'string') {
    const match = /^Bearer\s+(.+)$/i.exec(header);
    if (match && match[1]) {
      return match[1].trim();
    }
  }
  const alternative = req.headers['x-math-visuals-settings-token'];
  if (typeof alternative === 'string' && alternative.trim()) {
    return alternative.trim();
  }
  return null;
}

function authorizeMutation(req, res) {
  const expectedToken = resolveMutationToken();
  if (!expectedToken) {
    sendJson(res, 503, { error: 'Settings persistence is not configured' });
    return false;
  }
  const providedToken = extractProvidedToken(req);
  if (!providedToken) {
    res.setHeader('WWW-Authenticate', 'Bearer realm="math-visuals-settings"');
    sendJson(res, 401, { error: 'Unauthorized' });
    return false;
  }
  try {
    const expected = Buffer.from(expectedToken, 'utf8');
    const provided = Buffer.from(providedToken, 'utf8');
    if (expected.length !== provided.length) {
      throw new Error('Length mismatch');
    }
    if (crypto.timingSafeEqual(expected, provided)) {
      return true;
    }
  } catch (_) {}
  res.setHeader('WWW-Authenticate', 'Bearer realm="math-visuals-settings"');
  sendJson(res, 401, { error: 'Unauthorized' });
  return false;
}

module.exports = async function handler(req, res) {
  const origin = req.headers.origin || '*';
  res.setHeader('Access-Control-Allow-Origin', origin === 'null' ? '*' : origin);
  res.setHeader(
    'Access-Control-Allow-Headers',
    'Content-Type, Authorization, X-Math-Visuals-Settings-Token'
  );
  res.setHeader('Access-Control-Allow-Methods', 'GET,PUT,POST,DELETE,OPTIONS');
  res.setHeader('Vary', 'Origin');

  if (req.method === 'OPTIONS') {
    res.statusCode = 204;
    res.end();
    return;
  }

  try {
    if (req.method === 'GET') {
      const settings = await getSettings();
      const mode = getStoreMode();
      applyStoreHeaders(res, mode);
      sendJson(res, 200, { settings, storage: { mode, persistent: mode === 'kv' } });
      return;
    }
    if (req.method === 'PUT' || req.method === 'POST') {
      if (!authorizeMutation(req, res)) {
        return;
      }
      const body = await readJsonBody(req);
      const payload = normalizePayload(body);
      const updated = await setSettings(payload);
      const mode = getStoreMode();
      applyStoreHeaders(res, mode);
      sendJson(res, 200, { settings: updated, storage: { mode, persistent: mode === 'kv' } });
      return;
    }
    if (req.method === 'DELETE') {
      if (!authorizeMutation(req, res)) {
        return;
      }
      const reset = await resetSettings();
      const mode = getStoreMode();
      applyStoreHeaders(res, mode);
      sendJson(res, 200, { settings: reset, storage: { mode, persistent: mode === 'kv' }, reset: true });
      return;
    }
    sendJson(res, 405, { error: 'Method Not Allowed' });
  } catch (error) {
    if (error instanceof KvConfigurationError) {
      applyStoreHeaders(res, 'memory');
      const fallback = await resetSettings();
      sendJson(res, 200, { settings: fallback, storage: { mode: 'memory', persistent: false } });
      return;
    }
    if (error instanceof KvOperationError) {
      applyStoreHeaders(res, getStoreMode());
      sendJson(res, 500, { error: 'Failed to persist settings' });
      return;
    }
    applyStoreHeaders(res, getStoreMode());
    sendJson(res, 500, { error: 'Internal Server Error' });
  }
};
