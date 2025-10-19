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

test.describe('Examples trash guidance', () => {
  let backend;
  let trashEntries;
  let trashRouteHandler;
  let browserContext;

  test.beforeEach(async ({ page }) => {
    browserContext = page.context();
    backend = await attachExamplesBackendMock(browserContext);
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
          for (const id of ids) {
            const index = trashEntries.findIndex(entry => entry.id === id);
            if (index >= 0) {
              removed.push(trashEntries[index]);
              trashEntries.splice(index, 1);
            }
          }
        }
        const body = {
          storage: 'memory',
          mode: 'memory',
          storageMode: 'memory',
          persistent: false,
          ephemeral: true,
          entries: trashEntries.map(entry => withDefaultSourceState(entry)),
          removed: removed.map(entry => withDefaultSourceState(entry))
        };
        await route.fulfill({ status: 200, headers: TRASH_HEADERS, body: JSON.stringify(body) });
        return;
      }
      await route.fallback();
    };

    await browserContext.route('**/api/examples/trash**', trashRouteHandler);
    await page.goto(EXAMPLE_PATH);
  });

  test.afterEach(async () => {
    try {
      await browserContext?.unroute('**/api/examples/trash**', trashRouteHandler);
    } catch (error) {}
    try {
      await backend?.dispose();
    } catch (error) {}
    backend = null;
    trashEntries = [];
    trashRouteHandler = null;
    browserContext = null;
  });

  test('deleting an example posts to trash and shows guidance message', async ({ page }) => {
    await archiveExample(page);

    await expect(page.locator('.example-save-status__text')).toContainText(
      'Bruk «Vis slettede» i arkivet for å gjenopprette eksempler.'
    );

    expect(trashEntries.length).toBe(1);
    const [entry] = trashEntries;
    expect(entry).toBeDefined();
    expect((entry.example && entry.example.description) || '').toContain(
      'Eksempel for gjenoppretting'
    );
  });

  test('legacy trash page redirects users to the SVG archive', async ({ context }) => {
    const archivePage = await context.newPage();
    await archivePage.goto(TRASH_ARCHIVE_PATH, { waitUntil: 'domcontentloaded' });

    await expect(
      archivePage.getByRole('heading', { name: 'Arkiverte eksempler finner du nå i arkivet' })
    ).toBeVisible();
    const link = archivePage.getByRole('link', { name: 'Gå til arkivet' });
    await expect(link).toHaveAttribute('href', 'svg-arkiv.html#trash');

    await archivePage.close();
  });
});
