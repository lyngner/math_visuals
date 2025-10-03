/* =========================================================
   KONFIG – forfatter styrer alt her
   ========================================================= */
const CFG = {
  type: 'bar',
  title: 'Favorittidretter i 5B',
  labels: ['Klatring', 'Fotball', 'Håndball', 'Basket', 'Tennis', 'Bowling'],
  series1: '',
  start: [6, 7, 3, 5, 8, 2],
  answer: [6, 7, 3, 5, 8, 2],
  yMin: 0,
  yMax: 8,
  snap: 1,
  tolerance: 0,
  axisXLabel: 'Idrett',
  axisYLabel: 'Antall elever',
  locked: [],
  altText: '',
  altTextSource: 'auto'
};
const DEFAULT_DIAGRAM_EXAMPLES = [{
  id: 'diagram-example-1',
  exampleNumber: '1',
  isDefault: true,
  config: {
    CFG: JSON.parse(JSON.stringify(CFG))
  }
}, {
  id: 'diagram-example-2',
  exampleNumber: '2',
  config: {
    CFG: {
      type: 'bar',
      title: 'Bøker lest i 5A',
      labels: ['Jan', 'Feb', 'Mar', 'Apr', 'Mai'],
      series1: '',
      start: [3, 5, 6, 4, 7],
      answer: [3, 5, 6, 4, 7],
      yMax: 8,
      snap: 1,
      tolerance: 0,
      axisXLabel: 'Måned',
      axisYLabel: 'Antall bøker',
      locked: []
    }
  }
}, {
  id: 'diagram-example-3',
  exampleNumber: '3',
  config: {
    CFG: {
      type: 'grouped',
      title: 'Fritidsaktiviteter',
      labels: ['Korps', 'Teater', 'Fotball', 'Sjakk'],
      series1: 'Jenter',
      start: [4, 6, 5, 3],
      answer: [4, 6, 5, 3],
      series2: 'Gutter',
      start2: [3, 2, 7, 4],
      answer2: [3, 2, 7, 4],
      yMax: 8,
      snap: 1,
      tolerance: 0,
      axisXLabel: 'Aktivitet',
      axisYLabel: 'Antall elever',
      locked: []
    }
  }
}, {
  id: 'diagram-example-4',
  exampleNumber: '4',
  config: {
    CFG: {
      type: 'stacked',
      title: 'Daglig skjermbruk',
      labels: ['1', '2', '3', '4', '5', '6', '7'],
      series1: 'Gutter',
      start: [2, 5, 5, 2, 3, 2, 1],
      answer: [2, 5, 5, 2, 3, 2, 1],
      series2: 'Jenter',
      start2: [1, 4, 3, 0, 1, 0, 0],
      answer2: [1, 4, 3, 0, 1, 0, 0],
      yMax: 9,
      snap: 1,
      tolerance: 0,
      axisXLabel: 'Timer per dag',
      axisYLabel: 'Antall elever',
      locked: []
    }
  }
}, {
  id: 'diagram-example-5',
  exampleNumber: '5',
  config: {
    CFG: {
      type: 'line',
      title: 'Temperatur over fem dager',
      labels: ['Dag 1', 'Dag 2', 'Dag 3', 'Dag 4', 'Dag 5'],
      series1: '',
      start: [-1, 2, 0, -3, -1],
      answer: [-1, 2, 0, -3, -1],
      yMin: -4,
      yMax: 4,
      snap: 1,
      tolerance: 0,
      axisXLabel: 'Dag',
      axisYLabel: 'Temperatur (°C)',
      locked: []
    }
  }
}, {
  id: 'diagram-example-6',
  exampleNumber: '6',
  config: {
    CFG: {
      type: 'pie',
      title: 'Hvordan får vi nyheter?',
      labels: ['TV', 'Internett', 'Bøker', 'Papiraviser', 'Radio'],
      series1: '',
      start: [30, 10, 20, 20, 20],
      answer: [30, 10, 20, 20, 20],
      snap: 1,
      tolerance: 0,
      axisXLabel: '',
      axisYLabel: '',
      locked: []
    }
  }
}];
window.DEFAULT_EXAMPLES = DEFAULT_DIAGRAM_EXAMPLES.map(ex => {
  var _ex$config, _ex$config2, _ex$config3, _ex$config4;
  return {
    ...ex,
    config: {
      ...ex.config,
      CFG: (_ex$config = ex.config) !== null && _ex$config !== void 0 && _ex$config.CFG ? JSON.parse(JSON.stringify(ex.config.CFG)) : undefined,
      STATE: (_ex$config2 = ex.config) !== null && _ex$config2 !== void 0 && _ex$config2.STATE ? JSON.parse(JSON.stringify(ex.config.STATE)) : undefined,
      CONFIG: (_ex$config3 = ex.config) !== null && _ex$config3 !== void 0 && _ex$config3.CONFIG ? JSON.parse(JSON.stringify(ex.config.CONFIG)) : undefined,
      SIMPLE: (_ex$config4 = ex.config) !== null && _ex$config4 !== void 0 && _ex$config4.SIMPLE ? JSON.parse(JSON.stringify(ex.config.SIMPLE)) : undefined
    }
  };
});

/* =========================================================
   OPPSETT
   ========================================================= */
const svg = document.getElementById('barsvg');
const W = 900,
  H = 560;
const M = {
  l: 80,
  r: 30,
  t: 40,
  b: 70
};
const innerW = W - M.l - M.r;
const innerH = H - M.t - M.b;

/* Lagrekkefølge: grid, akser, dataserier, håndtak, a11y, verdier (øverst), labels, legend */
const gGrid = add('g');
const gAxis = add('g');
const gBars = add('g');
const gHands = add('g');
const gA11y = add('g');
const gVals = add('g');
const gLabels = add('g');
const gLegend = add('g');
const PIE_COLORS = ['#4f2c8c', '#6c3db5', '#8a4de0', '#a75cf1', '#c26ef0', '#d381ba', '#c46287', '#9f436d', '#723a82', '#503070'];
let values = [];
let values2 = null;
let series2Enabled = false;
let seriesNames = [];
let locked = [];
let N = 0;
let yMin = 0;
let yMax = 0;
let yStep = 1;
const btnSvg = document.getElementById('btnSvg');
const btnPng = document.getElementById('btnPng');
btnSvg === null || btnSvg === void 0 || btnSvg.addEventListener('click', () => downloadSVG(svg, 'diagram.svg'));
btnPng === null || btnPng === void 0 || btnPng.addEventListener('click', () => downloadPNG(svg, 'diagram.png', 2));
const altTextField = document.getElementById('altText');
const altTextStatus = document.getElementById('altTextStatus');
const regenerateAltTextBtn = document.getElementById('btnRegenerateAltText');
let altTextGenerationTimer = null;
let altTextAbortController = null;
if (altTextField) {
  altTextField.addEventListener('input', () => {
    const text = altTextField.value.trim();
    if (altTextGenerationTimer) {
      clearTimeout(altTextGenerationTimer);
      altTextGenerationTimer = null;
    }
    if (altTextAbortController && typeof altTextAbortController.abort === 'function') {
      try {
        altTextAbortController.abort();
      } catch (error) {}
      altTextAbortController = null;
    }
    CFG.altText = text;
    CFG.altTextSource = text ? 'manual' : 'auto';
    applyAltTextToSvg(text);
    if (text) {
      setAltTextStatus('Alternativ tekst oppdatert manuelt.', false);
    } else {
      setAltTextStatus('Feltet er tomt. Generer gjerne en ny tekst.', false);
      scheduleAltTextUpdate('manual', 0);
    }
  });
}
if (regenerateAltTextBtn) {
  regenerateAltTextBtn.addEventListener('click', () => {
    CFG.altTextSource = 'auto';
    scheduleAltTextUpdate('manual', 0);
  });
}
const addSeriesBtn = document.getElementById('addSeries');
const series2Fields = document.getElementById('series2Fields');
addSeriesBtn === null || addSeriesBtn === void 0 || addSeriesBtn.addEventListener('click', () => {
  series2Enabled = true;
  addSeriesBtn.style.display = 'none';
  if (series2Fields) series2Fields.style.display = '';
  applyCfg();
});
// skalaer
let xBand = 0;
let barW = 0;
function xPos(i) {
  return M.l + xBand * i + xBand / 2;
}
function yPos(v) {
  if (yMax === yMin) return M.t + innerH / 2;
  return M.t + innerH - (v - yMin) / (yMax - yMin) * innerH;
}

