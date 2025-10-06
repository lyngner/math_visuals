// Viewer for stored examples
const globalScope = typeof window !== 'undefined' ? window : typeof globalThis !== 'undefined' ? globalThis : null;

const DESCRIPTION_RENDERER = (() => {
  if (globalScope && globalScope.__EXAMPLES_DESCRIPTION__) {
    return globalScope.__EXAMPLES_DESCRIPTION__;
  }

  const MAX_KATEX_ATTEMPTS = 8;

  function normalizeLineBreaks(value) {
    return typeof value === 'string' ? value.replace(/\r\n?/g, '\n') : '';
  }

  function createParagraphNode() {
    return { type: 'paragraph', children: [] };
  }

  function appendTextSegment(paragraph, text) {
    if (!paragraph || typeof text !== 'string' || !text) return;
    const normalized = normalizeLineBreaks(text);
    const lines = normalized.split('\n');
    lines.forEach((line, index) => {
      if (line) {
        paragraph.children.push({ type: 'text', value: line });
      }
      if (index < lines.length - 1) {
        paragraph.children.push({ type: 'linebreak' });
      }
    });
  }

  function findCommand(source, startIndex) {
    let index = source.indexOf('@', startIndex);
    while (index !== -1) {
      const match = /^@([a-zA-Z]+)\s*\{/.exec(source.slice(index));
      if (!match) {
        index = source.indexOf('@', index + 1);
        continue;
      }
      const name = match[1];
      let depth = 1;
      let cursor = index + match[0].length;
      while (cursor < source.length && depth > 0) {
        const char = source[cursor];
        if (char === '{') {
          depth++;
        } else if (char === '}') {
          depth--;
        }
        cursor++;
      }
      if (depth !== 0) {
        index = source.indexOf('@', index + 1);
        continue;
      }
      const contentStart = index + match[0].length;
      return {
        index,
        name,
        content: source.slice(contentStart, cursor - 1),
        endIndex: cursor
      };
    }
    return null;
  }

  function parseTable(content) {
    const normalized = normalizeLineBreaks(content).trim();
    if (!normalized) return null;
    const lines = normalized
      .split('\n')
      .map(line => line.trim())
      .filter(line => line);
    if (!lines.length) return null;
    const rows = lines.map(line => line.split('|').map(cell => cell.trim())) || [];
    const columnCount = rows.reduce((max, row) => (row.length > max ? row.length : max), 0);
    if (!columnCount) return null;
    const [headerRow, ...bodyRows] = rows;
    return {
      headers: headerRow,
      rows: bodyRows.length ? bodyRows : [headerRow]
    };
  }

  function parseDescriptionToAst(value) {
    const source = normalizeLineBreaks(String(value != null ? value : ''));
    const nodes = [];
    let paragraph = createParagraphNode();

    const ensureParagraph = () => {
      if (!paragraph) paragraph = createParagraphNode();
      return paragraph;
    };

    const commitParagraph = () => {
      if (!paragraph) return;
      const hasContent = paragraph.children.some(child => {
        if (child.type === 'text') return child.value.trim().length > 0;
        return child.type !== 'linebreak';
      });
      if (hasContent) {
        nodes.push(paragraph);
      }
      paragraph = createParagraphNode();
    };

    const appendText = text => {
      if (!text) return;
      const normalized = normalizeLineBreaks(text);
      const parts = normalized.split(/\n{2,}/);
      parts.forEach((part, index) => {
        if (part) {
          appendTextSegment(ensureParagraph(), part);
        }
        if (index < parts.length - 1) {
          commitParagraph();
        }
      });
    };

    let cursor = 0;
    while (cursor < source.length) {
      const command = findCommand(source, cursor);
      if (!command) {
        appendText(source.slice(cursor));
        break;
      }
      if (command.index > cursor) {
        appendText(source.slice(cursor, command.index));
      }
      const { name, content, endIndex } = command;
      const lowerName = name.toLowerCase();
      if (lowerName === 'task') {
        commitParagraph();
        nodes.push({ type: 'task', children: parseDescriptionToAst(content) });
      } else if (lowerName === 'table') {
        commitParagraph();
        const table = parseTable(content);
        if (table) {
          nodes.push({ type: 'table', headers: table.headers, rows: table.rows });
        } else {
          appendText(`@${name}{${content}}`);
        }
      } else if (lowerName === 'answerbox') {
        ensureParagraph().children.push({ type: 'answerbox', value: content });
      } else {
        appendText(`@${name}{${content}}`);
      }
      cursor = endIndex;
    }

    commitParagraph();
    return nodes;
  }

  function normalizeAnswer(value) {
    const raw = typeof value === 'string' ? value.trim() : '';
    if (!raw) return { type: 'empty', value: '' };
    const numericCandidate = raw.replace(',', '.');
    if (/^[+-]?\d+(?:[.,]\d+)?$/.test(raw)) {
      const num = Number(numericCandidate);
      if (Number.isFinite(num)) {
        return { type: 'number', value: num.toFixed(10).replace(/\.0+$/, '').replace(/0+$/, '').replace(/\.$/, '') };
      }
    }
    return { type: 'text', value: raw.toLowerCase() };
  }

  function answersMatch(input, expected) {
    const a = normalizeAnswer(input);
    const b = normalizeAnswer(expected);
    if (a.type === 'empty') return false;
    if (a.type === 'number' && b.type === 'number') {
      return a.value === b.value;
    }
    return a.value === b.value;
  }

  function parseAnswerSpec(value) {
    if (typeof value !== 'string') return [];
    return value
      .split('|')
      .map(part => part.trim())
      .filter(Boolean);
  }

  function appendTextWithMath(container, text, context) {
    if (!text) return;
    const doc = container.ownerDocument || (globalScope && globalScope.document);
    if (!doc) return;
    const pattern = /\$(.+?)\$/g;
    let lastIndex = 0;
    let match;
    while ((match = pattern.exec(text)) !== null) {
      const before = text.slice(lastIndex, match.index);
      if (before) container.appendChild(doc.createTextNode(before));
      const latex = match[1];
      const span = doc.createElement('span');
      span.className = 'example-katex';
      span.textContent = latex;
      span.dataset.katex = latex;
      context.katexElements.push(span);
      container.appendChild(span);
      lastIndex = pattern.lastIndex;
    }
    const after = text.slice(lastIndex);
    if (after) container.appendChild(doc.createTextNode(after));
  }

  function createAnswerBox(value, context) {
    const doc = (context && context.doc) || (globalScope && globalScope.document);
    if (!doc) return null;
    const answers = parseAnswerSpec(value);
    const wrapper = doc.createElement('span');
    wrapper.className = 'example-answerbox';
    const input = doc.createElement('input');
    input.type = 'text';
    input.autocomplete = 'off';
    input.spellcheck = false;
    input.className = 'example-answerbox__input';
    input.setAttribute('aria-label', 'Svar');
    const status = doc.createElement('span');
    status.className = 'example-answerbox__status';
    status.setAttribute('aria-live', 'polite');
    status.textContent = '';
    wrapper.appendChild(input);
    wrapper.appendChild(status);
    context.answerBoxes.push({ box: wrapper, input, status, answers });
    return wrapper;
  }

  function renderAstNodes(nodes, context) {
    const doc = context.doc;
    const fragment = doc.createDocumentFragment();
    nodes.forEach(node => {
      if (!node) return;
      if (node.type === 'paragraph') {
        const p = doc.createElement('p');
        node.children.forEach(child => {
          if (!child) return;
          if (child.type === 'text') {
            appendTextWithMath(p, child.value, context);
          } else if (child.type === 'linebreak') {
            p.appendChild(doc.createElement('br'));
          } else if (child.type === 'answerbox') {
            const box = createAnswerBox(child.value, context);
            if (box) p.appendChild(box);
          }
        });
        if (p.childNodes.length) {
          fragment.appendChild(p);
        }
      } else if (node.type === 'task') {
        const task = doc.createElement('div');
        task.className = 'example-task';
        const body = doc.createElement('div');
        body.className = 'example-task__body';
        const inner = renderAstNodes(node.children || [], context);
        body.appendChild(inner);
        task.appendChild(body);
        fragment.appendChild(task);
      } else if (node.type === 'table') {
        const table = doc.createElement('table');
        table.className = 'example-description-table';
        const columnCount = Math.max(node.headers.length, ...(node.rows || []).map(row => row.length));
        if (node.headers && node.headers.length) {
          const thead = doc.createElement('thead');
          const tr = doc.createElement('tr');
          for (let i = 0; i < columnCount; i++) {
            const th = doc.createElement('th');
            const value = node.headers[i] != null ? node.headers[i] : '';
            appendTextWithMath(th, value, context);
            tr.appendChild(th);
          }
          thead.appendChild(tr);
          table.appendChild(thead);
        }
        const tbody = doc.createElement('tbody');
        (node.rows || []).forEach(row => {
          const tr = doc.createElement('tr');
          for (let i = 0; i < columnCount; i++) {
            const td = doc.createElement('td');
            const value = row[i] != null ? row[i] : '';
            appendTextWithMath(td, value, context);
            tr.appendChild(td);
          }
          tbody.appendChild(tr);
        });
        table.appendChild(tbody);
        fragment.appendChild(table);
      }
    });
    return fragment;
  }

  function attachAnswerHandlers(answerBoxes) {
    answerBoxes.forEach(item => {
      if (!item || !item.input) return;
      const { input, box, status, answers } = item;
      const update = () => {
        const value = input.value || '';
        if (!value.trim()) {
          box.classList.remove('example-answerbox--correct', 'example-answerbox--incorrect');
          if (status) status.textContent = '';
          return;
        }
        const isCorrect = answers.length ? answers.some(answer => answersMatch(value, answer)) : false;
        box.classList.toggle('example-answerbox--correct', isCorrect);
        box.classList.toggle('example-answerbox--incorrect', !isCorrect);
        if (status) status.textContent = isCorrect ? 'Riktig!' : 'Prøv igjen';
      };
      item.update = update;
      input.addEventListener('input', update);
      input.addEventListener('change', update);
      update();
    });
  }

  function renderKatexElements(elements, attempt = 0) {
    if (!elements || !elements.length) return;
    const katex = globalScope && globalScope.katex;
    if (!katex || typeof katex.render !== 'function') {
      if (globalScope && typeof globalScope.setTimeout === 'function' && attempt < MAX_KATEX_ATTEMPTS) {
        globalScope.setTimeout(() => renderKatexElements(elements, attempt + 1), 100 * (attempt + 1));
      }
      return;
    }
    elements.forEach(element => {
      if (!element || !element.dataset) return;
      const latex = element.dataset.katex;
      const fallback = element.textContent || '';
      try {
        katex.render(latex || '', element, { throwOnError: false });
      } catch (error) {
        element.textContent = fallback;
      }
    });
  }

  function renderDescription(value, options) {
    const doc = (options && options.document) || (globalScope && globalScope.document);
    if (!doc) {
      return {
        fragment: null,
        meta: { answerBoxes: [], katexElements: [] },
        hasContent: false
      };
    }
    const ast = parseDescriptionToAst(value);
    const context = {
      doc,
      answerBoxes: [],
      katexElements: []
    };
    const fragment = renderAstNodes(ast, context);
    const hasContent = fragment && fragment.childNodes && fragment.childNodes.length > 0;
    return { fragment, meta: context, hasContent };
  }

  function renderInto(container, value, options) {
    if (!container) {
      return renderDescription(value, options);
    }
    const result = renderDescription(value, { document: container.ownerDocument });
    while (container.firstChild) {
      container.removeChild(container.firstChild);
    }
    if (result.fragment) {
      container.appendChild(result.fragment);
    }
    const enableKatex = !options || options.enableKatex !== false;
    const enableAnswers = !options || options.enableAnswers !== false;
    if (enableKatex) {
      renderKatexElements(result.meta.katexElements || []);
    }
    if (enableAnswers) {
      attachAnswerHandlers(result.meta.answerBoxes || []);
    }
    return result;
  }

  const helpers = {
    parseToAst: parseDescriptionToAst,
    render: renderDescription,
    renderInto,
    attachAnswerHandlers,
    renderKatexElements
  };

  if (globalScope) {
    globalScope.__EXAMPLES_DESCRIPTION__ = helpers;
  }

  return helpers;
})();
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
  sections.forEach(sectionData => {
    const { path, examples } = sectionData;
    if (!Array.isArray(examples) || examples.length === 0) return;
    const section = document.createElement('section');
    const h2 = document.createElement('h2');
    h2.textContent = path;
    section.appendChild(h2);
    examples.forEach((ex, idx) => {
      const wrap = document.createElement('div');
      wrap.className = 'example';
      if (ex && typeof ex.description === 'string' && ex.description.trim()) {
        const description = document.createElement('div');
        description.className = 'example-description';
        const result = DESCRIPTION_RENDERER.renderInto(description, ex.description, {
          enableKatex: true,
          enableAnswers: true
        });
        if (result && result.hasContent) {
          wrap.appendChild(description);
        }
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
    });
    container.appendChild(section);
  });
}
document.addEventListener('DOMContentLoaded', () => {
  renderExamples();
});
