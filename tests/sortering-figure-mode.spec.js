const { test, expect } = require('@playwright/test');
const {
  clearFigureLibraryMemoryStores,
  createFigureLibraryRouteHandler
} = require('./helpers/figure-library-api-utils.js');
const { ensureCategory, setFigure } = require('../api/_lib/figure-library-store.js');

function getSorteringState(page) {
  return page.evaluate(() => {
    const api = window.mathVisSortering;
    if (!api || typeof api.getState !== 'function') {
      return null;
    }
    return api.getState();
  });
}

const MEASUREMENT_CATEGORY_APPS = ['maling', 'sortering'];
const FIGURE_LIBRARY_ROUTE = '**/api/figure-library**';
const SAMPLE_FIGURES = [
  {
    slug: 'stegosaurus',
    name: 'Stegosaurus',
    categoryId: 'prehistoric-animals',
    categoryLabel: 'Forhistoriske dyr',
    dimensions: '9 m × 4,5 m',
    scaleLabel: '1:90'
  },
  {
    slug: 'dame155',
    name: 'Dame 155',
    categoryId: 'humans',
    categoryLabel: 'Mennesker',
    dimensions: 'Høyde 155 cm',
    scaleLabel: '1:25'
  },
  {
    slug: 'gutt120',
    name: 'Gutt 120',
    categoryId: 'humans',
    categoryLabel: 'Mennesker',
    dimensions: 'Høyde 120 cm',
    scaleLabel: '1:25'
  }
];

function buildFigureSvg(slug) {
  return [
    '<svg xmlns="http://www.w3.org/2000/svg" width="160" height="90">',
    '<rect x="0" y="0" width="160" height="90" fill="#f4f4f4" stroke="#111"/>',
    `<text x="8" y="24" font-size="14">${slug}</text>`,
    '</svg>'
  ].join('');
}

async function seedMeasurementFigures() {
  clearFigureLibraryMemoryStores();

  const categories = new Map();
  SAMPLE_FIGURES.forEach(figure => {
    if (!categories.has(figure.categoryId)) {
      categories.set(figure.categoryId, {
        id: figure.categoryId,
        label: figure.categoryLabel,
        type: 'measurement',
        apps: MEASUREMENT_CATEGORY_APPS
      });
    }
  });

  for (const category of categories.values()) {
    await ensureCategory(category);
  }

  for (const figure of SAMPLE_FIGURES) {
    await setFigure(figure.slug, {
      name: figure.name,
      summary: `${figure.dimensions} – målestokk ${figure.scaleLabel}`,
      dimensions: figure.dimensions,
      scaleLabel: figure.scaleLabel,
      svg: buildFigureSvg(figure.slug),
      category: {
        id: figure.categoryId,
        label: figure.categoryLabel,
        apps: MEASUREMENT_CATEGORY_APPS
      }
    });
  }
}

test.beforeEach(async ({ page }) => {
  await seedMeasurementFigures();
  await page.route(FIGURE_LIBRARY_ROUTE, createFigureLibraryRouteHandler());
});

test.afterEach(async ({ page }) => {
  await page.unroute(FIGURE_LIBRARY_ROUTE);
  clearFigureLibraryMemoryStores();
});

test.describe('sortering figure editor', () => {
  test('resolves slug-only figure values via manifest lookup', async ({ page }) => {
    await page.addInitScript(() => {
      window.STATE = {
        sortering: {
          items: [
            {
              id: 'item-slug',
              type: 'figure',
              label: 'Stegosaurus',
              alt: 'Stegosaurus',
              figures: [
                {
                  id: 'item-slug-figure-1',
                  categoryId: 'prehistoric-animals',
                  value: 'stegosaurus'
                }
              ]
            }
          ],
          order: ['item-slug'],
          retning: 'horisontal',
          gap: 32,
          hideOutline: false,
          randomisering: false,
          altText: '',
          altTextSource: 'auto'
        }
      };
    });

    await page.goto('/sortering.html', { waitUntil: 'load' });

    const figureItem = page.locator('.sortering__item[data-item-id="item-slug"]');
    await expect(figureItem).toBeVisible();

    const figureImage = figureItem.locator('.sortering__item-image');
    await expect(figureImage).toHaveAttribute('src', /stegosaurus\.svg/i);

    const state = await getSorteringState(page);
    expect(state).not.toBeNull();
    const figureState = state.items.find(item => item && item.id === 'item-slug');
    expect(figureState).toBeDefined();
    expect(Array.isArray(figureState.figures)).toBe(true);
    expect(figureState.figures[0].value).toBe('stegosaurus');
  });

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
    await figureSelect.selectOption('dame155');

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
    expect(figureState.figures[0].value).toBe('dame155');
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
    await expect(figureSelect.locator('option[value="gutt120"]')).toHaveCount(1);
    await figureSelect.selectOption('gutt120');

    const valueInput = figureRow.locator('input[type="text"]');
    await expect(valueInput).toHaveValue('gutt120');
    await expect(typeSelect).toHaveValue('figure');

    const state = await getSorteringState(page);
    expect(state).not.toBeNull();

    const figureState = state.items.find(item => item.id === 'item-4');
    expect(figureState).toBeDefined();
    expect(figureState.type).toBe('figure');
    expect(Array.isArray(figureState.figures)).toBe(true);
    expect(figureState.figures[0].value).toBe('gutt120');
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
    await expect(figureSelect.locator('option[value="dame155"]')).toHaveCount(1);
    await figureSelect.selectOption('dame155');
    await expect(figureSelect).toHaveValue('dame155');

    await firstItem.locator('.sortering__item-editor-update').click();

    const cardImage = firstItem.locator('.sortering__item-image');
    await expect(cardImage).toHaveAttribute('src', /dame155\.svg$/);

    const state = await getSorteringState(page);
    expect(state).not.toBeNull();
    const targetItem = state.items.find(entry => entry && entry.id === itemId);
    expect(targetItem).toBeDefined();
    expect(targetItem.type).toBe('figure');
    expect(Array.isArray(targetItem.figures)).toBe(true);
    expect(targetItem.figures[0].value).toBe('dame155');

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
    expect(afterApplyItem.figures[0].value).toBe('dame155');
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
