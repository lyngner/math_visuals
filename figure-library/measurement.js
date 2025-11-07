import {
  CUSTOM_CATEGORY_ID,
  CUSTOM_FIGURE_ID,
  measurementFigureManifest,
  createMeasurementFigureLibrary,
  buildMeasurementFigureData,
  getMeasurementFiguresGroupedByCategory,
  encodeMeasureImagePath,
  extractRealWorldSize,
  createFigurePickerHelpers,
  loadMeasurementFigureLibrary as loadMeasurementFigureLibraryInternal,
  getMeasurementFigureLibraryMetadata
} from '../packages/figures/src/index.js';

const globalObj = typeof globalThis !== 'undefined'
  ? globalThis
  : typeof window !== 'undefined'
    ? window
    : typeof global !== 'undefined'
      ? global
      : null;

if (globalObj && !globalObj.mathVisMeasurementFigures) {
  globalObj.mathVisMeasurementFigures = measurementFigureManifest;
}

export {
  CUSTOM_CATEGORY_ID,
  CUSTOM_FIGURE_ID,
  measurementFigureManifest,
  buildMeasurementFigureData,
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
  return buildMeasurementFigureData(options);
}

export function getFiguresGroupedByCategory(options = {}) {
  return getMeasurementFiguresGroupedByCategory(options);
}

export function loadFigureLibrary(options = {}) {
  return loadMeasurementFigureLibraryInternal(options);
}

export function getFigureLibraryMetadata() {
  return getMeasurementFigureLibraryMetadata();
}

