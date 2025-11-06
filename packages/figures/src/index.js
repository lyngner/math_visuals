const DEFAULT_LOCALE = 'nb';

export const CUSTOM_CATEGORY_ID = 'custom';
export const CUSTOM_FIGURE_ID = 'custom';
export const MEASURE_IMAGE_BASE_PATH = '/images/measure/';

const DEFAULT_FIGURE_LIBRARY_ENDPOINT = '/api/figure-library';
const REMOTE_LIBRARY_FALLBACK_CATEGORY_ID = 'remote-library';
const REMOTE_LIBRARY_FALLBACK_CATEGORY_LABEL = 'Opplastede figurer';

const defaultFigureLibraryMetadata = Object.freeze({
  storageMode: 'memory',
  storage: 'memory',
  mode: 'memory',
  persistent: false,
  ephemeral: true,
  limitation: ''
});

const measurementFigureLibraryState = {
  loaded: false,
  loadingPromise: null,
  categories: [],
  figures: [],
  metadata: cloneFigureLibraryMetadata(defaultFigureLibraryMetadata)
};

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

function cloneFigureLibraryMetadata(metadata) {
  const base = {
    storageMode: defaultFigureLibraryMetadata.storageMode,
    storage: defaultFigureLibraryMetadata.storage,
    mode: defaultFigureLibraryMetadata.mode,
    persistent: defaultFigureLibraryMetadata.persistent,
    ephemeral: defaultFigureLibraryMetadata.ephemeral,
    limitation: defaultFigureLibraryMetadata.limitation
  };
  if (!metadata || typeof metadata !== 'object') {
    return base;
  }
  const modeHint = metadata.storageMode || metadata.mode || metadata.storage;
  const normalizedMode = normalizeStorageMode(modeHint);
  if (normalizedMode) {
    base.storageMode = normalizedMode;
    base.mode = normalizedMode;
    base.storage = normalizedMode;
    base.persistent = normalizedMode === 'kv';
    base.ephemeral = normalizedMode !== 'kv';
  }
  if (Object.prototype.hasOwnProperty.call(metadata, 'persistent')) {
    base.persistent = Boolean(metadata.persistent);
    if (base.persistent) {
      base.ephemeral = false;
    }
  }
  if (Object.prototype.hasOwnProperty.call(metadata, 'ephemeral')) {
    base.ephemeral = Boolean(metadata.ephemeral);
    if (base.ephemeral) {
      base.persistent = false;
    }
  }
  if (typeof metadata.limitation === 'string' && metadata.limitation.trim()) {
    base.limitation = metadata.limitation.trim();
  } else if (base.storageMode !== 'memory') {
    base.limitation = '';
  }
  return base;
}

function normalizeStorageMode(value) {
  if (typeof value !== 'string') {
    return null;
  }
  const normalized = value.trim().toLowerCase();
  if (!normalized) {
    return null;
  }
  if (normalized === 'kv' || normalized === 'vercel-kv') {
    return 'kv';
  }
  if (normalized === 'memory' || normalized === 'mem' || normalized === 'unconfigured') {
    return 'memory';
  }
  return normalized;
}

function normalizeLibraryIdentifier(value) {
  if (typeof value !== 'string') {
    return '';
  }
  const trimmed = value.trim();
  return trimmed ? trimmed : '';
}

function normalizeOptionalText(value) {
  if (typeof value !== 'string') {
    return '';
  }
  return value.trim();
}

