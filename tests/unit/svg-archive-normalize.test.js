const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

function loadNormalizeAssetUrl() {
  const filePath = path.resolve(__dirname, '..', '..', 'svg-arkiv.js');
  const source = fs.readFileSync(filePath, 'utf8');
  const start = source.indexOf('function normalizeAssetUrl');
  if (start === -1) {
    throw new Error('normalizeAssetUrl definition not found');
  }
  const end = source.indexOf('\n\n  function sanitizeBaseName', start);
  if (end === -1) {
    throw new Error('Unable to locate end of normalizeAssetUrl definition');
  }
  const functionSource = source.slice(start, end);
  const script = new vm.Script(`(${functionSource})`);
  const context = vm.createContext({ URLSearchParams });
  return script.runInContext(context);
}

const normalizeAssetUrl = loadNormalizeAssetUrl();

const slugResult = normalizeAssetUrl('custom-bs12-12.png', 'png');
assert.equal(
  slugResult,
  '/api/svg/raw?path=custom-bs12-12.png&format=png',
  'Expected slugs without a leading slash to resolve to the svg raw endpoint'
);

const normalizedResult = normalizeAssetUrl('/custom-bs12-12.png', 'png');
assert.equal(
  normalizedResult,
  '/custom-bs12-12.png',
  'Leading slashes should be preserved for direct asset paths'
);

console.log('normalizeAssetUrl slug normalization test passed');
