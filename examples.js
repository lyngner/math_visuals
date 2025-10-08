(function ensureVercelRedirect() {
  if (typeof window === 'undefined') return;
  if (window.__MATH_VISUALS_REDIRECT_INITIALIZED__) return;
  const { hostname, pathname, search, hash } = window.location;
  if (!hostname || !hostname.endsWith('github.io')) return;
  window.__MATH_VISUALS_REDIRECT_INITIALIZED__ = true;
  const targetOrigin = 'https://math-visuals.vercel.app';
  const repoBasePath = '/math_visuals';
  let path = typeof pathname === 'string' && pathname ? pathname : '/';
  if (!path.startsWith('/')) {
    path = `/${path}`;
  }
  const normalizedRepoPath = repoBasePath.toLowerCase();
  if (normalizedRepoPath && path.toLowerCase().startsWith(normalizedRepoPath)) {
    path = path.slice(repoBasePath.length) || '/';
  }
  if (!path.startsWith('/')) {
    path = `/${path}`;
  }
  const destination = new URL(`${path}${search || ''}${hash || ''}`, targetOrigin).toString();
  if (destination === window.location.href) return;
  try {
    window.location.replace(destination);
  } catch (_) {
    window.location.href = destination;
  }
})();

(function removeRestoreExampleButtons() {
  if (typeof document === 'undefined') return;
  const targetText = 'gjenopprett eksempler';
  const isElement = node => {
    if (typeof Node === 'undefined') return !!(node && node.nodeType === 1);
    return !!(node && node.nodeType === Node.ELEMENT_NODE);
  };
  const normalizeText = value => {
    if (typeof value !== 'string') return '';
    return value.replace(/\s+/g, ' ').trim().toLowerCase();
  };
  const shouldRemove = button => {
    if (!button) return false;
    const text = normalizeText(button.textContent || '');
    return text === targetText;
  };
  const removeButtonsIn = root => {
    let removed = false;
    if (!root) return removed;
    const process = element => {
      if (!element) return;
      if (shouldRemove(element)) {
        element.remove();
        removed = true;
      }
    };
    if (root === document || root === document.documentElement || root === document.body) {
      const buttons = document.querySelectorAll('button');
      buttons.forEach(process);
      return removed;
    }
    if (isElement(root)) {
      if (root.tagName === 'BUTTON') {
        process(root);
      }
      root.querySelectorAll && root.querySelectorAll('button').forEach(process);
    } else if (root && typeof root.querySelectorAll === 'function') {
      root.querySelectorAll('button').forEach(process);
    }
    return removed;
  };
  const removeAll = () => {
    if (!document.body) return false;
    return removeButtonsIn(document);
  };
  const initRemoval = () => {
    removeAll();
  };
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initRemoval, { once: true });
  } else {
    initRemoval();
  }
  if (typeof MutationObserver !== 'function') return;
  const observer = new MutationObserver(mutations => {
    let removed = false;
    mutations.forEach(mutation => {
      mutation.addedNodes && mutation.addedNodes.forEach(node => {
        if (removeButtonsIn(node)) removed = true;
      });
    });
    if (removed) {
      removeAll();
    }
  });
  observer.observe(document.documentElement, {
    childList: true,
    subtree: true
  });
})();

