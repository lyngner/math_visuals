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

const PROFILE_STORAGE_KEY = 'profile';
const PROFILE_DEFAULT = 'kikora';
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
const iframe = document.querySelector('iframe');
const nav = document.querySelector('nav');
const profileControl = nav ? nav.querySelector('[data-profile-control]') : null;

function syncProfileControl(profile) {
  if (!profileControl) return;
  if (profileControl.value !== profile) {
    profileControl.value = profile;
  }
}

syncProfileControl(currentProfile);

if (typeof document !== 'undefined') {
  document.addEventListener('DOMContentLoaded', () => {
    syncProfileControl(currentProfile);
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
  const lookupKeys = collectLookupKeys(routeSegment, label, href, path);
  const entry = {
    link,
    href,
    label,
    routeSegment,
    path,
    lookupKeys
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
      applyRoute(currentEntry, currentExampleNumber, {
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

function buildIframeSrc(href, exampleNumber, profile) {
  const normalizedProfile = normalizeProfileName(profile || currentProfile);
  const normalizedExample = Number.isFinite(exampleNumber) && exampleNumber > 0 ? Number(exampleNumber) : null;
  try {
    const url = new URL(href, window.location.origin);
    if (normalizedProfile) {
      url.searchParams.set('profile', normalizedProfile);
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
  const baseSegment = `/${entry.routeSegment || ''}`.replace(/\/+$/, '');
  if (!exampleNumber || !Number.isFinite(exampleNumber) || exampleNumber <= 1) {
    return baseSegment || '/';
  }
  return `${baseSegment || ''}/eksempel${exampleNumber}`;
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

let currentEntry = null;
let currentExampleNumber = null;
let lastHistoryPath = null;

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
    example: exampleNumber != null && Number.isFinite(exampleNumber) ? exampleNumber : null
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
  const normalizedExample = Number.isFinite(exampleNumber) && exampleNumber > 0 ? exampleNumber : null;
  const entryChanged = currentEntry !== entry;
  const exampleChanged = normalizedExample !== (currentExampleNumber != null ? currentExampleNumber : null);
  const targetSrc = buildIframeSrc(entry.href, normalizedExample, currentProfile);
  const shouldRefresh = options.refresh === true || (!entryChanged && exampleChanged);
  setIframeSrc(targetSrc, { refresh: shouldRefresh });
  setActive(entry.href);
  if (options.skipStorage !== true) {
    safeSetItem('currentPage', entry.href);
  }
  if (options.updateHistory !== false) {
    updateHistoryState(entry, normalizedExample, options);
  }
  currentEntry = entry;
  currentExampleNumber = normalizedExample;
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

window.addEventListener('popstate', () => {
  const route = parseRouteFromLocation();
  if (route && route.entry) {
    applyRoute(route.entry, route.exampleNumber, {
      updateHistory: false,
      skipStorage: false
    });
    lastHistoryPath = window.location.pathname || lastHistoryPath;
  } else if (defaultEntry) {
    applyRoute(defaultEntry, null, {
      updateHistory: false,
      skipStorage: false
    });
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
  if (data.type !== 'math-visuals:example-change') return;
  if (!currentEntry) return;
  const normalizedPath = normalizeEntryPath(data.path || data.href || '');
  if (normalizedPath && currentEntry && normalizedPath !== currentEntry.path) {
    return;
  }
  const parsedNumber = Number(data.exampleNumber);
  const exampleNumber = Number.isFinite(parsedNumber) && parsedNumber > 0 ? parsedNumber : null;
  currentExampleNumber = exampleNumber;
  updateHistoryState(currentEntry, exampleNumber, { replaceHistory: true, force: true });
});
