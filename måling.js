(function initMeasurementApp() {
  const board = document.querySelector('[data-board]');
  const ruler = board ? board.querySelector('[data-ruler]') : null;
  if (!board || !ruler) {
    return;
  }

  const rulerSvg = ruler.querySelector('[data-ruler-svg]');
  const statusNote = document.querySelector('[data-status-note]');
  const gridToggleInput = document.querySelector('[data-grid-toggle]');
  const numberFormatter = typeof Intl !== 'undefined' ? new Intl.NumberFormat('nb-NO') : null;

  const state = {
    x: 0,
    y: 0,
    rotation: 0
  };

  const gridState = {
    enabled: false,
    spacing: 100
  };

  const rulerGeometry = {
    contentWidth: 0,
    totalHeight: 0,
    marginLeft: 0,
    baselineY: 0
  };

  const activePointers = new Map();
  let boardRect = board.getBoundingClientRect();
  const baseSize = {
    width: ruler.offsetWidth,
    height: ruler.offsetHeight
  };

  initializeRuler();

  function applyTransform({ snap = true } = {}) {
    if (snap && gridState.enabled) {
      snapStateToGrid();
    }
    ruler.style.transform = `translate3d(${state.x}px, ${state.y}px, 0) rotate(${state.rotation}rad)`;
  }

  function centerRuler() {
    boardRect = board.getBoundingClientRect();
    baseSize.width = ruler.offsetWidth;
    baseSize.height = ruler.offsetHeight;
    const offsetX = (boardRect.width - baseSize.width) / 2;
    const offsetY = Math.max(boardRect.height - baseSize.height - 32, 16);
    state.x = offsetX;
    state.y = offsetY;
    state.rotation = 0;
    applyTransform();
  }

  centerRuler();

  function normalizeAngle(angle) {
    const twoPi = Math.PI * 2;
    let value = angle;
    while (value <= -Math.PI) value += twoPi;
    while (value > Math.PI) value -= twoPi;
    return value;
  }

  function updateFromSinglePointer(pointerEntry) {
    const dx = pointerEntry.clientX - pointerEntry.prevX;
    const dy = pointerEntry.clientY - pointerEntry.prevY;
    if (!Number.isFinite(dx) || !Number.isFinite(dy)) {
      return;
    }
    state.x += dx;
    state.y += dy;
    applyTransform();
  }

  function updateFromGesture(currentEntry) {
    const pointers = Array.from(activePointers.values());
    if (pointers.length === 0) {
      return;
    }
    if (pointers.length === 1) {
      updateFromSinglePointer(currentEntry);
      return;
    }

    const [p1, p2] = pointers;
    const prevPoints = [
      { x: p1 === currentEntry ? currentEntry.prevX : p1.clientX, y: p1 === currentEntry ? currentEntry.prevY : p1.clientY },
      { x: p2 === currentEntry ? currentEntry.prevX : p2.clientX, y: p2 === currentEntry ? currentEntry.prevY : p2.clientY }
    ];
    const nextPoints = [
      { x: p1.clientX, y: p1.clientY },
      { x: p2.clientX, y: p2.clientY }
    ];

    const prevCenter = {
      x: (prevPoints[0].x + prevPoints[1].x) / 2,
      y: (prevPoints[0].y + prevPoints[1].y) / 2
    };
    const nextCenter = {
      x: (nextPoints[0].x + nextPoints[1].x) / 2,
      y: (nextPoints[0].y + nextPoints[1].y) / 2
    };

    const prevAngle = Math.atan2(prevPoints[1].y - prevPoints[0].y, prevPoints[1].x - prevPoints[0].x);
    const nextAngle = Math.atan2(nextPoints[1].y - nextPoints[0].y, nextPoints[1].x - nextPoints[0].x);

    state.x += nextCenter.x - prevCenter.x;
    state.y += nextCenter.y - prevCenter.y;
    state.rotation = normalizeAngle(state.rotation + normalizeAngle(nextAngle - prevAngle));
    applyTransform({ snap: false });
  }

  function handlePointerDown(event) {
    if (event.button && event.button !== 0) {
      return;
    }
    if (activePointers.size >= 2 && !activePointers.has(event.pointerId)) {
      return;
    }
    event.preventDefault();
    const entry = {
      pointerId: event.pointerId,
      clientX: event.clientX,
      clientY: event.clientY,
      prevX: event.clientX,
      prevY: event.clientY
    };
    activePointers.set(event.pointerId, entry);
    try {
      ruler.setPointerCapture(event.pointerId);
    } catch (_) {}
  }

  function handlePointerMove(event) {
    const entry = activePointers.get(event.pointerId);
    if (!entry) {
      return;
    }
    entry.prevX = entry.clientX;
    entry.prevY = entry.clientY;
    entry.clientX = event.clientX;
    entry.clientY = event.clientY;
    updateFromGesture(entry);
  }

  function handlePointerEnd(event) {
    const entry = activePointers.get(event.pointerId);
    if (!entry) {
      return;
    }
    activePointers.delete(event.pointerId);
    try {
      ruler.releasePointerCapture(event.pointerId);
    } catch (_) {}
    if (gridState.enabled && activePointers.size === 0) {
      applyTransform();
    }
  }

  function handleResize() {
    const prevRect = boardRect;
    boardRect = board.getBoundingClientRect();
    const widthChanged = !prevRect || Math.abs(boardRect.width - prevRect.width) > 1;
    const heightChanged = !prevRect || Math.abs(boardRect.height - prevRect.height) > 1;
    baseSize.width = ruler.offsetWidth;
    baseSize.height = ruler.offsetHeight;

    if (activePointers.size === 0 && (widthChanged || heightChanged)) {
      centerRuler();
      return;
    }

    const maxX = boardRect.width;
    const maxY = boardRect.height;
    state.x = Math.min(Math.max(state.x, -maxX), maxX);
    state.y = Math.min(Math.max(state.y, -maxY), maxY);
    applyTransform();
  }

  function initializeRuler() {
    const settings = normalizeSettings();
    renderRuler(settings);
    updateAccessibility(settings);
    setupGridToggle();
  }

  function normalizeSettings() {
    const defaults = {
      length: 10,
      subdivisions: 10,
      unitLabel: 'cm'
    };

    const globalScope = typeof window !== 'undefined' ? window : null;
    const globalCfg = globalScope && typeof globalScope.CFG === 'object' && globalScope.CFG ? globalScope.CFG : {};
    if (globalScope && (!globalScope.CFG || typeof globalScope.CFG !== 'object')) {
      globalScope.CFG = globalCfg;
    }
    const cfgTarget = globalCfg && typeof globalCfg.measurement === 'object' && globalCfg.measurement ? globalCfg.measurement : globalCfg;

    const lengthRaw = Number.parseFloat(cfgTarget.length ?? cfgTarget.rulerLength ?? cfgTarget.maxValue);
    const subdivisionsRaw = Number.parseFloat(cfgTarget.subdivisions ?? cfgTarget.marksBetween ?? cfgTarget.minorTicks);
    const unitRaw = typeof cfgTarget.unitLabel === 'string' ? cfgTarget.unitLabel.trim() : '';

    let length = Number.isFinite(lengthRaw) ? Math.round(lengthRaw) : defaults.length;
    if (!(length >= 1)) length = defaults.length;
    length = Math.min(100, Math.max(1, length));

    let subdivisions = Number.isFinite(subdivisionsRaw) ? Math.round(subdivisionsRaw) : defaults.subdivisions;
    if (!(subdivisions >= 0)) subdivisions = defaults.subdivisions;
    subdivisions = Math.min(20, Math.max(0, subdivisions));

    let unitLabel = unitRaw || defaults.unitLabel;
    if (cfgTarget) {
      cfgTarget.length = length;
      cfgTarget.subdivisions = subdivisions;
      cfgTarget.unitLabel = unitLabel;
    }

    return { length, subdivisions, unitLabel };
  }

  function renderRuler(settings) {
    if (!rulerSvg) {
      return;
    }

    const { length, subdivisions } = settings;

    const inset = 8;
    const marginLeft = 44;
    const marginRight = 44;
    const unitSpacing = 60;
    const totalHeight = 120;
    const baselineY = inset + 26;
    const majorTickLength = (totalHeight - inset - 20 - baselineY) / 2;
    const majorTickBottom = baselineY + majorTickLength;
    const minorTickBottom = baselineY + majorTickLength * 0.58;
    const labelY = majorTickBottom + 24;
    const contentWidth = marginLeft + marginRight + unitSpacing * length;

    const baselineStartX = marginLeft;
    const baselineEndX = contentWidth - marginRight;

    const majorTickMarkup = Array.from({ length: length + 1 }, (_, index) => {
      const x = marginLeft + unitSpacing * index;
      return `<line x1="${x}" y1="${baselineY}" x2="${x}" y2="${majorTickBottom}" class="ruler-svg__tick ruler-svg__tick--major" />`;
    }).join('');

    let minorTickMarkup = '';
    if (subdivisions > 1) {
      const step = unitSpacing / subdivisions;
      for (let unitIndex = 0; unitIndex < length; unitIndex += 1) {
        const unitStart = marginLeft + unitSpacing * unitIndex;
        for (let subIndex = 1; subIndex < subdivisions; subIndex += 1) {
          const x = unitStart + step * subIndex;
          minorTickMarkup += `<line x1="${x}" y1="${baselineY}" x2="${x}" y2="${minorTickBottom}" class="ruler-svg__tick ruler-svg__tick--minor" />`;
        }
      }
    }

    const labelMarkup = Array.from({ length: length + 1 }, (_, index) => {
      const x = marginLeft + unitSpacing * index;
      const anchor = index === 0 ? 'start' : index === length ? 'end' : 'middle';
      const dx = anchor === 'start' ? -6 : anchor === 'end' ? 6 : 0;
      const labelText = formatNumber(index);
      return `<text x="${x}" y="${labelY}" text-anchor="${anchor}"${dx !== 0 ? ` dx="${dx}"` : ''} class="ruler-svg__label">${labelText}</text>`;
    }).join('');

    rulerSvg.setAttribute('viewBox', `0 0 ${contentWidth} ${totalHeight}`);
    rulerSvg.innerHTML = `
      <rect x="8" y="8" width="${contentWidth - 16}" height="${totalHeight - 16}" rx="18" ry="18" class="ruler-svg__background" />
      <line x1="${baselineStartX}" y1="${baselineY}" x2="${baselineEndX}" y2="${baselineY}" class="ruler-svg__baseline" />
      ${minorTickMarkup}
      ${majorTickMarkup}
      ${labelMarkup}
    `;

    ruler.style.setProperty('--ruler-width', `${contentWidth}px`);
    ruler.style.setProperty('--ruler-height', `${totalHeight}px`);

    rulerGeometry.contentWidth = contentWidth;
    rulerGeometry.totalHeight = totalHeight;
    rulerGeometry.marginLeft = marginLeft;
    rulerGeometry.baselineY = baselineY;
  }

  function updateAccessibility(settings) {
    const { length, unitLabel } = settings;
    const formattedLength = formatNumber(length);
    const unitText = unitLabel ? ` ${unitLabel}` : '';
    ruler.setAttribute('aria-label', `Flyttbar linjal på ${formattedLength}${unitText}`);
    if (statusNote) {
      const suffix = unitLabel ? ` ${unitLabel}` : '';
      statusNote.textContent = `Linjalens lengde er ${formattedLength}${suffix}. Bruk den til å finne høyden på kyllingen.`;
    }
  }

  function getZeroPointOffset() {
    if (!Number.isFinite(rulerGeometry.contentWidth) || rulerGeometry.contentWidth <= 0) {
      return { x: 0, y: 0 };
    }
    const scaleX = ruler.offsetWidth / rulerGeometry.contentWidth;
    const scaleY = rulerGeometry.totalHeight > 0 ? ruler.offsetHeight / rulerGeometry.totalHeight : scaleX;
    return {
      x: rulerGeometry.marginLeft * scaleX,
      y: rulerGeometry.baselineY * scaleY
    };
  }

  function getZeroPointPosition() {
    const zeroOffset = getZeroPointOffset();
    const center = {
      x: ruler.offsetWidth / 2,
      y: ruler.offsetHeight / 2
    };
    const relative = {
      x: zeroOffset.x - center.x,
      y: zeroOffset.y - center.y
    };
    const cos = Math.cos(state.rotation);
    const sin = Math.sin(state.rotation);
    const rotated = {
      x: relative.x * cos - relative.y * sin + center.x,
      y: relative.x * sin + relative.y * cos + center.y
    };
    return {
      x: state.x + rotated.x,
      y: state.y + rotated.y
    };
  }

  function snapStateToGrid() {
    if (!gridState.enabled) {
      return;
    }
    const zeroPosition = getZeroPointPosition();
    const spacing = gridState.spacing;
    if (!(spacing > 0)) {
      return;
    }
    const snappedX = Math.round(zeroPosition.x / spacing) * spacing;
    const snappedY = Math.round(zeroPosition.y / spacing) * spacing;
    const deltaX = snappedX - zeroPosition.x;
    const deltaY = snappedY - zeroPosition.y;
    if (deltaX !== 0 || deltaY !== 0) {
      state.x += deltaX;
      state.y += deltaY;
    }
  }

  function applyGridVisibility() {
    const shouldShow = gridState.enabled;
    board.classList.toggle('board--show-grid', shouldShow);
    applyTransform({ snap: shouldShow });
  }

  function setupGridToggle() {
    if (!gridToggleInput) {
      return;
    }
    const cfg = getMeasurementConfig();
    if (cfg && cfg.gridEnabled === true) {
      gridState.enabled = true;
      gridToggleInput.checked = true;
      applyGridVisibility();
    } else {
      applyGridVisibility();
    }
    gridToggleInput.addEventListener('change', () => {
      gridState.enabled = gridToggleInput.checked;
      if (cfg) {
        cfg.gridEnabled = gridState.enabled;
      }
      applyGridVisibility();
    });
  }

  function getMeasurementConfig() {
    const globalScope = typeof window !== 'undefined' ? window : null;
    if (!globalScope) {
      return null;
    }
    if (!globalScope.CFG || typeof globalScope.CFG !== 'object') {
      globalScope.CFG = {};
    }
    if (!globalScope.CFG.measurement || typeof globalScope.CFG.measurement !== 'object') {
      globalScope.CFG.measurement = {};
    }
    return globalScope.CFG.measurement;
  }

  function formatNumber(value) {
    if (numberFormatter) {
      return numberFormatter.format(value);
    }
    return String(value);
  }

  ruler.addEventListener('pointerdown', handlePointerDown, { passive: false });
  ruler.addEventListener('pointermove', handlePointerMove);
  ruler.addEventListener('pointerup', handlePointerEnd);
  ruler.addEventListener('pointercancel', handlePointerEnd);
  ruler.addEventListener('lostpointercapture', event => {
    if (event.pointerId != null) {
      activePointers.delete(event.pointerId);
    }
  });

  board.addEventListener('dblclick', event => {
    event.preventDefault();
    if (activePointers.size === 0) {
      centerRuler();
    }
  });

  window.addEventListener('resize', handleResize);
})();
