const DEFAULT_LOCALE = 'nb';

export const CUSTOM_CATEGORY_ID = 'custom';
export const CUSTOM_FIGURE_ID = 'custom';
export const MEASURE_IMAGE_BASE_PATH = 'images/measure/';

export function encodeMeasureImagePath(fileName, options = {}) {
  if (!fileName) {
    return null;
  }
  const basePath = typeof options.basePath === 'string' && options.basePath
    ? options.basePath
    : MEASURE_IMAGE_BASE_PATH;
  return encodeURI(`${basePath}${fileName}`);
}

export function extractRealWorldSize(helper, ...sources) {
  if (typeof helper !== 'function') {
    return null;
  }
  for (const source of sources) {
    if (!source) continue;
    const value = helper(source || '');
    if (value) {
      return value;
    }
  }
  return null;
}

export const measurementFigureManifest = {
  basePath: MEASURE_IMAGE_BASE_PATH,
  categories: [
    {
      id: 'prehistoric-animals',
      label: 'Forhistoriske dyr',
      figures: [
        { id: 'allosaurus', name: 'Allosaurus', fileName: 'Allosaurus 12m_4.32m  1 _ 120.svg', dimensions: '12 m × 4,32 m', scaleLabel: '1:120' },
        { id: 'ankylosaurus', name: 'Ankylosaurus', fileName: 'Ankylosaurus 7m_2,5.svg', dimensions: '7 m × 2,5 m', scaleLabel: '1:70' },
        { id: 'brachiosaurus', name: 'Brachiosaurus', fileName: 'Brachiosaurus 30m_16m 1_300.svg', dimensions: '30 m × 16 m', scaleLabel: '1:300' },
        { id: 'coelophysis', name: 'Coelophysis', fileName: 'Coelohysis 3m_1,2m  1_30.svg', dimensions: '3 m × 1,2 m', scaleLabel: '1:30' },
        { id: 'elasmosaurus', name: 'Elasmosaurus', fileName: 'Elasmosaurus 10m_5,3m.svg', dimensions: '10 m × 5,3 m', scaleLabel: '1:100' },
        { id: 'parasaurolophus', name: 'Parasaurolophus', fileName: 'Parasaurolophus 10m_5m 1_100.svg', dimensions: '10 m × 5 m', scaleLabel: '1:100' },
        { id: 'pteranodon', name: 'Pteranodon', fileName: 'Pteranodon 4,3m_3,5m 1_50.svg', dimensions: '4,3 m × 3,5 m', scaleLabel: '1:50' },
        { id: 'spinosaurus', name: 'Spinosaurus', fileName: 'Spinosaurus 12m_5,6m 1_120.svg', dimensions: '12 m × 5,6 m', scaleLabel: '1:120' },
        { id: 'stegosaurus', name: 'Stegosaurus', fileName: 'Stegosaurus 9m_4,5m 1_90.svg', dimensions: '9 m × 4,5 m', scaleLabel: '1:90' },
        { id: 'triceratops', name: 'Triceratops', fileName: 'Triceratops 8m_3m 1_80.svg', dimensions: '8 m × 3 m', scaleLabel: '1:80' },
        { id: 'tyrannosaurus', name: 'Tyrannosaurus rex', fileName: 'TyrannosaurusRex 13m_5,2m 1_130.svg', dimensions: '13 m × 5,2 m', scaleLabel: '1:130' },
        { id: 'velociraptor', name: 'Velociraptor', fileName: 'Velociraptor 2m_0,8m 1_20.svg', dimensions: '2 m × 0,8 m', scaleLabel: '1:20' }
      ]
    },
    {
      id: 'modern-mammals',
      label: 'Nålevende pattedyr',
      figures: [
        { id: 'elefant', name: 'Elefant', fileName: 'elefant (4m_3m) 1_40.svg', dimensions: '4 m × 3 m', scaleLabel: '1:40' },
        { id: 'flodhest', name: 'Flodhest', fileName: 'flodhest (2m_1.5) 1_20.svg', dimensions: '2 m × 1,5 m', scaleLabel: '1:20' },
        { id: 'gris', name: 'Gris', fileName: 'gris (1m_0,55m) 1_10.svg', dimensions: '1 m × 0,55 m', scaleLabel: '1:10' },
        { id: 'hest', name: 'Hest', fileName: 'hest (2,4m_1,7m) 1_24.svg', dimensions: '2,4 m × 1,7 m', scaleLabel: '1:24' },
        { id: 'sjiraff', name: 'Sjiraff', fileName: 'sjiraff (4m_5,6m) 1_80.svg', dimensions: '4 m × 5,6 m', scaleLabel: '1:80' },
        { id: 'neshorn', name: 'Neshorn', fileName: 'neshorn 3m_2m (1_30).svg', dimensions: '3 m × 2 m', scaleLabel: '1:30' },
        { id: 'koala', name: 'Koala', fileName: 'koala  (50cm_ 70cm) 1_10.svg', dimensions: '50 cm × 70 cm', scaleLabel: '1:10' },
        { id: 'kanin', name: 'Kanin', fileName: 'kanin (40cm_28cm) 1_4.svg', dimensions: '40 cm × 28 cm', scaleLabel: '1:4' },
        { id: 'ku', name: 'Ku', fileName: 'ku (2m_1,4m) 1_20.svg', dimensions: '2 m × 1,4 m', scaleLabel: '1:20' },
        { id: 'corgi', name: 'Corgi', fileName: 'corgi (50cm_35cm) 1_5.svg', dimensions: '50 cm × 35 cm', scaleLabel: '1:5' },
        { id: 'katt', name: 'Katt', fileName: 'katt50.svg', dimensions: 'Lengde ca. 50 cm', scaleLabel: '1:25' }
      ]
    },
    {
      id: 'birds',
      label: 'Fugler',
      figures: [
        { id: 'hone', name: 'Høne', fileName: 'høne (22_28cm) 1_4.svg', dimensions: '22–28 cm høy', scaleLabel: '1:4' },
        { id: 'kylling', name: 'Kylling', fileName: 'kylling (7cm_7cm) 1_1.svg', dimensions: '7 cm × 7 cm', scaleLabel: '1:1' }
      ]
    },
    {
      id: 'insects',
      label: 'Småkryp og insekter',
      figures: [
        { id: 'edderkopp', name: 'Edderkopp', fileName: 'edderkopp (5cm_3,5cm) 2_1.svg', dimensions: '5 cm × 3,5 cm', scaleLabel: '2:1' },
        { id: 'maur', name: 'Maur', fileName: 'maur (0,5cm_0,35cm) 20_1.svg', dimensions: '0,5 cm × 0,35 cm', scaleLabel: '20:1' },
        { id: 'bille', name: 'Bille', fileName: 'bille (1,25cm_0,875cm) 8_1.svg', dimensions: '1,25 cm × 0,875 cm', scaleLabel: '8:1' },
        { id: 'marihøne', name: 'Marihøne', fileName: 'marihøne (1cm _0,7cm) 10_1.svg', dimensions: '1 cm × 0,7 cm', scaleLabel: '10:1' },
        { id: 'skolopender', name: 'Skolopender', fileName: 'skolopender (3cm_2,1cm )10_3.svg', dimensions: '3 cm × 2,1 cm', scaleLabel: '10:3' },
        { id: 'skrukketroll', name: 'Skrukketroll', fileName: 'skrukketroll (2cm_1,4cm ) 5_1.svg', dimensions: '2 cm × 1,4 cm', scaleLabel: '5:1' },
        { id: 'tusenben', name: 'Tusenben', fileName: 'tusenben (4cm_1cm) 10_4.svg', dimensions: '4 cm × 1 cm', scaleLabel: '10:4' },
        { id: 'veps', name: 'Veps', fileName: 'veps (2,5cm_1,75cm) 4_1.svg', dimensions: '2,5 cm × 1,75 cm', scaleLabel: '4:1' },
        { id: 'sommerfugl', name: 'Sommerfugl', fileName: 'sommerfugl (10cm_7cm)  1_1.svg', dimensions: '10 cm × 7 cm', scaleLabel: '1:1' }
      ]
    },
    {
      id: 'humans',
      label: 'Mennesker',
      figures: [
        { id: 'dame155', name: 'Dame 155', fileName: 'dame155.svg', dimensions: 'Høyde 155 cm', scaleLabel: '1:25' },
        { id: 'dame180', name: 'Dame 180', fileName: 'dame180.svg', dimensions: 'Høyde 180 cm', scaleLabel: '1:23,68' },
        { id: 'gutt120', name: 'Gutt 120', fileName: 'gutt120.svg', dimensions: 'Høyde 120 cm', scaleLabel: '1:25' },
        { id: 'gutt125', name: 'Gutt 125', fileName: 'Gutt125.svg', dimensions: 'Høyde 125 cm', scaleLabel: '1:25' },
        { id: 'gutt130', name: 'Gutt 130', fileName: 'gutt130 v2.svg', dimensions: 'Høyde 130 cm', scaleLabel: '1:25' },
        { id: 'gutt140', name: 'Gutt 140', fileName: 'gutt140.svg', dimensions: 'Høyde 140 cm', scaleLabel: '1:25' },
        { id: 'gutt150', name: 'Gutt 150', fileName: 'gutt150.svg', dimensions: 'Høyde 150 cm', scaleLabel: '1:25' },
        { id: 'gutt180', name: 'Gutt 180', fileName: 'gutt180 2.svg', dimensions: 'Høyde 180 cm', scaleLabel: '1:25' },
        { id: 'jente100', name: 'Jente 100', fileName: 'jente100.svg', dimensions: 'Høyde 100 cm', scaleLabel: '1:25' },
        { id: 'jente120', name: 'Jente 120', fileName: 'jente120 v2.svg', dimensions: 'Høyde 120 cm', scaleLabel: '1:25' },
        { id: 'jente155', name: 'Jente 155', fileName: 'jente155.svg', dimensions: 'Høyde 155 cm', scaleLabel: '1:25' },
        { id: 'jente160', name: 'Jente 160', fileName: 'jente160.svg', dimensions: 'Høyde 160 cm', scaleLabel: '1:25' },
        { id: 'mann140', name: 'Mann 140', fileName: 'mann140.svg', dimensions: 'Høyde 140 cm', scaleLabel: '1:25' },
        { id: 'mann185', name: 'Mann 185', fileName: 'Mann185.svg', dimensions: 'Høyde 185 cm', scaleLabel: '1:25' },
        { id: 'mann200', name: 'Mann 200', fileName: 'Mann200.svg', dimensions: 'Høyde 200 cm', scaleLabel: '1:25' }
      ]
    },
    {
      id: 'vehicles',
      label: 'Kjøretøy',
      figures: [
        { id: 'buss', name: 'Buss', fileName: 'buss (12m_3m) 1_120.svg', dimensions: '12 m × 3 m', scaleLabel: '1:120' },
        { id: 'campingbil', name: 'Campingbil', fileName: 'campingbil (6m_3m) 1_60.svg', dimensions: '6 m × 3 m', scaleLabel: '1:60' },
        { id: 'lastebil', name: 'Lastebil', fileName: 'Lastebil (8m_3,6m) 1_80.svg', dimensions: '8 m × 3,6 m', scaleLabel: '1:80' },
        { id: 'mini', name: 'Mini', fileName: 'mini (3,5m_1,75m) 1_35.svg', dimensions: '3,5 m × 1,75 m', scaleLabel: '1:35' },
        { id: 'sedan', name: 'Sedan', fileName: 'sedan (4,5m_1,6) 1_45.svg', dimensions: '4,5 m × 1,6 m', scaleLabel: '1:45' },
        { id: 'stasjonsvogn', name: 'Stasjonsvogn', fileName: 'stasjonsvogn(5m_2m) 1_50.svg', dimensions: '5 m × 2 m', scaleLabel: '1:50' },
        { id: 'sykkel', name: 'Sykkel', fileName: 'sykkel(2m_0,55m) 1_20.svg', dimensions: '2 m × 0,55 m', scaleLabel: '1:20' },
        { id: 'tankbil', name: 'Tankbil', fileName: 'tankbil (8m_3,2m) 1_80.svg', dimensions: '8 m × 3,2 m', scaleLabel: '1:80' },
        { id: 'trailer', name: 'Trailer', fileName: 'trailer(10m_3m) 1_100.svg', dimensions: '10 m × 3 m', scaleLabel: '1:100' },
        { id: 'trikk', name: 'Trikk', fileName: 'trikk(30m_1,5m) 1_200.svg', dimensions: '30 m × 1,5 m', scaleLabel: '1:200' }
      ]
    },
    {
      id: 'astronomy',
      label: 'Astronomiske legemer',
      figures: [
        { id: 'asteroide', name: 'Asteroide', fileName: 'asteroide 500 km.svg', dimensions: 'Diameter 500 km', scaleLabel: '1:8 333 333' },
        { id: 'manen', name: 'Månen', fileName: 'månen 3 474,8 km.svg', dimensions: 'Diameter 3 474,8 km', scaleLabel: '1:57 913 333' },
        { id: 'merkur', name: 'Merkur', fileName: 'merkur 4 879,4 km.svg', dimensions: 'Diameter 4 879,4 km', scaleLabel: '1:81 323 333' },
        { id: 'mars', name: 'Mars', fileName: 'mars 6779km.svg', dimensions: 'Diameter 6 779 km', scaleLabel: '1:112 983 333' },
        { id: 'jupiter', name: 'Jupiter', fileName: 'jupiter 139 820 km.svg', dimensions: 'Diameter 139 820 km', scaleLabel: '1:2 330 333 333' },
        { id: 'saturn', name: 'Saturn', fileName: 'saturn 116 460 km.svg', dimensions: 'Diameter 116 460 km', scaleLabel: '1:1 164 600 000' },
        { id: 'uranus', name: 'Uranus', fileName: 'uranus 50 724 km.svg', dimensions: 'Diameter 50 724 km', scaleLabel: '1:845 400 000' },
        { id: 'neptun', name: 'Neptun', fileName: 'neptun 49244km.svg', dimensions: 'Diameter 49 244 km', scaleLabel: '1:820 733 333' },
        { id: 'venus', name: 'Venus', fileName: 'venus 12 104 km.svg', dimensions: 'Diameter 12 104 km', scaleLabel: '1:201 733 333' },
        { id: 'pluto', name: 'Pluto', fileName: 'pluto 2 376,6 km.svg', dimensions: 'Diameter 2 376,6 km', scaleLabel: '1:39 610 000' },
        { id: 'solen', name: 'Solen', fileName: 'solen 1 392 700 km.svg', dimensions: 'Diameter 1 392 700 km', scaleLabel: '1:23 211 666 667' }
      ]
    },
    {
      id: 'nature',
      label: 'Natur og installasjoner',
      figures: [
        { id: 'tre', name: 'Tre', fileName: 'Tre 2_3m 1_20.svg', dimensions: 'Høyde 2–3 m', scaleLabel: '1:20' },
        { id: 'lyktestolpe', name: 'Lyktestolpe', fileName: 'lyktestolpe (0,4m_2,8m) 1_40.svg', dimensions: '0,4 m × 2,8 m', scaleLabel: '1:40' }
      ]
    },
    {
      id: 'maps',
      label: 'Kart',
      figures: [
        { id: 'map-city', name: 'Bykart', fileName: 'maps/bykart 1_5000.svg', scaleLabel: '1:5 000', summary: 'Kart over et byområde' },
        { id: 'map-orienteering', name: 'Orienteringskart', fileName: 'maps/orienteringskart 1_3000.svg', scaleLabel: '1:3 000', summary: 'Orienteringskart' },
        { id: 'map-fjord', name: 'Fjordkart', fileName: 'maps/fjordkart 1_1000000.svg', scaleLabel: '1:1 000 000', summary: 'Kart over en fjord' },
        { id: 'map-norden', name: 'Norden', fileName: 'maps/Norden 1_25000000.svg', scaleLabel: '1:25 000 000', summary: 'Kart over Norden' },
        { id: 'map-europe', name: 'Europa', fileName: 'maps/europa 1_50000000.svg', scaleLabel: '1:50 000 000', summary: 'Kart over Europa' }
      ]
    },
    {
      id: 'sports',
      label: 'Sport- og lekeutstyr',
      figures: [
        { id: 'fotball', name: 'Fotball', fileName: 'fotball (21cm_21cm) 1_3.svg', dimensions: 'Diameter 21 cm', scaleLabel: '1:3' },
        { id: 'basketball', name: 'Basketball', fileName: 'basketball 24cm_24cm 1_4.svg', dimensions: 'Diameter 24 cm', scaleLabel: '1:4' },
        { id: 'tennisball', name: 'Tennisball', fileName: 'tennisball 6,5cm_6,5cm 1_1.svg', dimensions: 'Diameter 6,5 cm', scaleLabel: '1:1' },
        { id: 'badeball', name: 'Badeball', fileName: 'badeball (56cm_56cm) 1_8.svg', dimensions: 'Diameter 56 cm', scaleLabel: '1:8' }
      ]
    },
    {
      id: 'school-supplies',
      label: 'Skole-, kontor- og tegneutstyr',
      figures: [
        { id: 'binders', name: 'Binders', fileName: 'Binders (4cm_1cm) 10_4.svg', dimensions: '4 cm × 1 cm', scaleLabel: '10:4' },
        { id: 'euro', name: 'Euro-mynt', fileName: 'euro (2,325cm _2,325cm) 2,325 _ 1.svg', dimensions: 'Diameter 2,325 cm', scaleLabel: '2,325:1' },
        { id: 'passer', name: 'Passer', fileName: 'passer (10cm _5cm) 1_1.svg', dimensions: '10 cm × 5 cm', scaleLabel: '1:1' },
        { id: 'pensel', name: 'Pensel', fileName: 'pensel (20cm_1cm) 1_2.svg', dimensions: '20 cm × 1 cm', scaleLabel: '1:2' },
        { id: 'linjal', name: 'Linjal', fileName: 'linjal 1_1 (10cm 1,5cm) 1_1.svg', dimensions: '10 cm × 1,5 cm', scaleLabel: '1:1' },
        { id: 'blyant', name: 'Blyant', fileName: 'blyant (10cm_0,75cm) 1_1.svg', dimensions: '10 cm × 0,75 cm', scaleLabel: '1:1' },
        { id: 'blyant-tykk', name: 'Blyant (tykk)', fileName: 'blyantTykk (10cm _ 1cm) 1_1.svg', dimensions: '10 cm × 1 cm', scaleLabel: '1:1' },
        { id: 'blyant-tynn', name: 'Blyant (tynn)', fileName: 'blyantTynn (10cm_0,5cm) 1_1.svg', dimensions: '10 cm × 0,5 cm', scaleLabel: '1:1' },
        { id: 'blyantspisser', name: 'Blyantspisser', fileName: 'blyantspisser (3cm_1,5)  10_3.svg', dimensions: '3 cm × 1,5 cm', scaleLabel: '10:3' },
        { id: 'maleskrin', name: 'Maleskrin', fileName: 'maleskrin (20cm_10cm) 1_2.svg', dimensions: '20 cm × 10 cm', scaleLabel: '1:2' },
        { id: 'saks', name: 'Saks', fileName: 'saks (7cm_5cm) 10_7.svg', dimensions: '7 cm × 5 cm', scaleLabel: '10:7' },
        { id: 'viskelar', name: 'Viskelær', fileName: 'viskelær (4cm_1,4cm ) 10_4.svg', dimensions: '4 cm × 1,4 cm', scaleLabel: '10:4' }
      ]
    }
  ]
};

