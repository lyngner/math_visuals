const { test, expect } = require('@playwright/test');

const TEST_PNG_DATA_URL = 'data:image/png;base64,' + Buffer.from('svg-store-png').toString('base64');

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
  process.env.REDIS_ENDPOINT = originalRedisEndpoint || TEST_REDIS_ENDPOINT;
  process.env.REDIS_PORT = originalRedisPort || TEST_REDIS_PORT;
  process.env.REDIS_PASSWORD = originalRedisPassword || TEST_REDIS_PASSWORD;
});

test.afterAll(() => {
  cleanupKvMock();
  clearMemoryStore();
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

test.describe('svg-store slug normalization', () => {
  test('keeps svg suffix and lowercases path segments', () => {
    expect(normalizeSlug('Icons/Star.SVG')).toBe('icons/star.svg');
    expect(normalizeSlug('/Shapes/Circle.svg')).toBe('shapes/circle.svg');
  });
});

test.describe('svg-store memory mode', () => {
  test.beforeEach(() => {
    delete process.env.REDIS_ENDPOINT;
    delete process.env.REDIS_PORT;
    delete process.env.REDIS_PASSWORD;
  });

  test('setSvg and listSvgs operate in memory', async () => {
    const statePayload = { foo: 'bar', nested: { value: 42 }, items: [1, 2, 3] };
    const stored = await setSvg('Memory/Example.svg', {
      title: 'Memory entry',
      tool: 'editor',
      svg: '<svg>memory</svg>',
      summary: 'Stored in memory',
      exampleState: JSON.stringify(statePayload)
    });
    expect(stored).not.toBeNull();
    expect(stored.storage).toBe('memory');
    expect(stored.slug).toBe('memory/example');
    expect(stored.exampleState).toEqual(statePayload);

    const listed = await listSvgs();
    expect(Array.isArray(listed)).toBe(true);
    expect(listed).toHaveLength(1);
    expect(listed[0].summary).toBe('Stored in memory');
    expect(listed[0].mode).toBe('memory');
    expect(listed[0].exampleState).toEqual(statePayload);

    const fetched = await getSvg('memory/example.svg');
    expect(fetched).not.toBeNull();
    expect(fetched.title).toBe('Memory entry');
    expect(fetched.exampleState).toEqual(statePayload);
    expect(getStoreMode()).toBe('memory');
  });

  test('setSvg accepts exampleState objects without stringifying', async () => {
    const directState = { foo: 'direct', nested: { count: 3 }, list: [true, false] };
    const stored = await setSvg('Memory/ObjectExample.svg', {
      title: 'Object state',
      tool: 'editor',
      svg: '<svg>object</svg>',
      exampleState: directState
    });

    expect(stored).not.toBeNull();
    expect(stored.exampleState).toEqual(directState);

    const fetched = await getSvg('memory/objectexample.svg');
    expect(fetched).not.toBeNull();
    expect(fetched.exampleState).toEqual(directState);
  });

  test('setSvg skips PNG metadata when no data URL is provided', async () => {
    const slug = 'Memory/SvgOnly.svg';
    const stored = await setSvg(slug, {
      title: 'SVG only',
      tool: 'editor',
      svg: '<svg>only</svg>'
    });

    expect(stored).not.toBeNull();
    expect(stored.png).toBeUndefined();
    expect(stored.pngSlug).toBeUndefined();
    expect(stored.pngFilename).toBeUndefined();
    expect(stored.files.png).toBeUndefined();
    expect(stored.urls.png).toBeUndefined();

    const fetched = await getSvg('memory/svgonly.svg');
    expect(fetched).not.toBeNull();
    expect(fetched.png).toBeUndefined();
    expect(fetched.files.png).toBeUndefined();

    const withPng = await setSvg(slug, {
      title: 'SVG only',
      tool: 'editor',
      svg: '<svg>only</svg>',
      png: {
        dataUrl: TEST_PNG_DATA_URL,
        width: 37,
        height: 21
      }
    });

    expect(withPng.png).toBe(TEST_PNG_DATA_URL);
    expect(withPng.pngSlug).toMatch(/\.png$/);
    expect(withPng.pngFilename).toMatch(/\.png$/);
    expect(withPng.files.png).toBeDefined();
    expect(withPng.urls.png).toMatch(/\.png$/);
    expect(withPng.pngWidth).toBe(37);
    expect(withPng.pngHeight).toBe(21);

    const removedPng = await setSvg(slug, {
      title: 'SVG only',
      tool: 'editor',
      svg: '<svg>only</svg>',
      png: null
    });

    expect(removedPng.png).toBeUndefined();
    expect(removedPng.files.png).toBeUndefined();
    expect(removedPng.urls.png).toBeUndefined();
    expect(removedPng.pngSlug).toBeUndefined();
    expect(removedPng.pngFilename).toBeUndefined();

    const fetchedAfterRemoval = await getSvg('memory/svgonly.svg');
    expect(fetchedAfterRemoval).not.toBeNull();
    expect(fetchedAfterRemoval.png).toBeUndefined();
    expect(fetchedAfterRemoval.files.png).toBeUndefined();
  });
});

test.describe('svg-store kv mode', () => {
  test('getStoreMode reports kv when Redis secrets are available', async () => {
    process.env.REDIS_ENDPOINT = TEST_REDIS_ENDPOINT;
    process.env.REDIS_PORT = TEST_REDIS_PORT;
    process.env.REDIS_PASSWORD = TEST_REDIS_PASSWORD;

    expect(getStoreMode()).toBe('kv');
  });

  test('setSvg persists to kv and listSvgs hydrates from kv', async () => {
    const statePayload = { foo: 'kv', nested: { list: ['a', 'b'] } };
    const stored = await setSvg('Icons/Star.svg', {
      title: 'Star',
      tool: 'vector',
      svg: '<svg>star</svg>',
      exampleState: JSON.stringify(statePayload)
    });
    expect(stored).not.toBeNull();
    expect(stored.mode).toBe('kv');
    expect(stored.slug).toBe('icons/star');
    expect(stored.exampleState).toEqual(statePayload);

    // Simuler ny prosess ved å tømme minneindeksen.
    clearMemoryStore();

    const listed = await listSvgs();
    expect(listed).toHaveLength(1);
    expect(listed[0].mode).toBe('kv');
    expect(listed[0].svg).toBe('<svg>star</svg>');
    expect(listed[0].exampleState).toEqual(statePayload);

    const fetched = await getSvg('icons/star.svg');
    expect(fetched).not.toBeNull();
    expect(fetched.storage).toBe('kv');
    expect(fetched.exampleState).toEqual(statePayload);

    const deleted = await deleteSvg('icons/star.svg');
    expect(deleted).toBe(true);
    const afterDelete = await listSvgs();
    expect(afterDelete).toHaveLength(0);
  });
});
