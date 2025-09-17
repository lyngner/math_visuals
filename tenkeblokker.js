/* Tenkeblokker – med innstillinger */

// ---------- Konfig ----------
const DEFAULT_BLOCKS = [
  { total: 50, n: 1, k: 1, showWhole: true, lockDenominator: false, lockNumerator: false, hideNValue: false, valueDisplay: 'number' },
  { total: 50, n: 1, k: 0, showWhole: true, lockDenominator: false, lockNumerator: false, hideNValue: false, valueDisplay: 'number' }
];

const DISPLAY_OPTIONS = ['number', 'fraction', 'percent'];

function sanitizeDisplayMode(value) {
  if (typeof value !== 'string') return null;
  const normalized = value.trim().toLowerCase();
  return DISPLAY_OPTIONS.includes(normalized) ? normalized : null;
}

function applyDisplayMode(cfg, mode, fallback = 'number') {
  if (!cfg) return 'number';
  const normalizedFallback = sanitizeDisplayMode(fallback) || 'number';
  const normalized = sanitizeDisplayMode(mode) || normalizedFallback;
  cfg.valueDisplay = normalized;
  cfg.showFraction = normalized === 'fraction';
  cfg.showPercent = normalized === 'percent';
  return normalized;
}

const CONFIG = {
  minN: 1,
  maxN: 12,
  blocks: DEFAULT_BLOCKS.map(block => ({ ...block })),
  activeBlocks: 1
};

CONFIG.total = CONFIG.blocks[0].total;
CONFIG.n = CONFIG.blocks[0].n;
CONFIG.k = CONFIG.blocks[0].k;
CONFIG.showWhole = CONFIG.blocks[0].showWhole;
CONFIG.lockDenominator = CONFIG.blocks[0].lockDenominator;
CONFIG.lockNumerator = CONFIG.blocks[0].lockNumerator;
CONFIG.hideNValue = CONFIG.blocks[0].hideNValue;
const initialDisplay = sanitizeDisplayMode(CONFIG.blocks[0].valueDisplay) || 'number';
applyDisplayMode(CONFIG.blocks[0], initialDisplay, initialDisplay);
CONFIG.valueDisplay = CONFIG.blocks[0].valueDisplay;
CONFIG.showFraction = CONFIG.blocks[0].showFraction;
CONFIG.showPercent = CONFIG.blocks[0].showPercent;

// ---------- SVG-oppsett ----------
const VBW = 900, VBH = 420;                  // MÅ samsvare med viewBox i HTML
const SIDE_MARGIN = 70;                      // tomrom på hver side av rammen
const L = SIDE_MARGIN, R = VBW - SIDE_MARGIN; // venstre/høyre marg
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
  addBtn: document.getElementById('tbAdd'),
  removeBtn: document.getElementById('tbRemove')
};

const settingsContainer = document.getElementById('tbSettings');

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

