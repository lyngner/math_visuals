const { test, expect } = require('@playwright/test');

const REMOTE_SVG = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 12 12"><rect width="12" height="12" fill="#2563eb"/></svg>';

function buildRemoteResponse(state) {
  return {
    storageMode: state.storageMode,
    storage: state.storageMode,
    persistent: true,
    limitation: '',
    categories: state.categories.map((category) => ({
      ...category,
      figureSlugs: category.figureSlugs ? category.figureSlugs.slice() : undefined
    })),
    entries: state.entries.map((entry) => ({ ...entry }))
  };
}

test.describe('figurbibliotek – fjernlagring', () => {
  test('reflekterer oppdatert navn fra backend uten lokale fallbacks', async ({ page }) => {
    const remoteState = {
      storageMode: 'kv',
      categories: [
        {
          id: 'remote-kategori',
          label: 'Fjernkategori',
          apps: ['bibliotek'],
          figureSlugs: ['remote/test-figur']
        }
      ],
      entries: [
        {
          id: 'remote-figur',
          slug: 'remote/test-figur',
          title: 'Ekstern figur',
          name: 'Ekstern figur',
          summary: 'Leveres av backend',
          categoryId: 'remote-kategori',
          categoryName: 'Fjernkategori',
          category: { id: 'remote-kategori', label: 'Fjernkategori', apps: ['bibliotek'] },
          urls: { svg: `data:image/svg+xml;charset=utf-8,${encodeURIComponent(REMOTE_SVG)}` },
          files: { svg: { url: `data:image/svg+xml;charset=utf-8,${encodeURIComponent(REMOTE_SVG)}` } },
          tool: 'bibliotek-upload'
        }
      ]
    };

    const patchPayloads = [];

    await page.addInitScript(() => {
      try {
        window.localStorage?.clear();
        window.sessionStorage?.clear();
      } catch (error) {}
    });

    await page.route('**/api/figure-library**', async (route) => {
      const request = route.request();
      const method = request.method();

      if (method === 'GET') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(buildRemoteResponse(remoteState))
        });
        return;
      }

      if (method === 'PATCH') {
        const payload = request.postDataJSON() || {};
        patchPayloads.push(payload);
        const entry = remoteState.entries.find((item) => item.slug === payload.slug);
        if (entry) {
          if (typeof payload.title === 'string' && payload.title.trim()) {
            entry.title = payload.title.trim();
            entry.name = payload.title.trim();
          }
          if (payload.summary) {
            entry.summary = payload.summary;
          }
        }
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            storageMode: remoteState.storageMode,
            persistent: true,
            entry,
            categories: remoteState.categories
          })
        });
        return;
      }

      await route.continue();
    });

    const response = await page.goto('/bibliotek.html', { waitUntil: 'networkidle' });
    expect(response?.ok()).toBeTruthy();

    const categoryButton = page
      .locator('[data-category-grid] .categoryItem')
      .filter({ has: page.locator('h3', { hasText: 'Fjernkategori' }) });
    await expect(categoryButton.locator('.categoryCount')).toHaveText('1 figur');
    await categoryButton.locator('button.categoryButton').click();

    const categoryDialog = page.locator('[data-category-dialog]');
    await expect(categoryDialog).toBeVisible();

    const remoteFigureItem = categoryDialog.locator('[data-category-figures] .bibliotekItem').first();
    await expect(remoteFigureItem.locator('h2')).toHaveText('Ekstern figur');

    const editorDialog = page.locator('dialog[data-custom-editor]');

    const patchRequestPromise = page.waitForRequest((request) => {
      if (!request.url().includes('/api/figure-library')) return false;
      if (request.method() !== 'PATCH') return false;
      const payload = request.postDataJSON();
      return payload && payload.slug === 'remote/test-figur';
    });

    const patchResponsePromise = page.waitForResponse((response) => {
      if (!response.url().includes('/api/figure-library')) return false;
      if (response.request().method() !== 'PATCH') return false;
      const payload = response.request().postDataJSON();
      return payload && payload.slug === 'remote/test-figur';
    });

    await remoteFigureItem.getByRole('button', { name: 'Rediger' }).click();
    await expect(editorDialog).toBeVisible();
    await editorDialog.locator('[data-editor-name]').fill('Oppdatert fjernfigur');

    const [patchRequest, patchResponse] = await Promise.all([
      patchRequestPromise,
      patchResponsePromise,
      editorDialog.getByRole('button', { name: 'Lagre endringer' }).click()
    ]);

    await expect(editorDialog).toBeHidden();
    expect(patchResponse.ok()).toBeTruthy();

    const requestPayload = patchRequest.postDataJSON();
    expect(requestPayload.slug).toBe('remote/test-figur');
    expect(requestPayload.title).toBe('Oppdatert fjernfigur');
    expect(patchPayloads).toHaveLength(1);

    const patchBody = await patchResponse.json();
    expect(patchBody.entry?.title || patchBody.entry?.name).toBe('Oppdatert fjernfigur');

    await expect(remoteFigureItem.locator('h2')).toHaveText('Oppdatert fjernfigur');

    const storedEntries = await page.evaluate(() => {
      try {
        return window.localStorage.getItem('mathvis:figureLibrary:customEntries:v1');
      } catch (error) {
        return 'error';
      }
    });
    expect(storedEntries === null).toBeTruthy();

    await page.unroute('**/api/figure-library**');
  });
});
