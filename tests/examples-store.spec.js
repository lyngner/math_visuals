const { test, expect } = require('@playwright/test');

const TEST_REDIS_ENDPOINT = 'redis.test.local';
const TEST_REDIS_PORT = '6379';
const TEST_REDIS_PASSWORD = 'test-token';

const originalRedisEndpoint = process.env.REDIS_ENDPOINT;
const originalRedisPort = process.env.REDIS_PORT;
const originalRedisPassword = process.env.REDIS_PASSWORD;

process.env.REDIS_ENDPOINT = originalRedisEndpoint || TEST_REDIS_ENDPOINT;
process.env.REDIS_PORT = originalRedisPort || TEST_REDIS_PORT;
process.env.REDIS_PASSWORD = originalRedisPassword || TEST_REDIS_PASSWORD;

const { setupKvMock } = require('./helpers/kv-mock');

const { mockKv, cleanup: cleanupKvMock } = setupKvMock();

const {
  normalizePath,
  setEntry,
  getEntry,
  deleteEntry,
  listEntries,
  getTrashEntries,
  setTrashEntries,
  appendTrashEntries,
  deleteTrashEntries,
  getMemoryEntry,
  setMemoryEntry,
  deleteMemoryEntry,
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

test.afterAll(() => {
  cleanupKvMock();
  if (originalRedisEndpoint !== undefined) {
    process.env.REDIS_ENDPOINT = originalRedisEndpoint;
  } else {
    delete process.env.REDIS_ENDPOINT;
  }
  if (originalRedisPort !== undefined) {
    process.env.REDIS_PORT = originalRedisPort;
  } else {
    delete process.env.REDIS_PORT;
  }
  if (originalRedisPassword !== undefined) {
    process.env.REDIS_PASSWORD = originalRedisPassword;
  } else {
    delete process.env.REDIS_PASSWORD;
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
      mockKv.api.get = originalGet;
      try {
        await deleteEntry(path);
      } catch (error) {}
    }
  });
});

test.describe('examples-store memory fallback', () => {
  let originalUrl;
  let originalToken;

  test.beforeEach(() => {
    originalUrl = process.env.REDIS_ENDPOINT;
    originalToken = process.env.REDIS_PASSWORD;
    delete process.env.REDIS_ENDPOINT;
    delete process.env.REDIS_PASSWORD;
  });

  test.afterEach(() => {
    if (originalUrl !== undefined) {
      process.env.REDIS_ENDPOINT = originalUrl;
    } else {
      delete process.env.REDIS_ENDPOINT;
    }
    if (originalToken !== undefined) {
      process.env.REDIS_PASSWORD = originalToken;
    } else {
      delete process.env.REDIS_PASSWORD;
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

test.describe('examples-store trash operations', () => {
  test.beforeEach(async () => {
    await setTrashEntries([]);
  });

  test('setTrashEntries normalizes trash payloads', async () => {
    const entries = await setTrashEntries([
      {
        id: 'custom-id',
        example: { title: 'Trash demo', config: { STATE: { value: 1 } } },
        deletedAt: '2024-01-02T03:04:05.000Z',
        sourcePath: '/Diagram/Index.html',
        reason: 'history'
      }
    ]);

    expect(entries).toHaveLength(1);
    const [stored] = entries;
    expect(stored.id).toBe('custom-id');
    expect(stored.sourcePath).toBe('/diagram');
    expect(stored.sourcePathRaw).toBe('/Diagram/Index.html');
    expect(stored.reason).toBe('history');
    expect(stored.example).toMatchObject({ title: 'Trash demo' });

    const roundTrip = await getTrashEntries();
    expect(roundTrip).toHaveLength(1);
    expect(roundTrip[0].id).toBe('custom-id');
    expect(roundTrip[0].sourcePath).toBe('/diagram');
  });

  test('appendTrashEntries prepends new entries and enforces limit', async () => {
    await setTrashEntries([
      { id: 'existing', example: { title: 'Existing' }, deletedAt: '2024-01-01T00:00:00.000Z' }
    ]);

    const updated = await appendTrashEntries(
      [
        { id: 'newer', example: { title: 'Newer' }, deletedAt: '2024-02-01T00:00:00.000Z' },
        { id: 'existing', example: { title: 'Duplicate' } }
      ],
      { mode: 'prepend', limit: 2 }
    );

    expect(updated[0].id).toBe('newer');
    expect(updated).toHaveLength(2);
    const ids = updated.map(entry => entry.id);
    expect(ids).toContain('existing');

    const appended = await appendTrashEntries(
      [{ id: 'tail', example: { title: 'Tail' }, deletedAt: '2024-03-01T00:00:00.000Z' }],
      { mode: 'append', limit: 2 }
    );
    expect(appended).toHaveLength(2);
    expect(appended[appended.length - 1].id).toBe('tail');
  });

  test('appendTrashEntries replaces duplicates when appending', async () => {
    await setTrashEntries([
      { id: 'shared', example: { title: 'Original' }, deletedAt: '2024-01-01T00:00:00.000Z' }
    ]);

    const appended = await appendTrashEntries(
      [{ id: 'shared', example: { title: 'Updated' }, deletedAt: '2024-02-01T00:00:00.000Z' }],
      { mode: 'append' }
    );

    expect(appended).toHaveLength(1);
    expect(appended[0].id).toBe('shared');
    expect(appended[0].example).toMatchObject({ title: 'Updated' });
    expect(appended[0].deletedAt).toBe('2024-02-01T00:00:00.000Z');
  });

  test('deleteTrashEntries removes matching ids', async () => {
    await setTrashEntries([
      { id: 'keep', example: { title: 'Keep' } },
      { id: 'remove', example: { title: 'Remove' } }
    ]);

    const result = await deleteTrashEntries(['remove']);
    expect(result.removed).toBe(1);
    const remaining = await getTrashEntries();
    const remainingIds = remaining.map(entry => entry.id);
    expect(remainingIds).toContain('keep');
    expect(remainingIds).not.toContain('remove');
  });
});
