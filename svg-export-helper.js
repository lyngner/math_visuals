(function (global) {
  if (typeof global !== 'object' || !global) return;

  const helper = {};
  let toastStyleInjected = false;
  let toastContainer = null;

  function ensureToastStyle(doc) {
    if (toastStyleInjected) return;
    const style = doc.createElement('style');
    style.textContent = `
      .mathvis-toast-container {
        position: fixed;
        inset-inline-end: 16px;
        inset-block-end: 16px;
        display: flex;
        flex-direction: column;
        gap: 8px;
        z-index: 2147483647;
        max-width: min(320px, 80vw);
        pointer-events: none;
      }
      .mathvis-toast {
        background: rgba(31, 41, 55, 0.92);
        color: #f9fafb;
        padding: 12px 16px;
        border-radius: 8px;
        box-shadow: 0 10px 30px rgba(15, 23, 42, 0.35);
        font-family: "Inter", "Segoe UI", system-ui, sans-serif;
        font-size: 14px;
        line-height: 1.4;
        display: flex;
        align-items: flex-start;
        gap: 8px;
        pointer-events: auto;
      }
      .mathvis-toast--success {
        background: rgba(16, 185, 129, 0.92);
        color: #022c22;
      }
      .mathvis-toast--error {
        background: rgba(239, 68, 68, 0.92);
        color: #450a0a;
      }
      .mathvis-toast__dismiss {
        margin-inline-start: auto;
        background: transparent;
        border: none;
        color: inherit;
        font-size: 16px;
        cursor: pointer;
        line-height: 1;
      }
    `;
    doc.head.appendChild(style);
    toastStyleInjected = true;
  }

  function ensureToastContainer(doc) {
    if (toastContainer && toastContainer.isConnected) return toastContainer;
    toastContainer = doc.createElement('div');
    toastContainer.className = 'mathvis-toast-container';
    doc.body.appendChild(toastContainer);
    return toastContainer;
  }

  function showToast(message, type = 'info', options = {}) {
    const doc = global.document;
    if (!doc || !doc.body) return;
    ensureToastStyle(doc);
    const container = ensureToastContainer(doc);
    const toast = doc.createElement('div');
    toast.className = `mathvis-toast${type ? ` mathvis-toast--${type}` : ''}`;
    toast.setAttribute('role', 'status');
    toast.setAttribute('aria-live', 'polite');

    const content = doc.createElement('div');
    content.textContent = message;
    toast.appendChild(content);

    if (!options.sticky) {
      const dismiss = doc.createElement('button');
      dismiss.className = 'mathvis-toast__dismiss';
      dismiss.setAttribute('type', 'button');
      dismiss.setAttribute('aria-label', 'Lukk');
      dismiss.textContent = '×';
      dismiss.addEventListener('click', () => {
        if (toast.isConnected) toast.remove();
      });
      toast.appendChild(dismiss);
    }

    container.appendChild(toast);
    const timeout = Number.isFinite(options.duration) ? options.duration : 6000;
    if (!options.sticky) {
      setTimeout(() => {
        if (toast.isConnected) {
          toast.classList.add('mathvis-toast--closing');
          toast.remove();
        }
      }, timeout);
    }
    return toast;
  }

  function sanitizeBaseName(value, fallback = 'export') {
    if (typeof value !== 'string') return fallback;
    const trimmed = value.trim();
    if (!trimmed) return fallback;
    const noExt = trimmed.replace(/\.[^/.]+$/u, '');
    return noExt || fallback;
  }

  function slugify(input, fallback = 'export') {
    if (typeof input !== 'string') input = '';
    const normalized = input
      .normalize('NFKD')
      .replace(/\p{Diacritic}/gu, '')
      .replace(/[^\p{Letter}\p{Number}]+/gu, '-');
    const cleaned = normalized.replace(/^-+|-+$/g, '').toLowerCase();
    if (cleaned) return cleaned;
    return fallback.replace(/[^a-z0-9]+/gi, '-').replace(/^-+|-+$/g, '').toLowerCase() || 'export';
  }

  function withSvgFileSuffix(name) {
    return name.toLowerCase().endsWith('.svg') ? name : `${name}.svg`;
  }

  async function exportSvgWithArchive(svgElement, suggestedName, toolId, options = {}) {
    if (!svgElement) throw new Error('svgElement mangler');
    const doc = svgElement.ownerDocument || (typeof document !== 'undefined' ? document : null);
    if (!doc) throw new Error('document mangler');

    const serializer = options.serialize;
    let svgString;
    if (options.svgString != null) {
      svgString = await Promise.resolve(options.svgString);
    } else if (typeof serializer === 'function') {
      svgString = await Promise.resolve(serializer(svgElement));
    } else {
      svgString = new XMLSerializer().serializeToString(svgElement);
    }

    const description = typeof options.description === 'string' ? options.description.trim() : '';
    const slugInput = typeof options.slug === 'string' && options.slug ? options.slug : description;
    const fallbackSlugBase = sanitizeBaseName(suggestedName || toolId || 'export');
    const slug = slugify(slugInput, fallbackSlugBase);

    const baseSuggested = sanitizeBaseName(options.defaultBaseName || suggestedName || slug || toolId || 'export', fallbackSlugBase);
    const promptDefault = withSvgFileSuffix(baseSuggested);
    let finalName = promptDefault;
    if (typeof global.prompt === 'function') {
      const response = global.prompt('Filnavn for SVG-eksport', promptDefault);
      if (typeof response === 'string' && response.trim()) {
        const sanitized = sanitizeBaseName(response.trim(), baseSuggested);
        finalName = withSvgFileSuffix(sanitized);
      }
    }

    const blob = new Blob([svgString], {
      type: 'image/svg+xml;charset=utf-8'
    });
    const url = global.URL ? global.URL.createObjectURL(blob) : null;
    if (url) {
      const anchor = doc.createElement('a');
      anchor.href = url;
      anchor.download = finalName;
      doc.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      setTimeout(() => {
        if (global.URL) global.URL.revokeObjectURL(url);
      }, 1000);
    }

    const payload = {
      toolId: toolId || 'ukjent',
      filename: finalName,
      slug,
      description,
      summary: options.summary || null,
      createdAt: new Date().toISOString(),
      svg: svgString
    };

    let uploadPromise = null;
    if (typeof global.fetch === 'function') {
      uploadPromise = global.fetch('/api/svg', {
        method: 'POST',
        headers: {
          'content-type': 'application/json'
        },
        body: JSON.stringify(payload)
      });
      uploadPromise
        .then(response => {
          if (response && response.ok) {
            showToast(`SVG lastet ned og arkivert som ${finalName}.`, 'success');
          } else {
            const status = response ? response.status : 'ukjent';
            showToast(`SVG lastet ned, men arkivopplasting feilet (status ${status}).`, 'error');
          }
        })
        .catch(error => {
          const message = error && error.message ? error.message : String(error);
          showToast(`SVG lastet ned, men arkivopplasting feilet: ${message}.`, 'error');
        });
    } else {
      showToast(`SVG lastet ned som ${finalName}. (Arkivopplasting ikke tilgjengelig.)`, 'info');
    }

    return {
      filename: finalName,
      slug,
      description,
      uploadPromise
    };
  }

  helper.exportSvgWithArchive = exportSvgWithArchive;
  helper.slugify = slugify;
  helper.showToast = showToast;

  global.MathVisSvgExport = helper;
})(typeof window !== 'undefined' ? window : typeof globalThis !== 'undefined' ? globalThis : this);
