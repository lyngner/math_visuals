const { test, expect } = require('@playwright/test');

const {
  normalizePath,
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

test.describe('examples-store path normalization', () => {
  test('strips html suffixes to match canonical keys', () => {
    expect(normalizePath('/nkant.html')).toBe('/nkant');
    expect(normalizePath('/nkant.htm')).toBe('/nkant');
    expect(normalizePath('nkant.html')).toBe('/nkant');
  });

  test('retains root path when stripping html suffix', () => {
    expect(normalizePath('index.html')).toBe('/');
    expect(normalizePath('/index.htm')).toBe('/');
  });

  test('normalizes legacy html path variants to canonical form', () => {
    const variants = [
      '/Diagram.HTML',
      '/diagram/index.HTML',
      '/diagram/index.htm',
      'diagram/index.html',
      '/diagram.html',
      '/diagram.HTML',
      '/diagram/index.html'
    ];
    variants.forEach(value => {
      expect(normalizePath(value)).toBe('/diagram');
    });
    expect(normalizePath('/Br%C3%98KVEGG.HTML')).toBe('/br%C3%B8kvegg');
    expect(normalizePath('/brøkvegg/index.html')).toBe('/br%C3%B8kvegg');
  });
});

test.describe('examples-store canonical entry handling', () => {
  test('coerces html paths to canonical storage keys', async () => {
    const path = '/diagram/index.html';
    const payload = {
      examples: [
        {
          description: 'Legacy backend entry',
          config: { STATE: { migrated: true } }
        }
      ],
      deletedProvided: ['legacy-provided']
    };
    const cleanupTarget = '/diagram';
    try {
      const entry = await setEntry(path, payload);
      expect(entry).not.toBeNull();
      expect(entry.path).toBe('/diagram');

      const canonical = await getEntry('/diagram');
      expect(canonical).not.toBeNull();
      expect(Array.isArray(canonical.examples)).toBe(true);
      expect(canonical.examples[0]).toMatchObject({ description: 'Legacy backend entry' });

      const htmlVariant = await getEntry('/diagram.html');
      expect(htmlVariant).not.toBeNull();
      expect(htmlVariant.path).toBe('/diagram');

      const deletedKey = canonical.deletedProvided || [];
      expect(deletedKey).toContain('legacy-provided');
    } finally {
      try {
        await deleteEntry(cleanupTarget);
      } catch (error) {}
    }
  });
});
