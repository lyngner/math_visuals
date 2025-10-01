(function (global) {
  const nsSvg = 'http://www.w3.org/2000/svg';

  function ensureSvgA11yNodes(svg) {
    if (!svg) {
      return { titleEl: null, descEl: null };
    }
    const doc = svg.ownerDocument || document;
    let titleEl = svg.querySelector('title');
    if (!titleEl) {
      titleEl = doc.createElementNS(nsSvg, 'title');
      svg.insertBefore(titleEl, svg.firstChild || null);
    }
    if (!titleEl.id) {
      const baseId = svg.id || 'figure';
      titleEl.id = `${baseId}-title`;
    }
    let descEl = svg.querySelector('desc');
    if (!descEl) {
      descEl = doc.createElementNS(nsSvg, 'desc');
      if (titleEl.nextSibling) {
        svg.insertBefore(descEl, titleEl.nextSibling);
      } else {
        svg.appendChild(descEl);
      }
    }
    if (!descEl.id) {
      const baseId = svg.id || 'figure';
      descEl.id = `${baseId}-desc`;
    }
    return { titleEl, descEl };
  }

  function createAltTextElements(container) {
    if (!container) return null;
    const existing = container.querySelector('.alt-text');
    if (existing) {
      const textarea = existing.querySelector('textarea');
      const button = existing.querySelector('button');
      const status = existing.querySelector('[role="status"]');
      if (textarea && button && status) {
        return { wrap: existing, textarea, button, status };
      }
    }

    const wrap = document.createElement('div');
    wrap.className = 'alt-text';

    const label = document.createElement('label');
    label.setAttribute('for', 'altText');
    label.textContent = 'Alternativ tekst';

    const textarea = document.createElement('textarea');
    textarea.id = 'altText';
    textarea.rows = 4;
    textarea.placeholder = 'Teksten genereres automatisk og kan endres ved behov.';

    const footer = document.createElement('div');
    footer.className = 'alt-text__footer';

    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'btn';
    button.id = 'btnRegenerateAltText';
    button.textContent = 'Generer på nytt';

    const status = document.createElement('span');
    status.id = 'altTextStatus';
    status.className = 'alt-text__status';
    status.setAttribute('role', 'status');
    status.setAttribute('aria-live', 'polite');

    footer.append(button, status);
    wrap.append(label, textarea, footer);
    container.appendChild(wrap);

    return { wrap, textarea, button, status };
  }

  function normalizeState(state) {
    if (!state || typeof state !== 'object') {
      return { text: '', source: 'auto' };
    }
    const text = typeof state.text === 'string' ? state.text : '';
    const source = state.source === 'manual' ? 'manual' : 'auto';
    return { text, source };
  }

  function createAltTextManager(options) {
    const {
      svg,
      container,
      getTitle,
      getState,
      setState,
      generate,
      getAutoMessage,
      getManualMessage
    } = options || {};

    if (!svg || !container || typeof getState !== 'function' || typeof setState !== 'function' || typeof generate !== 'function') {
      return null;
    }

    const svgSource = typeof svg === 'function' ? svg : () => svg;
    const els = createAltTextElements(container);
    if (!els) return null;
    const { textarea, button, status } = els;

    let generationTimer = null;

    function applyToSvg(text) {
      const targetSvg = svgSource();
      if (!targetSvg) return;
      const titleText = typeof getTitle === 'function' ? (getTitle() || '') : '';
      const descText = (text || '').trim();
      const { titleEl, descEl } = ensureSvgA11yNodes(targetSvg);
      const fallbackTitle = titleText.trim() || 'Figur';
      if (titleEl) titleEl.textContent = fallbackTitle;
      if (descEl) descEl.textContent = descText;
      targetSvg.setAttribute('role', 'img');
      targetSvg.setAttribute('aria-label', fallbackTitle);
      if (titleEl && titleEl.id) targetSvg.setAttribute('aria-labelledby', titleEl.id);
      if (descEl && descEl.id) targetSvg.setAttribute('aria-describedby', descEl.id);
    }

    function setStatus(message, isError) {
      if (!status) return;
      status.textContent = message || '';
      if (isError) {
        status.classList.add('alt-text__status--error');
      } else {
        status.classList.remove('alt-text__status--error');
      }
    }

    function setStateAndApply(text, source) {
      setState(text, source);
      if (textarea && textarea.value !== text) {
        textarea.value = text;
      }
      applyToSvg(text);
    }

    function autoGenerate(reason) {
      const next = (generate(reason) || '').trim();
      setStateAndApply(next, 'auto');
      const message = typeof getAutoMessage === 'function' ? getAutoMessage(reason) : 'Alternativ tekst oppdatert automatisk.';
      setStatus(message, false);
    }

    function scheduleAuto(reason = 'auto', delay = 600) {
      if (generationTimer) {
        clearTimeout(generationTimer);
        generationTimer = null;
      }
      generationTimer = setTimeout(() => {
        generationTimer = null;
        autoGenerate(reason);
      }, Math.max(0, delay));
    }

    function handleManualInput() {
      const raw = textarea.value;
      const trimmed = raw.trim();
      if (trimmed) {
        setStateAndApply(trimmed, 'manual');
        const msg = typeof getManualMessage === 'function' ? getManualMessage() : 'Alternativ tekst oppdatert manuelt.';
        setStatus(msg, false);
      } else {
        setStateAndApply('', 'auto');
        setStatus('Feltet er tomt. Genererer forslag …', false);
        scheduleAuto('manual-clear', 0);
      }
    }

    textarea.addEventListener('input', handleManualInput);
    button.addEventListener('click', () => {
      setStatus('Genererer forslag …', false);
      scheduleAuto('manual-regenerate', 0);
    });

    const initial = normalizeState(getState());
    textarea.value = initial.text;
    applyToSvg(initial.text);
    if (initial.text) {
      setStatus('', false);
    } else {
      scheduleAuto('init', 0);
    }

    return {
      refresh(reason) {
        const current = normalizeState(getState());
        if (current.source === 'manual' && current.text.trim()) {
          applyToSvg(current.text);
          return;
        }
        setStatus('Oppdaterer alternativ tekst …', false);
        scheduleAuto(reason || 'auto');
      },
      applyCurrent() {
        const current = normalizeState(getState());
        textarea.value = current.text;
        applyToSvg(current.text);
      },
      ensureDom() {
        return els.wrap;
      }
    };
  }

  global.MathVisAltText = {
    create: createAltTextManager,
    ensureSvgA11yNodes
  };
})(typeof window !== 'undefined' ? window : this);
