import * as measurementLibrary from '../packages/figures/src/index.js';

const globalObj = typeof globalThis !== 'undefined'
  ? globalThis
  : typeof window !== 'undefined'
    ? window
    : typeof global !== 'undefined'
      ? global
      : null;

const {
  CUSTOM_CATEGORY_ID,
  CUSTOM_FIGURE_ID,
  measurementFigureManifest,
  createMeasurementFigureLibrary,
  buildMeasurementFigureData: buildMeasurementFigureDataInternal,
  getMeasurementFiguresGroupedByCategory: getMeasurementFiguresGroupedByCategoryInternal,
  encodeMeasureImagePath,
  extractRealWorldSize,
  createFigurePickerHelpers,
  loadFigureLibrary: loadMeasurementFigureLibraryInternal,
  getFigureLibraryMetadata: getMeasurementFigureLibraryMetadata
} = measurementLibrary;

if (globalObj && !globalObj.mathVisMeasurementFigures) {
  globalObj.mathVisMeasurementFigures = measurementFigureManifest;
}

function normalizeOptions(options = {}) {
  if (typeof options === 'string') {
    return { app: options };
  }
  if (Array.isArray(options)) {
    return { allowedApps: options };
  }
  if (!options || typeof options !== 'object') {
    return {};
  }
  return options;
}

export {
  CUSTOM_CATEGORY_ID,
  CUSTOM_FIGURE_ID,
  measurementFigureManifest,
  buildMeasurementFigureDataInternal as buildMeasurementFigureData,
  encodeMeasureImagePath,
  extractRealWorldSize,
  createFigurePickerHelpers,
  loadMeasurementFigureLibraryInternal as loadMeasurementFigureLibrary,
  getMeasurementFigureLibraryMetadata
};

export function createFigureLibrary(options = {}) {
  return createMeasurementFigureLibrary(normalizeOptions(options));
}

export function buildFigureData(options = {}) {
  return buildMeasurementFigureDataInternal(normalizeOptions(options));
}

export function getMeasurementFiguresGroupedByCategory(options = {}) {
  return getMeasurementFiguresGroupedByCategoryInternal(normalizeOptions(options));
}

export function getFiguresGroupedByCategory(options = {}) {
  return getMeasurementFiguresGroupedByCategoryInternal(normalizeOptions(options));
}

export function loadFigureLibrary(options = {}) {
  return loadMeasurementFigureLibraryInternal(options);
}

export function getFigureLibraryMetadata() {
  return getMeasurementFigureLibraryMetadata();
}

