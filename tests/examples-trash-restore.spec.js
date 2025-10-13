const { test, expect } = require('@playwright/test');

const {
  attachExamplesBackendMock,
  normalizeExamplePath
} = require('./helpers/examples-backend-mock');

const EXAMPLE_PATH = '/diagram/index.html';
const CANONICAL_PATH = normalizeExamplePath(EXAMPLE_PATH);

const TRASH_HEADERS = {
  'Content-Type': 'application/json',
  'X-Examples-Store-Mode': 'memory'
};

function clone(value) {
  try {
    return JSON.parse(JSON.stringify(value));
  } catch (error) {
    return value;
  }
}

test.describe('Examples trash restore flow', () => {
  let backend;
  let trashEntries;
  let trashRouteHandler;

  test.beforeEach(async ({ page }) => {
    backend = await attachExamplesBackendMock(page.context());
    try {
      await backend.client.delete(CANONICAL_PATH);
    } catch (error) {}
    trashEntries = [];
    trashRouteHandler = async route => {
      const request = route.request();
      const method = request.method();
      if (method === 'GET') {
        const body = {
          storage: 'memory',
          mode: 'memory',
          storageMode: 'memory',
          persistent: false,
          ephemeral: true,
          entries: trashEntries.map(entry => ({
            ...clone(entry),
            sourceActive: false,
            sourceArchived: true
          }))
        };
        await route.fulfill({ status: 200, headers: TRASH_HEADERS, body: JSON.stringify(body) });
        return;
      }
      if (method === 'POST') {
        let payload = {};
        try {
          payload = request.postDataJSON();
        } catch (error) {}
        const entries = Array.isArray(payload.entries) ? payload.entries : [];
        const limit = Number.isInteger(payload.limit) ? payload.limit : undefined;
        if (payload.replace === true) {
          trashEntries = [];
        }
        if (entries.length) {
          const mapped = entries.map(entry => clone(entry));
          if (payload.replace === true) {
            trashEntries = mapped;
          } else if (payload.mode === 'append') {
            trashEntries = trashEntries.concat(mapped);
          } else {
            trashEntries = mapped.concat(trashEntries);
          }
        }
        if (limit && trashEntries.length > limit) {
          trashEntries = trashEntries.slice(0, limit);
        }
        const body = {
          storage: 'memory',
          mode: 'memory',
          storageMode: 'memory',
          persistent: false,
          ephemeral: true,
          entries: trashEntries.map(entry => ({
            ...clone(entry),
            sourceActive: false,
            sourceArchived: true
          }))
        };
        await route.fulfill({ status: 200, headers: TRASH_HEADERS, body: JSON.stringify(body) });
        return;
      }
      if (method === 'DELETE') {
        let payload = {};
        try {
          payload = request.postDataJSON();
        } catch (error) {}
        const ids = Array.isArray(payload.ids) ? payload.ids : [];
        const removed = [];
        if (ids.length) {
          trashEntries = trashEntries.filter(entry => {
            if (entry && ids.includes(entry.id)) {
              removed.push(entry.id);
              return false;
            }
            return true;
          });
        }
        const body = {
          storage: 'memory',
          mode: 'memory',
          storageMode: 'memory',
          persistent: false,
          ephemeral: true,
          removed,
          entries: trashEntries.map(entry => ({
            ...clone(entry),
            sourceActive: false,
            sourceArchived: true
          }))
        };
        await route.fulfill({ status: 200, headers: TRASH_HEADERS, body: JSON.stringify(body) });
        return;
      }
      await route.fulfill({
        status: 405,
        headers: TRASH_HEADERS,
        body: JSON.stringify({ error: 'Method Not Allowed', method })
      });
    };
    await page.context().route('**/api/examples/trash', trashRouteHandler);
    await page.goto(EXAMPLE_PATH, { waitUntil: 'load' });
  });

  test.afterEach(async ({ page }) => {
    if (trashRouteHandler) {
      try {
        await page.context().unroute('**/api/examples/trash', trashRouteHandler);
      } catch (error) {}
      trashRouteHandler = null;
    }
    if (backend) {
      await backend.dispose();
      backend = null;
    }
  });

  test('archives and restores an example via the archive page', async ({ page }) => {
    const description = page.locator('#exampleDescription');
    await description.fill('Eksempel for gjenoppretting');

    const initialSave = page.waitForRequest(
      request => request.url().includes('/api/examples') && request.method() === 'PUT'
    );
    await page.locator('#btnSaveExample').click();
    await initialSave;

    const deleteRequest = page.waitForRequest(
      request => request.url().includes('/api/examples') && request.method() === 'PUT'
    );
    const trashPost = page.waitForRequest(
      request => request.url().includes('/api/examples/trash') && request.method() === 'POST'
    );
    await page.locator('#btnDeleteExample').click();
    await Promise.all([deleteRequest, trashPost]);

    await expect(page.locator('.example-tabs-empty')).toBeVisible();
    await expect(page.locator('#btnRestoreExample')).toHaveCount(0);

    const archivePage = await page.context().newPage();
    const trashLoad = archivePage.waitForRequest(
      request => request.url().includes('/api/examples/trash') && request.method() === 'GET'
    );
    await archivePage.goto('/examples-trash.html', { waitUntil: 'load' });
    await trashLoad;

    await expect(archivePage.locator('[data-group]')).toHaveCount(1);

    const restorePut = archivePage.waitForRequest(
      request => request.url().includes('/api/examples') && request.method() === 'PUT'
    );
    const trashDelete = archivePage.waitForRequest(
      request => request.url().includes('/api/examples/trash') && request.method() === 'DELETE'
    );
    await archivePage.locator('button[data-action="restore"]').first().click();
    await Promise.all([restorePut, trashDelete]);

    await expect(archivePage.locator('.trash-empty')).toBeVisible();
    await archivePage.close();

    const reloadExamples = page.waitForRequest(
      request => request.url().includes('/api/examples') && request.method() === 'GET'
    );
    await page.reload({ waitUntil: 'load' });
    await reloadExamples;

    await expect(page.locator('#exampleTabs .example-tab')).toHaveCount(1);
    await expect(page.locator('#exampleDescription')).toHaveValue('Eksempel for gjenoppretting');
  });
});
