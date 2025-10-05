const { test, expect } = require('@playwright/test');

const CANONICAL_PATH = '/br%C3%B8kfigurer.html';

function computeCanonicalKey(pathname) {
  if (typeof pathname !== 'string') return 'examples_/';
  let path = pathname.trim();
  if (!path) path = '/';
  if (!path.startsWith('/')) path = `/${path}`;
  path = path.replace(/\\+/g, '/');
  path = path.replace(/\/+/g, '/');
  path = path.replace(/\/index\.html?$/i, '/');
  if (/\.html?$/i.test(path)) {
    path = path.replace(/\.html?$/i, '');
    if (!path) path = '/';
  }
  if (path.length > 1 && path.endsWith('/')) {
    path = path.slice(0, -1);
  }
  if (!path) path = '/';
  let decoded = path;
  try {
    decoded = decodeURI(path);
  } catch (error) {}
  if (typeof decoded === 'string') {
    decoded = decoded.toLowerCase();
  }
  let encoded = decoded;
  try {
    encoded = encodeURI(decoded);
  } catch (error) {
    encoded = path;
  }
  if (!encoded) encoded = '/';
  encoded = encoded.replace(/%[0-9a-f]{2}/gi, match => match.toUpperCase());
  return `examples_${encoded}`;
}

const CANONICAL_KEY = computeCanonicalKey(CANONICAL_PATH);
const LEGACY_DECODED_KEY = 'examples_/brøkfigurer.html';
const LEGACY_LOWERCASE_KEY = 'examples_/br%c3%b8kfigurer.html';
const GRAFTEGNER_CANONICAL_KEY = computeCanonicalKey('/graftegner.html');
const GRAFTEGNER_LEGACY_KEY = 'examples_/Graftegner';

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

  test('loads Graftegner examples saved under uppercase path casing', async ({ page }) => {
    const payload = legacyPayload('Graftegner stor bokstav');
    await page.addInitScript(([legacyKey, value]) => {
      window.localStorage.setItem(legacyKey, value);
    }, [GRAFTEGNER_LEGACY_KEY, payload]);

    await page.goto('/graftegner.html');
    await page.waitForFunction(key => {
      const value = window.localStorage.getItem(key);
      if (!value) return false;
      try {
        const parsed = JSON.parse(value);
        return Array.isArray(parsed) && parsed.length > 0;
      } catch (error) {
        return false;
      }
    }, GRAFTEGNER_CANONICAL_KEY);

    const stored = await page.evaluate(key => JSON.parse(window.localStorage.getItem(key)), GRAFTEGNER_CANONICAL_KEY);
    expect(stored[0]).toMatchObject({
      description: 'Graftegner stor bokstav'
    });

    const legacyValue = await page.evaluate(key => window.localStorage.getItem(key), GRAFTEGNER_LEGACY_KEY);
    expect(legacyValue).toBeNull();

    await expect(page.locator('#exampleDescription')).toHaveValue('Graftegner stor bokstav');
  });
});
