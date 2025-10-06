// Viewer for stored examples
const globalScope = typeof window !== 'undefined' ? window : typeof globalThis !== 'undefined' ? globalThis : null;
const VIEWER_SCRIPT_FILENAME = 'examples-viewer.js';
const DESCRIPTION_RENDERER_FILENAME = 'description-renderer.js';
const DESCRIPTION_RENDERER_PROMISE_KEY = '__MATH_VISUALS_DESCRIPTION_RENDERER_PROMISE__';
const DESCRIPTION_RENDERER_URL_KEY = '__MATH_VISUALS_DESCRIPTION_RENDERER_URL__';
let descriptionRendererLoadPromise = null;
let descriptionRendererResolvedUrl = null;

function getDescriptionRendererGlobal() {
  if (!globalScope) return null;
  const renderer = globalScope.MathVisDescriptionRenderer;
  if (renderer && typeof renderer.renderInto === 'function') {
    return renderer;
  }
  return null;
}

function resolveDescriptionRendererUrl() {
  if (descriptionRendererResolvedUrl) return descriptionRendererResolvedUrl;
  if (globalScope) {
    const cached = globalScope[DESCRIPTION_RENDERER_URL_KEY];
    if (typeof cached === 'string' && cached.trim()) {
      descriptionRendererResolvedUrl = cached.trim();
      return descriptionRendererResolvedUrl;
    }
  }
  if (typeof document === 'undefined') {
    descriptionRendererResolvedUrl = DESCRIPTION_RENDERER_FILENAME;
    if (globalScope) {
      globalScope[DESCRIPTION_RENDERER_URL_KEY] = descriptionRendererResolvedUrl;
    }
    return descriptionRendererResolvedUrl;
  }
  const scripts = document.getElementsByTagName('script');
  let resolved = null;
  for (let i = scripts.length - 1; i >= 0; i--) {
    const script = scripts[i];
    if (!script) continue;
    const srcAttr = script.getAttribute && script.getAttribute('src');
    if (typeof srcAttr !== 'string') continue;
    const src = srcAttr.trim();
    if (!src) continue;
    const normalized = src.split('#')[0].split('?')[0];
    if (!normalized.endsWith(VIEWER_SCRIPT_FILENAME)) continue;
    try {
      const baseHref = typeof window !== 'undefined' && window && window.location ? window.location.href : undefined;
      const url = new URL(src, baseHref);
      const path = url.pathname || '';
      const basePath = path.replace(/[^/]*$/, '');
      url.pathname = `${basePath}${DESCRIPTION_RENDERER_FILENAME}`;
      url.search = '';
      url.hash = '';
      resolved = url.toString();
      break;
    } catch (error) {
      const slashIndex = src.lastIndexOf('/');
      const prefix = slashIndex >= 0 ? src.slice(0, slashIndex + 1) : '';
      resolved = `${prefix}${DESCRIPTION_RENDERER_FILENAME}`;
      break;
    }
  }
  descriptionRendererResolvedUrl = resolved || DESCRIPTION_RENDERER_FILENAME;
  if (globalScope) {
    globalScope[DESCRIPTION_RENDERER_URL_KEY] = descriptionRendererResolvedUrl;
  }
  return descriptionRendererResolvedUrl;
}

