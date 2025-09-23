const state = {
  domainMin: 1,
  domainMax: 2,
  initialDomain: { min: 1, max: 2 },
  tasks: [
    { id: 'task-1', label: '1,2', value: 1.2, placedValue: null },
    { id: 'task-2', label: '3/2', value: 1.5, placedValue: null }
  ],
  activeTaskId: null,
  showAnswers: false
};

const svg = document.getElementById('numberLine');
const domainInfo = document.getElementById('domainInfo');
const boardStatus = document.getElementById('boardStatus');
const taskList = document.getElementById('taskList');
const toggleAnswersBtn = document.getElementById('toggleAnswers');
const resetPlacementsBtn = document.getElementById('resetPlacements');
const answerLegend = document.getElementById('answerLegend');

const zoomInBtn = document.getElementById('zoomIn');
const zoomOutBtn = document.getElementById('zoomOut');
const zoomResetBtn = document.getElementById('zoomReset');
const panLeftBtn = document.getElementById('panLeft');
const panRightBtn = document.getElementById('panRight');

const view = {
  width: 920,
  height: 320,
  marginLeft: 70,
  marginRight: 70,
  marginTop: 46,
  marginBottom: 74
};

const axisY = view.height - view.marginBottom;
const innerWidth = view.width - view.marginLeft - view.marginRight;

const BASE_TOLERANCE = 0.02;
const RELATIVE_TOLERANCE_FACTOR = 320;
const MIN_SPAN = 0.0005;
const MAX_SPAN = 100000;

const markerElements = new Map();

const axisGroup = createSvgElement('g', { class: 'axis-layer' });
const gridGroup = createSvgElement('g', { class: 'grid-lines' });
const tickGroup = createSvgElement('g', { class: 'tick-lines' });
const labelGroup = createSvgElement('g', { class: 'tick-labels' });
const answersGroup = createSvgElement('g', { class: 'answers-layer' });
const markersGroup = createSvgElement('g', { class: 'markers' });

function createSvgElement(name, attrs = {}) {
  const element = document.createElementNS('http://www.w3.org/2000/svg', name);
  Object.entries(attrs).forEach(([key, value]) => {
    element.setAttribute(key, value);
  });
  return element;
}

svg.append(axisGroup);
svg.append(gridGroup);
svg.append(tickGroup);
svg.append(labelGroup);
svg.append(answersGroup);
svg.append(markersGroup);

const baseline = createSvgElement('line', {
  class: 'axis-line',
  x1: view.marginLeft,
  y1: axisY,
  x2: view.width - view.marginRight,
  y2: axisY
});
axisGroup.append(baseline);

let isPanning = false;
let panStartPoint = null;
let panStartDomain = null;

svg.addEventListener('pointerdown', event => {
  const markerElement = event.target.closest('[data-marker-id]');
  if (markerElement) {
    const taskId = markerElement.getAttribute('data-marker-id');
    const task = state.tasks.find(t => t.id === taskId);
    if (task) {
      startMarkerDrag(event, task, markerElement);
    }
    return;
  }

  if (event.button !== 0) return;
  svg.setPointerCapture(event.pointerId);

  const activeTask = getActiveTask();
  if (activeTask) {
    event.preventDefault();
    const svgPoint = getSvgPoint(event);
    const value = clampToDomain(svgXToValue(svgPoint.x));
    activeTask.placedValue = value;
    state.activeTaskId = null;
    updateBoardStatus();
    renderMarkers();
    updateTaskList();
    svg.releasePointerCapture(event.pointerId);
    return;
  }

  startPan(event);
});

svg.addEventListener('pointermove', event => {
  if (!isPanning || panStartPoint == null || panStartDomain == null) return;
  if (event.pointerId !== panStartPoint.pointerId) return;
  event.preventDefault();
  const point = getSvgPoint(event);
  const deltaX = point.x - panStartPoint.x;
  const span = panStartDomain.max - panStartDomain.min;
  const deltaValue = (deltaX / innerWidth) * span;
  state.domainMin = panStartDomain.min - deltaValue;
  state.domainMax = panStartDomain.max - deltaValue;
  clampDomain();
  renderAll();
});