panels.removeBtn?.addEventListener('click', () => {
  CONFIG.activeBlocks = 1;
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

function renderFractionLabel(parent, cx, cy, numerator, denominator) {
  if (!parent) return;

  const numText = typeof numerator === 'number' ? numerator.toString() : `${numerator ?? ''}`;
  const denText = typeof denominator === 'number' ? denominator.toString() : `${denominator ?? ''}`;
  if (!numText || !denText) return;

  const numeratorY = -20;
  const denominatorY = 28;
  const fallbackCenter = (numeratorY + denominatorY) / 2;
  const maxLen = Math.max(numText.length, denText.length);
  const charWidth = 20;
  const halfWidth = Math.max(16, (maxLen * charWidth) / 2);

  const group = createSvgElement(parent, 'g', {
    class: 'tb-frac'
  });

  const numeratorEl = createSvgElement(group, 'text', {
    x: 0,
    y: numeratorY,
    class: 'tb-frac-num',
    'text-anchor': 'middle'
  });
  numeratorEl.textContent = numText;

  const lineEl = createSvgElement(group, 'line', {
    x1: -halfWidth,
    x2: halfWidth,
    y1: fallbackCenter,
    y2: fallbackCenter,
    class: 'tb-frac-line'
  });

  const denominatorEl = createSvgElement(group, 'text', {
    x: 0,
    y: denominatorY,
    class: 'tb-frac-den',
    'text-anchor': 'middle'
  });
  denominatorEl.textContent = denText;

  let appliedCenter = fallbackCenter;
  const hasBBox = typeof numeratorEl.getBBox === 'function' && typeof denominatorEl.getBBox === 'function';

  if (hasBBox) {
    try {
      const numeratorBBox = numeratorEl.getBBox();
      const denominatorBBox = denominatorEl.getBBox();
      const numeratorBottom = numeratorBBox.y + numeratorBBox.height;
      const denominatorTop = denominatorBBox.y;
      const visualLineY = (numeratorBottom + denominatorTop) / 2;
      lineEl.setAttribute('y1', visualLineY);
      lineEl.setAttribute('y2', visualLineY);

      const fractionTop = Math.min(numeratorBBox.y, denominatorBBox.y);
      const fractionBottom = Math.max(numeratorBottom, denominatorBBox.y + denominatorBBox.height);
      appliedCenter = (fractionTop + fractionBottom) / 2;
    } catch (err) {
      // Ignore errors and fall back to preset positions
    }
  }

  group.setAttribute('transform', `translate(${cx}, ${cy - appliedCenter})`);
}
function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }
function fmt(x) { return (Math.round(x * 100) / 100).toString().replace('.', ','); }
// Skjerm-px → SVG viewBox-koordinater
function clientToSvg(svgEl, clientX, clientY) {
  const rect = svgEl.getBoundingClientRect();
  const vb = svgEl.viewBox?.baseVal;
  const width = vb?.width ?? VBW;
  const height = vb?.height ?? VBH;
  const minX = vb?.x ?? 0;
  const minY = vb?.y ?? 0;
  if (!rect.width || !rect.height) return { x: minX, y: minY };
  const sx = width / rect.width;
  const sy = height / rect.height;
  return {
    x: minX + (clientX - rect.left) * sx,
    y: minY + (clientY - rect.top) * sy
  };
}

// Firkantparentes (rett linje med «hak» i begge ender)
function drawBracketSquare(group, x0, x1, y, tick) {
  if (!group) return;
  const ns = group.ownerSVGElement?.namespaceURI || 'http://www.w3.org/2000/svg';
  let path = group.querySelector('path.tb-brace');
  if (!path) {
    path = document.createElementNS(ns, 'path');
    path.setAttribute('class', 'tb-brace');
    const firstChild = group.firstChild;
    if (firstChild) group.insertBefore(path, firstChild);
    else group.appendChild(path);
  }
  const d = [
    `M ${x0} ${y}`, `v ${tick}`,          // venstre «hak»
    `M ${x0} ${y}`, `H ${x1}`,            // topplinje
    `M ${x1} ${y}`, `v ${tick}`           // høyre «hak»
  ].join(' ');
  path.setAttribute('d', d);
}

function getBlockLayout(index) {
  const count = clamp(CONFIG.activeBlocks || 1, 1, 2);
  const baseWidth = Math.max(R - L, 1);
  let width = baseWidth;

  if (count > 1) {
    let maxTotal = 0;
    const totals = [];
    for (let i = 0; i < count; i++) {
      const cfg = CONFIG.blocks[i];
      const raw = typeof cfg?.total === 'number' && !Number.isNaN(cfg.total) ? Math.abs(cfg.total) : 0;
      totals[i] = raw;
      if (raw > maxTotal) maxTotal = raw;
    }
    if (maxTotal > 0) {
      const current = totals[index] ?? maxTotal;
      width = baseWidth * (current / maxTotal);
    }
  }

  width = Math.max(width, 1);
  const left = L;
  const right = left + width;
  const center = left + width / 2;
  return { left, right, width, center };
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
  const layouts = [];
  let width = SIDE_MARGIN * 2;
  for (let i = 0; i < count; i++) {
    const layout = getBlockLayout(i);
    layouts.push(layout);
    width += layout?.width ?? 0;
  }
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
    if (i < count - 1) x += layouts[i]?.width ?? 0;
  }
  return exportSvg;
}

