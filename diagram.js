/* =========================================================
   KONFIG – forfatter styrer alt her
   ========================================================= */
const CFG = {
  title: 'Diagram',
  labels: ['1','2','4','6','Ingen'],      // x-etiketter
  start:  [8,0,7,0,0],                    // startverdier
  answer: [10,6,3,1,4],                   // fasit
  yMax:   15,                             // maks på y-aksen (valgfritt; auto hvis utelatt)
  snap:   1,                              // trinn-størrelse
  tolerance: 0,                           // tillatt avvik per søyle ved "Sjekk"
  axisXLabel: 'Ant. bøker',
  axisYLabel: 'Antall elever'
};

/* =========================================================
   OPPSETT
   ========================================================= */
const svg = document.getElementById('barsvg');
const W = 900, H = 560;
const M = {l:80, r:30, t:40, b:70};

const innerW = W - M.l - M.r;
const innerH = H - M.t - M.b;

/* Lagrekkefølge: grid, akser, søyler, håndtak, a11y, verdier (øverst), labels */
const gGrid   = add('g');
const gAxis   = add('g');
const gBars   = add('g');
const gHands  = add('g');
const gA11y   = add('g');
const gVals   = add('g');
const gLabels = add('g');

let values = [];
let N = 0;

let yMax = 0;
const yMin = 0;

// skalaer
let xBand = 0;
let barW  = 0;
function xPos(i){ return M.l + xBand*i + xBand/2; }
function yPos(v){ return M.t + innerH - (v - yMin) / (yMax - yMin) * innerH; }

// husk sist fokusert søyle mellom redraw
let lastFocusIndex = null;

initFromCfg();
updateStatus('Dra i søylene/håndtaket – eller bruk tastaturet.');

function initFromCfg(){
  values = CFG.start.slice();
  N = CFG.labels.length;
  xBand = innerW / N;
  barW  = xBand * 0.6;
  yMax  = CFG.yMax ?? niceMax([...CFG.start, ...CFG.answer]);
  lastFocusIndex = null;
  document.getElementById('chartTitle').textContent = CFG.title || '';
  drawAxesAndGrid();
  drawBars();
}

/* =========================================================
   RENDER
   ========================================================= */
function drawAxesAndGrid(){
  gGrid.innerHTML = ''; gAxis.innerHTML = ''; gLabels.innerHTML = '';

  const step = chooseStep(yMax);
  for(let y=0; y<=yMax + 1e-9; y+=step){
    const yy = yPos(y);
    addTo(gGrid,'line',{x1:M.l, y1:yy, x2:W-M.r, y2:yy, class:'grid'});
    addTo(gGrid,'text',{x:M.l-6,y:yy+4,class:'yTickText'}).textContent = y;
  }

  // y-akse
  addTo(gAxis,'line',{x1:M.l, y1:M.t-8, x2:M.l, y2:H-M.b, class:'axis'});
  // x-akse
  addTo(gAxis,'line',{x1:M.l, y1:H-M.b, x2:W-M.r, y2:H-M.b, class:'axis'});

  // x-etiketter
  CFG.labels.forEach((lab,i)=>{
    addTo(gLabels,'text',{x:xPos(i), y:H-M.b+28, class:'xLabel'}).textContent = lab;
  });

  // aksetekster
  const yLab = addTo(gLabels,'text',{x:M.l-56, y:M.t + innerH/2, class:'yLabel'});
  yLab.setAttribute('transform',`rotate(-90, ${M.l-56}, ${M.t + innerH/2})`);
  yLab.textContent = CFG.axisYLabel || '';
  addTo(gLabels,'text',{x:M.l + innerW - 10, y:H - 24, class:'yLabel'}).textContent = CFG.axisXLabel || '';
}

