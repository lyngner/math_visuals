/* Tenkeblokker – grid layout */

const DEFAULT_BLOCKS = [
  {
    total: 1,
    n: 1,
    k: 1,
    showWhole: false,
    lockDenominator: true,
    lockNumerator: true,
    hideNValue: false,
    valueDisplay: 'number',
    showCustomText: false,
    customText: ''
  },
  {
    total: 1,
    n: 1,
    k: 1,
    showWhole: false,
    lockDenominator: true,
    lockNumerator: true,
    hideNValue: false,
    valueDisplay: 'number',
    showCustomText: false,
    customText: ''
  }
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

function getHiddenNumber(target, key) {
  if (!target || typeof target !== 'object') return null;
  const value = target[key];
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function setHiddenNumber(target, key, value) {
  if (!target || typeof target !== 'object') return;
  Object.defineProperty(target, key, {
    value,
    writable: true,
    configurable: true,
    enumerable: false
  });
}

function getHiddenBoolean(target, key) {
  if (!target || typeof target !== 'object') return false;
  return target[key] === true;
}

function setHiddenFlag(target, key, value) {
  if (!target || typeof target !== 'object') return;
  Object.defineProperty(target, key, {
    value: !!value,
    writable: true,
    configurable: true,
    enumerable: false
  });
}

function isMeaningfulBlockCell(cell) {
  if (cell == null) return false;
  if (typeof cell === 'object') {
    try {
      return Object.keys(cell).length > 0;
    } catch (err) {
      return true;
    }
  }
  return true;
}

function countMeaningfulColumns(row) {
  if (!Array.isArray(row)) return 0;
  for (let i = row.length - 1; i >= 0; i--) {
    if (isMeaningfulBlockCell(row[i])) return i + 1;
  }
  return 0;
}

function getDefaultBlock(index = 0) {
  const base = DEFAULT_BLOCKS[index] || DEFAULT_BLOCKS[DEFAULT_BLOCKS.length - 1];
  return { ...base };
}

const CONFIG = {
  minN: 1,
  maxN: 12,
  rows: 1,
  cols: 1,
  blocks: [],
  showCombinedWhole: false
};

const VBW = 900;
const VBH = 420;
const SIDE_MARGIN_RATIO = 0;
const TOP_RATIO = 130 / VBH;
const BOTTOM_RATIO = (VBH - 60) / VBH;
const BRACE_Y_RATIO = 78 / VBH;
const BRACKET_TICK_RATIO = 16 / VBH;
const LABEL_OFFSET_RATIO = 14 / VBH;
const DEFAULT_SVG_HEIGHT = 260;
const ROW_GAP = 18;
const DEFAULT_FRAME_INSET = 3;

const BLOCKS = [];

const board = document.getElementById('tbBoard');
const grid = document.getElementById('tbGrid');
const addColumnBtn = document.getElementById('tbAddColumn');
const addRowBtn = document.getElementById('tbAddRow');
const removeColumnBtn = document.getElementById('tbRemoveColumn');
const removeRowBtn = document.getElementById('tbRemoveRow');
const settingsContainer = document.getElementById('tbSettings');

const combinedWholeControls = {
  row: document.getElementById('cfg-show-combined-row'),
  checkbox: document.getElementById('cfg-show-combined-whole')
};

const btnSvg = document.getElementById('btnSvg');
const btnPng = document.getElementById('btnPng');

const combinedWholeOverlay = createCombinedWholeOverlay();
if (typeof window !== 'undefined') {
  window.addEventListener('resize', () => draw(true));
}

addColumnBtn?.addEventListener('click', () => {
  if (CONFIG.cols >= 3) return;
  const current = Number.isFinite(CONFIG.cols) ? CONFIG.cols : 1;
  setHiddenFlag(CONFIG, '__colsDirty', true);
  CONFIG.cols = Math.min(3, current + 1);
  draw();
});

addRowBtn?.addEventListener('click', () => {
  if (CONFIG.rows >= 3) return;
  const current = Number.isFinite(CONFIG.rows) ? CONFIG.rows : 1;
  setHiddenFlag(CONFIG, '__rowsDirty', true);
  CONFIG.rows = Math.min(3, current + 1);
  draw();
});

removeColumnBtn?.addEventListener('click', () => {
  const current = Number.isFinite(CONFIG.cols) ? Math.round(CONFIG.cols) : 1;
  if (current <= 1) return;
  const next = Math.max(1, current - 1);
  setHiddenFlag(CONFIG, '__colsDirty', true);
  CONFIG.cols = next;
  if (Array.isArray(CONFIG.blocks)) {
    for (const row of CONFIG.blocks) {
      if (Array.isArray(row) && row.length > next) {
        row.length = next;
      }
    }
  }
  draw();
});

removeRowBtn?.addEventListener('click', () => {
  const current = Number.isFinite(CONFIG.rows) ? Math.round(CONFIG.rows) : 1;
  if (current <= 1) return;
  const next = Math.max(1, current - 1);
  setHiddenFlag(CONFIG, '__rowsDirty', true);
  CONFIG.rows = next;
  if (Array.isArray(CONFIG.blocks) && CONFIG.blocks.length > next) {
    CONFIG.blocks.length = next;
  }
  draw();
});

combinedWholeControls.checkbox?.addEventListener('change', () => {
  CONFIG.showCombinedWhole = !!combinedWholeControls.checkbox.checked;
  draw(true);
});

btnSvg?.addEventListener('click', () => {
  const exportSvg = getExportSvg();
  if (exportSvg) downloadSVG(exportSvg, 'tenkeblokker.svg');
});

btnPng?.addEventListener('click', () => {
  const exportSvg = getExportSvg();
  if (exportSvg) downloadPNG(exportSvg, 'tenkeblokker.png', 2);
});

normalizeConfig(true);
rebuildStructure();

draw(true);

window.CONFIG = CONFIG;
window.draw = draw;

function getSvgViewport(block) {
  const svg = block?.svg;
  const panelRect = block?.panel?.getBoundingClientRect?.();
  const svgRect = svg?.getBoundingClientRect?.();

  let width = panelRect?.width;
  if (!(width > 0)) width = svgRect?.width;
  if (!(width > 0)) width = VBW;

  let height = svgRect?.height;
  if (!(height > 0) && svg) {
    const owner = svg.ownerDocument?.defaultView;
    if (owner?.getComputedStyle) {
      const computedHeight = owner.getComputedStyle(svg).getPropertyValue('height');
      const parsed = Number.parseFloat(String(computedHeight).replace(',', '.'));
      if (Number.isFinite(parsed) && parsed > 0) height = parsed;
    }
  }
  if (!(height > 0)) height = DEFAULT_SVG_HEIGHT;

  return { width, height };
}

function getBlockMetrics(block) {
  const { width, height } = getSvgViewport(block);
  const left = width * SIDE_MARGIN_RATIO;
  const right = width - left;
  const top = height * TOP_RATIO;
  const bottom = height * BOTTOM_RATIO;
  const frameInset = getFrameInset(block);
  const outerWidth = Math.max(0, right - left);
  const outerHeight = Math.max(0, bottom - top);
  const clampedInset = Math.min(frameInset, outerWidth / 2, outerHeight / 2);
  const frameLeft = left + clampedInset;
  const frameRight = right - clampedInset;
  const frameTop = top + clampedInset;
  const frameBottom = bottom - clampedInset;
  const braceY = height * BRACE_Y_RATIO;
  const bracketTick = height * BRACKET_TICK_RATIO;
  const labelOffsetY = height * LABEL_OFFSET_RATIO;
  const innerWidth = Math.max(0, frameRight - frameLeft);
  const innerHeight = Math.max(0, frameBottom - frameTop);
  const centerX = frameLeft + innerWidth / 2;
  return {
    width,
    height,
    left: frameLeft,
    right: frameRight,
    top: frameTop,
    bottom: frameBottom,
    braceY,
    bracketTick,
    labelOffsetY,
    innerWidth,
    innerHeight,
    centerX,
    frameInset: clampedInset,
    outerLeft: left,
    outerRight: right,
    outerTop: top,
    outerBottom: bottom
  };
}

function toBoolean(value, fallback = false) {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    if (['true', '1', 'yes', 'on'].includes(normalized)) return true;
    if (['false', '0', 'no', 'off'].includes(normalized)) return false;
  }
  return fallback;
}

function normalizeBlockConfig(raw, index, existing, previous) {
  const defaults = getDefaultBlock(index);
  const target = existing && typeof existing === 'object' ? existing : { ...defaults };
  const source = raw && typeof raw === 'object' ? raw : {};
  const isNew = raw == null;

  let total = Number(source.total);
  if (!Number.isFinite(total) || total < 1) {
    const prevTotal = Number(previous?.total);
    if (isNew && Number.isFinite(prevTotal) && prevTotal > 0) {
      total = prevTotal;
    } else {
      total = Number(defaults.total) || 1;
    }
  }
  target.total = total;

  let n = Number(source.n);
  if (!Number.isFinite(n)) n = Number(defaults.n) || 1;
  target.n = Math.round(n);

  let k = Number(source.k);
  if (!Number.isFinite(k)) k = Number(defaults.k) || 0;
  target.k = Math.round(k);

  target.showWhole = toBoolean(source.showWhole, toBoolean(defaults.showWhole, true));
  target.lockDenominator = toBoolean(source.lockDenominator, toBoolean(defaults.lockDenominator, false));
  target.lockNumerator = toBoolean(source.lockNumerator, toBoolean(defaults.lockNumerator, false));
  target.hideNValue = toBoolean(source.hideNValue, toBoolean(defaults.hideNValue, false));
  target.showCustomText = toBoolean(source.showCustomText, toBoolean(defaults.showCustomText, false));
  const textSource = typeof source.customText === 'string' ? source.customText : defaults.customText ?? '';
  target.customText = textSource;

  let desiredDisplay = sanitizeDisplayMode(source.valueDisplay);
  if (!desiredDisplay) {
    if (toBoolean(source.showPercent)) desiredDisplay = 'percent';
    else if (toBoolean(source.showFraction)) desiredDisplay = 'fraction';
    else desiredDisplay = sanitizeDisplayMode(defaults.valueDisplay) || 'number';
  }
  applyDisplayMode(target, desiredDisplay, defaults.valueDisplay);

  return target;
}

function normalizeConfig(initial = false) {
  let structureChanged = false;

  if (typeof CONFIG.minN !== 'number' || Number.isNaN(CONFIG.minN)) CONFIG.minN = 1;
  if (typeof CONFIG.maxN !== 'number' || Number.isNaN(CONFIG.maxN)) CONFIG.maxN = 12;
  CONFIG.minN = Math.max(1, Math.floor(CONFIG.minN));
  CONFIG.maxN = Math.max(CONFIG.minN, Math.floor(CONFIG.maxN));

  if (!Array.isArray(CONFIG.blocks)) {
    CONFIG.blocks = [];
    structureChanged = true;
  }

  let usedRows = 0;
  let usedCols = 0;
  if (Array.isArray(CONFIG.blocks)) {
    for (let r = 0; r < CONFIG.blocks.length; r++) {
      const colsUsed = countMeaningfulColumns(CONFIG.blocks[r]);
      if (colsUsed > 0) {
        usedRows = Math.max(usedRows, r + 1);
        usedCols = Math.max(usedCols, colsUsed);
      }
    }
  }
  usedRows = clamp(usedRows, 0, 3);
  usedCols = clamp(usedCols, 0, 3);

  const rowsDirty = getHiddenBoolean(CONFIG, '__rowsDirty');
  const colsDirty = getHiddenBoolean(CONFIG, '__colsDirty');

  const hasNested = CONFIG.blocks.some(item => Array.isArray(item));
  if (!hasNested) {
    const flat = CONFIG.blocks;
    const activeRaw = Number.isFinite(CONFIG.activeBlocks) ? Math.round(CONFIG.activeBlocks) : (flat?.length || 1);
    const active = clamp(activeRaw, 1, 9);
    let rows = Number.isFinite(CONFIG.rows) ? Math.round(CONFIG.rows) : 0;
    let cols = Number.isFinite(CONFIG.cols) ? Math.round(CONFIG.cols) : 0;
    if (rows < 1) rows = active <= 3 ? 1 : Math.min(3, Math.ceil(active / 3));
    if (cols < 1) cols = Math.min(3, Math.max(1, active));
    rows = clamp(rows, 1, 3);
    cols = clamp(cols, 1, 3);
    while (rows * cols < active) {
      if (cols < 3) cols += 1;
      else if (rows < 3) rows += 1;
      else break;
    }
    const gridData = [];
    let index = 0;
    for (let r = 0; r < rows; r++) {
      const row = [];
      for (let c = 0; c < cols; c++) {
        const raw = flat?.[index] || null;
        let previous = null;
        if (index > 0) {
          if (c > 0) previous = row[c - 1];
          else if (r > 0) {
            const prevRow = gridData[r - 1];
            previous = Array.isArray(prevRow) ? prevRow[cols - 1] : null;
          }
        }
        row.push(normalizeBlockConfig(raw, index, raw, previous));
        index += 1;
      }
      gridData.push(row);
    }
    CONFIG.blocks = gridData;
    CONFIG.rows = rows;
    CONFIG.cols = cols;
    structureChanged = true;
  } else {
    let rows = Number.isFinite(CONFIG.rows) ? Math.round(CONFIG.rows) : CONFIG.blocks.length || 1;
    rows = clamp(rows, 1, 3);
    if (usedRows > 0) {
      if (rows < usedRows) {
        rows = usedRows;
      } else if (!rowsDirty && rows > usedRows) {
        rows = usedRows;
      }
    }

    let cols = Number.isFinite(CONFIG.cols) ? Math.round(CONFIG.cols) : 0;
    if (!(cols >= 1)) {
      cols = usedCols > 0 ? usedCols : 1;
    }
    cols = clamp(cols, 1, 3);
    if (usedCols > 0) {
      if (cols < usedCols) {
        cols = usedCols;
      } else if (!colsDirty && cols > usedCols) {
        cols = usedCols;
      }
    }

    if (CONFIG.blocks.length !== rows) structureChanged = true;
    CONFIG.blocks.length = rows;

    for (let r = 0; r < rows; r++) {
      let row = CONFIG.blocks[r];
      if (!Array.isArray(row)) {
        row = [];
        CONFIG.blocks[r] = row;
        structureChanged = true;
      }
      if (row.length !== cols) structureChanged = true;
      row.length = cols;
      for (let c = 0; c < cols; c++) {
        const index = r * cols + c;
        const current = row[c];
        let previous = null;
        if (index > 0) {
          if (c > 0) {
            previous = row[c - 1];
          } else if (r > 0) {
            const prevRow = CONFIG.blocks[r - 1];
            previous = Array.isArray(prevRow) ? prevRow[cols - 1] : null;
          }
        }
        row[c] = normalizeBlockConfig(current, index, current, previous);
      }
    }
    CONFIG.rows = rows;
    CONFIG.cols = cols;
  }

  const rows = CONFIG.rows;
  const cols = CONFIG.cols;
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const cfg = CONFIG.blocks[r][c];
      cfg.n = clamp(Math.round(Number(cfg.n) || CONFIG.minN), CONFIG.minN, CONFIG.maxN);
      cfg.k = clamp(Math.round(Number(cfg.k) || 0), 0, cfg.n);
      cfg.total = Number(cfg.total);
      if (!Number.isFinite(cfg.total) || cfg.total < 1) cfg.total = 1;
      cfg.showWhole = !!cfg.showWhole;
      cfg.lockDenominator = !!cfg.lockDenominator;
      cfg.lockNumerator = !!cfg.lockNumerator;
      cfg.hideNValue = !!cfg.hideNValue;
    }
  }

  CONFIG.activeBlocks = rows * cols;
  CONFIG.showCombinedWhole = toBoolean(CONFIG.showCombinedWhole, false);

  setHiddenNumber(CONFIG, '__lastNormalizedRows', rows);
  setHiddenNumber(CONFIG, '__lastNormalizedCols', cols);
  setHiddenFlag(CONFIG, '__rowsDirty', false);
  setHiddenFlag(CONFIG, '__colsDirty', false);

  if (!initial && CONFIG.stackBlocks !== undefined) {
    delete CONFIG.stackBlocks;
    structureChanged = true;
  }

  return structureChanged;
}
function rebuildStructure() {
  if (!grid) return;

  const panelsFragment = document.createDocumentFragment();
  const settingsFragment = document.createDocumentFragment();

  BLOCKS.length = 0;
  grid.innerHTML = '';
  if (settingsContainer) settingsContainer.innerHTML = '';

  const rowElements = [];
  for (let r = 0; r < CONFIG.rows; r++) {
    const rowEl = document.createElement('div');
    rowEl.className = 'tb-row';
    rowEl.dataset.row = String(r);
    rowElements.push(rowEl);
    panelsFragment.appendChild(rowEl);

    for (let c = 0; c < CONFIG.cols; c++) {
      const cfg = CONFIG.blocks[r][c];
      const block = createBlock(r, c, cfg);
      BLOCKS.push(block);
      if (block.panel) rowEl.appendChild(block.panel);
      if (block.fieldset) settingsFragment.appendChild(block.fieldset);
    }
  }

  grid.setAttribute('data-cols', String(CONFIG.cols));
  grid.appendChild(panelsFragment);
  if (settingsContainer) settingsContainer.appendChild(settingsFragment);

  updateAddButtons();
}

