const { test, expect } = require('@playwright/test');

test.describe('Examples API base detection', () => {
  test('falls back to protocol/host when location.origin is unavailable', async ({ page, context }) => {
    await context.addInitScript(() => {
      try {
        Object.defineProperty(Location.prototype, 'origin', {
          configurable: true,
          get() {
            return undefined;
          }
        });
      } catch (error) {
        window.__ORIGIN_OVERRIDE_FAILED__ = true;
      }

      const recordedUrls = [];
      window.__FETCH_URLS__ = recordedUrls;
      const originalFetch = window.fetch;
      window.fetch = (...args) => {
        recordedUrls.push(args[0]);
        return Promise.reject(new Error('fetch disabled for test'));
      };
      window.__RESTORE_FETCH__ = () => {
        window.fetch = originalFetch;
      };
    });

    const response = await page.goto('/nkant.html', { waitUntil: 'load' });
    expect(response?.ok()).toBeTruthy();

    const overrideFailed = await page.evaluate(() => window.__ORIGIN_OVERRIDE_FAILED__ === true);
    expect(overrideFailed).toBe(false);

    const fetchUrls = await page.evaluate(() => {
      try {
        if (typeof window.__RESTORE_FETCH__ === 'function') {
          window.__RESTORE_FETCH__();
        }
      } catch (error) {}
      return Array.isArray(window.__FETCH_URLS__) ? window.__FETCH_URLS__.slice() : [];
    });

    expect(fetchUrls.some(url => typeof url === 'string' && url.includes('/api/examples'))).toBe(true);
  });
});
