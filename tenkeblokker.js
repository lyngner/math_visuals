/* Tenkeblokker – full JS m/ firkantparentes */

/* ============ ENKEL KONFIG (FORFATTER) ============ */
const SIMPLE = {
  total: 50,       // tallet i parentesen
  startN: 5,       // antall blokker (nevner)
  startK: 4,       // antall fylte blokker (teller)
  minN: 2,
  maxN: 12
};

/* ============ ADV KONFIG (VALGFRITT) ============ */
const ADV = {
  bracketTick: 16,   // lengde på «haken» ned i hver ende
  labelOffsetY: 14   // løft tallet litt over parentes-linjen
};

/* ============ DERIVERT KONFIG FOR RENDER (IKKE REDIGER) ============ */
let CFG = {
  total: SIMPLE.total,
  minN: SIMPLE.minN,
  maxN: SIMPLE.maxN,
  bracketTick: ADV.bracketTick,
  labelOffsetY: ADV.labelOffsetY
};

let n = clamp(SIMPLE.startN, CFG.minN, CFG.maxN);
let k = clamp(SIMPLE.startK, 0, n);

// ---------- SVG-oppsett ----------
const svg = document.getElementById('thinkBlocks');
svg.innerHTML = '';

const VBW = 900, VBH = 420;                  // MÅ samsvare med viewBox i HTML
const L = 70, R = VBW - 70;                  // venstre/høyre marg
const TOP = 130, BOT = VBH - 60;             // ramme-topp/-bunn
const BRACE_Y = 78;                          // høyde for parentes

// Lag i riktig tegnerekkefølge
const gBase   = add('g');     // bakgrunn
const gFill   = add('g');     // fylte blokker
const gSep    = add('g');     // skillelinjer
const gVals   = add('g');     // tall i blokker
const gFrame  = add('g');     // svart ramme
const gHandle = add('g');     // håndtak
const gBrace  = add('g');     // parentes + TOTAL

// Bakgrunn + ramme
addTo(gBase ,'rect',{x:L,y:TOP,width:R-L,height:BOT-TOP,class:'tb-rect-empty'});
addTo(gFrame,'rect',{x:L,y:TOP,width:R-L,height:BOT-TOP,class:'tb-frame'});

// Firkantparentes + total tegnes i applyConfig()

// Håndtak
const handleShadow = addTo(gHandle,'circle',{cx:R, cy:(TOP+BOT)/2+2, r:20, class:'tb-handle-shadow'});
const handle       = addTo(gHandle,'circle',{cx:R, cy:(TOP+BOT)/2,   r:18, class:'tb-handle'});

// ---------- Interaksjon ----------
document.getElementById('tbMinus').addEventListener('click', ()=> setN(n-1));
document.getElementById('tbPlus') .addEventListener('click', ()=> setN(n+1));

handle.addEventListener('pointerdown', onDragStart);
function onDragStart(e){
  handle.setPointerCapture(e.pointerId);
  const move = ev=>{
    const p = clientToSvg(ev.clientX, ev.clientY);    // skjerm → viewBox
    const x = clamp(p.x, L, R);
    const cellW = (R-L)/n;
    const snapK = Math.round((x-L)/cellW);            // 0..n (kan helt til høyre)
    setK(snapK);
  };
  const up = ()=>{
    handle.releasePointerCapture(e.pointerId);
    window.removeEventListener('pointermove', move);
    window.removeEventListener('pointerup', up);
  };
  window.addEventListener('pointermove', move);
  window.addEventListener('pointerup', up);
}

// ---------- Utils ----------
function add(name, attrs={}){
  const el = document.createElementNS('http://www.w3.org/2000/svg', name);
  Object.entries(attrs).forEach(([k,v])=>el.setAttribute(k,v));
  svg.appendChild(el);
  return el;
}
function addTo(group, name, attrs){
  const el = document.createElementNS(svg.namespaceURI, name);
  Object.entries(attrs).forEach(([k,v])=>el.setAttribute(k,v));
  group.appendChild(el);
  return el;
}
function clamp(v,a,b){ return Math.max(a, Math.min(b,v)); }
function fmt(x){ return (Math.round(x*100)/100).toString().replace('.',','); }

