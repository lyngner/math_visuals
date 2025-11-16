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

const { toSafeEvent } = require('../../infra/api/runtime');

function createBaseEvent({ stage = '$default', path = '/api/examples' } = {}) {
  return {
    version: '2.0',
    rawPath: path,
    path,
    requestContext: {
      stage,
      routeKey: 'GET /api/examples',
      http: {
        path,
        method: 'GET',
        protocol: 'HTTP/1.1',
      },
    },
  };
}

const defaultStageEvent = createBaseEvent({ stage: '$default', path: '/api/examples' });
const defaultSafe = toSafeEvent(defaultStageEvent);
assert.equal(
  defaultSafe.path,
  '/api/examples',
  'Default stage events should keep their /api/examples path untouched',
);
assert.equal(
  defaultSafe.rawPath,
  '/api/examples',
  'Default stage rawPath should remain unmodified',
);
assert.equal(
  defaultSafe.requestContext.http.path,
  '/api/examples',
  'HTTP context path should remain unchanged for default stage events',
);

const stageName = 'prod';
const stagePath = `/${stageName}/api/examples`;
const stagedEvent = createBaseEvent({ stage: stageName, path: stagePath });
const stagedSafe = toSafeEvent(stagedEvent);
assert.equal(
  stagedSafe.path,
  '/api/examples',
  'Named stage events should remove the stage prefix from the path',
);
assert.equal(
  stagedSafe.rawPath,
  '/api/examples',
  'Named stage events should normalize rawPath to /api/examples',
);
assert.equal(
  stagedSafe.requestContext.http.path,
  '/api/examples',
  'Named stage events should update the HTTP context path to match Express expectations',
);

console.log('API runtime stage normalization tests passed');
