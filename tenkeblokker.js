/* Tenkeblokker – med innstillinger */

// ---------- Konfig ----------
const DEFAULT_BLOCKS = [
  { total: 50, n: 5, k: 4 },
  { total: 50, n: 5, k: 3 }
];

const CONFIG = {
  minN: 2,
  maxN: 12,
  blocks: DEFAULT_BLOCKS.map(block => ({ ...block })),
  activeBlocks: 1
};

CONFIG.total = CONFIG.blocks[0].total;
CONFIG.n = CONFIG.blocks[0].n;
CONFIG.k = CONFIG.blocks[0].k;

// ---------- SVG-oppsett ----------
const VBW = 900, VBH = 420;                  // MÅ samsvare med viewBox i HTML
const L = 70, R = VBW - 70;                  // venstre/høyre marg
const TOP = 130, BOT = VBH - 60;             // ramme-topp/-bunn
const BRACE_Y = 78;                          // høyde for parentes
const BRACKET_TICK = 16;                     // lengde på «haken» ned i hver ende
const LABEL_OFFSET_Y = 14;                   // løft tallet litt over parentes-linjen

const BLOCKS = [];
const settingsInputs = [];

const panels = {
  container: document.getElementById('tbPanels'),
  panel2: document.getElementById('tbPanel2'),
  fieldset2: document.getElementById('cfg-fieldset-2'),
  addBtn: document.getElementById('tbAdd')
};

createBlock(0);
createBlock(1);

const btnSvg = document.getElementById('btnSvg');
const btnPng = document.getElementById('btnPng');
btnSvg?.addEventListener('click', () => {
  const exportSvg = getExportSvg();
  if (exportSvg) downloadSVG(exportSvg, 'tenkeblokker.svg');
});
btnPng?.addEventListener('click', () => {
  const exportSvg = getExportSvg();
  if (exportSvg) downloadPNG(exportSvg, 'tenkeblokker.png', 2);
});

panels.addBtn?.addEventListener('click', () => {
  CONFIG.activeBlocks = 2;
  updateVisibility();
  draw();
});

setupSettingsUI();

// ---------- Utils ----------
function createSvgElement(parent, name, attrs = {}) {
  const svgEl = parent.ownerSVGElement || parent;
  const el = document.createElementNS(svgEl.namespaceURI, name);
  Object.entries(attrs).forEach(([k, v]) => el.setAttribute(k, v));
  parent.appendChild(el);
  return el;
}
function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }
function fmt(x) { return (Math.round(x * 100) / 100).toString().replace('.', ','); }

// Skjerm-px → SVG viewBox-koordinater
function clientToSvg(svgEl, clientX, clientY) {
  const rect = svgEl.getBoundingClientRect();
  const sx = VBW / rect.width;
  const sy = VBH / rect.height;
  return {
    x: (clientX - rect.left) * sx,
    y: (clientY - rect.top) * sy
  };
}

// Firkantparentes (rett linje med «hak» i begge ender)
function drawBracketSquare(group, x0, x1, y, tick) {
  const ns = group.ownerSVGElement?.namespaceURI || 'http://www.w3.org/2000/svg';
  group.innerHTML = '';
  const d = [
    `M ${x0} ${y}`, `v ${tick}`,          // venstre «hak»
    `M ${x0} ${y}`, `H ${x1}`,            // topplinje
    `M ${x1} ${y}`, `v ${tick}`           // høyre «hak»
  ].join(' ');
  const path = document.createElementNS(ns, 'path');
  path.setAttribute('d', d);
  path.setAttribute('class', 'tb-brace');
  group.appendChild(path);
}

