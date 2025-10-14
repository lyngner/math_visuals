const { test, expect } = require('@playwright/test');

const {
  attachExamplesBackendMock,
  normalizeExamplePath
} = require('./helpers/examples-backend-mock');

const EXAMPLE_PATH = '/diagram/index.html';
const CANONICAL_PATH = normalizeExamplePath(EXAMPLE_PATH);
const TRASH_ARCHIVE_PATH = '/examples-trash.html';

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

function withDefaultSourceState(entry) {
  const copy = clone(entry);
  if (!Object.prototype.hasOwnProperty.call(copy, 'sourceActive')) {
    copy.sourceActive = false;
  }
  if (!Object.prototype.hasOwnProperty.call(copy, 'sourceArchived')) {
    copy.sourceArchived = true;
  }
  return copy;
}

async function drainPendingPutEvents(backend, path) {
  if (!backend || typeof backend.waitForPut !== 'function') return;
  const drainMessage = 'drain pending put events';
  while (true) {
    try {
      await backend.waitForPut(path, { timeout: 200, timeoutMessage: drainMessage });
    } catch (error) {
      if (error && typeof error.message === 'string' && error.message.includes(drainMessage)) {
        break;
      }
      throw error;
    }
  }
}

async function archiveExample(page, descriptionText = 'Eksempel for gjenoppretting') {
  const description = page.locator('#exampleDescription');
  await description.fill(descriptionText);

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
}

async function openTrashArchivePage(context) {
  const archivePage = await context.newPage();
  await archivePage.goto(TRASH_ARCHIVE_PATH, { waitUntil: 'domcontentloaded' });
  await expect(
    archivePage.getByRole('heading', { name: 'Arkiv for arkiverte (slettede) eksempler' })
  ).toBeVisible();
  return archivePage;
}

test.describe('Examples trash guidance', () => {
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
          entries: trashEntries.map(entry => withDefaultSourceState(entry))
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
          entries: trashEntries.map(entry => withDefaultSourceState(entry))
        };
        await route.fulfill({ status: 200, headers: TRASH_HEADERS, body: JSON.stringify(body) });
        return;
      }
      if (method === 'DELETE') {
        const requestUrl = new URL(request.url());
        const entryIdParam = requestUrl.searchParams.get('entryId');
        const ids = [];
        if (entryIdParam && entryIdParam.trim()) {
          ids.push(entryIdParam.trim());
        } else {
          let payload = {};
          try {
            payload = request.postDataJSON();
          } catch (error) {}
          if (Array.isArray(payload.ids)) {
            payload.ids.forEach(value => {
              if (typeof value === 'string' && value.trim()) {
                ids.push(value.trim());
              }
            });
          }
        }
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
          entryId: ids.length === 1 ? ids[0] : null,
          entries: trashEntries.map(entry => withDefaultSourceState(entry))
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
    await page.context().route('**/api/examples/trash**', trashRouteHandler);
    await page.goto(EXAMPLE_PATH, { waitUntil: 'load' });
  });

  test.afterEach(async ({ page }) => {
    if (trashRouteHandler) {
      try {
      await page.context().unroute('**/api/examples/trash**', trashRouteHandler);
      } catch (error) {}
      trashRouteHandler = null;
    }
    if (backend) {
      await backend.dispose();
      backend = null;
    }
  });

  test('deleting an example posts to trash and shows guidance message', async ({ page }) => {
    await archiveExample(page);

    await expect(page.locator('.example-save-status__text')).toContainText(
      'Slettede eksempler kan gjenopprettes via examples-trash.html.'
    );

    expect(trashEntries.length).toBe(1);
    const [entry] = trashEntries;
    expect(entry).toBeDefined();
    expect((entry.example && entry.example.description) || '').toContain(
      'Eksempel for gjenoppretting'
    );
  });

  test('restoring an archived example reinserts it via the backend', async ({ page }) => {
    const description = 'Arkivtest – gjenoppretting';
    await archiveExample(page, description);

    await drainPendingPutEvents(backend, CANONICAL_PATH);

    const archivePage = await openTrashArchivePage(page.context());
    const item = archivePage
      .locator('[data-item]')
      .filter({ hasText: description });
    await expect(item).toHaveCount(1);

    const restoreButton = item.getByRole('button', { name: 'Gjenopprett' });
    const deleteRequest = archivePage.waitForRequest(
      request => request.url().includes('/api/examples/trash') && request.method() === 'DELETE'
    );
    const refreshRequest = archivePage.waitForRequest(
      request => request.url().includes('/api/examples/trash') && request.method() === 'GET'
    );

    await restoreButton.click();

    await Promise.all([deleteRequest, refreshRequest]);

    const matchesDescription = example => {
      const text = typeof example.description === 'string' ? example.description : '';
      return text.includes(description);
    };

    await expect(archivePage.getByText('Eksempel gjenopprettet fra arkivet.')).toBeVisible();
    await expect(archivePage.locator('[data-item]')).toHaveCount(0);

    expect(trashEntries.length).toBe(0);
    await expect.poll(() => {
      const store = backend && backend.store && backend.store.canonical;
      if (!store || typeof store.get !== 'function') return false;
      const entry = store.get(CANONICAL_PATH);
      if (!entry || !entry.data || !Array.isArray(entry.data.examples)) return false;
      return entry.data.examples.some(matchesDescription);
    }).toBe(true);
  });

  test('permanently deleting an archived example removes it from the archive', async ({ page }) => {
    const description = 'Arkivtest – sletting';
    await archiveExample(page, description);

    await backend.waitForPut(CANONICAL_PATH);

    const archivePage = await openTrashArchivePage(page.context());
    const item = archivePage
      .locator('[data-item]')
      .filter({ hasText: description });
    await expect(item).toHaveCount(1);

    const deleteButton = item.getByRole('button', { name: 'Slett' });
    await archivePage.evaluate(() => {
      window.confirm = () => true;
    });
    const deleteRequest = archivePage.waitForRequest(
      request => request.url().includes('/api/examples/trash') && request.method() === 'DELETE'
    );
    const refreshRequest = archivePage.waitForRequest(
      request => request.url().includes('/api/examples/trash') && request.method() === 'GET'
    );

    await deleteButton.click();

    await Promise.all([deleteRequest, refreshRequest]);

    await expect(archivePage.locator('[data-item]')).toHaveCount(0);
    await expect(
      archivePage.getByText('Det finnes foreløpig ingen slettede eller arkiverte eksempler å gjenopprette.', {
        exact: true
      })
    ).toBeVisible();
    expect(trashEntries.length).toBe(0);
  });

  test('archived examples remain visible even if the source path still has active examples', async ({ page }) => {
    const description = 'Arkivtest – aktiv kilde';
    await archiveExample(page, description);

    await backend.waitForPut(CANONICAL_PATH);

    trashEntries = trashEntries.map(entry => ({
      ...entry,
      sourceActive: true,
      sourceArchived: false
    }));

    const archivePage = await openTrashArchivePage(page.context());
    const item = archivePage
      .locator('[data-item]')
      .filter({ hasText: description });
    await expect(item).toHaveCount(1);

    await archivePage.close();
  });
});