// husk sist fokusert søyle mellom redraw
let lastFocusIndex = null;
initFromCfg();
function initFromCfg() {
  var _CFG$yMax;
  const hasSeries2Config = Array.isArray(CFG.start2) && CFG.start2.length > 0 || Array.isArray(CFG.answer2) && CFG.answer2.length > 0 || typeof CFG.series2 === 'string' && CFG.series2.trim().length > 0;
  series2Enabled = hasSeries2Config;
  values = CFG.start.slice();
  values2 = series2Enabled && CFG.start2 ? CFG.start2.slice() : null;
  seriesNames = [CFG.series1 || '', series2Enabled ? CFG.series2 || '' : ''];
  N = CFG.labels.length;
  xBand = innerW / N;
  barW = xBand * 0.6;
  const allVals = [...CFG.start, ...(CFG.start2 || []), ...(CFG.answer || []), ...(CFG.answer2 || [])];
  const scale = computeScaleBounds(allVals, CFG.yMin, CFG.yMax);
  yMin = scale.min;
  yMax = scale.max;
  yStep = scale.step;
  locked = alignLength(CFG.locked || [], N, false);
  lastFocusIndex = null;
  document.getElementById('chartTitle').textContent = CFG.title || '';
  const typeInput = document.getElementById('cfgType');
  const titleInput = document.getElementById('cfgTitle');
  const labelsInput = document.getElementById('cfgLabels');
  const lockedInput = document.getElementById('cfgLocked');
  const yMinInput = document.getElementById('cfgYMin');
  const yMaxInput = document.getElementById('cfgYMax');
  const axisXInput = document.getElementById('cfgAxisXLabel');
  const axisYInput = document.getElementById('cfgAxisYLabel');
  const snapInput = document.getElementById('cfgSnap');
  const tolInput = document.getElementById('cfgTolerance');
  const series1Input = document.getElementById('cfgSeries1');
  const startInput = document.getElementById('cfgStart');
  const answerInput = document.getElementById('cfgAnswer');
  const series2Input = document.getElementById('cfgSeries2');
  const start2Input = document.getElementById('cfgStart2');
  const answer2Input = document.getElementById('cfgAnswer2');
  if (titleInput) titleInput.value = CFG.title || '';
  if (labelsInput) labelsInput.value = (CFG.labels || []).join(',');
  if (lockedInput) {
    const lockedStr = locked.some(Boolean) ? locked.map(v => v ? '1' : '0').join(',') : '';
    lockedInput.value = lockedStr;
  }
  if (yMinInput) yMinInput.value = Number.isFinite(CFG.yMin) ? formatNumber(CFG.yMin) : '';
  if (yMaxInput) yMaxInput.value = Number.isFinite(CFG.yMax) ? formatNumber(CFG.yMax) : '';
  if (axisXInput) axisXInput.value = CFG.axisXLabel || '';
  if (axisYInput) axisYInput.value = CFG.axisYLabel || '';
  if (snapInput) snapInput.value = Number.isFinite(CFG.snap) ? formatNumber(CFG.snap) : '';
  if (tolInput) tolInput.value = Number.isFinite(CFG.tolerance) ? formatNumber(CFG.tolerance) : '';
  if (series1Input) series1Input.value = CFG.series1 || '';
  if (startInput) startInput.value = formatNumberList(values);
  if (answerInput) answerInput.value = formatNumberList(CFG.answer || []);
  if (addSeriesBtn) {
    addSeriesBtn.style.display = series2Enabled ? 'none' : '';
  }
  if (series2Fields) {
    series2Fields.style.display = series2Enabled ? '' : 'none';
  }
  if (series2Input) series2Input.value = series2Enabled ? CFG.series2 || '' : '';
  if (start2Input) start2Input.value = series2Enabled && Array.isArray(values2) ? formatNumberList(values2) : '';
  if (answer2Input) answer2Input.value = series2Enabled && Array.isArray(CFG.answer2) ? formatNumberList(CFG.answer2) : '';
  if (typeof CFG.altText !== 'string') CFG.altText = '';
  if (typeof CFG.altTextSource !== 'string') {
    CFG.altTextSource = CFG.altText ? 'manual' : 'auto';
  }
  if (altTextField) altTextField.value = CFG.altText || '';
  applyAltTextToSvg(CFG.altText || '');

  // disable stacking/grouping options when only one dataserie
  const typeSel = typeInput;
  const hasTwo = values2 && values2.length;
  if (typeSel) {
    [...typeSel.options].forEach(opt => {
      if (opt.value === 'pie') {
        opt.disabled = !!hasTwo;
      } else if (!hasTwo && (opt.value === 'stacked' || opt.value === 'grouped')) {
        opt.disabled = true;
      } else {
        opt.disabled = false;
      }
    });
    const order = hasTwo ? ['bar', 'grouped', 'stacked', 'line', 'pie'] : ['bar', 'line', 'pie', 'grouped', 'stacked'];
    order.forEach(val => {
      const opt = typeSel.querySelector(`option[value="${val}"]`);
      if (opt) typeSel.appendChild(opt);
    });
    const allowedTypes = hasTwo ? ['bar', 'grouped', 'stacked', 'line'] : ['bar', 'line', 'pie'];
    const desiredType = allowedTypes.includes(CFG.type) ? CFG.type : 'bar';
    typeSel.value = desiredType;
    CFG.type = desiredType;
  }
  drawAxesAndGrid();
  drawData();
  let statusMessage = '';
  if ((CFG.type === 'bar' || CFG.type === 'line') && !hasTwo) {
    statusMessage = 'Dra i søylene/punktene – eller bruk tastaturet.';
  } else if (CFG.type === 'pie') {
    statusMessage = 'Dra i sektorene – eller bruk tastaturet.';
  }
  updateStatus(statusMessage);
  scheduleAltTextUpdate('config');
}

/* =========================================================
   RENDER
   ========================================================= */
