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

const settings = {
  panEnabled: true,
  pinchZoomEnabled: true
};

const BOARD_VIEW = {
  top: 1.4,
  bottom: -0.5,
  markerHeight: 0.85,
  stemTop: 0.65,
  valueLabelY: 0.72,
  labelY: 1.05,
  answerHeight: 0.45,
  answerLabelY: 0.62,
  tickDown: -0.14,
  tickLabelY: -0.3
};

const COLORS = {
  base: '#0f6d8f',
  correct: '#10b981',
  outside: '#f97316'
};

const BASE_TOLERANCE = 0.02;
const RELATIVE_TOLERANCE_FACTOR = 320;
const MIN_SPAN = 0.0005;
const MAX_SPAN = 100000;

const boardStatus = document.getElementById('boardStatus');
const domainInfo = document.getElementById('domainInfo');
const taskList = document.getElementById('taskList');
const toggleAnswersBtn = document.getElementById('toggleAnswers');
const resetPlacementsBtn = document.getElementById('resetPlacements');
const answerLegend = document.getElementById('answerLegend');
const zoomInBtn = document.getElementById('zoomIn');
const zoomOutBtn = document.getElementById('zoomOut');
const zoomResetBtn = document.getElementById('zoomReset');
const panLeftBtn = document.getElementById('panLeft');
const panRightBtn = document.getElementById('panRight');
const togglePanInput = document.getElementById('togglePan');
const togglePinchInput = document.getElementById('togglePinch');

let boardContainer = document.getElementById('numberLineBoard');
let board = null;
let axisLine = null;
let markerTrack = null;
let skipBoundingBoxHandler = false;
let axisElements = [];
let answerElements = [];
const markerElements = new Map();

function initialize() {
  setupUi();
  if (typeof JXG === 'undefined' || !JXG || !JXG.JSXGraph) {
    boardStatus.textContent = 'JSXGraph-biblioteket kunne ikke lastes.';
    disableBoardControls();
    return;
  }
  initBoard();
  renderAll();
}

function setupUi() {
  zoomInBtn?.addEventListener('click', () => zoomAt(0.7));
  zoomOutBtn?.addEventListener('click', () => zoomAt(1.4));
  zoomResetBtn?.addEventListener('click', () => {
    state.domainMin = state.initialDomain.min;
    state.domainMax = state.initialDomain.max;
    clampDomain();
    applyDomainToBoard();
  });

  panLeftBtn?.addEventListener('click', () => {
    const span = state.domainMax - state.domainMin;
    const shift = span * 0.2;
    state.domainMin -= shift;
    state.domainMax -= shift;
    applyDomainToBoard();
  });

  panRightBtn?.addEventListener('click', () => {
    const span = state.domainMax - state.domainMin;
    const shift = span * 0.2;
    state.domainMin += shift;
    state.domainMax += shift;
    applyDomainToBoard();
  });

  toggleAnswersBtn?.addEventListener('click', () => {
    state.showAnswers = !state.showAnswers;
    toggleAnswersBtn.textContent = state.showAnswers ? 'Skjul fasit' : 'Vis fasit';
    renderAnswers();
  });

  resetPlacementsBtn?.addEventListener('click', () => {
    state.tasks.forEach(task => {
      task.placedValue = null;
    });
    state.activeTaskId = null;
    renderMarkers();
    updateTaskList();
    updateBoardStatus();
    renderAnswers();
  });

  togglePanInput?.addEventListener('change', event => {
    settings.panEnabled = Boolean(event.target?.checked);
    rebuildBoard();
  });

  togglePinchInput?.addEventListener('change', event => {
    settings.pinchZoomEnabled = Boolean(event.target?.checked);
    rebuildBoard();
  });

  window.addEventListener('resize', () => {
    if (!board) return;
    const jsx = typeof JXG !== 'undefined' && JXG ? JXG.JSXGraph : null;
    if (jsx && typeof jsx.resizeBoard === 'function') {
      jsx.resizeBoard(board, boardContainer.clientWidth, boardContainer.clientHeight);
    } else if (jsx && typeof jsx.resizeBoards === 'function') {
      jsx.resizeBoards();
    }
  });
}

