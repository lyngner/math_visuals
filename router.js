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
const iframe = document.querySelector('iframe');
const nav = document.querySelector('nav');
const defaultPage = 'nkant.html';
const links = Array.from(nav.querySelectorAll('a'));
const saved = safeGetItem('currentPage');
const initialPage = saved && links.some(link => link.getAttribute('href') === saved) ? saved : defaultPage;
if (initialPage !== saved) {
  safeSetItem('currentPage', initialPage);
}
iframe.src = initialPage;
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
setActive(initialPage);
nav.addEventListener('click', event => {
  const link = event.target.closest('a');
  if (!link) return;
  event.preventDefault();
  const href = link.getAttribute('href');
  const currentSrc = iframe.getAttribute('src') || '';
  const toPath = value => {
    try {
      return new URL(value, window.location.href).pathname;
    } catch (error) {
      return value;
    }
  };
  const currentPath = currentSrc ? toPath(currentSrc) : null;
  const targetPath = toPath(href);
  const needsRefresh = currentPath === targetPath;
  let cacheBustingSrc = href;
  if (needsRefresh) {
    const [pathAndQuery, ...hashParts] = href.split('#');
    const hash = hashParts.length ? `#${hashParts.join('#')}` : '';
    const separator = pathAndQuery.includes('?') ? '&' : '?';
    cacheBustingSrc = `${pathAndQuery}${separator}t=${Date.now()}${hash}`;
  }
  iframe.src = cacheBustingSrc;
  safeSetItem('currentPage', href);
  setActive(href);
});