svg.addEventListener('pointerup', event => {
  if (isPanning && panStartPoint && event.pointerId === panStartPoint.pointerId) {
    finishPan();
  }
});

svg.addEventListener('pointercancel', event => {
  if (isPanning && panStartPoint && event.pointerId === panStartPoint.pointerId) {
    finishPan();
  }
});

svg.addEventListener('dblclick', event => {
  event.preventDefault();
  const point = getSvgPoint(event);
  const anchorValue = svgXToValue(point.x);
  zoomAt(0.75, anchorValue);
});

function startPan(event) {
  isPanning = true;
  const point = getSvgPoint(event);
  panStartPoint = { x: point.x, pointerId: event.pointerId };
  panStartDomain = { min: state.domainMin, max: state.domainMax };
  svg.classList.add('is-panning');
}

function finishPan() {
  if (panStartPoint) {
    try {
      svg.releasePointerCapture(panStartPoint.pointerId);
    } catch (error) {
      /* ignore */
    }
  }
  isPanning = false;
  panStartPoint = null;
  panStartDomain = null;
  svg.classList.remove('is-panning');
}

function startMarkerDrag(event, task, element) {
  event.preventDefault();
  const pointerId = event.pointerId;
  const startPoint = getSvgPoint(event);
  const startValue = task.placedValue ?? svgXToValue(startPoint.x);
  const span = state.domainMax - state.domainMin;

  element.classList.add('is-dragging');
  element.setPointerCapture(pointerId);

  const move = moveEvent => {
    if (moveEvent.pointerId !== pointerId) return;
    const currentPoint = getSvgPoint(moveEvent);
    const deltaX = currentPoint.x - startPoint.x;
    let newValue = startValue + (deltaX / innerWidth) * span;
    if (!Number.isFinite(newValue)) return;
    task.placedValue = clampToDomain(newValue);
    updateMarkerElement(element, task);
    updateTaskList();
  };

  const end = endEvent => {
    if (endEvent.pointerId !== pointerId) return;
    element.classList.remove('is-dragging');
    element.releasePointerCapture(pointerId);
    element.removeEventListener('pointermove', move);
    element.removeEventListener('pointerup', end);
    element.removeEventListener('pointercancel', end);
    updateMarkerElement(element, task);
    updateTaskList();
  };

  element.addEventListener('pointermove', move);
  element.addEventListener('pointerup', end);
  element.addEventListener('pointercancel', end);
}

function renderAll() {
  renderAxis();
  renderMarkers();
  renderAnswers();
  updateDomainInfo();
  updateBoardStatus();
  updateTaskList();
}

function renderAxis() {
  gridGroup.replaceChildren();
  tickGroup.replaceChildren();
  labelGroup.replaceChildren();

  baseline.setAttribute('x1', view.marginLeft);
  baseline.setAttribute('x2', view.width - view.marginRight);

  const ticks = generateTicks(state.domainMin, state.domainMax);
  const span = state.domainMax - state.domainMin;
  const decimals = determineDecimals(span);

  ticks.forEach(value => {
    const x = valueToSvgX(value);
    const gridLine = createSvgElement('line', {
      class: 'grid-line',
      x1: x,
      y1: view.marginTop,
      x2: x,
      y2: axisY
    });
    gridGroup.append(gridLine);

    const tick = createSvgElement('line', {
      class: 'tick-line',
      x1: x,
      y1: axisY,
      x2: x,
      y2: axisY + 14
    });
    tickGroup.append(tick);

    const label = createSvgElement('text', {
      class: 'tick-label',
      x,
      y: axisY + 30
    });
    label.textContent = formatNumber(value, decimals);
    labelGroup.append(label);
  });
}

