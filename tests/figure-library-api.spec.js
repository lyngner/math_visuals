const { test, expect } = require('@playwright/test');

const TEST_PNG_DATA_URL =
  'data:image/png;base64,' + Buffer.from('figure-library-test-png').toString('base64');
const TEST_SVG_MARKUP =
  '<svg xmlns="http://www.w3.org/2000/svg" width="120" height="90"><rect width="120" height="90" fill="#2563eb" /></svg>';

const TEST_KV_URL = 'https://kv.figure-library.test';
const TEST_KV_TOKEN = 'figure-library-token';

const originalKvUrl = process.env.KV_REST_API_URL;
const originalKvToken = process.env.KV_REST_API_TOKEN;

const { setupKvMock } = require('./helpers/kv-mock');
const { mockKv, cleanup: cleanupKvMock } = setupKvMock();

const {
  invokeFigureLibraryApi,
  clearFigureLibraryMemoryStores
} = require('./helpers/figure-library-api-utils');

function restoreKvEnv() {
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
}

function enableKvEnv() {
  process.env.KV_REST_API_URL = originalKvUrl || TEST_KV_URL;
  process.env.KV_REST_API_TOKEN = originalKvToken || TEST_KV_TOKEN;
}

function disableKvEnv() {
  delete process.env.KV_REST_API_URL;
  delete process.env.KV_REST_API_TOKEN;
}

function expectStorageHeaders(response, expectedMode) {
  expect(response.headers['x-figure-library-store-mode']).toBe(expectedMode);
  expect(response.headers['x-figure-library-storage-result']).toBe(expectedMode);
}

