const { test, expect } = require('@playwright/test');

const TEST_ENTRIES = [
  {
    slug: 'bildearkiv/graftegner/koordinater',
    svgSlug: 'bildearkiv/graftegner/koordinater.svg',
    pngSlug: 'bildearkiv/graftegner/koordinater.png',
    urls: {
      svg: '/bildearkiv/graftegner/koordinater.svg',
      png: '/bildearkiv/graftegner/koordinater.png'
    },
    files: {
      svg: {
        slug: 'bildearkiv/graftegner/koordinater.svg',
        url: '/bildearkiv/graftegner/koordinater.svg',
        filename: 'koordinatfigur.svg'
      },
      png: {
        slug: 'bildearkiv/graftegner/koordinater.png',
        url: '/bildearkiv/graftegner/koordinater.png',
        filename: 'koordinatfigur.png'
      }
    },
    title: 'Koordinatfigur',
    tool: 'Graftegner',
    createdAt: '2024-01-02T12:30:00.000Z',
    summary: 'Testoppføring for graftegner'
  },
  {
    slug: 'bildearkiv/kuler/symmetri',
    svgSlug: 'bildearkiv/kuler/symmetri.svg',
    pngSlug: 'bildearkiv/kuler/symmetri.png',
    urls: {
      svg: '/bildearkiv/kuler/symmetri.svg',
      png: '/bildearkiv/kuler/symmetri.png'
    },
    files: {
      svg: {
        slug: 'bildearkiv/kuler/symmetri.svg',
        url: '/bildearkiv/kuler/symmetri.svg',
        filename: 'symmetri.svg'
      },
      png: {
        slug: 'bildearkiv/kuler/symmetri.png',
        url: '/bildearkiv/kuler/symmetri.png',
        filename: 'symmetri.png'
      }
    },
    title: 'Symmetrirekke',
    tool: 'Kuler',
    createdAt: '2023-12-18T09:15:00.000Z',
    summary: 'Eksempel fra kuler'
  }
];

test.describe('Arkiv', () => {
  test('viser SVG-liste fra API og filtrering', async ({ page }) => {
    await page.route('**/api/svg', async route => {
      if (route.request().method() !== 'GET') {
        await route.fallback();
        return;
      }
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          entries: TEST_ENTRIES,
          limitation: 'Denne testen bruker midlertidige data.'
        })
      });
    });

    const response = await page.goto('/svg-arkiv.html', { waitUntil: 'networkidle' });
    expect(response?.ok()).toBeTruthy();

    const items = page.locator('[data-svg-grid] [data-svg-item]');
    await expect(items).toHaveCount(TEST_ENTRIES.length);

    const expectedOrder = TEST_ENTRIES.slice().sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );

    const hrefs = await page.$$eval('[data-svg-grid] a', anchors => anchors.map(anchor => anchor.getAttribute('href')));
    expect(hrefs).toEqual(expectedOrder.map(entry => entry.urls.svg));

    const imageSources = await page.$$eval('[data-svg-grid] img', images => images.map(img => img.getAttribute('src')));
    expect(imageSources.every(src => typeof src === 'string' && src.startsWith('/bildearkiv/') && src.endsWith('.png'))).toBe(true);

    await expect(page.locator('[data-status]')).toBeHidden();
    await expect(page.locator('[data-storage-note]')).toHaveText('Denne testen bruker midlertidige data.');

    const filter = page.locator('[data-tool-filter]');
    await expect(filter).toBeVisible();
    await filter.selectOption('Kuler');

    await expect(items).toHaveCount(1);
    await expect(items.first()).toHaveAttribute('data-svg-item', 'bildearkiv/kuler/symmetri.svg');

    const statusText = await page.locator('[data-status]').textContent();
    expect(statusText).toBe('');
  });
});
