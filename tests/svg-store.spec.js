const { test, expect } = require('@playwright/test');

const TEST_PNG_DATA_URL = 'data:image/png;base64,' + Buffer.from('svg-store-png').toString('base64');

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
  test('getStoreMode uses alias environment variables when primary keys are missing', async () => {
    delete process.env.KV_REST_API_URL;
    delete process.env.KV_REST_API_TOKEN;
    process.env.FIGURE_LIBRARY_KV_REST_API_URL = TEST_KV_URL;
    process.env.FIGURE_LIBRARY_KV_REST_API_TOKEN = TEST_KV_TOKEN;

    expect(getStoreMode()).toBe('kv');
    expect(process.env.KV_REST_API_URL).toBe(TEST_KV_URL);
    expect(process.env.KV_REST_API_TOKEN).toBe(TEST_KV_TOKEN);

    delete process.env.FIGURE_LIBRARY_KV_REST_API_URL;
    delete process.env.FIGURE_LIBRARY_KV_REST_API_TOKEN;
    process.env.KV_REST_API_URL = originalKvUrl || TEST_KV_URL;
    process.env.KV_REST_API_TOKEN = originalKvToken || TEST_KV_TOKEN;
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