function draw(skipNormalization = false) {
  if (!skipNormalization) {
    const structureChanged = normalizeConfig();
    if (structureChanged) {
      rebuildStructure();
      draw(true);
      return;
    }
  }

  if (grid) grid.setAttribute('data-cols', String(CONFIG.cols));
  updateAddButtons();

  const multiple = CONFIG.activeBlocks > 1;
  if (combinedWholeControls.row) combinedWholeControls.row.style.display = multiple ? '' : 'none';
  if (combinedWholeControls.checkbox) {
    combinedWholeControls.checkbox.disabled = !multiple;
    if (!multiple) {
      combinedWholeControls.checkbox.checked = false;
      CONFIG.showCombinedWhole = false;
    } else {
      combinedWholeControls.checkbox.checked = !!CONFIG.showCombinedWhole;
    }
  }

  const rowTotals = Array.from({ length: CONFIG.rows }, () => 0);
  const visibleBlocks = [];

  for (const block of BLOCKS) {
    const cfg = CONFIG.blocks?.[block.row]?.[block.col];
    if (!cfg) continue;
    block.cfg = cfg;
    block.index = block.row * CONFIG.cols + block.col;
    visibleBlocks.push(block);

    const totalValue = Number(cfg.total);
    if (Number.isFinite(totalValue) && totalValue > 0 && rowTotals[block.row] !== undefined) {
      rowTotals[block.row] += totalValue;
    }
  }

  for (const block of visibleBlocks) {
    const rowTotal = rowTotals[block.row];
    updateBlockPanelLayout(block, rowTotal);
    drawBlock(block);
  }

  drawCombinedWholeOverlay();
  syncLegacyConfig();
}