// Skjerm-px → SVG viewBox-koordinater
function clientToSvg(clientX, clientY){
  const rect = svg.getBoundingClientRect();
  const sx = VBW / rect.width;
  const sy = VBH / rect.height;
  return { x: (clientX - rect.left) * sx, y: (clientY - rect.top) * sy };
}

// Firkantparentes (rett linje med «hak» i begge ender)
function drawBracketSquare(x0, x1, y, tick){
  gBrace.innerHTML = '';
  const d = [
    `M ${x0} ${y}`, `v ${tick}`,          // venstre «hak»
    `M ${x0} ${y}`, `H ${x1}`,            // topplinje
    `M ${x1} ${y}`, `v ${tick}`           // høyre «hak»
  ].join(' ');
  const path = document.createElementNS(svg.namespaceURI,'path');
  path.setAttribute('d', d);
  path.setAttribute('class','tb-brace');  // bruker samme stil (teal) fra CSS
  gBrace.appendChild(path);
}

function applyConfig(){
  CFG = {
    total: SIMPLE.total,
    minN: SIMPLE.minN,
    maxN: SIMPLE.maxN,
    bracketTick: ADV.bracketTick,
    labelOffsetY: ADV.labelOffsetY
  };
  n = clamp(SIMPLE.startN, CFG.minN, CFG.maxN);
  k = clamp(SIMPLE.startK, 0, n);
  drawBracketSquare(L, R, BRACE_Y, CFG.bracketTick);
  addTo(gBrace,'text',{x:(L+R)/2, y:BRACE_Y - CFG.labelOffsetY, class:'tb-total'}).textContent = CFG.total;
  redraw();
}

// ---------- Tegning ----------
function redraw(){
  gFill.innerHTML = '';
  gSep.innerHTML  = '';
  gVals.innerHTML = '';

  const cellW = (R-L)/n;

  // fylte celler
  for(let i=0;i<k;i++){
    addTo(gFill,'rect',{x:L+i*cellW,y:TOP,width:cellW,height:BOT-TOP,class:'tb-rect'});
  }
  // skillelinjer
  for(let i=1;i<n;i++){
    const x = L + i*cellW;
    addTo(gSep,'line',{x1:x,y1:TOP,x2:x,y2:BOT,class:'tb-sep'});
  }
  // verdier i fylte celler
  const per = CFG.total / n;
  for(let i=0;i<k;i++){
    const cx = L + (i+0.5)*cellW;
    const cy = (TOP+BOT)/2;
    addTo(gVals,'text',{x:cx,y:cy,class:'tb-val'}).textContent = fmt(per);
  }
  // håndtak-pos
  const hx = L + k*cellW;
  handle.setAttribute('cx', hx);
  handleShadow.setAttribute('cx', hx);
}

// ---------- State ----------
function setN(next){
  n = clamp(next, CFG.minN, CFG.maxN);
  if(k>n) k = n;
  redraw();
}
function setK(next){
  k = clamp(next, 0, n);
  redraw();
}

function setupSettingsUI(){
  const totalInput = document.getElementById('cfg-total');
  const nInput = document.getElementById('cfg-startN');
  const kInput = document.getElementById('cfg-startK');
  const minInput = document.getElementById('cfg-minN');
  const maxInput = document.getElementById('cfg-maxN');
  if(!totalInput || !nInput || !kInput || !minInput || !maxInput) return;

  totalInput.value = SIMPLE.total;
  nInput.value = SIMPLE.startN;
  kInput.value = SIMPLE.startK;
  minInput.value = SIMPLE.minN;
  maxInput.value = SIMPLE.maxN;

  function update(){
    SIMPLE.total = parseInt(totalInput.value) || SIMPLE.total;
    SIMPLE.startN = parseInt(nInput.value) || SIMPLE.startN;
    SIMPLE.startK = parseInt(kInput.value) || SIMPLE.startK;
    SIMPLE.minN = parseInt(minInput.value) || SIMPLE.minN;
    SIMPLE.maxN = parseInt(maxInput.value) || SIMPLE.maxN;
    applyConfig();
  }

  totalInput.addEventListener('change', update);
  nInput.addEventListener('change', update);
  kInput.addEventListener('change', update);
  minInput.addEventListener('change', update);
  maxInput.addEventListener('change', update);
}

// init
setupSettingsUI();
applyConfig();
