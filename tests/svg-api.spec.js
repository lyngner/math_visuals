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

    const memoryStore = global.__SVG_MEMORY_STORE__;
    const toolIdKey = `svg:${toolIdMatch.slug}`;
    const storedToolIdEntry = memoryStore && memoryStore.get ? memoryStore.get(toolIdKey) : null;
    if (storedToolIdEntry) {
      storedToolIdEntry.toolId = `  ${FIGURE_LIBRARY_UPLOAD_TOOL_ID}  `;
      memoryStore.set(toolIdKey, storedToolIdEntry);
    }

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

  test('updates display title and filenames via PATCH', async () => {
    const stored = await setSvg('Archive/RenameTarget.svg', {
      title: 'Opprinnelig navn',
      tool: 'graftegner',
      summary: 'Navn skal oppdateres',
      svg: TEST_SVG_MARKUP
    });

    expect(stored).not.toBeNull();

    const response = await invokeSvgApi({
      method: 'PATCH',
      url: '/api/svg',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        slug: stored.slug,
        title: 'Nytt navn',
        displayTitle: 'Nytt navn',
        baseName: 'Nytt navn 2024!.svg'
      })
    });

    expect(response.statusCode).toBe(200);
    expect(response.json).toBeTruthy();

    const payload = response.json;
    expect(payload.slug).toBe(stored.slug);
    expect(payload.displayTitle).toBe('Nytt navn');
    expect(payload.title).toBe('Nytt navn');
    expect(payload.baseName).toBe('Nytt-navn-2024');
    expect(payload.filename).toBe('Nytt-navn-2024.svg');
    expect(payload.svgFilename).toBe('Nytt-navn-2024.svg');
    if (payload.files && payload.files.svg) {
      expect(payload.files.svg.filename).toBe('Nytt-navn-2024.svg');
    }
    if (payload.files && payload.files.png) {
      expect(payload.files.png.filename).toBe('Nytt-navn-2024.png');
    }
    expect(payload.name).toBe('Nytt navn');
  });

  test('rejects invalid baseName updates', async () => {
    const stored = await setSvg('Archive/InvalidRename.svg', {
      title: 'Gyldig navn',
      tool: 'graftegner',
      summary: 'Forsøk på ugyldig navn',
      svg: TEST_SVG_MARKUP
    });

    expect(stored).not.toBeNull();

    const response = await invokeSvgApi({
      method: 'PATCH',
      url: '/api/svg',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        slug: stored.slug,
        displayTitle: 'Oppdatert navn',
        baseName: '!!!'
      })
    });

    expect(response.statusCode).toBe(400);
    expect(response.json).toBeTruthy();
    expect(response.json.error).toMatch(/baseName/);
  });

  test('rejects non-string title or displayTitle updates', async () => {
    const stored = await setSvg('Archive/InvalidTitle.svg', {
      title: 'Gyldig navn',
      tool: 'graftegner',
      summary: 'Forsøk på ugyldig felttype',
      svg: TEST_SVG_MARKUP
    });

    expect(stored).not.toBeNull();

    const invalidTitleResponse = await invokeSvgApi({
      method: 'PATCH',
      url: '/api/svg',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        slug: stored.slug,
        title: 12345
      })
    });

    expect(invalidTitleResponse.statusCode).toBe(400);
    expect(invalidTitleResponse.json).toBeTruthy();
    expect(invalidTitleResponse.json.error).toMatch(/Title must be a string value/i);

    const invalidDisplayResponse = await invokeSvgApi({
      method: 'PATCH',
      url: '/api/svg',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        slug: stored.slug,
        displayTitle: { label: 'nope' }
      })
    });

    expect(invalidDisplayResponse.statusCode).toBe(400);
    expect(invalidDisplayResponse.json).toBeTruthy();
    expect(invalidDisplayResponse.json.error).toMatch(/displayTitle must be a string value/i);
  });
});
