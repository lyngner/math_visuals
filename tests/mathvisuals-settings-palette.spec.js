const { test, expect } = require('@playwright/test');
const fs = require('fs');
const vm = require('vm');

const SETTINGS_MODULE = require.resolve('../examples.js');
const paletteConfig = require('../palette/palette-config.js');
const {
  distributeFlatPaletteToGroups,
  flattenProjectPalette: flattenStorePalette,
  expandPalette: expandStorePalette
} = require('../api/_lib/settings-store.js');
const MIN_COLOR_SLOTS = Number.isInteger(paletteConfig.MIN_COLOR_SLOTS)
  ? paletteConfig.MIN_COLOR_SLOTS
  : 0;
const AXIS_SLOT = (() => {
  if (!Array.isArray(paletteConfig.COLOR_SLOT_GROUPS)) {
    return null;
  }
  for (const group of paletteConfig.COLOR_SLOT_GROUPS) {
    if (!group || !Array.isArray(group.slots)) continue;
    for (const slot of group.slots) {
      if (slot && Number.isInteger(slot.index) && slot.index === 19) {
        const groupId = typeof group.groupId === 'string' ? group.groupId : String(group.groupId || '');
        const groupIndex = Number.isInteger(slot.groupIndex) ? slot.groupIndex : group.slots.indexOf(slot);
        return { groupId, groupIndex };
      }
    }
  }
  return null;
})();
const ORIGINAL_GLOBALS = {
  document: global.document,
  window: global.window,
  location: global.location,
  navigator: global.navigator,
  CustomEvent: global.CustomEvent,
  localStorage: global.localStorage
};

test.afterEach(() => {
  delete global.MathVisualsSettings;
  delete global.MathVisualsPalette;
  if (global.window && typeof global.window === 'object') {
    delete global.window.MathVisualsPalette;
  }
  delete require.cache[SETTINGS_MODULE];
  if (ORIGINAL_GLOBALS.document === undefined) {
    delete global.document;
  } else {
    global.document = ORIGINAL_GLOBALS.document;
  }
  if (ORIGINAL_GLOBALS.window === undefined) {
    delete global.window;
  } else {
    global.window = ORIGINAL_GLOBALS.window;
  }
  if (ORIGINAL_GLOBALS.location === undefined) {
    delete global.location;
  } else {
    global.location = ORIGINAL_GLOBALS.location;
  }
  if (ORIGINAL_GLOBALS.navigator === undefined) {
    delete global.navigator;
  } else {
    global.navigator = ORIGINAL_GLOBALS.navigator;
  }
  if (ORIGINAL_GLOBALS.CustomEvent === undefined) {
    delete global.CustomEvent;
  } else {
    global.CustomEvent = ORIGINAL_GLOBALS.CustomEvent;
  }
  if (ORIGINAL_GLOBALS.localStorage === undefined) {
    delete global.localStorage;
  } else {
    global.localStorage = ORIGINAL_GLOBALS.localStorage;
  }
});

