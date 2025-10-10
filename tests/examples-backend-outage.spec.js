const { test, expect } = require('@playwright/test');
const { attachExamplesBackendMock, normalizeExamplePath } = require('./helpers/examples-backend-mock');

const PAGE_PATH = '/graftegner.html';
const CANONICAL_PAGE_PATH = normalizeExamplePath(PAGE_PATH);

test.describe('Examples backend outage', () => {
  test('shows outage notice but keeps local actions available when backend fails', async ({ page }) => {
    const backend = await attachExamplesBackendMock(page.context());
    backend.simulateOutage(() => {
      const error = new Error('Mock backend failure (500)');
      error.status = 500;
      return error;
    });

    await page.goto(PAGE_PATH, { waitUntil: 'load' });

    await page.click('#btnSaveExample');

    const tabs = page.locator('.example-tab');
    await expect(tabs.first()).toBeVisible();

    const notice = page.locator('.example-backend-notice');
    await expect(notice).toBeVisible();
    await expect(notice).toContainText('Ingen backend-tilkobling');

    await expect(page.locator('#btnSaveExample')).toBeEnabled();
    await expect(page.locator('#btnUpdateExample')).toBeEnabled();

    const deleteButton = page.locator('#btnDeleteExample');
    const tabCount = await tabs.count();
    if (tabCount <= 1) {
      await expect(deleteButton).toBeDisabled();
    } else {
      await expect(deleteButton).toBeEnabled();
    }
  });
});

test.describe('Examples backend memory mode', () => {
  test('keeps UI working with temporary in-memory storage', async ({ page }) => {
    const backend = await attachExamplesBackendMock(page.context());
    backend.useMemoryMode();
    backend.seed(PAGE_PATH, {
      examples: [
        {
          description: 'Midlertidig lagret eksempel',
          config: { STATE: { label: 'fallback' } }
        }
      ],
      deletedProvided: []
    }, { promote: true });

    await page.goto(PAGE_PATH, { waitUntil: 'load' });

    const notice = page.locator('.example-backend-notice');
    await expect(notice).toBeVisible();
    await expect(notice).toContainText('Midlertidig lagring');

    const tabs = page.locator('.example-tab');
    await expect(tabs.first()).toBeVisible();
    const initialCount = await tabs.count();

    const savePromise = backend.waitForPut(CANONICAL_PAGE_PATH, {
      timeout: 5000,
      description: 'memory mode save'
    });
    await page.click('#btnSaveExample');
    const putResult = await savePromise;
    expect(putResult && putResult.entry).toBeTruthy();

    const updatedCount = await tabs.count();
    expect(updatedCount).toBeGreaterThan(initialCount);

    const stored = await backend.client.get(CANONICAL_PAGE_PATH);
    expect(stored).toBeTruthy();
    expect(stored.storage).toBe('memory');
    expect(stored.mode).toBe('memory');
  });
});
