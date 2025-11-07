const path = require('node:path');
const { test, expect } = require('@playwright/test');

const {
  createFigureLibraryRouteHandler,
  clearFigureLibraryMemoryStores
} = require('./helpers/figure-library-api-utils');
const { setupKvMock } = require('./helpers/kv-mock');

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

test.describe('Figurbibliotek opplastinger', () => {
  test.beforeEach(async ({ page, context }) => {
    delete process.env.KV_REST_API_URL;
    delete process.env.KV_REST_API_TOKEN;
    mockKv.clear();
    clearFigureLibraryMemoryStores();

    await context.addInitScript(() => {
      try {
        window.localStorage?.clear();
        window.sessionStorage?.clear();
      } catch (error) {}
      const pngPrefix = 'data:image/png;base64,';
      window.MathVisSvgExport = {
        ensureSvgNamespaces: () => {},
        getSvgCanvasBounds: () => ({ minX: 0, minY: 0, width: 120, height: 120 }),
        renderSvgToPng: async () => ({
          dataUrl: pngPrefix + btoa('figure-library-ui'),
          width: 120,
          height: 120
        })
      };
    });

    await page.route('**/api/figure-library**', createFigureLibraryRouteHandler());

    const response = await page.goto('/bibliotek.html', { waitUntil: 'networkidle' });
    expect(response?.ok()).toBeTruthy();
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

  test('lar brukere laste opp, redigere og bevare figurer', async ({ page }) => {
    const fixturesDir = path.join(__dirname, 'fixtures', 'figure-library');
    const files = [
      path.join(fixturesDir, 'grid-figure.svg'),
      path.join(fixturesDir, 'triangle-figure.svg')
    ];

    await page.locator('[data-upload-file]').setInputFiles(files);
    await page.locator('[data-upload-name]').fill('Tilpasset figur');
    await page.locator('[data-upload-category]').fill('Testkategori');
    await page.getByRole('button', { name: 'Legg til figur' }).click();

    const testCategory = page
      .locator('[data-category-grid] .categoryItem')
      .filter({ has: page.locator('h3', { hasText: 'Testkategori' }) });
    await expect(testCategory.locator('.categoryCount')).toHaveText('2 figurer');

    const categoryButton = testCategory.locator('button.categoryButton');
    await categoryButton.click();

    const categoryDialog = page.locator('[data-category-dialog]');
    await expect(categoryDialog).toBeVisible();

    const initialItems = categoryDialog.locator('[data-category-figures] .bibliotekItem');
    await expect(initialItems).toHaveCount(2);
    await expect(initialItems.nth(0).locator('h2')).toHaveText('Tilpasset figur 1');
    await expect(initialItems.nth(1).locator('h2')).toHaveText('Tilpasset figur 2');

    await initialItems.nth(0).getByRole('button', { name: 'Rediger' }).click();

    const editorDialog = page.locator('dialog[data-custom-editor]');
    await expect(editorDialog).toBeVisible();
    await editorDialog.locator('[data-editor-name]').fill('Oppdatert figur');
    await editorDialog.locator('[data-editor-category]').fill('Oppdatert kategori');
    await editorDialog.getByRole('button', { name: 'Lagre endringer' }).click();
    await expect(editorDialog).toBeHidden();

    const updatedCategory = page
      .locator('[data-category-grid] .categoryItem')
      .filter({ has: page.locator('h3', { hasText: 'Oppdatert kategori' }) });
    await expect(updatedCategory.locator('.categoryCount')).toHaveText('1 figur');

    await updatedCategory.locator('button.categoryButton').click();
    await expect(categoryDialog).toBeVisible();
    const updatedItems = categoryDialog.locator('[data-category-figures] .bibliotekItem');
    await expect(updatedItems).toHaveCount(1);
    await expect(updatedItems.first().locator('h2')).toHaveText('Oppdatert figur');

    await page.reload({ waitUntil: 'networkidle' });

    const reloadedUpdatedCategory = page
      .locator('[data-category-grid] .categoryItem')
      .filter({ has: page.locator('h3', { hasText: 'Oppdatert kategori' }) });
    await expect(reloadedUpdatedCategory.locator('.categoryCount')).toHaveText('1 figur');

    await reloadedUpdatedCategory.locator('button.categoryButton').click();
    await expect(page.locator('[data-category-dialog]')).toBeVisible();
    await expect(page.locator('[data-category-dialog] [data-category-figures] .bibliotekItem')).toHaveCount(1);
    await expect(
      page
        .locator('[data-category-dialog] [data-category-figures] .bibliotekItem h2')
        .first()
    ).toHaveText('Oppdatert figur');

    await page.locator('[data-category-dialog] [data-category-close]').click();

    const remainingCategory = page
      .locator('[data-category-grid] .categoryItem')
      .filter({ has: page.locator('h3', { hasText: 'Testkategori' }) });
    await expect(remainingCategory.locator('.categoryCount')).toHaveText('1 figur');
  });
});