function updateAddButtons() {
  if (addColumnBtn) addColumnBtn.style.display = CONFIG.cols >= 3 ? 'none' : '';
  if (addRowBtn) addRowBtn.style.display = CONFIG.rows >= 3 ? 'none' : '';
  if (removeColumnBtn) removeColumnBtn.style.display = CONFIG.cols <= 1 ? 'none' : '';
  if (removeRowBtn) removeRowBtn.style.display = CONFIG.rows <= 1 ? 'none' : '';
}

function createBlock(row, col, cfg) {
  const block = {
    row,
    col,
    cfg,
    uid: `tb-${row}-${col}-${Math.random().toString(36).slice(2, 8)}`
  };

  const panel = document.createElement('div');
  panel.className = 'tb-panel';
  panel.dataset.row = String(row);
  panel.dataset.col = String(col);
  block.panel = panel;

  const header = document.createElement('div');
  header.className = 'tb-header';
  header.style.display = 'none';
  block.header = header;
  panel.appendChild(header);

  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('class', 'tb-svg');
  svg.setAttribute('viewBox', `0 0 ${VBW} ${VBH}`);
  svg.setAttribute('preserveAspectRatio', 'none');
  block.svg = svg;
  panel.appendChild(svg);

  block.gBase = createSvgElement(svg, 'g');
  block.gFill = createSvgElement(svg, 'g');
  block.gSep = createSvgElement(svg, 'g');
  block.gVals = createSvgElement(svg, 'g');
  block.gFrame = createSvgElement(svg, 'g');
  block.gHandle = createSvgElement(svg, 'g');
  block.gBrace = createSvgElement(svg, 'g');

  block.rectEmpty = createSvgElement(block.gBase, 'rect', { x: 0, y: 0, width: 0, height: 0, class: 'tb-rect-empty' });
  block.rectFrame = createSvgElement(block.gFrame, 'rect', { x: 0, y: 0, width: 0, height: 0, class: 'tb-frame' });
  drawBracketSquare(block.gBrace, 0, 0, 0, 0);
  block.totalText = createSvgElement(block.gBrace, 'text', { x: 0, y: 0, class: 'tb-total' });

  block.handleShadow = createSvgElement(block.gHandle, 'circle', { cx: 0, cy: 0, r: 20, class: 'tb-handle-shadow' });
  block.handle = createSvgElement(block.gHandle, 'circle', { cx: 0, cy: 0, r: 18, class: 'tb-handle' });
  block.handle.addEventListener('pointerdown', event => onDragStart(block, event));

  const stepper = document.createElement('div');
  stepper.className = 'tb-stepper';
  block.stepper = stepper;

  const minus = document.createElement('button');
  minus.type = 'button';
  minus.textContent = '−';
  minus.setAttribute('aria-label', 'Færre blokker');
  block.minusBtn = minus;

  const nVal = document.createElement('span');
  block.nVal = nVal;

  const plus = document.createElement('button');
  plus.type = 'button';
  plus.textContent = '+';
  plus.setAttribute('aria-label', 'Flere blokker');
  block.plusBtn = plus;

  minus.addEventListener('click', () => {
    const next = (block.cfg?.n ?? CONFIG.minN) - 1;
    setN(block, next);
  });
  plus.addEventListener('click', () => {
    const next = (block.cfg?.n ?? CONFIG.minN) + 1;
    setN(block, next);
  });

  stepper.append(minus, nVal, plus);
  panel.appendChild(stepper);

  const fieldset = document.createElement('fieldset');
  block.fieldset = fieldset;

  const legend = document.createElement('legend');
  block.legend = legend;
  fieldset.appendChild(legend);

  const totalLabel = document.createElement('label');
  totalLabel.textContent = 'Total';
  const totalInput = document.createElement('input');
  totalInput.type = 'number';
  totalInput.min = '1';
  totalInput.step = '1';
  totalInput.value = String(cfg?.total ?? 1);
  totalInput.addEventListener('change', () => {
    const parsed = Number.parseFloat(totalInput.value.replace(',', '.'));
    if (Number.isFinite(parsed) && parsed > 0) {
      block.cfg.total = Math.max(parsed, 1);
      draw(true);
    }
  });
  totalLabel.appendChild(totalInput);
  fieldset.appendChild(totalLabel);

  const nLabel = document.createElement('label');
  nLabel.textContent = 'Antall blokker';
  const nInput = document.createElement('input');
  nInput.type = 'number';
  nInput.min = String(CONFIG.minN);
  nInput.max = String(CONFIG.maxN);
  nInput.step = '1';
  nInput.value = String(cfg?.n ?? CONFIG.minN);
  nInput.addEventListener('change', () => {
    const parsed = Number.parseInt(nInput.value, 10);
    if (!Number.isNaN(parsed)) setN(block, parsed);
  });
  nLabel.appendChild(nInput);
  fieldset.appendChild(nLabel);

  const kLabel = document.createElement('label');
  kLabel.textContent = 'Fylte blokker';
  const kInput = document.createElement('input');
  kInput.type = 'number';
  kInput.min = '0';
  kInput.step = '1';
  kInput.value = String(cfg?.k ?? 0);
  kInput.addEventListener('change', () => {
    const parsed = Number.parseInt(kInput.value, 10);
    if (!Number.isNaN(parsed)) setK(block, parsed);
  });
  kLabel.appendChild(kInput);
  fieldset.appendChild(kLabel);

  const showWholeRow = document.createElement('div');
  showWholeRow.className = 'checkbox-row';
  const showWholeInput = document.createElement('input');
  showWholeInput.type = 'checkbox';
  showWholeInput.id = `${block.uid}-show-whole`;
  showWholeInput.addEventListener('change', () => {
    block.cfg.showWhole = !!showWholeInput.checked;
    draw(true);
  });
  const showWholeLabel = document.createElement('label');
  showWholeLabel.setAttribute('for', showWholeInput.id);
  showWholeLabel.textContent = 'Vis hele';
  showWholeRow.append(showWholeInput, showWholeLabel);
  fieldset.appendChild(showWholeRow);

  const lockNRow = document.createElement('div');
  lockNRow.className = 'checkbox-row';
  const lockNInput = document.createElement('input');
  lockNInput.type = 'checkbox';
  lockNInput.id = `${block.uid}-lock-n`;
  lockNInput.addEventListener('change', () => {
    block.cfg.lockDenominator = !!lockNInput.checked;
    draw(true);
  });
  const lockNLabel = document.createElement('label');
  lockNLabel.setAttribute('for', lockNInput.id);
  lockNLabel.textContent = 'Lås nevner';
  lockNRow.append(lockNInput, lockNLabel);
  fieldset.appendChild(lockNRow);

  const lockKRow = document.createElement('div');
  lockKRow.className = 'checkbox-row';
  const lockKInput = document.createElement('input');
  lockKInput.type = 'checkbox';
  lockKInput.id = `${block.uid}-lock-k`;
  lockKInput.addEventListener('change', () => {
    block.cfg.lockNumerator = !!lockKInput.checked;
    draw(true);
  });
  const lockKLabel = document.createElement('label');
  lockKLabel.setAttribute('for', lockKInput.id);
  lockKLabel.textContent = 'Lås teller';
  lockKRow.append(lockKInput, lockKLabel);
  fieldset.appendChild(lockKRow);

  const hideNRow = document.createElement('div');
  hideNRow.className = 'checkbox-row';
  const hideNInput = document.createElement('input');
  hideNInput.type = 'checkbox';
  hideNInput.id = `${block.uid}-hide-n`;
  hideNInput.addEventListener('change', () => {
    block.cfg.hideNValue = !!hideNInput.checked;
    draw(true);
  });
  const hideNLabel = document.createElement('label');
  hideNLabel.setAttribute('for', hideNInput.id);
  hideNLabel.textContent = 'Skjul n-verdi';
  hideNRow.append(hideNInput, hideNLabel);
  fieldset.appendChild(hideNRow);

  const displayLabel = document.createElement('label');
  displayLabel.textContent = 'Vis som';
  const displaySelect = document.createElement('select');
  DISPLAY_OPTIONS.forEach(option => {
    const opt = document.createElement('option');
    opt.value = option;
    opt.textContent = option === 'number' ? 'Tall' : option === 'fraction' ? 'Brøk' : 'Prosent';
    displaySelect.appendChild(opt);
  });
  displaySelect.addEventListener('change', () => {
    applyDisplayMode(block.cfg, displaySelect.value, block.cfg.valueDisplay);
    draw(true);
  });
  displayLabel.appendChild(displaySelect);
  fieldset.appendChild(displayLabel);

  const customTextToggleRow = document.createElement('div');
  customTextToggleRow.className = 'checkbox-row';
  customTextToggleRow.style.display = 'none';
  const customTextToggle = document.createElement('input');
  customTextToggle.type = 'checkbox';
  customTextToggle.id = `${block.uid}-custom-text-toggle`;
  customTextToggle.addEventListener('change', () => {
    block.cfg.showCustomText = !!customTextToggle.checked;
    draw(true);
  });
  const customTextToggleLabel = document.createElement('label');
  customTextToggleLabel.setAttribute('for', customTextToggle.id);
  customTextToggleLabel.textContent = 'Vis tekst i blokk';
  customTextToggleRow.append(customTextToggle, customTextToggleLabel);
  fieldset.appendChild(customTextToggleRow);
  block.customTextToggleRow = customTextToggleRow;

  const customTextLabel = document.createElement('label');
  customTextLabel.textContent = 'Tekst i blokk';
  customTextLabel.style.display = 'none';
  const customTextInput = document.createElement('input');
  customTextInput.type = 'text';
  customTextInput.placeholder = 'Skriv tekst';
  customTextInput.addEventListener('input', () => {
    block.cfg.customText = customTextInput.value;
    draw(true);
  });
  customTextLabel.appendChild(customTextInput);
  fieldset.appendChild(customTextLabel);
  block.customTextLabel = customTextLabel;
  block.customTextInput = customTextInput;

  block.inputs = {
    total: totalInput,
    n: nInput,
    k: kInput,
    showWhole: showWholeInput,
    lockN: lockNInput,
    lockK: lockKInput,
    hideN: hideNInput,
    display: displaySelect,
    showCustomText: customTextToggle,
    customText: customTextInput
  };

  return block;
}

