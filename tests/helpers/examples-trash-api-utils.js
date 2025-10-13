'use strict';

const { PassThrough } = require('stream');

const handler = require('../../api/examples/trash');

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

function createMockResponse(resolve) {
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
  req.url = url || '/api/examples/trash';
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

async function runExamplesTrashApi({ method = 'GET', url = '/api/examples/trash', headers = {}, body = null } = {}) {
  return new Promise((resolve, reject) => {
    const request = buildRequestStream({ method, url, headers, body });
    const response = createMockResponse(resolve);

    handler(request, response)
      .then(() => {
        if (!response.finished) {
          response.end();
        }
      })
      .catch(reject);
  });
}

async function invokeExamplesTrashApi(options = {}) {
  const result = await runExamplesTrashApi(options);
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

module.exports = {
  runExamplesTrashApi,
  invokeExamplesTrashApi
};
