const { test, expect } = require('@playwright/test');

const {
  attachExamplesBackendMock,
  normalizeExamplePath,
  computeExamplesStorageKey
} = require('./helpers/examples-backend-mock');

const EXAMPLE_PATH = '/diagram/index.html';
const CANONICAL_PATH = normalizeExamplePath(EXAMPLE_PATH);
const STORAGE_KEY = computeExamplesStorageKey(EXAMPLE_PATH);
const DELETED_KEY = `${STORAGE_KEY}_deletedProvidedExamples`;

async function acceptNextAlert(page) {
  const handler = dialog => {
    dialog.accept().catch(() => {});
    page.off('dialog', handler);
  };
  page.on('dialog', handler);
}

test.describe('Example creation portability', () => {
  test('saves and reloads examples across browser contexts', async ({ page, browser }, testInfo) => {
    const sharedStore = { raw: new Map(), canonical: new Map() };
    const backend = await attachExamplesBackendMock(
      page.context(),
      { [CANONICAL_PATH]: { examples: [], deletedProvided: [], provided: [] } },
      sharedStore
    );

    await acceptNextAlert(page);
    await page.goto(EXAMPLE_PATH, { waitUntil: 'load' });

    const tabLocator = page.locator('#exampleTabs .example-tab');
    const initialCount = await tabLocator.count();

    const titleValue = `Tverrbrowser test ${testInfo.project.name}`;
    const descriptionValue = `E2E-${testInfo.project.name}-${Date.now()}`;

    await page.fill('#cfgTitle', titleValue);
    await page.fill('#exampleDescription', descriptionValue);
    const savePromise = backend.waitForPut(CANONICAL_PATH);
    await page.click('#btnSaveExample');

    const putResult = await savePromise;
    await expect(tabLocator).toHaveCount(initialCount + 1);

    const savedExample = putResult.payload.examples[putResult.payload.examples.length - 1];
    expect(savedExample.description).toBe(descriptionValue);
    expect(savedExample.config).toBeTruthy();

    const otherContext = await browser.newContext();
    const otherBackend = await attachExamplesBackendMock(otherContext, {}, sharedStore);

    const otherPage = await otherContext.newPage();
    await acceptNextAlert(otherPage);
    await otherPage.goto(EXAMPLE_PATH, { waitUntil: 'load' });

    const otherTabs = otherPage.locator('#exampleTabs .example-tab');
    await expect(otherTabs).toHaveCount(initialCount + 1);
    await otherTabs.last().click();

    await expect(otherPage.locator('#exampleDescription')).toHaveValue(descriptionValue);
    await expect(otherPage.locator('#cfgTitle')).toHaveValue(titleValue);

    const replicatedEntry = await otherBackend.read(CANONICAL_PATH);
    expect(replicatedEntry).toBeTruthy();
    expect(Array.isArray(replicatedEntry.examples)).toBe(true);
    expect(replicatedEntry.examples.some(example => example.description === descriptionValue)).toBe(true);

    await otherContext.close();
  });

  test('uses fallback storage when localStorage is unavailable', async ({ browser }, testInfo) => {
    const context = await browser.newContext();
    const backend = await attachExamplesBackendMock(
      context,
      { [CANONICAL_PATH]: { examples: [], deletedProvided: [], provided: [] } }
    );
    await context.addInitScript(({ key, deletedKey }) => {
      Object.defineProperty(window, 'localStorage', {
        configurable: true,
        get() {
          throw new Error('Access denied');
        }
      });
      if (window.__EXAMPLES_FALLBACK_STORAGE__ && typeof window.__EXAMPLES_FALLBACK_STORAGE__.removeItem === 'function') {
        window.__EXAMPLES_FALLBACK_STORAGE__.removeItem(key);
        window.__EXAMPLES_FALLBACK_STORAGE__.removeItem(deletedKey);
      }
    }, { key: STORAGE_KEY, deletedKey: DELETED_KEY });

    const page = await context.newPage();
    await acceptNextAlert(page);
    await page.goto(EXAMPLE_PATH, { waitUntil: 'load' });

    const fallbackDetected = await page.evaluate(() => {
      return !!window.__EXAMPLES_STORAGE__ && window.__EXAMPLES_STORAGE__ === window.__EXAMPLES_FALLBACK_STORAGE__;
    });
    expect(fallbackDetected).toBe(true);

    const descriptionValue = `Fallback-${testInfo.project.name}-${Date.now()}`;
    await page.fill('#exampleDescription', descriptionValue);
    const tabLocator = page.locator('#exampleTabs .example-tab');
    const initialCount = await tabLocator.count();
    const savePromise = backend.waitForPut(CANONICAL_PATH);
    await page.click('#btnSaveExample');
    const putResult = await savePromise;
    await expect(tabLocator).toHaveCount(initialCount + 1);

    expect(Array.isArray(putResult.payload.examples)).toBe(true);
    const last = putResult.payload.examples[putResult.payload.examples.length - 1];
    expect(last.description).toBe(descriptionValue);

    const storedEntry = await backend.read(CANONICAL_PATH);
    expect(storedEntry).toBeTruthy();
    expect(storedEntry.examples.some(example => example.description === descriptionValue)).toBe(true);

    await context.close();
  });
});
