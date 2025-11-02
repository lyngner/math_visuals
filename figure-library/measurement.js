import {
  CUSTOM_CATEGORY_ID,
  CUSTOM_FIGURE_ID,
  measurementFigureManifest,
  createMeasurementFigureLibrary,
  buildMeasurementFigureData,
  getMeasurementFiguresGroupedByCategory,
  encodeMeasureImagePath,
  extractRealWorldSize
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
  encodeMeasureImagePath,
  extractRealWorldSize
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

