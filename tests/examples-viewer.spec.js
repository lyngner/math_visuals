const { test, expect } = require('@playwright/test');

const {
  attachExamplesBackendMock,
  normalizeExamplePath
} = require('./helpers/examples-backend-mock');
const {
  createExamplesApiRouteHandler,
  resetExamplesMemoryStore
} = require('./helpers/examples-api-utils');

const VIEWER_FIXTURE_PATH = '/tests/fixtures/examples-viewer.html';
const MEMORY_WARNING_TEXT = 'Denne instansen bruker midlertidig minnelagring. Eksempler tilbakestilles når serveren starter på nytt.';
const EXAMPLE_PATH = '/tallinje';
const CANONICAL_PATH = normalizeExamplePath(EXAMPLE_PATH);

test.describe('Examples viewer – memory mode awareness', () => {
  test('shows memory status alert and renders entries from the backend', async ({ page }) => {
    const backend = await attachExamplesBackendMock(
      page.context(),
      undefined,
      { mode: 'memory', seedDefaults: true }
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
    const sectionCount = await sections.count();
    expect(sectionCount).toBeGreaterThan(1);

    const tallinjeSection = sections.filter({ hasText: CANONICAL_PATH });
    await expect(tallinjeSection).toHaveCount(1);
    const tallinjeHeading = tallinjeSection.first().locator('h2');
    await expect(tallinjeHeading).toHaveText(CANONICAL_PATH);

    const tallinjeCards = tallinjeSection.first().locator('.example');
    await expect(tallinjeCards).toHaveCount(1);
    const iframe = tallinjeCards.first().locator('iframe');
    await expect(iframe).toHaveAttribute('src', /\/tallinje(\?|$)/);
    await expect(tallinjeCards.first().getByRole('button', { name: 'Last inn' })).toBeVisible();
    await expect(tallinjeCards.first().getByRole('button', { name: 'Slett' })).toBeVisible();

    const additionalSection = sections.filter({ hasText: '/brøkpizza' });
    await expect(additionalSection).toHaveCount(1);
    const pizzaCards = additionalSection.first().locator('.example');
    await expect(pizzaCards).not.toHaveCount(0);

    const storedEntry = await backend.client.get(CANONICAL_PATH);
    expect(storedEntry).toBeTruthy();
    expect(storedEntry.mode).toBe('memory');
    expect(storedEntry.storage).toBe('memory');
    expect(Array.isArray(storedEntry.examples)).toBe(true);
    expect(storedEntry.examples.length).toBeGreaterThan(0);
    expect(storedEntry.examples[0]).toMatchObject({
      title: 'Plasser brøkene',
      isDefault: true
    });
  });
});

test.describe('Examples viewer – auto seeded defaults', () => {
  let originalKvUrl;
  let originalKvToken;

  test.beforeAll(() => {
    originalKvUrl = process.env.KV_REST_API_URL;
    originalKvToken = process.env.KV_REST_API_TOKEN;
  });

  test.beforeEach(async ({ context }) => {
    delete process.env.KV_REST_API_URL;
    delete process.env.KV_REST_API_TOKEN;
    resetExamplesMemoryStore();
    await context.route('**/api/examples**', createExamplesApiRouteHandler());
  });

  test.afterEach(async ({ context }) => {
    await context.unroute('**/api/examples**');
    resetExamplesMemoryStore();
  });

  test.afterAll(() => {
    if (originalKvUrl !== undefined) {
      process.env.KV_REST_API_URL = originalKvUrl;
    } else {
      delete process.env.KV_REST_API_URL;
    }
    if (originalKvToken !== undefined) {
      process.env.KV_REST_API_TOKEN = originalKvToken;
    } else {
      delete process.env.KV_REST_API_TOKEN;
    }
  });

  test('renders default examples provided by memory auto-seeding', async ({ page }) => {
    await page.goto(VIEWER_FIXTURE_PATH, { waitUntil: 'load' });

    const banner = page.locator('#examples-store-banner');
    await expect(banner).toBeVisible();
    await expect(banner).toContainText(MEMORY_WARNING_TEXT);

    const sections = page.locator('#examples section');
    await expect(sections.first()).toBeVisible();

    const tallinjeSection = sections.filter({ hasText: '/tallinje' });
    await expect(tallinjeSection).toHaveCount(1);
    const tallinjeExamples = tallinjeSection.first().locator('.example');
    await expect(tallinjeExamples).not.toHaveCount(0);

    const pizzaSection = sections.filter({ hasText: '/brøkpizza' });
    await expect(pizzaSection).toHaveCount(1);
    const pizzaExamples = pizzaSection.first().locator('.example');
    await expect(pizzaExamples).not.toHaveCount(0);
  });
});
