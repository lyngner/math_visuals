const { test, expect } = require('@playwright/test');

function trackJsdelivrRequests(page) {
  const requests = [];
  const listener = request => {
    if (request.url().includes('jsdelivr.net')) {
      requests.push(request.url());
    }
  };

  page.on('request', listener);

  return {
    requests,
    dispose() {
      page.off('request', listener);
    },
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
    const tracker = trackJsdelivrRequests(page);
    try {
      await page.goto('/fortegnsskjema.html', { waitUntil: 'load' });
      await expectMathLiveReady(page);
      expect(tracker.requests).toEqual([]);
    } finally {
      tracker.dispose();
    }
  });

  test('graftegner loads MathLive assets locally when jsdelivr is blocked', async ({ page }) => {
    const tracker = trackJsdelivrRequests(page);
    try {
      await page.goto('/graftegner.html', { waitUntil: 'load' });
      await expectMathLiveReady(page);
      expect(tracker.requests).toEqual([]);
    } finally {
      tracker.dispose();
    }
  });
});
