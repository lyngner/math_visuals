const { test, expect } = require('@playwright/test');

const EXAMPLE_PATH = '/diagram/index.html';
const STORAGE_KEY = 'examples_/diagram';
const DELETED_KEY = `${STORAGE_KEY}_deletedProvidedExamples`;

async function clearExampleStorage(page) {
  await page.addInitScript(({ key, deletedKey }) => {
    const eraseKey = (store, target) => {
      if (!store || typeof store.removeItem !== 'function') return;
      try {
        store.removeItem(target);
      } catch (error) {
        // ignore storage access issues
      }
    };
    const eraseIfAvailable = target => {
      try {
        if (typeof window.localStorage !== 'undefined') {
          eraseKey(window.localStorage, target);
        }
      } catch (error) {}
      if (window.__EXAMPLES_STORAGE__ && typeof window.__EXAMPLES_STORAGE__.removeItem === 'function') {
        try {
          window.__EXAMPLES_STORAGE__.removeItem(target);
        } catch (error) {}
      }
      if (window.__EXAMPLES_FALLBACK_STORAGE__ && typeof window.__EXAMPLES_FALLBACK_STORAGE__.removeItem === 'function') {
        try {
          window.__EXAMPLES_FALLBACK_STORAGE__.removeItem(target);
        } catch (error) {}
      }
    };
    eraseIfAvailable(key);
    eraseIfAvailable(deletedKey);
  }, { key: STORAGE_KEY, deletedKey: DELETED_KEY });
}

test.describe('Persisted example compatibility', () => {
  test.beforeEach(async ({ page }) => {
    await clearExampleStorage(page);
  });

  test('loads user saved examples stored under the canonical key', async ({ page }) => {
    const persistedExample = {
      description: 'Lagret før oppdatering',
      exampleNumber: 'Persistert',
      isDefault: true,
      config: {
        CFG: {
          type: 'bar',
          title: 'Forhåndslagret data',
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
        }
      }
    };

    await page.addInitScript(({ key, deletedKey, value }) => {
      try {
        window.localStorage.setItem(key, value);
      } catch (error) {}
      if (window.__EXAMPLES_STORAGE__ && window.__EXAMPLES_STORAGE__ !== window.localStorage) {
        try {
          window.__EXAMPLES_STORAGE__.setItem(key, value);
        } catch (error) {}
      }
      if (window.__EXAMPLES_FALLBACK_STORAGE__) {
        try {
          window.__EXAMPLES_FALLBACK_STORAGE__.setItem(key, value);
        } catch (error) {}
      }
      try {
        window.localStorage.setItem(deletedKey, '[]');
      } catch (error) {}
    }, { key: STORAGE_KEY, deletedKey: DELETED_KEY, value: JSON.stringify([persistedExample]) });

    await page.goto(EXAMPLE_PATH, { waitUntil: 'load' });

    const savedTab = page.locator('#exampleTabs .example-tab', { hasText: 'Persistert' });
    await expect(savedTab).toHaveCount(1);

    await savedTab.click();
    await expect(page.locator('#exampleDescription')).toHaveValue(persistedExample.description);

    const storedPayload = await page.evaluate(key => {
      try {
        const value = window.localStorage.getItem(key);
        return value ? JSON.parse(value) : null;
      } catch (error) {
        return null;
      }
    }, STORAGE_KEY);

    expect(Array.isArray(storedPayload)).toBeTruthy();
    expect(storedPayload[0]).toMatchObject({ description: persistedExample.description, exampleNumber: 'Persistert' });
  });
});