test.describe('figure library API memory mode', () => {
  test.beforeEach(() => {
    disableKvEnv();
    mockKv.clear();
    clearFigureLibraryMemoryStores();
  });

  test('supports create, list, update and delete in memory mode', async () => {
    const createResponse = await invokeFigureLibraryApi({
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        slug: 'Memory/Test-Figur',
        title: 'Testfigur',
        tool: 'playwright-test',
        summary: 'Lagt inn av test for minnelagring',
        svg: TEST_SVG_MARKUP,
        png: {
          dataUrl: TEST_PNG_DATA_URL,
          width: 120,
          height: 90
        },
        tags: ['shapes', 'shapes', 'geometri'],
        category: { label: 'Testkategori', apps: ['bibliotek', 'bibliotek', ' viewer '] }
      })
    });

    expect(createResponse.statusCode).toBe(200);
    expectStorageHeaders(createResponse, 'memory');
    expect(createResponse.json?.entry?.slug).toBe('memory/test-figur');
    expect(createResponse.json?.entry?.storage).toBe('memory');
    expect(createResponse.json?.persistent).toBe(false);
    expect(createResponse.json?.ephemeral).toBe(true);
    expect(createResponse.json?.limitation).toContain('midlertidig minnelagring');
    expect(createResponse.json?.entry?.tags).toEqual(['shapes', 'geometri']);
    expect(createResponse.json?.categories?.[0]?.id).toBe('testkategori');
    expect(createResponse.json?.entry?.category?.apps).toEqual(['bibliotek', 'viewer']);
    expect(createResponse.json?.categories?.[0]?.apps).toEqual(['bibliotek', 'viewer']);

    const listResponse = await invokeFigureLibraryApi();
    expect(listResponse.statusCode).toBe(200);
    expectStorageHeaders(listResponse, 'memory');
    expect(Array.isArray(listResponse.json?.entries)).toBe(true);
    expect(listResponse.json.entries).toHaveLength(1);
    expect(listResponse.json.entries[0].category?.label).toBe('Testkategori');
    expect(listResponse.json.entries[0].category?.apps).toEqual(['bibliotek', 'viewer']);
    expect(listResponse.json.categories?.[0]?.figureSlugs).toContain('memory/test-figur');
    expect(listResponse.json.categories?.[0]?.apps).toEqual(['bibliotek', 'viewer']);

    const updateResponse = await invokeFigureLibraryApi({
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        slug: 'memory/test-figur',
        title: 'Oppdatert figur',
        summary: 'Oppdatert i test',
        tags: ['oppdatert', 'shapes'],
        category: { label: 'Oppdatert kategori', apps: ['viewer', 'bibliotek', 'bibliotek'] }
      })
    });

    expect(updateResponse.statusCode).toBe(200);
    expectStorageHeaders(updateResponse, 'memory');
    expect(updateResponse.json?.entry?.title).toBe('Oppdatert figur');
    expect(updateResponse.json?.entry?.category?.id).toBe('oppdatert-kategori');
    expect(updateResponse.json?.entry?.tags).toEqual(['oppdatert', 'shapes']);
    expect(updateResponse.json?.categories?.some(cat => cat.id === 'oppdatert-kategori')).toBe(true);
    const updatedCategory = updateResponse.json?.categories?.find(cat => cat.id === 'oppdatert-kategori');
    expect(updatedCategory?.apps).toEqual(['viewer', 'bibliotek']);
    expect(updateResponse.json?.entry?.category?.apps).toEqual(['viewer', 'bibliotek']);

    const deleteResponse = await invokeFigureLibraryApi({
      method: 'DELETE',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ slug: 'memory/test-figur' })
    });

    expect(deleteResponse.statusCode).toBe(200);
    expectStorageHeaders(deleteResponse, 'memory');
    expect(deleteResponse.json?.deleted?.slug).toBe('memory/test-figur');
    expect(deleteResponse.json?.categories?.[0]?.figureSlugs ?? []).toHaveLength(0);

    const afterDelete = await invokeFigureLibraryApi();
    expect(afterDelete.statusCode).toBe(200);
    expect(afterDelete.json?.entries ?? []).toHaveLength(0);
  });

  test('accepts SVG-only payloads without PNG metadata', async () => {
    const createResponse = await invokeFigureLibraryApi({
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        slug: 'Memory/SVG-Only',
        title: 'SVG uten PNG',
        tool: 'playwright-test',
        svg: TEST_SVG_MARKUP,
        summary: 'Kun SVG'
      })
    });

    expect(createResponse.statusCode).toBe(200);
    expectStorageHeaders(createResponse, 'memory');
    expect(createResponse.json?.entry?.slug).toBe('memory/svg-only');
    expect(createResponse.json?.entry?.png).toBeUndefined();
    expect(createResponse.json?.entry?.pngSlug).toBeUndefined();
    expect(createResponse.json?.entry?.files?.png).toBeUndefined();
    expect(createResponse.json?.entry?.urls?.png).toBeUndefined();

    const fetchResponse = await invokeFigureLibraryApi({
      url: '/api/figure-library?slug=memory/svg-only'
    });

    expect(fetchResponse.statusCode).toBe(200);
    expect(fetchResponse.json?.entry?.svg).toBe(TEST_SVG_MARKUP);
    expect(fetchResponse.json?.entry?.png).toBeUndefined();
    expect(fetchResponse.json?.entry?.files?.png).toBeUndefined();

    const updateResponse = await invokeFigureLibraryApi({
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        slug: 'memory/svg-only',
        title: 'Oppdatert SVG uten PNG',
        png: null
      })
    });

    expect(updateResponse.statusCode).toBe(200);
    expect(updateResponse.json?.entry?.title).toBe('Oppdatert SVG uten PNG');
    expect(updateResponse.json?.entry?.png).toBeUndefined();
    expect(updateResponse.json?.entry?.files?.png).toBeUndefined();

    const refetched = await invokeFigureLibraryApi({
      url: '/api/figure-library?slug=memory/svg-only'
    });

    expect(refetched.statusCode).toBe(200);
    expect(refetched.json?.entry?.title).toBe('Oppdatert SVG uten PNG');
    expect(refetched.json?.entry?.pngSlug).toBeUndefined();
    expect(refetched.json?.entry?.urls?.png).toBeUndefined();
  });
});

