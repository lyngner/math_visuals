const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

function loadClampScreenToFirstQuadrant(options = {}) {
  const source = fs.readFileSync(path.resolve(__dirname, '..', '..', 'graftegner.js'), 'utf8');
  const start = source.indexOf('function clampScreenToFirstQuadrant');
  const end = source.indexOf('function normalizeAutoScreen', start);
  if (start === -1 || end === -1) {
    throw new Error('Unable to locate clampScreenToFirstQuadrant in graftegner.js');
  }
  const fnSource = source.slice(start, end);

  const context = {
    ADV: { firstQuadrant: true, ...options },
    Array,
    Math,
    Number
  };
  vm.createContext(context);
  vm.runInContext(`${fnSource}; this.clampScreenToFirstQuadrant = clampScreenToFirstQuadrant;`, context);
  return context.clampScreenToFirstQuadrant;
}

const clamp = loadClampScreenToFirstQuadrant();

const zoomedOutScreen = [-100, 100, -100, 100];
assert.deepEqual(
  Array.from(clamp(zoomedOutScreen)),
  [0, 100, 0, 100],
  'Zoomed-out view should snap to 0-100 range when Quadrant 1 is enabled.'
);

const fullyNegativeScreen = [-50, -10, -40, -20];
assert.deepEqual(
  Array.from(clamp(fullyNegativeScreen)),
  [0, 40, 0, 20],
  'Screens entirely left/below the origin should slide into the first quadrant while preserving size.'
);

console.log('clampScreenToFirstQuadrant quadrant edge cases passed');