function renderMarkers() {
  const used = new Set();
  state.tasks.forEach(task => {
    const element = markerElements.get(task.id);
    if (typeof task.placedValue !== 'number') {
      if (element) {
        element.remove();
        markerElements.delete(task.id);
      }
      return;
    }

    let marker = element;
    if (!marker) {
      marker = createMarkerElement(task);
      markerElements.set(task.id, marker);
      markersGroup.append(marker);
    }
    updateMarkerElement(marker, task);
    used.add(task.id);
  });

  markerElements.forEach((element, id) => {
    if (!used.has(id)) {
      element.remove();
      markerElements.delete(id);
    }
  });
}

function createMarkerElement(task) {
  const group = createSvgElement('g', { 'data-marker-id': task.id });

  const line = createSvgElement('line', {
    class: 'marker-line',
    x1: 0,
    y1: axisY,
    x2: 0,
    y2: axisY - 80
  });
  const circle = createSvgElement('circle', {
    class: 'marker-circle',
    cx: 0,
    cy: axisY - 80,
    r: 9
  });
  const label = createSvgElement('text', {
    class: 'marker-label',
    x: 0,
    y: axisY - 108
  });
  const valueLabel = createSvgElement('text', {
    class: 'marker-value',
    x: 0,
    y: axisY - 90
  });

  label.textContent = task.label;
  group.append(line, circle, label, valueLabel);

  return group;
}

function updateMarkerElement(element, task) {
  const line = element.querySelector('.marker-line');
  const circle = element.querySelector('.marker-circle');
  const label = element.querySelector('.marker-label');
  const valueLabel = element.querySelector('.marker-value');

  label.textContent = task.label;

  const x = valueToSvgX(task.placedValue);
  const minX = view.marginLeft;
  const maxX = view.width - view.marginRight;
  const clampedX = Math.max(minX, Math.min(maxX, x));
  const outside = clampedX !== x;

  element.setAttribute('transform', `translate(${clampedX}, 0)`);

  line.setAttribute('x1', 0);
  line.setAttribute('x2', 0);
  line.setAttribute('y1', axisY);
  line.setAttribute('y2', axisY - 80);

  circle.setAttribute('cx', 0);
  circle.setAttribute('cy', axisY - 80);

  label.setAttribute('x', 0);
  label.setAttribute('y', axisY - 108);

  valueLabel.setAttribute('x', 0);
  valueLabel.setAttribute('y', axisY - 90);
  valueLabel.textContent = formatNumber(task.placedValue, 3);

  const tolerance = getTolerance();
  const diff = Math.abs(task.placedValue - task.value);
  const correct = diff <= tolerance;

  element.classList.toggle('marker--correct', correct);
  element.classList.toggle('marker--outside', outside);
}

function renderAnswers() {
  answersGroup.replaceChildren();
  if (!state.showAnswers) {
    answerLegend.hidden = true;
    return;
  }

  answerLegend.hidden = false;
  state.tasks.forEach(task => {
    const x = valueToSvgX(task.value);
    const minX = view.marginLeft;
    const maxX = view.width - view.marginRight;
    const clampedX = Math.max(minX, Math.min(maxX, x));

    const group = createSvgElement('g', {
      class: 'answer-marker',
      transform: `translate(${clampedX}, ${axisY - 50})`
    });

    const circle = createSvgElement('circle', { cx: 0, cy: 0, r: 6 });
    const label = createSvgElement('text', { x: 0, y: 18 });
    label.textContent = task.label;

    group.append(circle, label);
    answersGroup.append(group);
  });
}

function updateDomainInfo() {
  domainInfo.textContent = `${formatNumber(state.domainMin, 2)} – ${formatNumber(state.domainMax, 2)}`;
}