test.describe('figure library API kv mode', () => {
  test.beforeEach(() => {
    enableKvEnv();
    mockKv.clear();
    clearFigureLibraryMemoryStores();
  });

  test.afterAll(() => {
    cleanupKvMock();
    clearFigureLibraryMemoryStores();
    restoreKvEnv();
  });

  test('persists entries via KV and survives memory resets', async () => {
    const createResponse = await invokeFigureLibraryApi({
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        slug: 'KV/Test-Figur',
        title: 'KV Figur',
        tool: 'playwright-test',
        svg: TEST_SVG_MARKUP,
        png: {
          dataUrl: TEST_PNG_DATA_URL,
          width: 120,
          height: 90
        },
        tags: ['kv', 'lagring'],
        category: { label: 'KV-kategori', apps: ['bibliotek', 'kv-app'] }
      })
    });

    expect(createResponse.statusCode).toBe(200);
    expectStorageHeaders(createResponse, 'kv');
    expect(createResponse.json?.persistent).toBe(true);
    expect(createResponse.json?.limitation).toBeUndefined();
    expect(createResponse.json?.entry?.storage).toBe('kv');
    expect(createResponse.json?.entry?.category?.apps).toEqual(['bibliotek', 'kv-app']);
    expect(createResponse.json?.categories?.[0]?.apps).toEqual(['bibliotek', 'kv-app']);

    const storedFigure = await mockKv.api.get('figure:kv/test-figur');
    expect(storedFigure?.mode).toBe('kv');

    const initialList = await invokeFigureLibraryApi();
    expect(initialList.statusCode).toBe(200);
    expect(initialList.json?.entries?.[0]?.category?.label).toBe('KV-kategori');
    expect(initialList.json?.entries?.[0]?.category?.apps).toEqual(['bibliotek', 'kv-app']);

    clearFigureLibraryMemoryStores();

    const listAfterReset = await invokeFigureLibraryApi();
    expect(listAfterReset.statusCode).toBe(200);
    expect(listAfterReset.json?.entries).toHaveLength(1);
    expect(listAfterReset.json?.entries?.[0]?.storage).toBe('kv');
    expect(listAfterReset.json?.entries?.[0]?.category?.apps).toEqual(['bibliotek', 'kv-app']);

    const updateResponse = await invokeFigureLibraryApi({
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        slug: 'kv/test-figur',
        title: 'KV Figur Oppdatert',
        category: { label: 'Oppdatert KV', apps: ['kv-app', 'bibliotek', 'bibliotek'] },
        tags: ['oppdatert']
      })
    });

    expect(updateResponse.statusCode).toBe(200);
    expect(updateResponse.json?.entry?.category?.id).toBe('oppdatert-kv');
    expect(updateResponse.json?.entry?.tags).toEqual(['oppdatert']);
    expect(updateResponse.json?.entry?.category?.apps).toEqual(['kv-app', 'bibliotek']);
    const kvUpdatedCategory = updateResponse.json?.categories?.find(cat => cat.id === 'oppdatert-kv');
    expect(kvUpdatedCategory?.apps).toEqual(['kv-app', 'bibliotek']);

    const kvCategory = await mockKv.api.get('figure:category:oppdatert-kv');
    expect(Array.isArray(kvCategory?.figureSlugs)).toBe(true);
    expect(kvCategory?.figureSlugs).toContain('kv/test-figur');
    expect(kvCategory?.apps).toEqual(['kv-app', 'bibliotek']);

    const deleteResponse = await invokeFigureLibraryApi({
      method: 'DELETE',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ slug: 'kv/test-figur' })
    });

    expect(deleteResponse.statusCode).toBe(200);
    expect(deleteResponse.json?.deleted?.slug).toBe('kv/test-figur');

    const indexAfterDelete = await mockKv.api.smembers('figure:__slugs__');
    expect(indexAfterDelete).toEqual([]);

    const finalList = await invokeFigureLibraryApi();
    expect(finalList.json?.entries ?? []).toHaveLength(0);
  });

  test('prevents deleting populated categories and removes empty ones', async () => {
    const createResponse = await invokeFigureLibraryApi({
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        slug: 'category-delete-figure',
        title: 'Figur for kategorisletting',
        tool: 'playwright-test',
        svg: TEST_SVG_MARKUP,
        category: { label: 'Slettekategori' }
      })
    });

    expect(createResponse.statusCode).toBe(200);

    const conflictResponse = await invokeFigureLibraryApi({
      method: 'DELETE',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ categoryId: 'slettekategori' })
    });

    expect(conflictResponse.statusCode).toBe(409);
    expect(conflictResponse.json?.error).toBe('Category contains figures');
    expect(conflictResponse.json?.category?.id).toBe('slettekategori');
    expect(conflictResponse.json?.category?.figureCount).toBe(1);

    const figureDeleteResponse = await invokeFigureLibraryApi({
      method: 'DELETE',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ slug: 'category-delete-figure' })
    });

    expect(figureDeleteResponse.statusCode).toBe(200);

    const successResponse = await invokeFigureLibraryApi({
      method: 'DELETE',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ categoryId: 'slettekategori' })
    });

    expect(successResponse.statusCode).toBe(200);
    expect(successResponse.json?.deleted?.categoryId).toBe('slettekategori');

    const finalState = await invokeFigureLibraryApi();
    const categories = Array.isArray(finalState.json?.categories) ? finalState.json.categories : [];
    expect(categories.some((category) => category?.id === 'slettekategori')).toBe(false);
  });
});
