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
function parseScreen(str) {
  if (!str) return null;
  const cleaned = str.replace(/^[\s\[]+|[\]\s]+$/g, '');
  const parts = cleaned.split(',').map(s => +s.trim());
  return parts.length === 4 && parts.every(Number.isFinite) ? parts : null;
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
  return lines.join('\n');
}
let SIMPLE = typeof window !== 'undefined' && typeof window.SIMPLE !== 'undefined' ? window.SIMPLE : buildSimple();
if (typeof window !== 'undefined') {
  window.SIMPLE = SIMPLE;
}

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
    }
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

/* ======================= Parser / modus ======================= */
function parseSimple(txt) {
  const lines = (txt || '').split('\n').map(s => s.trim()).filter(Boolean);
  const out = {
    funcs: [],
    pointsCount: 0,
    startX: [],
    extraPoints: [],
    answer: null,
    raw: txt
  };
  const parseDomain = dom => {
    if (!dom) return null;
    const cleaned = dom.trim();
    if (!cleaned) return null;
    if (/^r$/i.test(cleaned) || /^ℝ$/i.test(cleaned)) return null;
    const dm = cleaned.match(/^\[\s*([+-]?\d*\.?\d+)\s*,\s*([+-]?\d*\.?\d+)\s*\]$/i);
    return dm ? [+dm[1], +dm[2]] : null;
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
let START_SCREEN = null;
let brd = null;
let axX = null;
let axY = null;
let xName = null;
let yName = null;
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
  rhs = rhs.replace(/(^|[=+\-*/])\s*([+-])\s*([a-zA-Z0-9._()]+)\s*\^/g, (m, p, s, b) => p + '0' + s + '(' + b + ')^').replace(/\^/g, '**').replace(/(\d)([a-zA-Z(])/g, '$1*$2').replace(/([x\)])\(/g, '$1*(').replace(/x(\d)/g, 'x*$1').replace(/\bln\(/gi, 'log(').replace(/\bpi\b/gi, 'PI').replace(/\be\b/gi, 'E').replace(/\btau\b/gi, '(2*PI)');
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
  if (includeEndVals) {
    try {
      const ya = fn(a);
      if (Number.isFinite(ya)) endVals.push({
        x: a,
        y: ya
      });
    } catch (_) {}
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
      domMin = Math.min(domMin, f.domain[0]);
      domMax = Math.max(domMax, f.domain[1]);
      feats.push({
        hasDom: true,
        fn,
        a: f.domain[0],
        b: f.domain[1],
        ...sampleFeatures(fn, f.domain[0], f.domain[1], {
          includeEndVals: true
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
      JXG.JSXGraph.freeBoard(brd);
    } catch (_) {}
  }
  brd = null;
  axX = null;
  axY = null;
  xName = null;
  yName = null;
  gridV = [];
  gridH = [];
  graphs = [];
  A = null;
  B = null;
  moving = [];
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
  const tickBase = {
    drawLabels: true,
    precision: ADV.axis.grid.labelPrecision
  };
  const labelBase = {
    fontSize: ADV.axis.grid.fontSize
  };
  axX.defaultTicks.setAttribute({
    ...tickBase,
    ticksDistance: +ADV.axis.grid.majorX || 1,
    minorTicks: 0,
    label: {
      ...labelBase,
      display: 'internal',
      anchorX: 'middle',
      anchorY: 'top',
      offset: [0, -8]
    }
  });
  axY.defaultTicks.setAttribute({
    ...tickBase,
    ticksDistance: +ADV.axis.grid.majorY || 1,
    minorTicks: 0,
    label: {
      ...labelBase,
      display: 'internal',
      anchorX: 'right',
      anchorY: 'middle',
      offset: [-8, 0]
    }
  });
}
function initBoard() {
  START_SCREEN = initialScreen();
  brd = JXG.JSXGraph.initBoard('board', {
    boundingbox: toBB(START_SCREEN),
    axis: true,
    grid: false,
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
  const nodes = [label && label.rendNode, label && label.rendNodeText && label.rendNodeText.parentNode, label && label.rendNodeText];
  for (const node of nodes) {
    const res = tryBBox(node);
    if (res) return res;
  }
  for (const node of nodes) {
    const res = tryRect(node);
    if (res) return res;
  }
  const text = label && label.plaintext || 'f(x)';
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
  if (g.domain && g.domain.length === 2) {
    L = Math.max(L, g.domain[0]);
    R = Math.min(R, g.domain[1]);
  }
  if (!(R > L)) return;
  const vas = ADV.asymptote.detect && ADV.asymptote.showVertical ? detectVerticalAsymptotes(g.fn, L, R, 1000, ADV.asymptote.hugeY) : [];
  const xs = [L, ...vas.filter(x => x > L && x < R), R].sort((a, b) => a - b);
  const eps = (R - L) * 1e-6;
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
    const leftOpen = i > 0;
    const rightOpen = i < xs.length - 2;
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
function makeSmartCurveLabel(g, idx, text) {
  if (!ADV.curveName.show || !text) return;
  const label = brd.create('text', [0, 0, () => text], {
    color: g.color,
    fillColor: g.color,
    fontSize: ADV.curveName.fontSize,
    fixed: true,
    highlight: false,
    layer: ADV.curveName.layer,
    anchorX: 'left',
    anchorY: 'middle',
    display: 'internal',
    cssStyle: 'user-select:none;cursor:move;touch-action:none;'
  });
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
    const a = g.domain ? g.domain[0] : xmin,
      b = g.domain ? g.domain[1] : xmax;
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
function makeBracketAt(g, x0, side /* -1 = venstre (a), +1 = høyre (b) */) {
  g._br = g._br || {};
  if (g._br[side]) {
    g._br[side].forEach(o => brd.removeObject(o));
    g._br[side] = null;
  }
  if (!g.domain || !ADV.domainMarkers.show) return;
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
  const back = brd.create('segment', [A, B], style);

  // caps peker innover: retning = -side * t
  const [ux, uy] = px2world(tx, ty, CAP);
  const dir = -side;
  const cap1 = brd.create('segment', [A, [A[0] + dir * ux, A[1] + dir * uy]], style);
  const cap2 = brd.create('segment', [B, [B[0] + dir * ux, B[1] + dir * uy]], style);
  g._br[side] = [back, cap1, cap2];
}
function updateAllBrackets() {
  for (const g of graphs) {
    if (!g.domain) continue;
    makeBracketAt(g, g.domain[0], -1);
    makeBracketAt(g, g.domain[1], +1);
  }
}
function buildCurveLabelText(fun) {
  var _ADV$curveName, _ADV$curveName2;
  const showName = !!(ADV !== null && ADV !== void 0 && (_ADV$curveName = ADV.curveName) !== null && _ADV$curveName !== void 0 && _ADV$curveName.showName);
  const showExpr = !!(ADV !== null && ADV !== void 0 && (_ADV$curveName2 = ADV.curveName) !== null && _ADV$curveName2 !== void 0 && _ADV$curveName2.showExpression);
  if (!showName && !showExpr) return '';
  const nameText = typeof (fun === null || fun === void 0 ? void 0 : fun.label) === 'string' ? fun.label.trim() : '';
  const exprText = typeof (fun === null || fun === void 0 ? void 0 : fun.rhs) === 'string' ? fun.rhs.trim() : '';
  if (showName && showExpr) {
    if (nameText && exprText) return `${nameText} = ${exprText}`;
    return nameText || exprText;
  }
  if (showName && nameText) return nameText;
  if (showExpr && exprText) return exprText;
  return '';
}
function buildFunctions() {
  graphs = [];
  SIMPLE_PARSED.funcs.forEach((f, i) => {
    const color = colorFor(i);
    const fn = parseFunctionSpec(`${f.name}(x)=${f.rhs}`);
    const label = buildCurveLabelText(f);
    const g = {
      name: f.name,
      color,
      domain: f.domain || null,
      label,
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
    const xMinCarrier = g.domain ? g.domain[0] : () => brd.getBoundingBox()[0];
    const xMaxCarrier = g.domain ? g.domain[1] : () => brd.getBoundingBox()[2];
    g.carrier = brd.create('functiongraph', [g.fn, xMinCarrier, xMaxCarrier], {
      visible: false,
      strokeOpacity: 0,
      fixed: true
    });
    graphs.push(g);
    if (label) {
      makeSmartCurveLabel(g, i, label);
    }
  });
  rebuildAllFunctionSegments();
  updateAllBrackets();

  // glidere
  const n = SIMPLE_PARSED.pointsCount | 0;
  if (n > 0 && graphs.length > 0) {
    const G = graphs[0];
    const sxList = SIMPLE_PARSED.startX && SIMPLE_PARSED.startX.length > 0 ? SIMPLE_PARSED.startX : ADV.points.startX && ADV.points.startX.length > 0 ? ADV.points.startX : [0];
    function stepXg() {
      return (ADV.points.snap.stepX != null ? ADV.points.snap.stepX : +ADV.axis.grid.majorX) || 1;
    }
    const clampToDomain = x => G.domain ? Math.min(G.domain[1], Math.max(G.domain[0], x)) : x;
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

      // HARD KLAMMING TIL DOMENE UNDER DRAG
      P.on('drag', () => {
        let x = clampToDomain(P.X());
        P.moveTo([x, G.fn(x)]);
        if (ADV.points.snap.enabled && (ADV.points.snap.mode || 'up') === 'drag') applySnap(P);
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
        P.on('up', () => applySnap(P));
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
  const rhs = first.rhs.replace(/\s+/g, '').toLowerCase();
  let kind = 'two',
    anchorC = 0,
    slopeM = 1;
  if (/^a\*?x([+-])(\d+(?:\.\d+)?)$/.test(rhs)) {
    kind = 'anchorY';
    anchorC = RegExp.$1 === '-' ? -parseFloat(RegExp.$2) : parseFloat(RegExp.$2);
  } else if (/^([+-]?\d*(?:\.\d+)?)\*?x\+b$/.test(rhs)) {
    kind = 'fixedSlope';
    const raw = RegExp.$1;
    slopeM = raw === '' || raw === '+' ? 1 : raw === '-' ? -1 : parseFloat(raw);
  }
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
  rebuildGrid();
  applyTickSettings();
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
  MODE = decideMode(SIMPLE_PARSED);
  hideCheckControls();
  destroyBoard();
  initBoard();
  if (!brd) return;
  if (MODE === 'functions') {
    buildFunctions();
  } else {
    buildPointsLine();
  }
  addFixedPoints();
  brd.on('boundingbox', updateAfterViewChange);
  updateAfterViewChange();
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
  const functionsHost = document.querySelector('.function-controls');
  if (functionsHost && addBtn.parentElement !== functionsHost) {
    functionsHost.appendChild(addBtn);
  }
  const g = id => document.getElementById(id);
  const showNamesInput = g('cfgShowNames');
  const showExprInput = g('cfgShowExpr');
  const showBracketsInput = g('cfgShowBrackets');
  let gliderSection = null;
  let gliderCountInput = null;
  let gliderStartInput = null;
  let gliderStartLabel = null;
  const isCoords = str => /^\s*(?:\(\s*-?\d+(?:\.\d+)?\s*,\s*-?\d+(?:\.\d+)?\s*\)|-?\d+(?:\.\d+)?\s*,\s*-?\d+(?:\.\d+)?)(?:\s*;\s*(?:\(\s*-?\d+(?:\.\d+)?\s*,\s*-?\d+(?:\.\d+)?\s*\)|-?\d+(?:\.\d+)?\s*,\s*-?\d+(?:\.\d+)?))*\s*$/.test(str);
  const isExplicitFun = str => {
    const m = str.match(/^[a-zA-Z]\w*\s*\(\s*x\s*\)\s*=\s*(.+)$/) || str.match(/^y\s*=\s*(.+)$/i);
    const rhs = m ? m[1] : str;
    if (!/x/.test(rhs)) return false;
    return isExplicitRHS(rhs);
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
  const getGliderCount = () => {
    if (!gliderCountInput) return 0;
    const n = Number.parseInt(gliderCountInput.value, 10);
    if (!Number.isFinite(n)) return 0;
    const clamped = Math.max(0, Math.min(2, n));
    return clamped > 0 ? clamped : 0;
  };
  const shouldEnableGliders = () => {
    if (!funcRows) return false;
    const firstGroup = funcRows.querySelector('.func-group');
    if (!firstGroup) return false;
    const firstRowInput = firstGroup.querySelector('input[data-fun]');
    if (!firstRowInput) return false;
    const value = firstRowInput.value.trim();
    if (!value) return false;
    if (isCoords(value)) return false;
    return isExplicitFun(value);
  };
  const updateStartInputState = () => {
    if (!gliderStartInput) return;
    const active = shouldEnableGliders();
    const count = getGliderCount();
    gliderStartInput.disabled = !active || count <= 0;
    if (gliderStartLabel) {
      gliderStartLabel.style.display = active && count > 0 ? '' : 'none';
    }
  };
  const updateGliderVisibility = () => {
    if (!gliderSection) return;
    const show = shouldEnableGliders();
    gliderSection.style.display = show ? '' : 'none';
    if (gliderCountInput) {
      gliderCountInput.disabled = !show;
    }
    updateStartInputState();
  };
  const buildSimpleFromForm = () => {
    var _rows$;
    const rows = funcRows ? Array.from(funcRows.querySelectorAll('.func-group')) : [];
    const firstVal = ((_rows$ = rows[0]) === null || _rows$ === void 0 || (_rows$ = _rows$.querySelector('input[data-fun]')) === null || _rows$ === void 0 ? void 0 : _rows$.value.trim()) || '';
    const firstIsCoords = !!firstVal && isCoords(firstVal);
    const lines = [];
    rows.forEach((row, idx) => {
      const funInput = row.querySelector('input[data-fun]');
      const domInput = row.querySelector('input[data-dom]');
      if (!funInput) return;
      const fun = funInput.value.trim();
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
    const hasAnswerLine = lines.some(L => /^\s*riktig\s*:/i.test(L));
    const glidersActive = shouldEnableGliders();
    const gliderCount = glidersActive ? getGliderCount() : 0;
    if (glidersActive && !hasPointsLine && gliderCount > 0) {
      lines.push(`points=${gliderCount}`);
    }
    if (glidersActive && !hasStartXLine && gliderCount > 0) {
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
    if (!hasAnswerLine && SIMPLE_PARSED.answer) {
      lines.push(`riktig: ${SIMPLE_PARSED.answer}`);
    }
    return lines.join('\n');
  };
  const syncSimpleFromForm = () => {
    const simple = buildSimpleFromForm();
    if (simple === SIMPLE) return;
    SIMPLE = simple;
    if (typeof window !== 'undefined') {
      window.SIMPLE = SIMPLE;
    }
  };
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
    if (isExplicitFun(input.value.trim())) {
      if (domLabel) domLabel.style.display = '';
    } else {
      if (domLabel) {
        domLabel.style.display = 'none';
        const domInput = domLabel.querySelector('input[data-dom]');
        if (domInput) domInput.value = '';
      }
    }
    updateGliderVisibility();
  };
  const createRow = (index, funVal = '', domVal = '') => {
    const row = document.createElement('fieldset');
    row.className = 'func-group';
    row.dataset.index = String(index);
    const titleLabel = index === 1 ? 'Funksjon eller punkter' : 'Funksjon ' + index;
    row.innerHTML = `
      <legend>Funksjon ${index}</legend>
      <div class="func-fields">
        <label class="func-input">
          <span>${titleLabel}</span>
          <input type="text" data-fun>
        </label>
        <label class="domain">
          <span>Avgrensning</span>
          <input type="text" data-dom placeholder="[start, stopp]">
        </label>
      </div>
      ${index === 1 ? `
      <div class="glider-controls">
        <label class="points">
          <span>Antall punkter på grafen</span>
          <select data-points>
            <option value="0">0</option>
            <option value="1">1</option>
            <option value="2">2</option>
          </select>
        </label>
        <label class="startx-label">
          <span>Startposisjon, x</span>
          <input type="text" data-startx value="1" placeholder="1">
        </label>
      </div>
      ` : ''}
    `;
    if (funcRows) {
      funcRows.appendChild(row);
    }
    const funInput = row.querySelector('input[data-fun]');
    const domInput = row.querySelector('input[data-dom]');
    if (funInput) {
      funInput.value = funVal || '';
      funInput.addEventListener('input', () => {
        toggleDomain(funInput);
        syncSimpleFromForm();
      });
    }
    if (domInput) {
      domInput.value = domVal || '';
      domInput.addEventListener('input', syncSimpleFromForm);
    }
    if (index === 1) {
      gliderSection = row.querySelector('.glider-controls');
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
    }
    const lines = text.split(/\r?\n/).map(line => line.trim()).filter(line => line.length > 0);
    const filteredLines = lines.filter(line => !/^\s*points\s*=/i.test(line) && !/^\s*startx\s*=/i.test(line));
    if (filteredLines.length === 0) {
      filteredLines.push('');
    }
    if (funcRows) {
      gliderSection = null;
      gliderCountInput = null;
      gliderStartInput = null;
      gliderStartLabel = null;
      funcRows.innerHTML = '';
    }
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
    updateGliderVisibility();
    syncSimpleFromForm();
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
  const snapCheckbox = g('cfgSnap');
  if (snapCheckbox) {
    snapCheckbox.checked = ADV.points.snap.enabled;
  }
  const fontSizeInput = g('cfgFontSize');
  if (fontSizeInput) {
    fontSizeInput.value = String(sanitizeFontSize(ADV.axis.grid.fontSize, FONT_DEFAULT));
  }
  const apply = () => {
    syncSimpleFromForm();
    const p = new URLSearchParams();
    let idx = 1;
    (funcRows ? funcRows.querySelectorAll('.func-group') : []).forEach((row, rowIdx) => {
      const fun = row.querySelector('input[data-fun]').value.trim();
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
        const startVals = parseStartXValues((gliderStartInput === null || gliderStartInput === void 0 ? void 0 : gliderStartInput.value) || '');
        if (startVals.length) {
          p.set('startx', startVals.map(formatNumber).join(', '));
        }
      }
    }
    if (g('cfgScreen').value.trim()) p.set('screen', g('cfgScreen').value.trim());
    if (g('cfgLock').checked) p.set('lock', '1');else p.set('lock', '0');
    if (g('cfgAxisX').value.trim() && g('cfgAxisX').value.trim() !== 'x') p.set('xName', g('cfgAxisX').value.trim());
    if (g('cfgAxisY').value.trim() && g('cfgAxisY').value.trim() !== 'y') p.set('yName', g('cfgAxisY').value.trim());
    if (g('cfgPan').checked) p.set('pan', '1');
    if (showNamesInput) {
      p.set('showNames', showNamesInput.checked ? '1' : '0');
    }
    if (showExprInput) {
      p.set('showExpr', showExprInput.checked ? '1' : '0');
    }
    if (showBracketsInput) {
      p.set('brackets', showBracketsInput.checked ? '1' : '0');
    }
    const snapInput = g('cfgSnap');
    if (snapInput) {
      if (snapInput.checked) p.set('snap', '1');else p.set('snap', '0');
    }
    if (g('cfgQ1').checked) p.set('q1', '1');
    const currentFontSize = sanitizeFontSize(ADV.axis.grid.fontSize, FONT_DEFAULT);
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
    location.search = p.toString();
  };
  root.addEventListener('change', apply);
  root.addEventListener('keydown', e => {
    if (e.key === 'Enter') apply();
  });
}
