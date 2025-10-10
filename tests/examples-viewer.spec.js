const { test, expect } = require('@playwright/test');

const {
  attachExamplesBackendMock,
  normalizeExamplePath
} = require('./helpers/examples-backend-mock');

const VIEWER_FIXTURE_PATH = '/tests/fixtures/examples-viewer.html';
const MEMORY_WARNING_TEXT = 'Denne instansen bruker midlertidig minnelagring. Eksempler tilbakestilles når serveren starter på nytt.';
const EXAMPLE_PATH = '/diagram/index.html';
const CANONICAL_PATH = normalizeExamplePath(EXAMPLE_PATH);

const viewerSeedPayload = {
  examples: [
    {
      description: 'Viewer minnetest',
      config: { STATE: { note: 'lagret i minne' } }
    }
  ],
  deletedProvided: []
};

test.describe('Examples viewer – memory mode awareness', () => {
  test('shows memory status alert and renders entries from the backend', async ({ page }) => {
    const backend = await attachExamplesBackendMock(
      page.context(),
      { [CANONICAL_PATH]: viewerSeedPayload },
      undefined,
      { mode: 'memory' }
    );

    await page.goto(VIEWER_FIXTURE_PATH, { waitUntil: 'load' });

    const status = page.locator('#examples-status');
    await expect(status).toBeVisible();
    await expect(status).toContainText('midlertidig minnelagring');
    await expect(status).toHaveAttribute('data-status-type', 'warning');

    const banner = page.locator('#examples-store-banner');
    await expect(banner).toBeVisible();
    await expect(banner).toHaveClass(/examples-store-banner--active/);
    await expect(banner).toContainText(MEMORY_WARNING_TEXT);

    const sections = page.locator('#examples section');
    await expect(sections).toHaveCount(1);
    const sectionHeading = sections.first().locator('h2');
    await expect(sectionHeading).toHaveText(CANONICAL_PATH);

    const exampleCards = sections.first().locator('.example');
    await expect(exampleCards).toHaveCount(1);
    const iframe = exampleCards.first().locator('iframe');
    await expect(iframe).toHaveAttribute('src', /\/diagram(\?|$)/);
    await expect(exampleCards.first().getByRole('button', { name: 'Last inn' })).toBeVisible();
    await expect(exampleCards.first().getByRole('button', { name: 'Slett' })).toBeVisible();

    const storedEntry = await backend.client.get(CANONICAL_PATH);
    expect(storedEntry).toBeTruthy();
    expect(storedEntry.mode).toBe('memory');
    expect(storedEntry.storage).toBe('memory');
  });
});
