const { test, expect } = require('@playwright/test');

const {
  attachExamplesBackendMock,
  normalizeExamplePath
} = require('./helpers/examples-backend-mock');
const { openTaskDescriptionEditor } = require('./helpers/description-editor');

const PAGE_PATH = '/brøkfigurer.html';
const CANONICAL_PATH = normalizeExamplePath(PAGE_PATH);
const LEGACY_DECODED_PATH = '/brøkfigurer.html';
const LEGACY_LOWERCASE_PATH = '/br%c3%b8kfigurer.html';
const GRAFTEGNER_PAGE = '/graftegner.html';
const GRAFTEGNER_CANONICAL_PATH = normalizeExamplePath(GRAFTEGNER_PAGE);
const GRAFTEGNER_LEGACY_PATH = '/Graftegner';

function legacyPayload(description, options = {}) {
  return {
    examples: [
      {
        __builtinKey: 'legacy-one',
        isDefault: true,
        description,
        config: {
          STATE: { fromLegacy: true }
        }
      },
      {
        description: `${description} – andre`,
        config: {
          STATE: { fromLegacy: 'two' }
        }
      }
    ],
    deletedProvided: Array.isArray(options.deletedProvided) ? options.deletedProvided : [],
    provided: Array.isArray(options.provided) ? options.provided : []
  };
}

test.describe('legacy example storage keys', () => {
  let backend;

  test.beforeEach(async ({ page }) => {
    backend = await attachExamplesBackendMock(page.context());
  });

  test('migrates decoded path storage keys', async ({ page }) => {
    const description = 'Legacy example description';
    const payload = legacyPayload(description, { deletedProvided: ['provided-decoded'] });
    await backend.client.put(LEGACY_DECODED_PATH, payload);

    const putPromise = backend.waitForPut(CANONICAL_PATH, {
      description: 'migrate decoded legacy key'
    });
    const deletePromise = backend.waitForDelete(LEGACY_DECODED_PATH, {
      description: 'delete decoded legacy key'
    });

    await page.goto(PAGE_PATH);

    const putResult = await putPromise;
    const deleteResult = await deletePromise;

    expect(putResult.path).toBe(CANONICAL_PATH);
    expect(deleteResult.path).toBe(normalizeExamplePath(LEGACY_DECODED_PATH));

    const canonicalEntry = await backend.client.get(CANONICAL_PATH);
    expect(canonicalEntry).toBeTruthy();
    expect(Array.isArray(canonicalEntry.examples)).toBe(true);
    expect(canonicalEntry.examples[0]).toMatchObject({
      __builtinKey: 'legacy-one',
      description
    });
    expect(canonicalEntry.deletedProvided).toEqual(['provided-decoded']);

    const legacyEntry = await backend.client.get(LEGACY_DECODED_PATH);
    expect(legacyEntry).toBeUndefined();

    await openTaskDescriptionEditor(page);
    await expect(page.locator('#exampleDescription')).toHaveValue(description);
  });

  test('migrates lowercase percent-encoded keys', async ({ page }) => {
    const description = 'Legacy lower-case percent';
    await backend.client.put(LEGACY_LOWERCASE_PATH, legacyPayload(description));

    const putPromise = backend.waitForPut(CANONICAL_PATH, {
      description: 'migrate lowercase legacy key'
    });
    const deletePromise = backend.waitForDelete(LEGACY_LOWERCASE_PATH, {
      description: 'delete lowercase legacy key'
    });

    await page.goto(PAGE_PATH);

    await putPromise;
    await deletePromise;

    const canonicalEntry = await backend.client.get(CANONICAL_PATH);
    expect(canonicalEntry).toBeTruthy();
    expect(Array.isArray(canonicalEntry.examples)).toBe(true);
    expect(canonicalEntry.examples[0]).toMatchObject({ description });

    const legacyEntry = await backend.client.get(LEGACY_LOWERCASE_PATH);
    expect(legacyEntry).toBeUndefined();
  });

  test('loads Graftegner examples saved under uppercase path casing', async ({ page }) => {
    const description = 'Graftegner stor bokstav';
    await backend.client.put(GRAFTEGNER_LEGACY_PATH, legacyPayload(description));

    const putPromise = backend.waitForPut(GRAFTEGNER_CANONICAL_PATH, {
      description: 'migrate Graftegner legacy key'
    });
    const deletePromise = backend.waitForDelete(GRAFTEGNER_LEGACY_PATH, {
      description: 'delete Graftegner legacy key'
    });

    await page.goto(GRAFTEGNER_PAGE);

    await putPromise;
    await deletePromise;

    const canonicalEntry = await backend.client.get(GRAFTEGNER_CANONICAL_PATH);
    expect(canonicalEntry).toBeTruthy();
    expect(Array.isArray(canonicalEntry.examples)).toBe(true);
    expect(canonicalEntry.examples[0]).toMatchObject({ description });

    const legacyEntry = await backend.client.get(GRAFTEGNER_LEGACY_PATH);
    expect(legacyEntry).toBeUndefined();

    await openTaskDescriptionEditor(page);
    await expect(page.locator('#exampleDescription')).toHaveValue(description);
  });
});
