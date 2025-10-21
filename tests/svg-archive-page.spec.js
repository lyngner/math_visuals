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
    exampleState: {
      description: 'Eksempel fra arkiv',
      exampleNumber: 'Arkiv',
      config: {
        CFG: {
          type: 'bar',
          title: 'Arkivfigur'
        }
      }
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
  test.beforeEach(async ({ page }) => {
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
  });

  test('viser SVG-liste fra API og filtrering', async ({ page }) => {
    const items = page.locator('[data-svg-grid] [data-svg-item]');
    await expect(items).toHaveCount(TEST_ENTRIES.length);

    const expectedOrder = TEST_ENTRIES.slice().sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );

    const itemSlugs = await items.evaluateAll(elements =>
      elements.map(element => element.getAttribute('data-svg-item'))
    );
    expect(itemSlugs).toEqual(expectedOrder.map(entry => entry.slug));

    const imageSources = await page.$$eval('[data-svg-grid] img', images =>
      images.map(img => img.getAttribute('src') || '')
    );
    expect(imageSources.every(src => src.startsWith('/api/svg/raw'))).toBe(true);

    await expect(page.locator('[data-status]')).toBeHidden();
    await expect(page.locator('[data-storage-note]')).toHaveText('Denne testen bruker midlertidige data.');

    const filter = page.locator('[data-tool-filter]');
    await expect(filter).toBeVisible();
    await filter.selectOption('Kuler');

    await expect(items).toHaveCount(1);
    const remainingSlug = await items.first().getAttribute('data-svg-item');
    expect(remainingSlug).toBe(TEST_ENTRIES.find(entry => entry.tool === 'Kuler').slug);

    await expect(page.locator('[data-status]')).toBeHidden();
  });

  test('åpner dialog og bruker handlinger', async ({ page }) => {
    await page.route('**/api/svg?slug=*', async route => {
      if (route.request().method() === 'DELETE') {
        await route.fulfill({ status: 200, contentType: 'application/json', body: '{}' });
        return;
      }
      await route.fallback();
    });

    await page.route('**/api/svg/raw**', async route => {
      const url = route.request().url();
      if (url.includes('format=png') || url.endsWith('.png')) {
        await route.fulfill({ status: 200, headers: { 'content-type': 'image/png' }, body: 'PNG' });
        return;
      }
      await route.fulfill({
        status: 200,
        headers: { 'content-type': 'image/svg+xml' },
        body: '<svg xmlns="http://www.w3.org/2000/svg"></svg>'
      });
    });

    const menuTrigger = page.locator('.svg-archive__menu-trigger').first();
    await menuTrigger.click();

    const dialog = page.locator('dialog[data-archive-viewer]');
    await expect(dialog).toBeVisible();
    await expect(dialog.locator('[data-action="open-svg"]')).toBeFocused();

    await dialog.locator('.svg-archive__dialog-close').click();
    await expect(dialog).toBeHidden();
    await expect(menuTrigger).toBeFocused();

    const previewTrigger = page.locator('[data-preview-trigger="true"]').first();
    await previewTrigger.click();

    await expect(dialog).toBeVisible();
    await expect(dialog.locator('.svg-archive__dialog-title')).toHaveText(TEST_ENTRIES[0].title);

    const status = page.locator('[data-status]');

    const svgPopupPromise = page.waitForEvent('popup');
    await dialog.locator('[data-action="open-svg"]').click();
    const svgPopup = await svgPopupPromise;
    await svgPopup.close();
    await expect(status).toHaveText('Åpner SVG i ny fane.');

    const pngPopupPromise = page.waitForEvent('popup');
    await dialog.locator('[data-action="open-png"]').click();
    const pngPopup = await pngPopupPromise;
    await pngPopup.close();
    await expect(status).toHaveText('Åpner PNG i ny fane.');

    await page.evaluate(() => {
      window.__openRequests = [];
      window.MathVisExamples = {
        prepareOpenRequest: request => {
          window.__openRequests.push(request);
        }
      };
    });

    const editPopupPromise = page.waitForEvent('popup');
    await dialog.locator('[data-action="edit"]').click();
    const editPopup = await editPopupPromise;
    await editPopup.close();
    await expect(status).toHaveText('Figuren åpnes i Graftegner med et midlertidig eksempel.');

    const preparedRequests = await page.evaluate(() => window.__openRequests || []);
    expect(preparedRequests).toHaveLength(1);
    expect(preparedRequests[0]).toMatchObject({
      storagePath: '/graftegner',
      canonicalPath: '/graftegner',
      path: '/graftegner',
      targetUrl: '/graftegner.html'
    });
    expect(preparedRequests[0].example).toBeTruthy();

    const downloadPromise = page.waitForEvent('download');
    await dialog.locator('[data-action="download"]').click();
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toMatch(/koordinat/);
    await expect(status).toHaveText('Starter nedlasting av SVG.');

    page.once('dialog', async confirmDialog => {
      expect(confirmDialog.message()).toContain('Koordinatfigur');
      await confirmDialog.accept();
    });

    await dialog.locator('[data-action="delete"]').click();

    await expect(status).toHaveText('Figur slettet.');
    await expect(dialog).toBeHidden();
    await expect(page.locator('[data-svg-grid] [data-svg-item]')).toHaveCount(TEST_ENTRIES.length - 1);
  });
});
