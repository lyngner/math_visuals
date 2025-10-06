(function attachMathVisDescriptionRenderer(global) {
  if (!global || typeof global !== 'object') return;
  const doc = global.document;
  if (!doc) return;

  const KATEX_VERSION = '0.16.9';
  const KATEX_CSS_ID = 'math-vis-katex-style';
  const KATEX_SCRIPT_ID = 'math-vis-katex-script';

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

  function appendTextWithMath(container, text, placeholders) {
    if (!container) return;
    if (typeof text !== 'string') return;
    if (text === '') {
      container.appendChild(doc.createTextNode(''));
      return;
    }
    const marker = '@math{';
    let index = 0;
    while (index < text.length) {
      const nextMath = text.indexOf(marker, index);
      const nextBreak = text.indexOf('\n', index);
      let nextIndex = text.length;
      let type = 'end';
      if (nextMath !== -1 && nextMath < nextIndex) {
        nextIndex = nextMath;
        type = 'math';
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
        const extraction = extractBalancedContent(text, nextIndex + marker.length);
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
      }
    }
  }

  function appendParagraphs(fragment, text, placeholders) {
    if (!fragment || typeof fragment.appendChild !== 'function') return;
    if (typeof text !== 'string') return;
    const normalized = text.replace(/\r\n?/g, '\n');
    const paragraphs = normalized.split(/\n{2,}/);
    paragraphs.forEach(paragraph => {
      if (!paragraph.trim()) return;
      const p = doc.createElement('p');
      appendTextWithMath(p, paragraph, placeholders);
      fragment.appendChild(p);
    });
  }

  function createDescriptionTable(content, placeholders) {
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
          appendTextWithMath(th, headerCandidate[i] != null ? headerCandidate[i] : '', placeholders);
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
        appendTextWithMath(td, row && row[i] != null ? row[i] : '', placeholders);
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

  function parse(value) {
    const fragment = doc.createDocumentFragment();
    const placeholders = [];
    if (typeof value !== 'string') {
      return { fragment, placeholders };
    }
    const normalized = value.replace(/\r\n?/g, '\n');
    const pattern = /@table\s*\{([\s\S]*?)\}/gi;
    let lastIndex = 0;
    let match = null;
    while ((match = pattern.exec(normalized)) !== null) {
      const before = normalized.slice(lastIndex, match.index);
      appendParagraphs(fragment, before, placeholders);
      const table = createDescriptionTable(match[1], placeholders);
      if (table) {
        fragment.appendChild(table);
      } else {
        appendParagraphs(fragment, match[0], placeholders);
      }
      lastIndex = pattern.lastIndex;
    }
    const after = normalized.slice(lastIndex);
    appendParagraphs(fragment, after, placeholders);
    return { fragment, placeholders };
  }

  function renderInto(target, value) {
    if (!target) return false;
    while (target.firstChild) {
      target.removeChild(target.firstChild);
    }
    const parsed = parse(typeof value === 'string' ? value : '');
    const fragment = parsed.fragment;
    const placeholders = parsed.placeholders;
    if (fragment) {
      target.appendChild(fragment);
    }
    const hasContent = !!(fragment && fragment.childNodes && fragment.childNodes.length);
    if (placeholders.length) {
      const schedule = () => {
        ensureKatexLoaded()
          .then(katex => {
            placeholders.forEach(({ element, tex }) => {
              if (!element || !tex && tex !== '') return;
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
    return hasContent;
  }

  global.MathVisDescriptionRenderer = {
    ensureKatexLoaded,
    parse,
    renderInto
  };
})(typeof window !== 'undefined' ? window : typeof globalThis !== 'undefined' ? globalThis : null);