function svgToString(svgEl) {
  const clone = svgEl.cloneNode(true);
  const css = [...document.querySelectorAll('style')].map(s => s.textContent).join('\n');
  const style = document.createElement('style');
  style.textContent = css;
  clone.insertBefore(style, clone.firstChild);
  clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
  clone.setAttribute('xmlns:xlink', 'http://www.w3.org/1999/xlink');
  return '<?xml version="1.0" encoding="UTF-8"?>\n' + new XMLSerializer().serializeToString(clone);
}
function downloadSVG(svgEl, filename) {
  const data = svgToString(svgEl);
  const blob = new Blob([data], { type: 'image/svg+xml;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename.endsWith('.svg') ? filename : filename + '.svg';
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
function downloadPNG(svgEl, filename, scale = 2, bg = '#fff') {
  const vb = svgEl.viewBox?.baseVal;
  const w = vb?.width || svgEl.clientWidth || 420;
  const h = vb?.height || svgEl.clientHeight || 420;
  const data = svgToString(svgEl);
  const blob = new Blob([data], { type: 'image/svg+xml;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const img = new Image();
  img.onload = () => {
    const canvas = document.createElement('canvas');
    canvas.width  = Math.round(w * scale);
    canvas.height = Math.round(h * scale);
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    URL.revokeObjectURL(url);
    canvas.toBlob(blob => {
      const urlPng = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = urlPng;
      a.download = filename.endsWith('.png') ? filename : filename + '.png';
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(urlPng), 1000);
    }, 'image/png');
  };
  img.src = url;
}

function getExportSvg() {
  normalizeConfig();
  const count = clamp(CONFIG.activeBlocks || 1, 1, 2);
  const firstSvg = BLOCKS[0]?.svg;
  if (!firstSvg) return null;
  if (count === 1) return firstSvg;

  const ns = firstSvg.namespaceURI;
  const gap = 80;
  const width = count * VBW + (count - 1) * gap;
  const exportSvg = document.createElementNS(ns, 'svg');
  exportSvg.setAttribute('viewBox', `0 0 ${width} ${VBH}`);
  exportSvg.setAttribute('width', width);
  exportSvg.setAttribute('height', VBH);
  exportSvg.setAttribute('xmlns', ns);
  exportSvg.setAttribute('xmlns:xlink', 'http://www.w3.org/1999/xlink');

  let x = 0;
  for (let i = 0; i < count; i++) {
    const block = BLOCKS[i];
    if (!block) continue;
    const g = document.createElementNS(ns, 'g');
    g.setAttribute('transform', `translate(${x},0)`);
    g.innerHTML = block.svg.innerHTML;
    exportSvg.appendChild(g);
    x += VBW;
    if (i < count - 1) x += gap;
  }
  return exportSvg;
}

function createBlock(index) {
  const svg = document.getElementById(`thinkBlocks${index + 1}`);
  if (!svg) return null;
  svg.innerHTML = '';

  const block = { index, svg };
  block.gBase   = createSvgElement(svg, 'g');     // bakgrunn
  block.gFill   = createSvgElement(svg, 'g');     // fylte blokker
  block.gSep    = createSvgElement(svg, 'g');     // skillelinjer
  block.gVals   = createSvgElement(svg, 'g');     // tall i blokker
  block.gFrame  = createSvgElement(svg, 'g');     // svart ramme
  block.gHandle = createSvgElement(svg, 'g');     // håndtak
  block.gBrace  = createSvgElement(svg, 'g');     // parentes + TOTAL

  createSvgElement(block.gBase,'rect',{x:L,y:TOP,width:R-L,height:BOT-TOP,class:'tb-rect-empty'});
  createSvgElement(block.gFrame,'rect',{x:L,y:TOP,width:R-L,height:BOT-TOP,class:'tb-frame'});
  drawBracketSquare(block.gBrace, L, R, BRACE_Y, BRACKET_TICK);
  block.totalText = createSvgElement(block.gBrace,'text',{x:(L+R)/2,y:BRACE_Y - LABEL_OFFSET_Y,class:'tb-total'});

  block.handleShadow = createSvgElement(block.gHandle,'circle',{cx:R,cy:(TOP+BOT)/2+2,r:20,class:'tb-handle-shadow'});
  block.handle       = createSvgElement(block.gHandle,'circle',{cx:R,cy:(TOP+BOT)/2,r:18,class:'tb-handle'});
  block.handle.addEventListener('pointerdown', e => onDragStart(block, e));

  const minus = document.getElementById(`tbMinus${index + 1}`);
  const plus  = document.getElementById(`tbPlus${index + 1}`);
  minus?.addEventListener('click', () => setN(index, (CONFIG.blocks[index]?.n ?? CONFIG.minN) - 1));
  plus?.addEventListener('click', () => setN(index, (CONFIG.blocks[index]?.n ?? CONFIG.minN) + 1));
  block.minusBtn = minus || null;
  block.plusBtn = plus || null;

  BLOCKS[index] = block;
  return block;
}

function onDragStart(block, e) {
  if (!block?.handle) return;
  block.handle.setPointerCapture(e.pointerId);
  const move = ev => {
    const cfg = CONFIG.blocks[block.index];
    if (!cfg) return;
    const p = clientToSvg(block.svg, ev.clientX, ev.clientY);
    const x = clamp(p.x, L, R);
    const cellW = (R - L) / cfg.n;
    const snapK = Math.round((x - L) / cellW);            // 0..n (kan helt til høyre)
    setK(block.index, snapK);
  };
  const up = () => {
    block.handle.releasePointerCapture(e.pointerId);
    window.removeEventListener('pointermove', move);
    window.removeEventListener('pointerup', up);
  };
  window.addEventListener('pointermove', move);
  window.addEventListener('pointerup', up);
}

function normalizeConfig() {
  if (!Array.isArray(CONFIG.blocks)) CONFIG.blocks = [];
  if (CONFIG.blocks.length > 2) CONFIG.blocks.length = 2;

  if (typeof CONFIG.minN !== 'number') CONFIG.minN = 2;
  if (typeof CONFIG.maxN !== 'number') CONFIG.maxN = 12;
  CONFIG.minN = Math.max(1, CONFIG.minN);
  CONFIG.maxN = Math.max(CONFIG.minN, CONFIG.maxN);

  for (let i = 0; i < 2; i++) {
    const defaults = DEFAULT_BLOCKS[i] || DEFAULT_BLOCKS[0];
    let cfg = CONFIG.blocks[i];
    if (!cfg || typeof cfg !== 'object') {
      cfg = { ...defaults };
      CONFIG.blocks[i] = cfg;
    }
    if (typeof cfg.total !== 'number' || Number.isNaN(cfg.total)) cfg.total = defaults.total;
    if (cfg.total < 1) cfg.total = 1;

    if (typeof cfg.n !== 'number' || Number.isNaN(cfg.n)) cfg.n = defaults.n;
    cfg.n = clamp(cfg.n, CONFIG.minN, CONFIG.maxN);

    if (typeof cfg.k !== 'number' || Number.isNaN(cfg.k)) cfg.k = defaults.k;
    cfg.k = clamp(cfg.k, 0, cfg.n);
  }

  if (typeof CONFIG.total === 'number') CONFIG.blocks[0].total = CONFIG.total;
  if (typeof CONFIG.n === 'number') CONFIG.blocks[0].n = clamp(CONFIG.n, CONFIG.minN, CONFIG.maxN);
  if (typeof CONFIG.k === 'number') CONFIG.blocks[0].k = clamp(CONFIG.k, 0, CONFIG.blocks[0].n);

  CONFIG.blocks[0].k = clamp(CONFIG.blocks[0].k, 0, CONFIG.blocks[0].n);

  if (typeof CONFIG.activeBlocks !== 'number') CONFIG.activeBlocks = 1;
  CONFIG.activeBlocks = clamp(CONFIG.activeBlocks, 1, 2);

  syncLegacyConfig();
}

function syncLegacyConfig() {
  const first = CONFIG.blocks[0];
  if (!first) return;
  CONFIG.total = first.total;
  CONFIG.n = first.n;
  CONFIG.k = first.k;
}

function updateVisibility() {
  const showSecond = (CONFIG.activeBlocks || 1) > 1;
  if (panels.panel2) panels.panel2.style.display = showSecond ? '' : 'none';
  if (panels.fieldset2) panels.fieldset2.style.display = showSecond ? '' : 'none';
  if (panels.addBtn) panels.addBtn.style.display = showSecond ? 'none' : '';
  panels.container?.classList.toggle('two', showSecond);
}

function drawBlock(index) {
  const block = BLOCKS[index];
  const cfg = CONFIG.blocks[index];
  if (!block || !cfg) return;

  block.gFill.innerHTML = '';
  block.gSep.innerHTML = '';
  block.gVals.innerHTML = '';

  const inputs = settingsInputs[index];
  if (inputs) {
    if (inputs.total) inputs.total.value = cfg.total;
    if (inputs.n) {
      inputs.n.value = cfg.n;
      inputs.n.min = CONFIG.minN;
      inputs.n.max = CONFIG.maxN;
    }
    if (inputs.k) {
      inputs.k.value = cfg.k;
      inputs.k.max = cfg.n;
    }
  }

  block.totalText.textContent = cfg.total;

  const cellW = (R - L) / cfg.n;

  for (let i = 0; i < cfg.k; i++) {
    createSvgElement(block.gFill, 'rect', { x: L + i * cellW, y: TOP, width: cellW, height: BOT - TOP, class: 'tb-rect' });
  }

  for (let i = 1; i < cfg.n; i++) {
    const x = L + i * cellW;
    createSvgElement(block.gSep, 'line', { x1: x, y1: TOP, x2: x, y2: BOT, class: 'tb-sep' });
  }

  const per = cfg.total / cfg.n;
  for (let i = 0; i < cfg.k; i++) {
    const cx = L + (i + 0.5) * cellW;
    const cy = (TOP + BOT) / 2;
    const text = createSvgElement(block.gVals, 'text', { x: cx, y: cy, class: 'tb-val' });
    text.textContent = fmt(per);
  }

  const hx = L + cfg.k * cellW;
  block.handle?.setAttribute('cx', hx);
  block.handleShadow?.setAttribute('cx', hx);

  if (block.minusBtn) block.minusBtn.disabled = cfg.n <= CONFIG.minN;
  if (block.plusBtn) block.plusBtn.disabled = cfg.n >= CONFIG.maxN;
}

function draw() {
  normalizeConfig();
  updateVisibility();
  for (let i = 0; i < BLOCKS.length; i++) {
    drawBlock(i);
  }
  syncLegacyConfig();
}

function setN(index, next) {
  normalizeConfig();
  const cfg = CONFIG.blocks[index];
  if (!cfg) return;
  cfg.n = clamp(next, CONFIG.minN, CONFIG.maxN);
  if (cfg.k > cfg.n) cfg.k = cfg.n;
  if (index === 0) {
    CONFIG.n = cfg.n;
    CONFIG.k = cfg.k;
  }
  draw();
}

function setK(index, next) {
  normalizeConfig();
  const cfg = CONFIG.blocks[index];
  if (!cfg) return;
  cfg.k = clamp(next, 0, cfg.n);
  if (index === 0) CONFIG.k = cfg.k;
  draw();
}

function setupSettingsUI() {
  const maps = [
    { total: 'cfg-total-1', n: 'cfg-n-1', k: 'cfg-k-1' },
    { total: 'cfg-total-2', n: 'cfg-n-2', k: 'cfg-k-2' }
  ];
  maps.forEach((ids, index) => {
    const total = document.getElementById(ids.total);
    const n = document.getElementById(ids.n);
    const k = document.getElementById(ids.k);
    settingsInputs[index] = { total, n, k };

    total?.addEventListener('change', () => {
      const v = parseFloat(total.value);
      if (!Number.isNaN(v)) {
        normalizeConfig();
        CONFIG.blocks[index].total = v;
        if (index === 0) CONFIG.total = v;
        draw();
      }
    });
    n?.addEventListener('change', () => {
      const v = parseInt(n.value, 10);
      if (!Number.isNaN(v)) setN(index, v);
    });
    k?.addEventListener('change', () => {
      const v = parseInt(k.value, 10);
      if (!Number.isNaN(v)) setK(index, v);
    });
  });
}

// init
window.CONFIG = CONFIG;
window.draw = draw;
draw();
