/* =========================================================
   KOMBINERT:
   1) Funksjoner (m/ domene-brackets + glidere)
   2) Linje-fra-punkter (m/ fasit, brøkformat ved snap)
   Autozoom-policy:
     - Avgrenset (domene): vis hele grafen + akser.
     - Uavgrenset: bruk [-5,5] så lenge sentrale punkter (røtter,
       ekstremalpunkter, y-skjæring, horisontal asymptote) ligger inne;
       ellers utvid minimalt. Inkluder asymptoter i utsnittet.
   1:1-grid når majorX===majorY (eller lockAspect=true). Robust SVG-eksport.
   ========================================================= */

/* ======================= URL-baserte innstillinger ======================= */
if (typeof Math.log10 !== 'function') {
  Math.log10 = x => Math.log(x) / Math.LN10;
}

const params = new URLSearchParams(location.search);
const GLOBAL_SCOPE = typeof window !== 'undefined' ? window : typeof globalThis !== 'undefined' ? globalThis : null;
let JXG_INSTANCE = GLOBAL_SCOPE && typeof GLOBAL_SCOPE.JXG === 'object' ? GLOBAL_SCOPE.JXG : null;
let jxgConfigured = false;
const jxgReadyQueue = [];
let jxgCheckScheduled = false;
function getJXG() {
  if (JXG_INSTANCE && typeof JXG_INSTANCE === 'object') {
    return JXG_INSTANCE;
  }
  if (GLOBAL_SCOPE && typeof GLOBAL_SCOPE.JXG === 'object') {
    JXG_INSTANCE = GLOBAL_SCOPE.JXG;
    return JXG_INSTANCE;
  }
  return null;
}
function configureJXGOptions(jxg) {
  if (!jxg || jxgConfigured) return;
  if (jxg.Options && typeof jxg.Options === 'object') {
    try {
      jxg.Options.showCopyright = false;
      jxg.Options.showNavigation = false;
      if (jxg.Options.text) {
        jxg.Options.text.display = 'internal';
      }
    } catch (_) {}
  }
  jxgConfigured = true;
}
if (JXG_INSTANCE) {
  configureJXGOptions(JXG_INSTANCE);
}
function flushJXGReadyQueue(jxg) {
  if (!jxg) return;
  configureJXGOptions(jxg);
  while (jxgReadyQueue.length) {
    const cb = jxgReadyQueue.shift();
    try {
      cb(jxg);
    } catch (_) {}
  }
}
function scheduleJXGCheck() {
  if (jxgCheckScheduled || !GLOBAL_SCOPE) return;
  jxgCheckScheduled = true;
  const poll = () => {
    jxgCheckScheduled = false;
    const jxg = getJXG();
    if (jxg) {
      flushJXGReadyQueue(jxg);
      return;
    }
    GLOBAL_SCOPE.setTimeout(poll, 16);
    jxgCheckScheduled = true;
  };
  poll();
}
function whenJXGReady(callback) {
  if (typeof callback !== 'function') return;
  const jxg = getJXG();
  if (jxg) {
    callback(jxg);
    return;
  }
  jxgReadyQueue.push(callback);
  scheduleJXGCheck();
}
const SETTINGS_STORAGE_KEY = 'mathVisuals:settings';
const FALLBACK_CURVE_COLORS = ['#1F4DE2', '#475569', '#ef4444', '#0ea5e9', '#10b981', '#f59e0b'];
const FALLBACK_LINE_THICKNESS = 3;
const CAMPUS_CURVE_ORDER = [0, 1, 2, 3, 4, 5];
const DEFAULT_FUNCTION_EXPRESSION = 'f(x)=x^2-2';

function getSettingsApi() {
  if (typeof window === 'undefined') return null;
  const api = window.MathVisualsSettings;
  return api && typeof api === 'object' ? api : null;
}

function resolveProjectNameHint() {
  const doc = typeof document !== 'undefined' ? document : null;
  if (doc && doc.documentElement) {
    const root = doc.documentElement;
    const activeAttr = root.getAttribute('data-mv-active-project');
    if (typeof activeAttr === 'string' && activeAttr.trim()) {
      return activeAttr.trim().toLowerCase();
    }
    const themeAttr = root.getAttribute('data-theme-profile');
    if (typeof themeAttr === 'string' && themeAttr.trim()) {
      return themeAttr.trim().toLowerCase();
    }
  }
  const api = getSettingsApi();
  if (api && typeof api.getActiveProject === 'function') {
    try {
      const value = api.getActiveProject();
      if (typeof value === 'string' && value.trim()) {
        return value.trim().toLowerCase();
      }
    } catch (_) {}
  }
  return null;
}
function sanitizeStoredColor(value) {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  const match = /^#?([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.exec(trimmed);
  if (!match) return null;
  let hex = match[1].toLowerCase();
  if (hex.length === 3) {
    hex = hex.split('').map(ch => ch + ch).join('');
  }
  return `#${hex}`;
}
function cycleColors(source, count) {
  const base = Array.isArray(source) ? source.filter(color => typeof color === 'string' && color) : [];
  if (!base.length) return [];
  if (!Number.isFinite(count) || count <= 0) {
    return base.slice();
  }
  const target = Math.trunc(count);
  const result = [];
  for (let i = 0; i < target; i += 1) {
    result.push(base[i % base.length]);
  }
  return result;
}
function clampLineThicknessValue(value) {
  const num = Number.parseFloat(value);
  if (!Number.isFinite(num)) return FALLBACK_LINE_THICKNESS;
  if (num < 1) return 1;
  if (num > 12) return 12;
  return num;
}
function readStoredSettings() {
  if (typeof window === 'undefined' || !window.localStorage) return null;
  try {
    const raw = window.localStorage.getItem(SETTINGS_STORAGE_KEY);
    if (typeof raw !== 'string' || !raw) return null;
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : null;
  } catch (_) {
    return null;
  }
}
function resolveSettingsSnapshot() {
  const api = getSettingsApi();
  if (api && typeof api.getSettings === 'function') {
    try {
      const snapshot = api.getSettings();
      if (snapshot && typeof snapshot === 'object') {
        return snapshot;
      }
    } catch (_) {}
  }
  return readStoredSettings();
}
function getBaseCurveColors(count) {
  const api = getSettingsApi();
  const targetCount = Number.isFinite(count) && count > 0 ? Math.trunc(count) : undefined;
  const project = resolveProjectNameHint();
  if (api && typeof api.getDefaultColors === 'function') {
    try {
      const palette = api.getDefaultColors(targetCount, project ? { project } : undefined);
      if (Array.isArray(palette) && palette.length) {
        return cycleColors(palette, targetCount || palette.length);
      }
    } catch (_) {}
  }
  const stored = resolveSettingsSnapshot();
  if (stored && typeof stored === 'object') {
    if (project && stored.projects && typeof stored.projects === 'object') {
      const projectSettings = stored.projects[project];
      if (projectSettings && Array.isArray(projectSettings.defaultColors)) {
        const projectPalette = projectSettings.defaultColors.map(sanitizeStoredColor).filter(Boolean);
        if (projectPalette.length) {
          return cycleColors(projectPalette, targetCount || projectPalette.length);
        }
      }
    }
    if (Array.isArray(stored.defaultColors)) {
      const sanitized = stored.defaultColors.map(sanitizeStoredColor).filter(Boolean);
      if (sanitized.length) {
        return cycleColors(sanitized, targetCount || sanitized.length);
      }
    }
  }
  return cycleColors(FALLBACK_CURVE_COLORS, targetCount || FALLBACK_CURVE_COLORS.length);
}
function getDefaultCurveColor(index) {
  const palette = getBaseCurveColors(index + 1);
  if (!palette.length) {
    return FALLBACK_CURVE_COLORS[index % FALLBACK_CURVE_COLORS.length];
  }
  return palette[index % palette.length];
}
function getDefaultLineThickness() {
  const api = getSettingsApi();
  if (api && typeof api.getDefaultLineThickness === 'function') {
    try {
      const value = api.getDefaultLineThickness();
      if (Number.isFinite(value)) {
        return clampLineThicknessValue(value);
      }
    } catch (_) {}
  }
  const stored = resolveSettingsSnapshot();
  if (stored && stored.defaultLineThickness != null) {
    return clampLineThicknessValue(stored.defaultLineThickness);
  }
  return FALLBACK_LINE_THICKNESS;
}

const DEFAULT_GRAFTEGNER_SIMPLE = {
  axes: {
    xMin: -5,
    xMax: 5,
    yMin: -4,
    yMax: 6
  },
  expressions: [
    {
      id: 'expr-1',
      latex: 'y=x^2-1',
      color: '#2563eb',
      visible: true
    },
    {
      id: 'expr-2',
      latex: 'y=2x+3',
      color: '#f97316',
      visible: true
    }
  ],
  altText: '',
  altTextSource: 'auto'
};

const DEFAULT_GRAFTEGNER_TRIG_SIMPLE = {
  axes: {
    xMin: -7,
    xMax: 7,
    yMin: -2,
    yMax: 2
  },
  expressions: [
    {
      id: 'expr-1',
      latex: 'y=\\sin(x)',
      color: '#0ea5e9',
      visible: true
    },
    {
      id: 'expr-2',
      latex: 'y=\\cos(x)',
      color: '#10b981',
      visible: true
    }
  ],
  altText: '',
  altTextSource: 'auto'
};

const AXIS_ARROW_PIXEL_THICKNESS = 26;
const AXIS_ARROW_ASPECT_RATIO = 17 / 30;
const AXIS_LABEL_OFFSET_PX = 10;

const X_AXIS_ARROW_SVG_TEMPLATE =
  '<svg width="17" height="30" viewBox="0 0 17 30" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M16.1421 16.1421C16.9231 15.3611 16.9231 14.0948 16.1421 13.3137L3.41417 0.5858C2.63313 -0.195248 1.3668 -0.195248 0.585748 0.5858C-0.195301 1.36685 -0.195301 2.63318 0.585748 3.41423L11.8995 14.7279L0.585748 26.0416C-0.195301 26.8227 -0.195301 28.089 0.585748 28.8701C1.3668 29.6511 2.63313 29.6511 3.41417 28.8701L16.1421 16.1421ZM14.7278 14.7279V16.7279H14.7279V14.7279V12.7279H14.7278V14.7279Z" fill="{{COLOR}}"/></svg>';
const Y_AXIS_ARROW_SVG_TEMPLATE =
  '<svg width="30" height="17" viewBox="0 0 30 17" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M16.1422 0.585778C15.3612 -0.195271 14.0949 -0.195271 13.3138 0.585778L0.585892 13.3137C-0.195157 14.0947 -0.195157 15.3611 0.585892 16.1421C1.36694 16.9232 2.63327 16.9232 3.41432 16.1421L14.728 4.82842L26.0417 16.1421C26.8228 16.9232 28.0891 16.9232 28.8702 16.1421C29.6512 15.3611 29.6512 14.0947 28.8702 13.3137L16.1422 0.585778ZM14.728 2.00009L16.728 2.00009V1.99999L14.728 1.99999L12.728 1.99999V2.00009L14.728 2.00009Z" fill="{{COLOR}}"/></svg>';

function axisArrowSvgData(axis, color) {
  const template = axis === 'y' ? Y_AXIS_ARROW_SVG_TEMPLATE : X_AXIS_ARROW_SVG_TEMPLATE;
  const normalized = typeof color === 'string' ? color.trim() : '';
  const tint = normalized ? normalized : '#000000';
  return `data:image/svg+xml;utf8,${encodeURIComponent(template.replace(/{{COLOR}}/g, tint))}`;
}

const DEFAULT_AXIS_COLOR = '#111827';
const CAMPUS_AXIS_COLOR = '#1F4DE2';

const POINT_MARKER_SIZE = 6;

function getThemeApi() {
  const theme = typeof window !== 'undefined' ? window.MathVisualsTheme : null;
  return theme && typeof theme === 'object' ? theme : null;
}

function resolveAxisStrokeColor() {
  const theme = getThemeApi();
  const normalize = value => {
    if (typeof value !== 'string') return null;
    const trimmed = value.trim();
    return trimmed ? trimmed : null;
  };
  if (theme && typeof theme.getColor === 'function') {
    const tokenColor = normalize(theme.getColor('graphs.axis'));
    if (tokenColor) {
      return tokenColor;
    }
    const activeRaw = typeof theme.getActiveProfileName === 'function' ? normalize(theme.getActiveProfileName()) : null;
    const active = activeRaw ? activeRaw.toLowerCase() : null;
    if (active === 'campus') {
      const campusPrimary = normalize(theme.getColor('ui.primary'));
      return campusPrimary || CAMPUS_AXIS_COLOR;
    }
  }
  return DEFAULT_AXIS_COLOR;
}
function applyThemeToDocument() {
  const theme = getThemeApi();
  if (theme && typeof theme.applyToDocument === 'function') {
    theme.applyToDocument(document);
  }
}
function ensureColorCount(base, fallback, count) {
  const hasBase = Array.isArray(base) && base.length;
  const targetCount = Number.isFinite(count) && count > 0 ? Math.trunc(count) : undefined;
  const fallbackPalette = Array.isArray(fallback) && fallback.length ? fallback : getBaseCurveColors(targetCount);
  const effectiveCount = targetCount || (hasBase ? base.length : fallbackPalette.length);
  const result = [];
  for (let i = 0; i < effectiveCount; i += 1) {
    const candidate = hasBase && typeof base[i] === 'string' && base[i] ? base[i] : null;
    const fallbackColor = fallbackPalette[i % fallbackPalette.length] || getDefaultCurveColor(i);
    result.push(candidate || fallbackColor);
  }
  return result;
}
function normalizeColorValue(value) {
  if (typeof value !== 'string') return '';
  const trimmed = value.trim();
  if (!trimmed) return '';
  const match = /^#?([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.exec(trimmed);
  if (!match) return '';
  let hex = match[1].toLowerCase();
  if (hex.length === 3) {
    hex = hex.split('').map(ch => ch + ch).join('');
  }
  return `#${hex}`;
}
function resolveCurvePalette(count = undefined) {
  const targetCount = Number.isFinite(count) && count > 0 ? Math.trunc(count) : undefined;
  const basePalette = getBaseCurveColors(targetCount);
  const theme = getThemeApi();
  if (theme && typeof theme.getPalette === 'function') {
    const active = typeof theme.getActiveProfileName === 'function' ? theme.getActiveProfileName() : null;
    const palette = theme.getPalette('figures', targetCount || basePalette.length, { fallbackKinds: ['fractions'] });
    if (Array.isArray(palette) && palette.length) {
      const reordered = active && active.toLowerCase() === 'campus'
        ? CAMPUS_CURVE_ORDER.map(idx => palette[idx % palette.length])
        : palette;
      return ensureColorCount(reordered, basePalette, targetCount || reordered.length);
    }
  }
  return ensureColorCount(basePalette, basePalette, targetCount || basePalette.length);
}
applyThemeToDocument();
function paramStr(id, def = '') {
  const v = params.get(id);
  return v == null ? def : v;
}
function paramBool(id) {
  return params.get(id) === '1';
}
function paramNumber(id, def = null) {
  const v = params.get(id);
  if (v == null) return def;
  const n = Number.parseFloat(String(v).replace(',', '.'));
  return Number.isFinite(n) ? n : def;
}
const DEFAULT_POINT_MARKER = 'o';
const DEFAULT_DOMAIN_VALUE = '-∞, ∞';
const DEFAULT_UNBOUNDED_DOMAIN_SPAN = 10;
function sanitizePointMarkerValue(value) {
  if (typeof value !== 'string') return '';
  return value.trim();
}
function parsePointMarkerList(value) {
  if (typeof value !== 'string') return [];
  return value
    .split(';')
    .map(part => sanitizePointMarkerValue(part))
    .map(part => part.replace(/\s+/g, ' ').trim())
    .filter(Boolean);
}
function formatPointMarkerList(markers) {
  if (!Array.isArray(markers) || !markers.length) return '';
  return markers.map(marker => sanitizePointMarkerValue(marker)).filter(Boolean).join('; ');
}
function normalizePointMarkerValue(value) {
  const markers = parsePointMarkerList(value);
  if (!markers.length) return '';
  return formatPointMarkerList(markers);
}
function markerValueForIndex(markers, index) {
  if (!Array.isArray(markers) || markers.length === 0) {
    return '';
  }
  if (index < markers.length) {
    return markers[index];
  }
  return markers[markers.length - 1];
}
function isDefaultPointMarker(value) {
  const markers = parsePointMarkerList(value);
  if (!markers.length) return true;
  return markers.every(marker => sanitizePointMarkerValue(marker) === DEFAULT_POINT_MARKER);
}
const FONT_LIMITS = {
  min: 6,
  max: 72
};
const FONT_DEFAULT = 15;
const FONT_PARAM_KEYS = ['fontSize', 'font', 'axisFont', 'tickFont', 'curveFont'];
const SHOW_CURVE_NAMES = params.has('showNames') ? paramBool('showNames') : true;
const SHOW_CURVE_EXPRESSIONS = params.has('showExpr') ? paramBool('showExpr') : false;
const SHOW_DOMAIN_MARKERS = params.has('brackets') ? paramBool('brackets') : true;
const SHOW_AXIS_NUMBERS = params.has('axisNumbers') ? paramBool('axisNumbers') : true;
const SHOW_GRID = params.has('grid') ? paramBool('grid') : true;
function clampFontSize(val) {
  if (!Number.isFinite(val)) return null;
  if (val < FONT_LIMITS.min) return FONT_LIMITS.min;
  if (val > FONT_LIMITS.max) return FONT_LIMITS.max;
  return val;
}
function sanitizeFontSize(val, fallback) {
  const clamped = clampFontSize(val);
  return clamped == null ? fallback : clamped;
}
function resolveSharedFontSize() {
  for (const key of FONT_PARAM_KEYS) {
    const candidate = clampFontSize(paramNumber(key, null));
    if (candidate != null) {
      return candidate;
    }
  }
  return FONT_DEFAULT;
}
const SHARED_FONT_SIZE = resolveSharedFontSize();
let FORCE_TICKS_REQUESTED = params.has('forceTicks') ? paramBool('forceTicks') : true;
function parseScreen(str) {
  if (!str) return null;
  const cleaned = str.replace(/^[\s\[]+|[\]\s]+$/g, '');
  const parts = cleaned.split(',').map(s => +s.trim());
  return parts.length === 4 && parts.every(Number.isFinite) ? parts : null;
}
function screensEqual(a, b) {
  if (a === b) return true;
  if (!Array.isArray(a) || !Array.isArray(b)) return false;
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (Math.abs(a[i] - b[i]) > 1e-9) {
      return false;
    }
  }
  return true;
}
function buildSimple() {
  const lines = [];
  let i = 1;
  while (true) {
    const key = `fun${i}`;
    const fun = paramStr(key, i === 1 ? DEFAULT_FUNCTION_EXPRESSION : '').trim();
    const dom = paramStr(`dom${i}`, '').trim();
    const colorParam = paramStr(`color${i}`, '').trim();
    const colorValue = normalizeColorValue(colorParam);
    if (i === 1 || params.has(key)) {
      if (fun) {
        const baseLine = dom ? `${fun}, x in ${dom}` : fun;
        const withColor = colorValue ? `${baseLine}, color=${colorValue}` : baseLine;
        lines.push(withColor);
      }
      i++;
    } else {
      break;
    }
  }
  const pts = paramStr('points', '0').trim();
  if (pts) {
    lines.push(`points=${pts}`);
  }
  const startx = paramStr('startx', '').trim();
  if (startx) {
    lines.push(`startx=${startx}`);
  }
  const coords = paramStr('coords', '').trim();
  if (coords) {
    lines.push(`coords=${coords}`);
  }
  const marker = normalizePointMarkerValue(paramStr('marker', ''));
  if (!isDefaultPointMarker(marker)) {
    lines.push(`marker=${marker}`);
  }
  if (params.has('lockpoint')) {
    const lockRaw = paramStr('lockpoint', '').trim();
    if (/^(?:0|false|nei|off|no)$/i.test(lockRaw)) {
      lines.push('lockpoint=false');
    }
  }
  const linepts = paramStr('linepts', '').trim();
  if (linepts) {
    lines.push(`linepts=${linepts}`);
  }
  return lines.join('\n');
}
let SIMPLE = typeof window !== 'undefined' && typeof window.SIMPLE !== 'undefined' ? window.SIMPLE : buildSimple();
let LAST_RENDERED_SIMPLE = SIMPLE;
let PENDING_SIMPLE_REBUILD = null;
function cancelScheduledSimpleRebuild() {
  if (PENDING_SIMPLE_REBUILD != null) {
    clearTimeout(PENDING_SIMPLE_REBUILD);
    PENDING_SIMPLE_REBUILD = null;
  }
}
function scheduleSimpleRebuild() {
  if (typeof setTimeout !== 'function') {
    return;
  }
  if (SIMPLE === LAST_RENDERED_SIMPLE) {
    cancelScheduledSimpleRebuild();
    return;
  }
  cancelScheduledSimpleRebuild();
  PENDING_SIMPLE_REBUILD = setTimeout(() => {
    PENDING_SIMPLE_REBUILD = null;
    if (SIMPLE !== LAST_RENDERED_SIMPLE) {
      requestRebuild();
    }
  }, 180);
}

function createSimpleFormChangeQueue(task, delay = 360) {
  const safeTask = typeof task === 'function' ? task : null;
  const safeDelay = Number.isFinite(delay) && delay >= 0 ? delay : 360;
  let pending = null;
  const invoke = () => {
    pending = null;
    if (safeTask) {
      safeTask();
    }
  };
  const schedule = () => {
    if (!safeTask) return;
    if (typeof setTimeout !== 'function' || safeDelay === 0) {
      invoke();
      return;
    }
    if (pending != null) {
      clearTimeout(pending);
    }
    pending = setTimeout(invoke, safeDelay);
  };
  schedule.flush = () => {
    if (!safeTask) return;
    if (pending != null) {
      clearTimeout(pending);
      pending = null;
    }
    safeTask();
  };
  return schedule;
}
if (typeof window !== 'undefined') {
  window.SIMPLE = SIMPLE;
}

const ALT_TEXT_DEFAULT_STATE = {
  text: '',
  source: 'auto'
};
let ALT_TEXT_STATE = {
  ...ALT_TEXT_DEFAULT_STATE
};
if (typeof window !== 'undefined' && window.GRAF_ALT_TEXT && typeof window.GRAF_ALT_TEXT === 'object') {
  const existing = window.GRAF_ALT_TEXT;
  ALT_TEXT_STATE.text = typeof existing.text === 'string' ? existing.text : '';
  ALT_TEXT_STATE.source = existing.source === 'manual' ? 'manual' : 'auto';
}
if (typeof window !== 'undefined') {
  window.GRAF_ALT_TEXT = ALT_TEXT_STATE;
}
let altTextManager = null;

/* ====================== AVANSERT KONFIG ===================== */
const INITIAL_POINT_MARKER_RAW = paramStr('marker', DEFAULT_POINT_MARKER);
const INITIAL_POINT_MARKER_NORMALIZED = normalizePointMarkerValue(INITIAL_POINT_MARKER_RAW);
const INITIAL_POINT_MARKER_LIST = parsePointMarkerList(INITIAL_POINT_MARKER_RAW);
const INITIAL_POINT_MARKER_VALUE = !INITIAL_POINT_MARKER_NORMALIZED || isDefaultPointMarker(INITIAL_POINT_MARKER_NORMALIZED)
  ? DEFAULT_POINT_MARKER
  : INITIAL_POINT_MARKER_NORMALIZED;
const ADV = {
  axis: {
    labels: {
      x: paramStr('xName', 'x'),
      y: paramStr('yName', 'y'),
      fontSize: SHARED_FONT_SIZE
    },
    style: {
      stroke: resolveAxisStrokeColor(),
      width: getDefaultLineThickness()
    },
    ticks: {
      showNumbers: SHOW_AXIS_NUMBERS
    },
    grid: {
      show: SHOW_GRID,
      majorX: 1,
      majorY: 1,
      labelPrecision: 0,
      fontSize: SHARED_FONT_SIZE
    },
    forceIntegers: FORCE_TICKS_REQUESTED
  },
  screen: parseScreen(paramStr('screen', '')),
  lockAspect: params.has('lock') ? paramBool('lock') : true,
  firstQuadrant: paramBool('q1'),
  interactions: {
    pan: {
      enabled: paramBool('pan'),
      needShift: false
    },
    zoom: {
      enabled: params.has('zoom') ? paramBool('zoom') : false,
      wheel: true,
      needShift: false,
      factorX: 1.2,
      factorY: 1.2
    }
  },
  /* Brukes i punkts-modus og for glidere i funksjons-modus */
  points: {
    start: [[-3, 1], [1, 3]],
    // to punkt i linje-modus
    startX: [1],
    // start-X for glidere (kan overstyres i SIMPLE)
    showCoordsOnHover: true,
    marker: INITIAL_POINT_MARKER_VALUE,
    markerList: INITIAL_POINT_MARKER_LIST,
    decimals: 2,
    guideArrows: true,
    lockExtraPoints: true,
    // bare i funksjons-modus
    snap: {
      enabled: params.has('snap') ? paramBool('snap') : true,
      mode: 'up',
      // 'drag' | 'up'
      stepX: null,
      // null => bruk axis.grid.majorX
      stepY: null // null => bruk axis.grid.majorY
    }
  },
  // Grafnavn
  curveName: {
    show: SHOW_CURVE_NAMES || SHOW_CURVE_EXPRESSIONS,
    showName: SHOW_CURVE_NAMES,
    showExpression: SHOW_CURVE_EXPRESSIONS,
    fontSize: SHARED_FONT_SIZE,
    layer: 30,
    fractions: [0.2, 0.8, 0.6, 0.4],
    gapPx: 30,
    plate: {
      paddingPx: 4,
      fill: '#fff',
      opacity: 0.6,
      radiusPx: 4
    },
    marginFracX: 0.04,
    marginFracY: 0.04
  },
  // Domenemarkører (brackets)
  domainMarkers: {
    show: SHOW_DOMAIN_MARKERS,
    barPx: 22,
    tipFrac: 0.20,
    color: '#6b7280',
    width: getDefaultLineThickness(),
    layer: 8
  },
  // Asymptoter
  asymptote: {
    detect: true,
    showVertical: true,
    hugeY: 30,
    trimY: 8
  },
  // Fasit-sjekk (linje-modus)
  check: {
    slopeTol: 1e-3,
    interTol: 1e-3
  }
};

const DOMAIN_MARKER_SHAPES = {
  closed: {
    points: [
      [18.5, 47],
      [3, 47],
      [2.610756875, 46.9214171875],
      [2.2928949999999997, 46.7071125],
      [2.078585625, 46.3892515625],
      [2, 46],
      [2, 3],
      [2.078585625, 2.610756875],
      [2.2928949999999997, 2.2928949999999997],
      [2.610756875, 2.078585625],
      [3, 2],
      [18.5, 2]
    ]
  },
  open: {
    points: [
      [2, 47.5],
      [37.6146, 25.6019],
      [37.97173125, 25.225853125],
      [38.090775, 24.75],
      [37.97173125, 24.274146875],
      [37.6146, 23.8981],
      [2, 2]
    ]
  }
};

Object.values(DOMAIN_MARKER_SHAPES).forEach(shape => {
  if (!shape || !Array.isArray(shape.points) || !shape.points.length) return;
  const xs = shape.points.map(pt => pt[0]);
  const ys = shape.points.map(pt => pt[1]);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  shape.centerX = (minX + maxX) / 2;
  shape.centerY = (minY + maxY) / 2;
  shape.height = Math.max(1e-6, maxY - minY);
});

const DEFAULT_LINE_POINTS = ADV.points.start.map(pt => pt.slice());

function parsePointListString(str) {
  if (typeof str !== 'string') return [];
  return str.split(';').map(part => {
    const cleaned = part.trim().replace(/^\(|\)$/g, '');
    if (!cleaned) return null;
    const coords = cleaned.split(',').map(token => Number.parseFloat(token.trim().replace(',', '.')));
    if (coords.length !== 2) return null;
    if (!coords.every(Number.isFinite)) return null;
    return coords;
  }).filter(Boolean);
}

function extractLineRhs(expr) {
  if (typeof expr !== 'string') return '';
  const match = expr.match(/^[a-zA-Z]\w*\s*\(\s*x\s*\)\s*=\s*(.+)$/i) || expr.match(/^y\s*=\s*(.+)$/i);
  return match ? match[1].trim() : expr.trim();
}

