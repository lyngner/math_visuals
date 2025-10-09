(function attachMathVisDescriptionRenderer(global) {
  if (!global || typeof global !== 'object') return;
  const doc = global.document;
  if (!doc) return;

  const KATEX_VERSION = '0.16.9';
  const DEFAULT_KATEX_BASE_PATH = '/vendor/cdn/katex';
  const scriptList = () => {
    if (!doc || typeof doc.getElementsByTagName !== 'function') return [];
    const list = [];
    if (doc.currentScript) list.push(doc.currentScript);
    list.push(...doc.getElementsByTagName('script'));
    return list;
  };

  const normalizeBasePath = value => {
    if (typeof value !== 'string') return null;
    const trimmed = value.trim();
    if (!trimmed) return null;
    return trimmed.replace(/\/+$/, '');
  };

  const resolveFromScript = script => {
    if (!script) return null;
    const dataValue = script.dataset && (script.dataset.mathVisKatexBase || script.dataset.mathvisKatexBase);
    const attrValue = script.getAttribute && (script.getAttribute('data-math-vis-katex-base') || script.getAttribute('data-mathvis-katex-base'));
    const explicit = normalizeBasePath(dataValue || attrValue);
    if (explicit) return explicit;
    if (script.src) {
      try {
        const url = new URL('vendor/cdn/katex/', script.src);
        return normalizeBasePath(url.href);
      } catch (error) {
        // Ignore resolution errors and fall through to other strategies.
      }
    }
    return null;
  };

  const resolveKatexBasePath = () => {
    const explicitGlobal = normalizeBasePath(global.__MATH_VIS_KATEX_BASE_PATH__);
    if (explicitGlobal) return explicitGlobal;

    for (const script of scriptList()) {
      const resolved = resolveFromScript(script);
      if (resolved) return resolved;
    }

    if (doc && typeof doc.baseURI === 'string') {
      try {
        const url = new URL(DEFAULT_KATEX_BASE_PATH.replace(/^\//, ''), doc.baseURI);
        return normalizeBasePath(url.href) || DEFAULT_KATEX_BASE_PATH;
      } catch (error) {
        // Ignore resolution errors and fall back to default path.
      }
    }

    if (global.location && typeof global.location.href === 'string') {
      try {
        const url = new URL(DEFAULT_KATEX_BASE_PATH.replace(/^\//, ''), global.location.href);
        return normalizeBasePath(url.href) || DEFAULT_KATEX_BASE_PATH;
      } catch (error) {
        // Ignore resolution errors and fall back to default path.
      }
    }

    return DEFAULT_KATEX_BASE_PATH;
  };

  const KATEX_BASE_PATH = resolveKatexBasePath();
  const KATEX_CSS_ID = 'math-vis-katex-style';
  const KATEX_SCRIPT_ID = 'math-vis-katex-script';
  const ANSWERBOX_STATUS_MESSAGES = {
    correct: 'Riktig!',
    incorrect: 'Prøv igjen.'
  };
  let answerBoxIdCounter = 0;

  let katexPromise = null;

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
          link.href = `${KATEX_BASE_PATH}/katex.min.css`;
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
        script.src = `${KATEX_BASE_PATH}/katex.min.js`;
        script.setAttribute('data-mathvis-loader', 'true');
        script.addEventListener('load', () => {
          if (!resolveIfReady()) {
            cleanupOnError(new Error('KaTeX failed to initialize'));
          }
        });
        script.addEventListener('error', event => {
          cleanupOnError(new Error('Failed to load KaTeX assets'));
        });
        doc.head.appendChild(script);
      } else if (script.hasAttribute('data-mathvis-loader')) {
        script.addEventListener('load', () => {
          if (!resolveIfReady()) {
            cleanupOnError(new Error('KaTeX failed to initialize'));
          }
        }, { once: true });
        script.addEventListener('error', event => {
          cleanupOnError(new Error('Failed to load KaTeX assets'));
        }, { once: true });
      } else if (resolveIfReady()) {
        return;
      }
    });
    return katexPromise;
  }

  function extractBalancedContent(text, startIndex, openChar = '{', closeChar = '}') {
    let depth = 1;
    for (let i = startIndex; i < text.length; i++) {
      const char = text[i];
      if (char === openChar) {
        depth += 1;
      } else if (char === closeChar) {
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

  function splitDescriptor(content) {
    const parts = [];
    if (typeof content !== 'string' || !content) return parts;
    let current = '';
    let escape = false;
    let inSingleQuote = false;
    let inDoubleQuote = false;
    for (let i = 0; i < content.length; i++) {
      const char = content[i];
      if (escape) {
        current += char;
        escape = false;
        continue;
      }
      if (char === '\\') {
        escape = true;
        continue;
      }
      if (char === "'" && !inDoubleQuote) {
        inSingleQuote = !inSingleQuote;
        current += char;
        continue;
      }
      if (char === '"' && !inSingleQuote) {
        inDoubleQuote = !inDoubleQuote;
        current += char;
        continue;
      }
      let isSeparator = false;
      if (!inSingleQuote && !inDoubleQuote) {
        if (char === '|') {
          isSeparator = true;
        } else if (char === ',') {
          const prevChar = content[i - 1];
          const nextChar = content[i + 1];
          const nextIsWhitespace = typeof nextChar === 'string' && /\s/.test(nextChar);
          const nextIsQuote = nextChar === '"' || nextChar === "'";
          if (prevChar === '"' || prevChar === "'" || nextIsWhitespace || nextIsQuote) {
            isSeparator = true;
          }
        }
      }
      if (isSeparator) {
        const nextChar = content[i + 1];
        if (nextChar === char) {
          current += char;
          i += 1;
          current += content[i];
          continue;
        }
        parts.push(current);
        current = '';
        continue;
      }
      current += char;
    }
    parts.push(current);
    return parts;
  }

  function unescapeMarkup(text) {
    if (typeof text !== 'string') return '';
    return text.replace(/\\([\\{}|,])/g, '$1');
  }

  function stripEnclosingQuotes(value) {
    if (typeof value !== 'string') return value;
    const trimmed = value.trim();
    if (trimmed.length >= 2) {
      const first = trimmed[0];
      const last = trimmed[trimmed.length - 1];
      if ((first === '"' && last === '"') || (first === "'" && last === "'")) {
        return trimmed.slice(1, -1);
      }
    }
    return trimmed;
  }

  function sanitizeDescriptorValue(value) {
    if (typeof value !== 'string') return '';
    return stripEnclosingQuotes(unescapeMarkup(value));
  }

  function parseBoolean(value) {
    if (typeof value === 'boolean') return value;
    if (typeof value !== 'string') return null;
    const normalized = value.trim().toLowerCase();
    if (['1', 'true', 'yes', 'on'].includes(normalized)) return true;
    if (['0', 'false', 'no', 'off'].includes(normalized)) return false;
    return null;
  }

  function parseNumber(value) {
    if (typeof value === 'number' && Number.isFinite(value)) return value;
    if (typeof value !== 'string') return null;
    const trimmed = value.trim();
    if (!trimmed) return null;
    const parsed = Number(trimmed);
    return Number.isFinite(parsed) ? parsed : null;
  }

  function collapseWhitespace(value) {
    if (typeof value !== 'string') return '';
    return value.replace(/\s+/g, ' ').trim();
  }

  function toNumericValue(value) {
    if (typeof value !== 'string') return null;
    const stripped = value.replace(/\s+/g, '').replace(/,/g, '.');
    if (!stripped || /[^0-9+\-.]/.test(stripped)) {
      return null;
    }
    if (!/^[-+]?\d*(?:\.\d+)?$/.test(stripped)) {
      return null;
    }
    const parsed = Number(stripped);
    return Number.isFinite(parsed) ? parsed : null;
  }

  function parseAnswerDescriptor(content) {
    const parts = splitDescriptor(content);
    const positional = [];
    const options = {};
    parts.forEach(part => {
      const trimmed = typeof part === 'string' ? part.trim() : '';
      if (!trimmed) return;
      const eqIndex = trimmed.indexOf('=');
      if (eqIndex > 0) {
        const key = trimmed.slice(0, eqIndex).trim().toLowerCase();
        const value = trimmed.slice(eqIndex + 1);
        if (key) {
          options[key] = sanitizeDescriptorValue(value);
        }
      } else {
        positional.push(sanitizeDescriptorValue(trimmed));
      }
    });
    if (!options.value && positional.length) options.value = positional.shift();
    if (!options.placeholder && positional.length) options.placeholder = positional.shift();
    if (!options.label && positional.length) options.label = positional.shift();
    if (!options.correct && positional.length) options.correct = positional.shift();
    if (!options.incorrect && positional.length) options.incorrect = positional.shift();

    const accepted = [];
    const addAccepted = raw => {
      if (typeof raw !== 'string') return;
      const segments = raw.split(/\|\|/);
      segments.forEach(segment => {
        const normalized = collapseWhitespace(unescapeMarkup(segment));
        if (normalized) {
          accepted.push(normalized);
        }
      });
    };
    addAccepted(options.value);
    addAccepted(options.values);
    addAccepted(options.answer);
    addAccepted(options.answers);
    addAccepted(options.accept);

    const caseSensitive = parseBoolean(options.caseSensitive ?? options.casesensitive ?? options.case ?? options.matchcase) === true;
    const tolerance = parseNumber(options.tolerance ?? options.toleranse ?? options.slack);
    const correctMessage = options.correct ?? options.correctMessage ?? options.success ?? options.ok ?? '';
    const incorrectMessage = options.incorrect ?? options.incorrectMessage ?? options.error ?? options.fail ?? '';

    return {
      acceptedAnswers: accepted.map(answer => ({
        raw: answer,
        normalized: collapseWhitespace(answer),
        comparable: collapseWhitespace(answer).toLowerCase(),
        numeric: toNumericValue(answer)
      })),
      placeholder: options.placeholder || '',
      label: options.label || '',
      width: options.width || options.bredde || '',
      size: options.size || options.length || '',
      caseSensitive,
      tolerance: typeof tolerance === 'number' ? Math.max(0, tolerance) : null,
      correctMessage: collapseWhitespace(correctMessage) || '',
      incorrectMessage: collapseWhitespace(incorrectMessage) || ''
    };
  }

  function findNextSpecial(text, index, allowAnswerBoxes) {
    const nextBreak = text.indexOf('\n', index);
    const nextMath = text.indexOf('@math{', index);
    const result = {
      type: 'end',
      nextIndex: text.length,
      marker: null,
      openChar: null,
      closeChar: null
    };
    if (nextBreak !== -1 && nextBreak < result.nextIndex) {
      result.type = 'break';
      result.nextIndex = nextBreak;
    }
    if (nextMath !== -1 && nextMath < result.nextIndex) {
      result.type = 'math';
      result.nextIndex = nextMath;
      result.marker = null;
      result.openChar = null;
      result.closeChar = null;
    }
    if (allowAnswerBoxes) {
      const answerMarkers = [
        { marker: '@answer{', openChar: '{', closeChar: '}' },
        { marker: '@answerbox[', openChar: '[', closeChar: ']' },
        { marker: '@input[', openChar: '[', closeChar: ']' }
      ];
      answerMarkers.forEach(({ marker, openChar, closeChar }) => {
        const position = text.indexOf(marker, index);
        if (position !== -1 && position < result.nextIndex) {
          result.type = 'answer';
          result.nextIndex = position;
          result.marker = marker;
          result.openChar = openChar;
          result.closeChar = closeChar;
        }
      });
    }
    return result;
  }

  function appendInlineContent(container, text, placeholders, interactives, options) {
    if (!container || typeof container.appendChild !== 'function') return;
    if (typeof text !== 'string' || text === '') {
      if (text === '') {
        container.appendChild(doc.createTextNode(''));
      }
      return;
    }
    const allowAnswerBoxes = !(options && options.allowAnswerBoxes === false);
    let index = 0;
    while (index < text.length) {
      const { type, nextIndex, marker, openChar, closeChar } = findNextSpecial(text, index, allowAnswerBoxes);
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
        const extraction = extractBalancedContent(text, nextIndex + '@math{'.length);
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
        const markerLength = typeof marker === 'string' ? marker.length : '@answer{'.length;
        const extraction = extractBalancedContent(
          text,
          nextIndex + markerLength,
          openChar || '{',
          closeChar || '}'
        );
        if (!extraction) {
          container.appendChild(doc.createTextNode(text.slice(nextIndex)));
          break;
        }
        const answerElement = createAnswerBox(extraction.content, placeholders, interactives, marker);
        if (answerElement) {
          container.appendChild(answerElement);
        } else {
          container.appendChild(doc.createTextNode(text.slice(nextIndex, extraction.endIndex + 1)));
        }
        index = extraction.endIndex + 1;
      }
    }
  }

  function appendParagraphs(fragment, text, placeholders, interactives) {
    if (!fragment || typeof fragment.appendChild !== 'function') return;
    if (typeof text !== 'string') return;
    const normalized = text.replace(/\r\n?/g, '\n');
    const paragraphs = normalized.split(/\n{2,}/);
    paragraphs.forEach(paragraph => {
      if (!paragraph.trim()) return;
      const p = doc.createElement('p');
      appendInlineContent(p, paragraph, placeholders, interactives);
      fragment.appendChild(p);
    });
  }

  function createDescriptionTable(content, placeholders, interactives) {
    if (typeof content !== 'string') return null;
    const rows = content
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
          appendInlineContent(th, headerCandidate[i] != null ? headerCandidate[i] : '', placeholders, interactives);
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
        appendInlineContent(td, row && row[i] != null ? row[i] : '', placeholders, interactives);
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

  function createAnswerBox(content, placeholders, interactives, marker) {
    if (!interactives || !Array.isArray(interactives.answerBoxes)) return null;
    const descriptor = parseAnswerDescriptor(content);
    if (!descriptor.acceptedAnswers.length) {
      return null;
    }
    const container = doc.createElement('span');
    container.className = 'math-vis-answerbox math-vis-answerbox--empty';
    container.dataset.state = 'empty';

    if (marker === '@input[') {
      container.classList.add('math-vis-answerbox--input');
    }

    if (descriptor.label) {
      const prompt = doc.createElement('span');
      prompt.className = 'math-vis-answerbox__prompt';
      appendInlineContent(prompt, descriptor.label, placeholders, interactives, { allowAnswerBoxes: false });
      container.appendChild(prompt);
    }

    const inputWrap = doc.createElement('span');
    inputWrap.className = 'math-vis-answerbox__input-wrap';

    const input = doc.createElement('input');
    input.type = 'text';
    input.className = 'math-vis-answerbox__input';
    if (descriptor.placeholder) input.placeholder = descriptor.placeholder;
    if (descriptor.width) {
      input.style.width = descriptor.width;
    } else if (descriptor.size) {
      const numericSize = Number(descriptor.size);
      if (Number.isFinite(numericSize) && numericSize > 0) {
        const rounded = Math.max(1, Math.round(numericSize));
        input.setAttribute('size', String(rounded));
      } else {
        input.style.width = descriptor.size;
      }
    }
    if (!descriptor.label) {
      const ariaLabel = descriptor.placeholder || 'Svar';
      input.setAttribute('aria-label', ariaLabel);
    }

    const status = doc.createElement('span');
    status.className = 'math-vis-answerbox__status';
    status.setAttribute('aria-live', 'polite');
    const statusId = `math-vis-answerbox-status-${++answerBoxIdCounter}`;
    status.id = statusId;
    input.setAttribute('aria-describedby', statusId);

    inputWrap.appendChild(input);
    container.appendChild(inputWrap);
    container.appendChild(status);

    interactives.answerBoxes.push({
      container,
      input,
      status,
      descriptor,
      variant: marker === '@input[' ? 'input' : 'answerbox'
    });

    return container;
  }

  function findBlock(text, lowerText, marker, startIndex) {
    if (!text || !marker) return null;
    const lowerMarker = marker.toLowerCase();
    let searchIndex = startIndex;
    while (searchIndex < text.length) {
      const markerIndex = lowerText.indexOf(lowerMarker, searchIndex);
      if (markerIndex === -1) {
        return null;
      }
      let cursor = markerIndex + marker.length;
      while (cursor < text.length && /\s/.test(text[cursor])) {
        cursor += 1;
      }
      if (cursor >= text.length || !'{['.includes(text[cursor])) {
        searchIndex = markerIndex + marker.length;
        continue;
      }
      const openChar = text[cursor];
      const closeChar = openChar === '{' ? '}' : ']';
      const extraction = extractBalancedContent(text, cursor + 1, openChar, closeChar);
      if (!extraction) {
        return { markerIndex, extraction: null };
      }
      return { markerIndex, extraction };
    }
    return null;
  }

  function appendFlowContent(target, text, placeholders, interactives) {
    if (!target || typeof target.appendChild !== 'function') return;
    if (typeof text !== 'string' || !text.trim()) {
      appendParagraphs(target, text, placeholders, interactives);
      return;
    }
    const normalized = text.replace(/\r\n?/g, '\n');
    const lower = normalized.toLowerCase();
    let index = 0;
    while (index < normalized.length) {
      const found = findBlock(normalized, lower, '@table', index);
      if (!found) {
        break;
      }
      const before = normalized.slice(index, found.markerIndex);
      appendParagraphs(target, before, placeholders, interactives);
      if (!found.extraction) {
        appendParagraphs(target, normalized.slice(found.markerIndex), placeholders, interactives);
        return;
      }
      const table = createDescriptionTable(found.extraction.content, placeholders, interactives);
      if (table) {
        target.appendChild(table);
      } else {
        appendParagraphs(target, normalized.slice(found.markerIndex, found.extraction.endIndex + 1), placeholders, interactives);
      }
      index = found.extraction.endIndex + 1;
    }
    const after = normalized.slice(index);
    appendParagraphs(target, after, placeholders, interactives);
  }

  function findFirstUnescaped(text, char) {
    if (typeof text !== 'string' || !char) return -1;
    for (let i = 0; i < text.length; i++) {
      const current = text[i];
      if (current === '\\') {
        i += 1;
        continue;
      }
      if (current === char) return i;
    }
    return -1;
  }

  function parseTaskBlock(content) {
    if (typeof content !== 'string') {
      return { title: '', body: '' };
    }
    const normalized = content.replace(/\r\n?/g, '\n');
    const trimmed = normalized.trim();
    if (!trimmed) {
      return { title: '', body: '' };
    }
    const pipeIndex = findFirstUnescaped(trimmed, '|');
    let title;
    let body;
    if (pipeIndex !== -1) {
      title = trimmed.slice(0, pipeIndex);
      body = trimmed.slice(pipeIndex + 1);
    } else {
      const newlineIndex = trimmed.indexOf('\n');
      if (newlineIndex !== -1) {
        title = trimmed.slice(0, newlineIndex);
        body = trimmed.slice(newlineIndex + 1);
      } else {
        title = trimmed;
        body = '';
      }
    }
    return {
      title: collapseWhitespace(unescapeMarkup(title || '')),
      body: unescapeMarkup(body || '').trim()
    };
  }

  function createTaskSection(content, placeholders, interactives) {
    const parsed = parseTaskBlock(content);
    const { title, body } = parsed;
    if (!title && !body) {
      return null;
    }
    const section = doc.createElement('section');
    section.className = 'math-vis-task';
    if (title) {
      const heading = doc.createElement('h3');
      heading.className = 'math-vis-task__title';
      appendInlineContent(heading, title, placeholders, interactives, { allowAnswerBoxes: false });
      section.appendChild(heading);
    }
    if (body) {
      const contentWrap = doc.createElement('div');
      contentWrap.className = 'math-vis-task__content';
      appendFlowContent(contentWrap, body, placeholders, interactives);
      if (contentWrap.childNodes.length) {
        section.appendChild(contentWrap);
      }
    }
    if (!section.childNodes.length) {
      return null;
    }
    return section;
  }

  function parse(value) {
    const fragment = doc.createDocumentFragment();
    const placeholders = [];
    const answerBoxes = [];
    if (typeof value !== 'string') {
      return { fragment, placeholders, answerBoxes };
    }
    const interactives = { answerBoxes };
    const normalized = value.replace(/\r\n?/g, '\n');
    const lower = normalized.toLowerCase();
    let index = 0;
    while (index < normalized.length) {
      const found = findBlock(normalized, lower, '@task', index);
      if (!found) {
        const remaining = normalized.slice(index);
        appendFlowContent(fragment, remaining, placeholders, interactives);
        break;
      }
      const before = normalized.slice(index, found.markerIndex);
      appendFlowContent(fragment, before, placeholders, interactives);
      if (!found.extraction) {
        appendFlowContent(fragment, normalized.slice(found.markerIndex), placeholders, interactives);
        break;
      }
      const section = createTaskSection(found.extraction.content, placeholders, interactives);
      if (section) {
        fragment.appendChild(section);
      } else {
        appendFlowContent(fragment, normalized.slice(found.markerIndex, found.extraction.endIndex + 1), placeholders, interactives);
      }
      index = found.extraction.endIndex + 1;
    }
    return { fragment, placeholders, answerBoxes };
  }

  function setAnswerBoxState(box, state) {
    if (!box || !box.container) return;
    const { container, status, input, descriptor } = box;
    const stateClasses = ['math-vis-answerbox--empty', 'math-vis-answerbox--correct', 'math-vis-answerbox--incorrect'];
    stateClasses.forEach(className => {
      if (container.classList.contains(className)) {
        container.classList.remove(className);
      }
    });
    if (state && typeof state === 'string') {
      const nextClass = `math-vis-answerbox--${state}`;
      if (stateClasses.includes(nextClass)) {
        container.classList.add(nextClass);
      }
    }
    container.dataset.state = state;
    if (!status || !input) return;
    if (state === 'correct') {
      status.textContent = descriptor.correctMessage || ANSWERBOX_STATUS_MESSAGES.correct;
      input.setAttribute('aria-invalid', 'false');
    } else if (state === 'incorrect') {
      status.textContent = descriptor.incorrectMessage || ANSWERBOX_STATUS_MESSAGES.incorrect;
      input.setAttribute('aria-invalid', 'true');
    } else {
      status.textContent = '';
      input.removeAttribute('aria-invalid');
    }
  }

  function evaluateAnswerBox(box) {
    if (!box || !box.input) return;
    const { input, descriptor } = box;
    const raw = typeof input.value === 'string' ? input.value : '';
    const trimmed = collapseWhitespace(raw);
    if (!trimmed) {
      setAnswerBoxState(box, 'empty');
      return;
    }
    const comparable = descriptor.caseSensitive ? trimmed : trimmed.toLowerCase();
    const numericValue = toNumericValue(raw);
    const isCorrect = descriptor.acceptedAnswers.some(answer => {
      if (descriptor.caseSensitive) {
        if (trimmed === answer.normalized) return true;
      } else if (comparable === answer.comparable) {
        return true;
      }
      if (numericValue != null && answer.numeric != null) {
        const tolerance = typeof descriptor.tolerance === 'number' ? descriptor.tolerance : 0;
        if (Math.abs(numericValue - answer.numeric) <= tolerance + Number.EPSILON) {
          return true;
        }
      }
      return false;
    });
    setAnswerBoxState(box, isCorrect ? 'correct' : 'incorrect');
  }

  function setupAnswerBoxes(answerBoxes) {
    if (!Array.isArray(answerBoxes) || !answerBoxes.length) return;
    answerBoxes.forEach(box => {
      if (!box || !box.input) return;
      const handler = () => evaluateAnswerBox(box);
      box.input.addEventListener('input', handler);
      box.input.addEventListener('blur', handler);
      evaluateAnswerBox(box);
    });
  }

  function renderInto(target, value) {
    if (!target) return false;
    while (target.firstChild) {
      target.removeChild(target.firstChild);
    }
    const parsed = parse(typeof value === 'string' ? value : '');
    const { fragment, placeholders, answerBoxes } = parsed;
    const hasContent = !!(fragment && fragment.childNodes && fragment.childNodes.length);
    if (fragment) {
      target.appendChild(fragment);
    }
    target.classList.add('math-vis-description-rendered');
    if (placeholders.length) {
      const schedule = () => {
        ensureKatexLoaded()
          .then(katex => {
            placeholders.forEach(({ element, tex }) => {
              if (!element || (!tex && tex !== '')) return;
              try {
                katex.render(tex, element, { throwOnError: false });
              } catch (error) {
                element.classList.add('math-vis-description-math--error');
              }
            });
          })
          .catch(() => {
            // Graceful fallback: leave text content untouched
          });
      };
      if (typeof Promise === 'function' && Promise.resolve) {
        Promise.resolve().then(schedule);
      } else {
        setTimeout(schedule, 0);
      }
    }
    if (answerBoxes.length) {
      setupAnswerBoxes(answerBoxes);
    }
    return hasContent;
  }

  global.MathVisDescriptionRenderer = {
    ensureKatexLoaded,
    parse,
    renderInto
  };
})(typeof window !== 'undefined' ? window : typeof globalThis !== 'undefined' ? globalThis : null);
