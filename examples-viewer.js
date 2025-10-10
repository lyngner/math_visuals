// Viewer for stored examples
const globalScope = typeof window !== 'undefined' ? window : typeof globalThis !== 'undefined' ? globalThis : null;
const VIEWER_SCRIPT_FILENAME = 'examples-viewer.js';
const DESCRIPTION_RENDERER_FILENAME = 'description-renderer.js';
const DESCRIPTION_RENDERER_PROMISE_KEY = '__MATH_VISUALS_DESCRIPTION_RENDERER_PROMISE__';
const DESCRIPTION_RENDERER_URL_KEY = '__MATH_VISUALS_DESCRIPTION_RENDERER_URL__';
const SHARED_STORAGE_KEY = '__EXAMPLES_STORAGE__';
const EXAMPLE_SELECTION_KEY = 'example_to_load';
const CURRENT_PAGE_KEY = 'currentPage';
let descriptionRendererLoadPromise = null;
let descriptionRendererResolvedUrl = null;

function createMemoryStorage(initialData) {
  const data = new Map();
  if (initialData && typeof initialData === 'object') {
    Object.keys(initialData).forEach(key => {
      const normalized = String(key);
      const value = initialData[key];
      data.set(normalized, value == null ? 'null' : String(value));
    });
  }
  return {
    get length() {
      return data.size;
    },
    key(index) {
      if (!Number.isInteger(index) || index < 0 || index >= data.size) return null;
      let i = 0;
      for (const key of data.keys()) {
        if (i === index) return key;
        i += 1;
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

function getSharedExamplesStorage() {
  if (globalScope && globalScope[SHARED_STORAGE_KEY] && typeof globalScope[SHARED_STORAGE_KEY].getItem === 'function') {
    return globalScope[SHARED_STORAGE_KEY];
  }
  const store = createMemoryStorage();
  if (globalScope) {
    globalScope[SHARED_STORAGE_KEY] = store;
  }
  return store;
}

function sharedStorageSetItem(key, value) {
  if (!key) return;
  const store = getSharedExamplesStorage();
  if (!store || typeof store.setItem !== 'function') return;
  try {
    store.setItem(String(key), value == null ? 'null' : String(value));
  } catch (error) {}
}

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
let lastStatusMessage = '';
let lastStatusType = '';

function ensureStatusElement() {
  if (typeof document === 'undefined') return null;
  if (ensureStatusElement.element && ensureStatusElement.element.isConnected) {
    return ensureStatusElement.element;
  }
  let el = document.getElementById('examples-status');
  if (!el) {
    el = document.createElement('p');
    el.id = 'examples-status';
    el.className = 'examples-status';
    el.setAttribute('role', 'status');
    el.hidden = true;
    const container = document.getElementById('examples');
    if (container && container.parentNode) {
      container.parentNode.insertBefore(el, container);
    } else if (document.body) {
      document.body.insertBefore(el, document.body.firstChild || null);
    }
  }
  ensureStatusElement.element = el;
  return el;
}

function setStatusMessage(message, type) {
  const normalizedMessage = typeof message === 'string' ? message : '';
  const normalizedType = typeof type === 'string' ? type : '';
  if (normalizedMessage === lastStatusMessage && normalizedType === lastStatusType) {
    return;
  }
  lastStatusMessage = normalizedMessage;
  lastStatusType = normalizedType;
  const el = ensureStatusElement();
  if (!el) return;
  el.textContent = normalizedMessage;
  el.hidden = !normalizedMessage;
  if (normalizedType) {
    el.dataset.statusType = normalizedType;
  } else if (el.dataset && Object.prototype.hasOwnProperty.call(el.dataset, 'statusType')) {
    delete el.dataset.statusType;
  }
  el.classList.toggle('examples-status--error', normalizedType === 'error');
}
function getCachedEntry(path) {
  const entry = backendEntriesCache.get(path);
  if (!entry) return { path, examples: [], deletedProvided: [], updatedAt: null };
  return {
    path,
    examples: Array.isArray(entry.examples) ? entry.examples.slice() : [],
    deletedProvided: Array.isArray(entry.deletedProvided) ? entry.deletedProvided.slice() : [],
    updatedAt: entry && entry.updatedAt ? entry.updatedAt : null
  };
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
        setStatusMessage('', '');
      } else {
        setStatusMessage(`Kunne ikke fjerne eksempelet «${path}» fra serveren.`, 'error');
      }
      return;
    }
    const payload = {
      path,
      examples,
      deletedProvided,
      updatedAt: new Date().toISOString()
    };
    const response = await fetch(url, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });
    if (!response.ok) {
      setStatusMessage(`Kunne ikke lagre endringene for «${path}» på serveren.`, 'error');
      return;
    }
    let persisted = null;
    try {
      persisted = await response.json();
    } catch (error) {
      persisted = null;
    }
    if (persisted && typeof persisted === 'object') {
      updateBackendCache(path, persisted);
    } else {
      updateBackendCache(path, payload);
    }
    setStatusMessage('', '');
  } catch (error) {
    setStatusMessage(`Kunne ikke lagre endringene for «${path}» på serveren.`, 'error');
  }
}
function rememberExampleSelection(path, index) {
  const selection = JSON.stringify({ path, index });
  sharedStorageSetItem(EXAMPLE_SELECTION_KEY, selection);
  sharedStorageSetItem(CURRENT_PAGE_KEY, path);
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(EXAMPLE_SELECTION_KEY, selection);
  } catch (error) {}
  try {
    window.localStorage.setItem(CURRENT_PAGE_KEY, path);
  } catch (error) {}
}
async function fetchBackendEntries() {
  if (!examplesApiBase) {
    setStatusMessage('Lagringstjenesten for eksempler er ikke konfigurert.', 'error');
    return null;
  }
  const url = buildExamplesApiUrl(examplesApiBase);
  if (!url) {
    setStatusMessage('Fant ikke adressen til eksempellageret.', 'error');
    return null;
  }
  let res;
  try {
    res = await fetch(url, {
      headers: {
        Accept: 'application/json'
      }
    });
  } catch (error) {
    setStatusMessage('Kunne ikke hente eksempler fra serveren.', 'error');
    return null;
  }
  if (!res.ok) {
    setStatusMessage(`Serveren svarte med ${res.status}.`, 'error');
    return null;
  }
  let data = null;
  try {
    data = await res.json();
  } catch (error) {
    setStatusMessage('Kunne ikke tolke svaret fra serveren.', 'error');
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
    if (examples.length) {
      normalized.push({
        path,
        examples
      });
    }
  });
  setStatusMessage('', '');
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
  backendEntriesCache.forEach(entry => {
    if (!entry || !Array.isArray(entry.examples) || entry.examples.length === 0) return;
    sections.push({
      path: entry.path,
      examples: entry.examples.slice()
    });
  });
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
    description.classList.add('math-vis-description-rendered');
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
        rememberExampleSelection(path, idx);
        try {
          const parentWindow = window.parent;
          if (!parentWindow || parentWindow === window) {
            return;
          }
          let iframeEl = null;
          try {
            iframeEl = parentWindow.document && typeof parentWindow.document.querySelector === 'function'
              ? parentWindow.document.querySelector('iframe')
              : null;
          } catch (_) {
            iframeEl = null;
          }
          if (iframeEl) {
            iframeEl.src = path;
          }
          if (typeof parentWindow.setActive === 'function') {
            parentWindow.setActive(path);
          }
        } catch (_) {}
      });
      const delBtn = document.createElement('button');
      delBtn.textContent = 'Slett';
      delBtn.addEventListener('click', async () => {
        const cached = getCachedEntry(path);
        const updated = Array.isArray(cached.examples) ? cached.examples.slice() : examples.slice();
        const removed = updated.splice(idx, 1);
        const deletedProvided = Array.isArray(cached.deletedProvided) ? cached.deletedProvided.slice() : [];
        const builtinKey = removed && removed.length ? removed[0] && removed[0].__builtinKey : null;
        if (typeof builtinKey === 'string') {
          const normalized = builtinKey.trim();
          if (normalized && !deletedProvided.includes(normalized)) {
            deletedProvided.push(normalized);
          }
        }
        if (updated.length || deletedProvided.length) {
          updateBackendCache(path, {
            path,
            examples: updated,
            deletedProvided
          });
        } else {
          backendEntriesCache.delete(path);
        }
        await persistBackendEntry(path, {
          examples: updated,
          deletedProvided
        });
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
  setStatusMessage('', '');
  renderExamples();
});