function getBlockViewBox(index) {
  const count = clamp(CONFIG.activeBlocks || 1, 1, 2);
  if (count <= 1) return { minX: 0, width: VBW };
  const width = Math.max(VBW - SIDE_MARGIN, 1);
  if (index === 0) return { minX: 0, width };
  return { minX: SIDE_MARGIN, width };
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

  block.rectEmpty = createSvgElement(block.gBase,'rect',{x:L,y:TOP,width:R-L,height:BOT-TOP,class:'tb-rect-empty'});
  block.rectFrame = createSvgElement(block.gFrame,'rect',{x:L,y:TOP,width:R-L,height:BOT-TOP,class:'tb-frame'});
  drawBracketSquare(block.gBrace, L, R, BRACE_Y, BRACKET_TICK);
  block.totalText = createSvgElement(block.gBrace,'text',{x:(L+R)/2,y:BRACE_Y - LABEL_OFFSET_Y,class:'tb-total'});

  block.handleShadow = createSvgElement(block.gHandle,'circle',{cx:R,cy:(TOP+BOT)/2+2,r:20,class:'tb-handle-shadow'});
  block.handle       = createSvgElement(block.gHandle,'circle',{cx:R,cy:(TOP+BOT)/2,r:18,class:'tb-handle'});
  block.handle.addEventListener('pointerdown', e => onDragStart(block, e));

  const header = document.getElementById(`tbHeader${index + 1}`);
  if (header) {
    header.innerHTML = '';
    header.style.display = 'none';
  }

  const minus = document.getElementById(`tbMinus${index + 1}`);
  const plus  = document.getElementById(`tbPlus${index + 1}`);
  minus?.addEventListener('click', () => {
    normalizeConfig();
    if (CONFIG.blocks[index]?.lockDenominator) return;
    setN(index, (CONFIG.blocks[index]?.n ?? CONFIG.minN) - 1);
  });
  plus?.addEventListener('click', () => {
    normalizeConfig();
    if (CONFIG.blocks[index]?.lockDenominator) return;
    setN(index, (CONFIG.blocks[index]?.n ?? CONFIG.minN) + 1);
  });
  block.minusBtn = minus || null;
  block.plusBtn = plus || null;
  block.nVal = document.getElementById(`tbNVal${index + 1}`) || null;
  block.stepper = block.nVal?.closest('.tb-stepper') || minus?.closest('.tb-stepper') || null;

  BLOCKS[index] = block;
  return block;
}

function onDragStart(block, e) {
  if (!block?.handle) return;
  const cfgAtStart = CONFIG.blocks[block.index];
  if (cfgAtStart?.lockNumerator) return;
  block.handle.setPointerCapture(e.pointerId);
  const move = ev => {
    const cfg = CONFIG.blocks[block.index];
    if (!cfg) return;
    const layout = block.layout || getBlockLayout(block.index);
    const p = clientToSvg(block.svg, ev.clientX, ev.clientY);
    const left = layout?.left ?? L;
    const right = layout?.right ?? R;
    const width = layout?.width ?? (R - L);
    const denom = cfg.n || 1;
    const cellW = width / denom;
    if (cellW <= 0) return;
    const x = clamp(p.x, left, right);
    const snapK = Math.round((x - left) / cellW);            // 0..n (kan helt til høyre)
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

  if (typeof CONFIG.minN !== 'number') CONFIG.minN = 1;
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

    cfg.showWhole = typeof cfg.showWhole === 'boolean' ? cfg.showWhole : (defaults.showWhole ?? true);
    cfg.showWhole = !!cfg.showWhole;

    cfg.lockDenominator = typeof cfg.lockDenominator === 'boolean' ? cfg.lockDenominator : !!defaults.lockDenominator;
    cfg.lockDenominator = !!cfg.lockDenominator;

    cfg.lockNumerator = typeof cfg.lockNumerator === 'boolean' ? cfg.lockNumerator : !!defaults.lockNumerator;
    cfg.lockNumerator = !!cfg.lockNumerator;

    cfg.hideNValue = typeof cfg.hideNValue === 'boolean' ? cfg.hideNValue : !!defaults.hideNValue;
    cfg.hideNValue = !!cfg.hideNValue;

    const defaultDisplay = sanitizeDisplayMode(defaults.valueDisplay) || 'number';
    let desiredDisplay = sanitizeDisplayMode(cfg.valueDisplay);
    if (!desiredDisplay) {
      if (cfg.showPercent) desiredDisplay = 'percent';
      else if (cfg.showFraction) desiredDisplay = 'fraction';
      else desiredDisplay = defaultDisplay;
    }
    applyDisplayMode(cfg, desiredDisplay, defaultDisplay);
  }

  if (typeof CONFIG.total === 'number') CONFIG.blocks[0].total = CONFIG.total;
  if (typeof CONFIG.n === 'number') CONFIG.blocks[0].n = clamp(CONFIG.n, CONFIG.minN, CONFIG.maxN);
  if (typeof CONFIG.k === 'number') CONFIG.blocks[0].k = clamp(CONFIG.k, 0, CONFIG.blocks[0].n);

  if (typeof CONFIG.showWhole === 'boolean') CONFIG.blocks[0].showWhole = CONFIG.showWhole;
  if (typeof CONFIG.lockDenominator === 'boolean') CONFIG.blocks[0].lockDenominator = CONFIG.lockDenominator;
  if (typeof CONFIG.lockNumerator === 'boolean') CONFIG.blocks[0].lockNumerator = CONFIG.lockNumerator;
  if (typeof CONFIG.hideNValue === 'boolean') CONFIG.blocks[0].hideNValue = CONFIG.hideNValue;

  if (typeof CONFIG.valueDisplay === 'string') {
    applyDisplayMode(CONFIG.blocks[0], CONFIG.valueDisplay, CONFIG.blocks[0].valueDisplay);
  } else if (typeof CONFIG.showPercent === 'boolean' || typeof CONFIG.showFraction === 'boolean') {
    if (CONFIG.showPercent) applyDisplayMode(CONFIG.blocks[0], 'percent', CONFIG.blocks[0].valueDisplay);
    else if (CONFIG.showFraction) applyDisplayMode(CONFIG.blocks[0], 'fraction', CONFIG.blocks[0].valueDisplay);
  }

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
  CONFIG.showWhole = first.showWhole;
  CONFIG.lockDenominator = first.lockDenominator;
  CONFIG.lockNumerator = first.lockNumerator;
  CONFIG.hideNValue = first.hideNValue;
  CONFIG.showFraction = first.showFraction;
  CONFIG.showPercent = first.showPercent;
  CONFIG.valueDisplay = first.valueDisplay;
}

