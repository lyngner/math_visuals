const { test, expect } = require('@playwright/test');

const {
  attachExamplesBackendMock,
  normalizeExamplePath
} = require('./helpers/examples-backend-mock');

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
    backend.seed(LEGACY_DECODED_PATH, payload);

    const putPromise = backend.waitForPut(CANONICAL_PATH);
    const deletePromise = backend.waitForDelete(LEGACY_DECODED_PATH);

    await page.goto(PAGE_PATH);

    const putResult = await putPromise;
    const deleteResult = await deletePromise;

    expect(putResult.path).toBe(CANONICAL_PATH);
    expect(deleteResult.path).toBe(normalizeExamplePath(LEGACY_DECODED_PATH));

    const canonicalEntry = await backend.read(CANONICAL_PATH);
    expect(canonicalEntry).toBeTruthy();
    expect(Array.isArray(canonicalEntry.examples)).toBe(true);
    expect(canonicalEntry.examples[0]).toMatchObject({
      __builtinKey: 'legacy-one',
      description
    });
    expect(canonicalEntry.deletedProvided).toEqual(['provided-decoded']);

    const legacyEntry = await backend.read(LEGACY_DECODED_PATH);
    expect(legacyEntry).toBeUndefined();

    await expect(page.locator('#exampleDescription')).toHaveValue(description);
  });

  test('migrates lowercase percent-encoded keys', async ({ page }) => {
    const description = 'Legacy lower-case percent';
    backend.seed(LEGACY_LOWERCASE_PATH, legacyPayload(description));

    const putPromise = backend.waitForPut(CANONICAL_PATH);
    const deletePromise = backend.waitForDelete(LEGACY_LOWERCASE_PATH);

    await page.goto(PAGE_PATH);

    await putPromise;
    await deletePromise;

    const canonicalEntry = await backend.read(CANONICAL_PATH);
    expect(canonicalEntry).toBeTruthy();
    expect(Array.isArray(canonicalEntry.examples)).toBe(true);
    expect(canonicalEntry.examples[0]).toMatchObject({ description });

    const legacyEntry = await backend.read(LEGACY_LOWERCASE_PATH);
    expect(legacyEntry).toBeUndefined();
  });

  test('loads Graftegner examples saved under uppercase path casing', async ({ page }) => {
    const description = 'Graftegner stor bokstav';
    backend.seed(GRAFTEGNER_LEGACY_PATH, legacyPayload(description));

    const putPromise = backend.waitForPut(GRAFTEGNER_CANONICAL_PATH);
    const deletePromise = backend.waitForDelete(GRAFTEGNER_LEGACY_PATH);

    await page.goto(GRAFTEGNER_PAGE);

    await putPromise;
    await deletePromise;

    const canonicalEntry = await backend.read(GRAFTEGNER_CANONICAL_PATH);
    expect(canonicalEntry).toBeTruthy();
    expect(Array.isArray(canonicalEntry.examples)).toBe(true);
    expect(canonicalEntry.examples[0]).toMatchObject({ description });

    const legacyEntry = await backend.read(GRAFTEGNER_LEGACY_PATH);
    expect(legacyEntry).toBeUndefined();

    await expect(page.locator('#exampleDescription')).toHaveValue(description);
  });
});
