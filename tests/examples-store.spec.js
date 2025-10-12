const { test, expect } = require('@playwright/test');

process.env.KV_REST_API_URL = process.env.KV_REST_API_URL || '';
process.env.KV_REST_API_TOKEN = process.env.KV_REST_API_TOKEN || '';

function createMockKv() {
  const data = new Map();
  const sets = new Map();
  const ensureSet = key => {
    if (!sets.has(key)) {
      sets.set(key, new Set());
    }
    return sets.get(key);
  };
  return {
    api: {
      async set(key, value) {
        data.set(key, value);
      },
      async get(key) {
        return data.has(key) ? data.get(key) : null;
      },
      async del(key) {
        data.delete(key);
      },
      async sadd(key, member) {
        ensureSet(key).add(member);
      },
      async srem(key, member) {
        if (!sets.has(key)) return;
        const target = sets.get(key);
        target.delete(member);
        if (target.size === 0) {
          sets.delete(key);
        }
      },
      async smembers(key) {
        return sets.has(key) ? Array.from(sets.get(key)) : [];
      }
    },
    clear() {
      data.clear();
      sets.clear();
    }
  };
}

const mockKv = createMockKv();
const kvModulePath = require.resolve('@vercel/kv');
require.cache[kvModulePath] = { exports: { kv: mockKv.api } };

const {
  normalizePath,
  setEntry,
  getEntry,
  deleteEntry,
  listEntries,
  getMemoryEntry,
  setMemoryEntry,
  deleteMemoryEntry,
  seedMemoryStoreWithDefaults,
  __deserializeExampleValue
} = require('../api/_lib/examples-store');

test.beforeEach(() => {
  mockKv.clear();
  if (global.__EXAMPLES_MEMORY_STORE__) {
    global.__EXAMPLES_MEMORY_STORE__.clear();
  }
  if (global.__EXAMPLES_MEMORY_INDEX__) {
    global.__EXAMPLES_MEMORY_INDEX__.clear();
  }
});

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

test.describe('examples-store KV verification', () => {
  test('fails when KV write verification does not return stored entry', async () => {
    const path = '/kv-verification-failure';
    const previousUrl = process.env.KV_REST_API_URL;
    const previousToken = process.env.KV_REST_API_TOKEN;
    process.env.KV_REST_API_URL = 'https://kv.example.test';
    process.env.KV_REST_API_TOKEN = 'test-token';
    const originalGet = mockKv.api.get;
    mockKv.api.get = async key => {
      if (typeof key === 'string' && key.includes('kv-verification-failure')) {
        return null;
      }
      return originalGet.call(mockKv.api, key);
    };

    try {
      await expect(setEntry(path, { examples: [] })).rejects.toThrow(/verify/i);
    } finally {
      if (previousUrl === undefined) {
        delete process.env.KV_REST_API_URL;
      } else {
        process.env.KV_REST_API_URL = previousUrl;
      }
      if (previousToken === undefined) {
        delete process.env.KV_REST_API_TOKEN;
      } else {
        process.env.KV_REST_API_TOKEN = previousToken;
      }
      mockKv.api.get = originalGet;
      try {
        await deleteEntry(path);
      } catch (error) {}
    }
  });
});

test.describe('examples-store memory defaults', () => {
  test('seedMemoryStoreWithDefaults seeds the bundled tallinje example', async () => {
    const path = '/tallinje';
    const previous = getMemoryEntry(path);
    try {
      if (previous) {
        deleteMemoryEntry(path);
      }

      const seeded = await seedMemoryStoreWithDefaults({ paths: [path], overwriteExisting: true });
      expect(Array.isArray(seeded)).toBe(true);
      expect(seeded.length).toBeGreaterThan(0);

      const entry = getMemoryEntry(path);
      expect(entry).toBeTruthy();
      expect(entry.mode).toBe('memory');
      expect(entry.storage).toBe('memory');
      expect(Array.isArray(entry.examples)).toBe(true);
      expect(entry.examples.length).toBeGreaterThan(0);
      expect(entry.examples[0]).toMatchObject({
        title: 'Plasser brøkene',
        isDefault: true
      });
    } finally {
      if (previous) {
        setMemoryEntry(path, {
          examples: Array.isArray(previous.examples) ? previous.examples : [],
          deletedProvided: Array.isArray(previous.deletedProvided) ? previous.deletedProvided : [],
          updatedAt: previous.updatedAt
        });
      } else {
        deleteMemoryEntry(path);
      }
    }
  });
});