(function () {
  const globalScope = typeof window !== 'undefined' ? window : typeof globalThis !== 'undefined' ? globalThis : null;
  const DEFAULT_APP_MODE = 'default';
  const APP_MODE_ALIASES = {
    task: 'task',
    tasks: 'task',
    oppgave: 'task',
    oppgaver: 'task',
    oppgavemodus: 'task',
    student: 'task',
    elev: 'task',
    default: DEFAULT_APP_MODE,
    standard: DEFAULT_APP_MODE,
    teacher: DEFAULT_APP_MODE,
    undervisning: DEFAULT_APP_MODE,
    edit: DEFAULT_APP_MODE,
    rediger: DEFAULT_APP_MODE,
    author: DEFAULT_APP_MODE,
    editor: DEFAULT_APP_MODE
  };
  const originalSplitSideWidths = new WeakMap();
  let currentAppMode = DEFAULT_APP_MODE;
  let lastAppliedAppMode = null;
  let splitterObserver = null;
  function normalizeAppMode(value) {
    if (typeof value !== 'string') return null;
    const trimmed = value.trim().toLowerCase();
    if (!trimmed) return null;
    if (APP_MODE_ALIASES[trimmed]) return APP_MODE_ALIASES[trimmed];
    if (trimmed === 'task-mode') return 'task';
    return null;
  }
  function adjustSplitLayoutForMode(isTaskMode) {
    if (typeof document === 'undefined') return;
    const grids = document.querySelectorAll('.grid');
    grids.forEach(grid => {
      if (!(grid instanceof HTMLElement)) return;
      const side = grid.querySelector('.side');
      if (!side) return;
      if (isTaskMode) {
        if (!originalSplitSideWidths.has(grid)) {
          const rect = side.getBoundingClientRect();
          if (rect && Number.isFinite(rect.width) && rect.width > 0) {
            originalSplitSideWidths.set(grid, `${Math.round(rect.width)}px`);
          } else {
            const current = grid.style.getPropertyValue('--side-width');
            originalSplitSideWidths.set(grid, current || '');
          }
        }
        grid.style.setProperty('--side-width', 'min(360px, 100%)');
      } else if (originalSplitSideWidths.has(grid)) {
        const previous = originalSplitSideWidths.get(grid);
        originalSplitSideWidths.delete(grid);
        if (previous) {
          grid.style.setProperty('--side-width', previous);
        } else {
          grid.style.removeProperty('--side-width');
        }
      } else {
        grid.style.removeProperty('--side-width');
      }
    });
  }
  function applyAppMode(mode) {
    if (typeof document === 'undefined') return;
    const body = document.body;
    if (!body) return;
    const normalized = normalizeAppMode(mode) || DEFAULT_APP_MODE;
    if (body.dataset.appMode !== normalized) {
      body.dataset.appMode = normalized;
    }
    const isTaskMode = normalized === 'task';
    adjustSplitLayoutForMode(isTaskMode);
    if (isTaskMode) {
      const raf = typeof window !== 'undefined' && typeof window.requestAnimationFrame === 'function' ? window.requestAnimationFrame : null;
      if (raf) {
        raf(() => adjustSplitLayoutForMode(true));
      } else {
        setTimeout(() => adjustSplitLayoutForMode(true), 16);
      }
    }
    lastAppliedAppMode = normalized;
  }
  function postParentAppMode(mode) {
    if (typeof window === 'undefined') return;
    if (!window.parent || window.parent === window) return;
    try {
      window.parent.postMessage({
        type: 'math-visuals:mode-change',
        mode
      }, '*');
    } catch (error) {}
  }
  function setAppMode(mode, options) {
    const normalized = normalizeAppMode(mode) || DEFAULT_APP_MODE;
    const opts = options && typeof options === 'object' ? options : {};
    const notifyParent = opts.notifyParent !== false;
    const force = opts.force === true;
    const changed = normalized !== currentAppMode;
    currentAppMode = normalized;
    if (force || normalized !== lastAppliedAppMode) {
      applyAppMode(normalized);
    }
    if (notifyParent && (changed || opts.alwaysNotify === true)) {
      postParentAppMode(normalized);
    }
    if ((changed || force) && typeof window !== 'undefined' && typeof window.dispatchEvent === 'function') {
      try {
        window.dispatchEvent(new CustomEvent('math-visuals:app-mode-changed', {
          detail: {
            mode: normalized
          }
        }));
      } catch (error) {}
    }
    return normalized;
  }
  function parseInitialAppMode() {
    if (typeof window === 'undefined') return null;
    try {
      if (typeof URLSearchParams !== 'undefined') {
        const params = new URLSearchParams(window.location && window.location.search ? window.location.search : '');
        const fromQuery = normalizeAppMode(params.get('mode'));
        if (fromQuery) return fromQuery;
      }
    } catch (error) {}
    return null;
  }
  function requestParentAppMode() {
    if (typeof window === 'undefined') return;
    if (!window.parent || window.parent === window) return;
    try {
      window.parent.postMessage({
        type: 'math-visuals:request-mode'
      }, '*');
    } catch (error) {}
  }
  function handleParentMessage(event) {
    if (!event) return;
    const data = event.data;
    if (!data || typeof data !== 'object') return;
    if (data.type === 'math-visuals:mode-change') {
      setAppMode(data.mode, {
        notifyParent: false
      });
    }
  }
  function handleLocalModeEvent(event) {
    if (!event) return;
    const detail = event.detail;
    if (!detail || typeof detail !== 'object') return;
    setAppMode(detail.mode, {
      notifyParent: detail.notifyParent !== false,
      force: detail.force === true
    });
  }
  function ensureSplitterObserver() {
    if (typeof document === 'undefined') return;
    if (typeof MutationObserver !== 'function') return;
    if (splitterObserver) return;
    splitterObserver = new MutationObserver(mutations => {
      if (currentAppMode !== 'task') return;
      let shouldAdjust = false;
      mutations.forEach(mutation => {
        if (shouldAdjust) return;
        if (!mutation.addedNodes) return;
        mutation.addedNodes.forEach(node => {
          if (shouldAdjust) return;
          if (node && node.nodeType === 1) {
            const element = node;
            if (element.classList && element.classList.contains('splitter')) {
              shouldAdjust = true;
              return;
            }
            if (element.querySelector && element.querySelector('.splitter')) {
              shouldAdjust = true;
            }
          }
        });
      });
      if (shouldAdjust) {
        adjustSplitLayoutForMode(true);
      }
    });
    if (!document.body) return;
    splitterObserver.observe(document.body, {
      childList: true,
      subtree: true
    });
  }
  ensureSplitterObserver();
  const initialAppMode = parseInitialAppMode() || DEFAULT_APP_MODE;
  setAppMode(initialAppMode, {
    notifyParent: false,
    force: true
  });
  if (typeof window !== 'undefined') {
    window.addEventListener('message', handleParentMessage);
    window.addEventListener('math-visuals:set-mode', handleLocalModeEvent);
  }
  if (typeof document !== 'undefined') {
    document.addEventListener('math-visuals:set-mode', handleLocalModeEvent);
  }
  if (typeof window !== 'undefined') {
    if (window.parent && window.parent !== window) {
      const request = () => {
        requestParentAppMode();
      };
      if (document && (document.readyState === 'interactive' || document.readyState === 'complete')) {
        request();
      } else if (document) {
        document.addEventListener('DOMContentLoaded', request, {
          once: true
        });
      } else {
        request();
      }
    }
  }
  if (globalScope) {
    globalScope.mathVisuals = globalScope.mathVisuals && typeof globalScope.mathVisuals === 'object' ? globalScope.mathVisuals :
 {};
    globalScope.mathVisuals.applyAppMode = applyAppMode;
    globalScope.mathVisuals.setAppMode = (mode, options) => setAppMode(mode, options);
    globalScope.mathVisuals.getAppMode = () => currentAppMode;
  }
  const MEMORY_STORAGE_WINDOW_PREFIX = '__MATH_VISUALS_STORAGE__:';
  let memoryStorageWindowNameOriginal = null;
  function serializeMemorySnapshot(data) {
    if (!data || data.size === 0) {
      return null;
    }
    const snapshot = {};
    data.forEach((value, key) => {
      snapshot[key] = value;
    });
    return snapshot;
  }
  function readMemorySnapshotFromWindow() {
    if (typeof window === 'undefined') {
      return { data: null, original: '' };
    }
    const current = typeof window.name === 'string' ? window.name : '';
    if (!current.startsWith(MEMORY_STORAGE_WINDOW_PREFIX)) {
      return { data: null, original: current };
    }
    const payload = current.slice(MEMORY_STORAGE_WINDOW_PREFIX.length);
    try {
      const parsed = JSON.parse(payload);
      if (parsed && typeof parsed === 'object') {
        const restored = parsed.data && typeof parsed.data === 'object' ? parsed.data : null;
        const original = typeof parsed.original === 'string' ? parsed.original : '';
        return { data: restored, original };
      }
    } catch (_) {}
    return { data: null, original: '' };
  }
  function writeMemorySnapshotToWindow(snapshot) {
    if (typeof window === 'undefined') return;
    if (!snapshot || (typeof snapshot === 'object' && Object.keys(snapshot).length === 0)) {
      const restore = memoryStorageWindowNameOriginal != null ? memoryStorageWindowNameOriginal : '';
      window.name = restore;
      return;
    }
    const payload = {
      data: snapshot,
      original: memoryStorageWindowNameOriginal != null ? memoryStorageWindowNameOriginal : ''
    };
    try {
      window.name = MEMORY_STORAGE_WINDOW_PREFIX + JSON.stringify(payload);
    } catch (_) {}
  }
  function snapshotFromStorage(store) {
    const snapshot = {};
    if (!store || typeof store.length !== 'number' || typeof store.key !== 'function') {
      return snapshot;
    }
    let total = 0;
    try {
      total = Number(store.length) || 0;
    } catch (_) {
      total = 0;
    }
    for (let i = 0; i < total; i++) {
      let key = null;
      try {
        key = store.key(i);
      } catch (_) {
        key = null;
      }
      if (typeof key !== 'string') continue;
      let value = null;
      try {
        value = store.getItem(key);
      } catch (_) {
        value = null;
      }
      if (value != null) {
        snapshot[key] = value;
      }
    }
    return snapshot;
  }
  function createMemoryStorage(options) {
    const opts = options && typeof options === 'object' ? options : {};
    const data = new Map();
    let suppressNotify = false;
    const notifyChange = () => {
      if (suppressNotify) return;
      if (typeof opts.onChange !== 'function') return;
      opts.onChange(serializeMemorySnapshot(data));
    };
    const api = {
      get length() {
        return data.size;
      },
      key(index) {
        if (!Number.isInteger(index) || index < 0) return null;
        if (index >= data.size) return null;
        let i = 0;
        for (const key of data.keys()) {
          if (i === index) return key;
          i++;
        }
        return null;
      },
      getItem(key) {
        if (key == null) return null;
        const normalized = String(key);
        return data.has(normalized) ? data.get(normalized) : null;
      },
      setItem(key, value) {
        if (key == null) return;
        const normalized = String(key);
        data.set(normalized, value == null ? 'null' : String(value));
        notifyChange();
      },
      removeItem(key) {
        if (key == null) return;
        data.delete(String(key));
        notifyChange();
      },
      clear() {
        data.clear();
        notifyChange();
      }
    };
    if (opts.initialData && typeof opts.initialData === 'object') {
      suppressNotify = true;
      try {
        Object.keys(opts.initialData).forEach(key => {
          const normalized = String(key);
          const value = opts.initialData[key];
          data.set(normalized, value == null ? 'null' : String(value));
        });
      } catch (_) {}
      suppressNotify = false;
    }
    return api;
  }
  function createSessionFallbackStorage() {
    if (typeof sessionStorage === 'undefined') return null;
    try {
      const testKey = '__examples_session_test__';
      sessionStorage.setItem(testKey, '1');
      sessionStorage.removeItem(testKey);
    } catch (_) {
      return null;
    }
    return {
      get length() {
        try {
          const value = sessionStorage.length;
          return typeof value === 'number' ? value : 0;
        } catch (_) {
          return 0;
        }
      },
      key(index) {
        try {
          return sessionStorage.key(index);
        } catch (_) {
          return null;
        }
      },
      getItem(key) {
        try {
          return sessionStorage.getItem(key);
        } catch (_) {
          return null;
        }
      },
      setItem(key, value) {
        try {
          sessionStorage.setItem(key, value);
        } catch (error) {
          throw error;
        }
      },
      removeItem(key) {
        try {
          sessionStorage.removeItem(key);
        } catch (error) {
          throw error;
        }
      },
      clear() {
        try {
          sessionStorage.clear();
        } catch (error) {
          throw error;
        }
      }
    };
  }
  let fallbackStorage = null;
  let fallbackStorageMode = 'memory';
  let fallbackStorageInitialized = false;
  let suppressMemoryFallbackNotice = false;
  let memoryFallbackNoticePending = false;
  let memoryFallbackNoticeRendered = false;
  let memoryFallbackNoticeElement = null;
  let memoryFallbackNoticeRenderTimeout = null;
  let memoryFallbackNoticeDomReadyHandler = null;
  function applyFallbackStorage(store, mode) {
    fallbackStorage = store;
    fallbackStorageMode = mode === 'session' ? 'session' : 'memory';
    if (globalScope) {
      globalScope.__EXAMPLES_FALLBACK_STORAGE__ = store;
      globalScope.__EXAMPLES_FALLBACK_STORAGE_MODE__ = fallbackStorageMode;
    }
    if (fallbackStorageMode === 'memory' && !suppressMemoryFallbackNotice) {
      scheduleMemoryFallbackNotice();
    }
    return fallbackStorage;
  }
  function initializeFallbackStorage() {
    if (fallbackStorageInitialized) {
      return fallbackStorage;
    }
    fallbackStorageInitialized = true;
    if (globalScope && globalScope.__EXAMPLES_FALLBACK_STORAGE__ && typeof globalScope.__EXAMPLES_FALLBACK_STORAGE__.getItem === 'function') {
      const existing = globalScope.__EXAMPLES_FALLBACK_STORAGE__;
      const mode = globalScope.__EXAMPLES_FALLBACK_STORAGE_MODE__ === 'session' ? 'session' : 'memory';
      if (mode === 'memory') {
        const snapshot = snapshotFromStorage(existing);
        const store = createMemoryStorage({
          initialData: snapshot,
          onChange: writeMemorySnapshotToWindow
        });
        return applyFallbackStorage(store, 'memory');
      }
      return applyFallbackStorage(existing, mode);
    }
    const sessionStore = createSessionFallbackStorage();
    if (sessionStore) {
      return applyFallbackStorage(sessionStore, 'session');
    }
    const { data: initialSnapshot, original } = readMemorySnapshotFromWindow();
    memoryStorageWindowNameOriginal = original;
    const memoryStore = createMemoryStorage({
      initialData: initialSnapshot,
      onChange: writeMemorySnapshotToWindow
    });
    writeMemorySnapshotToWindow(initialSnapshot);
    return applyFallbackStorage(memoryStore, 'memory');
  }
  initializeFallbackStorage();
  let usingFallbackStorage = false;
  let updateRestoreButtonState = () => {};
  function ensureFallbackStorage() {
    const target = initializeFallbackStorage() || createMemoryStorage();
    if (!usingFallbackStorage) {
      usingFallbackStorage = true;
      let localStorageAvailable = false;
      try {
        localStorageAvailable = typeof localStorage !== 'undefined';
      } catch (_) {
        localStorageAvailable = false;
      }
      if (localStorageAvailable) {
        try {
          const total = Number(localStorage.length) || 0;
          for (let i = 0; i < total; i++) {
            let key = null;
            try {
              key = localStorage.key(i);
            } catch (_) {
              key = null;
            }
            if (!key) continue;
            try {
              const value = localStorage.getItem(key);
              if (value != null) target.setItem(key, value);
            } catch (_) {}
          }
        } catch (_) {}
      }
      if (globalScope) {
        globalScope.__EXAMPLES_STORAGE__ = target;
      }
    }
    return target;
  }
  function copyStorageContents(source, target) {
    if (!source || !target || source === target) return;
    let total = 0;
    try {
      total = Number(source.length) || 0;
    } catch (_) {
      total = 0;
    }
    for (let i = 0; i < total; i++) {
      let key = null;
      try {
        key = source.key(i);
      } catch (_) {
        key = null;
      }
      if (!key) continue;
      try {
        const value = source.getItem(key);
        if (value != null) target.setItem(key, value);
      } catch (_) {}
    }
  }
  function switchToMemoryFallback() {
    const current = initializeFallbackStorage();
    if (fallbackStorageMode === 'memory' && current) {
      return current;
    }
    const memory = createMemoryStorage();
    if (current && typeof current.getItem === 'function') {
      copyStorageContents(current, memory);
    }
    applyFallbackStorage(memory, 'memory');
    if (usingFallbackStorage && globalScope) {
      globalScope.__EXAMPLES_STORAGE__ = memory;
    }
    return memory;
  }
  function trySetItemOn(store, key, value) {
    if (!store || typeof store.setItem !== 'function') return false;
    try {
      store.setItem(key, value);
      return true;
    } catch (error) {
      return false;
    }
  }
  function tryGetItemFrom(store, key) {
    if (!store || typeof store.getItem !== 'function') {
      return { success: false, value: null };
    }
    try {
      return { success: true, value: store.getItem(key) };
    } catch (_) {
      return { success: false, value: null };
    }
  }
  function tryRemoveItemFrom(store, key) {
    if (!store || typeof store.removeItem !== 'function') return false;
    try {
      store.removeItem(key);
      return true;
    } catch (_) {
      return false;
    }
  }
  function safeGetItem(key) {
    if (usingFallbackStorage) {
      const store = initializeFallbackStorage();
      const result = tryGetItemFrom(store, key);
      if (result.success) return result.value;
      const memory = switchToMemoryFallback();
      const fallbackResult = tryGetItemFrom(memory, key);
      return fallbackResult.success ? fallbackResult.value : null;
    }
    try {
      if (typeof localStorage === 'undefined') throw new Error('Storage not available');
      return localStorage.getItem(key);
    } catch (_) {
      const store = ensureFallbackStorage();
      const result = tryGetItemFrom(store, key);
      if (result.success) return result.value;
      const memory = switchToMemoryFallback();
      const fallbackResult = tryGetItemFrom(memory, key);
      return fallbackResult.success ? fallbackResult.value : null;
    }
  }
  function safeSetItem(key, value) {
    if (usingFallbackStorage) {
      const store = initializeFallbackStorage();
      if (trySetItemOn(store, key, value)) return;
      const memory = switchToMemoryFallback();
      trySetItemOn(memory, key, value);
      return;
    }
    try {
      if (typeof localStorage === 'undefined') throw new Error('Storage not available');
      localStorage.setItem(key, value);
    } catch (_) {
      const store = ensureFallbackStorage();
      if (trySetItemOn(store, key, value)) return;
      const memory = switchToMemoryFallback();
      trySetItemOn(memory, key, value);
    }
  }
  function safeRemoveItem(key) {
    if (usingFallbackStorage) {
      const store = initializeFallbackStorage();
      if (tryRemoveItemFrom(store, key)) return;
      const memory = switchToMemoryFallback();
      tryRemoveItemFrom(memory, key);
      return;
    }
    try {
      if (typeof localStorage === 'undefined') throw new Error('Storage not available');
      localStorage.removeItem(key);
    } catch (_) {
      const store = ensureFallbackStorage();
      if (tryRemoveItemFrom(store, key)) return;
      const memory = switchToMemoryFallback();
      tryRemoveItemFrom(memory, key);
    }
  }
  function resolveExamplesApiBase() {
    if (typeof window === 'undefined') return null;
    if (window.MATH_VISUALS_EXAMPLES_API_URL) {
      const value = String(window.MATH_VISUALS_EXAMPLES_API_URL).trim();
      if (value) return value;
    }
    const { location } = window;
    if (!location || typeof location !== 'object') return null;
    const origin = typeof location.origin === 'string' && location.origin ? location.origin : null;
    if (origin && /^https?:/i.test(origin)) {
      return '/api/examples';
    }
    const protocol = typeof location.protocol === 'string' ? location.protocol : '';
    const host = typeof location.host === 'string' ? location.host : '';
    if (protocol && /^https?:$/i.test(protocol) && host) {
      return '/api/examples';
    }
    return null;
  }
  function buildExamplesApiUrl(base, path) {
    if (!base) return null;
    if (typeof window === 'undefined') {
      if (!path) return base;
      const sep = base.includes('?') ? '&' : '?';
      return `${base}${sep}path=${encodeURIComponent(path)}`;
    }
    try {
      const url = new URL(base, window.location && window.location.href ? window.location.href : undefined);
      if (path) {
        url.searchParams.set('path', path);
      }
      return url.toString();
    } catch (error) {
      if (!path) return base;
      const sep = base.includes('?') ? '&' : '?';
      return `${base}${sep}path=${encodeURIComponent(path)}`;
    }
  }
  if (globalScope && !globalScope.__EXAMPLES_STORAGE__) {
    try {
      if (typeof localStorage !== 'undefined') {
        globalScope.__EXAMPLES_STORAGE__ = localStorage;
      } else {
        globalScope.__EXAMPLES_STORAGE__ = fallbackStorage;
        usingFallbackStorage = true;
      }
    } catch (_) {
      globalScope.__EXAMPLES_STORAGE__ = ensureFallbackStorage();
    }
  }
  function normalizePathname(pathname, options) {
    const preserveCase = !!(options && options.preserveCase);
    if (typeof pathname !== 'string') return '/';
    let path = pathname.trim();
    if (!path) return '/';
    if (!path.startsWith('/')) path = '/' + path;
    // Replace backslashes (possible in file:// URLs) and collapse duplicate slashes
    path = path.replace(/\+/g, '/');
    path = path.replace(/\/+/g, '/');
    // Remove trailing index.html or index.htm
    path = path.replace(/\/index\.html?$/i, '/');
    // Treat page.html and page.htm as the same canonical location as /page
    if (/\.html?$/i.test(path)) {
      path = path.replace(/\.html?$/i, '');
      if (!path) path = '/';
    }
    if (path.length > 1 && path.endsWith('/')) {
      path = path.slice(0, -1);
    }
    if (!path) return '/';
    let decoded = path;
    try {
      decoded = decodeURI(path);
    } catch (_) {}
    if (!preserveCase && typeof decoded === 'string') {
      decoded = decoded.toLowerCase();
    }
    let encoded = decoded;
    try {
      encoded = encodeURI(decoded);
    } catch (_) {
      if (preserveCase) {
        encoded = path;
      } else {
        encoded = typeof path === 'string' ? path.toLowerCase() : path;
      }
    }
    if (!encoded) return '/';
    const normalized = encoded.replace(/%[0-9a-f]{2}/gi, match => match.toUpperCase());
    return normalized;
  }
  function computeLegacyStorageKeys(rawPath, canonicalPath) {
    const prefix = 'examples_';
    const canonicalKey = prefix + canonicalPath;
    const paths = new Set();
    const addCandidate = candidate => {
      if (typeof candidate !== 'string') return;
      const trimmed = candidate.trim();
      if (!trimmed) return;
      paths.add(trimmed);
      try {
        const parts = trimmed.split('/');
        const capitalizedParts = parts.map((segment, idx) => {
          if (!segment) return segment;
          if (idx === 0 && segment === '') return segment;
          const first = segment.charAt(0);
          if (!first) return segment;
          const upper = first.toLocaleUpperCase('nb-NO');
          if (upper === first) return segment;
          return upper + segment.slice(1);
        });
        const capitalized = capitalizedParts.join('/');
        if (capitalized && capitalized !== trimmed) {
          paths.add(capitalized);
        }
      } catch (_) {}
      const upperEncoded = trimmed.replace(/%[0-9a-fA-F]{2}/g, match => match.toUpperCase());
      if (upperEncoded && upperEncoded !== trimmed) {
        paths.add(upperEncoded);
      }
      const lowerEncoded = trimmed.replace(/%[0-9a-fA-F]{2}/g, match => match.toLowerCase());
      if (lowerEncoded && lowerEncoded !== trimmed) {
        paths.add(lowerEncoded);
      }
    };
    const addPath = value => {
      if (typeof value !== 'string') return;
      const trimmed = value.trim();
      if (!trimmed) return;
      addCandidate(trimmed);
      const attemptDecoded = decoder => {
        try {
          const decoded = decoder(trimmed);
          if (decoded && decoded !== trimmed) {
            addCandidate(decoded);
            try {
              const reencoded = encodeURI(decoded);
              if (reencoded && reencoded !== trimmed) {
                addCandidate(reencoded);
              }
            } catch (_) {}
          }
        } catch (_) {}
      };
      attemptDecoded(decodeURI);
      attemptDecoded(decodeURIComponent);
    };
    addPath(rawPath);
    if (typeof rawPath === 'string') {
      const trimmed = rawPath.trim();
      if (trimmed) {
        if (trimmed.endsWith('/')) {
          const normalized = trimmed.replace(/\+/g, '/').replace(/\/+/g, '/').replace(/\/+$/, '');
          addPath(normalized);
        } else {
          addPath(trimmed + '/');
        }
        if (/index\.html?$/i.test(trimmed)) {
          addPath(trimmed.replace(/index\.html?$/i, ''));
        } else {
          const base = trimmed.endsWith('/') ? trimmed : trimmed + '/';
          addPath(base + 'index.html');
        }
      }
    }
    addPath(canonicalPath);
    if (canonicalPath && canonicalPath !== '/' && !canonicalPath.endsWith('/')) {
      addPath(canonicalPath + '/');
    }
    if (canonicalPath && canonicalPath !== '/' && !/\.html?$/i.test(canonicalPath)) {
      addPath(`${canonicalPath}.html`);
      addPath(`${canonicalPath}.htm`);
    }
    const canonicalBase = canonicalPath.endsWith('/') ? canonicalPath : `${canonicalPath}/`;
    addPath(canonicalBase + 'index.html');
    const legacyCanonicalPath = normalizePathname(rawPath, { preserveCase: true });
    if (legacyCanonicalPath && legacyCanonicalPath !== canonicalPath) {
      addPath(legacyCanonicalPath);
      if (legacyCanonicalPath !== '/' && !legacyCanonicalPath.endsWith('/')) {
        addPath(`${legacyCanonicalPath}/`);
      }
      if (legacyCanonicalPath !== '/' && !/\.html?$/i.test(legacyCanonicalPath)) {
        addPath(`${legacyCanonicalPath}.html`);
        addPath(`${legacyCanonicalPath}.htm`);
      }
      const legacyBase = legacyCanonicalPath.endsWith('/') ? legacyCanonicalPath : `${legacyCanonicalPath}/`;
      addPath(legacyBase + 'index.html');
    }
    const keys = [];
    paths.forEach(path => {
      if (!path) return;
      const key = prefix + path;
      if (key !== canonicalKey) keys.push(key);
    });
    return keys;
  }
  const rawPath = location && typeof location.pathname === 'string' ? location.pathname : '/';
  const storagePath = normalizePathname(rawPath);
  const key = 'examples_' + storagePath;
  const historyKey = key + '_history';
  const trashKey = key + '_trash';
  const trashMigratedKey = key + '_trash_migrated_v1';
  const MAX_TRASH_ENTRIES = 200;
  const MAX_HISTORY_ENTRIES = 10;
  let lastStoredRawValue = null;
  let historyEntriesCache = null;
  let historyEntriesLoaded = false;
  let trashEntriesCache = null;
  let trashEntriesLoaded = false;
  let trashMigrationAttempted = false;
  function normalizeHistoryEntry(entry) {
    if (!entry || typeof entry !== 'object') return null;
    const raw = typeof entry.data === 'string' ? entry.data.trim() : '';
    if (!raw) return null;
    const normalized = {
      data: raw,
      reason: typeof entry.reason === 'string' && entry.reason.trim() ? entry.reason.trim() : 'unknown',
      savedAt: typeof entry.savedAt === 'string' && entry.savedAt.trim() ? entry.savedAt.trim() : new Date().toISOString()
    };
    return normalized;
  }
  function loadHistoryEntries() {
    if (historyEntriesLoaded) return historyEntriesCache || [];
    historyEntriesLoaded = true;
    historyEntriesCache = [];
    let rawHistory = null;
    try {
      rawHistory = safeGetItem(historyKey);
    } catch (_) {
      rawHistory = null;
    }
    if (typeof rawHistory === 'string' && rawHistory.trim()) {
      try {
        const parsed = JSON.parse(rawHistory);
        if (Array.isArray(parsed)) {
          const entries = [];
          parsed.forEach(item => {
            const normalized = normalizeHistoryEntry(item);
            if (normalized) entries.push(normalized);
          });
          historyEntriesCache = entries.slice(0, MAX_HISTORY_ENTRIES);
        }
      } catch (_) {
        historyEntriesCache = [];
      }
    }
    return historyEntriesCache;
  }
  function persistHistoryEntries(entries) {
    historyEntriesCache = Array.isArray(entries) ? entries.slice(0, MAX_HISTORY_ENTRIES) : [];
    historyEntriesLoaded = true;
    if (!historyEntriesCache.length) {
      try {
        safeRemoveItem(historyKey);
      } catch (_) {}
    } else {
      try {
        safeSetItem(historyKey, JSON.stringify(historyEntriesCache));
      } catch (_) {}
    }
    try {
      updateRestoreButtonState();
    } catch (_) {}
    return historyEntriesCache;
  }
  function rememberHistoryRaw(rawValue, reason) {
    if (typeof rawValue !== 'string') return;
    const trimmed = rawValue.trim();
    if (!trimmed) return;
    const existing = loadHistoryEntries();
    const entries = [];
    const seen = new Set();
    const pushEntry = (entry, defaultReason) => {
      const normalized = normalizeHistoryEntry(entry);
      if (!normalized) return;
      const key = normalized.data;
      if (seen.has(key)) return;
      seen.add(key);
      entries.push({
        data: key,
        reason: normalized.reason || defaultReason || 'unknown',
        savedAt: normalized.savedAt
      });
    };
    pushEntry({
      data: trimmed,
      reason: typeof reason === 'string' && reason.trim() ? reason.trim() : 'unknown',
      savedAt: new Date().toISOString()
    });
    existing.forEach(entry => pushEntry(entry));
    persistHistoryEntries(entries);
  }

  function serializeTrashEntries(entries) {
    const seen = new WeakMap();
    return JSON.stringify(entries, (_, value) => serializeExampleValue(value, seen));
  }

  function deserializeTrashEntries(raw) {
    if (typeof raw !== 'string' || !raw.trim()) {
      return [];
    }
    try {
      const parsed = JSON.parse(raw);
      const value = deserializeExampleValue(parsed, new WeakMap());
      return Array.isArray(value) ? value : [];
    } catch (error) {
      return [];
    }
  }

  function deriveExampleLabel(example) {
    if (!example || typeof example !== 'object') return '';
    if (typeof example.title === 'string' && example.title.trim()) {
      return example.title.trim();
    }
    if (typeof example.exampleNumber === 'string' && example.exampleNumber.trim()) {
      return example.exampleNumber.trim();
    }
    if (typeof example.exampleNumber === 'number' && Number.isFinite(example.exampleNumber)) {
      return String(example.exampleNumber);
    }
    if (typeof example.description === 'string' && example.description.trim()) {
      const condensed = example.description.replace(/\s+/g, ' ').trim();
      if (condensed.length <= 80) return condensed;
      return `${condensed.slice(0, 77)}…`;
    }
    return '';
  }

  function generateTrashId() {
    const rand = Math.random().toString(36).slice(2, 10);
    const timestamp = Date.now().toString(36);
    return `${timestamp}-${rand}`;
  }

  function normalizeTrashEntry(entry) {
    if (!entry || typeof entry !== 'object') return null;
    const normalizedExample = entry.example && typeof entry.example === 'object' ? cloneValue(entry.example) : null;
    if (!normalizedExample) return null;
    const now = new Date().toISOString();
    const label = typeof entry.label === 'string' && entry.label.trim() ? entry.label.trim() : deriveExampleLabel(normalizedExample);
    return {
      id: typeof entry.id === 'string' && entry.id.trim() ? entry.id.trim() : generateTrashId(),
      example: normalizedExample,
      deletedAt: typeof entry.deletedAt === 'string' && entry.deletedAt.trim() ? entry.deletedAt.trim() : now,
      sourcePath: typeof entry.sourcePath === 'string' && entry.sourcePath.trim() ? entry.sourcePath.trim() : storagePath,
      sourceHref: typeof entry.sourceHref === 'string' && entry.sourceHref.trim() ? entry.sourceHref.trim() : rawPath,
      sourceTitle: typeof entry.sourceTitle === 'string' ? entry.sourceTitle : typeof document !== 'undefined' && document.title ? document.title : '',
      reason: typeof entry.reason === 'string' && entry.reason.trim() ? entry.reason.trim() : 'delete',
      removedAtIndex: Number.isInteger(entry.removedAtIndex) ? entry.removedAtIndex : null,
      label,
      importedFromHistory: entry.importedFromHistory === true
    };
  }

  function loadTrashEntries() {
    if (trashEntriesLoaded) return trashEntriesCache || [];
    trashEntriesLoaded = true;
    trashEntriesCache = [];
    let raw = null;
    try {
      raw = safeGetItem(trashKey);
    } catch (_) {
      raw = null;
    }
    if (typeof raw === 'string' && raw.trim()) {
      const parsed = deserializeTrashEntries(raw);
      if (Array.isArray(parsed)) {
        const normalized = [];
        parsed.forEach(item => {
          const normalizedEntry = normalizeTrashEntry(item);
          if (normalizedEntry) normalized.push(normalizedEntry);
        });
        trashEntriesCache = normalized;
      }
    }
    return trashEntriesCache;
  }

  function persistTrashEntries(entries) {
    trashEntriesCache = Array.isArray(entries) ? entries.map(normalizeTrashEntry).filter(Boolean) : [];
    trashEntriesLoaded = true;
    if (!trashEntriesCache.length) {
      try {
        safeRemoveItem(trashKey);
      } catch (_) {}
      return trashEntriesCache;
    }
    try {
      const serialized = serializeTrashEntries(trashEntriesCache);
      safeSetItem(trashKey, serialized);
    } catch (_) {}
    return trashEntriesCache;
  }

  function buildExampleSignature(example) {
    if (!example || typeof example !== 'object') return '';
    try {
      const serialized = serializeExamplesForStorage([example]);
      return serialized || '';
    } catch (error) {
      try {
        return JSON.stringify(example);
      } catch (_) {
        return '';
      }
    }
  }

  function addExampleToTrash(example, options) {
    if (!example || typeof example !== 'object') return;
    const opts = options && typeof options === 'object' ? options : {};
    const normalizedExample = opts.preNormalized === true && example && typeof example === 'object' ? cloneValue(example) : normalizeExamplesForStorage([example])[0] || {};
    if (opts.capturePreview === true) {
      try {
        const previewSvg = collectExampleSvgMarkup();
        const sanitizedPreview = sanitizeSvgForStorage(previewSvg);
        if (sanitizedPreview) {
          normalizedExample.svg = sanitizedPreview;
        }
      } catch (error) {
        console.error('[examples] failed to capture svg preview for trash entry', error);
      }
    }
    const record = normalizeTrashEntry({
      id: typeof opts.id === 'string' && opts.id.trim() ? opts.id.trim() : undefined,
      example: normalizedExample,
      deletedAt: typeof opts.deletedAt === 'string' ? opts.deletedAt : undefined,
      sourcePath: typeof opts.sourcePath === 'string' ? opts.sourcePath : storagePath,
      sourceHref: typeof opts.sourceHref === 'string' ? opts.sourceHref : rawPath,
      sourceTitle: typeof opts.sourceTitle === 'string' ? opts.sourceTitle : undefined,
      reason: typeof opts.reason === 'string' ? opts.reason : 'delete',
      removedAtIndex: Number.isInteger(opts.index) ? opts.index : null,
      label: typeof opts.label === 'string' ? opts.label : undefined,
      importedFromHistory: opts.importedFromHistory === true
    });
    if (!record) return;
    const current = loadTrashEntries().slice();
    if (opts.prepend === false) {
      current.push(record);
    } else {
      current.unshift(record);
    }
    persistTrashEntries(current.slice(0, MAX_TRASH_ENTRIES));
  }

  function ensureTrashHistoryMigration() {
    if (trashMigrationAttempted) return;
    trashMigrationAttempted = true;
    let migrated = false;
    let alreadyMigrated = false;
    try {
      const marker = safeGetItem(trashMigratedKey);
      if (typeof marker === 'string' && marker.trim()) {
        alreadyMigrated = true;
      }
    } catch (_) {
      alreadyMigrated = false;
    }
    if (alreadyMigrated) {
      loadTrashEntries();
      return;
    }
    const existingTrash = loadTrashEntries();
    const seenSignatures = new Set();
    existingTrash.forEach(entry => {
      const signature = buildExampleSignature(entry && entry.example);
      if (signature) seenSignatures.add(signature);
    });
    const currentExamples = getExamples();
    const normalizedCurrent = normalizeExamplesForStorage(currentExamples);
    normalizedCurrent.forEach(example => {
      const signature = buildExampleSignature(example);
      if (signature) seenSignatures.add(signature);
    });
    const historyEntries = loadHistoryEntries();
    historyEntries.forEach(entry => {
      if (!entry || typeof entry.data !== 'string') return;
      const parsed = parseExamplesFromRaw(entry.data);
      if (parsed.status !== 'ok' || !Array.isArray(parsed.examples)) return;
      const normalized = normalizeExamplesForStorage(parsed.examples);
      normalized.forEach((example, idx) => {
        const signature = buildExampleSignature(example);
        if (!signature || seenSignatures.has(signature)) return;
        addExampleToTrash(example, {
          preNormalized: true,
          prepend: false,
          deletedAt: typeof entry.savedAt === 'string' ? entry.savedAt : undefined,
          reason: 'history',
          index: idx,
          importedFromHistory: true
        });
        seenSignatures.add(signature);
        migrated = true;
      });
    });
    if (migrated) {
      const refreshed = loadTrashEntries();
      persistTrashEntries(refreshed.slice(0, MAX_TRASH_ENTRIES));
    }
    try {
      safeSetItem(trashMigratedKey, new Date().toISOString());
    } catch (_) {}
  }
  function parseExamplesFromRaw(rawValue) {
    if (rawValue == null) {
      return {
        status: 'empty',
        examples: []
      };
    }
    if (typeof rawValue !== 'string') {
      return {
        status: 'invalid',
        examples: []
      };
    }
    const trimmed = rawValue.trim();
    if (!trimmed) {
      return {
        status: 'empty',
        examples: []
      };
    }
    try {
      const parsed = deserializeExamplesFromRaw(trimmed);
      if (Array.isArray(parsed)) {
        return {
          status: 'ok',
          examples: parsed
        };
      }
      return {
        status: 'invalid',
        examples: []
      };
    } catch (error) {
      return {
        status: 'error',
        error,
        examples: []
      };
    }
  }
  function getFirstRestorableHistoryEntry() {
    const entries = loadHistoryEntries();
    for (const entry of entries) {
      if (!entry || typeof entry.data !== 'string') continue;
      const parsed = parseExamplesFromRaw(entry.data);
      if (parsed.status === 'ok' && Array.isArray(parsed.examples) && parsed.examples.length > 0) {
        return {
          raw: entry.data,
          entry,
          parsed
        };
      }
    }
    return null;
  }
  function applyRawExamples(rawValue, options) {
    const opts = options && typeof options === 'object' ? options : {};
    const reason = typeof opts.reason === 'string' && opts.reason.trim() ? opts.reason.trim() : 'update';
    const skipHistory = opts.skipHistory === true;
    const skipBackendSync = opts.skipBackendSync === true;
    const normalizedRaw = typeof rawValue === 'string' ? rawValue.trim() : '';
    if (!normalizedRaw) {
      if (!skipHistory && typeof lastStoredRawValue === 'string' && lastStoredRawValue.trim()) {
        rememberHistoryRaw(lastStoredRawValue, reason);
      }
      cachedExamples = [];
      cachedExamplesInitialized = true;
      try {
        safeRemoveItem(key);
      } catch (_) {}
      lastStoredRawValue = null;
      if (skipBackendSync) {
        backendSyncDeferred = true;
      } else {
        backendSyncDeferred = false;
        notifyBackendChange();
      }
      try {
        updateRestoreButtonState();
      } catch (_) {}
      return true;
    }
    const parsed = parseExamplesFromRaw(normalizedRaw);
    if (parsed.status !== 'ok') {
      return false;
    }
    if (!skipHistory && typeof lastStoredRawValue === 'string' && lastStoredRawValue.trim() && lastStoredRawValue.trim() !== normalizedRaw) {
      rememberHistoryRaw(lastStoredRawValue, reason);
    }
    cachedExamples = Array.isArray(parsed.examples) ? parsed.examples : [];
    cachedExamplesInitialized = true;
    try {
      safeSetItem(key, normalizedRaw);
    } catch (_) {}
    lastStoredRawValue = normalizedRaw;
    if (skipBackendSync) {
      backendSyncDeferred = true;
    } else {
      backendSyncDeferred = false;
      notifyBackendChange();
    }
    try {
      updateRestoreButtonState();
    } catch (_) {}
    return true;
  }
  function attemptHistoryRecovery(currentRawValue) {
    const entries = loadHistoryEntries();
    if (!entries || entries.length === 0) return false;
    const currentTrimmed = typeof currentRawValue === 'string' ? currentRawValue.trim() : '';
    for (const entry of entries) {
      if (!entry || typeof entry.data !== 'string') continue;
      const candidateRaw = entry.data.trim();
      if (!candidateRaw) continue;
      const parsed = parseExamplesFromRaw(candidateRaw);
      if (parsed.status !== 'ok') continue;
      if (currentTrimmed && currentTrimmed === candidateRaw) continue;
      if (currentTrimmed) {
        rememberHistoryRaw(currentTrimmed, 'auto-recovery');
      }
      const applied = applyRawExamples(candidateRaw, {
        reason: 'auto-recovery',
        skipHistory: true
      });
      if (applied) {
        cachedExamples = Array.isArray(parsed.examples) ? parsed.examples : [];
        cachedExamplesInitialized = true;
        return true;
      }
    }
    return false;
  }
  function formatHistoryTimestamp(value) {
    if (typeof value !== 'string') return '';
    const trimmed = value.trim();
    if (!trimmed) return '';
    const date = new Date(trimmed);
    if (Number.isNaN(date.getTime())) {
      return trimmed;
    }
    try {
      return date.toLocaleString('nb-NO');
    } catch (_) {
      try {
        return date.toLocaleString();
      } catch (_) {}
    }
    try {
      return date.toISOString();
    } catch (_) {}
    return trimmed;
  }
  const legacyKeys = computeLegacyStorageKeys(rawPath, storagePath);
  try {
    if (typeof localStorage !== 'undefined' || usingFallbackStorage) {
      let canonicalValue = safeGetItem(key);
      if (canonicalValue == null) {
        for (const legacyKey of legacyKeys) {
          const legacyValue = safeGetItem(legacyKey);
          if (legacyValue != null) {
            safeSetItem(key, legacyValue);
            canonicalValue = legacyValue;
            break;
          }
        }
      }
      if (canonicalValue != null) {
        legacyKeys.forEach(legacyKey => {
          if (legacyKey === key) return;
          try {
            const legacyValue = safeGetItem(legacyKey);
            if (legacyValue != null && legacyValue === canonicalValue) {
              safeRemoveItem(legacyKey);
            }
          } catch (_) {}
        });
        if (typeof canonicalValue === 'string') {
          lastStoredRawValue = canonicalValue;
        }
      }
      const deletedKey = key + '_deletedProvidedExamples';
      let canonicalDeletedValue = safeGetItem(deletedKey);
      if (canonicalDeletedValue == null) {
        for (const legacyKey of legacyKeys) {
          const candidate = legacyKey + '_deletedProvidedExamples';
          const legacyValue = safeGetItem(candidate);
          if (legacyValue != null) {
            safeSetItem(deletedKey, legacyValue);
            canonicalDeletedValue = legacyValue;
            break;
          }
        }
      }
      if (canonicalDeletedValue != null) {
        legacyKeys.forEach(legacyKey => {
          const candidate = legacyKey + '_deletedProvidedExamples';
          try {
            const legacyValue = safeGetItem(candidate);
            if (legacyValue != null && legacyValue === canonicalDeletedValue) {
              safeRemoveItem(candidate);
            }
          } catch (_) {}
        });
      }
    }
  } catch (_) {}
  if (lastStoredRawValue == null) {
    try {
      const initialRaw = safeGetItem(key);
      if (typeof initialRaw === 'string') {
        lastStoredRawValue = initialRaw;
      }
    } catch (_) {
      lastStoredRawValue = null;
    }
  }
  const examplesApiBase = resolveExamplesApiBase();
  if (examplesApiBase) {
    setMemoryFallbackNoticeSuppressed(true);
  }
  let backendAvailable = !!examplesApiBase;
  let backendReady = !examplesApiBase;
  let backendSyncDeferred = false;
  let applyingBackendUpdate = false;
  let backendSyncTimer = null;
  let backendSyncPromise = null;
  let backendSyncRequested = false;
  async function performBackendSync() {
    if (!examplesApiBase || applyingBackendUpdate) return;
    const url = buildExamplesApiUrl(examplesApiBase, storagePath);
    if (!url) return;
    const examples = Array.isArray(cachedExamples) ? cachedExamples : [];
    const deletedSet = getDeletedProvidedExamples();
    const deletedProvidedList = deletedSet ? Array.from(deletedSet).map(normalizeKey).filter(Boolean) : [];
    const hasExamples = examples.length > 0;
    const hasDeleted = deletedProvidedList.length > 0;
    try {
      if (!hasExamples && !hasDeleted) {
        const res = await fetch(url, {
          method: 'DELETE'
        });
        backendAvailable = res.ok || res.status === 404;
        if (backendAvailable) {
          setMemoryFallbackNoticeSuppressed(true);
        }
      } else {
        const payload = {
          path: storagePath,
          examples,
          deletedProvided: deletedProvidedList,
          updatedAt: new Date().toISOString()
        };
        const res = await fetch(url, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(payload)
        });
        if (!res.ok) throw new Error(`Backend sync failed (${res.status})`);
        backendAvailable = true;
        setMemoryFallbackNoticeSuppressed(true);
      }
    } catch (error) {
      backendAvailable = false;
      setMemoryFallbackNoticeSuppressed(false);
      backendSyncRequested = true;
    }
  }
  function flushBackendSync() {
    if (backendSyncTimer) {
      clearTimeout(backendSyncTimer);
      backendSyncTimer = null;
    }
    if (!backendSyncRequested || backendSyncPromise || !examplesApiBase || applyingBackendUpdate) {
      return;
    }
    backendSyncRequested = false;
    backendSyncPromise = performBackendSync().finally(() => {
      backendSyncPromise = null;
      if (backendSyncRequested) {
        scheduleBackendSync();
      }
    });
  }
  function scheduleBackendSync() {
    if (!examplesApiBase || applyingBackendUpdate) return;
    backendSyncRequested = true;
    if (backendSyncPromise) return;
    if (backendSyncTimer) return;
    backendSyncTimer = setTimeout(() => {
      backendSyncTimer = null;
      flushBackendSync();
    }, 200);
  }
  function notifyBackendChange() {
    if (!examplesApiBase || applyingBackendUpdate) return;
    scheduleBackendSync();
  }
  function applyBackendData(data) {
    applyingBackendUpdate = true;
    try {
      let examples = data && Array.isArray(data.examples) ? data.examples.map(example => example && typeof example === 'object' ? { ...example } : example) : [];
      const providedDefaults = getProvidedExamples();
      if (Array.isArray(providedDefaults) && providedDefaults.length) {
        const existingKeys = new Set();
        examples.forEach(ex => {
          const key = normalizeKey(ex && ex.__builtinKey);
          if (key) existingKeys.add(key);
        });
        providedDefaults.forEach(ex => {
          if (!ex || typeof ex !== 'object') return;
          const key = normalizeKey(ex.__builtinKey);
          if (key && existingKeys.has(key)) return;
          const copy = {
            config: cloneValue(ex.config),
            svg: typeof ex.svg === 'string' ? ex.svg : ''
          };
          if (key) copy.__builtinKey = key;
          if (typeof ex.title === 'string') copy.title = ex.title;
          if (typeof ex.description === 'string') copy.description = ex.description;
          if (typeof ex.exampleNumber === 'string' || typeof ex.exampleNumber === 'number') {
            copy.exampleNumber = ex.exampleNumber;
          }
          if (ex.isDefault === true) copy.isDefault = true;
          examples.push(copy);
          if (key) existingKeys.add(key);
        });
      }
      const localExamples = getExamples();
      const hasLocalExamples = Array.isArray(localExamples) && localExamples.length > 0;
      let backendUpdatedAtMs = 0;
      if (data && data.updatedAt != null) {
        if (typeof data.updatedAt === 'number' && Number.isFinite(data.updatedAt)) {
          backendUpdatedAtMs = data.updatedAt;
        } else {
          const parsed = Date.parse(data.updatedAt);
          if (Number.isFinite(parsed)) {
            backendUpdatedAtMs = parsed;
          }
        }
      }
      const backendIsStale = backendUpdatedAtMs < lastLocalUpdateMs;
      const shouldApplyExamples = examples.length > 0 || !hasLocalExamples;
      if (shouldApplyExamples && !backendIsStale) {
        store(examples, {
          reason: 'backend-sync'
        });
        if (backendUpdatedAtMs > lastLocalUpdateMs) {
          lastLocalUpdateMs = backendUpdatedAtMs;
        }
      }
      const deletedProvided = data && Array.isArray(data.deletedProvided) ? data.deletedProvided : [];
      if (!backendIsStale) {
        deletedProvidedExamples = new Set();
        deletedProvided.forEach(value => {
          const key = normalizeKey(value);
          if (key) deletedProvidedExamples.add(key);
        });
        if (deletedProvidedExamples.size > 0) {
          safeSetItem(DELETED_PROVIDED_KEY, JSON.stringify(Array.from(deletedProvidedExamples)));
        } else {
          safeRemoveItem(DELETED_PROVIDED_KEY);
        }
      }
    } catch (error) {
      deletedProvidedExamples = deletedProvidedExamples || new Set();
    } finally {
      applyingBackendUpdate = false;
    }
  }
  async function loadExamplesFromBackend() {
    if (!examplesApiBase) return null;
    const url = buildExamplesApiUrl(examplesApiBase, storagePath);
    if (!url) {
      backendReady = true;
      if (backendSyncDeferred) {
        backendSyncDeferred = false;
      }
      return null;
    }
    let backendWasEmpty = false;
    try {
      let res;
      try {
        res = await fetch(url, {
          headers: {
            Accept: 'application/json'
          }
        });
      } catch (error) {
        backendAvailable = false;
        setMemoryFallbackNoticeSuppressed(false);
        return null;
      }
      if (res.status === 404) {
        backendAvailable = true;
        setMemoryFallbackNoticeSuppressed(true);
        backendWasEmpty = true;
        return {
          path: storagePath,
          examples: [],
          deletedProvided: []
        };
      }
      if (!res.ok) {
        backendAvailable = false;
        setMemoryFallbackNoticeSuppressed(false);
        return null;
      }
      let backendData = null;
      try {
        backendData = await res.json();
      } catch (error) {
        backendAvailable = false;
        setMemoryFallbackNoticeSuppressed(false);
        return null;
      }
      backendAvailable = true;
      setMemoryFallbackNoticeSuppressed(true);
      const normalized = backendData || {};
      const backendExamples = Array.isArray(normalized.examples) ? normalized.examples : [];
      const backendDeleted = Array.isArray(normalized.deletedProvided) ? normalized.deletedProvided : [];
      backendWasEmpty = backendExamples.length === 0 && backendDeleted.length === 0;
      applyBackendData(normalized);
      renderOptions();
      scheduleEnsureDefaults({ force: true });
      return normalized;
    } finally {
      backendReady = true;
      if (backendSyncDeferred) {
        if (backendWasEmpty) {
          backendSyncDeferred = false;
          scheduleBackendSync();
        } else if (backendAvailable) {
          backendSyncDeferred = false;
        }
      }
    }
  }
  let initialLoadPerformed = false;
  let currentExampleIndex = null;
  let tabsContainer = null;
  let tabButtons = [];
  let descriptionInput = null;
  const descriptionInputsWithListeners = new WeakSet();
  let descriptionContainer = null;
  let descriptionPreview = null;
  let descriptionRendererPromise = null;
  let lastDescriptionRenderToken = 0;

  function loadDescriptionRenderer() {
    if (typeof window === 'undefined' || typeof document === 'undefined') {
      return Promise.resolve(null);
    }
    if (window.MathVisDescriptionRenderer) {
      return Promise.resolve(window.MathVisDescriptionRenderer);
    }
    if (descriptionRendererPromise) {
      return descriptionRendererPromise;
    }
    descriptionRendererPromise = new Promise((resolve, reject) => {
      const currentScript = document.currentScript;
      let scriptUrl = 'description-renderer.js';
      if (currentScript && currentScript.src) {
        try {
          scriptUrl = new URL('description-renderer.js', currentScript.src).toString();
        } catch (error) {}
      }
      const script = document.createElement('script');
      script.async = true;
      script.src = scriptUrl;
      script.addEventListener('load', () => {
        if (window.MathVisDescriptionRenderer) {
          resolve(window.MathVisDescriptionRenderer);
        } else {
          descriptionRendererPromise = null;
          reject(new Error('Description renderer loaded without exposing the expected global.'));
        }
      }, { once: true });
      script.addEventListener('error', () => {
        descriptionRendererPromise = null;
        reject(new Error('Failed to load description renderer.'));
      }, { once: true });
      document.head.appendChild(script);
    });
    return descriptionRendererPromise;
  }

  if (typeof window !== 'undefined') {
    loadDescriptionRenderer();
  }

  const DESCRIPTION_FALLBACK_FIELDS = [
    'descriptionHtml',
    'descriptionHTML',
    'description_html',
    'descriptionRich',
    'description_rich',
    'descriptionRichText',
    'description_rich_text',
    'richDescription',
    'taskDescription',
    'task_description',
    'taskText',
    'task_text',
    'task',
    'oppgave',
    'oppgavetekst',
    'oppgaveTekst'
  ];

  function normalizeDescriptionString(value) {
    if (typeof value !== 'string') return '';
    const normalized = value
      .replace(/\r\n?/g, '\n')
      .replace(/\u00a0/g, ' ')
      .replace(/[ \t]+\n/g, '\n')
      .replace(/\n{3,}/g, '\n\n');
    return normalized.trim();
  }

  function convertHtmlToPlainText(html) {
    if (typeof html !== 'string') return '';
    const trimmed = html.trim();
    if (!trimmed) return '';
    const sanitized = trimmed
      .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '')
      .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, '');
    const replaced = sanitized
      .replace(/<\s*br\s*\/?>/gi, '\n')
      .replace(/<\s*li\b[^>]*>/gi, '\n- ')
      .replace(/<\/(?:p|div|section|article|li|tr|thead|tbody|tfoot|table|h[1-6])\s*>/gi, '\n');
    if (typeof document !== 'undefined') {
      const container = document.createElement('div');
      container.innerHTML = replaced;
      return normalizeDescriptionString(container.textContent || '');
    }
    const stripped = replaced.replace(/<[^>]+>/g, '');
    return normalizeDescriptionString(stripped);
  }

  function extractDescriptionFromExample(example) {
    if (!example || typeof example !== 'object') return '';
    if (typeof example.description === 'string' && example.description.trim()) {
      return normalizeDescriptionString(example.description);
    }
    for (const key of DESCRIPTION_FALLBACK_FIELDS) {
      if (!Object.prototype.hasOwnProperty.call(example, key)) continue;
      const value = example[key];
      if (typeof value !== 'string') continue;
      if (!value.trim()) continue;
      const processed = /html|rich/i.test(key) ? convertHtmlToPlainText(value) : normalizeDescriptionString(value);
      if (processed) return processed;
    }
    if (typeof example.description === 'string') {
      return normalizeDescriptionString(example.description);
    }
    return '';
  }

  const MAX_SVG_STORAGE_BYTES = 120000;
  function computeByteLength(str) {
    if (typeof str !== 'string') return 0;
    if (typeof TextEncoder === 'function') {
      try {
        return new TextEncoder().encode(str).length;
      } catch (_) {}
    }
    return str.length;
  }
  function sanitizeSvgForStorage(svg) {
    if (typeof svg !== 'string') return '';
    const trimmed = svg.trim();
    if (!trimmed) return '';
    if (computeByteLength(trimmed) <= MAX_SVG_STORAGE_BYTES) {
      return trimmed;
    }
    const normalized = trimmed.replace(/\s{2,}/g, ' ');
    if (computeByteLength(normalized) <= MAX_SVG_STORAGE_BYTES) {
      return normalized;
    }
    return '';
  }
  function normalizeExamplesForStorage(examples) {
    const list = Array.isArray(examples) ? examples : [];
    return list.map(example => {
      const copy = cloneValue(example);
      if (!copy || typeof copy !== 'object') {
        return {};
      }
      const description = extractDescriptionFromExample(copy);
      if (typeof description === 'string') {
        copy.description = description;
      }
      if (copy.description == null) {
        copy.description = '';
      } else if (typeof copy.description === 'string') {
        copy.description = normalizeDescriptionString(copy.description);
      }
      if (copy.svg != null) {
        copy.svg = sanitizeSvgForStorage(copy.svg);
      }
      DESCRIPTION_FALLBACK_FIELDS.forEach(field => {
        if (field !== 'description' && Object.prototype.hasOwnProperty.call(copy, field)) {
          delete copy[field];
        }
      });
      return copy;
    });
  }

  const EXAMPLE_VALUE_TYPE_KEY = '__mathVisualsType__';
  const EXAMPLE_VALUE_DATA_KEY = '__mathVisualsValue__';

  function serializeExampleValue(value, seen) {
    if (value == null) return value;
    const valueType = typeof value;
    if (valueType === 'function' || valueType === 'symbol') return undefined;
    if (valueType !== 'object') return value;
    if (seen.has(value)) return seen.get(value);
    const tag = Object.prototype.toString.call(value);
    if (tag === '[object Map]') {
      const entries = [];
      const marker = {
        [EXAMPLE_VALUE_TYPE_KEY]: 'map',
        [EXAMPLE_VALUE_DATA_KEY]: entries
      };
      seen.set(value, marker);
      value.forEach((entryValue, entryKey) => {
        entries.push([
          serializeExampleValue(entryKey, seen),
          serializeExampleValue(entryValue, seen)
        ]);
      });
      return marker;
    }
    if (tag === '[object Set]') {
      const items = [];
      const marker = {
        [EXAMPLE_VALUE_TYPE_KEY]: 'set',
        [EXAMPLE_VALUE_DATA_KEY]: items
      };
      seen.set(value, marker);
      value.forEach(entryValue => {
        items.push(serializeExampleValue(entryValue, seen));
      });
      return marker;
    }
    if (tag === '[object Date]') {
      return {
        [EXAMPLE_VALUE_TYPE_KEY]: 'date',
        [EXAMPLE_VALUE_DATA_KEY]: value.toISOString()
      };
    }
    if (tag === '[object RegExp]') {
      return {
        [EXAMPLE_VALUE_TYPE_KEY]: 'regexp',
        pattern: value.source,
        flags: value.flags || ''
      };
    }
    if (Array.isArray(value)) {
      const arr = [];
      seen.set(value, arr);
      for (let i = 0; i < value.length; i++) {
        arr[i] = serializeExampleValue(value[i], seen);
      }
      return arr;
    }
    if (value && typeof value === 'object' && Object.prototype.hasOwnProperty.call(value, EXAMPLE_VALUE_TYPE_KEY)) {
      const clone = {};
      seen.set(value, clone);
      Object.keys(value).forEach(key => {
        const encoded = serializeExampleValue(value[key], seen);
        if (encoded !== undefined) {
          clone[key] = encoded;
        }
      });
      return clone;
    }
    const obj = {};
    seen.set(value, obj);
    Object.keys(value).forEach(key => {
      const encoded = serializeExampleValue(value[key], seen);
      if (encoded !== undefined) {
        obj[key] = encoded;
      }
    });
    return obj;
  }

  function deserializeExampleValue(value, seen) {
    if (value == null || typeof value !== 'object') {
      return value;
    }
    if (seen.has(value)) {
      return seen.get(value);
    }
    if (Array.isArray(value)) {
      const arr = [];
      seen.set(value, arr);
      for (let i = 0; i < value.length; i++) {
        arr[i] = deserializeExampleValue(value[i], seen);
      }
      return arr;
    }
    const type = value[EXAMPLE_VALUE_TYPE_KEY];
    if (type === 'map') {
      const result = new Map();
      seen.set(value, result);
      const entries = Array.isArray(value[EXAMPLE_VALUE_DATA_KEY]) ? value[EXAMPLE_VALUE_DATA_KEY] : [];
      entries.forEach(entry => {
        if (!Array.isArray(entry) || entry.length < 2) return;
        const key = deserializeExampleValue(entry[0], seen);
        const entryValue = deserializeExampleValue(entry[1], seen);
        try {
          result.set(key, entryValue);
        } catch (_) {}
      });
      return result;
    }
    if (type === 'set') {
      const result = new Set();
      seen.set(value, result);
      const items = Array.isArray(value[EXAMPLE_VALUE_DATA_KEY]) ? value[EXAMPLE_VALUE_DATA_KEY] : [];
      items.forEach(item => {
        result.add(deserializeExampleValue(item, seen));
      });
      return result;
    }
    if (type === 'date') {
      const isoValue = value[EXAMPLE_VALUE_DATA_KEY];
      const date = typeof isoValue === 'string' ? new Date(isoValue) : new Date(NaN);
      return date;
    }
    if (type === 'regexp') {
      const pattern = typeof value.pattern === 'string' ? value.pattern : '';
      const flags = typeof value.flags === 'string' ? value.flags : '';
      try {
        return new RegExp(pattern, flags);
      } catch (_) {
        try {
          return new RegExp(pattern);
        } catch (_) {
          return new RegExp('');
        }
      }
    }
    const obj = {};
    seen.set(value, obj);
    Object.keys(value).forEach(key => {
      obj[key] = deserializeExampleValue(value[key], seen);
    });
    return obj;
  }

  function serializeExamplesForStorage(examples) {
    const seen = new WeakMap();
    return JSON.stringify(examples, (_, value) => serializeExampleValue(value, seen));
  }

  function deserializeExamplesFromRaw(raw) {
    try {
      const parsed = JSON.parse(raw);
      return deserializeExampleValue(parsed, new WeakMap());
    } catch (error) {
      throw error;
    }
  }

  function getDescriptionContainer() {
    if (descriptionContainer && descriptionContainer.isConnected) return descriptionContainer;
    if (typeof document === 'undefined') return null;
    const container = document.querySelector('.example-description');
    if (container instanceof HTMLElement) {
      descriptionContainer = container;
      return container;
    }
    descriptionContainer = null;
    return null;
  }

  function getDescriptionPreviewElement() {
    if (descriptionPreview && descriptionPreview.isConnected) return descriptionPreview;
    const container = getDescriptionContainer();
    if (!container) return null;
    let preview = container.querySelector('.example-description-preview');
    if (!(preview instanceof HTMLElement)) {
      preview = document.createElement('div');
      preview.className = 'example-description-preview';
      preview.setAttribute('aria-hidden', 'true');
      preview.dataset.empty = 'true';
      container.appendChild(preview);
    }
    descriptionPreview = preview;
    return preview;
  }

  function clearChildren(node) {
    if (!node) return;
    while (node.firstChild) {
      node.removeChild(node.firstChild);
    }
  }

  function appendDescriptionText(fragment, text) {
    if (!fragment || typeof fragment.appendChild !== 'function') return;
    if (typeof text !== 'string') return;
    const normalized = text.replace(/\r\n?/g, '\n');
    const paragraphs = normalized.split(/\n{2,}/);
    paragraphs.forEach(paragraph => {
      if (!paragraph.trim()) return;
      const lines = paragraph.split('\n');
      const p = document.createElement('p');
      lines.forEach((line, index) => {
        p.appendChild(document.createTextNode(line));
        if (index < lines.length - 1) {
          p.appendChild(document.createElement('br'));
        }
      });
      fragment.appendChild(p);
    });
  }

  function createDescriptionTable(content) {
    if (typeof content !== 'string') return null;
    const normalized = content.replace(/\r\n?/g, '\n').trim();
    if (!normalized) return null;
    const lines = normalized
      .split('\n')
      .map(line => line.trim())
      .filter(line => line);
    if (!lines.length) return null;
    const rows = lines.map(line => line.split('|').map(cell => cell.trim()));
    const columnCount = rows.reduce((max, row) => (row.length > max ? row.length : max), 0);
    if (!columnCount) return null;
    const table = document.createElement('table');
    table.className = 'example-description-table';
    let bodyStartIndex = 0;
    if (rows.length > 1) {
      const thead = document.createElement('thead');
      const headRow = document.createElement('tr');
      for (let i = 0; i < columnCount; i++) {
        const th = document.createElement('th');
        th.textContent = rows[0][i] != null ? rows[0][i] : '';
        headRow.appendChild(th);
      }
      thead.appendChild(headRow);
      table.appendChild(thead);
      bodyStartIndex = 1;
    }
    const tbody = document.createElement('tbody');
    const appendRow = row => {
      const tr = document.createElement('tr');
      for (let i = 0; i < columnCount; i++) {
        const cell = document.createElement('td');
        cell.textContent = row && row[i] != null ? row[i] : '';
        tr.appendChild(cell);
      }
      tbody.appendChild(tr);
    };
    if (rows.length === 1) {
      appendRow(rows[0]);
    } else {
      for (let i = bodyStartIndex; i < rows.length; i++) {
        appendRow(rows[i]);
      }
    }
    table.appendChild(tbody);
    return table;
  }

  function buildDescriptionPreview(value) {
    const fragment = document.createDocumentFragment();
    if (typeof value !== 'string') return fragment;
    const normalized = value.replace(/\r\n?/g, '\n');
    const pattern = /@table\s*\{([\s\S]*?)\}/gi;
    let lastIndex = 0;
    let match = null;
    while ((match = pattern.exec(normalized)) !== null) {
      const before = normalized.slice(lastIndex, match.index);
      appendDescriptionText(fragment, before);
      const table = createDescriptionTable(match[1]);
      if (table) {
        fragment.appendChild(table);
      } else {
        appendDescriptionText(fragment, match[0]);
      }
      lastIndex = pattern.lastIndex;
    }
    const after = normalized.slice(lastIndex);
    appendDescriptionText(fragment, after);
    return fragment;
  }

  let lastRenderedDescriptionValue = null;

  function renderDescriptionPreviewFromValue(value, options) {
    const preview = getDescriptionPreviewElement();
    if (!preview) return;
    preview.classList.add('math-vis-description-rendered');
    const opts = options && typeof options === 'object' ? options : {};
    const force = opts.force === true;
    const stringValue = typeof value === 'string' ? value : '';
    if (!force && stringValue === lastRenderedDescriptionValue) {
      return preview.dataset.empty !== 'true';
    }
    const applyState = hasContent => {
      const emptyValue = hasContent ? 'false' : 'true';
      preview.dataset.empty = emptyValue;
      if (hasContent) {
        preview.removeAttribute('hidden');
        preview.setAttribute('aria-hidden', 'false');
      } else {
        preview.setAttribute('hidden', '');
        preview.setAttribute('aria-hidden', 'true');
      }
    };
    const markRendered = hasContent => {
      lastRenderedDescriptionValue = stringValue;
      return hasContent;
    };
    const renderLegacy = () => {
      clearChildren(preview);
      const fragment = buildDescriptionPreview(stringValue);
      const hasContent = fragment && fragment.childNodes && fragment.childNodes.length > 0;
      if (hasContent) {
        preview.appendChild(fragment);
      }
      applyState(hasContent);
      return markRendered(hasContent);
    };
    const token = ++lastDescriptionRenderToken;
    const renderWith = renderer => {
      if (!renderer || token !== lastDescriptionRenderToken) return;
      try {
        const hasContent = !!renderer.renderInto(preview, stringValue);
        applyState(hasContent);
        markRendered(hasContent);
      } catch (error) {
        if (token === lastDescriptionRenderToken) {
          renderLegacy();
        }
      }
    };

    if (window.MathVisDescriptionRenderer && typeof window.MathVisDescriptionRenderer.renderInto === 'function') {
      renderWith(window.MathVisDescriptionRenderer);
      return;
    }

    const loader = loadDescriptionRenderer();
    if (!loader || typeof loader.then !== 'function') {
      renderLegacy();
      return;
    }
    loader
      .then(renderer => {
        if (token !== lastDescriptionRenderToken) return;
        if (renderer && typeof renderer.renderInto === 'function') {
          renderWith(renderer);
        } else {
          renderLegacy();
        }
      })
      .catch(() => {
        if (token === lastDescriptionRenderToken) {
          renderLegacy();
        }
      });
  }

  function updateDescriptionCollapsedState(target) {
    const input = target && target.nodeType === 1 ? target : getDescriptionInput();
    if (!input || typeof input.value !== 'string') return;
    const container = input.closest('.example-description');
    if (!container) return;
    const isFocused = document.activeElement === input;
    const shouldCollapse = !isFocused && input.value.trim() === '';
    container.classList.toggle('example-description--collapsed', shouldCollapse);
  }

  function ensureDescriptionListeners(input) {
    if (!input || descriptionInputsWithListeners.has(input)) return;
    descriptionInputsWithListeners.add(input);
    const update = () => {
      updateDescriptionCollapsedState(input);
      renderDescriptionPreviewFromValue(input.value);
    };
    input.addEventListener('input', update);
    input.addEventListener('change', update);
    input.addEventListener('focus', update);
    input.addEventListener('blur', update);
    setTimeout(update, 0);
  }

  function getDescriptionInput() {
    if (descriptionInput && descriptionInput.isConnected) return descriptionInput;
    descriptionInput = document.getElementById('exampleDescription');
    if (descriptionInput) ensureDescriptionListeners(descriptionInput);
    return descriptionInput || null;
  }
  function getDescriptionValue() {
    const input = getDescriptionInput();
    if (!input) return '';
    const value = input.value;
    return typeof value === 'string' ? value : '';
  }
  function setDescriptionValue(value) {
    const input = getDescriptionInput();
    if (!input) return;
    if (typeof value === 'string') {
      input.value = value;
    } else {
      input.value = '';
    }
    updateDescriptionCollapsedState(input);
    renderDescriptionPreviewFromValue(input.value, { force: true });
  }
  let defaultEnsureScheduled = false;
  let ensureDefaultsRunning = false;
  let tabsHostCard = null;

  function hideMemoryFallbackNotice() {
    if (memoryFallbackNoticeRenderTimeout) {
      clearTimeout(memoryFallbackNoticeRenderTimeout);
      memoryFallbackNoticeRenderTimeout = null;
    }
    if (typeof document !== 'undefined' && memoryFallbackNoticeDomReadyHandler) {
      try {
        document.removeEventListener('DOMContentLoaded', memoryFallbackNoticeDomReadyHandler);
      } catch (_) {}
    }
    memoryFallbackNoticeDomReadyHandler = null;
    memoryFallbackNoticePending = false;
    memoryFallbackNoticeRendered = false;
    if (memoryFallbackNoticeElement) {
      try {
        if (typeof memoryFallbackNoticeElement.remove === 'function') {
          memoryFallbackNoticeElement.remove();
        } else if (memoryFallbackNoticeElement.parentElement) {
          memoryFallbackNoticeElement.parentElement.removeChild(memoryFallbackNoticeElement);
        }
      } catch (_) {
        if (memoryFallbackNoticeElement.parentElement) {
          try {
            memoryFallbackNoticeElement.parentElement.removeChild(memoryFallbackNoticeElement);
          } catch (_) {}
        }
      }
      try {
        memoryFallbackNoticeElement.hidden = true;
      } catch (_) {}
    }
    memoryFallbackNoticeElement = null;
  }

  function setMemoryFallbackNoticeSuppressed(value) {
    const next = value === true;
    if (next === suppressMemoryFallbackNotice) return;
    suppressMemoryFallbackNotice = next;
    if (next) {
      hideMemoryFallbackNotice();
    } else if (fallbackStorageMode === 'memory' && usingFallbackStorage) {
      scheduleMemoryFallbackNotice();
    }
  }

  function resolveMemoryFallbackNoticeHost() {
    if (memoryFallbackNoticeElement && memoryFallbackNoticeElement.isConnected) {
      return memoryFallbackNoticeElement.parentElement;
    }
    if (tabsContainer && tabsContainer.parentElement) {
      return tabsContainer.parentElement;
    }
    if (tabsHostCard && tabsHostCard.isConnected) {
      return tabsHostCard;
    }
    if (typeof document === 'undefined') return null;
    const card = document.querySelector('.card--examples');
    if (card instanceof HTMLElement) {
      return card;
    }
    const fallbackCard = document.querySelector('.card');
    if (fallbackCard instanceof HTMLElement) {
      return fallbackCard;
    }
    return document.body || null;
  }

  function ensureMemoryFallbackNotice() {
    if (suppressMemoryFallbackNotice) return;
    if (!memoryFallbackNoticePending || memoryFallbackNoticeRendered) return;
    if (typeof document === 'undefined') return;
    const host = resolveMemoryFallbackNoticeHost();
    if (!host) {
      if (!memoryFallbackNoticeRenderTimeout) {
        memoryFallbackNoticeRenderTimeout = setTimeout(() => {
          memoryFallbackNoticeRenderTimeout = null;
          ensureMemoryFallbackNotice();
        }, 100);
      }
      return;
    }
    let notice = memoryFallbackNoticeElement;
    if (!(notice instanceof HTMLElement)) {
      notice = document.createElement('div');
      notice.className = 'example-storage-notice';
      notice.setAttribute('role', 'status');
      notice.setAttribute('aria-live', 'polite');
      const heading = document.createElement('strong');
      heading.className = 'example-storage-notice__title';
      heading.textContent = 'Eksempler lagres midlertidig.';
      const message = document.createElement('span');
      message.className = 'example-storage-notice__message';
      message.textContent = 'Nettleserens lagring er utilgjengelig, så nye eksempler beholdes bare så lenge denne siden er åpen.';
      notice.appendChild(heading);
      notice.appendChild(document.createTextNode(' '));
      notice.appendChild(message);
    }
    notice.hidden = false;
    if (!notice.isConnected) {
      if (host.firstChild) {
        host.insertBefore(notice, host.firstChild);
      } else {
        host.appendChild(notice);
      }
    }
    memoryFallbackNoticeElement = notice;
    memoryFallbackNoticeRendered = true;
    memoryFallbackNoticePending = false;
  }

  function scheduleMemoryFallbackNotice() {
    if (suppressMemoryFallbackNotice) return;
    if (memoryFallbackNoticeRendered) return;
    memoryFallbackNoticePending = true;
    if (typeof document === 'undefined') return;
    if (document.readyState === 'loading') {
      if (!memoryFallbackNoticeDomReadyHandler) {
        memoryFallbackNoticeDomReadyHandler = () => {
          memoryFallbackNoticeDomReadyHandler = null;
          ensureMemoryFallbackNotice();
        };
        document.addEventListener('DOMContentLoaded', memoryFallbackNoticeDomReadyHandler, { once: true });
      }
      return;
    }
    if (memoryFallbackNoticeRenderTimeout) {
      clearTimeout(memoryFallbackNoticeRenderTimeout);
      memoryFallbackNoticeRenderTimeout = null;
    }
    memoryFallbackNoticeRenderTimeout = setTimeout(() => {
      memoryFallbackNoticeRenderTimeout = null;
      ensureMemoryFallbackNotice();
    }, 0);
  }
  const hasUrlOverrides = (() => {
    if (typeof URLSearchParams === 'undefined') return false;
    const search = new URLSearchParams(window.location.search);
    for (const key of search.keys()) {
      if (key === 'example') continue;
      if (/^fun\d+$/i.test(key) || /^dom\d+$/i.test(key)) return true;
      switch (key) {
        case 'coords':
        case 'points':
        case 'startx':
        case 'screen':
        case 'xName':
        case 'yName':
        case 'pan':
        case 'q1':
        case 'lock':
          return true;
        default:
          break;
      }
    }
    return false;
  })();
  if (hasUrlOverrides) {
    initialLoadPerformed = true;
  }
  let cachedExamples = [];
  let cachedExamplesInitialized = false;
  let lastLocalUpdateMs = 0;
  function getExamples() {
    if (!cachedExamplesInitialized) {
      cachedExamplesInitialized = true;
      cachedExamples = [];
    }
    const stored = safeGetItem(key);
    lastStoredRawValue = typeof stored === 'string' ? stored : null;
    if (stored == null) {
      return cachedExamples;
    }
    const parsed = parseExamplesFromRaw(stored);
    if (parsed.status === 'ok') {
      cachedExamples = Array.isArray(parsed.examples) ? parsed.examples : [];
      return cachedExamples;
    }
    if (parsed.status === 'empty') {
      cachedExamples = [];
      return cachedExamples;
    }
    if (attemptHistoryRecovery(stored)) {
      return cachedExamples;
    }
    cachedExamples = [];
    return cachedExamples;
  }
  const USER_INITIATED_REASONS = new Set(['manual-save', 'manual-update', 'delete', 'ensure-default', 'history']);
  function isUserInitiatedReason(reason) {
    return typeof reason === 'string' && USER_INITIATED_REASONS.has(reason);
  }
  function store(examples, options) {
    const normalized = normalizeExamplesForStorage(examples);
    const serialized = serializeExamplesForStorage(normalized);
    const opts = options && typeof options === 'object' ? options : {};
    const reason = typeof opts.reason === 'string' ? opts.reason : '';
    const skipBackendSync = opts.skipBackendSync === true;
    const applied = applyRawExamples(serialized, opts);
    if (applied && isUserInitiatedReason(reason) && !skipBackendSync) {
      lastLocalUpdateMs = Date.now();
    }
  }
  const BINDING_NAMES = ['STATE', 'CFG', 'CONFIG', 'SIMPLE'];
  const DELETED_PROVIDED_KEY = key + '_deletedProvidedExamples';
  let deletedProvidedExamples = null;
  function normalizeKey(value) {
    return (typeof value === 'string' ? value.trim() : '') || '';
  }
  function getDeletedProvidedExamples() {
    if (deletedProvidedExamples) return deletedProvidedExamples;
    deletedProvidedExamples = new Set();
    try {
      const stored = safeGetItem(DELETED_PROVIDED_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed)) {
          parsed.forEach(value => {
            const key = normalizeKey(value);
            if (key) deletedProvidedExamples.add(key);
          });
        }
      }
    } catch (error) {
      deletedProvidedExamples = new Set();
    }
    return deletedProvidedExamples;
  }
  function persistDeletedProvidedExamples() {
    if (!deletedProvidedExamples) return;
    try {
      safeSetItem(DELETED_PROVIDED_KEY, JSON.stringify(Array.from(deletedProvidedExamples)));
    } catch (error) {}
    notifyBackendChange();
  }
  function markProvidedExampleDeleted(value) {
    const key = normalizeKey(value);
    if (!key) return;
    const set = getDeletedProvidedExamples();
    if (!set.has(key)) {
      set.add(key);
      persistDeletedProvidedExamples();
    }
  }
  function flushPendingChanges() {
    const fields = document.querySelectorAll('input, textarea, select');
    fields.forEach(field => {
      ['input', 'change'].forEach(type => {
        try {
          field.dispatchEvent(new Event(type, {
            bubbles: true
          }));
        } catch (_) {}
      });
    });
    const syncFns = ['applyCfg', 'applyConfig'];
    syncFns.forEach(name => {
      const fn = window[name];
      if (typeof fn === 'function') {
        try {
          fn();
        } catch (_) {}
      }
    });
  }
  function collectExampleSvgMarkup(options) {
    if (typeof document === 'undefined') return '';
    const opts = options && typeof options === 'object' ? options : {};
    if (opts.flush !== false) {
      try {
        flushPendingChanges();
      } catch (_) {}
    }
    const detail = { svgOverride: null };
    if (typeof window !== 'undefined' && window) {
      try {
        let evt;
        if (typeof CustomEvent === 'function') {
          evt = new CustomEvent('examples:collect', {
            detail
          });
        } else {
          evt = new Event('examples:collect');
          try {
            evt.detail = detail;
          } catch (_) {}
        }
        window.dispatchEvent(evt);
      } catch (error) {
        try {
          const evt = new Event('examples:collect');
          try {
            evt.detail = detail;
          } catch (_) {}
          window.dispatchEvent(evt);
        } catch (_) {}
      }
    }
    let svgMarkup = '';
    const override = detail.svgOverride;
    if (override != null) {
      if (typeof override === 'string') {
        svgMarkup = override;
      } else if (override && typeof override.outerHTML === 'string') {
        svgMarkup = override.outerHTML;
      }
    }
    if (!svgMarkup) {
      const svg = document.querySelector('svg');
      if (svg && typeof svg.outerHTML === 'string') {
        svgMarkup = svg.outerHTML;
      }
    }
    return typeof svgMarkup === 'string' ? svgMarkup : '';
  }
  function ensureTabStyles() {
    if (document.getElementById('exampleTabStyles')) return;
    const style = document.createElement('style');
    style.id = 'exampleTabStyles';
    style.textContent = `
.example-tabs{display:flex;flex-wrap:wrap;gap:6px;margin-top:10px;margin-bottom:0;align-items:flex-end;padding-bottom:0;}
.example-tab{appearance:none;border:1px solid #d1d5db;border-bottom:none;background:#f3f4f6;color:#374151;border-radius:10px 10px 0 0;padding:6px 14px;font-size:14px;line-height:1;cursor:pointer;transition:background-color .2s,border-color .2s,color .2s;box-shadow:0 -1px 0 rgba(15,23,42,.08) inset;margin-bottom:-1px;}
.example-tab:hover{background:#e5e7eb;}
.example-tab.is-active{background:#fff;color:#111827;border-color:var(--purple,#5B2AA5);border-bottom:1px solid #fff;box-shadow:0 -2px 0 var(--purple,#5B2AA5) inset;}
.example-tab:focus-visible{outline:2px solid var(--purple,#5B2AA5);outline-offset:2px;}
.example-tabs-empty{font-size:13px;color:#6b7280;padding:6px 0;}
.example-storage-notice{margin-top:12px;margin-bottom:12px;padding:10px 14px;border-radius:10px;background:#fef3c7;border:1px solid #fcd34d;color:#92400e;font-size:14px;line-height:1.4;display:flex;flex-wrap:wrap;gap:4px;align-items:center;}
.example-storage-notice__title{font-weight:600;display:inline-flex;align-items:center;}
.example-storage-notice__message{display:inline-flex;align-items:center;}
.card-has-settings .example-settings{margin-top:6px;padding-top:12px;border-top:1px solid #e5e7eb;display:flex;flex-direction:column;gap:10px;}
.card-has-settings .example-settings > .example-tabs{margin-top:0;margin-bottom:0;}
.card-has-settings .example-settings > h2:first-child{margin-top:0;}
.card-has-settings .example-settings > .example-tabs + h2{margin-top:0;}
`;
    document.head.appendChild(style);
  }
  function placeTabsInsideSettings(exampleCard) {
    if (!tabsContainer || !exampleCard) return;
    const settingsWrapper = exampleCard.querySelector(':scope > .example-settings');
    if (!settingsWrapper) return;
    let firstChild = settingsWrapper.firstChild;
    if (firstChild === tabsContainer) return;
    tabsContainer.remove();
    while (firstChild && firstChild.nodeType === Node.TEXT_NODE && !firstChild.textContent.trim()) {
      const toRemove = firstChild;
      firstChild = firstChild.nextSibling;
      settingsWrapper.removeChild(toRemove);
    }
    settingsWrapper.insertBefore(tabsContainer, firstChild);
  }
  function adjustTabsSpacing() {
    if (!tabsContainer) return;
    const parent = tabsContainer.parentElement;
    if (parent && parent.classList && parent.classList.contains('example-settings')) {
      tabsContainer.style.marginTop = '0';
      tabsContainer.style.marginBottom = '0';
    } else {
      tabsContainer.style.removeProperty('margin-top');
      tabsContainer.style.removeProperty('margin-bottom');
    }
  }
  function moveDescriptionBelowTabs() {
    if (!tabsContainer) return;
    const description = document.querySelector('.example-description');
    if (!description || !description.parentElement) return;
    const settingsWrapper = tabsContainer.closest('.example-settings');
    const targetParent = settingsWrapper || tabsContainer.parentElement;
    if (!targetParent) return;
    let referenceNode = tabsContainer.nextSibling;
    while (referenceNode && referenceNode.nodeType === Node.TEXT_NODE && !referenceNode.textContent.trim()) {
      referenceNode = referenceNode.nextSibling;
    }
    if (referenceNode === description) return;
    if (description.parentElement !== targetParent) {
      if (referenceNode) {
        targetParent.insertBefore(description, referenceNode);
      } else {
        targetParent.appendChild(description);
      }
      return;
    }
    if (referenceNode) {
      targetParent.insertBefore(description, referenceNode);
    } else {
      targetParent.appendChild(description);
    }
  }
  function moveSettingsIntoExampleCard() {
    if (!toolbar) return;
    const exampleCard = toolbar.closest('.card');
    if (!exampleCard) return;
    tabsHostCard = exampleCard;
    if (!exampleCard.classList.contains('card-has-settings')) {
      let candidate = exampleCard.nextElementSibling;
      let settingsCard = null;
      while (candidate) {
        if (candidate.nodeType !== Node.ELEMENT_NODE) {
          candidate = candidate.nextElementSibling;
          continue;
        }
        if (!candidate.classList.contains('card')) {
          candidate = candidate.nextElementSibling;
          continue;
        }
        if (candidate.classList.contains('card--settings') || candidate.getAttribute('data-card') === 'settings') {
          settingsCard = candidate;
          break;
        }
        const heading = candidate.querySelector(':scope > h2');
        const text = heading ? heading.textContent.trim().toLowerCase() : '';
        if (text === 'innstillinger' || text === 'innstilling') {
          settingsCard = candidate;
          break;
        }
        candidate = candidate.nextElementSibling;
      }
      if (settingsCard) {
        const settingsWrapper = document.createElement('div');
        settingsWrapper.className = 'example-settings';
        while (settingsCard.firstChild) {
          settingsWrapper.appendChild(settingsCard.firstChild);
        }
        exampleCard.appendChild(settingsWrapper);
        settingsCard.remove();
        exampleCard.classList.add('card-has-settings');
      }
    }
    placeTabsInsideSettings(exampleCard);
    adjustTabsSpacing();
    moveDescriptionBelowTabs();
  }
  function getBinding(name) {
    if (name in window && window[name]) return window[name];
    try {
      switch (name) {
        case 'STATE':
          return typeof STATE !== 'undefined' && STATE ? STATE : undefined;
        case 'CFG':
          return typeof CFG !== 'undefined' && CFG ? CFG : undefined;
        case 'CONFIG':
          return typeof CONFIG !== 'undefined' && CONFIG ? CONFIG : undefined;
        case 'SIMPLE':
          return typeof SIMPLE !== 'undefined' && SIMPLE ? SIMPLE : undefined;
        default:
          return undefined;
      }
    } catch (error) {
      return undefined;
    }
  }
  function valueRequiresCustomClone(value, seen) {
    if (value == null || typeof value !== 'object') return false;
    if (seen.has(value)) return false;
    seen.add(value);
    const tag = Object.prototype.toString.call(value);
    if (tag === '[object Map]' || tag === '[object Set]' || tag === '[object Date]' || tag === '[object RegExp]') {
      return true;
    }
    if (Array.isArray(value)) {
      for (let i = 0; i < value.length; i++) {
        if (valueRequiresCustomClone(value[i], seen)) {
          return true;
        }
      }
      return false;
    }
    const keys = Object.keys(value);
    for (let i = 0; i < keys.length; i++) {
      const key = keys[i];
      if (valueRequiresCustomClone(value[key], seen)) {
        return true;
      }
    }
    return false;
  }
  function cloneValue(value) {
    if (value == null) return value;
    if (typeof structuredClone === 'function') {
      try {
        return structuredClone(value);
      } catch (error) {}
    }
    if (!valueRequiresCustomClone(value, new WeakSet())) {
      try {
        return JSON.parse(JSON.stringify(value));
      } catch (error) {}
    }
    return cloneValueFallback(value, new WeakMap());
  }
  function cloneValueFallback(value, seen) {
    if (value == null || typeof value !== 'object') return value;
    if (seen.has(value)) return seen.get(value);
    if (Array.isArray(value)) {
      const arr = [];
      seen.set(value, arr);
      for (let i = 0; i < value.length; i++) {
        arr[i] = cloneValueFallback(value[i], seen);
      }
      return arr;
    }
    const tag = Object.prototype.toString.call(value);
    if (tag === '[object Date]') {
      return new Date(value.getTime());
    }
    if (tag === '[object RegExp]') {
      return new RegExp(value);
    }
    if (tag === '[object Map]') {
      const map = new Map();
      seen.set(value, map);
      value.forEach((v, k) => {
        map.set(cloneValueFallback(k, seen), cloneValueFallback(v, seen));
      });
      return map;
    }
    if (tag === '[object Set]') {
      const set = new Set();
      seen.set(value, set);
      value.forEach(v => {
        set.add(cloneValueFallback(v, seen));
      });
      return set;
    }
    if (tag !== '[object Object]') {
      return value;
    }
    const clone = {};
    seen.set(value, clone);
    Object.keys(value).forEach(key => {
      clone[key] = cloneValueFallback(value[key], seen);
    });
    return clone;
  }
  function sanitizeProvidedExample(example, idx) {
    if (!example || typeof example !== 'object') return null;
    const sourceConfig = example.config;
    if (!sourceConfig || typeof sourceConfig !== 'object') return null;
    const config = {};
    for (const name of BINDING_NAMES) {
      if (sourceConfig[name] != null) {
        config[name] = cloneValue(sourceConfig[name]);
      }
    }
    if (Object.keys(config).length === 0) return null;
    const sanitized = {
      config
    };
    if (typeof example.svg === 'string') sanitized.svg = example.svg;
    if (typeof example.title === 'string') sanitized.title = example.title;
    const providedDescription = extractDescriptionFromExample(example);
    if (typeof providedDescription === 'string') {
      sanitized.description = providedDescription;
    }
    if (typeof example.exampleNumber === 'string' || typeof example.exampleNumber === 'number') {
      sanitized.exampleNumber = String(example.exampleNumber).trim();
    } else if (typeof example.label === 'string') {
      sanitized.exampleNumber = example.label.trim();
    }
    if (example.isDefault === true) sanitized.isDefault = true;
    if (typeof example.id === 'string' && example.id.trim().length) {
      sanitized.__builtinKey = example.id.trim();
    } else {
      sanitized.__builtinKey = `provided-${idx}`;
    }
    return sanitized;
  }
  function getProvidedExamples() {
    if (typeof window === 'undefined') return [];
    const provided = window.DEFAULT_EXAMPLES;
    if (!Array.isArray(provided)) return [];
    const sanitized = [];
    provided.forEach((ex, idx) => {
      const normalized = sanitizeProvidedExample(ex, idx);
      if (normalized) sanitized.push(normalized);
    });
    if (sanitized.length > 0 && !sanitized.some(ex => ex.isDefault)) {
      sanitized[0].isDefault = true;
    }
    return sanitized;
  }
  function replaceContents(target, source) {
    if (!target || source == null) return false;
    if (Array.isArray(target) && Array.isArray(source)) {
      target.length = 0;
      target.push(...source);
      return true;
    }
    if (typeof target === 'object' && typeof source === 'object') {
      Object.keys(target).forEach(key => {
        if (!Object.prototype.hasOwnProperty.call(source, key)) delete target[key];
      });
      Object.assign(target, source);
      return true;
    }
    return false;
  }
  function applyBinding(name, value) {
    if (value == null) return;
    const applyToTarget = target => {
      if (!target) return false;
      const cloned = cloneValue(value);
      return replaceContents(target, cloned);
    };
    const target = getBinding(name);
    if (applyToTarget(target)) {
      if (name in window && window[name] !== target) {
        window[name] = target;
      }
      return;
    }
    const winVal = name in window ? window[name] : undefined;
    if (applyToTarget(winVal)) return;
    window[name] = cloneValue(value);
  }
  function triggerRefresh(index) {
    const tried = new Set();
    const candidates = ['render', 'renderAll', 'draw', 'drawAll', 'update', 'updateAll', 'init', 'initAll', 'initFromCfg', 'initFromHtml', 'refresh', 'redraw', 'rerender', 'recalc', 'applyCfg', 'applyConfig', 'applyState', 'setup', 'rebuild'];
    for (const name of candidates) {
      const fn = window[name];
      if (typeof fn === 'function' && !tried.has(fn)) {
        try {
          fn();
        } catch (_) {}
        tried.add(fn);
      }
    }
    let dispatched = false;
    if (typeof CustomEvent === 'function') {
      try {
        window.dispatchEvent(new CustomEvent('examples:loaded', {
          detail: {
            index
          }
        }));
        dispatched = true;
      } catch (_) {}
    }
    if (!dispatched) {
      try {
        window.dispatchEvent(new Event('examples:loaded'));
      } catch (_) {}
    }
  }
  function collectConfig() {
    flushPendingChanges();
    const svgMarkup = collectExampleSvgMarkup({ flush: false });
    const cfg = {};
    for (const name of BINDING_NAMES) {
      const binding = getBinding(name);
      if (binding != null && typeof binding !== 'function') {
        cfg[name] = cloneValue(binding);
      }
    }
    return {
      config: cfg,
      svg: svgMarkup,
      description: getDescriptionValue()
    };
  }
  function notifyParentExampleChange(index) {
    if (typeof window === 'undefined') return;
    const targetWindow = (() => {
      try {
        return window.parent;
      } catch (_) {
        return null;
      }
    })();
    const normalizedIndex = Number.isInteger(index) && index >= 0 ? index : null;
    const exampleNumber = normalizedIndex != null ? normalizedIndex + 1 : null;
    try {
      if (typeof history !== 'undefined' && typeof history.replaceState === 'function') {
        const url = new URL(window.location.href);
        if (exampleNumber != null) {
          url.searchParams.set('example', String(exampleNumber));
        } else {
          url.searchParams.delete('example');
        }
        history.replaceState(history.state, document.title, `${url.pathname}${url.search}${url.hash}`);
      }
    } catch (_) {}
    if (!targetWindow || targetWindow === window || typeof targetWindow.postMessage !== 'function') return;
    try {
      targetWindow.postMessage({
        type: 'math-visuals:example-change',
        exampleIndex: normalizedIndex,
        exampleNumber,
        path: window.location.pathname,
        href: window.location.href
      }, '*');
    } catch (_) {}
  }
  function loadExample(index) {
    const examples = getExamples();
    const ex = examples[index];
    if (!ex || !ex.config) {
      setDescriptionValue('');
      return false;
    }
    const description = extractDescriptionFromExample(ex);
    setDescriptionValue(description);
    const cfg = ex.config;
    let applied = false;
    for (const name of BINDING_NAMES) {
      if (cfg[name] != null) {
        applyBinding(name, cfg[name]);
        applied = true;
      }
    }
    if (applied) {
      currentExampleIndex = index;
      pendingRequestedIndex = null;
      initialLoadPerformed = true;
      updateTabSelection();
      triggerRefresh(index);
      notifyParentExampleChange(index);
    }
    return applied;
  }
  function updateTabSelection() {
    if (!tabsContainer || !Array.isArray(tabButtons)) return;
    tabButtons.forEach((btn, idx) => {
      if (!btn) return;
      const isActive = idx === currentExampleIndex;
      btn.classList.toggle('is-active', isActive);
      btn.setAttribute('aria-selected', isActive ? 'true' : 'false');
      btn.tabIndex = isActive ? 0 : -1;
    });
  }
  // Load example if viewer requested
  (function () {
    if (hasUrlOverrides) return;
    const loadInfo = safeGetItem('example_to_load');
    if (!loadInfo) return;
    try {
      const {
        path,
        index
      } = JSON.parse(loadInfo);
      if (path === location.pathname) {
        if (loadExample(index)) initialLoadPerformed = true;
      }
    } catch (error) {}
    safeRemoveItem('example_to_load');
  })();
  const createBtn = document.getElementById('btnSaveExample');
  const updateBtn = document.getElementById('btnUpdateExample');
  const deleteBtn = document.getElementById('btnDeleteExample');
  if (!createBtn && !updateBtn && !deleteBtn) return;
  ensureTabStyles();
  const toolbar = (updateBtn === null || updateBtn === void 0 ? void 0 : updateBtn.parentElement) || (createBtn === null || createBtn === void 0 ? void 0 : createBtn.parentElement) || (deleteBtn === null || deleteBtn === void 0 ? void 0 : deleteBtn.parentElement);
  tabsContainer = document.createElement('div');
  tabsContainer.id = 'exampleTabs';
  tabsContainer.className = 'example-tabs';
  tabsContainer.setAttribute('role', 'tablist');
  tabsContainer.setAttribute('aria-orientation', 'horizontal');
  tabsContainer.setAttribute('aria-label', 'Lagrede eksempler');
  const toolbarParent = (toolbar === null || toolbar === void 0 ? void 0 : toolbar.parentElement) || toolbar;
  if (toolbarParent) {
    if (toolbar !== null && toolbar !== void 0 && toolbar.nextSibling) {
      toolbarParent.insertBefore(tabsContainer, toolbar.nextSibling);
    } else {
      toolbarParent.appendChild(tabsContainer);
    }
  } else {
    document.body.appendChild(tabsContainer);
  }
  moveSettingsIntoExampleCard();
  moveDescriptionBelowTabs();
  window.addEventListener('resize', adjustTabsSpacing);
  function updateActionButtonState(count) {
    if (deleteBtn) deleteBtn.disabled = count <= 1;
    if (updateBtn) updateBtn.disabled = count === 0;
  }
  function clampExampleIndex(index, length) {
    if (!Number.isInteger(index)) return null;
    if (!Number.isInteger(length) || length <= 0) return null;
    if (index < 0) return 0;
    if (index >= length) return length - 1;
    return index;
  }
  let pendingRequestedIndex = parseInitialExampleIndex();
  function attemptInitialLoad() {
    if (initialLoadPerformed) return;
    if (pendingRequestedIndex == null) return;
    const examples = getExamples();
    const normalizedIndex = clampExampleIndex(pendingRequestedIndex, examples.length);
    if (normalizedIndex == null) {
      pendingRequestedIndex = null;
      return;
    }
    if (normalizedIndex !== pendingRequestedIndex) {
      pendingRequestedIndex = normalizedIndex;
    }
    const loadNow = () => {
      if (initialLoadPerformed) return;
      if (loadExample(normalizedIndex)) {
        initialLoadPerformed = true;
        pendingRequestedIndex = null;
      }
    };
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', loadNow, {
      once: true
    });else setTimeout(loadNow, 0);
  }
  function renderOptions() {
    const examples = getExamples();
    if (examples.length === 0) {
      currentExampleIndex = null;
    } else if (currentExampleIndex == null || currentExampleIndex >= examples.length) {
      const fallback = currentExampleIndex == null ? 0 : examples.length - 1;
      currentExampleIndex = Math.min(examples.length - 1, Math.max(0, fallback));
    }
    if (tabsContainer) {
      tabsContainer.innerHTML = '';
      tabButtons = [];
      if (examples.length === 0) {
        const empty = document.createElement('div');
        empty.className = 'example-tabs-empty';
        empty.textContent = 'Ingen eksempler';
        tabsContainer.appendChild(empty);
      } else {
        const numericLabelPattern = /^[0-9]+$/;
        examples.forEach((ex, idx) => {
          const btn = document.createElement('button');
          btn.type = 'button';
          btn.className = 'example-tab';
          const defaultLabel = String(idx + 1);
          let label = defaultLabel;
          if (ex && typeof ex.exampleNumber === 'string') {
            const trimmed = ex.exampleNumber.trim();
            if (trimmed) {
              if (!numericLabelPattern.test(trimmed)) {
                label = trimmed;
              } else if (Number(trimmed) === idx + 1) {
                label = trimmed;
              }
            }
          }
          btn.textContent = label;
          btn.dataset.exampleIndex = String(idx);
          btn.setAttribute('role', 'tab');
          btn.setAttribute('aria-label', `Eksempel ${label}`);
          btn.addEventListener('click', () => {
            loadExample(idx);
          });
          btn.addEventListener('keydown', event => {
            var _tabButtons$next;
            if (event.key !== 'ArrowRight' && event.key !== 'ArrowLeft') return;
            event.preventDefault();
            if (!tabButtons.length) return;
            const dir = event.key === 'ArrowRight' ? 1 : -1;
            const total = tabButtons.length;
            let next = idx;
            do {
              next = (next + dir + total) % total;
            } while (next !== idx && !tabButtons[next]);
            loadExample(next);
            (_tabButtons$next = tabButtons[next]) === null || _tabButtons$next === void 0 || _tabButtons$next.focus();
          });
          tabsContainer.appendChild(btn);
          tabButtons.push(btn);
        });
        updateTabSelection();
      }
    }
    if (memoryFallbackNoticePending && !memoryFallbackNoticeRendered) {
      ensureMemoryFallbackNotice();
    }
    updateActionButtonState(examples.length);
    attemptInitialLoad();
    if (!initialLoadPerformed && pendingRequestedIndex == null && examples.length > 0) {
      let idx = Number.isInteger(currentExampleIndex) ? currentExampleIndex : 0;
      if (idx < 0) idx = 0;
      if (idx >= examples.length) idx = examples.length - 1;
      if (loadExample(idx)) initialLoadPerformed = true;
    }
  }
  function collectCurrentExampleState() {
    let ex;
    try {
      ex = collectConfig();
    } catch (error) {
      console.error('[examples] failed to collect config for example', error);
      const fallbackConfig = {};
      for (const name of BINDING_NAMES) {
        const binding = getBinding(name);
        if (binding != null && typeof binding !== 'function') {
          fallbackConfig[name] = cloneValue(binding);
        }
      }
      ex = {
        config: fallbackConfig,
        svg: '',
        description: getDescriptionValue()
      };
    }
    if (!ex || typeof ex !== 'object') {
      ex = {
        config: {},
        svg: '',
        description: getDescriptionValue()
      };
    }
    return ex;
  }
  function getActiveExampleIndex(examples) {
    if (!Array.isArray(examples) || examples.length === 0) return null;
    let index = Number.isInteger(currentExampleIndex) ? currentExampleIndex : NaN;
    if (!Number.isInteger(index)) {
      var _tabsContainer;
      const activeTab = (_tabsContainer = tabsContainer) === null || _tabsContainer === void 0 ? void 0 : _tabsContainer.querySelector('.example-tab.is-active');
      const parsed = activeTab ? Number(activeTab.dataset.exampleIndex) : NaN;
      if (Number.isInteger(parsed)) index = parsed;
    }
    if (!Number.isInteger(index)) {
      index = examples.length - 1;
    }
    if (!Number.isInteger(index)) return null;
    index = Math.max(0, Math.min(examples.length - 1, index));
    return index;
  }
  createBtn === null || createBtn === void 0 || createBtn.addEventListener('click', () => {
    const examples = getExamples();
    const ex = collectCurrentExampleState();
    examples.push(ex);
    store(examples, {
      reason: 'manual-save'
    });
    currentExampleIndex = examples.length - 1;
    renderOptions();
  });
  updateBtn === null || updateBtn === void 0 || updateBtn.addEventListener('click', () => {
    const examples = getExamples();
    if (examples.length === 0) {
      if (createBtn && typeof createBtn.click === 'function') {
        createBtn.click();
      }
      return;
    }
    const indexToUpdate = getActiveExampleIndex(examples);
    if (indexToUpdate == null) return;
    const payload = collectCurrentExampleState();
    const existing = examples[indexToUpdate];
    const updated = existing && typeof existing === 'object' ? { ...existing } : {};
    updated.config = payload && typeof payload.config === 'object' ? payload.config : {};
    updated.svg = typeof (payload === null || payload === void 0 ? void 0 : payload.svg) === 'string' ? payload.svg : '';
    if (payload && Object.prototype.hasOwnProperty.call(payload, 'description')) {
      updated.description = typeof payload.description === 'string' ? payload.description : '';
    } else {
      updated.description = getDescriptionValue();
    }
    examples[indexToUpdate] = updated;
    store(examples, {
      reason: 'manual-update'
    });
    currentExampleIndex = indexToUpdate;
    renderOptions();
  });
  deleteBtn === null || deleteBtn === void 0 || deleteBtn.addEventListener('click', () => {
    const examples = getExamples();
    if (examples.length <= 1) {
      return;
    }
    const indexToUpdate = getActiveExampleIndex(examples);
    if (indexToUpdate == null) {
      return;
    }
    const indexToRemove = indexToUpdate;
    const removed = examples.splice(indexToRemove, 1);
    if (removed && removed.length) {
      const removedExample = removed[0];
      if (removedExample && typeof removedExample === 'object') {
        addExampleToTrash(removedExample, {
          index: indexToRemove,
          reason: 'delete',
          capturePreview: true
        });
        markProvidedExampleDeleted(removedExample.__builtinKey);
      }
    }
    examples.forEach((ex, idx) => {
      if (!ex || typeof ex !== 'object') return;
      if (idx === 0) {
        ex.isDefault = true;
      } else if (Object.prototype.hasOwnProperty.call(ex, 'isDefault')) {
        delete ex.isDefault;
      }
    });
    store(examples, {
      reason: 'delete'
    });
    if (examples.length === 0) {
      currentExampleIndex = null;
    } else if (indexToRemove >= examples.length) {
      currentExampleIndex = examples.length - 1;
    } else {
      currentExampleIndex = indexToRemove;
    }
    renderOptions();
    if (currentExampleIndex != null && currentExampleIndex >= 0 && examples.length > 0) {
      loadExample(currentExampleIndex);
    }
  });
  ensureTrashHistoryMigration();
  renderOptions();
  if (examplesApiBase) {
    loadExamplesFromBackend();
  }
  function parseInitialExampleIndex() {
    const parseValue = value => {
      if (value == null) return null;
      const num = Number(value);
      if (!Number.isFinite(num) || !Number.isInteger(num)) return null;
      if (num > 0) return num - 1;
      if (num === 0) return 0;
      return null;
    };
    if (typeof URLSearchParams !== 'undefined') {
      const search = new URLSearchParams(window.location.search);
      const fromSearch = parseValue(search.get('example'));
      if (fromSearch != null) return fromSearch;
    }
    const hashMatch = window.location.hash && window.location.hash.match(/example=([0-9]+)/i);
    if (hashMatch) return parseValue(hashMatch[1]);
    return null;
  }
  function ensureDefaultsNow() {
    if (ensureDefaultsRunning) return;
    ensureDefaultsRunning = true;
    try {
      let examples = getExamples();
      let updated = false;
      const globalForceProvided = typeof window !== 'undefined' && window && window.__EXAMPLES_FORCE_PROVIDED__ === true;
      const requireProvided = globalForceProvided === true;
      const deletedProvided = getDeletedProvidedExamples();
      let deletedUpdated = false;
      examples.forEach(ex => {
        if (!ex || typeof ex !== 'object') return;
        const key = normalizeKey(ex.__builtinKey);
        if (key && deletedProvided.has(key)) {
          deletedProvided.delete(key);
          deletedUpdated = true;
        }
      });
      if (deletedUpdated) persistDeletedProvidedExamples();
      const firstValidIndex = examples.findIndex(ex => ex && typeof ex === 'object');
      if (firstValidIndex === -1) {
        if (examples.length) {
          examples = [];
          updated = true;
        }
      } else if (firstValidIndex > 0) {
        examples = examples.slice(firstValidIndex);
        if (Number.isInteger(currentExampleIndex)) {
          currentExampleIndex = Math.max(0, currentExampleIndex - firstValidIndex);
        }
        updated = true;
      }
      const providedDefaults = getProvidedExamples();
      const availableDefaults = providedDefaults.filter(ex => {
        const key = normalizeKey(ex && ex.__builtinKey);
        return !key || !deletedProvided.has(key);
      });
      if (requireProvided && availableDefaults.length > 0 && examples.length === 1) {
        const only = examples[0];
        const onlyObj = only && typeof only === 'object' ? only : null;
        const hasKey = onlyObj ? !!normalizeKey(onlyObj.__builtinKey) : false;
        const hasSvg = onlyObj && typeof onlyObj.svg === 'string' ? onlyObj.svg.trim().length > 0 : false;
        if (onlyObj && onlyObj.isDefault === true && !hasKey && !hasSvg) {
          examples = [];
          currentExampleIndex = 0;
          updated = true;
        }
      }
      if (examples.length === 0) {
        if (availableDefaults.length > 0) {
          let defaultIdx = availableDefaults.findIndex(ex => ex.isDefault);
          if (defaultIdx < 0) defaultIdx = 0;
          examples = availableDefaults.map((ex, idx) => {
            const copy = {
              config: cloneValue(ex.config),
              svg: typeof ex.svg === 'string' ? ex.svg : ''
            };
            if (ex.__builtinKey) copy.__builtinKey = ex.__builtinKey;
            if (ex.title) copy.title = ex.title;
            if (ex.description) copy.description = ex.description;
            if (ex.exampleNumber) copy.exampleNumber = ex.exampleNumber;
            if (idx === defaultIdx) {
              copy.isDefault = true;
            }
            return copy;
          });
          currentExampleIndex = Math.min(Math.max(defaultIdx, 0), examples.length - 1);
          updated = true;
        } else {
          const defaultExample = collectConfig();
          defaultExample.isDefault = true;
          examples = [defaultExample];
          currentExampleIndex = 0;
          updated = true;
        }
      } else {
        const first = examples[0];
        if (first.isDefault !== true) {
          first.isDefault = true;
          updated = true;
        }
        for (let i = 1; i < examples.length; i++) {
          const ex = examples[i];
          if (ex && typeof ex === 'object' && Object.prototype.hasOwnProperty.call(ex, 'isDefault')) {
            delete ex.isDefault;
            updated = true;
          }
        }
        if (availableDefaults.length > 0) {
          const existingKeys = new Set();
          examples.forEach(ex => {
            if (!ex || typeof ex !== 'object') return;
            const key = normalizeKey(ex.__builtinKey);
            if (key) existingKeys.add(key);
          });
          let appended = false;
          availableDefaults.forEach(ex => {
            const key = normalizeKey(ex.__builtinKey);
            if (key && existingKeys.has(key)) return;
            const copy = {
              config: cloneValue(ex.config),
              svg: typeof ex.svg === 'string' ? ex.svg : ''
            };
            if (key) copy.__builtinKey = key;
            if (ex.title) copy.title = ex.title;
            if (ex.description) copy.description = ex.description;
            if (ex.exampleNumber) copy.exampleNumber = ex.exampleNumber;
            examples.push(copy);
            if (key) existingKeys.add(key);
            appended = true;
          });
          if (appended) updated = true;
        }
      }
      if (updated) {
        const skipBackendSync = !backendReady;
        store(examples, {
          reason: 'ensure-default',
          skipBackendSync
        });
        examples = getExamples();
      }
      if (pendingRequestedIndex != null) {
        const normalizedIndex = clampExampleIndex(pendingRequestedIndex, examples.length);
        if (normalizedIndex == null) {
          pendingRequestedIndex = null;
        } else {
          pendingRequestedIndex = normalizedIndex;
        }
      }
      if (currentExampleIndex == null && examples.length > 0) {
        currentExampleIndex = 0;
      }
      if (currentExampleIndex != null && examples.length > 0) {
        const maxIdx = examples.length - 1;
        currentExampleIndex = Math.min(Math.max(currentExampleIndex, 0), maxIdx);
      }
      renderOptions();
      if (!initialLoadPerformed) {
        const refreshed = getExamples();
        if (pendingRequestedIndex != null) {
          const normalizedIndex = clampExampleIndex(pendingRequestedIndex, refreshed.length);
          if (normalizedIndex != null) {
            if (loadExample(normalizedIndex)) {
              initialLoadPerformed = true;
              pendingRequestedIndex = null;
            }
          } else {
            pendingRequestedIndex = null;
          }
        }
        if (!initialLoadPerformed && refreshed.length > 0) {
          let targetIndex = Number.isInteger(currentExampleIndex) ? currentExampleIndex : NaN;
          if (!Number.isInteger(targetIndex) || targetIndex < 0 || targetIndex >= refreshed.length) {
            const firstCustomIndex = refreshed.findIndex(example => {
              if (!example || typeof example !== 'object') return false;
              const key = normalizeKey(example.__builtinKey);
              return !key;
            });
            if (Number.isInteger(firstCustomIndex) && firstCustomIndex >= 0) {
              targetIndex = firstCustomIndex;
            }
          }
          if (!Number.isInteger(targetIndex) || targetIndex < 0 || targetIndex >= refreshed.length) {
            targetIndex = refreshed.findIndex(ex => ex && ex.isDefault === true);
          }
          if (!Number.isInteger(targetIndex) || targetIndex < 0 || targetIndex >= refreshed.length) {
            targetIndex = 0;
          }
          if (loadExample(targetIndex)) {
            initialLoadPerformed = true;
          }
        }
      }
      if (globalForceProvided && typeof window !== 'undefined' && window) {
        window.__EXAMPLES_FORCE_PROVIDED__ = false;
      }
    } finally {
      ensureDefaultsRunning = false;
    }
  }
  function scheduleEnsureDefaults(options) {
    const opts = options && typeof options === 'object' ? options : {};
    const force = opts.force === true;
    const runEnsure = () => {
      if (!force) {
        defaultEnsureScheduled = false;
      }
      ensureDefaultsNow();
    };
    if (!force) {
      if (defaultEnsureScheduled) return;
      defaultEnsureScheduled = true;
    }
    if (document.readyState === 'complete' || document.readyState === 'interactive') {
      setTimeout(runEnsure, 0);
      return;
    }
    const handler = () => {
      document.removeEventListener('DOMContentLoaded', handler);
      window.removeEventListener('load', handler);
      setTimeout(runEnsure, 0);
    };
    document.addEventListener('DOMContentLoaded', handler);
    window.addEventListener('load', handler);
  }
  scheduleEnsureDefaults();
})();