function loadNkantResolveSettingsPalette(projectName, options = {}) {
  const documentStub = createDocumentStub();
  const storageData = new Map();
  const localStorageStub = {
    getItem: key => (storageData.has(String(key)) ? storageData.get(String(key)) : null),
    setItem: (key, value) => {
      storageData.set(String(key), String(value));
    },
    removeItem: key => {
      storageData.delete(String(key));
    },
    clear: () => {
      storageData.clear();
    },
    key: index => Array.from(storageData.keys())[index] || null,
    get length() {
      return storageData.size;
    }
  };

  const windowStub = {
    document: documentStub,
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => {},
    location: { origin: '', pathname: '/', search: '', hash: '' },
    navigator: { userAgent: 'node' },
    matchMedia: () => ({ matches: false, addListener: () => {}, removeListener: () => {} }),
    setTimeout: (...args) => setTimeout(...args),
    clearTimeout: handle => clearTimeout(handle),
    setInterval: (...args) => setInterval(...args),
    clearInterval: handle => clearInterval(handle),
    requestAnimationFrame: callback => setTimeout(() => callback(Date.now()), 0),
    cancelAnimationFrame: handle => clearTimeout(handle),
    localStorage: localStorageStub,
    CustomEvent: function CustomEvent() {}
  };
  windowStub.window = windowStub;
  windowStub.self = windowStub;
  documentStub.defaultView = windowStub;
  const paletteHelper = options.groupPaletteHelper === null ? undefined : options.groupPaletteHelper;

  windowStub.MathVisualsPaletteConfig = paletteConfig;
  windowStub.MathVisualsSettings = {
    getActiveProject: () => projectName
  };
  if (options.paletteApi === null) {
    delete windowStub.MathVisualsPalette;
  } else {
    windowStub.MathVisualsPalette = {
      getGroupPalette: () => []
    };
  }
  const themeGroupPalette = function themeGroupPalette() {
    return [];
  };
  if (options.themeApi === null) {
    delete windowStub.MathVisualsTheme;
  } else {
    windowStub.MathVisualsTheme = {
      getGroupPalette: themeGroupPalette,
      getActiveProfileName: () => null,
      getColor: () => '#000000'
    };
  }
  if (paletteHelper) {
    windowStub.MathVisualsGroupPalette = paletteHelper;
  } else {
    delete windowStub.MathVisualsGroupPalette;
  }
  windowStub.MathVisAltText = {
    create: () => ({
      destroy: () => {},
      scheduleUpdate: () => {},
      setOptions: () => {}
    })
  };
  windowStub.MathVisSvgExport = {
    saveSvg: () => Promise.resolve(),
    savePng: () => Promise.resolve(),
    copySvg: () => Promise.resolve(),
    copyPng: () => Promise.resolve()
  };

  const sandbox = {
    window: windowStub,
    document: documentStub,
    self: windowStub,
    global: windowStub,
    globalThis: windowStub,
    console,
    Math,
    setTimeout,
    clearTimeout,
    setInterval,
    clearInterval,
    requestAnimationFrame: windowStub.requestAnimationFrame,
    cancelAnimationFrame: windowStub.cancelAnimationFrame,
    URL,
    module: { exports: {} },
    exports: {}
  };

  sandbox.MathVisualsPaletteConfig = paletteConfig;

  const nkantSource = fs.readFileSync(require.resolve('../nkant.js'), 'utf8');
  vm.runInNewContext(
    `${nkantSource}\nmodule.exports = typeof resolveSettingsPalette === 'function' ? { resolveSettingsPalette } : {};`,
    sandbox,
    { filename: require.resolve('../nkant.js') }
  );

  return {
    resolveSettingsPalette:
      sandbox.module && sandbox.module.exports ? sandbox.module.exports.resolveSettingsPalette : undefined,
    context: sandbox
  };
}

function createStyleStub() {
  return new Proxy(
    {},
    {
      get(target, prop) {
        if (prop === 'setProperty' || prop === 'removeProperty') {
          return () => {};
        }
        return target[prop] || '';
      },
      set(target, prop, value) {
        target[prop] = value;
        return true;
      },
      deleteProperty() {
        return true;
      }
    }
  );
}

