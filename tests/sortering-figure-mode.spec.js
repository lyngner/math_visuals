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
});
