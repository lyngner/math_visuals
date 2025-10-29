/* =========================================================
   KONFIG – forfatter styrer alt her
   ========================================================= */
const CFG = {
  type: 'stacked',
  title: 'Skjermtid i 7A',
  labels: ['1', '2', '3', '4', '5', '6', '7'],
  series1: 'Gutter',
  start: [2, 5, 4, 2, 3, 1, 0],
  answer: [2, 5, 4, 2, 3, 1, 0],
  yMin: 0,
  yMax: 9,
  snap: 1,
  tolerance: 0,
  axisXLabel: 'Timer per dag',
  axisYLabel: 'Antall elever',
  valueDisplay: 'none',
  pieLabelPosition: 'outside',
  locked: [],
  altText: '',
  altTextSource: 'auto',
  series2: 'Jenter',
  start2: [2, 3, 3, 1, 1, 1, 0],
  answer2: [2, 3, 3, 1, 1, 1, 0]
};
const VALUE_DISPLAY_OPTIONS = ['none', 'number', 'fraction', 'percent'];
const PIE_LABEL_POSITIONS = ['outside', 'inside'];
function sanitizeValueDisplay(value) {
  if (typeof value !== 'string') return 'none';
  const normalized = value.trim().toLowerCase();
  return VALUE_DISPLAY_OPTIONS.includes(normalized) ? normalized : 'none';
}
function sanitizePieLabelPosition(value) {
  if (typeof value !== 'string') return 'outside';
  const normalized = value.trim().toLowerCase();
  return PIE_LABEL_POSITIONS.includes(normalized) ? normalized : 'outside';
}
function getValueDisplayMode(type = CFG.type) {
  const mode = sanitizeValueDisplay(CFG.valueDisplay);
  return type === 'stacked' ? 'none' : mode;
}
const EMERGENCY_SERIES_COLORS = ['#574595', '#d081a1'];
const EMERGENCY_PIE_PALETTE = ['#4f2c8c', '#6c3db5', '#8a4de0', '#a75cf1', '#c26ef0', '#d381ba', '#c46287', '#9f436d', '#723a82', '#503070'];
const PIE_COLOR_CLASS_COUNT = 10;
const DIAGRAM_GROUP_SLOT_COUNT = 3 + PIE_COLOR_CLASS_COUNT;
const LEGACY_AXIS_COLOR = '#0f172a';
const LEGACY_GRID_COLOR = '#999999';
const LEGACY_TEXT_COLOR = '#333333';
const LEGACY_BAR_STROKE = '#000000';
const LEGACY_HANDLE_FILL = '#f1f1f7';
const LEGACY_HANDLE_STROKE = '#555555';
const LEGACY_FOCUS_OUTLINE = '#1e88e5';
const LEGACY_FIGURE_BACKGROUND = '#fafbfc';
const LEGACY_FIGURE_BORDER = '#eef0f3';
const LEGACY_CANVAS_BACKGROUND = '#ffffff';
const LEGACY_VALUE_COLOR = '#111111';
const LEGACY_PIE_LABEL_COLOR = '#333333';
const LEGACY_LEGEND_BACKGROUND = '#ffffff';
const LEGACY_LEGEND_TEXT_COLOR = '#000000';
const LEGACY_LEGEND_BORDER = '#d1d5db';
function resolveDragHandleIcon() {
  if (typeof document === 'undefined') {
    return 'images/draggable.svg';
  }
  const current = document.currentScript && document.currentScript.src ? document.currentScript.src : null;
  if (current) {
    try {
      return new URL('images/draggable.svg', current).toString();
    } catch (_) {}
  }
  if (document.baseURI) {
    try {
      return new URL('images/draggable.svg', document.baseURI).toString();
    } catch (_) {}
  }
  if (typeof window !== 'undefined' && window.location && window.location.href) {
    try {
      return new URL('images/draggable.svg', window.location.href).toString();
    } catch (_) {}
  }
  return 'images/draggable.svg';
}
const DRAG_HANDLE_ICON = resolveDragHandleIcon();
const DRAG_HANDLE_SIZE = 36;
const XLINK_NS = 'http://www.w3.org/1999/xlink';
let themePaletteSize = Array.isArray(CFG.labels) ? CFG.labels.length : 0;
function getThemeApi() {
  const theme = typeof window !== 'undefined' ? window.MathVisualsTheme : null;
  return theme && typeof theme === 'object' ? theme : null;
}

function getPaletteApi() {
  const root = typeof window !== 'undefined' ? window : typeof globalThis !== 'undefined' ? globalThis : null;
  if (!root || typeof root !== 'object') return null;
  const palette = root.MathVisualsPalette;
  return palette && typeof palette.getGroupPalette === 'function' ? palette : null;
}

function getActiveThemeProjectName(theme = getThemeApi()) {
  if (!theme || typeof theme.getActiveProfileName !== 'function') return null;
  try {
    const value = theme.getActiveProfileName();
    if (typeof value === 'string' && value.trim()) {
      return value.trim().toLowerCase();
    }
  } catch (_) {}
  return null;
}

function sanitizeThemePaletteValue(value) {
  if (typeof value !== 'string') return '';
  const trimmed = value.trim();
  return trimmed || '';
}
function getThemeColor(token, fallback) {
  const theme = getThemeApi();
  if (theme && typeof theme.getColor === 'function') {
    try {
      const value = theme.getColor(token, fallback);
      if (typeof value === 'string' && value.trim()) {
        return value.trim();
      }
    } catch (_) {}
  }
  return typeof fallback === 'string' && fallback.trim() ? fallback.trim() : undefined;
}
function ensurePalette(base, count, fallback) {
  const sanitizeList = values => {
    if (!Array.isArray(values)) return [];
    const result = [];
    for (const value of values) {
      const sanitized = sanitizeThemePaletteValue(value);
      if (sanitized) {
        result.push(sanitized);
      }
    }
    return result;
  };
  const basePalette = sanitizeList(base);
  const fallbackPalette = basePalette.length ? [] : sanitizeList(fallback);
  const source = basePalette.length ? basePalette : fallbackPalette;
  if (!source.length) {
    return [];
  }
  if (!Number.isFinite(count) || count <= 0) {
    return source.slice();
  }
  const size = Math.max(1, Math.trunc(count));
  const result = [];
  for (let index = 0; index < size; index += 1) {
    result.push(source[index % source.length]);
  }
  return result;
}