function ensureDescriptionRendererLoaded() {
  const existing = getDescriptionRendererGlobal();
  if (existing) return Promise.resolve(existing);
  if (globalScope) {
    const shared = globalScope[DESCRIPTION_RENDERER_PROMISE_KEY];
    if (shared && typeof shared.then === 'function') {
      return shared.then(() => getDescriptionRendererGlobal());
    }
  }
  if (descriptionRendererLoadPromise) {
    return descriptionRendererLoadPromise.then(() => getDescriptionRendererGlobal());
  }
  if (typeof document === 'undefined') {
    return Promise.resolve(null);
  }
  const parent = document.head || document.body || document.documentElement;
  if (!parent) {
    return Promise.resolve(null);
  }
  const scriptUrl = resolveDescriptionRendererUrl();
  if (!scriptUrl) {
    return Promise.resolve(null);
  }
  const loadPromise = new Promise(resolve => {
    const script = document.createElement('script');
    if (!script) {
      resolve(null);
      return;
    }
    let settled = false;
    const cleanup = () => {
      if (descriptionRendererLoadPromise === loadPromise) {
        descriptionRendererLoadPromise = null;
      }
      if (globalScope && globalScope[DESCRIPTION_RENDERER_PROMISE_KEY] === loadPromise) {
        delete globalScope[DESCRIPTION_RENDERER_PROMISE_KEY];
      }
    };
    script.async = true;
    script.src = scriptUrl;
    script.onload = () => {
      if (settled) return;
      settled = true;
      cleanup();
      const renderer = getDescriptionRendererGlobal();
      if (globalScope) {
        globalScope[DESCRIPTION_RENDERER_PROMISE_KEY] = Promise.resolve(renderer);
      }
      resolve(renderer);
    };
    script.onerror = () => {
      if (settled) return;
      settled = true;
      cleanup();
      resolve(null);
    };
    parent.appendChild(script);
  });
  descriptionRendererLoadPromise = loadPromise;
  if (globalScope) {
    globalScope[DESCRIPTION_RENDERER_PROMISE_KEY] = loadPromise;
  }
  return loadPromise.then(renderer => {
    if (!renderer && globalScope && globalScope[DESCRIPTION_RENDERER_PROMISE_KEY] === loadPromise) {
      delete globalScope[DESCRIPTION_RENDERER_PROMISE_KEY];
    }
    return renderer || null;
  });
}
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
function switchToFallback() {
  if (usingFallback) return storage;
  usingFallback = true;
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
  storage = sharedFallback;
  if (globalScope) {
    globalScope.__EXAMPLES_STORAGE__ = storage;
  }
  return storage;
}
function safeGetItem(key) {
  if (storage && typeof storage.getItem === 'function') {
    try {
      return storage.getItem(key);
    } catch (_) {
      return switchToFallback().getItem(key);
    }
  }
  return switchToFallback().getItem(key);
}
function safeSetItem(key, value) {
  if (storage && typeof storage.setItem === 'function') {
    try {
      storage.setItem(key, value);
      return;
    } catch (_) {
      // fall through to fallback
    }
  }
  switchToFallback().setItem(key, value);
}
function safeRemoveItem(key) {
  if (storage && typeof storage.removeItem === 'function') {
    try {
      storage.removeItem(key);
      return;
    } catch (_) {
      // fall through
    }
  }
  switchToFallback().removeItem(key);
}
function safeKey(index) {
  if (storage && typeof storage.key === 'function') {
    try {
      return storage.key(index);
    } catch (_) {
      // fall through
    }
  }
  const fallback = switchToFallback();
  return typeof fallback.key === 'function' ? fallback.key(index) : null;
}
function safeLength() {
  if (storage) {
    try {
      const value = storage.length;
      return typeof value === 'number' ? value : 0;
    } catch (_) {
      // fall through
    }
  }
  const fallback = switchToFallback();
  return typeof fallback.length === 'number' ? fallback.length : 0;
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
function normalizePath(value) {
  if (typeof value !== 'string') return '';
  let path = value.trim();
  if (!path) return '';
  if (!path.startsWith('/')) path = '/' + path;
  path = path.replace(/[\\]+/g, '/');
  path = path.replace(/\/+/g, '/');
  path = path.replace(/\/index\.html?$/i, '/');
  if (/\.html?$/i.test(path)) {
    path = path.replace(/\.html?$/i, '');
    if (!path) path = '/';
  }
  if (path.length > 1 && path.endsWith('/')) {
    path = path.slice(0, -1);
  }
  return path || '/';
}
const examplesApiBase = resolveExamplesApiBase();
const backendEntriesCache = new Map();
function writeLocalEntry(path, entry) {
  const key = 'examples_' + path;
  const examples = entry && Array.isArray(entry.examples) ? entry.examples : [];
  if (examples.length) {
    safeSetItem(key, JSON.stringify(examples));
  } else {
    safeRemoveItem(key);
  }
  const deleted = entry && Array.isArray(entry.deletedProvided) ? entry.deletedProvided.filter(value => typeof value === 'string' && value.trim()) : [];
  const deletedKey = key + '_deletedProvidedExamples';
  if (deleted.length) {
    safeSetItem(deletedKey, JSON.stringify(deleted));
  } else {
    safeRemoveItem(deletedKey);
  }
}
function readDeletedProvided(path) {
  const cached = backendEntriesCache.get(path);
  if (cached && Array.isArray(cached.deletedProvided)) {
    return cached.deletedProvided.slice();
  }
  const key = 'examples_' + path + '_deletedProvidedExamples';
  try {
    const stored = safeGetItem(key);
    if (!stored) return [];
    const parsed = JSON.parse(stored);
    if (!Array.isArray(parsed)) return [];
    return parsed.map(value => typeof value === 'string' ? value.trim() : '').filter(Boolean);
  } catch (error) {
    return [];
  }
}
function updateBackendCache(path, entry) {
  backendEntriesCache.set(path, {
    path,
    examples: entry && Array.isArray(entry.examples) ? entry.examples.slice() : [],
    deletedProvided: entry && Array.isArray(entry.deletedProvided) ? entry.deletedProvided.slice() : [],
    updatedAt: entry && entry.updatedAt ? entry.updatedAt : null
  });
}
async function persistBackendEntry(path, entry) {
  if (!examplesApiBase) return;
  const url = buildExamplesApiUrl(examplesApiBase, path);
  if (!url) return;
  const examples = entry && Array.isArray(entry.examples) ? entry.examples : [];
  const deletedProvided = entry && Array.isArray(entry.deletedProvided) ? entry.deletedProvided.filter(value => typeof value === 'string' && value.trim()) : [];
  try {
    if (!examples.length && !deletedProvided.length) {
      const res = await fetch(url, { method: 'DELETE' });
      if (res.ok || res.status === 404) {
        backendEntriesCache.delete(path);
      }
      return;
    }
    const payload = {
      path,
      examples,
      deletedProvided,
      updatedAt: new Date().toISOString()
    };
    await fetch(url, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });
    updateBackendCache(path, payload);
  } catch (error) {}
}
async function fetchBackendEntries() {
  if (!examplesApiBase) return null;
  const url = buildExamplesApiUrl(examplesApiBase);
  if (!url) return null;
  let res;
  try {
    res = await fetch(url, {
      headers: {
        Accept: 'application/json'
      }
    });
  } catch (error) {
    return null;
  }
  if (!res.ok) return null;
  let data = null;
  try {
    data = await res.json();
  } catch (error) {
    return null;
  }
  const entries = Array.isArray(data && data.entries) ? data.entries : [];
  const normalized = [];
  entries.forEach(item => {
    if (!item || typeof item !== 'object') return;
    const path = normalizePath(item.path);
    if (!path) return;
    const examples = Array.isArray(item.examples) ? item.examples : [];
    const deletedProvided = Array.isArray(item.deletedProvided) ? item.deletedProvided.filter(value => typeof value === 'string' && value.trim()) : [];
    const entry = {
      path,
      examples,
      deletedProvided,
      updatedAt: item.updatedAt || null
    };
    updateBackendCache(path, entry);
    writeLocalEntry(path, entry);
    if (examples.length) {
      normalized.push({
        path,
        examples
      });
    }
  });
  return normalized;
}
async function renderExamples(options) {
  const container = document.getElementById('examples');
  if (!container) return;
  const skipBackend = options && options.skipBackend;
  if (!skipBackend) {
    await fetchBackendEntries();
  }
  const sections = [];
  const seen = new Set();
  backendEntriesCache.forEach(entry => {
    if (!entry || !Array.isArray(entry.examples) || entry.examples.length === 0) return;
    sections.push({
      path: entry.path,
      examples: entry.examples.slice()
    });
    seen.add(entry.path);
  });
  const total = safeLength();
  for (let i = 0; i < total; i++) {
    const key = safeKey(i);
    if (typeof key !== 'string' || !key || !key.startsWith('examples_')) continue;
    const path = key.slice('examples_'.length);
    if (seen.has(path)) continue;
    let arr;
    try {
      arr = JSON.parse(safeGetItem(key)) || [];
    } catch (error) {
      arr = [];
    }
    if (!Array.isArray(arr) || arr.length === 0) continue;
    sections.push({
      path,
      examples: arr.slice()
    });
  }
  sections.sort((a, b) => a.path.localeCompare(b.path));
  container.innerHTML = '';
  let descriptionRendererPromise = null;
  let rendererLoadFailed = false;
  const ensureRendererPromise = () => {
    if (rendererLoadFailed) return null;
    if (!descriptionRendererPromise) {
      descriptionRendererPromise = ensureDescriptionRendererLoaded();
    }
    return descriptionRendererPromise;
  };
  const appendDescription = async (wrap, text, beforeNode) => {
    if (!wrap || typeof text !== 'string') return;
    const trimmed = text.trim();
    if (!trimmed) return;
    const description = document.createElement('div');
    description.className = 'example-description example-description-preview';
    description.style.margin = '0 0 8px';
    if (!rendererLoadFailed) {
      try {
        const promise = ensureRendererPromise();
        const renderer = promise ? await promise : null;
        if (renderer && typeof renderer.renderInto === 'function') {
          const hasContent = renderer.renderInto(description, text);
          if (hasContent) {
            if (beforeNode && typeof wrap.insertBefore === 'function') {
              wrap.insertBefore(description, beforeNode);
            } else {
              wrap.appendChild(description);
            }
            return;
          }
          return;
        }
        rendererLoadFailed = true;
        descriptionRendererPromise = null;
      } catch (error) {
        rendererLoadFailed = true;
        descriptionRendererPromise = null;
      }
    }
    if (!rendererLoadFailed) return;
    description.textContent = text;
    description.style.whiteSpace = 'pre-wrap';
    if (beforeNode && typeof wrap.insertBefore === 'function') {
      wrap.insertBefore(description, beforeNode);
    } else {
      wrap.appendChild(description);
    }
  };
  for (const sectionData of sections) {
    const { path, examples } = sectionData;
    if (!Array.isArray(examples) || examples.length === 0) continue;
    const section = document.createElement('section');
    const h2 = document.createElement('h2');
    h2.textContent = path;
    section.appendChild(h2);
    for (let idx = 0; idx < examples.length; idx++) {
      const ex = examples[idx];
      const wrap = document.createElement('div');
      wrap.className = 'example';
      const iframe = document.createElement('iframe');
      iframe.setAttribute('loading', 'lazy');
      iframe.title = `Eksempel ${idx + 1} – ${path}`;
      try {
        const url = new URL(path, window.location.href);
        url.searchParams.set('example', String(idx + 1));
        iframe.src = url.href;
      } catch (error) {
        const sep = path.includes('?') ? '&' : '?';
        iframe.src = `${path}${sep}example=${idx + 1}`;
      }
      wrap.appendChild(iframe);
      if (ex && typeof ex.description === 'string') {
        appendDescription(wrap, ex.description, iframe).catch(() => {});
      }
      const btns = document.createElement('div');
      btns.className = 'buttons';
      const loadBtn = document.createElement('button');
      loadBtn.textContent = 'Last inn';
      loadBtn.addEventListener('click', () => {
        safeSetItem('example_to_load', JSON.stringify({
          path,
          index: idx
        }));
        const iframeEl = window.parent.document.querySelector('iframe');
        iframeEl.src = path;
        try {
          window.parent.localStorage.setItem('currentPage', path);
        } catch (_) {
          try {
            if (window.parent.__EXAMPLES_STORAGE__ && typeof window.parent.__EXAMPLES_STORAGE__.setItem === 'function') {
              window.parent.__EXAMPLES_STORAGE__.setItem('currentPage', path);
            }
          } catch (_) {}
        }
        if (window.parent.setActive) window.parent.setActive(path);
      });
      const delBtn = document.createElement('button');
      delBtn.textContent = 'Slett';
      delBtn.addEventListener('click', async () => {
        const updated = examples.slice();
        updated.splice(idx, 1);
        const deletedProvided = readDeletedProvided(path);
        writeLocalEntry(path, {
          examples: updated,
          deletedProvided
        });
        if (updated.length) {
          updateBackendCache(path, {
            path,
            examples: updated,
            deletedProvided
          });
        } else {
          backendEntriesCache.delete(path);
        }
        if (examplesApiBase) {
          await persistBackendEntry(path, {
            examples: updated,
            deletedProvided
          });
        }
        renderExamples({ skipBackend: true });
      });
      btns.appendChild(loadBtn);
      btns.appendChild(delBtn);
      wrap.appendChild(btns);
      section.appendChild(wrap);
    }
    container.appendChild(section);
  }
}
document.addEventListener('DOMContentLoaded', () => {
  renderExamples();
});
