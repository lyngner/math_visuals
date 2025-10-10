const { test, expect } = require('@playwright/test');

const { attachExamplesBackendMock } = require('./helpers/examples-backend-mock');

const PAGE_PATH = '/graftegner.html';

async function acceptNextAlert(page) {
  const handler = dialog => {
    dialog.accept().catch(() => {});
    page.off('dialog', handler);
  };
  page.on('dialog', handler);
}

test.describe('Graftegner examples', () => {
  let backend;

  test.beforeEach(async ({ page }) => {
    backend = await attachExamplesBackendMock(page.context());
  });

  test('saving creates a new example tab', async ({ page }) => {
    await backend.client.delete('/graftegner');
    await acceptNextAlert(page);
    await page.goto(PAGE_PATH, { waitUntil: 'load' });

    const tabs = page.locator('#exampleTabs .example-tab');
    const initialCount = await tabs.count();
    const savePromise = backend.waitForPut('/graftegner', {
      description: 'Graftegner save creates tab'
    });
    await page.click('#btnSaveExample');
    await savePromise;

    await expect(tabs).toHaveCount(initialCount + 1);

    const storedEntry = await backend.client.get('/graftegner');
    expect(storedEntry).toBeTruthy();
    expect(Array.isArray(storedEntry.examples)).toBe(true);
    expect(storedEntry.examples.length).toBeGreaterThan(0);
  });

  test('retains locally saved example when backend response is stale', async ({ page }) => {
    await backend.client.delete('/graftegner');
    await acceptNextAlert(page);

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
      await route.fallback();
    });

    setTimeout(() => {
      if (!getFulfilled && typeof resolveBackendGet === 'function') {
        getFulfilled = true;
        resolveBackendGet();
      }
    }, 2000);

    await page.goto(PAGE_PATH, { waitUntil: 'load' });

    const tabs = page.locator('#exampleTabs .example-tab');
    const descriptionField = page.locator('#exampleDescription');
    await expect(descriptionField).toBeVisible();
    const initialCount = await tabs.count();
    const uniqueDescription = `Lokal test ${Date.now()}`;
    await descriptionField.fill(uniqueDescription);

    const savePromise = backend.waitForPut('/graftegner', {
      description: 'Graftegner save after stale backend response'
    });
    await page.click('#btnSaveExample');

    await expect(tabs).toHaveCount(initialCount + 1);

    await backendGetHandled;

    await expect(tabs).toHaveCount(initialCount + 1);

    const newTab = tabs.nth(initialCount);
    await newTab.click();
    await expect(descriptionField).toHaveValue(uniqueDescription);

    const storedEntry = await backend.client.get('/graftegner');
    expect(storedEntry).toBeTruthy();
    expect(Array.isArray(storedEntry.examples)).toBe(true);
    expect(storedEntry.examples.some(example => example.description === uniqueDescription)).toBe(true);
  });
});
