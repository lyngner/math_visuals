const { test, expect } = require('@playwright/test');

const SETTINGS_KEY = 'mathVisuals:settings';
const FOREIGN_PROJECT = 'kikora';
const FOREIGN_COLORS = ['#123123', '#234234', '#345345'];
const CAMPUS_PROJECT_HINT = 'campus';
const EXPECTED_CURVE_FALLBACK = '#1f4de2';
const EXPECTED_THEME_FALLBACK = '#dbe3ff';
const EXAMPLES_ROUTE = '**/examples.js';

function buildStoredSettings() {
  return {
    version: 1,
    projects: {
      [FOREIGN_PROJECT]: { defaultColors: FOREIGN_COLORS.slice() }
    },
    projectOrder: [FOREIGN_PROJECT],
    activeProject: FOREIGN_PROJECT,
    defaultColors: FOREIGN_COLORS.slice(),
    defaultLineThickness: 3,
    updatedAt: '2020-01-01T00:00:00.000Z'
  };
}

async function seedSettings(page, storedSettings, projectHint) {
  await page.addInitScript(({ key, value, hint }) => {
    if (typeof window !== 'undefined' && window.localStorage) {
      try {
        window.localStorage.clear();
        window.localStorage.setItem(key, JSON.stringify(value));
      } catch (error) {}
    }
    if (typeof document !== 'undefined' && document.documentElement) {
      if (hint) {
        document.documentElement.setAttribute('data-mv-active-project', hint);
        document.documentElement.setAttribute('data-theme-profile', hint);
      }
    }
  }, { key: SETTINGS_KEY, value: storedSettings, hint: projectHint });
}

test.describe('project palette isolation', () => {
  test('graftegner uses campus palette when stored colors belong to another project', async ({ page }) => {
    const storedSettings = buildStoredSettings();
    await page.route(EXAMPLES_ROUTE, route => {
      route.fulfill({ status: 200, contentType: 'application/javascript', body: '/* stubbed examples */' });
    });
    await seedSettings(page, storedSettings, CAMPUS_PROJECT_HINT);

    try {
      await page.goto('/graftegner.html', { waitUntil: 'load' });
      await page.waitForFunction(() => typeof window.getDefaultCurveColor === 'function');

      const color = await page.evaluate(() => window.getDefaultCurveColor(0));
      expect(color).toBeTruthy();
      expect(color.toLowerCase()).not.toBe(storedSettings.defaultColors[0].toLowerCase());
      expect(color.toLowerCase()).toBe(EXPECTED_CURVE_FALLBACK);
    } finally {
      await page.unroute(EXAMPLES_ROUTE);
    }
  });

  test('nkant uses campus palette when stored colors belong to another project', async ({ page }) => {
    const storedSettings = buildStoredSettings();
    await page.route(EXAMPLES_ROUTE, route => {
      route.fulfill({ status: 200, contentType: 'application/javascript', body: '/* stubbed examples */' });
    });
    await seedSettings(page, storedSettings, CAMPUS_PROJECT_HINT);

    try {
      await page.goto('/nkant.html', { waitUntil: 'load' });
      await page.waitForFunction(() => typeof window.resolveSettingsPalette === 'function');

      const palette = await page.evaluate(() => window.resolveSettingsPalette(4));
      expect(Array.isArray(palette)).toBe(true);
      expect(palette[0].toLowerCase()).not.toBe(storedSettings.defaultColors[0].toLowerCase());
      expect(palette[0].toLowerCase()).toBe(EXPECTED_CURVE_FALLBACK);
    } finally {
      await page.unroute(EXAMPLES_ROUTE);
    }
  });

  test('theme profiles use built-in palette when stored colors belong to another project', async ({ page }) => {
    const storedSettings = buildStoredSettings();
    await page.route(EXAMPLES_ROUTE, route => {
      route.fulfill({ status: 200, contentType: 'application/javascript', body: '/* stubbed examples */' });
    });
    await seedSettings(page, storedSettings, CAMPUS_PROJECT_HINT);

    try {
      await page.goto('/figurtall.html', { waitUntil: 'load' });
      await page.waitForFunction(() => window.MathVisualsTheme && typeof window.MathVisualsTheme.getPalette === 'function');

      const palette = await page.evaluate(() => window.MathVisualsTheme.getPalette('figures', 2));
      expect(Array.isArray(palette)).toBe(true);
      expect(palette[0].toLowerCase()).not.toBe(storedSettings.defaultColors[0].toLowerCase());
      expect(palette[0].toLowerCase()).toBe(EXPECTED_THEME_FALLBACK);
    } finally {
      await page.unroute(EXAMPLES_ROUTE);
    }
  });
});