function createNodeStub() {
  const node = {};
  return new Proxy(node, {
    get(target, prop) {
      if (prop === 'style') {
        if (!target.style) {
          target.style = createStyleStub();
        }
        return target.style;
      }
      if (prop === 'classList') {
        if (!target.classList) {
          target.classList = { add: () => {}, remove: () => {}, toggle: () => {}, contains: () => false };
        }
        return target.classList;
      }
      if (prop === 'dataset') {
        if (!target.dataset) {
          target.dataset = {};
        }
        return target.dataset;
      }
      if (prop === 'children') {
        if (!target.children) {
          target.children = [];
        }
        return target.children;
      }
      if (prop === 'innerHTML' || prop === 'textContent' || prop === 'value') {
        return target[prop] || '';
      }
      if (
        prop === 'appendChild' ||
        prop === 'removeChild' ||
        prop === 'insertBefore' ||
        prop === 'remove' ||
        prop === 'replaceChildren' ||
        prop === 'setAttribute' ||
        prop === 'removeAttribute' ||
        prop === 'addEventListener' ||
        prop === 'removeEventListener' ||
        prop === 'focus' ||
        prop === 'blur' ||
        prop === 'scrollIntoView'
      ) {
        return () => {};
      }
      if (prop === 'querySelectorAll') {
        return () => ({ forEach: () => {}, length: 0 });
      }
      if (prop === 'querySelector' || prop === 'closest') {
        return () => null;
      }
      if (
        prop === 'parentElement' ||
        prop === 'parentNode' ||
        prop === 'nextSibling' ||
        prop === 'previousSibling' ||
        prop === 'firstChild' ||
        prop === 'lastChild'
      ) {
        return target[prop] || null;
      }
      if (prop === 'getBoundingClientRect') {
        return () => ({ top: 0, left: 0, right: 0, bottom: 0, width: 0, height: 0 });
      }
      if (prop === Symbol.iterator) {
        return function* () {};
      }
      if (!(prop in target)) {
        target[prop] = () => {};
      }
      return target[prop];
    },
    set(target, prop, value) {
      target[prop] = value;
      return true;
    }
  });
}

function createDocumentStub() {
  const node = createNodeStub();
  return new Proxy(
    {
      readyState: 'complete',
      documentElement: node,
      body: node,
      head: createNodeStub(),
      addEventListener: () => {},
      removeEventListener: () => {},
      querySelectorAll: () => ({ forEach: () => {}, length: 0 }),
      querySelector: () => null,
      createElement: () => createNodeStub(),
      createDocumentFragment: () => createNodeStub(),
      getElementById: () => createNodeStub(),
      getElementsByTagName: () => [],
      fonts: { ready: Promise.resolve() },
      createTextNode: () => createNodeStub(),
      dispatchEvent: () => {}
    },
    {
      get(target, prop) {
        if (prop in target) {
          return target[prop];
        }
        return () => {};
      },
      set(target, prop, value) {
        target[prop] = value;
        return true;
      }
    }
  );
}

function ensureDomStubs() {
  const documentStub = createDocumentStub();
  global.document = documentStub;
  const storageData = new Map();
  const localStorageStub = {
    getItem: key => (storageData.has(String(key)) ? storageData.get(String(key)) : null),
    setItem: (key, value) => {
      storageData.set(String(key), String(value));
    },
    removeItem: key => {
      storageData.delete(String(key));
    },
    clear: () => {
      storageData.clear();
    },
    key: index => Array.from(storageData.keys())[index] || null,
    get length() {
      return storageData.size;
    }
  };
  global.window = {
    document: documentStub,
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => {},
    location: { origin: '', pathname: '/', search: '', hash: '' },
    navigator: { userAgent: 'node' },
    matchMedia: () => ({ matches: false, addListener: () => {}, removeListener: () => {} }),
    setTimeout: (...args) => setTimeout(...args),
    clearTimeout: handle => clearTimeout(handle),
    setInterval: (...args) => setInterval(...args),
    clearInterval: handle => clearInterval(handle),
    requestAnimationFrame: callback => setTimeout(() => callback(Date.now()), 0),
    cancelAnimationFrame: handle => clearTimeout(handle),
    localStorage: localStorageStub,
    CustomEvent: function CustomEvent() {}
  };
  global.location = global.window.location;
  global.navigator = global.window.navigator;
  global.CustomEvent = function CustomEvent() {};
  global.window.CustomEvent = global.CustomEvent;
  global.localStorage = localStorageStub;
}

