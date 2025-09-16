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
function paramStr(id, def=''){ const v=params.get(id); return v==null?def:v; }
function paramBool(id){ return params.get(id)==='1'; }
function parseScreen(str){
  if(!str) return null;
  const cleaned = str.replace(/^[\s\[]+|[\]\s]+$/g, '');
  const parts = cleaned.split(',').map(s=>+s.trim());
  return parts.length===4 && parts.every(Number.isFinite) ? parts : null;
}
function buildSimple(){
  const lines = [];
  let i = 1;
  while(true){
    const key = `fun${i}`;
    const fun = paramStr(key, i === 1 ? 'f(x)=x^2-2' : '').trim();
    const dom = paramStr(`dom${i}`, '').trim();
    if(i === 1 || params.has(key)){
      if(fun){ lines.push(dom ? `${fun}, x in ${dom}` : fun); }
      i++;
    } else {
      break;
    }
  }
  const pts = paramStr('points','0').trim();
  if(pts){ lines.push(`points=${pts}`); }
  const coords = paramStr('coords','').trim();
  if(coords){ lines.push(`coords=${coords}`); }
  return lines.join('\n');
}
let SIMPLE = buildSimple();

/* ====================== AVANSERT KONFIG ===================== */
const ADV = {
  axis: {
    labels: { x: paramStr('xName','x'), y: paramStr('yName','y') },
    style:  { stroke: '#111827', width: 2 },
    grid:   { majorX: 1, majorY: 1, labelPrecision: 0 }
  },
  screen: parseScreen(paramStr('screen','')),
  lockAspect: params.has('lock') ? paramBool('lock') : true,
  firstQuadrant: paramBool('q1'),

  interactions: {
    pan:  { enabled: paramBool('pan'),  needShift: false },
    zoom: { enabled: true,  wheel: true, needShift: false, factorX: 1.2, factorY: 1.2 }
  },

  /* Brukes i punkts-modus og for glidere i funksjons-modus */
  points: {
    start:  [ [-3, 1], [ 1, 3] ],   // to punkt i linje-modus
    startX: [  1 ],                 // start-X for glidere (kan overstyres i SIMPLE)
    showCoordsOnHover: true,
    decimals: 2,
    guideArrows: true,   // bare i funksjons-modus
    snap: {
      enabled: true,
      mode: 'up',        // 'drag' | 'up'
      stepX: null,       // null => bruk axis.grid.majorX
      stepY: null        // null => bruk axis.grid.majorY
    }
  },

  // Grafnavn
  curveName: {
    show: true,
    fontSize: 16,
    layer: 30,
    fractions: [0.2, 0.8, 0.6, 0.4],
    gapPx: 30,
    plate: { paddingPx: 4, fill: '#fff', opacity: 0.6, radiusPx: 4 },
    marginFracX: 0.04,
    marginFracY: 0.04
  },

  // Domenemarkører (brackets)
  domainMarkers: {
    show: true,
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
function parseSimple(txt){
  const lines = (txt||'').split('\n').map(s=>s.trim()).filter(Boolean);
  const out = { funcs:[], pointsCount:0, startX:[], extraPoints:[], answer:null, raw:txt };
  const fnRe = /^([a-zA-Z]\w*)\s*\(\s*x\s*\)\s*=\s*([^,]+?)(?:\s*,\s*x\s*in\s*(.+))?$/i;

  for(const L of lines){
    const m = L.match(fnRe);
    if(m){
      const name = m[1], rhs = m[2].trim(), dom=(m[3]||'').trim();
      let domain = null;
      if(dom && !/^r$/i.test(dom)){
        const dm = dom.match(/^\[\s*([+-]?\d*\.?\d+)\s*,\s*([+-]?\d*\.?\d+)\s*\]$/i);
        if(dm) domain = [ +dm[1], +dm[2] ];
      }
      out.funcs.push({ name, rhs, domain });
      continue;
    }
    const pm = L.match(/^points\s*=\s*(\d+)/i);
    if(pm){ out.pointsCount = +pm[1]; continue; }

    const cm = L.match(/^coords\s*=\s*(.+)$/i);
    if(cm){
      const pts = cm[1]
        .split(';')
        .map(s=>s.trim().replace(/^\(|\)$/g,''))
        .filter(Boolean)
        .map(p=>p.split(',').map(t=>+t.trim()).filter(Number.isFinite));
      for(const pt of pts){ if(pt.length===2) out.extraPoints.push(pt); }
      continue;
    }

    const sm = L.match(/^startx\s*=\s*(.+)$/i);
    if(sm){ out.startX = sm[1].split(',').map(s=>+s.trim()).filter(Number.isFinite); continue; }

    const am = L.match(/^riktig\s*:\s*(.+)$/i);
    if(am){ out.answer = am[1].trim(); continue; }
  }
  return out;
}
const SIMPLE_PARSED = parseSimple(SIMPLE);

const ALLOWED_NAMES = [
  'sin','cos','tan','asin','acos','atan','sinh','cosh','tanh',
  'log','ln','sqrt','exp','abs','min','max','floor','ceil','round','pow'
];
function isExplicitRHS(rhs){
  let s = rhs.toLowerCase();
  for(const k of ALLOWED_NAMES) s = s.replace(new RegExp(`\\b${k}\\b`,'g'),'');
  s = s.replace(/\bpi\b/g,'').replace(/\be\b/g,'').replace(/x/g,'');
  s = s.replace(/[0-9.+\-*/^()%\s]/g,'');
  return s.length===0;
}
function decideMode(parsed){
  const anyPlaceholder = parsed.funcs.some(f => !isExplicitRHS(f.rhs));
  return anyPlaceholder ? 'points' : 'functions';
}
const MODE = decideMode(SIMPLE_PARSED);

/* =============== uttrykk → funksjon ================= */
function parseFunctionSpec(spec){
  let rhs = (spec||'').toString().trim();
  const m = rhs.match(/^([a-zA-Z]\w*)\s*\(\s*x\s*\)\s*=\s*(.+)$/);
  if(m){ rhs=m[2]; }
  rhs = rhs
    .replace(/(^|[=+\-*/])\s*([+-])\s*([a-zA-Z0-9._()]+)\s*\^/g, (m,p,s,b) => p+'0'+s+'('+b+')^')
    .replace(/\^/g,'**')
    .replace(/(\d)([a-zA-Z(])/g,'$1*$2')
    .replace(/([x\)])\(/g,'$1*(')
    .replace(/x(\d)/g,'x*$1')
    .replace(/\bln\(/gi,'log(')
    .replace(/\bpi\b/gi,'PI')
    .replace(/\be\b/gi,'E')
    .replace(/\btau\b/gi,'(2*PI)');

  let fn;
  try{
    // eslint-disable-next-line no-new-func
    fn = new Function('x','with(Math){return '+rhs+';}');
  }catch(_){
    fn = x=>NaN;
  }
  return fn;
}

/* ============ Hjelpere for brøk/format & snap (linje-modus) ======== */
function stepX(){ return (ADV.points.snap.stepX!=null ? ADV.points.snap.stepX : +ADV.axis.grid.majorX) || 1; }
function stepY(){ return (ADV.points.snap.stepY!=null ? ADV.points.snap.stepY : +ADV.axis.grid.majorY) || 1; }
function nearestMultiple(val, step){ return Math.round(val/step)*step; }
function isNearMultiple(val, step){
  const eps = Math.max(1e-9, Math.abs(step)*1e-6);
  return Math.abs(val - nearestMultiple(val,step)) <= eps;
}
function decimalsForStep(step){
  if (!Number.isFinite(step) || step<=0) return 0;
  if (Math.abs(step - Math.round(step)) < 1e-12) return 0;
  const s = step.toString();
  if (s.includes('e')) { const m = Math.abs(Math.log10(step)); return Math.min(6, Math.ceil(m)); }
  return Math.min(6, (s.split('.')[1]||'').length);
}
function toFixedTrim(n, d){
  return (+n).toFixed(d).replace(/(\.\d*?)0+$/,'$1').replace(/\.$/,'');
}
function fmtSmartVal(val, step){
  if(!ADV.points.snap.enabled){ return toFixedTrim(val, ADV.points.decimals); }
  const m = nearestMultiple(val, step);
  if(isNearMultiple(val, step)){
    const digs = decimalsForStep(step);
    return toFixedTrim(m, digs);
  }else{
    return toFixedTrim(val, ADV.points.decimals);
  }
}
function fmtCoordsStatic(P){ return `(${fmtSmartVal(P.X(), stepX())}, ${fmtSmartVal(P.Y(), stepY())})`; }
function fmtCoordsDrag(P){ const d=ADV.points.decimals; return `(${toFixedTrim(P.X(),d)}, ${toFixedTrim(P.Y(),d)})`; }

/* ======= brøk for m & b (melding ved snap / “Riktig:”) ======= */
function rationalApprox(x, maxDen=64){
  let a0 = Math.floor(x), p0=1, q0=0, p1=a0, q1=1, frac = x - a0;
  while(Math.abs(p1/q1 - x) > 1e-12 && q1 <= maxDen && frac){
    const a = Math.floor(1/frac);
    const p2 = a*p1 + p0, q2 = a*q1 + q0;
    p0=p1; q0=q1; p1=p2; q1=q2; frac = 1/frac - a;
  }
  return [p1, q1];
}
function fracStr(x){
  const [n,d] = rationalApprox(x, 64);
  return d===1 ? `${n}` : `${n}/${d}`;
}
function linearStr(m,b){
  if(ADV.points.snap.enabled){
    if(m===0) return `y = ${fracStr(b)}`;
    const mS = m===1 ? 'x' : (m===-1 ? '-x' : `${fracStr(m)}x`);
    const bS = b===0 ? '' : ` ${b>=0?'+':'-'} ${fracStr(Math.abs(b))}`;
    return `y = ${mS}${bS}`;
  }else{
    const f = v => toFixedTrim(v, 3);
    if(m===0) return `y = ${f(b)}`;
    const mS = m===1 ? 'x' : (m===-1 ? '-x' : `${f(m)}x`);
    const bS = b===0 ? '' : ` ${b>=0?'+':'-'} ${f(Math.abs(b))}`;
    return `y = ${mS}${bS}`;
  }
}

/* ===================== Asymptoter ===================== */
function detectVerticalAsymptotes(fn, A, B, N=1000, huge=ADV.asymptote.hugeY){
  const xs=[], ys=[];
  for(let i=0;i<=N;i++){ const x=A+(i*(B-A))/N; let y; try{y=fn(x);}catch(_){y=NaN;} xs.push(x); ys.push(y); }
  const midBlow=(xL,xR)=>{ const m=0.5*(xL+xR); let y; try{y=fn(m);}catch(_){y=NaN;} return !Number.isFinite(y)||Math.abs(y)>(huge*2); };
  const cand=[];
  for(let i=1;i<ys.length;i++){
    const xL=xs[i-1], xR=xs[i], y0=ys[i-1], y1=ys[i];
    const b0=!Number.isFinite(y0)||Math.abs(y0)>huge;
    const b1=!Number.isFinite(y1)||Math.abs(y1)>huge;
    const opp=(Number.isFinite(y0)&&Number.isFinite(y1))?Math.sign(y0)!==Math.sign(y1):false;
    if((b0&&b1&&opp) || ((b0^b1)&&midBlow(xL,xR))) cand.push(0.5*(xL+xR));
  }
  const merged=[], tol=(B-A)/N*4;
  cand.sort((a,b)=>a-b).forEach(x=>{ if(merged.length===0||Math.abs(x-merged[merged.length-1])>tol) merged.push(x); });
  return merged;
}
function detectHorizontalAsymptoteInRange(fn, a, b, winFrac=0.12, N=600){
  if(!(b>a)) return null;
  const TRIM = ADV.asymptote.trimY ?? 8;
  const win = Math.max((b-a)*winFrac, (b-a)/N*10);
  const mean = (L,R,steps=120)=>{
    let s=0,c=0;
    for(let i=0;i<=steps;i++){
      const x=L + (i*(R-L))/steps;
      let y; try{ y=fn(x);}catch(_){ y=NaN; }
      if(Number.isFinite(y)){
        y = Math.max(-TRIM, Math.min(TRIM, y));
        s+=y; c++;
      }
    }
    return c? s/c : NaN;
  };
  const yL = mean(a, Math.min(a+win, b));
  const yR = mean(Math.max(b-win, a), b);
  if(!Number.isFinite(yL) || !Number.isFinite(yR)) return null;
  const y = 0.5*(yL+yR);
  const tol = 0.05 * Math.max(1, Math.abs(y));
  return (Math.abs(yL - y) <= tol && Math.abs(yR - y) <= tol) ? y : null;
}

/* ===================== Sample features ===================== */
function sampleFeatures(fn, a, b, opts={}){
  const { includeEndVals=false, detectAsymptotes=true, N=1000 } = opts;
  const TRIM = ADV.asymptote?.trimY ?? 8;

  const xs = [], ysRaw = [], ysTrim = [];
  for (let i = 0; i <= N; i++) {
    const x = a + (i * (b - a)) / N;
    let y; try { y = fn(x); } catch (_) { y = NaN; }
    xs.push(x);
    ysRaw.push(Number.isFinite(y) ? y : NaN);
    if (Number.isFinite(y)) ysTrim.push(Math.max(-TRIM, Math.min(TRIM, y)));
    else                    ysTrim.push(NaN);
  }

  // røtter
  const roots = [];
  for (let i = 1; i < ysTrim.length; i++) {
    const y0 = ysTrim[i - 1], y1 = ysTrim[i];
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
    try{ const y0 = fn(0); if(Number.isFinite(y0)) yIntercept = y0; }catch(_){}
  }

  // ekstremal
  const extrema = [];
  for (let i = 1; i < ysRaw.length - 1; i++) {
    const y0 = ysRaw[i - 1], y1 = ysRaw[i], y2 = ysRaw[i + 1];
    if (!Number.isFinite(y0) || !Number.isFinite(y1) || !Number.isFinite(y2)) continue;
    const d1 = y1 - y0, d2 = y2 - y1;
    if (d1 * d2 <= 0) {
      const x0 = xs[i - 1], x1 = xs[i];
      const denom = (y0 - 2 * y1 + y2);
      let xv;
      if (Math.abs(denom) < 1e-12) xv = x1;
      else {
        const h = x1 - x0;
        xv = x1 - (h * (y2 - y0)) / (2 * denom);
      }
      let yv; try { yv = fn(xv); } catch (_) { yv = NaN; }
      if (Number.isFinite(yv)) extrema.push({ x: xv, y: yv });
    }
  }

  // endepunkter
  let endVals = [];
  if(includeEndVals){
    try{ const ya = fn(a); if(Number.isFinite(ya)) endVals.push({x:a,y:ya}); }catch(_){}
    try{ const yb = fn(b); if(Number.isFinite(yb)) endVals.push({x:b,y:yb}); }catch(_){}
  }

  // robuste y-grenser via kvantiler
  let yVals = ysTrim.filter(Number.isFinite);
  let ymin = -5, ymax = 5;
  if (yVals.length) {
    yVals.sort((u,v)=>u-v);
    const lo = yVals[Math.floor(0.02*(yVals.length-1))];
    const hi = yVals[Math.floor(0.98*(yVals.length-1))];
    ymin = lo; ymax = hi;
  }

  // asymptoter
  const vas = (detectAsymptotes && ADV.asymptote.detect && ADV.asymptote.showVertical)
    ? detectVerticalAsymptotes(fn, a, b, 1000, ADV.asymptote.hugeY) : [];

  const haGuess = detectHorizontalAsymptoteInRange(fn, a, b);

  return { roots, extrema, yIntercept, endVals, ymin, ymax, vas, ha: haGuess };
}

/* ===================== Autozoom ===================== */
function computeAutoScreenFunctions(){
  const allUnbounded = SIMPLE_PARSED.funcs.every(f => !f.domain);

  // samle features
  const feats = [];
  let domMin=Infinity, domMax=-Infinity, anyDom=false;

  for(const f of SIMPLE_PARSED.funcs){
    const fn = parseFunctionSpec(`${f.name}(x)=${f.rhs}`);
    if(f.domain){
      anyDom = true;
      domMin = Math.min(domMin, f.domain[0]);
      domMax = Math.max(domMax, f.domain[1]);
      feats.push({ hasDom:true, fn, a:f.domain[0], b:f.domain[1],
                   ...sampleFeatures(fn, f.domain[0], f.domain[1], { includeEndVals:true }) });
    }else{
      feats.push({ hasDom:false, fn, a:-5, b: 5,
                   ...sampleFeatures(fn, -5, 5, { includeEndVals:false }) });
    }
  }

  let xmin, xmax, ymin, ymax;

  if(allUnbounded){
    // behold [-5,5] så lenge sentrale punkter ikke faller utenfor
    xmin = -5; xmax = 5; ymin = -5; ymax = 5;

    for(const F of feats){
      if(Number.isFinite(F.yIntercept)){
        ymin = Math.min(ymin, F.yIntercept);
        ymax = Math.max(ymax, F.yIntercept);
      }
      F.extrema.forEach(e => {
        ymin = Math.min(ymin, e.y);
        ymax = Math.max(ymax, e.y);
      });
      if(Number.isFinite(F.ha)){
        ymin = Math.min(ymin, F.ha);
        ymax = Math.max(ymax, F.ha);
      }
    }
  }else{
    // minst én avgrenset → vis hele domenet + sentrale punkter
    xmin = domMin; xmax = domMax;

    let ylo = [], yhi = [];
    feats.forEach(F => { ylo.push(F.ymin); yhi.push(F.ymax); });
    ymin = Math.min(...ylo, -5);
    ymax = Math.max(...yhi,  5);

    for(const F of feats){
      F.roots.forEach(r => { xmin = Math.min(xmin, r); xmax = Math.max(xmax, r); });
      if(Number.isFinite(F.yIntercept)){ ymin = Math.min(ymin, F.yIntercept); ymax = Math.max(ymax, F.yIntercept); }
      F.extrema.forEach(e => {
        xmin = Math.min(xmin, e.x); xmax = Math.max(xmax, e.x);
        ymin = Math.min(ymin, e.y); ymax = Math.max(ymax, e.y);
      });
      (F.endVals||[]).forEach(ev=>{
        xmin = Math.min(xmin, ev.x); xmax = Math.max(xmax, ev.x);
        ymin = Math.min(ymin, ev.y); ymax = Math.max(ymax, ev.y);
      });
      if(F.vas && F.vas.length){ for(const a of F.vas){ xmin = Math.min(xmin, a); xmax = Math.max(xmax, a); } }
      if(Number.isFinite(F.ha)){ ymin = Math.min(ymin, F.ha); ymax = Math.max(ymax, F.ha); }
    }
  }

  // Aksene alltid med
  xmin = Math.min(xmin, 0); xmax = Math.max(xmax, 0);
  ymin = Math.min(ymin, 0); ymax = Math.max(ymax, 0);

  // padding (og ev. kvadrat)
  const padX = 0.08*(xmax - xmin || 10);
  const padY = 0.08*(ymax - ymin || 10);
  xmin -= padX; xmax += padX; ymin -= padY; ymax += padY;
  if(shouldLockAspect()){
    const cx=(xmin+xmax)/2, cy=(ymin+ymax)/2;
    const span=Math.max(xmax-xmin, ymax-ymin);
    const half=span/2;
    return [cx-half, cx+half, cy-half, cy+half];
  }
  return [xmin, xmax, ymin, ymax];
}

function computeAutoScreenPoints(){
  const pts = ADV.points.start.slice(0,2);
  const xs = pts.map(p=>p[0]), ys = pts.map(p=>p[1]);
  let xmin = Math.min(-5, ...xs), xmax = Math.max( 5, ...xs);
  let ymin = Math.min(-5, ...ys), ymax = Math.max( 5, ...ys);

  xmin = Math.min(xmin, 0); xmax = Math.max(xmax, 0);
  ymin = Math.min(ymin, 0); ymax = Math.max(ymax, 0);

  const cx = (xmin + xmax) / 2, cy = (ymin + ymax) / 2;
  let halfX = Math.max(xmax - xmin, 10) / 2 * 1.1;
  let halfY = Math.max(ymax - ymin, 10) / 2 * 1.1;
  if(shouldLockAspect()){
    const half = Math.max(halfX, halfY);
    halfX = halfY = half;
  }
  return [cx-halfX, cx+halfX, cy-halfY, cy+halfY];
}
const toBB = scr => [scr[0], scr[3], scr[1], scr[2]];

/* ===================== Init JSXGraph ===================== */
JXG.Options.showCopyright = false;
JXG.Options.showNavigation = false;
JXG.Options.text.display = 'internal';
function initialScreen(){
  let scr = ADV.screen ?? (MODE==='functions' ? computeAutoScreenFunctions()
                                              : computeAutoScreenPoints());
  if(ADV.firstQuadrant){
    if(scr[0] < 0) scr[0] = 0;
    if(scr[2] < 0) scr[2] = 0;
  }
  return scr;
}
const START_SCREEN = initialScreen();

const brd = JXG.JSXGraph.initBoard('board',{
  boundingbox: toBB(START_SCREEN),
  axis: true,
  grid: false,
  showNavigation: false,
  showCopyright: false,
  pan:  { enabled: ADV.interactions.pan.enabled,  needShift: false },
  zoom: { enabled: ADV.interactions.zoom.enabled, wheel: true,
          needShift: false, factorX: ADV.interactions.zoom.factorX,
          factorY: ADV.interactions.zoom.factorY }
});

/* ---------- akser og navn ---------- */
['x','y'].forEach(ax=>{
  brd.defaultAxes[ax].setAttribute({
    withLabel:false,
    strokeColor:ADV.axis.style.stroke,
    strokeWidth:ADV.axis.style.width,
    firstArrow:false,
    lastArrow:true
  });
});
let xName=null,yName=null;
function placeAxisNames(){
  const [xmin,ymax,xmax,ymin]=brd.getBoundingBox();
  const rx=xmax-xmin, ry=ymax-ymin, off=0.04;
  if(!xName){
    xName = brd.create('text',[0,0,()=>ADV.axis.labels.x||'x'],
      {display:'internal',anchorX:'right',anchorY:'top',fixed:true,fontSize:20, layer:40,
       color:ADV.axis.style.stroke, cssStyle:'pointer-events:none;user-select:none;'});
  }
  if(!yName){
    yName = brd.create('text',[0,0,()=>ADV.axis.labels.y||'y'],
      {display:'internal',anchorX:'right',anchorY:'top',fixed:true,fontSize:20, layer:40,
       color:ADV.axis.style.stroke, cssStyle:'pointer-events:none;user-select:none;'});
  }
  xName.moveTo([xmax-off*rx, 0-off*ry]);
  yName.moveTo([0-off*rx, ymax-off*ry]);
}
placeAxisNames();

/* ---------- ticks / grid ---------- */
const axX=brd.defaultAxes.x, axY=brd.defaultAxes.y;
const tickBase = { drawLabels:true, precision: ADV.axis.grid.labelPrecision };
axX.defaultTicks.setAttribute({
  ...tickBase,
  ticksDistance: +ADV.axis.grid.majorX || 1,
  minorTicks: 0,
  label: { display:'internal', anchorX:'middle', anchorY:'top', offset:[0,-8] }
});
axY.defaultTicks.setAttribute({
  ...tickBase,
  ticksDistance: +ADV.axis.grid.majorY || 1,
  minorTicks: 0,
  label: { display:'internal', anchorX:'right', anchorY:'middle', offset:[-8,0] }
});

/* ====== Lås 1:1 når lockAspect===true,
   eller når lockAspect er null og majorX===majorY ====== */
function shouldLockAspect(){
  if (ADV.lockAspect === true) return true;
  if (ADV.lockAspect === false) return false;
  const sx = +ADV.axis.grid.majorX || 1;
  const sy = +ADV.axis.grid.majorY || 1;
  return Math.abs(sx - sy) < 1e-12;
}

let enforcing=false;
function enforceAspectStrict(){
  if(!shouldLockAspect() || enforcing) return;
  enforcing=true;
  try{
    const [xmin,ymax,xmax,ymin]=brd.getBoundingBox();
    const W=xmax-xmin, H=ymax-ymin;
    const pixAR = brd.canvasWidth / brd.canvasHeight;
    const worldAR = W/H;
    if(Math.abs(worldAR-pixAR)<1e-9) return;
    let newW=W, newH=H;
    if(worldAR>pixAR){ newH=W/pixAR; } else { newW=H*pixAR; }
    const cx=(xmax+xmin)/2, cy=(ymax+ymin)/2;
    brd.setBoundingBox([cx-newW/2, cy+newH/2, cx+newW/2, cy-newH/2], false);
  } finally { enforcing=false; }
}

/* ---------- GRID (statisk) ---------- */
let gridV=[], gridH=[];
function rebuildGrid(){
  for(const L of gridV) brd.removeObject(L);
  for(const L of gridH) brd.removeObject(L);
  gridV=[]; gridH=[];

  enforceAspectStrict();

  const [xmin,ymax,xmax,ymin]=brd.getBoundingBox();
  const sx=(+ADV.axis.grid.majorX>1e-9?+ADV.axis.grid.majorX:1);
  const sy=(+ADV.axis.grid.majorY>1e-9?+ADV.axis.grid.majorY:1);
  const x0=Math.ceil(xmin/sx)*sx, y0=Math.ceil(ymin/sy)*sy;

  const attrs = { straightFirst:false, straightLast:false, strokeColor:'#e5e7eb',
                  strokeWidth:1, fixed:true, layer:0, highlight:false, cssStyle:'pointer-events:none;' };

  for(let x=x0; x<=xmax+1e-9; x+=sx) gridV.push(brd.create('line', [[x,ymin],[x,ymax]], attrs));
  for(let y=y0; y<=ymax+1e-9; y+=sy) gridH.push(brd.create('line', [[xmin,y],[xmax,y]], attrs));
}
rebuildGrid();

/* =================== Grafnavn-bakplate =================== */
function measureTextPx(label){
  try{
    const t = label.rendNodeText || (label.rendNode && label.rendNode.getElementsByTagName('text')[0]);
    if(t && t.getBBox){ const bb=t.getBBox(); return {w:bb.width,h:bb.height}; }
  }catch(_){}
  const s=(label.plaintext||'f(x)').length, f=ADV.curveName.fontSize;
  return { w: s*f*0.6, h: f*1.1 };
}
function ensurePlateFor(label){
  if(label._plate) return;
  const mkPt = (x,y)=> brd.create('point',[x,y],{visible:false,fixed:true,layer:ADV.curveName.layer-1});
  const p1=mkPt(0,0),p2=mkPt(0,0),p3=mkPt(0,0),p4=mkPt(0,0);
  brd.create('polygon',[p1,p2,p3,p4],{
    fillColor:ADV.curveName.plate.fill, fillOpacity:ADV.curveName.plate.opacity,
    borders:{visible:false}, fixed:true, highlight:false, layer:ADV.curveName.layer-1,
    cssStyle:'pointer-events:none;stroke-linejoin:round;'
  });
  label._plate={p1,p2,p3,p4};
}
function ensureLabelFront(label){
  const node = label && label.rendNode;
  if(node && node.parentNode){ node.parentNode.appendChild(node); }
}
function updatePlate(label){
  if(!label._plate) return;
  const [xmin,ymax,xmax,ymin]=brd.getBoundingBox();
  const ux=(xmax-xmin)/brd.canvasWidth, uy=(ymax-ymin)/brd.canvasHeight;
  const {w,h}=measureTextPx(label), pad=ADV.curveName.plate.paddingPx;
  const tx=label.X(), ty=label.Y();
  const ax=(label.visProp&&label.visProp.anchorx)||'left';
  const ay=(label.visProp&&label.visProp.anchory)||'middle';
  let L,R,T,B;
  if(ax==='left'){L=tx-pad*ux; R=tx+(w+pad)*ux;}
  else if(ax==='right'){L=tx-(w+pad)*ux; R=tx+pad*ux;}
  else{L=tx-(w/2+pad)*ux; R=tx+(w/2+pad)*ux;}
  if(ay==='top'){T=ty+pad*uy; B=ty-(h+pad)*uy;}
  else if(ay==='bottom'){T=ty+(h+pad)*uy; B=ty-pad*uy;}
  else{T=ty+(h/2+pad)*uy; B=ty-(h/2+pad)*uy;}
  const P=label._plate; P.p1.moveTo([L,T]); P.p2.moveTo([R,T]); P.p3.moveTo([R,B]); P.p4.moveTo([L,B]);
}

/* =================== FARGEPALETT =================== */
function colorFor(i){ const def=['#9333ea','#475569','#ef4444','#0ea5e9','#10b981','#f59e0b']; return def[i%def.length]; }

/* =================== SEGMENTERT TEGNING =================== */
function removeSegments(g){ if(g.segs){ g.segs.forEach(s=>brd.removeObject(s)); g.segs=[]; } }
function rebuildFunctionSegmentsFor(g){
  removeSegments(g);
  const bb = brd.getBoundingBox();
  let L = bb[0], R = bb[2];

  if(g.domain && g.domain.length===2){
    L = Math.max(L, g.domain[0]);
    R = Math.min(R, g.domain[1]);
  }
  if(!(R>L)) return;

  const vas = (ADV.asymptote.detect && ADV.asymptote.showVertical)
    ? detectVerticalAsymptotes(g.fn, L, R, 1000, ADV.asymptote.hugeY)
    : [];
  const xs = [L, ...vas.filter(x=>x>L && x<R), R].sort((a,b)=>a-b);
  const eps = (R-L)*1e-6;

  const safe = x=>{ try{ const y=g.fn(x); return Number.isFinite(y)?y:NaN; }catch(_){ return NaN; } };

  g.segs=[];
  for(let i=0;i<xs.length-1;i++){
    let a=xs[i], b=xs[i+1];
    const leftOpen  = (i>0);
    const rightOpen = (i<xs.length-2);
    if(leftOpen)  a += eps;
    if(rightOpen) b -= eps;
    if(b<=a) continue;
    const seg = brd.create('functiongraph', [safe, ()=>a, ()=>b],
      { strokeColor:g.color, strokeWidth:4, fixed:true, highlight:false });
    g.segs.push(seg);
  }
}
function rebuildAllFunctionSegments(){ graphs.forEach(rebuildFunctionSegmentsFor); }

/* =================== FUNKSJONER + BRACKETS =================== */
const graphs=[];
function makeSmartCurveLabel(g, idx, text){
  if(!ADV.curveName.show) return;
  const label = brd.create('text',[0,0,()=>text],{
    color:g.color, fillColor:g.color, fontSize:ADV.curveName.fontSize,
    fixed:true, highlight:false, layer:ADV.curveName.layer,
    anchorX:'left', anchorY:'middle', display:'internal',
    cssStyle:'pointer-events:none;user-select:none;'
  });
  ensurePlateFor(label);

  function finiteYAt(x){
    let y=g.fn(x);
    if(Number.isFinite(y)) return y;
    const [xmin,ymax,xmax,ymin]=brd.getBoundingBox();
    const span=xmax-xmin, step=span/60;
    for(let k=1;k<=60;k++){
      for(const s of [+1,-1]){
        const xs=x+s*k*step/6; y=g.fn(xs);
        if(Number.isFinite(y)) return y;
      }
    }
    return 0;
  }
  function position(){
    const bb=brd.getBoundingBox(), xmin=bb[0], xmax=bb[2], ymin=bb[3], ymax=bb[1];
    const a=g.domain?g.domain[0]:xmin, b=g.domain?g.domain[1]:xmax;
    const L=Math.max(a,xmin), R=Math.min(b,xmax);
    if(!(R>L)) return;
    const fr=ADV.curveName.fractions, pad=0.04*(R-L);
    let best={pen:1e9,pos:[(xmin+xmax)/2,(ymin+ymax)/2],slope:0};
    for(const f of fr){
      let x=L+f*(R-L); x=Math.min(R-pad,Math.max(L+pad,x));
      const y=finiteYAt(x);
      const h=(xmax-xmin)/600; const y1=g.fn(x-h), y2=g.fn(x+h);
      const m=(Number.isFinite(y1)&&Number.isFinite(y2))? (y2-y1)/(2*h) : 0;
      let nx=-m, ny=1; const L2=Math.hypot(nx,ny)||1; nx/=L2; ny/=L2;
      const rx=(xmax-xmin)/brd.canvasWidth, ry=(ymax-ymin)/brd.canvasHeight;
      const off=ADV.curveName.gapPx; let X=x+nx*off*rx, Y=y+ny*off*ry;
      const xCl=Math.min(xmax-(xmax-xmin)*ADV.curveName.marginFracX,Math.max(xmin+(xmax-xmin)*ADV.curveName.marginFracX,X));
      const yCl=Math.min(ymax-(ymax-ymin)*ADV.curveName.marginFracY,Math.max(ymin+(ymax-ymin)*ADV.curveName.marginFracY,Y));
      const pen=Math.abs(xCl-X)/rx+Math.abs(yCl-Y)/ry;
      if(pen<best.pen) best={pen,pos:[xCl,yCl],slope:m};
    }
    label.moveTo(best.pos);
    label.setAttribute({anchorX: best.slope>=0?'left':'right'});
    updatePlate(label);
    ensureLabelFront(label);
  }
  position();
  brd.on('boundingbox', position);
}

function makeBracketAt(g, x0, side /* -1 = venstre (a), +1 = høyre (b) */) {
  g._br = g._br || {};
  if (g._br[side]) { g._br[side].forEach(o => brd.removeObject(o)); g._br[side] = null; }
  if (!g.domain || !ADV.domainMarkers.show) return;

  const [xmin, ymax, xmax, ymin] = brd.getBoundingBox();
  const rx = (xmax - xmin) / brd.canvasWidth;
  const ry = (ymax - ymin) / brd.canvasHeight;
  const baseH = Math.max((xmax - xmin)/200, 1e-4);

  // Finn et punkt innover i domenet med finite y
  let xS = x0, yS = g.fn(xS), tries = 0, inward = (side<0 ? +1 : -1);
  while(!Number.isFinite(yS) && tries < 12){
    xS = x0 + inward * (tries+1) * baseH;
    try { yS = g.fn(xS); }catch(_){ yS = NaN; }
    tries++;
  }
  if(!Number.isFinite(yS)) return;

  // tangent rundt xS
  let m = 0;
  try{
    const y1 = g.fn(xS + baseH), y2 = g.fn(xS - baseH);
    if (Number.isFinite(y1) && Number.isFinite(y2)) m = (y1 - y2) / (2 * baseH);
  }catch(_){}

  // enhets-tangent/-normal i px-rom
  let tx = 1 / rx, ty = m / ry;
  const tlen = Math.hypot(tx, ty) || 1; tx /= tlen; ty /= tlen;
  let nx = -ty, ny = tx;

  const px2world = (vx, vy, Lpx) => [vx * Lpx * rx, vy * Lpx * ry];
  const LEN = ADV.domainMarkers.barPx;
  const CAP = Math.max(4, LEN * (ADV.domainMarkers.tipFrac||0.2));

  const [wx, wy] = px2world(nx, ny, LEN/2);
  const A = [xS - wx, yS - wy];
  const B = [xS + wx, yS + wy];

  const style = {
    strokeColor: ADV.domainMarkers.color, strokeWidth: ADV.domainMarkers.width,
    fixed:true, highlight:false, layer: ADV.domainMarkers.layer
  };
  const back = brd.create('segment', [A, B], style);

  // caps peker innover: retning = -side * t
  const [ux, uy] = px2world(tx, ty, CAP);
  const dir = -side;
  const cap1 = brd.create('segment', [A, [A[0] + dir*ux, A[1] + dir*uy]], style);
  const cap2 = brd.create('segment', [B, [B[0] + dir*ux, B[1] + dir*uy]], style);

  g._br[side] = [back, cap1, cap2];
}

function updateAllBrackets(){
  for(const g of graphs){
    if(!g.domain) continue;
    makeBracketAt(g, g.domain[0], -1);
    makeBracketAt(g, g.domain[1], +1);
  }
}

function buildFunctions(){
  SIMPLE_PARSED.funcs.forEach((f,i)=>{
    const color=colorFor(i);
    const fn=parseFunctionSpec(`${f.name}(x)=${f.rhs}`);
    const g = { name:f.name, color, domain:f.domain||null };
    g.fn = x => { try{ const y=fn(x); return Number.isFinite(y)?y:NaN; }catch(_){ return NaN; } };
    g.segs = [];

    // usynlig "carrier" for glidere – VIKTIG: STRAMT TIL DOMENET
    const xMinCarrier = g.domain ? g.domain[0] : ()=>brd.getBoundingBox()[0];
    const xMaxCarrier = g.domain ? g.domain[1] : ()=>brd.getBoundingBox()[2];
    g.carrier = brd.create('functiongraph',[g.fn, xMinCarrier, xMaxCarrier],
      { visible:false, strokeOpacity:0, fixed:true });

    graphs.push(g);
    makeSmartCurveLabel(g, i, `${g.name}(x)`);
  });

  rebuildAllFunctionSegments();
  updateAllBrackets();

  // glidere
  const n = SIMPLE_PARSED.pointsCount|0;
  if(n>0 && graphs.length>0){
    const G = graphs[0];
    const sxList = (SIMPLE_PARSED.startX && SIMPLE_PARSED.startX.length>0)
      ? SIMPLE_PARSED.startX : (ADV.points.startX && ADV.points.startX.length>0 ? ADV.points.startX : [0]);

    function stepXg(){ return (ADV.points.snap.stepX!=null ? ADV.points.snap.stepX : +ADV.axis.grid.majorX) || 1; }
    const clampToDomain = x => (G.domain ? Math.min(G.domain[1], Math.max(G.domain[0], x)) : x);
    const applySnap = P => { const xs = clampToDomain(Math.round(P.X()/stepXg())*stepXg()); P.moveTo([xs, G.fn(xs)]); };

    for(let i=0;i<n;i++){
      const xi = sxList[i]!=null ? clampToDomain(sxList[i]) : clampToDomain(sxList[0]);
      const P = brd.create('glider',[xi, G.fn(xi), G.carrier],
        { name:'', withLabel:true, face:'o', size:3,
          strokeColor:G.color, fillColor:'#fff', showInfobox:false });

      // HARD KLAMMING TIL DOMENE UNDER DRAG
      P.on('drag', ()=>{
        let x = clampToDomain(P.X());
        P.moveTo([x, G.fn(x)]);
        if(ADV.points.snap.enabled && (ADV.points.snap.mode||'up')==='drag') applySnap(P);
      });

      if(ADV.points.showCoordsOnHover){
        P.label.setAttribute({visible:false});
        P.on('over', ()=>{ P.label.setText(()=>fmtCoordsStatic(P)); P.label.setAttribute({visible:true}); });
        P.on('drag', ()=>{ P.label.setText(()=>fmtCoordsDrag(P));   P.label.setAttribute({visible:true}); });
        P.on('up',   ()=>{ P.label.setText(()=>fmtCoordsStatic(P)); });
        P.on('out',  ()=> P.label.setAttribute({visible:false}));
      }
      if(ADV.points.snap.enabled && (ADV.points.snap.mode||'up')==='up'){
        P.on('up', ()=>applySnap(P));
      }
      if(MODE==='functions' && ADV.points.guideArrows){
        brd.create('arrow',[()=>[P.X(),P.Y()],()=>[0,P.Y()] ],
          { strokeColor:'#64748b', strokeWidth:2, dash:2, lastArrow:true, firstArrow:false, fixed:true, layer:10, highlight:false });
        brd.create('arrow',[()=>[P.X(),P.Y()],()=>[P.X(),0] ],
          { strokeColor:'#64748b', strokeWidth:2, dash:2, lastArrow:true, firstArrow:false, fixed:true, layer:10, highlight:false });
      }
    }
  }
}

/* =================== LINJE FRA PUNKTER =================== */
let A=null, B=null, moving=[];
function buildPointsLine(){
  const first = SIMPLE_PARSED.funcs[0] ?? {rhs:'ax+b'};
  const rhs = first.rhs.replace(/\s+/g,'').toLowerCase();

  let kind='two', anchorC=0, slopeM=1;
  if(/^a\*?x([+-])(\d+(?:\.\d+)?)$/.test(rhs)){
    kind='anchorY'; anchorC = RegExp.$1==='-'? -parseFloat(RegExp.$2): parseFloat(RegExp.$2);
  }else if(/^([+-]?\d*(?:\.\d+)?)\*?x\+b$/.test(rhs)){
    kind='fixedSlope';
    const raw = RegExp.$1; slopeM = (raw===''||raw==='+')?1:(raw==='-'?-1:parseFloat(raw));
  }

  const start0 = ADV.points.start[0], start1=ADV.points.start[1];

  if(kind==='two'){
    const P0=brd.create('point',start0.slice(),{name:'',size:3,face:'o',fillColor:'#fff',strokeColor:'#9333ea',withLabel:true,showInfobox:false});
    const P1=brd.create('point',start1.slice(),{name:'',size:3,face:'o',fillColor:'#fff',strokeColor:'#9333ea',withLabel:true,showInfobox:false});
    A=P0; B=P1; moving=[P0,P1];
  }else if(kind==='anchorY'){
    const F=brd.create('point',[0,anchorC],{name:'',visible:false,fixed:true});
    const P=brd.create('point',start0.slice(),{name:'',size:3,face:'o',fillColor:'#fff',strokeColor:'#9333ea',withLabel:true,showInfobox:false});
    A=F; B=P; moving=[P];
  }else{
    const P=brd.create('point',start0.slice(),{name:'',size:3,face:'o',fillColor:'#fff',strokeColor:'#9333ea',withLabel:true,showInfobox:false});
    const Q=brd.create('point',[()=>P.X()+1,()=>P.Y()+slopeM],{name:'',visible:false,fixed:true});
    A=P; B=Q; moving=[P];
  }

  brd.create('line',[A,B],{strokeColor:'#9333ea',strokeWidth:4});

  function stepXv(){return (ADV.points.snap.stepX!=null?ADV.points.snap.stepX:+ADV.axis.grid.majorX)||1;}
  function stepYv(){return (ADV.points.snap.stepY!=null?ADV.points.snap.stepY:+ADV.axis.grid.majorY)||1;}
  function snap(P){P.moveTo([nearestMultiple(P.X(),stepXv()), nearestMultiple(P.Y(),stepYv())]);}

  if(ADV.points.snap.enabled){
    const mode=ADV.points.snap.mode||'up';
    for(const P of moving){
      if(mode==='drag') P.on('drag',()=>snap(P));
      else              P.on('up',  ()=>{ snap(P); if(P.label) P.label.setText(()=>fmtCoordsStatic(P)); });
    }
  }

  if(ADV.points.showCoordsOnHover){
    for(const P of moving){
      P.label.setAttribute({visible:false});
      P.on('over',()=>{ P.label.setText(()=>fmtCoordsStatic(P)); P.label.setAttribute({visible:true}); });
      P.on('drag',()=>{ P.label.setText(()=>fmtCoordsDrag(P));   P.label.setAttribute({visible:true}); });
      P.on('up',  ()=>{ P.label.setText(()=>fmtCoordsStatic(P)); });
      P.on('out', ()=> P.label.setAttribute({visible:false}));
    }
  }

  // Fasit-sjekk (hvis "Riktig:" finnes)
  if (SIMPLE_PARSED.answer){
    const {btn, msg, setStatus} = ensureCheckControls();
    btn.onclick = () => {
      const {m, b} = currentMB();
      const ans = parseAnswerToMB(SIMPLE_PARSED.answer);
      if(!ans){ setStatus('err','Kunne ikke tolke fasit.'); return; }
      const okM = Math.abs(m - ans.m) <= ADV.check.slopeTol;
      const okB = Math.abs(b - ans.b) <= ADV.check.interTol;
      if(okM && okB){
        setStatus('ok', `Riktig! ${linearStr(ans.m, ans.b)}`);
      }else{
        setStatus('err', `Ikke helt. Nå: ${linearStr(m, b)}`);
      }
    };
  }
}

/* ====== MB fra punktene + tolke fasit-uttrykk robust ====== */
function currentMB(){
  const dx = (B.X()-A.X());
  const m  = (Math.abs(dx)<1e-12) ? NaN : (B.Y()-A.Y())/dx;
  const b  = Number.isFinite(m) ? (A.Y() - m*A.X()) : NaN;
  return { m, b };
}
function parseAnswerToMB(answerLine){
  const rhs = String(answerLine).split('=').slice(1).join('=').trim();
  if(!rhs) return null;
  const fn = parseFunctionSpec(`f(x)=${rhs}`);
  try{
    const b = fn(0);
    const m = fn(1) - b;
    if(!Number.isFinite(m) || !Number.isFinite(b)) return null;
    return { m, b };
  }catch(_){ return null; }
}

function addFixedPoints(){
  if(!Array.isArray(SIMPLE_PARSED.extraPoints)) return;
  for(const pt of SIMPLE_PARSED.extraPoints){
    const P = brd.create('point', pt.slice(), {name:'', size:3, face:'o', fillColor:'#fff', strokeColor:'#111827', withLabel:true, fixed:true, showInfobox:false});
    if(ADV.points.showCoordsOnHover){
      P.label.setAttribute({visible:false});
      P.on('over', ()=>{ P.label.setText(()=>fmtCoordsStatic(P)); P.label.setAttribute({visible:true}); });
      P.on('out',  ()=> P.label.setAttribute({visible:false}));
    }
  }
}

/* ================= bygg valgt modus ================= */
if(MODE==='functions'){
  buildFunctions();
}else{
  buildPointsLine();
}
addFixedPoints();

/* ================= Oppdater / resize ================= */
function updateAfterViewChange(){
  enforceAspectStrict();
  rebuildGrid();
  axX.defaultTicks.setAttribute({ ticksDistance:+ADV.axis.grid.majorX||1, minorTicks:0, precision:ADV.axis.grid.labelPrecision });
  axY.defaultTicks.setAttribute({ ticksDistance:+ADV.axis.grid.majorY||1, minorTicks:0, precision:ADV.axis.grid.labelPrecision });
  placeAxisNames();
  if(MODE==='functions'){
    rebuildAllFunctionSegments();
    updateAllBrackets();
  }
}
brd.on('boundingbox', updateAfterViewChange);

// Init
enforceAspectStrict();
rebuildGrid();

window.addEventListener('resize', ()=>{
  JXG.JSXGraph.resizeBoards();
  updateAfterViewChange();
});

/* ====== Sjekk-knapp + status (monteres i #checkArea i HTML) ====== */
function ensureCheckControls(){
  const host = document.getElementById('checkArea') || document.body;

  let btn = document.getElementById('btnCheck');
  let msg = document.getElementById('checkMsg');

  if(!btn){
    btn = document.createElement('button');
    btn.id = 'btnCheck';
    btn.textContent = 'Sjekk';
    btn.className = 'btn';
    host.appendChild(btn);
  }
  if(!msg){
    msg = document.createElement('div');
    msg.id = 'checkMsg';
    msg.className = 'status status--info';
    msg.textContent = '';
    host.appendChild(msg);
  }

  const setStatus = (type, text) => {
    msg.className = 'status ' + (type==='ok' ? 'status--ok' : type==='err' ? 'status--err' : 'status--info');
    msg.textContent = text || '';
  };

  return {btn, msg, setStatus};
}

/* ====== Reset & SVG (robust eksport) ====== */
const btnReset=document.getElementById('btnReset');
if(btnReset){
  btnReset.addEventListener('click', ()=>{
    const scr = initialScreen();
    brd.setBoundingBox(toBB(scr), true);
    updateAfterViewChange();
  });
}
const btnSvg=document.getElementById('btnSvg');
if(btnSvg){
  btnSvg.addEventListener('click', ()=>{
    const src = brd.renderer.svgRoot.cloneNode(true);
    src.removeAttribute('style');
    const w = brd.canvasWidth, h = brd.canvasHeight;
    src.setAttribute('width',  `${w}`);
    src.setAttribute('height', `${h}`);
    src.setAttribute('viewBox', `0 0 ${w} ${h}`);
    src.setAttribute('xmlns','http://www.w3.org/2000/svg');
    src.setAttribute('xmlns:xlink','http://www.w3.org/1999/xlink');
    const xml = new XMLSerializer().serializeToString(src)
      .replace(/\swidth="[^"]*"\s(?=.*width=")/, ' ')
      .replace(/\sheight="[^"]*"\s(?=.*height=")/, ' ');
    const blob=new Blob([xml],{type:'image/svg+xml;charset=utf-8'});
    const a=document.createElement('a'); a.href=URL.createObjectURL(blob); a.download='graf.svg'; a.click(); URL.revokeObjectURL(a.href);
  });
}