function updateBlockPanelLayout(block, rowTotal) {
  if (!block?.panel) return;
  const cfg = block.cfg;
  const totalValue = Number(cfg?.total);
  const positiveTotal = Number.isFinite(totalValue) && totalValue > 0 ? totalValue : 0;
  const hasRowTotal = Number.isFinite(rowTotal) && rowTotal > 0;

  block.panel.style.flexBasis = '0px';
  block.panel.style.flexShrink = '1';
  if (hasRowTotal && positiveTotal > 0) {
    block.panel.style.flexGrow = String(positiveTotal);
  } else {
    block.panel.style.flexGrow = '1';
  }
}

function drawBlock(block) {
  const cfg = block?.cfg;
  if (!block || !cfg) return;

  const metrics = getBlockMetrics(block);
  block.metrics = metrics;
  const { width, height, left, right, top, bottom, braceY, bracketTick, labelOffsetY, innerWidth, innerHeight, centerX } = metrics;

  if (block.svg) {
    block.svg.setAttribute('viewBox', `0 0 ${width} ${height}`);
    block.svg.setAttribute('aria-label', `Tenkeblokk ${block.index + 1}`);
    block.svg.setAttribute('preserveAspectRatio', 'none');
  }

  block.rectEmpty?.setAttribute('x', left);
  block.rectEmpty?.setAttribute('width', innerWidth);
  block.rectEmpty?.setAttribute('y', top);
  block.rectEmpty?.setAttribute('height', innerHeight);

  block.rectFrame?.setAttribute('x', left);
  block.rectFrame?.setAttribute('width', innerWidth);
  block.rectFrame?.setAttribute('y', top);
  block.rectFrame?.setAttribute('height', innerHeight);

  drawBracketSquare(block.gBrace, left, right, braceY, bracketTick);
  if (block.totalText) {
    block.totalText.setAttribute('x', centerX);
    block.totalText.setAttribute('y', braceY - labelOffsetY);
    block.totalText.textContent = fmt(cfg.total);
  }
  if (block.legend) {
    block.legend.textContent = `Tenkeblokk ${block.index + 1}`;
  }

  if (block.stepper) {
    block.stepper.setAttribute('aria-label', `Antall blokker i tenkeblokk ${block.index + 1}`);
    block.stepper.style.display = cfg.lockDenominator ? 'none' : '';
  }

  if (block.nVal) {
    block.nVal.textContent = cfg.n;
    block.nVal.style.display = cfg.hideNValue ? 'none' : '';
  }

  const customTextAvailable = cfg.n === 1;
  if (block.customTextToggleRow) {
    block.customTextToggleRow.style.display = customTextAvailable ? '' : 'none';
  }
  const customTextEnabled = customTextAvailable && cfg.showCustomText;
  if (block.customTextLabel) {
    block.customTextLabel.style.display = customTextEnabled ? '' : 'none';
  }

  if (block.minusBtn) block.minusBtn.disabled = cfg.lockDenominator || cfg.n <= CONFIG.minN;
  if (block.plusBtn) block.plusBtn.disabled = cfg.lockDenominator || cfg.n >= CONFIG.maxN;

  if (block.inputs) {
    const { total, n, k, showWhole, lockN, lockK, hideN, display, showCustomText, customText } = block.inputs;
    if (total) total.value = cfg.total;
    if (n) {
      n.value = cfg.n;
      n.min = String(CONFIG.minN);
      n.max = String(CONFIG.maxN);
      n.disabled = !!cfg.lockDenominator;
    }
    if (k) {
      k.value = cfg.k;
      k.max = String(cfg.n);
      k.disabled = !!cfg.lockNumerator;
    }
    if (showWhole) showWhole.checked = !!cfg.showWhole;
    if (lockN) lockN.checked = !!cfg.lockDenominator;
    if (lockK) lockK.checked = !!cfg.lockNumerator;
    if (hideN) hideN.checked = !!cfg.hideNValue;
    if (display) {
      const mode = sanitizeDisplayMode(cfg.valueDisplay) || 'number';
      display.value = mode;
    }
    if (showCustomText) {
      showCustomText.checked = !!cfg.showCustomText;
      showCustomText.disabled = !customTextAvailable;
    }
    if (customText) {
      const desiredText = typeof cfg.customText === 'string' ? cfg.customText : '';
      if (customText.value !== desiredText) customText.value = desiredText;
      customText.disabled = !customTextEnabled;
    }
  }

  block.gFill.innerHTML = '';
  block.gSep.innerHTML = '';
  block.gVals.innerHTML = '';

  const cellW = cfg.n ? innerWidth / cfg.n : 0;
  if (cellW > 0) {
    const showCustomText = customTextEnabled;
    const customLabel = typeof cfg.customText === 'string' ? cfg.customText.trim() : '';
    for (let i = 0; i < cfg.k; i++) {
      createSvgElement(block.gFill, 'rect', { x: left + i * cellW, y: top, width: cellW, height: innerHeight, class: 'tb-rect' });
    }
    for (let i = 1; i < cfg.n; i++) {
      const x = left + i * cellW;
      createSvgElement(block.gSep, 'line', { x1: x, y1: top, x2: x, y2: bottom, class: 'tb-sep' });
    }

    const displayMode = sanitizeDisplayMode(cfg.valueDisplay) || 'number';
    const per = cfg.n ? cfg.total / cfg.n : 0;
    const percentValue = cfg.n ? (100 / cfg.n) : 0;

    for (let i = 0; i < cfg.n; i++) {
      const cx = left + (i + 0.5) * cellW;
      const cy = top + innerHeight / 2;
      if (showCustomText) {
        const text = createSvgElement(block.gVals, 'text', { x: cx, y: cy, class: 'tb-val' });
        text.textContent = customLabel;
        continue;
      }
      if (displayMode === 'fraction') {
        renderFractionLabel(block.gVals, cx, cy, 1, cfg.n);
        continue;
      }
      const text = createSvgElement(block.gVals, 'text', { x: cx, y: cy, class: 'tb-val' });
      const label = displayMode === 'percent' ? `${fmt(percentValue)} %` : fmt(per);
      text.textContent = label;
    }
  }

  const hx = cellW > 0 ? left + cfg.k * cellW : left;
  const hy = top + innerHeight / 2;
  block.handle?.setAttribute('cx', hx);
  block.handleShadow?.setAttribute('cx', hx);
  block.handle?.setAttribute('cy', hy);
  block.handleShadow?.setAttribute('cy', hy + 2);
  if (block.gHandle) block.gHandle.style.display = cfg.lockNumerator ? 'none' : '';
  if (block.handle) block.handle.style.cursor = cfg.lockNumerator ? 'default' : 'pointer';

  if (block.gBrace) block.gBrace.style.display = cfg.showWhole ? '' : 'none';
}

