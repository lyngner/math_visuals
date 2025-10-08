const { test, expect } = require('@playwright/test');

const STORAGE_KEY = 'examples_/diagram';

const baseConfig = {
  type: 'bar',
  title: 'Base',
  labels: ['A', 'B', 'C'],
  series1: '',
  start: [1, 2, 3],
  answer: [1, 2, 3],
  yMin: 0,
  yMax: 5,
  snap: 1,
  tolerance: 0,
  axisXLabel: 'Kategori',
  axisYLabel: 'Verdi',
  valueDisplay: 'none',
  locked: []
};

test.describe('task mode example selection', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(key => {
      try {
        window.localStorage.removeItem(key);
      } catch (error) {}
      if (window.__EXAMPLES_STORAGE__) {
        try {
          window.__EXAMPLES_STORAGE__.removeItem(key);
        } catch (error) {}
      }
      if (window.__EXAMPLES_FALLBACK_STORAGE__) {
        try {
          window.__EXAMPLES_FALLBACK_STORAGE__.removeItem(key);
        } catch (error) {}
      }
    }, STORAGE_KEY);
  });

  test('loads the requested example configuration and description', async ({ page }) => {
    const examples = [
      {
        description: 'Oppgave 1',
        exampleNumber: '1',
        isDefault: true,
        config: {
          CFG: { ...baseConfig, title: 'Oppgave 1 tittel' }
        }
      },
      {
        description: 'Oppgave 2',
        exampleNumber: '2',
        config: {
          CFG: { ...baseConfig, title: 'Oppgave 2 tittel', answer: [3, 2, 1] }
        }
      }
    ];

    await page.addInitScript(({ key, value }) => {
      try {
        window.localStorage.setItem(key, value);
      } catch (error) {}
      if (window.__EXAMPLES_STORAGE__) {
        try {
          window.__EXAMPLES_STORAGE__.setItem(key, value);
        } catch (error) {}
      }
      if (window.__EXAMPLES_FALLBACK_STORAGE__) {
        try {
          window.__EXAMPLES_FALLBACK_STORAGE__.setItem(key, value);
        } catch (error) {}
      }
    }, { key: STORAGE_KEY, value: JSON.stringify(examples) });

    await page.goto('/diagram/index.html?mode=oppgave&example=2', { waitUntil: 'load' });

    await expect(page.locator('#chartTitle')).toHaveText('Oppgave 2 tittel');
    await expect(page.locator('#exampleDescription')).toHaveValue('Oppgave 2');
    await expect(page.locator('.example-description-preview')).toHaveText('Oppgave 2');
    await expect(page.locator('#exampleTabs .example-tab')).toHaveCount(2);
  });
});
