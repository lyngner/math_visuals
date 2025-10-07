const { test, expect } = require('@playwright/test');

const {
  setEntry,
  getEntry,
  deleteEntry,
  __deserializeExampleValue
} = require('../api/_lib/examples-store');

function buildPath() {
  return `/serialization-test-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

test.describe('examples-store serialization', () => {
  test('round-trips Map and Set data', async () => {
    const path = buildPath();
    const shapes = new Map();
    shapes.set('alpha', new Set(['a', 'b']));
    shapes.set('beta', new Set(['c']));

    const payload = {
      examples: [
        {
          description: 'Map/Set example',
          config: {
            STATE: {
              shapes
            }
          }
        }
      ]
    };

    const entry = await setEntry(path, payload);
    expect(Array.isArray(entry.examples)).toBe(true);
    const encoded = entry.examples[0].config.STATE.shapes;
    expect(encoded).toHaveProperty('__mathVisualsType__', 'map');

    const stored = await getEntry(path);
    expect(stored).not.toBeNull();
    const decoded = __deserializeExampleValue(stored.examples[0].config.STATE.shapes);
    expect(decoded instanceof Map).toBe(true);
    const roundTrip = Array.from(decoded.entries()).map(([key, set]) => [key, Array.from(set).sort()]);
    roundTrip.sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0));
    expect(roundTrip).toEqual([
      ['alpha', ['a', 'b']],
      ['beta', ['c']]
    ]);

    await deleteEntry(path);
  });
});
