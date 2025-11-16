const assert = require('node:assert/strict');
const Module = require('node:module');

const originalLoad = Module._load;
const moduleStubs = {
  express: () => {
    const noop = () => {};
    return {
      disable: noop,
      set: noop,
      use: noop,
      all: noop,
    };
  },
  '@vendia/serverless-express': () => () => ({ statusCode: 200 }),
};

Module._load = function patchedLoad(request, parent, isMain) {
  if (moduleStubs[request]) {
    return moduleStubs[request];
  }
  return originalLoad(request, parent, isMain);
};

const runtime = require('../../infra/api/runtime');

Module._load = originalLoad;

if (!runtime || !runtime.__INTERNALS__ || typeof runtime.__INTERNALS__.toSafeEvent !== 'function') {
  throw new Error('Runtime internals for testing could not be loaded.');
}

const { toSafeEvent } = runtime.__INTERNALS__;

function buildEvent({ stage, rawPath, path, httpPath }) {
  return {
    rawPath,
    path,
    requestContext: {
      stage,
      http: {
        method: 'GET',
        path: httpPath,
        protocol: 'HTTP/1.1',
      },
    },
  };
}

const eventWithStage = buildEvent({
  stage: 'prod',
  rawPath: '/prod/api/examples',
  path: '/prod/api/examples',
  httpPath: '/prod/api/examples',
});

const normalized = toSafeEvent(eventWithStage);
assert.equal(normalized.rawPath, '/api/examples', 'rawPath should drop the stage prefix');
assert.equal(normalized.path, '/api/examples', 'path should drop the stage prefix');
assert.equal(
  normalized.requestContext.http.path,
  '/api/examples',
  'requestContext.http.path should match the normalized path',
);

const eventWithDecoratedStage = buildEvent({
  stage: ' /Prod/ ',
  rawPath: '/Prod/api/examples',
  path: '/Prod/api/examples',
  httpPath: '/Prod/api/examples',
});

const normalizedDecorated = toSafeEvent(eventWithDecoratedStage);
assert.equal(normalizedDecorated.rawPath, '/api/examples', 'stage normalization should be case-insensitive');

const eventWithoutStage = buildEvent({
  stage: undefined,
  rawPath: '/api/examples',
  path: '/api/examples',
  httpPath: '/api/examples',
});

const normalizedWithoutStage = toSafeEvent(eventWithoutStage);
assert.equal(normalizedWithoutStage.rawPath, '/api/examples', 'paths without a stage remain untouched');

const eventWithNonMatchingStage = buildEvent({
  stage: 'prod',
  rawPath: '/sandbox/api/examples',
  path: '/sandbox/api/examples',
  httpPath: '/sandbox/api/examples',
});

const normalizedNonMatching = toSafeEvent(eventWithNonMatchingStage);
assert.equal(
  normalizedNonMatching.rawPath,
  '/sandbox/api/examples',
  'non-matching stage prefixes should not be stripped',
);

console.log('API runtime stage normalization tests passed');
