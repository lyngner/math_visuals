(function initMeasurementApp() {
  const doc = typeof document !== 'undefined' ? document : null;
  if (!doc) {
    return;
  }

  const board = doc.querySelector('[data-board]');
  const boardFigure = board ? board.querySelector('[data-figure-image]') : null;
  const boardScaleLabel = board ? board.querySelector('[data-scale-label]') : null;
  const ruler = board ? board.querySelector('[data-ruler]') : null;
  const rulerSvg = ruler ? ruler.querySelector('[data-ruler-svg]') : null;
  const boardGridOverlay = board ? board.querySelector('[data-grid-overlay]') : null;
  if (!board || !ruler || !rulerSvg) {
    return;
  }

  const DEFAULT_UNIT_SPACING_PX = 100;
  const UNIT_TO_CENTIMETERS = {
    mm: 0.1,
    cm: 1,
    dm: 10,
    m: 100,
    km: 100000
  };
  const UNIT_ALIASES = {
    millimeter: 'mm',
    millimetre: 'mm',
    centimeter: 'cm',
    centimetre: 'cm',
    meter: 'm',
    metre: 'm',
    kilometer: 'km',
    kilometre: 'km'
  };
  const statusNote = doc.querySelector('[data-status-note]');
  const exportButton = doc.getElementById('btnExportSvg');
  const inputs = {
    figureCategory: doc.getElementById('cfg-figure-category'),
    figurePreset: doc.getElementById('cfg-figure-preset'),
    figureName: doc.getElementById('cfg-figure-name'),
    figureImage: doc.getElementById('cfg-figure-image'),
    figureSummary: doc.getElementById('cfg-figure-summary'),
    figureScaleLabel: doc.getElementById('cfg-figure-scale'),
    length: doc.getElementById('cfg-length'),
    subdivisions: doc.getElementById('cfg-subdivisions'),
    unitLabel: doc.getElementById('cfg-unit'),
    boardPadding: doc.getElementById('cfg-board-padding'),
    rulerStartAtZero: doc.getElementById('cfg-ruler-start-at-zero'),
    gridEnabled: doc.getElementById('cfg-grid-enabled'),
    showScaleLabel: doc.getElementById('cfg-show-scale'),
    panningEnabled: doc.getElementById('cfg-pan-enabled')
  };
  const numberFormatter = typeof Intl !== 'undefined' ? new Intl.NumberFormat('nb-NO') : null;

  const transformState = { x: 0, y: 0, rotation: 0 };
  let suspendTransformPersistence = true;
  const BASE_BOARD_DIMENSIONS = { width: 1000, height: 700 };
  const figureImageDimensions = new Map();
  const figureImageDimensionsPending = new Set();
  const activePointers = new Map();
  const boardPanState = { entry: null, enabled: false };
  const boardPanTransform = { x: 0, y: 0 };
  let boardRect = board.getBoundingClientRect();
  const SVG_NS = 'http://www.w3.org/2000/svg';
  const XLINK_NS = 'http://www.w3.org/1999/xlink';
  const baseSize = { width: ruler.offsetWidth, height: ruler.offsetHeight };
  const zeroOffset = { x: 0, y: 0 };
  const CUSTOM_CATEGORY_ID = 'custom';
  const CUSTOM_FIGURE_ID = 'custom';
  const figureData = buildFigureData();
  const defaultPreset = figureData.byId.get('kylling');
  const appState = {
    settings: null,
    syncingInputs: false,
    measurementTargetAuto: true
  };
  const configContainers = resolveConfigContainers();

  function refreshConfigContainers() {
    const latest = resolveConfigContainers();
    if (!latest) {
      return;
    }
    if (latest.root) {
      configContainers.root = latest.root;
    }
    if (latest.measurement) {
      configContainers.measurement = latest.measurement;
    }
    if (latest.measurementGlobal) {
      configContainers.measurementGlobal = latest.measurementGlobal;
    }
  }

  const defaults = {
    length: 10,
    subdivisions: 10,
    unitLabel: 'cm',
    figureName: '',
    figureImage: defaultPreset ? defaultPreset.image : 'images/measure/kylling%20(7cm_7cm)%201_1.svg',
    measurementTarget: '',
    figureSummary: defaultPreset ? defaultPreset.summary : '',
    figureScaleLabel: defaultPreset ? defaultPreset.scaleLabel : '',
    boardPadding: 0,
    rulerStartAtZero: true,
    gridEnabled: false,
    showScaleLabel: false,
    panningEnabled: false,
    rulerTransform: null,
    boardPanTransform: { x: 0, y: 0 }
  };

  appState.settings = normalizeSettings();
  appState.measurementTargetAuto = shouldUseAutoMeasurementTarget(appState.settings);
  applySettings(appState.settings);
  syncInputs(appState.settings);
  const initialTransform = sanitizeRulerTransform(appState.settings && appState.settings.rulerTransform, null);
  if (initialTransform) {
    applyRulerTransform(initialTransform, { allowSnap: false, persist: false });
    suspendTransformPersistence = false;
    persistTransformState();
  } else {
    suspendTransformPersistence = false;
    centerRuler();
  }

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

  board.addEventListener('pointerdown', handleBoardPointerDown, { passive: false });
  board.addEventListener('pointermove', handleBoardPointerMove, { passive: false });
  board.addEventListener('pointerup', handleBoardPointerEnd);
  board.addEventListener('pointercancel', handleBoardPointerCancel);
  board.addEventListener('lostpointercapture', handleBoardLostPointerCapture);

  window.addEventListener('resize', handleResize);
  window.addEventListener('examples:loaded', handleExamplesLoaded);

  function resolveConfigContainers() {
    const globalScope = typeof window !== 'undefined' ? window : null;
    if (!globalScope) {
      return { root: null, measurement: null, measurementGlobal: null };
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
    let measurementGlobal = root.measurementGlobal;
    if (!measurementGlobal || typeof measurementGlobal !== 'object') {
      measurementGlobal = {};
      root.measurementGlobal = measurementGlobal;
    }
    return { root, measurement, measurementGlobal };
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
    if (typeof source.figureScaleLabel === 'string') target.figureScaleLabel = source.figureScaleLabel;
    if (typeof source.measurementTarget === 'string') target.measurementTarget = source.measurementTarget;
    if (source.boardPadding != null) target.boardPadding = source.boardPadding;
    if (source.boardPanTransform != null) target.boardPanTransform = source.boardPanTransform;
    else if (source.boardPan != null) target.boardPanTransform = source.boardPan;
    if (source.rulerTransform != null) target.rulerTransform = source.rulerTransform;
    if (Object.prototype.hasOwnProperty.call(source, 'rulerStartAtZero')) {
      target.rulerStartAtZero = source.rulerStartAtZero;
    } else if (source.rulerPadding != null) {
      const parsed = Number.parseFloat(source.rulerPadding);
      if (Number.isFinite(parsed)) {
        target.rulerStartAtZero = parsed <= 0;
      }
    }
    if (Object.prototype.hasOwnProperty.call(source, 'gridEnabled')) target.gridEnabled = source.gridEnabled;
    if (Object.prototype.hasOwnProperty.call(source, 'showScaleLabel')) target.showScaleLabel = source.showScaleLabel;
    if (Object.prototype.hasOwnProperty.call(source, 'panningEnabled')) {
      target.panningEnabled = source.panningEnabled;
    } else if (Object.prototype.hasOwnProperty.call(source, 'panorering')) {
      target.panningEnabled = source.panorering;
    } else if (Object.prototype.hasOwnProperty.call(source, 'panEnabled')) {
      target.panningEnabled = source.panEnabled;
    } else if (Object.prototype.hasOwnProperty.call(source, 'allowPan')) {
      target.panningEnabled = source.allowPan;
    }
    // unit spacing is fixed and not configurable
  }

  function applySettingsToContainer(container, settings, options) {
    if (!container || typeof container !== 'object') {
      return;
    }
    const mode = options && options.mode;
    if (mode === 'global') {
      container.length = settings.length;
      container.subdivisions = settings.subdivisions;
      container.unitLabel = settings.unitLabel;
      container.boardPadding = settings.boardPadding;
      container.rulerStartAtZero = settings.rulerStartAtZero;
      container.gridEnabled = settings.gridEnabled;
      container.showScaleLabel = settings.showScaleLabel;
      container.panningEnabled = !!settings.panningEnabled;
      container.panorering = !!settings.panningEnabled;
      delete container.rulerPadding;
      delete container.unitSpacingOverride;
      delete container.figureName;
      delete container.figureImage;
      delete container.figureSummary;
      delete container.figureScaleLabel;
      delete container.measurementTarget;
      delete container.rulerTransform;
      delete container.boardPanTransform;
      delete container.boardPan;
      return;
    }
    container.length = settings.length;
    container.subdivisions = settings.subdivisions;
    container.unitLabel = settings.unitLabel;
    container.figureName = settings.figureName;
    container.figureImage = settings.figureImage;
    container.figureSummary = settings.figureSummary || '';
    container.figureScaleLabel = settings.figureScaleLabel || '';
    container.measurementTarget = settings.measurementTarget;
    container.boardPadding = settings.boardPadding;
    container.rulerStartAtZero = settings.rulerStartAtZero;
    container.gridEnabled = settings.gridEnabled;
    container.showScaleLabel = settings.showScaleLabel;
    container.panningEnabled = !!settings.panningEnabled;
    container.panorering = !!settings.panningEnabled;
    delete container.unitSpacingOverride;
    delete container.rulerPadding;
    if (settings.rulerTransform && typeof settings.rulerTransform === 'object') {
      container.rulerTransform = { ...settings.rulerTransform };
    } else {
      delete container.rulerTransform;
    }
    if (settings.boardPanTransform && typeof settings.boardPanTransform === 'object') {
      container.boardPanTransform = { ...settings.boardPanTransform };
    } else {
      delete container.boardPanTransform;
    }
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

  function sanitizeFigureScaleLabel(value, fallback) {
    if (value === undefined) {
      return fallback || '';
    }
    if (value === null) {
      return '';
    }
    const normalized = collapseWhitespace(value);
    if (!normalized) {
      return '';
    }
    return normalized.slice(0, 80);
  }

  function sanitizeBoardPadding(value, fallback) {
    const parsed = Number.parseFloat(value);
    if (!Number.isFinite(parsed)) {
      return Math.max(0, fallback || 0);
    }
    const rounded = Math.round(parsed);
    if (!Number.isFinite(rounded)) {
      return Math.max(0, fallback || 0);
    }
    return Math.min(Math.max(rounded, 0), 200);
  }

  function sanitizeBoolean(value, fallback) {
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

  function buildDefaultMeasurementTarget() {
    return '';
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

  function sanitizeRulerTransform(value, fallback) {
    const source = value && typeof value === 'object' ? value : fallback;
    if (!source || typeof source !== 'object') {
      return null;
    }
    const x = Number.parseFloat(source.x);
    const y = Number.parseFloat(source.y);
    const rotation = Number.parseFloat(source.rotation);
    if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(rotation)) {
      return null;
    }
    return {
      x,
      y,
      rotation: normalizeAngle(rotation)
    };
  }

  function sanitizeBoardPanTransform(value, fallback) {
    const source = value && typeof value === 'object' ? value : fallback;
    if (!source || typeof source !== 'object') {
      return { x: 0, y: 0 };
    }
    const xRaw = Number.parseFloat(source.x);
    const yRaw = Number.parseFloat(source.y);
    if (!Number.isFinite(xRaw) || !Number.isFinite(yRaw)) {
      if (fallback && fallback !== source) {
        return sanitizeBoardPanTransform(fallback, null);
      }
      return { x: 0, y: 0 };
    }
    const limits =
      boardRect && Number.isFinite(boardRect.width) && Number.isFinite(boardRect.height)
        ? boardRect
        : board
        ? board.getBoundingClientRect()
        : null;
    const maxX =
      limits && Number.isFinite(limits.width)
        ? Math.max(limits.width, BASE_BOARD_DIMENSIONS.width)
        : BASE_BOARD_DIMENSIONS.width;
    const maxY =
      limits && Number.isFinite(limits.height)
        ? Math.max(limits.height, BASE_BOARD_DIMENSIONS.height)
        : BASE_BOARD_DIMENSIONS.height;
    const clampedX = Math.min(Math.max(xRaw, -maxX), maxX);
    const clampedY = Math.min(Math.max(yRaw, -maxY), maxY);
    return { x: clampedX, y: clampedY };
  }

  function resolveBoardPaddingValue(settings) {
    if (!settings) {
      return 0;
    }
    const value = settings.boardPadding;
    if (!Number.isFinite(value)) {
      return 0;
    }
    return Math.max(0, value);
  }

  function normalizeSettings(overrides) {
    refreshConfigContainers();
    const combined = { ...defaults };
    applySource(combined, configContainers.root);
    if (configContainers.measurementGlobal && configContainers.measurementGlobal !== configContainers.root) {
      applySource(combined, configContainers.measurementGlobal);
    }
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
    const figureScaleLabel = sanitizeFigureScaleLabel(combined.figureScaleLabel, defaults.figureScaleLabel);
    const boardPadding = sanitizeBoardPadding(combined.boardPadding, defaults.boardPadding);
    const rulerStartAtZero = sanitizeBoolean(combined.rulerStartAtZero, defaults.rulerStartAtZero);
    const gridEnabled = sanitizeGridEnabled(combined.gridEnabled, defaults.gridEnabled);
    const showScaleLabel = sanitizeGridEnabled(combined.showScaleLabel, defaults.showScaleLabel);
    const panningEnabled = sanitizeBoolean(combined.panningEnabled, defaults.panningEnabled);
    const rulerTransform = sanitizeRulerTransform(combined.rulerTransform, defaults.rulerTransform);
    const boardPanTransform = sanitizeBoardPanTransform(combined.boardPanTransform, defaults.boardPanTransform);

    const settings = {
      length,
      subdivisions,
      unitLabel,
      figureName,
      figureImage,
      figureSummary,
      figureScaleLabel,
      measurementTarget,
      boardPadding,
      rulerStartAtZero,
      gridEnabled,
      showScaleLabel,
      panningEnabled,
      rulerTransform,
      boardPanTransform
    };

    applySettingsToContainer(configContainers.measurement, settings);
    if (configContainers.measurementGlobal) {
      applySettingsToContainer(configContainers.measurementGlobal, settings, { mode: 'global' });
    }
    if (
      configContainers.root &&
      configContainers.root !== configContainers.measurement &&
      configContainers.root !== configContainers.measurementGlobal
    ) {
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
      a.figureScaleLabel === b.figureScaleLabel &&
      a.measurementTarget === b.measurementTarget &&
      a.boardPadding === b.boardPadding &&
      a.rulerStartAtZero === b.rulerStartAtZero &&
      a.gridEnabled === b.gridEnabled &&
      a.showScaleLabel === b.showScaleLabel &&
      a.panningEnabled === b.panningEnabled &&
      areRulerTransformsEqual(a.rulerTransform, b.rulerTransform) &&
      areBoardPanTransformsEqual(a.boardPanTransform, b.boardPanTransform)
    );
  }

  function areRulerTransformsEqual(a, b) {
    if (a === b) {
      return true;
    }
    if (!a || !b) {
      return false;
    }
    const epsilon = 0.001;
    return (
      Math.abs(a.x - b.x) <= epsilon &&
      Math.abs(a.y - b.y) <= epsilon &&
      Math.abs(normalizeAngle(a.rotation) - normalizeAngle(b.rotation)) <= epsilon
    );
  }

  function areBoardPanTransformsEqual(a, b) {
    if (a === b) {
      return true;
    }
    const first = sanitizeBoardPanTransform(a, defaults.boardPanTransform);
    const second = sanitizeBoardPanTransform(b, defaults.boardPanTransform);
    if (!first || !second) {
      return false;
    }
    const epsilon = 0.001;
    return Math.abs(first.x - second.x) <= epsilon && Math.abs(first.y - second.y) <= epsilon;
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

  function parseScaleRatio(label) {
    if (typeof label !== 'string') {
      return null;
    }
    const normalized = label.replace(/[\s\u00A0]+/g, '').replace(',', '.');
    const match = /^([0-9]+(?:\.[0-9]+)?)\:([0-9]+(?:\.[0-9]+)?)$/.exec(normalized);
    if (!match) {
      return null;
    }
    const drawingValue = Number.parseFloat(match[1]);
    const actualValue = Number.parseFloat(match[2]);
    if (!Number.isFinite(drawingValue) || drawingValue <= 0) {
      return null;
    }
    if (!Number.isFinite(actualValue) || actualValue <= 0) {
      return null;
    }
    return drawingValue / actualValue;
  }

  function normalizeUnitKey(value) {
    if (!value) {
      return '';
    }
    const trimmed = value.trim().toLowerCase();
    if (UNIT_TO_CENTIMETERS[trimmed] != null) {
      return trimmed;
    }
    if (UNIT_ALIASES[trimmed]) {
      return UNIT_ALIASES[trimmed];
    }
    return trimmed;
  }

  function getUnitToCentimeterFactor(unitLabel) {
    const normalized = normalizeUnitKey(unitLabel || '');
    if (UNIT_TO_CENTIMETERS[normalized] != null) {
      return UNIT_TO_CENTIMETERS[normalized];
    }
    return UNIT_TO_CENTIMETERS.cm;
  }

  function convertValueToCentimeters(rawValue, unitKey) {
    if (!rawValue || !unitKey) {
      return null;
    }
    const normalized = rawValue
      .replace(/[\s\u00A0\u202F]+/g, '')
      .replace(',', '.');
    const parsed = Number.parseFloat(normalized);
    if (!Number.isFinite(parsed) || parsed <= 0) {
      return null;
    }
    const multiplier = UNIT_TO_CENTIMETERS[unitKey];
    if (!multiplier) {
      return null;
    }
    return parsed * multiplier;
  }

  function parseScaleDenominator(value) {
    if (typeof value !== 'string') {
      return null;
    }
    const match = value.match(/([0-9]+(?:[.,][0-9]+)?)\s*[:\/]\s*([0-9]+(?:[.,][0-9]+)?)/);
    if (!match) {
      return null;
    }
    const leftRaw = match[1].replace(',', '.');
    const rightRaw = match[2].replace(',', '.');
    const left = Number.parseFloat(leftRaw);
    const right = Number.parseFloat(rightRaw);
    if (!Number.isFinite(left) || !Number.isFinite(right) || left <= 0 || right <= 0) {
      return null;
    }
    return right / left;
  }

  function extractRealWorldSizeFromText(text) {
    if (typeof text !== 'string') {
      return null;
    }
    const cleaned = text
      .replace(/[()_\[\]]/g, ' ')
      .replace(/[×x]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    if (!cleaned) {
      return null;
    }
    const values = [];
    const pattern = /([0-9]+(?:[ \u00A0\u202F]?[0-9]{3})*(?:[.,][0-9]+)?)(?:\s*[-–]\s*([0-9]+(?:[ \u00A0\u202F]?[0-9]{3})*(?:[.,][0-9]+)?))?\s*(mm|cm|dm|m|km)\b/gi;
    let match;
    while ((match = pattern.exec(cleaned))) {
      const unitKey = normalizeUnitKey(match[3]);
      const first = convertValueToCentimeters(match[1], unitKey);
      if (first != null) {
        values.push(first);
      }
      if (match[2]) {
        const second = convertValueToCentimeters(match[2], unitKey);
        if (second != null) {
          values.push(second);
        }
      }
    }
    const filtered = values.filter(value => Number.isFinite(value) && value > 0);
    if (filtered.length === 0) {
      return null;
    }
    const primary = Math.max(...filtered);
    if (!Number.isFinite(primary) || primary <= 0) {
      return null;
    }
    return {
      primaryCm: primary,
      valuesCm: filtered
    };
  }

  function decodeFigureImageFileName(imagePath) {
    if (typeof imagePath !== 'string') {
      return '';
    }
    const lastSlash = imagePath.lastIndexOf('/');
    const fileName = lastSlash >= 0 ? imagePath.slice(lastSlash + 1) : imagePath;
    try {
      return decodeURI(fileName);
    } catch (error) {
      return fileName;
    }
  }

  function resolveRealWorldSizeInfo(settings) {
    if (!settings) {
      return null;
    }
    const summaryInfo = extractRealWorldSizeFromText(settings.figureSummary || '');
    if (summaryInfo) {
      return summaryInfo;
    }
    const preset = resolvePresetFromSettings(settings);
    if (preset && preset.realWorldSize && Number.isFinite(preset.realWorldSize.primaryCm)) {
      return preset.realWorldSize;
    }
    const imageFileName = decodeFigureImageFileName(settings.figureImage || '');
    if (imageFileName) {
      const fromImage = extractRealWorldSizeFromText(imageFileName);
      if (fromImage) {
        return fromImage;
      }
    }
    return null;
  }

  function resolveScaleMetrics(settings) {
    // Illustrasjonene er tegnet med 100 px per centimeter i tegningen. Ved å kombinere
    // dette med valgt måleenhet får vi pikselavstanden som linjalen skal bruke per enhet.
    const baseSpacing = DEFAULT_UNIT_SPACING_PX;
    const unitFactorRaw = settings ? getUnitToCentimeterFactor(settings.unitLabel || '') : null;
    const unitFactor = Number.isFinite(unitFactorRaw) && unitFactorRaw > 0 ? unitFactorRaw : 1;
    return {
      unitSpacing: baseSpacing * unitFactor,
      baseSpacing,
      unitFactor
    };
  }

  function ensureFigureImageDimensions(imageUrl) {
    if (!imageUrl || figureImageDimensions.has(imageUrl) || figureImageDimensionsPending.has(imageUrl)) {
      return;
    }
    figureImageDimensionsPending.add(imageUrl);
    const img = new Image();
    img.decoding = 'async';
    img.onload = () => {
      figureImageDimensionsPending.delete(imageUrl);
      const width = img.naturalWidth || img.width || 0;
      const height = img.naturalHeight || img.height || 0;
      figureImageDimensions.set(imageUrl, width > 0 && height > 0 ? { width, height } : null);
      if (appState.settings && appState.settings.figureImage === imageUrl) {
        applyFigureScale(appState.settings, resolveScaleMetrics(appState.settings));
      }
    };
    img.onerror = () => {
      figureImageDimensionsPending.delete(imageUrl);
      figureImageDimensions.set(imageUrl, null);
    };
    img.src = imageUrl;
  }

  function computeFigureScale(settings, scaleMetrics, figureDimensions) {
    if (!settings || !scaleMetrics || !boardFigure || !figureDimensions) {
      return null;
    }

    const boardScale = getBoardScale(resolveBoardPaddingValue(settings));

    const baseSpacingPx = scaleMetrics && Number.isFinite(scaleMetrics.baseSpacing) && scaleMetrics.baseSpacing > 0
      ? scaleMetrics.baseSpacing
      : DEFAULT_UNIT_SPACING_PX;
    if (!Number.isFinite(baseSpacingPx) || baseSpacingPx <= 0) {
      return null;
    }

    const unitFactorRaw = scaleMetrics && Number.isFinite(scaleMetrics.unitFactor) && scaleMetrics.unitFactor > 0
      ? scaleMetrics.unitFactor
      : 1;
    let unitSpacingPx = baseSpacingPx * unitFactorRaw;
    if (!Number.isFinite(unitSpacingPx) || unitSpacingPx <= 0) {
      return null;
    }

    const naturalWidth = figureDimensions.width;
    const naturalHeight = figureDimensions.height;
    if (!Number.isFinite(naturalWidth) || !Number.isFinite(naturalHeight) || naturalWidth <= 0 || naturalHeight <= 0) {
      return null;
    }

    const preset = resolvePresetFromSettings(settings);
    const presetScaleDenominator = parseScaleDenominator(preset && preset.scaleLabel ? preset.scaleLabel : '');
    const desiredScaleDenominatorRaw = parseScaleDenominator(settings.figureScaleLabel || '');
    const desiredScaleDenominator = Number.isFinite(desiredScaleDenominatorRaw) && desiredScaleDenominatorRaw > 0
      ? desiredScaleDenominatorRaw
      : (Number.isFinite(presetScaleDenominator) && presetScaleDenominator > 0 ? presetScaleDenominator : 1);
    const baseScaleDenominator = Number.isFinite(presetScaleDenominator) && presetScaleDenominator > 0
      ? presetScaleDenominator
      : 1;

    let width = null;
    let height = null;

    const scaleAdjustmentRaw = baseScaleDenominator / desiredScaleDenominator;
    const scaleAdjustment = Number.isFinite(scaleAdjustmentRaw) && scaleAdjustmentRaw > 0 ? scaleAdjustmentRaw : 1;
    width = naturalWidth * scaleAdjustment;
    height = naturalHeight * scaleAdjustment;

    if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) {
      return null;
    }

    const hasBoardScale = Number.isFinite(boardScale) && boardScale > 0 && boardScale < 1;
    if (hasBoardScale) {
      width *= boardScale;
      height *= boardScale;
      unitSpacingPx *= boardScale;
    }

    return {
      width,
      height,
      unitSpacingPx
    };
  }

  function resolveFigureDimensions(imageUrl) {
    if (!imageUrl) {
      return null;
    }

    const cachedDimensions = figureImageDimensions.get(imageUrl);
    if (cachedDimensions === undefined) {
      ensureFigureImageDimensions(imageUrl);
      return null;
    }

    if (!cachedDimensions) {
      return null;
    }

    const { width, height } = cachedDimensions;
    if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) {
      return null;
    }

    return cachedDimensions;
  }

  function applyFigureScale(settings, scaleMetrics) {
    if (!boardFigure) {
      return;
    }

    const baseUnitSpacing = scaleMetrics && Number.isFinite(scaleMetrics.unitSpacing)
      ? scaleMetrics.unitSpacing
      : DEFAULT_UNIT_SPACING_PX;
    const imageUrl = settings && settings.figureImage ? settings.figureImage : '';
    const figureDimensions = resolveFigureDimensions(imageUrl);

    if (figureDimensions) {
      applyBoardAspectRatio();
      const scaleResult = computeFigureScale(settings, scaleMetrics, figureDimensions);

      if (scaleResult) {
        boardFigure.style.backgroundSize = `${scaleResult.width}px ${scaleResult.height}px`;
        const effectiveUnitSpacing = Number.isFinite(scaleResult.unitSpacingPx) && scaleResult.unitSpacingPx > 0
          ? scaleResult.unitSpacingPx
          : baseUnitSpacing;
        updateRuler(settings, effectiveUnitSpacing);
        return;
      }
    } else {
      applyBoardAspectRatio();
    }

    boardFigure.style.backgroundSize = '';
    updateRuler(settings, scaleValueForBoard(baseUnitSpacing, resolveBoardPaddingValue(settings)));
  }

  function applyBoardAspectRatio() {
    if (!board) {
      return;
    }

    boardRect = board.getBoundingClientRect();
  }

  function getBoardScale(padding = 0) {
    if (!board) {
      return 1;
    }

    const rect = boardRect && Number.isFinite(boardRect.width) && Number.isFinite(boardRect.height)
      ? boardRect
      : board.getBoundingClientRect();

    if (!rect || rect.width <= 0 || rect.height <= 0) {
      return 1;
    }

    boardRect = rect;

    const safePadding = Number.isFinite(padding) ? Math.max(0, padding) : 0;
    const widthAvailable = Math.max(rect.width - safePadding * 2, 1);
    const heightAvailable = Math.max(rect.height - safePadding * 2, 1);

    const widthRatio = widthAvailable / BASE_BOARD_DIMENSIONS.width;
    const heightRatio = heightAvailable / BASE_BOARD_DIMENSIONS.height;
    const candidates = [widthRatio, heightRatio].filter(value => Number.isFinite(value) && value > 0);
    if (candidates.length === 0) {
      return 1;
    }

    const ratio = Math.min(...candidates);
    return ratio < 1 ? ratio : 1;
  }

  function scaleValueForBoard(value, padding = 0) {
    if (!Number.isFinite(value) || value <= 0) {
      return value;
    }

    const boardScale = getBoardScale(padding);
    if (!Number.isFinite(boardScale) || boardScale <= 0 || boardScale >= 1) {
      return value;
    }

    return value * boardScale;
  }

  function updateRuler(settings, unitSpacing) {
    if (!Number.isFinite(unitSpacing) || unitSpacing <= 0) {
      unitSpacing = DEFAULT_UNIT_SPACING_PX;
    }
    renderRuler(settings, unitSpacing);
  }

  function applySettings(settings) {
    const scaleMetrics = resolveScaleMetrics(settings);
    applyFigureAppearance(settings);
    applyFigureScale(settings, scaleMetrics);
    applyGridAppearance(settings);
    applyBoardPanningState(settings);
    applyScaleLabel(settings);
    updateAccessibility(settings);
    appState.measurementTargetAuto = shouldUseAutoMeasurementTarget(settings);
    baseSize.width = ruler.offsetWidth;
    baseSize.height = ruler.offsetHeight;
    applyTransformWithSnap({ allowSnap: settings.gridEnabled, persist: true });
  }

  function applyFigureAppearance(settings) {
    if (board.hasAttribute('data-figure-label')) {
      board.removeAttribute('data-figure-label');
    }
    if (boardFigure) {
      if (settings.figureImage) {
        boardFigure.style.backgroundImage = `url(${JSON.stringify(settings.figureImage)})`;
        ensureFigureImageDimensions(settings.figureImage);
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

  function applyBoardPanningState(settings) {
    const enabled = !!(settings && settings.panningEnabled);
    boardPanState.enabled = enabled;
    if (!board) {
      return;
    }
    board.classList.toggle('board--pannable', enabled);
    if (enabled) {
      board.setAttribute('data-panning-enabled', 'true');
      const storedPan = sanitizeBoardPanTransform(
        settings && settings.boardPanTransform,
        defaults.boardPanTransform
      );
      boardPanTransform.x = storedPan.x;
      boardPanTransform.y = storedPan.y;
      applyBoardPanTransform();
    } else {
      board.removeAttribute('data-panning-enabled');
      resetBoardPanTransform({ persist: true });
      endBoardPanSession();
    }
  }

  function resetBoardPanTransform(options = {}) {
    boardPanTransform.x = 0;
    boardPanTransform.y = 0;
    applyBoardPanTransform();
    if (options.persist) {
      persistBoardPanState();
    }
  }

  function applyBoardPanTransform() {
    const x = Number.isFinite(boardPanTransform.x) ? boardPanTransform.x : 0;
    const y = Number.isFinite(boardPanTransform.y) ? boardPanTransform.y : 0;
    boardPanTransform.x = x;
    boardPanTransform.y = y;
    const translate = x === 0 && y === 0 ? '' : `translate3d(${x}px, ${y}px, 0)`;
    if (boardFigure) {
      boardFigure.style.transform = translate;
    }
    if (boardGridOverlay) {
      boardGridOverlay.style.transform = translate;
    }
    if (boardScaleLabel) {
      boardScaleLabel.style.transform = translate;
    }
  }

  function applyScaleLabel(settings) {
    if (!boardScaleLabel) {
      return;
    }
    if (!settings.showScaleLabel) {
      boardScaleLabel.textContent = '';
      boardScaleLabel.removeAttribute('data-visible');
      return;
    }
    const label = collapseWhitespace(settings.figureScaleLabel);
    const text = label ? `Målestokk ${label}` : 'Målestokk ikke angitt';
    boardScaleLabel.textContent = text;
    boardScaleLabel.setAttribute('data-visible', 'true');
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

  function renderRuler(settings, unitSpacing) {
    if (!rulerSvg) {
      return;
    }

    const { length, subdivisions, unitLabel } = settings;
    const inset = 8;
    const startAtZero = !!settings.rulerStartAtZero;
    const effectiveLength = length + (startAtZero ? 0 : 2);
    const startIndex = startAtZero ? 0 : -1;
    const totalTicks = effectiveLength + 1;
    const paddingLeft = 0;
    const paddingRight = 0;
    const marginLeft = 0;
    const marginRight = 0;
    const totalHeight = 120;
    const baselineY = inset + 26;
    const majorTickLength = (totalHeight - inset - 20 - baselineY) / 2;
    const majorTickBottom = baselineY + majorTickLength;
    const minorTickBottom = baselineY + majorTickLength * 0.58;
    const labelY = majorTickBottom + 24;
    const contentWidth = unitSpacing * effectiveLength + marginLeft + marginRight;

    const baselineStartX = marginLeft;
    const baselineEndX = baselineStartX + unitSpacing * effectiveLength;

    const majorTickMarkup = Array.from({ length: totalTicks }, (_, tickIndex) => {
      const x = marginLeft + unitSpacing * tickIndex;
      return `<line x1="${x}" y1="${baselineY}" x2="${x}" y2="${majorTickBottom}" class="ruler-svg__tick ruler-svg__tick--major" />`;
    }).join('');

    let minorTickMarkup = '';
    if (subdivisions > 1) {
      const step = unitSpacing / subdivisions;
      for (let unitIndex = 0; unitIndex < effectiveLength; unitIndex += 1) {
        const unitStart = marginLeft + unitSpacing * unitIndex;
        for (let subIndex = 1; subIndex < subdivisions; subIndex += 1) {
          const x = unitStart + step * subIndex;
          minorTickMarkup += `<line x1="${x}" y1="${baselineY}" x2="${x}" y2="${minorTickBottom}" class="ruler-svg__tick ruler-svg__tick--minor" />`;
        }
      }
    }

    const labelMarkup = Array.from({ length: totalTicks }, (_, tickIndex) => {
      const labelValue = startIndex + tickIndex;
      const x = marginLeft + unitSpacing * tickIndex;
      const anchor = tickIndex === 0 ? 'start' : tickIndex === totalTicks - 1 ? 'end' : 'middle';
      const dx = anchor === 'start' ? 6 : anchor === 'end' ? -6 : 0;
      const labelText = formatNumber(labelValue);
      return `<text x="${x}" y="${labelY}" text-anchor="${anchor}"${dx !== 0 ? ` dx="${dx}"` : ''} class="ruler-svg__label">${labelText}</text>`;
    }).join('');

    const unitLabelTrimmed = unitLabel ? unitLabel.trim() : '';
    const unitLabelMarkup = unitLabelTrimmed
      ? `<text x="${baselineEndX}" y="${baselineY - 16}" text-anchor="end" class="ruler-svg__unit-label">${escapeHtml(unitLabelTrimmed)}</text>`
      : '';

    rulerSvg.setAttribute('viewBox', `0 0 ${contentWidth} ${totalHeight}`);
    rulerSvg.innerHTML = `
      <rect x="0" y="${inset}" width="${contentWidth}" height="${totalHeight - inset * 2}" rx="18" ry="18" class="ruler-svg__background" data-export-background="true" />
      <line x1="${baselineStartX}" y1="${baselineY}" x2="${baselineEndX}" y2="${baselineY}" class="ruler-svg__baseline" />
      ${minorTickMarkup}
      ${majorTickMarkup}
      ${labelMarkup}
      ${unitLabelMarkup}
    `;

    const zeroOffsetX = marginLeft + paddingLeft + unitSpacing * (0 - startIndex);

    ruler.style.setProperty('--ruler-width', `${contentWidth}px`);
    ruler.style.setProperty('--ruler-height', `${totalHeight}px`);
    ruler.style.setProperty('--ruler-padding-left', `${paddingLeft}px`);
    ruler.style.setProperty('--ruler-padding-right', `${paddingRight}px`);
    ruler.style.setProperty('--zero-offset-x', `${zeroOffsetX}px`);
    ruler.style.setProperty('--zero-offset-y', `${baselineY}px`);
    if (startAtZero) {
      ruler.setAttribute('data-ruler-start', 'zero');
    } else {
      ruler.setAttribute('data-ruler-start', 'offset');
    }
    zeroOffset.x = zeroOffsetX;
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
    const target = collapseWhitespace(settings.measurementTarget || buildDefaultMeasurementTarget(settings.figureName));
    if (!target) {
      return '';
    }
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
      updateFigureSelectorsFromSettings(settings);
      if (inputs.figureName) inputs.figureName.value = settings.figureName || '';
      if (inputs.figureImage) inputs.figureImage.value = settings.figureImage || '';
      if (inputs.figureSummary) inputs.figureSummary.value = settings.figureSummary || '';
      if (inputs.figureScaleLabel) inputs.figureScaleLabel.value = settings.figureScaleLabel || '';
      if (inputs.length) inputs.length.value = settings.length;
      if (inputs.subdivisions) inputs.subdivisions.value = settings.subdivisions;
      if (inputs.unitLabel) inputs.unitLabel.value = settings.unitLabel || '';
      if (inputs.boardPadding) inputs.boardPadding.value = settings.boardPadding;
      if (inputs.rulerStartAtZero) inputs.rulerStartAtZero.checked = !!settings.rulerStartAtZero;
      if (inputs.gridEnabled) inputs.gridEnabled.checked = !!settings.gridEnabled;
      if (inputs.showScaleLabel) inputs.showScaleLabel.checked = !!settings.showScaleLabel;
      if (inputs.panningEnabled) inputs.panningEnabled.checked = !!settings.panningEnabled;
      // unit spacing is fixed and no longer exposed to the UI
    } finally {
      appState.syncingInputs = false;
    }
  }

  function attachInputListeners() {
    if (inputs.figureCategory) {
      inputs.figureCategory.addEventListener('change', event => {
        if (appState.syncingInputs) return;
        if (event && event.isTrusted === false) return;
        const categoryId = event.target.value;
        populateFigureOptions(categoryId);
        const figures = getFiguresForCategory(categoryId);
        const first = figures[0];
        if (inputs.figurePreset) {
          inputs.figurePreset.value = first ? first.id : '';
        }
        if (first && !first.custom) {
          applyFigurePreset(first.id);
        }
      });
    }
    if (inputs.figurePreset) {
      inputs.figurePreset.addEventListener('change', event => {
        if (appState.syncingInputs) return;
        if (event && event.isTrusted === false) return;
        applyFigurePreset(event.target.value);
      });
    }
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
    if (inputs.figureScaleLabel) {
      inputs.figureScaleLabel.addEventListener('input', event => {
        if (appState.syncingInputs) return;
        updateSettings({ figureScaleLabel: event.target.value });
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
    if (inputs.boardPadding) {
      inputs.boardPadding.addEventListener('input', event => {
        if (appState.syncingInputs) return;
        updateSettings({ boardPadding: event.target.value });
      });
    }
    if (inputs.rulerStartAtZero) {
      inputs.rulerStartAtZero.addEventListener('change', event => {
        if (appState.syncingInputs) return;
        updateSettings({ rulerStartAtZero: event.target.checked });
      });
    }
    if (inputs.gridEnabled) {
      inputs.gridEnabled.addEventListener('change', event => {
        if (appState.syncingInputs) return;
        updateSettings({ gridEnabled: event.target.checked });
      });
    }
    if (inputs.showScaleLabel) {
      inputs.showScaleLabel.addEventListener('change', event => {
        if (appState.syncingInputs) return;
        updateSettings({ showScaleLabel: event.target.checked });
      });
    }
    if (inputs.panningEnabled) {
      inputs.panningEnabled.addEventListener('change', event => {
        if (appState.syncingInputs) return;
        updateSettings({ panningEnabled: event.target.checked });
      });
    }
    // unit spacing is fixed and no longer configurable
  }

  function isEventInsideRuler(event) {
    if (!ruler) {
      return false;
    }
    const target = event && event.target;
    if (target && (target === ruler || (typeof ruler.contains === 'function' && ruler.contains(target)))) {
      return true;
    }
    if (event && typeof event.composedPath === 'function') {
      const path = event.composedPath();
      if (Array.isArray(path) && path.includes(ruler)) {
        return true;
      }
    }
    return false;
  }

  function handleBoardPointerDown(event) {
    if (!boardPanState.enabled || boardPanState.entry || !board) {
      return;
    }
    if (event.button && event.button !== 0) {
      return;
    }
    if (isEventInsideRuler(event) || activePointers.size > 0) {
      return;
    }
    const clientX = event.clientX;
    const clientY = event.clientY;
    if (!Number.isFinite(clientX) || !Number.isFinite(clientY)) {
      return;
    }
    boardPanState.entry = {
      pointerId: event.pointerId,
      clientX,
      clientY,
      prevX: clientX,
      prevY: clientY
    };
    board.classList.add('board--panning');
    try {
      board.setPointerCapture(event.pointerId);
    } catch (_) {}
    event.preventDefault();
  }

  function handleBoardPointerMove(event) {
    const entry = boardPanState.entry;
    if (!entry || entry.pointerId !== event.pointerId) {
      return;
    }
    if (!boardPanState.enabled) {
      endBoardPanSession();
      return;
    }
    const clientX = event.clientX;
    const clientY = event.clientY;
    if (!Number.isFinite(clientX) || !Number.isFinite(clientY)) {
      return;
    }
    entry.prevX = entry.clientX;
    entry.prevY = entry.clientY;
    entry.clientX = clientX;
    entry.clientY = clientY;
    updateBoardPanFromPointer(entry);
    event.preventDefault();
  }

  function handleBoardPointerEnd(event) {
    const entry = boardPanState.entry;
    if (!entry || entry.pointerId !== event.pointerId) {
      return;
    }
    endBoardPanSession();
  }

  function handleBoardPointerCancel(event) {
    const entry = boardPanState.entry;
    if (!entry || entry.pointerId !== event.pointerId) {
      return;
    }
    endBoardPanSession();
  }

  function handleBoardLostPointerCapture(event) {
    const entry = boardPanState.entry;
    if (!entry || entry.pointerId !== event.pointerId) {
      return;
    }
    endBoardPanSession({ skipRelease: true });
  }

  function endBoardPanSession(options = {}) {
    const entry = boardPanState.entry;
    boardPanState.entry = null;
    if (board) {
      board.classList.remove('board--panning');
      if (entry && !options.skipRelease) {
        try {
          board.releasePointerCapture(entry.pointerId);
        } catch (_) {}
      }
    }
    if (entry && options.persist !== false) {
      persistBoardPanState();
      applyTransformWithSnap({ persist: true });
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
      applyTransformWithSnap({ persist: true });
    }
  }

  function applyTransform() {
    ruler.style.transform = `translate3d(${transformState.x}px, ${transformState.y}px, 0) rotate(${transformState.rotation}rad)`;
  }

  function applyTransformWithSnap({ allowSnap = true, persist = false } = {}) {
    if (allowSnap && appState.settings && appState.settings.gridEnabled) {
      snapTranslationToGrid();
    }
    applyTransform();
    if (persist && !suspendTransformPersistence) {
      persistTransformState();
    }
  }

  function persistTransformState() {
    const snapshot = {
      x: Number.isFinite(transformState.x) ? transformState.x : 0,
      y: Number.isFinite(transformState.y) ? transformState.y : 0,
      rotation: Number.isFinite(transformState.rotation) ? transformState.rotation : 0
    };
    const sanitized = sanitizeRulerTransform(snapshot, null);
    if (!sanitized) {
      return;
    }
    if (appState.settings) {
      if (!areRulerTransformsEqual(appState.settings.rulerTransform, sanitized)) {
        appState.settings = { ...appState.settings, rulerTransform: { ...sanitized } };
      } else if (!appState.settings.rulerTransform) {
        appState.settings.rulerTransform = { ...sanitized };
      }
    }
    storeRulerTransform(sanitized);
  }

  function storeRulerTransform(transform) {
    if (!transform || typeof transform !== 'object') {
      return;
    }
    refreshConfigContainers();
    if (configContainers.measurement) {
      configContainers.measurement.rulerTransform = { ...transform };
    }
    if (configContainers.root && configContainers.root !== configContainers.measurement) {
      delete configContainers.root.rulerTransform;
    }
    if (
      configContainers.measurementGlobal &&
      configContainers.measurementGlobal !== configContainers.measurement
    ) {
      delete configContainers.measurementGlobal.rulerTransform;
    }
  }

  function persistBoardPanState() {
    if (suspendTransformPersistence) {
      return;
    }
    const snapshot = sanitizeBoardPanTransform(boardPanTransform, defaults.boardPanTransform);
    if (!snapshot) {
      return;
    }
    if (appState.settings) {
      if (!areBoardPanTransformsEqual(appState.settings.boardPanTransform, snapshot)) {
        appState.settings = { ...appState.settings, boardPanTransform: { ...snapshot } };
      } else if (!appState.settings.boardPanTransform) {
        appState.settings.boardPanTransform = { ...snapshot };
      }
    }
    storeBoardPanTransform(snapshot);
  }

  function storeBoardPanTransform(pan) {
    if (!pan || typeof pan !== 'object') {
      return;
    }
    refreshConfigContainers();
    if (configContainers.measurement) {
      configContainers.measurement.boardPanTransform = { ...pan };
    }
    if (configContainers.root && configContainers.root !== configContainers.measurement) {
      delete configContainers.root.boardPanTransform;
      delete configContainers.root.boardPan;
    }
    if (
      configContainers.measurementGlobal &&
      configContainers.measurementGlobal !== configContainers.measurement
    ) {
      delete configContainers.measurementGlobal.boardPanTransform;
      delete configContainers.measurementGlobal.boardPan;
    }
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

    const offsetX = zeroOffset.x - originX;
    const offsetY = zeroOffset.y - originY;

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
    applyTransformWithSnap({ persist: true });
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
    applyTransformWithSnap({ allowSnap: false, persist: false });
  }

  function updateBoardPanFromPointer(pointerEntry) {
    const dx = pointerEntry.clientX - pointerEntry.prevX;
    const dy = pointerEntry.clientY - pointerEntry.prevY;
    if (!Number.isFinite(dx) || !Number.isFinite(dy)) {
      return;
    }
    boardPanTransform.x += dx;
    boardPanTransform.y += dy;
    applyBoardPanTransform();
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
    applyTransformWithSnap({ allowSnap: false, persist: false });
  }

  function handleResize() {
    const prevRect = boardRect;
    boardRect = board.getBoundingClientRect();
    const widthChanged = !prevRect || Math.abs(boardRect.width - prevRect.width) > 1;
    const heightChanged = !prevRect || Math.abs(boardRect.height - prevRect.height) > 1;
    if (appState.settings) {
      applyFigureScale(appState.settings, resolveScaleMetrics(appState.settings));
    }
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
    applyTransformWithSnap({ allowSnap: activePointers.size === 0, persist: activePointers.size === 0 });
  }

  function handleExamplesLoaded() {
    refreshConfigContainers();
    syncSettingsFromConfig();
  }

  function syncSettingsFromConfig() {
    refreshConfigContainers();
    const previousSettings = appState.settings;
    const nextSettings = normalizeSettings();
    if (!nextSettings) {
      return;
    }
    const nextTransform = sanitizeRulerTransform(nextSettings.rulerTransform, null);
    const shouldUpdate = !previousSettings || !areSettingsEqual(nextSettings, previousSettings);
    appState.settings = nextSettings;
    appState.measurementTargetAuto = shouldUseAutoMeasurementTarget(nextSettings);
    if (!shouldUpdate) {
      return;
    }
    suspendTransformPersistence = true;
    try {
      applySettings(nextSettings);
      syncInputs(nextSettings);
    } finally {
      suspendTransformPersistence = false;
    }
    if (nextTransform) {
      applyRulerTransform(nextTransform, { allowSnap: false, persist: false });
      persistTransformState();
    } else {
      centerRuler();
    }
  }

  function applyRulerTransform(transform, options = {}) {
    const sanitized = sanitizeRulerTransform(transform, null);
    if (!sanitized) {
      return;
    }
    transformState.x = sanitized.x;
    transformState.y = sanitized.y;
    transformState.rotation = sanitized.rotation;
    const allowSnap = Object.prototype.hasOwnProperty.call(options, 'allowSnap') ? options.allowSnap : false;
    const persist = Object.prototype.hasOwnProperty.call(options, 'persist') ? options.persist : false;
    applyTransformWithSnap({ allowSnap, persist });
  }

  function svgToString(svgElement) {
    const serializer = new XMLSerializer();
    return serializer.serializeToString(svgElement);
  }

  function updateFigureSelectorsFromSettings(settings) {
    if (!inputs.figureCategory || !inputs.figurePreset) {
      return;
    }
    const preset = resolvePresetFromSettings(settings);
    const categoryId = preset ? preset.categoryId : CUSTOM_CATEGORY_ID;
    populateCategoryOptions(categoryId);
    populateFigureOptions(categoryId, preset ? preset.id : CUSTOM_FIGURE_ID);
  }

  function populateCategoryOptions(selectedId) {
    if (!inputs.figureCategory) {
      return;
    }
    const currentValue = selectedId || inputs.figureCategory.value || CUSTOM_CATEGORY_ID;
    inputs.figureCategory.textContent = '';
    const fragment = doc.createDocumentFragment();
    for (const category of figureData.categories) {
      const option = doc.createElement('option');
      option.value = category.id;
      option.textContent = category.label;
      fragment.appendChild(option);
    }
    inputs.figureCategory.appendChild(fragment);
    if (figureData.categories.some(category => category.id === currentValue)) {
      inputs.figureCategory.value = currentValue;
    } else {
      inputs.figureCategory.value = CUSTOM_CATEGORY_ID;
    }
  }

  function populateFigureOptions(categoryId, selectedFigureId) {
    if (!inputs.figurePreset) {
      return;
    }
    const figures = getFiguresForCategory(categoryId);
    const currentValue = selectedFigureId || inputs.figurePreset.value || (figures[0] ? figures[0].id : '');
    inputs.figurePreset.textContent = '';
    const fragment = doc.createDocumentFragment();
    for (const figure of figures) {
      const option = doc.createElement('option');
      option.value = figure.id;
      option.textContent = buildFigureOptionLabel(figure);
      fragment.appendChild(option);
    }
    inputs.figurePreset.appendChild(fragment);
    if (figures.some(figure => figure.id === currentValue)) {
      inputs.figurePreset.value = currentValue;
    } else if (figures[0]) {
      inputs.figurePreset.value = figures[0].id;
    }
  }

  function buildFigureOptionLabel(figure) {
    const parts = [figure.name];
    if (figure.dimensions) {
      parts.push(figure.dimensions);
    }
    if (figure.scaleLabel) {
      parts.push(`målestokk ${figure.scaleLabel}`);
    }
    return parts.join(' – ');
  }

  function getFiguresForCategory(categoryId) {
    const category = figureData.categories.find(entry => entry.id === categoryId);
    if (category) {
      return category.figures.slice();
    }
    const fallback = figureData.categories.find(entry => entry.id === CUSTOM_CATEGORY_ID);
    return fallback ? fallback.figures.slice() : [];
  }

  function applyFigurePreset(presetId) {
    if (!presetId) {
      return;
    }
    const preset = figureData.byId.get(presetId);
    if (!preset || preset.custom) {
      return;
    }
    updateSettings({
      figureName: preset.name,
      figureImage: preset.image,
      figureSummary: preset.summary || '',
      figureScaleLabel: preset.scaleLabel || ''
    });
  }

  function resolvePresetFromSettings(settings) {
    if (!settings) {
      return null;
    }
    if (settings.figureImage && figureData.byImage.has(settings.figureImage)) {
      return figureData.byImage.get(settings.figureImage);
    }
    const normalizedName = normalizeComparisonText(settings.figureName);
    if (!normalizedName) {
      return null;
    }
    for (const figure of figureData.byId.values()) {
      if (figure.custom) {
        continue;
      }
      if (normalizeComparisonText(figure.name) === normalizedName) {
        return figure;
      }
    }
    return null;
  }

  function encodeMeasureImagePath(fileName) {
    if (!fileName) {
      return null;
    }
    const basePath = 'images/measure/';
    return encodeURI(basePath + fileName);
  }

  function buildFigureData() {
    const baseCategories = createFigureLibrary();
    const categories = baseCategories.map(category => ({
      id: category.id,
      label: category.label,
      figures: category.figures.map(figure => ({
        ...figure,
        categoryId: category.id,
        custom: !!figure.custom
      }))
    }));
    const customCategory = {
      id: CUSTOM_CATEGORY_ID,
      label: 'Egendefinert',
      figures: [
        {
          id: CUSTOM_FIGURE_ID,
          name: 'Egendefinert figur',
          image: null,
          fileName: null,
          dimensions: '',
          scaleLabel: '',
          summary: '',
          categoryId: CUSTOM_CATEGORY_ID,
          custom: true
        }
      ]
    };
    categories.push(customCategory);

    const byId = new Map();
    const byImage = new Map();
    for (const category of categories) {
      for (const figure of category.figures) {
        byId.set(figure.id, figure);
        if (figure.image) {
          byImage.set(figure.image, figure);
        }
      }
    }

    return { categories, byId, byImage };
  }

  function createFigureLibrary() {
    const makeFigure = (id, name, fileName, dimensions, scaleLabel, summary) => {
      const image = encodeMeasureImagePath(fileName);
      const summaryParts = [];
      if (summary) {
        summaryParts.push(summary);
      } else if (dimensions) {
        summaryParts.push(dimensions);
      }
      if (scaleLabel) {
        summaryParts.push(`målestokk ${scaleLabel}`);
      }
      const realWorldSize =
        extractRealWorldSizeFromText(dimensions || '') ||
        extractRealWorldSizeFromText(summary || '') ||
        extractRealWorldSizeFromText(fileName || '');
      return {
        id,
        name,
        image,
        fileName: fileName || null,
        dimensions: dimensions || '',
        scaleLabel: scaleLabel || '',
        summary: summaryParts.join(' – '),
        realWorldSize: realWorldSize || null
      };
    };

    return [
      {
        id: 'prehistoric-animals',
        label: 'Forhistoriske dyr',
        figures: [
          makeFigure('allosaurus', 'Allosaurus', 'Allosaurus 12m_4.32m  1 _ 120.svg', '12 m × 4,32 m', '1:120'),
          makeFigure('ankylosaurus', 'Ankylosaurus', 'Ankylosaurus 7m_2,5.svg', '7 m × 2,5 m', '1:70'),
          makeFigure('brachiosaurus', 'Brachiosaurus', 'Brachiosaurus 30m_16m 1_300.svg', '30 m × 16 m', '1:300'),
          makeFigure('coelophysis', 'Coelophysis', 'Coelohysis 3m_1,2m  1_30.svg', '3 m × 1,2 m', '1:30'),
          makeFigure('elasmosaurus', 'Elasmosaurus', 'Elasmosaurus 10m_5,3m.svg', '10 m × 5,3 m', '1:100'),
          makeFigure('parasaurolophus', 'Parasaurolophus', 'Parasaurolophus 10m_5m 1_100.svg', '10 m × 5 m', '1:100'),
          makeFigure('pteranodon', 'Pteranodon', 'Pteranodon 4,3m_3,5m 1_50.svg', '4,3 m × 3,5 m', '1:50'),
          makeFigure('spinosaurus', 'Spinosaurus', 'Spinosaurus 12m_5,6m 1_120.svg', '12 m × 5,6 m', '1:120'),
          makeFigure('stegosaurus', 'Stegosaurus', 'Stegosaurus 9m_4,5m 1_90.svg', '9 m × 4,5 m', '1:90'),
          makeFigure('triceratops', 'Triceratops', 'Triceratops 8m_3m 1_80.svg', '8 m × 3 m', '1:80'),
          makeFigure('tyrannosaurus', 'Tyrannosaurus rex', 'TyrannosaurusRex 13m_5,2m 1_130.svg', '13 m × 5,2 m', '1:130'),
          makeFigure('velociraptor', 'Velociraptor', 'Velociraptor 2m_0,8m 1_20.svg', '2 m × 0,8 m', '1:20')
        ]
      },
      {
        id: 'modern-mammals',
        label: 'Nålevende pattedyr',
        figures: [
          makeFigure('elefant', 'Elefant', 'elefant (4m_3m) 1_40.svg', '4 m × 3 m', '1:40'),
          makeFigure('flodhest', 'Flodhest', 'flodhest (2m_1.5) 1_20.svg', '2 m × 1,5 m', '1:20'),
          makeFigure('gris', 'Gris', 'gris (1m_0,55m) 1_10.svg', '1 m × 0,55 m', '1:10'),
          makeFigure('hest', 'Hest', 'hest (2,4m_1,7m) 1_24.svg', '2,4 m × 1,7 m', '1:24'),
          makeFigure('sjiraff', 'Sjiraff', 'sjiraff (4m_5,6m) 1_80.svg', '4 m × 5,6 m', '1:80'),
          makeFigure('neshorn', 'Neshorn', 'neshorn 3m_2m (1_30).svg', '3 m × 2 m', '1:30'),
          makeFigure('koala', 'Koala', 'koala  (50cm_ 70cm) 1_10.svg', '50 cm × 70 cm', '1:10'),
          makeFigure('kanin', 'Kanin', 'kanin (40cm_28cm) 1_4.svg', '40 cm × 28 cm', '1:4'),
          makeFigure('ku', 'Ku', 'ku (2m_1,4m) 1_20.svg', '2 m × 1,4 m', '1:20'),
          makeFigure('corgi', 'Corgi', 'corgi (50cm_35cm) 1_5.svg', '50 cm × 35 cm', '1:5'),
          makeFigure('katt', 'Katt', 'katt50.svg', 'Lengde ca. 50 cm', '1:25')
        ]
      },
      {
        id: 'birds',
        label: 'Fugler',
        figures: [
          makeFigure('hone', 'Høne', 'høne (22_28cm) 1_4.svg', '22–28 cm høy', '1:4'),
          makeFigure('kylling', 'Kylling', 'kylling (7cm_7cm) 1_1.svg', '7 cm × 7 cm', '1:1')
        ]
      },
      {
        id: 'insects',
        label: 'Småkryp og insekter',
        figures: [
          makeFigure('edderkopp', 'Edderkopp', 'edderkopp (5cm_3,5cm) 2_1.svg', '5 cm × 3,5 cm', '2:1'),
          makeFigure('maur', 'Maur', 'maur (0,5cm_0,35cm) 20_1.svg', '0,5 cm × 0,35 cm', '20:1'),
          makeFigure('bille', 'Bille', 'bille (1,25cm_0,875cm) 8_1.svg', '1,25 cm × 0,875 cm', '8:1'),
          makeFigure('marihøne', 'Marihøne', 'marihøne (1cm _0,7cm) 10_1.svg', '1 cm × 0,7 cm', '10:1'),
          makeFigure('skolopender', 'Skolopender', 'skolopender (3cm_2,1cm )10_3.svg', '3 cm × 2,1 cm', '10:3'),
          makeFigure('skrukketroll', 'Skrukketroll', 'skrukketroll (2cm_1,4cm ) 5_1.svg', '2 cm × 1,4 cm', '5:1'),
          makeFigure('tusenben', 'Tusenben', 'tusenben (4cm_1cm) 10_4.svg', '4 cm × 1 cm', '10:4'),
          makeFigure('veps', 'Veps', 'veps (2,5cm_1,75cm) 4_1.svg', '2,5 cm × 1,75 cm', '4:1'),
          makeFigure('sommerfugl', 'Sommerfugl', 'sommerfugl (10cm_7cm)  1_1.svg', '10 cm × 7 cm', '1:1')
        ]
      },
      {
        id: 'humans',
        label: 'Mennesker',
        figures: [
          makeFigure('dame155', 'Dame 155', 'dame155.svg', 'Høyde 155 cm', '1:25'),
          makeFigure('dame180', 'Dame 180', 'dame180.svg', 'Høyde 180 cm', '1:23,68'),
          makeFigure('gutt120', 'Gutt 120', 'gutt120.svg', 'Høyde 120 cm', '1:25'),
          makeFigure('gutt125', 'Gutt 125', 'Gutt125.svg', 'Høyde 125 cm', '1:25'),
          makeFigure('gutt130', 'Gutt 130', 'gutt130 v2.svg', 'Høyde 130 cm', '1:25'),
          makeFigure('gutt140', 'Gutt 140', 'gutt140.svg', 'Høyde 140 cm', '1:25'),
          makeFigure('gutt150', 'Gutt 150', 'gutt150.svg', 'Høyde 150 cm', '1:25'),
          makeFigure('gutt180', 'Gutt 180', 'gutt180 2.svg', 'Høyde 180 cm', '1:25'),
          makeFigure('jente100', 'Jente 100', 'jente100.svg', 'Høyde 100 cm', '1:25'),
          makeFigure('jente120', 'Jente 120', 'jente120 v2.svg', 'Høyde 120 cm', '1:25'),
          makeFigure('jente155', 'Jente 155', 'jente155.svg', 'Høyde 155 cm', '1:25'),
          makeFigure('jente160', 'Jente 160', 'jente160.svg', 'Høyde 160 cm', '1:25'),
          makeFigure('mann140', 'Mann 140', 'mann140.svg', 'Høyde 140 cm', '1:25'),
          makeFigure('mann185', 'Mann 185', 'Mann185.svg', 'Høyde 185 cm', '1:25'),
          makeFigure('mann200', 'Mann 200', 'Mann200.svg', 'Høyde 200 cm', '1:25')
        ]
      },
      {
        id: 'vehicles',
        label: 'Kjøretøy',
        figures: [
          makeFigure('buss', 'Buss', 'buss (12m_3m) 1_120.svg', '12 m × 3 m', '1:120'),
          makeFigure('campingbil', 'Campingbil', 'campingbil (6m_3m) 1_60.svg', '6 m × 3 m', '1:60'),
          makeFigure('lastebil', 'Lastebil', 'Lastebil (8m_3,6m) 1_80.svg', '8 m × 3,6 m', '1:80'),
          makeFigure('mini', 'Mini', 'mini (3,5m_1,75m) 1_35.svg', '3,5 m × 1,75 m', '1:35'),
          makeFigure('sedan', 'Sedan', 'sedan (4,5m_1,6) 1_45.svg', '4,5 m × 1,6 m', '1:45'),
          makeFigure('stasjonsvogn', 'Stasjonsvogn', 'stasjonsvogn(5m_2m) 1_50.svg', '5 m × 2 m', '1:50'),
          makeFigure('sykkel', 'Sykkel', 'sykkel(2m_0,55m) 1_20.svg', '2 m × 0,55 m', '1:20'),
          makeFigure('tankbil', 'Tankbil', 'tankbil (8m_3,2m) 1_80.svg', '8 m × 3,2 m', '1:80'),
          makeFigure('trailer', 'Trailer', 'trailer(10m_3m) 1_100.svg', '10 m × 3 m', '1:100'),
          makeFigure('trikk', 'Trikk', 'trikk(30m_1,5m) 1_200.svg', '30 m × 1,5 m', '1:200')
        ]
      },
      {
        id: 'astronomy',
        label: 'Astronomiske legemer',
        figures: [
          makeFigure('asteroide', 'Asteroide', 'asteroide 500 km.svg', 'Diameter 500 km', '1:8 333 333'),
          makeFigure('manen', 'Månen', 'månen 3 474,8 km.svg', 'Diameter 3 474,8 km', '1:57 913 333'),
          makeFigure('merkur', 'Merkur', 'merkur 4 879,4 km.svg', 'Diameter 4 879,4 km', '1:81 323 333'),
          makeFigure('mars', 'Mars', 'mars 6779km.svg', 'Diameter 6 779 km', '1:112 983 333'),
          makeFigure('jupiter', 'Jupiter', 'jupiter 139 820 km.svg', 'Diameter 139 820 km', '1:2 330 333 333'),
          makeFigure('saturn', 'Saturn', 'saturn 116 460 km.svg', 'Diameter 116 460 km', '1:1 164 600 000'),
          makeFigure('uranus', 'Uranus', 'uranus 50 724 km.svg', 'Diameter 50 724 km', '1:845 400 000'),
          makeFigure('neptun', 'Neptun', 'neptun 49244km.svg', 'Diameter 49 244 km', '1:820 733 333'),
          makeFigure('venus', 'Venus', 'venus 12 104 km.svg', 'Diameter 12 104 km', '1:201 733 333'),
          makeFigure('pluto', 'Pluto', 'pluto 2 376,6 km.svg', 'Diameter 2 376,6 km', '1:39 610 000'),
          makeFigure('solen', 'Solen', 'solen 1 392 700 km.svg', 'Diameter 1 392 700 km', '1:23 211 666 667')
        ]
      },
      {
        id: 'nature',
        label: 'Natur og installasjoner',
        figures: [
          makeFigure('tre', 'Tre', 'Tre 2_3m 1_20.svg', 'Høyde 2–3 m', '1:20'),
          makeFigure('lyktestolpe', 'Lyktestolpe', 'lyktestolpe (0,4m_2,8m) 1_40.svg', '0,4 m × 2,8 m', '1:40')
        ]
      },
      {
        id: 'maps',
        label: 'Kart',
        figures: [
          makeFigure('map-city', 'Bykart', 'maps/bykart 1_5000.svg', '', '1:5 000', 'Kart over et byområde'),
          makeFigure('map-orienteering', 'Orienteringskart', 'maps/orienteringskart 1_3000.svg', '', '1:3 000', 'Orienteringskart'),
          makeFigure('map-fjord', 'Fjordkart', 'maps/fjordkart 1_1000000.svg', '', '1:1 000 000', 'Kart over en fjord'),
          makeFigure('map-norden', 'Norden', 'maps/Norden 1_25000000.svg', '', '1:25 000 000', 'Kart over Norden'),
          makeFigure('map-europe', 'Europa', 'maps/europa 1_50000000.svg', '', '1:50 000 000', 'Kart over Europa')
        ]
      },
      {
        id: 'sports',
        label: 'Sport- og lekeutstyr',
        figures: [
          makeFigure('fotball', 'Fotball', 'fotball (21cm_21cm) 1_3.svg', 'Diameter 21 cm', '1:3'),
          makeFigure('basketball', 'Basketball', 'basketball 24cm_24cm 1_4.svg', 'Diameter 24 cm', '1:4'),
          makeFigure('tennisball', 'Tennisball', 'tennisball 6,5cm_6,5cm 1_1.svg', 'Diameter 6,5 cm', '1:1'),
          makeFigure('badeball', 'Badeball', 'badeball (56cm_56cm) 1_8.svg', 'Diameter 56 cm', '1:8')
        ]
      },
      {
        id: 'school-supplies',
        label: 'Skole-, kontor- og tegneutstyr',
        figures: [
          makeFigure('binders', 'Binders', 'Binders (4cm_1cm) 10_4.svg', '4 cm × 1 cm', '10:4'),
          makeFigure('euro', 'Euro-mynt', 'euro (2,325cm _2,325cm) 2,325 _ 1.svg', 'Diameter 2,325 cm', '2,325:1'),
          makeFigure('passer', 'Passer', 'passer (10cm _5cm) 1_1.svg', '10 cm × 5 cm', '1:1'),
          makeFigure('pensel', 'Pensel', 'pensel (20cm_1cm) 1_2.svg', '20 cm × 1 cm', '1:2'),
          makeFigure('linjal', 'Linjal', 'linjal 1_1 (10cm 1,5cm) 1_1.svg', '10 cm × 1,5 cm', '1:1'),
          makeFigure('blyant', 'Blyant', 'blyant (10cm_0,75cm) 1_1.svg', '10 cm × 0,75 cm', '1:1'),
          makeFigure('blyant-tykk', 'Blyant (tykk)', 'blyantTykk (10cm _ 1cm) 1_1.svg', '10 cm × 1 cm', '1:1'),
          makeFigure('blyant-tynn', 'Blyant (tynn)', 'blyantTynn (10cm_0,5cm) 1_1.svg', '10 cm × 0,5 cm', '1:1'),
          makeFigure('blyantspisser', 'Blyantspisser', 'blyantspisser (3cm_1,5)  10_3.svg', '3 cm × 1,5 cm', '10:3'),
          makeFigure('maleskrin', 'Maleskrin', 'maleskrin (20cm_10cm) 1_2.svg', '20 cm × 10 cm', '1:2'),
          makeFigure('saks', 'Saks', 'saks (7cm_5cm) 10_7.svg', '7 cm × 5 cm', '10:7'),
          makeFigure('viskelar', 'Viskelær', 'viskelær (4cm_1,4cm ) 10_4.svg', '4 cm × 1,4 cm', '10:4')
        ]
      }
    ];
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
    if (settings.figureScaleLabel) {
      summary.figureScaleLabel = settings.figureScaleLabel;
    }
    summary.showScaleLabel = !!settings.showScaleLabel;
    summary.allowPanning = !!settings.panningEnabled;
    return {
      slug,
      baseName,
      description,
      altText,
      title: `${figureName} – linjal`,
      summary
    };
  }

  function formatSvgNumber(value) {
    if (!Number.isFinite(value)) {
      return '0';
    }
    const rounded = Math.abs(value) < 0.000001 ? 0 : value;
    return Number(rounded.toFixed(3)).toString();
  }

  function createSvgElement(name) {
    return doc.createElementNS(SVG_NS, name);
  }

  function parseCssMatrix(transformValue) {
    if (!transformValue || transformValue === 'none') {
      return null;
    }
    const trimmed = transformValue.trim();
    if (!trimmed) {
      return null;
    }
    if (trimmed.startsWith('matrix3d(')) {
      const values = trimmed
        .slice('matrix3d('.length, -1)
        .split(',')
        .map(part => Number.parseFloat(part.trim()));
      if (values.length === 16 && values.every(Number.isFinite)) {
        return {
          a: values[0],
          b: values[1],
          c: values[4],
          d: values[5],
          e: values[12],
          f: values[13]
        };
      }
      return null;
    }
    const match = trimmed.match(/matrix\(([^)]+)\)/);
    if (!match) {
      return null;
    }
    const parts = match[1]
      .split(',')
      .map(part => Number.parseFloat(part.trim()));
    if (parts.length !== 6 || !parts.every(Number.isFinite)) {
      return null;
    }
    return { a: parts[0], b: parts[1], c: parts[2], d: parts[3], e: parts[4], f: parts[5] };
  }

  function getComputedMatrix(element) {
    if (!element || typeof window === 'undefined' || typeof window.getComputedStyle !== 'function') {
      return null;
    }
    const computed = window.getComputedStyle(element);
    if (!computed) {
      return null;
    }
    return parseCssMatrix(computed.transform || computed.webkitTransform || computed.mozTransform || '');
  }

  function matrixToString(matrix) {
    if (!matrix) {
      return '';
    }
    const { a, b, c, d, e, f } = matrix;
    return `matrix(${formatSvgNumber(a)} ${formatSvgNumber(b)} ${formatSvgNumber(c)} ${formatSvgNumber(d)} ${formatSvgNumber(e)} ${formatSvgNumber(f)})`;
  }

  function buildExportStyle() {
    return `
      .mv-board-bg { fill: #f8fafc; }
      .mv-board-border { fill: none; stroke: rgba(15, 23, 42, 0.12); stroke-width: 2; }
      .mv-grid line { stroke: rgba(15, 23, 42, 0.16); stroke-width: 1; }
      .mv-scale-label__bg { fill: rgba(15, 23, 42, 0.6); }
      .mv-scale-label__text {
        font-family: "Inter", "Segoe UI", system-ui, sans-serif;
        font-size: 18px;
        font-weight: 600;
        fill: #ffffff;
        letter-spacing: 0.03em;
      }
      .mv-figure { image-rendering: optimizeQuality; }
      .mv-ruler .ruler-svg__background { fill: #ffffff; fill-opacity: 0.5; stroke: rgba(15, 23, 42, 0.28); stroke-width: 2; }
      .mv-ruler .ruler-svg__baseline { stroke: rgba(15, 23, 42, 0.75); stroke-width: 2; stroke-linecap: round; }
      .mv-ruler .ruler-svg__tick { stroke-linecap: round; }
      .mv-ruler .ruler-svg__tick--major { stroke: rgba(15, 23, 42, 0.78); stroke-width: 2.5; }
      .mv-ruler .ruler-svg__tick--minor { stroke: rgba(15, 23, 42, 0.55); stroke-width: 1.4; }
      .mv-ruler .ruler-svg__label {
        font-family: "Inter", system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
        font-size: 24px;
        font-weight: 600;
        fill: #1f2937;
        letter-spacing: -0.01em;
      }
      .mv-ruler .ruler-svg__unit-label {
        font-family: "Inter", system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
        font-size: 18px;
        font-weight: 600;
        fill: #1e293b;
        letter-spacing: 0.02em;
      }
    `;
  }

  function appendGrid(svgRoot, width, height, pan) {
    if (!svgRoot) {
      return;
    }
    const group = createSvgElement('g');
    group.setAttribute('class', 'mv-grid');
    group.setAttribute('shape-rendering', 'crispEdges');
    const offsetX = pan && Number.isFinite(pan.x) ? pan.x : 0;
    const offsetY = pan && Number.isFinite(pan.y) ? pan.y : 0;
    if (offsetX !== 0 || offsetY !== 0) {
      group.setAttribute('transform', `translate(${formatSvgNumber(offsetX)} ${formatSvgNumber(offsetY)})`);
    }
    const columns = 100;
    const rows = 100;
    for (let column = 1; column < columns; column += 1) {
      const x = (width / columns) * column;
      const line = createSvgElement('line');
      line.setAttribute('x1', formatSvgNumber(x));
      line.setAttribute('y1', '0');
      line.setAttribute('x2', formatSvgNumber(x));
      line.setAttribute('y2', formatSvgNumber(height));
      group.appendChild(line);
    }
    for (let row = 1; row < rows; row += 1) {
      const y = (height / rows) * row;
      const line = createSvgElement('line');
      line.setAttribute('x1', '0');
      line.setAttribute('y1', formatSvgNumber(y));
      line.setAttribute('x2', formatSvgNumber(width));
      line.setAttribute('y2', formatSvgNumber(y));
      group.appendChild(line);
    }
    svgRoot.appendChild(group);
  }

  function appendScaleLabel(svgRoot, settings) {
    if (!svgRoot || !settings || !settings.showScaleLabel || !boardScaleLabel || !board) {
      return;
    }
    const text = collapseWhitespace(boardScaleLabel.textContent || '');
    if (!text) {
      return;
    }
    const labelRect = boardScaleLabel.getBoundingClientRect();
    const baseRect =
      boardRect && Number.isFinite(boardRect.width) && Number.isFinite(boardRect.height)
        ? boardRect
        : board.getBoundingClientRect();
    if (!labelRect || !baseRect || labelRect.width <= 0 || labelRect.height <= 0) {
      return;
    }
    const x = labelRect.left - baseRect.left;
    const y = labelRect.top - baseRect.top;
    const width = labelRect.width;
    const height = labelRect.height;
    const radius = Math.min(height / 2, 24);
    const group = createSvgElement('g');
    group.setAttribute('class', 'mv-scale-label');
    const background = createSvgElement('rect');
    background.setAttribute('class', 'mv-scale-label__bg');
    background.setAttribute('x', formatSvgNumber(x));
    background.setAttribute('y', formatSvgNumber(y));
    background.setAttribute('width', formatSvgNumber(width));
    background.setAttribute('height', formatSvgNumber(height));
    background.setAttribute('rx', formatSvgNumber(radius));
    background.setAttribute('ry', formatSvgNumber(radius));
    group.appendChild(background);
    const textElement = createSvgElement('text');
    textElement.setAttribute('class', 'mv-scale-label__text');
    textElement.setAttribute('x', formatSvgNumber(x + width / 2));
    textElement.setAttribute('y', formatSvgNumber(y + height / 2));
    textElement.setAttribute('text-anchor', 'middle');
    textElement.setAttribute('dominant-baseline', 'middle');
    textElement.textContent = text;
    group.appendChild(textElement);
    svgRoot.appendChild(group);
  }

  async function resolveImageHref(imageUrl) {
    if (typeof imageUrl !== 'string' || !imageUrl) {
      return null;
    }
    const trimmed = imageUrl.trim();
    if (!trimmed) {
      return null;
    }
    if (trimmed.startsWith('data:') || typeof fetch !== 'function' || typeof FileReader !== 'function') {
      return trimmed;
    }
    try {
      const absolute = new URL(trimmed, doc.baseURI).toString();
      const response = await fetch(absolute, { mode: 'cors' });
      if (!response.ok) {
        throw new Error('failed');
      }
      const blob = await response.blob();
      return await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(typeof reader.result === 'string' ? reader.result : trimmed);
        reader.onerror = () => reject(reader.error || new Error('read failed'));
        reader.readAsDataURL(blob);
      });
    } catch (error) {
      return trimmed;
    }
  }

  async function createFigureImageElement(settings, boardWidth, boardHeight, pan) {
    if (!settings || !settings.figureImage || !boardFigure) {
      return null;
    }
    const imageUrl = settings.figureImage;
    ensureFigureImageDimensions(imageUrl);
    const scaleMetrics = resolveScaleMetrics(settings);
    const figureDimensions = resolveFigureDimensions(imageUrl);
    let figureWidth = boardWidth;
    let figureHeight = boardHeight;
    if (figureDimensions) {
      const scaleResult = computeFigureScale(settings, scaleMetrics, figureDimensions);
      if (scaleResult) {
        figureWidth = scaleResult.width;
        figureHeight = scaleResult.height;
      }
    }
    if (!(figureWidth > 0) || !(figureHeight > 0)) {
      figureWidth = boardWidth;
      figureHeight = boardHeight;
    }
    const href = await resolveImageHref(imageUrl);
    if (!href) {
      return null;
    }
    const image = createSvgElement('image');
    image.setAttribute('class', 'mv-figure');
    const offsetX = pan && Number.isFinite(pan.x) ? pan.x : 0;
    const offsetY = pan && Number.isFinite(pan.y) ? pan.y : 0;
    const x = (boardWidth - figureWidth) / 2 + offsetX;
    const y = (boardHeight - figureHeight) / 2 + offsetY;
    image.setAttribute('x', formatSvgNumber(x));
    image.setAttribute('y', formatSvgNumber(y));
    image.setAttribute('width', formatSvgNumber(figureWidth));
    image.setAttribute('height', formatSvgNumber(figureHeight));
    image.setAttributeNS(XLINK_NS, 'xlink:href', href);
    image.setAttribute('href', href);
    return image;
  }

  function createRulerGroupForExport(helper) {
    if (!rulerSvg) {
      return null;
    }
    const clone = helper && typeof helper.cloneSvgForExport === 'function'
      ? helper.cloneSvgForExport(rulerSvg)
      : rulerSvg.cloneNode(true);
    if (!clone) {
      return null;
    }
    clone.removeAttribute('aria-hidden');
    clone.removeAttribute('focusable');
    const group = createSvgElement('g');
    group.setAttribute('class', 'mv-ruler');
    const matrix = getComputedMatrix(ruler);
    if (matrix) {
      group.setAttribute('transform', matrixToString(matrix));
    }
    group.setAttribute('filter', 'url(#mv-ruler-shadow)');
    group.appendChild(clone);
    return group;
  }

  async function createMeasurementExportSvg(settings, helper) {
    if (!doc || !board) {
      return null;
    }
    const bounds = board.getBoundingClientRect();
    if (bounds && Number.isFinite(bounds.width) && Number.isFinite(bounds.height)) {
      boardRect = bounds;
    }
    const width = Math.max(
      Math.round((boardRect && Number.isFinite(boardRect.width) ? boardRect.width : BASE_BOARD_DIMENSIONS.width) || 0),
      1
    );
    const height = Math.max(
      Math.round((boardRect && Number.isFinite(boardRect.height) ? boardRect.height : BASE_BOARD_DIMENSIONS.height) || 0),
      1
    );
    const svg = createSvgElement('svg');
    svg.setAttribute('xmlns', SVG_NS);
    svg.setAttributeNS('http://www.w3.org/2000/xmlns/', 'xmlns:xlink', XLINK_NS);
    svg.setAttribute('viewBox', `0 0 ${width} ${height}`);
    svg.setAttribute('width', String(width));
    svg.setAttribute('height', String(height));

    const defs = createSvgElement('defs');
    const style = createSvgElement('style');
    style.textContent = buildExportStyle();
    defs.appendChild(style);
    const shadow = createSvgElement('filter');
    shadow.setAttribute('id', 'mv-ruler-shadow');
    shadow.setAttribute('x', '-20%');
    shadow.setAttribute('y', '-20%');
    shadow.setAttribute('width', '140%');
    shadow.setAttribute('height', '180%');
    const dropShadow = createSvgElement('feDropShadow');
    dropShadow.setAttribute('dx', '0');
    dropShadow.setAttribute('dy', '12');
    dropShadow.setAttribute('stdDeviation', '9');
    dropShadow.setAttribute('flood-color', '#0f172a');
    dropShadow.setAttribute('flood-opacity', '0.25');
    shadow.appendChild(dropShadow);
    defs.appendChild(shadow);
    svg.appendChild(defs);

    const background = createSvgElement('rect');
    background.setAttribute('class', 'mv-board-bg');
    background.setAttribute('x', '0');
    background.setAttribute('y', '0');
    background.setAttribute('width', formatSvgNumber(width));
    background.setAttribute('height', formatSvgNumber(height));
    svg.appendChild(background);

    const border = createSvgElement('rect');
    border.setAttribute('class', 'mv-board-border');
    border.setAttribute('x', formatSvgNumber(1));
    border.setAttribute('y', formatSvgNumber(1));
    border.setAttribute('width', formatSvgNumber(Math.max(width - 2, 0)));
    border.setAttribute('height', formatSvgNumber(Math.max(height - 2, 0)));
    svg.appendChild(border);

    const pan = settings && settings.panningEnabled
      ? sanitizeBoardPanTransform(settings.boardPanTransform, defaults.boardPanTransform)
      : { x: 0, y: 0 };

    const figureImage = await createFigureImageElement(settings, width, height, pan);
    if (figureImage) {
      svg.appendChild(figureImage);
    }

    if (settings && settings.gridEnabled) {
      appendGrid(svg, width, height, pan);
    }

    appendScaleLabel(svg, settings);

    const rulerGroup = createRulerGroupForExport(helper);
    if (rulerGroup) {
      svg.appendChild(rulerGroup);
    }

    return svg;
  }

  async function handleExport() {
    if (!appState.settings || !rulerSvg) {
      return;
    }
    const helper = typeof window !== 'undefined' ? window.MathVisSvgExport : null;
    const exportSvgElement = await createMeasurementExportSvg(appState.settings, helper);
    if (!exportSvgElement) {
      return;
    }
    const meta = buildExportMetadata(appState.settings);
    const svgMarkup = svgToString(exportSvgElement);
    const suggestedBase = meta.baseName || 'maling';
    const suggestedName = suggestedBase.toLowerCase().endsWith('.svg') ? suggestedBase : `${suggestedBase}.svg`;

    if (helper && typeof helper.exportSvgWithArchive === 'function') {
      try {
        const elementForHelper =
          helper && typeof helper.cloneSvgForExport === 'function'
            ? helper.cloneSvgForExport(exportSvgElement)
            : exportSvgElement.cloneNode(true);
        await helper.exportSvgWithArchive(elementForHelper, suggestedName, 'maling', {
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