const btnPng=document.getElementById('btnPng');
if(btnPng){
  btnPng.addEventListener('click', ()=>{
    const src = brd.renderer.svgRoot.cloneNode(true);
    src.removeAttribute('style');
    const w = brd.canvasWidth, h = brd.canvasHeight;
    src.setAttribute('width',  `${w}`);
    src.setAttribute('height', `${h}`);
    src.setAttribute('viewBox', `0 0 ${w} ${h}`);
    src.setAttribute('xmlns','http://www.w3.org/2000/svg');
    src.setAttribute('xmlns:xlink','http://www.w3.org/1999/xlink');
    const xml = new XMLSerializer().serializeToString(src)
      .replace(/\swidth="[^"]*"\s(?=.*width=")/, ' ')
      .replace(/\sheight="[^"]*"\s(?=.*height=")/, ' ');
    const svgBlob = new Blob([xml], {type:'image/svg+xml;charset=utf-8'});
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

function setupSettingsForm(){
  const root = document.querySelector('.settings');
  if(!root) return;
  const funcRows = document.getElementById('funcRows');
  const addBtn = document.createElement('button');
  addBtn.id = 'addFunc';
  addBtn.type = 'button';
  addBtn.className = 'btn';
  addBtn.textContent = '+';
  addBtn.setAttribute('aria-label','Legg til funksjon');
  const g = id => document.getElementById(id);

  const isCoords = str => /^\s*(?:\(\s*-?\d+(?:\.\d+)?\s*,\s*-?\d+(?:\.\d+)?\s*\)|-?\d+(?:\.\d+)?\s*,\s*-?\d+(?:\.\d+)?)(?:\s*;\s*(?:\(\s*-?\d+(?:\.\d+)?\s*,\s*-?\d+(?:\.\d+)?\s*\)|-?\d+(?:\.\d+)?\s*,\s*-?\d+(?:\.\d+)?))*\s*$/.test(str);
  const isExplicitFun = str => {
    const m = str.match(/^[a-zA-Z]\w*\s*\(\s*x\s*\)\s*=\s*(.+)$/) || str.match(/^y\s*=\s*(.+)$/);
    const rhs = m ? m[1] : str;
    if(!/x/.test(rhs)) return false;
    return isExplicitRHS(rhs);
  };

  const toggleDomain = input => {
    const row = input.closest('.func-row');
    const domLabel = row.querySelector('label.domain');
    if(isExplicitFun(input.value.trim())){
      domLabel.style.display = '';
    }else{
      domLabel.style.display = 'none';
      const domInput = domLabel.querySelector('input[data-dom]');
      if(domInput) domInput.value = '';
    }
  };

  const createRow = (index, funVal = '', domVal = '') => {
    const row = document.createElement('div');
    row.className = 'settings-row func-row';
    row.innerHTML = `
      <label>${index === 1 ? 'Funksjon eller punkter' : 'Funksjon ' + index}
        <input type="text" data-fun value="${funVal}">
      </label>
      <label class="domain">Definisjon (valgfritt)
        <input type="text" data-dom value="${domVal}" placeholder="[start, stopp]">
      </label>
    `;
    funcRows.appendChild(row);
    const funInput = row.querySelector('input[data-fun]');
    funInput.addEventListener('input', () => toggleDomain(funInput));
    toggleDomain(funInput);
    return row;
  };

  const appendAddBtn = () => {
    if(addBtn.parentElement) addBtn.parentElement.removeChild(addBtn);
    const lastRow = funcRows.querySelector('.func-row:last-child');
    if(lastRow) lastRow.appendChild(addBtn);
  };

  let i = 1;
  const initCoords = paramStr('coords','');
  const hasCoords = initCoords !== '';
  while(true){
    const key = `fun${i}`;
    const fun = (i === 1 && hasCoords) ? initCoords : paramStr(key, i === 1 ? 'f(x)=x^2-2' : '');
    const dom = paramStr(`dom${i}`, '');
    if(i === 1 || params.has(key)){
      createRow(i, fun, dom);
      i++;
    } else {
      break;
    }
  }

  appendAddBtn();

  addBtn.addEventListener('click', () => {
    const index = funcRows.querySelectorAll('.func-row').length + 1;
    createRow(index, '', '');
    appendAddBtn();
  });
  g('cfgScreen').value = paramStr('screen','');
  g('cfgLock').checked = params.has('lock') ? paramBool('lock') : true;
  g('cfgAxisX').value = paramStr('xName','x');
  g('cfgAxisY').value = paramStr('yName','y');
  g('cfgPan').checked = paramBool('pan');
  g('cfgQ1').checked = paramBool('q1');

  const apply = () => {
    const p = new URLSearchParams();
    let idx = 1;
    funcRows.querySelectorAll('.func-row').forEach((row, rowIdx) => {
      const fun = row.querySelector('input[data-fun]').value.trim();
      const dom = row.querySelector('input[data-dom]').value.trim();
      if(!fun) return;
      if(rowIdx === 0 && isCoords(fun)){
        p.set('coords', fun);
      } else {
        p.set(`fun${idx}`, fun);
        if(dom) p.set(`dom${idx}`, dom);
        idx++;
      }
    });
    if(g('cfgScreen').value.trim()) p.set('screen', g('cfgScreen').value.trim());
    if(g('cfgLock').checked) p.set('lock','1'); else p.set('lock','0');
    if(g('cfgAxisX').value.trim() && g('cfgAxisX').value.trim() !== 'x') p.set('xName', g('cfgAxisX').value.trim());
    if(g('cfgAxisY').value.trim() && g('cfgAxisY').value.trim() !== 'y') p.set('yName', g('cfgAxisY').value.trim());
    if(g('cfgPan').checked) p.set('pan','1');
    if(g('cfgQ1').checked) p.set('q1','1');
    location.search = p.toString();
  };

  root.addEventListener('change', apply);
  root.addEventListener('keydown', e => {
    if(e.key === 'Enter') apply();
  });
}
