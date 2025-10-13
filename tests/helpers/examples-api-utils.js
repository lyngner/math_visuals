'use strict';

const { PassThrough } = require('stream');

const handler = require('../../api/examples');

function ensureObject(value) {
  return value && typeof value === 'object' ? value : {};
}

function toBuffer(value) {
  if (value == null) {
    return null;
  }
  if (Buffer.isBuffer(value)) {
    return value;
  }
  if (typeof value === 'string') {
    return Buffer.from(value);
  }
  return Buffer.from(String(value));
}

async function resetExamplesMemoryStore() {
  const listResponse = await invokeExamplesApi({ url: '/api/examples' });
  if (!listResponse || listResponse.statusCode !== 200) {
    return;
  }
  const entries = listResponse.json && Array.isArray(listResponse.json.entries)
    ? listResponse.json.entries
    : [];
  for (const entry of entries) {
    if (!entry || typeof entry.path !== 'string') continue;
    await invokeExamplesApi({
      method: 'DELETE',
      url: `/api/examples?path=${encodeURIComponent(entry.path)}`
    });
  }
}

function createMockResponse(resolve, reject) {
  const headers = {};
  const chunks = [];
  let ended = false;
  let statusCode = 200;

  return {
    get finished() {
      return ended;
    },
    get statusCode() {
      return statusCode;
    },
    set statusCode(value) {
      statusCode = value;
    },
    setHeader(name, value) {
      if (!name) return;
      headers[name] = value;
    },
    getHeader(name) {
      if (!name) return undefined;
      return headers[name];
    },
    write(chunk) {
      if (ended) return;
      const buffer = toBuffer(chunk);
      if (buffer) {
        chunks.push(buffer);
      }
    },
    end(chunk) {
      if (ended) return;
      ended = true;
      if (chunk) {
        const buffer = toBuffer(chunk);
        if (buffer) {
          chunks.push(buffer);
        }
      }
      const body = Buffer.concat(chunks);
      resolve({
        statusCode,
        headers: { ...headers },
        body
      });
    }
  };
}

function buildRequestStream({ method, url, headers, body }) {
  const req = new PassThrough();
  req.method = method || 'GET';
  req.url = url || '/api/examples';
  req.headers = {
    host: 'example.test',
    'x-forwarded-proto': 'http',
    ...ensureObject(headers)
  };
  const buffer = toBuffer(body);
  if (buffer) {
    req.end(buffer);
  } else {
    req.end();
  }
  return req;
}

async function runExamplesApi({ method = 'GET', url = '/api/examples', headers = {}, body = null } = {}) {
  return new Promise((resolve, reject) => {
    const request = buildRequestStream({ method, url, headers, body });
    const response = createMockResponse(resolve, reject);

    handler(request, response)
      .then(() => {
        if (!response.finished) {
          response.end();
        }
      })
      .catch(reject);
  });
}

async function invokeExamplesApi(options = {}) {
  const result = await runExamplesApi(options);
  let text = '';
  try {
    text = result.body ? result.body.toString('utf8') : '';
  } catch (error) {
    text = '';
  }
  let json = null;
  if (text) {
    try {
      json = JSON.parse(text);
    } catch (error) {}
  }
  return { ...result, text, json };
}

function normalizeHeaderValue(value) {
  if (Array.isArray(value)) {
    return value.map(item => String(item));
  }
  if (value == null) return undefined;
  return String(value);
}

function createExamplesApiRouteHandler(routeOptions = {}) {
  return async function handleExamplesRoute(route) {
    const request = route.request();
    const requestUrl = new URL(request.url());
    const relativeUrl = `${requestUrl.pathname}${requestUrl.search}`;
    const bodyBuffer = request.postDataBuffer();
    const headers = { ...request.headers(), host: requestUrl.host };

    const result = await runExamplesApi({
      method: request.method(),
      url: relativeUrl,
      headers,
      body: bodyBuffer || null,
      ...routeOptions
    });

    const headersForFulfill = {};
    Object.keys(result.headers || {}).forEach(name => {
      const value = normalizeHeaderValue(result.headers[name]);
      if (value !== undefined) {
        headersForFulfill[name] = value;
      }
    });

    await route.fulfill({
      status: result.statusCode,
      headers: headersForFulfill,
      body: result.body ? result.body.toString('utf8') : ''
    });
  };
}

module.exports = {
  invokeExamplesApi,
  runExamplesApi,
  createExamplesApiRouteHandler,
  resetExamplesMemoryStore
};
