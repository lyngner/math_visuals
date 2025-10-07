const { test, expect } = require('@playwright/test');

const STORAGE_KEY = 'examples_/graftegner';

function createQuotaExceededError(page) {
  return page.addInitScript(() => {
    const createError = () => {
      try {
        return new DOMException('QuotaExceededError', 'QuotaExceededError');
      } catch (error) {
        const fallback = new Error('QuotaExceededError');
        fallback.name = 'QuotaExceededError';
        return fallback;
      }
    };
    const quotaError = createError();
    if (typeof Storage !== 'undefined' && Storage.prototype && typeof Storage.prototype.setItem === 'function') {
      const original = Storage.prototype.setItem;
      Storage.prototype.setItem = function patchedSetItem() {
        throw quotaError;
      };
      if (!window.__RESTORE_STORAGE_SETITEM__) {
        window.__RESTORE_STORAGE_SETITEM__ = () => {
          Storage.prototype.setItem = original;
        };
      }
    }
  });
}

test.describe('Example storage fallback', () => {
  test('falls back to in-memory storage with notice when quota is exceeded', async ({ page }) => {
    await createQuotaExceededError(page);

    await page.goto('/graftegner.html', { waitUntil: 'load' });

    await page.locator('#btnSaveExample').click();

    const notice = page.locator('.example-storage-notice');
    await expect(notice).toBeVisible();
    await expect(notice).toContainText(/lagres midlertidig/i);

    const fallbackMode = await page.evaluate(() => window.__EXAMPLES_FALLBACK_STORAGE_MODE__);
    expect(fallbackMode).toBe('memory');

    const stored = await page.evaluate(key => {
      const store = window.__EXAMPLES_FALLBACK_STORAGE__;
      if (!store || typeof store.getItem !== 'function') return null;
      try {
        return store.getItem(key);
      } catch (error) {
        return null;
      }
    }, STORAGE_KEY);

    expect(stored).not.toBeNull();
  });
});
