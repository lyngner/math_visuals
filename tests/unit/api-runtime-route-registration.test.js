const assert = require('node:assert/strict');
const path = require('node:path');
const Module = require('node:module');

const stubModuleRoot = path.resolve(__dirname, 'stubs', 'modules');
if (!process.env.NODE_PATH || !process.env.NODE_PATH.includes(stubModuleRoot)) {
  process.env.NODE_PATH = process.env.NODE_PATH
    ? `${process.env.NODE_PATH}:${stubModuleRoot}`
    : stubModuleRoot;
  Module._initPaths();
}

const fixtureApiRoot = path.resolve(__dirname, 'fixtures', 'api-runtime', 'api');
process.env.API_RUNTIME_API_ROOT = fixtureApiRoot;

const runtime = require('../../infra/api/runtime');
const internals = runtime.__internals || {};
assert.ok(
  internals && typeof internals.createApp === 'function',
  'Runtime should expose createApp to unit tests',
);

const app = internals.createApp();
const handlers = Array.isArray(app.handlers) ? app.handlers : [];
assert.ok(handlers.length > 0, 'Expected the fixture API root to register at least one handler');

const widgetHandlers = handlers.filter(entry => entry && typeof entry.path === 'string' && entry.path.startsWith('/api/widgets'));
assert.equal(
  widgetHandlers.length,
  2,
  'The widgets handler should register canonical and trailing slash routes',
);

const canonical = widgetHandlers.find(entry => entry.path === '/api/widgets');
assert.ok(canonical, 'Canonical /api/widgets route should be present');

function createMockRequest(method) {
  return {
    method,
    headers: {
      origin: 'https://example.test',
    },
  };
}

function createMockResponse() {
  return {
    statusCode: 200,
    headers: {},
    writableEnded: false,
    headersSent: false,
    body: '',
    setHeader(key, value) {
      this.headers[key] = value;
    },
    getHeader(key) {
      return this.headers[key];
    },
    end(payload = '') {
      this.body = payload;
      this.writableEnded = true;
      this.headersSent = true;
    },
  };
}

async function invoke(handler, req, res) {
  await handler(req, res, err => {
    if (err) {
      throw err;
    }
  });
}

(async () => {
  const optionsRes = createMockResponse();
  await invoke(canonical.handler, createMockRequest('OPTIONS'), optionsRes);
  assert.equal(optionsRes.statusCode, 204, 'OPTIONS responses should use the status set by the handler');
  assert.equal(
    optionsRes.headers['Access-Control-Allow-Origin'],
    'https://example.test',
    'CORS headers should match the handler output',
  );
  assert.equal(
    optionsRes.headers['Access-Control-Allow-Methods'],
    'GET,POST,OPTIONS',
    'CORS method list should be preserved',
  );
  assert.ok(optionsRes.writableEnded, 'Wrapped handlers must end the response for OPTIONS');

  const getRes = createMockResponse();
  await invoke(canonical.handler, createMockRequest('GET'), getRes);
  assert.equal(getRes.statusCode, 200, 'GET requests should forward the handler status code');
  assert.equal(getRes.headers['Content-Type'], 'application/json', 'Content-Type header should be kept');
  assert.equal(getRes.body, '{"ok":true,"method":"GET"}', 'Response body should match the handler output');

  console.log('API runtime route registration tests passed');
})().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
