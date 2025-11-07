'use strict';

const { PassThrough } = require('stream');

const handler = require('../../api/figure-library');

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
  req.url = url || '/api/figure-library';
  req.headers = {
    host: 'figure-library.test',
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

async function runFigureLibraryApi({ method = 'GET', url = '/api/figure-library', headers = {}, body = null } = {}) {
  return new Promise((resolve, reject) => {
    const request = buildRequestStream({ method, url, headers, body });
    const response = createMockResponse(resolve, reject);

    Promise.resolve(handler(request, response))
      .then(() => {
        if (!response.finished) {
          response.end();
        }
      })
      .catch(reject);
  });
}

async function invokeFigureLibraryApi(options = {}) {
  const result = await runFigureLibraryApi(options);
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
    } catch (error) {
      json = null;
    }
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

function createFigureLibraryRouteHandler(routeOptions = {}) {
  return async function handleFigureLibraryRoute(route) {
    const request = route.request();
    const requestUrl = new URL(request.url());
    const relativeUrl = `${requestUrl.pathname}${requestUrl.search}`;
    const bodyBuffer = request.postDataBuffer();
    const headers = { ...request.headers(), host: requestUrl.host };

    const result = await runFigureLibraryApi({
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

function clearFigureLibraryMemoryStores() {
  const maps = [
    '__FIGURE_LIBRARY_MEMORY_STORE__',
    '__FIGURE_LIBRARY_CATEGORY_STORE__',
    '__SVG_MEMORY_STORE__'
  ];
  const sets = [
    '__FIGURE_LIBRARY_MEMORY_INDEX__',
    '__FIGURE_LIBRARY_CATEGORY_INDEX__',
    '__SVG_MEMORY_INDEX__'
  ];

  maps.forEach(key => {
    const value = global[key];
    if (value && typeof value.clear === 'function') {
      value.clear();
    }
  });

  sets.forEach(key => {
    const value = global[key];
    if (value && typeof value.clear === 'function') {
      value.clear();
    }
  });
}

module.exports = {
  runFigureLibraryApi,
  invokeFigureLibraryApi,
  createFigureLibraryRouteHandler,
  clearFigureLibraryMemoryStores
};