measurementFigureManifest.categories.forEach(category => {
  if (!category || typeof category !== 'object') return;
  if (Array.isArray(category.figures)) {
    category.figures.forEach(figure => {
      if (figure && typeof figure === 'object') {
        Object.freeze(figure);
      }
    });
    Object.freeze(category.figures);
  }
  Object.freeze(category);
});
Object.freeze(measurementFigureManifest.categories);
Object.freeze(measurementFigureManifest);

export function createMeasurementFigureLibrary(options = {}) {
  const { extractRealWorldSizeFromText } = options;

  return measurementFigureManifest.categories.map(category => ({
    id: category.id,
    label: category.label,
    figures: category.figures.map(figure => {
      const summaryParts = [];
      if (figure.summary) {
        summaryParts.push(figure.summary);
      } else if (figure.dimensions) {
        summaryParts.push(figure.dimensions);
      }
      if (figure.scaleLabel) {
        summaryParts.push(`målestokk ${figure.scaleLabel}`);
      }
      return {
        id: figure.id,
        name: figure.name,
        image: encodeMeasureImagePath(figure.fileName),
        fileName: figure.fileName || null,
        dimensions: figure.dimensions || '',
        scaleLabel: figure.scaleLabel || '',
        summary: summaryParts.join(' – '),
        realWorldSize: extractRealWorldSize(
          extractRealWorldSizeFromText,
          figure.dimensions,
          figure.summary,
          figure.fileName
        )
      };
    })
  }));
}

