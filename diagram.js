/* =========================================================
   KONFIG – forfatter styrer alt her
   ========================================================= */
const CFG = {
  type: 'stacked',
  title: 'Skjermtid per dag',
  labels: ['1','2','3','4','5','6','7'],
  series1: 'Gutter',
  series2: 'Jenter',
  start:  [1,6,1,1,2,1,0],
  start2: [1,3,2,0,2,0,0],
  answer: [1,6,1,1,2,1,0],
  answer2:[1,3,2,0,2,0,0],
  yMax:   9,
  snap:   1,
  tolerance: 0,
  axisXLabel: 'Timer per dag',
  axisYLabel: 'Antall personer',
  locked: []
};

/* =========================================================
   OPPSETT
   ========================================================= */
const svg = document.getElementById('barsvg');
const W = 900, H = 560;
const M = {l:80, r:30, t:40, b:70};

const innerW = W - M.l - M.r;
const innerH = H - M.t - M.b;

/* Lagrekkefølge: grid, akser, dataserier, håndtak, a11y, verdier (øverst), labels, legend */
const gGrid   = add('g');
const gAxis   = add('g');
const gBars   = add('g');
const gHands  = add('g');
const gA11y   = add('g');
const gVals   = add('g');
const gLabels = add('g');
const gLegend = add('g');

let values = [];
let values2 = null;
let seriesNames = [];
let locked = [];
let N = 0;

let yMax = 0;

const btnSvg = document.getElementById('btnSvg');
const btnPng = document.getElementById('btnPng');
btnSvg?.addEventListener('click', ()=> downloadSVG(svg, 'diagram.svg'));
btnPng?.addEventListener('click', ()=> downloadPNG(svg, 'diagram.png', 2));
const yMin = 0;

// skalaer
let xBand = 0;
let barW  = 0;
function xPos(i){ return M.l + xBand*i + xBand/2; }
function yPos(v){ return M.t + innerH - (v - yMin) / (yMax - yMin) * innerH; }

// husk sist fokusert søyle mellom redraw
let lastFocusIndex = null;

initFromCfg();

function initFromCfg(){
  values = CFG.start.slice();
  values2 = CFG.start2 ? CFG.start2.slice() : null;
  seriesNames = [CFG.series1 || '', CFG.series2 || ''];
  N = CFG.labels.length;
  xBand = innerW / N;
  barW  = xBand * 0.6;
  const allVals = [...CFG.start, ...(CFG.start2||[]), ...(CFG.answer||[]), ...(CFG.answer2||[])];
  yMax  = CFG.yMax ?? niceMax(allVals);
  locked = alignLength(CFG.locked || [], N, false);
  lastFocusIndex = null;
  document.getElementById('chartTitle').textContent = CFG.title || '';

  // disable stacking/grouping options when only one dataserie
  const typeSel = document.getElementById('cfgType');
  const hasTwo = values2 && values2.length;
  [...typeSel.options].forEach(opt=>{
    if(!hasTwo && (opt.value==='stacked' || opt.value==='grouped')) opt.disabled = true;
    else opt.disabled = false;
  });

  drawAxesAndGrid();
  drawData();
  updateStatus(CFG.type==='bar' && !hasTwo ? 'Dra i søylene/håndtaket – eller bruk tastaturet.' : '');
}

/* =========================================================
   RENDER
   ========================================================= */
