// Viewer for stored examples
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
function renderExamples() {
  const container = document.getElementById('examples');
  container.innerHTML = '';
  const total = safeLength();
  for (let i = 0; i < total; i++) {
    const key = safeKey(i);
    if (typeof key !== 'string' || !key) continue;
    if (!key.startsWith('examples_')) continue;
    const path = key.slice('examples_'.length);
    let arr;
    try {
      arr = JSON.parse(safeGetItem(key)) || [];
    } catch (error) {
      arr = [];
    }
    if (arr.length === 0) continue;
    const section = document.createElement('section');
    const h2 = document.createElement('h2');
    h2.textContent = path;
    section.appendChild(h2);
    arr.forEach((ex, idx) => {
      const wrap = document.createElement('div');
      wrap.className = 'example';
      if (ex && typeof ex.description === 'string' && ex.description.trim()) {
        const description = document.createElement('p');
        description.className = 'example-description';
        description.textContent = ex.description;
        description.style.whiteSpace = 'pre-wrap';
        description.style.margin = '0 0 8px';
        wrap.appendChild(description);
      }
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
      const btns = document.createElement('div');
      btns.className = 'buttons';
      const loadBtn = document.createElement('button');
      loadBtn.textContent = 'Last inn';
      loadBtn.addEventListener('click', () => {
        safeSetItem('example_to_load', JSON.stringify({
          path,
          index: idx
        }));
        const iframe = window.parent.document.querySelector('iframe');
        iframe.src = path;
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
      delBtn.addEventListener('click', () => {
        arr.splice(idx, 1);
        if (arr.length) safeSetItem(key, JSON.stringify(arr));else safeRemoveItem(key);
        renderExamples();
      });
      btns.appendChild(loadBtn);
      btns.appendChild(delBtn);
      wrap.appendChild(btns);
      section.appendChild(wrap);
    });
    container.appendChild(section);
  }
}
document.addEventListener('DOMContentLoaded', renderExamples);
