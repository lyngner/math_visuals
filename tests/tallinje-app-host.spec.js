const { test, expect } = require('@playwright/test');

function captureConsoleErrors(page) {
  const messages = [];
  page.on('console', message => {
    if (message.type() === 'error') {
      messages.push(message.text());
    }
  });
  page.on('pageerror', error => {
    messages.push(error.message || String(error));
  });
  return messages;
}

test.describe('Tallinje app host integration', () => {
  test('mounts the app definition without console errors', async ({ page }) => {
    const errors = captureConsoleErrors(page);

    await page.goto('/tallinje.html', { waitUntil: 'networkidle' });

    await expect(page.locator('#numberLineSvg')).toBeVisible();
    await expect(page.locator('.draggable-config-list')).toBeVisible();

    const hostInfo = await page.evaluate(() => {
      const mv = window.mathVisuals || {};
      const host = mv.tallinjeHost;
      return {
        hasHost: Boolean(host),
        hasBus: Boolean(host && host.bus),
        appMode: typeof mv.getAppMode === 'function' ? mv.getAppMode() : null
      };
    });

    expect(hostInfo.hasHost).toBe(true);
    expect(hostInfo.hasBus).toBe(true);
    expect(Array.isArray(errors)).toBe(true);
    expect(errors, `Unexpected console errors: ${errors.join('\n')}`).toHaveLength(0);
    expect(hostInfo.appMode === 'task' || hostInfo.appMode === 'default').toBe(true);
  });
});