function drawAxesAndGrid(){
  gGrid.innerHTML = ''; gAxis.innerHTML = ''; gLabels.innerHTML = '';

  const step = chooseStep(yMax);
  for(let y=0; y<=yMax + 1e-9; y+=step){
    const yy = yPos(y);
    addTo(gGrid,'line',{x1:M.l, y1:yy, x2:W-M.r, y2:yy, class:'gridline'});
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
  addTo(gLabels,'text',{x:M.l + innerW/2, y:H - 24, class:'xAxisLabel'}).textContent = CFG.axisXLabel || '';
}

function drawData(){
  gBars.innerHTML=''; gVals.innerHTML=''; gHands.innerHTML=''; gA11y.innerHTML=''; gLegend.innerHTML='';
  const hasTwo = values2 && values2.length;
  if(CFG.type === 'line'){
    drawLines();
  }else if(hasTwo && CFG.type === 'grouped'){
    drawGroupedBars();
  }else if(hasTwo && CFG.type === 'stacked'){
    drawStackedBars();
  }else{
    drawBars();
  }
  drawLegend();
}

function drawLegend(){
  const names = [];
  if(seriesNames[0]) names.push({name:seriesNames[0], cls:'series0'});
  if(values2 && values2.length && seriesNames[1]) names.push({name:seriesNames[1], cls:'series1'});
  names.forEach((s,i)=>{
    const x = M.l + i*120;
    const y = M.t - 10;
    addTo(gLegend,'rect',{x:x, y:y-10, width:20, height:10, class:'legendbox '+s.cls});
    addTo(gLegend,'text',{x:x+26,y:y,class:'legendtext'}).textContent = s.name;
  });
}

function drawLines(){
  const datasets = [values];
  if(values2 && values2.length) datasets.push(values2);
  datasets.forEach((arr,idx)=>{
    const path = arr.map((v,i)=> (i?'L':'M') + xPos(i) + ',' + yPos(v)).join(' ');
    addTo(gBars,'path',{d:path,class:'line series'+idx});
    arr.forEach((v,i)=>{
      addTo(gBars,'circle',{cx:xPos(i), cy:yPos(v), r:4, class:'line-dot series'+idx});
    });
  });
}

function drawGroupedBars(){
  const hasTwo = values2 && values2.length;
  const barTotal = xBand*0.6;
  const barSingle = hasTwo ? barTotal/2 : barTotal;
  for(let i=0;i<N;i++){
    const x0 = xPos(i) - barTotal/2;
    const y1 = yPos(values[i]);
    addTo(gBars,'rect',{x:x0, y:y1, width:barSingle, height:Math.max(2,(H-M.b)-y1), class:'bar series0'});
    if(hasTwo){
      const y2 = yPos(values2[i]);
      addTo(gBars,'rect',{x:x0+barSingle, y:y2, width:barSingle, height:Math.max(2,(H-M.b)-y2), class:'bar series1'});
    }
  }
}

function drawStackedBars(){
  const barTotal = xBand*0.6;
  for(let i=0;i<N;i++){
    const base = H-M.b;
    const v1 = values[i];
    const v2 = values2 ? values2[i] : 0;
    const y1 = yPos(v1);
    addTo(gBars,'rect',{x:xPos(i)-barTotal/2, y:y1, width:barTotal, height:Math.max(2,base-y1), class:'bar series0'});
    if(values2){
      const y2 = yPos(v1+v2);
      addTo(gBars,'rect',{x:xPos(i)-barTotal/2, y:y2, width:barTotal, height:Math.max(2,y1-y2), class:'bar series1'});
    }
  }
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
      class: 'bar series0' + (locked[i] ? ' locked' : '')
    });
    rect.dataset.index = i;
    rect.addEventListener('pointerdown', onDragStart);

    // 2) HÅNDTAK (draggbar)
    if (!locked[i]) {
      addTo(gHands,'circle',{cx:cx, cy:y-2+2, r:16, class:'handleShadow'});
      const h = addTo(gHands,'circle',{cx:cx, cy:y-2, r:14, class:'handle'});
      h.dataset.index = i;
      h.addEventListener('pointerdown', onDragStart);
    }

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
    if(locked[i]) a11y.setAttribute('aria-disabled','true');
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
  if (locked[idx]) return;
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
  if (locked[idx]) return;
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
  if (locked[idx]) return;
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
  if(values2 && values2.length && CFG.type !== 'bar') return;
  values = CFG.start.slice();
  clearBadges();
  lastFocusIndex = null;
  drawBars();
  updateStatus('Nullstilt.');
});
document.getElementById('btnShow').addEventListener('click', ()=>{
  if(values2 && values2.length && CFG.type !== 'bar') return;
  values = CFG.answer.slice();
  lastFocusIndex = null;
  drawBars();
  markCorrectness();
  updateStatus('Dette er én fasit.');
});
document.getElementById('btnCheck').addEventListener('click', ()=>{
  if(values2 && values2.length && CFG.type !== 'bar') return;
  markCorrectness();
  const ok = isCorrect(values, CFG.answer, CFG.tolerance||0);
  updateStatus(ok ? 'Riktig! 🎉' : 'Prøv igjen 🙂');
});

document.querySelector('.settings').addEventListener('input', applyCfg);

function applyCfg(){
  const lbls = parseList(document.getElementById('cfgLabels').value);
  const starts = parseNumList(document.getElementById('cfgStart').value);
  const starts2 = parseNumList(document.getElementById('cfgStart2').value);
  const answers = parseNumList(document.getElementById('cfgAnswer').value);
  const answers2 = parseNumList(document.getElementById('cfgAnswer2').value);
  const yMaxVal = parseFloat(document.getElementById('cfgYMax').value);
  CFG.title = document.getElementById('cfgTitle').value;
  CFG.type = document.getElementById('cfgType').value;
  CFG.series1 = document.getElementById('cfgSeries1').value;
  CFG.series2 = document.getElementById('cfgSeries2').value;
  CFG.labels = lbls;
  CFG.start  = alignLength(starts, lbls.length, 0);
  CFG.start2 = alignLength(starts2, lbls.length, 0);
  CFG.answer = alignLength(answers, lbls.length, 0);
  CFG.answer2= alignLength(answers2, lbls.length, 0);
  CFG.yMax   = isNaN(yMaxVal) ? undefined : yMaxVal;
  CFG.axisXLabel = document.getElementById('cfgAxisXLabel').value;
  CFG.axisYLabel = document.getElementById('cfgAxisYLabel').value;
  const snapVal = parseFloat(document.getElementById('cfgSnap').value);
  CFG.snap = isNaN(snapVal) ? 1 : snapVal;
  const tolVal = parseFloat(document.getElementById('cfgTolerance').value);
  CFG.tolerance = isNaN(tolVal) ? 0 : tolVal;
  const lockedVals = parseNumList(document.getElementById('cfgLocked').value).map(v=>v!==0);
  CFG.locked = alignLength(lockedVals, lbls.length, false);
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
  const h = vb?.height || svgEl.clientHeight || 560;
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
