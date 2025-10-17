const { test, expect } = require('@playwright/test');

const TEST_KV_URL = 'https://kv.test.local';
const TEST_KV_TOKEN = 'test-token';

const originalKvUrl = process.env.KV_REST_API_URL;
const originalKvToken = process.env.KV_REST_API_TOKEN;

process.env.KV_REST_API_URL = originalKvUrl || TEST_KV_URL;
process.env.KV_REST_API_TOKEN = originalKvToken || TEST_KV_TOKEN;

const { setupKvMock } = require('./helpers/kv-mock');

const { mockKv, cleanup: cleanupKvMock } = setupKvMock();

const {
  normalizeSlug,
  setSvg,
  getSvg,
  deleteSvg,
  listSvgs,
  getStoreMode
} = require('../api/_lib/svg-store');

function clearMemoryStore() {
  if (global.__SVG_MEMORY_STORE__) {
    global.__SVG_MEMORY_STORE__.clear();
  }
  if (global.__SVG_MEMORY_INDEX__) {
    global.__SVG_MEMORY_INDEX__.clear();
  }
}

test.beforeEach(() => {
  mockKv.clear();
  clearMemoryStore();
  process.env.KV_REST_API_URL = originalKvUrl || TEST_KV_URL;
  process.env.KV_REST_API_TOKEN = originalKvToken || TEST_KV_TOKEN;
});

test.afterAll(() => {
  cleanupKvMock();
  clearMemoryStore();
  if (originalKvUrl !== undefined) {
    process.env.KV_REST_API_URL = originalKvUrl;
  } else {
    delete process.env.KV_REST_API_URL;
  }
  if (originalKvToken !== undefined) {
    process.env.KV_REST_API_TOKEN = originalKvToken;
  } else {
    delete process.env.KV_REST_API_TOKEN;
  }
});

test.describe('svg-store slug normalization', () => {
  test('keeps svg suffix and lowercases path segments', () => {
    expect(normalizeSlug('Icons/Star.SVG')).toBe('icons/star.svg');
    expect(normalizeSlug('/Shapes/Circle.svg')).toBe('shapes/circle.svg');
  });
});

test.describe('svg-store memory mode', () => {
  test.beforeEach(() => {
    delete process.env.KV_REST_API_URL;
    delete process.env.KV_REST_API_TOKEN;
  });

  test('setSvg and listSvgs operate in memory', async () => {
    const stored = await setSvg('Memory/Example.svg', {
      title: 'Memory entry',
      tool: 'editor',
      svg: '<svg>memory</svg>',
      summary: 'Stored in memory'
    });
    expect(stored).not.toBeNull();
    expect(stored.storage).toBe('memory');
    expect(stored.slug).toBe('memory/example.svg');

    const listed = await listSvgs();
    expect(Array.isArray(listed)).toBe(true);
    expect(listed).toHaveLength(1);
    expect(listed[0].summary).toBe('Stored in memory');
    expect(listed[0].mode).toBe('memory');

    const fetched = await getSvg('memory/example.svg');
    expect(fetched).not.toBeNull();
    expect(fetched.title).toBe('Memory entry');
    expect(getStoreMode()).toBe('memory');
  });
});

test.describe('svg-store kv mode', () => {
  test('setSvg persists to kv and listSvgs hydrates from kv', async () => {
    const stored = await setSvg('Icons/Star.svg', {
      title: 'Star',
      tool: 'vector',
      svg: '<svg>star</svg>'
    });
    expect(stored).not.toBeNull();
    expect(stored.mode).toBe('kv');
    expect(stored.slug).toBe('icons/star.svg');

    // Simuler ny prosess ved å tømme minneindeksen.
    clearMemoryStore();

    const listed = await listSvgs();
    expect(listed).toHaveLength(1);
    expect(listed[0].mode).toBe('kv');
    expect(listed[0].svg).toBe('<svg>star</svg>');

    const fetched = await getSvg('icons/star.svg');
    expect(fetched).not.toBeNull();
    expect(fetched.storage).toBe('kv');

    const deleted = await deleteSvg('icons/star.svg');
    expect(deleted).toBe(true);
    const afterDelete = await listSvgs();
    expect(afterDelete).toHaveLength(0);
  });
});