function drawBars(){
  gBars.innerHTML=''; gVals.innerHTML=''; gHands.innerHTML=''; gA11y.innerHTML='';

  values.forEach((v,i)=>{
    const cx = xPos(i);
    const y  = yPos(v);

    // 1) SØYLE (draggbar)
    const rect = addTo(gBars,'rect',{
      x: cx - barW/2,
      y: y,
      width: barW,
      height: Math.max(2, (H-M.b) - y),
      class:'bar'
    });
    rect.dataset.index = i;
    rect.addEventListener('pointerdown', onDragStart);

    // 2) HÅNDTAK (draggbar)
    addTo(gHands,'circle',{cx:cx, cy:y-2+2, r:16, class:'handleShadow'});
    const h = addTo(gHands,'circle',{cx:cx, cy:y-2, r:14, class:'handle'});
    h.dataset.index = i;
    h.addEventListener('pointerdown', onDragStart);

    // 3) A11y‐overlay (fokus + tastatur + stor klikkflate)
    const a11y = addTo(gA11y,'rect',{
      x: cx - xBand*0.5,
      y: M.t,
      width: xBand*0.98,
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
    a11y.dataset.index = i;
    a11y.addEventListener('pointerdown', onDragStart);
    a11y.addEventListener('keydown', onKeyAdjust);

    // gjenopprett fokus på samme søyle synkront
    if (lastFocusIndex === i) {
      a11y.focus({ preventScroll: true });
    }

    // 4) Verdi (øverst, ikke-interaktiv)
    const txt = addTo(gVals,'text',{x:cx, y:y-10, class:'value'});
    txt.textContent = fmt(v);
  });
}

/* =========================================================
   DRAGGING (mus/berøring)
   ========================================================= */
function onDragStart(e){
  const idx = +e.currentTarget.dataset.index;
  lastFocusIndex = idx;

  const move = ev=>{
    const p = clientToSvg(ev.clientX, ev.clientY);
    const clampedY = Math.min(H-M.b, Math.max(M.t, p.y));
    const v = yToValue(clampedY);
    setValue(idx, v, true);
  };
  const up = ()=>{
    window.removeEventListener('pointermove', move);
    window.removeEventListener('pointerup', up);
  };
  window.addEventListener('pointermove', move);
  window.addEventListener('pointerup', up);
}

/* =========================================================
   TASTATUR (UU)
   ========================================================= */
function onKeyAdjust(e){
  const idx = +e.currentTarget.dataset.index;
  lastFocusIndex = idx;

  const step = CFG.snap || 1;
  const big  = step * 5;
  let target = values[idx];

  switch(e.key){
    case 'ArrowUp':
    case 'ArrowRight': target += step; break;
    case 'ArrowDown':
    case 'ArrowLeft':  target -= step; break;
    case 'PageUp':     target += big;  break;
    case 'PageDown':   target -= big;  break;
    case 'Home':       target = 0;     break;
    case 'End':        target = yMax;  break;
    default: return;
  }
  e.preventDefault();
  setValue(idx, target, true);
}

/* =========================================================
   STATE / BEREGNING
   ========================================================= */
function setValue(idx, newVal, announce=false){
  const snapped = snap(newVal, CFG.snap || 1);
  const v = clamp(snapped, yMin, yMax);
  values[idx] = v;
  drawBars(); // oppdater grafikk + aria
  if(announce){
    updateStatus(`${CFG.labels[idx]}: ${fmt(v)}`);
  }
}

function yToValue(py){
  const frac = (H - M.b - py) / innerH;     // inverse av yPos
  return yMin + frac * (yMax - yMin);
}

/* =========================================================
   KNAPPER
   ========================================================= */
document.getElementById('btnReset').addEventListener('click', ()=>{
  values = CFG.start.slice();
  clearBadges();
  lastFocusIndex = null;
  drawBars();
  updateStatus('Nullstilt.');
});
document.getElementById('btnShow').addEventListener('click', ()=>{
  values = CFG.answer.slice();
  lastFocusIndex = null;
  drawBars();
  markCorrectness();
  updateStatus('Dette er én fasit.');
});
document.getElementById('btnCheck').addEventListener('click', ()=>{
  markCorrectness();
  const ok = isCorrect(values, CFG.answer, CFG.tolerance||0);
  updateStatus(ok ? 'Riktig! 🎉' : 'Prøv igjen 🙂');
});

document.querySelector('.settings').addEventListener('input', applyCfg);

function applyCfg(){
  const lbls = parseList(document.getElementById('cfgLabels').value);
  const starts = parseNumList(document.getElementById('cfgStart').value);
  const answers = parseNumList(document.getElementById('cfgAnswer').value);
  const yMaxVal = parseFloat(document.getElementById('cfgYMax').value);
  CFG.title = document.getElementById('cfgTitle').value;
  CFG.labels = lbls;
  CFG.start  = alignLength(starts, lbls.length, 0);
  CFG.answer = alignLength(answers, lbls.length, 0);
  CFG.yMax   = isNaN(yMaxVal) ? undefined : yMaxVal;
  CFG.axisXLabel = document.getElementById('cfgAxisXLabel').value;
  CFG.axisYLabel = document.getElementById('cfgAxisYLabel').value;
  const snapVal = parseFloat(document.getElementById('cfgSnap').value);
  CFG.snap = isNaN(snapVal) ? 1 : snapVal;
  const tolVal = parseFloat(document.getElementById('cfgTolerance').value);
  CFG.tolerance = isNaN(tolVal) ? 0 : tolVal;
  initFromCfg();
}

/* =========================================================
   HJELPERE
   ========================================================= */
function add(name, attrs={}){
  const el = document.createElementNS('http://www.w3.org/2000/svg', name);
  Object.entries(attrs).forEach(([k,v])=>el.setAttribute(k,v));
  svg.appendChild(el); return el;
}
function addTo(group, name, attrs={}){
  const el = document.createElementNS(svg.namespaceURI, name);
  Object.entries(attrs).forEach(([k,v])=>el.setAttribute(k,v));
  group.appendChild(el); return el;
}
function clientToSvg(clientX, clientY){
  const rect = svg.getBoundingClientRect();
  const sx = W / rect.width, sy = H / rect.height;
  return { x:(clientX-rect.left)*sx, y:(clientY-rect.top)*sy };
}
function fmt(x){ return (Math.round(x*100)/100).toString().replace('.',','); }
function snap(v, s){ return Math.round(v / s) * s; }
function clamp(v,a,b){ return Math.max(a, Math.min(b,v)); }

function parseList(str){
  return str.split(',').map(s=>s.trim()).filter(s=>s.length>0);
}
function parseNumList(str){
  return parseList(str).map(s=>Number(s.replace(',', '.'))).map(v=>isNaN(v)?0:v);
}
function alignLength(arr, len, fill=0){
  if(arr.length < len) return arr.concat(Array(len-arr.length).fill(fill));
  if(arr.length > len) return arr.slice(0,len);
  return arr;
}

function niceMax(arr){
  const m = Math.max(...arr);
  if(m<=10) return 10;
  if(m<=12) return 12;
  const pow = Math.pow(10, Math.floor(Math.log10(m)));
  const r = Math.ceil(m / pow);
  return r * pow;
}
function chooseStep(maxY){
  if(maxY<=10) return 1;
  if(maxY<=20) return 2;
  if(maxY<=50) return 5;
  return 10;
}
function updateStatus(msg){
  document.getElementById('status').textContent = msg; // aria-live="polite"
}
function clearBadges(){
  [...gBars.querySelectorAll('.bar')].forEach(b=>b.classList.remove('badge-ok','badge-no'));
}
function markCorrectness(){
  clearBadges();
  const tol = CFG.tolerance||0;
  [...gBars.children].forEach((rect,i)=>{
    const v = values[i], a = CFG.answer[i];
    const ok = Math.abs(v - a) <= tol;
    rect.classList.add(ok ? 'badge-ok' : 'badge-no');
  });
}
function isCorrect(vs, ans, tol){
  if(vs.length !== ans.length) return false;
  return vs.every((v,i)=> Math.abs(v-ans[i]) <= tol);
}
