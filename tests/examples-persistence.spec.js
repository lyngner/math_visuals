const { test, expect } = require('@playwright/test');

const {
  attachExamplesBackendMock,
  normalizeExamplePath
} = require('./helpers/examples-backend-mock');

const EXAMPLE_PATH = '/diagram/index.html';
const CANONICAL_PATH = normalizeExamplePath(EXAMPLE_PATH);

const persistedExample = {
  description: 'Lagret før oppdatering',
  exampleNumber: 'Persistert',
  isDefault: true,
  config: {
    CFG: {
      type: 'bar',
      title: 'Forhåndslagret data',
      labels: ['A', 'B', 'C'],
      series1: '',
      start: [1, 2, 3],
      answer: [1, 2, 3],
      yMin: 0,
      yMax: 5,
      snap: 1,
      tolerance: 0,
      axisXLabel: 'Kategori',
      axisYLabel: 'Verdi',
      valueDisplay: 'none',
      locked: []
    }
  }
};

const seedPayload = {
  examples: [persistedExample],
  deletedProvided: []
};

test.describe('Persisted example compatibility', () => {
  let backend;

  test.beforeEach(async ({ page }) => {
    backend = await attachExamplesBackendMock(page.context(), {
      [CANONICAL_PATH]: seedPayload
    });
  });

  test.afterEach(async () => {
    if (backend) {
      await backend.dispose();
      backend = null;
    }
  });

  test('does not trigger backend sync on initial load when no changes exist', async ({ page }) => {
    if (backend) {
      await backend.dispose();
    }
    backend = await attachExamplesBackendMock(page.context());
    const unexpectedPut = backend.waitForPut(CANONICAL_PATH, {
      timeout: 800,
      timeoutMessage: 'Expected no automatic PUT for empty examples state'
    });

    await page.goto(EXAMPLE_PATH, { waitUntil: 'load' });

    await expect(unexpectedPut).rejects.toThrow(/Expected no automatic PUT/i);
  });

  test('loads user saved examples stored under the canonical key', async ({ page }) => {
    await page.goto(EXAMPLE_PATH, { waitUntil: 'load' });

    const savedTab = page.locator('#exampleTabs .example-tab', { hasText: 'Persistert' });
    await expect(savedTab).toHaveCount(1);

    await savedTab.click();
    await expect(page.locator('#exampleDescription')).toHaveValue(persistedExample.description);

    const storedEntry = await backend.client.get(CANONICAL_PATH);
    expect(storedEntry).toBeTruthy();
    expect(Array.isArray(storedEntry.examples)).toBe(true);
    expect(storedEntry.examples[0]).toMatchObject({
      description: persistedExample.description,
      exampleNumber: 'Persistert'
    });
  });

  test('preserves Map and Set structures when saving and reloading', async ({ page }) => {
    const figurePath = '/brøkfigurer.html';
    const canonicalFigurePath = normalizeExamplePath(figurePath);
    await backend.client.put(canonicalFigurePath, { examples: [], deletedProvided: [] });
    await backend.waitForPut(canonicalFigurePath, {
      timeout: 500,
      description: 'drain initial seed put'
    });

    await page.goto(figurePath, { waitUntil: 'load' });

    await page.evaluate(() => {
      const colors = new Map();
      colors.set('første', new Set(['rød', 'blå']));
      colors.set('andre', new Set(['grønn']));
      window.STATE = { colors };
    });

    const tabs = page.locator('#exampleTabs .example-tab');
    const initialCount = await tabs.count();

    const savePromise = backend.waitForPut(canonicalFigurePath, {
      description: `persist example for ${figurePath}`
    });
    await page.locator('#btnSaveExample').click();

    const putResult = await savePromise;
    await expect(tabs).toHaveCount(initialCount + 1);

    expect(Array.isArray(putResult.payload.examples)).toBe(true);
    expect(putResult.payload.examples.length).toBeGreaterThan(0);

    await page.evaluate(() => {
      window.STATE = { colors: null };
    });

    const savedTab = tabs.nth(initialCount);
    await savedTab.click();

    await page.waitForFunction(() => {
      const state = window.STATE;
      return !!(state && state.colors instanceof Map && state.colors.size === 2);
    });

    const roundTrip = await page.evaluate(() => {
      const state = window.STATE;
      if (!state || !(state.colors instanceof Map)) return null;
      const collected = [];
      state.colors.forEach((set, key) => {
        const values = set instanceof Set ? Array.from(set).sort() : [];
        collected.push([key, values]);
      });
      collected.sort((a, b) => {
        if (a[0] === b[0]) return 0;
        return a[0] < b[0] ? -1 : 1;
      });
      return collected;
    });

    expect(roundTrip).toEqual([
      ['andre', ['grønn']],
      ['første', ['blå', 'rød']]
    ]);

    const stored = await backend.client.get(canonicalFigurePath);
    expect(stored).toBeTruthy();
    expect(Array.isArray(stored.examples)).toBe(true);
    expect(stored.examples[stored.examples.length - 1]).toMatchObject({
      description: expect.any(String)
    });
  });
});