function setN(block, next) {
  if (!block) return;
  const cfg = block.cfg;
  if (!cfg) return;
  const clamped = clamp(Math.round(next), CONFIG.minN, CONFIG.maxN);
  if (cfg.n === clamped) return;
  cfg.n = clamped;
  if (cfg.k > cfg.n) cfg.k = cfg.n;
  draw(true);
}

function setK(block, next) {
  if (!block) return;
  const cfg = block.cfg;
  if (!cfg) return;
  const clamped = clamp(Math.round(next), 0, cfg.n);
  if (cfg.k === clamped) return;
  cfg.k = clamped;
  draw(true);
}

function createCombinedWholeOverlay() {
  if (!board) return null;
  const ns = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(ns, 'svg');
  svg.setAttribute('class', 'tb-combined-whole');
  svg.setAttribute('aria-hidden', 'true');
  svg.style.display = 'none';
  svg.style.width = '0';
  svg.style.height = '0';
  board.appendChild(svg);
  const group = createSvgElement(svg, 'g', { class: 'tb-combined-brace' });
  const text = createSvgElement(group, 'text', { class: 'tb-total', 'text-anchor': 'middle' });
  return { svg, group, text };
}

function getCombinedTotal() {
  let sum = 0;
  for (let r = 0; r < CONFIG.rows; r++) {
    for (let c = 0; c < CONFIG.cols; c++) {
      const value = Number(CONFIG.blocks?.[r]?.[c]?.total);
      if (!Number.isFinite(value)) return NaN;
      sum += value;
    }
  }
  return sum;
}

