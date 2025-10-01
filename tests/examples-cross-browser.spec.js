const { test, expect } = require('@playwright/test');

const EXAMPLE_PATH = '/diagram/index.html';
const STORAGE_KEY = computeStorageKey(EXAMPLE_PATH);
const DELETED_KEY = `${STORAGE_KEY}_deletedProvidedExamples`;

function computeStorageKey(pathname) {
  if (typeof pathname !== 'string') return 'examples_/';
  let path = pathname.trim();
  if (!path) path = '/';
  path = path.split('\\').join('/');
  if (!path.startsWith('/')) path = `/${path}`;
  while (path.includes('//')) {
    path = path.replace('//', '/');
  }
  const lower = path.toLowerCase();
  if (lower.endsWith('/index.html')) {
    path = path.slice(0, -'/index.html'.length);
  } else if (lower.endsWith('/index.htm')) {
    path = path.slice(0, -'/index.htm'.length);
  }
  if (path.length > 1 && path.endsWith('/')) {
    path = path.slice(0, -1);
  }
  if (!path) {
    path = '/';
  }
  return `examples_${path}`;
}
async function clearExampleStorage(page) {
  await page.addInitScript(({ key, deletedKey }) => {
    const eraseKey = (store, target) => {
      if (!store || typeof store.removeItem !== 'function') return;
      try {
        store.removeItem(target);
      } catch (error) {
        // Ignore storage access errors – fallback storage will kick in later.
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

async function acceptNextAlert(page) {
  const handler = dialog => {
    dialog.accept().catch(() => {});
    page.off('dialog', handler);
  };
  page.on('dialog', handler);
}

test.describe('Example creation portability', () => {
  test.beforeEach(async ({ page }) => {
    await clearExampleStorage(page);
  });

  test('saves and reloads examples across browser contexts', async ({ page, browser }, testInfo) => {
    await acceptNextAlert(page);
    await page.goto(EXAMPLE_PATH, { waitUntil: 'load' });

    const tabLocator = page.locator('#exampleTabs .example-tab');
    const initialCount = await tabLocator.count();

    const titleValue = `Tverrbrowser test ${testInfo.project.name}`;
    const descriptionValue = `E2E-${testInfo.project.name}-${Date.now()}`;

    await page.fill('#cfgTitle', titleValue);
    await page.fill('#exampleDescription', descriptionValue);
    await page.click('#btnSaveExample');

    await expect(tabLocator).toHaveCount(initialCount + 1);

    const serialized = await page.evaluate(key => {
      const storage = window.__EXAMPLES_STORAGE__ || window.localStorage;
      if (!storage || typeof storage.getItem !== 'function') return null;
      try {
        return storage.getItem(key);
      } catch (error) {
        return null;
      }
    }, STORAGE_KEY);

    expect(serialized, 'serialized example data should exist').toBeTruthy();

    const parsed = JSON.parse(serialized);
    const savedExample = parsed[parsed.length - 1];
    expect(savedExample.description).toBe(descriptionValue);
    expect(savedExample.config).toBeTruthy();

    const otherContext = await browser.newContext();
    await otherContext.addInitScript(({ key, value }) => {
      const trySet = store => {
        if (!store || typeof store.setItem !== 'function') return false;
        try {
          store.setItem(key, value);
          return true;
        } catch (error) {
          return false;
        }
      };
      if (!trySet(window.localStorage)) {
        if (window.__EXAMPLES_STORAGE__ && window.__EXAMPLES_STORAGE__ !== window.localStorage) {
          trySet(window.__EXAMPLES_STORAGE__);
        }
        if (window.__EXAMPLES_FALLBACK_STORAGE__) {
          trySet(window.__EXAMPLES_FALLBACK_STORAGE__);
        }
      }
    }, { key: STORAGE_KEY, value: serialized });

    const otherPage = await otherContext.newPage();
    await acceptNextAlert(otherPage);
    await otherPage.goto(EXAMPLE_PATH, { waitUntil: 'load' });

    const otherTabs = otherPage.locator('#exampleTabs .example-tab');
    await expect(otherTabs).toHaveCount(initialCount + 1);
    await otherTabs.last().click();

    await expect(otherPage.locator('#exampleDescription')).toHaveValue(descriptionValue);
    await expect(otherPage.locator('#cfgTitle')).toHaveValue(titleValue);

    await otherContext.close();
  });

  test('uses fallback storage when localStorage is unavailable', async ({ browser }, testInfo) => {
    const context = await browser.newContext();
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
    await page.click('#btnSaveExample');
    await expect(tabLocator).toHaveCount(initialCount + 1);

    const stored = await page.evaluate(key => {
      const storage = window.__EXAMPLES_STORAGE__;
      if (!storage || typeof storage.getItem !== 'function') return null;
      return storage.getItem(key);
    }, STORAGE_KEY);

    expect(stored).toBeTruthy();
    const parsed = JSON.parse(stored);
    const last = parsed[parsed.length - 1];
    expect(last.description).toBe(descriptionValue);

    await context.close();
  });
});
