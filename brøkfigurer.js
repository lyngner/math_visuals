(function (_colorCountInp$value) {
  function svgToString(svgEl) {
    if (!svgEl) return '';
    const helper = typeof window !== 'undefined' ? window.MathVisSvgExport : null;
    const clone = helper && typeof helper.cloneSvgForExport === 'function' ? helper.cloneSvgForExport(svgEl) : svgEl.cloneNode(true);
    if (!clone) return '';
    const css = [...document.querySelectorAll('style')].map(s => s.textContent).join('\n');
    const style = document.createElement('style');
    style.textContent = css;
    const firstElement = clone.firstElementChild;
    if (
      firstElement &&
      typeof firstElement.tagName === 'string' &&
      firstElement.tagName.toLowerCase() === 'rect' &&
      firstElement.getAttribute('fill') === '#ffffff'
    ) {
      clone.insertBefore(style, firstElement.nextSibling);
    } else if (clone.firstChild) {
      clone.insertBefore(style, clone.firstChild);
    } else {
      clone.appendChild(style);
    }
    if (!clone.getAttribute('xmlns')) {
      clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
    }
    if (!clone.getAttribute('xmlns:xlink')) {
      clone.setAttribute('xmlns:xlink', 'http://www.w3.org/1999/xlink');
    }
    return '<?xml version="1.0" encoding="UTF-8"?>\n' + new XMLSerializer().serializeToString(clone);
  }
  function buildBrokfigurerExportMeta() {
    const helper = typeof window !== 'undefined' ? window.MathVisSvgExport : null;
    const summary = collectBrokfigurerAltSummary();
    const figureCount = summary && Number.isFinite(summary.figureCount) ? Math.max(0, summary.figureCount) : 0;
    const baseDescription = figureCount === 1 ? '1 figur' : `${figureCount} figurer`;
    const descriptionParts = [`Brøkfigurer med ${baseDescription}`];
    if (summary && Number.isFinite(summary.rows) && Number.isFinite(summary.cols)) {
      descriptionParts.push(`${summary.rows}×${summary.cols} rutenett`);
    }
    if (summary && Array.isArray(summary.figures) && summary.figures.length) {
      const shapeNames = Array.from(new Set(summary.figures.map(fig => fig.shape || 'figur')));
      descriptionParts.push(`former: ${shapeNames.join(', ')}`);
    }
    const description = `${descriptionParts.join(' – ')}.`;
    const slugParts = ['brokfigurer', `${figureCount}fig`];
    if (summary && Number.isFinite(summary.rows) && Number.isFinite(summary.cols)) {
      slugParts.push(`${summary.rows}x${summary.cols}`);
    }
    const slugBase = slugParts.join(' ');
    const slug = helper && typeof helper.slugify === 'function' ? helper.slugify(slugBase, 'brokfigurer') : slugParts.join('-').toLowerCase();
  return {
    description,
    slug,
    defaultBaseName: slug || 'brokfigurer',
    summary
  };
}
  function downloadSVG(svgEl, filename) {
    const suggestedName = typeof filename === 'string' && filename ? filename : 'brokfigurer.svg';
    const data = svgToString(svgEl);
    const helper = typeof window !== 'undefined' ? window.MathVisSvgExport : null;
    const meta = buildBrokfigurerExportMeta();
    if (helper && typeof helper.exportSvgWithArchive === 'function') {
      return helper.exportSvgWithArchive(svgEl, suggestedName, 'brokfigurer', {
        svgString: data,
        description: meta.description,
        slug: meta.slug,
        defaultBaseName: meta.defaultBaseName,
        summary: meta.summary
      });
    }
    return new Promise(resolve => {
      const blob = new Blob([data], {
        type: 'image/svg+xml;charset=utf-8'
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = suggestedName.endsWith('.svg') ? suggestedName : suggestedName + '.svg';
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => {
        URL.revokeObjectURL(url);
        resolve();
      }, 0);
    });
  }
  function downloadPNG(svgEl, filename, scale = 2, bg = '#fff') {
    var _svgEl$viewBox;
    return new Promise(resolve => {
      const vb = (_svgEl$viewBox = svgEl.viewBox) === null || _svgEl$viewBox === void 0 ? void 0 : _svgEl$viewBox.baseVal;
      const w = (vb === null || vb === void 0 ? void 0 : vb.width) || svgEl.clientWidth || 420;
      const h = (vb === null || vb === void 0 ? void 0 : vb.height) || svgEl.clientHeight || 420;
      const data = svgToString(svgEl);
      const blob = new Blob([data], {
        type: 'image/svg+xml;charset=utf-8'
      });
      const url = URL.createObjectURL(blob);
      const img = new Image();
      const cleanup = () => URL.revokeObjectURL(url);
      const setFallbackSrc = () => {
        const dataUrl = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(data);
        img.onerror = () => {
          console.error('Kunne ikke eksportere PNG');
          setTimeout(resolve, 0);
        };
        img.src = dataUrl;
      };
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const helper = typeof window !== 'undefined' ? window.MathVisSvgExport : null;
        const sizing = helper && typeof helper.ensureMinimumPngDimensions === 'function'
          ? helper.ensureMinimumPngDimensions({ width: w, height: h }, { scale })
          : (() => {
              const minDimension = 100;
              const baseScale = Number.isFinite(scale) && scale > 0 ? scale : 1;
              const safeWidth = Number.isFinite(w) && w > 0 ? w : minDimension;
              const safeHeight = Number.isFinite(h) && h > 0 ? h : minDimension;
              const scaledWidth = safeWidth * baseScale;
              const scaledHeight = safeHeight * baseScale;
              const scaleMultiplier = Math.max(
                1,
                scaledWidth > 0 ? minDimension / scaledWidth : 1,
                scaledHeight > 0 ? minDimension / scaledHeight : 1
              );
              const finalScale = baseScale * scaleMultiplier;
              return {
                width: Math.max(minDimension, Math.round(safeWidth * finalScale)),
                height: Math.max(minDimension, Math.round(safeHeight * finalScale))
              };
            })();
        canvas.width = sizing.width;
        canvas.height = sizing.height;
        const ctx = canvas.getContext('2d');
        ctx.fillStyle = bg;
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        cleanup();
        const handleBlob = blob => {
          const finish = () => setTimeout(resolve, 0);
          if (blob) {
            const urlPng = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = urlPng;
            a.download = filename.endsWith('.png') ? filename : filename + '.png';
            document.body.appendChild(a);
            a.click();
            a.remove();
            setTimeout(() => {
              URL.revokeObjectURL(urlPng);
              finish();
            }, 0);
          } else {
            try {
              const dataUrl = canvas.toDataURL('image/png');
              const a = document.createElement('a');
              a.href = dataUrl;
              a.download = filename.endsWith('.png') ? filename : filename + '.png';
              document.body.appendChild(a);
              a.click();
              a.remove();
              finish();
            } catch (error) {
              console.error('Kunne ikke eksportere PNG', error);
              finish();
            }
          }
        };
        if (typeof canvas.toBlob === 'function') {
          canvas.toBlob(blob => {
            handleBlob(blob);
          }, 'image/png');
        } else {
          handleBlob(null);
        }
      };
      img.onerror = () => {
        cleanup();
        setFallbackSrc();
      };
      img.src = url;
    });
  }
  const SVG_NS = 'http://www.w3.org/2000/svg';
  const figures = [];
  let altTextManager = null;
  const BOARD_MARGIN = 0.05;
  const BOARD_SIZE = 1 + BOARD_MARGIN * 2;
  const BOARD_BOUNDING_BOX = [-BOARD_MARGIN, 1 + BOARD_MARGIN, 1 + BOARD_MARGIN, -BOARD_MARGIN];
  const CLIP_PADDING_PERCENT = BOARD_MARGIN / BOARD_SIZE * 100;
  const CLIP_PAD_EXTRA_PERCENT = 2;
  const CLIP_PAD_PERCENT = CLIP_PADDING_PERCENT + CLIP_PAD_EXTRA_PERCENT;
  const CIRCLE_RADIUS = 0.45;
  const OUTLINE_STROKE_WIDTH = 6;
  const DIVISION_SEGMENT_EXTENSION = 0.01;
  const colorCountInp = document.getElementById('colorCount');
  const allowWrongInp = document.getElementById('allowWrong');
  const showDivisionLinesInp = document.getElementById('showDivisionLines');
  const showOutlineInp = document.getElementById('showOutline');
  const colorInputs = [];
  for (let i = 1;; i++) {
    const inp = document.getElementById('color_' + i);
    if (!inp) break;
    colorInputs.push(inp);
  }
  const LEGACY_COLOR_PALETTE = ['#B25FE3', '#6C1BA2', '#534477', '#873E79', '#BF4474', '#E31C3D'];
  function getThemeApi() {
    const theme = typeof window !== 'undefined' ? window.MathVisualsTheme : null;
    return theme && typeof theme === 'object' ? theme : null;
  }
  function applyThemeToDocument() {
    const theme = getThemeApi();
    if (theme && typeof theme.applyToDocument === 'function') {
      theme.applyToDocument(document);
    }
  }
  applyThemeToDocument();
  function getPaletteFromTheme(count) {
    const theme = getThemeApi();
    let palette = null;
    if (theme && typeof theme.getPalette === 'function') {
      palette = theme.getPalette('fractions', count, { fallbackKinds: ['figures'] });
    }
    const target = Number.isFinite(count) && count > 0 ? Math.trunc(count) : 0;
    const base = Array.isArray(palette) && palette.length ? palette.slice() : LEGACY_COLOR_PALETTE.slice();
    if (target <= 0) return base.slice();
    if (base.length >= target) return base.slice(0, target);
    const result = base.slice();
    for (let i = base.length; i < target; i++) {
      result.push(base[i % base.length]);
    }
    return result;
  }
  function getDefaultColorForIndex(index) {
    if (!Number.isFinite(index) || index < 0) return LEGACY_COLOR_PALETTE[0];
    const palette = getPaletteFromTheme(index + 1);
    if (Array.isArray(palette) && palette[index]) return palette[index];
    return LEGACY_COLOR_PALETTE[index % LEGACY_COLOR_PALETTE.length];
  }
  const boardEl = document.getElementById('figureBoard');
  const gridEl = document.getElementById('figureGrid');
  const addColumnBtn = document.getElementById('figAddColumn');
  const removeColumnBtn = document.getElementById('figRemoveColumn');
  const addRowBtn = document.getElementById('figAddRow');
  const removeRowBtn = document.getElementById('figRemoveRow');
  const settingsContainer = document.getElementById('figureSettings');
  const exportSvgBtn = document.getElementById('btnExportSvg');
  const exportPngBtn = document.getElementById('btnExportPng');
  const clampInt = (value, min, max) => {
    const num = parseInt(value, 10);
    const base = Number.isFinite(num) ? num : min;
    const clamped = Math.max(min, base);
    return max != null ? Math.min(clamped, max) : clamped;
  };
  const STATE = window.STATE && typeof window.STATE === 'object' ? window.STATE : {};
  window.STATE = STATE;
  const modifiedColorIndexes = new Set();
  if (typeof STATE.altText !== 'string') STATE.altText = '';
  if (STATE.altTextSource !== 'manual') STATE.altTextSource = 'auto';
  if (Array.isArray(STATE.colors)) {
    STATE.colors.forEach((color, idx) => {
      if (typeof color === 'string' && color) modifiedColorIndexes.add(idx);
    });
  }
  let autoPaletteEnabled = modifiedColorIndexes.size === 0;
  if (!STATE.figures || typeof STATE.figures !== 'object') STATE.figures = {};
  let allowWrongGlobal;
  if (typeof STATE.allowWrong === 'boolean') {
    allowWrongGlobal = STATE.allowWrong;
  } else {
    allowWrongGlobal = false;
    for (const key of Object.keys(STATE.figures)) {
      const figState = STATE.figures[key];
      if (figState && typeof figState === 'object' && typeof figState.allowWrong === 'boolean') {
        allowWrongGlobal = figState.allowWrong;
        break;
      }
    }
  }
  STATE.allowWrong = allowWrongGlobal;
  if (allowWrongInp) allowWrongInp.checked = allowWrongGlobal;
  let showDivisionLinesGlobal = typeof STATE.showDivisionLines === 'boolean' ? STATE.showDivisionLines : true;
  STATE.showDivisionLines = showDivisionLinesGlobal;
  if (showDivisionLinesInp) showDivisionLinesInp.checked = showDivisionLinesGlobal;
  let showOutlineGlobal = typeof STATE.showOutline === 'boolean' ? STATE.showOutline : true;
  STATE.showOutline = showOutlineGlobal;
  if (showOutlineInp) showOutlineInp.checked = showOutlineGlobal;
  const maxColors = colorInputs.length || 1;
  const defaultColorCount = clampInt((_colorCountInp$value = colorCountInp === null || colorCountInp === void 0 ? void 0 : colorCountInp.value) !== null && _colorCountInp$value !== void 0 ? _colorCountInp$value : 1, 1, maxColors);
  const stateColorCount = STATE.colorCount != null ? clampInt(STATE.colorCount, 1, maxColors) : null;
  let colorCount = stateColorCount || defaultColorCount;
  STATE.colorCount = colorCount;
  const MAX_ROWS = 3;
  const MAX_COLS = 3;
  const MIN_DIMENSION = 1;
  const figurePanels = new Map();
  const figureFieldsets = new Map();
  let activeFigureIds = [];
  let rows = clampInt(STATE.rows != null ? STATE.rows : 1, MIN_DIMENSION, MAX_ROWS);
  let cols = clampInt(STATE.cols != null ? STATE.cols : 1, MIN_DIMENSION, MAX_COLS);
  STATE.rows = rows;
  STATE.cols = cols;
  const FIGURE_MIN_SIZE = 160;
  const FIGURE_MAX_SIZE = 720;
  let pendingFigureSizeFrame = null;
  function updateFigureSize() {
    if (!gridEl) return;
    const rect = gridEl.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    const style = getComputedStyle(gridEl);
    let gap = parseFloat(style.gap);
    if (!Number.isFinite(gap)) {
      const colGap = parseFloat(style.columnGap);
      const rowGap = parseFloat(style.rowGap);
      gap = Number.isFinite(colGap) ? colGap : Number.isFinite(rowGap) ? rowGap : 0;
    }
    const horizontalGap = Math.max(0, cols - 1) * (Number.isFinite(gap) ? gap : 0);
    const verticalGap = Math.max(0, rows - 1) * (Number.isFinite(gap) ? gap : 0);
    const availableWidth = rect.width - horizontalGap;
    const availableHeight = rect.height - verticalGap;
    if (availableWidth <= 0 || availableHeight <= 0) return;
    const perFigureWidth = availableWidth / Math.max(cols, 1);
    const perFigureHeight = availableHeight / Math.max(rows, 1);
    const baseSize = Math.min(perFigureWidth, perFigureHeight);
    const size = Math.max(FIGURE_MIN_SIZE, Math.min(FIGURE_MAX_SIZE, baseSize));
    gridEl.style.setProperty('--figure-size', `${size}px`);
  }
  function scheduleFigureSizeUpdate() {
    if (pendingFigureSizeFrame != null) return;
    pendingFigureSizeFrame = requestAnimationFrame(() => {
      pendingFigureSizeFrame = null;
      updateFigureSize();
    });
  }
  if (typeof ResizeObserver === 'function') {
    const observer = new ResizeObserver(() => scheduleFigureSizeUpdate());
    if (boardEl) observer.observe(boardEl);
    if (gridEl) observer.observe(gridEl);
  }
  window.addEventListener('resize', scheduleFigureSizeUpdate);
  function ensureFigureState(id) {
    const existing = STATE.figures[id];
    const fig = existing && typeof existing === 'object' ? existing : {};
    const shapeEl = document.getElementById(`shape${id}`);
    const partsEl = document.getElementById(`parts${id}`);
    const divisionEl = document.getElementById(`division${id}`);
    if (shapeEl && fig.shape == null) fig.shape = shapeEl.value;
    if (partsEl && fig.parts == null) {
      const parsed = parseInt(partsEl.value, 10);
      fig.parts = Number.isFinite(parsed) && parsed > 0 ? parsed : 1;
    }
    if (divisionEl && fig.division == null) fig.division = divisionEl.value;
    if (typeof fig.allowDenominatorChange === 'string') {
      fig.allowDenominatorChange = fig.allowDenominatorChange === 'true';
    } else if (typeof fig.allowDenominatorChange !== 'boolean') {
      fig.allowDenominatorChange = false;
    }
    fig.allowWrong = allowWrongGlobal;
    STATE.figures[id] = fig;
    return fig;
  }
  const getActiveFigureIds = () => activeFigureIds.slice();
  if (allowWrongInp) {
    allowWrongInp.addEventListener('change', () => {
      allowWrongGlobal = !!allowWrongInp.checked;
      STATE.allowWrong = allowWrongGlobal;
      for (const id of getActiveFigureIds()) {
        const figState = ensureFigureState(id);
        figState.allowWrong = allowWrongGlobal;
      }
      renderAll();
    });
  }
  if (showDivisionLinesInp) {
    showDivisionLinesInp.addEventListener('change', () => {
      showDivisionLinesGlobal = !!showDivisionLinesInp.checked;
      STATE.showDivisionLines = showDivisionLinesGlobal;
      window.render();
    });
  }
  if (showOutlineInp) {
    showOutlineInp.addEventListener('change', () => {
      showOutlineGlobal = !!showOutlineInp.checked;
      STATE.showOutline = showOutlineGlobal;
      window.render();
    });
  }
  function ensureColorDefaults(count) {
    const required = Math.max(count, maxColors);
    const palette = getPaletteFromTheme(required);
    if (!Array.isArray(STATE.colors)) STATE.colors = [];
    if (autoPaletteEnabled) {
      STATE.colors = palette.slice(0, required);
    }
    for (let i = 0; i < required; i++) {
      const defaultColor = palette[i] || getDefaultColorForIndex(i);
      const hasColor = typeof STATE.colors[i] === 'string' && STATE.colors[i];
      const shouldUseDefault = autoPaletteEnabled || !modifiedColorIndexes.has(i);
      if (shouldUseDefault || !hasColor) {
        STATE.colors[i] = defaultColor;
      }
      if (typeof STATE.colors[i] !== 'string' || !STATE.colors[i]) {
        STATE.colors[i] = defaultColor || LEGACY_COLOR_PALETTE[i % LEGACY_COLOR_PALETTE.length];
      }
    }
    if (STATE.colors.length > required) STATE.colors.length = required;
  }
  function getColors() {
    ensureColorDefaults(colorCount);
    return STATE.colors.slice(0, colorCount);
  }
  function updateColorVisibility() {
    colorInputs.forEach((inp, idx) => {
      inp.style.display = idx < colorCount ? '' : 'none';
    });
  }
  colorCountInp === null || colorCountInp === void 0 || colorCountInp.addEventListener('input', () => {
    var _window$render, _window;
    const next = clampInt(colorCountInp.value, 1, maxColors);
    if (STATE.colorCount !== next) {
      STATE.colorCount = next;
    }
    colorCount = STATE.colorCount;
    ensureColorDefaults(colorCount);
    (_window$render = (_window = window).render) === null || _window$render === void 0 || _window$render.call(_window);
  });
  colorInputs.forEach((inp, idx) => inp.addEventListener('input', () => {
    var _window$render2, _window2;
    modifiedColorIndexes.add(idx);
    autoPaletteEnabled = modifiedColorIndexes.size === 0;
    ensureColorDefaults(Math.max(idx + 1, colorCount));
    if (!Array.isArray(STATE.colors)) STATE.colors = [];
    STATE.colors[idx] = inp.value;
    (_window$render2 = (_window2 = window).render) === null || _window$render2 === void 0 || _window$render2.call(_window2);
  }));
  function applyStateToControls() {
    allowWrongGlobal = !!STATE.allowWrong;
    STATE.allowWrong = allowWrongGlobal;
    if (allowWrongInp) allowWrongInp.checked = allowWrongGlobal;
    if (typeof STATE.showDivisionLines === 'boolean') {
      showDivisionLinesGlobal = STATE.showDivisionLines;
    } else {
      showDivisionLinesGlobal = true;
    }
    STATE.showDivisionLines = showDivisionLinesGlobal;
    if (showDivisionLinesInp) showDivisionLinesInp.checked = showDivisionLinesGlobal;
    if (typeof STATE.showOutline === 'boolean') {
      showOutlineGlobal = STATE.showOutline;
    } else {
      showOutlineGlobal = true;
    }
    STATE.showOutline = showOutlineGlobal;
    if (showOutlineInp) showOutlineInp.checked = showOutlineGlobal;
    colorCount = clampInt(STATE.colorCount, 1, maxColors);
    STATE.colorCount = colorCount;
    if (colorCountInp) colorCountInp.value = String(colorCount);
    ensureColorDefaults(colorCount);
    colorInputs.forEach((inp, idx) => {
      const color = STATE.colors[idx];
      if (typeof color === 'string') inp.value = color;
    });
    for (const id of getActiveFigureIds()) {
      const figState = ensureFigureState(id);
      figState.allowWrong = allowWrongGlobal;
      if (typeof figState.allowDenominatorChange !== 'boolean') {
        figState.allowDenominatorChange = false;
      }
      const allowDenominator = !!figState.allowDenominatorChange;
      const allowDenominatorInp = document.getElementById(`allowDenominator${id}`);
      if (allowDenominatorInp) allowDenominatorInp.checked = allowDenominator;
      const shapeSel = document.getElementById(`shape${id}`);
      if (shapeSel && figState.shape) {
        const options = Array.from(shapeSel.options || []);
        if (options.some(opt => opt.value === figState.shape)) shapeSel.value = figState.shape;else figState.shape = shapeSel.value;
      }
      const partsInp = document.getElementById(`parts${id}`);
      const partsVal = document.getElementById(`partsVal${id}`);
      const figureController = figures[id];
      if (figureController && typeof figureController.updateDenominatorControls === 'function') {
        figureController.updateDenominatorControls(allowDenominator);
      } else {
        if (partsInp) partsInp.disabled = !allowDenominator;
        const stepper = document.getElementById(`partsStepper${id}`);
        if (stepper) stepper.style.display = allowDenominator ? '' : 'none';
        const minusBtn = document.getElementById(`partsMinus${id}`);
        if (minusBtn) minusBtn.disabled = !allowDenominator;
        const plusBtn = document.getElementById(`partsPlus${id}`);
        if (plusBtn) plusBtn.disabled = !allowDenominator;
      }
      if (partsInp) {
        const parts = clampInt(figState.parts, 1);
        figState.parts = parts;
        partsInp.value = String(parts);
        if (partsVal) partsVal.textContent = String(parts);
      } else if (partsVal && figState.parts != null) {
        partsVal.textContent = String(figState.parts);
      }
      const divSel = document.getElementById(`division${id}`);
      if (divSel && figState.division) {
        const options = Array.from(divSel.options || []);
        if (options.some(opt => opt.value === figState.division)) divSel.value = figState.division;
      }
    }
  }
  function renderAll() {
    const desiredRows = clampInt(STATE.rows != null ? STATE.rows : MIN_DIMENSION, MIN_DIMENSION, MAX_ROWS);
    const desiredCols = clampInt(STATE.cols != null ? STATE.cols : MIN_DIMENSION, MIN_DIMENSION, MAX_COLS);
    let layoutChanged = false;
    if (desiredRows !== rows) {
      rows = desiredRows;
      layoutChanged = true;
    }
    if (desiredCols !== cols) {
      cols = desiredCols;
      layoutChanged = true;
    }
    STATE.rows = rows;
    STATE.cols = cols;
    if (layoutChanged) {
      rebuildLayout();
    }
    applyStateToControls();
    updateColorVisibility();
    for (const id of getActiveFigureIds()) {
      const fig = figures[id];
      if (fig && typeof fig.draw === 'function') fig.draw();
    }
    scheduleFigureSizeUpdate();
    refreshAltText('render');
  }
  function createFigurePanel(id) {
    const panel = document.createElement('div');
    panel.className = 'figurePanel';
    panel.id = `panel${id}`;
    panel.dataset.figureId = String(id);
    panel.innerHTML = `
      <div class="figure"><div id="box${id}" class="box"></div></div>
      <div class="stepper" id="partsStepper${id}" aria-label="Antall deler">
        <button id="partsMinus${id}" type="button" aria-label="Færre deler">−</button>
        <span id="partsVal${id}">4</span>
        <button id="partsPlus${id}" type="button" aria-label="Flere deler">+</button>
      </div>
    `;
    return panel;
  }
  function createFigureSettings(id) {
    const fieldset = document.createElement('fieldset');
    fieldset.id = `fieldset${id}`;
    fieldset.innerHTML = `
      <legend>Figur ${id}</legend>
      <label>Form
        <select id="shape${id}">
          <option value="circle">sirkel</option>
          <option value="rectangle" selected>rektangel</option>
          <option value="square">kvadrat</option>
          <option value="triangle">trekant</option>
        </select>
      </label>
      <label>Antall deler
        <input id="parts${id}" class="input--digit input--small" type="number" min="1" value="4" />
      </label>
      <div class="checkbox-row">
        <input id="allowDenominator${id}" type="checkbox" />
        <label for="allowDenominator${id}">Endre nevner</label>
      </div>
      <label>Delt
        <select id="division${id}">
          <option value="horizontal">horisontalt</option>
          <option value="vertical">vertikalt</option>
          <option value="diagonal">diagonalt</option>
          <option value="grid">horisontalt og vertikalt</option>
          <option value="triangular">trekantsrutenett</option>
        </select>
      </label>
    `;
    return fieldset;
  }
  function updateLayoutControls() {
    if (gridEl) {
      gridEl.dataset.cols = String(cols);
      gridEl.style.setProperty('--figure-cols', String(cols));
      gridEl.dataset.rows = String(rows);
      gridEl.style.setProperty('--figure-rows', String(rows));
    }
    if (addRowBtn) addRowBtn.style.display = rows >= MAX_ROWS ? 'none' : '';
    if (removeRowBtn) removeRowBtn.style.display = rows <= MIN_DIMENSION ? 'none' : '';
    if (addColumnBtn) addColumnBtn.style.display = cols >= MAX_COLS ? 'none' : '';
    if (removeColumnBtn) removeColumnBtn.style.display = cols <= MIN_DIMENSION ? 'none' : '';
    scheduleFigureSizeUpdate();
  }
  function rebuildLayout() {
    const total = Math.max(MIN_DIMENSION, Math.min(rows * cols, MAX_ROWS * MAX_COLS));
    const ids = [];
    if (gridEl) {
      gridEl.innerHTML = '';
      for (let id = 1; id <= total; id++) {
        ids.push(id);
        let panel = figurePanels.get(id);
        if (!panel) {
          panel = createFigurePanel(id);
          figurePanels.set(id, panel);
        }
        gridEl.appendChild(panel);
        ensureFigureState(id);
      }
    } else {
      for (let id = 1; id <= total; id++) {
        ids.push(id);
        ensureFigureState(id);
      }
    }
    if (settingsContainer) {
      settingsContainer.innerHTML = '';
      for (const id of ids) {
        let fieldset = figureFieldsets.get(id);
        if (!fieldset) {
          fieldset = createFigureSettings(id);
          figureFieldsets.set(id, fieldset);
        }
        const legend = fieldset.querySelector('legend');
        if (legend) legend.textContent = `Figur ${id}`;
        settingsContainer.appendChild(fieldset);
      }
      settingsContainer.style.setProperty('--figure-settings-cols', String(cols));
      settingsContainer.style.setProperty('--figure-settings-rows', String(rows));
      settingsContainer.dataset.cols = String(cols);
      settingsContainer.dataset.rows = String(rows);
    }
    activeFigureIds = ids;
    updateLayoutControls();
    for (const id of ids) {
      if (!figures[id]) {
        figures[id] = setupFigure(id);
      }
    }
  }
  function joinWithOg(items) {
    if (!Array.isArray(items)) return '';
    const filtered = items.filter(item => typeof item === 'string' && item);
    const count = filtered.length;
    if (count === 0) return '';
    if (count === 1) return filtered[0];
    if (count === 2) return `${filtered[0]} og ${filtered[1]}`;
    return `${filtered.slice(0, -1).join(', ')} og ${filtered[count - 1]}`;
  }
  function formatCount(value, singular, plural) {
    const num = Number.isFinite(value) ? Math.round(value) : 0;
    const abs = Math.abs(num);
    const word = abs === 1 ? singular : plural || `${singular}er`;
    return `${num} ${word}`;
  }
  function getShapeInfo(shape) {
    switch (shape) {
      case 'circle':
        return { article: 'en', noun: 'sirkel' };
      case 'rectangle':
        return { article: 'et', noun: 'rektangel' };
      case 'square':
        return { article: 'et', noun: 'kvadrat' };
      case 'triangle':
        return { article: 'en', noun: 'trekant' };
      default:
        return { article: 'en', noun: 'figur' };
    }
  }
  function computeGridDimensionsForParts(parts) {
    const n = Math.max(1, Math.round(Number(parts) || 0));
    let cols = Math.max(1, Math.floor(Math.sqrt(n)));
    while (cols > 1 && n % cols !== 0) cols--;
    if (cols <= 0) cols = 1;
    const rowsCount = Math.max(1, Math.round(n / cols));
    return { rows: rowsCount, cols };
  }
  function describeDivision(fig) {
    const totalText = formatCount(fig.parts, 'del', 'deler');
    switch (fig.division) {
      case 'horizontal':
        return `delt horisontalt i ${totalText}`;
      case 'vertical':
        return `delt vertikalt i ${totalText}`;
      case 'diagonal':
        return `delt diagonalt i ${totalText}`;
      case 'grid': {
        if (fig.gridRows && fig.gridCols) {
          const gridText = joinWithOg([
            formatCount(fig.gridRows, 'rad', 'rader'),
            formatCount(fig.gridCols, 'kolonne', 'kolonner')
          ]);
          if (gridText) {
            return `delt i et rutenett med ${gridText} (${totalText} totalt)`;
          }
        }
        return `delt i et rutenett med ${totalText}`;
      }
      case 'triangular': {
        if (fig.triangularSize) {
          return `delt i et trekantsrutenett på ${formatCount(fig.triangularSize, 'rad', 'rader')} (${totalText} totalt)`;
        }
        return `delt i et trekantsrutenett med ${totalText}`;
      }
      default:
        return `delt i ${totalText}`;
    }
  }
  function describeFillUsage(fig) {
    const counts = Array.isArray(fig.colorCounts) ? fig.colorCounts : [];
    const parts = [];
    counts.forEach((count, idx) => {
      if (!Number.isFinite(count) || count <= 0) return;
      parts.push(`${formatCount(count, 'del', 'deler')} i farge ${idx + 1}`);
    });
    if (Number.isFinite(fig.emptyCount) && fig.emptyCount > 0) {
      parts.push(`${formatCount(fig.emptyCount, 'del', 'deler')} uten farge`);
    }
    if (parts.length === 0) {
      return 'Ingen deler er fylt.';
    }
    return `Fordeling: ${joinWithOg(parts)}.`;
  }
  function collectBrokfigurerAltSummary() {
    const ids = getActiveFigureIds();
    const figureIds = Array.isArray(ids) ? ids : [];
    const summary = {
      rows,
      cols,
      figureCount: figureIds.length,
      figures: []
    };
    if (figureIds.length === 0) return summary;
    const paletteLength = getColors().length;
    figureIds.forEach((id, index) => {
      const figState = ensureFigureState(id);
      const shape = typeof (figState == null ? void 0 : figState.shape) === 'string' ? figState.shape : 'rectangle';
      const division = typeof (figState == null ? void 0 : figState.division) === 'string' ? figState.division : 'horizontal';
      const parts = clampInt(figState == null ? void 0 : figState.parts, 1);
      const entries = Array.isArray(figState == null ? void 0 : figState.filled) ? figState.filled : [];
      const colorCounts = [];
      const seenParts = new Set();
      let filledTotal = 0;
      entries.forEach(entry => {
        if (!entry || entry.length < 2) return;
        const partIndex = Number(entry[0]);
        if (Number.isFinite(partIndex)) {
          if (seenParts.has(partIndex)) return;
          seenParts.add(partIndex);
        }
        const colorIndex = Number(entry[1]);
        if (!Number.isFinite(colorIndex) || colorIndex <= 0) return;
        const idx = Math.max(0, Math.floor(colorIndex - 1));
        while (colorCounts.length <= idx) colorCounts.push(0);
        colorCounts[idx] += 1;
        filledTotal += 1;
      });
      if (paletteLength > colorCounts.length) {
        for (let i = colorCounts.length; i < paletteLength; i++) {
          colorCounts[i] = 0;
        }
      } else {
        for (let i = 0; i < colorCounts.length; i++) {
          if (!Number.isFinite(colorCounts[i]) || colorCounts[i] < 0) colorCounts[i] = 0;
        }
      }
      const emptyCount = Math.max(0, parts - filledTotal);
      let gridRows = null;
      let gridCols = null;
      let triangularSize = null;
      if (division === 'grid') {
        const dims = computeGridDimensionsForParts(parts);
        gridRows = dims.rows;
        gridCols = dims.cols;
      } else if (division === 'triangular') {
        triangularSize = Math.max(1, Math.round(Math.sqrt(Math.max(1, parts))));
      }
      summary.figures.push({
        id,
        index: index + 1,
        shape,
        division,
        parts,
        colorCounts,
        emptyCount,
        gridRows,
        gridCols,
        triangularSize
      });
    });
    return summary;
  }
  function describeFigureSummary(fig) {
    const shapeInfo = getShapeInfo(fig.shape);
    const base = `Figur ${fig.index} er ${shapeInfo.article} ${shapeInfo.noun} ${describeDivision(fig)}.`;
    const fill = describeFillUsage(fig);
    return fill ? `${base} ${fill}` : base;
  }
  function buildBrokfigurerAltText(summary) {
    const data = summary || collectBrokfigurerAltSummary();
    if (!data) return 'Brøkfigurer.';
    const sentences = [];
    if (data.figureCount > 0) {
      const layout = joinWithOg([
        formatCount(data.rows, 'rad', 'rader'),
        formatCount(data.cols, 'kolonne', 'kolonner')
      ]);
      const figureText = data.figureCount === 1 ? 'én figur' : `${data.figureCount} figurer`;
      if (layout) {
        sentences.push(`Oppsettet viser ${figureText} fordelt på ${layout}.`);
      } else {
        sentences.push(`Oppsettet viser ${figureText}.`);
      }
    } else {
      sentences.push('Oppsettet viser ingen figurer.');
    }
    if (Array.isArray(data.figures)) {
      data.figures.forEach(fig => {
        sentences.push(describeFigureSummary(fig));
      });
    }
    return sentences.filter(Boolean).join(' ');
  }
  function getBrokfigurerAltTitle() {
    const summary = collectBrokfigurerAltSummary();
    if (!summary) return 'Brøkfigurer';
    return summary.figureCount === 1 ? 'Brøkfigur' : 'Brøkfigurer';
  }
  function ensureAltTextAnchor() {
    if (typeof document === 'undefined') return null;
    let anchor = document.getElementById('brokfigurer-alt-anchor');
    if (!anchor) {
      anchor = document.createElementNS(SVG_NS, 'svg');
      anchor.setAttribute('id', 'brokfigurer-alt-anchor');
      anchor.setAttribute('width', '0');
      anchor.setAttribute('height', '0');
      anchor.setAttribute('aria-hidden', 'true');
      anchor.style.position = 'absolute';
      anchor.style.width = '0';
      anchor.style.height = '0';
      anchor.style.overflow = 'hidden';
      anchor.style.left = '-9999px';
      if (document.body) {
        document.body.appendChild(anchor);
      }
    }
    return anchor;
  }
  function updateAltTextTargetAttributes() {
    if (typeof document === 'undefined' || !window.MathVisAltText) return;
    const board = document.getElementById('figureBoard');
    const anchor = document.getElementById('brokfigurer-alt-anchor');
    if (!board || !anchor) return;
    const nodes = window.MathVisAltText.ensureSvgA11yNodes(anchor);
    board.setAttribute('role', 'img');
    board.setAttribute('aria-label', getBrokfigurerAltTitle());
    if (nodes.titleEl && nodes.titleEl.id) {
      board.setAttribute('aria-labelledby', nodes.titleEl.id);
    }
    if (nodes.descEl && nodes.descEl.id) {
      board.setAttribute('aria-describedby', nodes.descEl.id);
    }
  }
  function refreshAltText(reason) {
    const signature = buildBrokfigurerAltText();
    if (altTextManager && typeof altTextManager.refresh === 'function') {
      altTextManager.refresh(reason || 'auto', signature);
    }
    updateAltTextTargetAttributes();
  }
  function initAltTextManager() {
    if (typeof window === 'undefined' || !window.MathVisAltText) return;
    if (altTextManager) {
      updateAltTextTargetAttributes();
      return;
    }
    const container = document.getElementById('exportCard');
    if (!container) return;
    const anchor = ensureAltTextAnchor();
    if (!anchor) return;
    altTextManager = window.MathVisAltText.create({
      svg: () => anchor,
      container,
      getTitle: getBrokfigurerAltTitle,
      getState: () => ({
        text: typeof STATE.altText === 'string' ? STATE.altText : '',
        source: STATE.altTextSource === 'manual' ? 'manual' : 'auto'
      }),
      setState: (text, source) => {
        STATE.altText = text;
        STATE.altTextSource = source === 'manual' ? 'manual' : 'auto';
      },
      generate: () => buildBrokfigurerAltText(),
      getSignature: () => buildBrokfigurerAltText(),
      getAutoMessage: reason => reason && reason.startsWith('manual') ? 'Alternativ tekst oppdatert.' : 'Alternativ tekst oppdatert automatisk.',
      getManualMessage: () => 'Alternativ tekst oppdatert manuelt.'
    });
    updateAltTextTargetAttributes();
  }
  window.render = renderAll;
  function setupFigure(id) {
    const shapeSel = document.getElementById(`shape${id}`);
    const partsInp = document.getElementById(`parts${id}`);
    const divSel = document.getElementById(`division${id}`);
    const minusBtn = document.getElementById(`partsMinus${id}`);
    const plusBtn = document.getElementById(`partsPlus${id}`);
    const partsVal = document.getElementById(`partsVal${id}`);
    const allowDenominatorInp = document.getElementById(`allowDenominator${id}`);
    const stepperEl = document.getElementById(`partsStepper${id}`);
    const panel = document.getElementById(`panel${id}`);
    let board;
    const divisionSegmentIds = new Set();
    const divisionSegmentNodes = new Set();
    let filled = new Map();
    let suppressToggle = false;
    let suppressToggleResetTimer = null;
    let detachDivisionGuard = null;
    function updateDenominatorControls(override, figStateOverride) {
      const figState = figStateOverride || ensureFigureState(id);
      let enabled;
      if (typeof override === 'boolean') {
        enabled = override;
      } else if (typeof figState.allowDenominatorChange === 'boolean') {
        enabled = figState.allowDenominatorChange;
      } else if (typeof figState.allowDenominatorChange === 'string') {
        enabled = figState.allowDenominatorChange === 'true';
      } else {
        enabled = false;
      }
      if (figState.allowDenominatorChange !== enabled) {
        figState.allowDenominatorChange = enabled;
      }
      if (allowDenominatorInp && allowDenominatorInp.checked !== enabled) {
        allowDenominatorInp.checked = enabled;
      }
      if (partsInp) {
        partsInp.disabled = !enabled;
      }
      if (minusBtn) minusBtn.disabled = !enabled;
      if (plusBtn) plusBtn.disabled = !enabled;
      if (stepperEl) {
        stepperEl.style.display = enabled ? '' : 'none';
        if (enabled) {
          stepperEl.removeAttribute('aria-hidden');
        } else {
          stepperEl.setAttribute('aria-hidden', 'true');
        }
      }
      return enabled;
    }
    function normalizeFilledEntries(value) {
      let iterable;
      if (value instanceof Map) {
        iterable = value.entries();
      } else if (Array.isArray(value)) {
        iterable = value;
      } else if (value && typeof value[Symbol.iterator] === 'function') {
        iterable = value;
      } else if (value && typeof value === 'object') {
        iterable = Object.entries(value);
      } else {
        iterable = [];
      }
      const normalized = new Map();
      for (const entry of iterable) {
        if (entry == null) continue;
        let pair;
        if (Array.isArray(entry)) pair = entry;else {
          try {
            pair = Array.from(entry);
          } catch (_) {
            continue;
          }
        }
        if (!Array.isArray(pair) || pair.length < 2) continue;
        const partIndex = Number.parseInt(pair[0], 10);
        const colorIndex = Number.parseInt(pair[1], 10);
        if (!Number.isFinite(partIndex) || partIndex < 0) continue;
        if (!Number.isFinite(colorIndex) || colorIndex <= 0) continue;
        normalized.set(partIndex, colorIndex);
      }
      return Array.from(normalized.entries()).sort((a, b) => a[0] - b[0]);
    }
    function syncFilledState(entriesOverride, skipMapUpdate) {
      const figState = ensureFigureState(id);
      const entries = Array.isArray(entriesOverride) ? entriesOverride.slice() : Array.from(filled.entries());
      entries.sort((a, b) => a[0] - b[0]);
      if (!skipMapUpdate) {
        filled = new Map(entries);
      }
      figState.filled = entries;
    }
    function initBoard() {
      if (board) JXG.JSXGraph.freeBoard(board);
      board = JXG.JSXGraph.initBoard(`box${id}`, {
        boundingbox: BOARD_BOUNDING_BOX,
        axis: false,
        showCopyright: false,
        showNavigation: false,
        keepaspectratio: true
      });
    }
    function disableHitDetection(element) {
      if (element && typeof element.hasPoint === 'function') {
        element.hasPoint = () => false;
      }
    }
    const getEventPoint = evt => {
      if (!evt) return null;
      if (typeof evt.clientX === 'number' && typeof evt.clientY === 'number') {
        return {
          x: evt.clientX,
          y: evt.clientY
        };
      }
      const touch = evt.touches && evt.touches[0] || evt.changedTouches && evt.changedTouches[0];
      if (touch && typeof touch.clientX === 'number' && typeof touch.clientY === 'number') {
        return {
          x: touch.clientX,
          y: touch.clientY
        };
      }
      if (evt.evt) return getEventPoint(evt.evt);
      return null;
    };
    const hasPointerEvents = el => {
      if (!el) return false;
      const inline = el.style && typeof el.style.pointerEvents === 'string' ? el.style.pointerEvents.trim().toLowerCase() : '';
      if (inline === 'none') return false;
      if (inline) return true;
      if (typeof window !== 'undefined' && typeof window.getComputedStyle === 'function' && el.nodeType === 1) {
        const computed = window.getComputedStyle(el);
        const computedValue = computed && typeof computed.pointerEvents === 'string' ? computed.pointerEvents.trim().toLowerCase() : '';
        if (computedValue === 'none') return false;
        if (computedValue) return true;
      }
      return true;
    };
    const isDivisionStrokeElement = el => {
      if (!el) return false;
      if (typeof Element !== 'undefined' && !(el instanceof Element)) return false;
      if (!hasPointerEvents(el)) return false;
      if (divisionSegmentNodes.has(el)) return true;
      if (el.getAttribute && el.getAttribute('data-division-segment') === 'true') return true;
      if (el.classList && el.classList.contains('brok-division-segment')) return true;
      if (typeof el.getAttribute === 'function') {
        const dashAttr = el.getAttribute('stroke-dasharray');
        if (dashAttr && dashAttr !== 'none') return true;
      }
      if (el.style && typeof el.style.strokeDasharray === 'string' && el.style.strokeDasharray && el.style.strokeDasharray !== 'none') {
        return true;
      }
      if (typeof window !== 'undefined' && typeof window.getComputedStyle === 'function') {
        const computed = el.nodeType === 1 ? window.getComputedStyle(el) : null;
        if (computed && typeof computed.strokeDasharray === 'string' && computed.strokeDasharray && computed.strokeDasharray !== 'none') {
          return true;
        }
      }
      return false;
    };
    const findDivisionStroke = element => {
      let current = element;
      while (current) {
        if (isDivisionStrokeElement(current)) return current;
        current = current.parentNode;
      }
      return null;
    };
    const DIVISION_STROKE_HIT_PADDING = 2;
    function getDivisionStrokeAtPoint(point) {
      if (!point || !panel) return null;
      const box = panel.querySelector('.box');
      if (!box) return null;
      const rect = box.getBoundingClientRect();
      if (point.x < rect.left || point.x > rect.right || point.y < rect.top || point.y > rect.bottom) return null;
      if (typeof document !== 'undefined') {
        if (typeof document.elementsFromPoint === 'function') {
          const elements = document.elementsFromPoint(point.x, point.y) || [];
          for (const el of elements) {
            const stroke = findDivisionStroke(el);
            if (stroke) return stroke;
          }
        }
        const target = document.elementFromPoint(point.x, point.y);
        const stroke = findDivisionStroke(target);
        if (stroke) return stroke;
      }
      for (const node of divisionSegmentNodes) {
        if (!node) continue;
        if (typeof node.isConnected === 'boolean' && !node.isConnected) continue;
        if (typeof node.getBoundingClientRect !== 'function') continue;
        if (!hasPointerEvents(node)) continue;
        const nodeRect = node.getBoundingClientRect();
        const pad = DIVISION_STROKE_HIT_PADDING;
        if (
          point.x >= nodeRect.left - pad &&
          point.x <= nodeRect.right + pad &&
          point.y >= nodeRect.top - pad &&
          point.y <= nodeRect.bottom + pad
        ) {
          return node;
        }
      }
      return null;
    }
    function preventDivisionClick(element) {
      if (!element) return;
      const nodes = [];
      if (element.rendNode) nodes.push(element.rendNode);
      if (element.rendNodeFront && element.rendNodeFront !== element.rendNode) nodes.push(element.rendNodeFront);
      for (const node of nodes) {
        if (!node) continue;
        if (node.style) {
          node.style.pointerEvents = 'none';
          if (!node.style.cursor) node.style.cursor = 'default';
        }
      }
    }
    const clonePoint = point => {
      if (Array.isArray(point)) return point.slice();
      if (point && typeof point === 'object') {
        if (typeof point.X === 'function' && typeof point.Y === 'function') {
          const x = Number(point.X());
          const y = Number(point.Y());
          if (Number.isFinite(x) && Number.isFinite(y)) return [x, y];
        }
        const usrCoords = point.coords && point.coords.usrCoords;
        if (usrCoords && usrCoords.length >= 3) {
          const w = Number(usrCoords[0]);
          const x = Number(usrCoords[1]);
          const y = Number(usrCoords[2]);
          if (Number.isFinite(x) && Number.isFinite(y)) {
            if (Number.isFinite(w) && w !== 0) {
              return [x / w, y / w];
            }
            return [x, y];
          }
        }
      }
      return [Number(point == null ? void 0 : point[0]) || 0, Number(point == null ? void 0 : point[1]) || 0];
    };
    function ensureDivisionGuard() {
      if (detachDivisionGuard || !panel) return;
      const box = panel.querySelector('.box');
      if (!box) return;
      if (typeof window !== 'undefined') window.__guardInitCount = (window.__guardInitCount || 0) + 1;
      const downHandler = evt => {
        const point = getEventPoint(evt);
        if (!point) return;
        const strokeEl = getDivisionStrokeAtPoint(point);
        if (strokeEl) {
          if (suppressToggleResetTimer != null) {
            clearTimeout(suppressToggleResetTimer);
            suppressToggleResetTimer = null;
          }
          suppressToggle = true;
        }
      };
      const upHandler = () => {
        if (suppressToggleResetTimer != null) clearTimeout(suppressToggleResetTimer);
        suppressToggleResetTimer = setTimeout(() => {
          suppressToggle = false;
          suppressToggleResetTimer = null;
        }, 0);
      };
      const docDownHandler = evt => {
        if (!evt) return;
        const point = getEventPoint(evt);
        const strokeEl = getDivisionStrokeAtPoint(point);
        if (!strokeEl) return;
        if (suppressToggleResetTimer != null) {
          clearTimeout(suppressToggleResetTimer);
          suppressToggleResetTimer = null;
        }
        suppressToggle = true;
      };
      const docUpHandler = evt => {
        if (!evt) return;
        if (suppressToggleResetTimer != null) clearTimeout(suppressToggleResetTimer);
        suppressToggleResetTimer = setTimeout(() => {
          suppressToggle = false;
          suppressToggleResetTimer = null;
        }, 0);
      };
      const listeners = [[
        'pointerdown',
        downHandler
      ], [
        'mousedown',
        downHandler
      ], [
        'touchstart',
        downHandler
      ], [
        'pointerup',
        upHandler
      ], [
        'mouseup',
        upHandler
      ], [
        'touchend',
        upHandler
      ], [
        'click',
        upHandler
      ]];
      const docListeners = [[
        'pointerdown',
        docDownHandler
      ], [
        'mousedown',
        docDownHandler
      ], [
        'touchstart',
        docDownHandler
      ], [
        'pointerup',
        docUpHandler
      ], [
        'mouseup',
        docUpHandler
      ], [
        'touchend',
        docUpHandler
      ]];
      const winListeners = docListeners;
      for (const [type, handler] of listeners) {
        box.addEventListener(type, handler, true);
      }
      for (const [type, handler] of docListeners) {
        document.addEventListener(type, handler, true);
      }
      for (const [type, handler] of winListeners) {
        window.addEventListener(type, handler, true);
      }
      detachDivisionGuard = () => {
        for (const [type, handler] of listeners) {
          box.removeEventListener(type, handler, true);
        }
        for (const [type, handler] of docListeners) {
          document.removeEventListener(type, handler, true);
        }
        for (const [type, handler] of winListeners) {
          window.removeEventListener(type, handler, true);
        }
        detachDivisionGuard = null;
      };
    }
    function extendSegmentEndpoints(start, end, extension = DIVISION_SEGMENT_EXTENSION) {
      const p1 = clonePoint(start);
      const p2 = clonePoint(end);
      if (!Number.isFinite(extension) || extension <= 0) return [p1, p2];
      const dx = p2[0] - p1[0];
      const dy = p2[1] - p1[1];
      const length = Math.hypot(dx, dy);
      if (!(length > 0)) return [p1, p2];
      const ux = dx / length;
      const uy = dy / length;
      return [[p1[0] - ux * extension, p1[1] - uy * extension], [p2[0] + ux * extension, p2[1] + uy * extension]];
    }
    function markDivisionNode(node) {
      if (!node) return;
      const fillAttr = typeof node.getAttribute === 'function' ? node.getAttribute('fill') : null;
      const fillOpacityAttr = typeof node.getAttribute === 'function' ? node.getAttribute('fill-opacity') : null;
      const inlineFill = node.style && typeof node.style.fill === 'string' ? node.style.fill.trim().toLowerCase() : '';
      const inlineOpacity = node.style && typeof node.style.fillOpacity === 'string' ? node.style.fillOpacity.trim() : '';
      const effectiveFill = (typeof fillAttr === 'string' && fillAttr.trim().toLowerCase()) || inlineFill;
      const hasColor = effectiveFill && effectiveFill !== 'none' && effectiveFill !== 'transparent';
      const parseOpacity = value => {
        if (typeof value !== 'string' || value === '') return NaN;
        const num = Number(value);
        return Number.isFinite(num) ? num : NaN;
      };
      const fillOpacity = parseOpacity(fillOpacityAttr);
      const styleOpacity = parseOpacity(inlineOpacity);
      const opacityValue = Number.isFinite(styleOpacity) ? styleOpacity : fillOpacity;
      const hasVisibleOpacity = Number.isFinite(opacityValue) ? opacityValue > 0 : true;
      const isFilled = hasColor && hasVisibleOpacity;
      if (isFilled) {
        return;
      }
      if (node.classList) node.classList.add('brok-division-segment');
      if (typeof node.setAttribute === 'function') node.setAttribute('data-division-segment', 'true');
      if (node.id) divisionSegmentIds.add(node.id);
      divisionSegmentNodes.add(node);
      if (node.style) {
        node.style.pointerEvents = 'none';
        if (!node.style.cursor) node.style.cursor = 'default';
      }
    }
    function markPolygonBorders(polygon) {
      if (!polygon || !Array.isArray(polygon.borders)) return;
      for (const border of polygon.borders) {
        if (!border) continue;
        const nodes = [border.rendNode, border.rendNodeFront && border.rendNodeFront !== border.rendNode ? border.rendNodeFront : null];
        for (const node of nodes) {
          if (!node) continue;
          node.setAttribute('stroke-linecap', 'butt');
          node.setAttribute('stroke-linejoin', 'miter');
          markDivisionNode(node);
        }
      }
    }
    function createDivisionSegment(start, end, options = {}, extend = true) {
      if (!showDivisionLinesGlobal) return null;
      const [p1, p2] = extend ? extendSegmentEndpoints(start, end) : [clonePoint(start), clonePoint(end)];
      const seg = board.create('segment', [p1, p2], Object.assign({
        strokeColor: '#000',
        strokeWidth: 2,
        dash: 2,
        highlight: false,
        highlightStrokeColor: '#000',
        highlightStrokeOpacity: 1,
        highlightStrokeWidth: 2,
        fixed: true,
        linecap: 'butt',
        layer: 10
      }, options));
      preventDivisionClick(seg);
      disableHitDetection(seg);
      if (typeof seg.on === 'function') {
        seg.on('down', evt => {
          if (evt && typeof evt.stopPropagation === 'function') evt.stopPropagation();
          if (evt && typeof evt.preventDefault === 'function') evt.preventDefault();
          return false;
        });
      }
      markDivisionNode(seg == null ? void 0 : seg.rendNode);
      if (seg != null && seg.rendNodeFront && seg.rendNodeFront !== seg.rendNode) markDivisionNode(seg.rendNodeFront);
      return seg;
    }
    const DOM_TOGGLE_EVENTS = typeof window !== 'undefined' && 'PointerEvent' in window ? ['pointerdown'] : ['mousedown', 'touchstart'];
    function attachToggleHandler(element, partIndex) {
      if (!element) return;
      const handler = evt => togglePart(partIndex, element, evt);
      const domHandler = evt => {
        handler(evt);
      };
      const nodes = [];
      if (element.rendNode) nodes.push(element.rendNode);
      if (element.rendNodeFront && element.rendNodeFront !== element.rendNode) nodes.push(element.rendNodeFront);
      for (const node of nodes) {
        if (!node) continue;
        if (node.style) {
          if (!node.style.pointerEvents || node.style.pointerEvents === 'none') {
            node.style.pointerEvents = 'auto';
          }
          if (!node.style.cursor || node.style.cursor === 'default') {
            node.style.cursor = 'pointer';
          }
        }
        for (const type of DOM_TOGGLE_EVENTS) {
          node.addEventListener(type, domHandler, true);
        }
      }
    }
    function togglePart(i, element, evt) {
      const evtTarget = evt == null ? void 0 : evt.target;
      const targetId = typeof evtTarget === 'string' ? evtTarget : evtTarget && typeof evtTarget.id === 'string' ? evtTarget.id : null;
      if (targetId && divisionSegmentIds.has(targetId)) {
        suppressToggle = false;
        return;
      }
      const point = getEventPoint(evt);
      if (point && getDivisionStrokeAtPoint(point)) {
        suppressToggle = false;
        return;
      }
      if (suppressToggle) {
        suppressToggle = false;
        return;
      }
      const colors = getColors();
      const current = filled.get(i) || 0;
      const next = (current + 1) % (colors.length + 1);
      if (next === 0) {
        filled.delete(i);
        element.setAttribute({
          fillColor: '#fff',
          fillOpacity: 1
        });
      } else {
        filled.set(i, next);
        element.setAttribute({
          fillColor: colors[next - 1],
          fillOpacity: 1
        });
      }
      board.update();
      syncFilledState();
      refreshAltText('fill-change');
    }
    function gridDims(n) {
      let cols = Math.floor(Math.sqrt(n));
      while (n % cols !== 0) cols--;
      const rows = n / cols;
      return {
        rows,
        cols
      };
    }
    function hasProperFactor(n) {
      if (n < 4) return false;
      for (let i = 2; i * i <= n; i++) {
        if (n % i === 0) return true;
      }
      return false;
    }
    function draw() {
      var _ref, _partsInp$value;
      if (!panel || !panel.isConnected || panel.style.display === 'none') return;
      const figState = ensureFigureState(id);
      updateDenominatorControls(figState.allowDenominatorChange, figState);
      setFilled(figState.filled);
      initBoard();
      divisionSegmentIds.clear();
      divisionSegmentNodes.clear();
      ensureDivisionGuard();
      let n = clampInt((_ref = (_partsInp$value = partsInp === null || partsInp === void 0 ? void 0 : partsInp.value) !== null && _partsInp$value !== void 0 ? _partsInp$value : figState.parts) !== null && _ref !== void 0 ? _ref : 1, 1);
      const shape = (shapeSel === null || shapeSel === void 0 ? void 0 : shapeSel.value) || figState.shape || 'rectangle';
      let division = (divSel === null || divSel === void 0 ? void 0 : divSel.value) || figState.division || 'horizontal';
      const allowWrong = allowWrongGlobal;
      if ((shape === 'rectangle' || shape === 'square') && division === 'diagonal') n = 4;
      const gridOpt = divSel === null || divSel === void 0 ? void 0 : divSel.querySelector('option[value="grid"]');
      const vertOpt = divSel === null || divSel === void 0 ? void 0 : divSel.querySelector('option[value="vertical"]');
      const triOpt = divSel === null || divSel === void 0 ? void 0 : divSel.querySelector('option[value="triangular"]');
      if (gridOpt) {
        gridOpt.hidden = !hasProperFactor(n) || shape === 'circle' && !allowWrong || shape === 'triangle';
        if (gridOpt.hidden && division === 'grid') divSel.value = 'horizontal';
      }
      if (vertOpt) {
        vertOpt.hidden = shape === 'circle' && !allowWrong;
        if (vertOpt.hidden && division === 'vertical') divSel.value = 'horizontal';
      }
      if (triOpt) {
        triOpt.hidden = shape !== 'triangle';
        if (triOpt.hidden && division === 'triangular') divSel.value = 'horizontal';
      }
      division = (divSel === null || divSel === void 0 ? void 0 : divSel.value) || division;
      if (shape === 'triangle' && division === 'triangular') {
        const m = Math.max(1, Math.round(Math.sqrt(n)));
        n = m * m;
      }
      if (partsInp) partsInp.value = String(n);
      if (partsVal) partsVal.textContent = String(n);
      figState.parts = n;
      figState.shape = (shapeSel === null || shapeSel === void 0 ? void 0 : shapeSel.value) || shape;
      figState.division = division;
      figState.allowWrong = allowWrong;
      const colors = getColors();
      const colorFor = idx => {
        const c = filled.get(idx);
        return c ? colors[c - 1] || '#fff' : '#fff';
      };
      if (shape === 'circle') drawCircle(n, division, allowWrong, colorFor);else if (shape === 'rectangle' || shape === 'square') drawRect(n, division, colorFor);else drawTriangle(n, division, allowWrong, colorFor);
      applyClip(shape, division);
    }
    function drawCircle(n, division, allowWrong, colorFor) {
      const r = CIRCLE_RADIUS;
      const cx = 0.5,
        cy = 0.5;
      const pointOpts = {
        visible: false,
        fixed: true,
        name: '',
        label: {
          visible: false
        }
      };
      if (allowWrong && (division === 'vertical' || division === 'horizontal' || division === 'grid')) {
        let rows = 1,
          cols = n;
        if (division === 'horizontal') {
          rows = n;
          cols = 1;
        } else if (division === 'grid') {
          const d = gridDims(n);
          rows = d.rows;
          cols = d.cols;
        }
        for (let rIdx = 0; rIdx < rows; rIdx++) {
          for (let cIdx = 0; cIdx < cols; cIdx++) {
            const idx = rIdx * cols + cIdx;
            const x1 = cIdx / cols,
              x2 = (cIdx + 1) / cols;
            const y1 = rIdx / rows,
              y2 = (rIdx + 1) / rows;
            const poly = board.create('polygon', [[x1, y1], [x2, y1], [x2, y2], [x1, y2]], {
              borders: {
                strokeColor: '#fff',
                strokeWidth: 6
              },
              vertices: {
                visible: false,
                name: '',
                fixed: true,
                label: {
                  visible: false
                }
              },
              fillColor: colorFor(idx),
              fillOpacity: 1,
              highlight: false,
              hasInnerPoints: true,
              fixed: true,
              cssStyle: 'pointer-events:fill;'
            });
            attachToggleHandler(poly, idx);
            markPolygonBorders(poly);
          }
        }
        for (let i = 1; i < cols; i++) {
          const x = i / cols;
          createDivisionSegment([x, 0], [x, 1]);
        }
        for (let j = 1; j < rows; j++) {
          const y = j / rows;
          createDivisionSegment([0, y], [1, y]);
        }
        if (showOutlineGlobal) {
          board.create('circle', [[cx, cy], r], {
            strokeColor: '#333',
            strokeWidth: OUTLINE_STROKE_WIDTH,
            fillColor: 'none',
            highlight: false,
            fixed: true,
            hasInnerPoints: false,
            cssStyle: 'pointer-events:none;'
          });
        }
      } else {
        const center = board.create('point', [cx, cy], pointOpts);
        const boundaryPts = [];
        for (let i = 0; i < n; i++) {
          const a1 = 2 * Math.PI * i / n;
          const a2 = 2 * Math.PI * (i + 1) / n;
          const p1 = board.create('point', [cx + r * Math.cos(a1), cy + r * Math.sin(a1)], pointOpts);
          const p2 = board.create('point', [cx + r * Math.cos(a2), cy + r * Math.sin(a2)], pointOpts);
          boundaryPts.push(p1);
          const sector = board.create('sector', [center, p1, p2], {
            withLines: true,
            strokeColor: '#fff',
            strokeWidth: 6,
            fillColor: colorFor(i),
            fillOpacity: 1,
            highlight: false,
            hasInnerPoints: true,
            fixed: true,
            cssStyle: 'pointer-events:fill;'
          });
          attachToggleHandler(sector, i);
        }
        for (const p of boundaryPts) {
          createDivisionSegment(center, p, {
            strokeColor: '#000'
          }, false);
        }
        if (showOutlineGlobal) {
          board.create('circle', [center, r], {
            strokeColor: '#333',
            strokeWidth: OUTLINE_STROKE_WIDTH,
            fillColor: 'none',
            highlight: false,
            fixed: true,
            hasInnerPoints: false,
            cssStyle: 'pointer-events:none;'
          });
        }
      }
    }
    function drawRect(n, division, colorFor) {
      if (division === 'diagonal') {
        const c = [0.5, 0.5];
        const corners = [[0, 0], [1, 0], [1, 1], [0, 1]];
        for (let i = 0; i < 4; i++) {
          const pts = [corners[i], corners[(i + 1) % 4], c];
          const poly = board.create('polygon', pts, {
            borders: {
              strokeColor: '#fff',
              strokeWidth: 6
            },
            vertices: {
              visible: false,
              name: '',
              fixed: true,
              label: {
                visible: false
              }
            },
            fillColor: colorFor(i),
            fillOpacity: 1,
            highlight: false,
            hasInnerPoints: true,
            fixed: true,
            cssStyle: 'pointer-events:fill;'
          });
          attachToggleHandler(poly, i);
          markPolygonBorders(poly);
          createDivisionSegment(c, corners[i], {
            strokeColor: '#000'
          }, false);
        }
      } else if (division === 'grid') {
        const {
          rows,
          cols
        } = gridDims(n);
        for (let rIdx = 0; rIdx < rows; rIdx++) {
          for (let cIdx = 0; cIdx < cols; cIdx++) {
            const idx = rIdx * cols + cIdx;
            const x1 = cIdx / cols,
              x2 = (cIdx + 1) / cols;
            const y1 = rIdx / rows,
              y2 = (rIdx + 1) / rows;
            const pts = [[x1, y1], [x2, y1], [x2, y2], [x1, y2]];
            const poly = board.create('polygon', pts, {
              borders: {
                strokeColor: '#fff',
                strokeWidth: 6
              },
              vertices: {
                visible: false,
                name: '',
                fixed: true,
                label: {
                  visible: false
                }
              },
              fillColor: colorFor(idx),
              fillOpacity: 1,
              highlight: false,
              hasInnerPoints: true,
              fixed: true,
              cssStyle: 'pointer-events:fill;'
            });
            attachToggleHandler(poly, idx);
            markPolygonBorders(poly);
          }
        }
        for (let i = 1; i < cols; i++) {
          const x = i / cols;
          createDivisionSegment([x, 0], [x, 1]);
        }
        for (let j = 1; j < rows; j++) {
          const y = j / rows;
          createDivisionSegment([0, y], [1, y]);
        }
      } else {
        for (let i = 0; i < n; i++) {
          let pts;
          if (division === 'vertical') {
            const x1 = i / n,
              x2 = (i + 1) / n;
            pts = [[x1, 0], [x2, 0], [x2, 1], [x1, 1]];
          } else {
            // horizontal
            const y1 = i / n,
              y2 = (i + 1) / n;
            pts = [[0, y1], [1, y1], [1, y2], [0, y2]];
          }
        const poly = board.create('polygon', pts, {
          borders: {
            strokeColor: '#fff',
            strokeWidth: 6
          },
          vertices: {
            visible: false,
            name: '',
            fixed: true,
            label: {
              visible: false
            }
          },
          fillColor: colorFor(i),
          fillOpacity: 1,
          highlight: false,
          hasInnerPoints: true,
          fixed: true,
          cssStyle: 'pointer-events:fill;'
        });
          attachToggleHandler(poly, i);
          markPolygonBorders(poly);
        }
        for (let i = 1; i < n; i++) {
          if (division === 'vertical') {
            const x = i / n;
            createDivisionSegment([x, 0], [x, 1]);
          } else {
            const y = i / n;
            createDivisionSegment([0, y], [1, y]);
          }
        }
      }
      if (showOutlineGlobal) {
        board.create('polygon', [[0, 0], [1, 0], [1, 1], [0, 1]], {
          borders: {
            strokeColor: '#333',
            strokeWidth: 6
          },
          vertices: {
            visible: false,
            name: '',
            fixed: true,
            label: {
              visible: false
            }
          },
          fillColor: 'none',
          highlight: false,
          fixed: true,
          hasInnerPoints: false,
          cssStyle: 'pointer-events:none;'
        });
      }
    }
    function drawTriangle(n, division, allowWrong, colorFor) {
      const h = Math.sqrt(3) / 2;
      const toEq = ([x, y]) => [x + 0.5 * y, y * h];
      const toEqTri = ([x, y]) => [x, (1 - y) * h];
      if (division === 'triangular') {
        const m = Math.round(Math.sqrt(n));
        const rows = [];
        for (let r = 0; r <= m; r++) {
          const y = r / m;
          const xStart = 0.5 - r / (2 * m);
          const row = [];
          for (let c = 0; c <= r; c++) {
            row.push(toEqTri([xStart + c / m, y]));
          }
          rows.push(row);
        }
        let idx = 0;
        for (let r = 1; r <= m; r++) {
          for (let c = 0; c < r; c++) {
            const pts = [rows[r][c], rows[r][c + 1], rows[r - 1][c]];
            const poly = board.create('polygon', pts, {
              borders: {
                strokeColor: '#fff',
                strokeWidth: 6
              },
              vertices: {
                visible: false,
                name: '',
                fixed: true,
                label: {
                  visible: false
                }
              },
              fillColor: colorFor(idx),
              fillOpacity: 1,
              highlight: false,
              hasInnerPoints: true,
              fixed: true,
              cssStyle: 'pointer-events:fill;'
            });
            attachToggleHandler(poly, idx);
            markPolygonBorders(poly);
            idx++;
          }
        }
        for (let r = 0; r < m; r++) {
          for (let c = 0; c < rows[r].length - 1; c++) {
            const pts = [rows[r][c], rows[r][c + 1], rows[r + 1][c + 1]];
            const poly = board.create('polygon', pts, {
              borders: {
                strokeColor: '#fff',
                strokeWidth: 6
              },
              vertices: {
                visible: false,
                name: '',
                fixed: true,
                label: {
                  visible: false
                }
              },
              fillColor: colorFor(idx),
              fillOpacity: 1,
              highlight: false,
              hasInnerPoints: true,
              fixed: true,
              cssStyle: 'pointer-events:fill;'
            });
            attachToggleHandler(poly, idx);
            markPolygonBorders(poly);
            idx++;
          }
        }
        for (let r = 1; r < m; r++) {
          createDivisionSegment(rows[r][0], rows[r][r], {}, false);
          createDivisionSegment(rows[r][0], rows[m][r], {}, false);
          createDivisionSegment(rows[r][r], rows[m][m - r], {}, false);
        }
        if (showOutlineGlobal) {
          board.create('polygon', [toEqTri([0, 1]), toEqTri([1, 1]), toEqTri([0.5, 0])], {
            borders: {
              strokeColor: '#333',
              strokeWidth: 6
            },
            vertices: {
              visible: false,
              name: '',
              fixed: true,
              label: {
                visible: false
              }
            },
            fillColor: 'none',
            highlight: false,
            fixed: true,
            hasInnerPoints: false,
            cssStyle: 'pointer-events:none;'
          });
        }
        return;
      }
      for (let i = 0; i < n; i++) {
        let pts;
        if (division === 'vertical') {
          const x1 = i / n,
            x2 = (i + 1) / n;
          if (allowWrong) {
            pts = [[x1, 0], [x2, 0], [x2, 1 - x2], [x1, 1 - x1]];
          } else {
            pts = [[x1, 0], [x2, 0], [0, 1]];
          }
        } else if (division === 'horizontal') {
          const y1 = i / n,
            y2 = (i + 1) / n;
          if (allowWrong) {
            pts = [[0, y1], [1 - y1, y1], [1 - y2, y2], [0, y2]];
          } else {
            pts = [[0, y1], [0, y2], [1, 0]];
          }
        } else {
          // diagonal
          const t1 = i / n,
            t2 = (i + 1) / n;
          pts = [[1 - t1, t1], [1 - t2, t2], [0, 0]];
        }
        pts = pts.map(toEq);
        const poly = board.create('polygon', pts, {
          borders: {
            strokeColor: '#fff',
            strokeWidth: 6
          },
          vertices: {
            visible: false,
            name: '',
            fixed: true,
            label: {
              visible: false
            }
          },
          fillColor: colorFor(i),
          fillOpacity: 1,
          highlight: false,
          hasInnerPoints: true,
          fixed: true,
          cssStyle: 'pointer-events:fill;'
        });
        attachToggleHandler(poly, i);
        markPolygonBorders(poly);
      }
      if (division === 'vertical') {
        for (let i = 1; i < n; i++) {
          const x = i / n;
          if (allowWrong) {
            createDivisionSegment(toEq([x, 0]), toEq([x, 1 - x]), {}, false);
          } else {
            createDivisionSegment(toEq([x, 0]), toEq([0, 1]), {}, false);
          }
        }
      } else if (division === 'horizontal') {
        for (let i = 1; i < n; i++) {
          const y = i / n;
          if (allowWrong) {
            createDivisionSegment(toEq([0, y]), toEq([1 - y, y]), {}, false);
          } else {
            createDivisionSegment(toEq([0, y]), toEq([1, 0]), {}, false);
          }
        }
      } else {
        // diagonal
        for (let i = 1; i < n; i++) {
          const t = i / n;
          createDivisionSegment(toEq([1 - t, t]), toEq([0, 0]), {}, false);
        }
      }
      if (showOutlineGlobal) {
        board.create('polygon', [toEq([0, 0]), toEq([1, 0]), toEq([0, 1])], {
          borders: {
            strokeColor: '#333',
            strokeWidth: 6
          },
          vertices: {
            visible: false,
            name: '',
            fixed: true,
            label: {
              visible: false
            }
          },
          fillColor: 'none',
          highlight: false,
          fixed: true,
          hasInnerPoints: false,
          cssStyle: 'pointer-events:none;'
        });
      }
    }
    function applyClip(shape, division) {
      var _board;
      const svg = (_board = board) === null || _board === void 0 || (_board = _board.renderer) === null || _board === void 0 ? void 0 : _board.svgRoot;
      if (!svg) return;
      const pad = CLIP_PAD_PERCENT;
      const padStr = pad.toFixed(2);
      const maxStr = (100 + pad).toFixed(2);
      const clipId = `brokClip${id}`;
      let clipValue = '';
      let clipUpdater = null;
      if (shape === 'triangle') {
        clipValue = `polygon(50% -${padStr}%, -${padStr}% ${maxStr}%, ${maxStr}% ${maxStr}%)`;
      } else if (shape === 'rectangle' || shape === 'square') {
        clipValue = `polygon(-${padStr}% ${maxStr}%, ${maxStr}% ${maxStr}%, ${maxStr}% -${padStr}%, -${padStr}% -${padStr}%)`;
      } else if (shape === 'circle') {
        var _svg$viewBox, _svg$viewBox2;
        const circleBase = CIRCLE_RADIUS / BOARD_SIZE;
        const size = Math.max(svg.clientWidth || 0, svg.clientHeight || 0, ((_svg$viewBox = svg.viewBox) === null || _svg$viewBox === void 0 || (_svg$viewBox = _svg$viewBox.baseVal) === null || _svg$viewBox === void 0 ? void 0 : _svg$viewBox.width) || 0, ((_svg$viewBox2 = svg.viewBox) === null || _svg$viewBox2 === void 0 || (_svg$viewBox2 = _svg$viewBox2.baseVal) === null || _svg$viewBox2 === void 0 ? void 0 : _svg$viewBox2.height) || 0, 360);
        const strokePadding = OUTLINE_STROKE_WIDTH / (2 * size);
        const circleClip = Math.min(0.5, circleBase + strokePadding);
        clipValue = `circle(${(circleClip * 100).toFixed(3)}% at 50% 50%)`;
        clipUpdater = clipPath => {
          clipPath.setAttribute('clipPathUnits', 'objectBoundingBox');
          while (clipPath.firstChild) clipPath.removeChild(clipPath.firstChild);
          const circle = document.createElementNS(SVG_NS, 'circle');
          circle.setAttribute('cx', '0.5');
          circle.setAttribute('cy', '0.5');
          circle.setAttribute('r', circleClip.toFixed(6));
          clipPath.appendChild(circle);
        };
      }
      svg.style.clipPath = clipValue;
      svg.style.webkitClipPath = clipValue;
      const defsLookup = () => {
        let defs = svg.querySelector('defs');
        if (!defs && clipUpdater) {
          defs = document.createElementNS(SVG_NS, 'defs');
          svg.insertBefore(defs, svg.firstChild);
        }
        return defs;
      };
      if (clipUpdater) {
        const defs = defsLookup();
        if (!defs) return;
        let clipPath = defs.querySelector(`#${clipId}`);
        if (!clipPath) {
          clipPath = document.createElementNS(SVG_NS, 'clipPath');
          clipPath.setAttribute('id', clipId);
          defs.appendChild(clipPath);
        }
        clipUpdater(clipPath);
        svg.setAttribute('clip-path', `url(#${clipId})`);
      } else {
        svg.removeAttribute('clip-path');
        const defs = defsLookup();
        const clipPath = defs === null || defs === void 0 ? void 0 : defs.querySelector(`#${clipId}`);
        if (clipPath) clipPath.remove();
      }
    }
    allowDenominatorInp === null || allowDenominatorInp === void 0 || allowDenominatorInp.addEventListener('change', () => {
      const enabled = !!allowDenominatorInp.checked;
      updateDenominatorControls(enabled);
      window.render();
    });
    shapeSel === null || shapeSel === void 0 || shapeSel.addEventListener('change', () => {
      const figState = ensureFigureState(id);
      figState.shape = shapeSel.value;
      window.render();
    });
    partsInp === null || partsInp === void 0 || partsInp.addEventListener('input', () => {
      const figState = ensureFigureState(id);
      if (!figState.allowDenominatorChange) {
        const current = clampInt(figState.parts, 1);
        partsInp.value = String(current);
        if (partsVal) partsVal.textContent = String(current);
        return;
      }
      figState.parts = clampInt(partsInp.value, 1);
      window.render();
    });
    divSel === null || divSel === void 0 || divSel.addEventListener('change', () => {
      const figState = ensureFigureState(id);
      figState.division = divSel.value;
      window.render();
    });
    minusBtn === null || minusBtn === void 0 || minusBtn.addEventListener('click', () => {
      let n = parseInt(partsInp.value, 10);
      n = isNaN(n) ? 1 : Math.max(1, n - 1);
      partsInp.value = String(n);
      partsInp.dispatchEvent(new Event('input'));
    });
    plusBtn === null || plusBtn === void 0 || plusBtn.addEventListener('click', () => {
      let n = parseInt(partsInp.value, 10);
      n = isNaN(n) ? 1 : n + 1;
      partsInp.value = String(n);
      partsInp.dispatchEvent(new Event('input'));
    });
    function getFilled() {
      return new Map(filled);
    }
    function setFilled(next) {
      const normalized = normalizeFilledEntries(next);
      filled = new Map(normalized);
      syncFilledState(normalized, true);
    }
    function getSvgElement() {
      var _board2;
      return (_board2 = board) === null || _board2 === void 0 || (_board2 = _board2.renderer) === null || _board2 === void 0 ? void 0 : _board2.svgRoot;
    }
    updateDenominatorControls();
    return {
      draw,
      panel,
      getSvgElement,
      getFilled,
      setFilled,
      updateDenominatorControls
    };
  }
  const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
  async function downloadAllFigures(type) {
    var _window$render, _window;
    (_window$render = (_window = window).render) === null || _window$render === void 0 || _window$render.call(_window);
    const ids = getActiveFigureIds();
    const jobs = ids.map(id => {
      const fig = figures[id];
      if (!fig || typeof fig.getSvgElement !== 'function') return null;
      const svg = fig.getSvgElement();
      if (!svg) return null;
      const baseName = `brok${id}`;
      if (type === 'svg') {
        return () => downloadSVG(svg, baseName + '.svg');
      }
      if (type === 'png') {
        return () => downloadPNG(svg, baseName + '.png', 2);
      }
      return null;
    }).filter(Boolean);
    for (const run of jobs) {
      try {
        await run();
      } catch (error) {
        console.error('Kunne ikke eksportere figur', error);
      }
      await delay(50);
    }
  }
  exportSvgBtn === null || exportSvgBtn === void 0 || exportSvgBtn.addEventListener('click', () => {
    void downloadAllFigures('svg');
  });
  exportPngBtn === null || exportPngBtn === void 0 || exportPngBtn.addEventListener('click', () => {
    void downloadAllFigures('png');
  });
  addRowBtn === null || addRowBtn === void 0 || addRowBtn.addEventListener('click', () => {
    if (rows >= MAX_ROWS) return;
    rows++;
    STATE.rows = rows;
    rebuildLayout();
    window.render();
  });
  removeRowBtn === null || removeRowBtn === void 0 || removeRowBtn.addEventListener('click', () => {
    if (rows <= MIN_DIMENSION) return;
    rows--;
    STATE.rows = rows;
    rebuildLayout();
    window.render();
  });
  addColumnBtn === null || addColumnBtn === void 0 || addColumnBtn.addEventListener('click', () => {
    if (cols >= MAX_COLS) return;
    cols++;
    STATE.cols = cols;
    rebuildLayout();
    window.render();
  });
  removeColumnBtn === null || removeColumnBtn === void 0 || removeColumnBtn.addEventListener('click', () => {
    if (cols <= MIN_DIMENSION) return;
    cols--;
    STATE.cols = cols;
    rebuildLayout();
    window.render();
  });
  rebuildLayout();
  initAltTextManager();
  window.addEventListener('examples:collect', event => {
    var _window$render3, _window3, _window$render4, _window4;
    const detail = event === null || event === void 0 ? void 0 : event.detail;
    if (!detail || detail.svgOverride != null) return;
    const restore = [];
    for (const id of getActiveFigureIds()) {
      const fig = figures[id];
      if (!fig || typeof fig.getFilled !== 'function' || typeof fig.setFilled !== 'function') continue;
      let filled = fig.getFilled();
      if (filled instanceof Map) {
        if (filled.size === 0) continue;
      } else if (filled && typeof filled[Symbol.iterator] === 'function') {
        filled = new Map(filled);
        if (filled.size === 0) continue;
      } else {
        continue;
      }
      restore.push({
        fig,
        filled
      });
    }
    if (restore.length === 0) return;
    for (const entry of restore) {
      entry.fig.setFilled(new Map());
    }
    (_window$render3 = (_window3 = window).render) === null || _window$render3 === void 0 || _window$render3.call(_window3);
    const svg = document.querySelector('svg');
    if (svg) detail.svgOverride = svg.outerHTML;
    for (const entry of restore) {
      entry.fig.setFilled(entry.filled);
    }
    (_window$render4 = (_window4 = window).render) === null || _window$render4 === void 0 || _window$render4.call(_window4);
  });
  function handleThemeProfileChange(event) {
    const data = event && event.data;
    const type = typeof data === 'string' ? data : data && data.type;
    if (type !== 'math-visuals:profile-change') return;
    applyThemeToDocument();
    if (typeof window.render === 'function') window.render();
  }
  if (typeof window !== 'undefined' && typeof window.addEventListener === 'function') {
    window.addEventListener('message', handleThemeProfileChange);
  }
  window.render();
})();