function getBlockClientMetrics(block) {
  if (!block?.svg) return null;
  const rect = block.svg.getBoundingClientRect();
  if (!(rect?.width > 0) || !(rect?.height > 0)) return null;
  return {
    left: rect.left,
    right: rect.right,
    top: rect.top,
    bottom: rect.bottom
  };
}

function drawCombinedWholeOverlay() {
  const overlay = combinedWholeOverlay;
  if (!overlay?.svg || !board) return;
  const multiple = CONFIG.activeBlocks > 1 && CONFIG.showCombinedWhole;
  if (!multiple) {
    overlay.svg.style.display = 'none';
    return;
  }

  const metrics = BLOCKS.map(getBlockClientMetrics).filter(Boolean);
  if (!metrics.length) {
    overlay.svg.style.display = 'none';
    return;
  }

  const left = Math.min(...metrics.map(m => m.left));
  const right = Math.max(...metrics.map(m => m.right));
  const top = Math.min(...metrics.map(m => m.top));
  const bottom = Math.max(...metrics.map(m => m.bottom));
  const width = right - left;
  const height = bottom - top;
  if (!(width > 0) || !(height > 0)) {
    overlay.svg.style.display = 'none';
    return;
  }

  const boardRect = board.getBoundingClientRect();
  const figureWidth = width;
  const figureHeight = height;
  const vertical = shouldShowVerticalCombinedBrace(figureWidth, figureHeight);

  let overlayWidth = figureWidth;
  let overlayLeft = left - boardRect.left;
  let bracketX = figureWidth;
  let textX = figureWidth / 2;

  let braceStartY = figureHeight * BRACE_Y_RATIO;
  let braceTick = figureHeight * BRACKET_TICK_RATIO;
  const labelOffsetY = LABEL_OFFSET_RATIO * figureHeight;

  let textY = braceStartY - labelOffsetY;
  let dominantBaseline = null;

  if (vertical) {
    const topInner = figureHeight * TOP_RATIO;
    const bottomInner = figureHeight * BOTTOM_RATIO;
    const gap = Math.max(figureWidth * 0.04, 20);
    const labelSpace = Math.max(figureWidth * 0.18, 60);
    bracketX = figureWidth + gap;
    overlayWidth = bracketX + labelSpace;
    braceStartY = topInner;
    const braceEndY = bottomInner;
    braceTick = Math.min(Math.max(figureWidth * BRACKET_TICK_RATIO, 12), Math.max(bracketX, 12));
    textX = bracketX + labelSpace / 2;
    textY = (topInner + bottomInner) / 2;
    dominantBaseline = 'middle';

    drawVerticalBracketSquare(overlay.group, braceStartY, braceEndY, bracketX, braceTick);
  } else {
    drawBracketSquare(overlay.group, 0, figureWidth, braceStartY, braceTick);
  }

  overlay.svg.style.display = '';
  overlay.svg.style.left = `${overlayLeft}px`;
  overlay.svg.style.top = `${top - boardRect.top}px`;
  overlay.svg.style.width = `${overlayWidth}px`;
  overlay.svg.style.height = `${figureHeight}px`;
  overlay.svg.setAttribute('width', overlayWidth);
  overlay.svg.setAttribute('height', figureHeight);
  overlay.svg.setAttribute('viewBox', `0 0 ${overlayWidth} ${figureHeight}`);
  overlay.svg.setAttribute('preserveAspectRatio', 'none');

  if (overlay.text) {
    overlay.text.setAttribute('x', textX);
    overlay.text.setAttribute('y', textY);
    overlay.text.setAttribute('text-anchor', 'middle');
    if (dominantBaseline) overlay.text.setAttribute('dominant-baseline', dominantBaseline);
    else overlay.text.removeAttribute('dominant-baseline');
    const total = getCombinedTotal();
    overlay.text.textContent = Number.isFinite(total) ? fmt(total) : '';
  }
}

