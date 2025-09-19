(function () {
  const SVG_NS = 'http://www.w3.org/2000/svg';
  const BOARD_WIDTH = 1000;
  const BOARD_HEIGHT = 700;
  const LABEL_OFFSET_X = 16;
  const LABEL_OFFSET_Y = -14;
  const POINT_DECORATIONS = ['circle', 'square', 'eye'];
  const DEFAULT_DECORATION = 'circle';
  const POINT_RADIUS = 11;
  const POINT_SQUARE_SIZE = POINT_RADIUS * 2;
  const POINT_EYE_HORIZONTAL = POINT_RADIUS + 2;
  const POINT_EYE_VERTICAL = Math.round(POINT_RADIUS * 0.7);

  function normalizeDecoration(value) {
    const candidate = typeof value === 'string' ? value.toLowerCase() : '';
    return POINT_DECORATIONS.includes(candidate) ? candidate : DEFAULT_DECORATION;
  }

  function deepClone(value) {
    if (value == null) return value;
    if (typeof structuredClone === 'function') {
      try {
        return structuredClone(value);
      } catch (_) {}
    }
    if (Array.isArray(value)) {
      return value.map(entry => deepClone(entry));
    }
    if (typeof value === 'object') {
      const clone = {};
      Object.keys(value).forEach(key => {
        clone[key] = deepClone(value[key]);
      });
      return clone;
    }
    try {
      return JSON.parse(JSON.stringify(value));
    } catch (_) {
      return value;
    }
  }

  const DEFAULT_STATE = {
    coordinateOrigin: 'bottom-left',
    points: [
      { id: 'p1', label: '21', x: 0.16, y: 0.32 },
      { id: 'p2', label: '28', x: 0.27, y: 0.38 },
      { id: 'p3', label: '35', x: 0.29, y: 0.52 },
      { id: 'p4', label: '42', x: 0.21, y: 0.64 },
      { id: 'p5', label: '49', x: 0.39, y: 0.68 },
      { id: 'p6', label: '56', x: 0.47, y: 0.82 },
      { id: 'p7', label: '63', x: 0.6, y: 0.74 },
      { id: 'p8', label: '7', x: 0.83, y: 0.8 },
      { id: 'p9', label: '70', x: 0.83, y: 0.46 },
      { id: 'p10', label: '14', x: 0.6, y: 0.34 }
    ],
    answerLines: [
      ['p1', 'p2'],
      ['p2', 'p3'],
      ['p3', 'p4'],
      ['p4', 'p5'],
      ['p5', 'p6'],
      ['p6', 'p7'],
      ['p7', 'p8'],
      ['p8', 'p9'],
      ['p9', 'p10'],
      ['p10', 'p5'],
      ['p10', 'p3'],
      ['p2', 'p10']
    ],
    predefinedLines: [['p3', 'p5']],
    showLabels: true,
    nextPointId: 11
  };

  const LIGHTNING_STATE = {
    coordinateOrigin: 'bottom-left',
    points: [
      { id: 'p1', label: 'A', x: 0.7, y: 0.65 },
      { id: 'p2', label: 'B', x: 0.55, y: 0.5 },
      { id: 'p3', label: 'C', x: 0.65, y: 0.5 },
      { id: 'p4', label: 'D', x: 0.5, y: 0.35 },
      { id: 'p5', label: 'E', x: 0.6, y: 0.35 },
      { id: 'p6', label: 'F', x: 0.5, y: 0.2 },
      { id: 'p7', label: 'G', x: 0.75, y: 0.4 },
      { id: 'p8', label: 'H', x: 0.65, y: 0.4 },
      { id: 'p9', label: 'I', x: 0.8, y: 0.55 },
      { id: 'p10', label: 'J', x: 0.7, y: 0.55 },
      { id: 'p11', label: 'K', x: 0.8, y: 0.65 }
    ],
    answerLines: [
      ['p1', 'p11'],
      ['p11', 'p9'],
      ['p9', 'p10'],
      ['p10', 'p3'],
      ['p3', 'p7'],
      ['p7', 'p8'],
      ['p8', 'p5'],
      ['p5', 'p6'],
      ['p6', 'p4'],
      ['p4', 'p2'],
      ['p2', 'p1']
    ],
    predefinedLines: [],
    showLabels: true,
    nextPointId: 12
  };

  const DEFAULT_PRIKK_TIL_PRIKK_EXAMPLES = [{
    id: 'prikktilprikk-example-1',
    exampleNumber: '1',
    title: 'Eksempel 1',
    isDefault: true,
    config: {
      STATE: DEFAULT_STATE
    }
  }, {
    id: 'prikktilprikk-example-2',
    exampleNumber: '2',
    title: 'Lyn',
    config: {
      STATE: LIGHTNING_STATE
    }
  }];

  if (typeof window !== 'undefined') {
    window.DEFAULT_EXAMPLES = DEFAULT_PRIKK_TIL_PRIKK_EXAMPLES.map(example => {
      const exampleState = example.config && example.config.STATE;
      return {
        ...example,
        config: {
          ...example.config,
          STATE: deepClone(exampleState)
        }
      };
    });
  }

  const board = document.getElementById('dotBoard');
  if (!board) return;

  const modeToggleBtn = document.getElementById('btnToggleMode');
  const modeLabel = document.getElementById('modeLabel');
  const modeHint = document.getElementById('modeHint');
  const checkBtn = document.getElementById('btnCheck');
  const clearBtn = document.getElementById('btnClear');
  const statusBox = document.getElementById('statusMessage');
  const addPointBtn = document.getElementById('btnAddPoint');
  const sortPointsBtn = document.getElementById('btnSortPoints');
  const pointListEl = document.getElementById('pointList');
  const showLabelsCheckbox = document.getElementById('cfg-showLabels');
  const answerCountEl = document.getElementById('answerCount');
  const predefCountEl = document.getElementById('predefCount');

  const baseGroup = document.createElementNS(SVG_NS, 'g');
  const userGroup = document.createElementNS(SVG_NS, 'g');
  const answerGroup = document.createElementNS(SVG_NS, 'g');
  const pointsGroup = document.createElementNS(SVG_NS, 'g');
  const labelsGroup = document.createElementNS(SVG_NS, 'g');
  baseGroup.classList.add('line-group', 'line-group--base');
  userGroup.classList.add('line-group', 'line-group--user');
  answerGroup.classList.add('line-group', 'line-group--answer');
  answerGroup.style.pointerEvents = 'none';
  pointsGroup.classList.add('points-group');
  labelsGroup.classList.add('labels-group');
  board.append(baseGroup, userGroup, answerGroup, pointsGroup, labelsGroup);

  const STATE = window.STATE && typeof window.STATE === 'object' ? window.STATE : {};
  window.STATE = STATE;

  const baseLines = new Set();
  const userLines = new Set();

  let isEditMode = true;
  let selectedPointId = null;

  const pointEditors = new Map();
  const pointElements = new Map();
  const labelElements = new Map();
  const baseLineElements = new Map();
  const userLineElements = new Map();
  const answerLineElements = new Map();

  let realPointIds = new Set();

  let draggedPointId = null;
  let draggingItemEl = null;
  let draggingItemOriginalDisplay = '';
  let draggingItemHeight = 0;
  let dropTargetEl = null;
  let dropTargetPointId = null;
  let dropPositionAfter = false;
  let dragPlaceholderEl = null;

  ensureStateDefaults();

  function ensureStateDefaults() {
    if (!Array.isArray(STATE.points) || STATE.points.length === 0) {
      const baseState = deepClone(DEFAULT_STATE) || {};
      STATE.points = Array.isArray(baseState.points) ? baseState.points : [];
      STATE.answerLines = Array.isArray(baseState.answerLines) ? baseState.answerLines : [];
      STATE.predefinedLines = Array.isArray(baseState.predefinedLines) ? baseState.predefinedLines : [];
      STATE.showLabels = baseState.showLabels !== false;
      STATE.nextPointId = Number.isFinite(baseState.nextPointId) ? baseState.nextPointId : STATE.points.length + 1;
      STATE.coordinateOrigin = typeof baseState.coordinateOrigin === 'string' ? baseState.coordinateOrigin : 'bottom-left';
    }
    if (typeof STATE.coordinateOrigin !== 'string') STATE.coordinateOrigin = 'bottom-left';
    if (!Array.isArray(STATE.answerLines)) STATE.answerLines = [];
    if (!Array.isArray(STATE.predefinedLines)) STATE.predefinedLines = [];
    if (typeof STATE.showLabels !== 'boolean') STATE.showLabels = true;
    if (!Number.isFinite(STATE.nextPointId)) STATE.nextPointId = STATE.points.length + 1;
  }

  function clamp01(value) {
    const num = Number(value);
    if (!Number.isFinite(num)) return 0;
    if (num <= 0) return 0;
    if (num >= 1) return 1;
    return num;
  }

  function percentString(value) {
    const num = Number(value);
    if (!Number.isFinite(num)) return '0';
    const rounded = Math.round(num * 1000) / 10;
    if (!Number.isFinite(rounded)) return '0';
    return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1);
  }

  function coordinateString(point) {
    if (!point) return '(0, 0)';
    return `(${percentString(point.x)}, ${percentString(point.y)})`;
  }

  function parseCoordinateInput(value) {
    if (typeof value !== 'string') return null;
    const matches = value.match(/-?\d+(?:[.,]\d+)?/g);
    if (!matches || matches.length < 2) return null;
    const parsePart = str => {
      const normalized = str.replace(',', '.');
      const num = Number(normalized);
      if (!Number.isFinite(num)) return null;
      if (num > 1) return clamp01(num / 100);
      return clamp01(num);
    };
    const x = parsePart(matches[0]);
    const y = parsePart(matches[1]);
    if (x == null || y == null) return null;
    return { x, y };
  }

  function makeLineKey(a, b) {
    const idA = String(a);
    const idB = String(b);
    if (!idA || !idB) return null;
    if (idA === idB) return null;
    return idA < idB ? `${idA}|${idB}` : `${idB}|${idA}`;
  }

  function keyToPair(key) {
    const parts = String(key).split('|');
    return { a: parts[0], b: parts[1] };
  }

  function sanitizeLineList(list, validPoints) {
    if (!Array.isArray(list)) return [];
    const sanitized = [];
    const seen = new Set();
    list.forEach(entry => {
      if (!entry) return;
      let first;
      let second;
      if (Array.isArray(entry)) {
        [first, second] = entry;
      } else if (typeof entry === 'object') {
        first = entry.from != null ? entry.from : entry.a != null ? entry.a : entry[0];
        second = entry.to != null ? entry.to : entry.b != null ? entry.b : entry[1];
      } else {
        return;
      }
      const idA = first != null ? String(first) : '';
      const idB = second != null ? String(second) : '';
      if (!validPoints.has(idA) || !validPoints.has(idB)) return;
      const key = makeLineKey(idA, idB);
      if (!key || seen.has(key)) return;
      seen.add(key);
      const [a, b] = key.split('|');
      sanitized.push([a, b]);
    });
    return sanitized;
  }

  function buildSequentialAnswerLines(points) {
    if (!Array.isArray(points)) return [];
    const sequential = [];
    const usedKeys = new Set();
    let previous = null;
    points.forEach(point => {
      if (!point || point.isFalse) return;
      if (previous) {
        const key = makeLineKey(previous.id, point.id);
        if (key && !usedKeys.has(key)) {
          sequential.push([previous.id, point.id]);
          usedKeys.add(key);
        }
      }
      previous = point;
    });
    return sequential;
  }

  function ensureBottomLeftOrigin() {
    if (!STATE || typeof STATE !== 'object') return;
    const origin = typeof STATE.coordinateOrigin === 'string' ? STATE.coordinateOrigin : null;
    if (origin === 'bottom-left') return;
    if (Array.isArray(STATE.points)) {
      STATE.points = STATE.points.map(point => {
        if (!point || typeof point !== 'object') return point;
        const clone = { ...point };
        const rawY = Number(point.y);
        if (Number.isFinite(rawY)) clone.y = 1 - rawY;
        return clone;
      });
    }
    STATE.coordinateOrigin = 'bottom-left';
  }

  function sanitizeState() {
    ensureBottomLeftOrigin();
    if (!Array.isArray(STATE.points)) STATE.points = [];
    const sanitizedPoints = [];
    const usedIds = new Set();
    STATE.points.forEach((point, idx) => {
      if (!point || typeof point !== 'object') return;
      let id = point.id;
      if (typeof id !== 'string' || !id) id = `p${idx + 1}`;
      if (usedIds.has(id)) {
        let suffix = 1;
        let candidate = `${id}_${suffix}`;
        while (usedIds.has(candidate)) {
          suffix += 1;
          candidate = `${id}_${suffix}`;
        }
        id = candidate;
      }
      const sanitizedPoint = {
        id,
        label: typeof point.label === 'string' ? point.label : String(idx + 1),
        x: clamp01(point.x),
        y: clamp01(point.y),
        isFalse: !!point.isFalse,
        decoration: normalizeDecoration(point.decoration)
      };
      usedIds.add(id);
      sanitizedPoints.push(sanitizedPoint);
    });
    STATE.points = sanitizedPoints;
    const validPoints = new Set(sanitizedPoints.map(p => p.id));
    realPointIds = new Set();
    sanitizedPoints.forEach(point => {
      if (point && !point.isFalse) realPointIds.add(point.id);
    });
    STATE.predefinedLines = sanitizeLineList(STATE.predefinedLines, realPointIds);
    STATE.answerLines = buildSequentialAnswerLines(sanitizedPoints);
    let nextCandidate = 1;
    sanitizedPoints.forEach(point => {
      const match = point.id.match(/([0-9]+)$/);
      if (!match) return;
      const num = parseInt(match[1], 10);
      if (Number.isFinite(num) && num + 1 > nextCandidate) nextCandidate = num + 1;
    });
    if (!Number.isFinite(STATE.nextPointId) || STATE.nextPointId < nextCandidate) {
      STATE.nextPointId = nextCandidate;
    }
    if (typeof STATE.showLabels !== 'boolean') STATE.showLabels = true;
    return validPoints;
  }

  function syncBaseLines(validPoints) {
    baseLines.clear();
    STATE.predefinedLines.forEach(([a, b]) => {
      const key = makeLineKey(a, b);
      if (key) baseLines.add(key);
    });
    const toDelete = [];
    userLines.forEach(key => {
      const { a, b } = keyToPair(key);
      if (!validPoints.has(a) || !validPoints.has(b) || baseLines.has(key) || !realPointIds.has(a) || !realPointIds.has(b)) {
        toDelete.push(key);
      }
    });
    toDelete.forEach(key => userLines.delete(key));
  }

  function prepareState() {
    const validPoints = sanitizeState();
    syncBaseLines(validPoints);
    if (showLabelsCheckbox) showLabelsCheckbox.checked = !!STATE.showLabels;
    document.body.classList.toggle('labels-hidden', !STATE.showLabels);
    return validPoints;
  }

  function toPixel(point) {
    const normX = clamp01(point.x);
    const normY = clamp01(point.y);
    return {
      x: normX * BOARD_WIDTH,
      y: (1 - normY) * BOARD_HEIGHT
    };
  }

  function setLineAttrs(line, p1, p2) {
    const pos1 = toPixel(p1);
    const pos2 = toPixel(p2);
    line.setAttribute('x1', pos1.x);
    line.setAttribute('y1', pos1.y);
    line.setAttribute('x2', pos2.x);
    line.setAttribute('y2', pos2.y);
  }

  function clientToNormalized(clientX, clientY) {
    const rect = board.getBoundingClientRect();
    const width = rect.width || 1;
    const height = rect.height || 1;
    const rawX = (clientX - rect.left) / width;
    const rawY = (clientY - rect.top) / height;
    return {
      x: clamp01(rawX),
      y: clamp01(1 - rawY)
    };
  }

  function updatePointEditorValues(pointId) {
    const editor = pointEditors.get(pointId);
    const point = STATE.points.find(p => p.id === pointId);
    if (!editor || !point) return;
    if (editor.labelInput) editor.labelInput.value = point.label;
    if (editor.coordInput) editor.coordInput.value = coordinateString(point);
  }

  function updateLinesForPoint(pointId) {
    const pointMap = new Map(STATE.points.map(p => [p.id, p]));
    const updater = collection => {
      collection.forEach(data => {
        if (data.a !== pointId && data.b !== pointId) return;
        const p1 = pointMap.get(data.a);
        const p2 = pointMap.get(data.b);
        if (!p1 || !p2) return;
        setLineAttrs(data.element, p1, p2);
      });
    };
    updater(baseLineElements);
    updater(userLineElements);
    updater(answerLineElements);
  }

  function attachPointInteraction(element, pointId) {
    element.addEventListener('pointerdown', event => {
      event.preventDefault();
      const pointerId = event.pointerId;
      let moved = false;
      const onMove = e => {
        if (!isEditMode) return;
        moved = true;
        const { x, y } = clientToNormalized(e.clientX, e.clientY);
        updatePointPosition(pointId, x, y);
      };
      const onEnd = () => {
        element.removeEventListener('pointermove', onMove);
        element.removeEventListener('pointerup', onEnd);
        element.removeEventListener('pointercancel', onEnd);
        try {
          element.releasePointerCapture(pointerId);
        } catch (_) {}
        if (!moved) handlePointSelection(pointId);
        else updatePointEditorValues(pointId);
      };
      try {
        element.setPointerCapture(pointerId);
      } catch (_) {}
      element.addEventListener('pointermove', onMove);
      element.addEventListener('pointerup', onEnd);
      element.addEventListener('pointercancel', onEnd);
    });
  }

  function updatePointPosition(pointId, normX, normY) {
    const point = STATE.points.find(p => p.id === pointId);
    if (!point) return;
    point.x = clamp01(normX);
    point.y = clamp01(normY);
    const pos = toPixel(point);
    const visual = pointElements.get(pointId);
    if (visual) {
      updatePointVisualPosition(visual, point, pos);
    }
    const label = labelElements.get(pointId);
    if (label) {
      label.setAttribute('x', pos.x + LABEL_OFFSET_X);
      label.setAttribute('y', pos.y + LABEL_OFFSET_Y);
    }
    updateLinesForPoint(pointId);
  }

  function clearDragVisualState() {
    if (!pointListEl) return;
    pointListEl.querySelectorAll('.point-item').forEach(el => {
      el.classList.remove('drop-before', 'drop-after');
      delete el.dataset.dropPosition;
    });
    if (dragPlaceholderEl && dragPlaceholderEl.parentNode) {
      dragPlaceholderEl.parentNode.removeChild(dragPlaceholderEl);
    }
    dragPlaceholderEl = null;
    dropTargetEl = null;
    dropTargetPointId = null;
    dropPositionAfter = false;
  }

  function ensureDragPlaceholder(referenceItem) {
    if (!pointListEl) return null;
    if (!dragPlaceholderEl) {
      dragPlaceholderEl = document.createElement('div');
      dragPlaceholderEl.className = 'point-item point-placeholder';
      dragPlaceholderEl.setAttribute('aria-hidden', 'true');
      const label = document.createElement('div');
      label.className = 'point-placeholder-label';
      label.textContent = 'Slipp her';
      dragPlaceholderEl.appendChild(label);
      dragPlaceholderEl.addEventListener('dragover', event => {
        if (!draggedPointId) return;
        event.preventDefault();
        if (event.dataTransfer) event.dataTransfer.dropEffect = 'move';
      });
      dragPlaceholderEl.addEventListener('drop', event => {
        handlePointDrop(event);
      });
    }
    const height = draggingItemHeight || (referenceItem ? referenceItem.getBoundingClientRect().height : 0);
    if (height > 0) {
      dragPlaceholderEl.style.height = `${Math.round(height)}px`;
    } else {
      dragPlaceholderEl.style.removeProperty('height');
    }
    return dragPlaceholderEl;
  }

  function updateDropPreview(pointId, item, placeAfter) {
    if (!pointListEl || !item) return;
    const placeholder = ensureDragPlaceholder(item);
    if (!placeholder) return;
    const parent = pointListEl;
    if (placeAfter) {
      if (item.nextSibling !== placeholder) {
        parent.insertBefore(placeholder, item.nextSibling);
      }
    } else if (parent !== placeholder.parentNode || placeholder.nextSibling !== item) {
      parent.insertBefore(placeholder, item);
    }
    dropTargetPointId = pointId;
    dropPositionAfter = !!placeAfter;
    placeholder.dataset.dropTargetId = pointId;
    placeholder.dataset.dropPosition = placeAfter ? 'after' : 'before';
  }

  function handlePointDragStart(event, pointId, item) {
    draggedPointId = pointId;
    draggingItemEl = item;
    draggingItemOriginalDisplay = item ? item.style.display : '';
    draggingItemHeight = item ? item.getBoundingClientRect().height : 0;
    dropTargetEl = null;
    dropTargetPointId = null;
    dropPositionAfter = false;
    const placeholder = ensureDragPlaceholder(item);
    if (placeholder && item && item.parentNode) {
      placeholder.dataset.dropTargetId = '';
      placeholder.dataset.dropPosition = '';
      item.parentNode.insertBefore(placeholder, item.nextSibling);
    }
    if (event.dataTransfer) {
      event.dataTransfer.effectAllowed = 'move';
      try {
        event.dataTransfer.setData('text/plain', pointId);
      } catch (_) {}
    }
    requestAnimationFrame(() => {
      if (draggingItemEl) {
        draggingItemEl.classList.add('is-dragging');
        draggingItemEl.setAttribute('aria-hidden', 'true');
        draggingItemEl.style.display = 'none';
      }
    });
  }

  function handlePointDragEnd() {
    if (draggingItemEl) {
      draggingItemEl.classList.remove('is-dragging');
      draggingItemEl.removeAttribute('aria-hidden');
      draggingItemEl.style.display = draggingItemOriginalDisplay || '';
    }
    draggingItemOriginalDisplay = '';
    draggingItemHeight = 0;
    draggingItemEl = null;
    draggedPointId = null;
    clearDragVisualState();
  }

  function handlePointDragOver(event, pointId, item) {
    if (!draggedPointId || draggedPointId === pointId) return;
    event.preventDefault();
    if (event.dataTransfer) event.dataTransfer.dropEffect = 'move';
    if (dropTargetEl && dropTargetEl !== item) {
      dropTargetEl.classList.remove('drop-before', 'drop-after');
      delete dropTargetEl.dataset.dropPosition;
    }
    dropTargetEl = item;
    const rect = item.getBoundingClientRect();
    const isAfter = event.clientY >= rect.top + rect.height / 2;
    item.classList.remove('drop-before', 'drop-after');
    item.classList.add(isAfter ? 'drop-after' : 'drop-before');
    item.dataset.dropPosition = isAfter ? 'after' : 'before';
    updateDropPreview(pointId, item, isAfter);
  }

  function handlePointDragLeave(event, item) {
    if (!draggedPointId || dropTargetEl !== item) return;
    const related = event.relatedTarget;
    if (related && (item.contains(related) || (dragPlaceholderEl && dragPlaceholderEl.contains(related)))) return;
    item.classList.remove('drop-before', 'drop-after');
    delete item.dataset.dropPosition;
    dropTargetEl = null;
  }

  function reorderPoints(sourceId, targetId, placeAfter) {
    if (sourceId === targetId) return false;
    const sourceIdx = STATE.points.findIndex(p => p.id === sourceId);
    const targetIdx = STATE.points.findIndex(p => p.id === targetId);
    if (sourceIdx < 0 || targetIdx < 0) return false;
    const [entry] = STATE.points.splice(sourceIdx, 1);
    if (!entry) return false;
    const targetIdxAfterRemoval = targetIdx - (sourceIdx < targetIdx ? 1 : 0);
    let insertIndex = targetIdxAfterRemoval + (placeAfter ? 1 : 0);
    if (insertIndex < 0) insertIndex = 0;
    if (insertIndex > STATE.points.length) insertIndex = STATE.points.length;
    STATE.points.splice(insertIndex, 0, entry);
    return true;
  }

  function handlePointDrop(event, targetPointId) {
    if (!draggedPointId) return;
    event.preventDefault();
    event.stopPropagation();
    const sourceId = draggedPointId;
    let resolvedTarget = dropTargetPointId || targetPointId;
    if (!resolvedTarget && dragPlaceholderEl && dragPlaceholderEl.dataset.dropTargetId) {
      resolvedTarget = dragPlaceholderEl.dataset.dropTargetId;
    }
    if (!resolvedTarget && event && event.currentTarget && event.currentTarget.dataset) {
      resolvedTarget = event.currentTarget.dataset.pointId;
    }
    let placeAfter = dropTargetPointId != null ? dropPositionAfter : false;
    if (dropTargetPointId == null) {
      const datasetSource = (dropTargetEl && dropTargetEl.dataset) || (event.currentTarget && event.currentTarget.dataset) || (dragPlaceholderEl && dragPlaceholderEl.dataset) || {};
      if (datasetSource.dropPosition) placeAfter = datasetSource.dropPosition === 'after';
    }
    const changed = resolvedTarget ? reorderPoints(sourceId, resolvedTarget, placeAfter) : false;
    handlePointDragEnd();
    if (!changed) return;
    const validPoints = prepareState();
    renderPointList(validPoints);
    renderBoard(validPoints);
  }

  function sortPoints() {
    const collator = new Intl.Collator('nb', { numeric: true, sensitivity: 'base' });
    STATE.points.sort((a, b) => {
      const labelA = a && typeof a.label === 'string' ? a.label : '';
      const labelB = b && typeof b.label === 'string' ? b.label : '';
      const compareLabel = collator.compare(labelA, labelB);
      if (compareLabel !== 0) return compareLabel;
      const idA = a && typeof a.id === 'string' ? a.id : '';
      const idB = b && typeof b.id === 'string' ? b.id : '';
      return collator.compare(idA, idB);
    });
    const validPoints = prepareState();
    renderPointList(validPoints);
    renderBoard(validPoints);
  }

  function renderPointList(validPoints) {
    if (!pointListEl) return;
    if (!validPoints) validPoints = prepareState();
    pointEditors.clear();
    pointListEl.innerHTML = '';
    clearDragVisualState();
    STATE.points.forEach((point, index) => {
      const item = document.createElement('div');
      item.className = 'point-item';
      item.dataset.pointId = point.id;

      const handle = document.createElement('button');
      handle.type = 'button';
      handle.className = 'point-handle';
      handle.setAttribute('aria-label', 'Flytt punkt');
      handle.setAttribute('title', 'Dra for å endre rekkefølge');
      handle.draggable = true;
      const handleIcon = document.createElement('span');
      handleIcon.className = 'point-handle-icon';
      handleIcon.setAttribute('aria-hidden', 'true');
      handleIcon.textContent = '⠿';
      handle.appendChild(handleIcon);
      handle.addEventListener('dragstart', event => {
        handlePointDragStart(event, point.id, item);
      });
      handle.addEventListener('dragend', () => {
        handlePointDragEnd();
      });
      handle.addEventListener('click', event => {
        event.preventDefault();
      });
      item.appendChild(handle);

      const orderBadge = document.createElement('span');
      orderBadge.className = 'point-order';
      orderBadge.textContent = String(index + 1);
      item.appendChild(orderBadge);

      const coordInput = document.createElement('input');
      coordInput.type = 'text';
      coordInput.inputMode = 'decimal';
      coordInput.className = 'point-input point-input--coord';
      coordInput.placeholder = '(50, 50)';
      coordInput.setAttribute('aria-label', 'Koordinat (x,y)');
      coordInput.value = coordinateString(point);
      const commitCoordChange = () => {
        const parsed = parseCoordinateInput(coordInput.value);
        if (!parsed) {
          coordInput.value = coordinateString(point);
          return;
        }
        updatePointPosition(point.id, parsed.x, parsed.y);
        coordInput.value = coordinateString(point);
      };
      coordInput.addEventListener('change', commitCoordChange);
      coordInput.addEventListener('blur', commitCoordChange);
      coordInput.addEventListener('keydown', event => {
        if (event.key === 'Enter') {
          event.preventDefault();
          commitCoordChange();
          coordInput.blur();
        }
      });
      item.appendChild(coordInput);

      const labelInput = document.createElement('input');
      labelInput.type = 'text';
      labelInput.className = 'point-input point-input--label';
      labelInput.placeholder = 'Tekst';
      labelInput.setAttribute('aria-label', 'Tekst');
      labelInput.value = point.label;
      labelInput.addEventListener('input', () => {
        point.label = labelInput.value;
        const text = labelElements.get(point.id);
        if (text) text.textContent = point.label;
      });
      item.appendChild(labelInput);

      const controls = document.createElement('div');
      controls.className = 'point-controls';

      const falseLabel = document.createElement('label');
      falseLabel.className = 'point-flag';
      const falseCheckbox = document.createElement('input');
      falseCheckbox.type = 'checkbox';
      falseCheckbox.className = 'point-flag-checkbox';
      falseCheckbox.checked = !!point.isFalse;
      falseCheckbox.addEventListener('change', () => {
        point.isFalse = falseCheckbox.checked;
        updatePointVisualClasses(pointElements.get(point.id), point);
        const label = labelElements.get(point.id);
        if (label) label.classList.toggle('point-label--false', point.isFalse);
        renderBoard();
      });
      const falseLabelText = document.createElement('span');
      falseLabelText.textContent = 'Falskt punkt';
      falseLabel.append(falseCheckbox, falseLabelText);
      controls.appendChild(falseLabel);

      const decorationLabel = document.createElement('label');
      decorationLabel.className = 'point-decoration-label';
      const decorationText = document.createElement('span');
      decorationText.textContent = 'Dekorasjon';
      const decorationSelect = document.createElement('select');
      decorationSelect.className = 'point-decoration-select';
      POINT_DECORATIONS.forEach(type => {
        const option = document.createElement('option');
        option.value = type;
        option.textContent = type === 'circle' ? 'Sirkel' : type === 'square' ? 'Kvadrat' : 'Øye';
        decorationSelect.appendChild(option);
      });
      decorationSelect.value = normalizeDecoration(point.decoration);
      decorationSelect.addEventListener('change', () => {
        point.decoration = normalizeDecoration(decorationSelect.value);
        const visual = pointElements.get(point.id);
        if (visual) {
          updatePointVisualClasses(visual, point);
          updatePointVisualPosition(visual, point);
        }
        renderBoard();
      });
      decorationLabel.append(decorationText, decorationSelect);
      controls.appendChild(decorationLabel);

      item.appendChild(controls);

      const removeBtn = document.createElement('button');
      removeBtn.type = 'button';
      removeBtn.className = 'btn btn--small point-remove';
      removeBtn.textContent = 'Fjern';
      removeBtn.addEventListener('click', event => {
        event.preventDefault();
        event.stopPropagation();
        removePoint(point.id);
      });
      item.appendChild(removeBtn);

      item.addEventListener('dragover', event => {
        handlePointDragOver(event, point.id, item);
      });
      item.addEventListener('dragleave', event => {
        handlePointDragLeave(event, item);
      });
      item.addEventListener('drop', event => {
        handlePointDrop(event, point.id);
      });

      pointListEl.appendChild(item);
      pointEditors.set(point.id, {
        itemEl: item,
        orderEl: orderBadge,
        coordInput,
        labelInput,
        falseCheckbox,
        decorationSelect
      });
    });
    applySelectionHighlight();
  }

  function applySelectionHighlight() {
    pointElements.forEach((visual, id) => {
      if (!visual || !visual.group) return;
      visual.group.classList.toggle('is-selected', id === selectedPointId);
    });
    pointEditors.forEach((editor, id) => {
      if (editor.itemEl) editor.itemEl.classList.toggle('is-selected', id === selectedPointId);
    });
  }

  function createDecorationElement(type) {
    if (type === 'square') {
      const rect = document.createElementNS(SVG_NS, 'rect');
      rect.setAttribute('rx', 5);
      rect.setAttribute('ry', 5);
      return rect;
    }
    if (type === 'eye') {
      return document.createElementNS(SVG_NS, 'path');
    }
    return document.createElementNS(SVG_NS, 'circle');
  }

  function updatePointVisualClasses(visual, point) {
    if (!visual || !visual.group) return;
    POINT_DECORATIONS.forEach(type => {
      visual.group.classList.remove(`point--decoration-${type}`);
    });
    const decorationType = normalizeDecoration(point && point.decoration);
    const expectedTag = decorationType === 'square' ? 'rect' : decorationType === 'eye' ? 'path' : 'circle';
    if (!visual.decoration || visual.decoration.tagName.toLowerCase() !== expectedTag) {
      const newDecoration = createDecorationElement(decorationType);
      newDecoration.classList.add('point-decoration');
      if (visual.decoration && visual.decoration.parentNode === visual.group) {
        visual.group.replaceChild(newDecoration, visual.decoration);
      } else if (visual.dot && visual.dot.parentNode === visual.group) {
        visual.group.insertBefore(newDecoration, visual.dot);
      } else {
        visual.group.appendChild(newDecoration);
      }
      visual.decoration = newDecoration;
    }
    visual.group.classList.add(`point--decoration-${decorationType}`);
    visual.group.classList.toggle('point--false', !!(point && point.isFalse));
    visual.decorationType = decorationType;
  }

  function updatePointVisualPosition(visual, point, pos) {
    if (!visual || !visual.group || !visual.decoration || !visual.dot) return;
    const coords = pos || toPixel(point);
    const { x, y } = coords;
    const type = visual.decorationType || normalizeDecoration(point && point.decoration);
    if (type === 'square') {
      const size = POINT_SQUARE_SIZE;
      visual.decoration.setAttribute('x', x - size / 2);
      visual.decoration.setAttribute('y', y - size / 2);
      visual.decoration.setAttribute('width', size);
      visual.decoration.setAttribute('height', size);
      visual.decoration.setAttribute('rx', 5);
      visual.decoration.setAttribute('ry', 5);
    } else if (type === 'eye') {
      const hr = POINT_EYE_HORIZONTAL;
      const vr = POINT_EYE_VERTICAL;
      const d = [
        `M ${x - hr} ${y}`,
        `Q ${x} ${y - vr} ${x + hr} ${y}`,
        `Q ${x} ${y + vr} ${x - hr} ${y}`,
        'Z'
      ].join(' ');
      visual.decoration.setAttribute('d', d);
    } else {
      visual.decoration.setAttribute('cx', x);
      visual.decoration.setAttribute('cy', y);
      visual.decoration.setAttribute('r', POINT_RADIUS);
    }
    visual.dot.setAttribute('cx', x);
    visual.dot.setAttribute('cy', y);
  }

  function createPointVisual(point, pos) {
    const decorationType = normalizeDecoration(point && point.decoration);
    const group = document.createElementNS(SVG_NS, 'g');
    group.classList.add('point');
    group.dataset.pointId = point.id;

    const decoration = createDecorationElement(decorationType);
    decoration.classList.add('point-decoration');
    group.appendChild(decoration);

    const dot = document.createElementNS(SVG_NS, 'circle');
    dot.classList.add('point-dot');
    dot.setAttribute('r', 4.5);
    group.appendChild(dot);

    attachPointInteraction(group, point.id);

    const visual = { group, decoration, dot, decorationType };
    updatePointVisualClasses(visual, point);
    updatePointVisualPosition(visual, point, pos);
    return visual;
  }

  function updatePointEditors() {
    STATE.points.forEach((point, index) => {
      const editor = pointEditors.get(point.id);
      if (!editor) return;
      if (editor.orderEl) editor.orderEl.textContent = String(index + 1);
      if (editor.labelInput) editor.labelInput.value = point.label;
      if (editor.coordInput) editor.coordInput.value = coordinateString(point);
      if (editor.falseCheckbox) editor.falseCheckbox.checked = !!point.isFalse;
      if (editor.decorationSelect) editor.decorationSelect.value = normalizeDecoration(point.decoration);
      if (editor.itemEl) editor.itemEl.dataset.pointId = point.id;
    });
  }

  function renderBoard(validPoints) {
    if (!validPoints) validPoints = prepareState();
    document.body.classList.toggle('labels-hidden', !STATE.showLabels);

    const pointMap = new Map(STATE.points.map(p => [p.id, p]));

    baseGroup.innerHTML = '';
    baseLineElements.clear();
    STATE.predefinedLines.forEach(([a, b]) => {
      const p1 = pointMap.get(a);
      const p2 = pointMap.get(b);
      if (!p1 || !p2) return;
      const line = document.createElementNS(SVG_NS, 'line');
      setLineAttrs(line, p1, p2);
      line.classList.add('line-predefined');
      const key = makeLineKey(a, b);
      if (key) {
        line.dataset.key = key;
        line.dataset.type = 'predefined';
        baseLineElements.set(key, { element: line, a, b });
      }
      baseGroup.appendChild(line);
    });

    userGroup.innerHTML = '';
    userLineElements.clear();
    const toRemove = [];
    userLines.forEach(key => {
      const { a, b } = keyToPair(key);
      const p1 = pointMap.get(a);
      const p2 = pointMap.get(b);
      if (!p1 || !p2) {
        toRemove.push(key);
        return;
      }
      const line = document.createElementNS(SVG_NS, 'line');
      setLineAttrs(line, p1, p2);
      line.classList.add('line-user');
      line.dataset.key = key;
      line.dataset.type = 'user';
      line.addEventListener('pointerdown', event => {
        event.preventDefault();
        if (baseLines.has(key)) return;
        userLines.delete(key);
        clearStatus();
        selectedPointId = null;
        renderBoard();
      });
      userGroup.appendChild(line);
      userLineElements.set(key, { element: line, a, b });
    });
    toRemove.forEach(key => userLines.delete(key));

    answerGroup.innerHTML = '';
    answerLineElements.clear();
    if (isEditMode) {
      STATE.answerLines.forEach(([a, b]) => {
        const p1 = pointMap.get(a);
        const p2 = pointMap.get(b);
        if (!p1 || !p2) return;
        const line = document.createElementNS(SVG_NS, 'line');
        setLineAttrs(line, p1, p2);
        line.classList.add('line-answer');
        answerGroup.appendChild(line);
        const key = makeLineKey(a, b);
        if (key) answerLineElements.set(key, { element: line, a, b });
      });
    }

    pointsGroup.innerHTML = '';
    labelsGroup.innerHTML = '';
    pointElements.clear();
    labelElements.clear();
    STATE.points.forEach(point => {
      const pos = toPixel(point);
      const visual = createPointVisual(point, pos);
      pointsGroup.appendChild(visual.group);
      pointElements.set(point.id, visual);

      const text = document.createElementNS(SVG_NS, 'text');
      text.textContent = point.label;
      text.setAttribute('x', pos.x + LABEL_OFFSET_X);
      text.setAttribute('y', pos.y + LABEL_OFFSET_Y);
      text.setAttribute('text-anchor', 'start');
      text.setAttribute('dominant-baseline', 'middle');
      text.classList.add('point-label');
      if (point.isFalse) text.classList.add('point-label--false');
      if (!STATE.showLabels) text.style.display = 'none';
      labelsGroup.appendChild(text);
      labelElements.set(point.id, text);
    });

    updatePointEditors();
    updateCounts();
    applySelectionHighlight();
    updateModeHint();
  }

  function updateCounts() {
    if (answerCountEl) answerCountEl.textContent = String(STATE.answerLines.length);
    if (predefCountEl) predefCountEl.textContent = String(STATE.predefinedLines.length);
  }

  function handlePointSelection(pointId) {
    if (isEditMode) {
      selectedPointId = selectedPointId === pointId ? null : pointId;
      applySelectionHighlight();
      return;
    }
    if (selectedPointId == null) {
      selectedPointId = pointId;
      applySelectionHighlight();
      return;
    }
    if (selectedPointId === pointId) {
      selectedPointId = null;
      applySelectionHighlight();
      return;
    }
    clearStatus();
    const key = makeLineKey(selectedPointId, pointId);
    if (!key) {
      selectedPointId = null;
      applySelectionHighlight();
      return;
    }
    const { a, b } = keyToPair(key);
    if (!realPointIds.has(a) || !realPointIds.has(b)) {
      selectedPointId = pointId;
      applySelectionHighlight();
      return;
    }
    if (baseLines.has(key)) {
      selectedPointId = pointId;
      applySelectionHighlight();
      return;
    }
    if (userLines.has(key)) {
      userLines.delete(key);
    } else {
      userLines.add(key);
    }
    selectedPointId = pointId;
    renderBoard();
  }

  function showStatus(type, heading, detailLines) {
    if (!statusBox) return;
    if (!type || !heading) {
      statusBox.className = 'status';
      statusBox.innerHTML = '';
      return;
    }
    statusBox.className = `status status--${type}`;
    statusBox.innerHTML = '';
    const strong = document.createElement('strong');
    if (type === 'success') {
      const icon = document.createElement('span');
      icon.setAttribute('aria-hidden', 'true');
      icon.textContent = '🏆';
      strong.append(icon, document.createTextNode(` ${heading}`));
    } else {
      strong.textContent = heading;
    }
    statusBox.appendChild(strong);
    if (Array.isArray(detailLines)) {
      detailLines.forEach(line => {
        if (!line) return;
        const p = document.createElement('div');
        p.textContent = line;
        statusBox.appendChild(p);
      });
    }
  }

  function clearStatus() {
    showStatus(null, null);
  }

  function describeLine(key, pointMap) {
    const { a, b } = keyToPair(key);
    const p1 = pointMap.get(a);
    const p2 = pointMap.get(b);
    const labelA = p1 && typeof p1.label === 'string' && p1.label ? p1.label : a;
    const labelB = p2 && typeof p2.label === 'string' && p2.label ? p2.label : b;
    return `${labelA}–${labelB}`;
  }

  function checkSolution() {
    prepareState();
    if (!STATE.answerLines.length) {
      showStatus('info', 'Ingen fasit er definert ennå.');
      return;
    }
    const pointMap = new Map(STATE.points.map(p => [p.id, p]));
    const answerKeys = new Set(STATE.answerLines.map(([a, b]) => makeLineKey(a, b)).filter(Boolean));
    const drawnKeys = new Set([...baseLines, ...userLines]);
    const missing = [];
    answerKeys.forEach(key => {
      if (!drawnKeys.has(key)) missing.push(key);
    });
    const extras = [];
    drawnKeys.forEach(key => {
      if (!answerKeys.has(key) && !baseLines.has(key)) extras.push(key);
    });
    if (missing.length === 0 && extras.length === 0) {
      showStatus('success', 'Det er riktig!');
      return;
    }
    const details = [];
    if (missing.length) {
      details.push(`Mangler: ${missing.map(key => describeLine(key, pointMap)).join(', ')}`);
    }
    if (extras.length) {
      details.push(`Ekstra: ${extras.map(key => describeLine(key, pointMap)).join(', ')}`);
    }
    showStatus('error', 'Ikke helt riktig ennå.', details);
  }

  function updateModeHint() {
    if (!modeHint) return;
    if (isEditMode) {
      modeHint.textContent = 'Fasit-strekene følger rekkefølgen på ekte punkter. Dra i punktene for å endre plassering.';
      return;
    }
    modeHint.textContent = 'Klikk på to punkter for å tegne en strek. Klikk på en strek for å fjerne den.';
  }

  function updateModeUI() {
    if (modeToggleBtn) {
      modeToggleBtn.textContent = isEditMode ? 'Gå til spillmodus' : 'Gå til redigeringsmodus';
    }
    if (modeLabel) modeLabel.textContent = isEditMode ? 'Redigeringsmodus' : 'Spillmodus';
    if (checkBtn) checkBtn.disabled = isEditMode;
    if (clearBtn) clearBtn.disabled = isEditMode;
    document.body.classList.toggle('is-edit-mode', isEditMode);
    document.body.classList.toggle('is-play-mode', !isEditMode);
    updateModeHint();
  }

  function createPointId() {
    const existing = new Set(STATE.points.map(p => String(p.id)));
    let next = Number.isFinite(STATE.nextPointId) ? Math.floor(STATE.nextPointId) : existing.size + 1;
    if (next < 1) next = existing.size + 1;
    let id;
    do {
      id = `p${next++}`;
    } while (existing.has(id));
    STATE.nextPointId = next;
    return id;
  }

  function addPoint() {
    const id = createPointId();
    const count = STATE.points.length;
    const radius = 0.3;
    const angle = count === 0 ? 0 : count * (2 * Math.PI / Math.max(count + 1, 6));
    const x = clamp01(0.5 + Math.cos(angle) * radius);
    const y = clamp01(0.5 + Math.sin(angle) * radius);
    STATE.points.push({
      id,
      label: String(count + 1),
      x,
      y,
      isFalse: false,
      decoration: DEFAULT_DECORATION
    });
    selectedPointId = id;
    renderPointList();
    renderBoard();
    clearStatus();
  }

  function removePoint(pointId) {
    const idx = STATE.points.findIndex(p => p.id === pointId);
    if (idx < 0) return;
    STATE.points.splice(idx, 1);
    STATE.answerLines = STATE.answerLines.filter(([a, b]) => a !== pointId && b !== pointId);
    STATE.predefinedLines = STATE.predefinedLines.filter(([a, b]) => a !== pointId && b !== pointId);
    const toDelete = [];
    userLines.forEach(key => {
      const { a, b } = keyToPair(key);
      if (a === pointId || b === pointId) toDelete.push(key);
    });
    toDelete.forEach(key => userLines.delete(key));
    if (selectedPointId === pointId) selectedPointId = null;
    renderPointList();
    renderBoard();
    clearStatus();
  }

  function clearUserLines() {
    userLines.clear();
    selectedPointId = null;
    renderBoard();
  }

  function rebuildAll(resetDrawn = false) {
    if (resetDrawn) userLines.clear();
    const validPoints = prepareState();
    renderPointList(validPoints);
    renderBoard(validPoints);
    updateModeUI();
  }

  if (addPointBtn) {
    addPointBtn.addEventListener('click', () => {
      addPoint();
    });
  }

  if (sortPointsBtn) {
    sortPointsBtn.addEventListener('click', () => {
      sortPoints();
      clearStatus();
    });
  }

  if (checkBtn) {
    checkBtn.addEventListener('click', () => {
      checkSolution();
    });
  }

  if (clearBtn) {
    clearBtn.addEventListener('click', () => {
      clearStatus();
      clearUserLines();
    });
  }

  if (modeToggleBtn) {
    modeToggleBtn.addEventListener('click', () => {
      isEditMode = !isEditMode;
      selectedPointId = null;
      clearStatus();
      updateModeUI();
      renderBoard();
    });
  }

  if (showLabelsCheckbox) {
    showLabelsCheckbox.addEventListener('change', () => {
      STATE.showLabels = showLabelsCheckbox.checked;
      document.body.classList.toggle('labels-hidden', !STATE.showLabels);
      renderBoard();
    });
  }

  window.addEventListener('examples:loaded', () => {
    rebuildAll(true);
    clearStatus();
  });

  rebuildAll(true);
  clearStatus();

  window.render = () => rebuildAll(true);
})();
