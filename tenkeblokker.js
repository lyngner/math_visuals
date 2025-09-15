/* Tenkeblokker – full JS m/ firkantparentes */

// ---------- Konfig ----------
const CONFIG = {
  total: 50,
  minN: 2,
  maxN: 12,
  n: 5,
  k: 4
};
window.CONFIG = CONFIG;
let TOTAL = CONFIG.total;          // tallet i parentesen
let MIN_N = CONFIG.minN;
let MAX_N = CONFIG.maxN;
let n = CONFIG.n;                 // antall blokker (nevner)
let k = CONFIG.k;                 // antall fylte blokker (teller), 0..n

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
const totalText = addTo(gBrace,'text',{x:(L+R)/2, y:BRACE_Y - LABEL_OFFSET_Y, class:'tb-total'});
totalText.textContent = TOTAL;

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
  CONFIG.n = n;
  cfgN.value = n;
  cfgK.max = n;
  if(k>n) k = n;
  cfgK.value = k;
  CONFIG.k = k;
  redraw();
}
function setK(next){
  k = clamp(next, 0, n);
  CONFIG.k = k;
  cfgK.value = k;
  redraw();
}

// ---------- Eksport & kontroller ----------
const cfgTotal = document.getElementById('cfg-total');
const cfgMinN  = document.getElementById('cfg-min-n');
const cfgMaxN  = document.getElementById('cfg-max-n');
const cfgN     = document.getElementById('cfg-n');
const cfgK     = document.getElementById('cfg-k');

cfgTotal.addEventListener('input', ()=>{
  TOTAL = CONFIG.total = parseInt(cfgTotal.value,10) || 0;
  totalText.textContent = TOTAL;
  redraw();
});
cfgMinN.addEventListener('input', ()=>{
  MIN_N = CONFIG.minN = parseInt(cfgMinN.value,10) || 1;
  setN(n);
});
cfgMaxN.addEventListener('input', ()=>{
  MAX_N = CONFIG.maxN = parseInt(cfgMaxN.value,10) || 1;
  setN(n);
});
cfgN.addEventListener('input', ()=> setN(parseInt(cfgN.value,10) || n));
cfgK.addEventListener('input', ()=> setK(parseInt(cfgK.value,10) || k));

document.getElementById('btnSvg').addEventListener('click', ()=> downloadSVG(svg, 'tenkeblokker.svg'));
document.getElementById('btnPng').addEventListener('click', ()=> downloadPNG(svg, 'tenkeblokker.png', 2));

// ---------- SVG til fil ----------
function svgToString(svgEl){
  const clone = svgEl.cloneNode(true);
  const css = [...document.querySelectorAll('style')].map(s => s.textContent).join('\n');
  const style = document.createElement('style');
  style.textContent = css;
  clone.insertBefore(style, clone.firstChild);

  const ids = new Set();
  clone.querySelectorAll('[aria-describedby]').forEach(el => {
    el.getAttribute('aria-describedby')?.split(/\s+/).forEach(id => ids.add(id));
  });
  ids.forEach(id => {
    if(!id || clone.getElementById(id)) return;
    const src = document.getElementById(id);
    if(src){
      const desc = document.createElementNS('http://www.w3.org/2000/svg','desc');
      desc.setAttribute('id', id);
      desc.textContent = src.textContent;
      clone.insertBefore(desc, style.nextSibling);
    }
  });

  clone.setAttribute('xmlns','http://www.w3.org/2000/svg');
  clone.setAttribute('xmlns:xlink','http://www.w3.org/1999/xlink');
  return '<?xml version="1.0" encoding="UTF-8"?>\n' + new XMLSerializer().serializeToString(clone);
}
function downloadSVG(svgEl, filename){
  const data = svgToString(svgEl);
  const blob = new Blob([data], {type:'image/svg+xml;charset=utf-8'});
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename.endsWith('.svg') ? filename : filename + '.svg';
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(()=>URL.revokeObjectURL(url),1000);
}
function downloadPNG(svgEl, filename, scale=2, bg='#fff'){
  const vb = svgEl.viewBox.baseVal;
  const w = vb?.width  || svgEl.clientWidth  || VBW;
  const h = vb?.height || svgEl.clientHeight || VBH;
  const data = svgToString(svgEl);
  const blob = new Blob([data], {type:'image/svg+xml;charset=utf-8'});
  const url  = URL.createObjectURL(blob);
  const img = new Image();
  img.onload = ()=>{
    const canvas = document.createElement('canvas');
    canvas.width  = Math.round(w * scale);
    canvas.height = Math.round(h * scale);
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = bg;
    ctx.fillRect(0,0,canvas.width,canvas.height);
    ctx.drawImage(img,0,0,canvas.width,canvas.height);
    URL.revokeObjectURL(url);
    canvas.toBlob(blob=>{
      const urlPng = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = urlPng;
      a.download = filename.endsWith('.png') ? filename : filename + '.png';
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(()=>URL.revokeObjectURL(urlPng),1000);
    }, 'image/png');
  };
  img.src = url;
}

// init
setN(n);
setK(k);