function drawAxesAndGrid() {
  gGrid.innerHTML = '';
  gAxis.innerHTML = '';
  gLabels.innerHTML = '';
  if (CFG.type === 'pie') {
    return;
  }
  const step = yStep || niceStep(yMax - yMin || 1);
  const maxTicks = 500;
  for (let i = 0; i < maxTicks; i++) {
    const raw = yMin + step * i;
    if (raw > yMax + step * 0.5) break;
    const value = normalizeTickValue(raw);
    const yy = yPos(value);
    addTo(gGrid, 'line', {
      x1: M.l,
      y1: yy,
      x2: W - M.r,
      y2: yy,
      class: 'gridline'
    });
    addTo(gGrid, 'text', {
      x: M.l - 6,
      y: yy + 4,
      class: 'yTickText'
    }).textContent = formatTickValue(value);
  }

  // y-akse
  addTo(gAxis, 'line', {
    x1: M.l,
    y1: M.t - 8,
    x2: M.l,
    y2: H - M.b,
    class: 'axis'
  });
  // x-akse
  const baseValue = getBaselineValue();
  const axisY = yPos(baseValue);
  addTo(gAxis, 'line', {
    x1: M.l,
    y1: axisY,
    x2: W - M.r,
    y2: axisY,
    class: 'axis'
  });

  // x-etiketter
  CFG.labels.forEach((lab, i) => {
    addTo(gLabels, 'text', {
      x: xPos(i),
      y: H - M.b + 28,
      class: 'xLabel'
    }).textContent = lab;
  });

  // aksetekster
  const yLab = addTo(gLabels, 'text', {
    x: M.l - 56,
    y: M.t + innerH / 2,
    class: 'yLabel'
  });
  yLab.setAttribute('transform', `rotate(-90, ${M.l - 56}, ${M.t + innerH / 2})`);
  yLab.textContent = CFG.axisYLabel || '';
  addTo(gLabels, 'text', {
    x: M.l + innerW / 2,
    y: H - 24,
    class: 'xAxisLabel'
  }).textContent = CFG.axisXLabel || '';
}
function drawData() {
  gBars.innerHTML = '';
  gVals.innerHTML = '';
  gHands.innerHTML = '';
  gA11y.innerHTML = '';
  gLegend.innerHTML = '';
  if (CFG.type === 'pie') {
    drawPie();
    return;
  }
  const hasTwo = values2 && values2.length;
  if (CFG.type === 'line') {
    drawLines();
  } else if (hasTwo && CFG.type === 'grouped') {
    drawGroupedBars();
  } else if (hasTwo && CFG.type === 'stacked') {
    drawStackedBars();
  } else {
    drawBars();
  }
  drawLegend();
}
function drawLegend() {
  const names = [];
  if (seriesNames[0]) names.push({
    name: seriesNames[0],
    cls: 'series0'
  });
  if (values2 && values2.length && seriesNames[1]) names.push({
    name: seriesNames[1],
    cls: 'series1'
  });
  names.forEach((s, i) => {
    const x = M.l + i * 120;
    const y = M.t - 10;
    addTo(gLegend, 'rect', {
      x: x,
      y: y - 10,
      width: 20,
      height: 10,
      class: 'legendbox ' + s.cls
    });
    addTo(gLegend, 'text', {
      x: x + 26,
      y: y,
      class: 'legendtext'
    }).textContent = s.name;
  });
}
function drawLines() {
  const datasets = [values];
  if (values2 && values2.length) datasets.push(values2);
  datasets.forEach((arr, idx) => {
    const path = arr.map((v, i) => (i ? 'L' : 'M') + xPos(i) + ',' + yPos(v)).join(' ');
    addTo(gBars, 'path', {
      d: path,
      class: 'line series' + idx
    });
    arr.forEach((v, i) => {
      const cx = xPos(i);
      const cy = yPos(v);
      addTo(gBars, 'circle', {
        cx: cx,
        cy: cy,
        r: 4,
        class: 'line-dot series' + idx
      });
      if (!locked[i]) {
        addTo(gHands, 'circle', {
          cx: cx,
          cy: cy + 2,
          r: 16,
          class: 'handleShadow'
        });
        const h = addTo(gHands, 'circle', {
          cx: cx,
          cy: cy,
          r: 14,
          class: 'handle'
        });
        h.dataset.index = i;
        h.dataset.series = idx;
        h.dataset.base = 0;
        h.addEventListener('pointerdown', onDragStart);
      }
      const a11y = addTo(gA11y, 'circle', {
        cx: cx,
        cy: cy,
        r: 20,
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
      if (locked[i]) a11y.setAttribute('aria-disabled', 'true');
      a11y.dataset.index = i;
      a11y.dataset.series = idx;
      a11y.dataset.base = 0;
      a11y.addEventListener('pointerdown', onDragStart);
      a11y.addEventListener('keydown', onKeyAdjust);
    });
  });
}
function drawPie() {
  const count = values.length;
  if (!count) {
    const message = addTo(gLabels, 'text', {
      x: W / 2,
      y: H / 2,
      class: 'pie-label',
      'text-anchor': 'middle'
    });
    message.textContent = 'Ingen data';
    return;
  }
  const cx = M.l + innerW / 2;
  const cy = M.t + innerH / 2;
  const radius = Math.min(innerW, innerH) * 0.42;
  const sanitized = values.map(v => Math.max(0, Number.isFinite(v) ? v : 0));
  const total = sanitized.reduce((sum, v) => sum + v, 0);
  let currentAngle = -Math.PI / 2;
  const labelRadius = radius * 1.15;
  const fallbackFraction = count ? 1 / count : 0;
  for (let i = 0; i < count; i++) {
    const value = sanitized[i];
    const share = total > 0 ? value / total : fallbackFraction;
    const sliceAngle = Math.max(0, share) * Math.PI * 2;
    const startAngle = currentAngle;
    const endAngle = currentAngle + sliceAngle;
    addTo(gGrid, 'line', {
      x1: cx,
      y1: cy,
      x2: cx + radius * Math.cos(startAngle),
      y2: cy + radius * Math.sin(startAngle),
      class: 'pie-divider'
    });
    const colorClass = 'pie-slice-' + (i % PIE_COLORS.length);
    const lockedCls = locked[i] ? ' locked' : '';
    const pathData = buildPieSlicePath(cx, cy, radius, startAngle, endAngle);
    const slice = addTo(gBars, 'path', {
      d: pathData,
      class: `pie-slice ${colorClass}${lockedCls}`
    });
    slice.dataset.index = i;
    slice.dataset.series = 0;
    slice.dataset.base = 0;
    if (!locked[i]) {
      slice.addEventListener('pointerdown', onDragStart);
    }
    const midAngle = startAngle + sliceAngle / 2;
    const lx = cx + labelRadius * Math.cos(midAngle);
    const ly = cy + labelRadius * Math.sin(midAngle);
    const label = typeof CFG.labels[i] === 'string' && CFG.labels[i].trim().length ? CFG.labels[i].trim() : `Kategori ${i + 1}`;
    const percent = share > 0 ? share * 100 : total > 0 ? 0 : fallbackFraction * 100;
    const textAnchor = lx >= cx ? 'start' : 'end';
    const baseline = ly >= cy ? 'hanging' : 'auto';
    const textEl = addTo(gLabels, 'text', {
      x: lx,
      y: ly,
      class: 'pie-label',
      'text-anchor': textAnchor,
      'dominant-baseline': baseline
    });
    textEl.textContent = label;
    const percentLine = document.createElementNS(svg.namespaceURI, 'tspan');
    percentLine.setAttribute('x', lx);
    percentLine.setAttribute('dy', ly >= cy ? '1.1em' : '1.2em');
    percentLine.textContent = formatPercent(percent);
    percentLine.setAttribute('class', 'pie-label__percent');
    textEl.appendChild(percentLine);
    const a11y = addTo(gA11y, 'path', {
      d: pathData,
      fill: 'transparent',
      class: 'a11y',
      tabindex: 0,
      role: 'slider',
      'aria-orientation': 'vertical',
      'aria-label': label,
      'aria-valuemin': String(Math.max(0, yMin)),
      'aria-valuemax': String(Math.max(Math.max(0, yMax), sanitized[i])),
      'aria-valuenow': String(values[i]),
      'aria-valuetext': `${label}: ${fmt(values[i])}`
    });
    if (locked[i]) a11y.setAttribute('aria-disabled', 'true');
    a11y.dataset.index = i;
    a11y.dataset.series = 0;
    a11y.dataset.base = 0;
    a11y.addEventListener('keydown', onKeyAdjust);
    if (!locked[i]) {
      a11y.addEventListener('pointerdown', onDragStart);
    }
    currentAngle = endAngle;
  }
  addTo(gGrid, 'line', {
    x1: cx,
    y1: cy,
    x2: cx + radius * Math.cos(currentAngle),
    y2: cy + radius * Math.sin(currentAngle),
    class: 'pie-divider'
  });
}
function drawGroupedBars() {
  const hasTwo = values2 && values2.length;
  const barTotal = xBand * 0.6;
  const barSingle = hasTwo ? barTotal / 2 : barTotal;
  const baseValue = getBaselineValue();
  const baseY = yPos(baseValue);
  for (let i = 0; i < N; i++) {
    const x0 = xPos(i) - barTotal / 2;
    // serie 1
    const v1 = values[i];
    const y1 = yPos(v1);
    const rect1Y = Math.min(y1, baseY);
    const rect1H = Math.max(2, Math.abs(baseY - y1));
    const handleDir1 = y1 <= baseY ? -1 : 1;
    const rect1 = addTo(gBars, 'rect', {
      x: x0,
      y: rect1Y,
      width: barSingle,
      height: rect1H,
      class: 'bar series0' + (locked[i] ? ' locked' : '')
    });
    rect1.dataset.index = i;
    rect1.dataset.series = 0;
    rect1.dataset.base = 0;
    rect1.addEventListener('pointerdown', onDragStart);
    if (!locked[i]) {
      addTo(gHands, 'circle', {
        cx: x0 + barSingle / 2,
        cy: y1,
        r: 16,
        class: 'handleShadow'
      });
      const h1 = addTo(gHands, 'circle', {
        cx: x0 + barSingle / 2,
        cy: y1 + handleDir1 * 2,
        r: 14,
        class: 'handle'
      });
      h1.dataset.index = i;
      h1.dataset.series = 0;
      h1.dataset.base = 0;
      h1.addEventListener('pointerdown', onDragStart);
    }
    const a1 = addTo(gA11y, 'rect', {
      x: x0,
      y: M.t,
      width: barSingle,
      height: innerH,
      fill: 'transparent',
      class: 'a11y',
      tabindex: 0,
      role: 'slider',
      'aria-orientation': 'vertical',
      'aria-label': `${CFG.labels[i]}`,
      'aria-valuemin': String(yMin),
      'aria-valuemax': String(yMax),
      'aria-valuenow': String(v1),
      'aria-valuetext': `${CFG.labels[i]}: ${fmt(v1)}`
    });
    if (locked[i]) a1.setAttribute('aria-disabled', 'true');
    a1.dataset.index = i;
    a1.dataset.series = 0;
    a1.dataset.base = 0;
    a1.addEventListener('pointerdown', onDragStart);
    a1.addEventListener('keydown', onKeyAdjust);
    // Verdietikettene fjernet

    if (hasTwo) {
      const v2 = values2[i];
      const y2 = yPos(v2);
      const x1 = x0 + barSingle;
      const rect2Y = Math.min(y2, baseY);
      const rect2H = Math.max(2, Math.abs(baseY - y2));
      const handleDir2 = y2 <= baseY ? -1 : 1;
      const rect2 = addTo(gBars, 'rect', {
        x: x1,
        y: rect2Y,
        width: barSingle,
        height: rect2H,
        class: 'bar series1' + (locked[i] ? ' locked' : '')
      });
      rect2.dataset.index = i;
      rect2.dataset.series = 1;
      rect2.dataset.base = 0;
      rect2.addEventListener('pointerdown', onDragStart);
      if (!locked[i]) {
        addTo(gHands, 'circle', {
          cx: x1 + barSingle / 2,
          cy: y2,
          r: 16,
          class: 'handleShadow'
        });
        const h2 = addTo(gHands, 'circle', {
          cx: x1 + barSingle / 2,
          cy: y2 + handleDir2 * 2,
          r: 14,
          class: 'handle'
        });
        h2.dataset.index = i;
        h2.dataset.series = 1;
        h2.dataset.base = 0;
        h2.addEventListener('pointerdown', onDragStart);
      }
      const a2 = addTo(gA11y, 'rect', {
        x: x1,
        y: M.t,
        width: barSingle,
        height: innerH,
        fill: 'transparent',
        class: 'a11y',
        tabindex: 0,
        role: 'slider',
        'aria-orientation': 'vertical',
        'aria-label': `${CFG.labels[i]}`,
        'aria-valuemin': String(yMin),
        'aria-valuemax': String(yMax),
        'aria-valuenow': String(v2),
        'aria-valuetext': `${CFG.labels[i]}: ${fmt(v2)}`
      });
      if (locked[i]) a2.setAttribute('aria-disabled', 'true');
      a2.dataset.index = i;
      a2.dataset.series = 1;
      a2.dataset.base = 0;
      a2.addEventListener('pointerdown', onDragStart);
      a2.addEventListener('keydown', onKeyAdjust);
      // Verdietikettene fjernet
    }
  }
}
function drawStackedBars() {
  const barTotal = xBand * 0.6;
  const baseValue = getBaselineValue();
  const baseY = yPos(baseValue);
  for (let i = 0; i < N; i++) {
    const v1 = values[i];
    const v2 = values2 ? values2[i] : 0;
    const cx = xPos(i);
    const y1 = yPos(v1);
    const rect1Y = Math.min(y1, baseY);
    const rect1H = Math.max(2, Math.abs(baseY - y1));
    const handleDir1 = y1 <= baseY ? -1 : 1;
    const rect1 = addTo(gBars, 'rect', {
      x: cx - barTotal / 2,
      y: rect1Y,
      width: barTotal,
      height: rect1H,
      class: 'bar series0' + (locked[i] ? ' locked' : '')
    });
    rect1.dataset.index = i;
    rect1.dataset.series = 0;
    rect1.dataset.base = 0;
    rect1.addEventListener('pointerdown', onDragStart);
    if (!locked[i]) {
      addTo(gHands, 'circle', {
        cx: cx,
        cy: y1,
        r: 16,
        class: 'handleShadow'
      });
      const h1 = addTo(gHands, 'circle', {
        cx: cx,
        cy: y1 + handleDir1 * 2,
        r: 14,
        class: 'handle'
      });
      h1.dataset.index = i;
      h1.dataset.series = 0;
      h1.dataset.base = 0;
      h1.addEventListener('pointerdown', onDragStart);
    }
    const a1 = addTo(gA11y, 'rect', {
      x: cx - barTotal / 2,
      y: rect1Y,
      width: barTotal,
      height: rect1H,
      fill: 'transparent',
      class: 'a11y',
      tabindex: 0,
      role: 'slider',
      'aria-orientation': 'vertical',
      'aria-label': `${CFG.labels[i]}`,
      'aria-valuemin': String(yMin),
      'aria-valuemax': String(yMax - v2),
      'aria-valuenow': String(v1),
      'aria-valuetext': `${CFG.labels[i]}: ${fmt(v1)}`
    });
    if (locked[i]) a1.setAttribute('aria-disabled', 'true');
    a1.dataset.index = i;
    a1.dataset.series = 0;
    a1.dataset.base = 0;
    a1.addEventListener('pointerdown', onDragStart);
    a1.addEventListener('keydown', onKeyAdjust);
    // Verdietikettene fjernet

    if (values2) {
      const y2 = yPos(v1 + v2);
      const rect2Y = Math.min(y2, y1);
      const rect2H = Math.max(2, Math.abs(y1 - y2));
      const handleDir2 = y2 <= y1 ? -1 : 1;
      const rect2 = addTo(gBars, 'rect', {
        x: cx - barTotal / 2,
        y: rect2Y,
        width: barTotal,
        height: rect2H,
        class: 'bar series1' + (locked[i] ? ' locked' : '')
      });
      rect2.dataset.index = i;
      rect2.dataset.series = 1;
      rect2.dataset.base = v1;
      rect2.addEventListener('pointerdown', onDragStart);
      if (!locked[i]) {
        addTo(gHands, 'circle', {
          cx: cx,
          cy: y2,
          r: 16,
          class: 'handleShadow'
        });
        const h2 = addTo(gHands, 'circle', {
          cx: cx,
          cy: y2 + handleDir2 * 2,
          r: 14,
          class: 'handle'
        });
        h2.dataset.index = i;
        h2.dataset.series = 1;
        h2.dataset.base = v1;
        h2.addEventListener('pointerdown', onDragStart);
      }
      const a2 = addTo(gA11y, 'rect', {
        x: cx - barTotal / 2,
        y: rect2Y,
        width: barTotal,
        height: rect2H,
        fill: 'transparent',
        class: 'a11y',
        tabindex: 0,
        role: 'slider',
        'aria-orientation': 'vertical',
        'aria-label': `${CFG.labels[i]}`,
        'aria-valuemin': String(yMin),
        'aria-valuemax': String(yMax),
        'aria-valuenow': String(v2),
        'aria-valuetext': `${CFG.labels[i]}: ${fmt(v2)}`
      });
      if (locked[i]) a2.setAttribute('aria-disabled', 'true');
      a2.dataset.index = i;
      a2.dataset.series = 1;
      a2.dataset.base = v1;
      a2.addEventListener('pointerdown', onDragStart);
      a2.addEventListener('keydown', onKeyAdjust);
      // Verdietikettene fjernet
    }
  }
}
function drawBars() {
  gBars.innerHTML = '';
  gVals.innerHTML = '';
  gHands.innerHTML = '';
  gA11y.innerHTML = '';
  const baseValue = getBaselineValue();
  const baseY = yPos(baseValue);
  values.forEach((v, i) => {
    const cx = xPos(i);
    const y = yPos(v);
    const rectY = Math.min(y, baseY);
    const rectHeight = Math.max(2, Math.abs(baseY - y));
    const handleDirection = y <= baseY ? -1 : 1;
    const handleCenter = y + handleDirection * 2;

    // 1) SØYLE (draggbar)
    const rect = addTo(gBars, 'rect', {
      x: cx - barW / 2,
      y: rectY,
      width: barW,
      height: rectHeight,
      class: 'bar series0' + (locked[i] ? ' locked' : '')
    });
    rect.dataset.index = i;
    rect.dataset.series = 0;
    rect.dataset.base = 0;
    rect.addEventListener('pointerdown', onDragStart);

    // 2) HÅNDTAK (draggbar)
    if (!locked[i]) {
      addTo(gHands, 'circle', {
        cx: cx,
        cy: y,
        r: 16,
        class: 'handleShadow'
      });
      const h = addTo(gHands, 'circle', {
        cx: cx,
        cy: handleCenter,
        r: 14,
        class: 'handle'
      });
      h.dataset.index = i;
      h.dataset.series = 0;
      h.dataset.base = 0;
      h.addEventListener('pointerdown', onDragStart);
    }

    // 3) A11y‐overlay (fokus + tastatur + stor klikkflate)
    const a11y = addTo(gA11y, 'rect', {
      x: cx - xBand * 0.5,
      y: M.t,
      width: xBand * 0.98,
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
    if (locked[i]) a11y.setAttribute('aria-disabled', 'true');
    a11y.dataset.index = i;
    a11y.dataset.series = 0;
    a11y.dataset.base = 0;
    a11y.addEventListener('pointerdown', onDragStart);
    a11y.addEventListener('keydown', onKeyAdjust);

    // gjenopprett fokus på samme søyle synkront
    if (lastFocusIndex === i) {
      a11y.focus({
        preventScroll: true
      });
    }

    // 4) Verdi (øverst, ikke-interaktiv)
    // Verdietikettene fjernet
  });
}

/* =========================================================
   DRAGGING (mus/berøring)
   ========================================================= */
function onDragStart(e) {
  e.preventDefault();
  const target = e.currentTarget;
  const idx = +target.dataset.index;
  let series = +target.dataset.series || 0;
  if (locked[idx]) return;
  lastFocusIndex = idx;
  let base = +target.dataset.base || 0;
  if (CFG.type === 'stacked' && values2 && values2.length) {
    const pointer = clientToSvg(e.clientX, e.clientY);
    const boundaryY = yPos(values[idx]);
    const margin = 12;
    if (series === 1 && pointer.y >= boundaryY - margin) {
      series = 0;
      base = 0;
    } else if (series === 0 && pointer.y < boundaryY - margin) {
      series = 1;
      base = values[idx];
    }
  }
  const move = ev => {
    ev.preventDefault();
    const p = clientToSvg(ev.clientX, ev.clientY);
    const clampedY = Math.min(H - M.b, Math.max(M.t, p.y));
    const v = yToValue(clampedY) - base;
    setValue(idx, v, true, series);
  };
  const up = ev => {
    ev.preventDefault();
    window.removeEventListener('pointermove', move);
    window.removeEventListener('pointerup', up);
    if (target.releasePointerCapture) {
      try {
        target.releasePointerCapture(ev.pointerId);
      } catch (error) {}
    }
  };
  window.addEventListener('pointermove', move, {
    passive: false
  });
  window.addEventListener('pointerup', up, {
    passive: false
  });
  if (target.setPointerCapture) {
    try {
      target.setPointerCapture(e.pointerId);
    } catch (error) {}
  }
}

/* =========================================================
   TASTATUR (UU)
   ========================================================= */
function onKeyAdjust(e) {
  const idx = +e.currentTarget.dataset.index;
  const series = +e.currentTarget.dataset.series || 0;
  if (locked[idx]) return;
  lastFocusIndex = idx;
  const step = CFG.snap || 1;
  const big = step * 5;
  let target = series === 0 ? values[idx] : values2 ? values2[idx] : 0;
  switch (e.key) {
    case 'ArrowUp':
    case 'ArrowRight':
      target += step;
      break;
    case 'ArrowDown':
    case 'ArrowLeft':
      target -= step;
      break;
    case 'PageUp':
      target += big;
      break;
    case 'PageDown':
      target -= big;
      break;
    case 'Home':
      target = yMin;
      break;
    case 'End':
      target = yMax - (series === 0 ? values2 ? values2[idx] : 0 : values[idx]);
      break;
    default:
      return;
  }
  e.preventDefault();
  setValue(idx, target, true, series);
}

/* =========================================================
   STATE / BEREGNING
   ========================================================= */
function setValue(idx, newVal, announce = false, series = 0) {
  if (locked[idx]) return;
  const other = series === 0 ? values2 ? values2[idx] : 0 : values[idx];
  const snapped = snap(newVal, CFG.snap || 1);
  const v = clamp(snapped, yMin, yMax - other);
  if (series === 0) {
    values[idx] = v;
  } else {
    if (!values2) values2 = alignLength([], N, 0);
    values2[idx] = v;
  }
  syncConfigFromValues(series);
  drawData(); // oppdater grafikk + aria
  scheduleAltTextUpdate('data');
  if (announce) {
    const sName = seriesNames[series] || '';
    const label = sName ? `${CFG.labels[idx]} – ${sName}` : `${CFG.labels[idx]}`;
    updateStatus(`${label}: ${fmt(v)}`);
  }
}
function yToValue(py) {
  const frac = (H - M.b - py) / innerH; // inverse av yPos
  return yMin + frac * (yMax - yMin);
}
function syncConfigFromValues(series) {
  const updateInput = (id, arr) => {
    const input = document.getElementById(id);
    if (input) input.value = formatNumberList(arr);
  };
  if (series === 0) {
    CFG.start = values.slice();
    updateInput('cfgStart', values);
  } else if (series === 1 && values2) {
    CFG.start2 = values2.slice();
    updateInput('cfgStart2', values2);
  }
}

/* =========================================================
   ALT-TEKST (AI)
   ========================================================= */
function scheduleAltTextUpdate(reason = 'auto', delayOverride) {
  if (!altTextField) return;
  applyAltTextToSvg(CFG.altText || '');
  if (!shouldAutoGenerateAltText()) return;
  const delay = typeof delayOverride === 'number' ? Math.max(0, delayOverride) : reason === 'manual' ? 0 : 800;
  if (altTextGenerationTimer) {
    clearTimeout(altTextGenerationTimer);
    altTextGenerationTimer = null;
  }
  altTextGenerationTimer = setTimeout(() => {
    altTextGenerationTimer = null;
    generateAltText(reason);
  }, delay);
}
function shouldAutoGenerateAltText() {
  const text = typeof CFG.altText === 'string' ? CFG.altText.trim() : '';
  if (!text) return true;
  return (CFG.altTextSource || 'auto') !== 'manual';
}
function generateAltText(reason = 'auto') {
  if (!altTextField) return;
  if (altTextAbortController && typeof altTextAbortController.abort === 'function') {
    try {
      altTextAbortController.abort();
    } catch (error) {}
  }
  const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
  if (controller) {
    altTextAbortController = controller;
  } else {
    altTextAbortController = null;
  }
  setAltTextStatus('Genererer alternativ tekst …', false);
  const context = collectAltTextContext();
  requestAltText(context, controller ? controller.signal : undefined).then(text => {
    if (controller && controller.signal.aborted) return;
    const trimmed = (text || '').trim();
    if (!trimmed) throw new Error('Empty alt-text');
    setAltText(trimmed, 'auto');
    setAltTextStatus('Alternativ tekst oppdatert.', false);
  }).catch(async error => {
    if (controller && controller.signal.aborted) return;
    console.warn('Alt-tekstgenerering feilet', error);
    let svgBasedText = null;
    try {
      svgBasedText = await generateAltTextFromSvg(context, controller ? controller.signal : undefined);
    } catch (svgError) {
      if (!(controller && controller.signal.aborted)) {
        console.warn('Alt-tekst fra SVG feilet', svgError);
      }
    }
    if (controller && controller.signal.aborted) return;
    const trimmedSvgText = svgBasedText && svgBasedText.trim ? svgBasedText.trim() : svgBasedText;
    if (trimmedSvgText) {
      setAltText(trimmedSvgText, 'auto');
      setAltTextStatus('Alternativ tekst generert fra eksportert SVG.', false);
      return;
    }
    const fallback = buildHeuristicAltText(context);
    setAltText(fallback, 'auto');
    setAltTextStatus('Viser en enkel beskrivelse.');
  }).finally(() => {
    if (altTextAbortController === controller) {
      altTextAbortController = null;
    }
  });
}
async function requestAltText(context, signal) {
  const prompt = buildAltTextPrompt(context);
  return performAltTextRequest(prompt, signal);
}
async function performAltTextRequest(prompt, signal) {
  let backendError = null;
  try {
    const endpoint = resolveAltTextEndpoint();
    if (endpoint) {
      return await requestAltTextFromBackend(endpoint, prompt, signal);
    }
  } catch (error) {
    backendError = error;
    if (error) console.warn('Alt-tekst backend utilgjengelig', error);
  }
  try {
    return await requestAltTextDirect(prompt, signal);
  } catch (error) {
    if (backendError) console.warn('Alt-tekst direktkall feilet etter backend', error);
    throw error;
  }
}
async function requestAltTextFromBackend(endpoint, prompt, signal) {
  const res = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      prompt
    }),
    signal
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Backend error ${res.status}${text ? `: ${text}` : ''}`);
  }
  const data = await res.json().catch(() => null);
  if (!data || typeof data.text !== 'string') {
    throw new Error('Ugyldig svar fra alt-tekst-tjenesten');
  }
  const txt = data.text.trim();
  if (!txt) throw new Error('Tom alt-tekst fra tjenesten');
  return txt;
}
async function requestAltTextDirect(prompt, signal) {
  const apiKey = typeof window !== 'undefined' ? window.OPENAI_API_KEY : null;
  if (!apiKey) throw new Error('Mangler API-nøkkel for direktekall');
  const body = {
    model: 'gpt-4o-mini',
    messages: [{
      role: 'system',
      content: 'Du skriver korte og tydelige alternative tekster (2–3 setninger) på norsk for diagrammer. Inkluder hovedtendenser, topper/bunner og hva aksene viser. Ingen punktlister eller Markdown.'
    }, {
      role: 'user',
      content: prompt
    }],
    temperature: 0.4
  };
  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`
    },
    body: JSON.stringify(body),
    signal
  });
  const data = await res.json().catch(() => null);
  if (!res.ok) {
    const err = data && data.error ? data.error.message || JSON.stringify(data.error) : res.statusText;
    throw new Error(`OpenAI error ${res.status}${err ? `: ${err}` : ''}`);
  }
  const txt = data && data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content;
  if (!txt) throw new Error('Ingen tekst mottatt fra OpenAI');
  return txt.trim();
}
async function generateAltTextFromSvg(context, signal) {
  if (!svg) return null;
  let markup = null;
  try {
    markup = await svgToString(svg);
  } catch (error) {
    console.warn('Kunne ikke serialisere SVG for alt-tekst', error);
    return null;
  }
  if (!markup) return null;
  const prompt = buildSvgAltTextPrompt(markup, context);
  try {
    return await performAltTextRequest(prompt, signal);
  } catch (error) {
    if (!(signal && signal.aborted)) console.warn('Alt-tekst med SVG-data feilet', error);
    return null;
  }
}
function resolveAltTextEndpoint() {
  if (typeof window === 'undefined') return null;
  if (window.MATH_VISUALS_ALT_TEXT_API_URL) {
    const value = String(window.MATH_VISUALS_ALT_TEXT_API_URL).trim();
    if (value) return value;
  }
  var _window$location2;
  const origin = (_window$location2 = window.location) === null || _window$location2 === void 0 ? void 0 : _window$location2.origin;
  if (typeof origin === 'string' && /^https?:/i.test(origin)) {
    return '/api/diagram-alt-text';
  }
  return null;
}
function setAltText(text, source) {
  const cleaned = (text || '').trim();
  if (altTextField && altTextField.value !== cleaned) {
    altTextField.value = cleaned;
  }
  CFG.altText = cleaned;
  if (source) {
    CFG.altTextSource = source;
  } else if (!CFG.altTextSource) {
    CFG.altTextSource = cleaned ? 'manual' : 'auto';
  }
  applyAltTextToSvg(cleaned);
}
function setAltTextStatus(message, isError) {
  if (!altTextStatus) return;
  altTextStatus.textContent = message || '';
  if (isError) altTextStatus.classList.add('alt-text__status--error');else altTextStatus.classList.remove('alt-text__status--error');
}
function applyAltTextToSvg(text) {
  if (!svg) return;
  const { titleEl, descEl } = ensureSvgA11yNodes(svg);
  const titleText = (CFG.title || '').trim() || 'Diagram';
  const descText = (text || '').trim();
  if (titleEl) titleEl.textContent = titleText;
  if (descEl) descEl.textContent = descText;
  svg.setAttribute('role', 'img');
  svg.setAttribute('aria-label', titleText);
  if (titleEl && titleEl.id) svg.setAttribute('aria-labelledby', titleEl.id);
  if (descEl && descEl.id) svg.setAttribute('aria-describedby', descEl.id);
}
function ensureSvgA11yNodes(targetSvg) {
  if (!targetSvg) return { titleEl: null, descEl: null };
  const doc = targetSvg.ownerDocument || document;
  const ns = targetSvg.namespaceURI || 'http://www.w3.org/2000/svg';
  let titleEl = targetSvg.querySelector('title');
  if (!titleEl) {
    titleEl = doc.createElementNS(ns, 'title');
    targetSvg.insertBefore(titleEl, targetSvg.firstChild || null);
  }
  if (!titleEl.id) {
    const baseId = targetSvg.id || 'diagram';
    titleEl.id = `${baseId}-title`;
  }
  let descEl = targetSvg.querySelector('desc');
  if (!descEl) {
    descEl = doc.createElementNS(ns, 'desc');
    if (titleEl.nextSibling) targetSvg.insertBefore(descEl, titleEl.nextSibling);else targetSvg.appendChild(descEl);
  }
  if (!descEl.id) {
    const baseId = targetSvg.id || 'diagram';
    descEl.id = `${baseId}-desc`;
  }
  return {
    titleEl,
    descEl
  };
}
function collectAltTextContext() {
  const lbls = Array.isArray(CFG.labels) ? CFG.labels.slice() : [];
  const vals1 = lbls.length ? alignLength(values.slice(), lbls.length, 0) : values.slice();
  const vals2 = values2 && values2.length ? lbls.length ? alignLength(values2.slice(), lbls.length, 0) : values2.slice() : null;
  return {
    type: CFG.type || 'bar',
    title: CFG.title || '',
    axisXLabel: CFG.axisXLabel || '',
    axisYLabel: CFG.axisYLabel || '',
    labels: lbls,
    values: vals1,
    values2: vals2,
    seriesNames: seriesNames.slice(),
    yMax: yMax
  };
}
function describeDiagramType(type) {
  if (type === 'pie') return 'sektordiagram';
  if (type === 'line') return 'linjediagram';
  if (type === 'grouped') return 'gruppert stolpediagram';
  if (type === 'stacked') return 'stablet stolpediagram';
  return 'stolpediagram';
}
function buildAltTextPrompt(context) {
  const typeName = describeDiagramType(context.type);
  const parts = [`Diagramtype: ${typeName}`];
  if (context.title) parts.push(`Tittel: ${context.title}`);
  if (context.type !== 'pie') {
    if (context.axisXLabel) parts.push(`X-akse: ${context.axisXLabel}`);
    if (context.axisYLabel) parts.push(`Y-akse: ${context.axisYLabel}`);
  }
  const labels = context.labels.length ? context.labels : context.values.map((_, i) => `Kategori ${i + 1}`);
  const seriesName1 = context.seriesNames && context.seriesNames[0] && context.seriesNames[0].trim() ? context.seriesNames[0].trim() : context.values2 && context.values2.length ? 'Serie 1' : 'Dataserien';
  parts.push(`Serie 1 (${seriesName1}):`);
  labels.forEach((label, idx) => {
    const v = Number(context.values[idx] || 0);
    parts.push(`- ${label}: ${formatNumberForPrompt(v)}`);
  });
  if (context.values2 && context.values2.length) {
    const seriesName2 = context.seriesNames && context.seriesNames[1] && context.seriesNames[1].trim() ? context.seriesNames[1].trim() : 'Serie 2';
    parts.push(`Serie 2 (${seriesName2}):`);
    labels.forEach((label, idx) => {
      const v = Number(context.values2 ? context.values2[idx] || 0 : 0);
      parts.push(`- ${label}: ${formatNumberForPrompt(v)}`);
    });
    if (context.type === 'stacked') {
      parts.push('Totalsummer per kategori:');
      labels.forEach((label, idx) => {
        const total = Number(context.values[idx] || 0) + Number(context.values2 ? context.values2[idx] || 0 : 0);
        parts.push(`- ${label}: ${formatNumberForPrompt(total)}`);
      });
    }
  }
  return `Lag en kort og tydelig alternativ tekst på norsk for et ${typeName}. Teksten skal være 2–3 setninger, beskrive hva diagrammet handler om, forklare aksene og fremheve tydelige trender eller ekstreme verdier. Ikke bruk punktlister eller Markdown.

Data:
${parts.join('\n')}`;
}
function buildSvgAltTextPrompt(svgMarkup, context) {
  const sanitized = sanitizeSvgForPrompt(svgMarkup);
  const basePrompt = buildAltTextPrompt(context);
  return `${basePrompt}

SVG:
${sanitized}`;
}
function sanitizeSvgForPrompt(markup) {
  if (typeof markup !== 'string') return '';
  const collapsed = markup.replace(/\s+/g, ' ').trim();
  const limit = 4000;
  if (collapsed.length <= limit) return collapsed;
  return collapsed.slice(0, limit) + ' …';
}
function buildHeuristicAltText(context) {
  const labels = (Array.isArray(context.labels) && context.labels.length
    ? context.labels
    : context.values.map((_, i) => `Kategori ${i + 1}`)
  ).map((label, idx) => {
    const str = typeof label === 'string' ? label.trim() : String(label || '');
    return str || `Kategori ${idx + 1}`;
  });
  const typeName = describeDiagramType(context.type);
  const sentences = [];
  const title = context.title && context.title.trim();
  if (context.type === 'pie') {
    if (title) {
      sentences.push(`${title} er et ${typeName}.`);
    } else {
      sentences.push(`Figuren er et ${typeName} med ${labels.length} sektorer.`);
    }
    if (labels.length) {
      if (labels.length <= 8) {
        sentences.push(`Sektorene viser ${formatLabelList(labels)}.`);
      } else {
        const first = labels[0];
        const last = labels[labels.length - 1];
        sentences.push(`Diagrammet fordeler andeler for ${labels.length} kategorier, fra ${first} til ${last}.`);
      }
    }
    const numbers = context.values.map(v => Math.max(0, Number(v) || 0));
    const total = numbers.reduce((sum, v) => sum + v, 0);
    const fallbackShare = labels.length ? 100 / labels.length : 0;
    const shares = total > 0 ? numbers.map(v => v / total * 100) : numbers.map(() => fallbackShare);
    if (labels.length) {
      let maxIndex = 0;
      let minIndex = 0;
      shares.forEach((value, idx) => {
        if (value > shares[maxIndex]) maxIndex = idx;
        if (value < shares[minIndex]) minIndex = idx;
      });
      const maxLabel = labels[maxIndex] || `Kategori ${maxIndex + 1}`;
      const minLabel = labels[minIndex] || `Kategori ${minIndex + 1}`;
      let shareSentence = `${maxLabel} er størst med ${formatPercent(shares[maxIndex])}`;
      if (Math.abs(shares[minIndex] - shares[maxIndex]) > 1e-6) {
        shareSentence += `, mens ${minLabel} er minst med ${formatPercent(shares[minIndex])}`;
      }
      shareSentence += '.';
      sentences.push(shareSentence);
    }
    return sentences.join(' ');
  }
  if (title) {
    sentences.push(`${title} er et ${typeName}.`);
  } else {
    sentences.push(`Figuren er et ${typeName} med ${labels.length} kategorier.`);
  }
  const readableLabels = labels.filter(label => !!label);
  if (readableLabels.length) {
    if (readableLabels.length <= 8) {
      sentences.push(`Kategoriene er ${formatLabelList(readableLabels)}.`);
    } else {
      const first = readableLabels[0];
      const last = readableLabels[readableLabels.length - 1];
      sentences.push(`Diagrammet sammenligner ${readableLabels.length} kategorier, fra ${first} til ${last}.`);
    }
  }
  if (context.axisXLabel && context.axisYLabel) {
    sentences.push(`Den horisontale aksen viser ${context.axisXLabel}, og den vertikale viser ${context.axisYLabel}.`);
  } else if (context.axisXLabel) {
    sentences.push(`Den horisontale aksen viser ${context.axisXLabel}.`);
  } else if (context.axisYLabel) {
    sentences.push(`Den vertikale aksen viser ${context.axisYLabel}.`);
  }
  const addSeriesSummary = (arr, name, suffix) => {
    if (!arr || !arr.length) return;
    const numbers = arr.map(v => Number(v) || 0);
    if (numbers.every(v => Math.abs(v - numbers[0]) < 1e-9)) {
      sentences.push(`${name} er ${fmt(numbers[0])} for alle kategorier${suffix || ''}.`);
      return;
    }
    let maxIndex = 0;
    let minIndex = 0;
    numbers.forEach((value, idx) => {
      if (value > numbers[maxIndex]) maxIndex = idx;
      if (value < numbers[minIndex]) minIndex = idx;
    });
    const maxLabel = labels[maxIndex] || `Kategori ${maxIndex + 1}`;
    const minLabel = labels[minIndex] || `Kategori ${minIndex + 1}`;
    let sentence = `${name} er høyest for ${maxLabel} (${fmt(numbers[maxIndex])})`;
    if (numbers[minIndex] !== numbers[maxIndex]) {
      sentence += ` og lavest for ${minLabel} (${fmt(numbers[minIndex])})`;
    }
    sentence += suffix || '';
    sentence += '.';
    sentences.push(sentence);
  };
  const seriesName1 = context.seriesNames && context.seriesNames[0] && context.seriesNames[0].trim() ? context.seriesNames[0].trim() : context.values2 && context.values2.length ? 'Serie 1' : 'Dataserien';
  addSeriesSummary(context.values, seriesName1, context.values2 && context.values2.length ? '' : '');
  if (context.values2 && context.values2.length) {
    const seriesName2 = context.seriesNames && context.seriesNames[1] && context.seriesNames[1].trim() ? context.seriesNames[1].trim() : 'Serie 2';
    addSeriesSummary(context.values2, seriesName2);
    if (context.type === 'stacked') {
      const totals = context.values.map((v, idx) => Number(v || 0) + Number(context.values2 ? context.values2[idx] || 0 : 0));
      addSeriesSummary(totals, 'Totalt', ' når søylene er stablet');
    }
  }
  return sentences.join(' ');
}
function formatLabelList(labels) {
  if (!Array.isArray(labels) || !labels.length) return '';
  if (labels.length === 1) return labels[0];
  if (labels.length === 2) return `${labels[0]} og ${labels[1]}`;
  return `${labels.slice(0, -1).join(', ')} og ${labels[labels.length - 1]}`;
}
function formatNumberForPrompt(value) {
  const str = formatNumber(Number.isFinite(value) ? value : 0);
  return str.replace('.', ',');
}

