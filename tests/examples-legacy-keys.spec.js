const { test, expect } = require('@playwright/test');

const CANONICAL_PATH = '/br%C3%B8kfigurer.html';
const CANONICAL_KEY = `examples_${CANONICAL_PATH}`;
const LEGACY_DECODED_KEY = 'examples_/brøkfigurer.html';
const LEGACY_LOWERCASE_KEY = 'examples_/br%c3%b8kfigurer.html';

function legacyPayload(description) {
  return JSON.stringify([
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
  ]);
}

test.describe('legacy example storage keys', () => {
  test('migrates decoded path storage keys', async ({ page }) => {
    const payload = legacyPayload('Legacy example description');
    await page.addInitScript(([legacyKey, value, deletedKey, deletedValue]) => {
      window.localStorage.setItem(legacyKey, value);
      window.localStorage.setItem(deletedKey, deletedValue);
    }, [
      LEGACY_DECODED_KEY,
      payload,
      `${LEGACY_DECODED_KEY}_deletedProvidedExamples`,
      JSON.stringify(['provided-decoded'])
    ]);

    await page.goto(CANONICAL_PATH);
    await page.waitForFunction(key => {
      const value = window.localStorage.getItem(key);
      if (!value) return false;
      try {
        const parsed = JSON.parse(value);
        return Array.isArray(parsed) && parsed.length >= 2;
      } catch (error) {
        return false;
      }
    }, CANONICAL_KEY);

    const stored = await page.evaluate(key => JSON.parse(window.localStorage.getItem(key)), CANONICAL_KEY);
    expect(Array.isArray(stored)).toBeTruthy();
    expect(stored[0]).toMatchObject({
      __builtinKey: 'legacy-one',
      description: 'Legacy example description'
    });
    expect(stored.length).toBeGreaterThanOrEqual(2);

    const removedLegacy = await page.evaluate(key => window.localStorage.getItem(key), LEGACY_DECODED_KEY);
    expect(removedLegacy).toBeNull();

    const migratedDeleted = await page.evaluate(
      key => JSON.parse(window.localStorage.getItem(key)),
      `${CANONICAL_KEY}_deletedProvidedExamples`
    );
    expect(migratedDeleted).toEqual(['provided-decoded']);

    const removedDeletedLegacy = await page.evaluate(
      key => window.localStorage.getItem(key),
      `${LEGACY_DECODED_KEY}_deletedProvidedExamples`
    );
    expect(removedDeletedLegacy).toBeNull();

    await expect(page.locator('#exampleDescription')).toHaveValue('Legacy example description');
  });

  test('migrates lowercase percent-encoded keys', async ({ page }) => {
    const payload = legacyPayload('Legacy lower-case percent');
    await page.addInitScript(([legacyKey, value]) => {
      window.localStorage.setItem(legacyKey, value);
    }, [LEGACY_LOWERCASE_KEY, payload]);

    await page.goto(CANONICAL_PATH);
    await page.waitForFunction(key => !!window.localStorage.getItem(key), CANONICAL_KEY);

    const stored = await page.evaluate(key => JSON.parse(window.localStorage.getItem(key)), CANONICAL_KEY);
    expect(stored[0]).toMatchObject({
      description: 'Legacy lower-case percent'
    });

    const legacyValue = await page.evaluate(key => window.localStorage.getItem(key), LEGACY_LOWERCASE_KEY);
    expect(legacyValue).toBeNull();
  });
});