function disableBoardControls() {
  [zoomInBtn, zoomOutBtn, zoomResetBtn, panLeftBtn, panRightBtn, toggleAnswersBtn, resetPlacementsBtn]
    .filter(Boolean)
    .forEach(element => {
      element.disabled = true;
    });
  [togglePanInput, togglePinchInput]
    .filter(Boolean)
    .forEach(element => {
      element.disabled = true;
      element.checked = false;
    });
}

function resetBoardContainer(container) {
  if (!container || !container.parentNode) return container;
  const replacement = container.cloneNode(false);
  container.parentNode.replaceChild(replacement, container);
  return replacement;
}

function rebuildBoard() {
  if (board) {
    try {
      board.off('boundingbox', handleBoundingBoxChange);
    } catch (_) {
      /* ignore */
    }
    try {
      JXG.JSXGraph.freeBoard(board);
    } catch (_) {
      /* ignore */
    }
    board = null;
  }
  axisElements = [];
  answerElements = [];
  markerElements.clear();
  boardContainer = resetBoardContainer(boardContainer);
  initBoard();
  renderAll();
}

function initBoard() {
  if (!boardContainer) return;
  board = JXG.JSXGraph.initBoard(boardContainer.id, {
    boundingbox: [state.domainMin, BOARD_VIEW.top, state.domainMax, BOARD_VIEW.bottom],
    axis: false,
    showNavigation: false,
    showCopyright: false,
    keepaspectratio: false,
    pan: {
      enabled: settings.panEnabled,
      needShift: false,
      needTwoFingers: false,
      allowHorizontal: true,
      allowVertical: false
    },
    zoom: {
      enabled: settings.pinchZoomEnabled,
      wheel: settings.pinchZoomEnabled,
      pinch: settings.pinchZoomEnabled,
      needShift: false,
      factorX: 1.2,
      factorY: 1.0
    }
  });

  axisLine = board.create('line', [[0, 0], [1, 0]], {
    straightFirst: true,
    straightLast: true,
    strokeColor: '#1f2937',
    strokeWidth: 2,
    fixed: true,
    highlight: false
  });

  markerTrack = board.create('line', [[0, BOARD_VIEW.markerHeight], [1, BOARD_VIEW.markerHeight]], {
    visible: false,
    fixed: true,
    highlight: false
  });

  board.on('boundingbox', handleBoundingBoxChange);

  boardContainer.addEventListener('pointerdown', handleBoardPointerDown);
  boardContainer.addEventListener('dblclick', handleBoardDoubleClick, { passive: false });

  handleBoundingBoxChange();
}

function handleBoardPointerDown(event) {
  if (!board) return;
  const activeTask = getActiveTask();
  if (!activeTask) return;
  if (typeof event.button === 'number' && event.button !== 0) return;
  const coords = board.getUsrCoordsOfMouse(event);
  if (!Array.isArray(coords) || coords.length < 2) return;
  event.preventDefault();
  event.stopPropagation();
  activeTask.placedValue = clampToDomain(coords[0]);
  state.activeTaskId = null;
  renderMarkers();
  updateTaskList();
  updateBoardStatus();
}

function handleBoardDoubleClick(event) {
  if (!board) return;
  event.preventDefault();
  const coords = board.getUsrCoordsOfMouse(event);
  if (!Array.isArray(coords) || coords.length < 2) return;
  zoomAt(0.75, coords[0]);
}

function renderAll() {
  renderMarkers();
  renderAnswers();
  renderAxisTicks();
  updateDomainInfo();
  updateBoardStatus();
  updateTaskList();
}

function renderMarkers() {
  if (!board) return;
  const tolerance = getTolerance();
  const used = new Set();
  board.suspendUpdate();
  state.tasks.forEach(task => {
    if (typeof task.placedValue !== 'number') {
      removeMarker(task.id);
      return;
    }
    let marker = markerElements.get(task.id);
    if (!marker) {
      marker = createMarker(task);
      markerElements.set(task.id, marker);
    }
    marker.point.moveTo([clampToDomain(task.placedValue), BOARD_VIEW.markerHeight], 0);
    updateMarkerAppearance(marker, task, tolerance);
    used.add(task.id);
  });
  markerElements.forEach((_, id) => {
    if (!used.has(id)) {
      removeMarker(id);
    }
  });
  board.unsuspendUpdate();
}