function interpretLineTemplate(rhs) {
  const base = { kind: null, anchorC: 0, slopeM: 1 };
  if (typeof rhs !== 'string') return base;
  const normalized = rhs.replace(/\s+/g, '').replace(/·/g, '*').replace(/,/g, '.').replace(/−/g, '-').toLowerCase();
  if (!normalized) return base;
  if (/^a\*?x$/.test(normalized)) {
    return {
      kind: 'anchorY',
      anchorC: 0,
      slopeM: 1
    };
  }
  if (/^a\*?x([+-])(\d+(?:\.\d+)?)$/.test(normalized)) {
    const sign = RegExp.$1 === '-' ? -1 : 1;
    const value = Number.parseFloat(RegExp.$2);
    return {
      kind: 'anchorY',
      anchorC: Number.isFinite(value) ? sign * value : 0,
      slopeM: 1
    };
  }
  if (/^([+-]?\d*(?:\.\d+)?)\*?x\+b$/.test(normalized)) {
    const raw = RegExp.$1;
    let slopeM = 1;
    if (raw === '' || raw === '+') {
      slopeM = 1;
    } else if (raw === '-') {
      slopeM = -1;
    } else {
      const parsed = Number.parseFloat(raw);
      slopeM = Number.isFinite(parsed) ? parsed : 1;
    }
    return {
      kind: 'fixedSlope',
      anchorC: 0,
      slopeM
    };
  }
  const hasA = /(^|[+\-*/(])a(?=\*?x(?![a-z]))/.test(normalized);
  const hasB = /(^|[+\-])b(?![a-z])(?!\*|x)/.test(normalized);
  if (hasA && hasB) {
    return {
      kind: 'two',
      anchorC: 0,
      slopeM: 1
    };
  }
  return base;
}

function interpretLineTemplateFromExpression(expr) {
  return interpretLineTemplate(extractLineRhs(expr));
}

function isValidPointArray(pt) {
  return Array.isArray(pt) && pt.length === 2 && pt.every(Number.isFinite);
}

function resolveLineStartPoints(parsed) {
  const basePoints = DEFAULT_LINE_POINTS.map(pt => pt.slice());
  if (!parsed) {
    return basePoints;
  }
  const first = parsed.funcs && parsed.funcs[0] ? parsed.funcs[0] : null;
  const spec = interpretLineTemplate(first ? first.rhs : '');
  const needed = spec.kind === 'two' ? 2 : spec.kind ? 1 : 0;
  if (Array.isArray(parsed.linePoints)) {
    const valid = parsed.linePoints.filter(isValidPointArray);
    if (valid[0]) basePoints[0] = valid[0].slice();
    if (needed > 1 && valid[1]) basePoints[1] = valid[1].slice();
  }
  return basePoints;
}

function applyLinePointStart(parsed) {
  const resolved = resolveLineStartPoints(parsed);
  ADV.points.start = resolved.map(pt => pt.slice());
  if (parsed && typeof parsed === 'object') {
    const xValues = resolved
      .map(pt => Array.isArray(pt) && pt.length > 0 ? pt[0] : null)
      .filter(val => Number.isFinite(val));
    if (xValues.length) {
      const existingStartX = Array.isArray(parsed.startX) ? parsed.startX.filter(Number.isFinite) : [];
      if (existingStartX.length < xValues.length) {
        parsed.startX = xValues.slice();
      }
    }
  }
  return resolved;
}

/* ======================= Parser / modus ======================= */
function normalizeDomainNumericString(str) {
  if (!str) return '';
  const replacedMinus = str.replace(/−/g, '-');
  let out = '';
  for (let i = 0; i < replacedMinus.length; i++) {
    const ch = replacedMinus[i];
    const prev = i > 0 ? replacedMinus[i - 1] : '';
    const next = i < replacedMinus.length - 1 ? replacedMinus[i + 1] : '';
    if (ch === ',' && /\d/.test(prev) && /\d/.test(next)) {
      out += '.';
    } else if (!/\s/.test(ch)) {
      out += ch;
    }
  }
  return out;
}

function splitDomainParts(str) {
  if (typeof str !== 'string') return [];
  const parts = [];
  let current = '';
  for (let i = 0; i < str.length; i++) {
    const ch = str[i];
    if (ch === ',') {
      const prev = i > 0 ? str[i - 1] : '';
      const next = i < str.length - 1 ? str[i + 1] : '';
      if (/\d/.test(prev) && /\d/.test(next)) {
        current += ch;
      } else {
        const trimmed = current.trim();
        if (trimmed) parts.push(trimmed);
        current = '';
      }
    } else {
      current += ch;
    }
  }
  const trimmed = current.trim();
  if (trimmed) parts.push(trimmed);
  return parts;
}

function stripDomainEndpointMarker(part, side) {
  if (typeof part !== 'string') {
    return { text: '', marker: null };
  }
  let trimmed = part.trim();
  if (!trimmed) {
    return { text: '', marker: null };
  }
  let marker = null;
  if (side === 'left') {
    const first = trimmed[0];
    if (['[', '<', '('].includes(first)) {
      marker = first;
      trimmed = trimmed.slice(1).trim();
    }
  }
  if (side === 'right') {
    const last = trimmed[trimmed.length - 1];
    if ([']', '>', ')'].includes(last)) {
      marker = last;
      trimmed = trimmed.slice(0, -1).trim();
    }
  }
  return { text: trimmed, marker };
}

function parseDomainNumber(str) {
  if (!str) return null;
  const normalized = normalizeDomainNumericString(str);
  if (!normalized) return null;
  const infinityMatch = normalized.match(/^([+-])?(?:inf(?:inity)?|∞)$/i);
  if (infinityMatch) {
    const sign = infinityMatch[1] === '-' ? -1 : 1;
    return sign < 0 ? -Infinity : Infinity;
  }
  const num = Number.parseFloat(normalized.replace(/∞/gi, ''));
  if (Number.isFinite(num)) {
    return num;
  }
  return null;
}

function parseDomainString(dom) {
  if (!dom) return null;
  const cleaned = dom.trim();
  if (!cleaned) return null;
  if (/^r$/i.test(cleaned) || /^ℝ$/i.test(cleaned)) return null;
  const normalized = cleaned
    .replace(/[⟨〈]/g, '<')
    .replace(/[⟩〉]/g, '>')
    .replace(/≤/g, '<=')
    .replace(/≥/g, '>=')
    .replace(/−/g, '-');
  const buildDomain = (leftPart, rightPart, opts = {}) => {
    const leftInfo = stripDomainEndpointMarker(leftPart, 'left');
    const rightInfo = stripDomainEndpointMarker(rightPart, 'right');
    const leftMarker = opts.leftMarker != null ? opts.leftMarker : leftInfo.marker;
    const rightMarker = opts.rightMarker != null ? opts.rightMarker : rightInfo.marker;
    const a = parseDomainNumber(leftInfo.text);
    const b = parseDomainNumber(rightInfo.text);
    if (a == null || b == null) return null;
    if (!(b >= a)) return null;
    if (!Number.isFinite(a) && !Number.isFinite(b)) return null;
    const hasExplicitLeft = leftMarker != null;
    const hasExplicitRight = rightMarker != null;
    let leftClosed = hasExplicitLeft ? leftMarker === '[' : false;
    let rightClosed = hasExplicitRight ? rightMarker === ']' : false;
    if (!Number.isFinite(a)) leftClosed = false;
    if (!Number.isFinite(b)) rightClosed = false;
    const hasMarkers =
      opts.showMarkers === undefined ? leftMarker != null || rightMarker != null : !!opts.showMarkers;
    return {
      min: a,
      max: b,
      leftClosed,
      rightClosed,
      showMarkers: hasMarkers
    };
  };
  const start = normalized[0];
  const end = normalized[normalized.length - 1];
  const isBracketStart = ['[', '<', '('].includes(start);
  const isBracketEnd = [']', '>', ')'].includes(end);
  if (isBracketStart && isBracketEnd) {
    const inner = normalized.slice(1, -1);
    const parts = splitDomainParts(inner);
    if (parts.length === 2) {
      const bracketDomain = buildDomain(parts[0], parts[1], {
        leftMarker: start,
        rightMarker: end,
        showMarkers: true
      });
      if (bracketDomain) {
        return bracketDomain;
      }
    }
    return null;
  }
  const inequality = normalized.match(
    /^([+-]?(?:\d+(?:[.,]\d+)?|[.,]\d+|∞|inf(?:inity)?))\s*(<=|<)\s*[xX]\s*(<=|<)\s*([+-]?(?:\d+(?:[.,]\d+)?|[.,]\d+|∞|inf(?:inity)?))$/i
  );
  if (inequality) {
    const a = parseDomainNumber(inequality[1]);
    const b = parseDomainNumber(inequality[4]);
    if (a != null && b != null && b >= a) {
      if (!Number.isFinite(a) && !Number.isFinite(b)) return null;
      return {
        min: a,
        max: b,
        leftClosed: inequality[2] === '<=' && Number.isFinite(a),
        rightClosed: inequality[3] === '<=' && Number.isFinite(b),
        showMarkers: true
      };
    }
  }
  const parts = splitDomainParts(normalized);
  if (parts.length === 2) {
    const fallbackDomain = buildDomain(parts[0], parts[1]);
    if (fallbackDomain) {
      return fallbackDomain;
    }
  }
  return null;
}

function formatDomainNumber(value) {
  if (value === Infinity) return '∞';
  if (value === -Infinity) return '-∞';
  if (typeof value !== 'number' || !Number.isFinite(value)) return '';
  const normalized = Object.is(value, -0) ? 0 : value;
  if (Number.isInteger(normalized)) {
    return String(normalized);
  }
  let out = normalized
    .toFixed(6)
    .replace(/(\.\d*?)0+$/, '$1')
    .replace(/\.$/, '');
  if (out.includes('.')) {
    out = out.replace('.', ',');
  }
  return out;
}

function formatDomainForInput(domain) {
  if (!domain || typeof domain !== 'object') {
    return '';
  }
  const hasMin = Number.isFinite(domain.min);
  const hasMax = Number.isFinite(domain.max);
  if (!hasMin && !hasMax) {
    return '';
  }
  const min = hasMin ? formatDomainNumber(domain.min) : '-∞';
  const max = hasMax ? formatDomainNumber(domain.max) : '∞';
  if ((hasMin && !min) || (hasMax && !max)) {
    return '';
  }
  if (domain.showMarkers === false) {
    return `${min}, ${max}`;
  }
  const left = hasMin && domain.leftClosed ? '[' : '<';
  const right = hasMax && domain.rightClosed ? ']' : '>';
  return `${left}${min}, ${max}${right}`;
}

function normalizeDomainInputValue(value) {
  const parsed = parseDomainString(value);
  if (!parsed) return null;
  const formatted = formatDomainForInput(parsed);
  if (!formatted) return null;
  return { parsed, formatted };
}

function resolveDomainSamplingBounds(domain) {
  const span = DEFAULT_UNBOUNDED_DOMAIN_SPAN;
  if (!domain || typeof domain !== 'object') {
    return [-5, 5];
  }
  const hasMin = Number.isFinite(domain.min);
  const hasMax = Number.isFinite(domain.max);
  if (hasMin && hasMax) {
    return [domain.min, domain.max];
  }
  if (hasMin && !hasMax) {
    const start = domain.min;
    return [start, start + span];
  }
  if (!hasMin && hasMax) {
    const end = domain.max;
    return [end - span, end];
  }
  const half = span / 2;
  return [-half, half];
}

function parseSimple(txt) {
  const lines = (txt || '').split('\n').map(s => s.trim()).filter(Boolean);
  const out = {
    funcs: [],
    pointsCount: 0,
    startX: [],
    extraPoints: [],
    linePoints: [],
    answer: null,
    answers: [],
    rows: [],
    pointMarker: '',
    pointMarkers: [],
    lockExtraPoints: true,
    raw: txt
  };
  const parseFunctionLine = line => {
    const eqIdx = line.indexOf('=');
    if (eqIdx < 0) return null;
    const lhsRaw = line.slice(0, eqIdx).trim();
    const rhsWithDom = line.slice(eqIdx + 1).trim();
    if (!lhsRaw || !rhsWithDom) return null;
    let name = null;
    let label = null;
    const lhsFn = lhsRaw.match(/^([a-zA-Z]\w*)\s*\(\s*x\s*\)$/i);
    if (lhsFn) {
      name = lhsFn[1];
      label = `${lhsFn[1]}(x)`;
    } else {
      const lhsVar = lhsRaw.match(/^([a-zA-Z]\w*)$/i);
      if (!lhsVar) return null;
      if (lhsVar[1].toLowerCase() !== 'y') return null;
      name = lhsVar[1];
      label = lhsVar[1];
    }
    let rhs = rhsWithDom;
    let domain = null;
    let color = '';
    let colorSource = 'auto';
    let searching = true;
    while (searching) {
      searching = false;
      const colorMatch = /,?\s*color\s*=\s*([^,]+)$/i.exec(rhs);
      if (colorMatch) {
        const normalizedColor = normalizeColorValue(colorMatch[1]);
        if (normalizedColor) {
          color = normalizedColor;
          colorSource = 'manual';
        }
        rhs = rhs.slice(0, colorMatch.index).trim();
        searching = true;
        continue;
      }
      const domMatch = /,?\s*x\s*(?:in|∈)\s*(.+)$/i.exec(rhs);
      if (domMatch) {
        rhs = rhs.slice(0, domMatch.index).trim();
        domain = parseDomainString(domMatch[1]);
        searching = true;
        continue;
      }
    }
    rhs = rhs.trim();
    if (!rhs) return null;
    return {
      name,
      rhs,
      domain,
      label,
      color,
      colorSource
    };
  };
  for (const L of lines) {
    const fun = parseFunctionLine(L);
    if (fun) {
      out.funcs.push(fun);
      out.rows.push({
        type: 'function',
        funcIndex: out.funcs.length - 1
      });
      continue;
    }
    const pm = L.match(/^points\s*=\s*(\d+)/i);
    if (pm) {
      out.pointsCount = +pm[1];
      continue;
    }
    const cm = L.match(/^coords\s*=\s*(.+)$/i);
    if (cm) {
      const startIndex = out.extraPoints.length;
      const pts = cm[1].split(';').map(s => s.trim().replace(/^\(|\)$/g, '')).filter(Boolean).map(p => p.split(',').map(t => +t.trim()).filter(Number.isFinite));
      for (const pt of pts) {
        if (pt.length === 2) out.extraPoints.push(pt);
      }
      const count = out.extraPoints.length - startIndex;
      if (count > 0) {
        out.rows.push({
          type: 'coords',
          pointStart: startIndex,
          pointCount: count
        });
      }
      continue;
    }
    const mm = L.match(/^marker\s*=\s*(.+)$/i);
    if (mm) {
      const normalizedMarker = normalizePointMarkerValue(mm[1]);
      out.pointMarkers = parsePointMarkerList(mm[1]);
      out.pointMarker = normalizedMarker || sanitizePointMarkerValue(mm[1]);
      continue;
    }
    const lockMatch = L.match(/^lockpoint\s*=\s*(.+)$/i);
    if (lockMatch) {
      const value = lockMatch[1].trim().toLowerCase();
      out.lockExtraPoints = !/^(?:0|false|nei|off|no)$/i.test(value);
      continue;
    }
    const lm = L.match(/^linepts\s*=\s*(.+)$/i);
    if (lm) {
      const pts = parsePointListString(lm[1]);
      for (const pt of pts) {
        if (pt.length === 2) out.linePoints.push(pt);
      }
      continue;
    }
    const sm = L.match(/^startx\s*=\s*(.+)$/i);
    if (sm) {
      out.startX = sm[1].split(',').map(s => +s.trim()).filter(Number.isFinite);
      continue;
    }
    const am = L.match(/^(?:riktig|fasit)(\d*)\s*:\s*(.+)$/i);
    if (am) {
      const idx = am[1] ? Math.max(1, Number.parseInt(am[1], 10)) - 1 : 0;
      const value = am[2].trim();
      if (value) {
        out.answers[idx] = value;
      }
      continue;
    }
  }
  if (!out.answer && Array.isArray(out.answers)) {
    const firstAnswer = out.answers.find(ans => typeof ans === 'string' && ans.trim());
    if (firstAnswer) {
      out.answer = firstAnswer;
    }
  }
  if (out.pointMarkers.length > out.extraPoints.length) {
    out.pointMarkers = out.pointMarkers.slice(0, out.extraPoints.length);
  }
  if (!out.pointMarker && out.pointMarkers.length) {
    out.pointMarker = formatPointMarkerList(out.pointMarkers);
  }
  return out;
}
let SIMPLE_PARSED = parseSimple(SIMPLE);
applyLinePointStart(SIMPLE_PARSED);
const ALLOWED_NAMES = ['sin', 'cos', 'tan', 'asin', 'acos', 'atan', 'sinh', 'cosh', 'tanh', 'log', 'ln', 'lg', 'sqrt', 'exp', 'abs', 'min', 'max', 'floor', 'ceil', 'round', 'pow'];
function isExplicitRHS(rhs) {
  let s = rhs.toLowerCase();
  for (const k of ALLOWED_NAMES) s = s.replace(new RegExp(`\\b${k}\\b`, 'g'), '');
  s = s.replace(/\bpi\b/g, '').replace(/\be\b/g, '').replace(/x/g, '');
  s = s.replace(/[0-9.+\-*/^()%\s]/g, '');
  return s.length === 0;
}
function decideMode(parsed) {
  const anyPlaceholder = parsed.funcs.some(f => !isExplicitRHS(f.rhs));
  return anyPlaceholder ? 'points' : 'functions';
}
let MODE = decideMode(SIMPLE_PARSED);
// Deaktiverer "Tving 1, 2, 3" når mer enn 40 tall får plass på en akse.
const FORCE_TICKS_AUTO_DISABLE_LIMIT = 40;
let FORCE_TICKS_LOCKED_FALSE = false;
let START_SCREEN = null;
let LAST_COMPUTED_SCREEN = null;
let LAST_SCREEN_SOURCE = 'auto';
let SCREEN_INPUT_IS_EDITING = false;
let brd = null;
let axX = null;
let axY = null;
let xName = null;
let yName = null;
let axisArrowX = null;
let axisArrowY = null;
let customTicksX = null;
let customTicksY = null;
let gridV = [];
let gridH = [];
let graphs = [];
let A = null;
let B = null;
let moving = [];

/* =============== uttrykk → funksjon ================= */
function parseFunctionSpec(spec) {
  let rhs = (spec || '').toString().trim();
  const m = rhs.match(/^([a-zA-Z]\w*)\s*\(\s*x\s*\)\s*=\s*(.+)$/);
  if (m) {
    rhs = m[2];
  }
  rhs = rhs
    .replace(/(^|[=+\-*/])\s*([+-])\s*([a-zA-Z0-9._()]+)\s*\^/g, (m, p, s, b) => p + '0' + s + '(' + b + ')^')
    .replace(/\^/g, '**')
    .replace(/(\d)([a-zA-Z(])/g, '$1*$2')
    .replace(/([x\)])\(/g, '$1*(')
    .replace(/x(\d)/g, 'x*$1')
    .replace(/\bln\(/gi, 'log(')
    .replace(/\blg\(/gi, 'log10(')
    .replace(/\bpi\b/gi, 'PI')
    .replace(/\be\b/gi, 'E')
    .replace(/\btau\b/gi, '(2*PI)')
    .replace(/(\bPI|\bE|[\d.)x])\s+(?=[a-zA-Z(0-9)])/g, '$1*');
  let fn;
  try {
    // eslint-disable-next-line no-new-func
    fn = new Function('x', 'with(Math){return ' + rhs + ';}');
  } catch (_) {
    fn = x => NaN;
  }
  return fn;
}

/* ============ Hjelpere for brøk/format & snap (linje-modus) ======== */
function stepX() {
  return (ADV.points.snap.stepX != null ? ADV.points.snap.stepX : +ADV.axis.grid.majorX) || 1;
}
function stepY() {
  return (ADV.points.snap.stepY != null ? ADV.points.snap.stepY : +ADV.axis.grid.majorY) || 1;
}
function nearestMultiple(val, step) {
  return Math.round(val / step) * step;
}
function isNearMultiple(val, step) {
  const eps = Math.max(1e-9, Math.abs(step) * 1e-6);
  return Math.abs(val - nearestMultiple(val, step)) <= eps;
}
function decimalsForStep(step) {
  if (!Number.isFinite(step) || step <= 0) return 0;
  if (Math.abs(step - Math.round(step)) < 1e-12) return 0;
  const s = step.toString();
  if (s.includes('e')) {
    const m = Math.abs(Math.log10(step));
    return Math.min(6, Math.ceil(m));
  }
  return Math.min(6, (s.split('.')[1] || '').length);
}
function toFixedTrim(n, d) {
  return (+n).toFixed(d).replace(/(\.\d*?)0+$/, '$1').replace(/\.$/, '');
}
function fmtSmartVal(val, step) {
  if (!ADV.points.snap.enabled) {
    return toFixedTrim(val, ADV.points.decimals);
  }
  const m = nearestMultiple(val, step);
  if (isNearMultiple(val, step)) {
    const digs = decimalsForStep(step);
    return toFixedTrim(m, digs);
  } else {
    return toFixedTrim(val, ADV.points.decimals);
  }
}
function fmtCoordsStatic(P) {
  return `(${fmtSmartVal(P.X(), stepX())}, ${fmtSmartVal(P.Y(), stepY())})`;
}
function fmtCoordsDrag(P) {
  const d = ADV.points.decimals;
  return `(${toFixedTrim(P.X(), d)}, ${toFixedTrim(P.Y(), d)})`;
}

function formatScreenNumber(val) {
  if (!Number.isFinite(val)) return '';
  const abs = Math.abs(val);
  let decimals = 4;
  if (abs >= 1000) {
    decimals = 2;
  } else if (abs >= 100) {
    decimals = 3;
  }
  return toFixedTrim(val, decimals);
}

function formatScreenForInput(screen) {
  if (!Array.isArray(screen) || screen.length !== 4) return '';
  return screen.map(formatScreenNumber).join(', ');
}

function syncScreenInputFromState() {
  if (typeof document === 'undefined') return;
  const input = document.getElementById('cfgScreen');
  if (!input) return;
  if (SCREEN_INPUT_IS_EDITING && typeof document !== 'undefined' && document.activeElement === input) {
    return;
  }
  if (Array.isArray(LAST_COMPUTED_SCREEN) && LAST_COMPUTED_SCREEN.length === 4) {
    const formatted = formatScreenForInput(LAST_COMPUTED_SCREEN);
    input.value = formatted;
    if (LAST_SCREEN_SOURCE === 'auto') {
      if (input.dataset) input.dataset.autoscreen = '1';
      input.classList.add('is-auto');
    } else {
      if (input.dataset) delete input.dataset.autoscreen;
      input.classList.remove('is-auto');
    }
  } else {
    input.value = '';
    if (input.dataset) delete input.dataset.autoscreen;
    input.classList.remove('is-auto');
  }
}

function rememberScreenState(screen, source) {
  LAST_COMPUTED_SCREEN = Array.isArray(screen) ? screen.slice(0, 4) : null;
  LAST_SCREEN_SOURCE = source === 'manual' ? 'manual' : 'auto';
  syncScreenInputFromState();
}

/* ======= brøk for m & b (melding ved snap / “Riktig:”) ======= */
function rationalApprox(x, maxDen = 64) {
  let a0 = Math.floor(x),
    p0 = 1,
    q0 = 0,
    p1 = a0,
    q1 = 1,
    frac = x - a0;
  while (Math.abs(p1 / q1 - x) > 1e-12 && q1 <= maxDen && frac) {
    const a = Math.floor(1 / frac);
    const p2 = a * p1 + p0,
      q2 = a * q1 + q0;
    p0 = p1;
    q0 = q1;
    p1 = p2;
    q1 = q2;
    frac = 1 / frac - a;
  }
  return [p1, q1];
}
function fracStr(x) {
  const [n, d] = rationalApprox(x, 64);
  return d === 1 ? `${n}` : `${n}/${d}`;
}

function fracPlain(x) {
  if (!Number.isFinite(x)) return '';
  const sign = x < 0 ? '-' : '';
  const [n, d] = rationalApprox(Math.abs(x), 64);
  if (d === 1) {
    return `${sign}${n}`;
  }
  return `${sign}${n}/${d}`;
}

function fracLatex(x) {
  if (!Number.isFinite(x)) return '';
  const sign = x < 0 ? '-' : '';
  const [n, d] = rationalApprox(Math.abs(x), 64);
  if (d === 1) {
    return `${sign}${n}`;
  }
  return `${sign}\\frac{${n}}{${d}}`;
}

const LINEAR_EPSILON = 1e-9;

function isNearly(value, target) {
  return Math.abs(value - target) < LINEAR_EPSILON;
}

function isNearlyZero(value) {
  return Math.abs(value) < LINEAR_EPSILON;
}

function formatLineEquation(lhs, slope, intercept, formatter, variable = 'x') {
  const safeLhs = typeof lhs === 'string' ? lhs.trim() : '';
  const varSymbol = typeof variable === 'string' && variable ? variable : 'x';
  let rhs = '';
  if (!isNearlyZero(slope)) {
    if (isNearly(slope, 1)) {
      rhs = varSymbol;
    } else if (isNearly(slope, -1)) {
      rhs = `-${varSymbol}`;
    } else {
      const slopePart = formatter(slope);
      if (!slopePart) return '';
      rhs = `${slopePart}${varSymbol}`;
    }
  }
  if (!isNearlyZero(intercept)) {
    const interceptPart = formatter(Math.abs(intercept));
    if (!interceptPart) return '';
    if (rhs) {
      rhs += ` ${intercept >= 0 ? '+' : '-'} ${interceptPart}`;
    } else {
      rhs = intercept >= 0 ? interceptPart : `-${interceptPart}`;
    }
  }
  if (!rhs) {
    rhs = '0';
  }
  return safeLhs ? `${safeLhs} = ${rhs}` : rhs;
}
function linearStr(m, b) {
  if (ADV.points.snap.enabled) {
    if (m === 0) return `y = ${fracStr(b)}`;
    const mS = m === 1 ? 'x' : m === -1 ? '-x' : `${fracStr(m)}x`;
    const bS = b === 0 ? '' : ` ${b >= 0 ? '+' : '-'} ${fracStr(Math.abs(b))}`;
    return `y = ${mS}${bS}`;
  } else {
    const f = v => toFixedTrim(v, 3);
    if (m === 0) return `y = ${f(b)}`;
    const mS = m === 1 ? 'x' : m === -1 ? '-x' : `${f(m)}x`;
    const bS = b === 0 ? '' : ` ${b >= 0 ? '+' : '-'} ${f(Math.abs(b))}`;
    return `y = ${mS}${bS}`;
  }
}

/* ===================== Asymptoter ===================== */
function detectVerticalAsymptotes(fn, A, B, N = 1000, huge = ADV.asymptote.hugeY) {
  const xs = [],
    ys = [];
  for (let i = 0; i <= N; i++) {
    const x = A + i * (B - A) / N;
    let y;
    try {
      y = fn(x);
    } catch (_) {
      y = NaN;
    }
    xs.push(x);
    ys.push(y);
  }
  const midBlow = (xL, xR) => {
    const m = 0.5 * (xL + xR);
    let y;
    try {
      y = fn(m);
    } catch (_) {
      y = NaN;
    }
    return !Number.isFinite(y) || Math.abs(y) > huge * 2;
  };
  const cand = [];
  for (let i = 1; i < ys.length; i++) {
    const xL = xs[i - 1],
      xR = xs[i],
      y0 = ys[i - 1],
      y1 = ys[i];
    const b0 = !Number.isFinite(y0) || Math.abs(y0) > huge;
    const b1 = !Number.isFinite(y1) || Math.abs(y1) > huge;
    const opp = Number.isFinite(y0) && Number.isFinite(y1) ? Math.sign(y0) !== Math.sign(y1) : false;
    const midBad = midBlow(xL, xR);
    if (b0 && b1 && (opp || midBad) || (b0 ^ b1) && midBad) cand.push(0.5 * (xL + xR));
  }
  const merged = [],
    tol = (B - A) / N * 4;
  cand.sort((a, b) => a - b).forEach(x => {
    if (merged.length === 0 || Math.abs(x - merged[merged.length - 1]) > tol) merged.push(x);
  });
  return merged;
}
function detectHorizontalAsymptoteInRange(fn, a, b, winFrac = 0.12, N = 600) {
  var _ADV$asymptote$trimY;
  if (!(b > a)) return null;
  const TRIM = (_ADV$asymptote$trimY = ADV.asymptote.trimY) !== null && _ADV$asymptote$trimY !== void 0 ? _ADV$asymptote$trimY : 8;
  const win = Math.max((b - a) * winFrac, (b - a) / N * 10);
  const mean = (L, R, steps = 120) => {
    let s = 0,
      c = 0;
    for (let i = 0; i <= steps; i++) {
      const x = L + i * (R - L) / steps;
      let y;
      try {
        y = fn(x);
      } catch (_) {
        y = NaN;
      }
      if (Number.isFinite(y)) {
        y = Math.max(-TRIM, Math.min(TRIM, y));
        s += y;
        c++;
      }
    }
    return c ? s / c : NaN;
  };
  const yL = mean(a, Math.min(a + win, b));
  const yR = mean(Math.max(b - win, a), b);
  if (!Number.isFinite(yL) || !Number.isFinite(yR)) return null;
  const y = 0.5 * (yL + yR);
  const tol = 0.05 * Math.max(1, Math.abs(y));
  return Math.abs(yL - y) <= tol && Math.abs(yR - y) <= tol ? y : null;
}

/* ===================== Sample features ===================== */
function sampleFeatures(fn, a, b, opts = {}) {
  var _ADV$asymptote$trimY2, _ADV$asymptote;
  const {
    includeEndVals = false,
    includeLeftEnd = includeEndVals,
    includeRightEnd = includeEndVals,
    detectAsymptotes = true,
    N = 1000
  } = opts;
  const TRIM = (_ADV$asymptote$trimY2 = (_ADV$asymptote = ADV.asymptote) === null || _ADV$asymptote === void 0 ? void 0 : _ADV$asymptote.trimY) !== null && _ADV$asymptote$trimY2 !== void 0 ? _ADV$asymptote$trimY2 : 8;
  const xs = [],
    ysRaw = [],
    ysTrim = [];
  for (let i = 0; i <= N; i++) {
    const x = a + i * (b - a) / N;
    let y;
    try {
      y = fn(x);
    } catch (_) {
      y = NaN;
    }
    xs.push(x);
    ysRaw.push(Number.isFinite(y) ? y : NaN);
    if (Number.isFinite(y)) ysTrim.push(Math.max(-TRIM, Math.min(TRIM, y)));else ysTrim.push(NaN);
  }

  // røtter
  const roots = [];
  for (let i = 1; i < ysTrim.length; i++) {
    const y0 = ysTrim[i - 1],
      y1 = ysTrim[i];
    if (!Number.isFinite(y0) || !Number.isFinite(y1)) continue;
    if (y0 === 0) roots.push(xs[i - 1]);
    if (y0 * y1 < 0) {
      const t = y0 / (y0 - y1);
      roots.push(xs[i - 1] + t * (xs[i] - xs[i - 1]));
    }
  }

  // y-skjæring
  let yIntercept = null;
  if (0 >= a && 0 <= b) {
    try {
      const y0 = fn(0);
      if (Number.isFinite(y0)) yIntercept = y0;
    } catch (_) {}
  }

  // ekstremal
  const extrema = [];
  for (let i = 1; i < ysRaw.length - 1; i++) {
    const y0 = ysRaw[i - 1],
      y1 = ysRaw[i],
      y2 = ysRaw[i + 1];
    if (!Number.isFinite(y0) || !Number.isFinite(y1) || !Number.isFinite(y2)) continue;
    const d1 = y1 - y0,
      d2 = y2 - y1;
    if (d1 * d2 <= 0) {
      const x0 = xs[i - 1],
        x1 = xs[i];
      const denom = y0 - 2 * y1 + y2;
      let xv;
      if (Math.abs(denom) < 1e-12) xv = x1;else {
        const h = x1 - x0;
        xv = x1 - h * (y2 - y0) / (2 * denom);
      }
      let yv;
      try {
        yv = fn(xv);
      } catch (_) {
        yv = NaN;
      }
      if (Number.isFinite(yv)) extrema.push({
        x: xv,
        y: yv
      });
    }
  }

  // endepunkter
  let endVals = [];
  if (includeLeftEnd) {
    try {
      const ya = fn(a);
      if (Number.isFinite(ya)) endVals.push({
        x: a,
        y: ya
      });
    } catch (_) {}
  }
  if (includeRightEnd) {
    try {
      const yb = fn(b);
      if (Number.isFinite(yb)) endVals.push({
        x: b,
        y: yb
      });
    } catch (_) {}
  }

  // robuste y-grenser via kvantiler
  let yVals = ysTrim.filter(Number.isFinite);
  let ymin = -5,
    ymax = 5;
  if (yVals.length) {
    yVals.sort((u, v) => u - v);
    const lo = yVals[Math.floor(0.02 * (yVals.length - 1))];
    const hi = yVals[Math.floor(0.98 * (yVals.length - 1))];
    ymin = lo;
    ymax = hi;
  }

  // asymptoter
  const vas = detectAsymptotes && ADV.asymptote.detect && ADV.asymptote.showVertical ? detectVerticalAsymptotes(fn, a, b, 1000, ADV.asymptote.hugeY) : [];
  const haGuess = detectHorizontalAsymptoteInRange(fn, a, b);
  return {
    roots,
    extrema,
    yIntercept,
    endVals,
    ymin,
    ymax,
    vas,
    ha: haGuess
  };
}

/* ===================== Autozoom ===================== */
function computeAutoScreenFunctions() {
  const allUnbounded = SIMPLE_PARSED.funcs.every(f => !f.domain);

  // samle features
  const feats = [];
  let domMin = Infinity,
    domMax = -Infinity,
    anyDom = false;
  for (const f of SIMPLE_PARSED.funcs) {
    const fn = parseFunctionSpec(`${f.name}(x)=${f.rhs}`);
    if (f.domain) {
      anyDom = true;
      const [sampleMin, sampleMax] = resolveDomainSamplingBounds(f.domain);
      const rangeMin = Number.isFinite(f.domain.min) ? f.domain.min : sampleMin;
      const rangeMax = Number.isFinite(f.domain.max) ? f.domain.max : sampleMax;
      domMin = Math.min(domMin, rangeMin);
      domMax = Math.max(domMax, rangeMax);
      feats.push({
        hasDom: true,
        fn,
        a: sampleMin,
        b: sampleMax,
        ...sampleFeatures(fn, sampleMin, sampleMax, {
          includeLeftEnd: Number.isFinite(f.domain.min) && !!f.domain.leftClosed,
          includeRightEnd: Number.isFinite(f.domain.max) && !!f.domain.rightClosed
        })
      });
    } else {
      feats.push({
        hasDom: false,
        fn,
        a: -5,
        b: 5,
        ...sampleFeatures(fn, -5, 5, {
          includeEndVals: false
        })
      });
    }
  }
  let xmin, xmax, ymin, ymax;
  if (allUnbounded) {
    // behold [-5,5] så lenge sentrale punkter ikke faller utenfor
    xmin = -5;
    xmax = 5;
    ymin = -5;
    ymax = 5;
    for (const F of feats) {
      if (Number.isFinite(F.yIntercept)) {
        ymin = Math.min(ymin, F.yIntercept);
        ymax = Math.max(ymax, F.yIntercept);
      }
      F.extrema.forEach(e => {
        ymin = Math.min(ymin, e.y);
        ymax = Math.max(ymax, e.y);
      });
      if (Number.isFinite(F.ha)) {
        ymin = Math.min(ymin, F.ha);
        ymax = Math.max(ymax, F.ha);
      }
    }
  } else {
    // minst én avgrenset → vis hele domenet + sentrale punkter
    xmin = domMin;
    xmax = domMax;
    let ylo = [],
      yhi = [];
    feats.forEach(F => {
      ylo.push(F.ymin);
      yhi.push(F.ymax);
    });
    ymin = Math.min(...ylo, -5);
    ymax = Math.max(...yhi, 5);
    for (const F of feats) {
      F.roots.forEach(r => {
        xmin = Math.min(xmin, r);
        xmax = Math.max(xmax, r);
      });
      if (Number.isFinite(F.yIntercept)) {
        ymin = Math.min(ymin, F.yIntercept);
        ymax = Math.max(ymax, F.yIntercept);
      }
      F.extrema.forEach(e => {
        xmin = Math.min(xmin, e.x);
        xmax = Math.max(xmax, e.x);
        ymin = Math.min(ymin, e.y);
        ymax = Math.max(ymax, e.y);
      });
      (F.endVals || []).forEach(ev => {
        xmin = Math.min(xmin, ev.x);
        xmax = Math.max(xmax, ev.x);
        ymin = Math.min(ymin, ev.y);
        ymax = Math.max(ymax, ev.y);
      });
      if (F.vas && F.vas.length) {
        for (const a of F.vas) {
          xmin = Math.min(xmin, a);
          xmax = Math.max(xmax, a);
        }
      }
      if (Number.isFinite(F.ha)) {
        ymin = Math.min(ymin, F.ha);
        ymax = Math.max(ymax, F.ha);
      }
    }
  }

  // Aksene alltid med
  xmin = Math.min(xmin, 0);
  xmax = Math.max(xmax, 0);
  ymin = Math.min(ymin, 0);
  ymax = Math.max(ymax, 0);

  // padding (og ev. kvadrat)
  const padX = 0.08 * (xmax - xmin || 10);
  const padY = 0.08 * (ymax - ymin || 10);
  xmin -= padX;
  xmax += padX;
  ymin -= padY;
  ymax += padY;
  if (shouldLockAspect()) {
    const cx = (xmin + xmax) / 2,
      cy = (ymin + ymax) / 2;
    const span = Math.max(xmax - xmin, ymax - ymin);
    const half = span / 2;
    return [cx - half, cx + half, cy - half, cy + half];
  }
  return [xmin, xmax, ymin, ymax];
}
function computeAutoScreenPoints() {
  const pts = ADV.points.start.slice(0, 2);
  const xs = pts.map(p => p[0]),
    ys = pts.map(p => p[1]);
  let xmin = Math.min(-5, ...xs),
    xmax = Math.max(5, ...xs);
  let ymin = Math.min(-5, ...ys),
    ymax = Math.max(5, ...ys);
  xmin = Math.min(xmin, 0);
  xmax = Math.max(xmax, 0);
  ymin = Math.min(ymin, 0);
  ymax = Math.max(ymax, 0);
  const cx = (xmin + xmax) / 2,
    cy = (ymin + ymax) / 2;
  let halfX = Math.max(xmax - xmin, 10) / 2 * 1.1;
  let halfY = Math.max(ymax - ymin, 10) / 2 * 1.1;
  if (shouldLockAspect()) {
    const half = Math.max(halfX, halfY);
    halfX = halfY = half;
  }
  return [cx - halfX, cx + halfX, cy - halfY, cy + halfY];
}
const toBB = scr => [scr[0], scr[3], scr[1], scr[2]];
function fromBoundingBox(bb) {
  if (!Array.isArray(bb) || bb.length !== 4) return null;
  const [xmin, ymax, xmax, ymin] = bb;
  if (![xmin, xmax, ymin, ymax].every(Number.isFinite)) {
    return null;
  }
  return [xmin, xmax, ymin, ymax];
}
function screenSupportsLockAspect(screen) {
  if (!Array.isArray(screen) || screen.length !== 4) return false;
  const [xmin, xmax, ymin, ymax] = screen;
  if (![xmin, xmax, ymin, ymax].every(Number.isFinite)) return false;
  const width = xmax - xmin;
  const height = ymax - ymin;
  if (!(width > 0 && height > 0)) return false;
  const diff = Math.abs(width - height);
  const scale = Math.max(Math.abs(width), Math.abs(height), 1);
  return diff <= 1e-6 * scale;
}
function screenSupportsFirstQuadrant(screen) {
  if (!Array.isArray(screen) || screen.length !== 4) return false;
  const xmin = screen[0];
  const ymin = screen[2];
  if (!(Number.isFinite(xmin) && Number.isFinite(ymin))) return false;
  const EPS = 1e-9;
  return xmin >= -EPS && ymin >= -EPS;
}

/* ===================== Init JSXGraph ===================== */
function initialScreen() {
  var _ADV$screen;
  const hasManualScreen = Array.isArray(ADV.screen) && ADV.screen.length === 4;
  let scr = (_ADV$screen = ADV.screen) !== null && _ADV$screen !== void 0 ? _ADV$screen : MODE === 'functions' ? computeAutoScreenFunctions() : computeAutoScreenPoints();
  if (ADV.firstQuadrant) {
    if (scr[0] < 0) scr[0] = 0;
    if (scr[2] < 0) scr[2] = 0;
  }
  rememberScreenState(scr, hasManualScreen ? 'manual' : 'auto');
  return scr;
}
function syncSimpleFromWindow() {
  if (typeof window !== 'undefined' && typeof window.SIMPLE !== 'undefined') {
    SIMPLE = window.SIMPLE;
  } else if (typeof window !== 'undefined') {
    window.SIMPLE = SIMPLE;
  }
}
function destroyBoard() {
  if (brd) {
    try {
      var _brd$off, _brd;
      (_brd$off = (_brd = brd).off) === null || _brd$off === void 0 || _brd$off.call(_brd, 'boundingbox', updateAfterViewChange);
    } catch (_) {}
    try {
      if (customTicksX) {
        brd.removeObject(customTicksX);
      }
      if (customTicksY) {
        brd.removeObject(customTicksY);
      }
    } catch (_) {}
    try {
      const jxg = getJXG();
      if (jxg && jxg.JSXGraph && typeof jxg.JSXGraph.freeBoard === 'function') {
        jxg.JSXGraph.freeBoard(brd);
      }
    } catch (_) {}
  }
  brd = null;
  axX = null;
  axY = null;
  xName = null;
  yName = null;
  axisArrowX = null;
  axisArrowY = null;
  customTicksX = null;
  customTicksY = null;
  gridV = [];
  gridH = [];
  graphs = [];
  A = null;
  B = null;
  moving = [];
  START_SCREEN = null;
}
function applyAxisStyles() {
  if (!brd) return;
  const stroke = resolveAxisStrokeColor();
  if (stroke) {
    ADV.axis.style.stroke = stroke;
  }
  ['x', 'y'].forEach(ax => {
    brd.defaultAxes[ax].setAttribute({
      withLabel: false,
      strokeColor: ADV.axis.style.stroke,
      strokeWidth: ADV.axis.style.width,
      highlight: false,
      highlightStrokeColor: ADV.axis.style.stroke,
      highlightStrokeWidth: ADV.axis.style.width,
      firstArrow: false,
      lastArrow: false
    });
    if (typeof brd.defaultAxes[ax].setHighlight === 'function') {
      brd.defaultAxes[ax].setHighlight(false);
    }
  });
  updateAxisArrows();
}

function updateAxisThemeStyling() {
  const stroke = resolveAxisStrokeColor();
  if (stroke) {
    ADV.axis.style.stroke = stroke;
  }
  applyAxisStyles();
  placeAxisNames();
  if (brd && typeof brd.update === 'function') {
    brd.update();
  }
}
function applyTickSettings() {
  if (!axX || !axY) return;
  const showNumbers = !!(ADV.axis && ADV.axis.ticks && ADV.axis.ticks.showNumbers);
  const showGrid = !!(ADV.axis && ADV.axis.grid && ADV.axis.grid.show);
  const showTicks = showNumbers || showGrid;
  if (!ADV.axis.forceIntegers) {
    if (customTicksX) {
      try {
        brd.removeObject(customTicksX);
      } catch (_) {}
      customTicksX = null;
    }
    if (customTicksY) {
      try {
        brd.removeObject(customTicksY);
      } catch (_) {}
      customTicksY = null;
    }
    axX.defaultTicks.setAttribute({
      visible: showTicks,
      drawLabels: showNumbers
    });
    axY.defaultTicks.setAttribute({
      visible: showTicks,
      drawLabels: showNumbers
    });
    return;
  }
  const tickBase = {
    drawLabels: showNumbers,
    precision: ADV.axis.grid.labelPrecision,
    visible: showTicks
  };
  const labelBase = {
    fontSize: ADV.axis.grid.fontSize,
    visible: showNumbers
  };
  const xOpts = {
    ...tickBase,
    ticksDistance: +ADV.axis.grid.majorX || 1,
    minorTicks: 0,
    strokeColor: '#666666',
    strokeOpacity: 0.25,
    label: {
      ...labelBase,
      display: 'internal',
      anchorX: 'middle',
      anchorY: 'top',
      offset: [0, -8]
    }
  };
  const yOpts = {
    ...tickBase,
    ticksDistance: +ADV.axis.grid.majorY || 1,
    minorTicks: 0,
    strokeColor: '#666666',
    strokeOpacity: 0.25,
    label: {
      ...labelBase,
      display: 'internal',
      anchorX: 'right',
      anchorY: 'middle',
      offset: [-8, 0]
    }
  };
  axX.defaultTicks.setAttribute({
    ...tickBase,
    visible: false
  });
  axY.defaultTicks.setAttribute({
    ...tickBase,
    visible: false
  });
  if (!customTicksX || customTicksX.board !== brd) {
    customTicksX = brd.create('ticks', [axX, xOpts.ticksDistance], xOpts);
  } else {
    customTicksX.setAttribute(xOpts);
  }
  if (!customTicksY || customTicksY.board !== brd) {
    customTicksY = brd.create('ticks', [axY, yOpts.ticksDistance], yOpts);
  } else {
    customTicksY.setAttribute(yOpts);
  }
  updateCustomTickSpacing();
}

const MAX_TICKS_PER_AXIS = 40;
function niceTickStep(span, maxTicks) {
  if (!Number.isFinite(span) || span <= 0) return 1;
  const raw = span / Math.max(1, maxTicks);
  if (!Number.isFinite(raw) || raw <= 0) return 1;
  const exponent = Math.floor(Math.log10(raw));
  const pow10 = Math.pow(10, exponent);
  const fraction = raw / pow10;
  let niceFraction;
  if (fraction <= 1) {
    niceFraction = 1;
  } else if (fraction <= 2) {
    niceFraction = 2;
  } else if (fraction <= 5) {
    niceFraction = 5;
  } else {
    niceFraction = 10;
  }
  return niceFraction * pow10;
}
function computeTickSpacing(base, span) {
  const safeBase = Number.isFinite(base) && base > 1e-9 ? base : 1;
  if (!Number.isFinite(span) || span <= 0) return safeBase;
  const nice = niceTickStep(span, MAX_TICKS_PER_AXIS);
  return Math.max(safeBase, nice);
}
function shouldLockForceTicks(screen) {
  if (!Array.isArray(screen) || screen.length !== 4) return false;
  const spanX = Math.abs(screen[1] - screen[0]);
  const spanY = Math.abs(screen[3] - screen[2]);
  const stepX = Math.abs(+ADV.axis.grid.majorX) > 1e-9 ? Math.abs(+ADV.axis.grid.majorX) : 1;
  const stepY = Math.abs(+ADV.axis.grid.majorY) > 1e-9 ? Math.abs(+ADV.axis.grid.majorY) : 1;
  const ticksX = Number.isFinite(spanX) ? spanX / stepX : Infinity;
  const ticksY = Number.isFinite(spanY) ? spanY / stepY : Infinity;
  return ticksX > FORCE_TICKS_AUTO_DISABLE_LIMIT || ticksY > FORCE_TICKS_AUTO_DISABLE_LIMIT;
}
function updateCustomTickSpacing() {
  if (!brd) return;
  const bb = brd.getBoundingBox();
  if (!Array.isArray(bb) || bb.length !== 4) return;
  const [xmin, ymax, xmax, ymin] = bb;
  if (customTicksX) {
    const spanX = Math.abs(xmax - xmin);
    const spacingX = computeTickSpacing(+ADV.axis.grid.majorX, spanX);
    customTicksX.setAttribute({
      ticksDistance: spacingX
    });
    if (typeof customTicksX.fullUpdate === 'function') {
      customTicksX.fullUpdate();
    }
  }
  if (customTicksY) {
    const spanY = Math.abs(ymax - ymin);
    const spacingY = computeTickSpacing(+ADV.axis.grid.majorY, spanY);
    customTicksY.setAttribute({
      ticksDistance: spacingY
    });
    if (typeof customTicksY.fullUpdate === 'function') {
      customTicksY.fullUpdate();
    }
  }
}
function initBoard() {
  if (!START_SCREEN) {
    START_SCREEN = initialScreen();
  }
  const jxg = getJXG();
  if (!jxg || !jxg.JSXGraph || typeof jxg.JSXGraph.initBoard !== 'function') {
    brd = null;
    return;
  }
  brd = jxg.JSXGraph.initBoard('board', {
    boundingbox: toBB(START_SCREEN),
    axis: true,
    grid: ADV.axis.grid.show && !ADV.axis.forceIntegers,
    showNavigation: false,
    showCopyright: false,
    pan: {
      enabled: ADV.interactions.pan.enabled,
      needShift: false
    },
    zoom: {
      enabled: ADV.interactions.zoom.enabled,
      wheel: true,
      needShift: false,
      factorX: ADV.interactions.zoom.factorX,
      factorY: ADV.interactions.zoom.factorY
    }
  });
  axX = brd.defaultAxes.x;
  axY = brd.defaultAxes.y;
  applyAxisStyles();
  applyTickSettings();
  xName = null;
  yName = null;
  placeAxisNames();
  gridV = [];
  gridH = [];
}

/* ---------- akser og navn ---------- */
function axisArrowLengthX() {
  if (!brd) return 0;
  const [xmin, , xmax] = brd.getBoundingBox();
  const span = xmax - xmin;
  if (!Number.isFinite(span) || span === 0) return 0;
  const px = Math.max(1, brd.canvasWidth || 1);
  const pixelLength = AXIS_ARROW_PIXEL_THICKNESS * AXIS_ARROW_ASPECT_RATIO;
  const len = (span / px) * pixelLength;
  return Math.max(len, span * 0.01);
}

function axisArrowHalfHeight() {
  if (!brd) return 0;
  const [, ymax, , ymin] = brd.getBoundingBox();
  const span = ymax - ymin;
  if (!Number.isFinite(span) || span === 0) return 0;
  const px = Math.max(1, brd.canvasHeight || 1);
  const half = (span / px) * (AXIS_ARROW_PIXEL_THICKNESS / 2);
  return Math.max(half, span * 0.01);
}

function axisArrowLengthY() {
  if (!brd) return 0;
  const [, ymax, , ymin] = brd.getBoundingBox();
  const span = ymax - ymin;
  if (!Number.isFinite(span) || span === 0) return 0;
  const px = Math.max(1, brd.canvasHeight || 1);
  const pixelLength = AXIS_ARROW_PIXEL_THICKNESS * AXIS_ARROW_ASPECT_RATIO;
  const len = (span / px) * pixelLength;
  return Math.max(len, span * 0.01);
}

function axisArrowHalfWidth() {
  if (!brd) return 0;
  const [xmin, , xmax] = brd.getBoundingBox();
  const span = xmax - xmin;
  if (!Number.isFinite(span) || span === 0) return 0;
  const px = Math.max(1, brd.canvasWidth || 1);
  const half = (span / px) * (AXIS_ARROW_PIXEL_THICKNESS / 2);
  return Math.max(half, span * 0.01);
}

function ensureAxisArrowShapes() {
  if (!brd) return;
  const baseOptions = {
    fixed: true,
    highlight: false,
    layer: 41,
    cssStyle: 'pointer-events:none;'
  };
  const axisColor = ADV.axis.style.stroke;
  if (!axisArrowX) {
    axisArrowX = brd.create(
      'image',
      [
        axisArrowSvgData('x', axisColor),
        [
          () => (brd ? brd.getBoundingBox()[2] - axisArrowLengthX() : 0),
          () => -axisArrowHalfHeight()
        ],
        [
          () => axisArrowLengthX(),
          () => axisArrowHalfHeight() * 2
        ]
      ],
      baseOptions
    );
  }
  if (!axisArrowY) {
    axisArrowY = brd.create(
      'image',
      [
        axisArrowSvgData('y', axisColor),
        [
          () => -axisArrowHalfWidth(),
          () => (brd ? brd.getBoundingBox()[1] - axisArrowLengthY() : 0)
        ],
        [
          () => axisArrowHalfWidth() * 2,
          () => axisArrowLengthY()
        ]
      ],
      baseOptions
    );
  }
}

function updateAxisArrows() {
  if (!brd) return;
  ensureAxisArrowShapes();
  const axisColor = ADV.axis.style.stroke;
  if (axisArrowX) {
    axisArrowX.setAttribute({
      url: axisArrowSvgData('x', axisColor),
      size: [axisArrowLengthX(), axisArrowHalfHeight() * 2]
    });
    if (typeof axisArrowX.update === 'function') {
      axisArrowX.update();
    }
  }
  if (axisArrowY) {
    axisArrowY.setAttribute({
      url: axisArrowSvgData('y', axisColor),
      size: [axisArrowHalfWidth() * 2, axisArrowLengthY()]
    });
    if (typeof axisArrowY.update === 'function') {
      axisArrowY.update();
    }
  }
}

function axisLabelChip(axisKey) {
  const fallback = axisKey;
  const raw = axisKey === 'x' ? ADV.axis.labels.x : ADV.axis.labels.y;
  const text = raw && String(raw).trim() ? raw : fallback;
  const color = ADV.axis.style.stroke;
  const fontSizeRaw = Number.parseFloat(ADV.axis.labels.fontSize);
  const fontSize = Number.isFinite(fontSizeRaw) ? fontSizeRaw : 15;
  const styleTokens = [
    `--graf-axis-label-text:${color}`,
    `--graf-axis-label-font-size:${fontSize}px`
  ];
  return `<span class="graf-axis-label graf-axis-label--${axisKey}" style="${styleTokens.join(';')};">${escapeHtml(text)}</span>`;
}

function placeAxisNames() {
  if (!brd) return;
  const [xmin, ymax, xmax, ymin] = brd.getBoundingBox();
  const rx = xmax - xmin;
  const ry = ymax - ymin;
  const canvasWidth = Math.max(1, brd.canvasWidth || 1);
  const canvasHeight = Math.max(1, brd.canvasHeight || 1);
  const offsetX = Number.isFinite(rx) ? (rx / canvasWidth) * AXIS_LABEL_OFFSET_PX : 0;
  const offsetY = Number.isFinite(ry) ? (ry / canvasHeight) * AXIS_LABEL_OFFSET_PX : 0;
  const arrowHalfWidth = axisArrowHalfWidth();
  const arrowHalfHeight = axisArrowHalfHeight();
  const xLabelY = (Number.isFinite(arrowHalfHeight) ? arrowHalfHeight : 0) + offsetY;
  const yLabelX = (Number.isFinite(arrowHalfWidth) ? arrowHalfWidth : 0) + offsetX;
  const xLabelPos = [Number.isFinite(xmax) ? xmax : 0, Number.isFinite(xLabelY) ? xLabelY : 0];
  const yLabelPos = [Number.isFinite(yLabelX) ? yLabelX : 0, Number.isFinite(ymax) ? ymax : 0];
  const axisLabelCss = 'pointer-events:none;user-select:none;';
  if (!xName) {
    xName = brd.create('text', [...xLabelPos, () => axisLabelChip('x')], {
      display: 'html',
      anchorX: 'right',
      anchorY: 'bottom',
      fixed: true,
      layer: 40,
      highlight: false,
      cssStyle: axisLabelCss
    });
  } else {
    xName.setAttribute({
      cssStyle: axisLabelCss,
      highlight: false,
      anchorX: 'right'
    });
  }
  if (!yName) {
    yName = brd.create('text', [...yLabelPos, () => axisLabelChip('y')], {
      display: 'html',
      anchorX: 'left',
      anchorY: 'top',
      fixed: true,
      layer: 40,
      highlight: false,
      cssStyle: axisLabelCss
    });
  } else {
    yName.setAttribute({
      cssStyle: axisLabelCss,
      highlight: false
    });
  }
  if (xName) {
    xName.setText(() => axisLabelChip('x'));
  }
  if (yName) {
    yName.setText(() => axisLabelChip('y'));
  }
  xName.moveTo(xLabelPos);
  yName.moveTo(yLabelPos);
}

/* ====== Lås 1:1 når lockAspect===true,
   eller når lockAspect er null og majorX===majorY ====== */
function shouldLockAspect() {
  if (ADV.lockAspect === true) return true;
  if (ADV.lockAspect === false) return false;
  const sx = +ADV.axis.grid.majorX || 1;
  const sy = +ADV.axis.grid.majorY || 1;
  return Math.abs(sx - sy) < 1e-12;
}
let enforcing = false;
function enforceAspectStrict() {
  if (!brd || !shouldLockAspect() || enforcing) return;
  enforcing = true;
  try {
    const [xmin, ymax, xmax, ymin] = brd.getBoundingBox();
    const W = xmax - xmin,
      H = ymax - ymin;
    const pixAR = brd.canvasWidth / brd.canvasHeight;
    const worldAR = W / H;
    if (Math.abs(worldAR - pixAR) < 1e-9) return;
    let newW = W,
      newH = H;
    if (worldAR > pixAR) {
      newH = W / pixAR;
    } else {
      newW = H * pixAR;
    }
    const cx = (xmax + xmin) / 2,
      cy = (ymax + ymin) / 2;
    brd.setBoundingBox([cx - newW / 2, cy + newH / 2, cx + newW / 2, cy - newH / 2], false);
  } finally {
    enforcing = false;
  }
}

/* ---------- GRID (statisk) ---------- */
function rebuildGrid() {
  if (!brd) return;
  for (const L of gridV) {
    try {
      brd.removeObject(L);
    } catch (_) {}
  }
  for (const L of gridH) {
    try {
      brd.removeObject(L);
    } catch (_) {}
  }
  gridV = [];
  gridH = [];
  if (!ADV.axis.forceIntegers || !ADV.axis.grid.show) {
    return;
  }
  enforceAspectStrict();
  const [xmin, ymax, xmax, ymin] = brd.getBoundingBox();
  const sx = +ADV.axis.grid.majorX > 1e-9 ? +ADV.axis.grid.majorX : 1;
  const sy = +ADV.axis.grid.majorY > 1e-9 ? +ADV.axis.grid.majorY : 1;
  const x0 = Math.ceil(xmin / sx) * sx,
    y0 = Math.ceil(ymin / sy) * sy;
  const attrs = {
    straightFirst: false,
    straightLast: false,
    strokeColor: '#e5e7eb',
    strokeWidth: 1,
    fixed: true,
    layer: 0,
    highlight: false,
    cssStyle: 'pointer-events:none;'
  };
  for (let x = x0; x <= xmax + 1e-9; x += sx) gridV.push(brd.create('line', [[x, ymin], [x, ymax]], attrs));
  for (let y = y0; y <= ymax + 1e-9; y += sy) gridH.push(brd.create('line', [[xmin, y], [xmax, y]], attrs));
}

/* =================== Grafnavn-bakplate =================== */
function measureTextPx(label) {
  const tryBBox = node => {
    if (!node) return null;
    try {
      if (typeof node.getBBox === 'function') {
        const bb = node.getBBox();
        if (bb && Number.isFinite(bb.width) && Number.isFinite(bb.height)) {
          return {
            w: bb.width,
            h: bb.height
          };
        }
      }
    } catch (_) {}
    return null;
  };
  const tryRect = node => {
    if (!node) return null;
    try {
      if (typeof node.getBoundingClientRect === 'function') {
        const rect = node.getBoundingClientRect();
        if (rect && Number.isFinite(rect.width) && Number.isFinite(rect.height)) {
          return {
            w: rect.width,
            h: rect.height
          };
        }
      }
    } catch (_) {}
    return null;
  };
  const nodes = [label && label.rendNode, label && label.rendNodeText && label.rendNodeText.parentNode, label && label.rendNodeText, label && label.rendNode && label.rendNode.firstChild];
  for (const node of nodes) {
    const res = tryBBox(node);
    if (res) return res;
  }
  for (const node of nodes) {
    const res = tryRect(node);
    if (res) return res;
  }
  let fallback = '';
  if (label) {
    const primary = typeof label.plaintext === 'string' ? label.plaintext : null;
    const secondary = typeof label._plainText === 'string' ? label._plainText : null;
    fallback = primary && primary.trim() ? primary.trim() : secondary && secondary.trim() ? secondary.trim() : '';
  }
  const text = fallback || 'f(x)';
  const f = label && label.visProp && label.visProp.fontsize || ADV.curveName.fontSize;
  return {
    w: text.length * f * 0.6,
    h: f * 1.1
  };
}
function ensurePlateFor(label) {
  if (label._plate) return;
  const mkPt = (x, y) => brd.create('point', [x, y], {
    visible: false,
    fixed: true,
    layer: ADV.curveName.layer - 1
  });
  const p1 = mkPt(0, 0),
    p2 = mkPt(0, 0),
    p3 = mkPt(0, 0),
    p4 = mkPt(0, 0);
  brd.create('polygon', [p1, p2, p3, p4], {
    fillColor: ADV.curveName.plate.fill,
    fillOpacity: ADV.curveName.plate.opacity,
    borders: {
      visible: false
    },
    fixed: true,
    highlight: false,
    layer: ADV.curveName.layer - 1,
    cssStyle: 'pointer-events:none;stroke-linejoin:round;'
  });
  label._plate = {
    p1,
    p2,
    p3,
    p4
  };
}
function ensureLabelFront(label) {
  const node = label && label.rendNode;
  if (node && node.parentNode) {
    node.parentNode.appendChild(node);
  }
}
function updatePlate(label) {
  if (!label._plate) return;
  const [xmin, ymax, xmax, ymin] = brd.getBoundingBox();
  const ux = (xmax - xmin) / brd.canvasWidth,
    uy = (ymax - ymin) / brd.canvasHeight;
  const {
      w,
      h
    } = measureTextPx(label),
    pad = ADV.curveName.plate.paddingPx;
  const tx = label.X(),
    ty = label.Y();
  const ax = label.visProp && label.visProp.anchorx || 'left';
  const ay = label.visProp && label.visProp.anchory || 'middle';
  let L, R, T, B;
  if (ax === 'left') {
    L = tx - pad * ux;
    R = tx + (w + pad) * ux;
  } else if (ax === 'right') {
    L = tx - (w + pad) * ux;
    R = tx + pad * ux;
  } else {
    L = tx - (w / 2 + pad) * ux;
    R = tx + (w / 2 + pad) * ux;
  }
  if (ay === 'top') {
    T = ty + pad * uy;
    B = ty - (h + pad) * uy;
  } else if (ay === 'bottom') {
    T = ty + (h + pad) * uy;
    B = ty - pad * uy;
  } else {
    T = ty + (h / 2 + pad) * uy;
    B = ty - (h / 2 + pad) * uy;
  }
  const P = label._plate;
  P.p1.moveTo([L, T]);
  P.p2.moveTo([R, T]);
  P.p3.moveTo([R, B]);
  P.p4.moveTo([L, B]);
}
function clampLabelToView(label) {
  if (!label) return;
  const bb = brd.getBoundingBox();
  const xmin = bb[0],
    xmax = bb[2],
    ymin = bb[3],
    ymax = bb[1];
  const marginX = (xmax - xmin) * (ADV.curveName.marginFracX || 0);
  const marginY = (ymax - ymin) * (ADV.curveName.marginFracY || 0);
  const x = label.X(),
    y = label.Y();
  const xClamped = Math.min(xmax - marginX, Math.max(xmin + marginX, x));
  const yClamped = Math.min(ymax - marginY, Math.max(ymin + marginY, y));
  if (Math.abs(xClamped - x) > 1e-12 || Math.abs(yClamped - y) > 1e-12) {
    label.moveTo([xClamped, yClamped]);
  }
}
function makeLabelDraggable(label, g, reposition) {
  if (!label) return;
  const setup = () => {
    const node = label.rendNode;
    if (!node) return false;
    if (node._dragSetup) return true;
    node._dragSetup = true;
    node.style.pointerEvents = 'auto';
    node.style.cursor = 'move';
    node.style.touchAction = 'none';
    let dragging = false;
    let offset = [0, 0];
    const toCoords = ev => {
      try {
        const c = brd.getUsrCoordsOfMouse(ev);
        if (Array.isArray(c) && c.length >= 2) {
          return [c[0], c[1]];
        }
      } catch (_) {}
      return null;
    };
    const start = ev => {
      if (ev.button != null && ev.button !== 0) return;
      const coords = toCoords(ev);
      if (!coords) return;
      ev.preventDefault();
      ev.stopPropagation();
      dragging = true;
      g._labelManual = true;
      ensureLabelFront(label);
      clampLabelToView(label);
      offset = [label.X() - coords[0], label.Y() - coords[1]];
      if (typeof node.setPointerCapture === 'function' && ev.pointerId != null) {
        try {
          node.setPointerCapture(ev.pointerId);
        } catch (_) {}
      }
    };
    const move = ev => {
      if (!dragging) return;
      const coords = toCoords(ev);
      if (!coords) return;
      ev.preventDefault();
      const nx = coords[0] + offset[0];
      const ny = coords[1] + offset[1];
      label.moveTo([nx, ny]);
      clampLabelToView(label);
      updatePlate(label);
    };
    const end = ev => {
      if (!dragging) return;
      dragging = false;
      ev.preventDefault();
      ev.stopPropagation();
      clampLabelToView(label);
      updatePlate(label);
      if (typeof node.releasePointerCapture === 'function' && ev.pointerId != null) {
        try {
          node.releasePointerCapture(ev.pointerId);
        } catch (_) {}
      }
    };
    node.addEventListener('pointerdown', start);
    node.addEventListener('pointermove', move);
    node.addEventListener('pointerup', end);
    node.addEventListener('pointercancel', end);
    node.addEventListener('dblclick', ev => {
      ev.preventDefault();
      ev.stopPropagation();
      g._labelManual = false;
      reposition(true);
    });
    return true;
  };
  if (setup()) return;
  let attempts = 0;
  const retry = () => {
    if (setup()) return;
    if (attempts++ < 5) {
      setTimeout(retry, 30);
    }
  };
  setTimeout(retry, 30);
}

/* =================== FARGEPALETT =================== */
function colorFor(i) {
  const palette = resolveCurvePalette();
  return palette[i % palette.length];
}
function updateCurveColorsFromTheme() {
  if (!Array.isArray(graphs) || graphs.length === 0) return;
  const palette = resolveCurvePalette(graphs.length);
  let updated = false;
  graphs.forEach((g, idx) => {
    if (!g) return;
    const nextColor = palette[idx % palette.length];
    const paletteColor = typeof nextColor === 'string' && nextColor ? nextColor : null;
    const manual = !!g.manualColor;
    if (!manual && paletteColor && g.color !== paletteColor) {
      g.color = paletteColor;
      updated = true;
    }
    const appliedColor = typeof g.color === 'string' && g.color ? g.color : paletteColor;
    if (!appliedColor) return;
    if (Array.isArray(g.segs)) {
      g.segs.forEach(seg => {
        if (seg && typeof seg.setAttribute === 'function') {
          seg.setAttribute({ strokeColor: appliedColor });
        }
      });
    }
    if (Array.isArray(g.gliders) && g.gliders.length) {
      g.gliders.forEach(point => {
        if (point && typeof point.setAttribute === 'function') {
          point.setAttribute({ strokeColor: appliedColor });
        }
      });
    }
    if (g.labelElement && typeof g.labelElement.setAttribute === 'function') {
      g.labelElement.setAttribute({
        color: appliedColor,
        fillColor: appliedColor,
        cssStyle: `user-select:none;cursor:move;touch-action:none;color:${appliedColor};display:inline-block;`
      });
      const node = g.labelElement.rendNode;
      if (node && node.style) {
        node.style.color = appliedColor;
      }
    }
    if (g._br && typeof g._br === 'object') {
      Object.values(g._br).forEach(list => {
        if (!Array.isArray(list)) return;
        list.forEach(seg => {
          if (seg && typeof seg.setAttribute === 'function') {
            seg.setAttribute({ strokeColor: appliedColor });
          }
        });
      });
    }
  });
  if (updated && brd && typeof brd.update === 'function') {
    brd.update();
  }
}

/* =================== SEGMENTERT TEGNING =================== */
function removeSegments(g) {
  if (g.segs) {
    g.segs.forEach(s => brd.removeObject(s));
    g.segs = [];
  }
}
function rebuildFunctionSegmentsFor(g) {
  removeSegments(g);
  const bb = brd.getBoundingBox();
  let L = bb[0],
    R = bb[2];
  if (g.domain) {
    if (Number.isFinite(g.domain.min)) {
      L = Math.max(L, g.domain.min);
    }
    if (Number.isFinite(g.domain.max)) {
      R = Math.min(R, g.domain.max);
    }
  }
  if (!(R > L)) return;
  const vas = ADV.asymptote.detect && ADV.asymptote.showVertical ? detectVerticalAsymptotes(g.fn, L, R, 1000, ADV.asymptote.hugeY) : [];
  const xs = [L, ...vas.filter(x => x > L && x < R), R].sort((a, b) => a - b);
  const eps = (R - L) * 1e-6;
  const leftDomainOpen = !!(g.domain && !g.domain.leftClosed);
  const rightDomainOpen = !!(g.domain && !g.domain.rightClosed);
  const safe = x => {
    try {
      const y = g.fn(x);
      return Number.isFinite(y) ? y : NaN;
    } catch (_) {
      return NaN;
    }
  };
  g.segs = [];
  for (let i = 0; i < xs.length - 1; i++) {
    let a = xs[i],
      b = xs[i + 1];
    const leftOpen = i > 0 || (i === 0 && leftDomainOpen);
    const rightOpen = i < xs.length - 2 || (i === xs.length - 2 && rightDomainOpen);
    if (leftOpen) a += eps;
    if (rightOpen) b -= eps;
    if (b <= a) continue;
    const seg = brd.create('functiongraph', [safe, () => a, () => b], {
      strokeColor: g.color,
      strokeWidth: 4,
      fixed: true,
      highlight: false
    });
    g.segs.push(seg);
  }
}
function rebuildAllFunctionSegments() {
  graphs.forEach(rebuildFunctionSegmentsFor);
}

/* =================== FUNKSJONER + BRACKETS =================== */
const SUPERSCRIPT_MAP = {
  0: '⁰',
  1: '¹',
  2: '²',
  3: '³',
  4: '⁴',
  5: '⁵',
  6: '⁶',
  7: '⁷',
  8: '⁸',
  9: '⁹',
  '+': '⁺',
  '-': '⁻',
  '=': '⁼',
  '(': '⁽',
  ')': '⁾',
  'n': 'ⁿ',
  'i': 'ⁱ'
};
const SUBSCRIPT_MAP = {
  0: '₀',
  1: '₁',
  2: '₂',
  3: '₃',
  4: '₄',
  5: '₅',
  6: '₆',
  7: '₇',
  8: '₈',
  9: '₉',
  '+': '₊',
  '-': '₋',
  '=': '₌',
  '(': '₍',
  ')': '₎'
};
function mapScriptChars(str, map) {
  return Array.from(str).map(ch => map[ch] || ch).join('');
}
function escapeRegExpClass(str) {
  return str.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&');
}
const SUPERSCRIPT_REVERSE_MAP = Object.entries(SUPERSCRIPT_MAP).reduce((acc, [key, value]) => {
  acc[value] = key;
  return acc;
}, {});
const SUBSCRIPT_REVERSE_MAP = Object.entries(SUBSCRIPT_MAP).reduce((acc, [key, value]) => {
  acc[value] = key;
  return acc;
}, {});
const SUPERSCRIPT_SEQUENCE_REGEX = new RegExp(`[${escapeRegExpClass(Object.values(SUPERSCRIPT_MAP).join(''))}]+`, 'g');
const SUBSCRIPT_SEQUENCE_REGEX = new RegExp(`[${escapeRegExpClass(Object.values(SUBSCRIPT_MAP).join(''))}]+`, 'g');
const HTML_ESCAPE_MAP = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;'
};
function escapeHtml(str) {
  return String(str).replace(/[&<>"']/g, ch => HTML_ESCAPE_MAP[ch] || ch);
}
function decodeBasicEntities(text) {
  return String(text).replace(/&nbsp;/gi, ' ').replace(/&lt;/gi, '<').replace(/&gt;/gi, '>').replace(/&amp;/gi, '&');
}
function collapseExpressionWhitespace(text) {
  return String(text).replace(/\u00a0/g, ' ').replace(/[\t\r\f]+/g, ' ').replace(/\s+\n/g, '\n').replace(/\n\s+/g, '\n').trim();
}
function replaceUnicodeScripts(value, regex, reverseMap, prefix) {
  return value.replace(regex, match => {
    const mapped = Array.from(match).map(ch => reverseMap[ch] != null ? reverseMap[ch] : ch).join('');
    if (!mapped) return match;
    return `${prefix}{${mapped}}`;
  });
}
function finalizeLatexFromPlain(input) {
  const collapsed = collapseExpressionWhitespace(decodeBasicEntities(input));
  if (!collapsed) return '';
  let out = replaceUnicodeScripts(collapsed, SUPERSCRIPT_SEQUENCE_REGEX, SUPERSCRIPT_REVERSE_MAP, '^');
  out = replaceUnicodeScripts(out, SUBSCRIPT_SEQUENCE_REGEX, SUBSCRIPT_REVERSE_MAP, '_');
  return out.replace(/\n/g, '\\\\');
}
function convertExpressionToLatex(str) {
  if (typeof str !== 'string') return '';
  const trimmed = str.trim();
  if (!trimmed) return '';
  const manualConvert = input => {
    let text = String(input);
    const replaceScript = (pattern, builder) => {
      text = text.replace(pattern, (_, inner = '') => builder(manualConvert(inner)));
    };
    text = text.replace(/<br\s*\/?>/gi, '\n');
    replaceScript(/<sup>([\s\S]*?)<\/sup>/gi, inner => `^{${inner}}`);
    replaceScript(/<sub>([\s\S]*?)<\/sub>/gi, inner => `_{${inner}}`);
    text = text.replace(/<[^>]*>/g, '');
    return text;
  };
  if (/[<&]/.test(trimmed) && typeof document !== 'undefined') {
    try {
      const tpl = document.createElement('template');
      tpl.innerHTML = trimmed;
      const TEXT_NODE = typeof Node !== 'undefined' && Node.TEXT_NODE != null ? Node.TEXT_NODE : 3;
      const ELEMENT_NODE = typeof Node !== 'undefined' && Node.ELEMENT_NODE != null ? Node.ELEMENT_NODE : 1;
      const convertNode = node => {
        if (!node) return '';
        if (node.nodeType === TEXT_NODE) {
          return node.textContent || '';
        }
        if (node.nodeType === ELEMENT_NODE) {
          const tag = node.tagName ? node.tagName.toLowerCase() : '';
          if (tag === 'sup') {
            let out = '';
            node.childNodes.forEach(child => {
              out += convertNode(child);
            });
            return `^{${out}}`;
          }
          if (tag === 'sub') {
            let out = '';
            node.childNodes.forEach(child => {
              out += convertNode(child);
            });
            return `_{${out}}`;
          }
          if (tag === 'br') {
            return '\n';
          }
          let out = '';
          node.childNodes.forEach(child => {
            out += convertNode(child);
          });
          return out;
        }
        return '';
      };
      const text = Array.from(tpl.content.childNodes).map(node => convertNode(node)).join('');
      return finalizeLatexFromPlain(text);
    } catch (_) {
      return finalizeLatexFromPlain(manualConvert(trimmed));
    }
  }
  if (/[<&]/.test(trimmed)) {
    return finalizeLatexFromPlain(manualConvert(trimmed));
  }
  return finalizeLatexFromPlain(trimmed);
}
function renderLatexToHtml(latex) {
  if (!latex) return '';
  if (typeof window === 'undefined' || !window.katex) return '';
  const { katex } = window;
  if (!katex) return '';
  if (typeof katex.renderToString === 'function') {
    try {
      return katex.renderToString(latex, {
        throwOnError: false
      });
    } catch (_) {
      return '';
    }
  }
  if (typeof katex.render === 'function' && typeof document !== 'undefined') {
    const span = document.createElement('span');
    try {
      katex.render(latex, span, {
        throwOnError: false
      });
      return span.innerHTML;
    } catch (_) {
      return '';
    }
  }
  return '';
}
const KATEX_TEXT_ESCAPE_REGEX = /([#%&$^_{}\\])/g;
function escapeKatexPlainText(text) {
  return String(text).replace(KATEX_TEXT_ESCAPE_REGEX, '\\$1');
}
function renderKatexPlainText(target, text) {
  if (!target) return;
  const str = typeof text === 'string' ? text : '';
  if (!str) {
    target.textContent = '';
    return;
  }
  const katex = typeof window !== 'undefined' ? window.katex : null;
  if (katex && typeof katex.render === 'function') {
    try {
      katex.render(`\\text{${escapeKatexPlainText(str)}}`, target, { throwOnError: false });
      return;
    } catch (_) {}
  }
  target.textContent = str;
}
function renderKatexMath(target, latex, fallbackText = '') {
  if (!target) return;
  const str = typeof latex === 'string' ? latex : '';
  const fallback = typeof fallbackText === 'string' && fallbackText ? fallbackText : str;
  if (!str) {
    target.textContent = fallback;
    return;
  }
  const katex = typeof window !== 'undefined' ? window.katex : null;
  if (katex && typeof katex.render === 'function') {
    try {
      katex.render(str, target, { throwOnError: false });
      return;
    } catch (_) {}
  }
  target.textContent = fallback || str;
}
function normalizeExpressionText(str) {
  if (typeof str !== 'string') return '';
  const trimmed = str.trim();
  if (!trimmed) return '';
  const manualNormalize = input => {
    let text = String(input);
    const replaceScript = (pattern, map) => {
      text = text.replace(pattern, (_, inner = '') => mapScriptChars(manualNormalize(inner), map));
    };
    text = text.replace(/<br\s*\/?>/gi, '\n');
    replaceScript(/<sup>([\s\S]*?)<\/sup>/gi, SUPERSCRIPT_MAP);
    replaceScript(/<sub>([\s\S]*?)<\/sub>/gi, SUBSCRIPT_MAP);
    text = text.replace(/<[^>]*>/g, '');
    return collapseExpressionWhitespace(decodeBasicEntities(text));
  };
  if (/[<&]/.test(trimmed) && typeof document !== 'undefined') {
    try {
      const tpl = document.createElement('template');
      tpl.innerHTML = trimmed;
      const TEXT_NODE = typeof Node !== 'undefined' && Node.TEXT_NODE != null ? Node.TEXT_NODE : 3;
      const ELEMENT_NODE = typeof Node !== 'undefined' && Node.ELEMENT_NODE != null ? Node.ELEMENT_NODE : 1;
      const convertNode = (node, mode) => {
        if (!node) return '';
        if (node.nodeType === TEXT_NODE) {
          const text = node.textContent || '';
          if (mode === 'sup') return mapScriptChars(text, SUPERSCRIPT_MAP);
          if (mode === 'sub') return mapScriptChars(text, SUBSCRIPT_MAP);
          return text;
        }
        if (node.nodeType === ELEMENT_NODE) {
          const tag = node.tagName ? node.tagName.toLowerCase() : '';
          if (tag === 'sup') {
            let out = '';
            node.childNodes.forEach(child => {
              out += convertNode(child, 'sup');
            });
            return out;
          }
          if (tag === 'sub') {
            let out = '';
            node.childNodes.forEach(child => {
              out += convertNode(child, 'sub');
            });
            return out;
          }
          if (tag === 'br') {
            return '\n';
          }
          let out = '';
          node.childNodes.forEach(child => {
            out += convertNode(child, mode);
          });
          return out;
        }
        return '';
      };
      const text = Array.from(tpl.content.childNodes).map(node => convertNode(node, null)).join('');
      return collapseExpressionWhitespace(text);
    } catch (_) {
      return manualNormalize(trimmed);
    }
  }
  if (/[<&]/.test(trimmed)) {
    return manualNormalize(trimmed);
  }
  return collapseExpressionWhitespace(decodeBasicEntities(trimmed));
}
const ALT_TEXT_NUMBER_FORMATTER = typeof Intl !== 'undefined' ? new Intl.NumberFormat('nb-NO', {
  minimumFractionDigits: 0,
  maximumFractionDigits: 3
}) : null;
function formatAltNumber(value) {
  if (typeof value !== 'number' || !Number.isFinite(value)) return '';
  const normalized = Object.is(value, -0) ? 0 : value;
  if (ALT_TEXT_NUMBER_FORMATTER) {
    try {
      return ALT_TEXT_NUMBER_FORMATTER.format(normalized);
    } catch (_) {}
  }
  const rounded = Math.round(normalized * 1000) / 1000;
  const str = String(rounded);
  return str.replace(/\.0+(?=$)/, '').replace(/(\.\d*?)0+(?=$)/, '$1');
}
function joinList(items) {
  if (!Array.isArray(items) || items.length === 0) return '';
  if (items.length === 1) return items[0];
  if (items.length === 2) return `${items[0]} og ${items[1]}`;
  const head = items.slice(0, -1).join(', ');
  const tail = items[items.length - 1];
  return `${head} og ${tail}`;
}
function formatCoordinateForAlt(point) {
  if (!Array.isArray(point) || point.length < 2) return '';
  const [x, y] = point;
  const fx = formatAltNumber(x);
  const fy = formatAltNumber(y);
  if (!fx || !fy) return '';
  return `(${fx}, ${fy})`;
}
function describeDomainForAlt(domain) {
  if (!domain) return '';
  const hasMin = Number.isFinite(domain.min);
  const hasMax = Number.isFinite(domain.max);
  if (!hasMin && !hasMax) return '';
  const min = hasMin ? formatAltNumber(domain.min) : '';
  const max = hasMax ? formatAltNumber(domain.max) : '';
  if (hasMin && hasMax) {
    if (!min || !max) return '';
    if (domain.min === domain.max) {
      return `for x lik ${min}`;
    }
    if (domain.leftClosed && domain.rightClosed) {
      return `for x fra ${min} til ${max}, inkludert begge endepunkter`;
    }
    if (domain.leftClosed && !domain.rightClosed) {
      return `for x fra og med ${min} til ${max}, men ikke inkludert ${max}`;
    }
    if (!domain.leftClosed && domain.rightClosed) {
      return `for x fra ${min} til og med ${max}, men ikke inkludert ${min}`;
    }
    return `for x mellom ${min} og ${max}, uten endepunktene`;
  }
  if (!hasMin && hasMax) {
    if (!max) return '';
    return domain.rightClosed ? `for x mindre enn eller lik ${max}` : `for x mindre enn ${max}`;
  }
  if (hasMin && !hasMax) {
    if (!min) return '';
    return domain.leftClosed ? `for x større enn eller lik ${min}` : `for x større enn ${min}`;
  }
  return '';
}
function appendExtraPointsAltText(parsed, sentences) {
  if (!Array.isArray(sentences)) return;
  const points = Array.isArray(parsed === null || parsed === void 0 ? void 0 : parsed.extraPoints) ? parsed.extraPoints.filter(isValidPointArray) : [];
  if (!points.length) return;
  const coords = points.map(formatCoordinateForAlt).filter(Boolean);
  if (!coords.length) return;
  const locked = !(parsed && parsed.lockExtraPoints === false);
  if (coords.length === 1) {
    sentences.push(`${locked ? 'Et fast punkt' : 'Et punkt'} er markert i ${coords[0]}.`);
  } else {
    sentences.push(`${locked ? 'Faste punkter' : 'Punkter'} er markert i ${joinList(coords)}.`);
  }
}
function describeCoordinateSystemForAlt() {
  return 'Koordinatsystemet har en horisontal x-akse og en vertikal y-akse med rutenettlinjer som markerer enheter.';
}
function parseSimpleQuadraticCoefficients(expr) {
  if (typeof expr !== 'string') return null;
  let normalized = expr.replace(/\s+/g, '').replace(/·/g, '').replace(/,/g, '.').replace(/−/g, '-');
  normalized = normalized.replace(/\*/g, '');
  normalized = normalized.replace(/X/g, 'x');
  if (!normalized) return null;
  if (!/x\^2/i.test(normalized)) return null;
  if (/[^0-9x^+\.\-]/i.test(normalized)) return null;
  const terms = [];
  let current = '';
  for (let i = 0; i < normalized.length; i++) {
    const ch = normalized[i];
    if (ch === '+' || ch === '-') {
      if (i === 0) {
        current += ch;
      } else {
        if (current) terms.push(current);
        current = ch;
      }
    } else {
      current += ch;
    }
  }
  if (current) terms.push(current);
  if (!terms.length) terms.push(normalized);
  const parseCoeff = (str, fallback) => {
    if (str == null || str === '') {
      return fallback;
    }
    if (str === '+') {
      return fallback == null ? null : +fallback;
    }
    if (str === '-') {
      return fallback == null ? null : -fallback;
    }
    const num = Number.parseFloat(str);
    if (!Number.isFinite(num)) return null;
    return num;
  };
  let a = null;
  let b = 0;
  let c = 0;
  for (const term of terms) {
    if (!term) continue;
    if (/x\^2$/i.test(term)) {
      const coeff = parseCoeff(term.replace(/x\^2$/i, ''), 1);
      if (coeff == null) return null;
      a = coeff;
    } else if (/x$/i.test(term)) {
      const coeff = parseCoeff(term.replace(/x$/i, ''), 1);
      if (coeff == null) return null;
      b += coeff;
    } else {
      const coeff = parseCoeff(term, null);
      if (coeff == null) return null;
      c += coeff;
    }
  }
  if (a == null) return null;
  return { a, b, c };
}
function describeQuadraticShapeForAlt(fun) {
  if (!fun || typeof fun.rhs !== 'string') return [];
  const coeffs = parseSimpleQuadraticCoefficients(fun.rhs);
  if (!coeffs) return [];
  const { a, b, c } = coeffs;
  if (a === 0 || !Number.isFinite(a) || !Number.isFinite(b) || !Number.isFinite(c)) {
    return [];
  }
  const sentences = [];
  sentences.push(`Grafen er en parabel som åpner ${a > 0 ? 'oppover' : 'nedover'}.`);
  const vertexX = -b / (2 * a);
  const vertexY = a * vertexX * vertexX + b * vertexX + c;
  const vertexCoord = formatCoordinateForAlt([vertexX, vertexY]);
  if (vertexCoord) {
    sentences.push(`Toppunktet ligger i ${vertexCoord}.`);
  }
  const yInterceptCoord = formatCoordinateForAlt([0, c]);
  if (yInterceptCoord) {
    sentences.push(`Grafen skjærer y-aksen i ${yInterceptCoord}.`);
  }
  const disc = b * b - 4 * a * c;
  if (Number.isFinite(disc)) {
    const EPS = 1e-9;
    if (disc > EPS) {
      const sqrtDisc = Math.sqrt(disc);
      const root1 = (-b - sqrtDisc) / (2 * a);
      const root2 = (-b + sqrtDisc) / (2 * a);
      const coords = [formatCoordinateForAlt([root1, 0]), formatCoordinateForAlt([root2, 0])].filter(Boolean);
      if (coords.length === 2) {
        sentences.push(`Den krysser x-aksen i punktene ${joinList(coords)}.`);
      } else if (coords.length === 1) {
        sentences.push(`Den krysser x-aksen i punktet ${coords[0]}.`);
      }
    } else if (Math.abs(disc) <= EPS) {
      if (vertexCoord) {
        sentences.push(`Grafen tangerer x-aksen i ${vertexCoord}.`);
      } else {
        sentences.push('Grafen tangerer x-aksen i toppunktet.');
      }
    } else {
      sentences.push('Grafen krysser ikke x-aksen.');
    }
  }
  return sentences;
}
function buildFunctionsAltTextSummary(parsed) {
  const sentences = [];
  const coordinateSentence = describeCoordinateSystemForAlt();
  if (coordinateSentence) {
    sentences.push(coordinateSentence);
  }
  const functions = Array.isArray(parsed === null || parsed === void 0 ? void 0 : parsed.funcs) ? parsed.funcs.filter(fun => fun && typeof fun.rhs === 'string' && fun.rhs.trim()) : [];
  if (!functions.length) {
    sentences.push('Figuren viser et koordinatsystem uten funksjoner.');
  } else if (functions.length === 1) {
    const fun = functions[0];
    const label = normalizeExpressionText((fun === null || fun === void 0 ? void 0 : fun.label) || (fun === null || fun === void 0 ? void 0 : fun.name) || '');
    const expr = normalizeExpressionText(fun === null || fun === void 0 ? void 0 : fun.rhs);
    if (label && expr) {
      sentences.push(`Grafen viser ${label} = ${expr}.`);
    } else if (expr) {
      sentences.push(`Grafen viser funksjonen y = ${expr}.`);
    } else if (label) {
      sentences.push(`Grafen viser ${label}.`);
    } else {
      sentences.push('Grafen viser én funksjon.');
    }
    const domainText = describeDomainForAlt(fun === null || fun === void 0 ? void 0 : fun.domain);
    if (domainText) {
      sentences.push(`Funksjonen er tegnet ${domainText}.`);
    }
    const shapeSentences = describeQuadraticShapeForAlt(fun);
    if (shapeSentences.length) {
      sentences.push(...shapeSentences);
    }
  } else {
    sentences.push(`Grafen viser ${functions.length} funksjoner.`);
    functions.forEach((fun, idx) => {
      const label = normalizeExpressionText((fun === null || fun === void 0 ? void 0 : fun.label) || (fun === null || fun === void 0 ? void 0 : fun.name) || '');
      const expr = normalizeExpressionText(fun === null || fun === void 0 ? void 0 : fun.rhs);
      let sentence = '';
      if (label && expr) {
        sentence = `Funksjon ${idx + 1}: ${label} = ${expr}.`;
      } else if (expr) {
        sentence = `Funksjon ${idx + 1}: y = ${expr}.`;
      } else if (label) {
        sentence = `Funksjon ${idx + 1}: ${label}.`;
      }
      const domainText = describeDomainForAlt(fun === null || fun === void 0 ? void 0 : fun.domain);
      if (sentence) {
        if (domainText) {
          sentence += ` Den er tegnet ${domainText}.`;
        }
        sentences.push(sentence);
      } else if (domainText) {
        sentences.push(`Funksjon ${idx + 1} er tegnet ${domainText}.`);
      }
    });
  }
  const gliderCount = Number.isFinite(parsed === null || parsed === void 0 ? void 0 : parsed.pointsCount) ? parsed.pointsCount : 0;
  if (gliderCount > 0) {
    sentences.push(gliderCount === 1 ? 'Det er ett flyttbart punkt på grafen.' : `Det er ${gliderCount} flyttbare punkter på grafene.`);
    const startValues = Array.isArray(parsed === null || parsed === void 0 ? void 0 : parsed.startX) ? parsed.startX.filter(Number.isFinite).map(formatAltNumber).filter(Boolean) : [];
    if (startValues.length) {
      sentences.push(`Startposisjonene for x er ${joinList(startValues)}.`);
    }
  }
  appendExtraPointsAltText(parsed, sentences);
  const answerText = normalizeExpressionText(parsed === null || parsed === void 0 ? void 0 : parsed.answer);
  if (answerText) {
    sentences.push(`Fasit: ${answerText}.`);
  }
  return sentences.join(' ');
}
function buildLineAltTextSummary(parsed) {
  const sentences = ['Figuren viser en linje i et koordinatsystem.'];
  const first = Array.isArray(parsed === null || parsed === void 0 ? void 0 : parsed.funcs) && parsed.funcs.length ? parsed.funcs[0] : null;
  const expr = normalizeExpressionText((first === null || first === void 0 ? void 0 : first.rhs) || '');
  if (expr) {
    sentences.push(`Uttrykket er y = ${expr}.`);
  }
  const template = interpretLineTemplate(first ? first.rhs : '');
  const specifiedPoints = Array.isArray(parsed === null || parsed === void 0 ? void 0 : parsed.linePoints) ? parsed.linePoints.filter(isValidPointArray) : [];
  const basePoints = (specifiedPoints.length ? specifiedPoints : resolveLineStartPoints(parsed)).filter(isValidPointArray);
  if ((template === null || template === void 0 ? void 0 : template.kind) === 'anchorY') {
    const anchor = formatAltNumber(template.anchorC);
    if (anchor) {
      sentences.push(`Linjen går alltid gjennom punktet (0, ${anchor}) på y-aksen.`);
    }
    const point = basePoints[0] ? formatCoordinateForAlt(basePoints[0]) : '';
    if (point) {
      sentences.push(`${specifiedPoints.length ? 'Det angitte punktet ligger' : 'Det flyttbare punktet starter'} i ${point}.`);
    }
  } else if ((template === null || template === void 0 ? void 0 : template.kind) === 'fixedSlope') {
    const slope = formatAltNumber(template.slopeM);
    if (slope) {
      sentences.push(`Linjen har fast stigningstall ${slope}.`);
    }
    const point = basePoints[0] ? formatCoordinateForAlt(basePoints[0]) : '';
    if (point) {
      sentences.push(`${specifiedPoints.length ? 'Linjen går gjennom' : 'Det flyttbare punktet starter i'} ${point}.`);
    }
  } else {
    const coords = basePoints.slice(0, 2).map(formatCoordinateForAlt).filter(Boolean);
    if (coords.length === 2) {
      const prefix = specifiedPoints.length ? 'Linjen er definert av' : 'Linjen starter i';
      sentences.push(`${prefix} punktene ${joinList(coords)}.`);
    } else if (coords.length === 1) {
      sentences.push(`Linjen går gjennom punktet ${coords[0]}.`);
    }
  }
  appendExtraPointsAltText(parsed, sentences);
  const answerText = normalizeExpressionText(parsed === null || parsed === void 0 ? void 0 : parsed.answer);
  if (answerText) {
    sentences.push(`Fasit: ${answerText}.`);
  }
  return sentences.join(' ');
}
function getSimpleString() {
  if (typeof SIMPLE === 'string') return SIMPLE;
  if (SIMPLE == null) return '';
  return String(SIMPLE);
}
function buildGrafAltText() {
  try {
    const parsed = parseSimple(getSimpleString());
    const mode = decideMode(parsed);
    const summary = mode === 'functions' ? buildFunctionsAltTextSummary(parsed) : buildLineAltTextSummary(parsed);
    const normalized = summary.replace(/\s+/g, ' ').trim();
    return normalized || 'Figuren viser et koordinatsystem.';
  } catch (_) {
    return 'Figuren viser et koordinatsystem.';
  }
}
function resolveAltTextTitle() {
  if (typeof document === 'undefined') return 'Graftegner';
  const docTitle = typeof document.title === 'string' ? document.title.trim() : '';
  if (docTitle) return docTitle;
  const heading = document.querySelector('h1');
  if (heading && heading.textContent && heading.textContent.trim()) {
    return heading.textContent.trim();
  }
  return 'Graftegner';
}
function refreshAltText(reason) {
  const signature = buildGrafAltText();
  if (altTextManager && typeof altTextManager.refresh === 'function') {
    altTextManager.refresh(reason || 'auto', signature);
  } else if (altTextManager && typeof altTextManager.notifyFigureChange === 'function') {
    altTextManager.notifyFigureChange(signature);
  }
}
function applyAltTextToBoard() {
  if (altTextManager) {
    altTextManager.applyCurrent();
  }
}

function getCurrentAltText() {
  const text = ALT_TEXT_STATE && typeof ALT_TEXT_STATE.text === 'string' ? ALT_TEXT_STATE.text.trim() : '';
  if (text) {
    return text;
  }
  const generated = buildGrafAltText();
  return typeof generated === 'string' ? generated : '';
}
function initAltTextManager() {
  if (typeof window === 'undefined' || !window.MathVisAltText) return;
  const container = document.getElementById('exportCard');
  if (!container) return;
  if (altTextManager) {
    altTextManager.ensureDom();
    altTextManager.applyCurrent();
    return;
  }
  altTextManager = window.MathVisAltText.create({
    svg: () => brd && brd.renderer && brd.renderer.svgRoot || null,
    container,
    getTitle: resolveAltTextTitle,
    getState: () => ({
      text: typeof ALT_TEXT_STATE.text === 'string' ? ALT_TEXT_STATE.text : '',
      source: ALT_TEXT_STATE.source === 'manual' ? 'manual' : 'auto'
    }),
    setState: (text, source) => {
      ALT_TEXT_STATE.text = typeof text === 'string' ? text : '';
      ALT_TEXT_STATE.source = source === 'manual' ? 'manual' : 'auto';
      if (typeof window !== 'undefined') {
        window.GRAF_ALT_TEXT = ALT_TEXT_STATE;
      }
    },
    generate: () => buildGrafAltText(),
    getSignature: () => buildGrafAltText(),
    getAutoMessage: reason => reason && reason.startsWith('manual') ? 'Alternativ tekst oppdatert.' : 'Alternativ tekst oppdatert automatisk.',
    getManualMessage: () => 'Alternativ tekst oppdatert manuelt.'
  });
  if (altTextManager) {
    altTextManager.applyCurrent();
    refreshAltText('init');
  }
}
function makeSmartCurveLabel(g, idx, content) {
  if (!ADV.curveName.show || !content) return;
  const renderer = (() => {
    let cached = '';
    let cachedKey = null;
    return () => {
      const latex = content.latex && content.latex.trim();
      if (latex) {
        const key = `latex:${latex}`;
        if (cachedKey === key && cached) return cached;
        const html = (content.html && content.html.trim()) || renderLatexToHtml(latex);
        if (html) {
          cachedKey = key;
          cached = `<span class="curve-label curve-label--latex">${html}</span>`;
          content.html = html;
          return cached;
        }
      }
      const plain = content.text ? escapeHtml(content.text) : '';
      const key = `text:${plain}`;
      if (cachedKey === key && cached) return cached;
      cachedKey = key;
      cached = plain ? `<span class="curve-label curve-label--text">${plain}</span>` : '';
      return cached;
    };
  })();
  const label = brd.create('text', [0, 0, renderer], {
    color: g.color,
    fillColor: g.color,
    fontSize: ADV.curveName.fontSize,
    fixed: true,
    highlight: false,
    layer: ADV.curveName.layer,
    anchorX: 'left',
    anchorY: 'middle',
    display: 'html',
    cssStyle: `user-select:none;cursor:move;touch-action:none;color:${g.color};display:inline-block;`
  });
  g.labelElement = label;
  label._plainText = content.text || '';
  ensurePlateFor(label);
  g._labelManual = false;
  function finiteYAt(x) {
    let y = g.fn(x);
    if (Number.isFinite(y)) return y;
    const [xmin, ymax, xmax, ymin] = brd.getBoundingBox();
    const span = xmax - xmin,
      step = span / 60;
    for (let k = 1; k <= 60; k++) {
      for (const s of [+1, -1]) {
        const xs = x + s * k * step / 6;
        y = g.fn(xs);
        if (Number.isFinite(y)) return y;
      }
    }
    return 0;
  }
  function position(force) {
    const forced = force === true;
    if (g._labelManual && !forced) {
      clampLabelToView(label);
      updatePlate(label);
      ensureLabelFront(label);
      return;
    }
    const bb = brd.getBoundingBox(),
      xmin = bb[0],
      xmax = bb[2],
      ymin = bb[3],
      ymax = bb[1];
    const a = g.domain ? g.domain.min : xmin,
      b = g.domain ? g.domain.max : xmax;
    const L = Math.max(a, xmin),
      R = Math.min(b, xmax);
    if (!(R > L)) return;
    const fr = ADV.curveName.fractions,
      pad = 0.04 * (R - L);
    let best = {
      pen: 1e9,
      pos: [(xmin + xmax) / 2, (ymin + ymax) / 2],
      slope: 0
    };
    for (const f of fr) {
      let x = L + f * (R - L);
      x = Math.min(R - pad, Math.max(L + pad, x));
      const y = finiteYAt(x);
      const h = (xmax - xmin) / 600;
      const y1 = g.fn(x - h),
        y2 = g.fn(x + h);
      const m = Number.isFinite(y1) && Number.isFinite(y2) ? (y2 - y1) / (2 * h) : 0;
      let nx = -m,
        ny = 1;
      const L2 = Math.hypot(nx, ny) || 1;
      nx /= L2;
      ny /= L2;
      const rx = (xmax - xmin) / brd.canvasWidth,
        ry = (ymax - ymin) / brd.canvasHeight;
      const off = ADV.curveName.gapPx;
      let X = x + nx * off * rx,
        Y = y + ny * off * ry;
      const xCl = Math.min(xmax - (xmax - xmin) * ADV.curveName.marginFracX, Math.max(xmin + (xmax - xmin) * ADV.curveName.marginFracX, X));
      const yCl = Math.min(ymax - (ymax - ymin) * ADV.curveName.marginFracY, Math.max(ymin + (ymax - ymin) * ADV.curveName.marginFracY, Y));
      const pen = Math.abs(xCl - X) / rx + Math.abs(yCl - Y) / ry;
      if (pen < best.pen) best = {
        pen,
        pos: [xCl, yCl],
        slope: m
      };
    }
    label.moveTo(best.pos);
    label.setAttribute({
      anchorX: best.slope >= 0 ? 'left' : 'right'
    });
    clampLabelToView(label);
    updatePlate(label);
    ensureLabelFront(label);
    g._labelManual = false;
  }
  position();
  brd.on('boundingbox', position);
  makeLabelDraggable(label, g, position);
  g._repositionLabel = position;
}
function makeBracketAt(g, x0, side /* -1 = venstre (a), +1 = høyre (b) */, closed) {
  g._br = g._br || {};
  if (g._br[side]) {
    g._br[side].forEach(o => brd.removeObject(o));
    g._br[side] = null;
  }
  if (!g.domain || g.domain.showMarkers === false || !ADV.domainMarkers.show) return;
  if (!Number.isFinite(x0)) return;
  const [xmin, ymax, xmax, ymin] = brd.getBoundingBox();
  const rx = (xmax - xmin) / brd.canvasWidth;
  const ry = (ymax - ymin) / brd.canvasHeight;
  const baseH = Math.max((xmax - xmin) / 400, 5e-5);

  // Finn et punkt innover i domenet med finite y
  const inward = side < 0 ? +1 : -1;
  const maxTries = 24;
  let xS = x0;
  let yS = NaN;
  for (let tries = 0; tries < maxTries; tries += 1) {
    const step = tries === 0 ? 0 : baseH * Math.pow(0.5, tries - 1);
    const candidate = tries === 0 ? x0 : x0 + inward * step;
    let value;
    try {
      value = g.fn(candidate);
    } catch (_) {
      value = NaN;
    }
    if (Number.isFinite(value)) {
      xS = candidate;
      yS = value;
      break;
    }
  }
  if (!Number.isFinite(yS)) return;

  // tangent rundt xS
  let m = 0;
  try {
    const y1 = g.fn(xS + baseH),
      y2 = g.fn(xS - baseH);
    if (Number.isFinite(y1) && Number.isFinite(y2)) m = (y1 - y2) / (2 * baseH);
  } catch (_) {}

  // enhets-tangent/-normal i px-rom
  let tx = 1 / rx,
    ty = m / ry;
  const tlen = Math.hypot(tx, ty) || 1;
  tx /= tlen;
  ty /= tlen;
  let nx = -ty,
    ny = tx;
  const px2world = (vx, vy, Lpx) => [vx * Lpx * rx, vy * Lpx * ry];
  const shape = closed ? DOMAIN_MARKER_SHAPES.closed : DOMAIN_MARKER_SHAPES.open;
  if (!shape || !Array.isArray(shape.points) || !shape.points.length) return;
  const LEN = ADV.domainMarkers.barPx;
  const heightPx = shape.height || 1;
  const scale = LEN / heightPx;
  const flip = closed ? -side : side;
  const strokeColor = typeof g.color === 'string' && g.color ? g.color : ADV.domainMarkers.color;
  const style = {
    strokeColor,
    strokeWidth: ADV.domainMarkers.width,
    fixed: true,
    highlight: false,
    layer: ADV.domainMarkers.layer,
    lineCap: 'round',
    lineJoin: 'round'
  };
  const tangentUnit = px2world(tx, ty, 1);
  const normalUnit = px2world(nx, ny, 1);
  const localPoints = shape.points.map(([px, py]) => {
    return {
      localX: (px - shape.centerX) * scale * flip,
      localY: (py - shape.centerY) * scale
    };
  });
  let localShift = 0;
  let contactIdx = 0;
  if (Math.abs(tangentUnit[0]) > 1e-9) {
    const xValues = localPoints.map(pt => xS + pt.localX * tangentUnit[0] + pt.localY * normalUnit[0]);
    for (let i = 1; i < xValues.length; i += 1) {
      const better = side > 0 ? xValues[i] > xValues[contactIdx] : xValues[i] < xValues[contactIdx];
      if (better) contactIdx = i;
    }
    const desiredX = x0;
    const delta = desiredX - xValues[contactIdx];
    localShift = delta / tangentUnit[0];
  }
  const segments = [];
  const mapped = localPoints.map(({ localX, localY }) => {
    const shiftedX = localX + localShift;
    const offTx = shiftedX * tangentUnit[0];
    const offTy = shiftedX * tangentUnit[1];
    const offNx = localY * normalUnit[0];
    const offNy = localY * normalUnit[1];
    return [xS + offTx + offNx, yS + offTy + offNy];
  });
  if (mapped.length) {
    let yTarget = yS;
    if (Math.abs(xS - x0) > 1e-9) {
      try {
        const yExact = g.fn(x0);
        if (Number.isFinite(yExact)) yTarget = yExact;
      } catch (_) {}
    }
    if (!(Number.isFinite(contactIdx) && contactIdx >= 0 && contactIdx < mapped.length)) {
      contactIdx = 0;
    }
    if (mapped.length > 1) {
      for (let i = 1; i < mapped.length; i += 1) {
        const better = side > 0 ? mapped[i][0] > mapped[contactIdx][0] : mapped[i][0] < mapped[contactIdx][0];
        if (better) contactIdx = i;
      }
    }
    const desiredPoint = [x0, yTarget];
    const dx = desiredPoint[0] - mapped[contactIdx][0];
    const dy = desiredPoint[1] - mapped[contactIdx][1];
    if (Math.abs(dx) > 1e-12 || Math.abs(dy) > 1e-12) {
      for (let i = 0; i < mapped.length; i += 1) {
        mapped[i] = [mapped[i][0] + dx, mapped[i][1] + dy];
      }
    }
  }
  const boundaryCheck = side > 0
    ? mapped.every(pt => pt[0] <= x0 + 1e-8)
    : mapped.every(pt => pt[0] >= x0 - 1e-8);
  if (!boundaryCheck) {
    const extreme = side > 0 ? Math.max(...mapped.map(pt => pt[0])) : Math.min(...mapped.map(pt => pt[0]));
    if (Math.abs(tangentUnit[0]) > 1e-9) {
      const corrLocal = (x0 - extreme) / tangentUnit[0];
      for (let i = 0; i < mapped.length; i += 1) {
        mapped[i] = [
          mapped[i][0] + corrLocal * tangentUnit[0],
          mapped[i][1] + corrLocal * tangentUnit[1]
        ];
      }
    } else {
      const adjust = x0 - extreme;
      for (let i = 0; i < mapped.length; i += 1) {
        mapped[i] = [mapped[i][0] + adjust, mapped[i][1]];
      }
    }
  }
  for (let i = 0; i < mapped.length - 1; i += 1) {
    const p = mapped[i];
    const q = mapped[i + 1];
    if (!p || !q) continue;
    const dx = q[0] - p[0];
    const dy = q[1] - p[1];
    if (Math.hypot(dx, dy) < 1e-8) continue;
    segments.push(brd.create('segment', [p, q], style));
  }
  g._br[side] = segments;
}
function updateAllBrackets() {
  for (const g of graphs) {
    if (!g.domain) continue;
    if (Number.isFinite(g.domain.min)) {
      makeBracketAt(g, g.domain.min, -1, !!g.domain.leftClosed);
    }
    if (Number.isFinite(g.domain.max)) {
      makeBracketAt(g, g.domain.max, +1, !!g.domain.rightClosed);
    }
  }
}
function buildCurveLabelContent(fun) {
  var _ADV$curveName, _ADV$curveName2;
  const showName = !!(ADV !== null && ADV !== void 0 && (_ADV$curveName = ADV.curveName) !== null && _ADV$curveName !== void 0 && _ADV$curveName.showName);
  const showExpr = !!(ADV !== null && ADV !== void 0 && (_ADV$curveName2 = ADV.curveName) !== null && _ADV$curveName2 !== void 0 && _ADV$curveName2.showExpression);
  if (!showName && !showExpr) return null;
  const nameTextRaw = typeof (fun === null || fun === void 0 ? void 0 : fun.label) === 'string' ? fun.label : '';
  const exprTextRaw = typeof (fun === null || fun === void 0 ? void 0 : fun.rhs) === 'string' ? fun.rhs : '';
  const nameText = normalizeExpressionText(nameTextRaw);
  const exprText = normalizeExpressionText(exprTextRaw);
  let plain = '';
  if (showName && showExpr) {
    plain = nameText && exprText ? `${nameText} = ${exprText}` : nameText || exprText || '';
  } else if (showName) {
    plain = nameText;
  } else if (showExpr) {
    plain = exprText;
  }
  const nameLatex = showName ? convertExpressionToLatex(nameTextRaw || nameText) : '';
  const exprLatex = showExpr ? convertExpressionToLatex(exprTextRaw || exprText) : '';
  let latex = '';
  if (showName && showExpr) {
    latex = nameLatex && exprLatex ? `${nameLatex} = ${exprLatex}` : nameLatex || exprLatex || '';
  } else if (showName) {
    latex = nameLatex;
  } else if (showExpr) {
    latex = exprLatex;
  }
  if (!plain && !latex) return null;
  const html = latex ? renderLatexToHtml(latex) : '';
  return {
    text: plain || '',
    latex: latex || '',
    html: html || ''
  };
}
function buildFunctions() {
  graphs = [];
  const basePalette = getBaseCurveColors();
  const fallbackColor = normalizeColorValue(getDefaultCurveColor(0)) || '#1F4DE2';
  const palette = resolveCurvePalette(Math.max(basePalette.length, SIMPLE_PARSED.funcs.length || 1));
  SIMPLE_PARSED.funcs.forEach((f, i) => {
    const defaultColor = normalizeColorValue(palette[i % palette.length]) || fallbackColor;
    const manualColor = f && f.colorSource === 'manual' ? normalizeColorValue(f.color) : '';
    const color = manualColor || defaultColor;
    const fn = parseFunctionSpec(`${f.name}(x)=${f.rhs}`);
    const labelContent = buildCurveLabelContent(f);
    const g = {
      name: f.name,
      color,
      manualColor: !!manualColor,
      domain: f.domain || null,
      label: labelContent && labelContent.text || '',
      labelContent,
      expression: f.rhs,
      gliders: []
    };
    g.fn = x => {
      try {
        const y = fn(x);
        return Number.isFinite(y) ? y : NaN;
      } catch (_) {
        return NaN;
      }
    };
    g.segs = [];

    // usynlig "carrier" for glidere – VIKTIG: STRAMT TIL DOMENET
    const xMinCarrier = g.domain ? g.domain.min : () => brd.getBoundingBox()[0];
    const xMaxCarrier = g.domain ? g.domain.max : () => brd.getBoundingBox()[2];
    g.carrier = brd.create('functiongraph', [g.fn, xMinCarrier, xMaxCarrier], {
      visible: false,
      strokeOpacity: 0,
      fixed: true
    });
    graphs.push(g);
    if (labelContent) {
      makeSmartCurveLabel(g, i, labelContent);
    }
  });
  rebuildAllFunctionSegments();
  updateAllBrackets();

  // glidere
  const n = SIMPLE_PARSED.pointsCount | 0;
  if (n > 0 && graphs.length > 0) {
    const firstFunc = SIMPLE_PARSED.funcs && SIMPLE_PARSED.funcs.length ? SIMPLE_PARSED.funcs[0] : null;
    const gliderTemplate = interpretLineTemplate(firstFunc ? firstFunc.rhs : '');
    const shouldEmitLinePointEvents = !!(gliderTemplate && gliderTemplate.kind);
    const gliders = [];
    const emitLinePointUpdate = (options = {}) => {
      if (!shouldEmitLinePointEvents || typeof window === 'undefined' || gliders.length === 0) {
        return;
      }
      const points = [];
      for (const point of gliders) {
        if (!point) {
          return;
        }
        const x = point.X();
        const y = point.Y();
        if (!Number.isFinite(x) || !Number.isFinite(y)) {
          return;
        }
        points.push([x, y]);
      }
      if (!points.length) {
        return;
      }
      const detail = { points };
      if (options.sync === false) {
        detail.sync = false;
      }
      if (options.markEdited === false) {
        detail.markEdited = false;
      }
      window.dispatchEvent(new CustomEvent('graf:linepoints-changed', { detail }));
    };
    const G = graphs[0];
    const sxList = SIMPLE_PARSED.startX && SIMPLE_PARSED.startX.length > 0 ? SIMPLE_PARSED.startX : ADV.points.startX && ADV.points.startX.length > 0 ? ADV.points.startX : [0];
    function stepXg() {
      return (ADV.points.snap.stepX != null ? ADV.points.snap.stepX : +ADV.axis.grid.majorX) || 1;
    }
    const clampToDomain = x => G.domain ? Math.min(G.domain.max, Math.max(G.domain.min, x)) : x;
    const applySnap = P => {
      const xs = clampToDomain(Math.round(P.X() / stepXg()) * stepXg());
      P.moveTo([xs, G.fn(xs)]);
    };
    for (let i = 0; i < n; i++) {
      const xi = sxList[i] != null ? clampToDomain(sxList[i]) : clampToDomain(sxList[0]);
      const P = brd.create('glider', [xi, G.fn(xi), G.carrier], {
        name: '',
        withLabel: true,
        face: 'o',
        size: POINT_MARKER_SIZE,
        strokeColor: G.color,
        fillColor: '#fff',
        showInfobox: false
      });
      gliders.push(P);

      // HARD KLAMMING TIL DOMENE UNDER DRAG
      P.on('drag', () => {
        let x = clampToDomain(P.X());
        P.moveTo([x, G.fn(x)]);
        if (ADV.points.snap.enabled && (ADV.points.snap.mode || 'up') === 'drag') applySnap(P);
        emitLinePointUpdate({ sync: false });
      });
      if (ADV.points.showCoordsOnHover) {
        P.label.setAttribute({
          visible: false
        });
        P.on('over', () => {
          P.label.setText(() => fmtCoordsStatic(P));
          P.label.setAttribute({
            visible: true
          });
        });
        P.on('drag', () => {
          P.label.setText(() => fmtCoordsDrag(P));
          P.label.setAttribute({
            visible: true
          });
        });
        P.on('up', () => {
          P.label.setText(() => fmtCoordsStatic(P));
        });
        P.on('out', () => P.label.setAttribute({
          visible: false
        }));
      }
      if (ADV.points.snap.enabled && (ADV.points.snap.mode || 'up') === 'up') {
        P.on('up', () => {
          applySnap(P);
          emitLinePointUpdate();
        });
      } else {
        P.on('up', () => {
          emitLinePointUpdate();
        });
      }
      if (MODE === 'functions' && ADV.points.guideArrows) {
        brd.create('arrow', [() => [P.X(), P.Y()], () => [0, P.Y()]], {
          strokeColor: '#64748b',
          strokeWidth: 2,
          dash: 2,
          lastArrow: true,
          firstArrow: false,
          fixed: true,
          layer: 10,
          highlight: false
        });
        brd.create('arrow', [() => [P.X(), P.Y()], () => [P.X(), 0]], {
          strokeColor: '#64748b',
          strokeWidth: 2,
          dash: 2,
          lastArrow: true,
          firstArrow: false,
          fixed: true,
          layer: 10,
          highlight: false
        });
      }
    }
    G.gliders = gliders.slice();
    emitLinePointUpdate({ sync: false, markEdited: false });
  }
}

/* =================== LINJE FRA PUNKTER =================== */
function buildPointsLine() {
  var _SIMPLE_PARSED$funcs$;
  graphs = [];
  A = null;
  B = null;
  moving = [];
  const fallbackColor = normalizeColorValue(getDefaultCurveColor(0)) || '#1F4DE2';
  const paletteColor = normalizeColorValue(colorFor(0)) || fallbackColor;
  const first = (_SIMPLE_PARSED$funcs$ = SIMPLE_PARSED.funcs[0]) !== null && _SIMPLE_PARSED$funcs$ !== void 0 ? _SIMPLE_PARSED$funcs$ : {
    rhs: 'ax+b'
  };
  const manualLineColor = first && first.colorSource === 'manual' ? normalizeColorValue(first.color) : '';
  const lineColor = manualLineColor || paletteColor;
  const lineColorManual = !!manualLineColor;
  const template = interpretLineTemplate(first.rhs);
  const kind = template.kind || 'two';
  const anchorC = template.anchorC;
  const slopeM = template.slopeM;
  const start0 = ADV.points.start[0],
    start1 = ADV.points.start[1];
  if (kind === 'two') {
    const P0 = brd.create('point', start0.slice(), {
      name: '',
      size: POINT_MARKER_SIZE,
      face: 'o',
      fillColor: '#fff',
      strokeColor: lineColor,
      withLabel: true,
      showInfobox: false
    });
    const P1 = brd.create('point', start1.slice(), {
      name: '',
      size: POINT_MARKER_SIZE,
      face: 'o',
      fillColor: '#fff',
      strokeColor: lineColor,
      withLabel: true,
      showInfobox: false
    });
    A = P0;
    B = P1;
    moving = [P0, P1];
  } else if (kind === 'anchorY') {
    const F = brd.create('point', [0, anchorC], {
      name: '',
      visible: false,
      fixed: true
    });
    const P = brd.create('point', start0.slice(), {
      name: '',
      size: POINT_MARKER_SIZE,
      face: 'o',
      fillColor: '#fff',
      strokeColor: lineColor,
      withLabel: true,
      showInfobox: false
    });
    A = F;
    B = P;
    moving = [P];
  } else {
    const P = brd.create('point', start0.slice(), {
      name: '',
      size: POINT_MARKER_SIZE,
      face: 'o',
      fillColor: '#fff',
      strokeColor: lineColor,
      withLabel: true,
      showInfobox: false
    });
    const Q = brd.create('point', [() => P.X() + 1, () => P.Y() + slopeM], {
      name: '',
      visible: false,
      fixed: true
    });
    A = P;
    B = Q;
    moving = [P];
  }
  const line = brd.create('line', [A, B], {
    strokeColor: lineColor,
    strokeWidth: 4
  });
  const labelFun = SIMPLE_PARSED.funcs && SIMPLE_PARSED.funcs.length ? SIMPLE_PARSED.funcs[0] : null;
  const labelContent = labelFun ? buildCurveLabelContent(labelFun) : null;
  let updateLabelWithAB = null;
  if (labelContent && labelFun) {
    const templateForLabel = interpretLineTemplate(labelFun.rhs || '');
    if (templateForLabel && templateForLabel.kind === 'two') {
      const baseText = labelContent.text || '';
      const baseLatex = labelContent.latex || '';
      const baseHtml = labelContent.html || '';
      const extractLhs = value => {
        if (typeof value !== 'string') return '';
        const eqIndex = value.indexOf('=');
        if (eqIndex === -1) return '';
        return value.slice(0, eqIndex).trim();
      };
      updateLabelWithAB = () => {
        const shouldShowExpression = !!(ADV.curveName && ADV.curveName.showExpression);
        if (!shouldShowExpression) {
          if (labelContent.text !== baseText || labelContent.latex !== baseLatex || labelContent.html !== baseHtml) {
            labelContent.text = baseText;
            labelContent.latex = baseLatex;
            labelContent.html = baseHtml;
          }
          return;
        }
        const { m, b } = currentMB();
        if (!Number.isFinite(m) || !Number.isFinite(b)) {
          if (labelContent.text !== baseText || labelContent.latex !== baseLatex || labelContent.html !== baseHtml) {
            labelContent.text = baseText;
            labelContent.latex = baseLatex;
            labelContent.html = baseHtml;
          }
          return;
        }
        const normalizedLabel = normalizeExpressionText(labelFun.label || '') || (labelFun.name || '').trim();
        const lhsText = extractLhs(baseText) || normalizedLabel || 'y';
        const latexSource = labelFun.label || labelFun.name || normalizedLabel || 'y';
        const lhsLatex = extractLhs(baseLatex) || convertExpressionToLatex(latexSource) || convertExpressionToLatex('y') || 'y';
        const nextText = formatLineEquation(lhsText, m, b, fracPlain);
        const nextLatex = formatLineEquation(lhsLatex, m, b, fracLatex);
        if (!nextText || !nextLatex) {
          if (labelContent.text !== baseText || labelContent.latex !== baseLatex || labelContent.html !== baseHtml) {
            labelContent.text = baseText;
            labelContent.latex = baseLatex;
            labelContent.html = baseHtml;
          }
          return;
        }
        if (labelContent.text !== nextText || labelContent.latex !== nextLatex) {
          labelContent.text = nextText;
          labelContent.latex = nextLatex;
          labelContent.html = renderLatexToHtml(nextLatex);
        }
      };
      updateLabelWithAB();
    }
  }
  if (labelContent) {
    const g = {
      color: lineColor,
      manualColor: lineColorManual,
      domain: null,
      label: labelContent.text || '',
      labelContent,
      expression: labelFun.rhs || '',
      gliders: Array.isArray(moving) ? moving.slice() : [],
      segs: [line]
    };
    g.fn = x => {
      if (!A || !B || typeof A.X !== 'function' || typeof A.Y !== 'function' || typeof B.X !== 'function' || typeof B.Y !== 'function') {
        return NaN;
      }
      const x1 = A.X();
      const y1 = A.Y();
      const x2 = B.X();
      const y2 = B.Y();
      if (!Number.isFinite(x1) || !Number.isFinite(y1) || !Number.isFinite(x2) || !Number.isFinite(y2)) {
        return NaN;
      }
      const dx = x2 - x1;
      if (Math.abs(dx) < 1e-9) {
        return NaN;
      }
      const m = (y2 - y1) / dx;
      return y1 + m * (x - x1);
    };
    graphs.push(g);
    makeSmartCurveLabel(g, 0, labelContent);
    const refreshLabelPosition = () => {
      if (g && typeof g._repositionLabel === 'function') {
        g._repositionLabel(true);
      }
    };
    if (Array.isArray(moving)) {
      moving.forEach(point => {
        if (!point || typeof point.on !== 'function') return;
        point.on('drag', refreshLabelPosition);
        point.on('up', refreshLabelPosition);
      });
    }
  }
  function stepXv() {
    return (ADV.points.snap.stepX != null ? ADV.points.snap.stepX : +ADV.axis.grid.majorX) || 1;
  }
  function stepYv() {
    return (ADV.points.snap.stepY != null ? ADV.points.snap.stepY : +ADV.axis.grid.majorY) || 1;
  }
  function snap(P) {
    P.moveTo([nearestMultiple(P.X(), stepXv()), nearestMultiple(P.Y(), stepYv())]);
  }
  const emitLinePointUpdate = (options = {}) => {
    if (typeof updateLabelWithAB === 'function') {
      updateLabelWithAB();
    }
    if (typeof window === 'undefined' || !Array.isArray(moving) || moving.length === 0) {
      return;
    }
    const sample = kind === 'two' ? moving : moving.slice(0, 1);
    const points = [];
    for (const point of sample) {
      if (!point) {
        continue;
      }
      const x = point.X();
      const y = point.Y();
      if (!Number.isFinite(x) || !Number.isFinite(y)) {
        return;
      }
      points.push([x, y]);
    }
    if (!points.length) {
      return;
    }
    const detail = { points };
    if (options.sync === false) {
      detail.sync = false;
    }
    if (options.markEdited === false) {
      detail.markEdited = false;
    }
    window.dispatchEvent(new CustomEvent('graf:linepoints-changed', { detail }));
  };
  if (ADV.points.snap.enabled) {
    const mode = ADV.points.snap.mode || 'up';
    for (const P of moving) {
      if (mode === 'drag') P.on('drag', () => snap(P));else P.on('up', () => {
        snap(P);
        if (P.label) P.label.setText(() => fmtCoordsStatic(P));
      });
    }
  }
  if (ADV.points.showCoordsOnHover) {
    for (const P of moving) {
      P.label.setAttribute({
        visible: false
      });
      P.on('over', () => {
        P.label.setText(() => fmtCoordsStatic(P));
        P.label.setAttribute({
          visible: true
        });
      });
      P.on('drag', () => {
        P.label.setText(() => fmtCoordsDrag(P));
        P.label.setAttribute({
          visible: true
        });
      });
      P.on('up', () => {
        P.label.setText(() => fmtCoordsStatic(P));
      });
      P.on('out', () => P.label.setAttribute({
        visible: false
      }));
    }
  }
  if (Array.isArray(moving)) {
    for (const P of moving) {
      P.on('drag', () => emitLinePointUpdate({ sync: false }));
      P.on('up', () => emitLinePointUpdate());
    }
  }
  emitLinePointUpdate({ sync: false, markEdited: false });

}

/* ====== MB fra punktene + tolke fasit-uttrykk robust ====== */
function currentMB() {
  const dx = B.X() - A.X();
  const m = Math.abs(dx) < 1e-12 ? NaN : (B.Y() - A.Y()) / dx;
  const b = Number.isFinite(m) ? A.Y() - m * A.X() : NaN;
  return {
    m,
    b
  };
}
function parseAnswerToMB(answerLine) {
  const rhs = String(answerLine).split('=').slice(1).join('=').trim();
  if (!rhs) return null;
  const fn = parseFunctionSpec(`f(x)=${rhs}`);
  try {
    const b = fn(0);
    const m = fn(1) - b;
    if (!Number.isFinite(m) || !Number.isFinite(b)) return null;
    return {
      m,
      b
    };
  } catch (_) {
    return null;
  }
}

function formatAnswerNumber(value) {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return '';
  }
  return toFixedTrim(value, 6).replace('.', ',');
}

function parseNumericValue(str) {
  if (typeof str !== 'string') return null;
  const cleaned = str.trim();
  if (!cleaned) return null;
  const normalized = cleaned.replace(',', '.');
  if (/^[+-]?\d+\s*\/\s*\d+$/.test(normalized)) {
    const parts = normalized.split('/');
    const numerator = Number.parseFloat(parts[0]);
    const denominator = Number.parseFloat(parts[1]);
    if (!Number.isFinite(numerator) || !Number.isFinite(denominator) || denominator === 0) {
      return null;
    }
    return numerator / denominator;
  }
  const num = Number.parseFloat(normalized);
  return Number.isFinite(num) ? num : null;
}

function parseAssignmentList(answerLine) {
  if (typeof answerLine !== 'string') return null;
  const normalized = answerLine
    .replace(/&&/g, ',')
    .replace(/\b(?:og|and)\b/gi, ',');
  const parts = normalized.split(/[,;]+/).map(part => part.trim()).filter(Boolean);
  if (!parts.length) return null;
  const assignments = [];
  for (const part of parts) {
    const match = part.match(/^([a-zA-Z]\w*)\s*=\s*(.+)$/);
    if (!match) continue;
    const label = match[1];
    const value = parseNumericValue(match[2]);
    if (value == null) continue;
    assignments.push({ label, value });
  }
  if (!assignments.length) return null;
  const slope = assignments.find(item => /^(a|m)$/i.test(item.label)) || null;
  const intercept = assignments.find(item => /^(b|c)$/i.test(item.label)) || null;
  return {
    assignments,
    slope: slope ? { label: slope.label, value: slope.value } : null,
    intercept: intercept ? { label: intercept.label, value: intercept.value } : null
  };
}

function summarizeAssignments(assignments) {
  if (!Array.isArray(assignments) || !assignments.length) {
    return '';
  }
  return assignments
    .map(item => `${item.label} = ${formatAnswerNumber(item.value)}`)
    .join(', ');
}

function parseLineAnswerSpec(answerLine) {
  const trimmed = typeof answerLine === 'string' ? answerLine.trim() : '';
  if (!trimmed) return null;
  const exprSpec = parseAnswerToMB(trimmed);
  if (exprSpec) {
    const summary = normalizeExpressionText(trimmed) || linearStr(exprSpec.m, exprSpec.b);
    return {
      source: 'expression',
      summary,
      slope: { required: true, value: exprSpec.m, label: 'm' },
      intercept: { required: true, value: exprSpec.b, label: 'b' }
    };
  }
  const assignments = parseAssignmentList(trimmed);
  if (assignments) {
    const summary = summarizeAssignments(assignments.assignments);
    const spec = {
      source: 'assignments',
      summary,
      slope: assignments.slope ? { required: true, value: assignments.slope.value, label: assignments.slope.label } : null,
      intercept: assignments.intercept ? { required: true, value: assignments.intercept.value, label: assignments.intercept.label } : null
    };
    if (!spec.slope && !spec.intercept) {
      return null;
    }
    return spec;
  }
  return null;
}

function formatPointList(points) {
  if (!Array.isArray(points)) return '';
  return points.map(pt => formatPointForInput(pt)).filter(Boolean).join('; ');
}

function clampValueToDomain(x, domain) {
  if (typeof x !== 'number' || !Number.isFinite(x)) return NaN;
  if (!domain || typeof domain !== 'object') {
    return x;
  }
  let clamped = x;
  if (Number.isFinite(domain.min) && clamped < domain.min) {
    clamped = domain.min;
  }
  if (Number.isFinite(domain.max) && clamped > domain.max) {
    clamped = domain.max;
  }
  return clamped;
}

function extractGliderAnswerXValues(text) {
  if (typeof text !== 'string') return [];
  const str = text.trim();
  if (!str) return [];
  const entries = [];
  const pairRegex = /\(\s*[^()]*\)/g;
  let match;
  while ((match = pairRegex.exec(str)) !== null) {
    const inner = match[0];
    const numberRegex = /-?\d+(?:[.,]\d+)?/g;
    const numberMatch = numberRegex.exec(inner);
    if (!numberMatch) continue;
    const value = Number.parseFloat(numberMatch[0].replace(',', '.'));
    if (!Number.isFinite(value)) continue;
    entries.push({ index: match.index + numberMatch.index, value });
  }
  const cleaned = str.replace(pairRegex, ' ');
  const numRegex = /-?\d+(?:[.,]\d+)?/g;
  while ((match = numRegex.exec(cleaned)) !== null) {
    const value = Number.parseFloat(match[0].replace(',', '.'));
    if (!Number.isFinite(value)) continue;
    entries.push({ index: match.index, value });
  }
  entries.sort((a, b) => a.index - b.index);
  return entries.map(entry => entry.value).filter(Number.isFinite);
}

function getFunctionGliderPoints(funcIndex) {
  if (!Array.isArray(graphs) || !Number.isInteger(funcIndex) || funcIndex < 0) {
    return [];
  }
  const graph = graphs[funcIndex];
  if (!graph || !Array.isArray(graph.gliders)) {
    return [];
  }
  const points = [];
  for (const glider of graph.gliders) {
    if (!glider) continue;
    const x = typeof glider.X === 'function' ? glider.X() : Number.isFinite(glider.X) ? glider.X : NaN;
    const y = typeof glider.Y === 'function' ? glider.Y() : Number.isFinite(glider.Y) ? glider.Y : NaN;
    if (!Number.isFinite(x) || !Number.isFinite(y)) {
      continue;
    }
    points.push([x, y]);
  }
  return points;
}

function evaluateFunctionGliderAnswer(answerText, rowSpec, index) {
  const funcIndex = rowSpec && Number.isFinite(rowSpec.funcIndex) ? rowSpec.funcIndex : index;
  const funcs = Array.isArray(SIMPLE_PARSED.funcs) ? SIMPLE_PARSED.funcs : [];
  const fun = funcs[funcIndex];
  if (!fun || !fun.rhs) {
    return {
      ok: false,
      type: 'error',
      message: `Funksjon ${index + 1} kan ikke kontrolleres.`
    };
  }
  const gliderPoints = getFunctionGliderPoints(funcIndex);
  if (!gliderPoints.length) {
    return {
      ok: false,
      type: 'error',
      message: `Funksjon ${index + 1} kan ikke kontrolleres.`
    };
  }
  const fnName = fun.name || 'f';
  const evaluator = parseFunctionSpec(`${fnName}(x)=${fun.rhs}`);
  if (typeof evaluator !== 'function') {
    return {
      ok: false,
      type: 'error',
      message: `Kunne ikke tolke fasit for funksjon ${index + 1}.`
    };
  }
  let xs = extractGliderAnswerXValues(answerText);
  if (!xs.length) {
    const points = parsePointListString(answerText);
    if (points.length) {
      xs = points.map(pt => (Array.isArray(pt) && Number.isFinite(pt[0])) ? pt[0] : NaN).filter(Number.isFinite);
    }
  }
  if (!xs.length) {
    return {
      ok: false,
      type: 'error',
      message: `Kunne ikke tolke fasit for funksjon ${index + 1}.`
    };
  }
  const needed = gliderPoints.length;
  if (xs.length < needed) {
    return {
      ok: false,
      type: 'error',
      message: `Kunne ikke tolke fasit for funksjon ${index + 1}.`
    };
  }
  const expectedPoints = [];
  for (let i = 0; i < needed; i++) {
    const rawX = xs[i];
    const x = clampValueToDomain(rawX, fun.domain);
    const y = evaluator(x);
    if (!Number.isFinite(x) || !Number.isFinite(y)) {
      return {
        ok: false,
        type: 'error',
        message: `Kunne ikke tolke fasit for funksjon ${index + 1}.`
      };
    }
    expectedPoints.push([x, y]);
  }
  const actualPoints = gliderPoints.slice(0, needed);
  const expectedStr = formatPointList(expectedPoints);
  const actualStr = formatPointList(actualPoints);
  for (let i = 0; i < needed; i++) {
    if (!pointsRoughlyEqual(expectedPoints[i], actualPoints[i])) {
      return {
        ok: false,
        type: 'error',
        message: `Funksjon ${index + 1} stemmer ikke. Forventet ${expectedStr}. Nå: ${actualStr}.`
      };
    }
  }
  const detail = expectedStr ? `Funksjon ${index + 1}: ${expectedStr}.` : `Funksjon ${index + 1} er riktig.`;
  return {
    ok: true,
    message: detail
  };
}

function evaluateLineAnswer(spec, index) {
  if (typeof currentMB !== 'function') {
    return {
      ok: false,
      type: 'error',
      message: `Funksjon ${index + 1} kan ikke kontrolleres.`
    };
  }
  const { m, b } = currentMB();
  if (!Number.isFinite(m) || !Number.isFinite(b)) {
    return {
      ok: false,
      type: 'error',
      message: `Funksjon ${index + 1} kan ikke kontrolleres.`
    };
  }
  let slopeOk = true;
  if (spec.slope && spec.slope.required) {
    slopeOk = Math.abs(m - spec.slope.value) <= ADV.check.slopeTol;
  }
  let interceptOk = true;
  if (spec.intercept && spec.intercept.required) {
    interceptOk = Math.abs(b - spec.intercept.value) <= ADV.check.interTol;
  }
  if (!slopeOk || !interceptOk) {
    const expected = spec.summary || linearStr(spec.slope ? spec.slope.value : m, spec.intercept ? spec.intercept.value : b);
    return {
      ok: false,
      type: 'error',
      message: `Funksjon ${index + 1} stemmer ikke. Forventet ${expected}. Nå: ${linearStr(m, b)}.`
    };
  }
  const detail = spec.summary ? `Funksjon ${index + 1}: ${spec.summary}.` : `Funksjon ${index + 1} er riktig.`;
  return {
    ok: true,
    message: detail
  };
}

function pointsRoughlyEqual(a, b, tolerance = 1e-3) {
  if (!Array.isArray(a) || !Array.isArray(b) || a.length < 2 || b.length < 2) {
    return false;
  }
  return Math.abs(a[0] - b[0]) <= tolerance && Math.abs(a[1] - b[1]) <= tolerance;
}

function evaluateCoordinateAnswer(expectedPoints, rowSpec, index) {
  if (!Array.isArray(expectedPoints) || !expectedPoints.length) {
    return {
      ok: false,
      type: 'error',
      message: `Punkt ${index + 1} har ingen fasit.`
    };
  }
  const start = rowSpec && Number.isFinite(rowSpec.pointStart) ? rowSpec.pointStart : 0;
  const count = rowSpec && Number.isFinite(rowSpec.pointCount) ? rowSpec.pointCount : expectedPoints.length;
  const actualSource = Array.isArray(SIMPLE_PARSED.extraPoints) ? SIMPLE_PARSED.extraPoints : [];
  const actualPoints = actualSource.slice(start, start + count);
  const expectedStr = formatPointList(expectedPoints);
  const actualStr = formatPointList(actualPoints);
  if (actualPoints.length < expectedPoints.length) {
    return {
      ok: false,
      type: 'error',
      message: `Punkt ${index + 1} stemmer ikke. Forventet ${expectedStr}. Nå: ${actualStr}.`
    };
  }
  for (let i = 0; i < expectedPoints.length; i++) {
    if (!pointsRoughlyEqual(expectedPoints[i], actualPoints[i])) {
      return {
        ok: false,
        type: 'error',
        message: `Punkt ${index + 1} stemmer ikke. Forventet ${expectedStr}. Nå: ${actualStr}.`
      };
    }
  }
  return {
    ok: true,
    message: `Punkt ${index + 1}: ${expectedStr}.`
  };
}

function evaluateAnswerForRow(answer, index) {
  const trimmed = typeof answer === 'string' ? answer.trim() : '';
  if (!trimmed) {
    return { ok: true, message: '' };
  }
  const rows = Array.isArray(SIMPLE_PARSED.rows) ? SIMPLE_PARSED.rows : [];
  const rowSpec = rows[index] || null;
  if (rowSpec && rowSpec.type === 'function') {
    if (MODE === 'points') {
      const spec = parseLineAnswerSpec(trimmed);
      if (!spec) {
        return {
          ok: false,
          type: 'error',
          message: `Kunne ikke tolke fasit for funksjon ${index + 1}.`
        };
      }
      return evaluateLineAnswer(spec, index);
    }
    return evaluateFunctionGliderAnswer(trimmed, rowSpec, index);
  }
  if (rowSpec && rowSpec.type === 'coords') {
    const expected = parsePointListString(trimmed);
    if (!expected.length) {
      return {
        ok: false,
        type: 'error',
        message: `Kunne ikke tolke fasit for punkt ${index + 1}.`
      };
    }
    return evaluateCoordinateAnswer(expected, rowSpec, index);
  }
  const fallbackPoints = parsePointListString(trimmed);
  if (fallbackPoints.length) {
    return evaluateCoordinateAnswer(fallbackPoints, rowSpec, index);
  }
  if (MODE === 'points') {
    const spec = parseLineAnswerSpec(trimmed);
    if (spec) {
      return evaluateLineAnswer(spec, index);
    }
  }
  return {
    ok: false,
    type: 'error',
    message: `Fasit for rad ${index + 1} er ikke støttet.`
  };
}

function evaluateAnswers() {
  const answers = Array.isArray(SIMPLE_PARSED.answers) ? SIMPLE_PARSED.answers : [];
  const messages = [];
  for (let i = 0; i < answers.length; i++) {
    const answer = answers[i];
    if (!answer || !String(answer).trim()) {
      continue;
    }
    const evaluation = evaluateAnswerForRow(answer, i);
    if (!evaluation) {
      return {
        ok: false,
        type: 'error',
        message: 'Kunne ikke tolke fasit.'
      };
    }
    if (!evaluation.ok) {
      return evaluation;
    }
    if (evaluation.message) {
      messages.push(evaluation.message.trim());
    }
  }
  return {
    ok: true,
    details: messages.join(' ').trim()
  };
}

function evaluateDescriptionInputs() {
  if (typeof window === 'undefined') return;
  const mv = window.mathVisuals;
  if (!mv || typeof mv.evaluateTaskInputs !== 'function') return;
  try {
    mv.evaluateTaskInputs();
  } catch (_) {}
}

function setupTaskCheck() {
  const answers = Array.isArray(SIMPLE_PARSED.answers) ? SIMPLE_PARSED.answers : [];
  const hasAnswers = answers.some(answer => typeof answer === 'string' && answer.trim());
  if (!hasAnswers) {
    hideCheckControls();
    return;
  }
  const controls = ensureCheckControls();
  if (!controls) return;
  const { btn, msg, setStatus } = controls;
  if (btn) {
    btn.style.display = '';
  }
  if (msg) {
    msg.style.display = '';
  }
  setStatus('info', '');
  if (btn) {
    btn.onclick = () => {
      evaluateDescriptionInputs();
      const result = evaluateAnswers();
      if (!result) {
        setStatus('error', 'Kunne ikke tolke fasit.');
        return;
      }
      if (result.ok) {
        const suffix = result.details ? ` ${result.details}` : '';
        setStatus('success', `Riktig!${suffix}`);
      } else {
        const statusType = result.type === 'info' ? 'info' : 'error';
        setStatus(statusType, result.message || 'Ikke helt.');
      }
    };
  }
}
function formatPointCoordinateForInput(value, step) {
  if (typeof value !== 'number' || !Number.isFinite(value)) return '';
  if (Number.isFinite(step) && step > 0) {
    return fmtSmartVal(value, step);
  }
  return toFixedTrim(value, ADV.points.decimals);
}
function formatPointForInput(pt) {
  if (!Array.isArray(pt) || pt.length < 2) return '';
  const [x, y] = pt;
  if (!Number.isFinite(x) || !Number.isFinite(y)) return '';
  const formattedX = formatPointCoordinateForInput(x, stepX());
  const formattedY = formatPointCoordinateForInput(y, stepY());
  if (!formattedX || !formattedY) return '';
  return `(${formattedX}, ${formattedY})`;
}
function formatExtraPointsForInput(points) {
  if (!Array.isArray(points)) return '';
  return points.map(formatPointForInput).filter(Boolean).join('; ');
}
function updateCoordsInputFromPoints(points, options = {}) {
  if (typeof document === 'undefined') return;
  const { triggerInput = false, triggerChange = false } = options;
  const firstGroup = document.querySelector('.func-group[data-index="1"]');
  if (!firstGroup) return;
  const input = firstGroup.querySelector('[data-fun]');
  if (!input) return;
  const nextValue = formatExtraPointsForInput(points);
  let currentValue = '';
  if ('value' in input) {
    currentValue = input.value != null ? String(input.value) : '';
  } else if (typeof input.textContent === 'string') {
    currentValue = input.textContent;
  }
  if (nextValue === currentValue) {
    if (triggerInput || triggerChange) {
      if (triggerInput) {
        input.dispatchEvent(new Event('input', { bubbles: true }));
      }
      if (triggerChange) {
        input.dispatchEvent(new Event('change', { bubbles: true }));
      }
    }
    return;
  }
  const tag = input.tagName ? input.tagName.toUpperCase() : '';
  if (tag === 'MATH-FIELD' && typeof input.setValue === 'function') {
    try {
      input.setValue(nextValue, { format: 'ascii-math' });
    } catch (_) {
      if ('value' in input) {
        input.value = nextValue;
      }
    }
  } else if ('value' in input) {
    input.value = nextValue;
  } else {
    input.textContent = nextValue;
  }
  if (triggerInput) {
    input.dispatchEvent(new Event('input', { bubbles: true }));
  }
  if (triggerChange) {
    input.dispatchEvent(new Event('change', { bubbles: true }));
  }
}
function addFixedPoints() {
  if (!Array.isArray(SIMPLE_PARSED.extraPoints)) return;
  const markerList = Array.isArray(SIMPLE_PARSED.pointMarkers) && SIMPLE_PARSED.pointMarkers.length
    ? SIMPLE_PARSED.pointMarkers
    : parsePointMarkerList(ADV.points.marker);
  SIMPLE_PARSED.extraPoints.forEach((pt, idx) => {
    const pointOptions = {
      name: '',
      size: POINT_MARKER_SIZE,
      face: 'o',
      fillColor: '#fff',
      strokeColor: '#111827',
      withLabel: true,
      fixed: !!ADV.points.lockExtraPoints,
      showInfobox: false
    };
    const markerCandidate = markerValueForIndex(markerList, idx);
    const markerValue = sanitizePointMarkerValue(markerCandidate);
    const useCustomMarker = !isDefaultPointMarker(markerValue);
    if (useCustomMarker) {
      pointOptions.strokeOpacity = 0;
      pointOptions.fillOpacity = 0;
    }
    const P = brd.create('point', pt.slice(), pointOptions);
    if (useCustomMarker) {
      brd.create('text', [() => P.X(), () => P.Y(), markerValue], {
        anchorX: 'middle',
        anchorY: 'middle',
        fontSize: 24,
        strokeColor: '#111827',
        fixed: true,
        layer: 9
      });
    }
    if (ADV.points.showCoordsOnHover) {
      P.label.setAttribute({
        visible: false
      });
      P.on('over', () => {
        P.label.setText(() => fmtCoordsStatic(P));
        P.label.setAttribute({
          visible: true
        });
      });
      P.on('out', () => P.label.setAttribute({
        visible: false
      }));
    }
    if (!ADV.points.lockExtraPoints) {
      const updatePointState = commit => {
        if (!Array.isArray(SIMPLE_PARSED.extraPoints)) return;
        const x = typeof P.X === 'function' ? P.X() : NaN;
        const y = typeof P.Y === 'function' ? P.Y() : NaN;
        if (!Number.isFinite(x) || !Number.isFinite(y)) return;
        SIMPLE_PARSED.extraPoints[idx] = [x, y];
        updateCoordsInputFromPoints(SIMPLE_PARSED.extraPoints, {
          triggerInput: true,
          triggerChange: !!commit
        });
      };
      const snapMode = ADV.points.snap.mode || 'up';
      const snapEnabled = !!ADV.points.snap.enabled;
      const shouldSnapOnDrag = snapEnabled && snapMode === 'drag';
      const shouldSnapOnUp = snapEnabled && snapMode !== 'drag';
      const applySnap = () => {
        const x = nearestMultiple(P.X(), stepX());
        const y = nearestMultiple(P.Y(), stepY());
        P.moveTo([x, y]);
      };
      P.on('drag', () => {
        if (shouldSnapOnDrag) {
          applySnap();
        }
        updatePointState(false);
      });
      P.on('up', () => {
        if (shouldSnapOnUp) {
          applySnap();
        }
        updatePointState(true);
      });
    }
  });
}

/* ================= bygg valgt modus ================= */
function hideCheckControls() {
  const btn = document.getElementById('btnCheck');
  const msg = document.getElementById('checkMsg');
  if (btn) {
    btn.style.display = 'none';
    btn.onclick = null;
  }
  if (msg) {
    msg.style.display = 'none';
    msg.textContent = '';
    msg.className = 'status status--info';
  }
}

/* ================= Oppdater / resize ================= */
function updateAfterViewChange() {
  if (!brd) return;
  enforceAspectStrict();
  applyTickSettings();
  if (ADV.axis.forceIntegers) {
    rebuildGrid();
  }
  placeAxisNames();
  updateAxisArrows();
  if (MODE === 'functions') {
    rebuildAllFunctionSegments();
    updateAllBrackets();
  }
  if (brd && typeof brd.getBoundingBox === 'function') {
    const bb = brd.getBoundingBox();
    const screen = fromBoundingBox(bb);
    if (screen) {
      const manualActive = Array.isArray(ADV.screen) && ADV.screen.length === 4;
      rememberScreenState(screen, manualActive ? 'manual' : 'auto');
    }
  }
}
function rebuildAll() {
  syncSimpleFromWindow();
  if (typeof window !== 'undefined') {
    window.SIMPLE = SIMPLE;
  }
  if (typeof SIMPLE !== 'string') {
    SIMPLE = SIMPLE == null ? '' : String(SIMPLE);
  }
  SIMPLE_PARSED = parseSimple(SIMPLE);
  applyLinePointStart(SIMPLE_PARSED);
  {
    const markerList = Array.isArray(SIMPLE_PARSED.pointMarkers)
      ? SIMPLE_PARSED.pointMarkers.map(sanitizePointMarkerValue).filter(Boolean)
      : [];
    const markerFromList = markerList.length ? formatPointMarkerList(markerList) : SIMPLE_PARSED.pointMarker;
    const normalizedMarker = normalizePointMarkerValue(markerFromList);
    ADV.points.markerList = markerList.slice();
    ADV.points.marker = !normalizedMarker || isDefaultPointMarker(normalizedMarker)
      ? DEFAULT_POINT_MARKER
      : normalizedMarker;
  }
  ADV.points.lockExtraPoints = SIMPLE_PARSED && SIMPLE_PARSED.lockExtraPoints === false ? false : true;
  MODE = decideMode(SIMPLE_PARSED);
  hideCheckControls();
  destroyBoard();
  ADV.axis.forceIntegers = FORCE_TICKS_REQUESTED;
  FORCE_TICKS_LOCKED_FALSE = false;
  const plannedScreen = initialScreen();
  if (shouldLockForceTicks(plannedScreen)) {
    FORCE_TICKS_LOCKED_FALSE = true;
    ADV.axis.forceIntegers = false;
  }
  START_SCREEN = plannedScreen;
  initBoard();
  if (!brd) {
    LAST_RENDERED_SIMPLE = SIMPLE;
    return;
  }
  if (MODE === 'functions') {
    buildFunctions();
  } else {
    buildPointsLine();
  }
  addFixedPoints();
  brd.on('boundingbox', updateAfterViewChange);
  updateAfterViewChange();
  setupTaskCheck();
  applyAltTextToBoard();
  refreshAltText('rebuild');
  LAST_RENDERED_SIMPLE = SIMPLE;
}
window.addEventListener('resize', () => {
  const jxg = getJXG();
  const resizeBoards = jxg && jxg.JSXGraph && typeof jxg.JSXGraph.resizeBoards === 'function' ? jxg.JSXGraph.resizeBoards : null;
  if (typeof resizeBoards === 'function') {
    resizeBoards();
  } else if (brd && typeof brd.resizeContainer === 'function') {
    var _brd$containerObj, _brd$containerObj2;
    const cw = (_brd$containerObj = brd.containerObj) === null || _brd$containerObj === void 0 ? void 0 : _brd$containerObj.clientWidth;
    const ch = (_brd$containerObj2 = brd.containerObj) === null || _brd$containerObj2 === void 0 ? void 0 : _brd$containerObj2.clientHeight;
    if (cw && ch) {
      brd.resizeContainer(cw, ch);
      brd.update();
    }
  }
  updateAfterViewChange();
});
if (typeof window !== 'undefined' && typeof window.addEventListener === 'function') {
  window.addEventListener('message', event => {
    const data = event && event.data;
    const type = typeof data === 'string' ? data : data && data.type;
    if (type !== 'math-visuals:profile-change') return;
    applyThemeToDocument();
    updateCurveColorsFromTheme();
    updateAxisThemeStyling();
    refreshFunctionColorDefaults();
  });
  window.addEventListener('math-visuals:settings-changed', () => {
    const thickness = getDefaultLineThickness();
    ADV.axis.style.width = thickness;
    ADV.domainMarkers.width = thickness;
    applyThemeToDocument();
    updateCurveColorsFromTheme();
    refreshFunctionColorDefaults();
    requestRebuild();
  });
}
function requestRebuild() {
  cancelScheduledSimpleRebuild();
  whenJXGReady(() => {
    rebuildAll();
  });
}
requestRebuild();
if (typeof window !== 'undefined') {
  window.render = requestRebuild;
}

/* ====== Sjekk-knapp + status (monteres i #checkArea i HTML) ====== */
function ensureCheckControls() {
  const host = document.getElementById('checkArea') || document.body;
  let btn = document.getElementById('btnCheck');
  let msg = document.getElementById('checkMsg');
  if (!btn) {
    btn = document.createElement('button');
    btn.id = 'btnCheck';
    btn.textContent = 'Sjekk svar';
    btn.className = 'btn btn--task-check';
    btn.type = 'button';
    host.appendChild(btn);
  }
  if (!msg) {
    msg = document.createElement('div');
    msg.id = 'checkMsg';
    msg.className = 'status status--info';
    msg.textContent = '';
    host.appendChild(msg);
  }
  applyAppModeToTaskCheckHost(getCurrentAppMode() || 'task');
  const setStatus = (type, text) => {
    let normalized = 'info';
    if (type === 'success') {
      normalized = 'success';
    } else if (type === 'error') {
      normalized = 'error';
    } else if (type === 'info') {
      normalized = 'info';
    }
    msg.className = `status status--${normalized}`;
    msg.textContent = text || '';
  };
  return {
    btn,
    msg,
    setStatus
  };
}

const taskCheckHost = typeof document !== 'undefined' ? document.querySelector('[data-task-check-host]') : null;

function ensureTaskCheckHostChildren() {
  if (!taskCheckHost) return;
  const btn = document.getElementById('btnCheck');
  const msg = document.getElementById('checkMsg');
  if (btn && btn.parentElement !== taskCheckHost) {
    taskCheckHost.appendChild(btn);
  }
  if (msg && msg.parentElement !== taskCheckHost) {
    taskCheckHost.appendChild(msg);
  }
}

function applyAppModeToTaskCheckHost(mode) {
  if (!taskCheckHost) return;
  const normalized = typeof mode === 'string' ? mode.toLowerCase() : '';
  const isTaskMode = normalized === 'task';
  if (isTaskMode) {
    ensureTaskCheckHostChildren();
    taskCheckHost.hidden = false;
    const btn = document.getElementById('btnCheck');
    const msg = document.getElementById('checkMsg');
    if (btn) {
      btn.hidden = false;
      if (btn.dataset) delete btn.dataset.prevHidden;
    }
    if (msg) {
      if (msg.dataset && 'prevHidden' in msg.dataset) {
        const wasHidden = msg.dataset.prevHidden === '1';
        delete msg.dataset.prevHidden;
        msg.hidden = wasHidden;
      }
    }
  } else {
    taskCheckHost.hidden = true;
    const btn = document.getElementById('btnCheck');
    const msg = document.getElementById('checkMsg');
    if (btn) {
      if (btn.dataset) {
        btn.dataset.prevHidden = btn.hidden ? '1' : '0';
      }
      btn.hidden = true;
    }
    if (msg) {
      if (msg.dataset) {
        msg.dataset.prevHidden = msg.hidden ? '1' : '0';
      }
      msg.hidden = true;
    }
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

applyAppModeToTaskCheckHost(getCurrentAppMode() || 'task');

if (typeof window !== 'undefined' && typeof window.addEventListener === 'function') {
  window.addEventListener('math-visuals:app-mode-changed', event => {
    if (!event) return;
    const detail = event.detail;
    if (!detail || typeof detail.mode !== 'string') return;
    applyAppModeToTaskCheckHost(detail.mode);
  });
}
function extractInlineStyleValue(styleString, properties) {
  if (!styleString || typeof styleString !== 'string') return null;
  const normalized = Array.isArray(properties) ? properties : [properties];
  for (const property of normalized) {
    if (!property) continue;
    const pattern = property.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(`${pattern}\\s*:\\s*([^;]+)`, 'i');
    const match = styleString.match(regex);
    if (match && match[1]) {
      return match[1].trim();
    }
  }
  return null;
}

function sanitizeSvgForeignObjects(svgNode) {
  if (!svgNode || typeof svgNode.querySelectorAll !== 'function') return;
  const doc = svgNode.ownerDocument || (typeof document !== 'undefined' ? document : null);
  const nodes = Array.from(svgNode.querySelectorAll('foreignObject'));
  if (!doc || typeof doc.createElementNS !== 'function') {
    nodes.forEach(node => node.remove());
    return;
  }
  nodes.forEach(node => {
    const parent = node.parentNode;
    if (!parent) return;
    const textContent = (node.textContent || '').trim();
    if (!textContent) {
      parent.removeChild(node);
      return;
    }
    const replacement = doc.createElementNS('http://www.w3.org/2000/svg', 'text');
    const xAttr = node.getAttribute('x');
    const yAttr = node.getAttribute('y');
    if (xAttr != null) replacement.setAttribute('x', xAttr);
    if (yAttr != null) replacement.setAttribute('y', yAttr);
    replacement.setAttribute('dominant-baseline', 'text-before-edge');
    replacement.setAttribute('font-family', 'Inter, "Segoe UI", system-ui, sans-serif');
    const styleSources = [node.getAttribute('style') || ''];
    if (node.firstElementChild && typeof node.firstElementChild.getAttribute === 'function') {
      styleSources.push(node.firstElementChild.getAttribute('style') || '');
    }
    const colorValue = styleSources.reduce((acc, style) => acc || extractInlineStyleValue(style, ['color', '--graf-axis-label-text']), null);
    if (colorValue) {
      replacement.setAttribute('fill', colorValue);
    } else {
      replacement.setAttribute('fill', '#111827');
    }
    const fontSizeValue = styleSources.reduce((acc, style) => acc || extractInlineStyleValue(style, ['font-size', '--graf-axis-label-font-size']), null);
    if (fontSizeValue) {
      replacement.setAttribute('font-size', fontSizeValue);
    }
    replacement.textContent = textContent;
    parent.replaceChild(replacement, node);
  });
}

function cloneBoardSvgRoot() {
  if (!brd || !brd.renderer || !brd.renderer.svgRoot) return null;
  const width = brd.canvasWidth;
  const height = brd.canvasHeight;
  const node = brd.renderer.svgRoot.cloneNode(true);
  node.removeAttribute('style');
  node.setAttribute('width', `${width}`);
  node.setAttribute('height', `${height}`);
  node.setAttribute('viewBox', `0 0 ${width} ${height}`);
  node.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
  node.setAttribute('xmlns:xlink', 'http://www.w3.org/1999/xlink');
  sanitizeSvgForeignObjects(node);
  const helper = typeof window !== 'undefined' ? window.MathVisSvgExport : null;
  if (helper && typeof helper.ensureSvgBackground === 'function') {
    helper.ensureSvgBackground(node, {
      bounds: { minX: 0, minY: 0, width, height }
    });
  } else if (typeof document !== 'undefined') {
    const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
    rect.setAttribute('x', '0');
    rect.setAttribute('y', '0');
    rect.setAttribute('width', String(width));
    rect.setAttribute('height', String(height));
    rect.setAttribute('fill', '#ffffff');
    node.insertBefore(rect, node.firstChild);
  }
  return { node, width, height };
}
function serializeBoardSvg(clone) {
  if (!clone || !clone.node) return '';
  return new XMLSerializer().serializeToString(clone.node).replace(/\swidth="[^"]*"\s(?=.*width=")/, ' ').replace(/\sheight="[^"]*"\s(?=.*height=")/, ' ');
}
function buildBoardSvgExport() {
  applyAltTextToBoard();
  const clone = cloneBoardSvgRoot();
  if (!clone) return null;
  return {
    markup: serializeBoardSvg(clone),
    width: clone.width,
    height: clone.height,
    node: clone.node,
    altText: getCurrentAltText()
  };
}
const btnSvg = document.getElementById('btnSvg');
if (btnSvg) {
  btnSvg.addEventListener('click', () => {
    const svgExport = buildBoardSvgExport();
    if (!svgExport || !svgExport.markup) return;
    const helper = typeof window !== 'undefined' ? window.MathVisSvgExport : null;
    const suggestedName = 'graf.svg';
    if (helper && typeof helper.exportSvgWithArchive === 'function') {
      helper.exportSvgWithArchive(svgExport.node, suggestedName, 'graftegner', {
        svgString: svgExport.markup,
        alt: svgExport.altText,
        description: svgExport.altText
      });
      return;
    }
    const blob = new Blob([svgExport.markup], {
      type: 'image/svg+xml;charset=utf-8'
    });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = suggestedName;
    a.click();
    URL.revokeObjectURL(a.href);
  });
}
const btnPng = document.getElementById('btnPng');
if (btnPng) {
  btnPng.addEventListener('click', () => {
    const svgExport = buildBoardSvgExport();
    if (!svgExport || !svgExport.markup) return;
    const svgBlob = new Blob([svgExport.markup], {
      type: 'image/svg+xml;charset=utf-8'
    });
    const url = URL.createObjectURL(svgBlob);
    const img = new Image();
    img.onload = () => {
    const canvas = document.createElement('canvas');
    const helper = typeof window !== 'undefined' ? window.MathVisSvgExport : null;
    const sizing = helper && typeof helper.ensureMinimumPngDimensions === 'function'
      ? helper.ensureMinimumPngDimensions({ width: svgExport.width, height: svgExport.height })
      : (() => {
          const minDimension = 100;
          const safeWidth = Number.isFinite(svgExport.width) && svgExport.width > 0 ? svgExport.width : minDimension;
          const safeHeight = Number.isFinite(svgExport.height) && svgExport.height > 0 ? svgExport.height : minDimension;
          return {
            width: Math.max(minDimension, Math.round(safeWidth)),
            height: Math.max(minDimension, Math.round(safeHeight))
          };
        })();
    canvas.width = sizing.width;
    canvas.height = sizing.height;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      URL.revokeObjectURL(url);
      canvas.toBlob(blob => {
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = 'graf.png';
        a.click();
        URL.revokeObjectURL(a.href);
      });
    };
    img.src = url;
  });
}
setupSettingsForm();
initAltTextManager();
let refreshFunctionColorDefaults = () => {};
function setupSettingsForm() {
  const root = document.querySelector('.settings');
  if (!root) return;
  const funcRows = document.getElementById('funcRows');
  let addBtn = document.getElementById('addFunc');
  if (!addBtn) {
    addBtn = document.createElement('button');
    addBtn.id = 'addFunc';
  }
  addBtn.type = 'button';
  addBtn.textContent = '+';
  addBtn.setAttribute('aria-label', 'Legg til funksjon');
  addBtn.setAttribute('data-edit-only', '');
  addBtn.classList.remove('btn');
  addBtn.classList.add('addFigureBtn');
  const functionActions = document.querySelector('.func-actions');
  const functionsHost = functionActions || document.querySelector('.function-controls');
  if (functionsHost && addBtn.parentElement !== functionsHost) {
    functionsHost.appendChild(addBtn);
  }
  const g = id => document.getElementById(id);
  const showNamesInput = g('cfgShowNames');
  const showExprInput = g('cfgShowExpr');
  const showAxisNumbersInput = g('cfgShowAxisNumbers');
  const showGridInput = g('cfgShowGrid');
  const forceTicksInput = g('cfgForceTicks');
  const screenInput = g('cfgScreen');
  const axisXInputElement = g('cfgAxisX');
  const axisYInputElement = g('cfgAxisY');
  const snapCheckbox = g('cfgSnap');
  let gliderSection = null;
  let gliderCountInput = null;
  let gliderStartInput = null;
  let gliderStartLabel = null;
  let glidersVisible = false;
  let forcedGliderCount = null;
  let linePointSection = null;
  let linePointInputs = [];
  let linePointLabels = [];
  let linePointVisibleCount = 0;
  let linePointsEdited = false;
  let queueSimpleFormUpdate = null;
  let scheduleSimpleFormChange = () => {};
  let flushSimpleFormChange = () => {};
  const pointMarkerControls = [];
  let pointLockControl = null;
  let pointLockEnabled = !(SIMPLE_PARSED && SIMPLE_PARSED.lockExtraPoints === false);
  ADV.points.lockExtraPoints = pointLockEnabled;
  const functionColorControls = [];
  let answerControl = null;
  const DEFAULT_COLOR_FALLBACK = normalizeColorValue(getDefaultCurveColor(0)) || '#1F4DE2';
  const getRowIndex = row => {
    if (!row || !row.dataset) return 1;
    const parsed = Number.parseInt(row.dataset.index, 10);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : 1;
  };
  const computeDefaultColorForIndex = index => normalizeColorValue(colorFor(index - 1)) || DEFAULT_COLOR_FALLBACK;
  const applyColorManualClass = (row, manual) => {
    if (!row || !row.classList) return;
    if (manual) {
      row.classList.add('func-group--color-manual');
    } else {
      row.classList.remove('func-group--color-manual');
    }
  };
  const registerFunctionColorControl = (row, input, options = {}) => {
    if (!row || !input) return null;
    const index = getRowIndex(row);
    const providedDefault = normalizeColorValue(options.defaultColor);
    const manualColor = normalizeColorValue(options.manualColor);
    const control = {
      row,
      input,
      defaultColor: providedDefault || computeDefaultColorForIndex(index),
      value: '',
      manual: false
    };
    if (!control.defaultColor) {
      control.defaultColor = computeDefaultColorForIndex(index);
    }
    if (options.manual && manualColor) {
      control.manual = true;
      control.value = manualColor;
    } else if (manualColor && manualColor !== control.defaultColor) {
      control.manual = true;
      control.value = manualColor;
    } else {
      control.manual = false;
      control.value = control.defaultColor;
    }
    if (!control.value) {
      control.value = control.defaultColor || DEFAULT_COLOR_FALLBACK;
    }
    input.value = control.value;
    applyColorManualClass(row, control.manual);
    const handleColorInput = event => {
      const normalized = normalizeColorValue(input.value);
      if (normalized) {
        input.value = normalized;
      }
      const nextValue = normalized || control.defaultColor || DEFAULT_COLOR_FALLBACK;
      if (normalized && control.defaultColor && normalized === control.defaultColor) {
        control.manual = false;
        control.value = control.defaultColor;
        input.value = control.defaultColor;
      } else if (normalized) {
        control.manual = true;
        control.value = normalized;
      } else {
        control.manual = false;
        control.value = control.defaultColor || DEFAULT_COLOR_FALLBACK;
        input.value = control.value;
      }
      applyColorManualClass(row, control.manual);
      if (event && event.type === 'change') {
        flushSimpleFormChange();
      } else {
        scheduleSimpleFormChange();
      }
    };
    input.addEventListener('input', handleColorInput);
    input.addEventListener('change', handleColorInput);
    functionColorControls.push(control);
    return control;
  };
  const clearFunctionColorControls = () => {
    functionColorControls.length = 0;
  };
  const getFunctionColorInfoForRow = row => {
    const control = functionColorControls.find(entry => entry && entry.row === row);
    if (!control) {
      return {
        manual: false,
        value: '',
        defaultColor: computeDefaultColorForIndex(getRowIndex(row))
      };
    }
    return {
      manual: !!control.manual,
      value: control.manual ? control.value : '',
      defaultColor: control.defaultColor || computeDefaultColorForIndex(getRowIndex(row))
    };
  };
  let refreshFunctionColorDefaultsLocal = () => {
    functionColorControls.forEach(control => {
      if (!control || !control.row) return;
      const nextDefault = computeDefaultColorForIndex(getRowIndex(control.row));
      control.defaultColor = nextDefault || control.defaultColor || DEFAULT_COLOR_FALLBACK;
      if (!control.manual) {
        control.value = control.defaultColor || DEFAULT_COLOR_FALLBACK;
        control.input.value = control.value;
      }
      applyColorManualClass(control.row, control.manual);
    });
  };
  let pointMarkerValue = DEFAULT_POINT_MARKER;
  const MATHFIELD_TAG = 'MATH-FIELD';
  const nav = typeof navigator !== 'undefined' ? navigator : null;
  const hasTouchSupport = typeof window !== 'undefined' && (
    'ontouchstart' in window ||
    (nav && (nav.maxTouchPoints > 0 || nav.msMaxTouchPoints > 0))
  );
  const hasCoarsePointer = typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(pointer: coarse)').matches;
  const enableVirtualKeyboard = hasTouchSupport || hasCoarsePointer;
  const mathFieldKeyboardMode = enableVirtualKeyboard ? 'onfocus' : 'off';
  const mathFieldKeyboardAttr = `virtual-keyboard-mode="${mathFieldKeyboardMode}"`;
  const COMMAND_NAME_MAP = {
    cdot: '*',
    times: '*',
    div: '/',
    pm: '+/-',
    minus: '-',
    pi: 'pi',
    tau: 'tau',
    theta: 'theta',
    alpha: 'alpha',
    beta: 'beta',
    gamma: 'gamma',
    phi: 'phi',
    degree: 'deg',
    log: 'log',
    ln: 'ln',
    sin: 'sin',
    cos: 'cos',
    tan: 'tan',
    asin: 'asin',
    acos: 'acos',
    atan: 'atan',
    sinh: 'sinh',
    cosh: 'cosh',
    tanh: 'tanh',
    exp: 'exp',
    abs: 'abs',
    max: 'max',
    min: 'min',
    floor: 'floor',
    ceil: 'ceil',
    round: 'round'
  };
  const tryGetMathFieldValue = (field, format) => {
    if (!field || typeof field.getValue !== 'function') return '';
    try {
      const value = field.getValue(format);
      return typeof value === 'string' ? value : '';
    } catch (_) {
      return '';
    }
  };
  const readGroup = (str, startIdx) => {
    if (typeof str !== 'string' || startIdx == null || startIdx < 0 || startIdx >= str.length) {
      return ['', typeof startIdx === 'number' ? startIdx : 0];
    }
    if (str[startIdx] !== '{') {
      return ['', startIdx];
    }
    let depth = 0;
    for (let i = startIdx + 1; i < str.length; i++) {
      const ch = str[i];
      if (ch === '{') {
        depth++;
        continue;
      }
      if (ch === '}') {
        if (depth === 0) {
          return [str.slice(startIdx + 1, i), i + 1];
        }
        depth--;
      }
    }
    return [str.slice(startIdx + 1), str.length];
  };
  const replaceLatexFractions = str => {
    if (typeof str !== 'string' || !str.includes('\\frac')) {
      return typeof str === 'string' ? str : '';
    }
    let out = '';
    let idx = 0;
    while (idx < str.length) {
      const start = str.indexOf('\\frac', idx);
      if (start === -1) {
        out += str.slice(idx);
        break;
      }
      out += str.slice(idx, start);
      let pos = start + 5;
      while (pos < str.length && /\s/.test(str[pos])) pos++;
      let numerator = '';
      let denominator = '';
      if (pos < str.length && str[pos] === '{') {
        const group = readGroup(str, pos);
        numerator = replaceLatexFractions(group[0]);
        pos = group[1];
      }
      while (pos < str.length && /\s/.test(str[pos])) pos++;
      if (pos < str.length && str[pos] === '{') {
        const group = readGroup(str, pos);
        denominator = replaceLatexFractions(group[0]);
        pos = group[1];
      }
      out += `(${numerator})/(${denominator})`;
      idx = pos;
    }
    return out;
  };
  const replaceLatexSqrt = str => {
    if (typeof str !== 'string' || !str.includes('\\sqrt')) {
      return typeof str === 'string' ? str : '';
    }
    let out = '';
    let idx = 0;
    while (idx < str.length) {
      const start = str.indexOf('\\sqrt', idx);
      if (start === -1) {
        out += str.slice(idx);
        break;
      }
      out += str.slice(idx, start);
      let pos = start + 5;
      while (pos < str.length && /\s/.test(str[pos])) pos++;
      let radicand = '';
      if (pos < str.length && str[pos] === '{') {
        const group = readGroup(str, pos);
        radicand = replaceLatexSqrt(replaceLatexFractions(group[0]));
        pos = group[1];
      }
      out += `sqrt(${radicand})`;
      idx = pos;
    }
    return out;
  };
  const convertLatexLikeToPlain = latex => {
    if (typeof latex !== 'string') return '';
    let str = latex;
    str = str.replace(/\\left|\\right/g, '');
    str = str.replace(/\\!/g, '');
    str = str.replace(/\\,/g, '');
    str = str.replace(/\\;/g, ' ');
    str = str.replace(/~|\\:/g, ' ');
    str = str.replace(/\\\\/g, '\n');
    str = replaceLatexFractions(str);
    str = replaceLatexSqrt(str);
    str = str.replace(/\\operatorname\{([^{}]+)\}/gi, '$1');
    str = str.replace(/\\([a-zA-Z]+)\b/g, (match, name) => {
      const key = name.toLowerCase();
      return COMMAND_NAME_MAP[key] != null ? COMMAND_NAME_MAP[key] : name;
    });
    str = str.replace(/\\([a-zA-Z]+)/g, (match, name) => {
      const key = name.toLowerCase();
      return COMMAND_NAME_MAP[key] != null ? COMMAND_NAME_MAP[key] : name;
    });
    str = str.replace(/\\([{}])/g, '$1');
    str = str.replace(/\\%/g, '%');
    str = str.replace(/\\#/g, '#');
    str = str.replace(/\\&/g, '&');
    str = str.replace(/\\_/g, '_');
    str = str.replace(/\\\^/g, '^');
    str = str.replace(/\^\{([^{}]+)\}/g, '^($1)');
    str = str.replace(/_\{([^{}]+)\}/g, '_($1)');
    str = str.replace(/\^\(([^()]+)\)/g, '^$1');
    str = str.replace(/_\(([^()]+)\)/g, '_$1');
    str = str.replace(/[{}]/g, '');
    return str;
  };
  const replaceAsciiFractions = str => {
    if (typeof str !== 'string' || !str.toLowerCase().includes('frac(')) {
      return typeof str === 'string' ? str : '';
    }
    let out = str;
    let idx = out.toLowerCase().indexOf('frac(');
    while (idx !== -1) {
      let pos = idx + 5;
      let depth = 0;
      let comma = -1;
      for (let i = pos; i < out.length; i++) {
        const ch = out[i];
        if (ch === '(') {
          depth++;
        } else if (ch === ')') {
          if (depth === 0) break;
          depth--;
        } else if (ch === ',' && depth === 0) {
          comma = i;
          break;
        }
      }
      if (comma === -1) break;
      depth = 0;
      let end = -1;
      for (let i = comma + 1; i < out.length; i++) {
        const ch = out[i];
        if (ch === '(') {
          depth++;
        } else if (ch === ')') {
          if (depth === 0) {
            end = i;
            break;
          }
          depth--;
        }
      }
      if (end === -1) break;
      const numerator = replaceAsciiFractions(out.slice(idx + 5, comma).trim());
      const denominator = replaceAsciiFractions(out.slice(comma + 1, end).trim());
      out = `${out.slice(0, idx)}(${numerator})/(${denominator})${out.slice(end + 1)}`;
      idx = out.toLowerCase().indexOf('frac(');
    }
    return out;
  };
  const convertAsciiMathLikeToPlain = ascii => {
    if (typeof ascii !== 'string') return '';
    let str = ascii;
    str = replaceAsciiFractions(str);
    str = str.replace(/·|⋅/g, '*');
    str = str.replace(/÷/g, '/');
    str = str.replace(/−/g, '-');
    // MathLive inserts invisible operators when exporting ASCIIMath
    //   U+2062 INVISIBLE TIMES is used for implicit multiplication (2⁢x → 2*x)
    //   U+2061 INVISIBLE FUNCTION APPLICATION (sin⁡(x)) should simply be removed
    //   U+2063 INVISIBLE SEPARATOR and U+2064 INVISIBLE PLUS may also appear
    str = str.replace(/\u2062/g, '*');
    str = str.replace(/[\u2061\u2063\u2064]/g, '');
    str = str.replace(/\*\*/g, '^');
    str = str.replace(/\bsqrt\s*\(/gi, 'sqrt(');
    str = str.replace(/\bpi\b/gi, 'pi');
    str = str.replace(/\btau\b/gi, 'tau');
    return str;
  };
  const normalizePlainExpression = value => {
    if (value == null) return '';
    const raw = collapseExpressionWhitespace(String(value));
    if (!raw) return '';
    if (raw.includes('\\')) {
      return collapseExpressionWhitespace(convertLatexLikeToPlain(raw));
    }
    return collapseExpressionWhitespace(convertAsciiMathLikeToPlain(raw));
  };
  const getFunctionInputValue = element => {
    if (!element) return '';
    const tag = element.tagName ? element.tagName.toUpperCase() : '';
    if (tag === MATHFIELD_TAG) {
      let plain = tryGetMathFieldValue(element, 'ascii-math');
      if (!plain) {
        plain = tryGetMathFieldValue(element, 'ASCIIMath');
      }
      if (!plain) {
        plain = tryGetMathFieldValue(element, 'latex');
        if (plain) {
          plain = convertLatexLikeToPlain(plain);
        }
      }
      if (!plain && typeof element.value === 'string') {
        plain = element.value;
      }
      return normalizePlainExpression(plain);
    }
    const val = element.value != null ? element.value : '';
    return normalizePlainExpression(val);
  };
  const updateFunctionPreview = element => {
    if (!element) return;
    const editor = element.closest ? element.closest('.func-editor') : null;
    if (!editor) return;
    const preview = editor.querySelector('[data-fun-preview]');
    if (!preview) return;
    const tag = element.tagName ? element.tagName.toUpperCase() : '';
    const previewLayout = editor ? editor.getAttribute('data-preview-layout') : '';
    const allowMathFieldPreview = tag === MATHFIELD_TAG && previewLayout === 'below';
    if (tag === MATHFIELD_TAG && isMathLiveReady() && !allowMathFieldPreview) {
      preview.innerHTML = '';
      preview.textContent = '';
      preview.classList.remove('func-preview--latex', 'func-preview--text');
      preview.classList.add('func-preview--empty');
      preview.setAttribute('data-mode', 'empty');
      updateFunctionPreviewAccessibility(editor, preview);
      return;
    }
    const value = getFunctionInputValue(element);
    const allowLatex = !preview.hasAttribute('data-preview-no-latex');
    const latex = allowLatex ? convertExpressionToLatex(value) : '';
    const html = allowLatex && latex ? renderLatexToHtml(latex) : '';
    const plain = normalizeExpressionText(value);
    preview.innerHTML = '';
    preview.textContent = '';
    preview.classList.remove('func-preview--latex', 'func-preview--text', 'func-preview--empty');
    preview.removeAttribute('data-mode');
    if (html) {
      preview.innerHTML = html;
      preview.classList.add('func-preview--latex');
      preview.setAttribute('data-mode', 'latex');
    } else if (plain) {
      preview.textContent = plain;
      preview.classList.add('func-preview--text');
      preview.setAttribute('data-mode', 'text');
    } else {
      preview.classList.add('func-preview--empty');
      preview.setAttribute('data-mode', 'empty');
    }
    updateFunctionPreviewAccessibility(editor, preview);
  };
  const updateFunctionPreviewAccessibility = (editor, preview) => {
    if (!editor || !preview) return;
    const isPreviewMode = editor.getAttribute('data-editor-mode') === 'preview';
    const isEmpty = preview.classList.contains('func-preview--empty');
    if (isPreviewMode && !isEmpty) {
      preview.setAttribute('aria-hidden', 'false');
      preview.tabIndex = 0;
    } else {
      preview.setAttribute('aria-hidden', 'true');
      preview.tabIndex = -1;
    }
  };
  const setFunctionEditorMode = (element, mode) => {
    if (!element) return;
    const editor = element.closest ? element.closest('.func-editor') : null;
    if (!editor) return;
    const preview = editor.querySelector('[data-fun-preview]');
    const desired = mode === 'preview' ? 'preview' : 'edit';
    const effective = desired === 'preview' && preview && preview.classList.contains('func-preview--empty') ? 'edit' : desired;
    editor.setAttribute('data-editor-mode', effective);
    updateFunctionPreviewAccessibility(editor, preview);
  };
  const getMathFieldConstructor = () => {
    if (typeof window === 'undefined') return null;
    if (window.customElements && typeof window.customElements.get === 'function') {
      const defined = window.customElements.get('math-field');
      if (defined) {
        return defined;
      }
    }
    if (typeof window.MathfieldElement !== 'undefined') {
      return window.MathfieldElement;
    }
    return null;
  };
  const isMathLiveReady = () => {
    const ctor = getMathFieldConstructor();
    if (!ctor || !ctor.prototype) {
      return false;
    }
    return (
      typeof ctor.prototype.getValue === 'function' &&
      typeof ctor.prototype.setValue === 'function'
    );
  };
  const MATHLIVE_READY_QUEUE = [];
  let mathLiveReadyHandled = false;
  let mathLiveReadyPromise = null;
  const getMathLiveReadyPromise = () => {
    if (mathLiveReadyPromise) {
      return mathLiveReadyPromise;
    }
    if (typeof window !== 'undefined' && window.customElements && typeof window.customElements.whenDefined === 'function') {
      mathLiveReadyPromise = window.customElements.whenDefined('math-field').catch(() => {});
    } else if (typeof Promise !== 'undefined') {
      mathLiveReadyPromise = Promise.resolve();
    }
    return mathLiveReadyPromise;
  };
  const flushMathLiveReadyQueue = () => {
    if (mathLiveReadyHandled) return;
    if (!isMathLiveReady()) {
      if (typeof window !== 'undefined' && typeof window.setTimeout === 'function') {
        window.setTimeout(flushMathLiveReadyQueue, 50);
      }
      return;
    }
    mathLiveReadyHandled = true;
    while (MATHLIVE_READY_QUEUE.length) {
      const cb = MATHLIVE_READY_QUEUE.shift();
      if (typeof cb === 'function') {
        try {
          cb();
        } catch (_) {}
      }
    }
  };
  const whenMathLiveReady = callback => {
    if (typeof callback !== 'function') return;
    if (isMathLiveReady()) {
      callback();
      return;
    }
    MATHLIVE_READY_QUEUE.push(callback);
    const readyPromise = getMathLiveReadyPromise();
    if (readyPromise && typeof readyPromise.then === 'function') {
      readyPromise.then(() => {
        if (typeof window !== 'undefined' && window.setTimeout) {
          window.setTimeout(flushMathLiveReadyQueue, 0);
        } else {
          flushMathLiveReadyQueue();
        }
      }).catch(() => {});
    }
  };
  const ensureMathFieldOptions = field => {
    const apply = () => {
      if (field && typeof field.setOptions === 'function') {
        field.setOptions({
          smartMode: false,
          virtualKeyboardMode: 'off'
        });
      }
    };
    if (isMathLiveReady()) {
      apply();
      return;
    }
    whenMathLiveReady(apply);
  };
  const createFunctionFallbackInput = source => {
    const input = document.createElement('input');
    input.type = 'text';
    input.className = source && source.className ? source.className : 'func-math-field';
    input.setAttribute('data-fun', '');
    input.autocomplete = 'off';
    input.spellcheck = false;
    if (source) {
      const placeholder = source.getAttribute('placeholder');
      const ariaLabel = source.getAttribute('aria-label');
      const existingValue = source.hasAttribute('value') ? source.getAttribute('value') : source.textContent;
      if (placeholder) {
        input.setAttribute('placeholder', placeholder);
      }
      if (ariaLabel) {
        input.setAttribute('aria-label', ariaLabel);
      }
      if (existingValue) {
        input.value = existingValue;
      }
    }
    return input;
  };
  const ensureFunctionInputElement = element => {
    if (!element) return element;
    const tag = element.tagName ? element.tagName.toUpperCase() : '';
    if (tag === MATHFIELD_TAG) {
      const fallback = createFunctionFallbackInput(element);
      element.replaceWith(fallback);
      return fallback;
    }
    return element;
  };
  const setFunctionInputValue = (element, value) => {
    if (!element) return;
    const str = value != null ? String(value) : '';
    const tag = element.tagName ? element.tagName.toUpperCase() : '';
    if (tag === MATHFIELD_TAG) {
      const applyValue = () => {
        if (!element || !element.isConnected) return;
        ensureMathFieldOptions(element);
        if (typeof element.setValue === 'function') {
          try {
            element.setValue(str, { format: 'ascii-math' });
            updateFunctionPreview(element);
            setFunctionEditorMode(element, normalizePlainExpression(str) ? 'preview' : 'edit');
            return;
          } catch (_) {
            try {
              const latexValue = convertExpressionToLatex(str);
              element.setValue(latexValue, { format: 'latex' });
              updateFunctionPreview(element);
              setFunctionEditorMode(element, normalizePlainExpression(str) ? 'preview' : 'edit');
              return;
            } catch (_) {}
          }
        }
        const latex = convertExpressionToLatex(str);
        if ('value' in element) {
          element.value = latex;
        } else {
          element.setAttribute('value', latex);
        }
        updateFunctionPreview(element);
        setFunctionEditorMode(element, normalizePlainExpression(str) ? 'preview' : 'edit');
      };
      if (!isMathLiveReady() || typeof element.setValue !== 'function') {
        const latex = convertExpressionToLatex(str);
        if ('value' in element) {
          element.value = latex;
        } else {
          element.setAttribute('value', latex);
        }
        updateFunctionPreview(element);
        whenMathLiveReady(applyValue);
        setFunctionEditorMode(element, normalizePlainExpression(str) ? 'preview' : 'edit');
        return;
      }
      applyValue();
      return;
    }
    element.value = str;
    updateFunctionPreview(element);
    setFunctionEditorMode(element, normalizePlainExpression(str) ? 'preview' : 'edit');
  };
  const isCoords = str => /^\s*(?:\(\s*-?\d+(?:\.\d+)?\s*,\s*-?\d+(?:\.\d+)?\s*\)|-?\d+(?:\.\d+)?\s*,\s*-?\d+(?:\.\d+)?)(?:\s*;\s*(?:\(\s*-?\d+(?:\.\d+)?\s*,\s*-?\d+(?:\.\d+)?\s*\)|-?\d+(?:\.\d+)?\s*,\s*-?\d+(?:\.\d+)?))*\s*$/.test(str);
  const isExplicitFun = str => {
    const m = str.match(/^[a-zA-Z]\w*\s*\(\s*x\s*\)\s*=\s*(.+)$/) || str.match(/^y\s*=\s*(.+)$/i);
    const rhs = m ? m[1] : str;
    if (!/x/.test(rhs)) return false;
    return isExplicitRHS(rhs);
  };
  const getFirstFunctionValue = () => {
    if (!funcRows) return '';
    const firstGroup = funcRows.querySelector('.func-group');
    const firstRowInput = firstGroup ? firstGroup.querySelector('[data-fun]') : null;
    return firstRowInput ? getFunctionInputValue(firstRowInput) : '';
  };
  const getPointMarkerInputValue = () => normalizePointMarkerValue(pointMarkerValue) || '';
  const setPointMarkerInputValue = value => {
    const normalized = normalizePointMarkerValue(value);
    pointMarkerValue = normalized || DEFAULT_POINT_MARKER;
    pointMarkerControls.forEach(control => {
      if (!control || !control.input) return;
      control.input.value = normalized || DEFAULT_POINT_MARKER;
    });
  };
  const syncPointMarkerValueFromInput = input => {
    if (!input) return;
    const normalized = normalizePointMarkerValue(input.value);
    pointMarkerValue = normalized || DEFAULT_POINT_MARKER;
    const displayValue = normalized || DEFAULT_POINT_MARKER;
    pointMarkerControls.forEach(control => {
      if (!control || !control.input) return;
      if (control.input === input) {
        if (control.input.value !== displayValue) {
          control.input.value = displayValue;
        }
        return;
      }
      control.input.value = displayValue;
    });
  };
  const getPointMarkerValueForExport = () => {
    const normalized = normalizePointMarkerValue(pointMarkerValue);
    return normalized && !isDefaultPointMarker(normalized) ? normalized : '';
  };
  const updatePointLockVisibility = () => {
    if (!pointLockControl) return;
    const { container, checkbox } = pointLockControl;
    const firstGroup = funcRows ? funcRows.querySelector('.func-group[data-index="1"]') : null;
    const funInput = firstGroup ? firstGroup.querySelector('[data-fun]') : null;
    const value = funInput ? getFunctionInputValue(funInput) : '';
    const show = !!value && isCoords(value);
    if (container) {
      container.style.display = show ? '' : 'none';
    }
    if (checkbox) {
      checkbox.disabled = !show;
      if (show) {
        checkbox.checked = !!pointLockEnabled;
      }
    }
  };
  const updatePointMarkerVisibility = () => {
    pointMarkerControls.forEach(control => {
      if (!control || !control.row) return;
      const funInput = control.row.querySelector('[data-fun]');
      const value = funInput ? getFunctionInputValue(funInput) : '';
      const show = !!value && isCoords(value);
      if (control.container) {
        control.container.style.display = show ? '' : 'none';
      }
      if (control.input) {
        control.input.disabled = !show;
      }
    });
    updatePointLockVisibility();
  };
  const determineForcedGliderCount = value => {
    if (!value) return null;
    const match = value.match(/^[a-zA-Z]\w*\s*\(\s*x\s*\)\s*=\s*(.+)$/) || value.match(/^y\s*=\s*(.+)$/i);
    const rhs = (match ? match[1] : value).trim();
    if (!rhs) return null;
    const normalized = rhs.replace(/\s+/g, '').toLowerCase();
    const hasA = /(^|[+\-*/(])a(?=\*?x(?![a-z]))/.test(normalized);
    const hasB = /(^|[+\-])b(?![a-z])(?!\*|x)/.test(normalized);
    if (hasA && hasB) return 2;
    if (hasA || hasB) return 1;
    return null;
  };
  const formatNumber = (val, step = null) => {
    if (typeof val !== 'number') return '';
    if (!Number.isFinite(val)) return '';
    if (Number.isFinite(step) && step > 0) {
      return fmtSmartVal(val, step);
    }
    return toFixedTrim(val, ADV.points.decimals);
  };
  const parseStartXValues = value => {
    if (!value) return [];
    const text = String(value);
    const entries = [];
    const pairRegex = /\(\s*-?\d+(?:[.,]\d+)?(?:\s*,\s*-?\d+(?:[.,]\d+)?)?\s*\)/g;
    let match;
    while ((match = pairRegex.exec(text)) !== null) {
      const inner = match[0];
      const numberRegex = /-?\d+(?:[.,]\d+)?/g;
      const numberMatch = numberRegex.exec(inner);
      if (numberMatch) {
        const num = Number.parseFloat(numberMatch[0].replace(',', '.'));
        if (Number.isFinite(num)) {
          entries.push({ index: match.index + numberMatch.index, value: num });
        }
      }
    }
    const cleaned = text.replace(pairRegex, ' ');
    const numRegex = /-?\d+(?:[.,]\d+)?/g;
    while ((match = numRegex.exec(cleaned)) !== null) {
      const num = Number.parseFloat(match[0].replace(',', '.'));
      if (Number.isFinite(num)) {
        entries.push({ index: match.index, value: num });
      }
    }
    entries.sort((a, b) => a.index - b.index);
    return entries.map(entry => entry.value);
  };
  const getPrimaryFunctionEvaluator = () => {
    const value = getFirstFunctionValue();
    if (!value || !isExplicitFun(value)) {
      return null;
    }
    let main = value;
    const domMatch = main.match(/,?\s*x\s*(?:in|∈)\s*.+$/i);
    if (domMatch) {
      main = main.slice(0, domMatch.index).trim();
    }
    const fnMatch = main.match(/^([a-zA-Z]\w*)\s*\(\s*x\s*\)\s*=\s*(.+)$/);
    let spec;
    if (fnMatch) {
      spec = `${fnMatch[1]}(x)=${fnMatch[2]}`;
    } else {
      const yMatch = main.match(/^y\s*=\s*(.+)$/i);
      if (!yMatch) return null;
      spec = `f(x)=${yMatch[1]}`;
    }
    const evaluator = parseFunctionSpec(spec);
    return typeof evaluator === 'function' ? evaluator : null;
  };
  const formatGliderStartDisplay = xValues => {
    if (!Array.isArray(xValues) || !xValues.length) return '';
    const sx = stepX();
    const parts = [];
    xValues.forEach(raw => {
      if (!Number.isFinite(raw)) return;
      const formattedX = formatNumber(raw, sx);
      if (formattedX) {
        parts.push(`x=${formattedX}`);
      }
    });
    if (!parts.length) return '';
    return parts.join(', ');
  };
  const setGliderStartInputValues = values => {
    if (!gliderStartInput) return;
    const nums = Array.isArray(values) ? values.filter(Number.isFinite) : [];
    if (nums.length) {
      const display = formatGliderStartDisplay(nums);
      if (display) {
        gliderStartInput.value = display;
        return;
      }
      gliderStartInput.value = nums.map(val => formatNumber(val, stepX())).join(', ');
      return;
    }
    gliderStartInput.value = 'x=1';
  };
  const refreshGliderStartInputDisplay = () => {
    if (!gliderStartInput) return;
    const values = parseStartXValues(gliderStartInput.value || '');
    if (!values.length) return;
    setGliderStartInputValues(values);
  };
  const applyGliderStartValues = rawValues => {
    const numbers = Array.isArray(rawValues) ? rawValues.filter(Number.isFinite) : [];
    const primary = MODE === 'functions' && Array.isArray(graphs) && graphs.length > 0 ? graphs[0] : null;
    const domain = primary && primary.domain ? primary.domain : null;
    const clampValue = val => {
      if (!Number.isFinite(val)) return val;
      let next = val;
      if (domain) {
        if (Number.isFinite(domain.min) && next < domain.min) {
          next = domain.min;
        }
        if (Number.isFinite(domain.max) && next > domain.max) {
          next = domain.max;
        }
      }
      return next;
    };
    const clampedNumbers = numbers.map(clampValue);
    if (SIMPLE_PARSED && typeof SIMPLE_PARSED === 'object') {
      SIMPLE_PARSED.startX = clampedNumbers.slice();
    }
    ADV.points.startX = clampedNumbers.slice();
    if (primary && Array.isArray(primary.gliders) && primary.gliders.length > 0) {
      const gliders = primary.gliders;
      const fallback = clampedNumbers.length ? clampedNumbers[0] : null;
      let moved = false;
      for (let i = 0; i < gliders.length; i++) {
        const glider = gliders[i];
        if (!glider) continue;
        const targetX = clampedNumbers[i] != null ? clampedNumbers[i] : fallback;
        if (!Number.isFinite(targetX)) continue;
        const fnY = typeof primary.fn === 'function' ? primary.fn(targetX) : NaN;
        if (!Number.isFinite(fnY) || typeof glider.moveTo !== 'function') {
          continue;
        }
        try {
          let moveNeeded = true;
          if (typeof glider.X === 'function' && typeof glider.Y === 'function') {
            const currentX = glider.X();
            const currentY = glider.Y();
            if (Number.isFinite(currentX) && Number.isFinite(currentY)) {
              const EPS = 1e-9;
              moveNeeded = Math.abs(currentX - targetX) > EPS || Math.abs(currentY - fnY) > EPS;
            }
          }
          if (moveNeeded) {
            glider.moveTo([targetX, fnY]);
            moved = true;
            if (glider.label && typeof glider.label.setText === 'function') {
              glider.label.setText(() => fmtCoordsStatic(glider));
            }
          }
        } catch (_) {}
      }
      if (moved && brd && typeof brd.update === 'function') {
        brd.update();
      }
    }
    return clampedNumbers;
  };
  const handleGliderStartInputChange = () => {
    scheduleSimpleFormChange();
  };
  const handleGliderStartInputCommit = () => {
    if (!gliderStartInput) {
      flushSimpleFormChange();
      return;
    }
    const values = parseStartXValues(gliderStartInput.value || '');
    const applied = applyGliderStartValues(values);
    if (applied.length) {
      setGliderStartInputValues(applied);
    }
    flushSimpleFormChange();
  };
  const attachGliderStartInputListeners = () => {
    if (!gliderStartInput) return;
    if (gliderStartInput.__grafStartListenersAttached) return;
    gliderStartInput.addEventListener('input', handleGliderStartInputChange);
    gliderStartInput.addEventListener('change', handleGliderStartInputCommit);
    gliderStartInput.addEventListener('blur', handleGliderStartInputCommit);
    gliderStartInput.__grafStartListenersAttached = true;
  };
  const parseLinePointInput = value => {
    if (!value) return null;
    const matches = String(value).match(/-?\d+(?:[.,]\d+)?/g);
    if (!matches || matches.length < 2) return null;
    const nums = matches.slice(0, 2).map(str => Number.parseFloat(str.replace(',', '.')));
    if (!nums.every(Number.isFinite)) return null;
    return nums;
  };
  const formatPointInputValue = pt => {
    if (!Array.isArray(pt) || pt.length < 2) {
      return '';
    }
    const [x, y] = pt;
    if (!Number.isFinite(x) || !Number.isFinite(y)) {
      return '';
    }
    return `(${formatNumber(x, stepX())}, ${formatNumber(y, stepY())})`;
  };
  const setLinePointInputValues = points => {
    if (!Array.isArray(points)) return;
    linePointInputs.forEach((input, idx) => {
      if (!input) return;
      const pt = points[idx];
      input.value = formatPointInputValue(pt);
    });
  };
    const applyLinePointValues = (points, spec) => {
      if (!Array.isArray(points) || !points.length) {
        return false;
      }
      const clones = points
        .map(pt => (Array.isArray(pt) ? pt.slice(0, 2) : null))
        .filter(pt => Array.isArray(pt) && pt.length === 2 && pt.every(Number.isFinite));
      if (!clones.length) {
        return false;
      }
      const xValues = clones.map(pt => pt[0]).filter(Number.isFinite);
      if (SIMPLE_PARSED && typeof SIMPLE_PARSED === 'object') {
        SIMPLE_PARSED.linePoints = clones.map(pt => pt.slice());
        if (xValues.length) {
          SIMPLE_PARSED.startX = xValues.slice();
        }
      }
      if (Array.isArray(ADV.points.start)) {
        for (let i = 0; i < clones.length && i < ADV.points.start.length; i++) {
          ADV.points.start[i] = clones[i].slice();
        }
      }
      if (xValues.length) {
        ADV.points.startX = xValues.slice();
      }
      if (MODE === 'points' && brd && Array.isArray(moving) && moving.length) {
        const resolvedSpec = spec || getLineTemplateSpec();
        const kind = resolvedSpec && resolvedSpec.kind ? resolvedSpec.kind : null;
        const moveTargets = kind === 'two' ? clones : [clones[0]];
        const limit = Math.min(moveTargets.length, moving.length);
        for (let i = 0; i < limit; i++) {
          const point = moving[i];
          const target = kind === 'two' ? moveTargets[i] : moveTargets[0];
          if (!point || !Array.isArray(target)) continue;
          const [tx, ty] = target;
          if (!Number.isFinite(tx) || !Number.isFinite(ty)) continue;
          if (typeof point.moveTo === 'function') {
            let moveNeeded = true;
            if (typeof point.X === 'function' && typeof point.Y === 'function') {
              const currentX = point.X();
              const currentY = point.Y();
              if (Number.isFinite(currentX) && Number.isFinite(currentY)) {
                const EPS = 1e-9;
                moveNeeded = Math.abs(currentX - tx) > EPS || Math.abs(currentY - ty) > EPS;
              }
            }
            if (moveNeeded) {
              try {
                point.moveTo([tx, ty]);
                if (point.label && typeof point.label.setText === 'function') {
                  point.label.setText(() => fmtCoordsStatic(point));
                }
              } catch (_) {
                // ignore move errors
              }
            }
          }
        }
        if (typeof brd.update === 'function') {
          brd.update();
        }
      } else if (MODE === 'functions' && Array.isArray(graphs) && graphs.length > 0) {
        const resolvedSpec = spec || getLineTemplateSpec();
        const targetPoints = resolvedSpec && resolvedSpec.kind === 'two' ? clones : [clones[0]];
        const primary = graphs[0];
        if (primary && Array.isArray(primary.gliders) && primary.gliders.length) {
          const domain = primary.domain || null;
          const gliders = primary.gliders;
          const limit = Math.min(targetPoints.length, gliders.length);
          for (let i = 0; i < limit; i++) {
            const glider = gliders[i];
            const target = targetPoints[i];
            if (!glider || !Array.isArray(target)) continue;
            const rawX = target[0];
            if (!Number.isFinite(rawX)) continue;
            let clampedX = rawX;
            if (domain) {
              if (Number.isFinite(domain.min) && clampedX < domain.min) {
                clampedX = domain.min;
              }
              if (Number.isFinite(domain.max) && clampedX > domain.max) {
                clampedX = domain.max;
              }
            }
            const fnY = typeof primary.fn === 'function' ? primary.fn(clampedX) : NaN;
            if (!Number.isFinite(fnY) || typeof glider.moveTo !== 'function') {
              continue;
            }
            try {
              glider.moveTo([clampedX, fnY]);
              if (glider.label && typeof glider.label.setText === 'function') {
                glider.label.setText(() => fmtCoordsStatic(glider));
              }
            } catch (_) {}
          }
          if (brd && typeof brd.update === 'function') {
            brd.update();
          }
        }
      }
      return true;
    };
  const syncLinePointsToBoardFromInputs = () => {
    const spec = getLineTemplateSpec();
    const needed = getLinePointCount(spec);
    if (needed <= 0) {
      return false;
    }
    const values = getLinePointsFromInputs(needed);
    if (values.length !== needed) {
      return false;
    }
    return applyLinePointValues(values, spec);
  };
  const formatLinePoints = points => points.map(pt => formatPointInputValue(pt)).filter(Boolean).join('; ');
  const getLinePointsFromInputs = needed => {
    if (!Array.isArray(linePointInputs) || linePointInputs.length === 0 || needed <= 0) return [];
    const limit = Math.min(needed, linePointInputs.length);
    const pts = [];
    for (let i = 0; i < limit; i++) {
      const input = linePointInputs[i];
      if (!input) return [];
      const parsed = parseLinePointInput(input.value);
      if (!parsed) return [];
      pts.push(parsed);
    }
    return pts;
  };
  const gatherLinePointsForExport = needed => {
    if (needed <= 0) return [];
    const direct = getLinePointsFromInputs(needed);
    if (direct.length === needed) {
      return direct;
    }
    if (Array.isArray(SIMPLE_PARSED.linePoints) && SIMPLE_PARSED.linePoints.length >= needed) {
      const fallback = [];
      for (let i = 0; i < needed; i++) {
        const src = SIMPLE_PARSED.linePoints[i];
        if (!isValidPointArray(src)) return [];
        fallback.push([src[0], src[1]]);
      }
      return fallback;
    }
    return [];
  };
  const getLineTemplateSpec = () => interpretLineTemplateFromExpression(getFirstFunctionValue());
  const getLinePointCount = spec => spec && spec.kind ? spec.kind === 'two' ? 2 : 1 : 0;
  const getGliderCount = () => {
    if (!gliderCountInput) return 0;
    const n = Number.parseInt(gliderCountInput.value, 10);
    if (!Number.isFinite(n)) return 0;
    const clamped = Math.max(0, Math.min(2, n));
    return clamped > 0 ? clamped : 0;
  };
  const shouldEnableGliders = () => {
    const value = getFirstFunctionValue();
    if (!value) return false;
    if (isCoords(value)) return false;
    if (isExplicitFun(value)) return true;
    const forced = determineForcedGliderCount(value);
    return forced != null && forced > 0;
  };
  const shouldShowStartInput = () => {
    if (!gliderStartInput) return false;
    if (!shouldEnableGliders()) return false;
    const spec = getLineTemplateSpec();
    if (getLinePointCount(spec) !== 0) {
      return false;
    }
    return getGliderCount() > 0;
  };
  const hasConfiguredPoints = () => {
    const parsedMode = SIMPLE_PARSED ? decideMode(SIMPLE_PARSED) : 'functions';
    if (parsedMode === 'points') {
      return true;
    }
    const firstValue = getFirstFunctionValue();
    if (firstValue && isCoords(firstValue)) {
      return true;
    }
    if (shouldEnableGliders() && getGliderCount() > 0) {
      return true;
    }
    if (firstValue && !isCoords(firstValue) && !isExplicitFun(firstValue)) {
      return true;
    }
    const parsedCount = SIMPLE_PARSED && Number.isFinite(SIMPLE_PARSED.pointsCount) ? SIMPLE_PARSED.pointsCount : 0;
    if (parsedCount > 0) {
      return true;
    }
    const parsedExtraPoints = SIMPLE_PARSED && Array.isArray(SIMPLE_PARSED.extraPoints)
      ? SIMPLE_PARSED.extraPoints.length
      : 0;
    if (parsedExtraPoints > 0) {
      return true;
    }
    return false;
  };
  const updateSnapAvailability = () => {
    if (!snapCheckbox) return;
    const hasPoints = hasConfiguredPoints();
    snapCheckbox.disabled = !hasPoints;
    if (!hasPoints) {
      snapCheckbox.title = 'Aktiveres når punkter er lagt til.';
    } else {
      snapCheckbox.removeAttribute('title');
    }
  };
  function placeAnswerField(position) {
    if (!answerControl || !answerControl.label) return;
    if (answerControl.currentPlacement === position) return;
    const { label } = answerControl;
    const group = label.closest('.func-group');
    let { secondaryRow, mainRow } = answerControl;
    if (!secondaryRow || !secondaryRow.isConnected) {
      secondaryRow = group ? group.querySelector('.func-row--secondary') : null;
      answerControl.secondaryRow = secondaryRow;
    }
    if (!mainRow || !mainRow.isConnected) {
      mainRow = group ? group.querySelector('.func-row--main') : null;
      answerControl.mainRow = mainRow;
    }
    let domainLabel = answerControl.domainLabel;
    if (!domainLabel || !domainLabel.parentElement) {
      domainLabel = group ? group.querySelector('label.domain') : null;
      answerControl.domainLabel = domainLabel;
    }
    let gliderRow = answerControl.gliderRow;
    if (!gliderRow || !gliderRow.parentElement) {
      gliderRow = group ? group.querySelector('.glider-row') : null;
      answerControl.gliderRow = gliderRow;
    }
    const answerInput = label.querySelector('input[data-answer]');
    if (position === 'hidden') {
      if (answerInput) {
        answerInput.disabled = true;
      }
      label.classList.remove('func-answer--inline', 'func-answer--glider');
      label.style.display = 'none';
      if (secondaryRow) {
        secondaryRow.style.display = 'none';
        secondaryRow.appendChild(label);
      } else if (mainRow) {
        mainRow.appendChild(label);
      }
      answerControl.currentPlacement = position;
      return;
    }
    if (answerInput) {
      answerInput.disabled = false;
    }
    label.style.display = '';
    const startLabel = gliderStartLabel && gliderStartLabel.isConnected ? gliderStartLabel : null;
    if (secondaryRow) {
      const shouldShowSecondary = position === 'secondary' || (startLabel && startLabel.style.display !== 'none');
      secondaryRow.style.display = shouldShowSecondary ? '' : 'none';
    }
    if (position === 'inline') {
      label.classList.add('func-answer--inline');
      label.classList.remove('func-answer--glider');
      if (domainLabel) {
        domainLabel.after(label);
      } else if (mainRow) {
        mainRow.appendChild(label);
      }
    } else if (position === 'glider') {
      label.classList.add('func-answer--glider');
      label.classList.remove('func-answer--inline');
      if (gliderRow) {
        const colorLabel = gliderRow.querySelector('.func-color');
        if (colorLabel) {
          colorLabel.before(label);
        } else {
          gliderRow.appendChild(label);
        }
      }
    } else {
      label.classList.remove('func-answer--inline', 'func-answer--glider');
      if (secondaryRow) {
        secondaryRow.appendChild(label);
      }
    }
    answerControl.currentPlacement = position;
  }
  function updateAnswerPlacement() {
    if (!answerControl || !answerControl.label) return;
    const firstValue = getFirstFunctionValue();
    if (firstValue && isCoords(firstValue) && pointLockEnabled) {
      placeAnswerField('hidden');
      return;
    }
    const gliderSectionVisible = gliderSection && gliderSection.style.display !== 'none';
    if (gliderSectionVisible && getGliderCount() <= 0) {
      placeAnswerField('hidden');
      return;
    }
    const forced = determineForcedGliderCount(firstValue);
    if (forced != null && forced > 0) {
      placeAnswerField('inline');
      return;
    }
    const glidersActive = shouldEnableGliders() && gliderSectionVisible;
    if (glidersActive) {
      placeAnswerField('glider');
    } else {
      placeAnswerField('secondary');
    }
  }
  const updateLinePointControls = (options = {}) => {
    const { silent = false } = options;
    if (!linePointSection) {
      if (!silent) updateSnapAvailability();
      return;
    }
    const spec = getLineTemplateSpec();
    const count = getLinePointCount(spec);
    const changed = count !== linePointVisibleCount;
    linePointVisibleCount = count;
    linePointSection.style.display = count > 0 ? '' : 'none';
    linePointLabels.forEach((label, idx) => {
      if (!label) return;
      label.style.display = idx < count ? '' : 'none';
    });
    linePointInputs.forEach((input, idx) => {
      if (!input) return;
      input.disabled = idx >= count;
    });
    if (count === 0 && !silent) {
      linePointsEdited = false;
    }
    if (changed && !silent) {
      syncSimpleFromForm();
      scheduleSimpleRebuild();
    }
    updateSnapAvailability();
  };
  if (snapCheckbox) {
    snapCheckbox.checked = ADV.points.snap.enabled;
  }
  const updateStartInputState = () => {
    if (!gliderStartInput) return;
    const showInput = shouldShowStartInput();
    gliderStartInput.disabled = !showInput;
    if (gliderStartLabel) {
      gliderStartLabel.style.display = showInput ? '' : 'none';
    }
    updateSnapAvailability();
  };
  const applyForcedGliderCount = show => {
    if (!gliderCountInput) {
      forcedGliderCount = null;
      return false;
    }
    const prevForced = forcedGliderCount;
    const prevValue = gliderCountInput.value;
    const value = show ? getFirstFunctionValue() : '';
    const forced = show ? determineForcedGliderCount(value) : null;
    forcedGliderCount = forced;
    if (forced != null) {
      if (gliderCountInput.value !== String(forced)) {
        gliderCountInput.value = String(forced);
      }
      gliderCountInput.disabled = true;
    } else {
      gliderCountInput.disabled = !show;
    }
    return forced !== prevForced || gliderCountInput.value !== prevValue;
  };
  const updateGliderVisibility = () => {
    if (!gliderSection) {
      updateSnapAvailability();
      return;
    }
    if (answerControl) {
      answerControl.gliderRow = gliderSection;
    }
    const show = shouldEnableGliders();
    const visibilityChanged = show !== glidersVisible;
    glidersVisible = show;
    gliderSection.style.display = show ? '' : 'none';
    const domainRow = gliderSection.closest('.func-row--domain');
    if (domainRow) {
      const domainLabel = domainRow.querySelector('label.domain');
      const domainVisible = domainLabel && domainLabel.style.display !== 'none';
      domainRow.style.display = show || domainVisible ? '' : 'none';
    }
    const forcedChanged = applyForcedGliderCount(show);
    updateStartInputState();
    if (visibilityChanged || forcedChanged) {
      syncSimpleFromForm();
      scheduleSimpleRebuild();
    }
    updateAnswerPlacement();
  };
  const buildSimpleFromForm = () => {
    var _rows$;
    const rows = funcRows ? Array.from(funcRows.querySelectorAll('.func-group')) : [];
    const firstInput = (_rows$ = rows[0]) === null || _rows$ === void 0 ? void 0 : _rows$.querySelector('[data-fun]');
    const firstVal = firstInput ? getFunctionInputValue(firstInput) : '';
    const lineSpec = interpretLineTemplateFromExpression(firstVal);
    const neededLinePoints = getLinePointCount(lineSpec);
    const resolveMarkerValue = value => normalizePointMarkerValue(value) || '';
    const markerInputValue = pointMarkerControls.length ? resolveMarkerValue(getPointMarkerInputValue()) : '';
    const parsedMarkerValue = resolveMarkerValue(SIMPLE_PARSED.pointMarker);
    const parsedMarkerListValue = Array.isArray(SIMPLE_PARSED.pointMarkers) && SIMPLE_PARSED.pointMarkers.length
      ? resolveMarkerValue(formatPointMarkerList(SIMPLE_PARSED.pointMarkers))
      : '';
    const lines = [];
    const answerLines = [];
    rows.forEach((row, idx) => {
      const funInput = row.querySelector('[data-fun]');
      const domInput = row.querySelector('input[data-dom]');
      const answerInput = row.querySelector('input[data-answer]');
      if (!funInput) return;
      const fun = getFunctionInputValue(funInput);
      if (!fun) return;
      const isCoordsRow = isCoords(fun);
      const allowAnswer = !(idx === 0 && isCoordsRow && pointLockEnabled);
      const rawAnswer = allowAnswer && answerInput && !answerInput.disabled && typeof answerInput.value === 'string'
        ? answerInput.value.trim()
        : '';
      if (rawAnswer) {
        const key = idx === 0 ? 'riktig' : `riktig${idx + 1}`;
        answerLines.push(`${key}: ${rawAnswer}`);
      }
      if (isCoordsRow) {
        const parsedPoints = parsePointListString(fun)
          .filter(pt => Array.isArray(pt) && pt.length === 2 && pt.every(Number.isFinite));
        if (parsedPoints.length) {
          const coords = parsedPoints
            .map(pt => `(${formatNumber(pt[0], stepX())}, ${formatNumber(pt[1], stepY())})`)
            .filter(Boolean);
          if (coords.length) {
            lines.push(`coords=${coords.join('; ')}`);
          }
        }
        return;
      }
      const domRaw = domInput ? domInput.value.trim() : '';
      const normalizedDom = domRaw ? normalizeDomainInputValue(domRaw) : null;
      const dom = normalizedDom ? normalizedDom.formatted : domRaw;
      const colorInfo = getFunctionColorInfoForRow(row);
      const manualColor = colorInfo.manual && colorInfo.value ? normalizeColorValue(colorInfo.value) : '';
      const baseLine = dom ? `${fun}, x in ${dom}` : fun;
      const withColor = manualColor ? `${baseLine}, color=${manualColor}` : baseLine;
      lines.push(withColor);
    });
    let hasCoordsLine = lines.some(L => /^\s*coords\s*=/i.test(L));
    let hasMarkerLine = lines.some(L => /^\s*marker\s*=/i.test(L));
    const hasPointsLine = lines.some(L => /^\s*points\s*=/i.test(L));
    const hasStartXLine = lines.some(L => /^\s*startx\s*=/i.test(L));
    const hasLinePtsLine = lines.some(L => /^\s*linepts\s*=/i.test(L));
    const glidersActive = shouldEnableGliders();
    const gliderCount = glidersActive ? getGliderCount() : 0;
    if (glidersActive && !hasPointsLine && gliderCount > 0) {
      lines.push(`points=${gliderCount}`);
    }
    if (glidersActive && shouldShowStartInput() && !hasStartXLine && gliderCount > 0) {
      const startValues = parseStartXValues((gliderStartInput === null || gliderStartInput === void 0 ? void 0 : gliderStartInput.value) || '');
      if (startValues.length) {
        lines.push(`startx=${startValues.map(val => formatNumber(val, stepX())).join(', ')}`);
      }
    }
    if (!hasCoordsLine && Array.isArray(SIMPLE_PARSED.extraPoints)) {
      const coords = SIMPLE_PARSED.extraPoints
        .filter(pt => Array.isArray(pt) && pt.length === 2 && pt.every(Number.isFinite))
        .map(pt => `(${formatNumber(pt[0], stepX())}, ${formatNumber(pt[1], stepY())})`);
      if (coords.length) {
        lines.push(`coords=${coords.join('; ')}`);
        hasCoordsLine = true;
      }
    }
    if (!hasMarkerLine && hasCoordsLine) {
      const markerForFallback = markerInputValue || parsedMarkerListValue || parsedMarkerValue;
      if (markerForFallback && !isDefaultPointMarker(markerForFallback)) {
        lines.push(`marker=${markerForFallback}`);
        hasMarkerLine = true;
      }
    }
    if (!hasLinePtsLine && neededLinePoints > 0 && (linePointsEdited || Array.isArray(SIMPLE_PARSED.linePoints) && SIMPLE_PARSED.linePoints.length > 0)) {
      const exportPoints = gatherLinePointsForExport(neededLinePoints);
      if (exportPoints.length === neededLinePoints) {
        lines.push(`linepts=${formatLinePoints(exportPoints)}`);
      }
    }
    const hasLockLine = lines.some(L => /^\s*lockpoint\s*=/i.test(L));
    if (hasCoordsLine) {
      if (!pointLockEnabled) {
        if (!hasLockLine) {
          lines.push('lockpoint=false');
        }
      }
    }
    answerLines.forEach(line => {
      if (line) {
        lines.push(line);
      }
    });
    return lines.join('\n');
  };
  const syncSimpleFromForm = () => {
    const simple = buildSimpleFromForm();
    if (simple !== SIMPLE) {
      SIMPLE = simple;
      if (typeof window !== 'undefined') {
        window.SIMPLE = SIMPLE;
      }
      refreshAltText('form-change');
    }
    return simple;
  };
  queueSimpleFormUpdate = createSimpleFormChangeQueue(() => {
    syncSimpleFromForm();
    scheduleSimpleRebuild();
  }, 360);
  scheduleSimpleFormChange = () => {
    if (queueSimpleFormUpdate) {
      queueSimpleFormUpdate();
      return;
    }
    syncSimpleFromForm();
    scheduleSimpleRebuild();
  };
  flushSimpleFormChange = () => {
    if (queueSimpleFormUpdate && typeof queueSimpleFormUpdate.flush === 'function') {
      queueSimpleFormUpdate.flush();
      return;
    }
    if (queueSimpleFormUpdate) {
      queueSimpleFormUpdate();
      return;
    }
    syncSimpleFromForm();
    scheduleSimpleRebuild();
  };
  const handleExternalLinePointUpdate = event => {
    if (!linePointSection || !Array.isArray(linePointInputs) || linePointInputs.length === 0) {
      return;
    }
    if (!event || !event.detail || !Array.isArray(event.detail.points)) {
      return;
    }
    const spec = getLineTemplateSpec();
    const needed = getLinePointCount(spec);
    if (needed <= 0) {
      return;
    }
    if (event.detail.points.length < needed) {
      return;
    }
    const values = [];
    for (let i = 0; i < needed; i++) {
      const src = event.detail.points[i];
      if (!Array.isArray(src) || src.length < 2) {
        return;
      }
      const x = typeof src[0] === 'number' ? src[0] : Number.parseFloat(String(src[0]));
      const y = typeof src[1] === 'number' ? src[1] : Number.parseFloat(String(src[1]));
      if (!Number.isFinite(x) || !Number.isFinite(y)) {
        return;
      }
      values.push([x, y]);
    }
    if (!values.length) {
      return;
    }
    setLinePointInputValues(values);
    if (!event.detail || event.detail.markEdited !== false) {
      linePointsEdited = true;
    }
    if (!event.detail || event.detail.sync !== false) {
      syncSimpleFromForm();
    }
  };
  if (typeof window !== 'undefined') {
    window.addEventListener('graf:linepoints-changed', handleExternalLinePointUpdate);
  }
  if (typeof window !== 'undefined') {
    window.addEventListener('examples:collect', event => {
      try {
        syncSimpleFromForm();
      } catch (_) {}
      if (!event || !event.detail) return;
      if (event.detail.svgOverride) return;
      const clone = cloneBoardSvgRoot();
      if (clone && clone.node) {
        event.detail.svgOverride = clone.node;
      } else {
        const svgExport = buildBoardSvgExport();
        if (svgExport && svgExport.markup) {
          event.detail.svgOverride = svgExport.markup;
        }
      }
    });
  }
  const handleGliderCountInput = () => {
    updateStartInputState();
    updateAnswerPlacement();
    scheduleSimpleFormChange();
  };
  const handleGliderCountCommit = () => {
    updateStartInputState();
    updateAnswerPlacement();
    flushSimpleFormChange();
  };
  if (gliderCountInput) {
    gliderCountInput.addEventListener('input', handleGliderCountInput);
    gliderCountInput.addEventListener('change', handleGliderCountCommit);
    gliderCountInput.addEventListener('blur', handleGliderCountCommit);
  }
  if (gliderStartInput) {
    attachGliderStartInputListeners();
  }
  const toggleDomain = input => {
    const row = input.closest('.func-group');
    if (!row) return;
    const domLabel = row.querySelector('label.domain');
    const domInput = domLabel ? domLabel.querySelector('input[data-dom]') : null;
    const value = getFunctionInputValue(input);
    const showDomain = isExplicitFun(value);
    if (showDomain) {
      if (domLabel) {
        domLabel.style.display = '';
        if (domInput && !domInput.value.trim()) {
          domInput.value = DEFAULT_DOMAIN_VALUE;
        }
      }
    } else if (domLabel) {
      domLabel.style.display = 'none';
      if (domInput) domInput.value = '';
    }
    const domainRow = domLabel ? domLabel.closest('.func-row--domain') : null;
    if (domainRow && !domainRow.querySelector('.glider-row')) {
      domainRow.style.display = showDomain ? '' : 'none';
    }
    updateGliderVisibility();
    updateLinePointControls({ silent: true });
    updateAnswerPlacement();
  };
  const createRow = (index, funVal = '', domVal = '', colorVal = '', colorManual = false, answerVal = '') => {
    const row = document.createElement('div');
    row.className = 'func-group';
    row.dataset.index = String(index);
    const titleLabel = 'Funksjon eller punkter';
    const placeholderAttr = index === 1 ? ` placeholder="${DEFAULT_FUNCTION_EXPRESSION}"` : '';
    const defaultColor = computeDefaultColorForIndex(index);
    const manualColor = normalizeColorValue(colorVal);
    const isManualColor = !!colorManual && !!manualColor;
    const initialColor = isManualColor ? manualColor : (defaultColor || DEFAULT_COLOR_FALLBACK);
    const colorAttr = initialColor || DEFAULT_COLOR_FALLBACK;
    const colorControlMarkup = `
            <label class="func-color">
              <span>Farge</span>
              <input type="color" data-color value="${colorAttr}">
            </label>`;
    const gliderMarkup = index === 1 ? `
            <div class="func-row func-row--domain">
              <label class="domain">
                <span>Avgrensning</span>
                <input type="text" data-dom placeholder="[start, stopp]">
              </label>
              <div class="func-row--gliders glider-row">
                <label class="points">
                  <span>Punkter</span>
                  <select data-points>
                    <option value="0">0</option>
                    <option value="1">1</option>
                    <option value="2">2</option>
                  </select>
                </label>
                <div class="linepoints-row">
                  <label class="linepoint" data-linepoint-label="0">
                    <span>Punkt 1</span>
                    <input type="text" data-linepoint="0" placeholder="(0, 0)">
                  </label>
                  <label class="linepoint" data-linepoint-label="1">
                    <span>Punkt 2</span>
                    <input type="text" data-linepoint="1" placeholder="(1, 1)">
                  </label>
                </div>
              </div>
            </div>
    ` : `
            <div class="func-row func-row--domain">
              <label class="domain">
                <span>Avgrensning</span>
                <input type="text" data-dom placeholder="[start, stopp]">
              </label>
            </div>
    `;
    const startMarkup = index === 1 ? `
            <label class="startx-label">
              <span>Start</span>
              <input type="text" data-startx value="x=1" placeholder="x=1">
            </label>
    ` : '';
    const fieldsClass = index === 1 ? 'func-fields func-fields--first' : 'func-fields';
    row.innerHTML = `
      <fieldset>
        <legend>Funksjon ${index}</legend>
        <div class="${fieldsClass}">
          <div class="func-row func-row--main">
            <div class="func-main">
              <label class="func-input">
                <span>${titleLabel}</span>
                <div class="func-editor">
                  <math-field data-fun class="func-math-field" ${mathFieldKeyboardAttr} smart-mode="false" aria-label="${titleLabel}"${placeholderAttr}></math-field>
                  <div class="func-preview" data-fun-preview aria-hidden="true"></div>
                </div>
              </label>
            </div>
            ${colorControlMarkup}
          </div>
          <div class="func-row func-row--markers point-marker-row">
            <label class="point-marker" data-point-marker-container>
              <span>Punktmarkør</span>
              <input type="text" data-point-marker placeholder="${DEFAULT_POINT_MARKER}" value="${DEFAULT_POINT_MARKER}" autocomplete="off" spellcheck="false">
            </label>
            <label class="checkbox-inline point-lock" data-point-lock-container>
              <input type="checkbox" data-point-lock checked>
              <span>Lås punkt</span>
            </label>
          </div>
          ${gliderMarkup}
          <div class="func-row func-row--secondary">
            ${startMarkup}
            <label class="func-answer">
              <span>Fasit</span>
              <input type="text" data-answer placeholder="Skriv fasit (valgfritt)" autocomplete="off" spellcheck="false">
            </label>
          </div>
        </div>
      </fieldset>
    `;
    if (funcRows) {
      funcRows.appendChild(row);
    }
    const editor = row.querySelector('.func-editor');
    const preview = editor ? editor.querySelector('[data-fun-preview]') : null;
    if (index === 1) {
      const labelSpan = row.querySelector('.func-input > span');
      if (labelSpan) {
        labelSpan.textContent = titleLabel;
      }
      if (preview) {
        preview.removeAttribute('data-preview-no-latex');
      }
    }
    const colorInput = row.querySelector('input[data-color]');
    if (colorInput) {
      registerFunctionColorControl(row, colorInput, {
        defaultColor,
        manualColor,
        manual: isManualColor
      });
    }
    const markerLabel = row.querySelector('[data-point-marker-container]');
    const markerContainer = markerLabel ? markerLabel.closest('.point-marker-row') || markerLabel : null;
    if (markerContainer) {
      markerContainer.style.display = 'none';
    }
    const markerInput = row.querySelector('input[data-point-marker]');
    if (markerInput) {
      markerInput.dataset.defaultValue = DEFAULT_POINT_MARKER;
      markerInput.value = pointMarkerValue;
      pointMarkerControls.push({ row, input: markerInput, container: markerContainer });
      const handleMarkerInput = event => {
        syncPointMarkerValueFromInput(markerInput);
        if (event && event.type === 'change') {
          flushSimpleFormChange();
        } else {
          scheduleSimpleFormChange();
        }
      };
      markerInput.addEventListener('input', handleMarkerInput);
      markerInput.addEventListener('change', handleMarkerInput);
    }
    if (index === 1) {
      const lockLabel = row.querySelector('[data-point-lock-container]');
      const lockCheckbox = lockLabel ? lockLabel.querySelector('input[data-point-lock]') : null;
      if (lockLabel && lockCheckbox) {
        pointLockControl = { container: lockLabel, checkbox: lockCheckbox };
        lockLabel.style.display = 'none';
        lockCheckbox.checked = !!pointLockEnabled;
        lockCheckbox.disabled = true;
        const handlePointLockChange = () => {
          pointLockEnabled = !!lockCheckbox.checked;
          ADV.points.lockExtraPoints = pointLockEnabled;
          updateAnswerPlacement();
          syncSimpleFromForm();
          scheduleSimpleRebuild();
          updatePointLockVisibility();
        };
        lockCheckbox.addEventListener('change', handlePointLockChange);
        lockCheckbox.addEventListener('input', handlePointLockChange);
      }
    }
    let funInput = row.querySelector('[data-fun]');
    const answerInput = row.querySelector('input[data-answer]');
    if (answerInput) {
      answerInput.value = answerVal || '';
      const handleAnswerInput = () => {
        scheduleSimpleFormChange();
      };
      const handleAnswerBlur = () => {
        if (answerInput.value != null) {
          const trimmed = answerInput.value.trim();
          if (answerInput.value !== trimmed) {
            answerInput.value = trimmed;
          }
        }
        flushSimpleFormChange();
      };
      answerInput.addEventListener('input', handleAnswerInput);
      answerInput.addEventListener('change', handleAnswerBlur);
      answerInput.addEventListener('blur', handleAnswerBlur);
    }
    funInput = ensureFunctionInputElement(funInput);
    const domInput = row.querySelector('input[data-dom]');
    if (funInput) {
      setFunctionInputValue(funInput, funVal || '');
      const beginEditing = () => {
        setFunctionEditorMode(funInput, 'edit');
        const focusInput = () => {
          if (typeof funInput.focus === 'function') {
            try {
              funInput.focus({ preventScroll: true });
            } catch (_) {
              funInput.focus();
            }
          }
          if (typeof funInput.setSelectionRange === 'function') {
            const value = funInput.value != null ? String(funInput.value) : '';
            try {
              funInput.setSelectionRange(value.length, value.length);
            } catch (_) {}
          }
        };
        if (typeof window !== 'undefined' && typeof window.requestAnimationFrame === 'function') {
          window.requestAnimationFrame(focusInput);
        } else if (typeof setTimeout === 'function') {
          setTimeout(focusInput, 0);
        } else {
          focusInput();
        }
      };
      if (preview) {
        preview.setAttribute('role', 'button');
        if (!preview.getAttribute('aria-label')) {
          preview.setAttribute('aria-label', `Klikk for å redigere ${titleLabel}`);
        }
        preview.addEventListener('click', event => {
          event.preventDefault();
          beginEditing();
        });
        preview.addEventListener('keydown', event => {
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            beginEditing();
          }
        });
      }
      const rememberCommittedValue = () => {
        funInput.dataset.lastCommittedValue = getFunctionInputValue(funInput);
      };
      const runInputSideEffects = () => {
        updateFunctionPreview(funInput);
        toggleDomain(funInput);
        updateLinePointControls();
        updatePointMarkerVisibility();
      };
      const commitIfChanged = () => {
        runInputSideEffects();
        const currentValue = getFunctionInputValue(funInput);
        if (currentValue) {
          setFunctionEditorMode(funInput, 'preview');
        } else {
          setFunctionEditorMode(funInput, 'edit');
        }
        if (funInput.dataset.lastCommittedValue === currentValue) {
          return;
        }
        funInput.dataset.lastCommittedValue = currentValue;
        refreshGliderStartInputDisplay();
        flushSimpleFormChange();
      };
      const scheduleRemember = typeof queueMicrotask === 'function'
        ? queueMicrotask
        : callback => setTimeout(callback, 0);
      scheduleRemember(rememberCommittedValue);
      funInput.addEventListener('input', runInputSideEffects);
      funInput.addEventListener('change', commitIfChanged);
      funInput.addEventListener('blur', commitIfChanged);
      funInput.addEventListener('focus', () => {
        setFunctionEditorMode(funInput, 'edit');
      });
      funInput.addEventListener('keydown', event => {
        if (event.key === 'Enter') {
          event.preventDefault();
          commitIfChanged();
          if (typeof funInput.blur === 'function') {
            funInput.blur();
          }
        }
      });
    }
    if (domInput) {
      domInput.value = domVal || '';
      if (domInput.value) {
        const normalized = normalizeDomainInputValue(domInput.value);
        if (normalized && normalized.formatted !== domInput.value) {
          domInput.value = normalized.formatted;
        }
      }
      const handleDomChange = event => {
        if (event && event.type !== 'input') {
          const normalized = normalizeDomainInputValue(domInput.value);
          if (normalized && normalized.formatted !== domInput.value) {
            domInput.value = normalized.formatted;
          }
        }
        if (event && (event.type === 'change' || event.type === 'blur')) {
          flushSimpleFormChange();
        } else {
          scheduleSimpleFormChange();
        }
      };
      domInput.addEventListener('input', handleDomChange);
      domInput.addEventListener('change', handleDomChange);
      domInput.addEventListener('blur', handleDomChange);
    }
    if (index === 1) {
      gliderSection = row.querySelector('.glider-row');
      if (gliderSection) {
        gliderSection.style.display = 'none';
      }
      gliderCountInput = row.querySelector('[data-points]');
      gliderStartInput = row.querySelector('input[data-startx]');
      gliderStartLabel = gliderStartInput ? gliderStartInput.closest('label') : null;
      const secondaryRow = row.querySelector('.func-row--secondary');
      const mainRow = row.querySelector('.func-row--main');
      const domainLabel = row.querySelector('.func-row--domain label.domain');
      const answerLabel = secondaryRow ? secondaryRow.querySelector('label.func-answer') : null;
      if (answerLabel) {
        answerControl = {
          label: answerLabel,
          secondaryRow,
          mainRow,
          domainLabel,
          gliderRow: gliderSection,
          currentPlacement: null
        };
      }
      if (gliderCountInput) {
        gliderCountInput.addEventListener('input', handleGliderCountInput);
        gliderCountInput.addEventListener('change', handleGliderCountCommit);
        gliderCountInput.addEventListener('blur', handleGliderCountCommit);
      }
      if (gliderStartInput) {
        attachGliderStartInputListeners();
      }
      linePointSection = row.querySelector('.linepoints-row');
      linePointInputs = linePointSection ? Array.from(linePointSection.querySelectorAll('input[data-linepoint]')) : [];
      linePointLabels = linePointSection ? Array.from(linePointSection.querySelectorAll('[data-linepoint-label]')) : [];
      linePointVisibleCount = 0;
      if (linePointSection) {
        linePointSection.style.display = 'none';
      }
      linePointInputs.forEach(input => {
        if (!input) return;
        const handleLinePointInputChange = event => {
          const parsed = parseLinePointInput(input.value);
          if (parsed) {
            input.value = formatPointInputValue(parsed);
          }
          linePointsEdited = true;
          syncLinePointsToBoardFromInputs();
          if (event && event.type === 'change') {
            flushSimpleFormChange();
          } else {
            scheduleSimpleFormChange();
          }
        };
        input.addEventListener('input', handleLinePointInputChange);
        input.addEventListener('change', handleLinePointInputChange);
      });
    }
    if (funInput) {
      toggleDomain(funInput);
      updatePointMarkerVisibility();
    }
    if (index === 1) {
      updateAnswerPlacement();
    }
    return row;
  };
  const fillFormFromSimple = simple => {
    const source = typeof simple === 'string' ? simple : typeof window !== 'undefined' ? window.SIMPLE : SIMPLE;
    const text = typeof source === 'string' ? source : '';
    if (typeof source === 'string') {
      SIMPLE = source;
      SIMPLE_PARSED = parseSimple(SIMPLE);
      applyLinePointStart(SIMPLE_PARSED);
    }
    linePointsEdited = Array.isArray(SIMPLE_PARSED.linePoints) && SIMPLE_PARSED.linePoints.length > 0;
    const lines = text.split(/\r?\n/).map(line => line.trim()).filter(line => line.length > 0);
    const filteredLines = lines.filter(line => {
      if (/^\s*points\s*=/i.test(line)) return false;
      if (/^\s*startx\s*=/i.test(line)) return false;
      if (/^\s*linepts\s*=/i.test(line)) return false;
      if (/^\s*marker\s*=/i.test(line)) return false;
      if (/^\s*lockpoint\s*=/i.test(line)) return false;
      if (/^\s*(?:riktig|fasit)\d*\s*:/i.test(line)) return false;
      return true;
    });
    if (filteredLines.length === 0) {
      filteredLines.push('');
    }
    if (funcRows) {
      gliderSection = null;
      gliderCountInput = null;
      gliderStartInput = null;
      gliderStartLabel = null;
      linePointSection = null;
      linePointInputs = [];
      linePointLabels = [];
      linePointVisibleCount = 0;
      pointMarkerControls.length = 0;
      pointLockControl = null;
      clearFunctionColorControls();
      pointMarkerValue = DEFAULT_POINT_MARKER;
      answerControl = null;
      funcRows.innerHTML = '';
    }
    pointLockEnabled = SIMPLE_PARSED && SIMPLE_PARSED.lockExtraPoints === false ? false : true;
    ADV.points.lockExtraPoints = pointLockEnabled;
    glidersVisible = false;
    forcedGliderCount = null;
    let funcIndex = 0;
    filteredLines.forEach((line, idx) => {
      let funVal = line;
      let domVal = '';
      const coordsMatch = line.match(/^coords\s*=\s*(.+)$/i);
      if (coordsMatch) {
        funVal = coordsMatch[1].trim();
      } else {
        const domMatch = line.match(/,\s*x\s*(?:in|∈)\s*(.+)$/i);
        if (domMatch) {
          funVal = line.slice(0, domMatch.index).trim();
          domVal = domMatch[1].trim();
        }
      }
      let colorVal = '';
      let colorManualFlag = false;
      const isFunctionLine = !coordsMatch && /=/.test(line);
      if (isFunctionLine && Array.isArray(SIMPLE_PARSED.funcs)) {
        const parsedFunc = SIMPLE_PARSED.funcs[funcIndex] || null;
        if (parsedFunc) {
          colorVal = typeof parsedFunc.color === 'string' ? parsedFunc.color : '';
          colorManualFlag = parsedFunc.colorSource === 'manual' && !!colorVal;
        }
        funcIndex++;
      }
      const answerVal = Array.isArray(SIMPLE_PARSED.answers) ? SIMPLE_PARSED.answers[idx] || '' : '';
      createRow(idx + 1, funVal, domVal, colorVal, colorManualFlag, answerVal);
    });
    refreshFunctionColorDefaultsLocal();
    updatePointLockVisibility();
    if (gliderCountInput) {
      var _SIMPLE_PARSED;
      const count = Number.isFinite((_SIMPLE_PARSED = SIMPLE_PARSED) === null || _SIMPLE_PARSED === void 0 ? void 0 : _SIMPLE_PARSED.pointsCount) ? SIMPLE_PARSED.pointsCount : 0;
      const clamped = Math.max(0, Math.min(2, count));
      gliderCountInput.value = String(clamped);
    }
    if (gliderStartInput) {
      var _SIMPLE_PARSED2;
      const startVals = Array.isArray((_SIMPLE_PARSED2 = SIMPLE_PARSED) === null || _SIMPLE_PARSED2 === void 0 ? void 0 : _SIMPLE_PARSED2.startX)
        ? SIMPLE_PARSED.startX.filter(Number.isFinite)
        : [];
      setGliderStartInputValues(startVals);
      refreshGliderStartInputDisplay();
    }
    if (linePointInputs.length && SIMPLE_PARSED) {
      const resolvedPoints = resolveLineStartPoints(SIMPLE_PARSED);
      setLinePointInputValues(resolvedPoints);
    }
    updateGliderVisibility();
    updateLinePointControls({ silent: true });
    const parsedMarkerValueForInput = Array.isArray(SIMPLE_PARSED.pointMarkers) && SIMPLE_PARSED.pointMarkers.length
      ? formatPointMarkerList(SIMPLE_PARSED.pointMarkers)
      : SIMPLE_PARSED.pointMarker;
    const parsedMarker = normalizePointMarkerValue(parsedMarkerValueForInput);
    setPointMarkerInputValue(parsedMarker);
    updatePointMarkerVisibility();
    syncSimpleFromForm();
    updateSnapAvailability();
    refreshAltText('form-fill');
  };
  fillFormFromSimple(SIMPLE);
  if (addBtn) {
    addBtn.addEventListener('click', () => {
      const index = (funcRows ? funcRows.querySelectorAll('.func-group').length : 0) + 1;
      createRow(index, '', '', '', false, '');
      syncSimpleFromForm();
      scheduleSimpleRebuild();
    });
  }
  if (typeof window !== 'undefined') {
    window.addEventListener('examples:loaded', () => {
      fillFormFromSimple(window.SIMPLE);
    });
  }
  if (screenInput) {
    screenInput.addEventListener('input', () => {
      SCREEN_INPUT_IS_EDITING = true;
      if (screenInput.dataset) delete screenInput.dataset.autoscreen;
      screenInput.classList.remove('is-auto');
    });
    screenInput.addEventListener('focus', () => {
      SCREEN_INPUT_IS_EDITING = true;
      if (Array.isArray(LAST_COMPUTED_SCREEN) && LAST_COMPUTED_SCREEN.length === 4) {
        screenInput.value = formatScreenForInput(LAST_COMPUTED_SCREEN);
      }
      screenInput.classList.remove('is-auto');
    });
    screenInput.addEventListener('blur', () => {
      SCREEN_INPUT_IS_EDITING = false;
      if (screenInput.dataset && screenInput.dataset.autoscreen === '1') {
        screenInput.classList.add('is-auto');
      }
    });
  }
  syncScreenInputFromState();
  g('cfgLock').checked = params.has('lock') ? paramBool('lock') : true;
  g('cfgAxisX').value = paramStr('xName', 'x');
  g('cfgAxisY').value = paramStr('yName', 'y');
  g('cfgZoom').checked = ADV.interactions.zoom.enabled;
  g('cfgPan').checked = ADV.interactions.pan.enabled;
  g('cfgQ1').checked = paramBool('q1');
  if (showNamesInput) {
    showNamesInput.checked = !!ADV.curveName.showName;
  }
  if (showExprInput) {
    showExprInput.checked = !!ADV.curveName.showExpression;
  }
  if (showAxisNumbersInput) {
    showAxisNumbersInput.checked = !!(ADV.axis && ADV.axis.ticks && ADV.axis.ticks.showNumbers);
  }
  if (showGridInput) {
    showGridInput.checked = !!(ADV.axis && ADV.axis.grid && ADV.axis.grid.show);
  }
  if (forceTicksInput) {
    forceTicksInput.checked = !!ADV.axis.forceIntegers;
    forceTicksInput.disabled = FORCE_TICKS_LOCKED_FALSE;
    if (FORCE_TICKS_LOCKED_FALSE) {
      forceTicksInput.checked = false;
      forceTicksInput.title = 'Deaktivert fordi utsnittet gir for mange tall på aksene.';
    } else {
      forceTicksInput.removeAttribute('title');
    }
  }
  const fontSizeInput = g('cfgFontSize');
  if (fontSizeInput) {
    fontSizeInput.value = String(sanitizeFontSize(ADV.axis.grid.fontSize, FONT_DEFAULT));
  }
  const apply = () => {
    const prevSimple = LAST_RENDERED_SIMPLE;
    const currentSimple = syncSimpleFromForm();
    const simpleChanged = currentSimple !== prevSimple;
    let needsRebuild = simpleChanged;
    let screenRaw = screenInput ? screenInput.value.trim() : '';
    if (screenInput && screenInput.dataset && screenInput.dataset.autoscreen === '1') {
      screenRaw = '';
    }
    const nextScreen = screenInput ? parseScreen(screenRaw) : null;
    const lockInput = g('cfgLock');
    const q1Input = g('cfgQ1');
    if (nextScreen) {
      if (lockInput && lockInput.checked && !screenSupportsLockAspect(nextScreen)) {
        lockInput.checked = false;
      }
      if (q1Input && q1Input.checked && !screenSupportsFirstQuadrant(nextScreen)) {
        q1Input.checked = false;
      }
    }
    if (!screensEqual(nextScreen, ADV.screen)) {
      ADV.screen = nextScreen;
      needsRebuild = true;
    }
    const lockChecked = !!(lockInput && lockInput.checked);
    if (ADV.lockAspect !== lockChecked) {
      ADV.lockAspect = lockChecked;
      needsRebuild = true;
    }
    const axisXInput = axisXInputElement || g('cfgAxisX');
    const axisYInput = axisYInputElement || g('cfgAxisY');
    const axisXValue = axisXInput ? axisXInput.value.trim() : '';
    const axisYValue = axisYInput ? axisYInput.value.trim() : '';
    if ((ADV.axis.labels.x || '') !== axisXValue) {
      ADV.axis.labels.x = axisXValue;
      needsRebuild = true;
    }
    if ((ADV.axis.labels.y || '') !== axisYValue) {
      ADV.axis.labels.y = axisYValue;
      needsRebuild = true;
    }
    const zoomInput = g('cfgZoom');
    const zoomChecked = !!(zoomInput && zoomInput.checked);
    if (ADV.interactions.zoom.enabled !== zoomChecked) {
      ADV.interactions.zoom.enabled = zoomChecked;
      needsRebuild = true;
    }
    const panInput = g('cfgPan');
    const panChecked = !!(panInput && panInput.checked);
    if (ADV.interactions.pan.enabled !== panChecked) {
      ADV.interactions.pan.enabled = panChecked;
      needsRebuild = true;
    }
    const q1Checked = !!(q1Input && q1Input.checked);
    if (ADV.firstQuadrant !== q1Checked) {
      ADV.firstQuadrant = q1Checked;
      needsRebuild = true;
    }
    const showNamesChecked = showNamesInput ? !!showNamesInput.checked : !!(ADV.curveName && ADV.curveName.showName);
    const showExprChecked = showExprInput ? !!showExprInput.checked : !!(ADV.curveName && ADV.curveName.showExpression);
    const showBracketsChecked = !!(ADV.domainMarkers && ADV.domainMarkers.show);
    const showAxisNumbersChecked = showAxisNumbersInput ? !!showAxisNumbersInput.checked : !!(ADV.axis && ADV.axis.ticks && ADV.axis.ticks.showNumbers);
    const showGridChecked = showGridInput ? !!showGridInput.checked : !!(ADV.axis && ADV.axis.grid && ADV.axis.grid.show);
    if (showNamesInput && ADV.curveName.showName !== showNamesChecked) {
      ADV.curveName.showName = showNamesChecked;
      needsRebuild = true;
    }
    if (showExprInput && ADV.curveName.showExpression !== showExprChecked) {
      ADV.curveName.showExpression = showExprChecked;
      needsRebuild = true;
    }
    const showAny = showNamesChecked || showExprChecked;
    if (ADV.curveName.show !== showAny) {
      ADV.curveName.show = showAny;
      needsRebuild = true;
    }
    if (showAxisNumbersInput && ADV.axis.ticks.showNumbers !== showAxisNumbersChecked) {
      ADV.axis.ticks.showNumbers = showAxisNumbersChecked;
      needsRebuild = true;
    }
    if (showGridInput && ADV.axis.grid.show !== showGridChecked) {
      ADV.axis.grid.show = showGridChecked;
      needsRebuild = true;
    }
    if (forceTicksInput) {
      const requested = !!forceTicksInput.checked;
      if (!(forceTicksInput.disabled && FORCE_TICKS_LOCKED_FALSE) && FORCE_TICKS_REQUESTED !== requested) {
        FORCE_TICKS_REQUESTED = requested;
        needsRebuild = true;
      }
    }
    const snapInput = g('cfgSnap');
    const snapEnabled = !!(snapInput && snapInput.checked && !snapInput.disabled);
    if (ADV.points.snap.enabled !== snapEnabled) {
      ADV.points.snap.enabled = snapEnabled;
      needsRebuild = true;
    }
    const currentFontSize = sanitizeFontSize(ADV.axis.grid.fontSize, FONT_DEFAULT);
    const p = new URLSearchParams();
    const parsedMarkerListForExport = Array.isArray(SIMPLE_PARSED.pointMarkers) && SIMPLE_PARSED.pointMarkers.length
      ? formatPointMarkerList(SIMPLE_PARSED.pointMarkers)
      : '';
    const parsedMarkerNormalized = normalizePointMarkerValue(parsedMarkerListForExport || SIMPLE_PARSED.pointMarker);
    let idx = 1;
    (funcRows ? funcRows.querySelectorAll('.func-group') : []).forEach((row, rowIdx) => {
      const funInput = row.querySelector('[data-fun]');
      const fun = funInput ? getFunctionInputValue(funInput) : '';
      const dom = row.querySelector('input[data-dom]').value.trim();
      if (!fun) return;
      const colorInfo = getFunctionColorInfoForRow(row);
      const manualColor = colorInfo.manual && colorInfo.value ? normalizeColorValue(colorInfo.value) : '';
      if (rowIdx === 0 && isCoords(fun)) {
        p.set('coords', fun);
        const markerForParams = pointMarkerControls.length
          ? getPointMarkerValueForExport()
          : (parsedMarkerNormalized && !isDefaultPointMarker(parsedMarkerNormalized) ? parsedMarkerNormalized : '');
        if (markerForParams) {
          p.set('marker', markerForParams);
        }
      } else {
        p.set(`fun${idx}`, fun);
        if (dom) p.set(`dom${idx}`, dom);
        if (manualColor) {
          p.set(`color${idx}`, manualColor);
        }
        idx++;
      }
    });
    if (shouldEnableGliders()) {
      const count = getGliderCount();
      if (count > 0) {
        p.set('points', String(count));
        if (shouldShowStartInput()) {
          const startVals = parseStartXValues((gliderStartInput === null || gliderStartInput === void 0 ? void 0 : gliderStartInput.value) || '');
          if (startVals.length) {
            p.set('startx', startVals.map(val => formatNumber(val, stepX())).join(', '));
          }
        }
      }
    }
    if (!p.has('coords') && Array.isArray(SIMPLE_PARSED.extraPoints)) {
      const exportCoords = SIMPLE_PARSED.extraPoints
        .filter(pt => Array.isArray(pt) && pt.length === 2 && pt.every(Number.isFinite))
        .map(pt => `(${formatNumber(pt[0], stepX())}, ${formatNumber(pt[1], stepY())})`);
      if (exportCoords.length) {
        p.set('coords', exportCoords.join('; '));
        const markerFromParsed = parsedMarkerNormalized && !isDefaultPointMarker(parsedMarkerNormalized)
          ? parsedMarkerNormalized
          : '';
        if (markerFromParsed) {
          p.set('marker', markerFromParsed);
        }
      }
    }
    const applyLineSpec = interpretLineTemplateFromExpression(getFirstFunctionValue());
    const applyNeededLinePoints = getLinePointCount(applyLineSpec);
    if (applyNeededLinePoints > 0 && (linePointsEdited || Array.isArray(SIMPLE_PARSED.linePoints) && SIMPLE_PARSED.linePoints.length > 0)) {
      const exportPoints = gatherLinePointsForExport(applyNeededLinePoints);
      if (exportPoints.length === applyNeededLinePoints) {
        p.set('linepts', formatLinePoints(exportPoints));
      }
    }
    if (screenRaw) p.set('screen', screenRaw);
    if (lockChecked) p.set('lock', '1');else p.set('lock', '0');
    if (axisXValue && axisXValue !== 'x') p.set('xName', axisXValue);
    if (axisYValue && axisYValue !== 'y') p.set('yName', axisYValue);
    if (zoomInput) {
      p.set('zoom', zoomChecked ? '1' : '0');
    }
    if (panChecked) p.set('pan', '1');
    if (showNamesInput) {
      p.set('showNames', showNamesChecked ? '1' : '0');
    }
    if (showExprInput) {
      p.set('showExpr', showExprChecked ? '1' : '0');
    }
    p.set('brackets', showBracketsChecked ? '1' : '0');
    if (showAxisNumbersInput) {
      p.set('axisNumbers', showAxisNumbersChecked ? '1' : '0');
    }
    if (showGridInput) {
      p.set('grid', showGridChecked ? '1' : '0');
    }
    if (forceTicksInput) {
      if (forceTicksInput.disabled && FORCE_TICKS_LOCKED_FALSE) {
        p.set('forceTicks', FORCE_TICKS_REQUESTED ? '1' : '0');
      } else {
        p.set('forceTicks', forceTicksInput.checked ? '1' : '0');
      }
    }
    if (snapInput) {
      if (snapInput.checked) p.set('snap', '1');else p.set('snap', '0');
    }
    if (q1Checked) p.set('q1', '1');
    const keepFontParam = FONT_PARAM_KEYS.some(key => params.has(key)) || Math.abs(currentFontSize - FONT_DEFAULT) > 1e-9;
    const handleFontInput = (inputId, paramName, fallback, options = {}) => {
      const { keepWhenEqual = false } = options;
      const input = g(inputId);
      if (!input) return;
      const rawStr = String(input.value != null ? input.value : '').trim();
      if (!rawStr) {
        input.value = String(fallback);
        if (keepWhenEqual && Math.abs(fallback - FONT_DEFAULT) > 1e-9) {
          p.set(paramName, String(fallback));
        }
        return;
      }
      const raw = Number.parseFloat(rawStr.replace(',', '.'));
      if (!Number.isFinite(raw)) {
        input.value = String(fallback);
        if (keepWhenEqual && Math.abs(fallback - FONT_DEFAULT) > 1e-9) {
          p.set(paramName, String(fallback));
        }
        return;
      }
      const sanitized = sanitizeFontSize(raw, fallback);
      input.value = String(sanitized);
      if (Math.abs(sanitized - fallback) > 1e-9 || (keepWhenEqual && Math.abs(sanitized - FONT_DEFAULT) > 1e-9)) {
        p.set(paramName, String(sanitized));
      }
    };
    handleFontInput('cfgFontSize', 'fontSize', currentFontSize, { keepWhenEqual: keepFontParam });
    const fontSizeInput = g('cfgFontSize');
    if (fontSizeInput) {
      const parsedSize = Number.parseFloat(String(fontSizeInput.value).replace(',', '.'));
      const nextFontSize = Number.isFinite(parsedSize) ? sanitizeFontSize(parsedSize, currentFontSize) : currentFontSize;
      if (Math.abs(nextFontSize - ADV.axis.grid.fontSize) > 1e-9 || Math.abs(nextFontSize - ADV.axis.labels.fontSize) > 1e-9 || Math.abs(nextFontSize - ADV.curveName.fontSize) > 1e-9) {
        ADV.axis.grid.fontSize = nextFontSize;
        ADV.axis.labels.fontSize = nextFontSize;
        ADV.curveName.fontSize = nextFontSize;
        needsRebuild = true;
      }
    }
    const newSearch = p.toString();
    const currentSearch = typeof window !== 'undefined' && window.location ? window.location.search : '';
    const normalizedCurrentSearch = currentSearch.startsWith('?') ? currentSearch.slice(1) : currentSearch;
    if (newSearch !== normalizedCurrentSearch) {
      const hash = typeof window !== 'undefined' && window.location ? window.location.hash || '' : '';
      const basePath = typeof window !== 'undefined' && window.location ? window.location.pathname || '' : '';
      const nextSearch = newSearch ? `?${newSearch}` : '';
      const nextUrl = `${basePath}${nextSearch}${hash}`;
      if (typeof window !== 'undefined' && window.history && typeof window.history.replaceState === 'function') {
        window.history.replaceState(null, '', nextUrl);
      } else if (typeof window !== 'undefined' && window.location) {
        window.location.search = newSearch;
      }
    }
    if (needsRebuild) {
      requestRebuild();
    }
  };
  const syncAxisLabelsFromInputs = () => {
    const axisXValue = axisXInputElement ? axisXInputElement.value.trim() : '';
    const axisYValue = axisYInputElement ? axisYInputElement.value.trim() : '';
    let changed = false;
    if ((ADV.axis.labels.x || '') !== axisXValue) {
      ADV.axis.labels.x = axisXValue;
      changed = true;
    }
    if ((ADV.axis.labels.y || '') !== axisYValue) {
      ADV.axis.labels.y = axisYValue;
      changed = true;
    }
    if (changed) {
      requestRebuild();
    }
  };
  const bindAxisInput = input => {
    if (!input) return;
    const handle = () => {
      syncAxisLabelsFromInputs();
      apply();
    };
    input.addEventListener('change', handle);
    input.addEventListener('blur', handle);
    input.addEventListener('keydown', e => {
      if (e.key === 'Enter') handle();
    });
  };
  bindAxisInput(axisXInputElement);
  bindAxisInput(axisYInputElement);
  if (screenInput) {
    screenInput.addEventListener('change', e => {
      SCREEN_INPUT_IS_EDITING = false;
      if (e && typeof e.stopPropagation === 'function') {
        e.stopPropagation();
      }
      apply();
    });
    screenInput.addEventListener('keydown', e => {
      if (e.key === 'Enter') {
        e.preventDefault();
        SCREEN_INPUT_IS_EDITING = false;
        if (typeof e.stopPropagation === 'function') {
          e.stopPropagation();
        }
        apply();
      }
    });
  }
  refreshFunctionColorDefaults = refreshFunctionColorDefaultsLocal;
  root.addEventListener('change', apply);
  root.addEventListener('keydown', e => {
    if (e.key === 'Enter') apply();
  });
}
