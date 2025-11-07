const { test, expect } = require('@playwright/test');

const {
  clearFigureLibraryMemoryStores
} = require('./helpers/figure-library-api-utils');
const { setupKvMock } = require('./helpers/kv-mock');

const CUSTOM_STORAGE_KEY = 'mathvis:figureLibrary:customEntries:v1';

const { mockKv, cleanup: cleanupKvMock } = setupKvMock();

const originalKvUrl = process.env.KV_REST_API_URL;
const originalKvToken = process.env.KV_REST_API_TOKEN;

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

function buildSvgDataUrl(markup) {
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(markup)}`;
}

test.describe('Figurbibliotek hurtig cache', () => {
  test.beforeEach(async ({ context }) => {
    delete process.env.KV_REST_API_URL;
    delete process.env.KV_REST_API_TOKEN;
    mockKv.clear();
    clearFigureLibraryMemoryStores();

    const cachedEntry = {
      id: 'cached-figure',
      slug: 'cached-figure',
      name: 'Lokal figur',
      categoryId: 'cached-category',
      categoryName: 'Cachet kategori',
      dataUrl: buildSvgDataUrl('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"><rect width="10" height="10" fill="green"/></svg>'),
      summary: 'Cachet figur',
      createdAt: '2023-01-01T00:00:00.000Z'
    };

    await context.addInitScript(({ storageKey, entry }) => {
      try {
        window.localStorage?.clear();
        window.sessionStorage?.clear();
        window.localStorage?.setItem(storageKey, JSON.stringify([entry]));
      } catch (error) {}
      const pngPrefix = 'data:image/png;base64,';
      window.MathVisSvgExport = {
        ensureSvgNamespaces: () => {},
        getSvgCanvasBounds: () => ({ minX: 0, minY: 0, width: 120, height: 120 }),
        renderSvgToPng: async () => ({
          dataUrl: pngPrefix + btoa('figure-library-cache'),
          width: 120,
          height: 120
        })
      };
    }, { storageKey: CUSTOM_STORAGE_KEY, entry: cachedEntry });
  });

  test.afterEach(async ({ page }) => {
    await page.unroute('**/api/figure-library**');
    clearFigureLibraryMemoryStores();
  });

  test.afterAll(() => {
    cleanupKvMock();
    clearFigureLibraryMemoryStores();
    restoreKvEnv();
  });

  test('viser cachede figurer før treig respons og oppdaterer etterpå', async ({ page }) => {
    let releaseResponse;
    const allowResponse = new Promise((resolve) => {
      releaseResponse = resolve;
    });

    await page.route('**/api/figure-library**', async (route) => {
      await allowResponse;
      await new Promise((resolve) => setTimeout(resolve, 300));
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          storageMode: 'memory',
          entries: [
            {
              id: 'cached-figure',
              slug: 'cached-figure',
              name: 'Oppdatert figur',
              categoryId: 'cached-category',
              categoryName: 'Cachet kategori',
              svg: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"><rect width="10" height="10" fill="blue"/></svg>',
              summary: 'Oppdatert fra server',
              createdAt: '2024-01-01T00:00:00.000Z'
            },
            {
              id: 'remote-figure',
              slug: 'remote-figure',
              name: 'Remote figur',
              categoryId: 'cached-category',
              categoryName: 'Cachet kategori',
              svg: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"><circle cx="5" cy="5" r="4" fill="red"/></svg>',
              summary: 'Ny fra server',
              createdAt: '2024-01-02T00:00:00.000Z'
            }
          ],
          categories: [
            {
              id: 'cached-category',
              label: 'Cachet kategori',
              description: 'Serverkategori',
              sampleSlug: 'tb10'
            }
          ]
        })
      });
    });

    const response = await page.goto('/bibliotek.html', { waitUntil: 'domcontentloaded' });
    expect(response?.ok()).toBeTruthy();

    const categoryTile = page
      .locator('[data-category-grid] .categoryItem')
      .filter({ has: page.locator('h3', { hasText: 'Cachet kategori' }) });

    await expect(categoryTile.locator('.categoryCount')).toHaveText('1 figur', { timeout: 2000 });

    await categoryTile.locator('button.categoryButton').click();

    const categoryDialog = page.locator('[data-category-dialog]');
    await expect(categoryDialog).toBeVisible();

    const figureTitles = categoryDialog.locator('[data-category-figures] .bibliotekItem h2');
    await expect(figureTitles).toHaveCount(1);
    await expect(figureTitles.first()).toHaveText('Lokal figur');

    const apiResponsePromise = page.waitForResponse('**/api/figure-library**');
    releaseResponse();
    await apiResponsePromise;

    await expect(categoryTile.locator('.categoryCount')).toHaveText('2 figurer', { timeout: 5000 });
    await expect(figureTitles).toHaveCount(2);
    await expect(figureTitles.filter({ hasText: 'Oppdatert figur' })).toHaveCount(1);
    await expect(figureTitles.filter({ hasText: 'Remote figur' })).toHaveCount(1);
    await expect(figureTitles.filter({ hasText: 'Lokal figur' })).toHaveCount(0);
  });
});
