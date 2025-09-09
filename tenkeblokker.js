/* Tenkeblokker – full JS m/ firkantparentes */

// ---------- Konfig ----------
const TOTAL = 50;          // tallet i parentesen
const MIN_N = 2;
const MAX_N = 12;

let n = 5;                 // antall blokker (nevner)
let k = 4;                 // antall fylte blokker (teller), 0..n

// Parentes-utseende
const BRACKET_TICK   = 16; // lengde på «haken» ned i hver ende
const LABEL_OFFSET_Y = 14; // løft tallet litt over parentes-linjen

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

// Firkantparentes + total
drawBracketSquare(L, R, BRACE_Y, BRACKET_TICK);
addTo(gBrace,'text',{x:(L+R)/2, y:BRACE_Y - LABEL_OFFSET_Y, class:'tb-total'}).textContent = TOTAL;

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
  const per = TOTAL / n;
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
  n = clamp(next, MIN_N, MAX_N);
  if(k>n) k = n;
  redraw();
}
function setK(next){
  k = clamp(next, 0, n);
  redraw();
}

// init
redraw();
