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
  return createMeasurementFigureLibrary(options);
}

export function buildFigureData(options = {}) {
  return buildMeasurementFigureDataInternal(options);
}

export function getMeasurementFiguresGroupedByCategory(options = {}) {
  return getMeasurementFiguresGroupedByCategoryInternal(options);
}

export function getFiguresGroupedByCategory(options = {}) {
  return getMeasurementFiguresGroupedByCategoryInternal(options);
}

export function loadFigureLibrary(options = {}) {
  return loadMeasurementFigureLibraryInternal(options);
}

export function getFigureLibraryMetadata() {
  return getMeasurementFigureLibraryMetadata();
}

