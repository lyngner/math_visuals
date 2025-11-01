const { test, expect } = require('@playwright/test');

function getSorteringState(page) {
  return page.evaluate(() => {
    const api = window.mathVisSortering;
    if (!api || typeof api.getState !== 'function') {
      return null;
    }
    return api.getState();
  });
}

test.describe('sortering figure editor', () => {
  test('keeps figure mode after selecting library figure', async ({ page }) => {
    await page.goto('/sortering.html', { waitUntil: 'load' });

    const figureItem = page.locator('.sortering__item[data-item-id="item-4"]');
    const typeSelect = figureItem.locator('.sortering__item-editor-select');
    await expect(typeSelect).toHaveValue('figure');

    const figureRow = figureItem.locator('.sortering__item-editor-figure-row').first();
    const categorySelect = figureRow.locator('select').first();
    await categorySelect.selectOption('terninger');

    const figureSelect = figureRow.locator('.sortering__item-editor-figure-select');
    await expect(figureSelect).toBeEnabled();
    await expect(figureSelect.locator('option[value="d1.svg"]')).toHaveCount(1);
    await figureSelect.selectOption('d1.svg');

    const valueInput = figureRow.locator('input[type="text"]');
    await expect(valueInput).toHaveValue('d1.svg');
    await expect(typeSelect).toHaveValue('figure');

    const state = await getSorteringState(page);
    expect(state).not.toBeNull();

    const figureState = state.items.find(item => item.id === 'item-4');
    expect(figureState).toBeDefined();
    expect(figureState.type).toBe('figure');
    expect(Array.isArray(figureState.figures)).toBe(true);
    expect(figureState.figures[0].value).toBe('d1.svg');
  });

  test('persists figure edits without accessibility list', async ({ page }) => {
    await page.route('**/sortering.html', async route => {
      const response = await route.fetch();
      let body = await response.text();
      body = body.replace('<ol id="sortSkia" class="sr-only" tabindex="-1"></ol>', '');
      const headers = { ...response.headers() };
      delete headers['content-length'];
      delete headers['Content-Length'];
      const contentType = headers['content-type'] || headers['Content-Type'] || 'text/html';
      await route.fulfill({
        status: response.status(),
        headers,
        contentType,
        body
      });
    });

    await page.goto('/sortering.html', { waitUntil: 'load' });

    await expect(page.locator('#sortSkia')).toHaveCount(0);

    const firstItem = page.locator('.sortering__item').first();
    await expect(firstItem).toBeVisible();
    const itemId = await firstItem.getAttribute('data-item-id');

    const editButton = firstItem.locator('.sortering__item-edit-button');
    await editButton.click();

    const typeSelect = firstItem.locator('.sortering__item-editor-select');
    await expect(typeSelect).toBeVisible();
    await typeSelect.selectOption('figure');

    const figureRow = firstItem.locator('.sortering__item-editor-figure-row').first();
    await expect(figureRow).toBeVisible();

    const categorySelect = figureRow.locator('select').first();
    await categorySelect.selectOption('tierbrett');

    const figureSelect = figureRow.locator('.sortering__item-editor-figure-select');
    await expect(figureSelect).toBeEnabled();
    await expect(figureSelect.locator('option[value="tb4.svg"]')).toHaveCount(1);
    await figureSelect.selectOption('tb4.svg');
    await expect(figureSelect).toHaveValue('tb4.svg');

    await firstItem.locator('.sortering__item-editor-update').click();

    const cardImage = firstItem.locator('.sortering__item-image');
    await expect(cardImage).toHaveAttribute('src', /tb4\.svg$/);

    const state = await getSorteringState(page);
    expect(state).not.toBeNull();
    const targetItem = state.items.find(entry => entry && entry.id === itemId);
    expect(targetItem).toBeDefined();
    expect(targetItem.type).toBe('figure');
    expect(Array.isArray(targetItem.figures)).toBe(true);
    expect(targetItem.figures[0].value).toBe('tb4.svg');
  });
});