function encodeSvgToDataUrl(svgText) {
  if (typeof svgText !== 'string') {
    return null;
  }
  const trimmed = svgText.trim();
  if (!trimmed) {
    return null;
  }
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(trimmed)
    .replace(/'/g, '%27')
    .replace(/"/g, '%22')}`;
}

function resolveLibraryFigureImage(entry) {
  if (!entry || typeof entry !== 'object') {
    return '';
  }
  const candidates = [];
  if (typeof entry.image === 'string') {
    candidates.push(entry.image);
  }
  if (typeof entry.dataUrl === 'string') {
    candidates.push(entry.dataUrl);
  }
  if (entry.urls && typeof entry.urls.svg === 'string') {
    candidates.push(entry.urls.svg);
  }
  const files = entry.files && typeof entry.files === 'object' ? entry.files : null;
  if (files) {
    if (typeof files.svg === 'string') {
      candidates.push(files.svg);
    } else if (files.svg && typeof files.svg.url === 'string') {
      candidates.push(files.svg.url);
    }
  }
  if (typeof entry.svgPath === 'string') {
    candidates.push(entry.svgPath);
  }
  if (typeof entry.svgUrl === 'string') {
    candidates.push(entry.svgUrl);
  }
  if (typeof entry.path === 'string') {
    candidates.push(entry.path);
  }
  if (typeof entry.asset === 'string') {
    candidates.push(entry.asset);
  }
  if (typeof entry.svg === 'string') {
    const encoded = encodeSvgToDataUrl(entry.svg);
    if (encoded) {
      candidates.push(encoded);
    }
  }
  for (const candidate of candidates) {
    if (typeof candidate !== 'string') {
      continue;
    }
    const trimmed = candidate.trim();
    if (trimmed) {
      return trimmed;
    }
  }
  return '';
}

function normalizeLibraryCategory(entry) {
  if (!entry || typeof entry !== 'object') {
    return null;
  }
  const id = normalizeLibraryIdentifier(entry.id || entry.categoryId);
  if (!id) {
    return null;
  }
  const label = normalizeOptionalText(entry.label || entry.name || entry.title) || id;
  const description = normalizeOptionalText(entry.description);
  return { id, label, description };
}

function normalizeLibraryFigure(entry, categoryLabels = new Map()) {
  if (!entry || typeof entry !== 'object') {
    return null;
  }
  const slug = normalizeLibraryIdentifier(entry.slug);
  const idSource = slug || normalizeLibraryIdentifier(entry.id);
  if (!idSource) {
    return null;
  }
  const image = resolveLibraryFigureImage(entry);
  if (!image) {
    return null;
  }
  const nameCandidates = [entry.title, entry.name, idSource, slug];
  let name = '';
  for (const candidate of nameCandidates) {
    if (typeof candidate === 'string' && candidate.trim()) {
      name = candidate.trim();
      break;
    }
  }
  if (!name) {
    name = idSource;
  }
  const rawCategoryId = normalizeLibraryIdentifier(
    entry.categoryId || (entry.category && entry.category.id)
  );
  const categoryLabelCandidates = [
    normalizeOptionalText(entry.categoryName),
    entry.category && normalizeOptionalText(entry.category.label),
    categoryLabels.get(rawCategoryId),
    rawCategoryId
  ];
  let categoryLabel = '';
  for (const candidate of categoryLabelCandidates) {
    if (typeof candidate === 'string' && candidate.trim()) {
      categoryLabel = candidate.trim();
      break;
    }
  }
  const summary = normalizeOptionalText(entry.summary);
  const description = normalizeOptionalText(entry.description);
  const dimensions = normalizeOptionalText(entry.dimensions);
  const scaleLabel = normalizeOptionalText(entry.scaleLabel || entry.scale);
  const fileName = normalizeOptionalText(entry.fileName);
  const tags = Array.isArray(entry.tags)
    ? entry.tags
        .map(tag => (typeof tag === 'string' ? tag.trim() : ''))
        .filter(tag => tag)
    : [];
  const createdAt = typeof entry.createdAt === 'string' && entry.createdAt.trim()
    ? entry.createdAt.trim()
    : null;
  const updatedAt = typeof entry.updatedAt === 'string' && entry.updatedAt.trim()
    ? entry.updatedAt.trim()
    : null;
  const dataUrl = typeof entry.dataUrl === 'string' && entry.dataUrl.trim()
    ? entry.dataUrl.trim()
    : image.startsWith('data:')
      ? image
      : '';
  return {
    id: `remote:${idSource}`,
    slug: idSource,
    name,
    categoryId: rawCategoryId,
    categoryLabel,
    image,
    dataUrl,
    summary,
    description,
    dimensions,
    scaleLabel,
    fileName,
    tags,
    createdAt,
    updatedAt,
    storageMode: normalizeStorageMode(entry.storageMode || entry.mode || entry.storage)
  };
}

function normalizeLibraryMetadata(payload, response) {
  const metadata = {};
  if (payload && typeof payload === 'object') {
    Object.assign(metadata, payload);
  }
  if (response && typeof response.headers?.get === 'function') {
    const modeHeader = response.headers.get('X-Figure-Library-Store-Mode');
    if (modeHeader && !metadata.storageMode && !metadata.mode && !metadata.storage) {
      metadata.mode = modeHeader;
    }
  }
  return cloneFigureLibraryMetadata(metadata);
}

function normalizeMeasurementFigureLibraryPayload(payload, response) {
  const categories = [];
  const figures = [];
  const categoryLabels = new Map();
  if (payload && Array.isArray(payload.categories)) {
    payload.categories.forEach(entry => {
      const normalized = normalizeLibraryCategory(entry);
      if (!normalized) {
        return;
      }
      categories.push(normalized);
      categoryLabels.set(normalized.id, normalized.label);
    });
  }
  const entries = Array.isArray(payload && payload.entries)
    ? payload.entries
    : payload && payload.entry
      ? [payload.entry]
      : [];
  entries.forEach(entry => {
    const normalized = normalizeLibraryFigure(entry, categoryLabels);
    if (!normalized) {
      return;
    }
    if (normalized.categoryId && !categoryLabels.has(normalized.categoryId)) {
      categoryLabels.set(normalized.categoryId, normalized.categoryLabel || normalized.categoryId);
    }
    figures.push(normalized);
  });
  const metadata = normalizeLibraryMetadata(payload, response);
  return { categories, figures, metadata };
}

function parseJsonResponse(response) {
  if (!response || typeof response.text !== 'function') {
    return Promise.resolve({});
  }
  return response.text().then(text => {
    if (!text) {
      return {};
    }
    try {
      return JSON.parse(text);
    } catch (error) {
      if (response.ok) {
        const parsingError = new Error('Invalid JSON response from figure library');
        parsingError.response = response;
        parsingError.cause = error;
        throw parsingError;
      }
      return {};
    }
  });
}

function shapeRemoteMeasurementFigure(remoteFigure, options = {}) {
  if (!remoteFigure || typeof remoteFigure !== 'object') {
    return null;
  }
  if (typeof remoteFigure.image !== 'string' || !remoteFigure.image.trim()) {
    return null;
  }
  const dimensions = typeof remoteFigure.dimensions === 'string' ? remoteFigure.dimensions : '';
  const summarySource = typeof remoteFigure.summary === 'string' && remoteFigure.summary.trim()
    ? remoteFigure.summary.trim()
    : '';
  const description = typeof remoteFigure.description === 'string' && remoteFigure.description.trim()
    ? remoteFigure.description.trim()
    : '';
  const scaleLabel = typeof remoteFigure.scaleLabel === 'string' && remoteFigure.scaleLabel.trim()
    ? remoteFigure.scaleLabel.trim()
    : '';
  const summaryParts = [];
  if (summarySource) {
    summaryParts.push(summarySource);
  } else if (dimensions) {
    summaryParts.push(dimensions);
  } else if (description) {
    summaryParts.push(description);
  }
  if (scaleLabel) {
    summaryParts.push(`målestokk ${scaleLabel}`);
  }
  const summary = summaryParts.join(' – ');
  const realWorldSize = extractRealWorldSize(
    options.extractRealWorldSizeFromText,
    dimensions,
    summarySource,
    description
  );
  const tags = Array.isArray(remoteFigure.tags) ? remoteFigure.tags.slice() : [];
  return {
    id: remoteFigure.id,
    slug: remoteFigure.slug,
    name: remoteFigure.name,
    image: remoteFigure.image,
    fileName: remoteFigure.fileName || null,
    dimensions,
    scaleLabel,
    summary,
    realWorldSize,
    categoryId: remoteFigure.categoryId || '',
    categoryLabel: remoteFigure.categoryLabel || '',
    dataUrl: remoteFigure.dataUrl || '',
    tags,
    createdAt: remoteFigure.createdAt || null,
    updatedAt: remoteFigure.updatedAt || null,
    storageMode: remoteFigure.storageMode || null,
    source: 'api',
    custom: true,
    remote: true
  };
}

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

  const categoriesById = new Map();
  categories.forEach(category => {
    categoriesById.set(category.id, category);
  });

  const remoteFigures = Array.isArray(measurementFigureLibraryState.figures)
    ? measurementFigureLibraryState.figures
    : [];
  if (remoteFigures.length) {
    const remoteCategoryLabels = new Map();
    if (Array.isArray(measurementFigureLibraryState.categories)) {
      measurementFigureLibraryState.categories.forEach(entry => {
        const normalizedId = normalizeLibraryIdentifier(entry && entry.id);
        if (!normalizedId) {
          return;
        }
        const label = typeof entry.label === 'string' && entry.label.trim()
          ? entry.label.trim()
          : normalizedId;
        remoteCategoryLabels.set(normalizedId, label);
      });
    }
    remoteFigures.forEach(remoteFigure => {
      const shaped = shapeRemoteMeasurementFigure(remoteFigure, options);
      if (!shaped) {
        return;
      }
      let targetCategoryId = normalizeLibraryIdentifier(shaped.categoryId);
      if (!targetCategoryId) {
        targetCategoryId = REMOTE_LIBRARY_FALLBACK_CATEGORY_ID;
      }
      let category = categoriesById.get(targetCategoryId);
      if (!category) {
        const resolvedLabel = targetCategoryId === REMOTE_LIBRARY_FALLBACK_CATEGORY_ID
          ? REMOTE_LIBRARY_FALLBACK_CATEGORY_LABEL
          : shaped.categoryLabel || remoteCategoryLabels.get(targetCategoryId) || targetCategoryId;
        category = {
          id: targetCategoryId,
          label: resolvedLabel,
          figures: []
        };
        categories.push(category);
        categoriesById.set(category.id, category);
      }
      const figure = {
        ...shaped,
        categoryId: category.id
      };
      category.figures.push(figure);
    });
  }

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
      if (!byId.has(figure.id)) {
        byId.set(figure.id, figure);
      }
      if (figure.image && !byImage.has(figure.image)) {
        byImage.set(figure.image, figure);
      }
    }
  }

  return {
    categories,
    byId,
    byImage,
    metadata: cloneFigureLibraryMetadata(measurementFigureLibraryState.metadata)
  };
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
export const loadFigureLibrary = loadMeasurementFigureLibrary;
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

