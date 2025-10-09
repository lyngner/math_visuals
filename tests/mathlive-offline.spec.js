const { test, expect } = require('@playwright/test');

async function blockJsdelivr(page, blockedRequests) {
  await page.route('**/*', route => {
    const url = route.request().url();
    if (/^https?:\/\/[^/]*jsdelivr\.net\//i.test(url)) {
      blockedRequests.push(url);
      route.abort();
      return;
    }
    route.continue();
  });
}

test.describe('MathLive offline support', () => {
  async function expectMathLiveReady(page) {
    await page.waitForFunction(() => {
      const field = document.querySelector('math-field');
      return (
        !!field &&
        typeof field.getValue === 'function' &&
        typeof field.setValue === 'function'
      );
    });
    const latexValue = await page.evaluate(() => {
      const field = document.querySelector('math-field');
      return field && field.getValue ? field.getValue('latex') : null;
    });
    expect(typeof latexValue).toBe('string');
  }

  test('fortegnsskjema loads MathLive assets locally when jsdelivr is blocked', async ({ page }) => {
    const blockedRequests = [];
    await blockJsdelivr(page, blockedRequests);
    await page.goto('/fortegnsskjema.html', { waitUntil: 'load' });
    await expectMathLiveReady(page);
    expect(blockedRequests).toEqual([]);
  });

  test('graftegner loads MathLive assets locally when jsdelivr is blocked', async ({ page }) => {
    const blockedRequests = [];
    await blockJsdelivr(page, blockedRequests);
    await page.goto('/graftegner.html', { waitUntil: 'load' });
    await expectMathLiveReady(page);
    expect(blockedRequests).toEqual([]);
  });
});
