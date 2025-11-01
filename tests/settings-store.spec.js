const { test, expect } = require('@playwright/test');

const originalKvUrl = process.env.KV_REST_API_URL;
const originalKvToken = process.env.KV_REST_API_TOKEN;

delete process.env.KV_REST_API_URL;
delete process.env.KV_REST_API_TOKEN;

const {
  setSettings,
  getSettings,
  resetSettings
} = require('../api/_lib/settings-store');

test.afterAll(() => {
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
});

test.beforeEach(async () => {
  await resetSettings();
});

function buildGroupedPalette(overrides = {}) {
  const base = {
    graftegner: ['#123456'],
    nkant: ['#234567', '#345678', '#456789'],
    diagram: ['#56789a', '#6789ab', '#789abc', '#89abcd'],
    fractions: ['#9abcde', '#abcdee'],
    figurtall: ['#bcdef0', '#cdef01', '#def012', '#ef0123'],
    arealmodell: ['#ef0123', '#f01234', '#012345'],
    tallinje: ['#112233', '#223344'],
    kvikkbilder: ['#334455'],
    trefigurer: ['#445566', '#556677'],
    brokvegg: ['#667788', '#778899', '#8899aa', '#99aabb'],
    prikktilprikk: ['#aabbcc', '#bbccdd']
  };
  Object.keys(overrides).forEach(key => {
    base[key] = overrides[key];
  });
  return base;
}

test.describe('settings-store palette handling', () => {
  test('stores grouped project palettes and retrieves consistent hex colors', async () => {
    const campusPalette = buildGroupedPalette();
    const customPalette = buildGroupedPalette({
      graftegner: ['#101010'],
      ukjent: ['#222222', ' #333333 ', '#444444']
    });

    // Apply overrides to ensure variation between palettes
    customPalette.graftegner = ['#101010'];
    customPalette.ukjent = ['#222222', ' #333333 ', '#444444'];

    const payload = {
      activeProject: 'custom-app',
      projects: {
        campus: { defaultColors: campusPalette },
        'custom-app': { defaultColors: customPalette }
      },
      projectOrder: ['campus', 'custom-app']
    };

    const saved = await setSettings(payload);

    expect(saved.projects.campus.groupPalettes).toBeDefined();
    expect(saved.projects.campus.groupPalettes.graftegner[0]).toBe('#123456');
    expect(saved.projects['custom-app'].groupPalettes).toBeDefined();
    expect(saved.projects['custom-app'].groupPalettes.graftegner[0]).toBe('#101010');
    expect(saved.projects.campus.defaultColors[0]).toBe('#123456');
    expect(saved.projects['custom-app'].defaultColors[0]).toBe('#101010');
    expect(saved.activeProject).toBe('custom-app');
    expect(saved.defaultColors[0]).toBe('#101010');

    const retrieved = await getSettings();

    expect(retrieved.projects.campus.groupPalettes.graftegner[0]).toBe('#123456');
    expect(retrieved.projects['custom-app'].groupPalettes.graftegner[0]).toBe('#101010');
    expect(retrieved.projects.campus.defaultColors[0]).toBe('#123456');
    expect(retrieved.projects['custom-app'].defaultColors[0]).toBe('#101010');
    expect(retrieved.defaultColors[0]).toBe('#101010');

    expect(saved.projects.campus.groupPalettes.ukjent).toBeUndefined();
    expect(saved.projects['custom-app'].groupPalettes.ukjent).toBeUndefined();
    expect(retrieved.projects.campus.groupPalettes.ukjent).toBeUndefined();
    expect(retrieved.projects['custom-app'].groupPalettes.ukjent).toBeUndefined();
  });
});
