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
    await page.getByRole('button', { name: 'Legg til figur' }).click();

    const testCategory = page
      .locator('[data-category-grid] .categoryItem')
      .filter({ has: page.locator('h3', { hasText: 'Testkategori' }) });
    await expect(testCategory.locator('.categoryCount')).toHaveText('2 figurer');

    const categoryButton = testCategory.locator('button.categoryButton');
    await categoryButton.click();

    const categoryDialog = page.locator('[data-category-dialog]');
    await expect(categoryDialog).toBeVisible();

    const categoryAppsFieldset = categoryDialog.locator('[data-category-apps="category"]');
    await expect(categoryAppsFieldset).toBeVisible();
    const measurementCheckbox = categoryAppsFieldset.getByRole('checkbox', { name: 'Måling' });
    const sortingCheckbox = categoryAppsFieldset.getByRole('checkbox', { name: 'Sortering' });
    await expect(measurementCheckbox).toBeChecked();
    await expect(sortingCheckbox).toBeChecked();

    const saveAvailabilityButton = categoryDialog.getByRole('button', { name: 'Lagre tilgjengelighet' });
    await expect(saveAvailabilityButton).toBeDisabled();
    await sortingCheckbox.uncheck();
    await expect(saveAvailabilityButton).toBeEnabled();

    const firstCategoryPatchPromise = page.waitForRequest((request) => {
      if (!request.url().includes('/api/figure-library')) return false;
      if (request.method() !== 'PATCH') return false;
      const payload = request.postDataJSON();
      return payload && !payload.slug;
    });
    const firstCategoryPatchResponsePromise = page.waitForResponse((response) => {
      if (!response.url().includes('/api/figure-library')) return false;
      if (response.request().method() !== 'PATCH') return false;
      const payload = response.request().postDataJSON();
      return payload && !payload.slug;
    });
    await Promise.all([firstCategoryPatchPromise, firstCategoryPatchResponsePromise, saveAvailabilityButton.click()]);
    const firstCategoryPatchResponse = await firstCategoryPatchResponsePromise;
    expect(firstCategoryPatchResponse.ok()).toBeTruthy();
    const firstCategoryPatchBody = await firstCategoryPatchResponse.json();
    expect(firstCategoryPatchBody.category?.apps).toEqual(['bibliotek', 'måling']);
    await expect(categoryDialog.locator('[data-category-apps-status]')).toHaveText('Tilgjengelighet oppdatert.');
    await expect(saveAvailabilityButton).toBeDisabled();

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

    const updatedAppsFieldset = categoryDialog.locator('[data-category-apps="category"]');
    const updatedMeasurementCheckbox = updatedAppsFieldset.getByRole('checkbox', { name: 'Måling' });
    const updatedSortingCheckbox = updatedAppsFieldset.getByRole('checkbox', { name: 'Sortering' });
    await expect(updatedMeasurementCheckbox).toBeChecked();
    await expect(updatedSortingCheckbox).toBeChecked();

    const updatedSaveButton = categoryDialog.getByRole('button', { name: 'Lagre tilgjengelighet' });
    await updatedMeasurementCheckbox.uncheck();
    await expect(updatedSaveButton).toBeEnabled();
    const secondCategoryPatchPromise = page.waitForRequest((request) => {
      if (!request.url().includes('/api/figure-library')) return false;
      if (request.method() !== 'PATCH') return false;
      const payload = request.postDataJSON();
      return payload && !payload.slug;
    });
    const secondCategoryPatchResponsePromise = page.waitForResponse((response) => {
      if (!response.url().includes('/api/figure-library')) return false;
      if (response.request().method() !== 'PATCH') return false;
      const payload = response.request().postDataJSON();
      return payload && !payload.slug;
    });
    await Promise.all([secondCategoryPatchPromise, secondCategoryPatchResponsePromise, updatedSaveButton.click()]);
    const secondCategoryPatchResponse = await secondCategoryPatchResponsePromise;
    expect(secondCategoryPatchResponse.ok()).toBeTruthy();
    const secondCategoryPatchBody = await secondCategoryPatchResponse.json();
    expect(secondCategoryPatchBody.category?.apps).toEqual(['bibliotek', 'sortering']);
    await expect(categoryDialog.locator('[data-category-apps-status]')).toHaveText('Tilgjengelighet oppdatert.');
    await expect(updatedSaveButton).toBeDisabled();

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
    const reloadedAppsFieldset = page.locator('[data-category-dialog] [data-category-apps="category"]');
    await expect(reloadedAppsFieldset.getByRole('checkbox', { name: 'Måling' })).not.toBeChecked();
    await expect(reloadedAppsFieldset.getByRole('checkbox', { name: 'Sortering' })).toBeChecked();

    await page.locator('[data-category-dialog] [data-category-close]').click();

    const remainingCategory = page
      .locator('[data-category-grid] .categoryItem')
      .filter({ has: page.locator('h3', { hasText: 'Testkategori' }) });
    await expect(remainingCategory.locator('.categoryCount')).toHaveText('1 figur');

    const postRequests = figureLibraryRequests.filter((request) => request.method() === 'POST');
    expect(postRequests).toHaveLength(2);
    const postPayload = postRequests[0].postDataJSON();
    expect(postPayload.category?.apps).toEqual(['bibliotek', 'måling', 'sortering']);
    expect(postPayload.categoryApps).toEqual(['bibliotek', 'måling', 'sortering']);

    const patchRequests = figureLibraryRequests.filter((request) => request.method() === 'PATCH');
    const categoryPatchRequests = patchRequests.filter((request) => {
      const payload = request.postDataJSON();
      return payload && !payload.slug;
    });
    const figurePatchRequests = patchRequests.filter((request) => {
      const payload = request.postDataJSON();
      return payload && payload.slug;
    });

    expect(categoryPatchRequests).toHaveLength(2);
    expect(figurePatchRequests).toHaveLength(1);

    const firstCategoryPayload = categoryPatchRequests[0].postDataJSON();
    expect(firstCategoryPayload.category?.apps).toEqual(['bibliotek', 'måling']);
    expect(firstCategoryPayload.categoryApps).toEqual(['bibliotek', 'måling']);

    const figurePatchPayload = figurePatchRequests[0].postDataJSON();
    expect(figurePatchPayload.category?.apps).toEqual(['bibliotek', 'måling', 'sortering']);
    expect(figurePatchPayload.categoryApps).toEqual(['bibliotek', 'måling', 'sortering']);

    const secondCategoryPayload = categoryPatchRequests[1].postDataJSON();
    expect(secondCategoryPayload.category?.apps).toEqual(['bibliotek', 'sortering']);
    expect(secondCategoryPayload.categoryApps).toEqual(['bibliotek', 'sortering']);
  });

  test('viser appvalg i kategoridialogen og ikke i skjemaet for ny kategori', async ({ page }) => {
    const fixturesDir = path.join(__dirname, 'fixtures', 'figure-library');
    const file = path.join(fixturesDir, 'grid-figure.svg');

    await page.locator('[data-upload-file]').setInputFiles(file);
    await page.locator('[data-upload-name]').fill('Kategoriinspeksjon');
    await page.locator('[data-upload-category]').fill('Testkategori');
    await page.getByRole('button', { name: 'Legg til figur' }).click();

    await page.locator('[data-category-grid] .categoryItem button.categoryButton').first().click();
    const categoryDialog = page.locator('[data-category-dialog]');
    await expect(categoryDialog.locator('[data-category-apps="category"]')).toBeVisible();
    await categoryDialog.locator('[data-category-close]').click();

    await page.getByRole('button', { name: 'Ny kategori' }).click();
    const addForm = page.locator('[data-add-category-form]');
    await expect(addForm).toBeVisible();
    await expect(addForm.locator('[data-category-apps]')).toHaveCount(0);
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

  test('støtter massevalg i kategoridialogen', async ({ page }) => {
    const fixturesDir = path.join(__dirname, 'fixtures', 'figure-library');
    const files = [
      path.join(fixturesDir, 'grid-figure.svg'),
      path.join(fixturesDir, 'triangle-figure.svg')
    ];

    await page.locator('[data-upload-file]').setInputFiles(files);
    await page.locator('[data-upload-name]').fill('Bulkvalg');
    await page.locator('[data-upload-category]').fill('Bulkategori');
    await page.getByRole('button', { name: 'Legg til figur' }).click();

    const bulkCategoryTile = page
      .locator('[data-category-grid] .categoryItem')
      .filter({ has: page.locator('h3', { hasText: 'Bulkategori' }) });
    await expect(bulkCategoryTile.locator('.categoryCount')).toHaveText('2 figurer');

    await bulkCategoryTile.locator('button.categoryButton').click();

    const categoryDialog = page.locator('[data-category-dialog]');
    await expect(categoryDialog).toBeVisible();

    const selectAllButton = categoryDialog.locator('[data-category-select-all]');
    const deleteButton = categoryDialog.locator('[data-category-delete]');
    const toggles = categoryDialog.locator('[data-category-toggle]');

    await expect(selectAllButton).toBeEnabled();
    await expect(selectAllButton).toHaveAttribute('data-mode', 'select');
    await expect(selectAllButton).toContainText('Velg alle figurer');

    await selectAllButton.click();

    await expect(selectAllButton).toBeEnabled();
    await expect(selectAllButton).toHaveAttribute('data-mode', 'clear');
    await expect(selectAllButton).toContainText('Fjern alle figurer');
    await expect(deleteButton).toContainText('Slett figurer');
    await expect(toggles).toHaveCount(2);
    await expect(toggles.first()).toHaveAttribute('aria-pressed', 'true');
    await expect(toggles.nth(1)).toHaveAttribute('aria-pressed', 'true');

    const filter = page.locator('[data-filter]');
    await filter.fill('Bulk');

    await expect(selectAllButton).toBeEnabled();
    await expect(selectAllButton).toContainText('Fjern alle figurer');

    await selectAllButton.click();

    await expect(selectAllButton).toContainText('Velg alle figurer');
    await expect(selectAllButton).toHaveAttribute('data-mode', 'select');
    await expect(selectAllButton).toBeDisabled();
    await expect(deleteButton).toContainText('Slett figur(er)');
    await expect(toggles.first()).toHaveAttribute('aria-pressed', 'false');
    await expect(toggles.nth(1)).toHaveAttribute('aria-pressed', 'false');

    await filter.fill('');

    await expect(selectAllButton).toBeEnabled();
    await expect(selectAllButton).toContainText('Velg alle figurer');
  });
});