function updateBoardStatus() {
  const activeTask = getActiveTask();
  if (activeTask) {
    svg.classList.add('is-placing');
    boardStatus.innerHTML = `Klikk på tallinja for å plassere <strong>${activeTask.label}</strong>.`;
    return;
  }

  svg.classList.remove('is-placing');
  const span = state.domainMax - state.domainMin;
  boardStatus.innerHTML = `Dra for å flytte tallinja og bruk zoom-knappene for å utforske. Intervallbredde: <strong>${formatNumber(span, 2)}</strong>.`;
}

function updateTaskList() {
  taskList.replaceChildren();
  const tolerance = getTolerance();

  state.tasks.forEach(task => {
    const item = document.createElement('div');
    item.className = 'task';
    if (state.activeTaskId === task.id) item.classList.add('is-active');
    const diff = typeof task.placedValue === 'number' ? task.placedValue - task.value : null;
    if (diff != null && Math.abs(diff) <= tolerance) {
      item.classList.add('is-correct');
    }

    const header = document.createElement('div');
    header.className = 'task__header';

    const label = document.createElement('span');
    label.className = 'task__label';
    label.textContent = task.label;

    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'btn';
    button.textContent = state.activeTaskId === task.id ? 'Avbryt plassering' : 'Velg og plasser';
    button.addEventListener('click', () => {
      if (state.activeTaskId === task.id) {
        state.activeTaskId = null;
      } else {
        state.activeTaskId = task.id;
      }
      updateBoardStatus();
      updateTaskList();
    });

    header.append(label, button);
    item.append(header);

    const status = document.createElement('p');
    status.className = 'task__status';

    if (typeof task.placedValue !== 'number') {
      status.textContent = 'Ikke plassert enda.';
    } else {
      const diffAbs = Math.abs(diff);
      const diffFormatted = formatSigned(diff, 3);
      if (diffAbs <= tolerance) {
        status.innerHTML = `Plassert på <strong>${formatNumber(task.placedValue, 3)}</strong>. Riktig plassering!`;
      } else {
        const direction = diff > 0 ? 'for langt til høyre' : 'for langt til venstre';
        status.innerHTML = `Plassert på <strong>${formatNumber(task.placedValue, 3)}</strong>. Juster ${direction} (${diffFormatted}).`;
      }
    }

    item.append(status);
    taskList.append(item);
  });
}

function zoomAt(factor, anchorValue) {
  const span = state.domainMax - state.domainMin;
  const newSpan = Math.min(Math.max(span * factor, MIN_SPAN), MAX_SPAN);
  const ratio = newSpan / span;
  const center = anchorValue != null ? anchorValue : (state.domainMin + state.domainMax) / 2;
  const minOffset = center - state.domainMin;
  const maxOffset = state.domainMax - center;
  state.domainMin = center - minOffset * ratio;
  state.domainMax = center + maxOffset * ratio;
  clampDomain();
  renderAll();
}

function clampDomain() {
  if (state.domainMax - state.domainMin < MIN_SPAN) {
    const mid = (state.domainMin + state.domainMax) / 2;
    state.domainMin = mid - MIN_SPAN / 2;
    state.domainMax = mid + MIN_SPAN / 2;
  }
  if (state.domainMax - state.domainMin > MAX_SPAN) {
    const mid = (state.domainMin + state.domainMax) / 2;
    state.domainMin = mid - MAX_SPAN / 2;
    state.domainMax = mid + MAX_SPAN / 2;
  }
}

function getTolerance() {
  const span = state.domainMax - state.domainMin;
  return Math.max(BASE_TOLERANCE, span / RELATIVE_TOLERANCE_FACTOR);
}

function getSvgPoint(event) {
  const point = svg.createSVGPoint();
  point.x = event.clientX;
  point.y = event.clientY;
  const ctm = svg.getScreenCTM();
  if (!ctm) return { x: 0, y: 0 };
  const inverted = ctm.inverse();
  const svgPoint = point.matrixTransform(inverted);
  return svgPoint;
}