function buildEmergencyGroupPalette() {
  const base = EMERGENCY_SERIES_COLORS[0] || '#574595';
  const first = EMERGENCY_SERIES_COLORS[0] || base;
  const second = EMERGENCY_SERIES_COLORS[1] || first;
  return [base, first, second, ...EMERGENCY_PIE_PALETTE];
}
function withAlphaColor(color, alpha, fallback) {
  const normalized = typeof color === 'string' ? color.trim() : '';
  if (/^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(normalized)) {
    const hex = normalized.slice(1);
    const channels = hex.length === 3
      ? hex.split('').map(c => parseInt(c + c, 16))
      : [
          parseInt(hex.slice(0, 2), 16),
          parseInt(hex.slice(2, 4), 16),
          parseInt(hex.slice(4, 6), 16)
        ];
    if (channels.every(v => Number.isFinite(v))) {
      return `rgba(${channels[0]}, ${channels[1]}, ${channels[2]}, ${alpha})`;
    }
  }
  if (/^rgb\s*\(/i.test(normalized)) {
    const parts = normalized
      .replace(/rgba?\(|\)|\s+/gi, '')
      .split(',')
      .slice(0, 3)
      .map(Number);
    if (parts.length === 3 && parts.every(v => Number.isFinite(v))) {
      return `rgba(${parts[0]}, ${parts[1]}, ${parts[2]}, ${alpha})`;
    }
  }
  return fallback;
}
function setCssVariable(name, value, style) {
  if (typeof document === 'undefined' || typeof name !== 'string' || !name) return;
  const root = document.documentElement;
  const targetStyle = style || (root ? root.style : null);
  if (!targetStyle) return;
  if (typeof value === 'string' && value.trim()) {
    targetStyle.setProperty(name, value.trim());
  } else {
    targetStyle.removeProperty(name);
  }
}
function applyDiagramTheme(options = {}) {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;
  if (!root) return;
  const style = root.style;
  const theme = getThemeApi();
  const activeProfileNameRaw =
    theme && typeof theme.getActiveProfileName === 'function'
      ? theme.getActiveProfileName()
      : null;
  const normalizedProfileName = getActiveThemeProjectName(theme) || (typeof activeProfileNameRaw === 'string' ? activeProfileNameRaw.trim().toLowerCase() : '');
  const requestedSeriesCount = Math.max(1, Number.isFinite(options.seriesCount) ? Math.trunc(options.seriesCount) : 1);
  const requestedPaletteSize = Math.max(
    requestedSeriesCount,
    Number.isFinite(options.paletteSize) && options.paletteSize > 0 ? Math.trunc(options.paletteSize) : PIE_COLOR_CLASS_COUNT
  );
  let seriesPalette = [];
  let piePalette = [];
  const paletteApi = getPaletteApi();
  const paletteRequest = {
    count: Math.max(requestedPaletteSize, DIAGRAM_GROUP_SLOT_COUNT),
    project: normalizedProfileName || undefined
  };
  let groupPalette = [];
  if (paletteApi) {
    try {
      groupPalette = paletteApi.getGroupPalette('diagram', paletteRequest) || [];
    } catch (_) {
      groupPalette = [];
    }
  }
  if ((!Array.isArray(groupPalette) || !groupPalette.length) && theme && typeof theme.getGroupPalette === 'function') {
    try {
      groupPalette = theme.getGroupPalette('diagram', paletteRequest) || [];
    } catch (_) {
      groupPalette = [];
    }
  }
  const sanitizedGroupPalette = Array.isArray(groupPalette)
    ? groupPalette.map(sanitizeThemePaletteValue).filter(color => !!color)
    : [];
  const hasGroupPalette = sanitizedGroupPalette.length > 0;
  const emergencyGroupPalette = hasGroupPalette ? [] : buildEmergencyGroupPalette();
  const paletteEntries = ensurePalette(sanitizedGroupPalette, DIAGRAM_GROUP_SLOT_COUNT, emergencyGroupPalette);
  const singleSeriesColor =
    paletteEntries[0] || paletteEntries[1] || paletteEntries[2] || emergencyGroupPalette[0] || EMERGENCY_SERIES_COLORS[0];
  const multiSeriesColors = [
    paletteEntries[1] || singleSeriesColor,
    paletteEntries[2] || paletteEntries[1] || singleSeriesColor
  ];
  const seriesBase = requestedSeriesCount <= 1 ? [singleSeriesColor] : multiSeriesColors;
  const seriesFallback = hasGroupPalette ? [] : EMERGENCY_SERIES_COLORS;
  seriesPalette = ensurePalette(seriesBase, requestedSeriesCount, seriesFallback);
  const pieBase = paletteEntries.slice(3, 3 + PIE_COLOR_CLASS_COUNT);
  const pieFallback = hasGroupPalette ? [] : EMERGENCY_PIE_PALETTE;
  piePalette = ensurePalette(pieBase, PIE_COLOR_CLASS_COUNT, pieFallback);
  for (let i = 0; i < seriesPalette.length; i++) {
    setCssVariable(`--diagram-series-${i}`, seriesPalette[i], style);
    setCssVariable(`--diagram-line-series-${i}`, seriesPalette[i], style);
  }
  for (let i = seriesPalette.length; i < 4; i++) {
    style.removeProperty(`--diagram-series-${i}`);
    style.removeProperty(`--diagram-line-series-${i}`);
  }
  for (let i = 0; i < PIE_COLOR_CLASS_COUNT; i++) {
    setCssVariable(`--diagram-pie-${i}`, piePalette[i], style);
  }
  setCssVariable('--diagram-axis-color', getThemeColor('graphs.axis', LEGACY_AXIS_COLOR), style);
  setCssVariable('--diagram-axis-text-color', getThemeColor('graphs.axis', LEGACY_AXIS_COLOR), style);
  setCssVariable('--diagram-grid-color', getThemeColor('graphs.axis', LEGACY_GRID_COLOR), style);
  const primaryColor = getThemeColor('ui.primary', null);
  const resolvedTextColor = primaryColor || LEGACY_TEXT_COLOR;
  setCssVariable('--diagram-text-color', resolvedTextColor, style);
  setCssVariable('--diagram-pie-label-color', primaryColor || LEGACY_PIE_LABEL_COLOR, style);
  setCssVariable('--diagram-value-color', primaryColor || LEGACY_VALUE_COLOR, style);
  const barStrokeColor = normalizedProfileName === 'kikora' ? 'transparent' : (primaryColor || LEGACY_BAR_STROKE);
  setCssVariable('--diagram-bar-stroke', barStrokeColor, style);
  setCssVariable('--diagram-handle-fill', getThemeColor('ui.secondary', LEGACY_HANDLE_FILL), style);
  setCssVariable('--diagram-handle-stroke', primaryColor || LEGACY_HANDLE_STROKE, style);
  setCssVariable('--diagram-focus-outline', getThemeColor('ui.hover', LEGACY_FOCUS_OUTLINE), style);
  setCssVariable('--diagram-figure-background', getThemeColor('ui.secondary', LEGACY_FIGURE_BACKGROUND), style);
  const figureBorder = primaryColor ? withAlphaColor(primaryColor, 0.35, LEGACY_FIGURE_BORDER) : LEGACY_FIGURE_BORDER;
  setCssVariable('--diagram-figure-border', figureBorder, style);
  setCssVariable('--diagram-canvas-background', getThemeColor('ui.surface', LEGACY_CANVAS_BACKGROUND), style);
  setCssVariable('--diagram-legend-background', LEGACY_LEGEND_BACKGROUND, style);
  setCssVariable('--diagram-legend-text-color', LEGACY_LEGEND_TEXT_COLOR, style);
  setCssVariable('--diagram-legend-border', LEGACY_LEGEND_BORDER, style);
}

function getEffectiveSeriesCount() {
  return series2Enabled && CFG.type !== 'pie' ? 2 : 1;
}

function getEffectivePaletteSize() {
  const explicit = Number.isFinite(themePaletteSize) && themePaletteSize > 0 ? Math.trunc(themePaletteSize) : 0;
  const labelCount = Array.isArray(CFG.labels) ? CFG.labels.length : 0;
  const fallback = labelCount > 0 ? labelCount : 1;
  return Math.max(1, explicit || fallback);
}

function refreshDiagramTheme() {
  applyDiagramTheme({ paletteSize: getEffectivePaletteSize(), seriesCount: getEffectiveSeriesCount() });
}
/* =========================================================
   OPPSETT
   ========================================================= */
const svg = document.getElementById('barsvg');
const W = 900,
  H = 560;
const M = {
  l: 80,
  r: 30,
  t: 40,
  b: 70
};
const innerW = W - M.l - M.r;
const innerH = H - M.t - M.b;

/* Lagrekkefølge: grid, akser, dataserier, håndtak, a11y, verdier (øverst), labels, legend */
const gGrid = add('g');
const gAxis = add('g');
const gBars = add('g');
const gHands = add('g');
const gA11y = add('g');
const gVals = add('g');
const gLabels = add('g');
const gLegend = add('g');

function positionHandleIcon(handle, cx, cy, size) {
  if (!handle) return;
  let resolvedSize = Number.isFinite(size) ? size : undefined;
  if (!resolvedSize) {
    const attr = handle.getAttribute ? handle.getAttribute('data-handle-size') : null;
    const parsed = attr ? Number.parseFloat(attr) : NaN;
    resolvedSize = Number.isFinite(parsed) ? parsed : DRAG_HANDLE_SIZE;
  }
  const half = resolvedSize / 2;
  handle.setAttribute('x', cx - half);
  handle.setAttribute('y', cy - half);
}

function createDragHandle(group, cx, cy, dataset = {}) {
  const handle = addTo(group, 'image', {
    href: DRAG_HANDLE_ICON,
    width: DRAG_HANDLE_SIZE,
    height: DRAG_HANDLE_SIZE,
    class: 'handle',
    'data-handle-size': DRAG_HANDLE_SIZE,
    draggable: 'false',
    focusable: 'false'
  });
  positionHandleIcon(handle, cx, cy, DRAG_HANDLE_SIZE);
  if (handle && handle.dataset && dataset && typeof dataset === 'object') {
    Object.entries(dataset).forEach(([key, value]) => {
      handle.dataset[key] = value;
    });
  }
  if (handle) {
    handle.setAttribute('tabindex', '-1');
    handle.setAttribute('preserveAspectRatio', 'xMidYMid meet');
    handle.addEventListener('pointerdown', onDragStart);
  }
  return handle;
}

let values = [];
let values2 = null;
let series2Enabled = false;
let seriesNames = [];
let locked = [];
let N = 0;
let yMin = 0;
let yMax = 0;
let yStep = 1;
refreshDiagramTheme();
if (typeof MutationObserver === 'function' && typeof document !== 'undefined' && document.documentElement) {
  const themeObserver = new MutationObserver(() => {
    refreshDiagramTheme();
  });
  themeObserver.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme-profile'] });
}
if (typeof window !== 'undefined' && typeof window.addEventListener === 'function') {
  window.addEventListener('math-visuals:settings-changed', () => {
    refreshDiagramTheme();
  });
  window.addEventListener('math-visuals:profile-change', () => {
    refreshDiagramTheme();
  });
  window.addEventListener('message', event => {
    const data = event && event.data;
    const type = typeof data === 'string' ? data : data && data.type;
    if (type !== 'math-visuals:profile-change') return;
    refreshDiagramTheme();
  });
}
const btnSvg = document.getElementById('btnSvg');
const btnPng = document.getElementById('btnPng');
btnSvg === null || btnSvg === void 0 || btnSvg.addEventListener('click', () => downloadSVG(svg, 'diagram.svg'));
btnPng === null || btnPng === void 0 || btnPng.addEventListener('click', () => downloadPNG(svg, 'diagram.png', 2));
const altTextField = document.getElementById('altText');
const altTextStatus = document.getElementById('altTextStatus');
const regenerateAltTextBtn = document.getElementById('btnRegenerateAltText');
const checkBtn = document.getElementById('btnCheck');
const statusEl = document.getElementById('status');
  const taskCheckHost = typeof document !== 'undefined' ? document.querySelector('[data-task-check-host]') : null;
  const taskCheckControls = [checkBtn, statusEl].filter(Boolean);

  function evaluateDescriptionInputs() {
    if (typeof window === 'undefined') return;
    const mv = window.mathVisuals;
    if (!mv || typeof mv.evaluateTaskInputs !== 'function') return;
    try {
      mv.evaluateTaskInputs();
    } catch (_) {}
  }

function ensureTaskControlsHost() {
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
    ensureTaskControlsHost();
    taskCheckHost.hidden = false;
    taskCheckControls.forEach(control => {
      if (!control) return;
      if (control === checkBtn) {
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

  applyAppModeToTaskControls(getCurrentAppMode() || 'task');

if (typeof window !== 'undefined' && typeof window.addEventListener === 'function') {
  window.addEventListener('math-visuals:app-mode-changed', event => {
    if (!event) return;
    const detail = event.detail;
    if (!detail || typeof detail.mode !== 'string') return;
    applyAppModeToTaskControls(detail.mode);
  });
}
let altTextGenerationTimer = null;
let altTextAbortController = null;
if (altTextField) {
  altTextField.addEventListener('input', () => {
    const text = altTextField.value.trim();
    if (altTextGenerationTimer) {
      clearTimeout(altTextGenerationTimer);
      altTextGenerationTimer = null;
    }
    if (altTextAbortController && typeof altTextAbortController.abort === 'function') {
      try {
        altTextAbortController.abort();
      } catch (error) {}
      altTextAbortController = null;
    }
    CFG.altText = text;
    CFG.altTextSource = text ? 'manual' : 'auto';
    applyAltTextToSvg(text);
    if (text) {
      setAltTextStatus('Alternativ tekst oppdatert manuelt.', false);
    } else {
      setAltTextStatus('Feltet er tomt. Generer gjerne en ny tekst.', false);
      scheduleAltTextUpdate('manual', 0);
    }
  });
}
if (regenerateAltTextBtn) {
  regenerateAltTextBtn.addEventListener('click', () => {
    CFG.altTextSource = 'auto';
    scheduleAltTextUpdate('manual', 0);
  });
}
const addSeriesBtn = document.getElementById('addSeries');
const removeSeriesBtn = document.getElementById('removeSeries');
const series2Fields = document.getElementById('series2Fields');
const axisAndRangeRow = document.getElementById('cfgAxisAndRangeRow');
addSeriesBtn === null || addSeriesBtn === void 0 || addSeriesBtn.addEventListener('click', () => {
  series2Enabled = true;
  addSeriesBtn.style.display = 'none';
  if (series2Fields) series2Fields.style.display = '';
  if (removeSeriesBtn) removeSeriesBtn.style.display = '';
  applyCfg();
});
if (removeSeriesBtn) {
  removeSeriesBtn.addEventListener('click', () => {
    series2Enabled = false;
    if (series2Fields) series2Fields.style.display = 'none';
    if (addSeriesBtn) addSeriesBtn.style.display = '';
    removeSeriesBtn.style.display = 'none';
    CFG.series2 = undefined;
    CFG.start2 = null;
    CFG.answer2 = null;
    const series2Input = document.getElementById('cfgSeries2');
    const start2Input = document.getElementById('cfgStart2');
    const answer2Input = document.getElementById('cfgAnswer2');
    if (series2Input) series2Input.value = '';
    if (start2Input) start2Input.value = '';
    if (answer2Input) answer2Input.value = '';
    applyCfg();
  });
}

function setRowVisibility(row, visible) {
  if (!row) return;
  row.style.display = visible ? '' : 'none';
  const interactiveElements = row.querySelectorAll('input, select, textarea, button');
  interactiveElements.forEach(el => {
    el.disabled = !visible;
  });
  if (!visible) {
    row.setAttribute('aria-hidden', 'true');
  } else {
    row.removeAttribute('aria-hidden');
  }
}

function updateSettingsVisibilityForType(type) {
  const showAxisSettings = type !== 'pie';
  setRowVisibility(axisAndRangeRow, showAxisSettings);
  const lockedField = document.getElementById('cfgLocked');
  const snapField = document.getElementById('cfgSnap');
  const toleranceField = document.getElementById('cfgTolerance');
  const answerField = document.getElementById('cfgAnswer');
  const answerField2 = document.getElementById('cfgAnswer2');
  const lockedLabel = lockedField ? lockedField.closest('label') : null;
  const snapLabel = snapField ? snapField.closest('label') : null;
  const toleranceLabel = toleranceField ? toleranceField.closest('label') : null;
  const answerLabel = answerField ? answerField.closest('label') : null;
  const answerLabel2 = answerField2 ? answerField2.closest('label') : null;
  const showCommonSettings = type !== 'pie';
  setRowVisibility(lockedLabel, showCommonSettings);
  setRowVisibility(snapLabel, showCommonSettings);
  setRowVisibility(toleranceLabel, showCommonSettings);
  setRowVisibility(answerLabel, showCommonSettings);
  setRowVisibility(answerLabel2, showCommonSettings);
}
// skalaer
let xBand = 0;
let barW = 0;
function xPos(i) {
  return M.l + xBand * i + xBand / 2;
}
function yPos(v) {
  if (yMax === yMin) return M.t + innerH / 2;
  return M.t + innerH - (v - yMin) / (yMax - yMin) * innerH;
}

// husk sist fokusert søyle mellom redraw
let lastFocusIndex = null;
initFromCfg();
function initFromCfg() {
  var _CFG$yMax;
  const hasSeries2Config = Array.isArray(CFG.start2) && CFG.start2.length > 0 || Array.isArray(CFG.answer2) && CFG.answer2.length > 0 || typeof CFG.series2 === 'string' && CFG.series2.trim().length > 0;
  series2Enabled = hasSeries2Config;
  values = CFG.start.slice();
  values2 = series2Enabled && CFG.start2 ? CFG.start2.slice() : null;
  seriesNames = [CFG.series1 || '', series2Enabled ? CFG.series2 || '' : ''];
  CFG.valueDisplay = sanitizeValueDisplay(CFG.valueDisplay);
  CFG.pieLabelPosition = sanitizePieLabelPosition(CFG.pieLabelPosition);
  N = CFG.labels.length;
  themePaletteSize = Math.max(1, N);
  refreshDiagramTheme();
  xBand = innerW / N;
  barW = xBand * 0.6;
  const allVals = [...CFG.start, ...(CFG.start2 || []), ...(CFG.answer || []), ...(CFG.answer2 || [])];
  const scale = computeScaleBounds(allVals, CFG.yMin, CFG.yMax);
  yMin = scale.min;
  yMax = scale.max;
  yStep = scale.step;
  if (Array.isArray(CFG.locked) && CFG.locked.length) {
    const normalizedLocked = CFG.locked.map(v => !!v);
    locked = alignLength(normalizedLocked, N, true);
  } else {
    locked = Array(N).fill(true);
  }
  CFG.locked = locked.slice();
  lastFocusIndex = null;
  document.getElementById('chartTitle').textContent = CFG.title || '';
  const typeInput = document.getElementById('cfgType');
  const titleInput = document.getElementById('cfgTitle');
  const labelsInput = document.getElementById('cfgLabels');
  const lockedInput = document.getElementById('cfgLocked');
  const yMinInput = document.getElementById('cfgYMin');
  const yMaxInput = document.getElementById('cfgYMax');
  const axisXInput = document.getElementById('cfgAxisXLabel');
  const axisYInput = document.getElementById('cfgAxisYLabel');
  const snapInput = document.getElementById('cfgSnap');
  const tolInput = document.getElementById('cfgTolerance');
  const valueDisplaySelect = document.getElementById('cfgValueDisplay');
  const valueDisplayWrapper = document.getElementById('cfgValueDisplayWrapper');
  const pieLabelPositionWrapper = document.getElementById('cfgPieLabelPositionWrapper');
  const pieLabelPositionSelect = document.getElementById('cfgPieLabelPosition');
  const series1Input = document.getElementById('cfgSeries1');
  const startInput = document.getElementById('cfgStart');
  const answerInput = document.getElementById('cfgAnswer');
  const series2Input = document.getElementById('cfgSeries2');
  const start2Input = document.getElementById('cfgStart2');
  const answer2Input = document.getElementById('cfgAnswer2');
  if (titleInput) titleInput.value = CFG.title || '';
  if (labelsInput) labelsInput.value = (CFG.labels || []).join(',');
  if (lockedInput) {
    const showFlags = locked.map(v => !v);
    const lockedStr = showFlags.some(Boolean) ? showFlags.map(v => v ? '1' : '0').join(',') : '';
    lockedInput.value = lockedStr;
  }
  if (yMinInput) yMinInput.value = Number.isFinite(CFG.yMin) ? formatNumber(CFG.yMin) : '';
  if (yMaxInput) yMaxInput.value = Number.isFinite(CFG.yMax) ? formatNumber(CFG.yMax) : '';
  if (axisXInput) axisXInput.value = CFG.axisXLabel || '';
  if (axisYInput) axisYInput.value = CFG.axisYLabel || '';
  if (snapInput) snapInput.value = Number.isFinite(CFG.snap) ? formatNumber(CFG.snap) : '';
  if (tolInput) tolInput.value = Number.isFinite(CFG.tolerance) ? formatNumber(CFG.tolerance) : '';
  if (series1Input) series1Input.value = CFG.series1 || '';
  if (startInput) startInput.value = formatNumberList(values);
  if (answerInput) answerInput.value = formatNumberList(CFG.answer || []);
  if (addSeriesBtn) {
    addSeriesBtn.style.display = series2Enabled ? 'none' : '';
  }
  if (series2Fields) {
    series2Fields.style.display = series2Enabled ? '' : 'none';
  }
  if (removeSeriesBtn) {
    removeSeriesBtn.style.display = series2Enabled ? '' : 'none';
  }
  if (series2Input) series2Input.value = series2Enabled ? CFG.series2 || '' : '';
  if (start2Input) start2Input.value = series2Enabled && Array.isArray(values2) ? formatNumberList(values2) : '';
  if (answer2Input) answer2Input.value = series2Enabled && Array.isArray(CFG.answer2) ? formatNumberList(CFG.answer2) : '';
  if (valueDisplaySelect) valueDisplaySelect.value = CFG.valueDisplay;
  if (pieLabelPositionSelect) pieLabelPositionSelect.value = CFG.pieLabelPosition;
  if (typeof CFG.altText !== 'string') CFG.altText = '';
  if (typeof CFG.altTextSource !== 'string') {
    CFG.altTextSource = CFG.altText ? 'manual' : 'auto';
  }
  if (altTextField) altTextField.value = CFG.altText || '';
  applyAltTextToSvg(CFG.altText || '');

  // disable stacking/grouping options when only one dataserie
  const typeSel = typeInput;
  const hasTwo = values2 && values2.length;
  if (typeSel) {
    [...typeSel.options].forEach(opt => {
      if (opt.value === 'pie') {
        opt.disabled = !!hasTwo;
      } else if (!hasTwo && (opt.value === 'stacked' || opt.value === 'grouped')) {
        opt.disabled = true;
      } else {
        opt.disabled = false;
      }
    });
    const order = hasTwo ? ['bar', 'grouped', 'stacked', 'line', 'pie'] : ['bar', 'line', 'pie', 'grouped', 'stacked'];
    order.forEach(val => {
      const opt = typeSel.querySelector(`option[value="${val}"]`);
      if (opt) typeSel.appendChild(opt);
    });
    const allowedTypes = hasTwo ? ['bar', 'grouped', 'stacked', 'line'] : ['bar', 'line', 'pie'];
    const desiredType = allowedTypes.includes(CFG.type) ? CFG.type : 'bar';
    typeSel.value = desiredType;
    CFG.type = desiredType;
    if (valueDisplaySelect) {
      valueDisplaySelect.disabled = CFG.type === 'stacked';
    }
    if (valueDisplayWrapper) {
      valueDisplayWrapper.style.display = CFG.type === 'stacked' ? 'none' : '';
    }
    if (pieLabelPositionWrapper) {
      pieLabelPositionWrapper.style.display = CFG.type === 'pie' ? '' : 'none';
    }
    if (pieLabelPositionSelect) {
      pieLabelPositionSelect.disabled = CFG.type !== 'pie';
      pieLabelPositionSelect.value = CFG.pieLabelPosition;
    }
  }
  updateSettingsVisibilityForType(CFG.type);
  drawAxesAndGrid();
  drawData();
  let statusMessage = '';
  if ((CFG.type === 'bar' || CFG.type === 'line') && !hasTwo) {
    statusMessage = 'Dra i søylene/punktene – eller bruk tastaturet.';
  } else if (CFG.type === 'pie') {
    statusMessage = 'Dra i sektorene – eller bruk tastaturet.';
  }
  updateStatus(statusMessage, 'info');
  scheduleAltTextUpdate('config');
}

/* =========================================================
   RENDER
   ========================================================= */
function drawAxesAndGrid() {
  gGrid.innerHTML = '';
  gAxis.innerHTML = '';
  gLabels.innerHTML = '';
  if (CFG.type === 'pie') {
    return;
  }
  const step = yStep || niceStep(yMax - yMin || 1);
  const maxTicks = 500;
  for (let i = 0; i < maxTicks; i++) {
    const raw = yMin + step * i;
    if (raw > yMax + step * 0.5) break;
    const value = normalizeTickValue(raw);
    const yy = yPos(value);
    addTo(gGrid, 'line', {
      x1: M.l,
      y1: yy,
      x2: W - M.r,
      y2: yy,
      class: 'gridline'
    });
    addTo(gGrid, 'text', {
      x: M.l - 10,
      y: yy + 4,
      class: 'yTickText'
    }).textContent = formatTickValue(value);
  }

  const createAxisLabelGroup = (parent, textValue, options = {}) => {
    const { anchor = 'middle' } = options;
    const parseOffset = value => {
      if (Number.isFinite(value)) return value;
      if (typeof value === 'string') {
        const parsed = Number.parseFloat(value);
        return Number.isFinite(parsed) ? parsed : null;
      }
      return null;
    };
    const resolvedOffsetX =
      parseOffset(options.offsetX) ?? parseOffset(options.paddingX) ?? 14;
    const resolvedOffsetY =
      parseOffset(options.offsetY) ?? parseOffset(options.paddingY) ?? 0;
    const group = addTo(parent, 'g', { class: 'axis-label-group' });
    group.setAttribute('pointer-events', 'none');
    const textEl = addTo(group, 'text', {
      class: 'axis-label-text',
      'text-anchor': anchor,
      'dominant-baseline': 'middle'
    });
    const rawText = typeof textValue === 'string' ? textValue : '';
    textEl.textContent = rawText;
    const hasVisibleText = rawText.trim().length > 0;
    const bbox = textEl.getBBox();
    if (!hasVisibleText) {
      group.setAttribute('display', 'none');
      return { group, text: textEl, rect: null, width: 0, height: 0 };
    }
    const width = Math.max(bbox.width, 0);
    const height = Math.max(bbox.height, 0);
    let textX = 0;
    if (anchor === 'start') {
      textX = resolvedOffsetX;
    } else if (anchor === 'end') {
      textX = -resolvedOffsetX;
    }
    const textY = resolvedOffsetY;
    textEl.setAttribute('x', textX);
    textEl.setAttribute('y', textY);
    return { group, text: textEl, rect: null, width, height };
  };

  // y-akse
  const yAxisGroup = addTo(gAxis, 'g', { class: 'axis-group axis-group--y' });
  const yArrowLength = 16;
  const yArrowHalfWidth = 8;
  const yLineStart = M.t - 12;
  addTo(yAxisGroup, 'line', {
    x1: M.l,
    y1: yLineStart,
    x2: M.l,
    y2: H - M.b,
    class: 'axis'
  });
  addTo(yAxisGroup, 'path', {
    d: `M ${M.l - yArrowHalfWidth} ${yLineStart} L ${M.l} ${yLineStart - yArrowLength} L ${M.l + yArrowHalfWidth} ${yLineStart}`,
    class: 'axis-arrow axis-arrow--y'
  });

  const yLabel = createAxisLabelGroup(yAxisGroup, CFG.axisYLabel || '', { anchor: 'middle' });
  if (yLabel.group) {
    const yLabelX = M.l - 56;
    const yLabelY = M.t + innerH / 2;
    yLabel.group.setAttribute('transform', `translate(${yLabelX} ${yLabelY}) rotate(-90)`);
  }

  // x-akse
  const baseValue = getBaselineValue();
  const axisY = yPos(baseValue);
  const xAxisGroup = addTo(gAxis, 'g', { class: 'axis-group axis-group--x' });
  const xArrowLength = 18;
  const xArrowHalfHeight = 8;
  const xLineEnd = W - M.r + 4;
  addTo(xAxisGroup, 'line', {
    x1: M.l,
    y1: axisY,
    x2: xLineEnd,
    y2: axisY,
    class: 'axis'
  });
  addTo(xAxisGroup, 'path', {
    d: `M ${xLineEnd} ${axisY - xArrowHalfHeight} L ${xLineEnd + xArrowLength} ${axisY} L ${xLineEnd} ${axisY + xArrowHalfHeight}`,
    class: 'axis-arrow axis-arrow--x'
  });

  const xLabel = createAxisLabelGroup(xAxisGroup, CFG.axisXLabel || '', { anchor: 'end' });
  if (xLabel.group) {
    const xLabelX = W - M.r;
    const xLabelY = axisY + 48;
    xLabel.group.setAttribute('transform', `translate(${xLabelX} ${xLabelY})`);
  }

  // x-etiketter
  const xTickLabelY = axisY + 18;
  CFG.labels.forEach((lab, i) => {
    addTo(gLabels, 'text', {
      x: xPos(i),
      y: xTickLabelY,
      class: 'xLabel',
      'dominant-baseline': 'hanging'
    }).textContent = lab;
  });
}
function drawData() {
  gBars.innerHTML = '';
  gVals.innerHTML = '';
  gHands.innerHTML = '';
  gA11y.innerHTML = '';
  gLegend.innerHTML = '';
  const displayMode = getValueDisplayMode();
  if (CFG.type === 'pie') {
    drawPie(displayMode);
    return;
  }
  const hasTwo = values2 && values2.length;
  if (CFG.type === 'line') {
    drawLines(displayMode);
  } else if (hasTwo && CFG.type === 'grouped') {
    drawGroupedBars(displayMode);
  } else if (hasTwo && CFG.type === 'stacked') {
    drawStackedBars();
  } else {
    drawBars(displayMode);
  }
  drawLegend();
}
function drawLegend() {
  const names = [];
  if (values2 && values2.length && seriesNames[1]) {
    names.push({ name: seriesNames[1], cls: 'series1' });
  }
  if (seriesNames[0]) {
    names.push({ name: seriesNames[0], cls: 'series0' });
  }
  if (!names.length) return;

  const legendLayout = CFG.type === 'grouped' && names.length > 1 ? 'horizontal' : 'vertical';
  let legendY = M.t - 28;
  const legendRoot = addTo(gLegend, 'g', {
    class: 'legend-root',
    transform: `translate(0 ${legendY})`
  });
  const frame = addTo(legendRoot, 'rect', {
    class: 'legend-frame'
  });
  const itemsGroup = addTo(legendRoot, 'g', {
    class: 'legend-items'
  });

  const swatchSize = 18;
  const textOffset = 10;
  const verticalGap = 8;
  const verticalSpacing = swatchSize + verticalGap;
  const separatorSpacing = 32;
  let horizontalCursor = 0;

  names.forEach((s, index) => {
    if (legendLayout === 'horizontal' && index > 0) {
      const separatorX = horizontalCursor + separatorSpacing / 2;
      addTo(itemsGroup, 'text', {
        x: separatorX,
        y: swatchSize / 2,
        class: 'legend-separator',
        'text-anchor': 'middle',
        'dominant-baseline': 'middle'
      }).textContent = '|';
      horizontalCursor += separatorSpacing;
    }

    const itemGroup = addTo(itemsGroup, 'g', {
      class: 'legend-item'
    });
    if (legendLayout === 'horizontal') {
      itemGroup.setAttribute('transform', `translate(${horizontalCursor} 0)`);
    } else {
      itemGroup.setAttribute('transform', `translate(0 ${index * verticalSpacing})`);
    }

    addTo(itemGroup, 'rect', {
      x: 0,
      y: 0,
      width: swatchSize,
      height: swatchSize,
      class: 'legendbox ' + s.cls,
      rx: 2,
      ry: 2
    });
    const text = addTo(itemGroup, 'text', {
      x: swatchSize + textOffset,
      y: swatchSize / 2,
      class: 'legendtext',
      'dominant-baseline': 'middle'
    });
    text.textContent = s.name;
    const textWidth = typeof text.getComputedTextLength === 'function' ? text.getComputedTextLength() : s.name.length * 8;
    if (legendLayout === 'horizontal') {
      horizontalCursor += swatchSize + textOffset + textWidth;
    }
  });

  const itemsBox = itemsGroup.getBBox();
  const paddingX = 14;
  const paddingY = 8;
  const frameX = itemsBox.x - paddingX;
  const frameY = itemsBox.y - paddingY;
  const frameWidth = itemsBox.width + paddingX * 2;
  const frameHeight = itemsBox.height + paddingY * 2;
  frame.setAttribute('x', frameX);
  frame.setAttribute('y', frameY);
  frame.setAttribute('width', frameWidth);
  frame.setAttribute('height', frameHeight);
  frame.setAttribute('rx', 8);
  frame.setAttribute('ry', 8);

  const minTop = 0;
  const maxBottom = M.t - 6;
  const topEdge = frameY;
  const bottomEdge = frameY + frameHeight;
  const minAllowed = minTop - topEdge;
  const maxAllowed = maxBottom - bottomEdge;
  if (minAllowed > maxAllowed) {
    const topCandidate = minAllowed;
    const bottomCandidate = maxAllowed;
    const bottomOverflow = Math.max(0, bottomEdge + topCandidate - maxBottom);
    const topOverflow = Math.max(0, minTop - (topEdge + bottomCandidate));
    legendY = bottomOverflow <= topOverflow ? topCandidate : bottomCandidate;
  } else {
    if (legendY < minAllowed) legendY = minAllowed;
    if (legendY > maxAllowed) legendY = maxAllowed;
  }
  const legendX = W - M.r - (frameX + frameWidth);
  legendRoot.setAttribute('transform', `translate(${legendX} ${legendY})`);
}
function drawLines(displayMode) {
  const datasets = [values];
  if (values2 && values2.length) datasets.push(values2);
  const baseValue = getBaselineValue();
  const baseY = yPos(baseValue);
  const totals = datasets.map(arr => computeSeriesTotal(arr));
  datasets.forEach((arr, idx) => {
    const multiSeries = datasets.length > 1;
    const offsetX = multiSeries ? (idx - (datasets.length - 1) / 2) * 14 : 0;
    const path = arr.map((v, i) => (i ? 'L' : 'M') + xPos(i) + ',' + yPos(v)).join(' ');
    addTo(gBars, 'path', {
      d: path,
      class: 'line series' + idx
    });
    arr.forEach((v, i) => {
      const cx = xPos(i);
      const cy = yPos(v);
      addTo(gBars, 'circle', {
        cx: cx,
        cy: cy,
        r: 4,
        class: 'line-dot series' + idx
      });
      if (!locked[i]) {
        createDragHandle(gHands, cx, cy, {
          index: i,
          series: idx,
          base: 0
        });
      }
      const a11y = addTo(gA11y, 'circle', {
        cx: cx,
        cy: cy,
        r: 20,
        fill: 'transparent',
        class: 'a11y',
        tabindex: 0,
        role: 'slider',
        'aria-orientation': 'vertical',
        'aria-label': `${CFG.labels[i]}`,
        'aria-valuemin': String(yMin),
        'aria-valuemax': String(yMax),
        'aria-valuenow': String(v),
        'aria-valuetext': `${CFG.labels[i]}: ${fmt(v)}`
      });
      if (locked[i]) a11y.setAttribute('aria-disabled', 'true');
      a11y.dataset.index = i;
      a11y.dataset.series = idx;
      a11y.dataset.base = 0;
      a11y.addEventListener('pointerdown', onDragStart);
      a11y.addEventListener('keydown', onKeyAdjust);
      if (displayMode !== 'none') {
        const share = computeValueShare(v, totals[idx]);
        placeValueLabel(cx, cy, v, displayMode, {
          baseY,
          series: idx,
          xOffset: offsetX,
          share
        });
      }
    });
  });
}
function drawPie(displayMode) {
  const count = values.length;
  if (!count) {
    const message = addTo(gLabels, 'text', {
      x: W / 2,
      y: H / 2,
      class: 'pie-label',
      'text-anchor': 'middle'
    });
    message.textContent = 'Ingen data';
    return;
  }
  const cx = M.l + innerW / 2;
  const cy = M.t + innerH / 2;
  const radius = Math.min(innerW, innerH) * 0.42;
  const sanitized = values.map(v => Math.max(0, Number.isFinite(v) ? v : 0));
  const total = sanitized.reduce((sum, v) => sum + v, 0);
  let currentAngle = -Math.PI / 2;
  const pieLabelPosition = sanitizePieLabelPosition(CFG.pieLabelPosition);
  const labelsInside = pieLabelPosition === 'inside';
  const labelRadius = radius * (labelsInside ? 0.6 : 1.15);
  const fallbackFraction = count ? 1 / count : 0;
  for (let i = 0; i < count; i++) {
    const value = sanitized[i];
    const share = total > 0 ? value / total : fallbackFraction;
    const sliceAngle = Math.max(0, share) * Math.PI * 2;
    const startAngle = currentAngle;
    const endAngle = currentAngle + sliceAngle;
    addTo(gGrid, 'line', {
      x1: cx,
      y1: cy,
      x2: cx + radius * Math.cos(startAngle),
      y2: cy + radius * Math.sin(startAngle),
      class: 'pie-divider'
    });
    const colorClass = 'pie-slice-' + (i % PIE_COLOR_CLASS_COUNT);
    const lockedCls = locked[i] ? ' locked' : '';
    const pathData = buildPieSlicePath(cx, cy, radius, startAngle, endAngle);
    const slice = addTo(gBars, 'path', {
      d: pathData,
      class: `pie-slice ${colorClass}${lockedCls}`
    });
    slice.dataset.index = i;
    slice.dataset.series = 0;
    slice.dataset.base = 0;
    if (!locked[i]) {
      slice.addEventListener('pointerdown', onDragStart);
    }
    const midAngle = startAngle + sliceAngle / 2;
    const lx = cx + labelRadius * Math.cos(midAngle);
    const ly = cy + labelRadius * Math.sin(midAngle);
    const label = typeof CFG.labels[i] === 'string' && CFG.labels[i].trim().length ? CFG.labels[i].trim() : `Kategori ${i + 1}`;
    const textAnchor = labelsInside ? 'middle' : lx >= cx ? 'start' : 'end';
    const baseline = labelsInside ? 'middle' : ly >= cy ? 'hanging' : 'auto';
    const textClass = `pie-label${labelsInside ? ' pie-label--inside' : ''}`;
    const textEl = addTo(gLabels, 'text', {
      x: lx,
      y: ly,
      class: textClass,
      'text-anchor': textAnchor,
      'dominant-baseline': baseline
    });
    textEl.textContent = label;
    const valueLineText = formatPieValueText(value, share, displayMode);
    if (valueLineText) {
      const valueLine = document.createElementNS(svg.namespaceURI, 'tspan');
      valueLine.setAttribute('x', lx);
      valueLine.setAttribute('dy', labelsInside ? '1.2em' : ly >= cy ? '1.1em' : '1.2em');
      valueLine.textContent = valueLineText;
      valueLine.setAttribute('class', 'pie-label__value');
      textEl.appendChild(valueLine);
    }
    const a11y = addTo(gA11y, 'path', {
      d: pathData,
      fill: 'transparent',
      class: 'a11y',
      tabindex: 0,
      role: 'slider',
      'aria-orientation': 'vertical',
      'aria-label': label,
      'aria-valuemin': String(Math.max(0, yMin)),
      'aria-valuemax': String(Math.max(Math.max(0, yMax), sanitized[i])),
      'aria-valuenow': String(values[i]),
      'aria-valuetext': `${label}: ${fmt(values[i])}`
    });
    if (locked[i]) a11y.setAttribute('aria-disabled', 'true');
    a11y.dataset.index = i;
    a11y.dataset.series = 0;
    a11y.dataset.base = 0;
    a11y.addEventListener('keydown', onKeyAdjust);
    if (!locked[i]) {
      a11y.addEventListener('pointerdown', onDragStart);
    }
    currentAngle = endAngle;
  }
  addTo(gGrid, 'line', {
    x1: cx,
    y1: cy,
    x2: cx + radius * Math.cos(currentAngle),
    y2: cy + radius * Math.sin(currentAngle),
    class: 'pie-divider'
  });
}
function drawGroupedBars(displayMode) {
  const hasTwo = values2 && values2.length;
  const barTotal = xBand * 0.6;
  const barSingle = hasTwo ? barTotal / 2 : barTotal;
  const baseValue = getBaselineValue();
  const baseY = yPos(baseValue);
  const total1 = computeSeriesTotal(values);
  const total2 = hasTwo ? computeSeriesTotal(values2) : 0;
  for (let i = 0; i < N; i++) {
    const x0 = xPos(i) - barTotal / 2;
    // serie 1
    const v1 = values[i];
    const y1 = yPos(v1);
    const rect1Y = Math.min(y1, baseY);
    const rect1H = Math.max(2, Math.abs(baseY - y1));
    const handleDir1 = y1 <= baseY ? -1 : 1;
    const rect1 = addTo(gBars, 'rect', {
      x: x0,
      y: rect1Y,
      width: barSingle,
      height: rect1H,
      class: 'bar series0' + (locked[i] ? ' locked' : '')
    });
    rect1.dataset.index = i;
    rect1.dataset.series = 0;
    rect1.dataset.base = 0;
    rect1.addEventListener('pointerdown', onDragStart);
    if (!locked[i]) {
      createDragHandle(gHands, x0 + barSingle / 2, y1 + handleDir1 * 2, {
        index: i,
        series: 0,
        base: 0
      });
    }
    const a1 = addTo(gA11y, 'rect', {
      x: x0,
      y: M.t,
      width: barSingle,
      height: innerH,
      fill: 'transparent',
      class: 'a11y',
      tabindex: 0,
      role: 'slider',
      'aria-orientation': 'vertical',
      'aria-label': `${CFG.labels[i]}`,
      'aria-valuemin': String(yMin),
      'aria-valuemax': String(yMax),
      'aria-valuenow': String(v1),
      'aria-valuetext': `${CFG.labels[i]}: ${fmt(v1)}`
    });
    if (locked[i]) a1.setAttribute('aria-disabled', 'true');
    a1.dataset.index = i;
    a1.dataset.series = 0;
    a1.dataset.base = 0;
    a1.addEventListener('pointerdown', onDragStart);
    a1.addEventListener('keydown', onKeyAdjust);
    if (displayMode !== 'none') {
      const share1 = computeValueShare(v1, total1);
      placeValueLabel(x0 + barSingle / 2, y1, v1, displayMode, {
        baseY,
        series: 0,
        share: share1
      });
    }

    if (hasTwo) {
      const v2 = values2[i];
      const y2 = yPos(v2);
      const x1 = x0 + barSingle;
      const rect2Y = Math.min(y2, baseY);
      const rect2H = Math.max(2, Math.abs(baseY - y2));
      const handleDir2 = y2 <= baseY ? -1 : 1;
      const rect2 = addTo(gBars, 'rect', {
        x: x1,
        y: rect2Y,
        width: barSingle,
        height: rect2H,
        class: 'bar series1' + (locked[i] ? ' locked' : '')
      });
      rect2.dataset.index = i;
      rect2.dataset.series = 1;
      rect2.dataset.base = 0;
      rect2.addEventListener('pointerdown', onDragStart);
      if (!locked[i]) {
        createDragHandle(gHands, x1 + barSingle / 2, y2 + handleDir2 * 2, {
          index: i,
          series: 1,
          base: 0
        });
      }
      const a2 = addTo(gA11y, 'rect', {
        x: x1,
        y: M.t,
        width: barSingle,
        height: innerH,
        fill: 'transparent',
        class: 'a11y',
        tabindex: 0,
        role: 'slider',
        'aria-orientation': 'vertical',
        'aria-label': `${CFG.labels[i]}`,
        'aria-valuemin': String(yMin),
        'aria-valuemax': String(yMax),
        'aria-valuenow': String(v2),
        'aria-valuetext': `${CFG.labels[i]}: ${fmt(v2)}`
      });
      if (locked[i]) a2.setAttribute('aria-disabled', 'true');
      a2.dataset.index = i;
      a2.dataset.series = 1;
      a2.dataset.base = 0;
      a2.addEventListener('pointerdown', onDragStart);
      a2.addEventListener('keydown', onKeyAdjust);
      if (displayMode !== 'none') {
        const share2 = computeValueShare(v2, total2);
        placeValueLabel(x1 + barSingle / 2, y2, v2, displayMode, {
          baseY,
          series: 1,
          share: share2
        });
      }
    }
  }
}
function drawStackedBars() {
  const barTotal = xBand * 0.6;
  const baseValue = getBaselineValue();
  const baseY = yPos(baseValue);
  for (let i = 0; i < N; i++) {
    const v1 = values[i];
    const v2 = values2 ? values2[i] : 0;
    const cx = xPos(i);
    const y1 = yPos(v1);
    const rect1Y = Math.min(y1, baseY);
    const rect1H = Math.max(2, Math.abs(baseY - y1));
    const handleDir1 = y1 <= baseY ? -1 : 1;
    const rect1 = addTo(gBars, 'rect', {
      x: cx - barTotal / 2,
      y: rect1Y,
      width: barTotal,
      height: rect1H,
      class: 'bar series0' + (locked[i] ? ' locked' : '')
    });
    rect1.dataset.index = i;
    rect1.dataset.series = 0;
    rect1.dataset.base = 0;
    rect1.addEventListener('pointerdown', onDragStart);
    if (!locked[i]) {
      createDragHandle(gHands, cx, y1 + handleDir1 * 2, {
        index: i,
        series: 0,
        base: 0
      });
    }
    const a1 = addTo(gA11y, 'rect', {
      x: cx - barTotal / 2,
      y: rect1Y,
      width: barTotal,
      height: rect1H,
      fill: 'transparent',
      class: 'a11y',
      tabindex: 0,
      role: 'slider',
      'aria-orientation': 'vertical',
      'aria-label': `${CFG.labels[i]}`,
      'aria-valuemin': String(yMin),
      'aria-valuemax': String(yMax - v2),
      'aria-valuenow': String(v1),
      'aria-valuetext': `${CFG.labels[i]}: ${fmt(v1)}`
    });
    if (locked[i]) a1.setAttribute('aria-disabled', 'true');
    a1.dataset.index = i;
    a1.dataset.series = 0;
    a1.dataset.base = 0;
    a1.addEventListener('pointerdown', onDragStart);
    a1.addEventListener('keydown', onKeyAdjust);
    // Verdietikettene fjernet

    if (values2) {
      const y2 = yPos(v1 + v2);
      const rect2Y = Math.min(y2, y1);
      const rect2H = Math.max(2, Math.abs(y1 - y2));
      const handleDir2 = y2 <= y1 ? -1 : 1;
      const rect2 = addTo(gBars, 'rect', {
        x: cx - barTotal / 2,
        y: rect2Y,
        width: barTotal,
        height: rect2H,
        class: 'bar series1' + (locked[i] ? ' locked' : '')
      });
      rect2.dataset.index = i;
      rect2.dataset.series = 1;
      rect2.dataset.base = v1;
      rect2.addEventListener('pointerdown', onDragStart);
      if (!locked[i]) {
        createDragHandle(gHands, cx, y2 + handleDir2 * 2, {
          index: i,
          series: 1,
          base: v1
        });
      }
      const a2 = addTo(gA11y, 'rect', {
        x: cx - barTotal / 2,
        y: rect2Y,
        width: barTotal,
        height: rect2H,
        fill: 'transparent',
        class: 'a11y',
        tabindex: 0,
        role: 'slider',
        'aria-orientation': 'vertical',
        'aria-label': `${CFG.labels[i]}`,
        'aria-valuemin': String(yMin),
        'aria-valuemax': String(yMax),
        'aria-valuenow': String(v2),
        'aria-valuetext': `${CFG.labels[i]}: ${fmt(v2)}`
      });
      if (locked[i]) a2.setAttribute('aria-disabled', 'true');
      a2.dataset.index = i;
      a2.dataset.series = 1;
      a2.dataset.base = v1;
      a2.addEventListener('pointerdown', onDragStart);
      a2.addEventListener('keydown', onKeyAdjust);
      // Verdietikettene fjernet
    }
  }
}
function placeValueLabel(x, y, value, mode, options = {}) {
  const display = formatValueLabel(value, mode, options.share);
  if (!display || !display.text) return;
  const baseY = typeof options.baseY === 'number' ? options.baseY : y;
  const offset = Number.isFinite(options.offset) ? options.offset : 12;
  const xOffset = Number.isFinite(options.xOffset) ? options.xOffset : 0;
  const finalX = x + xOffset;
  const above = typeof options.above === 'boolean' ? options.above : y <= baseY;
  const finalY = above ? y - offset : y + offset;
  const anchor = typeof options.anchor === 'string' && options.anchor ? options.anchor : 'middle';
  if (display.type === 'katex' && display.latex && typeof window !== 'undefined' && window.katex && typeof window.katex.render === 'function') {
    const width = Number.isFinite(options.boxWidth) ? options.boxWidth : 140;
    const height = Number.isFinite(options.boxHeight) ? options.boxHeight : 56;
    const foreignObject = addTo(gVals, 'foreignObject', {
      x: finalX - width / 2,
      y: above ? finalY - height : finalY,
      width,
      height,
      class: 'value-fo'
    });
    const container = document.createElement('div');
    container.setAttribute('xmlns', 'http://www.w3.org/1999/xhtml');
    container.className = 'value value--html';
    container.style.display = 'flex';
    container.style.justifyContent = anchor === 'start' ? 'flex-start' : anchor === 'end' ? 'flex-end' : 'center';
    container.style.alignItems = above ? 'flex-end' : 'flex-start';
    container.style.width = '100%';
    container.style.height = '100%';
    container.style.pointerEvents = 'none';
    if (Number.isFinite(options.series)) {
      container.classList.add(`series${options.series}`);
    }
    const span = document.createElement('span');
    container.appendChild(span);
    try {
      window.katex.render(display.latex, span, {
        throwOnError: false
      });
    } catch (error) {
      span.textContent = display.text;
    }
    foreignObject.appendChild(container);
    return;
  }
  const attrs = {
    x: finalX,
    y: finalY,
    class: 'value'
  };
  if (Number.isFinite(options.series)) {
    attrs.class += ` series${options.series}`;
  }
  if (!above) {
    attrs['dominant-baseline'] = 'hanging';
  }
  if (anchor && anchor !== 'middle') {
    attrs['text-anchor'] = anchor;
  }
  const label = addTo(gVals, 'text', attrs);
  label.textContent = display.text;
}
function formatValueLabel(value, mode, share) {
  const normalized = sanitizeValueDisplay(mode);
  if (normalized === 'none') return { type: 'none', text: '' };
  const safeValue = Number.isFinite(value) ? value : 0;
  if (normalized === 'number') {
    return {
      type: 'text',
      text: fmt(safeValue)
    };
  }
  const ratio = Number.isFinite(share) ? share : 0;
  if (normalized === 'percent') {
    return {
      type: 'text',
      text: formatPercent(ratio * 100)
    };
  }
  if (normalized === 'fraction') {
    const fraction = formatFractionDisplay(ratio);
    if (fraction.latex) {
      return {
        type: 'katex',
        text: fraction.text,
        latex: fraction.latex
      };
    }
    return {
      type: 'text',
      text: fraction.text
    };
  }
  return {
    type: 'text',
    text: ''
  };
}
function computeSeriesTotal(arr) {
  if (!Array.isArray(arr) || !arr.length) return 0;
  return arr.reduce((sum, value) => {
    const safe = Number.isFinite(value) ? Math.abs(value) : 0;
    return safe > 0 ? sum + safe : sum;
  }, 0);
}
function computeValueShare(value, total) {
  const safeTotal = Number.isFinite(total) ? total : 0;
  if (safeTotal <= 0) return 0;
  const safeValue = Number.isFinite(value) ? value : 0;
  const magnitude = Math.abs(safeValue);
  if (magnitude <= 0) return 0;
  const ratio = magnitude / safeTotal;
  return safeValue < 0 ? -ratio : ratio;
}
function formatFractionValue(value) {
  return formatFractionDisplay(value).text;
}
function formatFractionDisplay(value) {
  if (!Number.isFinite(value)) return {
    text: '',
    latex: ''
  };
  if (Math.abs(value) < 1e-9) {
    return {
      text: '0',
      latex: '0'
    };
  }
  const signPrefix = value < 0 ? '-' : '';
  const absVal = Math.abs(value);
  if (Math.abs(absVal - Math.round(absVal)) < 1e-9) {
    const rounded = Math.round(absVal);
    const text = signPrefix + rounded;
    return {
      text,
      latex: text
    };
  }
  const approx = approximateFraction(absVal, 100);
  if (!approx) {
    const fallback = fmt(absVal);
    const text = signPrefix + fallback;
    return {
      text,
      latex: text
    };
  }
  let numerator = approx.numerator;
  let denominator = approx.denominator;
  if (denominator === 0) {
    const fallback = fmt(absVal);
    const text = signPrefix + fallback;
    return {
      text,
      latex: text
    };
  }
  if (numerator === 0) {
    return {
      text: '0',
      latex: '0'
    };
  }
  const whole = Math.floor(numerator / denominator);
  const remainder = numerator % denominator;
  if (remainder === 0) {
    const text = signPrefix + String(whole);
    return {
      text,
      latex: text
    };
  }
  if (whole === 0) {
    const fractionText = `${remainder}⁄${denominator}`;
    const text = signPrefix ? `-${fractionText}` : fractionText;
    const latex = `${signPrefix ? '-' : ''}\\frac{${remainder}}{${denominator}}`;
    return {
      text,
      latex
    };
  }
  const text = `${signPrefix ? '-' : ''}${whole} ${remainder}⁄${denominator}`;
  const latex = `${signPrefix ? '-' : ''}${whole}\\frac{${remainder}}{${denominator}}`;
  return {
    text,
    latex
  };
}
function approximateFraction(value, maxDenominator = 100) {
  if (!Number.isFinite(value)) return null;
  if (value === 0) return {
    numerator: 0,
    denominator: 1
  };
  if (Math.abs(value - Math.round(value)) < 1e-9) {
    return {
      numerator: Math.round(value),
      denominator: 1
    };
  }
  const limit = Math.max(1, Math.floor(maxDenominator));
  let lowerN = 0;
  let lowerD = 1;
  let upperN = 1;
  let upperD = 0;
  let bestN = 1;
  let bestD = 1;
  for (let i = 0; i < 64; i++) {
    const mediantN = lowerN + upperN;
    const mediantD = lowerD + upperD;
    if (mediantD > limit) break;
    bestN = mediantN;
    bestD = mediantD;
    const mediant = mediantN / mediantD;
    if (Math.abs(mediant - value) <= 1e-9) break;
    if (mediant < value) {
      lowerN = mediantN;
      lowerD = mediantD;
    } else {
      upperN = mediantN;
      upperD = mediantD;
    }
  }
  const bestVal = bestN / bestD;
  const upperVal = upperN / upperD;
  const lowerVal = lowerN / lowerD;
  let chosenN = bestN;
  let chosenD = bestD;
  if (upperD <= limit && Math.abs(upperVal - value) < Math.abs(bestVal - value)) {
    chosenN = upperN;
    chosenD = upperD;
  }
  if (lowerD <= limit && Math.abs(lowerVal - value) < Math.abs(chosenN / chosenD - value)) {
    chosenN = lowerN;
    chosenD = lowerD;
  }
  if (chosenD === 0) {
    chosenN = bestN;
    chosenD = bestD;
  }
  const divisor = gcd(chosenN, chosenD);
  return {
    numerator: Math.round(chosenN / divisor),
    denominator: Math.round(chosenD / divisor)
  };
}
function gcd(a, b) {
  let x = Math.abs(Math.round(a));
  let y = Math.abs(Math.round(b));
  while (y) {
    const t = y;
    y = x % y;
    x = t;
  }
  return x || 1;
}
function formatPieValueText(rawValue, share, mode) {
  const normalized = sanitizeValueDisplay(mode);
  if (normalized === 'none') return '';
  if (normalized === 'number') {
    return fmt(rawValue);
  }
  const ratio = Number.isFinite(share) ? share : 0;
  if (normalized === 'percent') {
    return formatPercent(ratio * 100);
  }
  if (normalized === 'fraction') {
    return formatFractionValue(ratio);
  }
  return '';
}
function drawBars(displayMode) {
  gBars.innerHTML = '';
  gVals.innerHTML = '';
  gHands.innerHTML = '';
  gA11y.innerHTML = '';
  const baseValue = getBaselineValue();
  const baseY = yPos(baseValue);
  const total = computeSeriesTotal(values);
  values.forEach((v, i) => {
    const cx = xPos(i);
    const y = yPos(v);
    const rectY = Math.min(y, baseY);
    const rectHeight = Math.max(2, Math.abs(baseY - y));
    const handleDirection = y <= baseY ? -1 : 1;
    const handleCenter = y + handleDirection * 2;

    // 1) SØYLE (draggbar)
    const rect = addTo(gBars, 'rect', {
      x: cx - barW / 2,
      y: rectY,
      width: barW,
      height: rectHeight,
      class: 'bar series0' + (locked[i] ? ' locked' : '')
    });
    rect.dataset.index = i;
    rect.dataset.series = 0;
    rect.dataset.base = 0;
    rect.addEventListener('pointerdown', onDragStart);

    // 2) HÅNDTAK (draggbar)
    if (!locked[i]) {
      createDragHandle(gHands, cx, handleCenter, {
        index: i,
        series: 0,
        base: 0
      });
    }

    // 3) A11y‐overlay (fokus + tastatur + stor klikkflate)
    const a11y = addTo(gA11y, 'rect', {
      x: cx - xBand * 0.5,
      y: M.t,
      width: xBand * 0.98,
      height: innerH,
      fill: 'transparent',
      class: 'a11y',
      tabindex: 0,
      role: 'slider',
      'aria-orientation': 'vertical',
      'aria-label': `${CFG.labels[i]}`,
      'aria-valuemin': String(yMin),
      'aria-valuemax': String(yMax),
      'aria-valuenow': String(v),
      'aria-valuetext': `${CFG.labels[i]}: ${fmt(v)}`
    });
    if (locked[i]) a11y.setAttribute('aria-disabled', 'true');
    a11y.dataset.index = i;
    a11y.dataset.series = 0;
    a11y.dataset.base = 0;
    a11y.addEventListener('pointerdown', onDragStart);
    a11y.addEventListener('keydown', onKeyAdjust);

    // gjenopprett fokus på samme søyle synkront
    if (lastFocusIndex === i) {
      a11y.focus({
        preventScroll: true
      });
    }

    // 4) Verdi (øverst, ikke-interaktiv)
    if (displayMode !== 'none') {
      const share = computeValueShare(v, total);
      placeValueLabel(cx, y, v, displayMode, {
        baseY,
        series: 0,
        share
      });
    }
  });
}

/* =========================================================
   DRAGGING (mus/berøring)
   ========================================================= */
function onDragStart(e) {
  e.preventDefault();
  const target = e.currentTarget;
  const idx = +target.dataset.index;
  let series = +target.dataset.series || 0;
  const isHandle = target && target.classList && target.classList.contains('handle');
  if (locked[idx]) {
    if (isHandle) target.classList.remove('is-grabbing');
    return;
  }
  if (isHandle) {
    target.classList.add('is-grabbing');
  }
  lastFocusIndex = idx;
  let base = +target.dataset.base || 0;
  if (CFG.type === 'stacked' && values2 && values2.length) {
    const pointer = clientToSvg(e.clientX, e.clientY);
    const boundaryY = yPos(values[idx]);
    const margin = 12;
    if (series === 1 && pointer.y >= boundaryY - margin) {
      series = 0;
      base = 0;
    } else if (series === 0 && pointer.y < boundaryY - margin) {
      series = 1;
      base = values[idx];
    }
  }
  const move = ev => {
    ev.preventDefault();
    const p = clientToSvg(ev.clientX, ev.clientY);
    const clampedY = Math.min(H - M.b, Math.max(M.t, p.y));
    const v = yToValue(clampedY) - base;
    setValue(idx, v, true, series);
  };
  const up = ev => {
    ev.preventDefault();
    window.removeEventListener('pointermove', move);
    window.removeEventListener('pointerup', up);
    window.removeEventListener('pointercancel', up);
    if (isHandle) {
      target.classList.remove('is-grabbing');
    }
    if (target.releasePointerCapture) {
      try {
        target.releasePointerCapture(ev.pointerId);
      } catch (error) {}
    }
  };
  window.addEventListener('pointermove', move, {
    passive: false
  });
  window.addEventListener('pointerup', up, {
    passive: false
  });
  window.addEventListener('pointercancel', up, {
    passive: false
  });
  if (target.setPointerCapture) {
    try {
      target.setPointerCapture(e.pointerId);
    } catch (error) {}
  }
}

/* =========================================================
   TASTATUR (UU)
   ========================================================= */
function onKeyAdjust(e) {
  const idx = +e.currentTarget.dataset.index;
  const series = +e.currentTarget.dataset.series || 0;
  if (locked[idx]) return;
  lastFocusIndex = idx;
  const step = CFG.snap || 1;
  const big = step * 5;
  let target = series === 0 ? values[idx] : values2 ? values2[idx] : 0;
  switch (e.key) {
    case 'ArrowUp':
    case 'ArrowRight':
      target += step;
      break;
    case 'ArrowDown':
    case 'ArrowLeft':
      target -= step;
      break;
    case 'PageUp':
      target += big;
      break;
    case 'PageDown':
      target -= big;
      break;
    case 'Home':
      target = yMin;
      break;
    case 'End':
      target = yMax - (series === 0 ? values2 ? values2[idx] : 0 : values[idx]);
      break;
    default:
      return;
  }
  e.preventDefault();
  setValue(idx, target, true, series);
}

/* =========================================================
   STATE / BEREGNING
   ========================================================= */
function setValue(idx, newVal, announce = false, series = 0) {
  if (locked[idx]) return;
  const snapped = snap(newVal, CFG.snap || 1);
  let v;
  if (CFG.type === 'pie') {
    v = Math.max(0, snapped);
  } else {
    const other = series === 0 ? values2 ? values2[idx] : 0 : values[idx];
    v = clamp(snapped, yMin, yMax - other);
  }
  if (series === 0) {
    values[idx] = v;
  } else {
    if (!values2) values2 = alignLength([], N, 0);
    values2[idx] = v;
  }
  syncConfigFromValues(series);
  drawData(); // oppdater grafikk + aria
  scheduleAltTextUpdate('data');
  if (announce) {
    const sName = seriesNames[series] || '';
    const label = sName ? `${CFG.labels[idx]} – ${sName}` : `${CFG.labels[idx]}`;
    updateStatus(`${label}: ${fmt(v)}`, 'info');
  }
}
function yToValue(py) {
  const frac = (H - M.b - py) / innerH; // inverse av yPos
  return yMin + frac * (yMax - yMin);
}
function syncConfigFromValues(series) {
  const updateInput = (id, arr) => {
    const input = document.getElementById(id);
    if (input) input.value = formatNumberList(arr);
  };
  if (series === 0) {
    CFG.start = values.slice();
    updateInput('cfgStart', values);
  } else if (series === 1 && values2) {
    CFG.start2 = values2.slice();
    updateInput('cfgStart2', values2);
  }
}

/* =========================================================
   ALT-TEKST (AI)
   ========================================================= */
let altTextServiceEnabled = true;
let altTextServiceWarningLogged = false;

function disableAltTextService(reason, error) {
  const shouldLog = !altTextServiceWarningLogged;
  altTextServiceEnabled = false;
  if (shouldLog) {
    const message = reason ? `Alt-tekst-tjeneste deaktivert: ${reason}.` : 'Alt-tekst-tjeneste deaktivert.';
    if (error) {
      console.warn(message, error);
    } else {
      console.warn(message);
    }
    altTextServiceWarningLogged = true;
  }
}

function scheduleAltTextUpdate(reason = 'auto', delayOverride) {
  if (!altTextField) return;
  applyAltTextToSvg(CFG.altText || '');
  if (!shouldAutoGenerateAltText()) return;
  const delay = typeof delayOverride === 'number' ? Math.max(0, delayOverride) : reason === 'manual' ? 0 : 800;
  if (altTextGenerationTimer) {
    clearTimeout(altTextGenerationTimer);
    altTextGenerationTimer = null;
  }
  altTextGenerationTimer = setTimeout(() => {
    altTextGenerationTimer = null;
    generateAltText(reason);
  }, delay);
}
function shouldAutoGenerateAltText() {
  const text = typeof CFG.altText === 'string' ? CFG.altText.trim() : '';
  if (!text) return true;
  return (CFG.altTextSource || 'auto') !== 'manual';
}
function generateAltText(reason = 'auto') {
  if (!altTextField) return;
  if (altTextAbortController && typeof altTextAbortController.abort === 'function') {
    try {
      altTextAbortController.abort();
    } catch (error) {}
  }
  const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
  if (controller) {
    altTextAbortController = controller;
  } else {
    altTextAbortController = null;
  }
  setAltTextStatus('Genererer alternativ tekst …', false);
  const context = collectAltTextContext();
  requestAltText(context, controller ? controller.signal : undefined).then(text => {
    if (controller && controller.signal.aborted) return;
    const trimmed = (text || '').trim();
    if (!trimmed) throw new Error('Empty alt-text');
    setAltText(trimmed, 'auto');
    setAltTextStatus('Alternativ tekst oppdatert.', false);
  }).catch(async error => {
    if (controller && controller.signal.aborted) return;
    console.warn('Alt-tekstgenerering feilet', error);
    let svgBasedText = null;
    try {
      svgBasedText = await generateAltTextFromSvg(context, controller ? controller.signal : undefined);
    } catch (svgError) {
      if (!(controller && controller.signal.aborted)) {
        console.warn('Alt-tekst fra SVG feilet', svgError);
      }
    }
    if (controller && controller.signal.aborted) return;
    const trimmedSvgText = svgBasedText && svgBasedText.trim ? svgBasedText.trim() : svgBasedText;
    if (trimmedSvgText) {
      setAltText(trimmedSvgText, 'auto');
      setAltTextStatus('Alternativ tekst generert fra eksportert SVG.', false);
      return;
    }
    const fallback = buildHeuristicAltText(context);
    setAltText(fallback, 'auto');
    setAltTextStatus('Viser en enkel beskrivelse.');
  }).finally(() => {
    if (altTextAbortController === controller) {
      altTextAbortController = null;
    }
  });
}
async function requestAltText(context, signal) {
  const prompt = buildAltTextPrompt(context);
  return performAltTextRequest(prompt, signal);
}
async function performAltTextRequest(prompt, signal) {
  if (!altTextServiceEnabled) return '';
  const endpoint = resolveAltTextEndpoint();
  if (endpoint) {
    try {
      return await requestAltTextFromBackend(endpoint, prompt, signal);
    } catch (error) {
      if (!altTextServiceEnabled) return '';
      throw error;
    }
  }
  if (!altTextServiceEnabled) return '';
  return requestAltTextDirect(prompt, signal);
}
async function requestAltTextFromBackend(endpoint, prompt, signal) {
  if (!altTextServiceEnabled) {
    throw new Error('Alt-tekst-tjeneste deaktivert');
  }
  let res;
  try {
    res = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        prompt
      }),
      signal
    });
  } catch (error) {
    if (!(signal && signal.aborted)) {
      disableAltTextService('nettverksfeil mot alt-tekst-tjenesten', error);
    }
    throw error;
  }
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    const error = new Error(`Backend error ${res.status}${text ? `: ${text}` : ''}`);
    disableAltTextService('ugyldig svar fra alt-tekst-tjenesten', error);
    throw error;
  }
  let data;
  try {
    data = await res.json();
  } catch (error) {
    disableAltTextService('JSON-feil fra alt-tekst-tjenesten', error);
    throw error;
  }
  if (!data || typeof data.text !== 'string') {
    const error = new Error('Ugyldig svar fra alt-tekst-tjenesten');
    disableAltTextService('ugyldig svar fra alt-tekst-tjenesten', error);
    throw error;
  }
  const txt = data.text.trim();
  if (!txt) {
    const error = new Error('Tom alt-tekst fra tjenesten');
    disableAltTextService('ugyldig svar fra alt-tekst-tjenesten', error);
    throw error;
  }
  return txt;
}
async function requestAltTextDirect(prompt, signal) {
  if (!altTextServiceEnabled) throw new Error('Alt-tekst-tjeneste deaktivert');
  const apiKey = typeof window !== 'undefined' ? window.OPENAI_API_KEY : null;
  if (!apiKey) {
    disableAltTextService('mangler API-nøkkel for OpenAI');
    throw new Error('Mangler API-nøkkel for direktekall');
  }
  const body = {
    model: 'gpt-4o-mini',
    messages: [{
      role: 'system',
      content: 'Du skriver korte og tydelige alternative tekster (2–3 setninger) på norsk for diagrammer. Inkluder hovedtendenser, topper/bunner og hva aksene viser. Ingen punktlister eller Markdown.'
    }, {
      role: 'user',
      content: prompt
    }],
    temperature: 0.4
  };
  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`
    },
    body: JSON.stringify(body),
    signal
  });
  const data = await res.json().catch(() => null);
  if (!res.ok) {
    const err = data && data.error ? data.error.message || JSON.stringify(data.error) : res.statusText;
    throw new Error(`OpenAI error ${res.status}${err ? `: ${err}` : ''}`);
  }
  const txt = data && data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content;
  if (!txt) throw new Error('Ingen tekst mottatt fra OpenAI');
  return txt.trim();
}
async function generateAltTextFromSvg(context, signal) {
  if (!svg) return null;
  let markup = null;
  try {
    markup = await svgToString(svg);
  } catch (error) {
    console.warn('Kunne ikke serialisere SVG for alt-tekst', error);
    return null;
  }
  if (!markup) return null;
  const prompt = buildSvgAltTextPrompt(markup, context);
  try {
    return await performAltTextRequest(prompt, signal);
  } catch (error) {
    if (!(signal && signal.aborted)) console.warn('Alt-tekst med SVG-data feilet', error);
    return null;
  }
}
function resolveAltTextEndpoint() {
  if (typeof window === 'undefined') return null;
  if (window.MATH_VISUALS_ALT_TEXT_API_URL) {
    const value = String(window.MATH_VISUALS_ALT_TEXT_API_URL).trim();
    if (value) return value;
  }
  var _window$location2;
  const origin = (_window$location2 = window.location) === null || _window$location2 === void 0 ? void 0 : _window$location2.origin;
  if (typeof origin === 'string' && /^https?:/i.test(origin)) {
    return '/api/diagram-alt-text';
  }
  return null;
}
function setAltText(text, source) {
  const cleaned = (text || '').trim();
  if (altTextField && altTextField.value !== cleaned) {
    altTextField.value = cleaned;
  }
  CFG.altText = cleaned;
  if (source) {
    CFG.altTextSource = source;
  } else if (!CFG.altTextSource) {
    CFG.altTextSource = cleaned ? 'manual' : 'auto';
  }
  applyAltTextToSvg(cleaned);
}
function setAltTextStatus(message, isError) {
  if (!altTextStatus) return;
  altTextStatus.textContent = message || '';
  if (isError) altTextStatus.classList.add('alt-text__status--error');else altTextStatus.classList.remove('alt-text__status--error');
}
function applyAltTextToSvg(text) {
  if (!svg) return;
  const { titleEl, descEl } = ensureSvgA11yNodes(svg);
  const titleText = (CFG.title || '').trim() || 'Diagram';
  const descText = (text || '').trim();
  if (titleEl) titleEl.textContent = titleText;
  if (descEl) descEl.textContent = descText;
  svg.setAttribute('role', 'img');
  svg.setAttribute('aria-label', titleText);
  if (titleEl && titleEl.id) svg.setAttribute('aria-labelledby', titleEl.id);
  if (descEl && descEl.id) svg.setAttribute('aria-describedby', descEl.id);
}
function ensureSvgA11yNodes(targetSvg) {
  if (!targetSvg) return { titleEl: null, descEl: null };
  const doc = targetSvg.ownerDocument || document;
  const ns = targetSvg.namespaceURI || 'http://www.w3.org/2000/svg';
  let titleEl = targetSvg.querySelector('title');
  if (!titleEl) {
    titleEl = doc.createElementNS(ns, 'title');
    targetSvg.insertBefore(titleEl, targetSvg.firstChild || null);
  }
  if (!titleEl.id) {
    const baseId = targetSvg.id || 'diagram';
    titleEl.id = `${baseId}-title`;
  }
  let descEl = targetSvg.querySelector('desc');
  if (!descEl) {
    descEl = doc.createElementNS(ns, 'desc');
    if (titleEl.nextSibling) targetSvg.insertBefore(descEl, titleEl.nextSibling);else targetSvg.appendChild(descEl);
  }
  if (!descEl.id) {
    const baseId = targetSvg.id || 'diagram';
    descEl.id = `${baseId}-desc`;
  }
  return {
    titleEl,
    descEl
  };
}
function collectAltTextContext() {
  const lbls = Array.isArray(CFG.labels) ? CFG.labels.slice() : [];
  const vals1 = lbls.length ? alignLength(values.slice(), lbls.length, 0) : values.slice();
  const vals2 = values2 && values2.length ? lbls.length ? alignLength(values2.slice(), lbls.length, 0) : values2.slice() : null;
  return {
    type: CFG.type || 'bar',
    title: CFG.title || '',
    axisXLabel: CFG.axisXLabel || '',
    axisYLabel: CFG.axisYLabel || '',
    labels: lbls,
    values: vals1,
    values2: vals2,
    seriesNames: seriesNames.slice(),
    yMax: yMax
  };
}
function describeDiagramType(type) {
  if (type === 'pie') return 'sektordiagram';
  if (type === 'line') return 'linjediagram';
  if (type === 'grouped') return 'gruppert stolpediagram';
  if (type === 'stacked') return 'stablet stolpediagram';
  return 'stolpediagram';
}
function buildAltTextPrompt(context) {
  const typeName = describeDiagramType(context.type);
  const parts = [`Diagramtype: ${typeName}`];
  if (context.title) parts.push(`Tittel: ${context.title}`);
  if (context.type !== 'pie') {
    if (context.axisXLabel) parts.push(`X-akse: ${context.axisXLabel}`);
    if (context.axisYLabel) parts.push(`Y-akse: ${context.axisYLabel}`);
  }
  const labels = context.labels.length ? context.labels : context.values.map((_, i) => `Kategori ${i + 1}`);
  const seriesName1 = context.seriesNames && context.seriesNames[0] && context.seriesNames[0].trim() ? context.seriesNames[0].trim() : context.values2 && context.values2.length ? 'Serie 1' : 'Dataserien';
  parts.push(`Serie 1 (${seriesName1}):`);
  labels.forEach((label, idx) => {
    const v = Number(context.values[idx] || 0);
    parts.push(`- ${label}: ${formatNumberForPrompt(v)}`);
  });
  if (context.values2 && context.values2.length) {
    const seriesName2 = context.seriesNames && context.seriesNames[1] && context.seriesNames[1].trim() ? context.seriesNames[1].trim() : 'Serie 2';
    parts.push(`Serie 2 (${seriesName2}):`);
    labels.forEach((label, idx) => {
      const v = Number(context.values2 ? context.values2[idx] || 0 : 0);
      parts.push(`- ${label}: ${formatNumberForPrompt(v)}`);
    });
    if (context.type === 'stacked') {
      parts.push('Totalsummer per kategori:');
      labels.forEach((label, idx) => {
        const total = Number(context.values[idx] || 0) + Number(context.values2 ? context.values2[idx] || 0 : 0);
        parts.push(`- ${label}: ${formatNumberForPrompt(total)}`);
      });
    }
  }
  return `Lag en kort og tydelig alternativ tekst på norsk for et ${typeName}. Teksten skal være 2–3 setninger, beskrive hva diagrammet handler om, forklare aksene og fremheve tydelige trender eller ekstreme verdier. Ikke bruk punktlister eller Markdown.

Data:
${parts.join('\n')}`;
}
function buildSvgAltTextPrompt(svgMarkup, context) {
  const sanitized = sanitizeSvgForPrompt(svgMarkup);
  const basePrompt = buildAltTextPrompt(context);
  return `${basePrompt}

SVG:
${sanitized}`;
}
function sanitizeSvgForPrompt(markup) {
  if (typeof markup !== 'string') return '';
  const collapsed = markup.replace(/\s+/g, ' ').trim();
  const limit = 4000;
  if (collapsed.length <= limit) return collapsed;
  return collapsed.slice(0, limit) + ' …';
}
function buildHeuristicAltText(context) {
  const labels = (Array.isArray(context.labels) && context.labels.length
    ? context.labels
    : context.values.map((_, i) => `Kategori ${i + 1}`)
  ).map((label, idx) => {
    const str = typeof label === 'string' ? label.trim() : String(label || '');
    return str || `Kategori ${idx + 1}`;
  });
  const typeName = describeDiagramType(context.type);
  const sentences = [];
  const title = context.title && context.title.trim();
  if (context.type === 'pie') {
    if (title) {
      sentences.push(`${title} er et ${typeName}.`);
    } else {
      sentences.push(`Figuren er et ${typeName} med ${labels.length} sektorer.`);
    }
    if (labels.length) {
      if (labels.length <= 8) {
        sentences.push(`Sektorene viser ${formatLabelList(labels)}.`);
      } else {
        const first = labels[0];
        const last = labels[labels.length - 1];
        sentences.push(`Diagrammet fordeler andeler for ${labels.length} kategorier, fra ${first} til ${last}.`);
      }
    }
    const numbers = context.values.map(v => Math.max(0, Number(v) || 0));
    const total = numbers.reduce((sum, v) => sum + v, 0);
    const fallbackShare = labels.length ? 100 / labels.length : 0;
    const shares = total > 0 ? numbers.map(v => v / total * 100) : numbers.map(() => fallbackShare);
    if (labels.length) {
      let maxIndex = 0;
      let minIndex = 0;
      shares.forEach((value, idx) => {
        if (value > shares[maxIndex]) maxIndex = idx;
        if (value < shares[minIndex]) minIndex = idx;
      });
      const maxLabel = labels[maxIndex] || `Kategori ${maxIndex + 1}`;
      const minLabel = labels[minIndex] || `Kategori ${minIndex + 1}`;
      let shareSentence = `${maxLabel} er størst med ${formatPercent(shares[maxIndex])}`;
      if (Math.abs(shares[minIndex] - shares[maxIndex]) > 1e-6) {
        shareSentence += `, mens ${minLabel} er minst med ${formatPercent(shares[minIndex])}`;
      }
      shareSentence += '.';
      sentences.push(shareSentence);
    }
    return sentences.join(' ');
  }
  if (title) {
    sentences.push(`${title} er et ${typeName}.`);
  } else {
    sentences.push(`Figuren er et ${typeName} med ${labels.length} kategorier.`);
  }
  const readableLabels = labels.filter(label => !!label);
  if (readableLabels.length) {
    if (readableLabels.length <= 8) {
      sentences.push(`Kategoriene er ${formatLabelList(readableLabels)}.`);
    } else {
      const first = readableLabels[0];
      const last = readableLabels[readableLabels.length - 1];
      sentences.push(`Diagrammet sammenligner ${readableLabels.length} kategorier, fra ${first} til ${last}.`);
    }
  }
  if (context.axisXLabel && context.axisYLabel) {
    sentences.push(`Den horisontale aksen viser ${context.axisXLabel}, og den vertikale viser ${context.axisYLabel}.`);
  } else if (context.axisXLabel) {
    sentences.push(`Den horisontale aksen viser ${context.axisXLabel}.`);
  } else if (context.axisYLabel) {
    sentences.push(`Den vertikale aksen viser ${context.axisYLabel}.`);
  }
  const addSeriesSummary = (arr, name, suffix) => {
    if (!arr || !arr.length) return;
    const numbers = arr.map(v => Number(v) || 0);
    if (numbers.every(v => Math.abs(v - numbers[0]) < 1e-9)) {
      sentences.push(`${name} er ${fmt(numbers[0])} for alle kategorier${suffix || ''}.`);
      return;
    }
    let maxIndex = 0;
    let minIndex = 0;
    numbers.forEach((value, idx) => {
      if (value > numbers[maxIndex]) maxIndex = idx;
      if (value < numbers[minIndex]) minIndex = idx;
    });
    const maxLabel = labels[maxIndex] || `Kategori ${maxIndex + 1}`;
    const minLabel = labels[minIndex] || `Kategori ${minIndex + 1}`;
    let sentence = `${name} er høyest for ${maxLabel} (${fmt(numbers[maxIndex])})`;
    if (numbers[minIndex] !== numbers[maxIndex]) {
      sentence += ` og lavest for ${minLabel} (${fmt(numbers[minIndex])})`;
    }
    sentence += suffix || '';
    sentence += '.';
    sentences.push(sentence);
  };
  const seriesName1 = context.seriesNames && context.seriesNames[0] && context.seriesNames[0].trim() ? context.seriesNames[0].trim() : context.values2 && context.values2.length ? 'Serie 1' : 'Dataserien';
  addSeriesSummary(context.values, seriesName1, context.values2 && context.values2.length ? '' : '');
  if (context.values2 && context.values2.length) {
    const seriesName2 = context.seriesNames && context.seriesNames[1] && context.seriesNames[1].trim() ? context.seriesNames[1].trim() : 'Serie 2';
    addSeriesSummary(context.values2, seriesName2);
    if (context.type === 'stacked') {
      const totals = context.values.map((v, idx) => Number(v || 0) + Number(context.values2 ? context.values2[idx] || 0 : 0));
      addSeriesSummary(totals, 'Totalt', ' når søylene er stablet');
    }
  }
  return sentences.join(' ');
}
function formatLabelList(labels) {
  if (!Array.isArray(labels) || !labels.length) return '';
  if (labels.length === 1) return labels[0];
  if (labels.length === 2) return `${labels[0]} og ${labels[1]}`;
  return `${labels.slice(0, -1).join(', ')} og ${labels[labels.length - 1]}`;
}
function formatNumberForPrompt(value) {
  const str = formatNumber(Number.isFinite(value) ? value : 0);
  return str.replace('.', ',');
}

/* =========================================================
   KNAPPER
   ========================================================= */
  document.getElementById('btnReset').addEventListener('click', () => {
    values = CFG.start.slice();
    if (values2) values2 = CFG.start2 ? CFG.start2.slice() : null;
    clearBadges();
    lastFocusIndex = null;
    drawData();
    scheduleAltTextUpdate('reset');
    updateStatus('Nullstilt.', 'info');
  });
  document.getElementById('btnShow').addEventListener('click', () => {
    values = CFG.answer.slice();
    if (values2) values2 = CFG.answer2 ? CFG.answer2.slice() : null;
    lastFocusIndex = null;
    drawData();
    markCorrectness();
    scheduleAltTextUpdate('show');
    updateStatus('Dette er én fasit.', 'info');
  });
  if (checkBtn) {
    checkBtn.addEventListener('click', () => {
      evaluateDescriptionInputs();
      markCorrectness();
      const ok1 = isCorrect(values, CFG.answer, CFG.tolerance || 0);
      const ok2 = values2 ? isCorrect(values2, CFG.answer2, CFG.tolerance || 0) : true;
      const ok = ok1 && ok2;
      updateStatus(ok ? 'Riktig!' : 'Prøv igjen.', ok ? 'success' : 'error');
    });
  }
document.querySelector('.settings').addEventListener('input', applyCfg);
function applyCfg() {
  const lbls = parseList(document.getElementById('cfgLabels').value);
  const starts = parseNumList(document.getElementById('cfgStart').value);
  const answers = parseNumList(document.getElementById('cfgAnswer').value);
  const yMinInput = document.getElementById('cfgYMin');
  const yMaxInput = document.getElementById('cfgYMax');
  const yMinVal = parseFloat(yMinInput ? yMinInput.value : '');
  const yMaxVal = parseFloat(yMaxInput ? yMaxInput.value : '');
  CFG.title = document.getElementById('cfgTitle').value;
  CFG.type = document.getElementById('cfgType').value;
  CFG.series1 = document.getElementById('cfgSeries1').value;
  CFG.labels = lbls;
  CFG.start = alignLength(starts, lbls.length, 0);
  CFG.answer = alignLength(answers, lbls.length, 0);
  if (series2Enabled) {
    CFG.series2 = document.getElementById('cfgSeries2').value;
    const starts2 = parseNumList(document.getElementById('cfgStart2').value);
    const answers2 = parseNumList(document.getElementById('cfgAnswer2').value);
    CFG.start2 = alignLength(starts2, lbls.length, 0);
    CFG.answer2 = alignLength(answers2, lbls.length, 0);
  } else {
    CFG.series2 = undefined;
    CFG.start2 = null;
    CFG.answer2 = null;
  }
  CFG.yMin = isNaN(yMinVal) ? undefined : yMinVal;
  CFG.yMax = isNaN(yMaxVal) ? undefined : yMaxVal;
  CFG.axisXLabel = document.getElementById('cfgAxisXLabel').value;
  CFG.axisYLabel = document.getElementById('cfgAxisYLabel').value;
  const valueDisplaySelect = document.getElementById('cfgValueDisplay');
  CFG.valueDisplay = valueDisplaySelect ? sanitizeValueDisplay(valueDisplaySelect.value) : 'none';
  const pieLabelPositionSelect = document.getElementById('cfgPieLabelPosition');
  CFG.pieLabelPosition = sanitizePieLabelPosition(pieLabelPositionSelect ? pieLabelPositionSelect.value : CFG.pieLabelPosition);
  const snapVal = parseFloat(document.getElementById('cfgSnap').value);
  CFG.snap = isNaN(snapVal) ? 1 : snapVal;
  const tolVal = parseFloat(document.getElementById('cfgTolerance').value);
  CFG.tolerance = isNaN(tolVal) ? 0 : tolVal;
  const lockedField = document.getElementById('cfgLocked');
  const lockedRaw = lockedField ? lockedField.value.trim() : '';
  if (!lockedRaw) {
    CFG.locked = Array(lbls.length).fill(true);
  } else {
    const showVals = parseNumList(lockedRaw).map(v => v !== 0);
    const alignedShow = alignLength(showVals, lbls.length, false);
    CFG.locked = alignedShow.map(show => !show);
  }
  initFromCfg();
}

/* =========================================================
   HJELPERE
   ========================================================= */
function add(name, attrs = {}) {
  const el = document.createElementNS('http://www.w3.org/2000/svg', name);
  applySvgAttributes(el, attrs);
  svg.appendChild(el);
  return el;
}
function addTo(group, name, attrs = {}) {
  const el = document.createElementNS(svg.namespaceURI, name);
  applySvgAttributes(el, attrs);
  group.appendChild(el);
  return el;
}
function applySvgAttributes(el, attrs = {}) {
  if (!el || !attrs || typeof attrs !== 'object') return;
  Object.entries(attrs).forEach(([key, value]) => {
    if (value === undefined || value === null) return;
    if (key === 'href' || key === 'xlink:href') {
      el.setAttribute('href', value);
      el.setAttributeNS(XLINK_NS, 'href', value);
      return;
    }
    el.setAttribute(key, value);
  });
}
function polarToCartesian(cx, cy, radius, angle) {
  return {
    x: cx + radius * Math.cos(angle),
    y: cy + radius * Math.sin(angle)
  };
}
function buildPieSlicePath(cx, cy, radius, startAngle, endAngle) {
  const start = polarToCartesian(cx, cy, radius, startAngle);
  const end = polarToCartesian(cx, cy, radius, endAngle);
  const delta = Math.abs(endAngle - startAngle);
  const largeArc = delta > Math.PI ? 1 : 0;
  return `M ${cx} ${cy} L ${start.x} ${start.y} A ${radius} ${radius} 0 ${largeArc} 1 ${end.x} ${end.y} Z`;
}
function clientToSvg(clientX, clientY) {
  const rect = svg.getBoundingClientRect();
  const sx = W / rect.width,
    sy = H / rect.height;
  return {
    x: (clientX - rect.left) * sx,
    y: (clientY - rect.top) * sy
  };
}
function fmt(x) {
  return (Math.round(x * 100) / 100).toString().replace('.', ',');
}
function snap(v, s) {
  return Math.round(v / s) * s;
}
function clamp(v, a, b) {
  return Math.max(a, Math.min(b, v));
}
function parseList(str) {
  return str.split(',').map(s => s.trim()).filter(s => s.length > 0);
}
function parseNumList(str) {
  return parseList(str).map(s => Number(s.replace(',', '.'))).map(v => isNaN(v) ? 0 : v);
}
function alignLength(arr, len, fill = 0) {
  if (arr.length < len) return arr.concat(Array(len - arr.length).fill(fill));
  if (arr.length > len) return arr.slice(0, len);
  return arr;
}
function formatNumberList(arr) {
  return arr.map(formatNumber).join(',');
}
function formatNumber(value) {
  if (!Number.isFinite(value)) return '0';
  let str = value.toFixed(6);
  if (str.includes('.')) {
    str = str.replace(/0+$/, '').replace(/\.$/, '');
  }
  return str.length ? str : '0';
}
function formatPercent(value) {
  const safe = Number.isFinite(value) ? value : 0;
  const abs = Math.abs(safe);
  const rounded = abs >= 10 ? Math.round(abs) : Math.round(abs * 10) / 10;
  const formatted = formatNumber(rounded).replace('.', ',');
  const sign = safe < 0 ? '-' : '';
  return `${sign}${formatted} %`;
}
function normalizeTickValue(value) {
  if (!Number.isFinite(value)) return 0;
  const rounded = Math.round(value * 1e6) / 1e6;
  return Math.abs(rounded) < 1e-9 ? 0 : rounded;
}
function formatTickValue(value) {
  return formatNumber(value).replace('.', ',');
}
function getBaselineValue() {
  if (yMin >= 0 && yMax >= 0) return yMin;
  if (yMin <= 0 && yMax <= 0) return yMax;
  return 0;
}
function computeScaleBounds(values, minOverride, maxOverride) {
  const filtered = values.filter(v => Number.isFinite(v));
  const data = filtered.length ? filtered.slice() : [0];
  const hasPositive = data.some(v => v > 0);
  const hasNegative = data.some(v => v < 0);
  if (!hasPositive) data.push(0);
  if (!hasNegative) data.push(0);
  let min = Number.isFinite(minOverride) ? minOverride : Math.min(...data);
  let max = Number.isFinite(maxOverride) ? maxOverride : Math.max(...data);
  if (min > max) {
    const tmp = min;
    min = max;
    max = tmp;
  }
  if (min === max) {
    const delta = Math.abs(min) > 0 ? Math.abs(min) * 0.2 : 1;
    min -= delta;
    max += delta;
  }
  const span = max - min || 1;
  const step = niceStep(span);
  const niceMin = Number.isFinite(minOverride) ? min : Math.floor(min / step) * step;
  const niceMax = Number.isFinite(maxOverride) ? max : Math.ceil(max / step) * step;
  return {
    min: normalizeTickValue(niceMin),
    max: normalizeTickValue(niceMax),
    step
  };
}
function niceStep(span) {
  const safeSpan = span > 0 ? span : 1;
  const rough = safeSpan / 8;
  const exponent = Math.floor(Math.log10(rough));
  const pow = Math.pow(10, exponent);
  const candidates = [1, 2, 2.5, 5, 10];
  for (const c of candidates) {
    const step = c * pow;
    if (rough <= step * 1.001) return step;
  }
  return 10 * pow;
}
function updateStatus(msg, type = 'info') {
  if (!statusEl) return;
  const text = typeof msg === 'string' ? msg : '';
  const normalizedType = type === 'success' ? 'success' : type === 'error' ? 'error' : 'info';
  statusEl.textContent = text;
  statusEl.className = `status status--${normalizedType}`;
  statusEl.hidden = !text;
}
function clearBadges() {
  [...gBars.querySelectorAll('.bar, .pie-slice')].forEach(b => b.classList.remove('badge-ok', 'badge-no'));
}
function markCorrectness() {
  clearBadges();
  const tol = CFG.tolerance || 0;
  [...gBars.children].forEach(rect => {
    const idx = +rect.dataset.index;
    const series = +rect.dataset.series || 0;
    const arr = series === 0 ? values : values2;
    const ans = series === 0 ? CFG.answer : CFG.answer2;
    if (!arr || !ans) return;
    const ok = Math.abs(arr[idx] - ans[idx]) <= tol;
    rect.classList.add(ok ? 'badge-ok' : 'badge-no');
  });
}
function isCorrect(vs, ans, tol) {
  if (vs.length !== ans.length) return false;
  return vs.every((v, i) => Math.abs(v - ans[i]) <= tol);
}
async function svgToString(svgEl) {
  var _titleEl$textContent;
  if (!svgEl) return '';
  const helper = typeof window !== 'undefined' ? window.MathVisSvgExport : null;
  const clone = helper && typeof helper.cloneSvgForExport === 'function' ? helper.cloneSvgForExport(svgEl) : svgEl.cloneNode(true);
  if (!clone) return '';
  const exportTitle = (CFG.title || '').trim() || 'Diagram';
  const currentContext = collectAltTextContext();
  const exportDesc = (CFG.altText || '').trim() || buildHeuristicAltText(currentContext);
  const { titleEl: cloneTitle, descEl: cloneDesc } = ensureSvgA11yNodes(clone);
  if (cloneTitle) cloneTitle.textContent = exportTitle;
  if (cloneDesc) cloneDesc.textContent = exportDesc;
  clone.setAttribute('role', 'img');
  clone.setAttribute('aria-label', exportTitle);
  if (cloneTitle && cloneTitle.id) clone.setAttribute('aria-labelledby', cloneTitle.id);
  if (cloneDesc && cloneDesc.id) clone.setAttribute('aria-describedby', cloneDesc.id);

  // Kopier beregnede stilverdier som attributter for å unngå svarte figurer
  const srcEls = Array.from(svgEl.querySelectorAll('*'));
  const cloneEls = Array.from(clone.querySelectorAll('*')).filter(
    el => el.getAttribute('data-export-background') !== 'true'
  );
  srcEls.forEach((src, i) => {
    const dst = cloneEls[i];
    const comp = getComputedStyle(src);
    const props = ['fill', 'stroke', 'stroke-width', 'font-family', 'font-size', 'font-weight', 'opacity', 'text-anchor', 'paint-order', 'stroke-linecap', 'stroke-linejoin', 'stroke-dasharray'];
    props.forEach(p => {
      const val = comp.getPropertyValue(p);
      // Include 'none' for fill and stroke to preserve transparency
      if (dst && val && val !== 'normal' && val !== '0px') {
        dst.setAttribute(p, val);
      }
    });
  });

  // legg til overskrift fra h2-elementet i eksporten
  const titleEl = document.getElementById('chartTitle');
  const titleText = titleEl === null || titleEl === void 0 || (_titleEl$textContent = titleEl.textContent) === null || _titleEl$textContent === void 0 ? void 0 : _titleEl$textContent.trim();
  if (titleText) {
    const t = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    t.textContent = titleText;
    t.setAttribute('x', W / 2);
    t.setAttribute('y', M.t / 2);
    t.setAttribute('text-anchor', 'middle');
    const comp = getComputedStyle(titleEl);
    const color = comp.getPropertyValue('color');
    if (color) t.setAttribute('fill', color);
    const ff = comp.getPropertyValue('font-family');
    if (ff) t.setAttribute('font-family', ff);
    const fs = comp.getPropertyValue('font-size');
    if (fs) t.setAttribute('font-size', fs);
    const fw = comp.getPropertyValue('font-weight');
    if (fw && fw !== 'normal') t.setAttribute('font-weight', fw);
    const firstElement = clone.firstElementChild;
    if (
      firstElement &&
      typeof firstElement.tagName === 'string' &&
      firstElement.tagName.toLowerCase() === 'rect' &&
      firstElement.getAttribute('fill') === '#ffffff'
    ) {
      clone.insertBefore(t, firstElement.nextSibling);
    } else {
      clone.insertBefore(t, clone.firstChild);
    }
  }

  // fjern interaktive håndtak før eksport
  clone.querySelectorAll('.handle, .handleShadow').forEach(el => el.remove());
  if (!clone.getAttribute('xmlns')) {
    clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
  }
  if (!clone.getAttribute('xmlns:xlink')) {
    clone.setAttribute('xmlns:xlink', 'http://www.w3.org/1999/xlink');
  }
  return '<?xml version="1.0" encoding="UTF-8"?>\n' + new XMLSerializer().serializeToString(clone);
}
function buildDiagramExportMeta() {
  const helper = typeof window !== 'undefined' ? window.MathVisSvgExport : null;
  const context = collectAltTextContext();
  const typeName = describeDiagramType(context.type);
  const labelCount = (Array.isArray(context.labels) ? context.labels.filter(label => !!label) : []).length || context.values.length;
  const hasSecondSeries = Array.isArray(context.values2) && context.values2.length > 0;
  const title = (CFG.title || '').trim();
  const descriptionParts = [];
  if (title) descriptionParts.push(title);
  const baseDesc = `${typeName} med ${labelCount || 1} kategorier${hasSecondSeries ? ' og to dataserier' : ''}`;
  descriptionParts.push(baseDesc);
  const description = descriptionParts.join(' – ');
  const slugPieces = ['diagram', typeName, `${Math.max(labelCount, 1)}kat`];
  if (hasSecondSeries) slugPieces.push('to-serier');
  const slugBase = slugPieces.join(' ');
  const slug = helper && typeof helper.slugify === 'function' ? helper.slugify(slugBase, 'diagram') : slugPieces.join('-').toLowerCase();
  return {
    description,
    slug,
    defaultBaseName: slug || 'diagram',
    summary: context
  };
}
async function downloadSVG(svgEl, filename) {
  const suggestedName = typeof filename === 'string' && filename ? filename : 'diagram.svg';
  const data = await svgToString(svgEl);
  const helper = typeof window !== 'undefined' ? window.MathVisSvgExport : null;
  const meta = buildDiagramExportMeta();
  if (helper && typeof helper.exportSvgWithArchive === 'function') {
    await helper.exportSvgWithArchive(svgEl, suggestedName, 'diagram', {
      svgString: data,
      description: meta.description,
      slug: meta.slug,
      defaultBaseName: meta.defaultBaseName,
      summary: meta.summary
    });
    return;
  }
  const blob = new Blob([data], {
    type: 'image/svg+xml;charset=utf-8'
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = suggestedName.endsWith('.svg') ? suggestedName : suggestedName + '.svg';
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
async function downloadPNG(svgEl, filename, scale = 2, bg = '#fff') {
  const vb = svgEl.viewBox.baseVal;
  const w = (vb === null || vb === void 0 ? void 0 : vb.width) || svgEl.clientWidth || 900;
  const h = (vb === null || vb === void 0 ? void 0 : vb.height) || svgEl.clientHeight || 560;
  const data = await svgToString(svgEl);
  const blob = new Blob([data], {
    type: 'image/svg+xml;charset=utf-8'
  });
  const url = URL.createObjectURL(blob);
  const img = new Image();
  img.onload = () => {
    const canvas = document.createElement('canvas');
    const helper = typeof window !== 'undefined' ? window.MathVisSvgExport : null;
    const sizing = helper && typeof helper.ensureMinimumPngDimensions === 'function'
      ? helper.ensureMinimumPngDimensions({ width: w, height: h }, { scale })
      : (() => {
          const minDimension = 100;
          const baseScale = Number.isFinite(scale) && scale > 0 ? scale : 1;
          const safeWidth = Number.isFinite(w) && w > 0 ? w : minDimension;
          const safeHeight = Number.isFinite(h) && h > 0 ? h : minDimension;
          const scaledWidth = safeWidth * baseScale;
          const scaledHeight = safeHeight * baseScale;
          const scaleMultiplier = Math.max(
            1,
            scaledWidth > 0 ? minDimension / scaledWidth : 1,
            scaledHeight > 0 ? minDimension / scaledHeight : 1
          );
          const finalScale = baseScale * scaleMultiplier;
          return {
            width: Math.max(minDimension, Math.round(safeWidth * finalScale)),
            height: Math.max(minDimension, Math.round(safeHeight * finalScale))
          };
        })();
    canvas.width = sizing.width;
    canvas.height = sizing.height;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    URL.revokeObjectURL(url);
    canvas.toBlob(blob => {
      const urlPng = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = urlPng;
      a.download = filename.endsWith('.png') ? filename : filename + '.png';
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(urlPng), 1000);
    }, 'image/png');
  };
  img.src = url;
}
