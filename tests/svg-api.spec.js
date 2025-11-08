const { test, expect } = require('@playwright/test');

const TEST_SVG_MARKUP =
  '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24"><rect width="24" height="24" fill="#1d4ed8" /></svg>';

const originalKvUrl = process.env.KV_REST_API_URL;
const originalKvToken = process.env.KV_REST_API_TOKEN;

const {
  invokeSvgApi,
  clearSvgMemoryStore
} = require('./helpers/svg-api-utils');
const {
  setSvg
} = require('../api/_lib/svg-store');
const {
  setFigureAsset,
  deleteFigureAsset
} = require('../api/_lib/figure-asset-store');
const {
  FIGURE_LIBRARY_UPLOAD_TOOL_ID
} = require('../api/_lib/figure-library-store');

function restoreKvEnv() {
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
}

function disableKvEnv() {
  delete process.env.KV_REST_API_URL;
  delete process.env.KV_REST_API_TOKEN;
}

test.describe('SVG API archive filtering', () => {
  test.beforeEach(() => {
    disableKvEnv();
    clearSvgMemoryStore();
  });

  test.afterEach(async () => {
    clearSvgMemoryStore();
    await deleteFigureAsset('archive/library');
  });

  test.afterAll(() => {
    clearSvgMemoryStore();
    restoreKvEnv();
  });

  test('excludes figure library uploads from list responses', async () => {
    const regular = await setSvg('Archive/Regular.svg', {
      title: 'Regulær eksport',
      tool: 'graftegner',
      summary: 'Vanlig eksport fra verktøy',
      svg: TEST_SVG_MARKUP
    });
    const library = await setFigureAsset('Archive/Library.svg', {
      title: 'Bibliotekopplasting',
      tool: FIGURE_LIBRARY_UPLOAD_TOOL_ID,
      summary: 'Skal ikke dukke opp i arkivet',
      svg: TEST_SVG_MARKUP
    });
    const toolIdMatch = await setSvg('Archive/ToolIdMatch.svg', {
      title: 'ToolId filtrering',
      tool: 'graftegner',
      toolId: `  ${FIGURE_LIBRARY_UPLOAD_TOOL_ID}  `,
      summary: 'Skal filtreres bort pga. toolId',
      svg: TEST_SVG_MARKUP
    });

    expect(regular).not.toBeNull();
    expect(library).not.toBeNull();
    expect(toolIdMatch).not.toBeNull();

    const response = await invokeSvgApi();

    expect(response.statusCode).toBe(200);
    expect(response.json).toBeTruthy();
    expect(Array.isArray(response.json.entries)).toBe(true);

    const entries = response.json.entries;
    const entrySlugs = entries.map(entry => entry.slug);

    expect(entrySlugs).toContain(regular.slug);
    expect(entrySlugs).not.toContain(library.slug);
    expect(entrySlugs).not.toContain(toolIdMatch.slug);
    expect(entries.every(entry => entry.tool !== FIGURE_LIBRARY_UPLOAD_TOOL_ID)).toBe(true);
    expect(entries.every(entry => (entry.toolId || '').trim() !== FIGURE_LIBRARY_UPLOAD_TOOL_ID)).toBe(true);
  });

  test('does not expose library uploads via svg API slug lookup', async () => {
    const stored = await setFigureAsset('Archive/Library.svg', {
      title: 'Bibliotekopplasting',
      tool: FIGURE_LIBRARY_UPLOAD_TOOL_ID,
      summary: 'Tilgjengelig via slug',
      svg: TEST_SVG_MARKUP
    });

    expect(stored).not.toBeNull();

    const response = await invokeSvgApi({ url: '/api/svg?slug=archive/library.svg' });

    expect(response.statusCode).toBe(404);
  });
});
