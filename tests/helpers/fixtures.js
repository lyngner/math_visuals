const { test: base, expect } = require('@playwright/test');

const KNOWN_CONSOLE_NOISE = [
  {
    pattern: /DevTools failed to load SourceMap/,
    description: 'Chromium occasionally logs missing source maps for vendored assets, which is noise for CI.'
  }
];

function shouldIgnoreConsoleMessage(message) {
  if (!message) return false;
  const text = message.text();
  return KNOWN_CONSOLE_NOISE.some(entry => entry.pattern.test(text));
}

const test = base.extend({
  page: async ({ page }, use, testInfo) => {
    const consoleMessages = [];
    const listener = message => {
      const type = message.type();
      if (type !== 'error' && type !== 'warning') {
        return;
      }
      if (shouldIgnoreConsoleMessage(message)) {
        return;
      }
      const location = message.location();
      const prefix = type === 'warning' ? 'WARN' : 'ERROR';
      const locationInfo = location && location.url
        ? ` @ ${location.url}:${location.lineNumber || '?'}:${location.columnNumber || '?'}`
        : '';
      consoleMessages.push(`${prefix}: ${message.text()}${locationInfo}`);
    };

    page.on('console', listener);
    await use(page);
    page.off('console', listener);

    if (consoleMessages.length > 0) {
      await testInfo.attach('console-messages', {
        body: consoleMessages.join('\n'),
        contentType: 'text/plain'
      });
      throw new Error(`Unexpected console output:\n${consoleMessages.join('\n')}`);
    }
  },

  attachScreenshot: async ({ page }, use, testInfo) => {
    await use(async (name = 'screenshot.png') => {
      const buffer = await page.screenshot({ fullPage: true });
      await testInfo.attach(name, { body: buffer, contentType: 'image/png' });
    });
  }
});

module.exports = { test, expect };
