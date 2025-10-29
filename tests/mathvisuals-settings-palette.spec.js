const { test, expect } = require('@playwright/test');

const SETTINGS_MODULE = require.resolve('../examples.js');
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