function updateMarkerStyles() {
  if (!board) return;
  const tolerance = getTolerance();
  board.suspendUpdate();
  markerElements.forEach((marker, id) => {
    const task = state.tasks.find(t => t.id === id);
    if (task && typeof task.placedValue === 'number') {
      updateMarkerAppearance(marker, task, tolerance);
    }
  });
  board.unsuspendUpdate();
}

function createMarker(task) {
  const x = clampToDomain(task.placedValue);
  const point = board.create('point', [x, BOARD_VIEW.markerHeight], {
    name: '',
    withLabel: false,
    size: 6,
    face: 'circle',
    strokeColor: '#ffffff',
    strokeWidth: 2.4,
    fillColor: COLORS.base,
    fillOpacity: 1,
    showInfobox: false,
    fixed: false,
    highlight: false,
    elementClass: 'nl-marker',
    slideObject: markerTrack
  });

  point.on('drag', () => handleMarkerDrag(task, point));
  point.on('up', () => handleMarkerDrag(task, point));
  point.on('down', () => {
    state.activeTaskId = null;
    updateBoardStatus();
    updateTaskList();
  });

  const stem = board.create('segment', [
    [() => point.X(), 0],
    [() => point.X(), BOARD_VIEW.stemTop]
  ], {
    strokeColor: COLORS.base,
    strokeWidth: 2,
    fixed: true,
    highlight: false
  });

  const label = board.create('text', [
    () => point.X(),
    BOARD_VIEW.labelY,
    () => task.label
  ], {
    anchorX: 'middle',
    anchorY: 'bottom',
    fontSize: 13,
    fixed: true,
    highlight: false,
    strokeColor: '#1f2937'
  });

  const valueText = board.create('text', [
    () => point.X(),
    BOARD_VIEW.valueLabelY,
    () => formatNumber(task.placedValue, 3)
  ], {
    anchorX: 'middle',
    anchorY: 'bottom',
    fontSize: 12,
    fixed: true,
    highlight: false,
    strokeColor: '#6b7280'
  });

  return { point, stem, label, valueText };
}

function handleMarkerDrag(task, point) {
  if (!board) return;
  const clampedX = clampToDomain(point.X());
  task.placedValue = clampedX;
  point.moveTo([clampedX, BOARD_VIEW.markerHeight], 0);
  updateMarkerStyles();
  updateTaskList();
}

function updateMarkerAppearance(marker, task, tolerance) {
  const diff = Math.abs((task.placedValue ?? 0) - task.value);
  const outside = task.placedValue < state.domainMin || task.placedValue > state.domainMax;
  const correct = diff <= tolerance;
  const color = outside ? COLORS.outside : correct ? COLORS.correct : COLORS.base;
  marker.point.setAttribute({
    fillColor: color,
    highlightFillColor: color,
    strokeColor: '#ffffff',
    highlightStrokeColor: '#ffffff'
  });
  marker.stem.setAttribute({
    strokeColor: outside ? COLORS.outside : correct ? COLORS.correct : COLORS.base
  });
}

function removeMarker(id) {
  const marker = markerElements.get(id);
  if (!marker) return;
  ['point', 'stem', 'label', 'valueText'].forEach(key => {
    removeElement(marker[key]);
  });
  markerElements.delete(id);
}

function renderAnswers() {
  if (!board) return;
  answerElements.forEach(removeElement);
  answerElements = [];
  if (!state.showAnswers) {
    answerLegend.hidden = true;
    board.update();
    return;
  }
  answerLegend.hidden = false;
  board.suspendUpdate();
  state.tasks.forEach(task => {
    const answerPoint = board.create('point', [task.value, BOARD_VIEW.answerHeight], {
      name: '',
      withLabel: false,
      size: 4,
      strokeColor: 'rgba(16, 185, 129, 0.85)',
      fillColor: 'rgba(16, 185, 129, 0.5)',
      fillOpacity: 1,
      fixed: true,
      showInfobox: false,
      highlight: false
    });
    const label = board.create('text', [
      () => answerPoint.X(),
      BOARD_VIEW.answerLabelY,
      () => task.label
    ], {
      anchorX: 'middle',
      anchorY: 'bottom',
      fontSize: 11,
      fixed: true,
      strokeColor: '#0f172a'
    });
    answerElements.push(answerPoint, label);
  });
  board.unsuspendUpdate();
}

