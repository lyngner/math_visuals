const { test, expect } = require('@playwright/test');
const { attachExamplesBackendMock } = require('./helpers/examples-backend-mock');

const PAGE_PATH = '/graftegner.html';

test.describe('Examples backend outage', () => {
  test('shows outage notice and disables actions when backend fails', async ({ page }) => {
    const backend = await attachExamplesBackendMock(page.context());
    backend.simulateOutage(() => {
      const error = new Error('Mock backend failure (500)');
      error.status = 500;
      return error;
    });

    await page.goto(PAGE_PATH, { waitUntil: 'load' });

    await page.click('#btnSaveExample');

    const notice = page.locator('.example-backend-notice');
    await expect(notice).toBeVisible();
    await expect(notice).toContainText('Ingen backend-tilkobling');

    await expect(page.locator('#btnSaveExample')).toBeDisabled();
    await expect(page.locator('#btnUpdateExample')).toBeDisabled();
    await expect(page.locator('#btnDeleteExample')).toBeDisabled();
  });
});
