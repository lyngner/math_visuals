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
const params = new URLSearchParams(location.search);
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
const FONT_LIMITS = {
  min: 6,
  max: 72
};
const FONT_DEFAULT = 16;
const FONT_PARAM_KEYS = ['fontSize', 'font', 'axisFont', 'tickFont', 'curveFont'];
const SHOW_CURVE_NAMES = params.has('showNames') ? paramBool('showNames') : true;
const SHOW_CURVE_EXPRESSIONS = params.has('showExpr') ? paramBool('showExpr') : false;
const SHOW_DOMAIN_MARKERS = params.has('brackets') ? paramBool('brackets') : true;
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
    const fun = paramStr(key, i === 1 ? 'f(x)=x^2-2' : '').trim();
    const dom = paramStr(`dom${i}`, '').trim();
    if (i === 1 || params.has(key)) {
      if (fun) {
        lines.push(dom ? `${fun}, x in ${dom}` : fun);
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
  const linepts = paramStr('linepts', '').trim();
  if (linepts) {
    lines.push(`linepts=${linepts}`);
  }
  return lines.join('\n');
}
let SIMPLE = typeof window !== 'undefined' && typeof window.SIMPLE !== 'undefined' ? window.SIMPLE : buildSimple();
let LAST_RENDERED_SIMPLE = SIMPLE;
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
const ADV = {
  axis: {
    labels: {
      x: paramStr('xName', 'x'),
      y: paramStr('yName', 'y'),
      fontSize: SHARED_FONT_SIZE
    },
    style: {
      stroke: '#111827',
      width: 2
    },
    grid: {
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
      enabled: true,
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
    decimals: 2,
    guideArrows: true,
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
    width: 3,
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
  return resolved;
}

/* ======================= Parser / modus ======================= */
function parseSimple(txt) {
  const lines = (txt || '').split('\n').map(s => s.trim()).filter(Boolean);
  const out = {
    funcs: [],
    pointsCount: 0,
    startX: [],
    extraPoints: [],
    linePoints: [],
    answer: null,
    raw: txt
  };
  const parseDomain = dom => {
    if (!dom) return null;
    const cleaned = dom.trim();
    if (!cleaned) return null;
    if (/^r$/i.test(cleaned) || /^ℝ$/i.test(cleaned)) return null;
    const normalizeNumeric = str => {
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
    };
    const parseNumberLike = str => {
      const normalized = normalizeNumeric(str);
      if (!normalized) return null;
      const num = Number.parseFloat(normalized);
      return Number.isFinite(num) ? num : null;
    };
    const normalized = cleaned.replace(/[⟨〈]/g, '<').replace(/[⟩〉]/g, '>').replace(/≤/g, '<=').replace(/≥/g, '>=').replace(/−/g, '-');
    const start = normalized[0];
    const end = normalized[normalized.length - 1];
    const isBracketStart = ['[', '<', '('].includes(start);
    const isBracketEnd = [']', '>', ')'].includes(end);
    if (isBracketStart && isBracketEnd) {
      const inner = normalized.slice(1, -1);
      const nums = inner.match(/[+-]?(?:\d+(?:[.,]\d+)?|[.,]\d+)/g);
      if (nums && nums.length === 2) {
        const a = parseNumberLike(nums[0]);
        const b = parseNumberLike(nums[1]);
        if (a != null && b != null && b >= a) {
          return {
            min: a,
            max: b,
            leftClosed: start === '[',
            rightClosed: end === ']'
          };
        }
      }
      return null;
    }
    const inequality = normalized.match(/^([+-]?(?:\d+(?:[.,]\d+)?|[.,]\d+))\s*(<=|<)\s*[xX]\s*(<=|<)\s*([+-]?(?:\d+(?:[.,]\d+)?|[.,]\d+))$/);
    if (inequality) {
      const a = parseNumberLike(inequality[1]);
      const b = parseNumberLike(inequality[4]);
      if (a != null && b != null && b >= a) {
        return {
          min: a,
          max: b,
          leftClosed: inequality[2] === '<=',
          rightClosed: inequality[3] === '<='
        };
      }
    }
    return null;
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
    const domMatch = /,\s*x\s*(?:in|∈)\s*(.+)$/i.exec(rhsWithDom);
    if (domMatch) {
      rhs = rhsWithDom.slice(0, domMatch.index).trim();
      domain = parseDomain(domMatch[1]);
    }
    rhs = rhs.trim();
    if (!rhs) return null;
    return {
      name,
      rhs,
      domain,
      label
    };
  };
  for (const L of lines) {
    const fun = parseFunctionLine(L);
    if (fun) {
      out.funcs.push(fun);
      continue;
    }
    const pm = L.match(/^points\s*=\s*(\d+)/i);
    if (pm) {
      out.pointsCount = +pm[1];
      continue;
    }
    const cm = L.match(/^coords\s*=\s*(.+)$/i);
    if (cm) {
      const pts = cm[1].split(';').map(s => s.trim().replace(/^\(|\)$/g, '')).filter(Boolean).map(p => p.split(',').map(t => +t.trim()).filter(Number.isFinite));
      for (const pt of pts) {
        if (pt.length === 2) out.extraPoints.push(pt);
      }
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
    const am = L.match(/^riktig\s*:\s*(.+)$/i);
    if (am) {
      out.answer = am[1].trim();
      continue;
    }
  }
  return out;
}
let SIMPLE_PARSED = parseSimple(SIMPLE);
applyLinePointStart(SIMPLE_PARSED);
const ALLOWED_NAMES = ['sin', 'cos', 'tan', 'asin', 'acos', 'atan', 'sinh', 'cosh', 'tanh', 'log', 'ln', 'sqrt', 'exp', 'abs', 'min', 'max', 'floor', 'ceil', 'round', 'pow'];
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
// Deaktiverer "Tving 1, 2, 3" når mer enn 20 tall får plass på en akse.
const FORCE_TICKS_AUTO_DISABLE_LIMIT = 20;
let FORCE_TICKS_LOCKED_FALSE = false;
let START_SCREEN = null;
let brd = null;
let axX = null;
let axY = null;
let xName = null;
let yName = null;
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
    if (b0 && b1 && opp || b0 ^ b1 && midBlow(xL, xR)) cand.push(0.5 * (xL + xR));
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
      domMin = Math.min(domMin, f.domain.min);
      domMax = Math.max(domMax, f.domain.max);
      feats.push({
        hasDom: true,
        fn,
        a: f.domain.min,
        b: f.domain.max,
        ...sampleFeatures(fn, f.domain.min, f.domain.max, {
          includeLeftEnd: !!f.domain.leftClosed,
          includeRightEnd: !!f.domain.rightClosed
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

/* ===================== Init JSXGraph ===================== */
JXG.Options.showCopyright = false;
JXG.Options.showNavigation = false;
JXG.Options.text.display = 'internal';
function initialScreen() {
  var _ADV$screen;
  let scr = (_ADV$screen = ADV.screen) !== null && _ADV$screen !== void 0 ? _ADV$screen : MODE === 'functions' ? computeAutoScreenFunctions() : computeAutoScreenPoints();
  if (ADV.firstQuadrant) {
    if (scr[0] < 0) scr[0] = 0;
    if (scr[2] < 0) scr[2] = 0;
  }
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
      JXG.JSXGraph.freeBoard(brd);
    } catch (_) {}
  }
  brd = null;
  axX = null;
  axY = null;
  xName = null;
  yName = null;
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
  ['x', 'y'].forEach(ax => {
    brd.defaultAxes[ax].setAttribute({
      withLabel: false,
      strokeColor: ADV.axis.style.stroke,
      strokeWidth: ADV.axis.style.width,
      firstArrow: false,
      lastArrow: true
    });
  });
}
function applyTickSettings() {
  if (!axX || !axY) return;
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
      visible: true,
      drawLabels: true
    });
    axY.defaultTicks.setAttribute({
      visible: true,
      drawLabels: true
    });
    return;
  }
  const tickBase = {
    drawLabels: true,
    precision: ADV.axis.grid.labelPrecision
  };
  const labelBase = {
    fontSize: ADV.axis.grid.fontSize
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
  brd = JXG.JSXGraph.initBoard('board', {
    boundingbox: toBB(START_SCREEN),
    axis: true,
    grid: !ADV.axis.forceIntegers,
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
  if (ADV.axis.forceIntegers) {
    applyTickSettings();
  }
  xName = null;
  yName = null;
  placeAxisNames();
  gridV = [];
  gridH = [];
}

/* ---------- akser og navn ---------- */
function placeAxisNames() {
  if (!brd) return;
  const [xmin, ymax, xmax, ymin] = brd.getBoundingBox();
  const rx = xmax - xmin,
    ry = ymax - ymin,
    off = 0.04;
  const xLabelPos = [xmax - off * rx, off * ry];
  const yLabelPos = [off * rx, ymax - off * ry];
  const axisFont = ADV.axis.labels.fontSize;
  const axisColor = ADV.axis.style.stroke;
  if (!xName) {
    xName = brd.create('text', [...xLabelPos, () => ADV.axis.labels.x || 'x'], {
      display: 'internal',
      anchorX: 'left',
      anchorY: 'bottom',
      fixed: true,
      fontSize: axisFont,
      layer: 40,
      color: axisColor,
      cssStyle: 'pointer-events:none;user-select:none;'
    });
  } else {
    xName.setAttribute({
      fontSize: axisFont,
      color: axisColor
    });
  }
  if (!yName) {
    yName = brd.create('text', [...yLabelPos, () => ADV.axis.labels.y || 'y'], {
      display: 'internal',
      anchorX: 'left',
      anchorY: 'top',
      fixed: true,
      fontSize: axisFont,
      layer: 40,
      color: axisColor,
      cssStyle: 'pointer-events:none;user-select:none;'
    });
  } else {
    yName.setAttribute({
      fontSize: axisFont,
      color: axisColor
    });
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
  if (!brd || !ADV.axis.forceIntegers) return;
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
  const def = ['#9333ea', '#475569', '#ef4444', '#0ea5e9', '#10b981', '#f59e0b'];
  return def[i % def.length];
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
  if (g.domain && Number.isFinite(g.domain.min) && Number.isFinite(g.domain.max)) {
    L = Math.max(L, g.domain.min);
    R = Math.min(R, g.domain.max);
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
  if (!domain || !Number.isFinite(domain.min) || !Number.isFinite(domain.max)) return '';
  const min = formatAltNumber(domain.min);
  const max = formatAltNumber(domain.max);
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
function appendExtraPointsAltText(parsed, sentences) {
  if (!Array.isArray(sentences)) return;
  const points = Array.isArray(parsed === null || parsed === void 0 ? void 0 : parsed.extraPoints) ? parsed.extraPoints.filter(isValidPointArray) : [];
  if (!points.length) return;
  const coords = points.map(formatCoordinateForAlt).filter(Boolean);
  if (!coords.length) return;
  if (coords.length === 1) {
    sentences.push(`Et fast punkt er markert i ${coords[0]}.`);
  } else {
    sentences.push(`Faste punkter er markert i ${joinList(coords)}.`);
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
  if (altTextManager) {
    altTextManager.refresh(reason || 'auto');
  }
}
function applyAltTextToBoard() {
  if (altTextManager) {
    altTextManager.applyCurrent();
  }
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
}
function makeBracketAt(g, x0, side /* -1 = venstre (a), +1 = høyre (b) */, closed) {
  g._br = g._br || {};
  if (g._br[side]) {
    g._br[side].forEach(o => brd.removeObject(o));
    g._br[side] = null;
  }
  if (!g.domain || !ADV.domainMarkers.show) return;
  if (!Number.isFinite(x0)) return;
  const [xmin, ymax, xmax, ymin] = brd.getBoundingBox();
  const rx = (xmax - xmin) / brd.canvasWidth;
  const ry = (ymax - ymin) / brd.canvasHeight;
  const baseH = Math.max((xmax - xmin) / 200, 1e-4);

  // Finn et punkt innover i domenet med finite y
  let xS = x0,
    yS = g.fn(xS),
    tries = 0,
    inward = side < 0 ? +1 : -1;
  while (!Number.isFinite(yS) && tries < 12) {
    xS = x0 + inward * (tries + 1) * baseH;
    try {
      yS = g.fn(xS);
    } catch (_) {
      yS = NaN;
    }
    tries++;
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
  const LEN = ADV.domainMarkers.barPx;
  const CAP = Math.max(4, LEN * (ADV.domainMarkers.tipFrac || 0.2));
  const [wx, wy] = px2world(nx, ny, LEN / 2);
  const A = [xS - wx, yS - wy];
  const B = [xS + wx, yS + wy];
  const style = {
    strokeColor: ADV.domainMarkers.color,
    strokeWidth: ADV.domainMarkers.width,
    fixed: true,
    highlight: false,
    layer: ADV.domainMarkers.layer
  };
  const [ux, uy] = px2world(tx, ty, CAP);
  const segments = [];
  if (closed) {
    const dir = -side;
    const back = brd.create('segment', [A, B], style);
    const cap1 = brd.create('segment', [A, [A[0] + dir * ux, A[1] + dir * uy]], style);
    const cap2 = brd.create('segment', [B, [B[0] + dir * ux, B[1] + dir * uy]], style);
    segments.push(back, cap1, cap2);
  } else {
    const dir = side;
    const tip = [xS + dir * ux, yS + dir * uy];
    segments.push(brd.create('segment', [A, tip], style));
    segments.push(brd.create('segment', [B, tip], style));
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
  SIMPLE_PARSED.funcs.forEach((f, i) => {
    const color = colorFor(i);
    const fn = parseFunctionSpec(`${f.name}(x)=${f.rhs}`);
    const labelContent = buildCurveLabelContent(f);
    const g = {
      name: f.name,
      color,
      domain: f.domain || null,
      label: labelContent && labelContent.text || '',
      labelContent,
      expression: f.rhs
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
        size: 3,
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
    emitLinePointUpdate({ sync: false, markEdited: false });
  }
}

/* =================== LINJE FRA PUNKTER =================== */
function buildPointsLine() {
  var _SIMPLE_PARSED$funcs$;
  A = null;
  B = null;
  moving = [];
  const first = (_SIMPLE_PARSED$funcs$ = SIMPLE_PARSED.funcs[0]) !== null && _SIMPLE_PARSED$funcs$ !== void 0 ? _SIMPLE_PARSED$funcs$ : {
    rhs: 'ax+b'
  };
  const template = interpretLineTemplate(first.rhs);
  const kind = template.kind || 'two';
  const anchorC = template.anchorC;
  const slopeM = template.slopeM;
  const start0 = ADV.points.start[0],
    start1 = ADV.points.start[1];
  if (kind === 'two') {
    const P0 = brd.create('point', start0.slice(), {
      name: '',
      size: 3,
      face: 'o',
      fillColor: '#fff',
      strokeColor: '#9333ea',
      withLabel: true,
      showInfobox: false
    });
    const P1 = brd.create('point', start1.slice(), {
      name: '',
      size: 3,
      face: 'o',
      fillColor: '#fff',
      strokeColor: '#9333ea',
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
      size: 3,
      face: 'o',
      fillColor: '#fff',
      strokeColor: '#9333ea',
      withLabel: true,
      showInfobox: false
    });
    A = F;
    B = P;
    moving = [P];
  } else {
    const P = brd.create('point', start0.slice(), {
      name: '',
      size: 3,
      face: 'o',
      fillColor: '#fff',
      strokeColor: '#9333ea',
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
  brd.create('line', [A, B], {
    strokeColor: '#9333ea',
    strokeWidth: 4
  });
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

  // Fasit-sjekk (hvis "Riktig:" finnes)
  if (SIMPLE_PARSED.answer) {
    const {
      btn,
      msg,
      setStatus
    } = ensureCheckControls();
    if (btn) {
      btn.style.display = '';
    }
    if (msg) {
      msg.style.display = '';
    }
    setStatus('info', '');
    if (btn) {
      btn.onclick = () => {
        const {
          m,
          b
        } = currentMB();
        const ans = parseAnswerToMB(SIMPLE_PARSED.answer);
        if (!ans) {
          setStatus('err', 'Kunne ikke tolke fasit.');
          return;
        }
        const okM = Math.abs(m - ans.m) <= ADV.check.slopeTol;
        const okB = Math.abs(b - ans.b) <= ADV.check.interTol;
        if (okM && okB) {
          setStatus('ok', `Riktig! ${linearStr(ans.m, ans.b)}`);
        } else {
          setStatus('err', `Ikke helt. Nå: ${linearStr(m, b)}`);
        }
      };
    }
  }
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
function addFixedPoints() {
  if (!Array.isArray(SIMPLE_PARSED.extraPoints)) return;
  for (const pt of SIMPLE_PARSED.extraPoints) {
    const P = brd.create('point', pt.slice(), {
      name: '',
      size: 3,
      face: 'o',
      fillColor: '#fff',
      strokeColor: '#111827',
      withLabel: true,
      fixed: true,
      showInfobox: false
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
      P.on('out', () => P.label.setAttribute({
        visible: false
      }));
    }
  }
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
  if (ADV.axis.forceIntegers) {
    rebuildGrid();
    applyTickSettings();
  }
  placeAxisNames();
  if (MODE === 'functions') {
    rebuildAllFunctionSegments();
    updateAllBrackets();
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
  applyAltTextToBoard();
  refreshAltText('rebuild');
  LAST_RENDERED_SIMPLE = SIMPLE;
}
window.addEventListener('resize', () => {
  var _JXG;
  const resizeBoards = (_JXG = JXG) === null || _JXG === void 0 || (_JXG = _JXG.JSXGraph) === null || _JXG === void 0 ? void 0 : _JXG.resizeBoards;
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
rebuildAll();
window.render = rebuildAll;

/* ====== Sjekk-knapp + status (monteres i #checkArea i HTML) ====== */
function ensureCheckControls() {
  const host = document.getElementById('checkArea') || document.body;
  let btn = document.getElementById('btnCheck');
  let msg = document.getElementById('checkMsg');
  if (!btn) {
    btn = document.createElement('button');
    btn.id = 'btnCheck';
    btn.textContent = 'Sjekk';
    btn.className = 'btn';
    host.appendChild(btn);
  }
  if (!msg) {
    msg = document.createElement('div');
    msg.id = 'checkMsg';
    msg.className = 'status status--info';
    msg.textContent = '';
    host.appendChild(msg);
  }
  const setStatus = (type, text) => {
    msg.className = 'status ' + (type === 'ok' ? 'status--ok' : type === 'err' ? 'status--err' : 'status--info');
    msg.textContent = text || '';
  };
  return {
    btn,
    msg,
    setStatus
  };
}

/* ====== Reset & SVG (robust eksport) ====== */
const btnReset = document.getElementById('btnReset');
if (btnReset) {
  btnReset.addEventListener('click', () => {
    const scr = initialScreen();
    brd.setBoundingBox(toBB(scr), true);
    updateAfterViewChange();
  });
}
const btnSvg = document.getElementById('btnSvg');
if (btnSvg) {
  btnSvg.addEventListener('click', () => {
    const src = brd.renderer.svgRoot.cloneNode(true);
    src.removeAttribute('style');
    const w = brd.canvasWidth,
      h = brd.canvasHeight;
    src.setAttribute('width', `${w}`);
    src.setAttribute('height', `${h}`);
    src.setAttribute('viewBox', `0 0 ${w} ${h}`);
    src.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
    src.setAttribute('xmlns:xlink', 'http://www.w3.org/1999/xlink');
    const xml = new XMLSerializer().serializeToString(src).replace(/\swidth="[^"]*"\s(?=.*width=")/, ' ').replace(/\sheight="[^"]*"\s(?=.*height=")/, ' ');
    const blob = new Blob([xml], {
      type: 'image/svg+xml;charset=utf-8'
    });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'graf.svg';
    a.click();
    URL.revokeObjectURL(a.href);
  });
}
const btnPng = document.getElementById('btnPng');
if (btnPng) {
  btnPng.addEventListener('click', () => {
    const src = brd.renderer.svgRoot.cloneNode(true);
    src.removeAttribute('style');
    const w = brd.canvasWidth,
      h = brd.canvasHeight;
    src.setAttribute('width', `${w}`);
    src.setAttribute('height', `${h}`);
    src.setAttribute('viewBox', `0 0 ${w} ${h}`);
    src.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
    src.setAttribute('xmlns:xlink', 'http://www.w3.org/1999/xlink');
    const xml = new XMLSerializer().serializeToString(src).replace(/\swidth="[^"]*"\s(?=.*width=")/, ' ').replace(/\sheight="[^"]*"\s(?=.*height=")/, ' ');
    const svgBlob = new Blob([xml], {
      type: 'image/svg+xml;charset=utf-8'
    });
    const url = URL.createObjectURL(svgBlob);
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0);
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
  const showBracketsInput = g('cfgShowBrackets');
  const forceTicksInput = g('cfgForceTicks');
  const snapCheckbox = g('cfgSnap');
  const drawBtn = g('btnDraw');
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
  const ensureMathFieldOptions = field => {
    if (field && typeof field.setOptions === 'function') {
      field.setOptions({
        smartMode: false,
        virtualKeyboardMode: 'off'
      });
    }
  };
  const setFunctionInputValue = (element, value) => {
    if (!element) return;
    const str = value != null ? String(value) : '';
    const tag = element.tagName ? element.tagName.toUpperCase() : '';
    if (tag === MATHFIELD_TAG) {
      ensureMathFieldOptions(element);
      if (typeof element.setValue === 'function') {
        try {
          element.setValue(str, { format: 'ascii-math' });
          return;
        } catch (_) {
          // fall back to latex
        }
      }
      const latex = convertExpressionToLatex(str);
      element.value = latex;
      return;
    }
    element.value = str;
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
  const formatNumber = val => {
    if (typeof val !== 'number') return '';
    if (!Number.isFinite(val)) return '';
    const str = String(val);
    return str.replace(/\.0+(?=$)/, '').replace(/(\.\d*?)0+(?=$)/, '$1');
  };
  const parseStartXValues = value => {
    if (!value) return [];
    const matches = String(value).match(/-?\d+(?:[.,]\d+)?/g);
    if (!matches) return [];
    return matches.map(str => Number.parseFloat(str.replace(',', '.'))).filter(Number.isFinite);
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
    return `(${formatNumber(x)}, ${formatNumber(y)})`;
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
    const clones = points.map(pt => Array.isArray(pt) ? pt.slice(0, 2) : null).filter(pt => Array.isArray(pt) && pt.length === 2 && pt.every(Number.isFinite));
    if (!clones.length) {
      return false;
    }
    if (SIMPLE_PARSED && typeof SIMPLE_PARSED === 'object') {
      SIMPLE_PARSED.linePoints = clones.map(pt => pt.slice());
    }
    if (Array.isArray(ADV.points.start)) {
      for (let i = 0; i < clones.length && i < ADV.points.start.length; i++) {
        ADV.points.start[i] = clones[i].slice();
      }
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
    return getLinePointCount(spec) === 0;
  };
  const hasConfiguredPoints = () => {
    const parsedMode = SIMPLE_PARSED ? decideMode(SIMPLE_PARSED) : 'functions';
    if (parsedMode === 'points') {
      return true;
    }
    if (shouldEnableGliders() && getGliderCount() > 0) {
      return true;
    }
    const firstValue = getFirstFunctionValue();
    if (firstValue && !isCoords(firstValue) && !isExplicitFun(firstValue)) {
      return true;
    }
    const parsedCount = SIMPLE_PARSED && Number.isFinite(SIMPLE_PARSED.pointsCount) ? SIMPLE_PARSED.pointsCount : 0;
    return parsedCount > 0;
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
    }
    updateSnapAvailability();
  };
  if (snapCheckbox) {
    snapCheckbox.checked = ADV.points.snap.enabled;
  }
  const updateStartInputState = () => {
    if (!gliderStartInput) return;
    const showInput = shouldShowStartInput();
    const count = getGliderCount();
    gliderStartInput.disabled = !showInput || count <= 0;
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
    const show = shouldEnableGliders();
    const visibilityChanged = show !== glidersVisible;
    glidersVisible = show;
    gliderSection.style.display = show ? '' : 'none';
    const forcedChanged = applyForcedGliderCount(show);
    updateStartInputState();
    if (visibilityChanged || forcedChanged) {
      syncSimpleFromForm();
    }
  };
  const buildSimpleFromForm = () => {
    var _rows$;
    const rows = funcRows ? Array.from(funcRows.querySelectorAll('.func-group')) : [];
    const firstInput = (_rows$ = rows[0]) === null || _rows$ === void 0 ? void 0 : _rows$.querySelector('[data-fun]');
    const firstVal = firstInput ? getFunctionInputValue(firstInput) : '';
    const firstIsCoords = !!firstVal && isCoords(firstVal);
    const lineSpec = interpretLineTemplateFromExpression(firstVal);
    const neededLinePoints = getLinePointCount(lineSpec);
    const lines = [];
    rows.forEach((row, idx) => {
      const funInput = row.querySelector('[data-fun]');
      const domInput = row.querySelector('input[data-dom]');
      if (!funInput) return;
      const fun = getFunctionInputValue(funInput);
      if (!fun) return;
      if (idx === 0 && firstIsCoords) {
        lines.push(`coords=${fun}`);
        return;
      }
      const dom = domInput ? domInput.value.trim() : '';
      lines.push(dom ? `${fun}, x in ${dom}` : fun);
    });
    const hasCoordsLine = lines.some(L => /^\s*coords\s*=/i.test(L));
    const hasPointsLine = lines.some(L => /^\s*points\s*=/i.test(L));
    const hasStartXLine = lines.some(L => /^\s*startx\s*=/i.test(L));
    const hasLinePtsLine = lines.some(L => /^\s*linepts\s*=/i.test(L));
    const hasAnswerLine = lines.some(L => /^\s*riktig\s*:/i.test(L));
    const glidersActive = shouldEnableGliders();
    const gliderCount = glidersActive ? getGliderCount() : 0;
    if (glidersActive && !hasPointsLine && gliderCount > 0) {
      lines.push(`points=${gliderCount}`);
    }
    if (glidersActive && shouldShowStartInput() && !hasStartXLine && gliderCount > 0) {
      const startValues = parseStartXValues((gliderStartInput === null || gliderStartInput === void 0 ? void 0 : gliderStartInput.value) || '');
      if (startValues.length) {
        lines.push(`startx=${startValues.map(formatNumber).join(', ')}`);
      }
    }
    if (!hasCoordsLine && Array.isArray(SIMPLE_PARSED.extraPoints)) {
      const coords = SIMPLE_PARSED.extraPoints.filter(pt => Array.isArray(pt) && pt.length === 2 && pt.every(Number.isFinite)).map(pt => `(${formatNumber(pt[0])}, ${formatNumber(pt[1])})`);
      if (coords.length) {
        lines.push(`coords=${coords.join('; ')}`);
      }
    }
    if (!hasLinePtsLine && neededLinePoints > 0 && (linePointsEdited || Array.isArray(SIMPLE_PARSED.linePoints) && SIMPLE_PARSED.linePoints.length > 0)) {
      const exportPoints = gatherLinePointsForExport(neededLinePoints);
      if (exportPoints.length === neededLinePoints) {
        lines.push(`linepts=${formatLinePoints(exportPoints)}`);
      }
    }
    if (!hasAnswerLine && SIMPLE_PARSED.answer) {
      lines.push(`riktig: ${SIMPLE_PARSED.answer}`);
    }
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
  const handleGliderCountChange = () => {
    updateStartInputState();
    syncSimpleFromForm();
  };
  if (gliderCountInput) {
    const onCountChange = () => {
      updateStartInputState();
      syncSimpleFromForm();
    };
    gliderCountInput.addEventListener('input', onCountChange);
    gliderCountInput.addEventListener('change', onCountChange);
  }
  if (gliderStartInput) {
    gliderStartInput.addEventListener('input', syncSimpleFromForm);
  }
  const toggleDomain = input => {
    const row = input.closest('.func-group');
    if (!row) return;
    const domLabel = row.querySelector('label.domain');
    if (isExplicitFun(getFunctionInputValue(input))) {
      if (domLabel) domLabel.style.display = '';
    } else {
      if (domLabel) {
        domLabel.style.display = 'none';
        const domInput = domLabel.querySelector('input[data-dom]');
        if (domInput) domInput.value = '';
      }
    }
    updateGliderVisibility();
    updateLinePointControls({ silent: true });
  };
  const createRow = (index, funVal = '', domVal = '') => {
    const row = document.createElement('fieldset');
    row.className = 'func-group';
    row.dataset.index = String(index);
    const titleLabel = index === 1 ? 'Funksjon eller punkter' : 'Funksjon ' + index;
    if (index === 1) {
      row.innerHTML = `
        <legend>Funksjon ${index}</legend>
        <div class="func-fields func-fields--first">
          <div class="func-row func-row--main">
            <label class="func-input">
              <span>${titleLabel}</span>
              <div class="func-editor">
                <math-field data-fun class="func-math-field" ${mathFieldKeyboardAttr} smart-mode="false" aria-label="${titleLabel}"></math-field>
              </div>
            </label>
            <label class="domain">
              <span>Avgrensning</span>
              <input type="text" data-dom placeholder="[start, stopp]">
            </label>
          </div>
          <div class="func-row func-row--gliders glider-row">
            <label class="points">
              <span>Antall punkter på grafen</span>
              <select data-points>
                <option value="0">0</option>
                <option value="1">1</option>
                <option value="2">2</option>
              </select>
            </label>
            <div class="linepoints-row">
              <label class="linepoint" data-linepoint-label="0">
                <span>Punkt 1 (x, y)</span>
                <input type="text" data-linepoint="0" placeholder="(0, 0)">
              </label>
              <label class="linepoint" data-linepoint-label="1">
                <span>Punkt 2 (x, y)</span>
                <input type="text" data-linepoint="1" placeholder="(1, 1)">
              </label>
            </div>
            <label class="startx-label">
              <span>Startposisjon, x</span>
              <input type="text" data-startx value="1" placeholder="1">
            </label>
          </div>
        </div>
      `;
    } else {
      row.innerHTML = `
        <legend>Funksjon ${index}</legend>
        <div class="func-fields">
          <label class="func-input">
            <span>${titleLabel}</span>
            <div class="func-editor">
              <math-field data-fun class="func-math-field" ${mathFieldKeyboardAttr} smart-mode="false" aria-label="${titleLabel}"></math-field>
            </div>
          </label>
          <label class="domain">
            <span>Avgrensning</span>
            <input type="text" data-dom placeholder="[start, stopp]">
          </label>
        </div>
      `;
    }
    if (funcRows) {
      funcRows.appendChild(row);
    }
    const funInput = row.querySelector('[data-fun]');
    const domInput = row.querySelector('input[data-dom]');
    if (funInput) {
      setFunctionInputValue(funInput, funVal || '');
      const handleChange = () => {
        toggleDomain(funInput);
        updateLinePointControls();
        syncSimpleFromForm();
      };
      funInput.addEventListener('input', handleChange);
      funInput.addEventListener('change', handleChange);
    }
    if (domInput) {
      domInput.value = domVal || '';
      domInput.addEventListener('input', syncSimpleFromForm);
    }
    if (index === 1) {
      gliderSection = row.querySelector('.glider-row');
      if (gliderSection) {
        gliderSection.style.display = 'none';
      }
      gliderCountInput = row.querySelector('[data-points]');
      gliderStartInput = row.querySelector('input[data-startx]');
      gliderStartLabel = gliderStartInput ? gliderStartInput.closest('label') : null;
      if (gliderCountInput) {
        gliderCountInput.addEventListener('input', handleGliderCountChange);
        gliderCountInput.addEventListener('change', handleGliderCountChange);
      }
      if (gliderStartInput) {
        gliderStartInput.addEventListener('input', syncSimpleFromForm);
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
        const handleLinePointInputChange = () => {
          const parsed = parseLinePointInput(input.value);
          if (parsed) {
            input.value = formatPointInputValue(parsed);
          }
          linePointsEdited = true;
          syncLinePointsToBoardFromInputs();
          syncSimpleFromForm();
        };
        input.addEventListener('input', handleLinePointInputChange);
        input.addEventListener('change', handleLinePointInputChange);
      });
    }
    if (funInput) {
      toggleDomain(funInput);
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
      funcRows.innerHTML = '';
    }
    glidersVisible = false;
    forcedGliderCount = null;
    filteredLines.forEach((line, idx) => {
      let funVal = line;
      let domVal = '';
      const domMatch = line.match(/,\s*x\s*(?:in|∈)\s*(.+)$/i);
      if (domMatch) {
        funVal = line.slice(0, domMatch.index).trim();
        domVal = domMatch[1].trim();
      }
      createRow(idx + 1, funVal, domVal);
    });
    if (gliderCountInput) {
      var _SIMPLE_PARSED;
      const count = Number.isFinite((_SIMPLE_PARSED = SIMPLE_PARSED) === null || _SIMPLE_PARSED === void 0 ? void 0 : _SIMPLE_PARSED.pointsCount) ? SIMPLE_PARSED.pointsCount : 0;
      const clamped = Math.max(0, Math.min(2, count));
      gliderCountInput.value = String(clamped);
    }
    if (gliderStartInput) {
      var _SIMPLE_PARSED2;
      const startVals = Array.isArray((_SIMPLE_PARSED2 = SIMPLE_PARSED) === null || _SIMPLE_PARSED2 === void 0 ? void 0 : _SIMPLE_PARSED2.startX) ? SIMPLE_PARSED.startX.filter(Number.isFinite) : [];
      gliderStartInput.value = startVals.length ? startVals.map(formatNumber).join(', ') : '1';
    }
    if (linePointInputs.length && SIMPLE_PARSED) {
      const resolvedPoints = resolveLineStartPoints(SIMPLE_PARSED);
      setLinePointInputValues(resolvedPoints);
    }
    updateGliderVisibility();
    updateLinePointControls({ silent: true });
    syncSimpleFromForm();
    updateSnapAvailability();
    refreshAltText('form-fill');
  };
  fillFormFromSimple(SIMPLE);
  if (addBtn) {
    addBtn.addEventListener('click', () => {
      const index = (funcRows ? funcRows.querySelectorAll('.func-group').length : 0) + 1;
      createRow(index, '', '');
      syncSimpleFromForm();
    });
  }
  if (typeof window !== 'undefined') {
    window.addEventListener('examples:loaded', () => {
      fillFormFromSimple(window.SIMPLE);
    });
  }
  g('cfgScreen').value = paramStr('screen', '');
  g('cfgLock').checked = params.has('lock') ? paramBool('lock') : true;
  g('cfgAxisX').value = paramStr('xName', 'x');
  g('cfgAxisY').value = paramStr('yName', 'y');
  g('cfgPan').checked = paramBool('pan');
  g('cfgQ1').checked = paramBool('q1');
  if (showNamesInput) {
    showNamesInput.checked = !!ADV.curveName.showName;
  }
  if (showExprInput) {
    showExprInput.checked = !!ADV.curveName.showExpression;
  }
  if (showBracketsInput) {
    showBracketsInput.checked = !!ADV.domainMarkers.show;
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
    const screenInput = g('cfgScreen');
    const screenRaw = screenInput ? screenInput.value.trim() : '';
    const nextScreen = screenInput ? parseScreen(screenRaw) : null;
    if (!screensEqual(nextScreen, ADV.screen)) {
      ADV.screen = nextScreen;
      needsRebuild = true;
    }
    const lockInput = g('cfgLock');
    const lockChecked = !!(lockInput && lockInput.checked);
    if (ADV.lockAspect !== lockChecked) {
      ADV.lockAspect = lockChecked;
      needsRebuild = true;
    }
    const axisXInput = g('cfgAxisX');
    const axisYInput = g('cfgAxisY');
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
    const panInput = g('cfgPan');
    const panChecked = !!(panInput && panInput.checked);
    if (ADV.interactions.pan.enabled !== panChecked) {
      ADV.interactions.pan.enabled = panChecked;
      needsRebuild = true;
    }
    const q1Input = g('cfgQ1');
    const q1Checked = !!(q1Input && q1Input.checked);
    if (ADV.firstQuadrant !== q1Checked) {
      ADV.firstQuadrant = q1Checked;
      needsRebuild = true;
    }
    const showNamesChecked = showNamesInput ? !!showNamesInput.checked : !!(ADV.curveName && ADV.curveName.showName);
    const showExprChecked = showExprInput ? !!showExprInput.checked : !!(ADV.curveName && ADV.curveName.showExpression);
    const showBracketsChecked = showBracketsInput ? !!showBracketsInput.checked : !!(ADV.domainMarkers && ADV.domainMarkers.show);
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
    if (showBracketsInput && ADV.domainMarkers.show !== showBracketsChecked) {
      ADV.domainMarkers.show = showBracketsChecked;
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
    let idx = 1;
    (funcRows ? funcRows.querySelectorAll('.func-group') : []).forEach((row, rowIdx) => {
      const funInput = row.querySelector('[data-fun]');
      const fun = funInput ? getFunctionInputValue(funInput) : '';
      const dom = row.querySelector('input[data-dom]').value.trim();
      if (!fun) return;
      if (rowIdx === 0 && isCoords(fun)) {
        p.set('coords', fun);
      } else {
        p.set(`fun${idx}`, fun);
        if (dom) p.set(`dom${idx}`, dom);
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
            p.set('startx', startVals.map(formatNumber).join(', '));
          }
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
    if (panChecked) p.set('pan', '1');
    if (showNamesInput) {
      p.set('showNames', showNamesChecked ? '1' : '0');
    }
    if (showExprInput) {
      p.set('showExpr', showExprChecked ? '1' : '0');
    }
    if (showBracketsInput) {
      p.set('brackets', showBracketsChecked ? '1' : '0');
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
      rebuildAll();
    }
  };
  root.addEventListener('change', apply);
  root.addEventListener('keydown', e => {
    if (e.key === 'Enter') apply();
  });
  if (drawBtn) {
    drawBtn.addEventListener('click', () => {
      apply();
    });
  }
}
