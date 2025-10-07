(function attachMathVisDescriptionRenderer(global) {
  if (!global || typeof global !== 'object') return;
  const doc = global.document;
  if (!doc) return;

  const KATEX_VERSION = '0.16.9';
  const KATEX_CSS_ID = 'math-vis-katex-style';
  const KATEX_SCRIPT_ID = 'math-vis-katex-script';
  const DESCRIPTION_STYLE_ID = 'math-vis-description-style';
  const DESCRIPTION_RENDERER_URL_KEY = '__MATH_VISUALS_DESCRIPTION_RENDERER_URL__';
  const DESCRIPTION_RENDERER_CSS = 'description-renderer.css';

  let scriptAssetUrl = null;

  function resolveScriptUrl() {
    if (scriptAssetUrl) return scriptAssetUrl;
    if (!doc) {
      scriptAssetUrl = 'description-renderer.js';
      return scriptAssetUrl;
    }
    const current = doc.currentScript;
    const candidates = [];
    if (current && current.src) {
      candidates.push(current.src);
    }
    const scripts = doc.getElementsByTagName ? doc.getElementsByTagName('script') : [];
    for (let i = scripts.length - 1; i >= 0; i--) {
      const script = scripts[i];
      if (!script) continue;
      const src = script.getAttribute && script.getAttribute('src');
      if (typeof src === 'string' && src.trim()) {
        candidates.push(src.trim());
        if (src.endsWith('description-renderer.js')) break;
      }
    }
    if (global && typeof global[DESCRIPTION_RENDERER_URL_KEY] === 'string') {
      candidates.push(global[DESCRIPTION_RENDERER_URL_KEY]);
    }
    for (const value of candidates) {
      if (!value) continue;
      try {
        scriptAssetUrl = new URL(value, doc.baseURI).toString();
        break;
      } catch (error) {
        scriptAssetUrl = value;
        break;
      }
    }
    if (!scriptAssetUrl) {
      scriptAssetUrl = 'description-renderer.js';
    }
    if (global) {
      try {
        global[DESCRIPTION_RENDERER_URL_KEY] = scriptAssetUrl;
      } catch (error) {}
    }
    return scriptAssetUrl;
  }

  function resolveAssetUrl(filename) {
    if (!filename) return '';
    const scriptUrl = resolveScriptUrl();
    if (!scriptUrl) return filename;
    try {
      return new URL(filename, scriptUrl).toString();
    } catch (error) {
      return filename;
    }
  }

  function ensureDescriptionStylesLoaded() {
    if (!doc || typeof doc.createElement !== 'function') return;
    if (doc.getElementById && doc.getElementById(DESCRIPTION_STYLE_ID)) {
      return;
    }
    const parent = doc.head || doc.body || doc.documentElement;
    if (!parent) return;
    const link = doc.createElement('link');
    if (!link) return;
    link.id = DESCRIPTION_STYLE_ID;
    link.rel = 'stylesheet';
    link.href = resolveAssetUrl(DESCRIPTION_RENDERER_CSS);
    link.setAttribute('data-mathvis-description-style', 'true');
    parent.appendChild(link);
  }

  let katexPromise = null;
  let answerBoxIdCounter = 0;

  ensureDescriptionStylesLoaded();

  function ensureKatexLoaded() {
    if (global.katex && typeof global.katex.render === 'function') {
      return Promise.resolve(global.katex);
    }
    if (!doc || typeof doc.createElement !== 'function') {
      return Promise.reject(new Error('Document is not available'));
    }
    if (katexPromise) {
      return katexPromise;
    }
    katexPromise = new Promise((resolve, reject) => {
      const cleanupOnError = error => {
        katexPromise = null;
        reject(error);
      };

      try {
        if (!doc.getElementById(KATEX_CSS_ID)) {
          const link = doc.createElement('link');
          link.id = KATEX_CSS_ID;
          link.rel = 'stylesheet';
          link.href = `https://cdn.jsdelivr.net/npm/katex@${KATEX_VERSION}/dist/katex.min.css`;
          doc.head.appendChild(link);
        }
      } catch (error) {
        cleanupOnError(error);
        return;
      }

      const resolveIfReady = () => {
        if (global.katex && typeof global.katex.render === 'function') {
          resolve(global.katex);
          return true;
        }
        return false;
      };

      if (resolveIfReady()) return;

      let script = doc.getElementById(KATEX_SCRIPT_ID);
      if (!script) {
        script = doc.createElement('script');
        script.id = KATEX_SCRIPT_ID;
        script.type = 'text/javascript';
        script.async = true;
        script.src = `https://cdn.jsdelivr.net/npm/katex@${KATEX_VERSION}/dist/katex.min.js`;
        script.setAttribute('data-mathvis-loader', 'true');
        script.addEventListener('load', () => {
          if (!resolveIfReady()) {
            cleanupOnError(new Error('KaTeX failed to initialize'));
          }
        });
        script.addEventListener('error', () => {
          cleanupOnError(new Error('Failed to load KaTeX assets'));
        });
        doc.head.appendChild(script);
      } else if (script.hasAttribute('data-mathvis-loader')) {
        script.addEventListener('load', () => {
          if (!resolveIfReady()) {
            cleanupOnError(new Error('KaTeX failed to initialize'));
          }
        }, { once: true });
        script.addEventListener('error', () => {
          cleanupOnError(new Error('Failed to load KaTeX assets'));
        }, { once: true });
      } else if (resolveIfReady()) {
        return;
      }
    });
    return katexPromise;
  }

  function extractBalancedContent(text, startIndex) {
    let depth = 1;
    for (let i = startIndex; i < text.length; i++) {
      const char = text[i];
      if (char === '{') {
        depth += 1;
      } else if (char === '}') {
        depth -= 1;
        if (depth === 0) {
          return {
            content: text.slice(startIndex, i),
            endIndex: i
          };
        }
      }
    }
    return null;
  }

  function normalizeLineEndings(value) {
    if (typeof value !== 'string') return '';
    return value.replace(/\r\n?/g, '\n');
  }

  function parseAttributeAssignments(line) {
    if (typeof line !== 'string') return null;
    const attrs = {};
    let index = 0;
    while (index < line.length) {
      while (index < line.length && /\s/.test(line[index])) {
        index += 1;
      }
      if (index >= line.length) break;
      const nameMatch = /[a-zA-Z][\w-]*/.exec(line.slice(index));
      if (!nameMatch || nameMatch.index !== 0) {
        return null;
      }
      const name = nameMatch[0];
      index += name.length;
      while (index < line.length && /\s/.test(line[index])) {
        index += 1;
      }
      if (line[index] !== '=') {
        return null;
      }
      index += 1;
      while (index < line.length && /\s/.test(line[index])) {
        index += 1;
      }
      if (index >= line.length) {
        attrs[name] = '';
        break;
      }
      let value = '';
      const quote = line[index];
      if (quote === '"' || quote === "'") {
        index += 1;
        const end = line.indexOf(quote, index);
        if (end === -1) {
          return null;
        }
        value = line.slice(index, end);
        index = end + 1;
      } else {
        const match = /[^\s]+/.exec(line.slice(index));
        if (!match || match.index !== 0) {
          return null;
        }
        value = match[0];
        index += value.length;
      }
      attrs[name] = value;
    }
    return { attrs };
  }

  function splitLeadingAttributes(content) {
    const normalized = normalizeLineEndings(content || '');
    const trimmed = normalized.trim();
    if (!trimmed) {
      return { attrs: {}, body: '' };
    }
    const firstNewline = trimmed.indexOf('\n');
    if (firstNewline === -1) {
      const attrResult = parseAttributeAssignments(trimmed);
      if (attrResult) {
        return { attrs: attrResult.attrs, body: '' };
      }
      return { attrs: {}, body: trimmed };
    }
    const firstLine = trimmed.slice(0, firstNewline);
    const attrResult = parseAttributeAssignments(firstLine);
    if (!attrResult) {
      return { attrs: {}, body: trimmed };
    }
    const body = trimmed.slice(firstNewline + 1).trim();
    return { attrs: attrResult.attrs, body };
  }

  function createStatusElement() {
    const status = doc.createElement('div');
    status.className = 'math-vis-answerbox__status';
    status.setAttribute('aria-live', 'polite');
    status.textContent = '';
    return status;
  }

  function parseAnswerList(value) {
    if (!value || typeof value !== 'string') return [];
    return value
      .split(/(?:\r?\n|\|)+/)
      .map(part => part.trim())
      .filter(Boolean);
  }

  function parseNumeric(value) {
    if (typeof value !== 'string') return NaN;
    const normalized = value
      .trim()
      .replace(/\s+/g, '')
      .replace(',', '.');
    if (!normalized) return NaN;
    const num = Number(normalized);
    return Number.isFinite(num) ? num : NaN;
  }

  function createAnswerEvaluator(config) {
    const type = config.type === 'number' ? 'number' : 'text';
    const caseSensitive = config.caseSensitive === true;
    const tolerance = Number.isFinite(config.tolerance) ? Math.abs(config.tolerance) : 0;
    const answers = Array.isArray(config.answers) ? config.answers : [];

    if (!answers.length) {
      return value => {
        const trimmed = typeof value === 'string' ? value.trim() : '';
        return {
          state: trimmed ? 'pending' : 'empty',
          message: ''
        };
      };
    }

    if (type === 'number') {
      const numericAnswers = answers
        .map(parseNumeric)
        .filter(num => Number.isFinite(num));
      if (!numericAnswers.length) {
        // fall back to text comparison if parsing failed
        const normalizedAnswers = answers.map(answer => (caseSensitive ? answer : answer.toLowerCase()));
        return value => {
          const raw = typeof value === 'string' ? value : '';
          const trimmed = raw.trim();
          if (!trimmed) {
            return { state: 'empty', message: '' };
          }
          const candidate = caseSensitive ? trimmed : trimmed.toLowerCase();
          const ok = normalizedAnswers.includes(candidate);
          return {
            state: ok ? 'correct' : 'incorrect',
            message: ''
          };
        };
      }
      return value => {
        const raw = typeof value === 'string' ? value : '';
        const trimmed = raw.trim();
        if (!trimmed) {
          return { state: 'empty', message: '' };
        }
        const candidate = parseNumeric(trimmed);
        if (!Number.isFinite(candidate)) {
          return { state: 'incorrect', message: '' };
        }
        const match = numericAnswers.some(answer => Math.abs(answer - candidate) <= tolerance);
        return {
          state: match ? 'correct' : 'incorrect',
          message: ''
        };
      };
    }

    const normalizedAnswers = answers.map(answer => (caseSensitive ? answer : answer.toLowerCase()));
    return value => {
      const raw = typeof value === 'string' ? value : '';
      const trimmed = raw.trim();
      if (!trimmed) {
        return { state: 'empty', message: '' };
      }
      const candidate = caseSensitive ? trimmed : trimmed.toLowerCase();
      const ok = normalizedAnswers.includes(candidate);
      return {
        state: ok ? 'correct' : 'incorrect',
        message: ''
      };
    };
  }

  function applyAnswerState(item, evaluation) {
    if (!item || !item.wrapper || !item.input) return;
    const { wrapper, status, messages, input } = item;
    const state = evaluation && evaluation.state ? evaluation.state : 'empty';
    wrapper.dataset.state = state;
    wrapper.classList.toggle('math-vis-answerbox--correct', state === 'correct');
    wrapper.classList.toggle('math-vis-answerbox--incorrect', state === 'incorrect');
    if (input) {
      input.setAttribute('aria-invalid', state === 'incorrect' ? 'true' : 'false');
    }
    const text = (() => {
      if (!messages) return '';
      if (state === 'correct' && messages.correct) return messages.correct;
      if (state === 'incorrect' && messages.incorrect) return messages.incorrect;
      if (state === 'pending' && messages.pending) return messages.pending;
      if ((state === 'empty' || state === 'pending') && messages.empty) return messages.empty;
      return '';
    })();
    if (status) {
      status.textContent = text || '';
    }
  }

  function initializeAnswerBoxes(answerBoxes) {
    if (!Array.isArray(answerBoxes) || !answerBoxes.length) return;
    answerBoxes.forEach(item => {
      if (!item || !item.input || typeof item.evaluate !== 'function') return;
      const { input } = item;
      const update = () => {
        const evaluation = item.evaluate(input.value);
        applyAnswerState(item, evaluation);
      };
      input.addEventListener('input', update);
      input.addEventListener('change', update);
      update();
    });
  }

  function appendInlineContent(container, text, placeholders, behaviors, options) {
    if (!container || typeof container.appendChild !== 'function') return;
    if (typeof text !== 'string' || !text) {
      if (text === '') {
        container.appendChild(doc.createTextNode(''));
      }
      return;
    }
    const markerMath = '@math{';
    const markerAnswer = '@answerbox{';
    const allowAnswerbox = !options || options.allowAnswerbox !== false;
    let index = 0;
    while (index < text.length) {
      const nextMath = text.indexOf(markerMath, index);
      const nextAnswer = allowAnswerbox ? text.indexOf(markerAnswer, index) : -1;
      const nextBreak = text.indexOf('\n', index);
      let nextIndex = text.length;
      let type = 'end';
      if (nextMath !== -1 && nextMath < nextIndex) {
        nextIndex = nextMath;
        type = 'math';
      }
      if (nextAnswer !== -1 && nextAnswer < nextIndex) {
        nextIndex = nextAnswer;
        type = 'answer';
      }
      if (nextBreak !== -1 && nextBreak < nextIndex) {
        nextIndex = nextBreak;
        type = 'break';
      }
      if (type === 'end') {
        if (index < text.length) {
          container.appendChild(doc.createTextNode(text.slice(index)));
        }
        break;
      }
      if (nextIndex > index) {
        container.appendChild(doc.createTextNode(text.slice(index, nextIndex)));
        index = nextIndex;
        continue;
      }
      if (type === 'break') {
        container.appendChild(doc.createElement('br'));
        index = nextIndex + 1;
        continue;
      }
      if (type === 'math') {
        const extraction = extractBalancedContent(text, nextIndex + markerMath.length);
        if (!extraction) {
          container.appendChild(doc.createTextNode(text.slice(nextIndex)));
          break;
        }
        const span = doc.createElement('span');
        span.className = 'math-vis-description-math';
        span.textContent = extraction.content;
        placeholders.push({ element: span, tex: extraction.content });
        container.appendChild(span);
        index = extraction.endIndex + 1;
        continue;
      }
      if (type === 'answer') {
        const extraction = extractBalancedContent(text, nextIndex + markerAnswer.length);
        if (!extraction) {
          container.appendChild(doc.createTextNode(text.slice(nextIndex)));
          break;
        }
        const answerElement = createAnswerBoxElement(extraction.content, placeholders, behaviors);
        if (answerElement) {
          container.appendChild(answerElement);
        } else {
          container.appendChild(doc.createTextNode(text.slice(nextIndex, extraction.endIndex + 1)));
        }
        index = extraction.endIndex + 1;
      }
    }
  }

  function appendParagraphs(target, text, placeholders, behaviors, options) {
    if (!target || typeof target.appendChild !== 'function') return;
    if (typeof text !== 'string') return;
    const normalized = normalizeLineEndings(text);
    const paragraphs = normalized.split(/\n{2,}/);
    paragraphs.forEach(paragraph => {
      if (!paragraph.trim()) return;
      const p = doc.createElement('p');
      appendInlineContent(p, paragraph, placeholders, behaviors, options);
      target.appendChild(p);
    });
  }

  function createAnswerBoxElement(content, placeholders, behaviors) {
    const { attrs, body } = splitLeadingAttributes(content);
    const wrapper = doc.createElement('div');
    wrapper.className = 'math-vis-answerbox';
    if (attrs.id) {
      wrapper.id = attrs.id;
    }
    const label = doc.createElement('label');
    label.className = 'math-vis-answerbox__label';
    const input = doc.createElement('input');
    input.className = 'math-vis-answerbox__input';
    input.setAttribute('type', 'text');
    input.setAttribute('autocomplete', 'off');
    input.setAttribute('autocorrect', 'off');
    input.setAttribute('spellcheck', 'false');
    const inputId = attrs.inputId || `math-vis-answerbox-input-${++answerBoxIdCounter}`;
    input.id = inputId;
    label.setAttribute('for', inputId);
    const labelText = attrs.label || attrs.title || 'Svar';
    label.appendChild(doc.createTextNode(labelText));
    const type = attrs.type === 'number' ? 'number' : 'text';
    if (type === 'number') {
      input.setAttribute('inputmode', 'decimal');
    }
    if (attrs.placeholder) {
      input.setAttribute('placeholder', attrs.placeholder);
    }
    if (attrs.maxlength) {
      const max = parseInt(attrs.maxlength, 10);
      if (Number.isInteger(max) && max > 0) {
        input.setAttribute('maxlength', String(max));
      }
    }
    if (attrs.pattern) {
      input.setAttribute('pattern', attrs.pattern);
    }
    if (attrs.width) {
      input.style.width = attrs.width;
    }
    const inputWrap = doc.createElement('div');
    inputWrap.className = 'math-vis-answerbox__control';
    inputWrap.appendChild(input);
    wrapper.appendChild(label);
    wrapper.appendChild(inputWrap);
    if (body) {
      const prompt = doc.createElement('div');
      prompt.className = 'math-vis-answerbox__prompt';
      appendInlineContent(prompt, body, placeholders, behaviors, { allowAnswerbox: false });
      wrapper.appendChild(prompt);
    }
    const status = createStatusElement();
    const statusId = `${inputId}-status`;
    status.id = statusId;
    input.setAttribute('aria-describedby', statusId);
    wrapper.appendChild(status);

    const answers = [
      ...parseAnswerList(attrs.answer || attrs.answers || attrs.correct || ''),
      ...parseAnswerList(attrs.accept || '')
    ];
    const tolerance = typeof attrs.tolerance === 'string' ? parseFloat(attrs.tolerance.replace(',', '.')) : NaN;
    const evaluate = createAnswerEvaluator({
      type,
      answers,
      tolerance,
      caseSensitive: /^true$/i.test(attrs.caseSensitive || attrs.case || '')
    });
    const messages = {
      correct: attrs.correctText || attrs.correctMessage || 'Riktig!',
      incorrect: attrs.incorrectText || attrs.incorrectMessage || 'Prøv igjen.',
      pending: attrs.pendingText || attrs.pendingMessage || '',
      empty: attrs.emptyText || attrs.emptyMessage || ''
    };
    if (!behaviors.answerBoxes) {
      behaviors.answerBoxes = [];
    }
    behaviors.answerBoxes.push({
      wrapper,
      input,
      status,
      evaluate,
      messages
    });
    return wrapper;
  }

  function createDescriptionTable(content, placeholders, behaviors) {
    if (typeof content !== 'string') return null;
    const rows = normalizeLineEndings(content)
      .split(/\n+/)
      .map(row => row.split('|').map(cell => cell.trim()))
      .filter(row => row.some(cell => cell));
    if (!rows.length) return null;
    const table = doc.createElement('table');
    table.className = 'example-description-table';
    const columnCount = rows.reduce((max, row) => Math.max(max, row.length), 0);
    if (columnCount === 0) return null;
    let bodyStartIndex = 0;
    if (rows.length > 1) {
      const headerCandidate = rows[0];
      const hasHeader = headerCandidate.every(cell => cell && cell.length > 0);
      if (hasHeader) {
        const thead = doc.createElement('thead');
        const headRow = doc.createElement('tr');
        for (let i = 0; i < columnCount; i++) {
          const th = doc.createElement('th');
          appendInlineContent(th, headerCandidate[i] != null ? headerCandidate[i] : '', placeholders, behaviors);
          headRow.appendChild(th);
        }
        thead.appendChild(headRow);
        table.appendChild(thead);
        bodyStartIndex = 1;
      }
    }
    const tbody = doc.createElement('tbody');
    const appendRow = row => {
      const tr = doc.createElement('tr');
      for (let i = 0; i < columnCount; i++) {
        const td = doc.createElement('td');
        appendInlineContent(td, row && row[i] != null ? row[i] : '', placeholders, behaviors);
        tr.appendChild(td);
      }
      tbody.appendChild(tr);
    };
    if (rows.length === 1) {
      appendRow(rows[0]);
    } else {
      for (let i = bodyStartIndex; i < rows.length; i++) {
        appendRow(rows[i]);
      }
    }
    table.appendChild(tbody);
    return table;
  }

  function renderTaskBlock(target, content, placeholders, behaviors) {
    const { attrs, body } = splitLeadingAttributes(content);
    const article = doc.createElement('article');
    article.className = 'math-vis-task';
    if (attrs.id) {
      article.id = attrs.id;
    }
    const title = attrs.title || attrs.heading || '';
    if (title) {
      const header = doc.createElement('header');
      header.className = 'math-vis-task__header';
      const titleEl = doc.createElement('h3');
      titleEl.className = 'math-vis-task__title';
      appendInlineContent(titleEl, title, placeholders, behaviors, { allowAnswerbox: false });
      header.appendChild(titleEl);
      article.appendChild(header);
    }
    const contentEl = doc.createElement('div');
    contentEl.className = 'math-vis-task__content';
    renderBlocks(contentEl, body || '', placeholders, behaviors, { withinTask: true });
    if (!contentEl.childNodes.length) {
      contentEl.appendChild(doc.createTextNode(''));
    }
    article.appendChild(contentEl);
    target.appendChild(article);
    return article;
  }

  function renderBlocks(target, text, placeholders, behaviors, context) {
    if (!target || typeof target.appendChild !== 'function') return;
    if (typeof text !== 'string') return;
    const normalized = normalizeLineEndings(text);
    const TASK_MARKER = '@task{';
    const TABLE_MARKER = '@table{';
    const withinTask = !!(context && context.withinTask);
    const allowTaskBlocks = !withinTask;
    const allowAnswerbox = !context || context.allowAnswerbox !== false;
    let index = 0;
    while (index < normalized.length) {
      const nextTask = allowTaskBlocks ? normalized.indexOf(TASK_MARKER, index) : -1;
      const nextTable = normalized.indexOf(TABLE_MARKER, index);
      let nextIndex = normalized.length;
      let type = null;
      if (nextTask !== -1 && nextTask < nextIndex) {
        nextIndex = nextTask;
        type = 'task';
      }
      if (nextTable !== -1 && nextTable < nextIndex) {
        nextIndex = nextTable;
        type = 'table';
      }
      if (type === null) {
        const remaining = normalized.slice(index);
        appendParagraphs(target, remaining, placeholders, behaviors, { allowAnswerbox });
        break;
      }
      if (nextIndex > index) {
        const before = normalized.slice(index, nextIndex);
        appendParagraphs(target, before, placeholders, behaviors, { allowAnswerbox });
      }
      if (type === 'task') {
        const extraction = extractBalancedContent(normalized, nextIndex + TASK_MARKER.length);
        if (!extraction) {
          appendParagraphs(target, normalized.slice(nextIndex), placeholders, behaviors, { allowAnswerbox });
          break;
        }
        renderTaskBlock(target, extraction.content, placeholders, behaviors);
        index = extraction.endIndex + 1;
        continue;
      }
      if (type === 'table') {
        const extraction = extractBalancedContent(normalized, nextIndex + TABLE_MARKER.length);
        if (!extraction) {
          appendParagraphs(target, normalized.slice(nextIndex), placeholders, behaviors, { allowAnswerbox });
          break;
        }
        const table = createDescriptionTable(extraction.content, placeholders, behaviors);
        if (table) {
          target.appendChild(table);
        } else {
          appendParagraphs(target, normalized.slice(nextIndex, extraction.endIndex + 1), placeholders, behaviors, { allowAnswerbox });
        }
        index = extraction.endIndex + 1;
        continue;
      }
    }
  }

  function parse(value) {
    const fragment = doc.createDocumentFragment();
    const placeholders = [];
    const behaviors = { answerBoxes: [] };
    if (typeof value !== 'string') {
      return { fragment, placeholders, behaviors };
    }
    renderBlocks(fragment, value, placeholders, behaviors, { withinTask: false });
    return { fragment, placeholders, behaviors };
  }

  function renderInto(target, value) {
    if (!target) return false;
    while (target.firstChild) {
      target.removeChild(target.firstChild);
    }
    const parsed = parse(typeof value === 'string' ? value : '');
    const { fragment, placeholders, behaviors } = parsed;
    if (fragment) {
      target.appendChild(fragment);
    }
    const hasContent = !!(fragment && fragment.childNodes && fragment.childNodes.length);
    if (Array.isArray(placeholders) && placeholders.length) {
      const schedule = () => {
        ensureKatexLoaded()
          .then(katex => {
            placeholders.forEach(({ element, tex }) => {
              if (!element || tex == null) return;
              try {
                katex.render(tex, element, { throwOnError: false });
              } catch (error) {
                element.classList.add('math-vis-description-math--error');
              }
            });
          })
          .catch(() => {
            // leave math as plain text
          });
      };
      if (typeof Promise === 'function' && Promise.resolve) {
        Promise.resolve().then(schedule);
      } else {
        setTimeout(schedule, 0);
      }
    }
    if (behaviors && Array.isArray(behaviors.answerBoxes) && behaviors.answerBoxes.length) {
      initializeAnswerBoxes(behaviors.answerBoxes);
    }
    return hasContent;
  }

  global.MathVisDescriptionRenderer = {
    ensureKatexLoaded,
    parse,
    renderInto
  };
})(typeof window !== 'undefined' ? window : typeof globalThis !== 'undefined' ? globalThis : null);
