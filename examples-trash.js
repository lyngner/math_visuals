(function () {
  'use strict';

  const MAX_HISTORY_ENTRIES = 10;
  const EXAMPLE_VALUE_TYPE_KEY = '__mathVisualsType__';
  const EXAMPLE_VALUE_DATA_KEY = '__mathVisualsValue__';
  const globalScope = typeof window !== 'undefined' ? window : typeof globalThis !== 'undefined' ? globalThis : null;

  function createMemoryStorage() {
    const data = new Map();
    return {
      get length() {
        return data.size;
      },
      key(index) {
        if (!Number.isInteger(index) || index < 0 || index >= data.size) return null;
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

  function resolveSharedStorage() {
    if (globalScope && globalScope.__EXAMPLES_STORAGE__ && typeof globalScope.__EXAMPLES_STORAGE__.getItem === 'function') {
      return globalScope.__EXAMPLES_STORAGE__;
    }
    const store = createMemoryStorage();
    if (globalScope) {
      globalScope.__EXAMPLES_STORAGE__ = store;
    }
    return store;
  }

  const storage = resolveSharedStorage();

  function safeGetItem(key) {
    if (!storage || typeof storage.getItem !== 'function') return null;
    try {
      return storage.getItem(key);
    } catch (error) {
      return null;
    }
  }

  function safeSetItem(key, value) {
    if (!storage || typeof storage.setItem !== 'function') return;
    try {
      storage.setItem(key, value);
    } catch (error) {}
  }

  function safeRemoveItem(key) {
    if (!storage || typeof storage.removeItem !== 'function') return;
    try {
      storage.removeItem(key);
    } catch (error) {}
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

  function normalizeBackendPath(value) {
    if (typeof value !== 'string') return '';
    let path = value.trim();
    if (!path) return '';
    if (!path.startsWith('/')) {
      path = `/${path}`;
    }
    path = path.replace(/[\\]+/g, '/');
    path = path.replace(/\/+/g, '/');
    if (path.length > 1 && path.endsWith('/')) {
      path = path.slice(0, -1);
    }
    return path;
  }

  const examplesApiBase = resolveExamplesApiBase();
  const backendEntriesCache = new Map();
  let backendIndexPromise = null;

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
        } catch (error) {}
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
      } catch (error) {
        try {
          return new RegExp(pattern);
        } catch (error2) {
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
    const parsed = JSON.parse(raw);
    return deserializeExampleValue(parsed, new WeakMap());
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

  function serializeTrashEntries(entries) {
    const seen = new WeakMap();
    return JSON.stringify(entries, (_, value) => serializeExampleValue(value, seen));
  }

  function deserializeTrashEntries(raw) {
    if (typeof raw !== 'string' || !raw.trim()) return [];
    try {
      const parsed = JSON.parse(raw);
      const value = deserializeExampleValue(parsed, new WeakMap());
      return Array.isArray(value) ? value : [];
    } catch (error) {
      return [];
    }
  }

  function generateTrashId() {
    const rand = Math.random().toString(36).slice(2, 10);
    const timestamp = Date.now().toString(36);
    return `${timestamp}-${rand}`;
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

  function summarizeDescription(example) {
    if (!example || typeof example !== 'object') return '';
    if (typeof example.description === 'string' && example.description.trim()) {
      const text = example.description.trim();
      if (text.length <= 320) return text;
      return `${text.slice(0, 317)}…`;
    }
    return '';
  }

  function sanitizeSvgElementTree(element) {
    if (!element || typeof element.tagName !== 'string') return;
    const tagName = element.tagName.toLowerCase();
    if (tagName === 'script' || tagName === 'foreignobject') {
      element.remove();
      return;
    }
    if (element.attributes) {
      for (let i = element.attributes.length - 1; i >= 0; i--) {
        const attr = element.attributes[i];
        if (!attr || typeof attr.name !== 'string') continue;
        const name = attr.name;
        if (/^on/i.test(name)) {
          element.removeAttribute(name);
          continue;
        }
        const value = typeof attr.value === 'string' ? attr.value : '';
        if ((name === 'href' || name === 'xlink:href') && /^(\s*javascript:|\s*data:(?!image\/(?:svg\+xml|png|jpeg|gif)))/i.test(value)) {
          element.removeAttribute(name);
          continue;
        }
        if (name === 'style' && (/(expression\s*\()/i.test(value) || /url\(\s*['"]?javascript:/i.test(value))) {
          element.removeAttribute(name);
        }
      }
    }
    const children = element.children ? Array.from(element.children) : [];
    children.forEach(child => sanitizeSvgElementTree(child));
  }

  function createSvgPreviewNode(svgMarkup) {
    if (typeof document === 'undefined') return null;
    if (typeof svgMarkup !== 'string') return null;
    const trimmed = svgMarkup.trim();
    if (!trimmed) return null;
    let svgElement = null;
    if (typeof DOMParser === 'function') {
      try {
        const parser = new DOMParser();
        const doc = parser.parseFromString(trimmed, 'image/svg+xml');
        const hasParserError = doc && doc.getElementsByTagName('parsererror').length > 0;
        if (!hasParserError && doc && doc.documentElement && doc.documentElement.tagName && doc.documentElement.tagName.toLowerCase() === 'svg') {
          svgElement = document.importNode(doc.documentElement, true);
        }
      } catch (error) {
        svgElement = null;
      }
    }
    if (!svgElement) {
      const wrapper = document.createElement('div');
      wrapper.innerHTML = trimmed;
      const candidate = wrapper.querySelector('svg');
      if (candidate) {
        svgElement = candidate.cloneNode(true);
      }
    }
    if (!svgElement) return null;
    sanitizeSvgElementTree(svgElement);
    return svgElement;
  }

  function renderExamplePreview(container, example) {
    if (!container) return false;
    if (!example || typeof example !== 'object') {
      container.innerHTML = '';
      return false;
    }
    const svgMarkup = typeof example.svg === 'string' ? example.svg : '';
    if (!svgMarkup || !svgMarkup.trim()) {
      container.innerHTML = '';
      return false;
    }
    const svgElement = createSvgPreviewNode(svgMarkup);
    if (!svgElement) {
      container.innerHTML = '';
      return false;
    }
    container.innerHTML = '';
    container.appendChild(svgElement);
    return true;
  }

  function formatTimestamp(value) {
    if (typeof value !== 'string') return '';
    const trimmed = value.trim();
    if (!trimmed) return '';
    const date = new Date(trimmed);
    if (Number.isNaN(date.getTime())) {
      return trimmed;
    }
    try {
      return date.toLocaleString('nb-NO');
    } catch (error) {
      try {
        return date.toLocaleString();
      } catch (error2) {}
    }
    try {
      return date.toISOString();
    } catch (error3) {}
    return trimmed;
  }

  function buildStorageKey(path) {
    return `examples_${path}`;
  }

  function buildTrashKey(path) {
    return `${buildStorageKey(path)}_trash`;
  }

  function buildHistoryKey(path) {
    return `${buildStorageKey(path)}_history`;
  }

  function normalizeTrashRecord(record) {
    if (!record || typeof record !== 'object') return null;
    const example = record.example && typeof record.example === 'object' ? record.example : null;
    if (!example) return null;
    const id = typeof record.id === 'string' && record.id.trim() ? record.id.trim() : generateTrashId();
    const label = typeof record.label === 'string' && record.label.trim() ? record.label.trim() : deriveExampleLabel(example);
    return {
      id,
      example,
      label,
      deletedAt: typeof record.deletedAt === 'string' ? record.deletedAt : '',
      sourcePath: typeof record.sourcePath === 'string' ? record.sourcePath : '',
      sourceHref: typeof record.sourceHref === 'string' ? record.sourceHref : '',
      sourceTitle: typeof record.sourceTitle === 'string' ? record.sourceTitle : '',
      reason: typeof record.reason === 'string' ? record.reason : '',
      removedAtIndex: Number.isInteger(record.removedAtIndex) ? record.removedAtIndex : null,
      importedFromHistory: record.importedFromHistory === true
    };
  }

  function loadTrashEntriesForPath(path) {
    const key = buildTrashKey(path);
    const raw = safeGetItem(key);
    if (typeof raw !== 'string' || !raw.trim()) return [];
    const parsed = deserializeTrashEntries(raw);
    const normalized = [];
    parsed.forEach(record => {
      const normalizedRecord = normalizeTrashRecord(record);
      if (normalizedRecord) normalized.push(normalizedRecord);
    });
    return normalized;
  }

  function saveTrashEntriesForPath(path, entries) {
    const normalized = Array.isArray(entries) ? entries.map(normalizeTrashRecord).filter(Boolean) : [];
    const key = buildTrashKey(path);
    if (!normalized.length) {
      safeRemoveItem(key);
      return [];
    }
    try {
      const serialized = serializeTrashEntries(normalized);
      safeSetItem(key, serialized);
    } catch (error) {}
    return normalized;
  }

  function rememberHistoryRawForPath(path, rawValue, reason) {
    if (typeof rawValue !== 'string') return;
    const trimmed = rawValue.trim();
    if (!trimmed) return;
    const historyKey = buildHistoryKey(path);
    let existing = [];
    const stored = safeGetItem(historyKey);
    if (typeof stored === 'string' && stored.trim()) {
      try {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed)) {
          existing = parsed;
        }
      } catch (error) {}
    }
    const now = new Date().toISOString();
    const pushEntry = (entry, defaultReason) => {
      if (!entry || typeof entry.data !== 'string') return;
      const data = entry.data.trim();
      if (!data) return;
      const seen = pushEntry._seen || (pushEntry._seen = new Set());
      if (seen.has(data)) return;
      seen.add(data);
      const normalized = {
        data,
        reason: typeof entry.reason === 'string' && entry.reason.trim() ? entry.reason.trim() : defaultReason || 'unknown',
        savedAt: typeof entry.savedAt === 'string' && entry.savedAt.trim() ? entry.savedAt.trim() : now
      };
      pushEntry._entries.push(normalized);
    };
    pushEntry._entries = [];
    pushEntry({
      data: trimmed,
      reason: typeof reason === 'string' && reason.trim() ? reason.trim() : 'restore-from-trash',
      savedAt: now
    });
    existing.forEach(item => pushEntry(item, 'previous'));
    const entries = pushEntry._entries.slice(0, MAX_HISTORY_ENTRIES);
    delete pushEntry._entries;
    delete pushEntry._seen;
    if (!entries.length) {
      safeRemoveItem(historyKey);
    } else {
      try {
        safeSetItem(historyKey, JSON.stringify(entries));
      } catch (error) {}
    }
  }

  function loadExamplesForPath(path) {
    const key = buildStorageKey(path);
    const raw = safeGetItem(key);
    if (typeof raw !== 'string' || !raw.trim()) return [];
    const parsed = parseExamplesFromRaw(raw);
    if (parsed.status === 'ok' && Array.isArray(parsed.examples)) {
      return parsed.examples;
    }
    return [];
  }

  function saveExamplesForPath(path, examples) {
    const key = buildStorageKey(path);
    const raw = serializeExamplesForStorage(Array.isArray(examples) ? examples : []);
    safeSetItem(key, raw);
    return raw;
  }

  function restoreTrashRecord(path, id) {
    const entries = loadTrashEntriesForPath(path);
    const index = entries.findIndex(entry => entry.id === id);
    if (index === -1) {
      throw new Error('Fant ikke eksempelet i arkivet.');
    }
    const [record] = entries.splice(index, 1);
    saveTrashEntriesForPath(path, entries);
    const previousRaw = safeGetItem(buildStorageKey(path));
    const examples = loadExamplesForPath(path);
    const insertIndex = Number.isInteger(record.removedAtIndex) ? Math.max(0, Math.min(record.removedAtIndex, examples.length)) : examples.length;
    const restored = record.example && typeof record.example === 'object' ? record.example : {};
    examples.splice(insertIndex, 0, restored);
    if (examples.length > 0) {
      const first = examples[0];
      if (first && typeof first === 'object') {
        first.isDefault = true;
      }
      for (let i = 1; i < examples.length; i++) {
        const candidate = examples[i];
        if (candidate && typeof candidate === 'object' && Object.prototype.hasOwnProperty.call(candidate, 'isDefault')) {
          delete candidate.isDefault;
        }
      }
    }
    const newRaw = saveExamplesForPath(path, examples);
    if (typeof previousRaw === 'string' && previousRaw.trim() && previousRaw.trim() !== newRaw.trim()) {
      rememberHistoryRawForPath(path, previousRaw, 'restore-from-trash');
    }
    return record;
  }

  function deleteTrashRecord(path, id) {
    const entries = loadTrashEntriesForPath(path);
    const index = entries.findIndex(entry => entry.id === id);
    if (index === -1) return false;
    entries.splice(index, 1);
    saveTrashEntriesForPath(path, entries);
    return true;
  }

  function prettifyPath(path) {
    if (typeof path !== 'string') return 'Ukjent verktøy';
    const trimmed = path.replace(/^\/+/, '');
    if (!trimmed) return 'Ukjent verktøy';
    const decoded = (() => {
      try {
        return decodeURIComponent(trimmed);
      } catch (error) {
        return trimmed;
      }
    })();
    const replaced = decoded.replace(/[-_]+/g, ' ');
    return replaced.replace(/\b\w/g, match => match.toLocaleUpperCase('nb-NO'));
  }

  function resolveGroupHref(record, path) {
    if (record && typeof record.sourceHref === 'string' && record.sourceHref.trim()) {
      return record.sourceHref.trim();
    }
    const trimmed = typeof path === 'string' ? path.replace(/^\/+/, '') : '';
    if (!trimmed) return '';
    if (/\.html?$/i.test(trimmed)) return trimmed;
    return `${trimmed}.html`;
  }

  const groupsContainer = document.querySelector('[data-trash-groups]');
  const statusElement = document.querySelector('[data-status]');
  const refreshButton = document.querySelector('[data-refresh]');
  const filterSelect = document.querySelector('[data-filter]');
  const groupTemplate = document.getElementById('trash-group-template');
  const itemTemplate = document.getElementById('trash-item-template');
  let cachedGroups = [];
  let currentFilterValue = 'all';
  let emptyTemplate = null;
  if (groupsContainer) {
    const existingEmpty = groupsContainer.querySelector('[data-empty]');
    if (existingEmpty) {
      emptyTemplate = existingEmpty.cloneNode(true);
      emptyTemplate.removeAttribute('data-empty');
      existingEmpty.remove();
    }
  }

  function setStatus(message, options) {
    if (!statusElement) return;
    if (!message) {
      statusElement.textContent = '';
      return;
    }
    statusElement.textContent = message;
    if (options && typeof options.timeout === 'number' && options.timeout > 0) {
      const nextToken = (setStatus._token || 0) + 1;
      setStatus._token = nextToken;
      setTimeout(() => {
        if (setStatus._token === nextToken) {
          statusElement.textContent = '';
        }
      }, options.timeout);
    }
  }


  async function fetchBackendIndex() {
    if (!examplesApiBase) {
      const error = new Error('Lagringstjenesten for eksempler er ikke konfigurert.');
      error.code = 'BACKEND_NOT_CONFIGURED';
      throw error;
    }
    if (backendIndexPromise) {
      return backendIndexPromise;
    }
    const url = buildExamplesApiUrl(examplesApiBase);
    if (!url) {
      const error = new Error('Fant ikke adressen til eksempellageret.');
      error.code = 'INVALID_URL';
      throw error;
    }
    backendIndexPromise = (async () => {
      let res;
      try {
        res = await fetch(url, {
          headers: {
            Accept: 'application/json'
          }
        });
      } catch (cause) {
        const error = new Error('Kunne ikke kontakte serveren.');
        error.code = 'NETWORK_ERROR';
        error.cause = cause;
        throw error;
      }
      if (!res.ok) {
        const error = new Error(`Serveren svarte med ${res.status}.`);
        error.code = 'HTTP_ERROR';
        error.status = res.status;
        throw error;
      }
      let payload;
      try {
        payload = await res.json();
      } catch (cause) {
        const error = new Error('Kunne ikke tolke svaret fra serveren.');
        error.code = 'INVALID_RESPONSE';
        error.cause = cause;
        throw error;
      }
      backendEntriesCache.clear();
      const entries = Array.isArray(payload && payload.entries) ? payload.entries : [];
      entries.forEach(item => {
        if (!item || typeof item !== 'object') return;
        const path = normalizeBackendPath(item.path);
        if (!path) return;
        backendEntriesCache.set(path, {
          path,
          updatedAt: typeof item.updatedAt === 'string' ? item.updatedAt : null,
          examples: Array.isArray(item.examples) ? item.examples.slice() : [],
          deletedProvided: Array.isArray(item.deletedProvided) ? item.deletedProvided.slice() : []
        });
      });
      return backendEntriesCache;
    })();
    try {
      return await backendIndexPromise;
    } finally {
      backendIndexPromise = null;
    }
  }

  async function loadTrashGroups(options) {
    const opts = options && typeof options === 'object' ? options : {};
    if (!opts.skipBackend) {
      await fetchBackendIndex();
    }
    const groups = [];
    backendEntriesCache.forEach((entry, path) => {
      const records = loadTrashEntriesForPath(path);
      if (!records.length) return;
      const reference = records.find(record => record.sourceTitle) || records[0];
      const title = reference && reference.sourceTitle ? reference.sourceTitle : prettifyPath(path);
      const href = resolveGroupHref(reference, path);
      groups.push({
        path,
        title,
        href,
        records
      });
    });
    groups.sort((a, b) => a.title.localeCompare(b.title, 'nb'));
    return groups;
  }

  async function deleteBackendEntry(path) {
    if (!examplesApiBase) {
      const error = new Error('Lagringstjenesten for eksempler er ikke konfigurert.');
      error.code = 'BACKEND_NOT_CONFIGURED';
      throw error;
    }
    const url = buildExamplesApiUrl(examplesApiBase, path);
    if (!url) {
      const error = new Error('Fant ikke adressen til eksempellageret.');
      error.code = 'INVALID_URL';
      throw error;
    }
    let res;
    try {
      res = await fetch(url, { method: 'DELETE' });
    } catch (cause) {
      const error = new Error('Kunne ikke kontakte serveren for å slette eksempelet.');
      error.code = 'NETWORK_ERROR';
      error.cause = cause;
      throw error;
    }
    if (res.ok || res.status === 404) {
      backendEntriesCache.delete(path);
      return true;
    }
    const error = new Error(`Serveren avviste sletting (${res.status}).`);
    error.code = 'HTTP_ERROR';
    error.status = res.status;
    throw error;
  }


  function getFilterValue() {
    if (filterSelect) {
      const value = filterSelect.value || 'all';
      currentFilterValue = value;
      return value;
    }
    return currentFilterValue || 'all';
  }

  function isFilterActive() {
    return getFilterValue() !== 'all';
  }

  function getVisibleGroups(groups) {
    if (!Array.isArray(groups) || !groups.length) {
      return [];
    }
    const filterValue = getFilterValue();
    if (!filterValue || filterValue === 'all') {
      return groups.slice();
    }
    return groups.filter(group => group && group.path === filterValue);
  }

  function updateFilterOptions(groups) {
    if (!filterSelect) return;
    const previousValue = currentFilterValue || 'all';
    const options = [{ value: 'all', label: 'Alle apper' }];
    const seen = new Set();
    if (Array.isArray(groups)) {
      groups.forEach(group => {
        if (!group || typeof group.path !== 'string') return;
        const path = group.path;
        if (seen.has(path)) return;
        seen.add(path);
        const label = group.title || prettifyPath(path);
        options.push({ value: path, label });
      });
    }
    let needsUpdate = filterSelect.options.length !== options.length;
    if (!needsUpdate) {
      for (let i = 0; i < options.length; i++) {
        const option = options[i];
        const existing = filterSelect.options[i];
        if (!existing || existing.value !== option.value || existing.textContent !== option.label) {
          needsUpdate = true;
          break;
        }
      }
    }
    if (needsUpdate) {
      filterSelect.innerHTML = '';
      const fragment = document.createDocumentFragment();
      options.forEach(option => {
        const optionEl = document.createElement('option');
        optionEl.value = option.value;
        optionEl.textContent = option.label;
        fragment.appendChild(optionEl);
      });
      filterSelect.appendChild(fragment);
    }
    const allowedValues = new Set(options.map(option => option.value));
    const nextValue = allowedValues.has(previousValue) ? previousValue : 'all';
    if (filterSelect.value !== nextValue) {
      filterSelect.value = nextValue;
    }
    currentFilterValue = nextValue;
  }

  function updateStatusForGroups(allGroups, visibleGroups, options) {
    if (options && (options.silent || options.skipStatus)) return;
    if (!Array.isArray(allGroups) || !allGroups.length) {
      setStatus('Arkivet er tomt.', { timeout: 4000 });
      return;
    }
    const visibleCount = Array.isArray(visibleGroups)
      ? visibleGroups.reduce((sum, group) => sum + (Array.isArray(group.records) ? group.records.length : 0), 0)
      : 0;
    if (!visibleCount) {
      if (isFilterActive()) {
        setStatus('Ingen arkiverte eksempler for valgt app.', { timeout: 4000 });
      } else {
        setStatus('Ingen arkiverte eksempler er tilgjengelige.', { timeout: 4000 });
      }
      return;
    }
    const baseLabel = visibleCount === 1 ? 'Viser 1 arkivert eksempel.' : `Viser ${visibleCount} arkiverte eksempler.`;
    if (isFilterActive()) {
      let filterLabel = '';
      if (filterSelect && filterSelect.options && filterSelect.selectedIndex >= 0) {
        const selected = filterSelect.options[filterSelect.selectedIndex];
        if (selected && selected.textContent) {
          filterLabel = selected.textContent.trim();
        }
      }
      if (filterLabel) {
        setStatus(`${baseLabel} (app: «${filterLabel}»).`, { timeout: 5000 });
      } else {
        setStatus(baseLabel, { timeout: 5000 });
      }
    } else {
      setStatus(baseLabel, { timeout: 4000 });
    }
  }

  function applyFilterAndRender(options) {
    const visibleGroups = getVisibleGroups(cachedGroups);
    renderGroups(visibleGroups);
    updateStatusForGroups(cachedGroups, visibleGroups, options);
  }

  function renderGroups(groups) {
    if (!groupsContainer) return;
    groupsContainer.innerHTML = '';
    if (!groups.length) {
      const emptyMessage = isFilterActive()
        ? 'Ingen arkiverte eksempler for valgt app.'
        : 'Ingen arkiverte eksempler er tilgjengelige.';
      if (emptyTemplate) {
        const emptyNode = emptyTemplate.cloneNode(true);
        emptyNode.textContent = emptyMessage;
        groupsContainer.appendChild(emptyNode);
      } else {
        const fallback = document.createElement('p');
        fallback.className = 'trash-empty';
        fallback.textContent = emptyMessage;
        groupsContainer.appendChild(fallback);
      }
      return;
    }
    groups.forEach(group => {
      let groupNode = null;
      if (groupTemplate && groupTemplate.content) {
        groupNode = groupTemplate.content.cloneNode(true);
      }
      if (!groupNode) {
        groupNode = document.createDocumentFragment();
        const section = document.createElement('section');
        section.className = 'trash-group';
        section.dataset.group = '';
        section.innerHTML = `
          <header class="trash-group__header">
            <h2 class="trash-group__title" data-group-title></h2>
            <span class="trash-group__meta" data-group-meta></span>
          </header>
          <ul class="trash-item-list" data-group-list></ul>
        `;
        groupNode.appendChild(section);
      }
      const section = groupNode.querySelector('[data-group]');
      const titleEl = groupNode.querySelector('[data-group-title]');
      const metaEl = groupNode.querySelector('[data-group-meta]');
      const listEl = groupNode.querySelector('[data-group-list]');
      if (section) {
        section.dataset.path = group.path;
      }
      if (titleEl) {
        titleEl.textContent = group.title || prettifyPath(group.path);
      }
      if (metaEl) {
        const count = group.records.length;
        const countLabel = count === 1 ? '1 arkivert eksempel' : `${count} arkiverte eksempler`;
        metaEl.textContent = countLabel;
        if (group.href) {
          const link = document.createElement('a');
          link.href = group.href;
          link.textContent = 'Åpne verktøy';
          link.target = '_blank';
          link.rel = 'noopener noreferrer';
          metaEl.appendChild(document.createTextNode(' · '));
          metaEl.appendChild(link);
        }
      }
      if (listEl) {
        listEl.innerHTML = '';
        group.records.forEach(record => {
          let itemNode = null;
          if (itemTemplate && itemTemplate.content) {
            itemNode = itemTemplate.content.cloneNode(true);
          }
          if (!itemNode) {
            itemNode = document.createDocumentFragment();
            const li = document.createElement('li');
            li.className = 'trash-item';
            li.dataset.item = '';
            li.innerHTML = `
              <div class="trash-item__content">
                <div class="trash-item__header">
                  <h3 class="trash-item__title" data-item-title></h3>
                  <span class="trash-item__timestamp" data-item-timestamp></span>
                </div>
                <div class="trash-item__meta" data-item-meta></div>
                <p class="trash-item__description" data-item-description hidden></p>
                <div class="trash-item__actions">
                  <button type="button" class="trash-button trash-button--restore" data-action="restore">Gjenopprett</button>
                  <button type="button" class="trash-button trash-button--delete" data-action="delete">Slett permanent</button>
                </div>
              </div>
              <div class="trash-item__preview" data-item-preview hidden>
                <div class="trash-item__preview-inner">
                  <div class="trash-item__preview-content" data-item-preview-content></div>
                </div>
              </div>
            `;
            itemNode.appendChild(li);
          }
          const item = itemNode.querySelector('[data-item]');
          const title = itemNode.querySelector('[data-item-title]');
          const timestamp = itemNode.querySelector('[data-item-timestamp]');
          const meta = itemNode.querySelector('[data-item-meta]');
          const description = itemNode.querySelector('[data-item-description]');
          const preview = itemNode.querySelector('[data-item-preview]');
          const previewContent = itemNode.querySelector('[data-item-preview-content]');
          if (item) {
            item.dataset.id = record.id;
          }
          if (title) {
            const label = record.label || 'Eksempel';
            title.textContent = label;
          }
          if (timestamp) {
            const formatted = formatTimestamp(record.deletedAt);
            timestamp.textContent = formatted ? `Slettet ${formatted}` : '';
          }
          if (description) {
            const summary = summarizeDescription(record.example);
            if (summary) {
              description.hidden = false;
              description.textContent = summary;
            } else {
              description.hidden = true;
              description.textContent = '';
            }
          }
          if (meta) {
            meta.innerHTML = '';
            const parts = [];
            if (Number.isInteger(record.removedAtIndex)) {
              parts.push(`Opprinnelig posisjon: ${record.removedAtIndex + 1}`);
            }
            if (record.reason && record.reason !== 'delete' && record.reason !== 'history') {
              parts.push(`Årsak: ${record.reason}`);
            }
            if (parts.length) {
              meta.appendChild(document.createTextNode(parts.join(' · ')));
            }
            if (record.importedFromHistory) {
              if (parts.length) {
                meta.appendChild(document.createTextNode(' '));
              }
              const badge = document.createElement('span');
              badge.className = 'trash-badge';
              badge.textContent = 'Importert fra historikk';
              meta.appendChild(badge);
            }
            meta.hidden = !meta.childNodes.length;
          }
          let hasPreview = false;
          if (previewContent) {
            hasPreview = renderExamplePreview(previewContent, record.example);
          }
          if (preview) {
            preview.hidden = !hasPreview;
          }
          if (item) {
            if (hasPreview) {
              item.classList.add('trash-item--has-preview');
            } else {
              item.classList.remove('trash-item--has-preview');
            }
          }
          listEl.appendChild(itemNode);
        });
      }
      groupsContainer.appendChild(groupNode);
    });
  }

  async function refreshGroups(options) {
    let groups = null;
    let backendFailed = false;
    try {
      groups = await loadTrashGroups(options);
    } catch (error) {
      backendFailed = true;
      console.error('[trash] failed to load trash entries', error);
      const message = error && error.message ? error.message : 'Kunne ikke laste arkivet fra serveren.';
      setStatus(message, { timeout: 6000 });
    }
    if (Array.isArray(groups)) {
      cachedGroups = groups;
    } else if (!backendFailed) {
      cachedGroups = [];
    }
    if (!Array.isArray(cachedGroups)) {
      cachedGroups = [];
    }
    updateFilterOptions(cachedGroups);
    if (backendFailed) {
      if (cachedGroups.length) {
        applyFilterAndRender(Object.assign({}, options || {}, { skipStatus: true }));
      } else {
        renderGroups([]);
      }
    } else {
      applyFilterAndRender(options);
    }
  }

  function findTargetInfo(button) {
    if (!button) return null;
    const item = button.closest('[data-item]');
    const group = button.closest('[data-group]');
    if (!item || !group) return null;
    const id = item.dataset.id;
    const path = group.dataset.path;
    if (!id || !path) return null;
    return { id, path };
  }

  function withButtonState(button, fn) {
    if (!button) return fn();
    const previous = button.disabled;
    button.disabled = true;
    try {
      return fn();
    } finally {
      button.disabled = previous;
    }
  }

  function handleRestore(event) {
    const button = event.target.closest('button[data-action="restore"]');
    if (!button) return;
    const target = findTargetInfo(button);
    if (!target) return;
    event.preventDefault();
    withButtonState(button, () => {
      try {
        const record = restoreTrashRecord(target.path, target.id);
        const tool = record && record.sourceTitle ? record.sourceTitle : prettifyPath(target.path);
        setStatus(`Gjenopprettet eksemplet til «${tool}».`, { timeout: 5000 });
      } catch (error) {
        console.error('[trash] failed to restore example', error);
        const message = error && error.message ? error.message : 'Kunne ikke gjenopprette eksempelet.';
        setStatus(message, { timeout: 6000 });
      }
    });
    refreshGroups({ silent: true, skipBackend: true }).catch(error => {
      console.error('[trash] failed to refresh after restore', error);
    });
  }

  function handleDelete(event) {
    const button = event.target.closest('button[data-action="delete"]');
    if (!button) return;
    const target = findTargetInfo(button);
    if (!target) return;
    event.preventDefault();
    const confirmed = window.confirm('Er du sikker på at du vil slette dette eksempelet permanent?');
    if (!confirmed) {
      return;
    }
    withButtonState(button, () => {
      try {
        deleteTrashRecord(target.path, target.id);
        setStatus('Eksempelet ble slettet permanent.', { timeout: 5000 });
        const remaining = loadTrashEntriesForPath(target.path);
        if (!remaining.length) {
          const backendEntry = backendEntriesCache.get(target.path);
          const hasActiveExamples = backendEntry && Array.isArray(backendEntry.examples) && backendEntry.examples.length > 0;
          const hasDeletedProvided = backendEntry && Array.isArray(backendEntry.deletedProvided) && backendEntry.deletedProvided.length > 0;
          if (!hasActiveExamples && !hasDeletedProvided) {
            deleteBackendEntry(target.path).catch(error => {
              console.error('[trash] failed to delete backend entry', error);
              const message = error && error.message ? error.message : 'Kunne ikke slette eksempelet fra serveren.';
              setStatus(message, { timeout: 6000 });
            });
          }
        }
      } catch (error) {
        console.error('[trash] failed to remove example', error);
        const message = error && error.message ? error.message : 'Kunne ikke slette eksempelet.';
        setStatus(message, { timeout: 6000 });
      }
    });
    refreshGroups({ silent: true, skipBackend: true }).catch(error => {
      console.error('[trash] failed to refresh after delete', error);
    });
  }

  if (groupsContainer) {
    groupsContainer.addEventListener('click', event => {
      const action = event.target.closest('button[data-action]');
      if (!action) return;
      const type = action.dataset.action;
      if (type === 'restore') {
        handleRestore(event);
      } else if (type === 'delete') {
        handleDelete(event);
      }
    });
  }

  if (refreshButton) {
    refreshButton.addEventListener('click', () => {
      refreshGroups().catch(error => {
        console.error('[trash] failed to refresh on demand', error);
      });
    });
  }

  if (filterSelect) {
    filterSelect.addEventListener('change', () => {
      currentFilterValue = filterSelect.value || 'all';
      applyFilterAndRender();
    });
  }


  if (typeof window !== 'undefined') {
    window.addEventListener('storage', event => {
      if (!event || typeof event.key !== 'string') return;
      if (!event.key.startsWith('examples_')) return;
      refreshGroups({ silent: true, skipBackend: true }).catch(error => {
        console.error('[trash] failed to refresh after storage event', error);
      });
    });
  }

  refreshGroups({ silent: true }).catch(error => {
    console.error('[trash] initial refresh failed', error);
  });
})();