function renderAxisTicks() {
  if (!board) return;
  axisElements.forEach(removeElement);
  axisElements = [];
  const ticks = generateTicks(state.domainMin, state.domainMax);
  const span = state.domainMax - state.domainMin;
  const decimals = determineDecimals(span);
  board.suspendUpdate();
  ticks.forEach(value => {
    const grid = board.create('segment', [
      [value, 0],
      [value, BOARD_VIEW.top]
    ], {
      strokeColor: 'rgba(148, 163, 184, 0.35)',
      strokeWidth: 1,
      fixed: true,
      highlight: false
    });
    const tick = board.create('segment', [
      [value, 0],
      [value, BOARD_VIEW.tickDown]
    ], {
      strokeColor: '#1f2937',
      strokeWidth: 1.4,
      fixed: true,
      highlight: false
    });
    const label = board.create('text', [value, BOARD_VIEW.tickLabelY, formatNumber(value, decimals)], {
      anchorX: 'middle',
      anchorY: 'top',
      fontSize: 12,
      fixed: true,
      strokeColor: '#334155'
    });
    axisElements.push(grid, tick, label);
  });
  board.unsuspendUpdate();
}

function removeElement(element) {
  if (!element || !board) return;
  try {
    board.removeObject(element);
  } catch (_) {
    /* ignore */
  }
}

function handleBoundingBoxChange() {
  if (!board || skipBoundingBoxHandler) return;
  const box = board.getBoundingBox();
  if (!Array.isArray(box) || box.length !== 4) return;
  const [min, top, max, bottom] = box;
  state.domainMin = min;
  state.domainMax = max;
  const topDiffers = Math.abs(top - BOARD_VIEW.top) > 1e-6;
  const bottomDiffers = Math.abs(bottom - BOARD_VIEW.bottom) > 1e-6;
  if (topDiffers || bottomDiffers) {
    skipBoundingBoxHandler = true;
    board.setBoundingBox([state.domainMin, BOARD_VIEW.top, state.domainMax, BOARD_VIEW.bottom], true);
    skipBoundingBoxHandler = false;
  }
  renderAxisTicks();
  updateDomainInfo();
  updateBoardStatus();
  updateMarkerStyles();
  updateTaskList();
}

function applyDomainToBoard() {
  if (!board) return;
  clampDomain();
  skipBoundingBoxHandler = true;
  board.setBoundingBox([state.domainMin, BOARD_VIEW.top, state.domainMax, BOARD_VIEW.bottom], true);
  skipBoundingBoxHandler = false;
  renderAxisTicks();
  updateDomainInfo();
  updateBoardStatus();
  updateMarkerStyles();
  updateTaskList();
}

function updateDomainInfo() {
  if (!domainInfo) return;
  domainInfo.textContent = `${formatNumber(state.domainMin, 2)} – ${formatNumber(state.domainMax, 2)}`;
}

function updateBoardStatus() {
  if (!boardContainer) return;
  const activeTask = getActiveTask();
  if (activeTask) {
    boardContainer.classList.add('is-placing');
    boardStatus.innerHTML = `Klikk på tallinja for å plassere <strong>${activeTask.label}</strong>.`;
    return;
  }
  boardContainer.classList.remove('is-placing');
  const span = state.domainMax - state.domainMin;
  const panText = settings.panEnabled
    ? 'Dra for å flytte tallinja'
    : 'Panorering er slått av. Bruk knappene for å flytte tallinja';
  const zoomText = settings.pinchZoomEnabled
    ? ' og bruk zoom-knappene eller klyp for å zoome'
    : ' og bruk zoom-knappene for å zoome';
  boardStatus.innerHTML = `${panText}${zoomText}. Intervallbredde: <strong>${formatNumber(span, 2)}</strong>.`;
}

function updateTaskList() {
  if (!taskList) return;
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
  if (!(span > 0)) return;
  const newSpan = Math.min(Math.max(span * factor, MIN_SPAN), MAX_SPAN);
  const ratio = newSpan / span;
  const center = anchorValue != null ? anchorValue : (state.domainMin + state.domainMax) / 2;
  const minOffset = center - state.domainMin;
  const maxOffset = state.domainMax - center;
  state.domainMin = center - minOffset * ratio;
  state.domainMax = center + maxOffset * ratio;
  clampDomain();
  applyDomainToBoard();
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

initialize();
