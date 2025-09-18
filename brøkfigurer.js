(function (_colorCountInp$value) {
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
    a.download = filename.endsWith('.svg') ? filename : filename + '.svg';
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  function downloadPNG(svgEl, filename, scale = 2, bg = '#fff') {
    var _svgEl$viewBox;
    const vb = (_svgEl$viewBox = svgEl.viewBox) === null || _svgEl$viewBox === void 0 ? void 0 : _svgEl$viewBox.baseVal;
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
      canvas.toBlob(blob => {
        const urlPng = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = urlPng;
        a.download = filename.endsWith('.png') ? filename : filename + '.png';
        document.body.appendChild(a);
        a.click();
        a.remove();
        setTimeout(() => URL.revokeObjectURL(urlPng), 1000);
      }, 'image/png');
    };
    img.src = url;
  }
  const SVG_NS = 'http://www.w3.org/2000/svg';
  const figures = [];
  const BOARD_MARGIN = 0.05;
  const BOARD_SIZE = 1 + BOARD_MARGIN * 2;
  const BOARD_BOUNDING_BOX = [-BOARD_MARGIN, 1 + BOARD_MARGIN, 1 + BOARD_MARGIN, -BOARD_MARGIN];
  const CLIP_PADDING_PERCENT = BOARD_MARGIN / BOARD_SIZE * 100;
  const CLIP_PAD_EXTRA_PERCENT = 2;
  const CLIP_PAD_PERCENT = CLIP_PADDING_PERCENT + CLIP_PAD_EXTRA_PERCENT;
  const CIRCLE_RADIUS = 0.45;
  const OUTLINE_STROKE_WIDTH = 6;
  const colorCountInp = document.getElementById('colorCount');
  const colorInputs = [];
  for (let i = 1;; i++) {
    const inp = document.getElementById('color_' + i);
    if (!inp) break;
    colorInputs.push(inp);
  }
  const addBtn = document.getElementById('addFigure');
  const removeBtn1 = document.getElementById('removeFigure1');
  const removeBtn2 = document.getElementById('removeFigure2');
  const fieldset2 = document.getElementById('fieldset2');
  const clampInt = (value, min, max) => {
    const num = parseInt(value, 10);
    const base = Number.isFinite(num) ? num : min;
    const clamped = Math.max(min, base);
    return max != null ? Math.min(clamped, max) : clamped;
  };
  const STATE = window.STATE && typeof window.STATE === 'object' ? window.STATE : {};
  window.STATE = STATE;
  const modifiedColorIndexes = new Set();
  if (Array.isArray(STATE.colors)) {
    STATE.colors.forEach((color, idx) => {
      if (typeof color === 'string' && color) modifiedColorIndexes.add(idx);
    });
  }
  let autoPaletteEnabled = modifiedColorIndexes.size === 0;
  let lastAppliedPaletteSize = null;
  if (!STATE.figures || typeof STATE.figures !== 'object') STATE.figures = {};
  const maxColors = colorInputs.length || 1;
  const defaultColorCount = clampInt((_colorCountInp$value = colorCountInp === null || colorCountInp === void 0 ? void 0 : colorCountInp.value) !== null && _colorCountInp$value !== void 0 ? _colorCountInp$value : 1, 1, maxColors);
  const stateColorCount = STATE.colorCount != null ? clampInt(STATE.colorCount, 1, maxColors) : null;
  let colorCount = stateColorCount || defaultColorCount;
  STATE.colorCount = colorCount;
  function ensureFigureState(id) {
    const existing = STATE.figures[id];
    const fig = existing && typeof existing === 'object' ? existing : {};
    const shapeEl = document.getElementById(`shape${id}`);
    const partsEl = document.getElementById(`parts${id}`);
    const divisionEl = document.getElementById(`division${id}`);
    const wrongEl = document.getElementById(`allowWrong${id}`);
    if (shapeEl && fig.shape == null) fig.shape = shapeEl.value;
    if (partsEl && fig.parts == null) {
      const parsed = parseInt(partsEl.value, 10);
      fig.parts = Number.isFinite(parsed) && parsed > 0 ? parsed : 1;
    }
    if (divisionEl && fig.division == null) fig.division = divisionEl.value;
    if (wrongEl && typeof fig.allowWrong !== 'boolean') fig.allowWrong = !!wrongEl.checked;
    STATE.figures[id] = fig;
    return fig;
  }
  ensureFigureState(1);
  ensureFigureState(2);
  if (typeof STATE.figure2Visible !== 'boolean') {
    const panel2 = document.getElementById('panel2');
    STATE.figure2Visible = panel2 ? panel2.style.display !== 'none' : false;
  }
  const DEFAULT_COLOR_SETS = {
    1: ['#6C1BA2'],
    2: ['#BF4474', '#534477'],
    3: ['#B25FE3', '#6C1BA2', '#BF4474'],
    4: ['#B25FE3', '#6C1BA2', '#534477', '#BF4474'],
    5: ['#B25FE3', '#6C1BA2', '#534477', '#873E79', '#BF4474'],
    6: ['#B25FE3', '#6C1BA2', '#534477', '#873E79', '#BF4474', '#E31C3D']
  };
  function ensureColorDefaults(count) {
    const palette = DEFAULT_COLOR_SETS[count] || DEFAULT_COLOR_SETS[maxColors] || ['#6C1BA2'];
    const fillPalette = DEFAULT_COLOR_SETS[maxColors] || palette;
    if (autoPaletteEnabled) {
      if (lastAppliedPaletteSize !== count || !Array.isArray(STATE.colors)) {
        STATE.colors = palette.slice();
      }
    } else if (!Array.isArray(STATE.colors)) {
      STATE.colors = [];
    }
    if (!Array.isArray(STATE.colors)) STATE.colors = [];
    const required = Math.max(count, maxColors);
    for (let i = 0; i < required; i++) {
      const withinCount = i < count;
      const source = withinCount ? palette : fillPalette;
      let defaultColor = '#6C1BA2';
      if (Array.isArray(source) && source.length > 0) {
        var _source$Math$min;
        defaultColor = (_source$Math$min = source[Math.min(i, source.length - 1)]) !== null && _source$Math$min !== void 0 ? _source$Math$min : '#6C1BA2';
      } else if (Array.isArray(palette) && palette.length > 0) {
        var _palette$Math$min;
        defaultColor = (_palette$Math$min = palette[Math.min(withinCount ? i : palette.length - 1, palette.length - 1)]) !== null && _palette$Math$min !== void 0 ? _palette$Math$min : '#6C1BA2';
      }
      const hasColor = typeof STATE.colors[i] === 'string' && STATE.colors[i];
      const shouldUseDefault = autoPaletteEnabled || !modifiedColorIndexes.has(i);
      if (shouldUseDefault || !hasColor) {
        STATE.colors[i] = defaultColor || '#6C1BA2';
      }
      if (typeof STATE.colors[i] !== 'string' || !STATE.colors[i]) {
        STATE.colors[i] = '#6C1BA2';
      }
    }
    if (STATE.colors.length > required) STATE.colors.length = required;
    lastAppliedPaletteSize = count;
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
    colorCount = clampInt(STATE.colorCount, 1, maxColors);
    STATE.colorCount = colorCount;
    if (colorCountInp) colorCountInp.value = String(colorCount);
    ensureColorDefaults(colorCount);
    colorInputs.forEach((inp, idx) => {
      const color = STATE.colors[idx];
      if (typeof color === 'string') inp.value = color;
    });
    for (let id = 1; id <= 2; id++) {
      const figState = ensureFigureState(id);
      const shapeSel = document.getElementById(`shape${id}`);
      if (shapeSel && figState.shape) {
        const options = Array.from(shapeSel.options || []);
        if (options.some(opt => opt.value === figState.shape)) shapeSel.value = figState.shape;else figState.shape = shapeSel.value;
      }
      const partsInp = document.getElementById(`parts${id}`);
      const partsVal = document.getElementById(`partsVal${id}`);
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
      const wrongInp = document.getElementById(`allowWrong${id}`);
      if (wrongInp && typeof figState.allowWrong === 'boolean') wrongInp.checked = figState.allowWrong;
    }
  }
  function applyFigureVisibility() {
    const showSecond = !!STATE.figure2Visible;
    if (addBtn) addBtn.style.display = showSecond ? 'none' : '';
    if (fieldset2) fieldset2.style.display = showSecond ? '' : 'none';
    if (removeBtn2) removeBtn2.style.display = showSecond ? '' : 'none';
    if (removeBtn1) removeBtn1.style.display = showSecond ? '' : 'none';
    const second = figures[2];
    if (second) {
      if (second.panel) second.panel.style.display = showSecond ? '' : 'none';
      if (second.toolbar) second.toolbar.style.display = showSecond ? '' : 'none';
    }
  }
  function renderAll() {
    applyStateToControls();
    applyFigureVisibility();
    updateColorVisibility();
    for (const fig of figures) {
      if (fig && typeof fig.draw === 'function') fig.draw();
    }
  }
  window.render = renderAll;
  function setupFigure(id) {
    const shapeSel = document.getElementById(`shape${id}`);
    const partsInp = document.getElementById(`parts${id}`);
    const divSel = document.getElementById(`division${id}`);
    const wrongInp = document.getElementById(`allowWrong${id}`);
    const minusBtn = document.getElementById(`partsMinus${id}`);
    const plusBtn = document.getElementById(`partsPlus${id}`);
    const partsVal = document.getElementById(`partsVal${id}`);
    const btnSvg = document.getElementById(`btnSvg${id}`);
    const btnPng = document.getElementById(`btnPng${id}`);
    const panel = document.getElementById(`panel${id}`);
    const toolbar = btnSvg === null || btnSvg === void 0 ? void 0 : btnSvg.parentElement;
    let board;
    let filled = new Map();
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
    function togglePart(i, element) {
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
      var _ref, _partsInp$value, _wrongInp$checked, _wrongInp$checked2;
      if (panel.style.display === 'none') return;
      const figState = ensureFigureState(id);
      setFilled(figState.filled);
      initBoard();
      let n = clampInt((_ref = (_partsInp$value = partsInp === null || partsInp === void 0 ? void 0 : partsInp.value) !== null && _partsInp$value !== void 0 ? _partsInp$value : figState.parts) !== null && _ref !== void 0 ? _ref : 1, 1);
      const shape = (shapeSel === null || shapeSel === void 0 ? void 0 : shapeSel.value) || figState.shape || 'rectangle';
      let division = (divSel === null || divSel === void 0 ? void 0 : divSel.value) || figState.division || 'horizontal';
      const allowWrong = (_wrongInp$checked = wrongInp === null || wrongInp === void 0 ? void 0 : wrongInp.checked) !== null && _wrongInp$checked !== void 0 ? _wrongInp$checked : !!figState.allowWrong;
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
      figState.allowWrong = !!((_wrongInp$checked2 = wrongInp === null || wrongInp === void 0 ? void 0 : wrongInp.checked) !== null && _wrongInp$checked2 !== void 0 ? _wrongInp$checked2 : allowWrong);
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
              fixed: true
            });
            poly.on('down', () => togglePart(idx, poly));
          }
        }
        for (let i = 1; i < cols; i++) {
          const x = i / cols;
          const seg = board.create('segment', [[x, 0], [x, 1]], {
            strokeColor: '#000',
            strokeWidth: 2,
            dash: 2,
            highlight: false,
            fixed: true,
            cssStyle: 'pointer-events:none;'
          });
          disableHitDetection(seg);
        }
        for (let j = 1; j < rows; j++) {
          const y = j / rows;
          const seg = board.create('segment', [[0, y], [1, y]], {
            strokeColor: '#000',
            strokeWidth: 2,
            dash: 2,
            highlight: false,
            fixed: true,
            cssStyle: 'pointer-events:none;'
          });
          disableHitDetection(seg);
        }
        board.create('circle', [[cx, cy], r], {
          strokeColor: '#333',
          strokeWidth: OUTLINE_STROKE_WIDTH,
          fillColor: 'none',
          highlight: false,
          fixed: true,
          hasInnerPoints: false,
          cssStyle: 'pointer-events:none;'
        });
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
            fixed: true
          });
          sector.on('down', () => togglePart(i, sector));
        }
        for (const p of boundaryPts) {
          const seg = board.create('segment', [center, p], {
            strokeColor: '#000',
            strokeWidth: 2,
            dash: 2,
            highlight: false,
            fixed: true,
            cssStyle: 'pointer-events:none;'
          });
          disableHitDetection(seg);
        }
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
            fixed: true
          });
          poly.on('down', () => togglePart(i, poly));
          const seg = board.create('segment', [c, corners[i]], {
            strokeColor: '#000',
            strokeWidth: 2,
            dash: 2,
            highlight: false,
            fixed: true,
            cssStyle: 'pointer-events:none;'
          });
          disableHitDetection(seg);
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
              fixed: true
            });
            poly.on('down', () => togglePart(idx, poly));
          }
        }
        for (let i = 1; i < cols; i++) {
          const x = i / cols;
          const seg = board.create('segment', [[x, 0], [x, 1]], {
            strokeColor: '#000',
            strokeWidth: 2,
            dash: 2,
            highlight: false,
            fixed: true,
            cssStyle: 'pointer-events:none;'
          });
          disableHitDetection(seg);
        }
        for (let j = 1; j < rows; j++) {
          const y = j / rows;
          const seg = board.create('segment', [[0, y], [1, y]], {
            strokeColor: '#000',
            strokeWidth: 2,
            dash: 2,
            highlight: false,
            fixed: true,
            cssStyle: 'pointer-events:none;'
          });
          disableHitDetection(seg);
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
            fixed: true
          });
          poly.on('down', () => togglePart(i, poly));
        }
        for (let i = 1; i < n; i++) {
          if (division === 'vertical') {
            const x = i / n;
            const seg = board.create('segment', [[x, 0], [x, 1]], {
              strokeColor: '#000',
              strokeWidth: 2,
              dash: 2,
              highlight: false,
              fixed: true,
              cssStyle: 'pointer-events:none;'
            });
            disableHitDetection(seg);
          } else {
            const y = i / n;
            const seg = board.create('segment', [[0, y], [1, y]], {
              strokeColor: '#000',
              strokeWidth: 2,
              dash: 2,
              highlight: false,
              fixed: true,
              cssStyle: 'pointer-events:none;'
            });
            disableHitDetection(seg);
          }
        }
      }
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
              fixed: true
            });
            poly.on('down', () => togglePart(idx, poly));
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
              fixed: true
            });
            poly.on('down', () => togglePart(idx, poly));
            idx++;
          }
        }
        for (let r = 1; r < m; r++) {
          const seg1 = board.create('segment', [rows[r][0], rows[r][r]], {
            strokeColor: '#000',
            strokeWidth: 2,
            dash: 2,
            highlight: false,
            fixed: true,
            cssStyle: 'pointer-events:none;'
          });
          disableHitDetection(seg1);
          const seg2 = board.create('segment', [rows[r][0], rows[m][r]], {
            strokeColor: '#000',
            strokeWidth: 2,
            dash: 2,
            highlight: false,
            fixed: true,
            cssStyle: 'pointer-events:none;'
          });
          disableHitDetection(seg2);
          const seg3 = board.create('segment', [rows[r][r], rows[m][m - r]], {
            strokeColor: '#000',
            strokeWidth: 2,
            dash: 2,
            highlight: false,
            fixed: true,
            cssStyle: 'pointer-events:none;'
          });
          disableHitDetection(seg3);
        }
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
          fixed: true
        });
        poly.on('down', () => togglePart(i, poly));
      }
      if (division === 'vertical') {
        for (let i = 1; i < n; i++) {
          const x = i / n;
          if (allowWrong) {
            const seg = board.create('segment', [toEq([x, 0]), toEq([x, 1 - x])], {
              strokeColor: '#000',
              strokeWidth: 2,
              dash: 2,
              highlight: false,
              fixed: true,
              cssStyle: 'pointer-events:none;'
            });
            disableHitDetection(seg);
          } else {
            const seg = board.create('segment', [toEq([x, 0]), toEq([0, 1])], {
              strokeColor: '#000',
              strokeWidth: 2,
              dash: 2,
              highlight: false,
              fixed: true,
              cssStyle: 'pointer-events:none;'
            });
            disableHitDetection(seg);
          }
        }
      } else if (division === 'horizontal') {
        for (let i = 1; i < n; i++) {
          const y = i / n;
          if (allowWrong) {
            const seg = board.create('segment', [toEq([0, y]), toEq([1 - y, y])], {
              strokeColor: '#000',
              strokeWidth: 2,
              dash: 2,
              highlight: false,
              fixed: true,
              cssStyle: 'pointer-events:none;'
            });
            disableHitDetection(seg);
          } else {
            const seg = board.create('segment', [toEq([0, y]), toEq([1, 0])], {
              strokeColor: '#000',
              strokeWidth: 2,
              dash: 2,
              highlight: false,
              fixed: true,
              cssStyle: 'pointer-events:none;'
            });
            disableHitDetection(seg);
          }
        }
      } else {
        // diagonal
        for (let i = 1; i < n; i++) {
          const t = i / n;
          const seg = board.create('segment', [toEq([1 - t, t]), toEq([0, 0])], {
            strokeColor: '#000',
            strokeWidth: 2,
            dash: 2,
            highlight: false,
            fixed: true,
            cssStyle: 'pointer-events:none;'
          });
          disableHitDetection(seg);
        }
      }
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
    shapeSel === null || shapeSel === void 0 || shapeSel.addEventListener('change', () => {
      const figState = ensureFigureState(id);
      figState.shape = shapeSel.value;
      window.render();
    });
    partsInp === null || partsInp === void 0 || partsInp.addEventListener('input', () => {
      const figState = ensureFigureState(id);
      figState.parts = clampInt(partsInp.value, 1);
      window.render();
    });
    divSel === null || divSel === void 0 || divSel.addEventListener('change', () => {
      const figState = ensureFigureState(id);
      figState.division = divSel.value;
      window.render();
    });
    wrongInp === null || wrongInp === void 0 || wrongInp.addEventListener('change', () => {
      const figState = ensureFigureState(id);
      figState.allowWrong = !!wrongInp.checked;
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
    btnSvg === null || btnSvg === void 0 || btnSvg.addEventListener('click', () => {
      var _board2;
      const svg = (_board2 = board) === null || _board2 === void 0 || (_board2 = _board2.renderer) === null || _board2 === void 0 ? void 0 : _board2.svgRoot;
      if (svg) downloadSVG(svg, `brok${id}.svg`);
    });
    btnPng === null || btnPng === void 0 || btnPng.addEventListener('click', () => {
      var _board3;
      const svg = (_board3 = board) === null || _board3 === void 0 || (_board3 = _board3.renderer) === null || _board3 === void 0 ? void 0 : _board3.svgRoot;
      if (svg) downloadPNG(svg, `brok${id}.png`, 2);
    });
    function getFilled() {
      return new Map(filled);
    }
    function setFilled(next) {
      const normalized = normalizeFilledEntries(next);
      filled = new Map(normalized);
      syncFilledState(normalized, true);
    }
    return {
      draw,
      panel,
      toolbar,
      getFilled,
      setFilled
    };
  }
  figures[1] = setupFigure(1);
  figures[2] = setupFigure(2);
  addBtn === null || addBtn === void 0 || addBtn.addEventListener('click', () => {
    STATE.figure2Visible = true;
    window.render();
  });
  removeBtn1 === null || removeBtn1 === void 0 || removeBtn1.addEventListener('click', () => {
    var _figures$1$getFilled, _figures$, _figures$$getFilled, _figures$2$getFilled, _figures$2, _figures$2$getFilled2, _figures$3, _figures$3$setFilled, _figures$4, _figures$4$setFilled;
    if (!STATE.figure2Visible) return;
    const fig1State = {
      ...ensureFigureState(1)
    };
    const fig2State = {
      ...ensureFigureState(2)
    };
    STATE.figures[1] = fig2State;
    STATE.figures[2] = fig1State;
    const fig1Filled = (_figures$1$getFilled = (_figures$ = figures[1]) === null || _figures$ === void 0 || (_figures$$getFilled = _figures$.getFilled) === null || _figures$$getFilled === void 0 ? void 0 : _figures$$getFilled.call(_figures$)) !== null && _figures$1$getFilled !== void 0 ? _figures$1$getFilled : new Map();
    const fig2Filled = (_figures$2$getFilled = (_figures$2 = figures[2]) === null || _figures$2 === void 0 || (_figures$2$getFilled2 = _figures$2.getFilled) === null || _figures$2$getFilled2 === void 0 ? void 0 : _figures$2$getFilled2.call(_figures$2)) !== null && _figures$2$getFilled !== void 0 ? _figures$2$getFilled : new Map();
    (_figures$3 = figures[1]) === null || _figures$3 === void 0 || (_figures$3$setFilled = _figures$3.setFilled) === null || _figures$3$setFilled === void 0 || _figures$3$setFilled.call(_figures$3, fig2Filled);
    (_figures$4 = figures[2]) === null || _figures$4 === void 0 || (_figures$4$setFilled = _figures$4.setFilled) === null || _figures$4$setFilled === void 0 || _figures$4$setFilled.call(_figures$4, fig1Filled);
    STATE.figure2Visible = false;
    window.render();
  });
  removeBtn2 === null || removeBtn2 === void 0 || removeBtn2.addEventListener('click', () => {
    STATE.figure2Visible = false;
    window.render();
  });
  window.addEventListener('examples:collect', event => {
    var _window$render3, _window3, _window$render4, _window4;
    const detail = event === null || event === void 0 ? void 0 : event.detail;
    if (!detail || detail.svgOverride != null) return;
    const restore = [];
    for (const fig of figures) {
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
    for (const {
      fig
    } of restore) {
      fig.setFilled(new Map());
    }
    (_window$render3 = (_window3 = window).render) === null || _window$render3 === void 0 || _window$render3.call(_window3);
    const svg = document.querySelector('svg');
    if (svg) detail.svgOverride = svg.outerHTML;
    for (const {
      fig,
      filled
    } of restore) {
      fig.setFilled(filled);
    }
    (_window$render4 = (_window4 = window).render) === null || _window$render4 === void 0 || _window$render4.call(_window4);
  });
  window.render();
})();
