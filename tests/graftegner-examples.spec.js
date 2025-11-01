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

  test('renders manual color from query params without showing color suffix in function input', async ({ page }) => {
    const url = `${PAGE_PATH}?fun1=${encodeURIComponent('y=x')}&color1=%23ff0000`;
    await page.goto(url, { waitUntil: 'load' });

    const functionField = page.locator('[data-fun]').first();
    await expect(functionField).toBeVisible();
    await expect(functionField).toHaveJSProperty('value', 'y=x');

    const colorInput = page.locator('input[data-color]').first();
    await expect(colorInput).toBeVisible();
    await expect(colorInput).toHaveValue('#ff0000');
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

  test('keeps backend entry after reload or navigation away and back', async ({ page }) => {
    await backend.client.delete('/graftegner');
    await acceptNextAlert(page);

    await page.goto(PAGE_PATH, { waitUntil: 'load' });

    const tabs = page.locator('#exampleTabs .example-tab');
    const descriptionField = page.locator('#exampleDescription');
    await expect(descriptionField).toBeVisible();
    const initialTabCount = await tabs.count();
    const newTabIndex = initialTabCount;
    const uniqueDescription = `Graftegner reload retention ${Date.now()}`;
    await descriptionField.fill(uniqueDescription);

    const savePromise = backend.waitForPut('/graftegner', {
      description: 'Graftegner retains backend entry across navigation'
    });
    await page.click('#btnSaveExample');
    await savePromise;

    await expect(tabs).toHaveCount(initialTabCount + 1);
    const newTab = tabs.nth(newTabIndex);
    await newTab.click();
    await expect(descriptionField).toHaveValue(uniqueDescription);

    const countDeletesForGraftegner = () =>
      backend.history.filter(entry => entry.type === 'DELETE' && entry.path === '/graftegner').length;
    const initialDeleteCount = countDeletesForGraftegner();

    const storedAfterSave = await backend.client.get('/graftegner');
    expect(storedAfterSave).toBeTruthy();
    expect(Array.isArray(storedAfterSave.examples)).toBe(true);
    expect(storedAfterSave.examples.some(example => example.description === uniqueDescription)).toBe(true);

    await page.reload({ waitUntil: 'load' });

    await expect(tabs).toHaveCount(initialTabCount + 1);
    const descriptionAfterReload = page.locator('#exampleDescription');
    await expect(descriptionAfterReload).toBeVisible();
    const reloadedTab = tabs.nth(newTabIndex);
    await reloadedTab.click();
    await expect(descriptionAfterReload).toHaveValue(uniqueDescription);

    const storedAfterReload = await backend.client.get('/graftegner');
    expect(storedAfterReload).toBeTruthy();
    expect(Array.isArray(storedAfterReload.examples)).toBe(true);
    expect(storedAfterReload.examples.some(example => example.description === uniqueDescription)).toBe(true);
    expect(countDeletesForGraftegner()).toBe(initialDeleteCount);

    await acceptNextAlert(page);
    await page.goto('/index.html', { waitUntil: 'load' });
    await acceptNextAlert(page);
    await page.goto(PAGE_PATH, { waitUntil: 'load' });

    const tabsAfterReturn = page.locator('#exampleTabs .example-tab');
    await expect(tabsAfterReturn).toHaveCount(initialTabCount + 1);
    const descriptionAfterReturn = page.locator('#exampleDescription');
    await expect(descriptionAfterReturn).toBeVisible();
    const returnedTab = tabsAfterReturn.nth(newTabIndex);
    await returnedTab.click();
    await expect(descriptionAfterReturn).toHaveValue(uniqueDescription);

    const storedAfterReturn = await backend.client.get('/graftegner');
    expect(storedAfterReturn).toBeTruthy();
    expect(Array.isArray(storedAfterReturn.examples)).toBe(true);
    expect(storedAfterReturn.examples.some(example => example.description === uniqueDescription)).toBe(true);
    expect(countDeletesForGraftegner()).toBe(initialDeleteCount);
  });
});
