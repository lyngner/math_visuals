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
});
