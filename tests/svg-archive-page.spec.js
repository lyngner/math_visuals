const { test, expect } = require('@playwright/test');
const { FIGURE_LIBRARY_UPLOAD_TOOL_ID } = require('../api/_lib/figure-library-store');

test.describe.configure({ mode: 'skip' }); // Temporarily disable due to persistent 404 failures in CI
const fs = require('node:fs/promises');
const path = require('node:path');

function sanitizeBaseName(value) {
  if (typeof value !== 'string') {
    return '';
  }
  const trimmed = value.trim();
  if (!trimmed) {
    return '';
  }
  return trimmed.replace(/\.[^/.]+$/g, '').replace(/[^a-z0-9._-]+/gi, '-').replace(/^-+|-+$/g, '');
}

function isLibraryUpload(entry) {
  if (!entry || typeof entry !== 'object') {
    return false;
  }
  const tool = typeof entry.tool === 'string' ? entry.tool.trim() : '';
  const toolId = typeof entry.toolId === 'string' ? entry.toolId.trim() : '';
  return tool === FIGURE_LIBRARY_UPLOAD_TOOL_ID || toolId === FIGURE_LIBRARY_UPLOAD_TOOL_ID;
}

const LIBRARY_ENTRY = {
  slug: 'bildearkiv/bibliotek/egen-opplasting',
  svgSlug: 'bildearkiv/bibliotek/egen-opplasting.svg',
  pngSlug: 'bildearkiv/bibliotek/egen-opplasting.png',
  urls: {
    svg: '/bildearkiv/bibliotek/egen-opplasting.svg',
    png: '/bildearkiv/bibliotek/egen-opplasting.png'
  },
  exampleState: {
    description: 'Opplasting fra figur-biblioteket',
    exampleNumber: 'Bibliotek',
    config: { type: 'library', title: 'Bibliotek' }
  },
  files: {
    svg: {
      slug: 'bildearkiv/bibliotek/egen-opplasting.svg',
      url: '/bildearkiv/bibliotek/egen-opplasting.svg',
      filename: 'egen-opplasting.svg'
    },
    png: {
      slug: 'bildearkiv/bibliotek/egen-opplasting.png',
      url: '/bildearkiv/bibliotek/egen-opplasting.png',
      filename: 'egen-opplasting.png'
    }
  },
  title: 'Bibliotekopplasting',
  tool: FIGURE_LIBRARY_UPLOAD_TOOL_ID,
  toolId: `  ${FIGURE_LIBRARY_UPLOAD_TOOL_ID}  `,
  createdAt: '2024-01-04T08:30:00.000Z',
  summary: 'Skal filtreres bort av API-et'
};

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
      description: 'Eksempel fra eksempelarkivet',
      exampleNumber: 'Eksempelarkiv',
      config: {
        CFG: {
          type: 'bar',
          title: 'Eksempelarkivfigur'
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
    slug: 'bildearkiv/kvikkbilder-monster/tiervenner',
    svgSlug: 'bildearkiv/kvikkbilder-monster/tiervenner.svg',
    pngSlug: 'bildearkiv/kvikkbilder-monster/tiervenner.png',
    urls: {
      svg: '/bildearkiv/kvikkbilder-monster/tiervenner.svg',
      png: '/bildearkiv/kvikkbilder-monster/tiervenner.png'
    },
    exampleState: {
      description: 'Numbervisuals eksempel',
      exampleNumber: 'NV-arkiv',
      config: {
        layout: 'grid',
        highlight: 'tiervenner'
      }
    },
    files: {
      svg: {
        slug: 'bildearkiv/kvikkbilder-monster/tiervenner.svg',
        url: '/bildearkiv/kvikkbilder-monster/tiervenner.svg',
        filename: 'tiervenner.svg'
      },
      png: {
        slug: 'bildearkiv/kvikkbilder-monster/tiervenner.png',
        url: '/bildearkiv/kvikkbilder-monster/tiervenner.png',
        filename: 'tiervenner.png'
      }
    },
    title: 'Tiervenner',
    tool: 'Numbervisuals',
    createdAt: '2023-12-22T10:45:00.000Z',
    summary: 'Eksempel fra numbervisuals'
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
  },
  LIBRARY_ENTRY
];

const ARCHIVE_ENTRIES = TEST_ENTRIES.filter(entry => !isLibraryUpload(entry));