test.describe('examples-store memory fallback', () => {
  let originalUrl;
  let originalToken;

  test.beforeEach(() => {
    originalUrl = process.env.KV_REST_API_URL;
    originalToken = process.env.KV_REST_API_TOKEN;
    delete process.env.KV_REST_API_URL;
    delete process.env.KV_REST_API_TOKEN;
  });

  test.afterEach(() => {
    if (originalUrl !== undefined) {
      process.env.KV_REST_API_URL = originalUrl;
    } else {
      delete process.env.KV_REST_API_URL;
    }
    if (originalToken !== undefined) {
      process.env.KV_REST_API_TOKEN = originalToken;
    } else {
      delete process.env.KV_REST_API_TOKEN;
    }
  });

  test('setEntry and getEntry operate entirely in memory when KV is unconfigured', async () => {
    const path = buildPath();
    const payload = {
      examples: [
        {
          description: 'Memory fallback example',
          config: { STATE: { value: 42 } }
        }
      ],
      deletedProvided: []
    };

    const entry = await setEntry(path, payload);
    expect(entry).not.toBeNull();
    expect(entry.path).toBe(normalizePath(path));
    expect(entry.storage).toBe('memory');
    expect(entry.mode).toBe('memory');
    expect(entry.persistent).toBe(false);
    expect(entry.ephemeral).toBe(true);

    const stored = await getEntry(path);
    expect(stored).not.toBeNull();
    expect(stored.storage).toBe('memory');
    expect(stored.mode).toBe('memory');
    expect(Array.isArray(stored.examples)).toBe(true);
    expect(stored.examples[0]).toMatchObject({ description: 'Memory fallback example' });
  });

  test('listEntries and deleteEntry use memory metadata when KV variables are missing', async () => {
    const pathA = buildPath();
    const pathB = buildPath();

    await setEntry(pathA, {
      examples: [
        {
          description: 'Entry A',
          config: { STATE: { label: 'A' } }
        }
      ],
      deletedProvided: []
    });

    await setEntry(pathB, {
      examples: [
        {
          description: 'Entry B',
          config: { STATE: { label: 'B' } }
        }
      ],
      deletedProvided: []
    });

    const entries = await listEntries();
    expect(entries.length).toBeGreaterThanOrEqual(2);
    const normalizedA = normalizePath(pathA);
    const normalizedB = normalizePath(pathB);
    const entryA = entries.find(item => item.path === normalizedA);
    const entryB = entries.find(item => item.path === normalizedB);
    expect(entryA).toBeTruthy();
    expect(entryA.storage).toBe('memory');
    expect(entryA.mode).toBe('memory');
    expect(entryB).toBeTruthy();
    expect(entryB.storage).toBe('memory');
    expect(entryB.mode).toBe('memory');

    const deleted = await deleteEntry(pathA);
    expect(deleted).toBe(true);
    const afterDelete = await getEntry(pathA);
    expect(afterDelete).toBeNull();

    const remaining = await listEntries();
    expect(remaining.some(item => item.path === normalizedA)).toBe(false);
    const stillHasB = remaining.find(item => item.path === normalizedB);
    expect(stillHasB).toBeTruthy();
    expect(stillHasB.storage).toBe('memory');
    expect(stillHasB.mode).toBe('memory');
  });
});
