/* Tenkeblokker – full JS m/ firkantparentes */

/* ============ ENKEL KONFIG (FORFATTER) ============ */
const SIMPLE = {
  total: 50,       // tallet i parentesen
  startN: 1,       // antall kolonner
  startK: 0,       // antall fylte blokker
  startM: 1,       // antall rader
  blockCols: [],   // kolonnegrenser for tykke linjer
  minN: 1,
  maxN: 3,
  minM: 1,
  maxM: 3,
  showWhole: true,    // vis parentes + total
  showStepper: true,  // vis pluss-knapper
  showHandle: true,   // vis håndtak
  valMode: 'rounded'  // 'rounded' | 'exact' | 'fraction' | 'percent'
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
  minM: SIMPLE.minM,
  maxM: SIMPLE.maxM,
  bracketTick: ADV.bracketTick,
  labelOffsetY: ADV.labelOffsetY,
  showWhole: SIMPLE.showWhole,
  showStepper: SIMPLE.showStepper,
  showHandle: SIMPLE.showHandle,
  valMode: SIMPLE.valMode,
  blockCols: SIMPLE.blockCols || []
};

let n = clamp(SIMPLE.startN, CFG.minN, CFG.maxN);
let m = clamp(SIMPLE.startM, CFG.minM, CFG.maxM);
let k = clamp(SIMPLE.startK, 0, n*m);

// ---------- SVG-oppsett ----------
const svg = document.getElementById('thinkBlocks');
const overlay = document.getElementById('tbOverlay');
const live = document.getElementById('tbLive');

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
if(overlay){
  svg.appendChild(overlay);
  overlay.setAttribute('x', L);
  overlay.setAttribute('y', TOP);
  overlay.setAttribute('width', R-L);
  overlay.setAttribute('height', BOT-TOP);
}

// Bakgrunn + ramme
addTo(gBase ,'rect',{x:L,y:TOP,width:R-L,height:BOT-TOP,class:'tb-rect-empty'});
addTo(gFrame,'rect',{x:L,y:TOP,width:R-L,height:BOT-TOP,class:'tb-frame'});

// Firkantparentes + total tegnes i applyConfig()

// Håndtak
const handleShadow = addTo(gHandle,'circle',{cx:R, cy:(TOP+BOT)/2+2, r:20, class:'tb-handle-shadow'});
const handle       = addTo(gHandle,'circle',{cx:R, cy:(TOP+BOT)/2,   r:18, class:'tb-handle'});
const addColBtn    = document.getElementById('tbAddCol');
const addRowBtn    = document.getElementById('tbAddRow');
const btnSvg       = document.getElementById('btnSvg');
const btnPng       = document.getElementById('btnPng');

// ---------- Interaksjon ----------
addColBtn?.addEventListener('click', ()=> setN(n+1));
addRowBtn?.addEventListener('click', ()=> setM(m+1));
btnSvg?.addEventListener('click', ()=> downloadSVG(svg, 'tenkeblokker.svg'));
btnPng?.addEventListener('click', ()=> downloadPNG(svg, 'tenkeblokker.png', 2));

