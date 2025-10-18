const { test, expect } = require('@playwright/test');

async function blockJsdelivr(page, blockedRequests) {
  const jsdelivrRoute = '**/*jsdelivr.net/**';
  const handler = route => {
    const url = route.request().url();
    blockedRequests.push(url);
    route.abort();
  };

  await page.route(jsdelivrRoute, handler);

  return async () => {
    await page.unroute(jsdelivrRoute, handler);
  };
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
    const cleanup = await blockJsdelivr(page, blockedRequests);
    try {
      await page.goto('/fortegnsskjema.html', { waitUntil: 'load' });
      await expectMathLiveReady(page);
      expect(blockedRequests).toEqual([]);
    } finally {
      await cleanup();
    }
  });

  test('graftegner loads MathLive assets locally when jsdelivr is blocked', async ({ page }) => {
    const blockedRequests = [];
    const cleanup = await blockJsdelivr(page, blockedRequests);
    try {
      await page.goto('/graftegner.html', { waitUntil: 'load' });
      await expectMathLiveReady(page);
      expect(blockedRequests).toEqual([]);
    } finally {
      await cleanup();
    }
  });
});
