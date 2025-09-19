(function () {
  const SVG_NS = 'http://www.w3.org/2000/svg';
  const BOARD_WIDTH = 1000;
  const BOARD_HEIGHT = 700;
  const LABEL_OFFSET_X = 16;
  const LABEL_OFFSET_Y = -14;

  const board = document.getElementById('dotBoard');
  if (!board) return;

  const modeToggleBtn = document.getElementById('btnToggleMode');
  const modeLabel = document.getElementById('modeLabel');
  const modeHint = document.getElementById('modeHint');
  const checkBtn = document.getElementById('btnCheck');
  const clearBtn = document.getElementById('btnClear');
  const statusBox = document.getElementById('statusMessage');
  const addPointBtn = document.getElementById('btnAddPoint');
  const pointListEl = document.getElementById('pointList');
  const lineModeFieldset = document.getElementById('lineModeFieldset');
  const lineModeInputs = lineModeFieldset ? Array.from(lineModeFieldset.querySelectorAll('input[name="lineMode"]')) : [];
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
  let currentLineMode = 'answer';
  let selectedPointId = null;

  const pointEditors = new Map();
  const pointElements = new Map();
  const labelElements = new Map();
  const baseLineElements = new Map();
  const userLineElements = new Map();
  const answerLineElements = new Map();

  ensureStateDefaults();

  function ensureStateDefaults() {
    if (!Array.isArray(STATE.points) || STATE.points.length === 0) {
      STATE.points = [
        { id: 'p1', label: '21', x: 0.16, y: 0.68 },
        { id: 'p2', label: '28', x: 0.27, y: 0.62 },
        { id: 'p3', label: '35', x: 0.29, y: 0.48 },
        { id: 'p4', label: '42', x: 0.21, y: 0.36 },
        { id: 'p5', label: '49', x: 0.39, y: 0.32 },
        { id: 'p6', label: '56', x: 0.47, y: 0.18 },
        { id: 'p7', label: '63', x: 0.6, y: 0.26 },
        { id: 'p8', label: '7', x: 0.83, y: 0.2 },
        { id: 'p9', label: '70', x: 0.83, y: 0.54 },
        { id: 'p10', label: '14', x: 0.6, y: 0.66 }
      ];
      STATE.answerLines = [
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
      ];
      STATE.predefinedLines = [['p3', 'p5']];
      STATE.showLabels = true;
      STATE.nextPointId = 11;
    }
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

  function sanitizeState() {
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
        y: clamp01(point.y)
      };
      usedIds.add(id);
      sanitizedPoints.push(sanitizedPoint);
    });
    STATE.points = sanitizedPoints;
    const validPoints = new Set(sanitizedPoints.map(p => p.id));
    STATE.answerLines = sanitizeLineList(STATE.answerLines, validPoints);
    STATE.predefinedLines = sanitizeLineList(STATE.predefinedLines, validPoints);
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
      if (!validPoints.has(a) || !validPoints.has(b) || baseLines.has(key)) {
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
    return {
      x: point.x * BOARD_WIDTH,
      y: point.y * BOARD_HEIGHT
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
    const x = (clientX - rect.left) / rect.width;
    const y = (clientY - rect.top) / rect.height;
    return {
      x: clamp01(x),
      y: clamp01(y)
    };
  }

  function updatePointEditorValues(pointId) {
    const editor = pointEditors.get(pointId);
    const point = STATE.points.find(p => p.id === pointId);
    if (!editor || !point) return;
    editor.labelInput.value = point.label;
    editor.xInput.value = percentString(point.x);
    editor.yInput.value = percentString(point.y);
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

  function attachPointInteraction(circle, pointId) {
    circle.addEventListener('pointerdown', event => {
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
        circle.removeEventListener('pointermove', onMove);
        circle.removeEventListener('pointerup', onEnd);
        circle.removeEventListener('pointercancel', onEnd);
        try {
          circle.releasePointerCapture(pointerId);
        } catch (_) {}
        if (!moved) handlePointSelection(pointId);
        else updatePointEditorValues(pointId);
      };
      try {
        circle.setPointerCapture(pointerId);
      } catch (_) {}
      circle.addEventListener('pointermove', onMove);
      circle.addEventListener('pointerup', onEnd);
      circle.addEventListener('pointercancel', onEnd);
    });
  }

  function updatePointPosition(pointId, normX, normY) {
    const point = STATE.points.find(p => p.id === pointId);
    if (!point) return;
    point.x = clamp01(normX);
    point.y = clamp01(normY);
    const pos = toPixel(point);
    const circle = pointElements.get(pointId);
    if (circle) {
      circle.setAttribute('cx', pos.x);
      circle.setAttribute('cy', pos.y);
    }
    const label = labelElements.get(pointId);
    if (label) {
      label.setAttribute('x', pos.x + LABEL_OFFSET_X);
      label.setAttribute('y', pos.y + LABEL_OFFSET_Y);
    }
    updateLinesForPoint(pointId);
  }

  function renderPointList(validPoints) {
    if (!pointListEl) return;
    if (!validPoints) validPoints = prepareState();
    pointEditors.clear();
    pointListEl.innerHTML = '';
    STATE.points.forEach((point, idx) => {
      const item = document.createElement('div');
      item.className = 'point-item';

      const titleRow = document.createElement('div');
      titleRow.className = 'point-item-title';
      const title = document.createElement('span');
      title.textContent = `Punkt ${idx + 1}`;
      const idBadge = document.createElement('span');
      idBadge.className = 'point-id';
      idBadge.textContent = point.id;
      titleRow.append(title, idBadge);
      item.appendChild(titleRow);

      const labelField = document.createElement('label');
      labelField.textContent = 'Tekst';
      const labelInput = document.createElement('input');
      labelInput.type = 'text';
      labelInput.value = point.label;
      labelInput.placeholder = `Punkt ${idx + 1}`;
      labelInput.addEventListener('input', () => {
        point.label = labelInput.value;
        const text = labelElements.get(point.id);
        if (text) text.textContent = point.label;
      });
      labelField.appendChild(labelInput);
      item.appendChild(labelField);

      const xField = document.createElement('label');
      xField.textContent = 'X (%)';
      const xInput = document.createElement('input');
      xInput.type = 'number';
      xInput.min = '0';
      xInput.max = '100';
      xInput.step = '0.1';
      xInput.value = percentString(point.x);
      xInput.addEventListener('change', () => {
        const normalized = clamp01(Number(xInput.value) / 100);
        point.x = normalized;
        xInput.value = percentString(point.x);
        updatePointPosition(point.id, point.x, point.y);
      });
      xField.appendChild(xInput);
      item.appendChild(xField);

      const yField = document.createElement('label');
      yField.textContent = 'Y (%)';
      const yInput = document.createElement('input');
      yInput.type = 'number';
      yInput.min = '0';
      yInput.max = '100';
      yInput.step = '0.1';
      yInput.value = percentString(point.y);
      yInput.addEventListener('change', () => {
        const normalized = clamp01(Number(yInput.value) / 100);
        point.y = normalized;
        yInput.value = percentString(point.y);
        updatePointPosition(point.id, point.x, point.y);
      });
      yField.appendChild(yInput);
      item.appendChild(yField);

      const actions = document.createElement('div');
      actions.className = 'point-item-actions';
      const removeBtn = document.createElement('button');
      removeBtn.type = 'button';
      removeBtn.className = 'btn btn--small';
      removeBtn.textContent = 'Fjern';
      removeBtn.addEventListener('click', () => {
        removePoint(point.id);
      });
      actions.appendChild(removeBtn);
      item.appendChild(actions);

      pointListEl.appendChild(item);
      pointEditors.set(point.id, {
        labelInput,
        xInput,
        yInput,
        titleEl: title,
        idEl: idBadge
      });
    });
  }

  function applySelectionHighlight() {
    pointElements.forEach((circle, id) => {
      circle.classList.toggle('is-selected', id === selectedPointId);
    });
  }

  function updatePointEditors() {
    STATE.points.forEach((point, idx) => {
      const editor = pointEditors.get(point.id);
      if (!editor) return;
      if (editor.titleEl) editor.titleEl.textContent = `Punkt ${idx + 1}`;
      if (editor.idEl) editor.idEl.textContent = point.id;
      editor.labelInput.value = point.label;
      editor.xInput.value = percentString(point.x);
      editor.yInput.value = percentString(point.y);
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
      const circle = document.createElementNS(SVG_NS, 'circle');
      const pos = toPixel(point);
      circle.setAttribute('cx', pos.x);
      circle.setAttribute('cy', pos.y);
      circle.setAttribute('r', 11);
      circle.classList.add('point');
      circle.dataset.pointId = point.id;
      attachPointInteraction(circle, point.id);
      pointsGroup.appendChild(circle);
      pointElements.set(point.id, circle);

      const text = document.createElementNS(SVG_NS, 'text');
      text.textContent = point.label;
      text.setAttribute('x', pos.x + LABEL_OFFSET_X);
      text.setAttribute('y', pos.y + LABEL_OFFSET_Y);
      text.setAttribute('text-anchor', 'start');
      text.setAttribute('dominant-baseline', 'middle');
      text.classList.add('point-label');
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

  function toggleLine(list, a, b) {
    const key = makeLineKey(a, b);
    if (!key) return false;
    const idx = list.findIndex(([p, q]) => makeLineKey(p, q) === key);
    if (idx >= 0) {
      list.splice(idx, 1);
      return false;
    }
    const [first, second] = key.split('|');
    list.push([first, second]);
    return true;
  }

  function handlePointSelection(pointId) {
    if (currentLineMode === 'none' && isEditMode) {
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
    if (isEditMode) {
      if (currentLineMode === 'answer') {
        toggleLine(STATE.answerLines, selectedPointId, pointId);
      } else if (currentLineMode === 'predefined') {
        const added = toggleLine(STATE.predefinedLines, selectedPointId, pointId);
        const key = makeLineKey(selectedPointId, pointId);
        if (added && key) userLines.delete(key);
      }
      selectedPointId = pointId;
      renderBoard();
      return;
    }
    const key = makeLineKey(selectedPointId, pointId);
    if (!key) {
      selectedPointId = null;
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
    if (!isEditMode) {
      modeHint.textContent = 'Klikk på to punkter for å tegne en strek. Klikk på en strek for å fjerne den.';
      return;
    }
    if (currentLineMode === 'answer') {
      modeHint.textContent = 'Rediger fasit: velg to punkter for å legge til eller fjerne en fasit-strek.';
    } else if (currentLineMode === 'predefined') {
      modeHint.textContent = 'Rediger forhåndsdefinerte streker: velg to punkter for å slå av eller på en ferdig strek.';
    } else {
      modeHint.textContent = 'Flytt punkter ved å dra dem. Velg en annen linjemodus for å endre streker.';
    }
  }

  function updateModeUI() {
    if (modeToggleBtn) {
      modeToggleBtn.textContent = isEditMode ? 'Gå til spillmodus' : 'Gå til redigeringsmodus';
    }
    if (modeLabel) modeLabel.textContent = isEditMode ? 'Redigeringsmodus' : 'Spillmodus';
    if (checkBtn) checkBtn.disabled = isEditMode;
    if (clearBtn) clearBtn.disabled = isEditMode;
    if (lineModeFieldset) lineModeFieldset.disabled = !isEditMode;
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
      y
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

  lineModeInputs.forEach(input => {
    input.addEventListener('change', () => {
      if (!input.checked) return;
      currentLineMode = input.value;
      selectedPointId = null;
      updateModeHint();
      applySelectionHighlight();
    });
  });

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
