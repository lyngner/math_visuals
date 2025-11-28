const { test, expect } = require('@playwright/test');

const {
  attachExamplesBackendMock,
  normalizeExamplePath
} = require('./helpers/examples-backend-mock');
const { openTaskDescriptionEditor } = require('./helpers/description-editor');

const PAGE_PATH = '/brøkfigurer.html';
const CANONICAL_PATH = normalizeExamplePath(PAGE_PATH);
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

function buildLegacyEntry() {
  return {
    examples: [
      {
        description: 'Backend legacy eksempel',
        exampleNumber: 'Legacy',
        isDefault: true,
        config: { STATE: { migrated: true } }
      }
    ],
    deletedProvided: ['legacy-backend-provided']
  };
}

test.describe('examples backend migration', () => {
  test('migrates legacy backend entries to the canonical path', async ({ page }) => {
    const backend = await attachExamplesBackendMock(page.context(), {
      [LEGACY_PRIMARY_PATH]: buildLegacyEntry()
    });

    const putPromise = backend.waitForPut(CANONICAL_PATH, {
      description: 'migrate legacy example to canonical path'
    });
    const primaryDeletePromise = backend.waitForDelete(LEGACY_PRIMARY_PATH, {
      description: 'remove legacy primary path entry'
    });

    await page.goto(PAGE_PATH);

    const canonicalPut = await putPromise;
    const primaryDelete = await primaryDeletePromise;

    expect(canonicalPut.path).toBe(CANONICAL_PATH);
    expect(Array.isArray(canonicalPut.payload.examples)).toBe(true);
    expect(canonicalPut.payload.examples[0]).toMatchObject({ description: 'Backend legacy eksempel' });
    expect(canonicalPut.payload.deletedProvided).toEqual(['legacy-backend-provided']);

    expect(primaryDelete.path).toBe(normalizeExamplePath(LEGACY_PRIMARY_PATH));

    const canonicalEntry = await backend.client.get(CANONICAL_PATH);
    expect(canonicalEntry).toBeTruthy();
    expect(Array.isArray(canonicalEntry.examples)).toBe(true);
    expect(canonicalEntry.examples[0]).toMatchObject({ description: 'Backend legacy eksempel' });
    expect(canonicalEntry.deletedProvided).toEqual(['legacy-backend-provided']);

    const legacyEntry = await backend.client.get(LEGACY_PRIMARY_PATH);
    expect(legacyEntry).toBeUndefined();

    await openTaskDescriptionEditor(page);
    await expect(page.locator('#exampleDescription')).toHaveValue('Backend legacy eksempel', { timeout: 15000 });

    const normalizedVariants = LEGACY_VARIANTS.map(value => normalizeExamplePath(value));
    const legacyDeletes = backend.history
      .filter(event => event.type === 'DELETE' && normalizedVariants.includes(event.path))
      .map(event => event.path);
    expect(legacyDeletes).toEqual(expect.arrayContaining([
      normalizeExamplePath(LEGACY_PRIMARY_PATH),
      normalizeExamplePath('/brøkfigurer/index.html')
    ]));

    const canonicalGets = backend.history.filter(event => event.type === 'GET' && event.path === CANONICAL_PATH);
    expect(canonicalGets.length).toBeGreaterThan(0);

    const legacyGets = backend.history.filter(event => event.type === 'GET' && normalizedVariants.includes(event.path));
    expect(legacyGets.length).toBeGreaterThan(0);
  });
});
