const { test, expect } = require('@playwright/test');

const PAGE_PATH = '/brøkfigurer.html';
const CANONICAL_PATH = '/br%C3%B8kfigurer';
const LEGACY_PRIMARY_PATH = '/brøkfigurer.html';
const LEGACY_VARIANTS = [
  LEGACY_PRIMARY_PATH,
  '/br%C3%B8kfigurer.html',
  '/brøkfigurer/index.html',
  '/br%C3%B8kfigurer/index.html',
  '/brøkfigurer/index.htm',
  '/br%C3%B8kfigurer/index.htm',
  '/brøkfigurer',
  '/br%C3%B8kfigurer/',
  '/brøkfigurer/',
  '/brøkfigurer.htm',
  '/br%C3%B8kfigurer.htm'
];

function buildLegacyResponse() {
  return {
    path: LEGACY_PRIMARY_PATH,
    examples: [
      {
        description: 'Backend legacy eksempel',
        exampleNumber: 'Legacy',
        isDefault: true,
        config: { STATE: { migrated: true } }
      }
    ],
    deletedProvided: ['legacy-backend-provided'],
    updatedAt: new Date().toISOString()
  };
}

test.describe('examples backend migration', () => {
  test('migrates legacy backend entries to the canonical path', async ({ page }) => {
    const canonicalKey = 'examples_/br%C3%B8kfigurer';
    const deletedKey = `${canonicalKey}_deletedProvidedExamples`;
    const recorded = {
      canonicalGets: 0,
      legacyGets: [],
      canonicalPut: null,
      legacyDeletes: []
    };
    let canonicalResponse = null;

    await page.route('**/api/examples**', async route => {
      const request = route.request();
      const method = request.method();
      const url = new URL(request.url());
      const path = url.searchParams.get('path');
      const headers = { 'Content-Type': 'application/json' };

      if (method === 'GET') {
        if (path === CANONICAL_PATH) {
          recorded.canonicalGets += 1;
          if (canonicalResponse) {
            await route.fulfill({ status: 200, headers, body: JSON.stringify(canonicalResponse) });
          } else {
            await route.fulfill({ status: 404, headers, body: JSON.stringify({ error: 'Not Found' }) });
          }
          return;
        }
        if (path === LEGACY_PRIMARY_PATH) {
          recorded.legacyGets.push(path);
          await route.fulfill({ status: 200, headers, body: JSON.stringify(buildLegacyResponse()) });
          return;
        }
        if (LEGACY_VARIANTS.includes(path)) {
          recorded.legacyGets.push(path);
          await route.fulfill({ status: 404, headers, body: JSON.stringify({ error: 'Not Found' }) });
          return;
        }
      }

      if (method === 'PUT' && path === CANONICAL_PATH) {
        const payload = JSON.parse(request.postData() || '{}');
        recorded.canonicalPut = payload;
        canonicalResponse = {
          path: CANONICAL_PATH,
          examples: Array.isArray(payload.examples) ? payload.examples : [],
          deletedProvided: Array.isArray(payload.deletedProvided) ? payload.deletedProvided : [],
          updatedAt: payload.updatedAt || new Date().toISOString(),
          storage: 'memory'
        };
        await route.fulfill({ status: 200, headers, body: JSON.stringify(canonicalResponse) });
        return;
      }

      if (method === 'DELETE' && LEGACY_VARIANTS.includes(path)) {
        recorded.legacyDeletes.push(path);
        await route.fulfill({ status: 200, headers, body: JSON.stringify({ ok: true }) });
        return;
      }

      await route.fulfill({
        status: 404,
        headers,
        body: JSON.stringify({ error: 'Unhandled request', method, path })
      });
    });

    await page.addInitScript(() => {
      window.MATH_VISUALS_EXAMPLES_API_URL = '/api/examples';
    });

    await page.goto(PAGE_PATH);

    await page.waitForFunction(key => {
      try {
        const value = window.localStorage.getItem(key);
        if (!value) return false;
        const parsed = JSON.parse(value);
        return Array.isArray(parsed) && parsed.length > 0;
      } catch (error) {
        return false;
      }
    }, canonicalKey);

    const storedExamples = await page.evaluate(key => JSON.parse(window.localStorage.getItem(key)), canonicalKey);
    expect(storedExamples[0]).toMatchObject({ description: 'Backend legacy eksempel' });

    const storedDeleted = await page.evaluate(key => JSON.parse(window.localStorage.getItem(key)), deletedKey);
    expect(storedDeleted).toEqual(['legacy-backend-provided']);

    await expect(page.locator('#exampleDescription')).toHaveValue('Backend legacy eksempel');

    expect(recorded.canonicalGets).toBeGreaterThan(0);
    expect(recorded.legacyGets).toContain(LEGACY_PRIMARY_PATH);
    expect(recorded.canonicalPut).not.toBeNull();
    expect(recorded.canonicalPut.path).toBe(CANONICAL_PATH);
    expect(recorded.canonicalPut.examples[0]).toMatchObject({ description: 'Backend legacy eksempel' });
    expect(recorded.canonicalPut.deletedProvided).toEqual(['legacy-backend-provided']);
    expect(recorded.legacyDeletes).toContain(LEGACY_PRIMARY_PATH);
    expect(recorded.legacyDeletes).toEqual(
      expect.arrayContaining(['/br%C3%B8kfigurer.html', '/brøkfigurer/index.html'])
    );
  });
});
