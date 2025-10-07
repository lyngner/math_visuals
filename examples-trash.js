(function () {
  'use strict';

  const MAX_HISTORY_ENTRIES = 10;
  const EXAMPLE_VALUE_TYPE_KEY = '__mathVisualsType__';
  const EXAMPLE_VALUE_DATA_KEY = '__mathVisualsValue__';

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

  function resolveStorage() {
    if (typeof window === 'undefined') {
      return createMemoryStorage();
    }
    const scopes = [window, window.parent === window ? null : (() => {
      try {
        return window.parent;
      } catch (error) {
        return null;
      }
    })()];
    for (const scope of scopes) {
      if (!scope) continue;
      const shared = scope.__EXAMPLES_STORAGE__;
      if (shared && typeof shared.getItem === 'function') {
        return shared;
      }
    }
    try {
      if (typeof localStorage !== 'undefined') {
        return localStorage;
      }
    } catch (error) {}
    if (typeof window.__EXAMPLES_FALLBACK_STORAGE__ !== 'undefined' && window.__EXAMPLES_FALLBACK_STORAGE__) {
      const fallback = window.__EXAMPLES_FALLBACK_STORAGE__;
      if (fallback && typeof fallback.getItem === 'function') {
        return fallback;
      }
    }
    return createMemoryStorage();
  }

  const storage = resolveStorage();

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

  function listStorageKeys() {
    if (!storage) return [];
    const keys = [];
    if (typeof storage.length === 'number' && typeof storage.key === 'function') {
      const total = Number(storage.length) || 0;
      for (let i = 0; i < total; i++) {
        let key = null;
        try {
          key = storage.key(i);
        } catch (error) {
          key = null;
        }
        if (typeof key === 'string' && key) {
          keys.push(key);
        }
      }
    } else {
      try {
        for (const key in storage) {
          if (Object.prototype.hasOwnProperty.call(storage, key)) {
            keys.push(key);
          }
        }
      } catch (error) {}
    }
    return keys;
  }

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

  function loadTrashGroups() {
    const keys = listStorageKeys();
    const paths = new Set();
    keys.forEach(key => {
      if (typeof key !== 'string') return;
      if (!key.startsWith('examples_') || !key.endsWith('_trash')) return;
      const path = key.slice('examples_'.length, -'_trash'.length);
      if (path) paths.add(path);
    });
    const groups = [];
    paths.forEach(path => {
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
    groups.sort((a, b) => a.title.localeCompare(b.title, 'nb')); // fallback to Norwegian sorting
    return groups;
  }

  const groupsContainer = document.querySelector('[data-trash-groups]');
  const statusElement = document.querySelector('[data-status]');
  const refreshButton = document.querySelector('[data-refresh]');
  const groupTemplate = document.getElementById('trash-group-template');
  const itemTemplate = document.getElementById('trash-item-template');
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

  function renderGroups(groups) {
    if (!groupsContainer) return;
    groupsContainer.innerHTML = '';
    if (!groups.length) {
      if (emptyTemplate) {
        groupsContainer.appendChild(emptyTemplate.cloneNode(true));
      } else {
        const fallback = document.createElement('p');
        fallback.className = 'trash-empty';
        fallback.textContent = 'Ingen arkiverte eksempler er tilgjengelige.';
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

  function refreshGroups(options) {
    try {
      const groups = loadTrashGroups();
      renderGroups(groups);
      if (!groups.length) {
        if (!(options && options.silent)) {
          setStatus('Arkivet er tomt.', { timeout: 4000 });
        }
      } else if (!(options && options.silent)) {
        const total = groups.reduce((sum, group) => sum + group.records.length, 0);
        const message = total === 1 ? '1 arkivert eksempel.' : `${total} arkiverte eksempler.`;
        setStatus(message, { timeout: 4000 });
      }
    } catch (error) {
      console.error('[trash] failed to load trash entries', error);
      setStatus('Kunne ikke laste arkivet.', { timeout: 5000 });
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
    refreshGroups({ silent: true });
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
      } catch (error) {
        console.error('[trash] failed to remove example', error);
        const message = error && error.message ? error.message : 'Kunne ikke slette eksempelet.';
        setStatus(message, { timeout: 6000 });
      }
    });
    refreshGroups({ silent: true });
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
      refreshGroups();
    });
  }

  if (typeof window !== 'undefined') {
    window.addEventListener('storage', event => {
      if (!event || typeof event.key !== 'string') return;
      if (!event.key.startsWith('examples_')) return;
      refreshGroups({ silent: true });
    });
  }

  refreshGroups({ silent: true });
})();
