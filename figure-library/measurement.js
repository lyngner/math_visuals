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
  // Vi bruker ikke den interne lasteren lenger fordi den mangler URL-fix
  // loadFigureLibrary: loadMeasurementFigureLibraryInternal, 
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
  // Vi eksporterer vår nye funksjon nederst i stedet
  // loadMeasurementFigureLibraryInternal as loadFigureLibrary, 
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

export function getFigureLibraryMetadata() {
  return getMeasurementFigureLibraryMetadata();
}

// --- NY, ROBUST LASTEFUNKSJON ---
export async function loadFigureLibrary(options = {}) {
  // 1. Finn API-URLen absolutt fra roten (fikser "rare URLer" problemet)
  const origin = typeof window !== 'undefined' && window.location ? window.location.origin : '';
  const endpoint = '/api/figure-library?view=summary';
  const url = `${origin}${endpoint}`;

  try {
    const response = await fetch(url, {
        headers: { 'Accept': 'application/json' },
        cache: 'no-store'
    });

    // 2. Sjekk om vi fikk HTML (feilside) i stedet for JSON
    const contentType = response.headers.get('content-type');
    if (!response.ok || (contentType && contentType.includes('text/html'))) {
        console.warn('Figurbibliotek API utilgjengelig (fikk HTML eller feilkode). Bruker innebygde figurer.');
        // Vi kaster ikke feil her, men lar appen fortsette med lokale data
        return { metadata: { storageMode: 'memory', limitation: 'Ingen kontakt med server' } };
    }

    const data = await response.json();

    // 3. Oppdater manifestet med data fra serveren
    if (data && Array.isArray(data.categories)) {
        // Vi tømmer arrayet og fyller det på nytt for å beholde referansen
        measurementFigureManifest.categories.length = 0;
        data.categories.forEach(cat => measurementFigureManifest.categories.push(cat));
        
        // Oppdater metadata hvis det finnes
        if (data.metadata) {
            if (!measurementFigureManifest.metadata) measurementFigureManifest.metadata = {};
            Object.assign(measurementFigureManifest.metadata, data.metadata);
        }
    }
    
    return { metadata: data.metadata || null };

  } catch (error) {
    console.error('Kritisk feil ved lasting av figurbibliotek:', error);
    // Returner tomt objekt så appen ikke krasjer
    return { metadata: null };
  }
}