function loadSettingsWithPaletteSpy(spyImplementation) {
  const paletteCalls = [];
  const previousFetch = global.fetch;

  delete global.MathVisualsSettings;
  delete require.cache[SETTINGS_MODULE];

  ensureDomStubs();

  global.MathVisualsPalette = {
    getGroupPalette(groupId, options) {
      const result = spyImplementation(groupId, options);
      paletteCalls.push({ groupId, options });
      return Array.isArray(result) ? result : ['#123456'];
    },
    getProjectGroupPalettes() {
      return {};
    },
    getProjectPalette() {
      return ['#123456'];
    }
  };
  if (global.window && typeof global.window === 'object') {
    global.window.MathVisualsPalette = global.MathVisualsPalette;
  }
  global.fetch = undefined;

  require('../examples.js');

  const api = global.MathVisualsSettings || (global.window && global.window.MathVisualsSettings);

  global.fetch = previousFetch;

  return { api, paletteCalls };
}

function loadThemeModule() {
  delete global.MathVisualsTheme;
  if (global.window && typeof global.window === 'object') {
    delete global.window.MathVisualsTheme;
  }
  delete require.cache[require.resolve('../theme-profiles.js')];

  ensureDomStubs();

  require('../theme-profiles.js');

  return global.MathVisualsTheme || (global.window && global.window.MathVisualsTheme);
}

test.describe('MathVisualsSettings.getGroupPalette', () => {
  test('forwards project override with legacy signature', () => {
    const { api, paletteCalls } = loadSettingsWithPaletteSpy(() => ['#abcdef']);

    const palette = api.getGroupPalette('graftegner', 4, { project: 'kikora' });

    expect(palette).toEqual(['#abcdef']);
    expect(paletteCalls).toHaveLength(1);
    const [{ groupId, options }] = paletteCalls;
    expect(groupId).toBe('graftegner');
    expect(options.project).toBe('kikora');
    expect(options.count).toBe(4);
  });

  test('supports options-object signature and preserves project override', () => {
    const { api, paletteCalls } = loadSettingsWithPaletteSpy(() => ['#fedcba']);

    const palette = api.getGroupPalette('graftegner', { project: 'annet', count: 2 });

    expect(palette).toEqual(['#fedcba']);
    expect(paletteCalls).toHaveLength(1);
    const [{ groupId, options }] = paletteCalls;
    expect(groupId).toBe('graftegner');
    expect(options.project).toBe('annet');
    expect(options.count).toBe(2);
  });
});

test.describe('nkant settings palette fallback', () => {
  test('uses project-specific fallbacks when palette APIs return no colors', () => {
    const campus = loadNkantResolveSettingsPalette('campus');
    expect(typeof campus.resolveSettingsPalette).toBe('function');
    const campusResult = campus.resolveSettingsPalette.call(campus.context.window, 4);
    expect(campusResult.source).toBe('project-fallback');
    const campusExpected = paletteConfig.PROJECT_FALLBACKS.campus
      .slice(0, 4)
      .map(color => color.toLowerCase());
    expect(campusResult.colors).toEqual(campusExpected);

    const annet = loadNkantResolveSettingsPalette('annet');
    expect(typeof annet.resolveSettingsPalette).toBe('function');
    const annetResult = annet.resolveSettingsPalette.call(annet.context.window, 4);
    expect(annetResult.source).toBe('project-fallback');
    const annetExpected = paletteConfig.PROJECT_FALLBACKS.annet
      .slice(0, 4)
      .map(color => color.toLowerCase());
    expect(annetResult.colors).toEqual(annetExpected);

    expect(campusResult.colors).not.toEqual(annetResult.colors);
  });
});

