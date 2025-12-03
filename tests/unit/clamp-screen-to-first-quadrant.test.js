const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

function loadClampScreenToFirstQuadrant(options = {}) {
  const source = fs.readFileSync(path.resolve(__dirname, '..', '..', 'graftegner.js'), 'utf8');
  const start = source.indexOf('function clampScreenToFirstQuadrant');
  if (start === -1) {
    throw new Error('Unable to locate clampScreenToFirstQuadrant in graftegner.js');
  }
  let braceCount = 0;
  let end = -1;
  for (let i = start; i < source.length; i++) {
    const ch = source[i];
    if (ch === '{') {
      braceCount += 1;
    } else if (ch === '}') {
      braceCount -= 1;
      if (braceCount === 0) {
        end = i + 1;
        break;
      }
    }
  }
  if (end === -1) {
    throw new Error('Unable to extract clampScreenToFirstQuadrant function body.');
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
  [-0.5, 199.5, -0.5, 199.5],
  'Zoomed-out view should preserve padding while clamping to the first quadrant.'
);

const fullyNegativeScreen = [-50, -10, -40, -20];
assert.deepEqual(
  Array.from(clamp(fullyNegativeScreen)),
  [-0.5, 39.5, -0.5, 19.5],
  'Screens entirely left/below the origin should slide into the first quadrant while preserving size and padding.'
);

console.log('clampScreenToFirstQuadrant quadrant edge cases passed');
