(function () {
  'use strict';

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

  const apiBase = resolveExamplesApiBase();
  const groupsContainer = typeof document !== 'undefined' ? document.querySelector('[data-trash-groups]') : null;
  const statusElement = typeof document !== 'undefined' ? document.querySelector('[data-status]') : null;
  const refreshButton = typeof document !== 'undefined' ? document.querySelector('[data-refresh]') : null;
  const filterSelect = typeof document !== 'undefined' ? document.querySelector('[data-filter]') : null;
  const groupTemplate = typeof document !== 'undefined' ? document.getElementById('trash-group-template') : null;
  const itemTemplate = typeof document !== 'undefined' ? document.getElementById('trash-item-template') : null;

  let emptyTemplate = null;
  if (groupsContainer) {
    const existingEmpty = groupsContainer.querySelector('[data-empty]');
    if (existingEmpty) {
      emptyTemplate = existingEmpty.cloneNode(true);
      emptyTemplate.removeAttribute('data-empty');
      existingEmpty.remove();
    }
  }

  const state = {
    entries: new Map(),
    filter: 'all'
  };

  function setStatus(message, type) {
    if (!statusElement) return;
    if (!message) {
      statusElement.textContent = '';
      statusElement.removeAttribute('data-status-type');
      return;
    }
    statusElement.textContent = message;
    if (type) {
      statusElement.dataset.statusType = type;
    } else {
      statusElement.removeAttribute('data-status-type');
    }
  }

  function normalizeEntry(path, payload) {
    const normalizedPath = normalizePath(path);
    const examples = Array.isArray(payload && payload.examples) ? payload.examples.slice() : [];
    const deletedProvided = Array.isArray(payload && payload.deletedProvided)
      ? payload.deletedProvided.map(value => typeof value === 'string' ? value.trim() : '').filter(Boolean)
      : [];
    const updatedAt = typeof (payload && payload.updatedAt) === 'string' ? payload.updatedAt : null;
    return {
      path: normalizedPath || path,
      examples,
      deletedProvided,
      updatedAt
    };
  }

  async function fetchEntriesFromBackend() {
    if (!apiBase) {
      throw new Error('Fant ikke eksempeltjenesten. Sørg for at back-end kjører.');
    }
    const url = buildExamplesApiUrl(apiBase);
    if (!url) {
      throw new Error('Kunne ikke finne adressen til eksempellageret.');
    }
    let response;
    try {
      response = await fetch(url, { headers: { Accept: 'application/json' } });
    } catch (error) {
      throw new Error('Kunne ikke kontakte eksempeltjenesten.');
    }
    if (!response.ok) {
      throw new Error(`Serveren svarte med ${response.status}.`);
    }
    let payload;
    try {
      payload = await response.json();
    } catch (error) {
      throw new Error('Kunne ikke tolke svaret fra serveren.');
    }
    const entries = Array.isArray(payload && payload.entries) ? payload.entries : [];
    const map = new Map();
    entries.forEach(item => {
      if (!item || typeof item !== 'object') return;
      const normalized = normalizeEntry(item.path, item);
      if (!normalized.path) return;
      map.set(normalized.path, normalized);
    });
    state.entries = map;
  }

  function buildFilterOptions() {
    if (!filterSelect) return;
    const currentValue = filterSelect.value || 'all';
    const selected = state.filter || 'all';
    const existing = new Set(['all']);
    const options = Array.from(filterSelect.querySelectorAll('option'));
    options.forEach(option => {
      const value = option.value || '';
      if (value === 'all') return;
      existing.add(value);
    });
    const desired = new Set(['all']);
    const paths = Array.from(state.entries.keys()).sort((a, b) => a.localeCompare(b, 'nb'));
    paths.forEach(path => {
      desired.add(path);
      if (!existing.has(path)) {
        const option = document.createElement('option');
        option.value = path;
        option.textContent = prettifyPath(path);
        filterSelect.appendChild(option);
      }
    });
    options.forEach(option => {
      const value = option.value || '';
      if (!desired.has(value)) {
        option.remove();
      }
    });
    if (desired.has(selected)) {
      filterSelect.value = selected;
    } else {
      filterSelect.value = 'all';
      state.filter = 'all';
    }
  }

  function getFilteredEntries() {
    const filterValue = state.filter || 'all';
    const entries = [];
    state.entries.forEach(entry => {
      if (!entry || !Array.isArray(entry.examples) || entry.examples.length === 0) return;
      if (filterValue !== 'all' && entry.path !== filterValue) return;
      entries.push(entry);
    });
    entries.sort((a, b) => a.path.localeCompare(b.path, 'nb'));
    return entries;
  }

  function buildGroupNode(entry) {
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
      section.dataset.path = entry.path;
    }
    if (titleEl) {
      titleEl.textContent = prettifyPath(entry.path);
    }
    if (metaEl) {
      const count = entry.examples.length;
      const countLabel = count === 1 ? '1 lagret eksempel' : `${count} lagrede eksempler`;
      metaEl.textContent = countLabel;
      const timestamp = formatTimestamp(entry.updatedAt);
      if (timestamp) {
        metaEl.appendChild(document.createTextNode(` · Oppdatert ${timestamp}`));
      }
      const link = document.createElement('a');
      link.href = entry.path.endsWith('.html') ? entry.path : `${entry.path}.html`;
      link.textContent = 'Åpne verktøy';
      link.target = '_blank';
      link.rel = 'noopener noreferrer';
      metaEl.appendChild(document.createTextNode(' · '));
      metaEl.appendChild(link);
    }
    if (listEl) {
      listEl.innerHTML = '';
      entry.examples.forEach((example, index) => {
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
                <button type="button" class="trash-button trash-button--restore" data-action="open">Åpne eksempel</button>
                <button type="button" class="trash-button trash-button--delete" data-action="delete">Slett</button>
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
        const timestampEl = itemNode.querySelector('[data-item-timestamp]');
        const meta = itemNode.querySelector('[data-item-meta]');
        const description = itemNode.querySelector('[data-item-description]');
        const preview = itemNode.querySelector('[data-item-preview]');
        const previewContent = itemNode.querySelector('[data-item-preview-content]');
        const openButton = itemNode.querySelector('[data-action="restore"], [data-action="open"]');
        const deleteButton = itemNode.querySelector('[data-action="delete"]');
        if (item) {
          item.dataset.index = String(index);
        }
        const titleText = typeof example.title === 'string' && example.title.trim()
          ? example.title.trim()
          : typeof example.description === 'string' && example.description.trim()
            ? example.description.trim().slice(0, 120)
            : `Eksempel ${index + 1}`;
        if (title) {
          title.textContent = titleText;
        }
        if (timestampEl) {
          timestampEl.textContent = entry.updatedAt ? `Oppdatert ${formatTimestamp(entry.updatedAt)}` : '';
        }
        if (meta) {
          meta.innerHTML = '';
          const parts = [];
          if (example.exampleNumber) {
            parts.push(`Eksempelnummer: ${example.exampleNumber}`);
          }
          if (example.__builtinKey) {
            parts.push(`Innebygd nøkkel: ${example.__builtinKey}`);
          }
          if (parts.length) {
            meta.appendChild(document.createTextNode(parts.join(' · ')));
          }
        }
        if (description) {
          const text = typeof example.description === 'string' ? example.description.trim() : '';
          if (text) {
            description.hidden = false;
            description.textContent = text;
          } else {
            description.hidden = true;
            description.textContent = '';
          }
        }
        if (preview) {
          if (previewContent && renderExamplePreview(previewContent, example)) {
            preview.hidden = false;
          } else {
            preview.hidden = true;
            if (previewContent) previewContent.innerHTML = '';
          }
        }
        if (openButton) {
          openButton.dataset.action = 'open';
          openButton.dataset.index = String(index);
          openButton.textContent = 'Åpne eksempel';
        }
        if (deleteButton) {
          deleteButton.dataset.index = String(index);
          deleteButton.textContent = 'Slett';
        }
        listEl.appendChild(itemNode);
      });
    }
    return groupNode;
  }

  function renderEntries() {
    if (!groupsContainer) return;
    groupsContainer.innerHTML = '';
    const entries = getFilteredEntries();
    if (!entries.length) {
      if (emptyTemplate) {
        groupsContainer.appendChild(emptyTemplate.cloneNode(true));
      }
      return;
    }
    entries.forEach(entry => {
      const node = buildGroupNode(entry);
      if (node) {
        groupsContainer.appendChild(node);
      }
    });
  }

  function openExample(path, index) {
    if (typeof window === 'undefined') return;
    if (typeof path !== 'string') return;
    const exampleIndex = Number(index);
    if (!Number.isInteger(exampleIndex) || exampleIndex < 0) return;
    try {
      const url = new URL(path, window.location && window.location.href ? window.location.href : undefined);
      url.searchParams.set('example', String(exampleIndex + 1));
      window.open(url.toString(), '_blank', 'noopener');
    } catch (error) {
      const base = path.includes('?') ? '&' : '?';
      const target = `${path}${base}example=${exampleIndex + 1}`;
      window.open(target, '_blank', 'noopener');
    }
  }

  async function putEntry(path, entry) {
    if (!apiBase) {
      throw new Error('Eksempeltjenesten er ikke konfigurert.');
    }
    const url = buildExamplesApiUrl(apiBase, path);
    if (!url) {
      throw new Error('Kunne ikke bygge URL for lagring.');
    }
    const payload = {
      path,
      examples: Array.isArray(entry.examples) ? entry.examples : [],
      deletedProvided: Array.isArray(entry.deletedProvided) ? entry.deletedProvided : [],
      updatedAt: new Date().toISOString()
    };
    let response;
    try {
      response = await fetch(url, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
    } catch (error) {
      throw new Error('Kunne ikke kontakte serveren for å lagre endringer.');
    }
    if (!response.ok) {
      throw new Error(`Serveren avviste oppdateringen (${response.status}).`);
    }
    let result;
    try {
      result = await response.json();
    } catch (error) {
      result = payload;
    }
    state.entries.set(path, normalizeEntry(path, result));
  }

  async function deleteEntry(path) {
    if (!apiBase) {
      throw new Error('Eksempeltjenesten er ikke konfigurert.');
    }
    const url = buildExamplesApiUrl(apiBase, path);
    if (!url) {
      throw new Error('Kunne ikke bygge URL for sletting.');
    }
    let response;
    try {
      response = await fetch(url, { method: 'DELETE' });
    } catch (error) {
      throw new Error('Kunne ikke kontakte serveren for å slette.');
    }
    if (!response.ok && response.status !== 404) {
      throw new Error(`Serveren avviste sletting (${response.status}).`);
    }
    state.entries.delete(path);
  }

  async function deleteExample(path, index) {
    const entry = state.entries.get(path);
    if (!entry || !Array.isArray(entry.examples)) {
      return;
    }
    const exampleIndex = Number(index);
    if (!Number.isInteger(exampleIndex) || exampleIndex < 0 || exampleIndex >= entry.examples.length) {
      return;
    }
    const examples = entry.examples.slice();
    const [removed] = examples.splice(exampleIndex, 1);
    const deletedProvided = Array.isArray(entry.deletedProvided) ? entry.deletedProvided.slice() : [];
    if (removed && typeof removed.__builtinKey === 'string') {
      const key = removed.__builtinKey.trim();
      if (key && !deletedProvided.includes(key)) {
        deletedProvided.push(key);
      }
    }
    if (!examples.length && !deletedProvided.length) {
      await deleteEntry(path);
      return;
    }
    await putEntry(path, { examples, deletedProvided });
  }

  async function refreshEntries() {
    setStatus('Laster eksempler …', 'info');
    try {
      await fetchEntriesFromBackend();
      buildFilterOptions();
      renderEntries();
      setStatus('', '');
    } catch (error) {
      state.entries.clear();
      renderEntries();
      setStatus(error && error.message ? error.message : 'Kunne ikke hente eksempler.', 'error');
    }
  }

  function handleFilterChange(event) {
    const value = event && event.target ? event.target.value : 'all';
    state.filter = value || 'all';
    renderEntries();
  }

  async function handleAction(event) {
    const button = event.target && event.target.closest ? event.target.closest('button[data-action]') : null;
    if (!button) return;
    const action = button.dataset.action;
    const item = button.closest('[data-item]');
    const group = button.closest('[data-group]');
    const path = group ? group.dataset.path : null;
    if (!path) return;
    if (action === 'open') {
      const index = item ? item.dataset.index : null;
      openExample(path, index);
      return;
    }
    if (action === 'delete') {
      const index = item ? item.dataset.index : null;
      button.disabled = true;
      try {
        await deleteExample(path, index);
        renderEntries();
        setStatus('', '');
      } catch (error) {
        setStatus(error && error.message ? error.message : 'Kunne ikke slette eksempelet.', 'error');
      } finally {
        button.disabled = false;
      }
    }
  }

  function init() {
    if (!groupsContainer) return;
    if (refreshButton) {
      refreshButton.addEventListener('click', () => {
        refreshEntries().catch(() => {});
      });
    }
    if (filterSelect) {
      filterSelect.addEventListener('change', handleFilterChange);
    }
    groupsContainer.addEventListener('click', handleAction);
    refreshEntries().catch(() => {});
  }

  if (typeof document !== 'undefined') {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', init, { once: true });
    } else {
      init();
    }
  }
})();
