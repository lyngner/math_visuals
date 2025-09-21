(function () {
  const globalScope = typeof window !== 'undefined' ? window : typeof globalThis !== 'undefined' ? globalThis : null;
  function createFallbackStorage() {
    const data = new Map();
    return {
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
      },
      removeItem(key) {
        if (key == null) return;
        data.delete(String(key));
      },
      clear() {
        data.clear();
      }
    };
  }
  const fallbackStorage = (() => {
    if (globalScope && globalScope.__EXAMPLES_FALLBACK_STORAGE__ && typeof globalScope.__EXAMPLES_FALLBACK_STORAGE__.getItem === 'function') {
      return globalScope.__EXAMPLES_FALLBACK_STORAGE__;
    }
    const store = createFallbackStorage();
    if (globalScope) {
      globalScope.__EXAMPLES_FALLBACK_STORAGE__ = store;
    }
    return store;
  })();
  let usingFallbackStorage = false;
  function ensureFallbackStorage() {
    if (!usingFallbackStorage) {
      usingFallbackStorage = true;
      if (typeof localStorage !== 'undefined') {
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
              if (value != null) fallbackStorage.setItem(key, value);
            } catch (_) {}
          }
        } catch (_) {}
      }
      if (globalScope) {
        globalScope.__EXAMPLES_STORAGE__ = fallbackStorage;
      }
    }
    return fallbackStorage;
  }
  function safeGetItem(key) {
    if (usingFallbackStorage) {
      return fallbackStorage.getItem(key);
    }
    try {
      if (typeof localStorage === 'undefined') throw new Error('Storage not available');
      return localStorage.getItem(key);
    } catch (_) {
      return ensureFallbackStorage().getItem(key);
    }
  }
  function safeSetItem(key, value) {
    if (usingFallbackStorage) {
      fallbackStorage.setItem(key, value);
      return;
    }
    try {
      if (typeof localStorage === 'undefined') throw new Error('Storage not available');
      localStorage.setItem(key, value);
    } catch (_) {
      ensureFallbackStorage().setItem(key, value);
    }
  }
  function safeRemoveItem(key) {
    if (usingFallbackStorage) {
      fallbackStorage.removeItem(key);
      return;
    }
    try {
      if (typeof localStorage === 'undefined') throw new Error('Storage not available');
      localStorage.removeItem(key);
    } catch (_) {
      ensureFallbackStorage().removeItem(key);
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
  function normalizePathname(pathname) {
    if (typeof pathname !== 'string') return '/';
    let path = pathname.trim();
    if (!path) return '/';
    if (!path.startsWith('/')) path = '/' + path;
    // Replace backslashes (possible in file:// URLs) and collapse duplicate slashes
    path = path.replace(/\+/g, '/');
    path = path.replace(/\/+/g, '/');
    // Remove trailing index.html or index.htm
    path = path.replace(/\/index\.html?$/i, '/');
    if (path.length > 1 && path.endsWith('/')) {
      path = path.slice(0, -1);
    }
    return path || '/';
  }
  function computeLegacyStorageKeys(rawPath, canonicalPath) {
    const prefix = 'examples_';
    const canonicalKey = prefix + canonicalPath;
    const paths = new Set();
    const addPath = value => {
      if (typeof value !== 'string') return;
      const trimmed = value.trim();
      if (!trimmed) return;
      paths.add(trimmed);
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
    const canonicalBase = canonicalPath.endsWith('/') ? canonicalPath : `${canonicalPath}/`;
    addPath(canonicalBase + 'index.html');
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
  let initialLoadPerformed = false;
  let currentExampleIndex = null;
  let tabsContainer = null;
  let tabButtons = [];
  let defaultEnsureScheduled = false;
  let tabsHostCard = null;
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
  function getExamples() {
    if (!cachedExamplesInitialized) {
      cachedExamplesInitialized = true;
      cachedExamples = [];
    }
    const stored = safeGetItem(key);
    if (stored == null) {
      return cachedExamples;
    }
    try {
      const parsed = JSON.parse(stored);
      cachedExamples = Array.isArray(parsed) ? parsed : [];
    } catch (_) {
      cachedExamples = [];
    }
    return cachedExamples;
  }
  function store(examples) {
    cachedExamples = Array.isArray(examples) ? examples : [];
    cachedExamplesInitialized = true;
    safeSetItem(key, JSON.stringify(cachedExamples));
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
.card-has-settings .example-settings{margin-top:6px;padding-top:12px;border-top:1px solid #e5e7eb;display:flex;flex-direction:column;gap:10px;}
.card-has-settings .example-settings > h2:first-child{margin-top:0;}
.card-has-settings .example-tabs{margin-bottom:-6px;}
`;
    document.head.appendChild(style);
  }
  function adjustTabsSpacing() {
    if (!tabsContainer || !tabsHostCard) return;
    if (!tabsHostCard.isConnected) {
      tabsHostCard = null;
      tabsContainer.style.removeProperty('margin-bottom');
      return;
    }
    if (!tabsHostCard.classList.contains('card-has-settings')) {
      tabsContainer.style.removeProperty('margin-bottom');
      return;
    }
    let gapValue = '';
    try {
      const styles = window.getComputedStyle(tabsHostCard);
      gapValue = styles.getPropertyValue('row-gap');
      if (!gapValue || gapValue === '0px' || gapValue === 'normal') {
        gapValue = styles.getPropertyValue('gap');
      }
    } catch (_) {}
    if (gapValue) {
      gapValue = gapValue.trim();
    }
    if (gapValue && gapValue !== '0px' && gapValue !== 'normal') {
      const match = gapValue.match(/^(-?\d*\.?\d+)(.*)$/);
      if (match) {
        const numeric = Number.parseFloat(match[1]);
        if (Number.isFinite(numeric)) {
          const unit = match[2].trim() || 'px';
          tabsContainer.style.marginBottom = `${numeric * -1}${unit}`;
          return;
        }
      }
      if (!gapValue.startsWith('-')) {
        tabsContainer.style.marginBottom = `-${gapValue}`;
        return;
      }
      tabsContainer.style.marginBottom = gapValue;
      return;
    }
    tabsContainer.style.marginBottom = '-6px';
  }
  function moveSettingsIntoExampleCard() {
    if (!toolbar) return;
    const exampleCard = toolbar.closest('.card');
    if (!exampleCard) return;
    tabsHostCard = exampleCard;
    if (exampleCard.classList.contains('card-has-settings')) {
      adjustTabsSpacing();
      return;
    }
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
    if (!settingsCard) {
      adjustTabsSpacing();
      return;
    }
    const settingsWrapper = document.createElement('div');
    settingsWrapper.className = 'example-settings';
    while (settingsCard.firstChild) {
      settingsWrapper.appendChild(settingsCard.firstChild);
    }
    exampleCard.appendChild(settingsWrapper);
    settingsCard.remove();
    exampleCard.classList.add('card-has-settings');
    adjustTabsSpacing();
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
  function cloneValue(value) {
    if (value == null) return value;
    if (typeof structuredClone === 'function') {
      try {
        return structuredClone(value);
      } catch (error) {}
    }
    try {
      return JSON.parse(JSON.stringify(value));
    } catch (error) {}
    if (Array.isArray(value)) {
      return value.slice();
    }
    if (typeof value === 'object') {
      return {
        ...value
      };
    }
    return value;
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
    if (typeof example.description === 'string') sanitized.description = example.description;
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
    const collectionDetail = {
      svgOverride: null
    };
    try {
      if (typeof window !== 'undefined' && window) {
        let evt;
        if (typeof CustomEvent === 'function') {
          evt = new CustomEvent('examples:collect', {
            detail: collectionDetail
          });
        } else {
          evt = new Event('examples:collect');
          try {
            evt.detail = collectionDetail;
          } catch (_) {}
        }
        window.dispatchEvent(evt);
      }
    } catch (_) {
      try {
        const evt = new Event('examples:collect');
        try {
          evt.detail = collectionDetail;
        } catch (_) {}
        window.dispatchEvent(evt);
      } catch (_) {}
    }
    const cfg = {};
    for (const name of BINDING_NAMES) {
      const binding = getBinding(name);
      if (binding != null && typeof binding !== 'function') {
        cfg[name] = cloneValue(binding);
      }
    }
    let svgMarkup = '';
    if (collectionDetail.svgOverride != null) {
      if (typeof collectionDetail.svgOverride === 'string') svgMarkup = collectionDetail.svgOverride;else if (collectionDetail.svgOverride && typeof collectionDetail.svgOverride.outerHTML === 'string') {
        svgMarkup = collectionDetail.svgOverride.outerHTML;
      }
    }
    if (!svgMarkup) {
      const svg = document.querySelector('svg');
      svgMarkup = svg ? svg.outerHTML : '';
    }
    return {
      config: cfg,
      svg: svgMarkup
    };
  }
  function loadExample(index) {
    const examples = getExamples();
    const ex = examples[index];
    if (!ex || !ex.config) return false;
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
      updateTabSelection();
      triggerRefresh(index);
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
  const saveBtn = document.getElementById('btnSaveExample');
  const deleteBtn = document.getElementById('btnDeleteExample');
  if (!saveBtn && !deleteBtn) return;
  ensureTabStyles();
  const toolbar = (saveBtn === null || saveBtn === void 0 ? void 0 : saveBtn.parentElement) || (deleteBtn === null || deleteBtn === void 0 ? void 0 : deleteBtn.parentElement);
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
  window.addEventListener('resize', adjustTabsSpacing);
  function updateDeleteButtonState(count) {
    if (deleteBtn) deleteBtn.disabled = count <= 1;
  }
  let pendingRequestedIndex = parseInitialExampleIndex();
  function attemptInitialLoad() {
    if (initialLoadPerformed) return;
    if (pendingRequestedIndex == null) return;
    const examples = getExamples();
    if (pendingRequestedIndex < 0 || pendingRequestedIndex >= examples.length) return;
    const loadNow = () => {
      if (initialLoadPerformed) return;
      if (loadExample(pendingRequestedIndex)) {
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
        examples.forEach((ex, idx) => {
          const btn = document.createElement('button');
          btn.type = 'button';
          btn.className = 'example-tab';
          let label = String(idx + 1);
          if (ex && typeof ex.exampleNumber === 'string' && ex.exampleNumber.trim()) {
            label = ex.exampleNumber.trim();
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
    updateDeleteButtonState(examples.length);
    attemptInitialLoad();
    if (!initialLoadPerformed && pendingRequestedIndex == null && examples.length > 0) {
      let idx = Number.isInteger(currentExampleIndex) ? currentExampleIndex : 0;
      if (idx < 0) idx = 0;
      if (idx >= examples.length) idx = examples.length - 1;
      if (loadExample(idx)) initialLoadPerformed = true;
    }
  }
  saveBtn === null || saveBtn === void 0 || saveBtn.addEventListener('click', async () => {
    const examples = getExamples();
    const ex = collectConfig();
    examples.push(ex);
    store(examples);
    currentExampleIndex = examples.length - 1;
    renderOptions();
    alert('Eksempel lagret');

    // Also offer download of the example as a JS file
    try {
      const lines = [];
      const cfg = ex.config || {};
      if (cfg.STATE) lines.push(`window.STATE=${JSON.stringify(cfg.STATE)};`);
      if (cfg.CFG) lines.push(`window.CFG=${JSON.stringify(cfg.CFG)};`);
      if (cfg.CONFIG) lines.push(`window.CONFIG=${JSON.stringify(cfg.CONFIG)};`);
      if (cfg.SIMPLE) lines.push(`window.SIMPLE=${JSON.stringify(cfg.SIMPLE)};`);

      // Include all external scripts in the downloaded file
      const scripts = Array.from(document.querySelectorAll('script[src]')).filter(s => !s.src.endsWith('examples.js'));
      for (const s of scripts) {
        try {
          const res = await fetch(s.src);
          const txt = await res.text();
          lines.push(`// Source: ${s.src}`);
          lines.push(txt);
        } catch (error) {}
      }
      const blob = new Blob([lines.join('\n')], {
        type: 'application/javascript'
      });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      const base = location.pathname.split('/').pop().replace(/\.html$/, '');
      a.download = `${base}-example-${examples.length}.js`;
      document.body.appendChild(a);
      a.click();
      setTimeout(() => {
        URL.revokeObjectURL(a.href);
        document.body.removeChild(a);
      }, 1000);
    } catch (error) {}
  });
  deleteBtn === null || deleteBtn === void 0 || deleteBtn.addEventListener('click', () => {
    const examples = getExamples();
    if (examples.length <= 1) {
      return;
    }
    let indexToRemove = Number.isInteger(currentExampleIndex) ? currentExampleIndex : NaN;
    if (!Number.isInteger(indexToRemove)) {
      var _tabsContainer;
      const activeTab = (_tabsContainer = tabsContainer) === null || _tabsContainer === void 0 ? void 0 : _tabsContainer.querySelector('.example-tab.is-active');
      const parsed = activeTab ? Number(activeTab.dataset.exampleIndex) : NaN;
      if (Number.isInteger(parsed)) indexToRemove = parsed;
    }
    if (!Number.isInteger(indexToRemove)) {
      indexToRemove = examples.length - 1;
    }
    indexToRemove = Math.max(0, Math.min(examples.length - 1, indexToRemove));
    const removed = examples.splice(indexToRemove, 1);
    if (removed && removed.length) {
      const removedExample = removed[0];
      if (removedExample && typeof removedExample === 'object') {
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
    store(examples);
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
    alert('Eksempel slettet');
  });
  renderOptions();
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
  function ensureDefaultExample() {
    if (defaultEnsureScheduled) return;
    defaultEnsureScheduled = true;
    const ensure = () => {
      let examples = getExamples();
      let updated = false;
      const requireProvided = typeof window !== 'undefined' && window && window.__EXAMPLES_FORCE_PROVIDED__ === true;
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
        store(examples);
        examples = getExamples();
      }
      if (pendingRequestedIndex != null) {
        if (pendingRequestedIndex < 0 || pendingRequestedIndex >= examples.length) {
          pendingRequestedIndex = null;
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
          if (pendingRequestedIndex >= 0 && pendingRequestedIndex < refreshed.length) {
            if (loadExample(pendingRequestedIndex)) {
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
      if (requireProvided && typeof window !== 'undefined' && window) {
        window.__EXAMPLES_FORCE_PROVIDED__ = false;
      }
    };
    const runEnsure = () => {
      window.removeEventListener('DOMContentLoaded', runEnsure);
      window.removeEventListener('load', runEnsure);
      setTimeout(ensure, 0);
    };
    if (document.readyState === 'complete' || document.readyState === 'interactive') {
      setTimeout(ensure, 0);
    } else {
      window.addEventListener('DOMContentLoaded', runEnsure);
      window.addEventListener('load', runEnsure);
    }
  }
  ensureDefaultExample();
})();