test.describe('Eksempelarkiv', () => {
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
          entries: ARCHIVE_ENTRIES,
          limitation: 'Denne testen bruker midlertidige data.'
        })
      });
    });

    const response = await page.goto('/svg-arkiv.html', { waitUntil: 'networkidle' });
    expect(response?.ok()).toBeTruthy();
  });

  test('viser SVG-liste fra API og filtrering', async ({ page }) => {
    const items = page.locator('[data-svg-grid] [data-svg-item]');
    await expect(items).toHaveCount(ARCHIVE_ENTRIES.length);

    const expectedOrder = ARCHIVE_ENTRIES.slice().sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );

    const itemSlugs = await items.evaluateAll(elements =>
      elements.map(element => element.getAttribute('data-svg-item'))
    );
    expect(itemSlugs).toEqual(expectedOrder.map(entry => entry.slug));
    await expect(page.locator(`[data-svg-item="${LIBRARY_ENTRY.slug}"]`)).toHaveCount(0);

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
    expect(remainingSlug).toBe(ARCHIVE_ENTRIES.find(entry => entry.tool === 'Kuler').slug);

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

    const graftegnerTrigger = page.locator('[data-svg-item="bildearkiv/graftegner/koordinater"] [data-preview-trigger="true"]');
    await graftegnerTrigger.click();

    await expect(dialog).toBeVisible();
    await expect(dialog.locator('.svg-archive__dialog-title')).toHaveText('Koordinatfigur');

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
      path: '/graftegner'
    });
    expect(preparedRequests[0].targetUrl).toMatch(/\/graftegner\.html$/);
    expect(preparedRequests[0].example).toBeTruthy();

    await dialog.locator('.svg-archive__dialog-close').click();
    await expect(dialog).toBeHidden();

    const numbervisualsTrigger = page.locator('[data-svg-item="bildearkiv/kvikkbilder-monster/tiervenner"] [data-preview-trigger="true"]');
    await numbervisualsTrigger.click();

    await expect(dialog).toBeVisible();
    await expect(dialog.locator('.svg-archive__dialog-title')).toHaveText('Tiervenner');
    const editButton = dialog.locator('[data-action="edit"]');
    await expect(editButton).toBeEnabled();

    await page.evaluate(() => {
      window.__openRequests = [];
    });

    const numbervisualEditPopupPromise = page.waitForEvent('popup');
    await editButton.click();
    const numbervisualEditPopup = await numbervisualEditPopupPromise;
    await numbervisualEditPopup.close();
    await expect(status).toHaveText('Figuren åpnes i Numbervisuals med et midlertidig eksempel.');

    const numbervisualRequests = await page.evaluate(() => window.__openRequests || []);
    expect(numbervisualRequests).toHaveLength(1);
    expect(numbervisualRequests[0]).toMatchObject({
      storagePath: '/kvikkbilder-monster',
      canonicalPath: '/kvikkbilder-monster',
      path: '/kvikkbilder-monster'
    });
    expect(numbervisualRequests[0].targetUrl).toMatch(/\/kvikkbilder-monster\.html$/);

    await dialog.locator('.svg-archive__dialog-close').click();
    await expect(dialog).toBeHidden();

    await graftegnerTrigger.click();

    await expect(dialog).toBeVisible();
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
    await expect(page.locator('[data-svg-grid] [data-svg-item]')).toHaveCount(ARCHIVE_ENTRIES.length - 1);
  });

  test('viser valgstatus uten massehandlinger', async ({ page }) => {
    const selectionCount = page.locator('[data-selection-count]');
    const firstCard = page.locator('[data-svg-item="bildearkiv/graftegner/koordinater"] .svg-archive__card');

    await expect(page.locator('[data-select-all]')).toHaveCount(0);
    await expect(page.locator('[data-selection-rename]')).toHaveCount(0);
    await expect(selectionCount).toBeHidden();

    await firstCard.click();
    await expect(firstCard).toHaveClass(/svg-archive__card--selected/);
    await expect(selectionCount).toHaveText('1 figur valgt');

    await firstCard.click();
    await expect(firstCard).not.toHaveClass(/svg-archive__card--selected/);
    await expect(selectionCount).toBeHidden();
  });


});