function shouldShowVerticalCombinedBrace(width, height) {
  if (!(width > 0) || !(height > 0)) return false;
  if (CONFIG.cols === 1 && CONFIG.rows > 1) return true;
  if (CONFIG.cols > 1) return false;
  return height >= width * 1.1;
}

function onDragStart(block, event) {
  if (!block?.handle) return;
  const cfg = block.cfg;
  if (cfg?.lockNumerator) return;
  block.handle.setPointerCapture(event.pointerId);
  const move = ev => {
    const currentCfg = block.cfg;
    if (!currentCfg) return;
    const p = clientToSvg(block.svg, ev.clientX, ev.clientY);
    const metrics = block.metrics || getBlockMetrics(block);
    const innerWidth = metrics?.innerWidth ?? metrics?.width ?? VBW;
    const left = metrics?.left ?? 0;
    const right = metrics?.right ?? (left + innerWidth);
    const denom = currentCfg.n || 1;
    const cellW = innerWidth / denom;
    if (!(cellW > 0)) return;
    const x = clamp(p.x, left, right);
    const snapK = Math.round((x - left) / cellW);
    setK(block, snapK);
  };
  const up = () => {
    block.handle.releasePointerCapture(event.pointerId);
    window.removeEventListener('pointermove', move);
    window.removeEventListener('pointerup', up);
  };
  window.addEventListener('pointermove', move);
  window.addEventListener('pointerup', up);
}

function getFrameInset(block) {
  let inset = DEFAULT_FRAME_INSET;
  if (!block) return inset;
  const rectFrame = block.rectFrame;
  if (rectFrame) {
    const attr = rectFrame.getAttribute?.('stroke-width');
    if (attr) {
      const parsed = Number.parseFloat(attr);
      if (Number.isFinite(parsed) && parsed >= 0) {
        inset = parsed / 2;
      }
    } else if (typeof window !== 'undefined' && window.getComputedStyle) {
      try {
        const computed = window.getComputedStyle(rectFrame).getPropertyValue('stroke-width');
        const parsed = Number.parseFloat(String(computed).replace(',', '.'));
        if (Number.isFinite(parsed) && parsed >= 0) {
          inset = parsed / 2;
        }
      } catch (err) {
        // ignore measurement errors
      }
    }
  }
  return inset;
}