function updateVisibility() {
  const showSecond = (CONFIG.activeBlocks || 1) > 1;
  if (panels.panel2) panels.panel2.style.display = showSecond ? '' : 'none';
  if (panels.fieldset2) panels.fieldset2.style.display = showSecond ? '' : 'none';
  if (panels.addBtn) panels.addBtn.style.display = showSecond ? 'none' : '';
  if (panels.removeBtn) panels.removeBtn.style.display = showSecond ? '' : 'none';
  panels.container?.classList.toggle('two', showSecond);
  settingsContainer?.classList.toggle('two', showSecond);
}

function drawBlock(index) {
  const block = BLOCKS[index];
  const cfg = CONFIG.blocks[index];
  if (!block || !cfg) return;

  const layout = getBlockLayout(index);
  block.layout = layout;
  const { left, right, width, center } = layout;

  const vb = getBlockViewBox(index);
  if (block.svg && vb) {
    block.svg.setAttribute('viewBox', `${vb.minX} 0 ${vb.width} ${VBH}`);
  }

  if (block.rectEmpty) {
    block.rectEmpty.setAttribute('x', left);
    block.rectEmpty.setAttribute('width', width);
    block.rectEmpty.setAttribute('y', TOP);
    block.rectEmpty.setAttribute('height', BOT - TOP);
  }
  if (block.rectFrame) {
    block.rectFrame.setAttribute('x', left);
    block.rectFrame.setAttribute('width', width);
    block.rectFrame.setAttribute('y', TOP);
    block.rectFrame.setAttribute('height', BOT - TOP);
  }
  drawBracketSquare(block.gBrace, left, right, BRACE_Y, BRACKET_TICK);
  if (block.totalText) block.totalText.setAttribute('x', center);

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
    if (inputs.showWhole) inputs.showWhole.checked = !!cfg.showWhole;
    if (inputs.lockN) inputs.lockN.checked = !!cfg.lockDenominator;
    if (inputs.lockK) inputs.lockK.checked = !!cfg.lockNumerator;
    if (inputs.hideN) inputs.hideN.checked = !!cfg.hideNValue;
    if (inputs.display) {
      const mode = sanitizeDisplayMode(cfg.valueDisplay) || 'number';
      inputs.display.value = mode;
    }
  }

  if (block.totalText) block.totalText.textContent = fmt(cfg.total);

  const cellW = cfg.n ? width / cfg.n : 0;

  if (cellW > 0) {
    for (let i = 0; i < cfg.k; i++) {
      createSvgElement(block.gFill, 'rect', { x: left + i * cellW, y: TOP, width: cellW, height: BOT - TOP, class: 'tb-rect' });
    }

    for (let i = 1; i < cfg.n; i++) {
      const x = left + i * cellW;
      createSvgElement(block.gSep, 'line', { x1: x, y1: TOP, x2: x, y2: BOT, class: 'tb-sep' });
    }

    const displayMode = sanitizeDisplayMode(cfg.valueDisplay) || 'number';
    const per = cfg.n ? cfg.total / cfg.n : 0;
    const percentValue = cfg.n ? (100 / cfg.n) : 0;

    for (let i = 0; i < cfg.n; i++) {
      const cx = left + (i + 0.5) * cellW;
      const cy = (TOP + BOT) / 2;
      if (displayMode === 'fraction' && cfg.n) {
        renderFractionLabel(block.gVals, cx, cy, 1, cfg.n);
        continue;
      }

      const text = createSvgElement(block.gVals, 'text', { x: cx, y: cy, class: 'tb-val' });
      let label = '';
      if (displayMode === 'percent') label = `${fmt(percentValue)} %`;
      else label = fmt(per);
      text.textContent = label;
    }
  }

  const hx = cellW > 0 ? left + cfg.k * cellW : left;
  block.handle?.setAttribute('cx', hx);
  block.handleShadow?.setAttribute('cx', hx);
  if (block.gHandle) block.gHandle.style.display = cfg.lockNumerator ? 'none' : '';
  if (block.handle) block.handle.style.cursor = cfg.lockNumerator ? 'default' : 'pointer';

  const showWhole = !!cfg.showWhole;

  if (block.gBrace) block.gBrace.style.display = showWhole ? '' : 'none';

  if (block.stepper) block.stepper.style.display = cfg.lockDenominator ? 'none' : '';
  if (block.nVal) {
    block.nVal.textContent = cfg.n;
    block.nVal.style.display = cfg.hideNValue ? 'none' : '';
  }

  if (block.minusBtn) block.minusBtn.disabled = cfg.lockDenominator || cfg.n <= CONFIG.minN;
  if (block.plusBtn) block.plusBtn.disabled = cfg.lockDenominator || cfg.n >= CONFIG.maxN;
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
    {
      total: 'cfg-total-1',
      n: 'cfg-n-1',
      k: 'cfg-k-1',
      showWhole: 'cfg-show-whole-1',
      lockN: 'cfg-lock-n-1',
      lockK: 'cfg-lock-k-1',
      hideN: 'cfg-hide-n-1',
      display: 'cfg-display-1'
    },
    {
      total: 'cfg-total-2',
      n: 'cfg-n-2',
      k: 'cfg-k-2',
      showWhole: 'cfg-show-whole-2',
      lockN: 'cfg-lock-n-2',
      lockK: 'cfg-lock-k-2',
      hideN: 'cfg-hide-n-2',
      display: 'cfg-display-2'
    }
  ];
  maps.forEach((ids, index) => {
    const total = document.getElementById(ids.total);
    const n = document.getElementById(ids.n);
    const k = document.getElementById(ids.k);
    const showWhole = document.getElementById(ids.showWhole);
    const lockN = document.getElementById(ids.lockN);
    const lockK = document.getElementById(ids.lockK);
    const hideN = document.getElementById(ids.hideN);
    const display = document.getElementById(ids.display);
    settingsInputs[index] = { total, n, k, showWhole, lockN, lockK, hideN, display };

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
    showWhole?.addEventListener('change', () => {
      normalizeConfig();
      CONFIG.blocks[index].showWhole = !!showWhole.checked;
      if (index === 0) CONFIG.showWhole = CONFIG.blocks[0].showWhole;
      draw();
    });
    lockN?.addEventListener('change', () => {
      normalizeConfig();
      CONFIG.blocks[index].lockDenominator = !!lockN.checked;
      if (index === 0) CONFIG.lockDenominator = CONFIG.blocks[0].lockDenominator;
      draw();
    });
    lockK?.addEventListener('change', () => {
      normalizeConfig();
      CONFIG.blocks[index].lockNumerator = !!lockK.checked;
      if (index === 0) CONFIG.lockNumerator = CONFIG.blocks[0].lockNumerator;
      draw();
    });
    hideN?.addEventListener('change', () => {
      normalizeConfig();
      CONFIG.blocks[index].hideNValue = !!hideN.checked;
      if (index === 0) CONFIG.hideNValue = CONFIG.blocks[0].hideNValue;
      draw();
    });
    display?.addEventListener('change', () => {
      normalizeConfig();
      const cfg = CONFIG.blocks[index];
      if (!cfg) return;
      applyDisplayMode(cfg, display.value, cfg.valueDisplay);
      if (index === 0) {
        CONFIG.valueDisplay = cfg.valueDisplay;
        CONFIG.showFraction = cfg.showFraction;
        CONFIG.showPercent = cfg.showPercent;
      }
      draw();
    });
  });
}

// init
window.CONFIG = CONFIG;
window.draw = draw;
draw();
