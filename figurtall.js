(function () {
  const boxes = [];
  const MAX_DIM = 20;
  const MAX_COLORS = 6;
  const LABEL_MODES = ['name', 'number', 'hidden'];
  let rows = 3;
  let cols = 3;
  const colorCountInp = document.getElementById('colorCount');
  const labelModeSelect = document.getElementById('labelMode');
  const colorInputs = [];
  for (let i = 1;; i++) {
    const inp = document.getElementById('color_' + i);
    if (!inp) break;
    colorInputs.push(inp);
  }
  const DEFAULT_COLOR_SETS = {
    1: ['#6C1BA2'],
    2: ['#BF4474', '#534477'],
    3: ['#B25FE3', '#6C1BA2', '#BF4474'],
    4: ['#B25FE3', '#6C1BA2', '#534477', '#BF4474'],
    5: ['#B25FE3', '#6C1BA2', '#534477', '#873E79', '#BF4474'],
    6: ['#B25FE3', '#6C1BA2', '#534477', '#873E79', '#BF4474', '#E31C3D']
  };
  const STATE = typeof window.STATE === 'object' && window.STATE ? window.STATE : {};
  window.STATE = STATE;
  const modifiedColorIndexes = new Set();
  if (Array.isArray(STATE.colors)) {
    STATE.colors.forEach((color, idx) => {
      if (typeof color === 'string' && color) modifiedColorIndexes.add(idx);
    });
  }
  let autoPaletteEnabled = modifiedColorIndexes.size === 0;
  let lastAppliedPaletteSize = null;
  function clampInt(value, min, max) {
    const num = parseInt(value, 10);
    if (!Number.isFinite(num)) return min;
    return Math.max(min, Math.min(max, num));
  }
  function normalizeLabelMode(value) {
    if (typeof value === 'string') {
      const normalized = value.trim().toLowerCase();
      if (LABEL_MODES.includes(normalized)) return normalized;
    }
    return 'name';
  }
  function normalizeCells(cells, rowCount, colCount) {
    const matrix = Array.from({
      length: rowCount
    }, () => Array(colCount).fill(0));
    if (!Array.isArray(cells)) return matrix;
    for (let r = 0; r < rowCount; r++) {
      const row = Array.isArray(cells[r]) ? cells[r] : [];
      for (let c = 0; c < colCount; c++) {
        const val = parseInt(row[c], 10);
        matrix[r][c] = Number.isFinite(val) && val > 0 ? val : 0;
      }
    }
    return matrix;
  }
  function ensureColors(count) {
    const palette = DEFAULT_COLOR_SETS[count] || DEFAULT_COLOR_SETS[MAX_COLORS] || ['#6C1BA2'];
    const fillPalette = DEFAULT_COLOR_SETS[MAX_COLORS] || palette;
    if (autoPaletteEnabled) {
      if (lastAppliedPaletteSize !== count || !Array.isArray(STATE.colors)) {
        STATE.colors = palette.slice();
      }
    } else if (!Array.isArray(STATE.colors)) {
      STATE.colors = [];
    }
    if (!Array.isArray(STATE.colors)) STATE.colors = [];
    const required = Math.max(count, MAX_COLORS);
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
  function createFigureState(name, rowCount, colCount, coords) {
    var _STATE$figures;
    const label = typeof name === 'string' && name.trim() ? name : `Figur ${(_STATE$figures = STATE.figures) !== null && _STATE$figures !== void 0 && _STATE$figures.length ? STATE.figures.length + 1 : 1}`;
    const cells = normalizeCells([], rowCount, colCount);
    (coords || []).forEach(coord => {
      if (!Array.isArray(coord)) return;
      const [r, c, colorIdx = 1] = coord;
      if (r >= 0 && r < rowCount && c >= 0 && c < colCount) {
        const idx = parseInt(colorIdx, 10);
        cells[r][c] = Number.isFinite(idx) && idx > 0 ? idx : 1;
      }
    });
    return {
      name: label,
      cells
    };
  }
  function sanitizeState() {
    var _STATE$rows, _STATE$cols, _STATE$colorCount;
    const maxColors = colorInputs.length || MAX_COLORS;
    rows = clampInt((_STATE$rows = STATE.rows) !== null && _STATE$rows !== void 0 ? _STATE$rows : rows, 1, MAX_DIM);
    cols = clampInt((_STATE$cols = STATE.cols) !== null && _STATE$cols !== void 0 ? _STATE$cols : cols, 1, MAX_DIM);
    STATE.rows = rows;
    STATE.cols = cols;
    STATE.circleMode = STATE.circleMode !== false;
    STATE.offset = STATE.offset !== false;
    STATE.showGrid = STATE.showGrid !== false;
    STATE.labelMode = normalizeLabelMode(STATE.labelMode);
    STATE.colorCount = clampInt((_STATE$colorCount = STATE.colorCount) !== null && _STATE$colorCount !== void 0 ? _STATE$colorCount : colorCountInp ? colorCountInp.value : 1, 1, maxColors);
    ensureColors(STATE.colorCount);
    if (!Array.isArray(STATE.figures)) STATE.figures = [];
    if (STATE.figures.length === 0) {
      STATE.figures = [createFigureState('Figur 1', rows, cols, [[0, 1]]), createFigureState('Figur 2', rows, cols, [[0, 1], [1, 0], [1, 1]]), createFigureState('Figur 3', rows, cols, [[0, 1], [1, 0], [1, 1], [2, 0], [2, 1], [2, 2]])];
    } else {
      STATE.figures = STATE.figures.map((fig, idx) => {
        const name = typeof (fig === null || fig === void 0 ? void 0 : fig.name) === 'string' && fig.name.trim() ? fig.name : `Figur ${idx + 1}`;
        return {
          name,
          cells: normalizeCells(fig === null || fig === void 0 ? void 0 : fig.cells, rows, cols)
        };
      });
    }
  }
  function getColors() {
    ensureColors(STATE.colorCount);
    return STATE.colors.slice(0, STATE.colorCount);
  }
  function applyCellAppearance(cell, idx, colors) {
    cell.dataset.color = String(idx);
    if (idx === 0) {
      cell.style.backgroundColor = '#fff';
    } else {
      cell.style.backgroundColor = colors[idx - 1] || '#fff';
    }
    if (STATE.circleMode && idx !== 0) {
      cell.classList.add('circle');
    } else {
      cell.classList.remove('circle');
    }
  }
  function updateCellColors() {
    const colors = getColors();
    container === null || container === void 0 || container.querySelectorAll('.cell').forEach(cell => {
      var _fig$cells;
      const figIndex = parseInt(cell.dataset.figIndex, 10);
      const r = parseInt(cell.dataset.row, 10);
      const c = parseInt(cell.dataset.col, 10);
      const fig = STATE.figures[figIndex];
      if (!fig || !Array.isArray(fig.cells)) return;
      let idxVal = ((_fig$cells = fig.cells) === null || _fig$cells === void 0 || (_fig$cells = _fig$cells[r]) === null || _fig$cells === void 0 ? void 0 : _fig$cells[c]) || 0;
      if (idxVal > colors.length) {
        idxVal = 0;
        if (fig.cells[r]) fig.cells[r][c] = 0;
      }
      applyCellAppearance(cell, idxVal, colors);
    });
  }
  function updateColorVisibility() {
    const count = STATE.colorCount;
    ensureColors(count);
    colorInputs.forEach((inp, idx) => {
      if (idx < count) {
        inp.style.display = '';
        inp.value = STATE.colors[idx];
      } else {
        inp.style.display = 'none';
      }
    });
    updateCellColors();
  }
  function createGridForFigure(boxEl, index) {
    const fig = STATE.figures[index];
    boxEl.innerHTML = '';
    boxEl.style.setProperty('--cols', cols);
    boxEl.style.setProperty('--rows', rows);
    boxEl.style.setProperty('--aspect', cols / rows);
    boxEl.style.setProperty('--cellSize', 100 / cols + '%');
    boxEl.classList.toggle('hide-grid', !STATE.showGrid);
    for (let r = 0; r < rows; r++) {
      const rowEl = document.createElement('div');
      rowEl.className = 'row';
      if (STATE.offset && r % 2 === 1) rowEl.classList.add('offset');
      for (let c = 0; c < cols; c++) {
        var _fig$cells2;
        const cell = document.createElement('div');
        cell.className = 'cell';
        const idxVal = (fig === null || fig === void 0 || (_fig$cells2 = fig.cells) === null || _fig$cells2 === void 0 || (_fig$cells2 = _fig$cells2[r]) === null || _fig$cells2 === void 0 ? void 0 : _fig$cells2[c]) || 0;
        cell.dataset.color = String(idxVal);
        cell.dataset.figIndex = String(index);
        cell.dataset.row = String(r);
        cell.dataset.col = String(c);
        cell.addEventListener('click', () => cycleCell(index, r, c, cell));
        rowEl.appendChild(cell);
      }
      boxEl.appendChild(rowEl);
    }
  }
  function createPanelForFigure(index) {
    const panel = document.createElement('div');
    panel.className = 'figurePanel';
    panel.dataset.index = String(index);
    panel.innerHTML = `
      <div class="figure"><div class="box"></div></div>
      <input class="nameInput" type="text" placeholder="Navn" />
      <div class="figureAutoLabel" aria-hidden="true"></div>
    `;
    const boxEl = panel.querySelector('.box');
    boxes.push(boxEl);
    createGridForFigure(boxEl, index);
    const nameInput = panel.querySelector('.nameInput');
    const fig = STATE.figures[index];
    const baseName = (fig === null || fig === void 0 ? void 0 : fig.name) || `Figur ${index + 1}`;
    nameInput.value = baseName;
    STATE.figures[index].name = baseName;
    nameInput.addEventListener('input', () => {
      STATE.figures[index].name = nameInput.value;
    });
    const removeBtn = document.createElement('button');
    removeBtn.type = 'button';
    removeBtn.className = 'removeFigureBtn';
    removeBtn.textContent = 'Fjern figur';
    if (STATE.figures.length <= 1) {
      removeBtn.disabled = true;
      removeBtn.setAttribute('aria-disabled', 'true');
    } else {
      removeBtn.disabled = false;
      removeBtn.removeAttribute('aria-disabled');
    }
    removeBtn.setAttribute('aria-label', `Fjern figur ${index + 1}`);
    removeBtn.addEventListener('click', () => {
      removeFigure(index);
    });
    panel.appendChild(removeBtn);
    applyLabelModeToPanel(panel, index);
    return panel;
  }
  const container = document.getElementById('figureContainer');
  const addBtn = document.getElementById('addFigure');
  function applyLabelModeToPanel(panel, index) {
    if (!panel) return;
    const mode = STATE.labelMode;
    const nameInput = panel.querySelector('.nameInput');
    const autoLabel = panel.querySelector('.figureAutoLabel');
    if (autoLabel) {
      autoLabel.textContent = String(index + 1);
    }
    if (mode === 'name') {
      if (nameInput) {
        nameInput.style.display = '';
        nameInput.disabled = false;
        nameInput.setAttribute('aria-hidden', 'false');
      }
      if (autoLabel) {
        autoLabel.style.display = 'none';
        autoLabel.setAttribute('aria-hidden', 'true');
      }
    } else if (mode === 'number') {
      if (nameInput) {
        nameInput.style.display = 'none';
        nameInput.disabled = true;
        nameInput.setAttribute('aria-hidden', 'true');
      }
      if (autoLabel) {
        autoLabel.style.display = '';
        autoLabel.setAttribute('aria-hidden', 'false');
      }
    } else {
      if (nameInput) {
        nameInput.style.display = 'none';
        nameInput.disabled = true;
        nameInput.setAttribute('aria-hidden', 'true');
      }
      if (autoLabel) {
        autoLabel.style.display = 'none';
        autoLabel.setAttribute('aria-hidden', 'true');
      }
    }
  }
  function updatePanelLabels() {
    if (!container) return;
    container.querySelectorAll('.figurePanel').forEach((panel, idx) => {
      applyLabelModeToPanel(panel, idx);
    });
  }
  function rebuildFigurePanels() {
    if (!container) return;
    boxes.length = 0;
    container.querySelectorAll('.figurePanel').forEach(panel => panel.remove());
    STATE.figures.forEach((_, idx) => {
      const panel = createPanelForFigure(idx);
      container.insertBefore(panel, addBtn);
    });
    updateCellColors();
    updateGridVisibility();
    updateFigureLayout();
    updatePanelLabels();
  }
  const MIN_PANEL_WIDTH = 80;
  const MAX_PANEL_WIDTH = 260;
  function updateFigureLayout() {
    if (!container) return;
    const panelCount = container.querySelectorAll('.figurePanel').length + (addBtn ? 1 : 0);
    if (panelCount <= 0) return;
    const styles = getComputedStyle(container);
    const gapStr = styles.columnGap || styles.gap || '0';
    const gap = parseFloat(gapStr) || 0;
    const available = container.clientWidth;
    if (available <= 0) return;
    let computed = (available - gap * (panelCount - 1)) / panelCount;
    if (!Number.isFinite(computed)) return;
    if (computed > MAX_PANEL_WIDTH) computed = MAX_PANEL_WIDTH;
    if (computed < MIN_PANEL_WIDTH) computed = MIN_PANEL_WIDTH;
    container.style.setProperty('--panel-min', `${computed}px`);
  }
  window.addEventListener('resize', updateFigureLayout);
  function updateGridVisibility() {
    boxes.forEach(box => box.classList.toggle('hide-grid', !STATE.showGrid));
  }
  function cycleCell(figIndex, r, c, cell) {
    var _fig$cells3;
    const colors = getColors();
    const fig = STATE.figures[figIndex];
    if (!fig) return;
    const current = ((_fig$cells3 = fig.cells) === null || _fig$cells3 === void 0 || (_fig$cells3 = _fig$cells3[r]) === null || _fig$cells3 === void 0 ? void 0 : _fig$cells3[c]) || 0;
    const next = (current + 1) % (colors.length + 1);
    fig.cells[r][c] = next;
    applyCellAppearance(cell, next, colors);
  }
  const rowsMinus = document.getElementById('rowsMinus');
  const rowsPlus = document.getElementById('rowsPlus');
  const rowsVal = document.getElementById('rowsVal');
  const colsMinus = document.getElementById('colsMinus');
  const colsPlus = document.getElementById('colsPlus');
  const colsVal = document.getElementById('colsVal');
  function applyStateToControls() {
    if (rowsVal) rowsVal.textContent = rows;
    if (colsVal) colsVal.textContent = cols;
    const circleInp = document.getElementById('circleMode');
    const offsetInp = document.getElementById('offsetRows');
    const gridInp = document.getElementById('showGrid');
    if (circleInp) circleInp.checked = !!STATE.circleMode;
    if (offsetInp) offsetInp.checked = !!STATE.offset;
    if (gridInp) gridInp.checked = !!STATE.showGrid;
    if (labelModeSelect) labelModeSelect.value = STATE.labelMode;
    if (colorCountInp) colorCountInp.value = String(STATE.colorCount);
    updateColorVisibility();
  }
  function setRows(next) {
    const clamped = clampInt(next, 1, MAX_DIM);
    if (clamped === rows) return;
    STATE.rows = clamped;
    render();
  }
  function setCols(next) {
    const clamped = clampInt(next, 1, MAX_DIM);
    if (clamped === cols) return;
    STATE.cols = clamped;
    render();
  }
  rowsMinus === null || rowsMinus === void 0 || rowsMinus.addEventListener('click', () => {
    if (rows > 1) setRows(rows - 1);
  });
  rowsPlus === null || rowsPlus === void 0 || rowsPlus.addEventListener('click', () => {
    if (rows < MAX_DIM) setRows(rows + 1);
  });
  colsMinus === null || colsMinus === void 0 || colsMinus.addEventListener('click', () => {
    if (cols > 1) setCols(cols - 1);
  });
  colsPlus === null || colsPlus === void 0 || colsPlus.addEventListener('click', () => {
    if (cols < MAX_DIM) setCols(cols + 1);
  });
  const circleInp = document.getElementById('circleMode');
  circleInp === null || circleInp === void 0 || circleInp.addEventListener('change', () => {
    STATE.circleMode = circleInp.checked;
    updateCellColors();
  });
  const offsetInp = document.getElementById('offsetRows');
  offsetInp === null || offsetInp === void 0 || offsetInp.addEventListener('change', () => {
    STATE.offset = offsetInp.checked;
    render();
  });
  const gridInp = document.getElementById('showGrid');
  gridInp === null || gridInp === void 0 || gridInp.addEventListener('change', () => {
    STATE.showGrid = gridInp.checked;
    updateGridVisibility();
  });
  labelModeSelect === null || labelModeSelect === void 0 || labelModeSelect.addEventListener('change', () => {
    STATE.labelMode = normalizeLabelMode(labelModeSelect.value);
    updatePanelLabels();
  });
  colorCountInp === null || colorCountInp === void 0 || colorCountInp.addEventListener('input', () => {
    STATE.colorCount = clampInt(colorCountInp.value, 1, colorInputs.length || MAX_COLORS);
    render();
  });
  colorInputs.forEach((inp, idx) => {
    inp.addEventListener('input', () => {
      modifiedColorIndexes.add(idx);
      autoPaletteEnabled = modifiedColorIndexes.size === 0;
      ensureColors(Math.max(idx + 1, STATE.colorCount));
      STATE.colors[idx] = inp.value;
      updateCellColors();
    });
  });
  addBtn === null || addBtn === void 0 || addBtn.addEventListener('click', () => {
    STATE.figures.push(createFigureState(`Figur ${STATE.figures.length + 1}`, rows, cols, []));
    render();
  });
  function removeFigure(index) {
    if (!Array.isArray(STATE.figures) || STATE.figures.length <= 1) return;
    STATE.figures.splice(index, 1);
    render();
  }
  const btnSvg = document.getElementById('btnSvg');
  const btnPng = document.getElementById('btnPng');
  const resetBtn = document.getElementById('resetBtn');
  function svgToString(svgEl) {
    const clone = svgEl.cloneNode(true);
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
    const vb = svgEl.viewBox.baseVal;
    const w = (vb === null || vb === void 0 ? void 0 : vb.width) || svgEl.clientWidth || cols * 40;
    const h = (vb === null || vb === void 0 ? void 0 : vb.height) || svgEl.clientHeight || rows * 40;
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
  function buildExportSvg() {
    const colors = getColors();
    const cellSize = 40;
    const figW = cols * cellSize + (STATE.offset ? cellSize / 2 : 0);
    const figH = rows * cellSize;
    const nameH = 24;
    const gap = 20;
    const figCount = boxes.length;
    const totalW = figCount > 0 ? figCount * figW + gap * (figCount - 1) : figW;
    const totalH = figH + nameH;
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('viewBox', `0 0 ${totalW} ${totalH}`);
    svg.setAttribute('width', totalW);
    svg.setAttribute('height', totalH);
    let xOffset = 0;
    boxes.forEach((box, figIndex) => {
      var _panel$querySelector;
      const panel = box.closest('.figurePanel');
      const nameInputValue = ((_panel$querySelector = panel.querySelector('.nameInput')) === null || _panel$querySelector === void 0 ? void 0 : _panel$querySelector.value) || '';
      const storedName = (() => {
        const figure = STATE.figures[figIndex];
        if (!figure || typeof figure.name !== 'string') return '';
        return figure.name;
      })();
      const normalizedName = typeof nameInputValue === 'string' && nameInputValue.trim() ? nameInputValue.trim() : typeof storedName === 'string' && storedName.trim() ? storedName.trim() : '';
      const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
      g.setAttribute('transform', `translate(${xOffset},0)`);
      box.querySelectorAll('.row').forEach((rowEl, r) => {
        rowEl.querySelectorAll('.cell').forEach((cellEl, c) => {
          const idx = parseInt(cellEl.dataset.color, 10) || 0;
          const x = c * cellSize + (STATE.offset && r % 2 === 1 ? cellSize / 2 : 0);
          const yPos = r * cellSize;
          const base = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
          base.setAttribute('x', x);
          base.setAttribute('y', yPos);
          base.setAttribute('width', cellSize);
          base.setAttribute('height', cellSize);
          base.setAttribute('fill', '#fff');
          if (STATE.showGrid) {
            base.setAttribute('stroke', '#d1d5db');
            base.setAttribute('stroke-width', '1');
          }
          g.appendChild(base);
          if (idx > 0) {
            if (STATE.circleMode) {
              const circ = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
              circ.setAttribute('cx', x + cellSize / 2);
              circ.setAttribute('cy', yPos + cellSize / 2);
              circ.setAttribute('r', cellSize / 2);
              circ.setAttribute('fill', colors[idx - 1]);
              g.appendChild(circ);
            } else {
              const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
              rect.setAttribute('x', x);
              rect.setAttribute('y', yPos);
              rect.setAttribute('width', cellSize);
              rect.setAttribute('height', cellSize);
              rect.setAttribute('fill', colors[idx - 1]);
              if (STATE.showGrid) {
                rect.setAttribute('stroke', '#d1d5db');
                rect.setAttribute('stroke-width', '1');
              }
              g.appendChild(rect);
            }
          }
        });
      });
      let labelText = '';
      if (STATE.labelMode === 'name') {
        labelText = normalizedName;
      } else if (STATE.labelMode === 'number') {
        labelText = String(figIndex + 1);
      }
      if (labelText) {
        const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        text.setAttribute('x', figW / 2);
        text.setAttribute('y', figH + 16);
        text.setAttribute('text-anchor', 'middle');
        text.setAttribute('font-size', '16');
        text.setAttribute('font-family', 'system-ui, sans-serif');
        text.textContent = labelText;
        g.appendChild(text);
      }
      svg.appendChild(g);
      xOffset += figW + gap;
    });
    return svg;
  }
  btnSvg === null || btnSvg === void 0 || btnSvg.addEventListener('click', () => {
    const svg = buildExportSvg();
    downloadSVG(svg, 'figurtall.svg');
  });
  btnPng === null || btnPng === void 0 || btnPng.addEventListener('click', () => {
    const svg = buildExportSvg();
    downloadPNG(svg, 'figurtall.png', 2);
  });
  function resetState() {
    STATE.rows = 3;
    STATE.cols = 3;
    STATE.circleMode = true;
    STATE.offset = true;
    STATE.showGrid = true;
    STATE.colorCount = 1;
    STATE.labelMode = 'name';
    STATE.colors = [];
    modifiedColorIndexes.clear();
    autoPaletteEnabled = true;
    lastAppliedPaletteSize = null;
    ensureColors(STATE.colorCount);
    STATE.figures = [];
  }
  function render() {
    sanitizeState();
    applyStateToControls();
    rebuildFigurePanels();
  }
  resetBtn === null || resetBtn === void 0 || resetBtn.addEventListener('click', () => {
    resetState();
    render();
  });
  render();
  updateFigureLayout();
  window.render = render;
})();
