(function () {
  const SVG_NS = 'http://www.w3.org/2000/svg';
  const svg = document.getElementById('numberLineSvg');
  if (!svg) return;

  const fromInput = document.getElementById('cfg-from');
  const toInput = document.getElementById('cfg-to');
  const mainStepInput = document.getElementById('cfg-mainStep');
  const subdivisionsInput = document.getElementById('cfg-subdivisions');
  const numberTypeSelect = document.getElementById('cfg-numberType');
  const decimalDigitsInput = document.getElementById('cfg-decimalDigits');
  const labelFontSizeInput = document.getElementById('cfg-labelFontSize');
  const btnSvg = document.getElementById('btnSvg');
  const btnPng = document.getElementById('btnPng');
  const clampLineInput = document.getElementById('cfg-clampLine');
  const lockLineInput = document.getElementById('cfg-lockLine');
  const exportCard = document.getElementById('exportCard');
  const draggableListContainer = document.getElementById('draggableItems');
  const addDraggableButton = document.getElementById('btnAddDraggable');
  const checkButton = document.getElementById('btnCheck');
  const checkStatus = document.getElementById('checkStatus');
  const taskCheckHost = typeof document !== 'undefined' ? document.querySelector('[data-task-check-host]') : null;
  const taskCheckControls = [checkButton, checkStatus].filter(Boolean);

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
    if (typeof window === 'undefined') return 'default';
    const mv = window.mathVisuals;
    if (mv && typeof mv.getAppMode === 'function') {
      try {
        const mode = mv.getAppMode();
        if (typeof mode === 'string' && mode) {
          return mode;
        }
      } catch (_) {
        // fall through to query parsing below
      }
    }
    try {
      const params = new URLSearchParams(window.location && window.location.search ? window.location.search : '');
      const fromQuery = params.get('mode');
      if (typeof fromQuery === 'string' && fromQuery.trim()) {
        return fromQuery.trim().toLowerCase() === 'task' ? 'task' : 'default';
      }
    } catch (_) {}
    return 'default';
  }

  function handleAppModeChanged(event) {
    if (!event) return;
    const detail = event.detail;
    if (!detail || typeof detail.mode !== 'string') return;
    applyAppModeToTaskControls(detail.mode);
  }

  if (typeof window !== 'undefined' && typeof window.addEventListener === 'function') {
    window.addEventListener('math-visuals:app-mode-changed', handleAppModeChanged);
  }

  applyAppModeToTaskControls(getCurrentAppMode() || 'task');

  const STATE = window.STATE && typeof window.STATE === 'object' ? window.STATE : {};
  window.STATE = STATE;

  const BASE_LABEL_FONT_SIZE = 18;
  const FIGURE_WIDTH = 1000;
  const FIGURE_HEIGHT = 260;
  const PADDING_LEFT = 80;
  const PADDING_RIGHT = 80;
  const BASELINE_Y = 140;
  const MINOR_TICK_HEIGHT = 9;
  const MAJOR_TICK_HEIGHT = 18;
  const DEFAULT_DRAGGABLE_WIDTH = 72;
  const DEFAULT_DRAGGABLE_HEIGHT = 72;
  const MIN_DRAGGABLE_DIAMETER = 56;
  const MAX_DRAGGABLE_DIAMETER = 108;
  const DEFAULT_DRAGGABLE_OFFSET_Y = -120;

  const DEFAULT_STATE = {
    from: -0.4,
    to: 10.4,
    mainStep: 1,
    subdivisions: 4,
    numberType: 'integer',
    decimalDigits: 1,
    labelFontSize: BASE_LABEL_FONT_SIZE,
    clampToRange: true,
    lockLine: true,
    altText: '',
    altTextSource: 'auto',
    draggableItems: []
  };

  const integerFormatter = typeof Intl !== 'undefined' ? new Intl.NumberFormat('nb-NO', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  }) : null;
  const altNumberFormatter = typeof Intl !== 'undefined' ? new Intl.NumberFormat('nb-NO', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 6
  }) : null;
  const decimalFormatterCache = new Map();
  const pendingKatexLabels = new Set();
  const VALID_NUMBER_TYPES = new Set(['integer', 'decimal', 'fraction', 'mixedFraction', 'improperFraction']);
  const LEGACY_NUMBER_TYPE_MAP = {};

  let altTextManager = null;
  let lastRenderSummary = null;
  let currentGeometry = null;
  let activeDragSession = null;
  let activeDraggableSession = null;
  let draggableIdCounter = 1;
  let pendingDraggableFocus = null;

  function cloneState(source) {
    return JSON.parse(JSON.stringify(source));
  }

  function computePlacedOffset(height) {
    const effectiveHeight = Number.isFinite(height) && height > 0 ? height : DEFAULT_DRAGGABLE_HEIGHT;
    return -(MAJOR_TICK_HEIGHT + effectiveHeight / 2 + 12);
  }

  function sanitizeDraggableItems(items) {
    const list = Array.isArray(items) ? items : [];
    const sanitized = [];
    let nextId = Math.max(1, draggableIdCounter);

    const updateCounterFromId = id => {
      if (typeof id !== 'string') return;
      const match = id.match(/^draggable-(\d+)$/);
      if (!match) return;
      const value = Number.parseInt(match[1], 10);
      if (Number.isFinite(value) && value + 1 > nextId) {
        nextId = value + 1;
      }
    };

    list.forEach(rawItem => {
      const item = rawItem && typeof rawItem === 'object' ? rawItem : {};
      let id = typeof item.id === 'string' && item.id ? item.id : '';
      if (!id) {
        id = `draggable-${nextId++}`;
      } else {
        updateCounterFromId(id);
      }

      const label = typeof item.label === 'string' ? item.label : '';

      let value = Number(item.value);
      if (!Number.isFinite(value)) value = 0;

      const start = item.startPosition && typeof item.startPosition === 'object' ? item.startPosition : {};
      let startValue = Number(start.value);
      if (!Number.isFinite(startValue)) startValue = value;
      let startOffset = Number(start.offsetY);
      if (!Number.isFinite(startOffset)) startOffset = DEFAULT_DRAGGABLE_OFFSET_Y;

      let currentValue = Number(item.currentValue);
      if (!Number.isFinite(currentValue)) currentValue = startValue;

      let currentOffsetY = Number(item.currentOffsetY);
      if (!Number.isFinite(currentOffsetY)) currentOffsetY = startOffset;

      const lockRaw = item.lockPosition;
      const lockPosition = !(lockRaw === false || lockRaw === 'false' || lockRaw === 0);

      let isPlaced = Boolean(item.isPlaced) && Number.isFinite(item.currentValue);
      if (lockPosition) {
        isPlaced = true;
        if (Number.isFinite(item.currentValue)) {
          currentValue = Number(item.currentValue);
        } else if (Number.isFinite(value)) {
          currentValue = value;
        }
      } else if (!isPlaced) {
        currentValue = startValue;
        currentOffsetY = startOffset;
      }
      if (lockPosition && Number.isFinite(value)) {
        currentValue = value;
      }

      item.id = id;
      item.label = label;
      item.value = value;
      item.startPosition = { value: startValue, offsetY: startOffset };
      item.currentValue = currentValue;
      item.currentOffsetY = currentOffsetY;
      item.isPlaced = lockPosition ? true : isPlaced;
      item.lockPosition = lockPosition;

      sanitized.push(item);
    });

    draggableIdCounter = Math.max(nextId, sanitized.length + 1);
    return sanitized;
  }

  function ensureStateDefaults() {
    const defaults = cloneState(DEFAULT_STATE);
    Object.keys(defaults).forEach(key => {
      if (!(key in STATE)) STATE[key] = defaults[key];
    });

    let from = Number(STATE.from);
    if (!Number.isFinite(from)) from = defaults.from;
    let to = Number(STATE.to);
    if (!Number.isFinite(to)) to = from + 10;

    if (to < from) {
      const swap = to;
      to = from;
      from = swap;
    }

    let mainStep = Number(STATE.mainStep);
    const range = Math.abs(to - from);
    if (!Number.isFinite(mainStep) || mainStep <= 0) {
      mainStep = range > 0 ? range / 4 : 1;
    }
    if (!Number.isFinite(mainStep) || mainStep <= 0) mainStep = 1;

    let subdivisions = Math.round(Number(STATE.subdivisions));
    if (!Number.isFinite(subdivisions) || subdivisions < 0) subdivisions = defaults.subdivisions;
    subdivisions = Math.min(Math.max(subdivisions, 0), 20);

    let numberType = STATE.numberType;
    if (numberType in LEGACY_NUMBER_TYPE_MAP) {
      numberType = LEGACY_NUMBER_TYPE_MAP[numberType];
    }
    if (!VALID_NUMBER_TYPES.has(numberType)) {
      numberType = defaults.numberType;
    }

    let decimalDigits = Math.round(Number(STATE.decimalDigits));
    if (!Number.isFinite(decimalDigits) || decimalDigits < 0) {
      decimalDigits = defaults.decimalDigits;
    }
    decimalDigits = Math.min(Math.max(decimalDigits, 0), 6);

    let labelFontSize = Number(STATE.labelFontSize);
    if (!Number.isFinite(labelFontSize)) {
      labelFontSize = defaults.labelFontSize;
    }
    labelFontSize = Math.min(Math.max(labelFontSize, 8), 72);

    STATE.clampToRange = Boolean(STATE.clampToRange);
    const lockValue = STATE.lockLine;
    STATE.lockLine = !(lockValue === false || lockValue === 'false' || lockValue === 0);
    if (STATE.clampToRange) {
      STATE.lockLine = true;
    }
    if (typeof STATE.altText !== 'string') STATE.altText = '';
    STATE.altTextSource = STATE.altTextSource === 'manual' ? 'manual' : 'auto';

    STATE.draggableItems = sanitizeDraggableItems(STATE.draggableItems);

    if (numberType === 'decimal') {
      from = roundToDecimalDigits(from, decimalDigits);
      to = roundToDecimalDigits(to, decimalDigits);
    }

    STATE.from = from;
    STATE.to = to;
    STATE.mainStep = mainStep;
    STATE.subdivisions = subdivisions;
    STATE.numberType = numberType;
    STATE.decimalDigits = decimalDigits;
    STATE.labelFontSize = labelFontSize;
  }

  function getDecimalFormatter(digits) {
    const key = Math.min(Math.max(Math.round(Number(digits)) || 0, 0), 6);
    if (!decimalFormatterCache.has(key) && typeof Intl !== 'undefined') {
      decimalFormatterCache.set(key, new Intl.NumberFormat('nb-NO', {
        minimumFractionDigits: key,
        maximumFractionDigits: key
      }));
    }
    return decimalFormatterCache.get(key) || null;
  }

  function formatInteger(value) {
    if (!Number.isFinite(value)) return String(value);
    if (integerFormatter) return integerFormatter.format(Math.round(value));
    return String(Math.round(value));
  }

  function formatDecimal(value, digits) {
    if (!Number.isFinite(value)) return String(value);
    const formatter = getDecimalFormatter(digits);
    if (formatter) return formatter.format(value);
    return value.toFixed(Math.max(0, digits));
  }

  function roundToDecimalDigits(value, digits) {
    if (!Number.isFinite(value)) return value;
    const safeDigits = Math.min(Math.max(Math.round(Number(digits)) || 0, 0), 6);
    const factor = Math.pow(10, safeDigits);
    if (!Number.isFinite(factor) || factor <= 0) return value;
    return Math.round(value * factor) / factor;
  }

  function getViewBoxPoint(event) {
    if (!svg) return null;
    const rect = svg.getBoundingClientRect();
    if (!rect || rect.width <= 0 || rect.height <= 0) return null;
    const x = ((event.clientX - rect.left) / rect.width) * FIGURE_WIDTH;
    const y = ((event.clientY - rect.top) / rect.height) * FIGURE_HEIGHT;
    if (!Number.isFinite(x) || !Number.isFinite(y)) return null;
    return { x, y };
  }

  function getSnapSpacing() {
    let mainStep = Number(STATE.mainStep);
    if (!Number.isFinite(mainStep) || Math.abs(mainStep) <= 1e-12) {
      mainStep = 1;
    }
    const subdivisions = Math.max(0, Math.round(Number(STATE.subdivisions)) || 0);
    const spacing = subdivisions > 0 ? mainStep / (subdivisions + 1) : mainStep;
    if (!Number.isFinite(spacing) || Math.abs(spacing) <= 1e-12) return 1;
    return Math.abs(spacing);
  }

  function snapValueToNearest(value) {
    if (!Number.isFinite(value)) return value;
    const spacing = getSnapSpacing();
    if (!(spacing > 1e-12)) return value;
    const base = Number(STATE.from);
    const reference = Number.isFinite(base) ? base : 0;
    const steps = Math.round((value - reference) / spacing);
    const snapped = reference + steps * spacing;
    return roundToDecimalDigits(snapped, Math.max((STATE.decimalDigits || 0) + 3, 6));
  }

  function getActiveDecimalDigitLimit() {
    if (!STATE || STATE.numberType !== 'decimal') return null;
    const digits = Math.round(Number(STATE.decimalDigits));
    if (!Number.isFinite(digits)) return 0;
    return Math.min(Math.max(digits, 0), 6);
  }

  function countDecimalDigitsInInput(value) {
    if (typeof value !== 'string') return 0;
    const match = value.match(/[.,](\d*)$/);
    if (!match) return 0;
    return match[1].length;
  }

  function formatNumberInputValue(value) {
    if (!Number.isFinite(value)) return '';
    const limit = getActiveDecimalDigitLimit();
    if (limit == null) return String(value);
    const rounded = roundToDecimalDigits(value, limit);
    if (limit <= 0) return String(rounded);
    let str = rounded.toFixed(limit);
    if (limit > 0) {
      str = str
        .replace(/(\.\d*[1-9])0+$/, '$1')
        .replace(/\.0+$/, '')
        .replace(/\.$/, '');
    }
    return str;
  }

  function gcd(a, b) {
    let x = Math.abs(a);
    let y = Math.abs(b);
    while (y) {
      const t = y;
      y = x % y;
      x = t;
    }
    return x || 1;
  }

  function approximateFraction(value, maxDenominator) {
    if (!Number.isFinite(value)) return null;
    if (value === 0) return { numerator: 0, denominator: 1 };
    const sign = value < 0 ? -1 : 1;
    let x = Math.abs(value);
    if (Math.abs(x - Math.round(x)) < 1e-10) {
      return { numerator: sign * Math.round(x), denominator: 1 };
    }
    let lowerN = 0;
    let lowerD = 1;
    let upperN = 1;
    let upperD = 0;
    let bestN = 1;
    let bestD = 1;
    const limit = Math.max(1, Math.floor(maxDenominator));
    for (let i = 0; i < 64; i++) {
      const mediantN = lowerN + upperN;
      const mediantD = lowerD + upperD;
      if (mediantD > limit) break;
      const mediant = mediantN / mediantD;
      bestN = mediantN;
      bestD = mediantD;
      if (Math.abs(mediant - x) <= 1e-9) break;
      if (mediant < x) {
        lowerN = mediantN;
        lowerD = mediantD;
      } else {
        upperN = mediantN;
        upperD = mediantD;
      }
    }
    const upperVal = upperN / upperD;
    const lowerVal = lowerN / lowerD;
    const upperDiff = Math.abs(upperVal - x);
    const lowerDiff = Math.abs(lowerVal - x);
    let chosenN = bestN;
    let chosenD = bestD;
    if (upperD <= limit && upperDiff < Math.abs(chosenN / chosenD - x)) {
      chosenN = upperN;
      chosenD = upperD;
    }
    if (lowerD <= limit && lowerDiff < Math.abs(chosenN / chosenD - x)) {
      chosenN = lowerN;
      chosenD = lowerD;
    }
    if (chosenD === 0) {
      chosenN = bestN;
      chosenD = bestD;
    }
    const divisor = gcd(chosenN, chosenD);
    return {
      numerator: sign * Math.round(chosenN / divisor),
      denominator: Math.round(chosenD / divisor)
    };
  }

  function getFractionRenderInfo(value, mode) {
    const renderMode = mode === 'improperFraction' ? 'improperFraction' : 'mixedFraction';
    const maxDen = Math.pow(10, Math.min(Math.max(STATE.decimalDigits + 2, 1), 6));
    const approx = approximateFraction(value, maxDen);
    if (!approx) {
      const fallback = formatDecimal(value, STATE.decimalDigits || 2);
      return { type: 'text', text: fallback };
    }

    const { numerator, denominator } = approx;
    if (denominator === 1) {
      const integerText = formatInteger(numerator);
      return { type: 'text', text: integerText };
    }

    const absNum = Math.abs(numerator);
    const whole = Math.trunc(absNum / denominator);
    const remainder = absNum % denominator;
    const sign = numerator < 0 ? '-' : '';

    if (renderMode === 'improperFraction') {
      const fractionText = `${sign}${absNum}⁄${denominator}`;
      const expression = `${sign}\\frac{${absNum}}{${denominator}}`;
      return { type: 'katex', text: fractionText, katex: expression };
    }

    if (whole === 0) {
      const fractionText = `${absNum}⁄${denominator}`;
      const text = sign ? `-${fractionText}` : fractionText;
      const expression = `${sign}\\frac{${absNum}}{${denominator}}`;
      return { type: 'katex', text, katex: expression };
    }

    if (remainder === 0) {
      const integerText = formatInteger(numerator / denominator);
      return { type: 'text', text: integerText };
    }

    const wholeValue = numerator < 0 ? -whole : whole;
    const fractionText = `${remainder}⁄${denominator}`;
    const text = `${formatInteger(wholeValue)} ${fractionText}`;
    const expression = `${sign}${whole}\\frac{${remainder}}{${denominator}}`;
    return { type: 'katex', text, katex: expression };
  }

  function formatFraction(value, mode) {
    return getFractionRenderInfo(value, mode).text;
  }

  function getLabelRenderInfo(value) {
    switch (STATE.numberType) {
      case 'decimal':
        return { type: 'text', text: formatDecimal(value, STATE.decimalDigits) };
      case 'fraction':
        return getFractionRenderInfo(value, 'improperFraction');
      case 'mixedFraction':
        return getFractionRenderInfo(value, 'mixedFraction');
      case 'improperFraction':
        return getFractionRenderInfo(value, 'improperFraction');
      case 'integer':
      default: {
        const rounded = Math.round(value);
        if (Math.abs(value - rounded) <= 1e-9) {
          return { type: 'text', text: formatInteger(rounded) };
        }
        const digits = Math.max(STATE.decimalDigits, 1);
        return { type: 'text', text: formatDecimal(value, digits) };
      }
    }
  }

  function applyKatexToContainer(container, latex, fallbackText) {
    if (!container || typeof latex !== 'string' || !latex) return false;
    if (
      !window.katex ||
      (typeof window.katex.render !== 'function' && typeof window.katex.renderToString !== 'function')
    ) {
      return false;
    }

    try {
      const span = document.createElementNS('http://www.w3.org/1999/xhtml', 'span');
      span.className = 'major-label__katex';
      if (typeof window.katex.render === 'function') {
        window.katex.render(latex, span, { throwOnError: false });
      } else {
        span.innerHTML = window.katex.renderToString(latex, { throwOnError: false });
      }
      if (!span.querySelector('.katex')) {
        container.innerHTML = '';
        throw new Error('Katex rendering failed');
      }
      container.innerHTML = '';
      container.appendChild(span);
      return true;
    } catch (err) {
      container.innerHTML = '';
    }
    if (fallbackText != null) {
      container.textContent = fallbackText;
    }
    return false;
  }

  function flushPendingKatex() {
    if (
      !window.katex ||
      (typeof window.katex.render !== 'function' && typeof window.katex.renderToString !== 'function')
    ) {
      return;
    }
    const items = Array.from(pendingKatexLabels);
    for (const container of items) {
      if (!container || !container.dataset) {
        pendingKatexLabels.delete(container);
        continue;
      }
      const latex = container.dataset.katexExpression;
      const fallback = container.dataset.katexFallback;
      if (!latex) {
        pendingKatexLabels.delete(container);
        continue;
      }
      if (applyKatexToContainer(container, latex, fallback)) {
        pendingKatexLabels.delete(container);
      } else if (fallback != null) {
        container.textContent = fallback;
        pendingKatexLabels.delete(container);
      }
    }
  }

  function renderLabelContent(container, value) {
    const info = getLabelRenderInfo(value);
    container.textContent = '';

    if (container.dataset) {
      delete container.dataset.katexExpression;
      delete container.dataset.katexFallback;
    }
    pendingKatexLabels.delete(container);

    if (info.type === 'katex') {
      if (container.dataset) {
        if (typeof info.katex === 'string') container.dataset.katexExpression = info.katex;
        if (typeof info.text === 'string') container.dataset.katexFallback = info.text;
      }
      if (applyKatexToContainer(container, info.katex, info.text)) {
        return;
      }
      pendingKatexLabels.add(container);
      container.textContent = info.text != null ? info.text : '';
      return;
    }

    container.textContent = info.text != null ? info.text : '';
  }

  function renderDraggableItemLabel(container, item) {
    if (!container) return;
    container.textContent = '';
    if (container.dataset) {
      delete container.dataset.katexExpression;
      delete container.dataset.katexFallback;
    }
    pendingKatexLabels.delete(container);

    if (!item || typeof item !== 'object') {
      container.textContent = '';
      return;
    }

    const labelText = typeof item.label === 'string' ? item.label.trim() : '';
    if (labelText) {
      container.textContent = labelText;
      return;
    }

    renderLabelContent(container, item.value);
  }

  function buildDraggableNode(item, index, geometry) {
    if (!item || !geometry) return null;
    const fontSizeValue = Number(STATE.labelFontSize);
    const normalizedFontSize = Number.isFinite(fontSizeValue) ? fontSizeValue : BASE_LABEL_FONT_SIZE;
    const baseSize = Math.max(normalizedFontSize * 2.6, DEFAULT_DRAGGABLE_HEIGHT);
    const diameter = Math.max(
      MIN_DRAGGABLE_DIAMETER,
      Math.min(MAX_DRAGGABLE_DIAMETER, baseSize)
    );
    const width = diameter;
    const height = diameter;

    const startPosition = item.startPosition && typeof item.startPosition === 'object' ? item.startPosition : {};
    const startValue = Number(startPosition.value);
    const startOffset = Number(startPosition.offsetY);
    const isLocked = Boolean(item.lockPosition);
    const isPlaced = isLocked || Boolean(item.isPlaced);

    let currentValue = Number(item.currentValue);
    if (!Number.isFinite(currentValue)) {
      currentValue = Number.isFinite(startValue) ? startValue : 0;
    }
    if (isLocked) {
      const lockedValue = Number(item.value);
      if (Number.isFinite(lockedValue)) {
        currentValue = lockedValue;
        if (item.currentValue !== lockedValue) {
          item.currentValue = lockedValue;
        }
      }
    }
    let offsetY = Number(item.currentOffsetY);
    if (isLocked) {
      offsetY = computePlacedOffset(height);
      if (item.currentOffsetY !== offsetY) {
        item.currentOffsetY = offsetY;
      }
      if (!item.isPlaced) {
        item.isPlaced = true;
      }
    } else if (isPlaced) {
      if (!Number.isFinite(offsetY)) {
        offsetY = computePlacedOffset(height);
        item.currentOffsetY = offsetY;
      }
    } else {
      offsetY = Number.isFinite(startOffset) ? startOffset : DEFAULT_DRAGGABLE_OFFSET_Y;
      if (!Number.isFinite(item.currentOffsetY)) {
        item.currentOffsetY = offsetY;
      }
    }

    const x = geometry.mapValue(currentValue);
    if (!Number.isFinite(x)) return null;
    const centerY = BASELINE_Y + offsetY;
    const y = centerY - height / 2;
    const topLeftX = x - width / 2;

    const radius = diameter / 2;

    const group = mk('g', { class: 'draggable-item' });
    group.dataset.index = String(index);
    group.dataset.width = String(width);
    group.dataset.height = String(height);
    group.dataset.x = String(topLeftX);
    group.dataset.y = String(y);
    group.setAttribute('transform', `translate(${topLeftX}, ${y})`);
    if (isPlaced) {
      group.classList.add('is-placed');
    }
    if (isLocked) {
      group.classList.add('is-locked');
    }

    group.style.touchAction = 'none';

    if (!isLocked) {
      group.addEventListener('pointerdown', handleDraggablePointerDown);
    }

    if (isPlaced) {
      const baselineWithinGroup = BASELINE_Y - y;
      const pointerThreshold = height + 12;
      if (baselineWithinGroup > pointerThreshold) {
        const pointerGroup = mk('g', { class: 'draggable-item__pointer' });
        const pointerTop = height - 6;
        const pointerNeckY = Math.max(pointerTop + 6, baselineWithinGroup - 10);
        const pointerLine = mk('line', {
          x1: radius,
          y1: pointerTop,
          x2: radius,
          y2: pointerNeckY,
          class: 'draggable-item__pointer-line'
        });
        const pointerHead = mk('polygon', {
          points: `${radius - 6},${pointerNeckY} ${radius + 6},${pointerNeckY} ${radius},${baselineWithinGroup}`,
          class: 'draggable-item__pointer-head'
        });
        pointerGroup.appendChild(pointerLine);
        pointerGroup.appendChild(pointerHead);
        group.appendChild(pointerGroup);
      }
    }

    const background = mk('circle', {
      cx: radius,
      cy: radius,
      r: Math.max(radius - 1, 0),
      class: 'draggable-item__bg'
    });
    group.appendChild(background);

    const foreignObject = mk('foreignObject', {
      x: 0,
      y: 0,
      width,
      height,
      class: 'draggable-item__fo'
    });
    const container = document.createElementNS('http://www.w3.org/1999/xhtml', 'div');
    container.className = 'draggable-item__label';
    container.style.fontSize = `${normalizedFontSize}px`;
    renderDraggableItemLabel(container, item);
    foreignObject.appendChild(container);
    group.appendChild(foreignObject);

    return group;
  }

  function renderDraggableItemsLayer(root, geometry) {
    if (!root || !geometry) return;
    const items = Array.isArray(STATE.draggableItems) ? STATE.draggableItems : [];
    if (!items.length) return;
    const group = mk('g', { class: 'draggable-items-layer' });
    items.forEach((item, index) => {
      const node = buildDraggableNode(item, index, geometry);
      if (node) {
        group.appendChild(node);
      }
    });
    root.appendChild(group);
  }

  function scheduleDraggableEditorFocus(itemId, field, input) {
    if (!input) return;
    let selectionStart = null;
    let selectionEnd = null;
    try {
      selectionStart = input.selectionStart;
      selectionEnd = input.selectionEnd;
    } catch (err) {}
    pendingDraggableFocus = {
      id: itemId,
      field,
      selectionStart,
      selectionEnd
    };
  }

  function applyDraggableEditorFocus(input, itemId, field, focusRequest) {
    if (!focusRequest || !input) return;
    if (focusRequest.id !== itemId || focusRequest.field !== field) return;
    setTimeout(() => {
      try {
        input.focus();
        if (
          focusRequest.selectionStart != null &&
          focusRequest.selectionEnd != null &&
          typeof input.setSelectionRange === 'function'
        ) {
          input.setSelectionRange(focusRequest.selectionStart, focusRequest.selectionEnd);
        }
      } catch (err) {}
    }, 0);
  }

  function renderDraggableEditor() {
    if (!draggableListContainer) return;
    const items = Array.isArray(STATE.draggableItems) ? STATE.draggableItems : [];
    draggableListContainer.innerHTML = '';

    const focusRequest = pendingDraggableFocus;
    pendingDraggableFocus = null;

    if (!items.length) {
      const empty = document.createElement('p');
      empty.className = 'draggable-config-empty';
      empty.textContent = 'Ingen elementer er lagt til.';
      draggableListContainer.appendChild(empty);
      return;
    }

    items.forEach((item, index) => {
      const wrapper = document.createElement('div');
      wrapper.className = 'draggable-config-item';

      const title = document.createElement('div');
      title.className = 'draggable-config-title';
      title.textContent = `Element ${index + 1}`;
      wrapper.appendChild(title);

      const topGrid = document.createElement('div');
      topGrid.className = 'draggable-config-grid draggable-config-grid--triple';

      const bottomGrid = document.createElement('div');
      bottomGrid.className = 'draggable-config-grid';

      const isLocked = Boolean(item.lockPosition);

      const labelField = document.createElement('label');
      labelField.textContent = 'Etikett (valgfritt)';
      const labelInput = document.createElement('input');
      labelInput.type = 'text';
      labelInput.value = item.label || '';
      labelInput.addEventListener('input', () => {
        item.label = labelInput.value;
        scheduleDraggableEditorFocus(item.id, 'label', labelInput);
        render();
      });
      labelField.appendChild(labelInput);
      topGrid.appendChild(labelField);
      applyDraggableEditorFocus(labelInput, item.id, 'label', focusRequest);

      const valueField = document.createElement('label');
      valueField.textContent = 'Riktig verdi på tallinjen';
      const valueInput = document.createElement('input');
      valueInput.type = 'number';
      valueInput.step = 'any';
      valueInput.value = formatNumberInputValue(item.value);
      valueInput.addEventListener('input', () => {
        const raw = valueInput.value;
        if (!raw.trim()) return;
        const numericValue = Number(raw);
        if (!Number.isFinite(numericValue)) return;
        item.value = numericValue;
        if (item.lockPosition) {
          item.currentValue = numericValue;
          item.currentOffsetY = NaN;
          item.isPlaced = true;
        } else {
          const startVal = item.startPosition && Number.isFinite(item.startPosition.value)
            ? item.startPosition.value
            : numericValue;
          const offsetVal = item.startPosition && Number.isFinite(item.startPosition.offsetY)
            ? item.startPosition.offsetY
            : DEFAULT_DRAGGABLE_OFFSET_Y;
          item.currentValue = startVal;
          item.currentOffsetY = offsetVal;
          item.isPlaced = false;
        }
        scheduleDraggableEditorFocus(item.id, 'value', valueInput);
        render();
      });
      valueField.appendChild(valueInput);
      topGrid.appendChild(valueField);
      applyDraggableEditorFocus(valueInput, item.id, 'value', focusRequest);

      const startValueField = document.createElement('label');
      startValueField.textContent = 'Startverdi (x-posisjon)';
      const startValueInput = document.createElement('input');
      startValueInput.type = 'number';
      startValueInput.step = 'any';
      startValueInput.value = formatNumberInputValue(
        item.startPosition && Number.isFinite(item.startPosition.value) ? item.startPosition.value : item.value
      );
      startValueInput.disabled = isLocked;
      startValueInput.addEventListener('input', () => {
        if (item.lockPosition) return;
        const raw = startValueInput.value;
        if (!raw.trim()) return;
        const numericValue = Number(raw);
        if (!Number.isFinite(numericValue)) return;
        if (!item.startPosition || typeof item.startPosition !== 'object') {
          item.startPosition = { value: numericValue, offsetY: DEFAULT_DRAGGABLE_OFFSET_Y };
        }
        item.startPosition.value = numericValue;
        item.currentValue = numericValue;
        const offsetVal = item.startPosition && Number.isFinite(item.startPosition.offsetY)
          ? item.startPosition.offsetY
          : DEFAULT_DRAGGABLE_OFFSET_Y;
        item.currentOffsetY = offsetVal;
        item.isPlaced = false;
        scheduleDraggableEditorFocus(item.id, 'startValue', startValueInput);
        render();
      });
      startValueField.appendChild(startValueInput);
      topGrid.appendChild(startValueField);
      applyDraggableEditorFocus(startValueInput, item.id, 'startValue', focusRequest);

      const offsetField = document.createElement('label');
      offsetField.textContent = 'Vertikal forskyvning (i px)';
      const offsetInput = document.createElement('input');
      offsetInput.type = 'number';
      offsetInput.step = 'any';
      const currentOffset = item.startPosition && Number.isFinite(item.startPosition.offsetY)
        ? item.startPosition.offsetY
        : DEFAULT_DRAGGABLE_OFFSET_Y;
      offsetInput.value = Number.isFinite(currentOffset) ? String(currentOffset) : '';
      offsetInput.disabled = isLocked;
      offsetInput.addEventListener('input', () => {
        if (item.lockPosition) return;
        const raw = offsetInput.value;
        if (!raw.trim()) return;
        const numericValue = Number(raw);
        if (!Number.isFinite(numericValue)) return;
        if (!item.startPosition || typeof item.startPosition !== 'object') {
          item.startPosition = { value: item.value, offsetY: numericValue };
        }
        item.startPosition.offsetY = numericValue;
        item.currentOffsetY = numericValue;
        item.currentValue = item.startPosition && Number.isFinite(item.startPosition.value)
          ? item.startPosition.value
          : item.value;
        item.isPlaced = false;
        scheduleDraggableEditorFocus(item.id, 'offset', offsetInput);
        render();
      });
      offsetField.appendChild(offsetInput);
      bottomGrid.appendChild(offsetField);
      applyDraggableEditorFocus(offsetInput, item.id, 'offset', focusRequest);

      const lockField = document.createElement('label');
      lockField.className = 'checkbox';
      lockField.style.gridColumn = '1 / -1';
      const lockInput = document.createElement('input');
      lockInput.type = 'checkbox';
      lockInput.checked = isLocked;
      lockInput.addEventListener('change', () => {
        const checked = lockInput.checked;
        item.lockPosition = checked;
        if (checked) {
          const numericValue = Number(item.value);
          if (Number.isFinite(numericValue)) {
            item.currentValue = numericValue;
          }
          item.currentOffsetY = NaN;
          item.isPlaced = true;
        } else {
          const startVal = item.startPosition && Number.isFinite(item.startPosition.value)
            ? item.startPosition.value
            : item.value;
          const offsetVal = item.startPosition && Number.isFinite(item.startPosition.offsetY)
            ? item.startPosition.offsetY
            : DEFAULT_DRAGGABLE_OFFSET_Y;
          item.currentValue = Number.isFinite(startVal) ? startVal : item.currentValue;
          item.currentOffsetY = offsetVal;
          item.isPlaced = false;
        }
        scheduleDraggableEditorFocus(item.id, 'lockPosition', lockInput);
        render();
      });
      lockField.appendChild(lockInput);
      const lockLabel = document.createElement('span');
      lockLabel.textContent = 'Lås posisjon';
      lockField.appendChild(lockLabel);
      bottomGrid.appendChild(lockField);
      applyDraggableEditorFocus(lockInput, item.id, 'lockPosition', focusRequest);

      wrapper.appendChild(topGrid);
      wrapper.appendChild(bottomGrid);

      const actions = document.createElement('div');
      actions.className = 'draggable-config-actions';

      const resetButton = document.createElement('button');
      resetButton.type = 'button';
      resetButton.className = 'btn btn--ghost';
      resetButton.textContent = 'Tilbakestill posisjon';
      resetButton.addEventListener('click', () => {
        if (item.lockPosition) return;
        item.isPlaced = false;
        const startVal = item.startPosition && Number.isFinite(item.startPosition.value)
          ? item.startPosition.value
          : item.value;
        const offsetVal = item.startPosition && Number.isFinite(item.startPosition.offsetY)
          ? item.startPosition.offsetY
          : DEFAULT_DRAGGABLE_OFFSET_Y;
        item.currentValue = startVal;
        item.currentOffsetY = offsetVal;
        render();
      });
      resetButton.disabled = isLocked;
      actions.appendChild(resetButton);

      const removeButton = document.createElement('button');
      removeButton.type = 'button';
      removeButton.className = 'btn btn--danger';
      removeButton.textContent = 'Fjern';
      removeButton.addEventListener('click', () => {
        STATE.draggableItems.splice(index, 1);
        render();
      });
      actions.appendChild(removeButton);

      wrapper.appendChild(actions);
      draggableListContainer.appendChild(wrapper);
    });
  }

  function formatAltNumber(value) {
    if (!Number.isFinite(value)) return String(value);
    if (altNumberFormatter) return altNumberFormatter.format(value);
    return String(Math.round(value * 1e6) / 1e6);
  }

  function formatValueForStatus(value) {
    if (!Number.isFinite(value)) {
      return String(value);
    }
    const info = getLabelRenderInfo(value);
    if (info && typeof info.text === 'string' && info.text.trim()) {
      return info.text.trim();
    }
    return formatAltNumber(value);
  }

  function describeDraggableItem(item, index) {
    if (!item || typeof item !== 'object') {
      return `Element ${index + 1}`;
    }
    const label = typeof item.label === 'string' ? item.label.trim() : '';
    if (label) return label;
    const value = Number(item.value);
    if (Number.isFinite(value)) {
      return formatValueForStatus(value);
    }
    return `Element ${index + 1}`;
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
      const strong = document.createElement('strong');
      strong.textContent = heading;
      checkStatus.appendChild(strong);
    }
    if (Array.isArray(detailLines)) {
      detailLines.forEach(line => {
        if (!line) return;
        const div = document.createElement('div');
        div.textContent = line;
        checkStatus.appendChild(div);
      });
    }
  }

  function getCheckTolerance() {
    const spacing = getSnapSpacing();
    if (!Number.isFinite(spacing) || spacing <= 0) {
      return 1e-6;
    }
    return Math.max(spacing * 0.01, 1e-6);
  }

  function checkDraggablePlacements() {
    ensureStateDefaults();
    const items = Array.isArray(STATE.draggableItems) ? STATE.draggableItems : [];
    if (!items.length) {
      setCheckStatus('info', 'Ingen fasit er definert ennå.');
      return;
    }

    const tolerance = getCheckTolerance();
    const missing = [];
    const incorrect = [];
    let placedCorrectly = 0;

    items.forEach((item, index) => {
      const expected = Number(item && item.value);
      if (!Number.isFinite(expected)) {
        missing.push({ item, index });
        return;
      }
      const isPlaced = Boolean(item && item.isPlaced);
      const current = Number(item && item.currentValue);
      if (!isPlaced || !Number.isFinite(current)) {
        missing.push({ item, index });
        return;
      }
      const diff = Math.abs(current - expected);
      if (diff <= tolerance) {
        placedCorrectly += 1;
      } else {
        incorrect.push({ item, index, expected, current });
      }
    });

    if (!missing.length && !incorrect.length) {
      const heading = placedCorrectly === 1
        ? 'Elementet er riktig plassert!'
        : 'Alle elementene er riktig plassert!';
      setCheckStatus('success', heading);
      return;
    }

    const details = [];
    if (missing.length) {
      const names = missing.map(entry => describeDraggableItem(entry.item, entry.index));
      if (missing.length === 1) {
        details.push(`${names[0]} er ikke plassert ennå.`);
      } else {
        details.push(`${missing.length} elementer er ikke plassert: ${names.join(', ')}.`);
      }
    }
    if (incorrect.length) {
      incorrect.forEach(entry => {
        const name = describeDraggableItem(entry.item, entry.index);
        const expectedText = formatValueForStatus(entry.expected);
        const currentText = formatValueForStatus(entry.current);
        details.push(`${name} skal være ved ${expectedText}, men står ved ${currentText}.`);
      });
    }
    setCheckStatus('error', 'Ikke helt riktig ennå.', details);
  }

  function updateControlsFromState() {
    const activeElement = typeof document !== 'undefined' ? document.activeElement : null;
    if (fromInput && activeElement !== fromInput) {
      fromInput.value = formatNumberInputValue(STATE.from);
    }
    if (toInput && activeElement !== toInput) {
      toInput.value = formatNumberInputValue(STATE.to);
    }
    if (mainStepInput) mainStepInput.value = String(STATE.mainStep);
    if (subdivisionsInput) subdivisionsInput.value = String(STATE.subdivisions);
    if (numberTypeSelect) numberTypeSelect.value = STATE.numberType;
    if (decimalDigitsInput) {
      decimalDigitsInput.value = String(STATE.decimalDigits);
      decimalDigitsInput.disabled = STATE.numberType !== 'decimal';
    }
    if (labelFontSizeInput) labelFontSizeInput.value = String(STATE.labelFontSize);
    if (clampLineInput) clampLineInput.checked = Boolean(STATE.clampToRange);
    if (lockLineInput) {
      lockLineInput.checked = Boolean(STATE.lockLine);
      lockLineInput.disabled = Boolean(STATE.clampToRange);
    }
    if (svg) {
      const isLocked = Boolean(STATE.lockLine);
      svg.classList.toggle('is-draggable', !isLocked);
      if (isLocked) {
        svg.classList.remove('is-dragging');
      }
    }
  }

  function stopActiveDraggableDrag(options) {
    if (!activeDraggableSession) return;
    const session = activeDraggableSession;
    activeDraggableSession = null;
    if (session.element) {
      session.element.classList.remove('is-dragging');
    }
    if (svg && session.pointerId != null) {
      try {
        svg.releasePointerCapture(session.pointerId);
      } catch (err) {}
    }
    if (options && options.render) {
      render();
    }
  }

  function updateActiveDraggableTransform(session, x, y) {
    if (!session || !session.element) return;
    const tx = Number.isFinite(x) ? x : 0;
    const ty = Number.isFinite(y) ? y : 0;
    session.element.setAttribute('transform', `translate(${tx}, ${ty})`);
    session.element.dataset.x = String(tx);
    session.element.dataset.y = String(ty);
  }

  function handleDraggablePointerDown(event) {
    if (!svg) return;
    const target = event.currentTarget;
    if (!target || !target.dataset) return;
    const index = Number(target.dataset.index);
    if (!Number.isFinite(index) || index < 0) return;
    const item = STATE.draggableItems && STATE.draggableItems[index];
    if (!item) return;
    if (item.lockPosition) return;

    const point = getViewBoxPoint(event);
    if (!point) return;

    const width = Number(target.dataset.width) || DEFAULT_DRAGGABLE_WIDTH;
    const height = Number(target.dataset.height) || DEFAULT_DRAGGABLE_HEIGHT;
    const currentX = Number(target.dataset.x) || 0;
    const currentY = Number(target.dataset.y) || 0;

    stopActiveDrag();
    stopActiveDraggableDrag();

    activeDraggableSession = {
      pointerId: event.pointerId,
      index,
      offsetX: point.x - currentX,
      offsetY: point.y - currentY,
      width,
      height,
      element: target,
      currentX,
      currentY
    };

    target.classList.add('is-dragging');

    try {
      svg.setPointerCapture(event.pointerId);
    } catch (err) {}

    if (typeof event.stopPropagation === 'function') event.stopPropagation();
    if (typeof event.preventDefault === 'function') event.preventDefault();
  }

  function handleActiveDraggablePointerMove(event) {
    if (!activeDraggableSession || event.pointerId !== activeDraggableSession.pointerId) return false;
    const point = getViewBoxPoint(event);
    if (!point) return false;

    const newX = point.x - activeDraggableSession.offsetX;
    const newY = point.y - activeDraggableSession.offsetY;
    activeDraggableSession.currentX = newX;
    activeDraggableSession.currentY = newY;
    updateActiveDraggableTransform(activeDraggableSession, newX, newY);

    if (typeof event.preventDefault === 'function') event.preventDefault();
    return true;
  }

  function finalizeActiveDraggableDrag(commit) {
    if (!activeDraggableSession) return;
    const session = activeDraggableSession;
    const item = STATE.draggableItems && STATE.draggableItems[session.index];
    const geometry = currentGeometry;
    const width = Number.isFinite(session.width) ? session.width : DEFAULT_DRAGGABLE_WIDTH;
    const height = Number.isFinite(session.height) ? session.height : DEFAULT_DRAGGABLE_HEIGHT;
    const datasetX = session.element && session.element.dataset ? Number(session.element.dataset.x) : null;
    const x = Number.isFinite(session.currentX)
      ? session.currentX
      : Number.isFinite(datasetX)
        ? datasetX
        : 0;

    stopActiveDraggableDrag();

    if (!commit || !item || !geometry) {
      render();
      return;
    }

    const clampToRange = Boolean(STATE.clampToRange);
    const paddingLeft = clampToRange ? PADDING_LEFT : 0;
    const domainSpan = geometry.domainMax - geometry.domainMin;
    const ratio = geometry.innerWidth > 0 ? (x + width / 2 - paddingLeft) / geometry.innerWidth : 0;
    let domainValue = geometry.domainMin + ratio * domainSpan;
    if (!Number.isFinite(domainValue)) domainValue = item.currentValue;

    let snapped = snapValueToNearest(domainValue);
    if (!Number.isFinite(snapped)) snapped = domainValue;
    if (clampToRange) {
      snapped = Math.min(Math.max(snapped, STATE.from), STATE.to);
    }

    item.currentValue = snapped;
    item.isPlaced = true;
    const placedOffset = computePlacedOffset(height);
    item.currentOffsetY = placedOffset;

    render();
  }

  function handleActiveDraggablePointerEnd(event) {
    if (!activeDraggableSession || event.pointerId !== activeDraggableSession.pointerId) return false;
    finalizeActiveDraggableDrag(true);
    if (typeof event.preventDefault === 'function') event.preventDefault();
    return true;
  }

  function handleActiveDraggablePointerCancel(event) {
    if (!activeDraggableSession || event.pointerId !== activeDraggableSession.pointerId) return false;
    stopActiveDraggableDrag();
    render();
    if (typeof event.preventDefault === 'function') event.preventDefault();
    return true;
  }

  function handleSvgPointerCancel(event) {
    if (handleActiveDraggablePointerCancel(event)) return;
    handlePointerEnd(event);
  }

  function handleSvgLostPointerCapture() {
    stopActiveDraggableDrag();
    stopActiveDrag();
  }

  function stopActiveDrag() {
    if (!activeDragSession) return;
    try {
      if (svg) svg.releasePointerCapture(activeDragSession.pointerId);
    } catch (err) {
      // ignore
    }
    if (svg) {
      svg.classList.remove('is-dragging');
    }
    activeDragSession = null;
  }

  function handlePointerDown(event) {
    if (!svg || STATE.lockLine) return;
    if (event.button != null && event.button !== 0) return;
    const geometry = currentGeometry;
    if (!geometry) return;
    const rect = svg.getBoundingClientRect();
    if (!rect || rect.width <= 0) return;
    const domainSpan = geometry.domainMax - geometry.domainMin;
    if (!Number.isFinite(domainSpan) || !(geometry.innerWidth > 0)) return;
    const pxToValue = (domainSpan / geometry.innerWidth) * (FIGURE_WIDTH / rect.width);
    if (!Number.isFinite(pxToValue) || pxToValue === 0) return;

    stopActiveDrag();
    activeDragSession = {
      pointerId: event.pointerId,
      startClientX: event.clientX,
      startFrom: STATE.from,
      startTo: STATE.to,
      pxToValue
    };

    svg.classList.add('is-dragging');
    try {
      svg.setPointerCapture(event.pointerId);
    } catch (err) {
      // ignore
    }
    if (typeof event.preventDefault === 'function') event.preventDefault();
  }

  function handlePointerMove(event) {
    if (handleActiveDraggablePointerMove(event)) return;
    if (!activeDragSession || event.pointerId !== activeDragSession.pointerId) return;
    const deltaClientX = event.clientX - activeDragSession.startClientX;
    const deltaValue = deltaClientX * activeDragSession.pxToValue;
    if (!Number.isFinite(deltaValue)) return;

    let newFrom = activeDragSession.startFrom - deltaValue;
    let newTo = activeDragSession.startTo - deltaValue;
    if (!Number.isFinite(newFrom) || !Number.isFinite(newTo)) return;

    const digitLimit = getActiveDecimalDigitLimit();
    if (digitLimit != null) {
      newFrom = roundToDecimalDigits(newFrom, digitLimit);
      newTo = roundToDecimalDigits(newTo, digitLimit);
    }

    if (STATE.from === newFrom && STATE.to === newTo) return;
    STATE.from = newFrom;
    STATE.to = newTo;
    render();
    if (typeof event.preventDefault === 'function') event.preventDefault();
  }

  function handlePointerEnd(event) {
    if (handleActiveDraggablePointerEnd(event)) return;
    if (!activeDragSession || event.pointerId !== activeDragSession.pointerId) return;
    stopActiveDrag();
    if (typeof event.preventDefault === 'function') event.preventDefault();
  }

  function mk(name, attrs) {
    const el = document.createElementNS(SVG_NS, name);
    if (attrs) {
      for (const [key, value] of Object.entries(attrs)) {
        if (value == null) continue;
        if (key === 'textContent') {
          el.textContent = value;
        } else {
          el.setAttribute(key, value);
        }
      }
    }
    return el;
  }

  function computeMajorValues(from, to, step, margin = 0, includeRangeEndpoints = true) {
    const stepAbs = Math.abs(step);
    const epsilon = Math.max(stepAbs * 1e-7, 1e-9);
    const roundingFactor = 1e9;
    const entryMap = new Map();

    const setEntry = (candidate, source) => {
      if (!Number.isFinite(candidate)) return;
      const rounded = Math.round(candidate * roundingFactor) / roundingFactor;
      const existing = entryMap.get(rounded);
      if (!existing) {
        entryMap.set(rounded, { value: rounded, source });
        return;
      }
      if (existing.source !== 'grid' && source === 'grid') {
        existing.source = 'grid';
      }
    };

    if (stepAbs > 0) {
      const minValue = Math.min(from, to) - margin;
      const maxValue = Math.max(from, to) + margin;
      const start = Math.floor((minValue - epsilon) / step) * step;
      const approxCount = Math.floor((maxValue - minValue) / stepAbs) + 5;
      const maxIterations = Math.min(5000, Math.max(approxCount, 1));
      for (let i = 0; i < maxIterations; i++) {
        const value = start + step * i;
        if (value > maxValue + epsilon) break;
        if (value >= minValue - epsilon) {
          setEntry(value, 'grid');
        }
      }
    }

    if (includeRangeEndpoints) {
      setEntry(from, 'endpoint');
      setEntry(to, 'endpoint');
    }

    const entries = Array.from(entryMap.values());
    entries.sort((a, b) => a.value - b.value);

    const values = [];
    const endpointValues = new Set();
    for (const entry of entries) {
      if (values.length && Math.abs(entry.value - values[values.length - 1]) <= epsilon) {
        if (endpointValues.has(values[values.length - 1]) && entry.source === 'grid') {
          endpointValues.delete(values[values.length - 1]);
        }
        continue;
      }
      values.push(entry.value);
      if (entry.source !== 'grid') {
        endpointValues.add(entry.value);
      }
    }

    return { values, endpointValues };
  }

  function computeRangeMargin(from, to, mainStep, subdivisions, clampToRange) {
    if (clampToRange) return 0;
    const stepAbs = Math.abs(mainStep);
    if (stepAbs > 0) {
      if (subdivisions > 0) {
        return (stepAbs / (subdivisions + 1)) * 2;
      }
      return stepAbs / 2;
    }
    const span = to - from;
    const effectiveRange = Math.max(Math.abs(span), 1e-6);
    if (effectiveRange > 0) return effectiveRange * 0.1;
    return 1;
  }

  function getAxisGeometry(from, to, margin, clampToRange) {
    const domainMin = clampToRange ? from : from - margin;
    const domainMax = clampToRange ? to : to + margin;
    const paddingLeft = clampToRange ? PADDING_LEFT : 0;
    const paddingRight = clampToRange ? PADDING_RIGHT : 0;
    const innerWidth = FIGURE_WIDTH - paddingLeft - paddingRight;
    const mapValue = value => {
      if (domainMax === domainMin) return paddingLeft + innerWidth / 2;
      const ratio = (value - domainMin) / (domainMax - domainMin);
      return paddingLeft + ratio * innerWidth;
    };
    const axisStartValue = clampToRange ? from : domainMin;
    const axisEndValue = clampToRange ? to : domainMax;
    const baseLineStartX = clampToRange ? mapValue(axisStartValue) : 0;
    const baseLineEndX = clampToRange ? mapValue(axisEndValue) : FIGURE_WIDTH;
    return {
      domainMin,
      domainMax,
      innerWidth,
      mapValue,
      axisStartValue,
      axisEndValue,
      baseLineStartX,
      baseLineEndX
    };
  }

  function extendMajorValues(baseValues, options) {
    const {
      clampToRange,
      mainStep,
      mapValue,
      baseLineStartX,
      baseLineEndX,
      axisStartValue,
      axisEndValue
    } = options || {};
    let result = [];
    let endpointValues = new Set();

    if (Array.isArray(baseValues)) {
      result = baseValues.slice();
    } else if (baseValues && Array.isArray(baseValues.values)) {
      result = baseValues.values.slice();
      const baseEndpoints = baseValues.endpointValues;
      if (baseEndpoints instanceof Set) {
        endpointValues = new Set(baseEndpoints);
      } else if (Array.isArray(baseEndpoints)) {
        endpointValues = new Set(baseEndpoints);
      }
    }

    if (clampToRange || !result.length) {
      return { values: result, endpointValues };
    }
    const spacing = Math.abs(mainStep);
    if (!(spacing > 1e-9)) {
      return { values: result, endpointValues };
    }
    const epsilon = Math.max(spacing * 1e-7, 1e-9);
    const pxTolerance = 0.5;
    const roundingFactor = 1e9;

    let iterations = 0;
    let value = result[0] - spacing;
    while (iterations < 10000) {
      const x = mapValue(value);
      if (!Number.isFinite(x) || x < baseLineStartX - pxTolerance) break;
      const rounded = Math.round(value * roundingFactor) / roundingFactor;
      if (Number.isFinite(axisStartValue) && rounded < axisStartValue - epsilon) break;
      if (!result.some(existing => Math.abs(existing - rounded) <= epsilon)) {
        result.unshift(rounded);
        endpointValues.delete(rounded);
      }
      value -= spacing;
      iterations++;
    }

    iterations = 0;
    value = result[result.length - 1] + spacing;
    while (iterations < 10000) {
      const x = mapValue(value);
      if (!Number.isFinite(x) || x > baseLineEndX + pxTolerance) break;
      const rounded = Math.round(value * roundingFactor) / roundingFactor;
      if (Number.isFinite(axisEndValue) && rounded > axisEndValue + epsilon) break;
      if (!result.some(existing => Math.abs(existing - rounded) <= epsilon)) {
        result.push(rounded);
        endpointValues.delete(rounded);
      }
      value += spacing;
      iterations++;
    }

    return { values: result, endpointValues };
  }

  function normalizeMajorInfo(info) {
    if (Array.isArray(info)) {
      return {
        values: info.slice(),
        hiddenArray: [],
        hiddenSet: new Set()
      };
    }
    const values = info && Array.isArray(info.values) ? info.values.slice() : [];
    let hiddenArray = [];
    if (info) {
      if (info.endpointValues instanceof Set) {
        hiddenArray = Array.from(info.endpointValues);
      } else if (Array.isArray(info.endpointValues)) {
        hiddenArray = info.endpointValues.slice();
      }
    }
    const hiddenSet = new Set(hiddenArray);
    return { values, hiddenArray, hiddenSet };
  }

  function render() {
    ensureStateDefaults();
    updateControlsFromState();
    renderDraggableEditor();

    const { from, to, mainStep, subdivisions } = STATE;
    const clampToRange = Boolean(STATE.clampToRange);
    const margin = computeRangeMargin(from, to, mainStep, subdivisions, clampToRange);
    const geometry = getAxisGeometry(from, to, margin, clampToRange);
    currentGeometry = geometry;
    const baseMajorValues = computeMajorValues(
      from,
      to,
      Math.max(mainStep, 1e-9),
      margin,
      clampToRange
    );
    const majorInfo = extendMajorValues(baseMajorValues, {
      clampToRange,
      mainStep,
      mapValue: geometry.mapValue,
      baseLineStartX: geometry.baseLineStartX,
      baseLineEndX: geometry.baseLineEndX,
      axisStartValue: geometry.axisStartValue,
      axisEndValue: geometry.axisEndValue
    });
    const normalizedMajor = normalizeMajorInfo(majorInfo);
    const majorValues = normalizedMajor.values;
    const hiddenMajorValues = normalizedMajor.hiddenSet;

    while (svg.firstChild) {
      svg.removeChild(svg.firstChild);
    }
    pendingKatexLabels.clear();

    const width = FIGURE_WIDTH;
    const baselineY = BASELINE_Y;
    const minorTickHeight = MINOR_TICK_HEIGHT;
    const majorTickHeight = MAJOR_TICK_HEIGHT;
    const labelOffset = 52 + (STATE.labelFontSize - BASE_LABEL_FONT_SIZE) * 1.2;

    const { mapValue, axisStartValue, axisEndValue, baseLineStartX, baseLineEndX } = geometry;

    const axisGroup = mk('g');
    svg.appendChild(axisGroup);

    axisGroup.appendChild(mk('line', {
      x1: baseLineStartX,
      y1: baselineY,
      x2: baseLineEndX,
      y2: baselineY,
      class: 'number-line-base'
    }));

    if (!clampToRange) {
      const arrowSize = 16;
      axisGroup.appendChild(mk('path', {
        d: `M ${baseLineEndX} ${baselineY} l -${arrowSize} -${arrowSize / 2} v ${arrowSize} z`,
        class: 'number-line-arrow'
      }));
    }

    const drawMinorTick = value => {
      const x = mapValue(value);
      axisGroup.appendChild(mk('line', {
        x1: x,
        y1: baselineY - minorTickHeight,
        x2: x,
        y2: baselineY + minorTickHeight,
        class: 'minor-tick'
      }));
    };

    if (subdivisions > 0 && majorValues.length > 1) {
      const spacing = Math.abs(mainStep) / (subdivisions + 1);
      const epsilon = Math.abs(spacing) * 1e-7 + 1e-9;
      if (spacing > 0) {
        for (let i = 0; i < majorValues.length - 1; i++) {
          const start = majorValues[i];
          const end = majorValues[i + 1];
          if (!(Number.isFinite(start) && Number.isFinite(end))) continue;
          const direction = end >= start ? 1 : -1;
          let value = start + spacing * direction;
          let count = 0;
          while (
            count < subdivisions &&
            ((direction > 0 && value < end - epsilon) ||
              (direction < 0 && value > end + epsilon))
          ) {
            drawMinorTick(value);
            value += spacing * direction;
            count++;
          }
        }
      }
    }

    if (!clampToRange && subdivisions > 0 && majorValues.length) {
      const spacing = Math.abs(mainStep) / (subdivisions + 1);
      const epsilon = Math.abs(spacing) * 1e-7 + 1e-9;
      if (spacing > 0) {
        let value = majorValues[0] - spacing;
        while (value > axisStartValue + epsilon) {
          drawMinorTick(value);
          value -= spacing;
        }

        value = majorValues[majorValues.length - 1] + spacing;
        while (value < axisEndValue - epsilon) {
          drawMinorTick(value);
          value += spacing;
        }
      }
    }

    majorValues.forEach(value => {
      if (hiddenMajorValues.has(value)) return;
      const x = mapValue(value);
      axisGroup.appendChild(mk('line', {
        x1: x,
        y1: baselineY - majorTickHeight,
        x2: x,
        y2: baselineY + majorTickHeight,
        class: 'major-tick'
      }));
      const labelWidth = Math.max(STATE.labelFontSize * 4, 120);
      const labelHeight = Math.max(STATE.labelFontSize * 1.8, 48);
      const labelCenterY = baselineY + labelOffset;
      const foreignObject = mk('foreignObject', {
        x: x - labelWidth / 2,
        y: labelCenterY - labelHeight / 2,
        width: labelWidth,
        height: labelHeight,
        class: 'major-label-fo'
      });
      const container = document.createElementNS('http://www.w3.org/1999/xhtml', 'div');
      container.className = 'major-label';
      container.style.fontSize = `${STATE.labelFontSize}px`;
      renderLabelContent(container, value);
      foreignObject.appendChild(container);
      axisGroup.appendChild(foreignObject);
    });

    renderDraggableItemsLayer(svg, geometry);

    const visibleMajorValues = majorValues.filter(value => !hiddenMajorValues.has(value));

    lastRenderSummary = {
      from,
      to,
      mainStep,
      subdivisions,
      majorValues: visibleMajorValues,
      hiddenMajorValues: normalizedMajor.hiddenArray.slice(),
      allMajorValues: majorValues.slice(),
      clampToRange,
      margin
    };

    flushPendingKatex();
    refreshAltText('render');
  }

  function getNumberTypeLabel() {
    switch (STATE.numberType) {
      case 'decimal':
        return 'desimaltall';
      case 'fraction':
        return 'brøker';
      case 'mixedFraction':
        return 'blandete tall';
      case 'improperFraction':
        return 'uekte brøker';
      default:
        return 'heltall';
    }
  }

  function buildTallinjeAltText() {
    const clampSetting = Boolean(STATE.clampToRange);
    const margin = computeRangeMargin(
      STATE.from,
      STATE.to,
      STATE.mainStep,
      STATE.subdivisions,
      clampSetting
    );
    const fallbackGeometry = getAxisGeometry(
      STATE.from,
      STATE.to,
      margin,
      clampSetting
    );
    const summary = lastRenderSummary || (() => {
      const fallbackMajorInfo = extendMajorValues(
        computeMajorValues(
          STATE.from,
          STATE.to,
          Math.max(STATE.mainStep, 1e-9),
          margin,
          clampSetting
        ),
        {
          clampToRange: clampSetting,
          mainStep: STATE.mainStep,
          mapValue: fallbackGeometry.mapValue,
          baseLineStartX: fallbackGeometry.baseLineStartX,
          baseLineEndX: fallbackGeometry.baseLineEndX,
          axisStartValue: fallbackGeometry.axisStartValue,
          axisEndValue: fallbackGeometry.axisEndValue
        }
      );
      const normalizedFallback = normalizeMajorInfo(fallbackMajorInfo);
      const fallbackVisible = normalizedFallback.values.filter(
        value => !normalizedFallback.hiddenSet.has(value)
      );
      return {
        from: STATE.from,
        to: STATE.to,
        mainStep: STATE.mainStep,
        subdivisions: STATE.subdivisions,
        clampToRange: clampSetting,
        margin,
        majorValues: fallbackVisible,
        hiddenMajorValues: normalizedFallback.hiddenArray.slice(),
        allMajorValues: normalizedFallback.values.slice()
      };
    })();
    if (!summary || !Array.isArray(summary.majorValues) || !summary.majorValues.length) {
      return 'Tallinjen viser ingen markeringer.';
    }
    const { from, to, mainStep, subdivisions, majorValues, clampToRange } = summary;
    const typeLabel = getNumberTypeLabel();
    const parts = [];
    parts.push(`Tallinjen viser området fra ${formatAltNumber(from)} til ${formatAltNumber(to)}.`);
    const majorCount = majorValues.length;
    if (majorCount === 1) {
      parts.push('Det er én hovedmarkering.');
    } else {
      parts.push(`Det er ${majorCount} hovedmarkeringer med omtrent ${formatAltNumber(mainStep)} enhet mellom.`);
    }
    if (subdivisions > 0) {
      parts.push(`Hver hovedmarkering er delt i ${subdivisions} delmarkeringer.`);
    } else {
      parts.push('Ingen delmarkeringer er aktivert.');
    }
    if (clampToRange) {
      parts.push('Tallinjen stopper ved start- og sluttverdien.');
    } else {
      parts.push('Tallinjen har ekstra plass med markeringer foran og bak start og stopp.');
    }
    parts.push(`Tallene vises som ${typeLabel}.`);
    return parts.join(' ');
  }

  function getTallinjeTitle() {
    const summary = lastRenderSummary;
    if (!summary || !Array.isArray(summary.majorValues)) return document.title || 'Tallinje';
    const count = summary.majorValues.length;
    const base = document.title || 'Tallinje';
    if (!count) return base;
    return `${base} – ${count} markering${count === 1 ? '' : 'er'}`;
  }

  function ensureAltTextManager() {
    if (altTextManager || typeof window === 'undefined' || !window.MathVisAltText || !exportCard) return;
    altTextManager = window.MathVisAltText.create({
      svg,
      container: exportCard,
      getTitle: getTallinjeTitle,
      getState: () => ({
        text: typeof STATE.altText === 'string' ? STATE.altText : '',
        source: STATE.altTextSource === 'manual' ? 'manual' : 'auto'
      }),
      setState: (text, source) => {
        STATE.altText = typeof text === 'string' ? text : '';
        STATE.altTextSource = source === 'manual' ? 'manual' : 'auto';
      },
      generate: () => buildTallinjeAltText(),
      getSignature: () => buildTallinjeAltText(),
      getAutoMessage: reason => reason && reason.startsWith('manual') ? 'Alternativ tekst oppdatert.' : 'Alternativ tekst oppdatert automatisk.',
      getManualMessage: () => 'Alternativ tekst oppdatert manuelt.'
    });
    if (altTextManager) {
      altTextManager.applyCurrent();
    }
  }

  function refreshAltText(reason) {
    if (typeof window === 'undefined' || !window.MathVisAltText) return;
    ensureAltTextManager();
    const signature = buildTallinjeAltText();
    if (altTextManager) {
      if (typeof altTextManager.refresh === 'function') {
        altTextManager.refresh(reason || 'auto', signature);
      } else if (typeof altTextManager.notifyFigureChange === 'function') {
        altTextManager.notifyFigureChange(signature);
      }
    } else {
      const nodes = window.MathVisAltText.ensureSvgA11yNodes(svg);
      if (nodes && nodes.descEl) nodes.descEl.textContent = buildTallinjeAltText();
      if (nodes && nodes.titleEl) nodes.titleEl.textContent = getTallinjeTitle();
    }
  }

  function svgToString(svgEl) {
    const clone = svgEl.cloneNode(true);
    clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
    clone.setAttribute('xmlns:xlink', 'http://www.w3.org/1999/xlink');
    return '<?xml version="1.0" encoding="UTF-8"?>\n' + new XMLSerializer().serializeToString(clone);
  }

  function downloadSVG(svgEl, filename) {
    const data = svgToString(svgEl);
    const blob = new Blob([data], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename.endsWith('.svg') ? filename : `${filename}.svg`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  function downloadPNG(svgEl, filename, scale = 2, background = '#ffffff') {
    const vb = svgEl.viewBox.baseVal;
    const width = vb && vb.width ? vb.width : svgEl.clientWidth || 1000;
    const height = vb && vb.height ? vb.height : svgEl.clientHeight || 260;
    const data = svgToString(svgEl);
    const blob = new Blob([data], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = Math.round(width * scale);
      canvas.height = Math.round(height * scale);
      const ctx = canvas.getContext('2d');
      ctx.fillStyle = background;
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      URL.revokeObjectURL(url);
      canvas.toBlob(blobData => {
        if (!blobData) return;
        const pngUrl = URL.createObjectURL(blobData);
        const a = document.createElement('a');
        a.href = pngUrl;
        a.download = filename.endsWith('.png') ? filename : `${filename}.png`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        setTimeout(() => URL.revokeObjectURL(pngUrl), 1000);
      }, 'image/png');
    };
    img.src = url;
  }

  if (fromInput) {
    fromInput.addEventListener('input', () => {
      const rawValue = fromInput.value;
      const numericValue = Number(rawValue);
      if (!Number.isFinite(numericValue)) return;
      let finalValue = numericValue;
      const digitLimit = getActiveDecimalDigitLimit();
      if (digitLimit != null) {
        finalValue = roundToDecimalDigits(numericValue, digitLimit);
        if (countDecimalDigitsInInput(rawValue) > digitLimit) {
          const formatted = formatNumberInputValue(finalValue);
          if (fromInput.value !== formatted) fromInput.value = formatted;
        }
      }
      STATE.from = finalValue;
      render();
    });
  }

  if (toInput) {
    toInput.addEventListener('input', () => {
      const rawValue = toInput.value;
      const numericValue = Number(rawValue);
      if (!Number.isFinite(numericValue)) return;
      let finalValue = numericValue;
      const digitLimit = getActiveDecimalDigitLimit();
      if (digitLimit != null) {
        finalValue = roundToDecimalDigits(numericValue, digitLimit);
        if (countDecimalDigitsInInput(rawValue) > digitLimit) {
          const formatted = formatNumberInputValue(finalValue);
          if (toInput.value !== formatted) toInput.value = formatted;
        }
      }
      STATE.to = finalValue;
      render();
    });
  }

  if (mainStepInput) {
    mainStepInput.addEventListener('input', () => {
      const value = Number(mainStepInput.value);
      if (!Number.isFinite(value)) return;
      STATE.mainStep = value;
      render();
    });
  }

  if (subdivisionsInput) {
    subdivisionsInput.addEventListener('input', () => {
      const value = Number(subdivisionsInput.value);
      if (!Number.isFinite(value)) return;
      STATE.subdivisions = Math.max(0, Math.round(value));
      render();
    });
  }

  if (numberTypeSelect) {
    numberTypeSelect.addEventListener('change', () => {
      const value = numberTypeSelect.value;
      if (VALID_NUMBER_TYPES.has(value)) {
        STATE.numberType = value;
        render();
      } else if (value in LEGACY_NUMBER_TYPE_MAP) {
        STATE.numberType = LEGACY_NUMBER_TYPE_MAP[value];
        render();
      }
    });
  }

  if (decimalDigitsInput) {
    decimalDigitsInput.addEventListener('input', () => {
      const value = Number(decimalDigitsInput.value);
      if (!Number.isFinite(value)) return;
      STATE.decimalDigits = Math.max(0, Math.min(6, Math.round(value)));
      if (STATE.numberType === 'decimal') {
        const digitLimit = getActiveDecimalDigitLimit();
        if (digitLimit != null) {
          STATE.from = roundToDecimalDigits(STATE.from, digitLimit);
          STATE.to = roundToDecimalDigits(STATE.to, digitLimit);
        }
      }
      render();
    });
  }

  if (labelFontSizeInput) {
    labelFontSizeInput.addEventListener('input', () => {
      const value = Number(labelFontSizeInput.value);
      if (!Number.isFinite(value)) return;
      STATE.labelFontSize = Math.min(Math.max(value, 8), 72);
      render();
    });
  }

  if (clampLineInput) {
    clampLineInput.addEventListener('change', () => {
      STATE.clampToRange = clampLineInput.checked;
      if (STATE.clampToRange) {
        if (!STATE.lockLine) stopActiveDrag();
        STATE.lockLine = true;
      }
      render();
    });
  }

  if (lockLineInput) {
    lockLineInput.addEventListener('change', () => {
      STATE.lockLine = lockLineInput.checked;
      if (STATE.lockLine) stopActiveDrag();
      render();
    });
  }

  if (addDraggableButton) {
    addDraggableButton.addEventListener('click', () => {
      let baseValue = Number(STATE.from);
      if (!Number.isFinite(baseValue)) baseValue = 0;
      const newItem = {
        id: `draggable-${draggableIdCounter++}`,
        label: '',
        value: baseValue,
        startPosition: { value: baseValue, offsetY: DEFAULT_DRAGGABLE_OFFSET_Y },
        currentValue: baseValue,
        currentOffsetY: DEFAULT_DRAGGABLE_OFFSET_Y,
        isPlaced: false,
        lockPosition: false
      };
      if (!Array.isArray(STATE.draggableItems)) {
        STATE.draggableItems = [];
      }
      STATE.draggableItems.push(newItem);
      render();
      if (draggableListContainer) {
        setTimeout(() => {
          const lastInput = draggableListContainer.querySelector('.draggable-config-item:last-of-type input[type="text"]');
          if (lastInput && typeof lastInput.focus === 'function') {
            lastInput.focus();
          }
        }, 0);
      }
    });
  }

  if (checkButton) {
    checkButton.addEventListener('click', () => {
      checkDraggablePlacements();
    });
  }

  if (svg) {
    svg.addEventListener('pointerdown', handlePointerDown);
    svg.addEventListener('pointermove', handlePointerMove);
    svg.addEventListener('pointerup', handlePointerEnd);
    svg.addEventListener('pointercancel', handleSvgPointerCancel);
    svg.addEventListener('lostpointercapture', handleSvgLostPointerCapture);
  }

  if (btnSvg) {
    btnSvg.addEventListener('click', () => downloadSVG(svg, 'tallinje.svg'));
  }

  if (btnPng) {
    btnPng.addEventListener('click', () => downloadPNG(svg, 'tallinje.png'));
  }

  window.render = render;

  ensureStateDefaults();
  render();
  if (document.readyState === 'complete') {
    flushPendingKatex();
  } else {
    window.addEventListener('load', flushPendingKatex, { once: true });
  }
  ensureAltTextManager();

})();
