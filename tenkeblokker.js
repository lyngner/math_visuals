/* Tenkeblokker – med innstillinger */

// ---------- Konfig ----------
const CONFIG = {
  total: 50,      // tallet i parentesen
  n: 5,           // antall blokker (nevner)
  k: 4,           // antall fylte blokker (teller)
  minN: 2,
  maxN: 12
};

// ---------- SVG-oppsett ----------
const svg = document.getElementById('thinkBlocks');
svg.innerHTML = '';

const VBW = 900, VBH = 420;                  // MÅ samsvare med viewBox i HTML
const L = 70, R = VBW - 70;                  // venstre/høyre marg
const TOP = 130, BOT = VBH - 60;             // ramme-topp/-bunn
const BRACE_Y = 78;                          // høyde for parentes
const BRACKET_TICK = 16;                     // lengde på «haken» ned i hver ende
const LABEL_OFFSET_Y = 14;                   // løft tallet litt over parentes-linjen

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

// Håndtak
const handleShadow = addTo(gHandle,'circle',{cx:R, cy:(TOP+BOT)/2+2, r:20, class:'tb-handle-shadow'});
const handle       = addTo(gHandle,'circle',{cx:R, cy:(TOP+BOT)/2,   r:18, class:'tb-handle'});

// ---------- Interaksjon ----------
document.getElementById('tbMinus').addEventListener('click', ()=> setN(CONFIG.n-1));
document.getElementById('tbPlus') .addEventListener('click', ()=> setN(CONFIG.n+1));

handle.addEventListener('pointerdown', onDragStart);
function onDragStart(e){
  handle.setPointerCapture(e.pointerId);
  const move = ev=>{
    const p = clientToSvg(ev.clientX, ev.clientY);    // skjerm → viewBox
    const x = clamp(p.x, L, R);
    const cellW = (R-L)/CONFIG.n;
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

const btnSvg = document.getElementById('btnSvg');
const btnPng = document.getElementById('btnPng');
btnSvg?.addEventListener('click', ()=> downloadSVG(svg, 'tenkeblokker.svg'));
btnPng?.addEventListener('click', ()=> downloadPNG(svg, 'tenkeblokker.png', 2));

let inpTotal, inpN, inpK;
setupSettingsUI();

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

function svgToString(svgEl){
  const clone = svgEl.cloneNode(true);
  const css = [...document.querySelectorAll('style')].map(s => s.textContent).join('\n');
  const style = document.createElement('style');
  style.textContent = css;
  clone.insertBefore(style, clone.firstChild);
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
  const vb = svgEl.viewBox?.baseVal;
  const w = vb?.width || svgEl.clientWidth || 420;
  const h = vb?.height|| svgEl.clientHeight || 420;
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
    },'image/png');
  };
  img.src = url;
}

// ---------- Tegning ----------
function draw(){
  gFill.innerHTML = '';
  gSep.innerHTML  = '';
  gVals.innerHTML = '';

  if(inpTotal) inpTotal.value = CONFIG.total;
  if(inpN){
    inpN.value = CONFIG.n;
    inpN.min = CONFIG.minN;
    inpN.max = CONFIG.maxN;
  }
  if(inpK){
    inpK.value = CONFIG.k;
    inpK.max = CONFIG.n;
  }
  totalText.textContent = CONFIG.total;

  const cellW = (R-L)/CONFIG.n;

  // fylte celler
  for(let i=0;i<CONFIG.k;i++){
    addTo(gFill,'rect',{x:L+i*cellW,y:TOP,width:cellW,height:BOT-TOP,class:'tb-rect'});
  }
  // skillelinjer
  for(let i=1;i<CONFIG.n;i++){
    const x = L + i*cellW;
    addTo(gSep,'line',{x1:x,y1:TOP,x2:x,y2:BOT,class:'tb-sep'});
  }
  // verdier i fylte celler
  const per = CONFIG.total / CONFIG.n;
  for(let i=0;i<CONFIG.k;i++){
    const cx = L + (i+0.5)*cellW;
    const cy = (TOP+BOT)/2;
    addTo(gVals,'text',{x:cx,y:cy,class:'tb-val'}).textContent = fmt(per);
  }
  // håndtak-pos
  const hx = L + CONFIG.k*cellW;
  handle.setAttribute('cx', hx);
  handleShadow.setAttribute('cx', hx);
}

// ---------- State ----------
function setN(next){
  CONFIG.n = clamp(next, CONFIG.minN, CONFIG.maxN);
  if(CONFIG.k > CONFIG.n) CONFIG.k = CONFIG.n;
  draw();
}
function setK(next){
  CONFIG.k = clamp(next, 0, CONFIG.n);
  draw();
}

function setupSettingsUI(){
  inpTotal = document.getElementById('cfg-total');
  inpN     = document.getElementById('cfg-n');
  inpK     = document.getElementById('cfg-k');
  inpTotal?.addEventListener('change', ()=>{
    const v = parseFloat(inpTotal.value);
    if(!Number.isNaN(v)) CONFIG.total = v;
    draw();
  });
  inpN?.addEventListener('change', ()=>{
    const v = parseInt(inpN.value,10);
    if(!Number.isNaN(v)) setN(v);
  });
  inpK?.addEventListener('change', ()=>{
    const v = parseInt(inpK.value,10);
    if(!Number.isNaN(v)) setK(v);
  });
}

// init
window.CONFIG = CONFIG;
window.draw = draw;
draw();
