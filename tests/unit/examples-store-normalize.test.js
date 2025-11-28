const assert = require('node:assert/strict');
const path = require('node:path');

// Load normalizePath directly from the server-side examples store module.
// This avoids running the Playwright suite when we only need to verify
// path normalization behaviour.
const { normalizePath } = require(path.resolve(__dirname, '..', '..', 'api/_lib/examples-store'));

const cases = [
  { input: '/eksempel3', expected: '/' },
  { input: '/eksempel-12/', expected: '/' },
  { input: '/foo/bar/eksempel2', expected: '/foo/bar' },
  { input: '/foo/bar/eksempel_10/', expected: '/foo/bar' },
  { input: '/foo/bar/eksempel12a', expected: '/foo/bar/eksempel12a' },
  { input: '/foo/bar/another', expected: '/foo/bar/another' },
  { input: 'foo/bar/eksempel2/', expected: '/foo/bar' }
];

cases.forEach(({ input, expected }) => {
  const result = normalizePath(input);
  assert.equal(result, expected, `normalizePath(${JSON.stringify(input)}) should be ${expected}`);
});

console.log('examples-store normalizePath example trimming tests passed');