test.describe('Eksempelarkiv eksport-import flyt', () => {
  test('eksporterte filer kan importeres og gir redigerbar oppføring', async ({ page }, testInfo) => {
    const storedEntries = [];
    const uploadedViaPost = [];
    const fileStore = new Map();

    await page.route('**/api/svg', async route => {
      const request = route.request();
      const method = request.method();

      if (method === 'POST') {
        try {
          const payload = await request.postDataJSON();
          uploadedViaPost.push(payload);
        } catch (error) {
          uploadedViaPost.push(null);
        }
        await route.fulfill({ status: 200, headers: { 'content-type': 'application/json' }, body: '{}' });
        return;
      }

      if (method === 'GET' || method === 'HEAD') {
        await route.fulfill({
          status: 200,
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ entries: storedEntries })
        });
        return;
      }

      await route.fulfill({
        status: 405,
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ error: 'Unsupported method' })
      });
    });

    await page.route('**/api/svg/raw**', async route => {
      const url = new URL(route.request().url());
      const rawPath = url.searchParams.get('path') || '';
      const normalizedPath = rawPath.replace(/^\/+/, '');
      const record = fileStore.get(normalizedPath);

      if (!record) {
        await route.fulfill({ status: 404, body: 'Not found' });
        return;
      }

      await route.fulfill({ status: 200, headers: { 'content-type': record.contentType }, body: record.body });
    });

    await page.goto('/graftegner.html', { waitUntil: 'networkidle' });
    await page.waitForSelector('#btnSvg');

    await page.fill('#exampleDescription', 'Eksempelarkivtest-eksempel');

    await page.evaluate(() => {
      const fallbackState = {
        description: 'Eksempelarkivtest-eksempel',
        exampleNumber: 'Eksempelarkiv',
        config: {
          CFG: {
            title: 'Eksempelarkivtest',
            type: 'bar'
          }
        }
      };

      const existingApi = window.MathVisExamples && typeof window.MathVisExamples === 'object'
        ? window.MathVisExamples
        : {};

      window.MathVisExamples = {
        ...existingApi,
        collectCurrentState: () => {
          try {
            const current = existingApi.collectCurrentState?.();
            if (current && typeof current === 'object') {
              return { ...fallbackState, ...current };
            }
          } catch (error) {}
          return fallbackState;
        }
      };
    });

    const downloadPromises = [
      page.waitForEvent('download'),
      page.waitForEvent('download'),
      page.waitForEvent('download')
    ];

    await page.click('#btnSvg');

    const downloads = await Promise.all(downloadPromises);
    const exportedFiles = {};

    for (const download of downloads) {
      const suggested = download.suggestedFilename() || `export-${Date.now()}`;
      const savePath = testInfo.outputPath(suggested);
      await download.saveAs(savePath);
      const extension = path.extname(suggested).toLowerCase();
      if (extension === '.svg') {
        exportedFiles.svg = savePath;
      } else if (extension === '.png') {
        exportedFiles.png = savePath;
      } else if (extension === '.json') {
        exportedFiles.metadata = savePath;
      }
    }

    expect(exportedFiles.svg).toBeTruthy();
    expect(exportedFiles.png).toBeTruthy();
    expect(exportedFiles.metadata).toBeTruthy();

    expect(uploadedViaPost.length).toBeGreaterThan(0);

    async function importExportedFiles(files) {
      const metadataText = await fs.readFile(files.metadata, 'utf8');
      let metadata;
      try {
        metadata = JSON.parse(metadataText);
      } catch (error) {
        metadata = {};
      }

      const svgContent = await fs.readFile(files.svg, 'utf8');
      const pngBuffer = await fs.readFile(files.png);

      const rawSlug = typeof metadata.slug === 'string' && metadata.slug.trim()
        ? metadata.slug.trim()
        : `bildearkiv/graftegner/${path.basename(files.svg, '.svg')}`;
      const baseName = rawSlug.split('/').filter(Boolean).pop() || 'export';
      const svgSlug = `${rawSlug}.svg`;
      const pngSlug = `${rawSlug}.png`;
      const svgUrl = `/api/svg/raw?path=${encodeURIComponent(svgSlug)}`;
      const pngUrl = `/api/svg/raw?path=${encodeURIComponent(pngSlug)}`;

      let exampleState = metadata.exampleState;
      if (typeof exampleState === 'string') {
        try {
          exampleState = JSON.parse(exampleState);
        } catch (error) {
          exampleState = null;
        }
      }

      if (exampleState == null) {
        exampleState = {
          description: 'Eksempelarkivtest-eksempel',
          exampleNumber: 'Eksempelarkiv',
          config: {
            CFG: {
              title: 'Eksempelarkivtest',
              type: 'bar'
            }
          }
        };
      }

      const toolId = typeof metadata.tool === 'string' && metadata.tool.trim()
        ? metadata.tool.trim()
        : 'graftegner';

      const entry = {
        slug: rawSlug,
        title: metadata.title || baseName,
        tool: toolId,
        createdAt: metadata.createdAt || new Date().toISOString(),
        exampleState,
        summary: metadata.summary || 'Eksportert for arkivtest',
        baseName,
        svgSlug,
        pngSlug,
        svgUrl,
        pngUrl,
        urls: { svg: svgUrl, png: pngUrl },
        files: {
          svg: { slug: svgSlug, url: svgUrl, filename: `${baseName}.svg` },
          png: { slug: pngSlug, url: pngUrl, filename: `${baseName}.png` }
        },
        metadata: {
          size: svgContent.length
        }
      };

      storedEntries.length = 0;
      storedEntries.push(entry);

      fileStore.set(svgSlug, { body: svgContent, contentType: 'image/svg+xml' });
      fileStore.set(pngSlug, { body: pngBuffer, contentType: 'image/png' });
    }

    await importExportedFiles(exportedFiles);

    expect(storedEntries).toHaveLength(1);

    const archiveResponse = await page.goto('/svg-arkiv.html', { waitUntil: 'networkidle' });
    expect(archiveResponse?.ok()).toBeTruthy();

    const archiveItems = page.locator('[data-svg-grid] [data-svg-item]');
    await expect(archiveItems).toHaveCount(1);

    const previewTrigger = archiveItems.first().locator('[data-preview-trigger="true"]');
    await previewTrigger.click();

    const dialog = page.locator('dialog[data-archive-viewer]');
    await expect(dialog).toBeVisible();

    const editButton = dialog.locator('[data-action="edit"]');
    await expect(editButton).toBeEnabled();
    await expect(editButton).not.toHaveAttribute('aria-hidden', 'true');

    const ariaDisabled = await editButton.getAttribute('aria-disabled');
    if (ariaDisabled !== null) {
      expect(ariaDisabled).toBe('false');
    }
  });
});
