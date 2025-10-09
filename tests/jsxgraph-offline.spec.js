const { test, expect } = require('@playwright/test');
const fs = require('fs');

test.describe('JSXGraph offline support', () => {
  test('arealmodell0 uses local vendor assets and exports local script tags', async ({ page }, testInfo) => {
    const blockedRequests = [];
    await page.route('**', route => {
      const rawUrl = route.request().url();
      let parsed;
      try {
        parsed = new URL(rawUrl);
      } catch (error) {
        route.continue();
        return;
      }
      const { protocol, hostname } = parsed;
      if (protocol === 'data:' || protocol === 'about:' || protocol === 'blob:') {
        route.continue();
        return;
      }
      if (hostname === '127.0.0.1' || hostname === 'localhost' || hostname === '::1') {
        route.continue();
        return;
      }
      blockedRequests.push(rawUrl);
      route.abort();
    });

    await page.goto('/arealmodell0.html', { waitUntil: 'load' });
    await page.waitForSelector('#box svg');
    await page.waitForFunction(() => window.JXG && Object.keys(window.JXG.JSXGraph.boards || {}).length > 0);
    expect(blockedRequests).toEqual([]);

    const downloadPromise = page.waitForEvent('download');
    await page.click('#btnHtml');
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toBe('arealmodell_interaktiv.html');
    const downloadPath = testInfo.outputPath('arealmodell_offline_export.html');
    await download.saveAs(downloadPath);

    const htmlContent = await fs.promises.readFile(downloadPath, 'utf8');
    expect(htmlContent).toContain('<script src="/vendor/jsxgraph/jsxgraphcore.js"></script>');
    expect(htmlContent).not.toMatch(/https:\/\/cdn\.jsdelivr\.net/);
  });
});