test.describe('MathVisuals palette slot handling', () => {
  test('preserves graftegner axis color across flatten → distribute → expand', () => {
    expect(AXIS_SLOT).toBeTruthy();
    const axisIndex = 19;
    const projects = Array.isArray(paletteConfig.DEFAULT_PROJECT_ORDER)
      ? paletteConfig.DEFAULT_PROJECT_ORDER.slice()
      : ['campus', 'kikora', 'annet'];
    if (!projects.includes('default')) {
      projects.push('default');
    }
    projects.forEach(project => {
      const fallbackFlat = expandStorePalette(project, null);
      expect(fallbackFlat.length).toBeGreaterThan(axisIndex);
      const flattened = fallbackFlat.slice();
      flattened[axisIndex] = '#000000';
      const grouped = distributeFlatPaletteToGroups(flattened, project);
      if (AXIS_SLOT) {
        const axisGroup = grouped[AXIS_SLOT.groupId] || [];
        expect(axisGroup[AXIS_SLOT.groupIndex]).toBe('#000000');
      }
      const roundTrip = flattenStorePalette(project, { groupPalettes: grouped });
      expect(roundTrip[axisIndex]).toBe('#000000');
      const expanded = expandStorePalette(project, { groupPalettes: grouped });
      expect(expanded[axisIndex]).toBe('#000000');
    });
  });
});

test.describe('MathVisualsTheme.getPalette', () => {
  test('uses project override profile even when active profile differs', () => {
    const theme = loadThemeModule();

    expect(theme).toBeTruthy();

    theme.setProfile('kikora', { force: true });
    expect(theme.getActiveProfileName()).toBe('kikora');

    const palette = theme.getPalette('figures', 6, { project: 'campus' });

    expect(palette).toEqual(['#DBE3FF', '#2C395B', '#E3B660', '#C5E5E9', '#F6E5BC', '#F1D0D9']);
  });

  test('ignores global stored default colors when project override provided', () => {
    const theme = loadThemeModule();

    expect(theme).toBeTruthy();

    const campusDefaults = ['#DBE3FF', '#2C395B', '#E3B660', '#C5E5E9', '#F6E5BC', '#F1D0D9'];
    global.localStorage.setItem(
      'mathVisuals:settings',
      JSON.stringify({ defaultColors: campusDefaults })
    );

    theme.setProfile('campus', { force: true });
    expect(theme.getActiveProfileName()).toBe('campus');

    const palette = theme.getPalette('figures', 6, { project: 'kikora' });
    const expected = ['#E31C3D', '#BF4474', '#873E79', '#534477', '#6C1BA2', '#B25FE3'];

    expect(palette.slice().sort()).toEqual(expected.slice().sort());
  });
});

