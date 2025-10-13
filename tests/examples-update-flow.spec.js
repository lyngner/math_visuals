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

  test('applies backend clearing after saving first example', async ({ page }) => {
    const tabs = page.locator('#exampleTabs .example-tab');
    await expect(tabs).toHaveCount(0);
    await expect(page.locator('.example-tabs-empty')).toBeVisible();

    const initialSave = backend.waitForPut(CANONICAL_PATH, {
      description: 'bootstrap first example'
    });
    await page.locator('#btnSaveExample').click();
    const initialResult = await initialSave;
    expect(Array.isArray(initialResult && initialResult.payload && initialResult.payload.examples)).toBe(true);
    expect(initialResult.payload.examples.length).toBe(1);
    await expect(tabs).toHaveCount(1);

    await backend.client.put(CANONICAL_PATH, {
      examples: [],
      deletedProvided: [],
      updatedAt: new Date().toISOString()
    });

    await page.reload({ waitUntil: 'load' });

    await expect(page.locator('.example-tabs-empty')).toBeVisible();
    await expect(tabs).toHaveCount(0);
    await expect(page.locator('#exampleDescription')).toHaveValue('');
  });

  test('disables action buttons during update and reflects saving state', async ({ page }) => {
    const description = page.locator('#exampleDescription');
    const saveButton = page.locator('#btnSaveExample');
    const updateButton = page.locator('#btnUpdateExample');
    const deleteButton = page.locator('#btnDeleteExample');
    const statusIndicator = page.locator('.example-save-status');
    const spinner = page.locator('.example-save-status__spinner');

    await description.fill('Eksempel én');
    const firstSave = page.waitForRequest(
      request => request.url().includes('/api/examples') && request.method() === 'PUT'
    );
    await saveButton.click();
    await firstSave;

    await description.fill('Eksempel to');
    const secondSave = page.waitForRequest(
      request => request.url().includes('/api/examples') && request.method() === 'PUT'
    );
    await saveButton.click();
    await secondSave;

    await expect(deleteButton).toBeEnabled();

    await description.fill('Oppdatert eksempel to');

    const updateRequestPromise = page.waitForRequest(
      request => request.url().includes('/api/examples') && request.method() === 'PUT'
    );

    await updateButton.click();

    await expect(statusIndicator).toHaveAttribute('data-status', 'saving');
    await expect(spinner).toBeVisible();
    await expect(saveButton).toBeDisabled();
    await expect(updateButton).toBeDisabled();
    await expect(deleteButton).toBeDisabled();

    const updateRequest = await updateRequestPromise;
    const payload = updateRequest.postDataJSON();
    expect(payload).toBeTruthy();
    expect(Array.isArray(payload.examples)).toBe(true);
    expect(payload.examples.length).toBeGreaterThan(0);
    const updatedExample = payload.examples[payload.examples.length - 1];
    expect(updatedExample.description).toContain('Oppdatert eksempel to');

    await expect(statusIndicator).toHaveAttribute('data-status', 'success');
    await expect(page.locator('.example-save-status__text')).toHaveText(/Sist lagret kl\./);
    await expect(saveButton).toBeEnabled();
    await expect(updateButton).toBeEnabled();
    await expect(deleteButton).toBeEnabled();
  });

  test('prevents deleting the final example and blocks direct archive attempts', async ({ page }) => {
    const description = page.locator('#exampleDescription');
    const deleteButton = page.locator('#btnDeleteExample');
    const statusIndicator = page.locator('.example-save-status');
    const statusText = page.locator('.example-save-status__text');

    await description.fill('Eneste eksempel');

    const initialSave = backend.waitForPut(CANONICAL_PATH, {
      timeout: 5000,
      description: 'initial save for single example guard'
    });
    await page.locator('#btnSaveExample').click();
    await initialSave;

    await expect(deleteButton).toBeDisabled();

    const deleteAttempt = backend.waitForDelete(CANONICAL_PATH, {
      timeout: 1500,
      description: 'should not delete final example'
    });

    await page.evaluate(() => {
      const btn = document.getElementById('btnDeleteExample');
      if (btn) {
        btn.disabled = false;
        btn.click();
      }
    });

    await expect(deleteAttempt).rejects.toThrow(/Timed out/i);
    await expect(statusIndicator).toHaveAttribute('data-status', 'error');
    await expect(statusText).toHaveText('Du må ha minst ett lagret eksempel.');

    const stored = await backend.client.get(CANONICAL_PATH);
    expect(stored).toBeTruthy();
    expect(Array.isArray(stored.examples)).toBe(true);
    expect(stored.examples.length).toBe(1);
  });
});