export function loadMeasurementFigureLibrary(options = {}) {
  const {
    fetch: fetchOverride,
    endpoint,
    force,
    refresh,
    headers: extraHeaders,
    ...fetchOptions
  } = options || {};
  const url = typeof endpoint === 'string' && endpoint.trim() ? endpoint.trim() : DEFAULT_FIGURE_LIBRARY_ENDPOINT;
  const fetchImpl = typeof fetchOverride === 'function'
    ? fetchOverride
    : typeof globalThis !== 'undefined' && typeof globalThis.fetch === 'function'
      ? globalThis.fetch.bind(globalThis)
      : null;
  if (!fetchImpl) {
    return Promise.reject(new Error('loadMeasurementFigureLibrary: no fetch implementation available'));
  }
  if (!force && !refresh && measurementFigureLibraryState.loaded) {
    return Promise.resolve({
      categories: Array.isArray(measurementFigureLibraryState.categories)
        ? measurementFigureLibraryState.categories.slice()
        : [],
      figures: Array.isArray(measurementFigureLibraryState.figures)
        ? measurementFigureLibraryState.figures.slice()
        : [],
      metadata: cloneFigureLibraryMetadata(measurementFigureLibraryState.metadata)
    });
  }
  if (measurementFigureLibraryState.loadingPromise) {
    return measurementFigureLibraryState.loadingPromise;
  }
  const headers = Object.assign({ Accept: 'application/json' }, extraHeaders && typeof extraHeaders === 'object' ? extraHeaders : {});
  const requestInit = {
    method: 'GET',
    headers,
    cache: 'no-store',
    ...fetchOptions
  };
  const request = fetchImpl(url, requestInit)
    .then(response => parseJsonResponse(response).then(data => ({ response, data })))
    .then(({ response, data }) => {
      if (!response || typeof response.ok !== 'boolean') {
        throw new Error('loadMeasurementFigureLibrary: invalid response');
      }
      if (!response.ok) {
        const message = typeof data.error === 'string' && data.error.trim()
          ? data.error.trim()
          : `HTTP ${response.status}`;
        const error = new Error(message);
        error.response = response;
        error.payload = data;
        throw error;
      }
      const normalized = normalizeMeasurementFigureLibraryPayload(data, response);
      measurementFigureLibraryState.categories = normalized.categories;
      measurementFigureLibraryState.figures = normalized.figures;
      measurementFigureLibraryState.metadata = cloneFigureLibraryMetadata(normalized.metadata);
      measurementFigureLibraryState.loaded = true;
      measurementFigureLibraryState.loadingPromise = null;
      return {
        categories: Array.isArray(measurementFigureLibraryState.categories)
          ? measurementFigureLibraryState.categories.slice()
          : [],
        figures: Array.isArray(measurementFigureLibraryState.figures)
          ? measurementFigureLibraryState.figures.slice()
          : [],
        metadata: cloneFigureLibraryMetadata(measurementFigureLibraryState.metadata)
      };
    })
    .catch(error => {
      measurementFigureLibraryState.loadingPromise = null;
      throw error;
    });
  measurementFigureLibraryState.loadingPromise = request;
  return request;
}

export function getMeasurementFigureLibraryMetadata() {
  return cloneFigureLibraryMetadata(measurementFigureLibraryState.metadata);
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