handle.addEventListener('pointerdown', onDragStart);
overlay?.addEventListener('keydown', e=>{
  switch(e.key){
    case 'ArrowRight':
      setK(k+1);
      e.preventDefault();
      break;
    case 'ArrowLeft':
      setK(k-1);
      e.preventDefault();
      break;
    case 'ArrowUp':
      setK(k+n);
      e.preventDefault();
      break;
    case 'ArrowDown':
      setK(k-n);
      e.preventDefault();
      break;
    case 'Home':
      setK(0);
      e.preventDefault();
      break;
    case 'End':
      setK(n*m);
      e.preventDefault();
      break;
  }
});
function onDragStart(e){
  e.preventDefault();
  handle.setPointerCapture(e.pointerId);

  const html = document.documentElement;
  const prevHtmlOverscroll = html.style.overscrollBehavior;
  const prevBodyOverscroll = document.body.style.overscrollBehavior;
  html.style.overscrollBehavior = 'contain';
  document.body.style.overscrollBehavior = 'contain';

  const move = ev=>{
    ev.preventDefault();
    const p = clientToSvg(ev.clientX, ev.clientY);    // skjerm → viewBox
    const x = clamp(p.x, L, R);
    const y = clamp(p.y, TOP, BOT);
    const cellW = (R-L)/n;
    const cellH = (BOT-TOP)/m;
    const col = clamp(Math.round((x-L)/cellW), 0, n);
    const row = clamp(Math.round((y-TOP)/cellH), 0, m);
    const snapK = Math.min(row*n + col, n*m);
    setK(snapK);
  };
  const up = ()=>{
    handle.releasePointerCapture(e.pointerId);
    window.removeEventListener('pointermove', move);
    window.removeEventListener('pointerup', up);
    html.style.overscrollBehavior = prevHtmlOverscroll;
    document.body.style.overscrollBehavior = prevBodyOverscroll;
  };
  window.addEventListener('pointermove', move, { passive: false });
  window.addEventListener('pointerup', up, { passive: false });
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
function fmtVal(per){
  switch(CFG.valMode){
    case 'percent':
      return fmt(100/n) + ' %';
    case 'exact':
      return per.toString().replace('.',',');
    case 'rounded':
    default:
      return fmt(per);
  }
}

function addFractionVal(cx, cy, num, den){
  const lineW = 28;
  const lineOffsetY = -2; // lift fraction bar slightly for better visual balance
  addTo(gVals,'text',{x:cx, y:cy-18, class:'tb-val'}).textContent = num;
  addTo(gVals,'line',{x1:cx-lineW/2, y1:cy+lineOffsetY, x2:cx+lineW/2, y2:cy+lineOffsetY, stroke:'#111', 'stroke-width':2});
  addTo(gVals,'text',{x:cx, y:cy+18, class:'tb-val'}).textContent = den;
}

// Skjerm-px → SVG viewBox-koordinater
function clientToSvg(clientX, clientY){
  const rect = svg.getBoundingClientRect();
  const sx = VBW / rect.width;
  const sy = VBH / rect.height;
  return { x: (clientX - rect.left) * sx, y: (clientY - rect.top) * sy };
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
  setTimeout(()=>URL.revokeObjectURL(url), 1000);
}
function downloadPNG(svgEl, filename, scale=2, bg='#fff'){
  const vb = svgEl.viewBox.baseVal;
  const w = vb?.width  || svgEl.clientWidth  || 900;
  const h = vb?.height || svgEl.clientHeight || 420;
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
    minM: SIMPLE.minM,
    maxM: SIMPLE.maxM,
    bracketTick: ADV.bracketTick,
    labelOffsetY: ADV.labelOffsetY,
    showWhole: SIMPLE.showWhole,
    showStepper: SIMPLE.showStepper,
    showHandle: SIMPLE.showHandle,
    valMode: SIMPLE.valMode,
    blockCols: SIMPLE.blockCols || []
  };
  n = clamp(SIMPLE.startN, CFG.minN, CFG.maxN);
  m = clamp(SIMPLE.startM, CFG.minM, CFG.maxM);
  k = clamp(SIMPLE.startK, 0, n*m);
  gBrace.innerHTML = '';
  if(CFG.showWhole){
    drawBracketSquare(L, R, BRACE_Y, CFG.bracketTick);
    addTo(gBrace,'text',{x:(L+R)/2, y:BRACE_Y - CFG.labelOffsetY, class:'tb-total'}).textContent = CFG.total;
    gBrace.style.display = '';
  } else {
    gBrace.style.display = 'none';
  }
  if(addColBtn) addColBtn.style.display = CFG.showStepper ? '' : 'none';
  if(addRowBtn) addRowBtn.style.display = CFG.showStepper ? '' : 'none';
  gHandle.style.display  = CFG.showHandle ? '' : 'none';
  redraw();
}

// ---------- Tegning ----------
function redraw(){
  gFill.innerHTML = '';
  gSep.innerHTML  = '';
  gVals.innerHTML = '';

  const cellW = (R-L)/n;
  const cellH = (BOT-TOP)/m;

  // fylte celler
  for(let j=0;j<m;j++){
    for(let i=0;i<n;i++){
      const idx = j*n + i;
      if(idx < k){
        addTo(gFill,'rect',{x:L+i*cellW,y:TOP+j*cellH,width:cellW,height:cellH,class:'tb-rect'});
      }
    }
  }
  // skillelinjer
  for(let j=0;j<m;j++){
    const y1 = TOP + j*cellH;
    const y2 = y1 + cellH;
    for(let i=1;i<n;i++){
      if(CFG.blockCols.includes(i)) continue;
      const x = L + i*cellW;
      addTo(gSep,'line',{x1:x,y1:y1,x2:x,y2:y2,class:'tb-sep'});
    }
  }
  for(const i of CFG.blockCols){
    if(i<=0 || i>=n) continue;
    const x = L + i*cellW;
    addTo(gSep,'line',{x1:x,y1:TOP,x2:x,y2:BOT,class:'tb-block-sep'});
  }
  for(let j=1;j<m;j++){
    const y = TOP + j*cellH;
    addTo(gSep,'line',{x1:L,y1:y,x2:R,y2:y,class:'tb-block-sep'});
  }
  // verdier i fylte celler
  const per = CFG.total / (n*m);
  if(CFG.valMode === 'fraction'){
    for(let j=0;j<m;j++){
      for(let i=0;i<n;i++){
        const idx = j*n + i;
        if(idx < k){
          const cx = L + (i+0.5)*cellW;
          const cy = TOP + (j+0.5)*cellH;
          addFractionVal(cx, cy, 1, n*m);
        }
      }
    }
  } else {
    const valText = fmtVal(per);
    for(let j=0;j<m;j++){
      for(let i=0;i<n;i++){
        const idx = j*n + i;
        if(idx < k){
          const cx = L + (i+0.5)*cellW;
          const cy = TOP + (j+0.5)*cellH;
          addTo(gVals,'text',{x:cx,y:cy,class:'tb-val'}).textContent = valText;
        }
      }
    }
  }
  // håndtak-pos
  const hx = L + (k % n)*cellW;
  const hy = TOP + Math.floor(k / n)*cellH + cellH/2;
  handle.setAttribute('cx', hx);
  handle.setAttribute('cy', hy);
  handleShadow.setAttribute('cx', hx);
  handleShadow.setAttribute('cy', hy+2);
  updateAria();
  updateAddButtons();
}

