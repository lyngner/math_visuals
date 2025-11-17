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

function createBaseEvent({
  path: requestPath,
  rawQueryString = '',
  stage = '$default',
  routeKey = 'GET /svg/{proxy+}',
} = {}) {
  const pathValue = requestPath || '/';
  const baseEvent = {
    version: '2.0',
    rawPath: pathValue,
    path: pathValue,
    rawQueryString,
    requestContext: {
      stage,
      routeKey,
      http: {
        path: pathValue,
        method: 'GET',
        protocol: 'HTTP/1.1',
      },
    },
  };
  if (rawQueryString) {
    const params = new URLSearchParams(rawQueryString);
    const query = {};
    const multi = {};
    params.forEach((value, key) => {
      query[key] = value;
      if (!multi[key]) {
        multi[key] = [];
      }
      multi[key].push(value);
    });
    baseEvent.queryStringParameters = query;
    baseEvent.multiValueQueryStringParameters = multi;
  }
  return baseEvent;
}

const svgEvent = createBaseEvent({ path: '/svg/library/icon.svg' });
const svgSafe = toSafeEvent(svgEvent);
assert.equal(svgSafe.path, '/api/svg/raw', 'SVG paths should rewrite to /api/svg/raw');
assert.equal(svgSafe.rawPath, '/api/svg/raw', 'rawPath should match the rewritten target');
assert.equal(svgSafe.requestContext.http.path, '/api/svg/raw', 'HTTP context must match the rewritten path');
assert.equal(svgSafe.queryStringParameters.path, '/library/icon.svg', 'Rewrites should inject a path query parameter');
assert.equal(svgSafe.rawQueryString, 'path=%2Flibrary%2Ficon.svg', 'Query string should encode the slug value');

const stagedBildearkivEvent = createBaseEvent({
  path: '/prod/bildearkiv/uploads/test.png',
  stage: 'prod',
  routeKey: 'GET /bildearkiv/{proxy+}',
});
const stagedSafe = toSafeEvent(stagedBildearkivEvent);
assert.equal(stagedSafe.path, '/api/svg/raw', 'Stage-prefixed bildearkiv paths should rewrite to /api/svg/raw');
assert.equal(
  stagedSafe.queryStringParameters.path,
  '/uploads/test.png',
  'Slug should remove the /bildearkiv prefix and keep the leading slash',
);

const figureLibraryEvent = createBaseEvent({
  path: '/figure-library/icons/test.svg',
  rawQueryString: 'format=svg',
  routeKey: 'GET /figure-library/{proxy+}',
});
const figureSafe = toSafeEvent(figureLibraryEvent);
assert.equal(figureSafe.path, '/api/figure-library/raw', 'Figure library assets should target /api/figure-library/raw');
assert.equal(figureSafe.queryStringParameters.format, 'svg', 'Existing query parameters must be preserved');
assert.equal(figureSafe.queryStringParameters.path, '/icons/test.svg', 'Path slug should include the file name and extension');
assert.equal(
  figureSafe.rawQueryString,
  'format=svg&path=%2Ficons%2Ftest.svg',
  'Rewrites should append the slug to the existing query string',
);

const measurementBundleEvent = createBaseEvent({
  path: '/figure-library/measurement.js',
  routeKey: 'GET /figure-library/{proxy+}',
});
const measurementSafe = toSafeEvent(measurementBundleEvent);
assert.equal(
  measurementSafe.path,
  '/figure-library/measurement.js',
  'Non-asset figure-library paths should not be rewritten',
);
assert.equal(
  measurementSafe.rawQueryString,
  '',
  'Requests without query strings should remain untouched when no rewrite occurs',
);

console.log('API runtime friendly route rewrite tests passed');