test.describe('MathVisualsSettings project palette formats', () => {
  test('exposes groupPalettes alongside defaultColors', () => {
    const { api } = loadSettingsWithPaletteSpy(() => ['#abcdef']);

    const campus = api.getProjectSettings('campus');
    expect(campus).toBeTruthy();
    expect(campus.groupPalettes).toBeTruthy();
    expect(campus.groupPalettes.graftegner).toBeTruthy();
    expect(Array.isArray(campus.defaultColors)).toBe(true);
    expect(campus.defaultColors[0]).toBeDefined();
    const firstGroupColor = campus.groupPalettes.graftegner && campus.groupPalettes.graftegner[0];
    if (firstGroupColor) {
      expect(campus.defaultColors[0]).toBe(firstGroupColor);
    }
  });

  test('updates groupPalettes and defaultColors when saving palettes', () => {
    const { api } = loadSettingsWithPaletteSpy(() => ['#abcdef']);

    const update = api.setSettings({
      activeProject: 'campus',
      projects: {
        campus: {
          groupPalettes: {
            graftegner: ['#111111'],
            ukjent: ['#222222', ' #333333 ']
          }
        }
      }
    });

    expect(update.projects.campus.groupPalettes.graftegner[0]).toBe('#111111');
    expect(update.projects.campus.defaultColors[0]).toBe('#111111');
    expect(update.projects.campus.groupPalettes.ukjent).toBeUndefined();
    expect(update.projects.campus.defaultColors).not.toEqual(expect.arrayContaining(['#222222']));

    const settings = api.getSettings();
    const campus = settings.projects.campus;
    expect(campus.groupPalettes.graftegner[0]).toBe('#111111');
    expect(campus.defaultColors[0]).toBe('#111111');
    expect(campus.groupPalettes.ukjent).toBeUndefined();
    expect(campus.defaultColors).not.toEqual(expect.arrayContaining(['#222222']));
  });

  test('creates groupPalettes for new projects', () => {
    const { api } = loadSettingsWithPaletteSpy(() => ['#abcdef']);

    const settings = api.updateSettings({
      projects: {
        'custom-app': {
          groupPalettes: {
            graftegner: ['#123456'],
            ukjent: ['#654321']
          }
        }
      }
    });

    const project = settings.projects['custom-app'];
    expect(project).toBeTruthy();
    expect(project.groupPalettes.graftegner[0]).toBe('#123456');
    expect(project.defaultColors[0]).toBe('#123456');
    expect(project.groupPalettes.ukjent).toBeUndefined();
  });

  test('updateSettings accepts root-level groupPalettes for active project', () => {
    const { api } = loadSettingsWithPaletteSpy(() => ['#abcdef']);

    const update = api.updateSettings({
      activeProject: 'campus',
      groupPalettes: {
        graftegner: ['#010101', ' #020202 '],
        ukjent: ['#030303']
      }
    });

    const campus = update.projects.campus;
    expect(campus).toBeTruthy();
    expect(campus.groupPalettes.graftegner).toEqual(['#010101', '#020202']);
    expect(campus.defaultColors[0]).toBe('#010101');
    expect(campus.groupPalettes.ukjent).toBeUndefined();

    const persisted = api.getSettings().projects.campus;
    expect(persisted.groupPalettes.graftegner).toEqual(['#010101', '#020202']);
    expect(persisted.defaultColors[0]).toBe('#010101');
    expect(persisted.groupPalettes.ukjent).toBeUndefined();
  });

  test('retains graftegner graph and axis colors after switching projects', () => {
    const { api } = loadSettingsWithPaletteSpy(() => ['#abcdef']);

    const graphColor = '#ff00ff';
    const axisColor = '#000000';
    const kikoraGraph = '#00ff00';
    const kikoraAxis = '#111111';

    const campusUpdate = api.updateSettings({
      activeProject: 'campus',
      groupPalettes: {
        graftegner: [graphColor, axisColor]
      }
    });

    expect(campusUpdate.projects.campus.groupPalettes.graftegner).toEqual([
      graphColor,
      axisColor
    ]);
    expect(campusUpdate.projects.campus.defaultColors[0]).toBe(graphColor);
    expect(campusUpdate.projects.campus.defaultColors[19]).toBe(axisColor);

    api.updateSettings({
      activeProject: 'kikora',
      groupPalettes: {
        graftegner: [kikoraGraph, kikoraAxis]
      }
    });

    api.setActiveProject('kikora', { notify: false });
    api.setActiveProject('campus', { notify: false });

    const campusSettings = api.getProjectSettings('campus');
    expect(campusSettings.groupPalettes.graftegner).toEqual([graphColor, axisColor]);
    expect(campusSettings.defaultColors[0]).toBe(graphColor);
    expect(campusSettings.defaultColors[19]).toBe(axisColor);

    const graftegnerPalette = api.getGroupPalette('graftegner', 2, { project: 'campus' });
    expect(graftegnerPalette[0]).toBe(graphColor);
    expect(graftegnerPalette[1]).toBe(axisColor);

    const kikoraSettings = api.getProjectSettings('kikora');
    expect(kikoraSettings.groupPalettes.graftegner).toEqual([kikoraGraph, kikoraAxis]);
    expect(kikoraSettings.defaultColors[0]).toBe(kikoraGraph);
    expect(kikoraSettings.defaultColors[19]).toBe(kikoraAxis);
  });
});
