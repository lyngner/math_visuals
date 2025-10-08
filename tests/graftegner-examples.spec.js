const { test, expect } = require('@playwright/test');

const PAGE_PATH = '/graftegner.html';

async function clearStorage(page) {
  await page.addInitScript(() => {
    const storage = window.__EXAMPLES_STORAGE__ || window.localStorage;
    if (!storage || typeof storage.removeItem !== 'function') return;
    const key = 'examples_/graftegner';
    try {
      storage.removeItem(key);
      storage.removeItem(`${key}_history`);
      storage.removeItem(`${key}_deletedProvidedExamples`);
    } catch (error) {
      // ignore
    }
  });
}

test.describe('Graftegner examples', () => {
  test.beforeEach(async ({ page }) => {
    await clearStorage(page);
  });

  test('saving creates a new example tab', async ({ page }) => {
    await page.goto(PAGE_PATH);
    const tabs = page.locator('#exampleTabs .example-tab');
    const initialCount = await tabs.count();
    await page.click('#btnSaveExample');
    await expect(tabs).toHaveCount(initialCount + 1);
  });

  test('retains locally saved example when backend response is stale', async ({ page }) => {
    await page.addInitScript(() => {
      window.MATH_VISUALS_EXAMPLES_API_URL = '/api/examples';
    });

    let resolveBackendGet;
    const backendGetHandled = new Promise(resolve => {
      resolveBackendGet = resolve;
    });
    let getFulfilled = false;

    await page.route('**/api/examples**', async route => {
      const request = route.request();
      const method = request.method();
      if (method === 'GET') {
        await new Promise(res => setTimeout(res, 300));
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            path: '/graftegner',
            examples: [
              {
                title: 'Backend eksempel',
                description: 'Backend eksempel',
                exampleNumber: 'B',
                config: { CFG: { type: 'line', points: [[0, 0], [1, 1]] } },
                svg: ''
              }
            ],
            deletedProvided: [],
            updatedAt: '2000-01-01T00:00:00.000Z'
          })
        });
        if (!getFulfilled && typeof resolveBackendGet === 'function') {
          getFulfilled = true;
          resolveBackendGet();
        }
        return;
      }
      if (method === 'PUT' || method === 'DELETE') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: '{}'
        });
        return;
      }
      await route.fallback();
    });

    setTimeout(() => {
      if (!getFulfilled && typeof resolveBackendGet === 'function') {
        getFulfilled = true;
        resolveBackendGet();
      }
    }, 2000);

    await page.goto(PAGE_PATH);

    const tabs = page.locator('#exampleTabs .example-tab');
    const descriptionField = page.locator('#exampleDescription');
    await expect(descriptionField).toBeVisible();
    const initialCount = await tabs.count();
    const uniqueDescription = `Lokal test ${Date.now()}`;
    await descriptionField.fill(uniqueDescription);

    await page.click('#btnSaveExample');

    await expect(tabs).toHaveCount(initialCount + 1);

    await backendGetHandled;

    await expect(tabs).toHaveCount(initialCount + 1);

    const newTab = tabs.nth(initialCount);
    await newTab.click();
    await expect(descriptionField).toHaveValue(uniqueDescription);

    const storedDescriptions = await page.evaluate(storageKey => {
      const resolveStorage = () => {
        try {
          const local = window.localStorage && window.localStorage.getItem(storageKey);
          if (local) return local;
        } catch (error) {}
        if (window.__EXAMPLES_STORAGE__ && typeof window.__EXAMPLES_STORAGE__.getItem === 'function') {
          try {
            return window.__EXAMPLES_STORAGE__.getItem(storageKey);
          } catch (error) {}
        }
        return null;
      };
      try {
        const raw = resolveStorage();
        if (!raw) return [];
        const parsed = JSON.parse(raw);
        if (!Array.isArray(parsed)) return [];
        return parsed.map(example => (example && typeof example.description === 'string') ? example.description : null);
      } catch (error) {
        return [];
      }
    }, 'examples_/graftegner');

    expect(storedDescriptions).toContain(uniqueDescription);
  });
});