function valueToSvgX(value) {
  const span = state.domainMax - state.domainMin;
  if (span === 0) return view.marginLeft;
  return view.marginLeft + ((value - state.domainMin) / span) * innerWidth;
}

function svgXToValue(x) {
  const span = state.domainMax - state.domainMin;
  if (span === 0) return state.domainMin;
  return state.domainMin + ((x - view.marginLeft) / innerWidth) * span;
}

function clampToDomain(value) {
  return Math.min(Math.max(value, state.domainMin), state.domainMax);
}

function formatNumber(value, decimals = 2) {
  if (!Number.isFinite(value)) return '';
  const formatter = new Intl.NumberFormat('no-NO', {
    minimumFractionDigits: 0,
    maximumFractionDigits: decimals
  });
  return formatter.format(value);
}

function formatSigned(value, decimals = 2) {
  if (!Number.isFinite(value)) return '';
  const formatter = new Intl.NumberFormat('no-NO', {
    minimumFractionDigits: 0,
    maximumFractionDigits: decimals,
    signDisplay: 'always'
  });
  return formatter.format(value);
}

function determineDecimals(span) {
  if (span <= 0.02) return 3;
  if (span <= 0.2) return 2;
  if (span <= 2) return 1;
  return 0;
}

function generateTicks(min, max) {
  const span = max - min;
  if (!Number.isFinite(span) || span <= 0) return [];
  const targetCount = 8;
  const step = niceStep(span / targetCount);
  if (!Number.isFinite(step) || step <= 0) return [];

  const start = Math.ceil(min / step) * step;
  const ticks = [];
  for (let value = start; value <= max + step * 0.5 && ticks.length < 200; value += step) {
    const rounded = Math.round(value / step) * step;
    ticks.push(Number.parseFloat(rounded.toFixed(12)));
  }
  return ticks;
}

function niceStep(roughStep) {
  if (!Number.isFinite(roughStep) || roughStep <= 0) return 1;
  const exponent = Math.floor(Math.log10(roughStep));
  const fraction = roughStep / Math.pow(10, exponent);
  let niceFraction;
  if (fraction <= 1) niceFraction = 1;
  else if (fraction <= 2) niceFraction = 2;
  else if (fraction <= 5) niceFraction = 5;
  else niceFraction = 10;
  return niceFraction * Math.pow(10, exponent);
}

function getActiveTask() {
  if (!state.activeTaskId) return null;
  return state.tasks.find(task => task.id === state.activeTaskId) ?? null;
}

zoomInBtn.addEventListener('click', () => zoomAt(0.7));
zoomOutBtn.addEventListener('click', () => zoomAt(1.4));
zoomResetBtn.addEventListener('click', () => {
  state.domainMin = state.initialDomain.min;
  state.domainMax = state.initialDomain.max;
  clampDomain();
  renderAll();
});

panLeftBtn.addEventListener('click', () => {
  const span = state.domainMax - state.domainMin;
  const shift = span * 0.2;
  state.domainMin -= shift;
  state.domainMax -= shift;
  renderAll();
});

panRightBtn.addEventListener('click', () => {
  const span = state.domainMax - state.domainMin;
  const shift = span * 0.2;
  state.domainMin += shift;
  state.domainMax += shift;
  renderAll();
});

toggleAnswersBtn.addEventListener('click', () => {
  state.showAnswers = !state.showAnswers;
  toggleAnswersBtn.textContent = state.showAnswers ? 'Skjul fasit' : 'Vis fasit';
  renderAnswers();
});

resetPlacementsBtn.addEventListener('click', () => {
  state.tasks.forEach(task => {
    task.placedValue = null;
  });
  state.activeTaskId = null;
  updateBoardStatus();
  renderMarkers();
  updateTaskList();
  renderAnswers();
});

window.addEventListener('resize', () => {
  renderAll();
});

renderAll();
