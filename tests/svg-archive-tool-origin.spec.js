const { test, expect } = require('@playwright/test');

const TOOL_ORIGIN = 'https://verktoy.mathvisuals.test';

const TEST_ENTRY = {
  slug: 'bildearkiv/graftegner/absolutt-url',
  svgSlug: 'bildearkiv/graftegner/absolutt-url.svg',
  pngSlug: 'bildearkiv/graftegner/absolutt-url.png',
  urls: {
    svg: '/bildearkiv/graftegner/absolutt-url.svg',
    png: '/bildearkiv/graftegner/absolutt-url.png'
  },
  files: {
    svg: {
      slug: 'bildearkiv/graftegner/absolutt-url.svg',
      url: '/bildearkiv/graftegner/absolutt-url.svg',
      filename: 'absolutt-url.svg'
    },
    png: {
      slug: 'bildearkiv/graftegner/absolutt-url.png',
      url: '/bildearkiv/graftegner/absolutt-url.png',
      filename: 'absolutt-url.png'
    }
  },
  svgUrl: '/bildearkiv/graftegner/absolutt-url.svg',
  pngUrl: '/bildearkiv/graftegner/absolutt-url.png',
  thumbnailUrl: '/bildearkiv/graftegner/absolutt-url.png',
  title: 'Absolutt testfigur',
  displayTitle: 'Absolutt testfigur',
  baseName: 'absolutt-testfigur',
  tool: 'Graftegner',
  storagePath: '/graftegner',
  createdAt: '2024-01-10T12:00:00.000Z',
  summary: 'Testfigur for absolutt URL',
  exampleState: {
    description: 'Absolutt testfigur',
    exampleNumber: 'Arkiv',
    config: {
      CFG: {
        type: 'line',
        title: 'Absolutt'
      }
    }
  }
};

test.describe('SVG-arkiv verktøyopprinnelse', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(origin => {
      window.MATH_VISUALS_TOOL_ORIGIN = origin;
    }, TOOL_ORIGIN);

    await page.addInitScript(() => {
      window.__openedToolUrls = [];
      window.open = (url, target, features) => {
        window.__openedToolUrls.push(url);
        return {
          closed: false,
          close: () => {}
        };
      };

      const existingApi = window.MathVisExamples && typeof window.MathVisExamples === 'object'
        ? window.MathVisExamples
        : {};
      const originalPrepare = typeof existingApi.prepareOpenRequest === 'function'
        ? existingApi.prepareOpenRequest.bind(existingApi)
        : null;

      window.__openRequests = [];
      window.MathVisExamples = {
        ...existingApi,
        prepareOpenRequest: request => {
          window.__openRequests.push(request);
          if (originalPrepare) {
            return originalPrepare(request);
          }
          return undefined;
        }
      };
    });

    await page.route('**/api/svg', async route => {
      if (route.request().method() !== 'GET') {
        await route.fallback();
        return;
      }
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ entries: [TEST_ENTRY] })
      });
    });

    await page.route('**/api/svg/raw**', async route => {
      await route.fulfill({
        status: 200,
        headers: { 'content-type': 'image/png' },
        body: 'PNG'
      });
    });

    const response = await page.goto('/svg-arkiv.html', { waitUntil: 'networkidle' });
    expect(response?.ok()).toBeTruthy();
  });

  test('åpner verktøy med absolutt URL når origin er konfigurert', async ({ page }) => {
    const items = page.locator('[data-svg-grid] [data-preview-trigger="true"]');
    await expect(items).toHaveCount(1);

    await items.first().click();

    const dialog = page.locator('dialog[data-archive-viewer]');
    await expect(dialog).toBeVisible();

    const editButton = dialog.locator('[data-action="edit"]');
    await expect(editButton).toBeEnabled();

    await editButton.click();

    const openedUrls = await page.evaluate(() => window.__openedToolUrls || []);
    expect(openedUrls).toContain(`${TOOL_ORIGIN}/graftegner.html`);

    const openRequests = await page.evaluate(() => window.__openRequests || []);
    expect(openRequests).toHaveLength(1);
    expect(openRequests[0].targetUrl).toBe(`${TOOL_ORIGIN}/graftegner.html`);
  });
});
