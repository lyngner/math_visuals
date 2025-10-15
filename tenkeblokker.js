/* Tenkeblokker – grid layout */

const DEFAULT_BLOCKS = [{
  total: 1,
  n: 1,
  k: 1,
  showWhole: false,
  hideBlock: false,
  lockDenominator: true,
  lockNumerator: true,
  hideNValue: true,
  valueDisplay: 'number',
  showCustomText: false,
  customText: ''
}, {
  total: 1,
  n: 1,
  k: 1,
  showWhole: false,
  hideBlock: false,
  lockDenominator: true,
  lockNumerator: true,
  hideNValue: true,
  valueDisplay: 'number',
  showCustomText: false,
  customText: ''
}];
const DEFAULT_TENKEBLOKKER_EXAMPLES = [];
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
function parseGridDimension(value, fallback = 1) {
  if (typeof value === 'number' && Number.isFinite(value) && value > 0) {
    return Math.round(value);
  }
  if (typeof value === 'string' && value.trim()) {
    const normalized = Number.parseFloat(value.replace(',', '.'));
    if (Number.isFinite(normalized) && normalized > 0) {
      return Math.round(normalized);
    }
  }
  return fallback;
}
function cloneExampleConfig(config) {
  if (!config) return config;
  if (typeof structuredClone === 'function') {
    try {
      return structuredClone(config);
    } catch (err) {
      // ignore structuredClone errors and fall back to JSON copy
    }
  }
  return JSON.parse(JSON.stringify(config));
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
function hasVisibleBlockBelow(block) {
  if (!block || typeof block.row !== 'number' || typeof block.col !== 'number') return false;
  const rows = Number(CONFIG === null || CONFIG === void 0 ? void 0 : CONFIG.rows);
  if (!Number.isFinite(rows) || block.row >= rows - 1) return false;
  if (!(Array.isArray(CONFIG === null || CONFIG === void 0 ? void 0 : CONFIG.blocks))) return false;
  const nextRowIndex = block.row + 1;
  if (nextRowIndex >= rows) return false;
  const nextRow = CONFIG.blocks[nextRowIndex];
  if (!Array.isArray(nextRow)) return false;
  const cfg = nextRow[block.col];
  if (!(cfg && typeof cfg === 'object')) return false;
  return cfg.hideBlock !== true;
}
function getRowSpanRatios(block) {
  const topRatio = clamp(TOP_RATIO, 0, 1);
  const bottomRatio = clamp(BOTTOM_RATIO, topRatio, 1);
  return {
    topRatio,
    bottomRatio
  };
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
  return {
    ...base
  };
}
const CONFIG = {
  minN: 1,
  maxN: 12,
  rows: 1,
  cols: 1,
  blocks: [],
  showCombinedWhole: false,
  showCombinedWholeVertical: false,
  rowLabels: [],
  altText: '',
  altTextSource: 'auto'
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
const BASE_INNER_RATIO = BOTTOM_RATIO - TOP_RATIO;
const ROW_GAP = 4;
const ROW_LABEL_GAP = 18;
const DEFAULT_FRAME_INSET = 3;
const DEFAULT_GRID_PADDING_TOP = 20;
const DEFAULT_GRID_PADDING_LEFT = 28;
const ROW_LABEL_EXTRA_LEFT_PADDING = 100;
const ROW_LABEL_EXTRA_PADDING_ROWS = 3;
const COMBINED_WHOLE_TOP_MARGIN = 12;
const BLOCKS = [];
let multipleBlocksActive = false;
let altTextManager = null;
let altTextRefreshTimer = null;
let lastAltTextSignature = null;
let pendingAltTextReason = 'auto';
const board = document.getElementById('tbBoard');
const grid = document.getElementById('tbGrid');
const addColumnBtn = document.getElementById('tbAddColumn');
const addRowBtn = document.getElementById('tbAddRow');
const removeColumnBtn = document.getElementById('tbRemoveColumn');
const removeRowBtn = document.getElementById('tbRemoveRow');
const settingsContainer = document.getElementById('tbSettings');
const ROW_LABEL_ELEMENTS = [];
let rowLabelMeasureElement = null;

function getRowLabelMeasureElement() {
  if (rowLabelMeasureElement && document.body && document.body.contains(rowLabelMeasureElement)) {
    return rowLabelMeasureElement;
  }
  const el = document.createElement('div');
  el.className = 'tb-row-label';
  el.setAttribute('aria-hidden', 'true');
  el.style.position = 'absolute';
  el.style.visibility = 'hidden';
  el.style.pointerEvents = 'none';
  el.style.whiteSpace = 'nowrap';
  el.style.paddingRight = '0px';
  el.style.margin = '0';
  el.style.display = 'inline-flex';
  el.style.alignItems = 'center';
  el.style.justifyContent = 'flex-end';
  el.style.gridColumn = 'auto';
  el.style.width = 'auto';
  el.style.minWidth = '0';
  el.style.maxWidth = 'none';
  if (document.body) document.body.appendChild(el);
  rowLabelMeasureElement = el;
  return el;
}

function measureRowLabelWidth(text) {
  if (typeof text !== 'string' || !text) return 0;
  const measureEl = getRowLabelMeasureElement();
  measureEl.textContent = text;
  const rect = measureEl.getBoundingClientRect();
  return rect && Number.isFinite(rect.width) ? rect.width : 0;
}
const globalControls = {
  fieldset: null,
  horizontal: null,
  horizontalRow: null,
  vertical: null,
  verticalRow: null,
  rowLabelInputs: []
};

function getEffectiveActiveBlockCount() {
  const visible = Number(CONFIG === null || CONFIG === void 0 ? void 0 : CONFIG.visibleBlockCount);
  if (Number.isFinite(visible)) return visible;
  const active = Number(CONFIG === null || CONFIG === void 0 ? void 0 : CONFIG.activeBlocks);
  if (Number.isFinite(active)) return active;
  const rows = Number(CONFIG === null || CONFIG === void 0 ? void 0 : CONFIG.rows);
  const cols = Number(CONFIG === null || CONFIG === void 0 ? void 0 : CONFIG.cols);
  if (Number.isFinite(rows) && Number.isFinite(cols)) return rows * cols;
  return 0;
}

function formatCount(value, singular, plural) {
  const num = Math.max(0, Math.round(Number(value) || 0));
  const label = num === 1 ? singular : plural || `${singular}er`;
  return `${num === 1 ? '1' : String(num)} ${label}`;
}

function joinWithOg(items) {
  const filtered = items.filter(Boolean);
  if (filtered.length === 0) return '';
  if (filtered.length === 1) return filtered[0];
  if (filtered.length === 2) return `${filtered[0]} og ${filtered[1]}`;
  return `${filtered.slice(0, -1).join(', ')} og ${filtered[filtered.length - 1]}`;
}

function collectTenkeblokkerAltSummary() {
  const rows = Math.max(1, Math.round(Number(CONFIG.rows) || 1));
  const cols = Math.max(1, Math.round(Number(CONFIG.cols) || 1));
  const rowLabels = Array.from({ length: rows }, (_, idx) => {
    const value = Array.isArray(CONFIG.rowLabels) && typeof CONFIG.rowLabels[idx] === 'string' ? CONFIG.rowLabels[idx].trim() : '';
    return value;
  });
  const blocks = [];
  if (Array.isArray(CONFIG.blocks)) {
    for (let r = 0; r < rows; r++) {
      const row = Array.isArray(CONFIG.blocks[r]) ? CONFIG.blocks[r] : [];
      for (let c = 0; c < cols; c++) {
        const cfg = row[c];
        if (!cfg) continue;
        const total = Number(cfg.total);
        const n = Number(cfg.n);
        const k = Number(cfg.k);
        blocks.push({
          index: r * cols + c,
          row: r,
          col: c,
          visible: cfg.hideBlock !== true,
          showWhole: cfg.showWhole === true,
          rowLabel: rowLabels[r] || '',
          total: Number.isFinite(total) ? total : null,
          n: Number.isFinite(n) && n > 0 ? Math.round(n) : null,
          k: Number.isFinite(k) && k >= 0 ? Math.round(k) : 0,
          customText: cfg.showCustomText && typeof cfg.customText === 'string' ? cfg.customText.trim() : '',
          display: sanitizeDisplayMode(cfg.valueDisplay) || 'number'
        });
      }
    }
  }
  return {
    rows,
    cols,
    rowLabels,
    showCombinedWhole: !!CONFIG.showCombinedWhole,
    showCombinedWholeVertical: !!CONFIG.showCombinedWholeVertical,
    blocks
  };
}

function describeSingleTenkeblokk(block) {
  if (!block) return '';
  const details = [];
  const hasK = Number.isFinite(block.k);
  const hasN = Number.isFinite(block.n);
  const nText = hasN ? formatCount(block.n, 'del', 'deler') : '';
  const kText = hasK ? formatCount(block.k, 'markert del', 'markerte deler') : '';
  if (kText && nText) {
    details.push(`${kText} av ${nText}`);
  } else if (nText) {
    details.push(`delt i ${nText}`);
  } else if (kText) {
    details.push(kText);
  }
  if (Number.isFinite(block.total)) {
    const totalText = fmt(block.total);
    if (block.showWhole) {
      details.push(`totalen ${totalText}`);
    } else {
      details.push(`totalverdi ${totalText}`);
    }
  }
  if (block.customText) {
    details.push(`etiketten «${block.customText}»`);
  }
  let sentence = 'Tenkeblokk';
  const detailText = joinWithOg(details);
  if (detailText) {
    sentence += ` med ${detailText}`;
  }
  if (!sentence.endsWith('.')) sentence += '.';
  return sentence;
}

function buildTenkeblokkerAltText(summary) {
  const data = summary || collectTenkeblokkerAltSummary();
  if (!data) return 'Tenkeblokker.';
  const sentences = [];
  const visibleBlocks = data.blocks.filter(block => block.visible);
  const blockCount = visibleBlocks.length;
  if (blockCount === 0) {
    sentences.push('Visualiseringen viser ingen tenkeblokker.');
    sentences.push('Ingen blokker er synlige.');
    return sentences.filter(Boolean).join(' ');
  }
  if (blockCount === 1) {
    const sentence = describeSingleTenkeblokk(visibleBlocks[0]);
    if (sentence) sentences.push(sentence);
    return sentences.filter(Boolean).join(' ');
  }
  const countText = blockCount === 0 ? 'ingen tenkeblokker' : blockCount === 1 ? 'én tenkeblokk' : `${blockCount} tenkeblokker`;
  sentences.push(`Visualiseringen viser ${countText} organisert i ${formatCount(data.rows, 'rad', 'rader')} og ${formatCount(data.cols, 'kolonne', 'kolonner')}.`);
  const labelDescriptions = data.rowLabels
    .map((label, idx) => (label ? `rad ${idx + 1} merket «${label}»` : ''))
    .filter(Boolean);
  if (labelDescriptions.length) {
    sentences.push(`Radene er merket med ${joinWithOg(labelDescriptions)}.`);
  }
  const totalParts = [];
  if (blockCount > 1 && data.showCombinedWhole) totalParts.push('en horisontal parentes som viser totalen');
  if (blockCount > 1 && data.showCombinedWholeVertical) totalParts.push('en vertikal parentes som viser totalen');
  if (totalParts.length) {
    sentences.push(`Totalverdien vises med ${joinWithOg(totalParts)}.`);
  }
  const blockParts = visibleBlocks.map(block => {
    const rowText = block.rowLabel ? `rad ${block.row + 1} («${block.rowLabel}») ` : `rad ${block.row + 1} `;
    const base = `blokk ${block.index + 1} i ${rowText.trim()}`;
    const nText = Number.isFinite(block.n) ? formatCount(block.n, 'del', 'deler') : null;
    const kText = Number.isFinite(block.k) ? formatCount(block.k, 'markert del', 'markerte deler') : null;
    let part = base;
    if (kText && nText) {
      part += ` viser ${kText} av ${nText}`;
    } else if (nText) {
      part += ` er delt i ${nText}`;
    }
    if (Number.isFinite(block.total)) {
      const totalText = fmt(block.total);
      if (block.showWhole) {
        part += ` av totalen ${totalText}`;
      } else {
        part += ` med totalverdi ${totalText}`;
      }
    }
    if (block.customText) {
      part += `, etiketten i blokken er «${block.customText}»`;
    }
    return part;
  });
  if (blockParts.length) {
    const limit = Math.min(blockParts.length, 3);
    const listed = blockParts.slice(0, limit);
    let sentence = joinWithOg(listed);
    if (sentence) {
      sentence = sentence.charAt(0).toUpperCase() + sentence.slice(1);
      sentence += '.';
    }
    if (blockParts.length > limit) {
      const remaining = blockParts.length - limit;
      sentence += ` ${remaining === 1 ? 'Én blokk til følger samme mønster.' : `${remaining} blokker til følger samme mønster.`}`;
    }
    if (sentence) sentences.push(sentence);
  } else {
    sentences.push('Ingen blokker er synlige.');
  }
  return sentences.filter(Boolean).join(' ');
}

function getTenkeblokkerTitle() {
  const base = typeof document !== 'undefined' && document && document.title ? document.title : 'Tenkeblokker';
  const summary = collectTenkeblokkerAltSummary();
  if (!summary) return base;
  const visibleBlocks = summary.blocks.filter(block => block.visible).length;
  if (!visibleBlocks) return base;
  const suffix = visibleBlocks === 1 ? '1 blokk' : `${visibleBlocks} blokker`;
  return `${base} – ${suffix}`;
}

function getActiveTenkeblokkerAltText() {
  const stored = typeof CONFIG.altText === 'string' ? CONFIG.altText.trim() : '';
  if (CONFIG.altTextSource === 'manual' && stored) return stored;
  return stored || buildTenkeblokkerAltText();
}

function ensureTenkeblokkerAltAnchor() {
  let anchor = document.getElementById('tenkeblokker-alt-anchor');
  if (!anchor) {
    anchor = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    anchor.setAttribute('id', 'tenkeblokker-alt-anchor');
    anchor.setAttribute('width', '0');
    anchor.setAttribute('height', '0');
    anchor.style.position = 'absolute';
    anchor.style.left = '-9999px';
    anchor.style.width = '0';
    anchor.style.height = '0';
    document.body.appendChild(anchor);
  }
  return anchor;
}

function refreshAltText(reason) {
  if (!altTextManager) return;
  const signature = JSON.stringify(collectTenkeblokkerAltSummary());
  if (signature !== lastAltTextSignature) {
    lastAltTextSignature = signature;
    altTextManager.refresh(reason || 'auto', signature);
  } else if (!reason || reason === 'init') {
    altTextManager.refresh(reason || 'auto', signature);
  } else if (typeof altTextManager.notifyFigureChange === 'function') {
    altTextManager.notifyFigureChange(signature);
  }
}

function scheduleAltTextRefresh(reason = 'auto') {
  pendingAltTextReason = reason;
  if (altTextRefreshTimer) {
    clearTimeout(altTextRefreshTimer);
  }
  altTextRefreshTimer = setTimeout(() => {
    altTextRefreshTimer = null;
    refreshAltText(pendingAltTextReason);
  }, 150);
}

function initAltTextManager() {
  if (typeof window === 'undefined' || !window.MathVisAltText) return;
  const container = document.getElementById('exportCard');
  if (!container) return;
  const anchor = ensureTenkeblokkerAltAnchor();
  altTextManager = window.MathVisAltText.create({
    svg: () => anchor,
    container,
    getTitle: getTenkeblokkerTitle,
    getState: () => ({
      text: typeof CONFIG.altText === 'string' ? CONFIG.altText : '',
      source: CONFIG.altTextSource === 'manual' ? 'manual' : 'auto'
    }),
    setState: (text, source) => {
      CONFIG.altText = text;
      CONFIG.altTextSource = source === 'manual' ? 'manual' : 'auto';
    },
    generate: () => buildTenkeblokkerAltText(),
    getSignature: () => JSON.stringify(collectTenkeblokkerAltSummary()),
    getAutoMessage: reason => (reason && reason.startsWith('manual') ? 'Alternativ tekst oppdatert.' : 'Alternativ tekst oppdatert automatisk.'),
    getManualMessage: () => 'Alternativ tekst oppdatert manuelt.'
  });
  if (altTextManager) {
    lastAltTextSignature = null;
    altTextManager.applyCurrent();
    const figure = document.getElementById('tbGrid');
    if (figure && window.MathVisAltText) {
      const nodes = window.MathVisAltText.ensureSvgA11yNodes(anchor);
      const title = getTenkeblokkerTitle();
      figure.setAttribute('role', 'img');
      figure.setAttribute('aria-label', title);
      if (nodes.titleEl && nodes.titleEl.id) figure.setAttribute('aria-labelledby', nodes.titleEl.id);
      if (nodes.descEl && nodes.descEl.id) figure.setAttribute('aria-describedby', nodes.descEl.id);
    }
    scheduleAltTextRefresh('init');
  }
}
const btnSvg = document.getElementById('btnSvg');
const btnPng = document.getElementById('btnPng');
const combinedWholeOverlays = {
  horizontal: createCombinedWholeOverlay('horizontal'),
  vertical: createCombinedWholeOverlay('vertical')
};
if (typeof window !== 'undefined') {
  window.addEventListener('resize', () => draw(true));
}
addColumnBtn === null || addColumnBtn === void 0 || addColumnBtn.addEventListener('click', () => {
  const current = parseGridDimension(CONFIG.cols, 1);
  if (current >= 3) return;
  setHiddenFlag(CONFIG, '__colsDirty', true);
  CONFIG.cols = Math.min(3, current + 1);
  draw();
});
addRowBtn === null || addRowBtn === void 0 || addRowBtn.addEventListener('click', () => {
  const current = parseGridDimension(CONFIG.rows, 1);
  if (current >= 3) return;
  setHiddenFlag(CONFIG, '__rowsDirty', true);
  CONFIG.rows = Math.min(3, current + 1);
  draw();
});
removeColumnBtn === null || removeColumnBtn === void 0 || removeColumnBtn.addEventListener('click', () => {
  const current = parseGridDimension(CONFIG.cols, 1);
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
removeRowBtn === null || removeRowBtn === void 0 || removeRowBtn.addEventListener('click', () => {
  const current = parseGridDimension(CONFIG.rows, 1);
  if (current <= 1) return;
  const next = Math.max(1, current - 1);
  setHiddenFlag(CONFIG, '__rowsDirty', true);
  CONFIG.rows = next;
  if (Array.isArray(CONFIG.blocks) && CONFIG.blocks.length > next) {
    CONFIG.blocks.length = next;
  }
  draw();
});
btnSvg === null || btnSvg === void 0 || btnSvg.addEventListener('click', () => {
  const exportSvg = getExportSvg();
  if (exportSvg) downloadSVG(exportSvg, 'tenkeblokker.svg');
});
btnPng === null || btnPng === void 0 || btnPng.addEventListener('click', () => {
  const exportSvg = getExportSvg();
  if (exportSvg) downloadPNG(exportSvg, 'tenkeblokker.png', 2);
});
normalizeConfig(true);
rebuildStructure();
draw(true);
initAltTextManager();
scheduleAltTextRefresh('init');
window.CONFIG = CONFIG;
window.draw = draw;
function getSvgViewport(block) {
  var _block$panel, _block$panel$getBound, _svg$getBoundingClien;
  const svg = block === null || block === void 0 ? void 0 : block.svg;
  const panelRect = block === null || block === void 0 || (_block$panel = block.panel) === null || _block$panel === void 0 || (_block$panel$getBound = _block$panel.getBoundingClientRect) === null || _block$panel$getBound === void 0 ? void 0 : _block$panel$getBound.call(_block$panel);
  const svgRect = svg === null || svg === void 0 || (_svg$getBoundingClien = svg.getBoundingClientRect) === null || _svg$getBoundingClien === void 0 ? void 0 : _svg$getBoundingClien.call(svg);
  let width = panelRect === null || panelRect === void 0 ? void 0 : panelRect.width;
  if (!(width > 0)) width = svgRect === null || svgRect === void 0 ? void 0 : svgRect.width;
  if (!(width > 0)) width = VBW;
  let height = svgRect === null || svgRect === void 0 ? void 0 : svgRect.height;
  if (!(height > 0) && svg) {
    var _svg$ownerDocument;
    const owner = (_svg$ownerDocument = svg.ownerDocument) === null || _svg$ownerDocument === void 0 ? void 0 : _svg$ownerDocument.defaultView;
    if (owner !== null && owner !== void 0 && owner.getComputedStyle) {
      const computedHeight = owner.getComputedStyle(svg).getPropertyValue('height');
      const parsed = Number.parseFloat(String(computedHeight).replace(',', '.'));
      if (Number.isFinite(parsed) && parsed > 0) height = parsed;
    }
  }
  if (!(height > 0)) height = DEFAULT_SVG_HEIGHT;
  return {
    width,
    height
  };
}
function getBlockMetrics(block) {
  const {
    width,
    height
  } = getSvgViewport(block);
  const left = width * SIDE_MARGIN_RATIO;
  const right = width - left;
  const { topRatio, bottomRatio } = getRowSpanRatios(block);
  let top = height * topRatio;
  let bottom = height * bottomRatio;
  const bracketTick = height * BRACKET_TICK_RATIO;
  let braceY = height * BRACE_Y_RATIO;
  let labelOffsetY = height * LABEL_OFFSET_RATIO;
  if (bottom <= top) {
    bottom = Math.max(top, height);
  }
  const span = bottom - top;
  if (span > 0) {
    const desiredInner = height * BASE_INNER_RATIO;
    const innerDelta = span - desiredInner;
    if (Math.abs(innerDelta) > 0.001) {
      const adjust = innerDelta / 2;
      top -= adjust;
      bottom += adjust;
    }
  }
  const frameInset = getFrameInset(block);
  const outerWidth = Math.max(0, right - left);
  const outerHeight = Math.max(0, bottom - top);
  const clampedInset = Math.min(frameInset, outerWidth / 2, outerHeight / 2);
  const frameLeft = left + clampedInset;
  const frameRight = right - clampedInset;
  const frameTop = top + clampedInset;
  const frameBottom = bottom - clampedInset;
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
  var _defaults$customText;
  const defaults = getDefaultBlock(index);
  const target = existing && typeof existing === 'object' ? existing : {
    ...defaults
  };
  const source = raw && typeof raw === 'object' ? raw : {};
  const isNew = raw == null;
  let total = Number(source.total);
  if (!Number.isFinite(total) || total < 1) {
    const prevTotal = Number(previous === null || previous === void 0 ? void 0 : previous.total);
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
  target.hideBlock = toBoolean(source.hideBlock, toBoolean(defaults.hideBlock, false));
  if (target.hideBlock) target.showWhole = true;
  target.lockDenominator = toBoolean(source.lockDenominator, toBoolean(defaults.lockDenominator, false));
  target.lockNumerator = toBoolean(source.lockNumerator, toBoolean(defaults.lockNumerator, false));
  target.hideNValue = toBoolean(source.hideNValue, toBoolean(defaults.hideNValue, false));
  target.showCustomText = toBoolean(source.showCustomText, toBoolean(defaults.showCustomText, false));
  const textSource = typeof source.customText === 'string' ? source.customText : (_defaults$customText = defaults.customText) !== null && _defaults$customText !== void 0 ? _defaults$customText : '';
  target.customText = textSource;
  let desiredDisplay = sanitizeDisplayMode(source.valueDisplay);
  if (!desiredDisplay) {
    if (toBoolean(source.showPercent)) desiredDisplay = 'percent';else if (toBoolean(source.showFraction)) desiredDisplay = 'fraction';else desiredDisplay = sanitizeDisplayMode(defaults.valueDisplay) || 'number';
  }
  applyDisplayMode(target, desiredDisplay, defaults.valueDisplay);
  return target;
}
function normalizeConfig(initial = false) {
  let structureChanged = false;
  const previousRows = getHiddenNumber(CONFIG, '__lastNormalizedRows');
  const previousCols = getHiddenNumber(CONFIG, '__lastNormalizedCols');
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
    const activeRaw = Number.isFinite(CONFIG.activeBlocks) ? Math.round(CONFIG.activeBlocks) : (flat === null || flat === void 0 ? void 0 : flat.length) || 1;
    const active = clamp(activeRaw, 1, 9);
    let rows = Number.isFinite(CONFIG.rows) ? Math.round(CONFIG.rows) : 0;
    let cols = Number.isFinite(CONFIG.cols) ? Math.round(CONFIG.cols) : 0;
    if (rows < 1) rows = active <= 3 ? 1 : Math.min(3, Math.ceil(active / 3));
    if (cols < 1) cols = Math.min(3, Math.max(1, active));
    rows = clamp(rows, 1, 3);
    cols = clamp(cols, 1, 3);
    while (rows * cols < active) {
      if (cols < 3) cols += 1;else if (rows < 3) rows += 1;else break;
    }
    const gridData = [];
    let index = 0;
    for (let r = 0; r < rows; r++) {
      const row = [];
      for (let c = 0; c < cols; c++) {
        const raw = (flat === null || flat === void 0 ? void 0 : flat[index]) || null;
        let previous = null;
        if (index > 0) {
          if (c > 0) previous = row[c - 1];else if (r > 0) {
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
      cfg.hideBlock = !!cfg.hideBlock;
      cfg.lockDenominator = !!cfg.lockDenominator;
      cfg.lockNumerator = !!cfg.lockNumerator;
      cfg.hideNValue = !!cfg.hideNValue;
    }
  }
  const activeVisible = CONFIG.blocks.reduce((count, row) => {
    if (!Array.isArray(row)) return count;
    return count + row.reduce((rowCount, cfg) => {
      if (!cfg || typeof cfg !== 'object') return rowCount;
      return rowCount + (cfg.hideBlock ? 0 : 1);
    }, 0);
  }, 0);
  CONFIG.visibleBlockCount = activeVisible;
  CONFIG.activeBlocks = rows * cols;
  const existingLabels = Array.isArray(CONFIG.rowLabels) ? CONFIG.rowLabels : [];
  const normalizedRowLabels = [];
  for (let i = 0; i < rows; i++) {
    const value = existingLabels[i];
    normalizedRowLabels.push(typeof value === 'string' ? value : '');
  }
  CONFIG.rowLabels = normalizedRowLabels;
  CONFIG.showCombinedWhole = toBoolean(CONFIG.showCombinedWhole, false);
  CONFIG.showCombinedWholeVertical = toBoolean(CONFIG.showCombinedWholeVertical, false);
  const rowsChanged = Number.isFinite(previousRows) && previousRows !== rows;
  const colsChanged = Number.isFinite(previousCols) && previousCols !== cols;
  if (rowsChanged || colsChanged) structureChanged = true;
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
  ROW_LABEL_ELEMENTS.length = 0;
  buildGlobalSettings(settingsFragment);
  const rowElements = [];
  for (let r = 0; r < CONFIG.rows; r++) {
    const rowEl = document.createElement('div');
    rowEl.className = 'tb-row';
    rowEl.dataset.row = String(r);
    const rowLabel = document.createElement('div');
    rowLabel.className = 'tb-row-label';
    rowLabel.dataset.row = String(r);
    rowLabel.dataset.empty = 'true';
    ROW_LABEL_ELEMENTS[r] = rowLabel;
    rowEl.appendChild(rowLabel);
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

function buildGlobalSettings(targetFragment) {
  if (!targetFragment) return;
  globalControls.fieldset = null;
  globalControls.horizontal = null;
  globalControls.horizontalRow = null;
  globalControls.vertical = null;
  globalControls.verticalRow = null;
  globalControls.rowLabelInputs = [];
  const fieldset = document.createElement('fieldset');
  fieldset.className = 'tb-settings-global';
  const legend = document.createElement('legend');
  legend.textContent = 'Globale innstillinger';
  fieldset.appendChild(legend);
  const rowCount = Math.max(1, Number.parseInt(CONFIG.rows, 10) || 1);
  if (rowCount > 0) {
    const labelWrapper = document.createElement('div');
    labelWrapper.className = 'tb-row-label-inputs';
    for (let i = 0; i < rowCount; i++) {
      const rowLabel = document.createElement('label');
      const input = document.createElement('input');
      input.type = 'text';
      input.placeholder = 'Tekst foran rad';
      input.setAttribute('aria-label', `Tekst foran rad ${i + 1}`);
      const existingValue = Array.isArray(CONFIG.rowLabels) && typeof CONFIG.rowLabels[i] === 'string' ? CONFIG.rowLabels[i] : '';
      input.value = existingValue;
      input.addEventListener('input', () => {
        if (!Array.isArray(CONFIG.rowLabels)) CONFIG.rowLabels = [];
        CONFIG.rowLabels[i] = input.value.trim();
        draw(true);
      });
      rowLabel.appendChild(input);
      labelWrapper.appendChild(rowLabel);
      globalControls.rowLabelInputs[i] = input;
    }
    fieldset.appendChild(labelWrapper);
  }
  const horizontalRow = document.createElement('div');
  horizontalRow.className = 'checkbox-row';
  const horizontalInput = document.createElement('input');
  horizontalInput.type = 'checkbox';
  horizontalInput.id = 'tb-global-combined-horizontal';
  horizontalInput.addEventListener('change', () => {
    CONFIG.showCombinedWhole = !!horizontalInput.checked;
    draw(true);
  });
  const horizontalLabel = document.createElement('label');
  horizontalLabel.setAttribute('for', horizontalInput.id);
  horizontalLabel.textContent = 'Vis horisontal markering av total';
  horizontalRow.append(horizontalInput, horizontalLabel);
  fieldset.appendChild(horizontalRow);
  const verticalRow = document.createElement('div');
  verticalRow.className = 'checkbox-row';
  const verticalInput = document.createElement('input');
  verticalInput.type = 'checkbox';
  verticalInput.id = 'tb-global-combined-vertical';
  verticalInput.addEventListener('change', () => {
    CONFIG.showCombinedWholeVertical = !!verticalInput.checked;
    draw(true);
  });
  const verticalLabel = document.createElement('label');
  verticalLabel.setAttribute('for', verticalInput.id);
  verticalLabel.textContent = 'Vis vertikal markering av total';
  verticalRow.append(verticalInput, verticalLabel);
  fieldset.appendChild(verticalRow);
  targetFragment.appendChild(fieldset);
  globalControls.fieldset = fieldset;
  globalControls.horizontal = horizontalInput;
  globalControls.horizontalRow = horizontalRow;
  globalControls.vertical = verticalInput;
  globalControls.verticalRow = verticalRow;
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
  if (settingsContainer) {
    const parsedColsForSettings = Number(CONFIG.cols);
    const parsedRowsForSettings = Number(CONFIG.rows);
    const safeCols = Number.isFinite(parsedColsForSettings) && parsedColsForSettings > 0 ? Math.floor(parsedColsForSettings) : 1;
    const safeRows = Number.isFinite(parsedRowsForSettings) && parsedRowsForSettings > 0 ? Math.floor(parsedRowsForSettings) : 1;
    settingsContainer.style.setProperty('--tb-settings-cols', String(safeCols));
    settingsContainer.style.setProperty('--tb-settings-rows', String(safeRows));
    settingsContainer.dataset.cols = String(safeCols);
    settingsContainer.dataset.rows = String(safeRows);
  }
  updateAddButtons();
  if (Array.isArray(globalControls.rowLabelInputs)) {
    globalControls.rowLabelInputs.forEach((input, index) => {
      if (!input) return;
      const value = Array.isArray(CONFIG.rowLabels) && typeof CONFIG.rowLabels[index] === 'string' ? CONFIG.rowLabels[index] : '';
      if (input.value !== value) input.value = value;
    });
  }
  let maxLabelWidth = 0;
  let needsFrontPadding = false;
  if (grid) {
    grid.style.setProperty('--tb-row-label-gap', `${ROW_LABEL_GAP}px`);
    grid.style.setProperty('--tb-label-max-width', '0px');
    grid.style.setProperty('--tb-grid-padding-left', `${DEFAULT_GRID_PADDING_LEFT}px`);
  }
  ROW_LABEL_ELEMENTS.forEach((label, index) => {
    if (!label) return;
    const text = Array.isArray(CONFIG.rowLabels) && typeof CONFIG.rowLabels[index] === 'string' ? CONFIG.rowLabels[index] : '';
    const trimmed = text.trim();
    label.textContent = trimmed;
    const hasText = trimmed.length > 0;
    label.dataset.empty = hasText ? 'false' : 'true';
    const rowEl = label.parentElement;
    if (rowEl && rowEl.classList && rowEl.classList.contains('tb-row')) {
      rowEl.dataset.hasLabel = hasText ? 'true' : 'false';
    }
    if (hasText) {
      label.style.display = 'flex';
      const measured = measureRowLabelWidth(trimmed);
      const padded = Math.ceil(Number.isFinite(measured) ? measured : 0) + ROW_LABEL_GAP;
      if (padded > maxLabelWidth) maxLabelWidth = padded;
      if (!needsFrontPadding && index < ROW_LABEL_EXTRA_PADDING_ROWS) {
        needsFrontPadding = true;
      }
    } else {
      label.style.display = 'none';
    }
  });
  if (grid) {
    const safeMax = Math.max(0, Math.ceil(maxLabelWidth));
    grid.style.setProperty('--tb-label-max-width', `${safeMax}px`);
    if (needsFrontPadding) {
      const paddingLeft = DEFAULT_GRID_PADDING_LEFT + ROW_LABEL_EXTRA_LEFT_PADDING;
      grid.style.setProperty('--tb-grid-padding-left', `${paddingLeft}px`);
    }
  }
  const rowTotals = Array.from({
    length: CONFIG.rows
  }, () => 0);
  const visibleBlocks = [];
  let visibleBlockCount = 0;
  for (const block of BLOCKS) {
    var _CONFIG$blocks;
    const cfg = (_CONFIG$blocks = CONFIG.blocks) === null || _CONFIG$blocks === void 0 || (_CONFIG$blocks = _CONFIG$blocks[block.row]) === null || _CONFIG$blocks === void 0 ? void 0 : _CONFIG$blocks[block.col];
    if (!cfg) continue;
    block.cfg = cfg;
    block.index = block.row * CONFIG.cols + block.col;
    visibleBlocks.push(block);
    if (!cfg.hideBlock) visibleBlockCount += 1;
    const totalValue = Number(cfg.total);
    if (Number.isFinite(totalValue) && totalValue > 0 && rowTotals[block.row] !== undefined) {
      rowTotals[block.row] += totalValue;
    }
  }
  CONFIG.visibleBlockCount = visibleBlockCount;
  const activeCount = getEffectiveActiveBlockCount();
  const multiple = activeCount > 1;
  multipleBlocksActive = multiple;
  const parsedCols = Number(CONFIG.cols);
  const parsedRows = Number(CONFIG.rows);
  const hasMultipleCols = Number.isFinite(parsedCols) && parsedCols > 1;
  const hasMultipleRows = Number.isFinite(parsedRows) && parsedRows > 1;
  const horizontalAvailable = multiple && hasMultipleCols;
  const verticalAvailable = multiple && hasMultipleRows;
  if (globalControls.horizontal) {
    globalControls.horizontal.disabled = !horizontalAvailable;
    if (!horizontalAvailable) {
      globalControls.horizontal.checked = false;
      CONFIG.showCombinedWhole = false;
    } else {
      globalControls.horizontal.checked = !!CONFIG.showCombinedWhole;
    }
  }
  if (globalControls.horizontalRow) {
    globalControls.horizontalRow.classList.toggle('is-disabled', !horizontalAvailable);
  }
  if (globalControls.vertical) {
    globalControls.vertical.disabled = !verticalAvailable;
    if (!verticalAvailable) {
      globalControls.vertical.checked = false;
      CONFIG.showCombinedWholeVertical = false;
    } else {
      globalControls.vertical.checked = !!CONFIG.showCombinedWholeVertical;
    }
  }
  if (globalControls.verticalRow) {
    globalControls.verticalRow.classList.toggle('is-disabled', !verticalAvailable);
  }
  const rowHeights = Array.from({
    length: CONFIG.rows
  }, () => {
    const { topRatio, bottomRatio } = getRowSpanRatios();
    const span = bottomRatio - topRatio;
    if (!(span > 0)) return DEFAULT_SVG_HEIGHT;
    const height = DEFAULT_SVG_HEIGHT * BASE_INNER_RATIO / span;
    return Number.isFinite(height) && height > 0 ? height : DEFAULT_SVG_HEIGHT;
  });
  const uniformRowHeight = rowHeights.reduce((max, value) => {
    const numeric = Number(value);
    if (!Number.isFinite(numeric) || numeric <= max) return max;
    return numeric;
  }, 0) || DEFAULT_SVG_HEIGHT;
  for (const block of visibleBlocks) {
    const height = uniformRowHeight;
    if (block === null || block === void 0 ? void 0 : block.panel) {
      const numericHeight = Number.isFinite(height) && height > 0 ? height : DEFAULT_SVG_HEIGHT;
      block.panel.style.setProperty('--tb-svg-height', `${numericHeight.toFixed(2)}px`);
    }
    block.metrics = null;
  }
  const maxRowTotal = rowTotals.reduce((max, value) => {
    const numeric = Number(value);
    if (!Number.isFinite(numeric) || numeric <= max) return max;
    return numeric;
  }, 0);
  if (grid) {
    const rowElements = grid.querySelectorAll('.tb-row');
    rowElements.forEach((rowEl, index) => {
      if (!rowEl) return;
      if (maxRowTotal > 0) {
        const total = Number(rowTotals[index]) || 0;
        const ratio = total > 0 ? total / maxRowTotal : 0;
        const clamped = Math.max(0, Math.min(ratio, 1));
        const percentValue = `${(clamped * 100).toFixed(4)}%`;
        rowEl.style.setProperty('--tb-row-width-percent', percentValue);
        rowEl.style.alignSelf = 'flex-start';
      } else {
        rowEl.style.removeProperty('--tb-row-width-percent');
        rowEl.style.alignSelf = '';
      }
    });
  }
  for (const block of visibleBlocks) {
    const rowTotal = rowTotals[block.row];
    updateBlockPanelLayout(block, rowTotal);
  }
  for (const block of visibleBlocks) {
    drawBlock(block);
  }
  drawCombinedWholeOverlay();
  syncLegacyConfig();
  scheduleAltTextRefresh('draw');
}
function updateAddButtons() {
  const parsedCols = Number(CONFIG.cols);
  const parsedRows = Number(CONFIG.rows);
  const cols = Number.isFinite(parsedCols) ? parsedCols : 1;
  const rows = Number.isFinite(parsedRows) ? parsedRows : 1;
  if (addColumnBtn) addColumnBtn.style.display = cols >= 3 ? 'none' : '';
  if (addRowBtn) addRowBtn.style.display = rows >= 3 ? 'none' : '';
  if (removeColumnBtn) removeColumnBtn.style.display = cols <= 1 ? 'none' : '';
  if (removeRowBtn) removeRowBtn.style.display = rows <= 1 ? 'none' : '';
}
function createBlock(row, col, cfg) {
  var _cfg$total, _cfg$n, _cfg$k;
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
  block.rectEmpty = createSvgElement(block.gBase, 'rect', {
    x: 0,
    y: 0,
    width: 0,
    height: 0,
    class: 'tb-rect-empty'
  });
  block.rectFrame = createSvgElement(block.gFrame, 'rect', {
    x: 0,
    y: 0,
    width: 0,
    height: 0,
    class: 'tb-frame'
  });
  drawBracketSquare(block.gBrace, 0, 0, 0, 0);
  block.totalText = createSvgElement(block.gBrace, 'text', {
    x: 0,
    y: 0,
    class: 'tb-total'
  });
  block.handleShadow = createSvgElement(block.gHandle, 'circle', {
    cx: 0,
    cy: 0,
    r: 20,
    class: 'tb-handle-shadow'
  });
  block.handle = createSvgElement(block.gHandle, 'circle', {
    cx: 0,
    cy: 0,
    r: 18,
    class: 'tb-handle'
  });
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
    var _block$cfg$n, _block$cfg;
    const next = ((_block$cfg$n = (_block$cfg = block.cfg) === null || _block$cfg === void 0 ? void 0 : _block$cfg.n) !== null && _block$cfg$n !== void 0 ? _block$cfg$n : CONFIG.minN) - 1;
    setN(block, next);
  });
  plus.addEventListener('click', () => {
    var _block$cfg$n2, _block$cfg2;
    const next = ((_block$cfg$n2 = (_block$cfg2 = block.cfg) === null || _block$cfg2 === void 0 ? void 0 : _block$cfg2.n) !== null && _block$cfg$n2 !== void 0 ? _block$cfg$n2 : CONFIG.minN) + 1;
    setN(block, next);
  });
  stepper.append(minus, nVal, plus);
  panel.appendChild(stepper);
  const fieldset = document.createElement('fieldset');
  block.fieldset = fieldset;
  fieldset.dataset.row = String(row);
  fieldset.dataset.col = String(col);
  const legend = document.createElement('legend');
  block.legend = legend;
  fieldset.appendChild(legend);
  const totalLabel = document.createElement('label');
  totalLabel.textContent = 'Lengde';
  const totalInput = document.createElement('input');
  totalInput.type = 'number';
  totalInput.min = '1';
  totalInput.step = '1';
  totalInput.value = String((_cfg$total = cfg === null || cfg === void 0 ? void 0 : cfg.total) !== null && _cfg$total !== void 0 ? _cfg$total : 1);
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
  nLabel.textContent = 'Nevner';
  const nInput = document.createElement('input');
  nInput.type = 'number';
  nInput.min = String(CONFIG.minN);
  nInput.max = String(CONFIG.maxN);
  nInput.step = '1';
  nInput.value = String((_cfg$n = cfg === null || cfg === void 0 ? void 0 : cfg.n) !== null && _cfg$n !== void 0 ? _cfg$n : CONFIG.minN);
  nInput.addEventListener('change', () => {
    const parsed = Number.parseInt(nInput.value, 10);
    if (!Number.isNaN(parsed)) setN(block, parsed);
  });
  nLabel.appendChild(nInput);
  fieldset.appendChild(nLabel);
  const kLabel = document.createElement('label');
  kLabel.textContent = 'Teller';
  const kInput = document.createElement('input');
  kInput.type = 'number';
  kInput.min = '0';
  kInput.step = '1';
  kInput.value = String((_cfg$k = cfg === null || cfg === void 0 ? void 0 : cfg.k) !== null && _cfg$k !== void 0 ? _cfg$k : 0);
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
  const hideBlockRow = document.createElement('div');
  hideBlockRow.className = 'checkbox-row';
  const hideBlockInput = document.createElement('input');
  hideBlockInput.type = 'checkbox';
  hideBlockInput.id = `${block.uid}-hide-block`;
  hideBlockInput.addEventListener('change', () => {
    const checked = !!hideBlockInput.checked;
    block.cfg.hideBlock = checked;
    if (checked) block.cfg.showWhole = true;
    draw(true);
  });
  const hideBlockLabel = document.createElement('label');
  hideBlockLabel.setAttribute('for', hideBlockInput.id);
  hideBlockLabel.textContent = 'Skjul blokk';
  hideBlockRow.append(hideBlockInput, hideBlockLabel);
  fieldset.appendChild(hideBlockRow);
  const lockNRow = document.createElement('div');
  lockNRow.className = 'checkbox-row';
  const lockNInput = document.createElement('input');
  lockNInput.type = 'checkbox';
  lockNInput.id = `${block.uid}-lock-n`;
  lockNInput.addEventListener('change', () => {
    block.cfg.lockDenominator = !lockNInput.checked;
    draw(true);
  });
  const lockNLabel = document.createElement('label');
  lockNLabel.setAttribute('for', lockNInput.id);
  lockNLabel.textContent = 'Endre nevner';
  lockNInput.checked = !(cfg !== null && cfg !== void 0 && cfg.lockDenominator);
  lockNRow.append(lockNInput, lockNLabel);
  fieldset.appendChild(lockNRow);
  const lockKRow = document.createElement('div');
  lockKRow.className = 'checkbox-row';
  const lockKInput = document.createElement('input');
  lockKInput.type = 'checkbox';
  lockKInput.id = `${block.uid}-lock-k`;
  lockKInput.addEventListener('change', () => {
    block.cfg.lockNumerator = !lockKInput.checked;
    draw(true);
  });
  const lockKLabel = document.createElement('label');
  lockKLabel.setAttribute('for', lockKInput.id);
  lockKLabel.textContent = 'Endre teller';
  lockKInput.checked = !(cfg !== null && cfg !== void 0 && cfg.lockNumerator);
  lockKRow.append(lockKInput, lockKLabel);
  fieldset.appendChild(lockKRow);
  const hideNRow = document.createElement('div');
  hideNRow.className = 'checkbox-row';
  const hideNInput = document.createElement('input');
  hideNInput.type = 'checkbox';
  hideNInput.id = `${block.uid}-hide-n`;
  hideNInput.addEventListener('change', () => {
    block.cfg.hideNValue = !hideNInput.checked;
    draw(true);
  });
  const hideNLabel = document.createElement('label');
  hideNLabel.setAttribute('for', hideNInput.id);
  hideNLabel.textContent = 'Vis verdien til nevner';
  hideNInput.checked = !(cfg !== null && cfg !== void 0 && cfg.hideNValue);
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
  if (!(block !== null && block !== void 0 && block.panel)) return;
  const cfg = block.cfg;
  const totalValue = Number(cfg === null || cfg === void 0 ? void 0 : cfg.total);
  const positiveTotal = Number.isFinite(totalValue) && totalValue > 0 ? totalValue : 0;
  const hasRowTotal = Number.isFinite(rowTotal) && rowTotal > 0;
  const stepperVisible = !(cfg !== null && cfg !== void 0 && cfg.lockDenominator);
  const hasBlockBelow = hasVisibleBlockBelow(block);
  block.hasVisibleBlockBelow = hasBlockBelow;
  const needsVerticalSpace = stepperVisible && hasBlockBelow;
  block.panel.style.flexBasis = '0px';
  block.panel.style.flexShrink = '1';
  if (hasRowTotal && positiveTotal > 0) {
    block.panel.style.flexGrow = String(positiveTotal);
  } else {
    block.panel.style.flexGrow = '1';
  }
  const panelEl = block.panel;
  const stepperEl = block.stepper;
  const stepperHeight = stepperEl && stepperEl.offsetHeight ? stepperEl.offsetHeight : 0;
  let stepperSpacing = 0;
  if (panelEl && typeof window !== 'undefined' && window.getComputedStyle) {
    try {
      const spacingValue = window.getComputedStyle(panelEl).getPropertyValue('--tb-stepper-spacing');
      const parsed = Number.parseFloat(String(spacingValue).replace(',', '.'));
      if (Number.isFinite(parsed)) stepperSpacing = parsed;
    } catch (err) {
      stepperSpacing = 0;
    }
  }
  if (panelEl) {
    const panelHeight = block !== null && block !== void 0 && block.svg ? block.svg.getBoundingClientRect().height : panelEl.getBoundingClientRect().height;
    if (needsVerticalSpace && stepperEl) {
      const shift = stepperHeight + stepperSpacing;
      panelEl.style.position = 'relative';
      panelEl.style.marginBottom = shift > 0 ? `${-shift}px` : '0px';
      panelEl.style.rowGap = '0px';
      stepperEl.style.position = 'absolute';
      stepperEl.style.left = '50%';
      stepperEl.style.transform = 'translate(-50%, -50%)';
      stepperEl.style.top = `${panelHeight}px`;
      stepperEl.style.zIndex = '2';
    } else {
      panelEl.style.position = '';
      panelEl.style.marginBottom = '0px';
      panelEl.style.rowGap = stepperVisible ? 'var(--tb-stepper-spacing, 6px)' : '0px';
      if (stepperEl) {
        stepperEl.style.position = '';
        stepperEl.style.left = '';
        stepperEl.style.transform = '';
        stepperEl.style.top = '';
        stepperEl.style.zIndex = '';
      }
    }
  }
}
function drawBlock(block) {
  var _block$rectEmpty, _block$rectEmpty2, _block$rectEmpty3, _block$rectEmpty4, _block$rectFrame, _block$rectFrame2, _block$rectFrame3, _block$rectFrame4, _block$handle, _block$handleShadow, _block$handle2, _block$handleShadow2;
  const cfg = block === null || block === void 0 ? void 0 : block.cfg;
  if (!block || !cfg) return;
  const blockHidden = !!cfg.hideBlock;
  if (blockHidden && !cfg.showWhole) cfg.showWhole = true;
  const metrics = getBlockMetrics(block);
  block.metrics = metrics;
  const {
    width,
    height,
    left,
    right,
    top,
    bottom,
    braceY,
    bracketTick,
    labelOffsetY,
    innerWidth,
    innerHeight,
    centerX
  } = metrics;
  if (block.svg) {
    block.svg.setAttribute('viewBox', `0 0 ${width} ${height}`);
    block.svg.setAttribute('aria-label', `Tenkeblokk ${block.index + 1}`);
    block.svg.setAttribute('preserveAspectRatio', 'none');
    block.svg.classList.toggle('tb-svg--hidden-block', blockHidden);
  }
  const hiddenDisplay = blockHidden ? 'none' : '';
  if (block.gBase) block.gBase.style.display = hiddenDisplay;
  if (block.gFill) block.gFill.style.display = hiddenDisplay;
  if (block.gSep) block.gSep.style.display = hiddenDisplay;
  if (block.gVals) block.gVals.style.display = hiddenDisplay;
  if (block.gFrame) block.gFrame.style.display = hiddenDisplay;
  if (block.gHandle) block.gHandle.style.display = blockHidden ? 'none' : '';
  if (block.handleShadow) block.handleShadow.style.display = blockHidden ? 'none' : '';
  if (block.handle) block.handle.style.display = blockHidden ? 'none' : '';
  (_block$rectEmpty = block.rectEmpty) === null || _block$rectEmpty === void 0 || _block$rectEmpty.setAttribute('x', left);
  (_block$rectEmpty2 = block.rectEmpty) === null || _block$rectEmpty2 === void 0 || _block$rectEmpty2.setAttribute('width', innerWidth);
  (_block$rectEmpty3 = block.rectEmpty) === null || _block$rectEmpty3 === void 0 || _block$rectEmpty3.setAttribute('y', top);
  (_block$rectEmpty4 = block.rectEmpty) === null || _block$rectEmpty4 === void 0 || _block$rectEmpty4.setAttribute('height', innerHeight);
  (_block$rectFrame = block.rectFrame) === null || _block$rectFrame === void 0 || _block$rectFrame.setAttribute('x', left);
  (_block$rectFrame2 = block.rectFrame) === null || _block$rectFrame2 === void 0 || _block$rectFrame2.setAttribute('width', innerWidth);
  (_block$rectFrame3 = block.rectFrame) === null || _block$rectFrame3 === void 0 || _block$rectFrame3.setAttribute('y', top);
  (_block$rectFrame4 = block.rectFrame) === null || _block$rectFrame4 === void 0 || _block$rectFrame4.setAttribute('height', innerHeight);
  drawBracketSquare(block.gBrace, left, right, braceY, bracketTick);
  if (block.totalText) {
    block.totalText.setAttribute('x', centerX);
    block.totalText.setAttribute('y', braceY - labelOffsetY);
    block.totalText.textContent = fmt(cfg.total);
  }
  if (block.legend) {
    block.legend.textContent = `Tenkeblokk ${block.index + 1}`;
  }
  const stepperVisible = !cfg.lockDenominator && !blockHidden;
  if (block.stepper) {
    block.stepper.setAttribute('aria-label', `Nevner i tenkeblokk ${block.index + 1}`);
    block.stepper.style.display = stepperVisible ? '' : 'none';
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
    const {
      total,
      n,
      k,
      showWhole,
      hideBlock: hideBlockInput,
      lockN,
      lockK,
      hideN,
      display,
      showCustomText,
      customText
    } = block.inputs;
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
    if (showWhole) {
      const showWholeDisabled = blockHidden || multipleBlocksActive && !blockHidden;
      if (blockHidden && !cfg.showWhole) cfg.showWhole = true;
      showWhole.checked = !!cfg.showWhole;
      showWhole.disabled = showWholeDisabled;
      if (showWholeDisabled) {
        showWhole.setAttribute('aria-disabled', 'true');
      } else {
        showWhole.removeAttribute('aria-disabled');
      }
    }
    if (hideBlockInput) hideBlockInput.checked = !!cfg.hideBlock;
    if (lockN) lockN.checked = !cfg.lockDenominator;
    if (lockK) lockK.checked = !cfg.lockNumerator;
    if (hideN) hideN.checked = !cfg.hideNValue;
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
  const cellW = !blockHidden && cfg.n ? innerWidth / cfg.n : 0;
  if (!blockHidden && cellW > 0) {
    const showCustomText = customTextEnabled;
    const customLabel = typeof cfg.customText === 'string' ? cfg.customText.trim() : '';
    for (let i = 0; i < cfg.k; i++) {
      createSvgElement(block.gFill, 'rect', {
        x: left + i * cellW,
        y: top,
        width: cellW,
        height: innerHeight,
        class: 'tb-rect'
      });
    }
    for (let i = 1; i < cfg.n; i++) {
      const x = left + i * cellW;
      createSvgElement(block.gSep, 'line', {
        x1: x,
        y1: top,
        x2: x,
        y2: bottom,
        class: 'tb-sep'
      });
    }
    const displayMode = sanitizeDisplayMode(cfg.valueDisplay) || 'number';
    const per = cfg.n ? cfg.total / cfg.n : 0;
    const percentValue = cfg.n ? 100 / cfg.n : 0;
    for (let i = 0; i < cfg.n; i++) {
      const cx = left + (i + 0.5) * cellW;
      const cy = top + innerHeight / 2;
      if (showCustomText) {
        const text = createSvgElement(block.gVals, 'text', {
          x: cx,
          y: cy,
          class: 'tb-val'
        });
        text.textContent = customLabel;
        continue;
      }
      if (displayMode === 'fraction') {
        renderFractionLabel(block.gVals, cx, cy, 1, cfg.n);
        continue;
      }
      const text = createSvgElement(block.gVals, 'text', {
        x: cx,
        y: cy,
        class: 'tb-val'
      });
      const label = displayMode === 'percent' ? `${fmt(percentValue)} %` : fmt(per);
      text.textContent = label;
    }
  }
  const hx = cellW > 0 ? left + cfg.k * cellW : left;
  const hy = top + innerHeight / 2;
  (_block$handle = block.handle) === null || _block$handle === void 0 || _block$handle.setAttribute('cx', hx);
  (_block$handleShadow = block.handleShadow) === null || _block$handleShadow === void 0 || _block$handleShadow.setAttribute('cx', hx);
  (_block$handle2 = block.handle) === null || _block$handle2 === void 0 || _block$handle2.setAttribute('cy', hy);
  (_block$handleShadow2 = block.handleShadow) === null || _block$handleShadow2 === void 0 || _block$handleShadow2.setAttribute('cy', hy + 2);
  if (block.gHandle) block.gHandle.style.display = blockHidden || cfg.lockNumerator ? 'none' : '';
  if (block.handle) block.handle.style.cursor = blockHidden || cfg.lockNumerator ? 'default' : 'pointer';
  const showWholeAllowed = !multipleBlocksActive || blockHidden;
  if (block.gBrace) block.gBrace.style.display = showWholeAllowed && cfg.showWhole ? '' : 'none';
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
function createCombinedWholeOverlay(orientation = 'horizontal') {
  if (!board) return null;
  const ns = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(ns, 'svg');
  svg.setAttribute('class', 'tb-combined-whole');
  svg.setAttribute('aria-hidden', 'true');
  svg.style.display = 'none';
  svg.style.width = '0';
  svg.style.height = '0';
  svg.dataset.orientation = orientation;
  board.appendChild(svg);
  const group = createSvgElement(svg, 'g', {
    class: 'tb-combined-brace'
  });
  const text = createSvgElement(group, 'text', {
    class: 'tb-total',
    'text-anchor': 'middle'
  });
  return {
    svg,
    group,
    text
  };
}
function getCombinedTotal() {
  let sum = 0;
  for (let r = 0; r < CONFIG.rows; r++) {
    for (let c = 0; c < CONFIG.cols; c++) {
      var _CONFIG$blocks2;
      const value = Number((_CONFIG$blocks2 = CONFIG.blocks) === null || _CONFIG$blocks2 === void 0 || (_CONFIG$blocks2 = _CONFIG$blocks2[r]) === null || _CONFIG$blocks2 === void 0 || (_CONFIG$blocks2 = _CONFIG$blocks2[c]) === null || _CONFIG$blocks2 === void 0 ? void 0 : _CONFIG$blocks2.total);
      if (!Number.isFinite(value)) return NaN;
      sum += value;
    }
  }
  return sum;
}
function getBlockClientMetrics(block) {
  if (!(block !== null && block !== void 0 && block.svg)) return null;
  const rect = block.svg.getBoundingClientRect();
  if (!((rect === null || rect === void 0 ? void 0 : rect.width) > 0) || !((rect === null || rect === void 0 ? void 0 : rect.height) > 0)) return null;
  return {
    left: rect.left,
    right: rect.right,
    top: rect.top,
    bottom: rect.bottom
  };
}
function drawCombinedWholeOverlay() {
  drawCombinedWholeOverlayHorizontal();
  drawCombinedWholeOverlayVertical();
}

function getCombinedFigureMetrics() {
  if (!board) return null;
  const metrics = BLOCKS.map(getBlockClientMetrics).filter(Boolean);
  if (!metrics.length) {
    return null;
  }
  const left = Math.min(...metrics.map(m => m.left));
  const right = Math.max(...metrics.map(m => m.right));
  const top = Math.min(...metrics.map(m => m.top));
  const bottom = Math.max(...metrics.map(m => m.bottom));
  const width = right - left;
  const height = bottom - top;
  if (!(width > 0) || !(height > 0)) {
    return null;
  }
  const boardRect = board.getBoundingClientRect();
  return {
    left,
    top,
    width,
    height,
    boardLeft: boardRect.left,
    boardTop: boardRect.top
  };
}

function drawCombinedWholeOverlayHorizontal() {
  const overlay = combinedWholeOverlays.horizontal;
  if (!(overlay !== null && overlay !== void 0 && overlay.svg) || !board) return;
  const activeCount = getEffectiveActiveBlockCount();
  const canShow = activeCount > 1 && CONFIG.showCombinedWhole;
  if (!canShow) {
    overlay.svg.style.display = 'none';
    if (grid) grid.style.removeProperty('--tb-grid-padding-top');
    return;
  }
  let metrics = getCombinedFigureMetrics();
  if (!metrics) {
    overlay.svg.style.display = 'none';
    if (grid) grid.style.removeProperty('--tb-grid-padding-top');
    return;
  }
  let { left, top, width, height, boardLeft, boardTop } = metrics;
  const labelOffsetY = Math.max(height * LABEL_OFFSET_RATIO, 12);
  const gapToBlocks = Math.max(Math.min(height * 0.03, 24), 12);
  const textPadding = Math.max(Math.min(labelOffsetY * 0.45, 10), 5);
  const textSafeMargin = Math.max(Math.min(height * 0.012, 10), 4);
  const braceStartY = labelOffsetY + textPadding + textSafeMargin;
  const braceTick = gapToBlocks;
  const overlayTopOffset = braceStartY + braceTick;
  if (grid) {
    const desiredPaddingTop = Math.max(DEFAULT_GRID_PADDING_TOP, overlayTopOffset + COMBINED_WHOLE_TOP_MARGIN);
    const currentPaddingRaw = grid.style.getPropertyValue('--tb-grid-padding-top');
    const currentPadding = Number.parseFloat(currentPaddingRaw);
    if (!Number.isFinite(currentPadding) || Math.abs(currentPadding - desiredPaddingTop) > 0.5) {
      grid.style.setProperty('--tb-grid-padding-top', `${desiredPaddingTop}px`);
      const updatedMetrics = getCombinedFigureMetrics();
      if (updatedMetrics) {
        left = updatedMetrics.left;
        top = updatedMetrics.top;
        width = updatedMetrics.width;
        height = updatedMetrics.height;
        boardLeft = updatedMetrics.boardLeft;
        boardTop = updatedMetrics.boardTop;
      }
    }
  }
  const overlayHeight = height + overlayTopOffset;
  overlay.svg.style.display = '';
  overlay.svg.style.left = `${left - boardLeft}px`;
  overlay.svg.style.top = `${top - boardTop - overlayTopOffset}px`;
  overlay.svg.style.width = `${width}px`;
  overlay.svg.style.height = `${overlayHeight}px`;
  overlay.svg.setAttribute('width', width);
  overlay.svg.setAttribute('height', overlayHeight);
  overlay.svg.setAttribute('viewBox', `0 0 ${width} ${overlayHeight}`);
  overlay.svg.setAttribute('preserveAspectRatio', 'none');
  drawBracketSquare(overlay.group, 0, width, braceStartY, braceTick);
  if (overlay.text) {
    overlay.text.setAttribute('x', width / 2);
    overlay.text.setAttribute('y', braceStartY - labelOffsetY);
    overlay.text.setAttribute('text-anchor', 'middle');
    overlay.text.removeAttribute('dominant-baseline');
    const total = getCombinedTotal();
    overlay.text.textContent = Number.isFinite(total) ? fmt(total) : '';
  }
}

function drawCombinedWholeOverlayVertical() {
  const overlay = combinedWholeOverlays.vertical;
  if (!(overlay !== null && overlay !== void 0 && overlay.svg) || !board) return;
  const activeCount = getEffectiveActiveBlockCount();
  const canShow = activeCount > 1 && CONFIG.showCombinedWholeVertical;
  if (!canShow) {
    overlay.svg.style.display = 'none';
    return;
  }
  const metrics = getCombinedFigureMetrics();
  if (!metrics) {
    overlay.svg.style.display = 'none';
    return;
  }
  const { left, top, width, height, boardLeft, boardTop } = metrics;
  let topInner = height * TOP_RATIO;
  let bottomInner = height * BOTTOM_RATIO;
  const blockBounds = BLOCKS.map(block => {
    const rect = getBlockClientMetrics(block);
    if (!rect) return null;
    const blockMetrics = block.metrics || getBlockMetrics(block);
    if (!blockMetrics) return null;
    return {
      rect,
      metrics: blockMetrics
    };
  }).filter(Boolean);
  if (blockBounds.length) {
    let minY = Infinity;
    let maxY = -Infinity;
    for (const { rect, metrics: blockMetrics } of blockBounds) {
      const offsetTop = rect.top - top;
      const outerTop = Number.isFinite(blockMetrics.outerTop) ? blockMetrics.outerTop : 0;
      const outerBottom = Number.isFinite(blockMetrics.outerBottom) ? blockMetrics.outerBottom : blockMetrics.height || 0;
      const start = offsetTop + outerTop;
      const end = offsetTop + outerBottom;
      if (start < minY) minY = start;
      if (end > maxY) maxY = end;
    }
    if (Number.isFinite(minY)) topInner = clamp(minY, 0, height);
    if (Number.isFinite(maxY)) bottomInner = clamp(maxY, topInner, height);
  }
  const gap = Math.max(width * 0.04, 20);
  const labelSpace = Math.max(width * 0.18, 60);
  const bracketX = width + gap;
  const overlayWidth = bracketX + labelSpace;
  const overlayHeight = height;
  overlay.svg.style.display = '';
  overlay.svg.style.left = `${left - boardLeft}px`;
  overlay.svg.style.top = `${top - boardTop}px`;
  overlay.svg.style.width = `${overlayWidth}px`;
  overlay.svg.style.height = `${overlayHeight}px`;
  overlay.svg.setAttribute('width', overlayWidth);
  overlay.svg.setAttribute('height', overlayHeight);
  overlay.svg.setAttribute('viewBox', `0 0 ${overlayWidth} ${overlayHeight}`);
  overlay.svg.setAttribute('preserveAspectRatio', 'none');
  const braceTick = Math.min(Math.max(width * BRACKET_TICK_RATIO, 12), Math.max(bracketX, 12));
  drawVerticalBracketSquare(overlay.group, topInner, bottomInner, bracketX, braceTick);
  if (overlay.text) {
    overlay.text.setAttribute('x', bracketX + labelSpace / 2);
    overlay.text.setAttribute('y', (topInner + bottomInner) / 2);
    overlay.text.setAttribute('text-anchor', 'middle');
    overlay.text.setAttribute('dominant-baseline', 'middle');
    const total = getCombinedTotal();
    overlay.text.textContent = Number.isFinite(total) ? fmt(total) : '';
  }
}
function onDragStart(block, event) {
  if (!(block !== null && block !== void 0 && block.handle)) return;
  const cfg = block.cfg;
  if (cfg !== null && cfg !== void 0 && cfg.lockNumerator) return;
  block.handle.setPointerCapture(event.pointerId);
  const move = ev => {
    var _ref, _metrics$innerWidth, _metrics$left, _metrics$right;
    const currentCfg = block.cfg;
    if (!currentCfg) return;
    const p = clientToSvg(block.svg, ev.clientX, ev.clientY);
    const metrics = block.metrics || getBlockMetrics(block);
    const innerWidth = (_ref = (_metrics$innerWidth = metrics === null || metrics === void 0 ? void 0 : metrics.innerWidth) !== null && _metrics$innerWidth !== void 0 ? _metrics$innerWidth : metrics === null || metrics === void 0 ? void 0 : metrics.width) !== null && _ref !== void 0 ? _ref : VBW;
    const left = (_metrics$left = metrics === null || metrics === void 0 ? void 0 : metrics.left) !== null && _metrics$left !== void 0 ? _metrics$left : 0;
    const right = (_metrics$right = metrics === null || metrics === void 0 ? void 0 : metrics.right) !== null && _metrics$right !== void 0 ? _metrics$right : left + innerWidth;
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
    var _rectFrame$getAttribu;
    const attr = (_rectFrame$getAttribu = rectFrame.getAttribute) === null || _rectFrame$getAttribu === void 0 ? void 0 : _rectFrame$getAttribu.call(rectFrame, 'stroke-width');
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
  var _CONFIG$blocks3;
  const first = (_CONFIG$blocks3 = CONFIG.blocks) === null || _CONFIG$blocks3 === void 0 || (_CONFIG$blocks3 = _CONFIG$blocks3[0]) === null || _CONFIG$blocks3 === void 0 ? void 0 : _CONFIG$blocks3[0];
  if (!first) return;
  CONFIG.total = first.total;
  CONFIG.n = first.n;
  CONFIG.k = first.k;
  CONFIG.showWhole = first.showWhole;
  CONFIG.hideBlock = first.hideBlock;
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
  const numText = typeof numerator === 'number' ? numerator.toString() : `${numerator !== null && numerator !== void 0 ? numerator : ''}`;
  const denText = typeof denominator === 'number' ? denominator.toString() : `${denominator !== null && denominator !== void 0 ? denominator : ''}`;
  if (!numText || !denText) return;
  const numeratorY = -20;
  const denominatorY = 28;
  const fallbackCenter = (numeratorY + denominatorY) / 2;
  const maxLen = Math.max(numText.length, denText.length);
  const charWidth = 20;
  const halfWidth = Math.max(16, maxLen * charWidth / 2);
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
  var _svgEl$viewBox, _vb$width, _vb$height, _vb$x, _vb$y;
  const rect = svgEl.getBoundingClientRect();
  const vb = (_svgEl$viewBox = svgEl.viewBox) === null || _svgEl$viewBox === void 0 ? void 0 : _svgEl$viewBox.baseVal;
  const width = (_vb$width = vb === null || vb === void 0 ? void 0 : vb.width) !== null && _vb$width !== void 0 ? _vb$width : VBW;
  const height = (_vb$height = vb === null || vb === void 0 ? void 0 : vb.height) !== null && _vb$height !== void 0 ? _vb$height : VBH;
  const minX = (_vb$x = vb === null || vb === void 0 ? void 0 : vb.x) !== null && _vb$x !== void 0 ? _vb$x : 0;
  const minY = (_vb$y = vb === null || vb === void 0 ? void 0 : vb.y) !== null && _vb$y !== void 0 ? _vb$y : 0;
  if (!rect.width || !rect.height) return {
    x: minX,
    y: minY
  };
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
  const d = [`M ${x0} ${y}`, `v ${tick}`, `M ${x0} ${y}`, `H ${x1}`, `M ${x1} ${y}`, `v ${tick}`].join(' ');
  path.setAttribute('d', d);
}
function drawVerticalBracketSquare(group, y0, y1, x, tick) {
  const path = getOrCreateBracePath(group);
  if (!path) return;
  const clampedTick = Math.max(0, Math.min(tick, x));
  const d = [`M ${x} ${y0}`, `h ${-clampedTick}`, `M ${x} ${y0}`, `V ${y1}`, `M ${x} ${y1}`, `h ${-clampedTick}`].join(' ');
  path.setAttribute('d', d);
}
function getOrCreateBracePath(group) {
  var _group$ownerSVGElemen;
  if (!group) return null;
  const ns = ((_group$ownerSVGElemen = group.ownerSVGElement) === null || _group$ownerSVGElemen === void 0 ? void 0 : _group$ownerSVGElemen.namespaceURI) || 'http://www.w3.org/2000/svg';
  let path = group.querySelector('path.tb-brace');
  if (!path) {
    path = document.createElementNS(ns, 'path');
    path.setAttribute('class', 'tb-brace');
    const firstChild = group.firstChild;
    if (firstChild) group.insertBefore(path, firstChild);else group.appendChild(path);
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
  const blob = new Blob([data], {
    type: 'image/svg+xml;charset=utf-8'
  });
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
  var _svgEl$viewBox2;
  const vb = (_svgEl$viewBox2 = svgEl.viewBox) === null || _svgEl$viewBox2 === void 0 ? void 0 : _svgEl$viewBox2.baseVal;
  const w = (vb === null || vb === void 0 ? void 0 : vb.width) || svgEl.clientWidth || 420;
  const h = (vb === null || vb === void 0 ? void 0 : vb.height) || svgEl.clientHeight || 420;
  const data = svgToString(svgEl);
  const blob = new Blob([data], {
    type: 'image/svg+xml;charset=utf-8'
  });
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
  var _BLOCKS$, _rowInfo$find;
  const firstSvg = (_BLOCKS$ = BLOCKS[0]) === null || _BLOCKS$ === void 0 ? void 0 : _BLOCKS$.svg;
  if (!firstSvg) return null;
  const ns = firstSvg.namespaceURI;
  const rows = CONFIG.rows;
  const rowInfo = Array.from({
    length: rows
  }, () => ({
    blocks: [],
    width: 0,
    height: 0
  }));
  for (const block of BLOCKS) {
    if (!block) continue;
    const metrics = block.metrics || getBlockMetrics(block);
    const row = rowInfo[block.row];
    if (!row) continue;
    row.blocks.push({
      block,
      metrics
    });
    const widthValue = metrics === null || metrics === void 0 ? void 0 : metrics.width;
    const heightValue = metrics === null || metrics === void 0 ? void 0 : metrics.height;
    const blockWidth = Number.isFinite(widthValue) && widthValue > 0 ? widthValue : VBW;
    const blockHeight = Number.isFinite(heightValue) && heightValue > 0 ? heightValue : DEFAULT_SVG_HEIGHT;
    row.width += blockWidth;
    if (row.height < blockHeight) row.height = blockHeight;
  }
  const figureWidth = rowInfo.reduce((max, row) => Math.max(max, row.width || 0), 0) || VBW;
  const rowLabels = Array.isArray(CONFIG.rowLabels) ? CONFIG.rowLabels : [];
  const labelTexts = rowInfo.map((_, index) => {
    const value = rowLabels[index];
    return typeof value === 'string' ? value.trim() : '';
  });
  const labelBaseWidth = labelTexts.reduce((max, text) => {
    if (!text) return max;
    const estimated = Math.max(48, Math.min(200, text.length * 14 + 24));
    return Math.max(max, estimated);
  }, 0);
  const labelPadding = labelBaseWidth > 0 ? 12 : 0;
  const labelSpace = labelBaseWidth > 0 ? labelBaseWidth + labelPadding : 0;
  const exportHeight = rowInfo.reduce((sum, row, index) => {
    if (!row.blocks.length) return sum;
    const gap = index > 0 ? ROW_GAP : 0;
    return sum + row.height + gap;
  }, 0) || DEFAULT_SVG_HEIGHT;
  const activeCount = getEffectiveActiveBlockCount();
  const verticalActive = CONFIG.showCombinedWholeVertical && activeCount > 1 && figureWidth > 0;
  const verticalGap = verticalActive ? Math.max(figureWidth * 0.04, 20) : 0;
  const verticalLabelSpace = verticalActive ? Math.max(figureWidth * 0.18, 60) : 0;
  const verticalExtra = verticalActive ? verticalGap + verticalLabelSpace : 0;
  const exportWidth = labelSpace + figureWidth + verticalExtra;
  const exportSvg = document.createElementNS(ns, 'svg');
  exportSvg.setAttribute('viewBox', `0 0 ${exportWidth} ${exportHeight}`);
  exportSvg.setAttribute('width', exportWidth);
  exportSvg.setAttribute('height', exportHeight);
  exportSvg.setAttribute('xmlns', ns);
  exportSvg.setAttribute('xmlns:xlink', 'http://www.w3.org/1999/xlink');
  if (window.MathVisAltText) {
    const { titleEl, descEl } = window.MathVisAltText.ensureSvgA11yNodes(exportSvg);
    const title = getTenkeblokkerTitle();
    if (titleEl) titleEl.textContent = title;
    const desc = getActiveTenkeblokkerAltText();
    if (descEl) descEl.textContent = desc;
    exportSvg.setAttribute('role', 'img');
    exportSvg.setAttribute('aria-label', title);
    if (titleEl && titleEl.id) exportSvg.setAttribute('aria-labelledby', titleEl.id);
    if (descEl && descEl.id) exportSvg.setAttribute('aria-describedby', descEl.id);
  }
  let offsetY = 0;
  rowInfo.forEach((row, rowIndex) => {
    if (!row.blocks.length) return;
    if (rowIndex > 0) offsetY += ROW_GAP;
    const rowContainer = document.createElementNS(ns, 'g');
    rowContainer.setAttribute('transform', `translate(0,${offsetY})`);
    exportSvg.appendChild(rowContainer);
    const labelText = labelTexts[rowIndex];
    if (labelText) {
      const firstEntry = row.blocks[0];
      const metrics = (firstEntry === null || firstEntry === void 0 ? void 0 : firstEntry.metrics) || null;
      const baseline = metrics && Number.isFinite(metrics.top) ? metrics.top : BRACE_Y_RATIO * row.height;
      const labelY = baseline + 24;
      const labelEl = createSvgElement(rowContainer, 'text', {
        x: labelSpace > 0 ? labelSpace - 12 : 0,
        y: labelY,
        class: 'tb-row-label-text',
        'text-anchor': labelSpace > 0 ? 'end' : 'start'
      });
      labelEl.textContent = labelText;
    }
    const blocksGroup = document.createElementNS(ns, 'g');
    blocksGroup.setAttribute('transform', `translate(${labelSpace},0)`);
    rowContainer.appendChild(blocksGroup);
    let offsetX = 0;
    row.blocks.forEach(({
      block,
      metrics
    }) => {
      var _metrics$width, _block$svg$viewBox;
      if (!(block !== null && block !== void 0 && block.svg)) return;
      const g = document.createElementNS(ns, 'g');
      g.setAttribute('transform', `translate(${offsetX},0)`);
      const blockClone = block.svg.cloneNode(true);
      const exportHandleElements = blockClone.querySelectorAll('.tb-handle, .tb-handle-shadow');
      exportHandleElements.forEach(el => el.remove());
      g.innerHTML = blockClone.innerHTML;
      blocksGroup.appendChild(g);
      const widthValue = (_metrics$width = metrics === null || metrics === void 0 ? void 0 : metrics.width) !== null && _metrics$width !== void 0 ? _metrics$width : (_block$svg$viewBox = block.svg.viewBox) === null || _block$svg$viewBox === void 0 || (_block$svg$viewBox = _block$svg$viewBox.baseVal) === null || _block$svg$viewBox === void 0 ? void 0 : _block$svg$viewBox.width;
      const blockWidth = Number.isFinite(widthValue) && widthValue > 0 ? widthValue : VBW;
      offsetX += blockWidth;
    });
    offsetY += row.height;
  });
  const referenceHeight = ((_rowInfo$find = rowInfo.find(row => row.blocks.length)) === null || _rowInfo$find === void 0 ? void 0 : _rowInfo$find.height) || DEFAULT_SVG_HEIGHT;
  const totalValue = getCombinedTotal();
  let exportTopInner = exportHeight * TOP_RATIO;
  let exportBottomInner = exportHeight * BOTTOM_RATIO;
  if (verticalActive) {
    let minY = Infinity;
    let maxY = -Infinity;
    let offsetYForRows = 0;
    rowInfo.forEach((row, rowIndex) => {
      if (!row.blocks.length) return;
      if (rowIndex > 0) offsetYForRows += ROW_GAP;
      for (const { metrics } of row.blocks) {
        if (!metrics) continue;
        const outerTop = Number.isFinite(metrics.outerTop) ? metrics.outerTop : 0;
        const fallbackHeight = Number.isFinite(metrics.height) ? metrics.height : row.height || 0;
        const outerBottom = Number.isFinite(metrics.outerBottom) ? metrics.outerBottom : fallbackHeight;
        const start = offsetYForRows + outerTop;
        const end = offsetYForRows + outerBottom;
        if (start < minY) minY = start;
        if (end > maxY) maxY = end;
      }
      offsetYForRows += row.height;
    });
    if (Number.isFinite(minY)) exportTopInner = clamp(minY, 0, exportHeight);
    if (Number.isFinite(maxY)) exportBottomInner = clamp(maxY, exportTopInner, exportHeight);
  }
  if (CONFIG.showCombinedWhole && activeCount > 1) {
    const startX = labelSpace;
    const endX = labelSpace + figureWidth;
    const braceGroup = createSvgElement(exportSvg, 'g', {
      class: 'tb-combined-brace'
    });
    const braceY = BRACE_Y_RATIO * referenceHeight;
    const tick = BRACKET_TICK_RATIO * referenceHeight;
    drawBracketSquare(braceGroup, startX, endX, braceY, tick);
    const textSafeMargin = Math.max(referenceHeight * 0.02, 10);
    const totalText = createSvgElement(braceGroup, 'text', {
      x: (startX + endX) / 2,
      y: braceY - LABEL_OFFSET_RATIO * referenceHeight + textSafeMargin,
      class: 'tb-total',
      'text-anchor': 'middle'
    });
    totalText.textContent = Number.isFinite(totalValue) ? fmt(totalValue) : '';
  }
  if (verticalActive && activeCount > 1) {
    const braceGroup = createSvgElement(exportSvg, 'g', {
      class: 'tb-combined-brace'
    });
    const bracketX = labelSpace + figureWidth + verticalGap;
    const tick = Math.min(Math.max(figureWidth * BRACKET_TICK_RATIO, 12), Math.max(bracketX - labelSpace, 12));
    drawVerticalBracketSquare(braceGroup, exportTopInner, exportBottomInner, bracketX, tick);
    const verticalText = createSvgElement(braceGroup, 'text', {
      x: bracketX + verticalLabelSpace / 2,
      y: (exportTopInner + exportBottomInner) / 2,
      class: 'tb-total',
      'text-anchor': 'middle'
    });
    verticalText.setAttribute('dominant-baseline', 'middle');
    verticalText.textContent = Number.isFinite(totalValue) ? fmt(totalValue) : '';
  }
  return exportSvg;
}