/* =========================================================
   KNAPPER
   ========================================================= */
document.getElementById('btnReset').addEventListener('click', () => {
  values = CFG.start.slice();
  if (values2) values2 = CFG.start2 ? CFG.start2.slice() : null;
  clearBadges();
  lastFocusIndex = null;
  drawData();
  scheduleAltTextUpdate('reset');
  updateStatus('Nullstilt.');
});
document.getElementById('btnShow').addEventListener('click', () => {
  values = CFG.answer.slice();
  if (values2) values2 = CFG.answer2 ? CFG.answer2.slice() : null;
  lastFocusIndex = null;
  drawData();
  markCorrectness();
  scheduleAltTextUpdate('show');
  updateStatus('Dette er én fasit.');
});
document.getElementById('btnCheck').addEventListener('click', () => {
  markCorrectness();
  const ok1 = isCorrect(values, CFG.answer, CFG.tolerance || 0);
  const ok2 = values2 ? isCorrect(values2, CFG.answer2, CFG.tolerance || 0) : true;
  const ok = ok1 && ok2;
  updateStatus(ok ? 'Riktig! 🎉' : 'Prøv igjen 🙂');
});
document.querySelector('.settings').addEventListener('input', applyCfg);
function applyCfg() {
  const lbls = parseList(document.getElementById('cfgLabels').value);
  const starts = parseNumList(document.getElementById('cfgStart').value);
  const answers = parseNumList(document.getElementById('cfgAnswer').value);
  const yMinInput = document.getElementById('cfgYMin');
  const yMaxInput = document.getElementById('cfgYMax');
  const yMinVal = parseFloat(yMinInput ? yMinInput.value : '');
  const yMaxVal = parseFloat(yMaxInput ? yMaxInput.value : '');
  CFG.title = document.getElementById('cfgTitle').value;
  CFG.type = document.getElementById('cfgType').value;
  CFG.series1 = document.getElementById('cfgSeries1').value;
  CFG.labels = lbls;
  CFG.start = alignLength(starts, lbls.length, 0);
  CFG.answer = alignLength(answers, lbls.length, 0);
  if (series2Enabled) {
    CFG.series2 = document.getElementById('cfgSeries2').value;
    const starts2 = parseNumList(document.getElementById('cfgStart2').value);
    const answers2 = parseNumList(document.getElementById('cfgAnswer2').value);
    CFG.start2 = alignLength(starts2, lbls.length, 0);
    CFG.answer2 = alignLength(answers2, lbls.length, 0);
  } else {
    CFG.series2 = undefined;
    CFG.start2 = null;
    CFG.answer2 = null;
  }
  CFG.yMin = isNaN(yMinVal) ? undefined : yMinVal;
  CFG.yMax = isNaN(yMaxVal) ? undefined : yMaxVal;
  CFG.axisXLabel = document.getElementById('cfgAxisXLabel').value;
  CFG.axisYLabel = document.getElementById('cfgAxisYLabel').value;
  const snapVal = parseFloat(document.getElementById('cfgSnap').value);
  CFG.snap = isNaN(snapVal) ? 1 : snapVal;
  const tolVal = parseFloat(document.getElementById('cfgTolerance').value);
  CFG.tolerance = isNaN(tolVal) ? 0 : tolVal;
  const lockedVals = parseNumList(document.getElementById('cfgLocked').value).map(v => v !== 0);
  CFG.locked = alignLength(lockedVals, lbls.length, false);
  initFromCfg();
}