function updateAria(){
  if(!overlay) return;
  overlay.setAttribute('aria-valuenow', k);
  overlay.setAttribute('aria-valuemax', n*m);
  const text = `${k} av ${n*m} blokker fylt`;
  overlay.setAttribute('aria-valuetext', text);
  if(live) live.textContent = text;
}

function updateAddButtons(){
  if(addColBtn){
    addColBtn.style.visibility = n < CFG.maxN ? 'visible' : 'hidden';
  }
  if(addRowBtn){
    addRowBtn.style.visibility = m < CFG.maxM ? 'visible' : 'hidden';
  }
}

// ---------- State ----------
function setN(next){
  n = clamp(next, CFG.minN, CFG.maxN);
  if(k>n*m) k = n*m;
  redraw();
}
function setM(next){
  m = clamp(next, CFG.minM, CFG.maxM);
  if(k>n*m) k = n*m;
  redraw();
}
function setK(next){
  k = clamp(next, 0, n*m);
  redraw();
}

function setupSettingsUI(){
  const totalInput = document.getElementById('cfg-total');
  const nInput = document.getElementById('cfg-startN');
  const kInput = document.getElementById('cfg-startK');
  const minInput = document.getElementById('cfg-minN');
  const maxInput = document.getElementById('cfg-maxN');
  const mInput = document.getElementById('cfg-startM');
  const minMInput = document.getElementById('cfg-minM');
  const maxMInput = document.getElementById('cfg-maxM');
  const showWholeInput = document.getElementById('cfg-showWhole');
  const showStepperInput = document.getElementById('cfg-showStepper');
  const showHandleInput = document.getElementById('cfg-showHandle');
  const valModeSelect = document.getElementById('cfg-valMode');
  if(!totalInput || !nInput || !kInput || !minInput || !maxInput || !mInput || !minMInput || !maxMInput || !showWholeInput || !showStepperInput || !showHandleInput || !valModeSelect) return;

  totalInput.value = SIMPLE.total;
  nInput.value = SIMPLE.startN;
  kInput.value = SIMPLE.startK;
  minInput.value = SIMPLE.minN;
  maxInput.value = SIMPLE.maxN;
  mInput.value = SIMPLE.startM;
  minMInput.value = SIMPLE.minM;
  maxMInput.value = SIMPLE.maxM;
  showWholeInput.checked = SIMPLE.showWhole;
  showStepperInput.checked = SIMPLE.showStepper;
  showHandleInput.checked = SIMPLE.showHandle;
  valModeSelect.value = SIMPLE.valMode;

  function update(){
    SIMPLE.total = parseInt(totalInput.value) || SIMPLE.total;
    SIMPLE.startN = parseInt(nInput.value) || SIMPLE.startN;
    SIMPLE.startK = parseInt(kInput.value) || SIMPLE.startK;
    SIMPLE.minN = parseInt(minInput.value) || SIMPLE.minN;
    SIMPLE.maxN = parseInt(maxInput.value) || SIMPLE.maxN;
    SIMPLE.startM = parseInt(mInput.value) || SIMPLE.startM;
    SIMPLE.minM = parseInt(minMInput.value) || SIMPLE.minM;
    SIMPLE.maxM = parseInt(maxMInput.value) || SIMPLE.maxM;
    SIMPLE.showWhole = showWholeInput.checked;
    SIMPLE.showStepper = showStepperInput.checked;
    SIMPLE.showHandle = showHandleInput.checked;
    SIMPLE.valMode = valModeSelect.value;
    applyConfig();
  }

  totalInput.addEventListener('change', update);
  nInput.addEventListener('change', update);
  kInput.addEventListener('change', update);
  minInput.addEventListener('change', update);
  maxInput.addEventListener('change', update);
  mInput.addEventListener('change', update);
  minMInput.addEventListener('change', update);
  maxMInput.addEventListener('change', update);
  showWholeInput.addEventListener('change', update);
  showStepperInput.addEventListener('change', update);
  showHandleInput.addEventListener('change', update);
  valModeSelect.addEventListener('change', update);
}

// init
setupSettingsUI();
applyConfig();
