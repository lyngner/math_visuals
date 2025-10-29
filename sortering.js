(function () {
  const globalObj = typeof window !== 'undefined' ? window : typeof globalThis !== 'undefined' ? globalThis : null;
  const doc = globalObj && globalObj.document ? globalObj.document : null;
  if (!globalObj || !doc) return;

  const DESCRIPTION_RENDERER = globalObj.MathVisDescriptionRenderer || null;
  const SVG_NS = 'http://www.w3.org/2000/svg';
  const STATUS_SAMPLE_COUNT = 3;

  const statusNodes = {
    sorted: null,
    almost: null,
    first: null,
    last: null,
    order: null
  };

  let statusSection = null;
  let statusSnapshot = null;
  const statusListeners = new Set();

  let exportCard = null;
  let altTextManager = null;
  let altTextSvg = null;

  let checkButton = null;
  let checkStatus = null;
  let taskCheckHost = null;
  let taskCheckControls = [];
  let settingsForm = null;
  let directionSelect = null;
  let gapInput = null;
  let randomizeInput = null;
  let itemEditorList = null;
  let addItemButton = null;
  let itemEditorStatus = null;
  let saveExampleButton = null;
  let updateExampleButton = null;
  let deleteExampleButton = null;

  function ensureStringArray(list) {
    if (!Array.isArray(list)) return [];
    return list
      .map(entry => (typeof entry === 'string' ? entry.trim() : ''))
      .filter(entry => entry);
  }

  function isSorted(order, reference) {
    const a = ensureStringArray(order);
    const b = ensureStringArray(reference);
    if (a.length !== b.length) return false;
    for (let i = 0; i < a.length; i += 1) {
      if (a[i] !== b[i]) return false;
    }
    return true;
  }

  function firstN(order, count = STATUS_SAMPLE_COUNT) {
    const arr = ensureStringArray(order);
    const size = Number.isFinite(count) ? Math.max(0, Math.trunc(count)) : STATUS_SAMPLE_COUNT;
    const limit = Math.min(arr.length, size);
    return arr.slice(0, limit);
  }

  function lastN(order, count = STATUS_SAMPLE_COUNT) {
    const arr = ensureStringArray(order);
    const size = Number.isFinite(count) ? Math.max(0, Math.trunc(count)) : STATUS_SAMPLE_COUNT;
    if (size === 0) return [];
    const limit = Math.min(arr.length, size);
    return arr.slice(arr.length - limit);
  }

  function almost(order, reference) {
    const current = ensureStringArray(order);
    const expected = ensureStringArray(reference);
    const total = expected.length;
    const comparisons = Math.min(current.length, expected.length);
    const mismatches = [];
    let matches = 0;
    for (let i = 0; i < comparisons; i += 1) {
      const actualId = current[i];
      const expectedId = expected[i];
      if (actualId === expectedId) {
        matches += 1;
      } else {
        mismatches.push({ index: i, actual: actualId || null, expected: expectedId || null });
      }
    }
    for (let i = comparisons; i < expected.length; i += 1) {
      mismatches.push({ index: i, actual: null, expected: expected[i] || null });
    }
    for (let i = expected.length; i < current.length; i += 1) {
      mismatches.push({ index: i, actual: current[i] || null, expected: null });
    }
    const fraction = total > 0 ? matches / total : 1;
    const percent = total > 0 ? Math.round(fraction * 100) : 100;
    return {
      matches,
      total,
      fraction,
      percent,
      mismatches
    };
  }

  function cloneAlmostResult(result) {
    if (!result || typeof result !== 'object') {
      return { matches: 0, total: 0, fraction: 0, percent: 0, mismatches: [] };
    }
    const mismatches = Array.isArray(result.mismatches)
      ? result.mismatches.map(entry => ({
          index: Number.isFinite(entry.index) ? entry.index : -1,
          actual: typeof entry.actual === 'string' ? entry.actual : entry.actual == null ? null : String(entry.actual),
          expected:
            typeof entry.expected === 'string' ? entry.expected : entry.expected == null ? null : String(entry.expected)
        }))
      : [];
    return {
      matches: Number.isFinite(result.matches) ? result.matches : 0,
      total: Number.isFinite(result.total) ? result.total : 0,
      fraction: Number.isFinite(result.fraction) ? result.fraction : 0,
      percent: Number.isFinite(result.percent) ? result.percent : 0,
      mismatches
    };
  }

  function resetStatusNodes() {
    statusNodes.sorted = null;
    statusNodes.almost = null;
    statusNodes.first = null;
    statusNodes.last = null;
    statusNodes.order = null;
  }

  function getCurrentOrder() {
    return Array.isArray(currentOrder) ? currentOrder.slice() : [];
  }

  function getBaseOrder() {
    if (!state) return [];
    const sanitized = sanitizeOrder(state.items, state.order);
    if (state && Array.isArray(state.order)) {
      const differs = sanitized.length !== state.order.length || sanitized.some((id, index) => state.order[index] !== id);
      if (differs) {
        state.order = sanitized.slice();
      }
    }
    return sanitized;
  }

  function buildExampleConfigPayload() {
    const defaults = {
      items: [],
      order: [],
      config: {
        direction: DEFAULT_STATE.retning,
        gap: DEFAULT_STATE.gap,
        randomize: DEFAULT_STATE.randomisering
      }
    };
    if (!state) return defaults;
    return {
      items: state.items.map(cloneItem),
      order: sanitizeOrder(state.items, state.order),
      config: {
        direction: normalizeDirection(state.retning),
        gap: Number.isFinite(state.gap) ? state.gap : DEFAULT_STATE.gap,
        randomize: !!state.randomisering
      }
    };
  }

  function stringifyExamplePayload(payload) {
    try {
      return JSON.stringify(payload);
    } catch (error) {
      if (globalObj && globalObj.console && typeof globalObj.console.warn === 'function') {
        globalObj.console.warn('mathVisSortering: failed to stringify example payload', error);
      }
      return '';
    }
  }

  function updateExampleActionPayloads(payload) {
    const targetPayload = payload || buildExampleConfigPayload();
    const json = stringifyExamplePayload(targetPayload);
    const buttons = [saveExampleButton, updateExampleButton, deleteExampleButton].filter(Boolean);
    if (!buttons.length) return;
    buttons.forEach(button => {
      if (!button.dataset) return;
      if (json) {
        button.dataset.examplePayload = json;
        button.dataset.examplePayloadType = 'sortering';
      } else {
        delete button.dataset.examplePayload;
        delete button.dataset.examplePayloadType;
      }
    });
  }

  function syncExampleBindings() {
    if (!globalObj) return;
    if (!globalObj.STATE || typeof globalObj.STATE !== 'object') {
      globalObj.STATE = {};
    }
    globalObj.STATE.sortering = state;
    if (!globalObj.CONFIG || typeof globalObj.CONFIG !== 'object') {
      globalObj.CONFIG = {};
    }
    const payload = buildExampleConfigPayload();
    globalObj.CONFIG.sortering = payload;
    updateExampleActionPayloads(payload);
  }

  function computeStatusSnapshot() {
    const order = getCurrentOrder();
    const baseOrder = getBaseOrder();
    const sorted = isSorted(order, baseOrder);
    const almostResult = cloneAlmostResult(almost(order, baseOrder));
    const firstSegment = firstN(order, STATUS_SAMPLE_COUNT);
    const lastSegment = lastN(order, STATUS_SAMPLE_COUNT);
    return {
      timestamp: Date.now(),
      order,
      baseOrder,
      sorted,
      almost: almostResult,
      firstN: firstSegment,
      lastN: lastSegment
    };
  }

  function cloneSnapshot(snapshot) {
    if (!snapshot || typeof snapshot !== 'object') return null;
    return {
      timestamp: snapshot.timestamp,
      order: Array.isArray(snapshot.order) ? snapshot.order.slice() : [],
      baseOrder: Array.isArray(snapshot.baseOrder) ? snapshot.baseOrder.slice() : [],
      sorted: !!snapshot.sorted,
      almost: cloneAlmostResult(snapshot.almost),
      firstN: Array.isArray(snapshot.firstN) ? snapshot.firstN.slice() : [],
      lastN: Array.isArray(snapshot.lastN) ? snapshot.lastN.slice() : []
    };
  }

  function getItemDisplayLabel(id) {
    if (typeof id !== 'string' || !id) return '';
    const item = itemsById.get(id);
    if (!item) return id;
    const candidates = [item.label, item.alt, item.description, item.id];
    for (const candidate of candidates) {
      if (typeof candidate === 'string' && candidate.trim()) {
        return candidate.trim();
      }
    }
    return id;
  }

  function formatIdList(ids) {
    if (!Array.isArray(ids) || !ids.length) {
      return 'Ingen';
    }
    const labels = ids
      .map(id => getItemDisplayLabel(id))
      .filter(label => typeof label === 'string' && label.trim());
    if (!labels.length) {
      return ids.join(', ');
    }
    return labels.join(', ');
  }

  function formatAlmost(result) {
    if (!result || typeof result !== 'object') return '—';
    const matches = Number.isFinite(result.matches) ? result.matches : 0;
    const total = Number.isFinite(result.total) ? result.total : 0;
    if (total <= 0) {
      return matches > 0 ? `${matches}` : 'Ingen fasit';
    }
    const percent = Number.isFinite(result.percent) ? result.percent : Math.round((matches / total) * 100);
    return `${matches} av ${total} (${percent}%)`;
  }

  function createStatusSection() {
    const section = doc.createElement('section');
    section.className = 'sortering-status';
    const heading = doc.createElement('h3');
    heading.textContent = 'Status';
    section.appendChild(heading);
    const list = doc.createElement('dl');
    list.className = 'sortering-status__list';

    const rows = [
      { label: 'Sortert', key: 'sorted' },
      { label: 'Nesten', key: 'almost' },
      { label: 'Første', key: 'first' },
      { label: 'Siste', key: 'last' },
      { label: 'Rekkefølge', key: 'order' }
    ];

    rows.forEach(row => {
      const dt = doc.createElement('dt');
      dt.textContent = row.label;
      dt.className = 'sortering-status__term';
      const dd = doc.createElement('dd');
      dd.className = 'sortering-status__value';
      if (row.key) {
        dd.classList.add(`sortering-status__value--${row.key}`);
      }
      list.appendChild(dt);
      list.appendChild(dd);
      if (row.key && row.key in statusNodes) {
        statusNodes[row.key] = dd;
      }
    });

    section.appendChild(list);
    return section;
  }

  function ensureStatusSection(host) {
    if (!host) return;
    resetStatusNodes();
    if (statusSection && statusSection.parentNode) {
      statusSection.parentNode.removeChild(statusSection);
    }
    statusSection = createStatusSection();
    host.appendChild(statusSection);
  }

  function updateStatusUI(snapshot) {
    if (!snapshot) return;
    if (statusNodes.sorted) {
      statusNodes.sorted.textContent = snapshot.sorted ? 'Ja' : 'Nei';
    }
    if (statusNodes.almost) {
      statusNodes.almost.textContent = formatAlmost(snapshot.almost);
    }
    if (statusNodes.first) {
      statusNodes.first.textContent = formatIdList(snapshot.firstN);
    }
    if (statusNodes.last) {
      statusNodes.last.textContent = formatIdList(snapshot.lastN);
    }
    if (statusNodes.order) {
      statusNodes.order.textContent = formatIdList(snapshot.order);
    }
    if (statusSection) {
      statusSection.dataset.sorted = snapshot.sorted ? '1' : '0';
      if (snapshot.almost && Number.isFinite(snapshot.almost.matches)) {
        statusSection.dataset.matches = String(snapshot.almost.matches);
        statusSection.dataset.total = String(snapshot.almost.total);
        statusSection.dataset.percent = String(snapshot.almost.percent);
      } else {
        delete statusSection.dataset.matches;
        delete statusSection.dataset.total;
        delete statusSection.dataset.percent;
      }
    }
  }

  function updateFigureDataset(snapshot) {
    if (!figureHost || !snapshot) return;
    figureHost.dataset.sorted = snapshot.sorted ? '1' : '0';
    figureHost.dataset.order = Array.isArray(snapshot.order) ? snapshot.order.join(',') : '';
    if (snapshot.almost && Number.isFinite(snapshot.almost.matches)) {
      figureHost.dataset.matches = String(snapshot.almost.matches);
      figureHost.dataset.total = String(snapshot.almost.total);
      figureHost.dataset.percent = String(snapshot.almost.percent);
    } else {
      delete figureHost.dataset.matches;
      delete figureHost.dataset.total;
      delete figureHost.dataset.percent;
    }
  }

  function updateTaskCheckState(snapshot) {
    if (!snapshot) return;
    if (checkButton) {
      checkButton.dataset.sorted = snapshot.sorted ? '1' : '0';
      if (snapshot.almost && Number.isFinite(snapshot.almost.matches)) {
        checkButton.dataset.matches = String(snapshot.almost.matches);
        checkButton.dataset.total = String(snapshot.almost.total);
      } else {
        delete checkButton.dataset.matches;
        delete checkButton.dataset.total;
      }
    }
    if (checkStatus) {
      checkStatus.dataset.sorted = snapshot.sorted ? '1' : '0';
    }
    if (taskCheckHost) {
      taskCheckHost.dataset.sorted = snapshot.sorted ? '1' : '0';
      taskCheckHost.dataset.order = Array.isArray(snapshot.order) ? snapshot.order.join(',') : '';
      if (snapshot.almost && Number.isFinite(snapshot.almost.matches)) {
        taskCheckHost.dataset.matches = String(snapshot.almost.matches);
        taskCheckHost.dataset.total = String(snapshot.almost.total);
        taskCheckHost.dataset.percent = String(snapshot.almost.percent);
      } else {
        delete taskCheckHost.dataset.matches;
        delete taskCheckHost.dataset.total;
        delete taskCheckHost.dataset.percent;
      }
    }
  }

  function dispatchStatusEvent(snapshot, reason) {
    if (!globalObj || typeof globalObj.dispatchEvent !== 'function' || typeof globalObj.CustomEvent !== 'function') {
      return;
    }
    const detail = cloneSnapshot(snapshot);
    if (!detail) return;
    detail.reason = reason || 'update';
    try {
      globalObj.dispatchEvent(new globalObj.CustomEvent('math-vis-sortering:update', { detail }));
    } catch (_) {}
  }

  function emitStatusToListeners(snapshot, reason) {
    if (!snapshot) return;
    const payload = cloneSnapshot(snapshot);
    if (!payload) return;
    payload.reason = reason || 'update';
    Array.from(statusListeners).forEach(listener => {
      if (typeof listener !== 'function') return;
      try {
        listener(payload);
      } catch (error) {
        if (globalObj && typeof globalObj.console !== 'undefined' && typeof globalObj.console.error === 'function') {
          globalObj.console.error('mathVisSortering listener error', error);
        }
      }
    });
  }

  function getStatusSnapshot(forceRecompute = false) {
    if (forceRecompute || !statusSnapshot) {
      statusSnapshot = computeStatusSnapshot();
    }
    return statusSnapshot;
  }

  function getStatusSnapshotClone(forceRecompute = false) {
    return cloneSnapshot(getStatusSnapshot(forceRecompute));
  }

  function notifyStatusChange(reason) {
    const snapshot = getStatusSnapshot(true);
    syncExampleBindings();
    updateStatusUI(snapshot);
    updateFigureDataset(snapshot);
    updateTaskCheckState(snapshot);
    clearCheckStatus();
    emitStatusToListeners(snapshot, reason);
    dispatchStatusEvent(snapshot, reason);
    refreshAltText(reason, snapshot);
  }

  function registerMathVisApi() {
    if (!globalObj) return null;
    const existing = globalObj.mathVisSortering && typeof globalObj.mathVisSortering === 'object' ? globalObj.mathVisSortering : null;
    const api = existing || {};
    api.getState = () => getStatusSnapshotClone();
    api.isSorted = (order, reference) => {
      const current = Array.isArray(order) ? order : getCurrentOrder();
      const base = Array.isArray(reference) ? reference : getBaseOrder();
      return isSorted(current, base);
    };
    api.firstN = (order, count) => {
      const current = Array.isArray(order) ? order : getCurrentOrder();
      return firstN(current, count);
    };
    api.lastN = (order, count) => {
      const current = Array.isArray(order) ? order : getCurrentOrder();
      return lastN(current, count);
    };
    api.almost = (order, reference) => {
      const current = Array.isArray(order) ? order : getCurrentOrder();
      const base = Array.isArray(reference) ? reference : getBaseOrder();
      return cloneAlmostResult(almost(current, base));
    };
    api.onChange = callback => {
      if (typeof callback !== 'function') return () => {};
      statusListeners.add(callback);
      if (statusSnapshot) {
        try {
          const payload = cloneSnapshot(statusSnapshot);
          if (payload) {
            payload.reason = 'listener-init';
            callback(payload);
          }
        } catch (error) {
          if (globalObj && globalObj.console && typeof globalObj.console.error === 'function') {
            globalObj.console.error('mathVisSortering onChange init error', error);
          }
        }
      }
      return () => {
        statusListeners.delete(callback);
      };
    };
    api.offChange = callback => {
      if (typeof callback !== 'function') return;
      statusListeners.delete(callback);
    };
    api.subscribe = api.onChange;
    api.unsubscribe = api.offChange;
    globalObj.mathVisSortering = api;
    if (globalObj.mathVisuals && typeof globalObj.mathVisuals === 'object') {
      globalObj.mathVisuals.sortering = api;
    }
    return api;
  }

  function ensureAltTextSvg() {
    if (altTextSvg && altTextSvg.ownerDocument === doc) {
      return altTextSvg;
    }
    if (!figureHost) return null;
    const svg = doc.createElementNS(SVG_NS, 'svg');
    svg.classList.add('sortering__alt-svg');
    svg.setAttribute('aria-hidden', 'true');
    svg.setAttribute('focusable', 'false');
    svg.setAttribute('width', '0');
    svg.setAttribute('height', '0');
    svg.style.position = 'absolute';
    svg.style.width = '0';
    svg.style.height = '0';
    svg.style.overflow = 'hidden';
    figureHost.appendChild(svg);
    altTextSvg = svg;
    return svg;
  }

  function buildAltText(snapshot) {
    const stateSnapshot = snapshot || getStatusSnapshot();
    if (!stateSnapshot) return '';
    const labels = Array.isArray(stateSnapshot.order)
      ? stateSnapshot.order.map(id => getItemDisplayLabel(id)).filter(Boolean)
      : [];
    const parts = [];
    if (labels.length === 0) {
      parts.push('Ingen elementer er tilgjengelige.');
    } else {
      parts.push(stateSnapshot.sorted ? 'Elementene er sortert.' : 'Elementene er ikke sortert.');
      parts.push(`Rekkefølgen er ${labels.join(', ')}.`);
      if (stateSnapshot.almost && Number.isFinite(stateSnapshot.almost.total) && stateSnapshot.almost.total > 0) {
        parts.push(`${stateSnapshot.almost.matches} av ${stateSnapshot.almost.total} elementer står på riktig plass.`);
      }
    }
    return parts.join(' ');
  }

  function buildAltTextSignature(snapshot) {
    const stateSnapshot = snapshot || getStatusSnapshot();
    if (!stateSnapshot) return '';
    try {
      return JSON.stringify({
        order: Array.isArray(stateSnapshot.order) ? stateSnapshot.order : [],
        sorted: !!stateSnapshot.sorted,
        matches: stateSnapshot.almost ? stateSnapshot.almost.matches : 0,
        total: stateSnapshot.almost ? stateSnapshot.almost.total : 0
      });
    } catch (_) {
      return `${stateSnapshot.sorted ? '1' : '0'}:${Array.isArray(stateSnapshot.order) ? stateSnapshot.order.join('|') : ''}`;
    }
  }

  function ensureAltTextManager() {
    if (altTextManager || !globalObj || !globalObj.MathVisAltText || !exportCard) return;
    const svg = ensureAltTextSvg();
    if (!svg) return;
    altTextManager = globalObj.MathVisAltText.create({
      svg,
      container: exportCard,
      getTitle: () => (doc && doc.title ? doc.title : 'Sortering'),
      getState: () => ({
        text: state && typeof state.altText === 'string' ? state.altText : '',
        source: state && state.altTextSource === 'manual' ? 'manual' : 'auto'
      }),
      setState: (text, source) => {
        if (!state) return;
        state.altText = typeof text === 'string' ? text : '';
        state.altTextSource = source === 'manual' ? 'manual' : 'auto';
      },
      generate: () => buildAltText(),
      getSignature: () => buildAltTextSignature(),
      getAutoMessage: reason =>
        reason && reason.startsWith('manual') ? 'Alternativ tekst oppdatert.' : 'Alternativ tekst oppdatert automatisk.',
      getManualMessage: () => 'Alternativ tekst oppdatert manuelt.'
    });
    if (altTextManager && typeof altTextManager.applyCurrent === 'function') {
      altTextManager.applyCurrent();
    }
  }

  function refreshAltText(reason, snapshot) {
    if (!globalObj || !globalObj.MathVisAltText) return;
    ensureAltTextManager();
    const signature = buildAltTextSignature(snapshot);
    const description = buildAltText(snapshot);
    if (altTextManager && typeof altTextManager.refresh === 'function') {
      altTextManager.refresh(reason || 'auto', signature);
    } else if (altTextManager && typeof altTextManager.notifyFigureChange === 'function') {
      altTextManager.notifyFigureChange(signature);
    } else {
      const svg = ensureAltTextSvg();
      if (!svg) return;
      const nodes = globalObj.MathVisAltText.ensureSvgA11yNodes(svg);
      if (nodes && nodes.descEl) {
        nodes.descEl.textContent = description;
      }
      if (nodes && nodes.titleEl) {
        nodes.titleEl.textContent = doc && doc.title ? doc.title : 'Sortering';
      }
    }
  }

  function setCheckStatus(type, heading, detailLines) {
    if (!checkStatus) return;
    if (!type) {
      checkStatus.hidden = true;
      checkStatus.className = 'status';
      checkStatus.textContent = '';
      return;
    }
    checkStatus.hidden = false;
    checkStatus.className = `status status--${type}`;
    checkStatus.textContent = '';
    if (heading) {
      const strong = doc.createElement('strong');
      strong.textContent = heading;
      checkStatus.appendChild(strong);
    }
    if (Array.isArray(detailLines) && detailLines.length) {
      detailLines.forEach(line => {
        if (!line) return;
        const div = doc.createElement('div');
        div.textContent = line;
        checkStatus.appendChild(div);
      });
    }
  }

  function clearCheckStatus() {
    if (!checkStatus || checkStatus.hidden) return;
    setCheckStatus(null);
  }

  function ensureTaskControlsAppended() {
    if (!taskCheckHost) return;
    taskCheckControls.forEach(control => {
      if (control && control.parentElement !== taskCheckHost) {
        taskCheckHost.appendChild(control);
      }
    });
  }

  function applyAppModeToTaskControls(mode) {
    if (!taskCheckHost) return;
    const normalized = typeof mode === 'string' ? mode.toLowerCase() : '';
    const isTaskMode = normalized === 'task';
    if (isTaskMode) {
      ensureTaskControlsAppended();
      taskCheckHost.hidden = false;
      taskCheckControls.forEach(control => {
        if (!control) return;
        if (control === checkButton) {
          control.hidden = false;
          if (control.dataset) delete control.dataset.prevHidden;
          return;
        }
        if (control.dataset && 'prevHidden' in control.dataset) {
          const wasHidden = control.dataset.prevHidden === '1';
          delete control.dataset.prevHidden;
          control.hidden = wasHidden;
        }
      });
    } else {
      taskCheckHost.hidden = true;
      taskCheckControls.forEach(control => {
        if (!control) return;
        if (control.dataset) {
          control.dataset.prevHidden = control.hidden ? '1' : '0';
        }
        control.hidden = true;
      });
    }
  }

  function getCurrentAppMode() {
    if (typeof globalObj === 'undefined') return 'default';
    const mv = globalObj.mathVisuals;
    if (mv && typeof mv.getAppMode === 'function') {
      try {
        const mode = mv.getAppMode();
        if (typeof mode === 'string' && mode.trim()) {
          return mode;
        }
      } catch (_) {}
    }
    try {
      const params = new URLSearchParams(globalObj.location && globalObj.location.search ? globalObj.location.search : '');
      const fromQuery = params.get('mode');
      if (typeof fromQuery === 'string' && fromQuery.trim()) {
        return fromQuery.trim().toLowerCase() === 'task' ? 'task' : 'default';
      }
    } catch (_) {}
    return 'default';
  }

  function handleAppModeChanged(event) {
    if (!event || !event.detail || typeof event.detail.mode !== 'string') return;
    applyAppModeToTaskControls(event.detail.mode);
  }

  function evaluateDescriptionInputs() {
    if (!globalObj) return;
    const mv = globalObj.mathVisuals;
    if (!mv || typeof mv.evaluateTaskInputs !== 'function') return;
    try {
      mv.evaluateTaskInputs();
    } catch (_) {}
  }

  function handleCheckButtonClick() {
    evaluateDescriptionInputs();
    runTaskCheck();
  }

  function runTaskCheck() {
    const snapshot = getStatusSnapshot();
    if (!snapshot) {
      setCheckStatus('info', 'Ingen fasit er definert ennå.');
      return;
    }
    if (!Array.isArray(snapshot.baseOrder) || snapshot.baseOrder.length === 0) {
      setCheckStatus('info', 'Ingen fasit er definert ennå.');
      return;
    }
    if (snapshot.sorted) {
      setCheckStatus('success', 'Riktig rekkefølge!');
      return;
    }
    const details = [];
    if (snapshot.almost && Number.isFinite(snapshot.almost.total) && snapshot.almost.total > 0) {
      details.push(`${snapshot.almost.matches} av ${snapshot.almost.total} elementer står riktig.`);
    }
    setCheckStatus('error', 'Ikke helt riktig ennå.', details);
  }

  registerMathVisApi();

  const ITEM_FORMATS = ['text', 'katex', 'asset'];

  function detectItemFormat(source) {
    if (!source || typeof source !== 'object') return 'text';
    if (typeof source.format === 'string' && ITEM_FORMATS.includes(source.format)) {
      return source.format;
    }
    if (typeof source.asset === 'string' && source.asset.trim()) {
      return 'asset';
    }
    if (typeof source.description === 'string' && source.description.trim()) {
      return 'katex';
    }
    return 'text';
  }

  function determineItemFormat(item) {
    if (!item || typeof item !== 'object') return 'text';
    if (typeof item.format === 'string' && ITEM_FORMATS.includes(item.format)) {
      return item.format;
    }
    return detectItemFormat(item);
  }

  function ensureItemFormat(item) {
    if (!item || typeof item !== 'object') return;
    const format = determineItemFormat(item);
    item.format = format;
    if (typeof item.label !== 'string') item.label = '';
    if (typeof item.alt !== 'string') item.alt = '';
    if (format === 'asset') {
      if (typeof item.asset !== 'string') item.asset = '';
      item.description = '';
    } else if (format === 'katex') {
      if (typeof item.description !== 'string') item.description = '';
      item.asset = '';
    } else {
      item.asset = '';
      item.description = '';
      if (typeof item.label !== 'string') item.label = '';
    }
  }

  function normalizeItem(raw, index) {
    const source = raw && typeof raw === 'object' ? raw : {};
    let id = typeof source.id === 'string' && source.id.trim() ? source.id.trim() : '';
    if (!id) {
      id = `item-${index + 1}`;
    }

    const descriptionCandidates = [source.description, source.text, source.content, source.label];
    let description = '';
    for (const candidate of descriptionCandidates) {
      if (typeof candidate === 'string' && candidate.trim()) {
        description = candidate.trim();
        break;
      }
    }

    const labelCandidates = [source.label, source.alt, description, source.id];
    let label = '';
    for (const candidate of labelCandidates) {
      if (typeof candidate === 'string' && candidate.trim()) {
        label = candidate.trim();
        break;
      }
    }

    const assetCandidates = [source.asset, source.svg, source.image];
    let asset = null;
    for (const candidate of assetCandidates) {
      if (typeof candidate === 'string' && candidate.trim()) {
        asset = candidate.trim();
        break;
      }
    }

    const altCandidates = [source.alt, label, description];
    let alt = '';
    for (const candidate of altCandidates) {
      if (typeof candidate === 'string' && candidate.trim()) {
        alt = candidate.trim();
        break;
      }
    }

    const format = detectItemFormat(source);

    return {
      id,
      description,
      label,
      asset,
      alt,
      format
    };
  }

  function buildItems(rawItems) {
    const list = Array.isArray(rawItems) ? rawItems : [];
    const seen = new Set();
    return list.map((entry, index) => {
      const normalized = normalizeItem(entry, index);
      let { id } = normalized;
      if (!id) {
        id = `item-${index + 1}`;
        normalized.id = id;
      }
      if (seen.has(id)) {
        let suffix = 2;
        let candidateId = `${id}-${suffix}`;
        while (seen.has(candidateId)) {
          suffix += 1;
          candidateId = `${id}-${suffix}`;
        }
        normalized.id = candidateId;
        seen.add(candidateId);
      } else {
        seen.add(id);
      }
      ensureItemFormat(normalized);
      return normalized;
    });
  }

  function cloneItem(item) {
    if (!item || typeof item !== 'object') return item;
    return {
      id: item.id,
      description: item.description,
      label: item.label,
      asset: item.asset,
      alt: item.alt,
      format: item.format
    };
  }

  function sanitizeOrder(items, order) {
    const idSet = new Set(items.map(item => item.id));
    const seen = new Set();
    const result = [];
    if (Array.isArray(order)) {
      order.forEach(id => {
        if (typeof id !== 'string') return;
        if (!idSet.has(id) || seen.has(id)) return;
        seen.add(id);
        result.push(id);
      });
    }
    items.forEach(item => {
      if (seen.has(item.id)) return;
      seen.add(item.id);
      result.push(item.id);
    });
    return result;
  }

  function shuffle(values) {
    const arr = Array.isArray(values) ? values.slice() : [];
    for (let i = arr.length - 1; i > 0; i -= 1) {
      const j = Math.floor(Math.random() * (i + 1));
      const tmp = arr[i];
      arr[i] = arr[j];
      arr[j] = tmp;
    }
    return arr;
  }

  function normalizeDirection(value) {
    if (typeof value === 'string') {
      const normalized = value.trim().toLowerCase();
      if (normalized === 'vertikal' || normalized === 'vertical') {
        return 'vertikal';
      }
    }
    return 'horisontal';
  }

  function parseNumber(value) {
    if (typeof value === 'number' && Number.isFinite(value)) return value;
    if (typeof value === 'string') {
      const normalized = value.replace(',', '.').trim();
      if (!normalized) return NaN;
      const parsed = Number.parseFloat(normalized);
      return Number.isFinite(parsed) ? parsed : NaN;
    }
    return NaN;
  }

  function normalizeGap(value, fallback) {
    const parsed = parseNumber(value);
    if (!Number.isFinite(parsed)) {
      return fallback;
    }
    return Math.max(0, parsed);
  }

  function buildButtonLabel(item, position) {
    if (item && typeof item.label === 'string' && item.label.trim()) {
      return item.label.trim();
    }
    if (item && typeof item.alt === 'string' && item.alt.trim()) {
      return item.alt.trim();
    }
    if (item && typeof item.description === 'string' && item.description.trim()) {
      return item.description.trim();
    }
    const idx = Number.isFinite(position) ? position + 1 : 0;
    return idx > 0 ? `Element ${idx}` : 'Element';
  }

  const DEFAULT_RAW_ITEMS = [
    { id: 'item-1', description: '\\frac{1}{2}', label: '1/2', alt: 'En halv' },
    { id: 'item-2', description: '\\sqrt{16}', label: '√16', alt: 'Kvadratroten av seksten' },
    { id: 'item-3', description: '7', label: '7', alt: 'Sju' },
    { id: 'item-4', asset: 'images/greenStar.svg', label: 'Grønn stjerne', alt: 'Grønn stjerne' }
  ];

  const DEFAULT_ITEMS = buildItems(DEFAULT_RAW_ITEMS);
  const DEFAULT_STATE = {
    items: DEFAULT_ITEMS.map(cloneItem),
    order: DEFAULT_ITEMS.map(item => item.id),
    retning: 'horisontal',
    gap: 32,
    randomisering: false,
    altText: '',
    altTextSource: 'auto'
  };

  let state = null;
  let currentOrder = [];
  const itemNodes = new Map();
  const itemsById = new Map();
  let visualList = null;
  let accessibleList = null;
  let figureHost = null;
  let keyboardActiveId = null;
  const keyboardHandlers = new Map();
  let dragState = null;
  const itemEditorDragState = {
    activeId: null,
    dropTargetEl: null,
    originIndex: -1
  };

  function refreshItemsById() {
    itemsById.clear();
    if (!state || !Array.isArray(state.items)) return;
    state.items.forEach(item => {
      if (!item || typeof item !== 'object' || !item.id) return;
      ensureItemFormat(item);
      itemsById.set(item.id, item);
    });
  }

  function generateItemId() {
    const used = new Set();
    if (state && Array.isArray(state.items)) {
      state.items.forEach(item => {
        if (item && typeof item.id === 'string') {
          used.add(item.id);
        }
      });
    }
    let index = used.size + 1;
    let candidate = `item-${index}`;
    while (used.has(candidate)) {
      index += 1;
      candidate = `item-${index}`;
    }
    return candidate;
  }

  function ensureItemNodes(item) {
    if (!item || !item.id) return null;
    if (itemNodes.has(item.id)) {
      return itemNodes.get(item.id);
    }
    const wrapper = doc.createElement('div');
    wrapper.className = 'sortering__item';
    wrapper.dataset.itemId = item.id;

    const contentEl = doc.createElement('div');
    contentEl.className = 'sortering__item-content';
    wrapper.appendChild(contentEl);

    const li = doc.createElement('li');
    li.className = 'sortering__skia-item';
    li.dataset.itemId = item.id;

    const button = doc.createElement('button');
    button.type = 'button';
    button.className = 'sortering__skia-button';
    button.dataset.itemId = item.id;
    li.appendChild(button);

    const nodes = { wrapper, contentEl, li, button };
    itemNodes.set(item.id, nodes);
    attachItemListeners(item.id, nodes);
    return nodes;
  }

  function renderItem(item, position) {
    if (!item) return null;
    const nodes = ensureItemNodes(item);
    if (!nodes) return null;

    const { wrapper, contentEl, li, button } = nodes;
    const label = buildButtonLabel(item, position);
    const accessibleLabel = item && typeof item.alt === 'string' && item.alt.trim() ? item.alt.trim() : label;

    wrapper.dataset.itemId = item.id;
    wrapper.dataset.position = Number.isFinite(position) ? String(position + 1) : '';

    while (contentEl.firstChild) {
      contentEl.removeChild(contentEl.firstChild);
    }

    if (item.asset) {
      const img = doc.createElement('img');
      img.src = item.asset;
      img.alt = accessibleLabel || label || '';
      img.loading = 'lazy';
      img.decoding = 'async';
      img.className = 'sortering__item-image';
      contentEl.appendChild(img);
    }

    if (item.description) {
      const descriptionEl = doc.createElement('div');
      descriptionEl.className = 'sortering__item-description';
      if (DESCRIPTION_RENDERER && typeof DESCRIPTION_RENDERER.renderInto === 'function') {
        DESCRIPTION_RENDERER.renderInto(descriptionEl, item.description);
      } else {
        descriptionEl.textContent = item.description;
      }
      contentEl.appendChild(descriptionEl);
    } else if (!item.asset && label) {
      contentEl.textContent = label;
    }

    li.dataset.itemId = item.id;
    li.dataset.position = Number.isFinite(position) ? String(position + 1) : '';

    button.dataset.itemId = item.id;
    button.dataset.position = Number.isFinite(position) ? String(position + 1) : '';
    button.textContent = label;
    if (accessibleLabel && accessibleLabel !== label) {
      button.setAttribute('aria-label', accessibleLabel);
    } else if (accessibleLabel) {
      button.setAttribute('aria-label', accessibleLabel);
    } else {
      button.removeAttribute('aria-label');
    }
    if (accessibleLabel) {
      button.title = accessibleLabel;
    } else {
      button.removeAttribute('title');
    }

    return nodes;
  }

  function syncVisualOrder() {
    if (!visualList) return;
    currentOrder.forEach((id, index) => {
      const nodes = itemNodes.get(id);
      if (!nodes || !nodes.wrapper) return;
      const expectedNode = visualList.children[index];
      if (expectedNode !== nodes.wrapper) {
        visualList.insertBefore(nodes.wrapper, expectedNode || null);
      }
    });
  }

  function syncAccessibleOrder() {
    if (!accessibleList) return;
    const fragment = doc.createDocumentFragment();
    currentOrder.forEach(id => {
      const nodes = itemNodes.get(id);
      if (!nodes || !nodes.li) return;
      fragment.appendChild(nodes.li);
    });
    accessibleList.appendChild(fragment);
  }

  function updateItemPositions() {
    const size = currentOrder.length;
    currentOrder.forEach((id, index) => {
      const nodes = itemNodes.get(id);
      if (!nodes) return;
      const pos = index + 1;
      if (nodes.wrapper) {
        nodes.wrapper.dataset.position = String(pos);
      }
      if (nodes.li) {
        nodes.li.dataset.position = String(pos);
        nodes.li.setAttribute('aria-posinset', String(pos));
        nodes.li.setAttribute('aria-setsize', String(size));
      }
      if (nodes.button) {
        nodes.button.dataset.position = String(pos);
        nodes.button.setAttribute('aria-posinset', String(pos));
        nodes.button.setAttribute('aria-setsize', String(size));
      }
    });

    syncVisualOrder();
    syncAccessibleOrder();
  }

  function snapToSlot(targetId) {
    const ids = typeof targetId === 'string' ? [targetId] : currentOrder.slice();
    ids.forEach(id => {
      const nodes = itemNodes.get(id);
      if (!nodes || !nodes.wrapper) return;
      const { wrapper } = nodes;
      wrapper.style.transition = '';
      wrapper.style.transform = '';
      wrapper.classList.remove('sortering__item--dragging');
    });
  }

  function finalizeKeyboardMode(options = {}) {
    const { restoreFocus = false } = options;
    if (!keyboardActiveId) return;
    const id = keyboardActiveId;
    const nodes = itemNodes.get(id);
    const handler = keyboardHandlers.get(id);
    if (nodes && handler) {
      nodes.button.removeEventListener('keydown', handler);
    }
    keyboardHandlers.delete(id);
    keyboardActiveId = null;
    if (nodes) {
      nodes.wrapper.classList.remove('sortering__item--active');
      nodes.button.classList.remove('sortering__skia-button--active');
      nodes.button.removeAttribute('aria-pressed');
      if (restoreFocus) {
        nodes.button.focus();
      }
    }
  }

  function clearVisualMarkers() {
    finalizeKeyboardMode();
    itemNodes.forEach(nodes => {
      if (nodes.wrapper) {
        nodes.wrapper.classList.remove('sortering__item--dragging');
        nodes.wrapper.classList.remove('sortering__item--active');
      }
      if (nodes.button) {
        nodes.button.classList.remove('sortering__skia-button--active');
        nodes.button.removeAttribute('aria-pressed');
      }
    });
  }

  function moveItemToIndex(id, targetIndex, options = {}) {
    if (!state || !currentOrder.length) return false;
    const { preserveTransform = false } = options;
    const currentIndex = currentOrder.indexOf(id);
    if (currentIndex < 0) return false;
    const maxIndex = currentOrder.length - 1;
    const boundedIndex = Math.max(0, Math.min(maxIndex, targetIndex));
    if (boundedIndex === currentIndex) return false;
    currentOrder.splice(currentIndex, 1);
    currentOrder.splice(boundedIndex, 0, id);

    updateItemPositions();
    if (!preserveTransform) {
      snapToSlot(id);
    }
    notifyStatusChange('move');
    return true;
  }

  function swapWith(id, offset, options = {}) {
    if (!Number.isFinite(offset) || !offset) return false;
    const idx = currentOrder.indexOf(id);
    if (idx < 0) return false;
    return moveItemToIndex(id, idx + offset, options);
  }

  function handleKeyboardInteraction(event, id) {
    if (!state || keyboardActiveId !== id) return;
    if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') {
      event.preventDefault();
      const moved = swapWith(id, -1);
      if (moved) {
        snapToSlot();
      }
    } else if (event.key === 'ArrowRight' || event.key === 'ArrowDown') {
      event.preventDefault();
      const moved = swapWith(id, 1);
      if (moved) {
        snapToSlot();
      }
    } else if (event.key === 'Enter' || event.key === 'Escape') {
      event.preventDefault();
      snapToSlot();
      updateItemPositions();
      finalizeKeyboardMode({ restoreFocus: event.key === 'Enter' });
    }
  }

  function activateKeyboardMode(id) {
    if (!id) return;
    if (keyboardActiveId === id) return;
    finalizeKeyboardMode();
    const nodes = itemNodes.get(id);
    if (!nodes) return;
    keyboardActiveId = id;
    nodes.wrapper.classList.add('sortering__item--active');
    nodes.button.classList.add('sortering__skia-button--active');
    nodes.button.setAttribute('aria-pressed', 'true');
    const handler = event => handleKeyboardInteraction(event, id);
    keyboardHandlers.set(id, handler);
    nodes.button.addEventListener('keydown', handler);
  }

  function collectSwapSlots(activeId, orientation) {
    if (!currentOrder.length) return [];
    const slots = [];
    currentOrder.forEach(candidateId => {
      if (candidateId === activeId) return;
      const candidateNodes = itemNodes.get(candidateId);
      if (!candidateNodes || !candidateNodes.wrapper) return;
      const rect = candidateNodes.wrapper.getBoundingClientRect();
      const size = orientation === 'vertikal' ? rect.height : rect.width;
      const center = orientation === 'vertikal' ? rect.top + rect.height / 2 : rect.left + rect.width / 2;
      slots.push({ id: candidateId, center, size });
    });
    return slots.sort((a, b) => a.center - b.center);
  }

  function determineDragTargetIndex(activeId, pointerCoord, orientation, slotsOverride) {
    const slots = Array.isArray(slotsOverride) ? slotsOverride : collectSwapSlots(activeId, orientation);
    if (!slots.length || !Number.isFinite(pointerCoord)) {
      return 0;
    }
    const gapValue = state && Number.isFinite(state.gap) ? Number(state.gap) : 0;
    const halfGap = gapValue / 2;
    const first = slots[0];
    const last = slots[slots.length - 1];
    const startEdge = first.center - first.size / 2 - halfGap;
    if (pointerCoord <= startEdge) {
      return 0;
    }
    for (let i = 1; i < slots.length; i += 1) {
      const prev = slots[i - 1];
      const current = slots[i];
      const midpoint = (prev.center + current.center) / 2;
      if (pointerCoord <= midpoint) {
        return i;
      }
    }
    const endEdge = last.center + last.size / 2 + halfGap;
    if (pointerCoord >= endEdge) {
      return slots.length;
    }
    return slots.length;
  }

  function getOrderSignature() {
    return currentOrder.join('|');
  }

  function refreshDragSlotCache(orientation) {
    if (!dragState) {
      return [];
    }
    const slots = collectSwapSlots(dragState.id, orientation);
    dragState.slotCache = slots;
    dragState.slotCacheOrientation = orientation;
    dragState.slotCacheSignature = getOrderSignature();
    dragState.slotCacheDirty = false;
    return slots;
  }

  function ensureDragSlotCache(orientation) {
    if (!dragState) {
      return [];
    }
    const signature = getOrderSignature();
    if (
      !Array.isArray(dragState.slotCache) ||
      dragState.slotCacheOrientation !== orientation ||
      dragState.slotCacheSignature !== signature ||
      dragState.slotCacheDirty
    ) {
      return refreshDragSlotCache(orientation);
    }
    return dragState.slotCache;
  }

  function cancelDragMeasurement(targetState) {
    const stateToClear = targetState || dragState;
    if (!stateToClear || stateToClear.measurementHandle == null) {
      return;
    }
    if (stateToClear.measurementHandleType === 'raf' && typeof globalObj.cancelAnimationFrame === 'function') {
      globalObj.cancelAnimationFrame(stateToClear.measurementHandle);
    } else if (stateToClear.measurementHandleType === 'timeout' && typeof globalObj.clearTimeout === 'function') {
      globalObj.clearTimeout(stateToClear.measurementHandle);
    }
    stateToClear.measurementHandle = null;
    stateToClear.measurementHandleType = null;
  }

  function performDragMeasurement() {
    if (!dragState) {
      return;
    }
    const nodes = itemNodes.get(dragState.id);
    if (!nodes || !nodes.wrapper) {
      return;
    }
    const { wrapper } = nodes;
    wrapper.style.transform = '';
    const rect = wrapper.getBoundingClientRect();
    const baseCenterX = rect.left + rect.width / 2;
    const baseCenterY = rect.top + rect.height / 2;
    dragState.baseCenterX = baseCenterX;
    dragState.baseCenterY = baseCenterY;
    const desiredCenterX = dragState.pointerX - dragState.offsetX;
    const desiredCenterY = dragState.pointerY - dragState.offsetY;
    if (!Number.isFinite(desiredCenterX) || !Number.isFinite(desiredCenterY)) {
      wrapper.style.transform = '';
      return;
    }
    const dx = desiredCenterX - baseCenterX;
    const dy = desiredCenterY - baseCenterY;
    dragState.translationX = dx;
    dragState.translationY = dy;
    wrapper.style.transform = `translate(${dx}px, ${dy}px)`;
  }

  function scheduleDragMeasurement() {
    if (!dragState || dragState.measurementHandle != null) {
      return;
    }
    const applyMeasurement = () => {
      dragState.measurementHandle = null;
      dragState.measurementHandleType = null;
      if (!dragState) {
        return;
      }
      performDragMeasurement();
    };
    if (typeof globalObj.requestAnimationFrame === 'function') {
      dragState.measurementHandleType = 'raf';
      dragState.measurementHandle = globalObj.requestAnimationFrame(applyMeasurement);
    } else if (typeof globalObj.setTimeout === 'function') {
      dragState.measurementHandleType = 'timeout';
      dragState.measurementHandle = globalObj.setTimeout(applyMeasurement, 16);
    } else {
      applyMeasurement();
    }
  }

  function startPointerDrag(event, id) {
    if (!visualList || dragState || !state) return;
    if (typeof event.button === 'number' && event.button !== 0) return;
    const nodes = itemNodes.get(id);
    if (!nodes || !nodes.wrapper) return;
    const orientation = normalizeDirection(state.retning);
    const wrapper = nodes.wrapper;
    const previousTransform = wrapper.style.transform;
    wrapper.style.transform = '';
    const rect = wrapper.getBoundingClientRect();
    wrapper.style.transform = previousTransform;
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    const pointerX = Number.isFinite(event.clientX) ? event.clientX : centerX;
    const pointerY = Number.isFinite(event.clientY) ? event.clientY : centerY;
    dragState = {
      id,
      pointerId: event.pointerId,
      orientation,
      offsetX: pointerX - centerX,
      offsetY: pointerY - centerY,
      baseCenterX: centerX,
      baseCenterY: centerY,
      pointerX,
      pointerY,
      translationX: 0,
      translationY: 0,
      lastKnownIndex: currentOrder.indexOf(id),
      measurementHandle: null,
      measurementHandleType: null,
      slotCache: null,
      slotCacheOrientation: null,
      slotCacheSignature: null,
      slotCacheDirty: true
    };
    refreshDragSlotCache(orientation);
    wrapper.classList.add('sortering__item--dragging');
    wrapper.style.transition = 'none';
    if (typeof wrapper.setPointerCapture === 'function') {
      wrapper.setPointerCapture(event.pointerId);
    }
    const selection = globalObj.getSelection ? globalObj.getSelection() : null;
    if (selection && typeof selection.removeAllRanges === 'function') {
      selection.removeAllRanges();
    }
    finalizeKeyboardMode();
    event.preventDefault();
  }

  function handlePointerMove(event, id) {
    if (!dragState || dragState.id !== id) return;
    if (event.pointerId !== dragState.pointerId) return;
    const nodes = itemNodes.get(id);
    if (!nodes || !nodes.wrapper) return;
    const wrapper = nodes.wrapper;
    const orientation = dragState.orientation || normalizeDirection(state && state.retning ? state.retning : 'horisontal');

    const pointerX = Number.isFinite(event.clientX) ? event.clientX : dragState.pointerX;
    const pointerY = Number.isFinite(event.clientY) ? event.clientY : dragState.pointerY;
    dragState.pointerX = pointerX;
    dragState.pointerY = pointerY;

    const desiredCenterX = dragState.pointerX - dragState.offsetX;
    const desiredCenterY = dragState.pointerY - dragState.offsetY;
    if (!Number.isFinite(desiredCenterX) || !Number.isFinite(desiredCenterY)) {
      return;
    }

    const baseCenterX = Number.isFinite(dragState.baseCenterX) ? dragState.baseCenterX : desiredCenterX;
    const baseCenterY = Number.isFinite(dragState.baseCenterY) ? dragState.baseCenterY : desiredCenterY;
    const dx = desiredCenterX - baseCenterX;
    const dy = desiredCenterY - baseCenterY;
    dragState.translationX = dx;
    dragState.translationY = dy;
    wrapper.style.transform = `translate(${dx}px, ${dy}px)`;

    const pointerCoord = orientation === 'vertikal' ? desiredCenterY : desiredCenterX;
    if (!Number.isFinite(pointerCoord)) return;

    const slots = ensureDragSlotCache(orientation);
    const targetIndex = determineDragTargetIndex(id, pointerCoord, orientation, slots);
    const currentIndex = Number.isFinite(dragState.lastKnownIndex)
      ? dragState.lastKnownIndex
      : currentOrder.indexOf(id);
    if (targetIndex === currentIndex) {
      return;
    }
    const moved = moveItemToIndex(id, targetIndex, { preserveTransform: true });
    if (moved) {
      dragState.lastKnownIndex = currentOrder.indexOf(id);
      dragState.slotCacheDirty = true;
      dragState.slotCacheSignature = null;
      scheduleDragMeasurement();
    }
  }

  function finishPointerDrag(event, id) {
    if (!dragState || dragState.id !== id) return;
    if (event.pointerId !== dragState.pointerId) return;
    const nodes = itemNodes.get(id);
    cancelDragMeasurement(dragState);
    dragState = null;
    if (nodes && nodes.wrapper) {
      if (typeof nodes.wrapper.releasePointerCapture === 'function') {
        nodes.wrapper.releasePointerCapture(event.pointerId);
      }
      nodes.wrapper.style.transition = '';
    }
    snapToSlot();
    updateItemPositions();
    clearVisualMarkers();
  }

  function attachItemListeners(id, nodes) {
    if (!nodes || nodes.wrapper.dataset.listenersAttached === 'true') return;
    nodes.wrapper.dataset.listenersAttached = 'true';
    nodes.wrapper.style.touchAction = 'none';
    nodes.wrapper.addEventListener('pointerdown', event => startPointerDrag(event, id));
    nodes.wrapper.addEventListener('pointermove', event => handlePointerMove(event, id));
    nodes.wrapper.addEventListener('pointerup', event => finishPointerDrag(event, id));
    nodes.wrapper.addEventListener('pointercancel', event => finishPointerDrag(event, id));

    nodes.button.addEventListener('click', () => {
      if (keyboardActiveId === id) {
        snapToSlot();
        updateItemPositions();
        finalizeKeyboardMode({ restoreFocus: true });
      } else {
        activateKeyboardMode(id);
      }
    });

    nodes.button.addEventListener('keydown', event => {
      if (event.key === 'Enter' && keyboardActiveId !== id) {
        event.preventDefault();
        activateKeyboardMode(id);
      } else if (event.key === 'Escape' && keyboardActiveId === id) {
        event.preventDefault();
        snapToSlot();
        updateItemPositions();
        finalizeKeyboardMode({ restoreFocus: true });
      }
    });

    nodes.button.addEventListener('focus', () => {
      nodes.wrapper.classList.add('sortering__item--focus');
    });

    nodes.button.addEventListener('blur', () => {
      nodes.wrapper.classList.remove('sortering__item--focus');
      if (keyboardActiveId === id) {
        snapToSlot();
        updateItemPositions();
        finalizeKeyboardMode();
      }
    });
  }

  function applyOrder(options = {}) {
    if (!state || !visualList || !accessibleList) return;

    const sanitizedBase = sanitizeOrder(state.items, state.order);
    if (sanitizedBase.length !== state.order.length) {
      state.order = sanitizedBase;
    }

    let nextOrder = [];
    if (options.randomize) {
      nextOrder = shuffle(sanitizedBase);
    } else if (options.resetToBase || currentOrder.length === 0) {
      nextOrder = sanitizedBase.slice();
    } else {
      nextOrder = sanitizeOrder(state.items, currentOrder);
      if (nextOrder.length !== sanitizedBase.length) {
        nextOrder = sanitizedBase.slice();
      }
    }

    currentOrder = nextOrder;
    const usedIds = new Set();

    currentOrder.forEach((id, index) => {
      const item = itemsById.get(id);
      if (!item) return;
      const nodes = renderItem(item, index);
      if (!nodes) return;
      usedIds.add(id);
      if (visualList && nodes.wrapper.parentNode !== visualList) {
        visualList.appendChild(nodes.wrapper);
      } else if (visualList) {
        visualList.appendChild(nodes.wrapper);
      }
      if (accessibleList && nodes.li.parentNode !== accessibleList) {
        accessibleList.appendChild(nodes.li);
      } else if (accessibleList) {
        accessibleList.appendChild(nodes.li);
      }
    });

    itemNodes.forEach((nodes, id) => {
      if (usedIds.has(id)) return;
      if (nodes.wrapper.parentNode === visualList) {
        visualList.removeChild(nodes.wrapper);
      }
      if (nodes.li.parentNode === accessibleList) {
        accessibleList.removeChild(nodes.li);
      }
    });
    updateItemPositions();
    snapToSlot();
    clearVisualMarkers();
    notifyStatusChange('applyOrder');
  }

  function updateLayout() {
    if (!visualList || !state) return;
    const direction = normalizeDirection(state.retning);
    state.retning = direction;

    visualList.style.display = 'flex';
    visualList.style.flexWrap = direction === 'vertikal' ? 'nowrap' : 'wrap';
    visualList.style.flexDirection = direction === 'vertikal' ? 'column' : 'row';
    visualList.style.alignItems = direction === 'vertikal' ? 'flex-start' : 'stretch';
    visualList.style.gap = `${state.gap}px`;
    visualList.dataset.direction = direction;

    if (figureHost && !figureHost.classList.contains('sortering__figure')) {
      figureHost.classList.add('sortering__figure');
    }

    if (accessibleList) {
      accessibleList.setAttribute('aria-orientation', direction === 'vertikal' ? 'vertical' : 'horizontal');
    }
  }

  function handleGapChange(event) {
    if (!event || !event.target) return;
    const fallback = DEFAULT_STATE.gap;
    const nextValue = normalizeGap(event.target.value, state ? state.gap : fallback);
    if (!state) return;
    state.gap = Number.isFinite(nextValue) ? nextValue : fallback;
    if (gapInput && doc.activeElement !== gapInput) {
      gapInput.value = String(state.gap);
    } else {
      event.target.value = String(state.gap);
    }
    updateLayout();
    syncSettingsFormFromState();
    notifyStatusChange('settings-change');
  }

  function syncSettingsFormFromState() {
    if (!state) return;
    const direction = normalizeDirection(state.retning);
    if (directionSelect) {
      directionSelect.value = direction;
    }
    if (gapInput && doc.activeElement !== gapInput) {
      gapInput.value = String(state.gap);
    }
    if (randomizeInput) {
      randomizeInput.checked = !!state.randomisering;
    }
  }

  function handleDirectionSelectChange(event) {
    if (!state) return;
    const next = event && event.target ? event.target.value : state.retning;
    state.retning = normalizeDirection(next);
    syncSettingsFormFromState();
    updateLayout();
    notifyStatusChange('settings-change');
  }

  function handleRandomizeToggle(event) {
    if (!state) return;
    const checked = !!(event && event.target && event.target.checked);
    state.randomisering = checked;
    const options = checked ? { randomize: true } : { resetToBase: true };
    applyOrder(options);
    syncSettingsFormFromState();
  }

  function setItemEditorStatus(messages) {
    if (!itemEditorStatus) return;
    if (!messages || !messages.length) {
      itemEditorStatus.hidden = true;
      itemEditorStatus.textContent = '';
      return;
    }
    itemEditorStatus.hidden = false;
    itemEditorStatus.textContent = messages.join(' ');
  }

  function getItemValueForFormat(item, format) {
    const targetFormat = format && ITEM_FORMATS.includes(format) ? format : determineItemFormat(item);
    if (!item || typeof item !== 'object') return '';
    if (targetFormat === 'asset') {
      return typeof item.asset === 'string' ? item.asset : '';
    }
    if (targetFormat === 'katex') {
      return typeof item.description === 'string' ? item.description : '';
    }
    return typeof item.label === 'string' ? item.label : '';
  }

  function setItemValueForFormat(item, format, value) {
    if (!item || typeof item !== 'object') return;
    const targetFormat = format && ITEM_FORMATS.includes(format) ? format : determineItemFormat(item);
    const raw = typeof value === 'string' ? value : '';
    if (targetFormat === 'asset') {
      const trimmed = raw.trim();
      item.asset = trimmed;
      item.description = '';
      if (!item.label) item.label = trimmed;
      if (!item.alt) item.alt = trimmed;
    } else if (targetFormat === 'katex') {
      const normalized = raw.trim();
      item.description = normalized;
      item.asset = '';
      if (!item.label) item.label = normalized;
      if (!item.alt) item.alt = normalized;
    } else {
      const trimmed = raw.trim();
      item.label = trimmed;
      item.asset = '';
      item.description = '';
      if (!item.alt) item.alt = trimmed;
    }
    ensureItemFormat(item);
  }

  function setValueInputPlaceholder(input, format) {
    if (!input) return;
    if (format === 'asset') {
      input.placeholder = 'Asset-slug (f.eks. images/fil.svg)';
    } else if (format === 'katex') {
      input.placeholder = 'KaTeX (f.eks. \\frac{1}{2})';
    } else {
      input.placeholder = 'Tekst';
    }
  }

  function validateItemEditor() {
    const errors = [];
    const items = state && Array.isArray(state.items) ? state.items : [];
    if (items.length === 0) {
      errors.push('Legg til minst ett element.');
    }
    items.forEach((item, index) => {
      if (!item) return;
      const format = determineItemFormat(item);
      const value = getItemValueForFormat(item, format).trim();
      if (!value) {
        if (format === 'asset') {
          errors.push(`Element ${index + 1} mangler asset-slug.`);
        } else if (format === 'katex') {
          errors.push(`Element ${index + 1} mangler KaTeX-innhold.`);
        } else {
          errors.push(`Element ${index + 1} mangler tekst.`);
        }
      }
    });
    return {
      valid: errors.length === 0,
      errors
    };
  }

  function updateItemEditorValidation() {
    const { valid, errors } = validateItemEditor();
    setItemEditorStatus(valid ? null : errors);
    return valid;
  }

  function removeItem(id) {
    if (!state || !Array.isArray(state.items)) return;
    const index = state.items.findIndex(item => item && item.id === id);
    if (index < 0) return;
    state.items.splice(index, 1);
    refreshItemsById();
    state.order = sanitizeOrder(state.items, state.order);
    currentOrder = sanitizeOrder(state.items, currentOrder);
    const options = state.randomisering ? { randomize: true } : { resetToBase: true };
    applyOrder(options);
    renderItemsEditor();
  }

  function clearItemEditorDragState() {
    if (itemEditorDragState.dropTargetEl) {
      itemEditorDragState.dropTargetEl.classList.remove('is-drop-before', 'is-drop-after');
      itemEditorDragState.dropTargetEl = null;
    }
    if (itemEditorList) {
      const dragSources = itemEditorList.querySelectorAll('.sortering-editor__item.is-drag-source');
      dragSources.forEach(node => node.classList.remove('is-drag-source'));
    }
    itemEditorDragState.activeId = null;
    itemEditorDragState.originIndex = -1;
  }

  function reorderConfigItems(sourceId, targetId, placeBefore) {
    if (!state || !Array.isArray(state.items)) return false;
    if (!sourceId || !targetId || sourceId === targetId) return false;
    const sourceIndex = state.items.findIndex(item => item && item.id === sourceId);
    const targetIndex = state.items.findIndex(item => item && item.id === targetId);
    if (sourceIndex < 0 || targetIndex < 0) return false;
    const [moved] = state.items.splice(sourceIndex, 1);
    let insertIndex = targetIndex;
    if (sourceIndex < targetIndex) {
      insertIndex -= 1;
    }
    if (!placeBefore) {
      insertIndex += 1;
    }
    if (insertIndex < 0) insertIndex = 0;
    if (insertIndex > state.items.length) insertIndex = state.items.length;
    state.items.splice(insertIndex, 0, moved);
    refreshItemsById();
    state.order = state.items.map(item => item.id);
    currentOrder = state.randomisering ? sanitizeOrder(state.items, currentOrder) : state.order.slice();
    const options = state.randomisering ? { randomize: true } : { resetToBase: true };
    applyOrder(options);
    renderItemsEditor({ focusId: sourceId, focusField: 'handle' });
    return true;
  }

  function handleItemEditorDragStart(event, id, row) {
    if (!row) return;
    event.dataTransfer.effectAllowed = 'move';
    itemEditorDragState.activeId = id;
    itemEditorDragState.originIndex = state && Array.isArray(state.items) ? state.items.findIndex(item => item && item.id === id) : -1;
    row.classList.add('is-drag-source');
    if (event.dataTransfer.setData) {
      event.dataTransfer.setData('text/plain', id);
    }
    event.dataTransfer.setDragImage(row, row.offsetWidth / 2, row.offsetHeight / 2);
  }

  function handleItemEditorDragOver(event) {
    if (!itemEditorDragState.activeId) return;
    const target = event.currentTarget;
    if (!target || target.dataset.itemId === itemEditorDragState.activeId) return;
    event.preventDefault();
    const rect = typeof target.getBoundingClientRect === 'function' ? target.getBoundingClientRect() : null;
    const midpoint = rect ? rect.top + rect.height / 2 : event.clientY;
    const before = event.clientY < midpoint;
    if (itemEditorDragState.dropTargetEl && itemEditorDragState.dropTargetEl !== target) {
      itemEditorDragState.dropTargetEl.classList.remove('is-drop-before', 'is-drop-after');
    }
    itemEditorDragState.dropTargetEl = target;
    target.classList.toggle('is-drop-before', before);
    target.classList.toggle('is-drop-after', !before);
  }

  function handleItemEditorDragLeave(event) {
    const target = event.currentTarget;
    if (!target) return;
    const related = event.relatedTarget;
    if (related && target.contains(related)) return;
    target.classList.remove('is-drop-before', 'is-drop-after');
    if (itemEditorDragState.dropTargetEl === target) {
      itemEditorDragState.dropTargetEl = null;
    }
  }

  function handleItemEditorDrop(event, targetId) {
    if (!itemEditorDragState.activeId) return;
    event.preventDefault();
    const target = event.currentTarget;
    const before = target && target.classList.contains('is-drop-before');
    reorderConfigItems(itemEditorDragState.activeId, targetId, before);
    clearItemEditorDragState();
  }

  function handleItemEditorDragEnd() {
    clearItemEditorDragState();
    renderItemsEditor();
  }

  function renderItemsEditor(options = {}) {
    if (!itemEditorList) return;
    const opts = options && typeof options === 'object' ? options : {};
    const focusId = typeof opts.focusId === 'string' ? opts.focusId : null;
    const focusField = typeof opts.focusField === 'string' ? opts.focusField : null;
    const activeElement = doc.activeElement;
    const previousFocusedId = activeElement && activeElement.closest ? activeElement.closest('.sortering-editor__item') : null;
    const previousId = previousFocusedId ? previousFocusedId.dataset.itemId : null;
    while (itemEditorList.firstChild) {
      itemEditorList.removeChild(itemEditorList.firstChild);
    }

    const items = state && Array.isArray(state.items) ? state.items : [];
    if (items.length === 0) {
      const empty = doc.createElement('li');
      empty.className = 'sortering-editor__empty';
      empty.textContent = 'Ingen elementer er lagt til.';
      itemEditorList.appendChild(empty);
      updateItemEditorValidation();
      return;
    }

    const focusRequests = [];

    items.forEach(item => {
      ensureItemFormat(item);
      const row = doc.createElement('li');
      row.className = 'sortering-editor__item';
      row.dataset.itemId = item.id;

      row.addEventListener('dragover', handleItemEditorDragOver);
      row.addEventListener('dragleave', handleItemEditorDragLeave);
      row.addEventListener('drop', event => handleItemEditorDrop(event, item.id));

      const handle = doc.createElement('button');
      handle.type = 'button';
      handle.className = 'sortering-editor__handle';
      handle.setAttribute('aria-label', 'Flytt element');
      handle.textContent = '⠿';
      handle.draggable = true;
      handle.addEventListener('dragstart', event => handleItemEditorDragStart(event, item.id, row));
      handle.addEventListener('dragend', handleItemEditorDragEnd);
      handle.addEventListener('click', event => event.preventDefault());
      row.appendChild(handle);

      const valueInput = doc.createElement('input');
      valueInput.type = 'text';
      valueInput.className = 'sortering-editor__input';
      const select = doc.createElement('select');
      select.className = 'sortering-editor__select';
      select.setAttribute('aria-label', 'Innholdstype');
      const optionsList = [
        { value: 'text', label: 'Tekst' },
        { value: 'katex', label: 'KaTeX' },
        { value: 'asset', label: 'Ressurs' }
      ];
      optionsList.forEach(option => {
        const opt = doc.createElement('option');
        opt.value = option.value;
        opt.textContent = option.label;
        select.appendChild(opt);
      });
      select.value = determineItemFormat(item);
      setValueInputPlaceholder(valueInput, select.value);
      valueInput.value = getItemValueForFormat(item, select.value);
      select.addEventListener('change', () => {
        const nextFormat = ITEM_FORMATS.includes(select.value) ? select.value : 'text';
        item.format = nextFormat;
        setItemValueForFormat(item, nextFormat, valueInput.value);
        refreshItemsById();
        setValueInputPlaceholder(valueInput, nextFormat);
        valueInput.value = getItemValueForFormat(item, nextFormat);
        const optsNext = state.randomisering ? { randomize: true } : {};
        applyOrder(optsNext);
        renderItemsEditor({ focusId: item.id, focusField: 'value' });
      });
      row.appendChild(select);

      valueInput.addEventListener('input', () => {
        setItemValueForFormat(item, select.value, valueInput.value);
        refreshItemsById();
        applyOrder({});
        updateItemEditorValidation();
      });
      row.appendChild(valueInput);

      const labelInput = doc.createElement('input');
      labelInput.type = 'text';
      labelInput.className = 'sortering-editor__label';
      labelInput.placeholder = 'Knappetekst (valgfritt)';
      labelInput.value = typeof item.label === 'string' ? item.label : '';
      labelInput.addEventListener('input', () => {
        item.label = labelInput.value;
        ensureItemFormat(item);
        refreshItemsById();
        applyOrder({});
        updateItemEditorValidation();
      });
      row.appendChild(labelInput);

      const altInput = doc.createElement('input');
      altInput.type = 'text';
      altInput.className = 'sortering-editor__alt';
      altInput.placeholder = 'Alternativ tekst';
      altInput.value = typeof item.alt === 'string' ? item.alt : '';
      altInput.addEventListener('input', () => {
        item.alt = altInput.value;
        ensureItemFormat(item);
        refreshItemsById();
        applyOrder({});
      });
      row.appendChild(altInput);

      const removeBtn = doc.createElement('button');
      removeBtn.type = 'button';
      removeBtn.className = 'sortering-editor__remove';
      removeBtn.textContent = 'Fjern';
      removeBtn.addEventListener('click', () => {
        removeItem(item.id);
        updateItemEditorValidation();
      });
      row.appendChild(removeBtn);

      itemEditorList.appendChild(row);

      if ((focusId && item.id === focusId) || (!focusId && previousId && item.id === previousId)) {
        focusRequests.push({ element: null, row, field: focusField || 'value' });
      }
    });

    updateItemEditorValidation();

    if (focusRequests.length) {
      const request = focusRequests[0];
      if (request && request.row) {
        let target = null;
        if (request.field === 'handle') {
          target = request.row.querySelector('.sortering-editor__handle');
        } else if (request.field === 'label') {
          target = request.row.querySelector('.sortering-editor__label');
        } else if (request.field === 'alt') {
          target = request.row.querySelector('.sortering-editor__alt');
        } else {
          target = request.row.querySelector('.sortering-editor__input');
        }
        if (target && typeof target.focus === 'function') {
          target.focus();
          if (typeof target.select === 'function') {
            target.select();
          }
        }
      }
    }
  }

  function addNewItem() {
    if (!state) return;
    if (!Array.isArray(state.items)) {
      state.items = [];
    }
    const id = generateItemId();
    const newItem = {
      id,
      label: '',
      description: '',
      asset: '',
      alt: '',
      format: 'text'
    };
    ensureItemFormat(newItem);
    state.items.push(newItem);
    refreshItemsById();
    state.order = state.items.map(item => item.id);
    currentOrder = state.randomisering ? sanitizeOrder(state.items, currentOrder) : state.order.slice();
    const options = state.randomisering ? { randomize: true } : { resetToBase: true };
    applyOrder(options);
    renderItemsEditor({ focusId: id, focusField: 'value' });
  }

  function attachExampleButtonGuards() {
    saveExampleButton = doc.getElementById('btnSaveExample');
    updateExampleButton = doc.getElementById('btnUpdateExample');
    const guardedButtons = [saveExampleButton, updateExampleButton];

    guardedButtons.forEach(button => {
      if (!button) return;
      button.addEventListener(
        'click',
        event => {
          if (!updateItemEditorValidation()) {
            event.preventDefault();
            event.stopImmediatePropagation();
            return;
          }
          syncExampleBindings();
        },
        true
      );
    });
    deleteExampleButton = doc.getElementById('btnDeleteExample');
    if (deleteExampleButton) {
      deleteExampleButton.addEventListener(
        'click',
        () => {
          syncExampleBindings();
        },
        true
      );
    }
    updateExampleActionPayloads();
  }

  function setupSettingsForm(host) {
    settingsForm = doc.getElementById('sorteringSettings');
    directionSelect = doc.getElementById('sortering-direction');
    gapInput = doc.getElementById('sortering-gap');
    randomizeInput = doc.getElementById('sortering-randomize');
    itemEditorList = doc.getElementById('sorteringEditorList');
    addItemButton = doc.getElementById('btnAddSorteringItem');
    itemEditorStatus = doc.getElementById('sorteringEditorStatus');

    if (directionSelect) {
      directionSelect.addEventListener('change', handleDirectionSelectChange);
    }
    if (gapInput) {
      gapInput.addEventListener('change', handleGapChange);
      gapInput.addEventListener('blur', handleGapChange);
    }
    if (randomizeInput) {
      randomizeInput.addEventListener('change', handleRandomizeToggle);
    }
    if (addItemButton) {
      addItemButton.addEventListener('click', addNewItem);
    }

    if (host) {
      ensureStatusSection(host);
      updateStatusUI(getStatusSnapshot());
    }
    syncSettingsFormFromState();
    renderItemsEditor();
  }

  function createState() {
    const rootState = globalObj.STATE && typeof globalObj.STATE === 'object' ? globalObj.STATE : {};
    if (!globalObj.STATE || typeof globalObj.STATE !== 'object') {
      globalObj.STATE = rootState;
    }

    const existing = rootState.sortering && typeof rootState.sortering === 'object' ? rootState.sortering : null;
    const incomingItems = buildItems(existing && Array.isArray(existing.items) ? existing.items : []);
    const items = incomingItems.length ? incomingItems : DEFAULT_ITEMS.map(cloneItem);
    const orderSource = existing && Array.isArray(existing.order) ? existing.order : DEFAULT_STATE.order;
    const order = sanitizeOrder(items, orderSource);
    const retning = normalizeDirection(existing && existing.retning ? existing.retning : DEFAULT_STATE.retning);
    const gap = normalizeGap(existing && 'gap' in existing ? existing.gap : Number.NaN, DEFAULT_STATE.gap);
    const randomisering = !!(existing && existing.randomisering);
    const altText = existing && typeof existing.altText === 'string' ? existing.altText : DEFAULT_STATE.altText;
    const altTextSource = existing && existing.altTextSource === 'manual' ? 'manual' : DEFAULT_STATE.altTextSource;

    const nextState = {
      items,
      order,
      retning,
      gap,
      randomisering,
      altText,
      altTextSource
    };

    rootState.sortering = nextState;
    globalObj.STATE = rootState;
    return nextState;
  }

  function applyStateFromGlobal() {
    state = createState();
    refreshItemsById();
    currentOrder = sanitizeOrder(state.items, state.order);
    syncSettingsFormFromState();
    if (itemEditorList) {
      renderItemsEditor();
    }
    updateLayout();
    const options = state.randomisering ? { randomize: true } : { resetToBase: true };
    applyOrder(options);
  }

  function init() {
    registerMathVisApi();
    exportCard = doc.getElementById('exportCard');
    checkButton = doc.getElementById('btnCheck');
    checkStatus = doc.getElementById('checkStatus');
    taskCheckHost = doc.querySelector('[data-task-check-host]');
    taskCheckControls = [checkButton, checkStatus].filter(Boolean);
    ensureTaskControlsAppended();
    applyAppModeToTaskControls(getCurrentAppMode() || 'task');
    if (typeof globalObj.addEventListener === 'function') {
      globalObj.addEventListener('math-visuals:app-mode-changed', handleAppModeChanged);
    }
    if (checkButton) {
      checkButton.addEventListener('click', handleCheckButtonClick);
    }
    figureHost = doc.getElementById('sortFigure');
    accessibleList = doc.getElementById('sortSkia');
    const settingsHost = doc.getElementById('settingsHost');

    if (!figureHost || !accessibleList) {
      return;
    }

    state = createState();
    refreshItemsById();

    currentOrder = sanitizeOrder(state.items, state.order);

    if (!visualList) {
      visualList = doc.createElement('div');
      visualList.className = 'sortering__items';
      figureHost.appendChild(visualList);
    }

    if (accessibleList && accessibleList.firstChild) {
      while (accessibleList.firstChild) {
        accessibleList.removeChild(accessibleList.firstChild);
      }
    }

    updateLayout();
    applyOrder({ randomize: !!state.randomisering, resetToBase: !state.randomisering });
    if (settingsHost) {
      setupSettingsForm(settingsHost);
    }
    attachExampleButtonGuards();
    if (typeof globalObj.addEventListener === 'function') {
      globalObj.addEventListener('examples:loaded', () => {
        applyStateFromGlobal();
      });
    }
  }

  if (doc.readyState === 'loading') {
    doc.addEventListener('DOMContentLoaded', init, { once: true });
  } else {
    init();
  }
})();
