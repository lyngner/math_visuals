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

const globalScope = typeof window !== 'undefined' ? window : typeof globalThis !== 'undefined' ? globalThis : null;
function createMemoryStorage() {
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
      data.set(String(key), value == null ? 'null' : String(value));
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
      } catch (_) {}
    },
    removeItem(key) {
      try {
        sessionStorage.removeItem(key);
      } catch (_) {}
    },
    clear() {
      try {
        sessionStorage.clear();
      } catch (_) {}
    }
  };
}
function createFallbackStorage() {
  return createSessionFallbackStorage() || createMemoryStorage();
}
const sharedFallback = (() => {
  if (globalScope && globalScope.__EXAMPLES_FALLBACK_STORAGE__ && typeof globalScope.__EXAMPLES_FALLBACK_STORAGE__.getItem === 'function') {
    return globalScope.__EXAMPLES_FALLBACK_STORAGE__;
  }
  const store = createFallbackStorage();
  if (globalScope) {
    globalScope.__EXAMPLES_FALLBACK_STORAGE__ = store;
  }
  return store;
})();
let storage = null;
let usingFallback = false;
if (globalScope) {
  const shared = globalScope.__EXAMPLES_STORAGE__;
  if (shared && typeof shared.getItem === 'function') {
    storage = shared;
    usingFallback = shared === sharedFallback;
  }
}
if (!storage) {
  try {
    if (typeof localStorage !== 'undefined') {
      storage = localStorage;
    } else {
      storage = sharedFallback;
      usingFallback = true;
    }
  } catch (_) {
    storage = sharedFallback;
    usingFallback = true;
  }
}
if (globalScope && (!globalScope.__EXAMPLES_STORAGE__ || typeof globalScope.__EXAMPLES_STORAGE__.getItem !== 'function')) {
  globalScope.__EXAMPLES_STORAGE__ = storage;
}
function switchToFallback() {
  if (usingFallback) return storage;
  if (storage && storage !== sharedFallback) {
    try {
      const total = Number(storage.length) || 0;
      for (let i = 0; i < total; i++) {
        let key = null;
        try {
          key = storage.key(i);
        } catch (_) {
          key = null;
        }
        if (!key) continue;
        try {
          const value = storage.getItem(key);
          if (value != null) sharedFallback.setItem(key, value);
        } catch (_) {}
      }
    } catch (_) {}
  }
  usingFallback = true;
  storage = sharedFallback;
  if (globalScope) {
    globalScope.__EXAMPLES_STORAGE__ = storage;
  }
  return storage;
}
function safeGetItem(key) {
  if (!usingFallback && storage && typeof storage.getItem === 'function') {
    try {
      return storage.getItem(key);
    } catch (_) {
      return switchToFallback().getItem(key);
    }
  }
  return storage && typeof storage.getItem === 'function' ? storage.getItem(key) : null;
}
function safeSetItem(key, value) {
  if (!usingFallback && storage && typeof storage.setItem === 'function') {
    try {
      storage.setItem(key, value);
      return;
    } catch (_) {
      // fall through
    }
  }
  switchToFallback().setItem(key, value);
}

