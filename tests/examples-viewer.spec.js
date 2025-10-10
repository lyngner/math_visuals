const { test, expect } = require('@playwright/test');

const {
  attachExamplesBackendMock,
  normalizeExamplePath
} = require('./helpers/examples-backend-mock');
const { loadDefaultExampleEntries } = require('../api/_lib/examples-defaults');

const VIEWER_FIXTURE_PATH = '/tests/fixtures/examples-viewer.html';
const MEMORY_WARNING_TEXT = 'Denne instansen bruker midlertidig minnelagring. Eksempler tilbakestilles når serveren starter på nytt.';

test.describe('Examples viewer – memory mode awareness', () => {
  test('shows memory status alert and renders entries from the backend', async ({ page }) => {
    const backend = await attachExamplesBackendMock(page.context(), undefined, {
      mode: 'memory',
      autoSeedDefaults: true
    });

    await page.goto(VIEWER_FIXTURE_PATH, { waitUntil: 'load' });

    const status = page.locator('#examples-status');
    await expect(status).toBeVisible();
    await expect(status).toContainText('midlertidig minnelagring');
    await expect(status).toHaveAttribute('data-status-type', 'warning');

    const banner = page.locator('#examples-store-banner');
    await expect(banner).toBeVisible();
    await expect(banner).toHaveClass(/examples-store-banner--active/);
    await expect(banner).toContainText(MEMORY_WARNING_TEXT);

    const defaults = await loadDefaultExampleEntries();
    const defaultsWithExamples = defaults.filter(
      entry => Array.isArray(entry.examples) && entry.examples.length > 0
    );
    expect(defaultsWithExamples.length).toBeGreaterThan(0);
    const expectedPaths = defaultsWithExamples
      .map(entry => normalizeExamplePath(entry.path))
      .map(path => path.trim());

    const sections = page.locator('#examples section');
    await expect(sections).toHaveCount(expectedPaths.length);

    const pagePaths = (await sections.locator('h2').allTextContents()).map(text => text.trim());
    expect(new Set(pagePaths)).toEqual(new Set(expectedPaths));

    for (const entry of defaultsWithExamples) {
      const normalizedPath = normalizeExamplePath(entry.path);
      const section = sections.filter({ has: page.locator('h2', { hasText: normalizedPath }) });
      await expect(section).toHaveCount(1);
      const expectedExampleCount = Array.isArray(entry.examples) ? entry.examples.length : 0;
      const exampleCards = section.locator('.example');
      await expect(exampleCards).toHaveCount(expectedExampleCount);
    }

    const backendState = await backend.client.list();
    expect(Array.isArray(backendState.entries)).toBe(true);
    expect(backendState.entries.length).toBe(defaults.length);
    backendState.entries.forEach(entry => {
      expect(entry.mode).toBe('memory');
      expect(entry.storage).toBe('memory');
      const normalizedPath = normalizeExamplePath(entry.path);
      const isDefaultPath = defaults.some(defaultEntry => normalizeExamplePath(defaultEntry.path) === normalizedPath);
      expect(isDefaultPath).toBe(true);
    });
  });
});
