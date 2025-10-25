(function initMeasurementApp() {
  const doc = typeof document !== 'undefined' ? document : null;
  if (!doc) {
    return;
  }

  const board = doc.querySelector('[data-board]');
  const boardFigure = board ? board.querySelector('[data-figure-image]') : null;
  const ruler = board ? board.querySelector('[data-ruler]') : null;
  const rulerSvg = ruler ? ruler.querySelector('[data-ruler-svg]') : null;
  const boardGridOverlay = board ? board.querySelector('[data-grid-overlay]') : null;
  if (!board || !ruler || !rulerSvg) {
    return;
  }

  const statusNote = doc.querySelector('[data-status-note]');
  const exportButton = doc.getElementById('btnExportSvg');
  const inputs = {
    figureName: doc.getElementById('cfg-figure-name'),
    figureImage: doc.getElementById('cfg-figure-image'),
    figureSummary: doc.getElementById('cfg-figure-summary'),
    measurementTarget: doc.getElementById('cfg-measurement-target'),
    length: doc.getElementById('cfg-length'),
    subdivisions: doc.getElementById('cfg-subdivisions'),
    unitLabel: doc.getElementById('cfg-unit'),
    gridEnabled: doc.getElementById('cfg-grid-enabled')
  };
  const numberFormatter = typeof Intl !== 'undefined' ? new Intl.NumberFormat('nb-NO') : null;

  const transformState = { x: 0, y: 0, rotation: 0 };
  const activePointers = new Map();
  let boardRect = board.getBoundingClientRect();
  const baseSize = { width: ruler.offsetWidth, height: ruler.offsetHeight };
  const intrinsicSize = { width: baseSize.width, height: baseSize.height };
  const zeroOffset = { x: 0, y: 0 };
  const appState = {
    settings: null,
    syncingInputs: false,
    measurementTargetAuto: true
  };
  const configContainers = resolveConfigContainers();

  const defaults = {
    length: 10,
    subdivisions: 10,
    unitLabel: 'cm',
    figureName: 'Kylling',
    figureImage: 'images/measure/kylling%20(7cm_7cm)%201_1.svg',
    measurementTarget: 'høyden på kyllingen',
    figureSummary: '',
    gridEnabled: false
  };

  appState.settings = normalizeSettings();
  appState.measurementTargetAuto = shouldUseAutoMeasurementTarget(appState.settings);
  applySettings(appState.settings);
  syncInputs(appState.settings);
  centerRuler();

  attachInputListeners();
  if (exportButton) {
    exportButton.addEventListener('click', handleExport);
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

  function resolveConfigContainers() {
    const globalScope = typeof window !== 'undefined' ? window : null;
    if (!globalScope) {
      return { root: null, measurement: null };
    }
    let root = globalScope.CFG;
    if (!root || typeof root !== 'object') {
      root = {};
      globalScope.CFG = root;
    }
    let measurement = root.measurement;
    if (!measurement || typeof measurement !== 'object') {
      measurement = {};
      root.measurement = measurement;
    }
    return { root, measurement };
  }

  function applySource(target, source) {
    if (!source || typeof source !== 'object') {
      return;
    }
    if (source.length != null) target.length = source.length;
    if (source.rulerLength != null && target.length == null) target.length = source.rulerLength;
    if (source.maxValue != null && target.length == null) target.length = source.maxValue;
    if (source.subdivisions != null) target.subdivisions = source.subdivisions;
    if (source.marksBetween != null && target.subdivisions == null) target.subdivisions = source.marksBetween;
    if (source.minorTicks != null && target.subdivisions == null) target.subdivisions = source.minorTicks;
    if (typeof source.unitLabel === 'string') target.unitLabel = source.unitLabel;
    if (typeof source.figureName === 'string') target.figureName = source.figureName;
    if (typeof source.figureLabel === 'string' && target.figureName == null) target.figureName = source.figureLabel;
    if (typeof source.figureImage === 'string') target.figureImage = source.figureImage;
    if (typeof source.figureSummary === 'string') target.figureSummary = source.figureSummary;
    if (typeof source.measurementTarget === 'string') target.measurementTarget = source.measurementTarget;
    if (Object.prototype.hasOwnProperty.call(source, 'gridEnabled')) target.gridEnabled = source.gridEnabled;
  }

  function applySettingsToContainer(container, settings) {
    if (!container || typeof container !== 'object') {
      return;
    }
    container.length = settings.length;
    container.subdivisions = settings.subdivisions;
    container.unitLabel = settings.unitLabel;
    container.figureName = settings.figureName;
    container.figureImage = settings.figureImage;
    container.figureSummary = settings.figureSummary || '';
    container.measurementTarget = settings.measurementTarget;
    container.gridEnabled = settings.gridEnabled;
  }

  function sanitizeLength(value, fallback) {
    const parsed = Number.parseFloat(value);
    if (!Number.isFinite(parsed)) {
      return fallback;
    }
    const rounded = Math.round(parsed);
    if (!Number.isFinite(rounded)) {
      return fallback;
    }
    return Math.min(Math.max(rounded, 1), 100);
  }

  function sanitizeSubdivisions(value, fallback) {
    const parsed = Number.parseFloat(value);
    if (!Number.isFinite(parsed)) {
      return fallback;
    }
    const rounded = Math.round(parsed);
    if (!Number.isFinite(rounded)) {
      return fallback;
    }
    return Math.min(Math.max(rounded, 0), 20);
  }

  function collapseWhitespace(value) {
    if (typeof value !== 'string') {
      return '';
    }
    return value.replace(/[\s\u00A0]+/g, ' ').trim();
  }

  function sanitizeUnitLabel(value, fallback) {
    const normalized = collapseWhitespace(value);
    if (!normalized) {
      return fallback;
    }
    return normalized.slice(0, 24);
  }

  function sanitizeFigureName(value, fallback) {
    const normalized = collapseWhitespace(value);
    if (!normalized) {
      return fallback;
    }
    return normalized.slice(0, 60);
  }

  function sanitizeFigureImage(value, fallback) {
    if (typeof value !== 'string') {
      return fallback;
    }
    const trimmed = value.trim();
    if (!trimmed) {
      return fallback;
    }
    return trimmed;
  }

  function sanitizeOptionalText(value) {
    if (typeof value !== 'string') {
      return '';
    }
    return value.trim();
  }

  function sanitizeGridEnabled(value, fallback) {
    if (value === undefined) {
      return fallback;
    }
    if (typeof value === 'boolean') {
      return value;
    }
    if (typeof value === 'number') {
      return value !== 0;
    }
    if (typeof value === 'string') {
      const normalized = value.trim().toLowerCase();
      if (!normalized) {
        return false;
      }
      if (['true', '1', 'on', 'yes'].includes(normalized)) {
        return true;
      }
      if (['false', '0', 'off', 'no'].includes(normalized)) {
        return false;
      }
    }
    return fallback;
  }

  function buildDefaultMeasurementTarget(figureName) {
    const normalized = collapseWhitespace(figureName);
    if (!normalized) {
      return 'høyden på figuren';
    }
    return `høyden på ${normalized.toLowerCase()}`;
  }

  function sanitizeMeasurementTarget(value, figureName, fallback) {
    let normalized = collapseWhitespace(value);
    if (!normalized) {
      normalized = collapseWhitespace(fallback);
    }
    if (!normalized) {
      normalized = buildDefaultMeasurementTarget(figureName);
    }
    return normalized.slice(0, 120);
  }

  function normalizeSettings(overrides) {
    const combined = { ...defaults };
    applySource(combined, configContainers.root);
    if (configContainers.measurement !== configContainers.root) {
      applySource(combined, configContainers.measurement);
    }
    if (overrides && typeof overrides === 'object') {
      Object.assign(combined, overrides);
    }

    const length = sanitizeLength(combined.length, defaults.length);
    const subdivisions = sanitizeSubdivisions(combined.subdivisions, defaults.subdivisions);
    const unitLabel = sanitizeUnitLabel(combined.unitLabel, defaults.unitLabel);
    const figureName = sanitizeFigureName(combined.figureName, defaults.figureName);
    const figureImage = sanitizeFigureImage(combined.figureImage, defaults.figureImage);
    const figureSummary = sanitizeOptionalText(combined.figureSummary);
    const measurementTarget = sanitizeMeasurementTarget(combined.measurementTarget, figureName, defaults.measurementTarget);
    const gridEnabled = sanitizeGridEnabled(combined.gridEnabled, defaults.gridEnabled);

    const settings = {
      length,
      subdivisions,
      unitLabel,
      figureName,
      figureImage,
      figureSummary,
      measurementTarget,
      gridEnabled
    };

    applySettingsToContainer(configContainers.measurement, settings);
    if (configContainers.root && configContainers.root !== configContainers.measurement) {
      applySettingsToContainer(configContainers.root, settings);
    }

    return settings;
  }

  function areSettingsEqual(a, b) {
    if (a === b) {
      return true;
    }
    if (!a || !b) {
      return false;
    }
    return (
      a.length === b.length &&
      a.subdivisions === b.subdivisions &&
      a.unitLabel === b.unitLabel &&
      a.figureName === b.figureName &&
      a.figureImage === b.figureImage &&
      a.figureSummary === b.figureSummary &&
      a.measurementTarget === b.measurementTarget &&
      a.gridEnabled === b.gridEnabled
    );
  }

  function updateSettings(partial) {
    if (!appState.settings) {
      return;
    }
    const nextPartial = { ...partial };
    if (
      Object.prototype.hasOwnProperty.call(partial, 'figureName') &&
      !Object.prototype.hasOwnProperty.call(partial, 'measurementTarget') &&
      appState.measurementTargetAuto
    ) {
      nextPartial.measurementTarget = buildDefaultMeasurementTarget(partial.figureName);
    }
    const merged = { ...appState.settings, ...nextPartial };
    const normalized = normalizeSettings(merged);
    if (!areSettingsEqual(normalized, appState.settings)) {
      appState.settings = normalized;
      applySettings(appState.settings);
      syncInputs(appState.settings);
    }
  }

  function normalizeComparisonText(value) {
    if (typeof value !== 'string') {
      return '';
    }
    return value.replace(/[\s\u00A0]+/g, ' ').trim().toLowerCase();
  }

  function shouldUseAutoMeasurementTarget(settings) {
    if (!settings) {
      return false;
    }
    const normalizedValue = normalizeComparisonText(settings.measurementTarget);
    if (!normalizedValue) {
      return true;
    }
    const defaultFromFigure = normalizeComparisonText(buildDefaultMeasurementTarget(settings.figureName));
    if (normalizedValue === defaultFromFigure) {
      return true;
    }
    const fallbackDefault = normalizeComparisonText(defaults.measurementTarget);
    if (normalizedValue === fallbackDefault) {
      return true;
    }
    return false;
  }

  function applySettings(settings) {
    renderRuler(settings);
    applyFigureAppearance(settings);
    applyGridAppearance(settings);
    updateAccessibility(settings);
    appState.measurementTargetAuto = shouldUseAutoMeasurementTarget(settings);
    baseSize.width = ruler.offsetWidth;
    baseSize.height = ruler.offsetHeight;
    applyTransformWithSnap({ allowSnap: settings.gridEnabled });
  }

  function applyFigureAppearance(settings) {
    const label = settings.figureName ? settings.figureName.trim() : '';
    if (label) {
      board.setAttribute('data-figure-label', label);
    } else {
      board.removeAttribute('data-figure-label');
    }
    if (boardFigure) {
      if (settings.figureImage) {
        boardFigure.style.backgroundImage = `url(${JSON.stringify(settings.figureImage)})`;
      } else {
        boardFigure.style.backgroundImage = 'none';
      }
    }
  }

  function applyGridAppearance(settings) {
    const enabled = !!settings.gridEnabled;
    board.classList.toggle('board--grid', enabled);
    if (boardGridOverlay) {
      boardGridOverlay.hidden = !enabled;
    }
  }

  function escapeHtml(value) {
    return value.replace(/[&<>"']/g, char => {
      switch (char) {
        case '&':
          return '&amp;';
        case '<':
          return '&lt;';
        case '>':
          return '&gt;';
        case '"':
          return '&quot;';
        case "'":
          return '&#39;';
        default:
          return char;
      }
    });
  }

  function renderRuler(settings) {
    if (!rulerSvg) {
      return;
    }

    const { length, subdivisions, unitLabel } = settings;

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

    const unitLabelTrimmed = unitLabel ? unitLabel.trim() : '';
    const unitLabelMarkup = unitLabelTrimmed
      ? `<text x="${baselineEndX}" y="${baselineY - 16}" text-anchor="end" class="ruler-svg__unit-label">${escapeHtml(unitLabelTrimmed)}</text>`
      : '';

    rulerSvg.setAttribute('viewBox', `0 0 ${contentWidth} ${totalHeight}`);
    rulerSvg.innerHTML = `
      <rect x="8" y="8" width="${contentWidth - 16}" height="${totalHeight - 16}" rx="18" ry="18" class="ruler-svg__background" data-export-background="true" />
      <line x1="${baselineStartX}" y1="${baselineY}" x2="${baselineEndX}" y2="${baselineY}" class="ruler-svg__baseline" />
      ${minorTickMarkup}
      ${majorTickMarkup}
      ${labelMarkup}
      ${unitLabelMarkup}
    `;

    ruler.style.setProperty('--ruler-width', `${contentWidth}px`);
    ruler.style.setProperty('--ruler-height', `${totalHeight}px`);
    ruler.style.setProperty('--zero-offset-x', `${marginLeft}px`);
    ruler.style.setProperty('--zero-offset-y', `${baselineY}px`);
    intrinsicSize.width = contentWidth;
    intrinsicSize.height = totalHeight;
    zeroOffset.x = marginLeft;
    zeroOffset.y = baselineY;
  }

  function updateAccessibility(settings) {
    const { length, unitLabel } = settings;
    const formattedLength = formatNumber(length);
    const unitSuffix = unitLabel ? ` ${unitLabel}` : '';
    ruler.setAttribute('aria-label', `Flyttbar linjal på ${formattedLength}${unitSuffix}`);
    if (statusNote) {
      statusNote.textContent = buildStatusMessage(settings);
    }
  }

  function buildStatusMessage(settings) {
    const formattedLength = formatNumber(settings.length);
    const unitSuffix = settings.unitLabel ? ` ${settings.unitLabel}` : '';
    const target = settings.measurementTarget || buildDefaultMeasurementTarget(settings.figureName);
    return `Linjalens lengde er ${formattedLength}${unitSuffix}. Bruk den til å finne ${target}.`;
  }

  function formatNumber(value) {
    if (numberFormatter) {
      return numberFormatter.format(value);
    }
    return String(value);
  }

  function syncInputs(settings) {
    appState.syncingInputs = true;
    try {
      if (inputs.figureName) inputs.figureName.value = settings.figureName || '';
      if (inputs.figureImage) inputs.figureImage.value = settings.figureImage || '';
      if (inputs.figureSummary) inputs.figureSummary.value = settings.figureSummary || '';
      if (inputs.measurementTarget) inputs.measurementTarget.value = settings.measurementTarget || '';
      if (inputs.length) inputs.length.value = settings.length;
      if (inputs.subdivisions) inputs.subdivisions.value = settings.subdivisions;
      if (inputs.unitLabel) inputs.unitLabel.value = settings.unitLabel || '';
      if (inputs.gridEnabled) inputs.gridEnabled.checked = !!settings.gridEnabled;
    } finally {
      appState.syncingInputs = false;
    }
  }

  function attachInputListeners() {
    if (inputs.figureName) {
      inputs.figureName.addEventListener('input', event => {
        if (appState.syncingInputs) return;
        updateSettings({ figureName: event.target.value });
      });
    }
    if (inputs.figureImage) {
      inputs.figureImage.addEventListener('input', event => {
        if (appState.syncingInputs) return;
        updateSettings({ figureImage: event.target.value });
      });
    }
    if (inputs.figureSummary) {
      inputs.figureSummary.addEventListener('input', event => {
        if (appState.syncingInputs) return;
        updateSettings({ figureSummary: event.target.value });
      });
    }
    if (inputs.measurementTarget) {
      inputs.measurementTarget.addEventListener('input', event => {
        if (appState.syncingInputs) return;
        updateSettings({ measurementTarget: event.target.value });
      });
    }
    if (inputs.length) {
      inputs.length.addEventListener('input', event => {
        if (appState.syncingInputs) return;
        updateSettings({ length: event.target.value });
      });
    }
    if (inputs.subdivisions) {
      inputs.subdivisions.addEventListener('input', event => {
        if (appState.syncingInputs) return;
        updateSettings({ subdivisions: event.target.value });
      });
    }
    if (inputs.unitLabel) {
      inputs.unitLabel.addEventListener('input', event => {
        if (appState.syncingInputs) return;
        updateSettings({ unitLabel: event.target.value });
      });
    }
    if (inputs.gridEnabled) {
      inputs.gridEnabled.addEventListener('change', event => {
        if (appState.syncingInputs) return;
        updateSettings({ gridEnabled: event.target.checked });
      });
    }
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
    if (activePointers.size === 0) {
      applyTransformWithSnap();
    }
  }

  function applyTransform() {
    ruler.style.transform = `translate3d(${transformState.x}px, ${transformState.y}px, 0) rotate(${transformState.rotation}rad)`;
  }

  function applyTransformWithSnap({ allowSnap = true } = {}) {
    if (allowSnap && appState.settings && appState.settings.gridEnabled) {
      snapTranslationToGrid();
    }
    applyTransform();
  }

  function snapTranslationToGrid() {
    if (!boardRect) {
      return;
    }
    const gridColumns = 100;
    const gridRows = 100;
    const cellWidth = boardRect.width / gridColumns;
    const cellHeight = boardRect.height / gridRows;
    if (!Number.isFinite(cellWidth) || !Number.isFinite(cellHeight) || cellWidth <= 0 || cellHeight <= 0) {
      return;
    }

    const originX = baseSize.width / 2;
    const originY = baseSize.height / 2;
    if (!Number.isFinite(originX) || !Number.isFinite(originY)) {
      return;
    }

    const scaleX = intrinsicSize.width > 0 ? baseSize.width / intrinsicSize.width : 1;
    const scaleY = intrinsicSize.height > 0 ? baseSize.height / intrinsicSize.height : 1;
    const scaledZeroX = zeroOffset.x * scaleX;
    const scaledZeroY = zeroOffset.y * scaleY;

    const offsetX = scaledZeroX - originX;
    const offsetY = scaledZeroY - originY;

    const sin = Math.sin(transformState.rotation);
    const cos = Math.cos(transformState.rotation);
    const rotatedOffsetX = offsetX * cos - offsetY * sin;
    const rotatedOffsetY = offsetX * sin + offsetY * cos;

    const zeroX = transformState.x + originX + rotatedOffsetX;
    const zeroY = transformState.y + originY + rotatedOffsetY;

    const snappedZeroX = Math.round(zeroX / cellWidth) * cellWidth;
    const snappedZeroY = Math.round(zeroY / cellHeight) * cellHeight;

    const dx = snappedZeroX - zeroX;
    const dy = snappedZeroY - zeroY;
    if (Math.abs(dx) > 0.01 || Math.abs(dy) > 0.01) {
      transformState.x += dx;
      transformState.y += dy;
    }
  }

  function centerRuler() {
    boardRect = board.getBoundingClientRect();
    baseSize.width = ruler.offsetWidth;
    baseSize.height = ruler.offsetHeight;
    const offsetX = (boardRect.width - baseSize.width) / 2;
    const offsetY = Math.max(boardRect.height - baseSize.height - 32, 16);
    transformState.x = offsetX;
    transformState.y = offsetY;
    transformState.rotation = 0;
    applyTransformWithSnap();
  }

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
    transformState.x += dx;
    transformState.y += dy;
    applyTransformWithSnap();
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

    transformState.x += nextCenter.x - prevCenter.x;
    transformState.y += nextCenter.y - prevCenter.y;
    transformState.rotation = normalizeAngle(transformState.rotation + normalizeAngle(nextAngle - prevAngle));
    applyTransformWithSnap({ allowSnap: false });
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
    transformState.x = Math.min(Math.max(transformState.x, -maxX), maxX);
    transformState.y = Math.min(Math.max(transformState.y, -maxY), maxY);
    applyTransformWithSnap({ allowSnap: activePointers.size === 0 });
  }

  function svgToString(svgElement) {
    const serializer = new XMLSerializer();
    return serializer.serializeToString(svgElement);
  }

  function buildExportMetadata(settings) {
    const helper = typeof window !== 'undefined' ? window.MathVisSvgExport : null;
    const figureName = settings.figureName || 'Figur';
    const unitLabel = settings.unitLabel ? settings.unitLabel.trim() : '';
    const slugBaseParts = ['måling', figureName, settings.length + (unitLabel ? unitLabel : '')];
    const slugBase = slugBaseParts.join(' ').trim() || 'måling';
    const slug = helper && typeof helper.slugify === 'function'
      ? helper.slugify(slugBase, 'maling')
      : slugBase
          .toLowerCase()
          .replace(/[^a-z0-9]+/gi, '-')
          .replace(/^-+|-+$/g, '') || 'maling';
    const baseName = slug || 'maling';
    const lengthText = formatNumber(settings.length);
    const unitSuffix = unitLabel ? ` ${unitLabel}` : '';
    const target = settings.measurementTarget || buildDefaultMeasurementTarget(settings.figureName);
    const descriptionParts = [];
    const summaryText = settings.figureSummary ? settings.figureSummary.trim() : '';
    if (summaryText) {
      descriptionParts.push(summaryText);
    }
    if (target) {
      descriptionParts.push(`Oppgave: ${target}`);
    }
    const description = descriptionParts.join(' – ') || `Linjalen er ${lengthText}${unitSuffix} lang.`;
    const altText = buildStatusMessage(settings);
    const summary = {
      figureName,
      figureImage: settings.figureImage || null,
      figureSummary: summaryText || null,
      measurementTarget: target || null,
      ruler: {
        length: settings.length,
        unit: unitLabel || null,
        subdivisions: settings.subdivisions
      }
    };
    return {
      slug,
      baseName,
      description,
      altText,
      title: `${figureName} – linjal`,
      summary
    };
  }

  async function handleExport() {
    if (!appState.settings || !rulerSvg) {
      return;
    }
    const meta = buildExportMetadata(appState.settings);
    const svgMarkup = svgToString(rulerSvg);
    const suggestedBase = meta.baseName || 'maling';
    const suggestedName = suggestedBase.toLowerCase().endsWith('.svg') ? suggestedBase : `${suggestedBase}.svg`;
    const helper = typeof window !== 'undefined' ? window.MathVisSvgExport : null;

    if (helper && typeof helper.exportSvgWithArchive === 'function') {
      try {
        await helper.exportSvgWithArchive(rulerSvg, suggestedName, 'maling', {
          svgString: svgMarkup,
          slug: meta.slug,
          defaultBaseName: meta.baseName,
          description: meta.description,
          summary: meta.summary,
          title: meta.title,
          alt: meta.altText
        });
        return;
      } catch (error) {
        // Faller tilbake til nedlasting dersom eksporthjelper feiler.
      }
    }

    downloadSvgFallback(svgMarkup, suggestedName);
  }

  function downloadSvgFallback(svgMarkup, filename) {
    try {
      const blob = new Blob([svgMarkup], {
        type: 'image/svg+xml;charset=utf-8'
      });
      const url = URL.createObjectURL(blob);
      const anchor = doc.createElement('a');
      anchor.href = url;
      anchor.download = filename;
      doc.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      setTimeout(() => {
        try {
          URL.revokeObjectURL(url);
        } catch (err) {}
      }, 1000);
    } catch (error) {
      // Fallback til enkel data-URL hvis Blob ikke er tilgjengelig.
      const anchor = doc.createElement('a');
      anchor.href = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svgMarkup)}`;
      anchor.download = filename;
      doc.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
    }
  }
})();