/* =========================================================
   HJELPERE
   ========================================================= */
function add(name, attrs = {}) {
  const el = document.createElementNS('http://www.w3.org/2000/svg', name);
  Object.entries(attrs).forEach(([k, v]) => el.setAttribute(k, v));
  svg.appendChild(el);
  return el;
}
function addTo(group, name, attrs = {}) {
  const el = document.createElementNS(svg.namespaceURI, name);
  Object.entries(attrs).forEach(([k, v]) => el.setAttribute(k, v));
  group.appendChild(el);
  return el;
}
function polarToCartesian(cx, cy, radius, angle) {
  return {
    x: cx + radius * Math.cos(angle),
    y: cy + radius * Math.sin(angle)
  };
}
function buildPieSlicePath(cx, cy, radius, startAngle, endAngle) {
  const start = polarToCartesian(cx, cy, radius, startAngle);
  const end = polarToCartesian(cx, cy, radius, endAngle);
  const delta = Math.abs(endAngle - startAngle);
  const largeArc = delta > Math.PI ? 1 : 0;
  return `M ${cx} ${cy} L ${start.x} ${start.y} A ${radius} ${radius} 0 ${largeArc} 1 ${end.x} ${end.y} Z`;
}
function clientToSvg(clientX, clientY) {
  const rect = svg.getBoundingClientRect();
  const sx = W / rect.width,
    sy = H / rect.height;
  return {
    x: (clientX - rect.left) * sx,
    y: (clientY - rect.top) * sy
  };
}
function fmt(x) {
  return (Math.round(x * 100) / 100).toString().replace('.', ',');
}
function snap(v, s) {
  return Math.round(v / s) * s;
}
function clamp(v, a, b) {
  return Math.max(a, Math.min(b, v));
}
function parseList(str) {
  return str.split(',').map(s => s.trim()).filter(s => s.length > 0);
}
function parseNumList(str) {
  return parseList(str).map(s => Number(s.replace(',', '.'))).map(v => isNaN(v) ? 0 : v);
}
function alignLength(arr, len, fill = 0) {
  if (arr.length < len) return arr.concat(Array(len - arr.length).fill(fill));
  if (arr.length > len) return arr.slice(0, len);
  return arr;
}
function formatNumberList(arr) {
  return arr.map(formatNumber).join(',');
}
function formatNumber(value) {
  if (!Number.isFinite(value)) return '0';
  let str = value.toFixed(6);
  if (str.includes('.')) {
    str = str.replace(/0+$/, '').replace(/\.$/, '');
  }
  return str.length ? str : '0';
}
function formatPercent(value) {
  const safe = Number.isFinite(value) ? Math.max(0, value) : 0;
  const rounded = safe >= 10 ? Math.round(safe) : Math.round(safe * 10) / 10;
  const formatted = formatNumber(rounded).replace('.', ',');
  return `${formatted} %`;
}
function normalizeTickValue(value) {
  if (!Number.isFinite(value)) return 0;
  const rounded = Math.round(value * 1e6) / 1e6;
  return Math.abs(rounded) < 1e-9 ? 0 : rounded;
}
function formatTickValue(value) {
  return formatNumber(value).replace('.', ',');
}
function getBaselineValue() {
  if (yMin >= 0 && yMax >= 0) return yMin;
  if (yMin <= 0 && yMax <= 0) return yMax;
  return 0;
}
function computeScaleBounds(values, minOverride, maxOverride) {
  const filtered = values.filter(v => Number.isFinite(v));
  const data = filtered.length ? filtered.slice() : [0];
  const hasPositive = data.some(v => v > 0);
  const hasNegative = data.some(v => v < 0);
  if (!hasPositive) data.push(0);
  if (!hasNegative) data.push(0);
  let min = Number.isFinite(minOverride) ? minOverride : Math.min(...data);
  let max = Number.isFinite(maxOverride) ? maxOverride : Math.max(...data);
  if (min > max) {
    const tmp = min;
    min = max;
    max = tmp;
  }
  if (min === max) {
    const delta = Math.abs(min) > 0 ? Math.abs(min) * 0.2 : 1;
    min -= delta;
    max += delta;
  }
  const span = max - min || 1;
  const step = niceStep(span);
  const niceMin = Number.isFinite(minOverride) ? min : Math.floor(min / step) * step;
  const niceMax = Number.isFinite(maxOverride) ? max : Math.ceil(max / step) * step;
  return {
    min: normalizeTickValue(niceMin),
    max: normalizeTickValue(niceMax),
    step
  };
}
function niceStep(span) {
  const safeSpan = span > 0 ? span : 1;
  const rough = safeSpan / 8;
  const exponent = Math.floor(Math.log10(rough));
  const pow = Math.pow(10, exponent);
  const candidates = [1, 2, 2.5, 5, 10];
  for (const c of candidates) {
    const step = c * pow;
    if (rough <= step * 1.001) return step;
  }
  return 10 * pow;
}
function updateStatus(msg) {
  document.getElementById('status').textContent = msg; // aria-live="polite"
}
function clearBadges() {
  [...gBars.querySelectorAll('.bar, .pie-slice')].forEach(b => b.classList.remove('badge-ok', 'badge-no'));
}
function markCorrectness() {
  clearBadges();
  const tol = CFG.tolerance || 0;
  [...gBars.children].forEach(rect => {
    const idx = +rect.dataset.index;
    const series = +rect.dataset.series || 0;
    const arr = series === 0 ? values : values2;
    const ans = series === 0 ? CFG.answer : CFG.answer2;
    if (!arr || !ans) return;
    const ok = Math.abs(arr[idx] - ans[idx]) <= tol;
    rect.classList.add(ok ? 'badge-ok' : 'badge-no');
  });
}
function isCorrect(vs, ans, tol) {
  if (vs.length !== ans.length) return false;
  return vs.every((v, i) => Math.abs(v - ans[i]) <= tol);
}
async function svgToString(svgEl) {
  var _titleEl$textContent;
  const clone = svgEl.cloneNode(true);
  const exportTitle = (CFG.title || '').trim() || 'Diagram';
  const currentContext = collectAltTextContext();
  const exportDesc = (CFG.altText || '').trim() || buildHeuristicAltText(currentContext);
  const { titleEl: cloneTitle, descEl: cloneDesc } = ensureSvgA11yNodes(clone);
  if (cloneTitle) cloneTitle.textContent = exportTitle;
  if (cloneDesc) cloneDesc.textContent = exportDesc;
  clone.setAttribute('role', 'img');
  clone.setAttribute('aria-label', exportTitle);
  if (cloneTitle && cloneTitle.id) clone.setAttribute('aria-labelledby', cloneTitle.id);
  if (cloneDesc && cloneDesc.id) clone.setAttribute('aria-describedby', cloneDesc.id);

  // Kopier beregnede stilverdier som attributter for å unngå svarte figurer
  const srcEls = svgEl.querySelectorAll('*');
  const cloneEls = clone.querySelectorAll('*');
  srcEls.forEach((src, i) => {
    const dst = cloneEls[i];
    const comp = getComputedStyle(src);
    const props = ['fill', 'stroke', 'stroke-width', 'font-family', 'font-size', 'font-weight', 'opacity', 'text-anchor', 'paint-order', 'stroke-linecap', 'stroke-linejoin', 'stroke-dasharray'];
    props.forEach(p => {
      const val = comp.getPropertyValue(p);
      // Include 'none' for fill and stroke to preserve transparency
      if (val && val !== 'normal' && val !== '0px') {
        dst.setAttribute(p, val);
      }
    });
  });

  // legg til overskrift fra h2-elementet i eksporten
  const titleEl = document.getElementById('chartTitle');
  const titleText = titleEl === null || titleEl === void 0 || (_titleEl$textContent = titleEl.textContent) === null || _titleEl$textContent === void 0 ? void 0 : _titleEl$textContent.trim();
  if (titleText) {
    const t = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    t.textContent = titleText;
    t.setAttribute('x', W / 2);
    t.setAttribute('y', M.t / 2);
    t.setAttribute('text-anchor', 'middle');
    const comp = getComputedStyle(titleEl);
    const color = comp.getPropertyValue('color');
    if (color) t.setAttribute('fill', color);
    const ff = comp.getPropertyValue('font-family');
    if (ff) t.setAttribute('font-family', ff);
    const fs = comp.getPropertyValue('font-size');
    if (fs) t.setAttribute('font-size', fs);
    const fw = comp.getPropertyValue('font-weight');
    if (fw && fw !== 'normal') t.setAttribute('font-weight', fw);
    clone.insertBefore(t, clone.firstChild);
  }

  // fjern interaktive håndtak før eksport
  clone.querySelectorAll('.handle, .handleShadow').forEach(el => el.remove());
  clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
  clone.setAttribute('xmlns:xlink', 'http://www.w3.org/1999/xlink');
  return '<?xml version="1.0" encoding="UTF-8"?>\n' + new XMLSerializer().serializeToString(clone);
}
async function downloadSVG(svgEl, filename) {
  const data = await svgToString(svgEl);
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
async function downloadPNG(svgEl, filename, scale = 2, bg = '#fff') {
  const vb = svgEl.viewBox.baseVal;
  const w = (vb === null || vb === void 0 ? void 0 : vb.width) || svgEl.clientWidth || 900;
  const h = (vb === null || vb === void 0 ? void 0 : vb.height) || svgEl.clientHeight || 560;
  const data = await svgToString(svgEl);
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