function resolveExamplesApiBase() {
  if (typeof window === 'undefined') return null;
  if (window.MATH_VISUALS_EXAMPLES_API_URL) {
    const value = String(window.MATH_VISUALS_EXAMPLES_API_URL).trim();
    if (value) return value;
  }
  const origin = window.location && window.location.origin;
  if (typeof origin === 'string' && /^https?:/i.test(origin)) {
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

function normalizeExamplePath(pathname) {
  if (typeof pathname !== 'string') return '/';
  let path = pathname.trim();
  if (!path) return '/';
  if (!path.startsWith('/')) path = '/' + path;
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
  if (!path) return '/';
  let decoded = path;
  try {
    decoded = decodeURI(path);
  } catch (_) {}
  if (typeof decoded === 'string') {
    decoded = decoded.toLowerCase();
  }
  let encoded = decoded;
  try {
    encoded = encodeURI(decoded);
  } catch (_) {
    encoded = typeof path === 'string' ? path.toLowerCase() : path;
  }
  if (!encoded) return '/';
  return encoded.replace(/%[0-9a-f]{2}/gi, match => match.toUpperCase());
}

const PROFILE_STORAGE_KEY = 'profile';
const PROFILE_DEFAULT = 'kikora';
const MODE_STORAGE_KEY = 'mode';
const MODE_DEFAULT = 'edit';
const MODE_VALUES = ['edit', 'task'];
const profileVariables = {
  kikora: {
    'profile-body-background': '#f7f8fb',
    'profile-body-color': '#111827',
    'profile-surface-background': '#ffffffee',
    'profile-surface-border': '#e5e7eb',
    'profile-title-color': '#0f172a',
    'profile-accent-color': '#0f6d8f',
    'profile-accent-contrast': '#ffffff',
    'profile-accent-hover': '#0c5974',
    'profile-accent-border': 'rgba(15, 109, 143, 0.15)',
    'profile-accent-border-strong': 'rgba(15, 109, 143, 0.35)',
    'profile-accent-surface': '#e6f4fa',
    'profile-accent-shadow-soft': 'rgba(15, 109, 143, 0.08)',
    'profile-accent-shadow-medium': 'rgba(15, 109, 143, 0.2)',
    'profile-accent-shadow-strong': 'rgba(15, 109, 143, 0.25)',
    'profile-tooltip-background': 'rgba(15, 109, 143, 0.95)',
    'profile-tooltip-color': '#ffffff',
    'profile-focus-outline': 'rgba(15, 109, 143, 0.35)',
    'profile-nav-badge-background': '#f97316',
    'profile-nav-badge-color': '#ffffff',
    'profile-iframe-background': '#ffffff'
  },
  campus: {
    'profile-body-background': '#f5f6ff',
    'profile-body-color': '#10143c',
    'profile-surface-background': '#ffffffee',
    'profile-surface-border': '#d8ddf0',
    'profile-title-color': '#10143c',
    'profile-accent-color': '#2f50c1',
    'profile-accent-contrast': '#ffffff',
    'profile-accent-hover': '#2540a4',
    'profile-accent-border': 'rgba(47, 80, 193, 0.2)',
    'profile-accent-border-strong': 'rgba(47, 80, 193, 0.4)',
    'profile-accent-surface': '#e7edff',
    'profile-accent-shadow-soft': 'rgba(47, 80, 193, 0.12)',
    'profile-accent-shadow-medium': 'rgba(47, 80, 193, 0.18)',
    'profile-accent-shadow-strong': 'rgba(47, 80, 193, 0.28)',
    'profile-tooltip-background': 'rgba(37, 64, 164, 0.95)',
    'profile-tooltip-color': '#ffffff',
    'profile-focus-outline': 'rgba(47, 80, 193, 0.4)',
    'profile-nav-badge-background': '#f59e0b',
    'profile-nav-badge-color': '#1f2937',
    'profile-iframe-background': '#ffffff'
  }
};

function normalizeProfileName(profile) {
  if (typeof profile !== 'string') return PROFILE_DEFAULT;
  const normalized = profile.trim().toLowerCase();
  return Object.prototype.hasOwnProperty.call(profileVariables, normalized) ? normalized : PROFILE_DEFAULT;
}

let currentProfile = PROFILE_DEFAULT;
let currentMode = MODE_DEFAULT;

function updateProfileStyles(profile) {
  const normalized = normalizeProfileName(profile);
  const variables = profileVariables[normalized] || profileVariables[PROFILE_DEFAULT];
  const root = typeof document !== 'undefined' ? document.documentElement : null;
  if (root) {
    Object.entries(variables).forEach(([key, value]) => {
      root.style.setProperty(`--${key}`, value);
    });
    root.setAttribute('data-profile', normalized);
  }
  currentProfile = normalized;
  return normalized;
}

if (typeof window !== 'undefined') {
  window.mathVisualsUpdateProfileStyles = updateProfileStyles;
}
const storedProfileValue = safeGetItem(PROFILE_STORAGE_KEY);
const initialProfile = updateProfileStyles(storedProfileValue || PROFILE_DEFAULT);
if (storedProfileValue !== initialProfile) {
  safeSetItem(PROFILE_STORAGE_KEY, initialProfile);
}
function normalizeMode(value) {
  if (typeof value !== 'string') return MODE_DEFAULT;
  const normalized = value.trim().toLowerCase();
  return MODE_VALUES.includes(normalized) ? normalized : MODE_DEFAULT;
}
const storedModeValue = safeGetItem(MODE_STORAGE_KEY);
const initialMode = normalizeMode(storedModeValue || MODE_DEFAULT);
currentMode = initialMode;
if (storedModeValue !== initialMode) {
  safeSetItem(MODE_STORAGE_KEY, initialMode);
}
const iframe = document.querySelector('iframe');
const nav = document.querySelector('nav');
const profileControl = nav ? nav.querySelector('[data-profile-control]') : null;
const modeControl = nav ? nav.querySelector('[data-mode-control]') : null;
const navList = nav ? nav.querySelector('ul') : null;
const taskStrip = nav ? nav.querySelector('[data-task-strip]') : null;
const examplesApiBase = resolveExamplesApiBase();

function syncProfileControl(profile) {
  if (!profileControl) return;
  if (profileControl.value !== profile) {
    profileControl.value = profile;
  }
}

syncProfileControl(currentProfile);

function syncModeControl(mode) {
  if (!modeControl) return;
  if (modeControl.value !== mode) {
    modeControl.value = mode;
  }
}

syncModeControl(currentMode);

if (typeof document !== 'undefined') {
  document.addEventListener('DOMContentLoaded', () => {
    syncProfileControl(currentProfile);
    syncModeControl(currentMode);
  });
}
const defaultPage = 'nkant.html';
const links = Array.from(nav.querySelectorAll('a'));

function normalizeLookupKey(value) {
  if (typeof value !== 'string') return '';
  let decoded = value;
  try {
    decoded = decodeURIComponent(value);
  } catch (_) {}
  const trimmed = decoded.trim();
  if (!trimmed) return '';
  const base = trimmed
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '');
  return base;
}

function resolveEntryPath(href) {
  if (typeof href !== 'string' || !href) return '/';
  try {
    const url = new URL(href, window.location.origin);
    return url.pathname;
  } catch (_) {
    if (href.startsWith('/')) return href;
    return `/${href}`;
  }
}

function buildRouteSegment(label, href) {
  if (typeof label === 'string' && label.trim()) {
    const sanitized = label
      .trim()
      .replace(/[()]/g, '')
      .replace(/[^0-9A-Za-zÆØÅæøå\-]+/g, '-')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '');
    if (sanitized) return sanitized;
  }
  const sanitizedHref = typeof href === 'string' ? href.split(/[?#]/)[0] : '';
  const parts = sanitizedHref.split('/').filter(Boolean);
  let base = parts.length > 1 ? parts[0] : sanitizedHref;
  if (base.endsWith('.html')) {
    base = base.slice(0, -5);
  }
  return base || 'app';
}

function collectLookupKeys(routeSegment, label, href, path) {
  const keys = new Set();
  const add = value => {
    const normalized = normalizeLookupKey(value);
    if (normalized) keys.add(normalized);
  };
  add(routeSegment);
  add(label);
  add(href);
  add(path);
  const sanitizedHref = typeof href === 'string' ? href.split(/[?#]/)[0] : '';
  const segments = sanitizedHref.split('/').filter(Boolean);
  segments.forEach(segment => {
    add(segment);
    if (segment.endsWith('.html')) {
      add(segment.slice(0, -5));
    }
  });
  return Array.from(keys);
}

function createNavEntry(link) {
  const href = link.getAttribute('href') || '';
  const label = link.getAttribute('data-label') || link.textContent || '';
  const routeSegment = buildRouteSegment(label, href);
  const path = resolveEntryPath(href);
  const normalizedPath = normalizeExamplePath(path);
  const lookupKeys = collectLookupKeys(routeSegment, label, href, path);
  const defaultExampleAttr = link.getAttribute('data-default-example');
  let defaultExampleNumber = null;
  if (defaultExampleAttr != null && defaultExampleAttr !== '') {
    const parsedDefaultExample = Number.parseInt(defaultExampleAttr, 10);
    if (Number.isFinite(parsedDefaultExample) && parsedDefaultExample > 0) {
      defaultExampleNumber = parsedDefaultExample;
    }
  }
  let includeExampleInPath = false;
  if (link.hasAttribute('data-include-example-in-path')) {
    const includeAttr = link.getAttribute('data-include-example-in-path');
    if (includeAttr == null || includeAttr === '') {
      includeExampleInPath = true;
    } else {
      const normalized = includeAttr.trim().toLowerCase();
      includeExampleInPath = normalized !== 'false' && normalized !== '0' && normalized !== 'no';
    }
  }
  const entry = {
    link,
    href,
    label,
    routeSegment,
    path,
    normalizedPath,
    lookupKeys,
    defaultExampleNumber,
    includeExampleInPath
  };
  Object.defineProperty(link, '__NAV_ENTRY__', {
    value: entry,
    writable: false
  });
  return entry;
}

const navEntries = links.map(createNavEntry);
const navLookup = new Map();
navEntries.forEach(entry => {
  entry.lookupKeys.forEach(key => {
    if (!key) return;
    if (!navLookup.has(key)) {
      navLookup.set(key, entry);
    }
  });
});

let currentEntry = null;
let currentExampleNumber = null;
let currentExampleIsExplicit = false;
let lastHistoryPath = null;

const TASK_STORAGE_PREFIX = 'examples_';
let taskButtons = [];
let taskLoadPromise = null;
let backendEntriesPromise = null;

function readLocalExamples(normalizedPath) {
  if (typeof normalizedPath !== 'string' || !normalizedPath) return [];
  const key = `${TASK_STORAGE_PREFIX}${normalizedPath}`;
  try {
    const stored = safeGetItem(key);
    if (!stored) return [];
    const parsed = JSON.parse(stored);
    return Array.isArray(parsed) ? parsed : [];
  } catch (_) {
    return [];
  }
}

async function fetchBackendEntriesList() {
  if (!examplesApiBase) return null;
  if (backendEntriesPromise) return backendEntriesPromise;
  const url = buildExamplesApiUrl(examplesApiBase);
  if (!url) return null;
  backendEntriesPromise = (async () => {
    try {
      const res = await fetch(url, { headers: { Accept: 'application/json' } });
      if (!res.ok) return null;
      const data = await res.json();
      if (data && Array.isArray(data.entries)) {
        return data.entries;
      }
      return null;
    } catch (_) {
      return null;
    }
  })();
  return backendEntriesPromise;
}

async function buildTaskData() {
  let backendEntries = null;
  try {
    backendEntries = await fetchBackendEntriesList();
  } catch (_) {
    backendEntries = null;
  }
  const backendMap = new Map();
  if (Array.isArray(backendEntries)) {
    backendEntries.forEach(entry => {
      if (!entry || typeof entry !== 'object') return;
      const path = normalizeExamplePath(entry.path || '');
      if (!path) return;
      const examples = Array.isArray(entry.examples) ? entry.examples : [];
      if (examples.length) {
        backendMap.set(path, examples.slice());
      }
    });
  }
  const tasks = [];
  let counter = 0;
  navEntries.forEach(entry => {
    if (!entry) return;
    const normalizedPath = entry.normalizedPath || normalizeExamplePath(entry.path || entry.href || '');
    if (!normalizedPath) return;
    let examples = backendMap.get(normalizedPath) || [];
    if (!examples.length) {
      examples = readLocalExamples(normalizedPath);
    }
    if (!Array.isArray(examples) || !examples.length) return;
    examples.forEach((_, idx) => {
      counter += 1;
      tasks.push({
        entry,
        exampleNumber: idx + 1,
        label: `Oppgave ${counter}`,
        normalizedPath
      });
    });
  });
  return tasks;
}

function renderTaskStrip(tasks) {
  if (!taskStrip) return;
  taskStrip.innerHTML = '';
  taskButtons = [];
  if (!tasks.length) {
    const empty = document.createElement('div');
    empty.className = 'task-strip-empty';
    empty.textContent = 'Ingen oppgaver tilgjengelig';
    taskStrip.appendChild(empty);
    return;
  }
  const fragment = document.createDocumentFragment();
  let currentCluster = null;
  tasks.forEach(task => {
    if (!currentCluster || currentCluster.entry !== task.entry) {
      const cluster = document.createElement('div');
      cluster.className = 'task-cluster';
      fragment.appendChild(cluster);
      currentCluster = { entry: task.entry, element: cluster };
    }

    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'task-node';
    button.dataset.entryPath = task.normalizedPath;
    button.dataset.exampleNumber = String(task.exampleNumber);
    button.dataset.label = task.label;
    button.setAttribute('aria-label', `${task.label} – ${task.entry.label}`);
    button.addEventListener('click', () => {
      const isSameEntry = currentEntry === task.entry;
      const currentNumber = Number.isFinite(currentExampleNumber) ? currentExampleNumber : 1;
      const options = {
        pushHistory: true,
        refresh: isSameEntry && currentNumber === task.exampleNumber
      };
      applyRoute(task.entry, task.exampleNumber, options);
    });
    currentCluster.element.appendChild(button);
    taskButtons.push(button);
  });
  taskStrip.appendChild(fragment);
  updateActiveTaskIndicator();
}

function updateTaskModeUI() {
  const body = typeof document !== 'undefined' ? document.body : null;
  if (body) {
    body.dataset.mode = currentMode;
  }
  const isTaskMode = currentMode === 'task';
  if (nav) {
    nav.classList.toggle('nav--task-mode', isTaskMode);
  }
  if (navList) {
    if (isTaskMode) {
      navList.setAttribute('aria-hidden', 'true');
    } else {
      navList.removeAttribute('aria-hidden');
    }
  }
  if (taskStrip) {
    taskStrip.hidden = !isTaskMode;
    taskStrip.setAttribute('aria-hidden', isTaskMode ? 'false' : 'true');
  }
}

async function ensureTasksRendered(options = {}) {
  if (!taskStrip || currentMode !== 'task') return;
  if (taskLoadPromise) {
    await taskLoadPromise;
    if (!options || options.force !== true) {
      return;
    }
  }
  const loadPromise = (async () => {
    const tasks = await buildTaskData();
    renderTaskStrip(tasks);
    updateTaskModeUI();
  })();
  taskLoadPromise = loadPromise;
  try {
    await loadPromise;
  } finally {
    if (taskLoadPromise === loadPromise) {
      taskLoadPromise = null;
    }
  }
}

function handleModeUpdate(options = {}) {
  updateTaskModeUI();
  if (currentMode === 'task') {
    ensureTasksRendered({ force: options.forceTasks === true })
      .then(() => {
        updateTaskModeUI();
        updateActiveTaskIndicator();
      })
      .catch(() => {});
  }
}

handleModeUpdate({ forceTasks: true });

function updateActiveTaskIndicator() {
  if (!taskButtons.length) return;
  const activePath = currentEntry && currentEntry.normalizedPath ? currentEntry.normalizedPath : null;
  const activeNumber = Number.isFinite(currentExampleNumber) ? currentExampleNumber : null;
  taskButtons.forEach(button => {
    if (!button) return;
    const buttonPath = button.dataset.entryPath || '';
    const buttonExample = Number(button.dataset.exampleNumber);
    let isActive = false;
    if (activePath && buttonPath === activePath) {
      if (activeNumber != null) {
        isActive = Number.isFinite(buttonExample) && buttonExample === activeNumber;
      } else {
        isActive = Number.isFinite(buttonExample) && buttonExample === 1;
      }
    }
    button.classList.toggle('is-active', isActive);
  });
}

if (profileControl) {
  profileControl.addEventListener('change', event => {
    const target = event && event.target ? event.target : null;
    const selected = target && typeof target.value === 'string' ? target.value : PROFILE_DEFAULT;
    const normalized = normalizeProfileName(selected);
    if (normalized === currentProfile) {
      syncProfileControl(currentProfile);
      return;
    }
    const applied = updateProfileStyles(normalized);
    safeSetItem(PROFILE_STORAGE_KEY, applied);
    syncProfileControl(applied);
    if (iframe && iframe.contentWindow && currentEntry) {
      try {
        iframe.contentWindow.postMessage(
          { type: 'math-visuals:profile-change', profile: applied },
          '*'
        );
      } catch (_) {}
    }
    if (currentEntry) {
      const exampleArg = currentExampleIsExplicit && Number.isFinite(currentExampleNumber)
        ? currentExampleNumber
        : null;
      applyRoute(currentEntry, exampleArg, {
        refresh: true,
        updateHistory: false,
        skipStorage: true
      });
    }
  });
}

if (modeControl) {
  modeControl.addEventListener('change', event => {
    const target = event && event.target ? event.target : null;
    const selected = target && typeof target.value === 'string' ? target.value : MODE_DEFAULT;
    const normalized = normalizeMode(selected);
    if (normalized === currentMode) {
      syncModeControl(currentMode);
      return;
    }
    currentMode = normalized;
    safeSetItem(MODE_STORAGE_KEY, normalized);
    syncModeControl(normalized);
    handleModeUpdate({ forceTasks: true });
    if (iframe && iframe.contentWindow) {
      try {
        iframe.contentWindow.postMessage(
          { type: 'math-visuals:mode-change', mode: normalized },
          '*'
        );
      } catch (_) {}
    }
    if (currentEntry) {
      const exampleArg = currentExampleIsExplicit && Number.isFinite(currentExampleNumber)
        ? currentExampleNumber
        : null;
      applyRoute(currentEntry, exampleArg, {
        refresh: true,
        updateHistory: false,
        skipStorage: true
      });
    }
  });
}

const defaultEntry = navEntries.find(entry => entry.href === defaultPage) || navEntries[0] || null;

function setActive(current) {
  nav.querySelectorAll('a').forEach(link => {
    const isActive = link.getAttribute('href') === current;
    link.classList.toggle('active', isActive);
    if (isActive) {
      link.setAttribute('aria-current', 'page');
    } else {
      link.removeAttribute('aria-current');
    }
  });
}

function buildIframeSrc(href, exampleNumber, profile, mode) {
  const normalizedProfile = normalizeProfileName(profile || currentProfile);
  const normalizedMode = normalizeMode(mode || currentMode);
  const normalizedExample = Number.isFinite(exampleNumber) && exampleNumber > 0 ? Number(exampleNumber) : null;
  try {
    const url = new URL(href, window.location.origin);
    if (normalizedProfile) {
      url.searchParams.set('profile', normalizedProfile);
    }
    if (normalizedMode) {
      url.searchParams.set('mode', normalizedMode);
    }
    if (normalizedExample) {
      url.searchParams.set('example', String(normalizedExample));
    } else {
      url.searchParams.delete('example');
    }
    return `${url.pathname}${url.search}${url.hash}`;
  } catch (_) {
    const params = [];
    if (normalizedProfile) {
      params.push(['profile', normalizedProfile]);
    }
    if (normalizedMode) {
      params.push(['mode', normalizedMode]);
    }
    if (normalizedExample) {
      params.push(['example', String(normalizedExample)]);
    }
    if (!params.length) {
      return href;
    }
    const separator = href.includes('?') ? '&' : '?';
    const query = params
      .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(value)}`)
      .join('&');
    return `${href}${separator}${query}`;
  }
}

function normalizeEntryPath(path) {
  if (typeof path !== 'string') return '';
  try {
    const url = new URL(path, window.location.origin);
    return url.pathname;
  } catch (_) {
    if (path.startsWith('/')) return path;
    return `/${path}`;
  }
}

function buildHistoryPath(entry, exampleNumber) {
  if (!entry) return '/';
  const segment = typeof entry.routeSegment === 'string' ? entry.routeSegment.replace(/^\/+|\/+$/g, '') : '';
  const basePath = segment ? `/${segment}` : '/';
  const parsedExample = Number(exampleNumber);
  if (!Number.isFinite(parsedExample) || parsedExample <= 0) {
    return basePath;
  }
  const exampleInt = Math.trunc(parsedExample);
  const includeExample = exampleInt > 1 || entry.includeExampleInPath === true;
  if (!includeExample) {
    return basePath;
  }
  if (basePath === '/') {
    return `/eksempel${exampleInt}`;
  }
  return `${basePath}/eksempel${exampleInt}`;
}

function resolveEntryFromSegment(segment) {
  const key = normalizeLookupKey(segment);
  if (!key) return null;
  return navLookup.get(key) || null;
}

function parseExampleSegment(segment) {
  if (typeof segment !== 'string') return null;
  let decoded = segment;
  try {
    decoded = decodeURIComponent(segment);
  } catch (_) {}
  const match = decoded.match(/^eksempel[-_]?(\d+)$/i);
  if (!match) return null;
  const value = Number(match[1]);
  if (!Number.isFinite(value) || value <= 0) return null;
  return value;
}

function parseExampleFromSearch(search) {
  if (typeof search !== 'string' || !search) return null;
  try {
    const params = new URLSearchParams(search);
    const value = Number(params.get('example'));
    if (!Number.isFinite(value) || value <= 0) return null;
    return value;
  } catch (_) {
    return null;
  }
}

function parseRouteFromLocation() {
  if (typeof window === 'undefined') return null;
  const path = typeof window.location.pathname === 'string' ? window.location.pathname : '';
  const segments = path.split('/').filter(Boolean);
  if (!segments.length) {
    const exampleFromSearch = parseExampleFromSearch(window.location.search);
    if (!exampleFromSearch) return null;
    return defaultEntry ? { entry: defaultEntry, exampleNumber: exampleFromSearch } : null;
  }
  const entry = resolveEntryFromSegment(segments[0]);
  if (!entry) return null;
  let exampleNumber = null;
  if (segments.length > 1) {
    exampleNumber = parseExampleSegment(segments[1]);
  }
  if (exampleNumber == null) {
    exampleNumber = parseExampleFromSearch(window.location.search);
  }
  return { entry, exampleNumber };
}

function updateHistoryState(entry, exampleNumber, options = {}) {
  if (typeof window === 'undefined' || typeof history === 'undefined') return;
  const method = options.replaceHistory ? 'replaceState' : options.pushHistory ? 'pushState' : 'replaceState';
  if (typeof history[method] !== 'function') return;
  const path = buildHistoryPath(entry, exampleNumber);
  if (!path) return;
  if (method === 'replaceState' && lastHistoryPath === path && !options.force) {
    return;
  }
  const state = {
    __mathVisualsRoute__: true,
    segment: entry ? entry.routeSegment : null,
    href: entry ? entry.href : null,
    example: exampleNumber != null && Number.isFinite(exampleNumber) ? exampleNumber : null,
    mode: currentMode
  };
  history[method](state, '', path);
  lastHistoryPath = path;
}

function setIframeSrc(targetSrc, { refresh } = {}) {
  if (!iframe) return;
  const currentSrc = iframe.getAttribute('src') || '';
  let finalSrc = targetSrc;
  if (refresh || currentSrc === targetSrc) {
    const [pathAndQuery, ...hashParts] = targetSrc.split('#');
    const hash = hashParts.length ? `#${hashParts.join('#')}` : '';
    const separator = pathAndQuery.includes('?') ? '&' : '?';
    finalSrc = `${pathAndQuery}${separator}t=${Date.now()}${hash}`;
  }
  iframe.src = finalSrc;
}

function applyRoute(entry, exampleNumber, options = {}) {
  if (!entry) return;
  const explicitExample = Number.isFinite(exampleNumber) && exampleNumber > 0 ? Math.trunc(exampleNumber) : null;
  let normalizedExample = explicitExample;
  let defaultExample = null;
  if (Number.isFinite(entry.defaultExampleNumber) && entry.defaultExampleNumber > 0) {
    defaultExample = Math.trunc(entry.defaultExampleNumber);
  }
  if (normalizedExample == null && defaultExample != null) {
    normalizedExample = defaultExample;
  }
  const usingDefaultExample = normalizedExample != null && normalizedExample === defaultExample && explicitExample == null;
  const appliedExample = usingDefaultExample ? null : normalizedExample;
  const previousExample = currentExampleIsExplicit && Number.isFinite(currentExampleNumber)
    ? Math.trunc(currentExampleNumber)
    : null;
  const entryChanged = currentEntry !== entry;
  const exampleChanged = appliedExample !== previousExample;
  const targetSrc = buildIframeSrc(entry.href, appliedExample, currentProfile, currentMode);
  const shouldRefresh = options.refresh === true || (!entryChanged && exampleChanged);
  setIframeSrc(targetSrc, { refresh: shouldRefresh });
  setActive(entry.href);
  if (options.skipStorage !== true) {
    safeSetItem('currentPage', entry.href);
  }
  if (options.updateHistory !== false) {
    updateHistoryState(entry, appliedExample, options);
  }
  currentEntry = entry;
  currentExampleNumber = normalizedExample != null ? normalizedExample : null;
  currentExampleIsExplicit = appliedExample != null;
  updateActiveTaskIndicator();
  if (currentMode === 'task') {
    ensureTasksRendered().catch(() => {});
  }
}

const saved = safeGetItem('currentPage');
const normalizedSaved = typeof saved === 'string' ? saved.split(/[?#]/)[0] : null;
const savedEntry = normalizedSaved ? navEntries.find(entry => entry.href === normalizedSaved) : null;
const initialRoute = parseRouteFromLocation();
const initialEntry = initialRoute && initialRoute.entry ? initialRoute.entry : savedEntry || defaultEntry;
const initialExampleNumber = initialRoute ? initialRoute.exampleNumber : null;

if (initialEntry) {
  if (!savedEntry || savedEntry.href !== initialEntry.href) {
    safeSetItem('currentPage', initialEntry.href);
  }
  const initialOptions = initialRoute ? { replaceHistory: true } : { updateHistory: false };
  applyRoute(initialEntry, initialExampleNumber, initialOptions);
  if (!initialRoute) {
    lastHistoryPath = window.location.pathname || lastHistoryPath;
  }
}
function findNavLink(target) {
  if (!target) return null;
  let element = target;
  while (element) {
    if (element.nodeType === 1) {
      if (typeof element.closest === 'function') {
        const closestLink = element.closest('a');
        if (closestLink && nav.contains(closestLink)) {
          return closestLink;
        }
      }
      if (
        typeof element.tagName === 'string' &&
        element.tagName.toLowerCase() === 'a' &&
        nav.contains(element)
      ) {
        return element;
      }
    }
    element = element.parentNode || null;
  }
  return null;
}

nav.addEventListener('click', event => {
  const link = findNavLink(event && event.target);
  if (!link) return;
  event.preventDefault();
  const entry = link.__NAV_ENTRY__ || resolveEntryFromSegment(link.getAttribute('data-label') || link.getAttribute('href'));
  if (!entry) return;
  const options = {
    pushHistory: true,
    refresh: currentEntry === entry
  };
  applyRoute(entry, null, options);
});

window.addEventListener('popstate', event => {
  const state = event && event.state && typeof event.state === 'object' ? event.state : null;
  let modeChanged = false;
  if (state && Object.prototype.hasOwnProperty.call(state, 'mode')) {
    const normalized = normalizeMode(state.mode);
    if (normalized !== currentMode) {
      currentMode = normalized;
      safeSetItem(MODE_STORAGE_KEY, normalized);
      modeChanged = true;
    }
    syncModeControl(currentMode);
    handleModeUpdate({ forceTasks: modeChanged });
  }
  const route = parseRouteFromLocation();
  if (route && route.entry) {
    const options = {
      updateHistory: false,
      skipStorage: false
    };
    if (modeChanged) {
      options.refresh = true;
    }
    applyRoute(route.entry, route.exampleNumber, options);
    lastHistoryPath = window.location.pathname || lastHistoryPath;
  } else if (defaultEntry) {
    const options = {
      updateHistory: false,
      skipStorage: false
    };
    if (modeChanged) {
      options.refresh = true;
    }
    applyRoute(defaultEntry, null, options);
    lastHistoryPath = window.location.pathname || lastHistoryPath;
  }
});

window.addEventListener('message', event => {
  if (!iframe || event.source !== iframe.contentWindow) return;
  const data = event && event.data;
  if (!data || typeof data !== 'object') return;
  if (data.type === 'math-visuals:request-profile') {
    try {
      event.source.postMessage(
        { type: 'math-visuals:profile-change', profile: currentProfile },
        '*'
      );
    } catch (_) {}
    return;
  }
  if (data.type === 'math-visuals:request-mode') {
    try {
      event.source.postMessage(
        { type: 'math-visuals:mode-change', mode: currentMode },
        '*'
      );
    } catch (_) {}
    return;
  }
  if (data.type === 'math-visuals:mode-change') {
    const normalized = normalizeMode(data.mode);
    if (normalized && normalized !== currentMode) {
      currentMode = normalized;
      safeSetItem(MODE_STORAGE_KEY, normalized);
      syncModeControl(normalized);
      handleModeUpdate({ forceTasks: true });
    }
    return;
  }
  if (data.type !== 'math-visuals:example-change') return;
  if (!currentEntry) return;
  const normalizedPath = normalizeEntryPath(data.path || data.href || '');
  if (normalizedPath && currentEntry && normalizedPath !== currentEntry.path) {
    return;
  }
  const parsedNumber = Number(data.exampleNumber);
  const exampleNumber = Number.isFinite(parsedNumber) && parsedNumber > 0 ? Math.trunc(parsedNumber) : null;
  const previousExampleWasExplicit = currentExampleIsExplicit === true;
  let defaultExampleNumber = null;
  if (
    currentEntry &&
    Number.isFinite(currentEntry.defaultExampleNumber) &&
    currentEntry.defaultExampleNumber > 0
  ) {
    defaultExampleNumber = Math.trunc(currentEntry.defaultExampleNumber);
  }
  const matchesDefaultFallback =
    exampleNumber != null &&
    defaultExampleNumber != null &&
    exampleNumber === defaultExampleNumber &&
    !previousExampleWasExplicit;
  currentExampleNumber = exampleNumber;
  currentExampleIsExplicit = exampleNumber != null && !matchesDefaultFallback;
  updateHistoryState(currentEntry, exampleNumber, { replaceHistory: true, force: true });
  updateActiveTaskIndicator();
  if (currentMode === 'task') {
    ensureTasksRendered({ force: true }).catch(() => {});
  }
});