function syncLegacyConfig() {
  const first = CONFIG.blocks?.[0]?.[0];
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
  CONFIG.showCustomText = first.showCustomText;
  CONFIG.customText = first.customText;
  CONFIG.activeBlocks = CONFIG.rows * CONFIG.cols;
}
function createSvgElement(parent, name, attrs = {}) {
  const svgEl = parent.ownerSVGElement || parent;
  const el = document.createElementNS(svgEl.namespaceURI, name);
  Object.entries(attrs).forEach(([key, value]) => el.setAttribute(key, value));
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
      // ignore measurement errors
    }
  }

  group.setAttribute('transform', `translate(${cx}, ${cy - appliedCenter})`);
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function fmt(value) {
  return (Math.round(value * 100) / 100).toString().replace('.', ',');
}

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

function drawBracketSquare(group, x0, x1, y, tick) {
  const path = getOrCreateBracePath(group);
  if (!path) return;
  const d = [
    `M ${x0} ${y}`, `v ${tick}`,
    `M ${x0} ${y}`, `H ${x1}`,
    `M ${x1} ${y}`, `v ${tick}`
  ].join(' ');
  path.setAttribute('d', d);
}

function drawVerticalBracketSquare(group, y0, y1, x, tick) {
  const path = getOrCreateBracePath(group);
  if (!path) return;
  const clampedTick = Math.max(0, Math.min(tick, x));
  const d = [
    `M ${x} ${y0}`, `h ${-clampedTick}`,
    `M ${x} ${y0}`, `V ${y1}`,
    `M ${x} ${y1}`, `h ${-clampedTick}`
  ].join(' ');
  path.setAttribute('d', d);
}

function getOrCreateBracePath(group) {
  if (!group) return null;
  const ns = group.ownerSVGElement?.namespaceURI || 'http://www.w3.org/2000/svg';
  let path = group.querySelector('path.tb-brace');
  if (!path) {
    path = document.createElementNS(ns, 'path');
    path.setAttribute('class', 'tb-brace');
    const firstChild = group.firstChild;
    if (firstChild) group.insertBefore(path, firstChild);
    else group.appendChild(path);
  }
  return path;
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
  a.download = filename.endsWith('.svg') ? filename : `${filename}.svg`;
  document.body.appendChild(a);
  a.click();
  a.remove();
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
    canvas.width = Math.round(w * scale);
    canvas.height = Math.round(h * scale);
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    URL.revokeObjectURL(url);
    canvas.toBlob(blobPng => {
      if (!blobPng) return;
      const urlPng = URL.createObjectURL(blobPng);
      const a = document.createElement('a');
      a.href = urlPng;
      a.download = filename.endsWith('.png') ? filename : `${filename}.png`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(urlPng), 1000);
    }, 'image/png');
  };
  img.src = url;
}

function getExportSvg() {
  const firstSvg = BLOCKS[0]?.svg;
  if (!firstSvg) return null;
  const ns = firstSvg.namespaceURI;
  const rows = CONFIG.rows;
  const rowInfo = Array.from({ length: rows }, () => ({ blocks: [], width: 0, height: 0 }));

  for (const block of BLOCKS) {
    if (!block) continue;
    const metrics = block.metrics || getBlockMetrics(block);
    const row = rowInfo[block.row];
    if (!row) continue;
    row.blocks.push({ block, metrics });
    const widthValue = metrics?.width;
    const heightValue = metrics?.height;
    const blockWidth = Number.isFinite(widthValue) && widthValue > 0 ? widthValue : VBW;
    const blockHeight = Number.isFinite(heightValue) && heightValue > 0 ? heightValue : DEFAULT_SVG_HEIGHT;
    row.width += blockWidth;
    if (row.height < blockHeight) row.height = blockHeight;
  }

  const exportWidth = rowInfo.reduce((max, row) => Math.max(max, row.width || 0), 0) || VBW;
  const exportHeight = rowInfo.reduce((sum, row, index) => {
    if (!row.blocks.length) return sum;
    const gap = index > 0 ? ROW_GAP : 0;
    return sum + row.height + gap;
  }, 0) || DEFAULT_SVG_HEIGHT;

  const exportSvg = document.createElementNS(ns, 'svg');
  exportSvg.setAttribute('viewBox', `0 0 ${exportWidth} ${exportHeight}`);
  exportSvg.setAttribute('width', exportWidth);
  exportSvg.setAttribute('height', exportHeight);
  exportSvg.setAttribute('xmlns', ns);
  exportSvg.setAttribute('xmlns:xlink', 'http://www.w3.org/1999/xlink');

  let offsetY = 0;
  rowInfo.forEach((row, rowIndex) => {
    if (!row.blocks.length) return;
    if (rowIndex > 0) offsetY += ROW_GAP;
    const rowGroup = document.createElementNS(ns, 'g');
    rowGroup.setAttribute('transform', `translate(0,${offsetY})`);
    exportSvg.appendChild(rowGroup);

    let offsetX = 0;
    row.blocks.forEach(({ block, metrics }) => {
      if (!block?.svg) return;
      const g = document.createElementNS(ns, 'g');
      g.setAttribute('transform', `translate(${offsetX},0)`);
      g.innerHTML = block.svg.innerHTML;
      rowGroup.appendChild(g);
      const widthValue = metrics?.width ?? block.svg.viewBox?.baseVal?.width;
      const blockWidth = Number.isFinite(widthValue) && widthValue > 0 ? widthValue : VBW;
      offsetX += blockWidth;
    });

    offsetY += row.height;
  });

  const referenceHeight = rowInfo.find(row => row.blocks.length)?.height || DEFAULT_SVG_HEIGHT;

  if (CONFIG.showCombinedWhole && CONFIG.activeBlocks > 1) {
    const startX = 0;
    const endX = exportWidth;
    const braceGroup = createSvgElement(exportSvg, 'g', { class: 'tb-combined-brace' });
    const braceY = BRACE_Y_RATIO * referenceHeight;
    const tick = BRACKET_TICK_RATIO * referenceHeight;
    drawBracketSquare(braceGroup, startX, endX, braceY, tick);
    const totalText = createSvgElement(braceGroup, 'text', {
      x: (startX + endX) / 2,
      y: braceY - LABEL_OFFSET_RATIO * referenceHeight,
      class: 'tb-total',
      'text-anchor': 'middle'
    });
    const totalValue = getCombinedTotal();
    totalText.textContent = Number.isFinite(totalValue) ? fmt(totalValue) : '';
  }

  return exportSvg;
}