export function buildMeasurementFigureData(options = {}) {
  const categories = createMeasurementFigureLibrary(options).map(category => ({
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
        custom: true,
        realWorldSize: null
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

export function getMeasurementFiguresGroupedByCategory(options = {}) {
  const data = buildMeasurementFigureData(options);
  return data.categories.map(category => ({
    id: category.id,
    label: category.label,
    figures: category.figures.map(figure => ({
      id: figure.id,
      name: figure.name,
      summary: figure.summary,
      image: figure.image
    }))
  }));
}

export const createFigureLibrary = createMeasurementFigureLibrary;
export const buildFigureData = buildMeasurementFigureData;
export const getFiguresGroupedByCategory = getMeasurementFiguresGroupedByCategory;
export { createFigurePickerHelpers } from './figure-picker.js';

const manifestCache = new Map();

export function fetchFigureManifest(url, options = {}) {
  if (typeof url !== 'string' || !url.trim()) {
    return Promise.reject(new TypeError('fetchFigureManifest: url must be a non-empty string'));
  }
  const normalizedUrl = url.trim();
  const {
    fetch: fetchOverride,
    cacheKey,
    cache: cacheMode = 'no-store',
    ...fetchOptions
  } = options;
  const resolvedCacheKey = typeof cacheKey === 'string' && cacheKey ? cacheKey : normalizedUrl;
  if (manifestCache.has(resolvedCacheKey)) {
    return manifestCache.get(resolvedCacheKey);
  }
  const fetchImpl = typeof fetchOverride === 'function'
    ? fetchOverride
    : typeof globalThis !== 'undefined' && typeof globalThis.fetch === 'function'
      ? globalThis.fetch
      : null;
  if (!fetchImpl) {
    return Promise.reject(new Error('fetchFigureManifest: no fetch implementation available'));
  }
  const request = fetchImpl(normalizedUrl, { cache: cacheMode, ...fetchOptions })
    .then(response => {
      if (!response || typeof response.ok !== 'boolean') {
        throw new Error('fetchFigureManifest: invalid response');
      }
      if (!response.ok) {
        throw new Error(`fetchFigureManifest: HTTP ${response.status}`);
      }
      return response.json();
    })
    .catch(error => {
      manifestCache.delete(resolvedCacheKey);
      throw error;
    });
  manifestCache.set(resolvedCacheKey, request);
  return request;
}

export function extractFigureLibrarySlugs(payload) {
  if (!payload || typeof payload !== 'object') {
    return [];
  }
  if (Array.isArray(payload.slugs) && payload.slugs.length) {
    return payload.slugs
      .map(entry => (typeof entry === 'string' ? entry.trim() : ''))
      .filter(entry => entry);
  }
  if (Array.isArray(payload.files) && payload.files.length) {
    return payload.files
      .map(entry => {
        if (typeof entry !== 'string') return '';
        return entry.replace(/\.svg$/i, '').trim();
      })
      .filter(entry => entry);
  }
  return [];
}

export function buildFigureLibraryOptions(slugs, options = {}) {
  const categories = Array.isArray(options.categories) ? options.categories : [];
  const defaultCategoryId = typeof options.defaultCategoryId === 'string' && options.defaultCategoryId
    ? options.defaultCategoryId
    : categories.length > 0
      ? categories[0].id
      : '';
  const locale = typeof options.locale === 'string' && options.locale ? options.locale : DEFAULT_LOCALE;

  const optionsByCategory = new Map();
  categories.forEach(category => {
    if (category && typeof category.id === 'string') {
      optionsByCategory.set(category.id, []);
    }
  });

  const optionsByValue = new Map();

  if (!Array.isArray(slugs)) {
    return { optionsByCategory, optionsByValue };
  }

  slugs.forEach(rawSlug => {
    if (typeof rawSlug !== 'string') return;
    const trimmed = rawSlug.trim();
    if (!trimmed) return;
    const baseSlug = trimmed.replace(/\.svg$/i, '');
    const value = `${baseSlug}.svg`;
    const label = baseSlug;
    const lowerValue = value.toLowerCase();
    if (optionsByValue.has(lowerValue)) {
      return;
    }
    const lowerLabel = label.toLowerCase();
    let categoryId = defaultCategoryId;
    for (const category of categories) {
      if (!category || typeof category.prefix !== 'string' || !category.prefix) continue;
      if (lowerLabel.startsWith(category.prefix)) {
        categoryId = category.id;
        break;
      }
    }
    const option = { value, label, categoryId };
    const list = optionsByCategory.get(categoryId);
    if (Array.isArray(list)) {
      list.push(option);
    } else if (categoryId) {
      optionsByCategory.set(categoryId, [option]);
    }
    optionsByValue.set(lowerValue, option);
    if (!optionsByValue.has(lowerLabel)) {
      optionsByValue.set(lowerLabel, option);
    }
  });

  optionsByCategory.forEach(list => {
    if (!Array.isArray(list) || list.length < 2) return;
    list.sort((a, b) => a.label.localeCompare(b.label, locale, { numeric: true, sensitivity: 'base' }));
  });

  return { optionsByCategory, optionsByValue };
}

export function clearFigureManifestCache(cacheKey) {
  if (typeof cacheKey === 'string' && cacheKey) {
    manifestCache.delete(cacheKey);
  } else {
    manifestCache.clear();
  }
}

