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

    const figureLibraryRequests = [];
    page.on('request', (request) => {
      if (
        request.url().includes('/api/figure-library') &&
        (request.method() === 'POST' || request.method() === 'PATCH')
      ) {
        figureLibraryRequests.push(request);
      }
    });

    await page.locator('[data-upload-file]').setInputFiles(files);
    await page.locator('[data-upload-name]').fill('Tilpasset figur');
    await page.locator('[data-upload-category]').fill('Testkategori');
    const uploadAppsFieldset = page.locator('[data-category-apps="upload"]');
    await expect(uploadAppsFieldset).toBeVisible();
    await expect(uploadAppsFieldset.getByRole('checkbox', { name: 'Måling' })).toBeChecked();
    await uploadAppsFieldset.getByRole('checkbox', { name: 'Sortering' }).uncheck();

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
    const editorAppsFieldset = editorDialog.locator('[data-category-apps="editor"]');
    await expect(editorAppsFieldset.getByRole('checkbox', { name: 'Måling' })).toBeChecked();
    await expect(editorAppsFieldset.getByRole('checkbox', { name: 'Sortering' })).not.toBeChecked();
    await editorDialog.locator('[data-editor-name]').fill('Oppdatert figur');
    await editorDialog.locator('[data-editor-category]').fill('Oppdatert kategori');
    await editorAppsFieldset.getByRole('checkbox', { name: 'Sortering' }).check();
    await editorAppsFieldset.getByRole('checkbox', { name: 'Måling' }).uncheck();
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
    const reloadedItem = page
      .locator('[data-category-dialog] [data-category-figures] .bibliotekItem')
      .first();
    await reloadedItem.getByRole('button', { name: 'Rediger' }).click();
    await expect(editorDialog).toBeVisible();
    const reloadedEditorApps = editorDialog.locator('[data-category-apps="editor"]');
    await expect(reloadedEditorApps.getByRole('checkbox', { name: 'Måling' })).not.toBeChecked();
    await expect(reloadedEditorApps.getByRole('checkbox', { name: 'Sortering' })).toBeChecked();
    await editorDialog.getByRole('button', { name: 'Avbryt' }).click();
    await expect(editorDialog).toBeHidden();

    await page.locator('[data-category-dialog] [data-category-close]').click();

    const remainingCategory = page
      .locator('[data-category-grid] .categoryItem')
      .filter({ has: page.locator('h3', { hasText: 'Testkategori' }) });
    await expect(remainingCategory.locator('.categoryCount')).toHaveText('1 figur');

    const postRequests = figureLibraryRequests.filter((request) => request.method() === 'POST');
    expect(postRequests).toHaveLength(2);
    const postPayload = postRequests[0].postDataJSON();
    expect(postPayload.category?.apps).toEqual(['bibliotek', 'måling']);
    expect(postPayload.categoryApps).toEqual(['bibliotek', 'måling']);

    const patchRequests = figureLibraryRequests.filter((request) => request.method() === 'PATCH');
    expect(patchRequests).toHaveLength(1);
    const patchPayload = patchRequests[0].postDataJSON();
    expect(patchPayload.category?.apps).toEqual(['bibliotek', 'sortering']);
    expect(patchPayload.categoryApps).toEqual(['bibliotek', 'sortering']);
  });

  test('lar redaktører velge apper for nye kategorier', async ({ page }) => {
    await page.getByRole('button', { name: 'Ny kategori' }).click();

    const addForm = page.locator('[data-add-category-form]');
    await expect(addForm).toBeVisible();

    const addAppsFieldset = addForm.locator('[data-category-apps="add"]');
    await expect(addAppsFieldset).toBeVisible();
    const measurementCheckbox = addAppsFieldset.getByRole('checkbox', { name: 'Måling' });
    const sortingCheckbox = addAppsFieldset.getByRole('checkbox', { name: 'Sortering' });
    await expect(measurementCheckbox).toBeChecked();
    await expect(sortingCheckbox).toBeChecked();

    await sortingCheckbox.uncheck();

    await addForm.locator('[data-add-category-input]').fill('Geometrikategori');
    await addForm.getByRole('button', { name: 'Legg til kategori' }).click();

    const newCategoryTile = page
      .locator('[data-category-grid] .categoryItem')
      .filter({ has: page.locator('h3', { hasText: 'Geometrikategori' }) });
    await expect(newCategoryTile).toHaveCount(1);

    const storedCategories = await page.evaluate(() => {
      try {
        const raw = window.localStorage.getItem('mathvis:figureLibrary:customCategories:v1');
        return raw ? JSON.parse(raw) : null;
      } catch (error) {
        return null;
      }
    });

    const storedCategory = Array.isArray(storedCategories)
      ? storedCategories.find((category) => category?.name === 'Geometrikategori')
      : null;
    expect(storedCategory?.apps).toEqual(['bibliotek', 'måling']);

    await page.getByRole('button', { name: 'Ny kategori' }).click();

    const reopenedFieldset = page.locator('[data-add-category-form] [data-category-apps="add"]');
    await expect(reopenedFieldset.getByRole('checkbox', { name: 'Sortering' })).toBeChecked();
    await expect(reopenedFieldset.getByRole('checkbox', { name: 'Måling' })).toBeChecked();
  });

  test('lar brukere slette tomme egendefinerte kategorier', async ({ page }) => {
    const fixturesDir = path.join(__dirname, 'fixtures', 'figure-library');
    const file = path.join(fixturesDir, 'grid-figure.svg');

    await page.locator('[data-upload-file]').setInputFiles(file);
    await page.locator('[data-upload-name]').fill('Slettefigur');
    await page.locator('[data-upload-category]').fill('Slettekategori');
    await page.getByRole('button', { name: 'Legg til figur' }).click();

    const status = page.locator('[data-status]');
    const deleteCategoryTile = page
      .locator('[data-category-grid] .categoryItem')
      .filter({ has: page.locator('h3', { hasText: 'Slettekategori' }) });

    await expect(deleteCategoryTile.locator('.categoryCount')).toHaveText('1 figur');

    const menuButton = deleteCategoryTile.locator('button.categoryMenuToggle');
    await menuButton.click();
    await page.getByRole('menuitem', { name: 'Slett kategori' }).click();

    await expect(status).toHaveText('Kan ikke slette kategorien «Slettekategori». Fjern figuren først.');

    await deleteCategoryTile.locator('button.categoryButton').click();
    const categoryDialog = page.locator('[data-category-dialog]');
    await expect(categoryDialog).toBeVisible();

    const figureToggle = categoryDialog.locator('[data-category-figures] [data-category-item]').first().locator('[data-category-toggle]');
    await figureToggle.click();
    await categoryDialog.locator('[data-category-delete]').click();
    await expect(categoryDialog.locator('[data-category-empty]')).toBeVisible();
    await categoryDialog.locator('[data-category-close]').click();
    await expect(categoryDialog).toBeHidden();

    await expect(deleteCategoryTile.locator('.categoryCount')).toHaveText('0 figurer');

    await menuButton.click();
    page.once('dialog', (dialog) => dialog.accept());
    await page.getByRole('menuitem', { name: 'Slett kategori' }).click();

    await expect(deleteCategoryTile).toHaveCount(0);
    await expect(status).toHaveText('Kategorien «Slettekategori» ble slettet.');
  });
});
