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
  test('blocks reordering while inline editor is active', async ({ page }) => {
    await page.goto('/sortering.html', { waitUntil: 'load' });

    const figureItem = page.locator('.sortering__item[data-item-id="item-4"]');
    await expect(figureItem).toBeVisible();

    await figureItem.click();

    const inlineEditor = figureItem.locator('.sortering__item-editor');
    await expect(inlineEditor).toBeVisible();

    const reorderButton = figureItem.locator('.sortering__skia-button');
    await expect(reorderButton).toBeDisabled();
    await expect(reorderButton).toHaveAttribute('aria-disabled', 'true');

    const initialState = await getSorteringState(page);
    expect(initialState).not.toBeNull();
    expect(Array.isArray(initialState.order)).toBe(true);
    const initialOrder = Array.isArray(initialState.order) ? [...initialState.order] : [];

    const figureBox = await figureItem.boundingBox();
    const firstItem = page.locator('.sortering__item').first();
    const targetBox = await firstItem.boundingBox();
    expect(figureBox).not.toBeNull();
    expect(targetBox).not.toBeNull();

    if (figureBox && targetBox) {
      await page.mouse.move(figureBox.x + figureBox.width / 2, figureBox.y + figureBox.height / 2);
      await page.mouse.down();
      await page.mouse.move(targetBox.x + targetBox.width / 2, targetBox.y + targetBox.height / 2, {
        steps: 5
      });
      await page.mouse.up();
    }

    await expect(inlineEditor).toBeVisible();

    const afterDragState = await getSorteringState(page);
    expect(afterDragState).not.toBeNull();
    expect(Array.isArray(afterDragState.order)).toBe(true);
    const afterDragOrder = Array.isArray(afterDragState.order) ? [...afterDragState.order] : [];
    expect(afterDragOrder).toEqual(initialOrder);

    const typeSelect = figureItem.locator('.sortering__item-editor-select');
    await expect(typeSelect).toHaveValue('figure');

    const figureRow = figureItem.locator('.sortering__item-editor-figure-row').first();
    const categorySelect = figureRow.locator('select').first();
    await categorySelect.selectOption('humans');

    const figureSelect = figureRow.locator('.sortering__item-editor-figure-select');
    await expect(figureSelect).toBeEnabled();
    await figureSelect.selectOption('/images/measure/dame155.svg');

    await figureItem.locator('.sortering__item-editor-update').click();

    await expect(reorderButton).not.toBeDisabled();
    await expect(reorderButton).not.toHaveAttribute('aria-disabled', 'true');

    const cardImage = figureItem.locator('.sortering__item-image');
    await expect(cardImage).toHaveAttribute('src', /dame155\.svg$/);

    const finalState = await getSorteringState(page);
    expect(finalState).not.toBeNull();
    const figureState = finalState.items.find(item => item && item.id === 'item-4');
    expect(figureState).toBeDefined();
    expect(figureState.type).toBe('figure');
    expect(Array.isArray(figureState.figures)).toBe(true);
    expect(figureState.figures[0].value).toBe('/images/measure/dame155.svg');
  });

  test('keeps figure mode after selecting library figure', async ({ page }) => {
    await page.goto('/sortering.html', { waitUntil: 'load' });

    const figureItem = page.locator('.sortering__item[data-item-id="item-4"]');
    const typeSelect = figureItem.locator('.sortering__item-editor-select');
    await expect(typeSelect).toHaveValue('figure');

    const figureRow = figureItem.locator('.sortering__item-editor-figure-row').first();
    const categorySelect = figureRow.locator('select').first();
    await categorySelect.selectOption('humans');

    const figureSelect = figureRow.locator('.sortering__item-editor-figure-select');
    await expect(figureSelect).toBeEnabled();
    await expect(figureSelect.locator('option[value="/images/measure/gutt120.svg"]')).toHaveCount(1);
    await figureSelect.selectOption('/images/measure/gutt120.svg');

    const valueInput = figureRow.locator('input[type="text"]');
    await expect(valueInput).toHaveValue('/images/measure/gutt120.svg');
    await expect(typeSelect).toHaveValue('figure');

    const state = await getSorteringState(page);
    expect(state).not.toBeNull();

    const figureState = state.items.find(item => item.id === 'item-4');
    expect(figureState).toBeDefined();
    expect(figureState.type).toBe('figure');
    expect(Array.isArray(figureState.figures)).toBe(true);
    expect(figureState.figures[0].value).toBe('/images/measure/gutt120.svg');
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

    await firstItem.click();

    const typeSelect = firstItem.locator('.sortering__item-editor-select');
    await expect(typeSelect).toBeVisible();
    await typeSelect.selectOption('figure');

    const figureRow = firstItem.locator('.sortering__item-editor-figure-row').first();
    await expect(figureRow).toBeVisible();

    const categorySelect = figureRow.locator('select').first();
    await categorySelect.selectOption('humans');

    const figureSelect = figureRow.locator('.sortering__item-editor-figure-select');
    await expect(figureSelect).toBeEnabled();
    await expect(figureSelect.locator('option[value="/images/measure/dame155.svg"]')).toHaveCount(1);
    await figureSelect.selectOption('/images/measure/dame155.svg');
    await expect(figureSelect).toHaveValue('/images/measure/dame155.svg');

    await firstItem.locator('.sortering__item-editor-update').click();

    const cardImage = firstItem.locator('.sortering__item-image');
    await expect(cardImage).toHaveAttribute('src', /dame155\.svg$/);

    const state = await getSorteringState(page);
    expect(state).not.toBeNull();
    const targetItem = state.items.find(entry => entry && entry.id === itemId);
    expect(targetItem).toBeDefined();
    expect(targetItem.type).toBe('figure');
    expect(Array.isArray(targetItem.figures)).toBe(true);
    expect(targetItem.figures[0].value).toBe('/images/measure/dame155.svg');

    await page.evaluate(() => {
      const api = window.mathVisSortering;
      if (api && typeof api.applyOrder === 'function') {
        api.applyOrder({ resetToBase: true });
      }
    });

    await expect(cardImage).toHaveAttribute('src', /dame155\.svg$/);

    const afterApplyState = await getSorteringState(page);
    expect(afterApplyState).not.toBeNull();
    const afterApplyItem = afterApplyState.items.find(entry => entry && entry.id === itemId);
    expect(afterApplyItem).toBeDefined();
    expect(afterApplyItem.type).toBe('figure');
    expect(Array.isArray(afterApplyItem.figures)).toBe(true);
    expect(afterApplyItem.figures[0].value).toBe('/images/measure/dame155.svg');
  });

  test('keeps manual figure selection for new items without figures', async ({ page }) => {
    await page.goto('/sortering.html', { waitUntil: 'load' });

    const addButton = page.locator('#btnAddSorteringItem');
    await expect(addButton).toBeVisible();
    await addButton.click();

    const newItem = page.locator('.sortering__item').last();
    await expect(newItem).toBeVisible();
    const itemId = await newItem.getAttribute('data-item-id');
    expect(itemId).toBeTruthy();

    await newItem.click();

    const typeSelect = newItem.locator('.sortering__item-editor-select');
    await expect(typeSelect).toBeVisible();
    await expect(typeSelect).toHaveValue('text');

    await typeSelect.selectOption('figure');
    await expect(typeSelect).toHaveValue('figure');

    const figureRow = newItem.locator('.sortering__item-editor-figure-row').first();
    await expect(figureRow).toBeVisible();

    await page.evaluate(() => {
      const api = window.mathVisSortering;
      if (api && typeof api.applyOrder === 'function') {
        api.applyOrder({ resetToBase: true });
      }
    });

    await expect(typeSelect).toHaveValue('figure');

    const state = await getSorteringState(page);
    expect(state).not.toBeNull();
    const createdItem = state.items.find(entry => entry && entry.id === itemId);
    expect(createdItem).toBeDefined();
    expect(createdItem.type).toBe('figure');
    expect(Array.isArray(createdItem.figures)).toBe(true);
    expect(createdItem.figures.length).toBeGreaterThan(0);
  });
});
