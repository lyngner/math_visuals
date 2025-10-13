const { test, expect } = require('@playwright/test');

const {
  attachExamplesBackendMock,
  normalizeExamplePath
} = require('./helpers/examples-backend-mock');

const EXAMPLE_PATH = '/diagram/index.html';
const CANONICAL_PATH = normalizeExamplePath(EXAMPLE_PATH);

test.describe('Examples update flow', () => {
  let backend;

  test.beforeEach(async ({ page }) => {
    backend = await attachExamplesBackendMock(page.context());
    try {
      await backend.client.delete(CANONICAL_PATH);
    } catch (error) {}
    await page.goto(EXAMPLE_PATH, { waitUntil: 'load' });
  });

  test.afterEach(async () => {
    if (backend) {
      await backend.dispose();
      backend = null;
    }
  });

  test('sends updated payload and shows save status feedback', async ({ page }) => {
    const description = page.locator('#exampleDescription');
    await description.fill('Første versjon');

    const initialRequest = page.waitForRequest(
      request => request.url().includes('/api/examples') && request.method() === 'PUT'
    );
    await page.locator('#btnSaveExample').click();
    await initialRequest;

    await description.fill('Oppdatert beskrivelse');

    const putPromise = page.waitForRequest(
      request => request.url().includes('/api/examples') && request.method() === 'PUT'
    );
    await page.locator('#btnUpdateExample').click();
    const putRequest = await putPromise;

    const payload = putRequest.postDataJSON();
    expect(payload).toBeTruthy();
    expect(Array.isArray(payload.examples)).toBe(true);
    expect(payload.examples.length).toBeGreaterThan(0);
    const updatedExample = payload.examples[payload.examples.length - 1];
    expect(updatedExample).toBeTruthy();
    expect(updatedExample.description).toContain('Oppdatert beskrivelse');

    const statusIndicator = page.locator('.example-save-status');
    await expect(statusIndicator).toBeVisible();
    await expect(statusIndicator).toHaveAttribute('data-status', 'success');
    await expect(page.locator('.example-save-status__text')).toHaveText(/Sist lagret kl\./);
  });
});
