const { test, expect } = require('@playwright/test');

function buildFigureLibraryPayload() {
  return {
    storageMode: 'memory',
    categories: [
      { id: 'sortering-exclusive', label: 'Sortering eksklusiv', apps: ['sortering'] },
      { id: 'maling-exclusive', label: 'Måling eksklusiv', apps: ['maling'] }
    ],
    entries: [
      {
        id: 'sortering-figur',
        slug: 'sortering-figur',
        title: 'Sortering figur',
        summary: 'Remote figur for Sortering',
        image: 'https://sortering-only.test/library/sortering.svg',
        categoryId: 'sortering-exclusive',
        categoryName: 'Sortering eksklusiv',
        category: {
          id: 'sortering-exclusive',
          label: 'Sortering eksklusiv',
          apps: ['sortering']
        }
      },
      {
        id: 'maling-figur',
        slug: 'maling-figur',
        title: 'Måling figur',
        summary: 'Remote figur for Måling',
        image: 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"><circle cx="5" cy="5" r="4" fill="red"/></svg>'),
        categoryId: 'maling-exclusive',
        categoryName: 'Måling eksklusiv',
        category: {
          id: 'maling-exclusive',
          label: 'Måling eksklusiv',
          apps: ['maling']
        }
      }
    ]
  };
}

test.describe('figure library app scoping', () => {
  test('måling filters remote categories by app metadata', async ({ page }) => {
    const blockedRequests = [];

    await page.route('https://sortering-only.test/**', async route => {
      blockedRequests.push(route.request().url());
      await route.abort();
    });

    await page.route('**/api/figure-library**', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(buildFigureLibraryPayload())
      });
    });

    const response = await page.goto('/måling.html', { waitUntil: 'load' });
    expect(response?.ok()).toBeTruthy();

    const categorySelect = page.locator('#cfg-figure-category');
    await expect(categorySelect).toBeVisible();
    await expect(categorySelect.locator('option', { hasText: 'Måling eksklusiv' })).toHaveCount(1);
    await expect(categorySelect.locator('option', { hasText: 'Sortering eksklusiv' })).toHaveCount(0);

    expect(blockedRequests).toHaveLength(0);
  });

  test('sortering includes remote categories for allowed apps', async ({ page }) => {
    const requested = [];

    await page.route('https://sortering-only.test/**', async route => {
      requested.push(route.request().url());
      await route.fulfill({
        status: 200,
        contentType: 'image/svg+xml',
        body: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"><rect width="10" height="10" fill="#2563eb"/></svg>'
      });
    });

    await page.route('**/api/figure-library**', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(buildFigureLibraryPayload())
      });
    });

    const response = await page.goto('/sortering.html', { waitUntil: 'load' });
    expect(response?.ok()).toBeTruthy();

    const firstItem = page.locator('.sortering__item').first();
    await expect(firstItem).toBeVisible();
    await firstItem.click();

    const figureRow = firstItem.locator('.sortering__item-editor-figure-row').first();
    const categorySelect = figureRow.locator('select').first();
    await expect(categorySelect.locator('option', { hasText: 'Sortering eksklusiv' })).toHaveCount(1);
    await expect(categorySelect.locator('option', { hasText: 'Måling eksklusiv' })).toHaveCount(0);

    await categorySelect.selectOption('sortering-exclusive');

    const figureSelect = figureRow.locator('.sortering__item-editor-figure-select');
    await expect(figureSelect.locator('option[value="sortering-figur"]')).toHaveCount(1);
    await figureSelect.selectOption('sortering-figur');

    await expect.poll(() => requested.length).toBeGreaterThan(0);
  });
});
