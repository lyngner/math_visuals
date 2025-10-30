export const CUSTOM_CATEGORY_ID = 'custom';
export const CUSTOM_FIGURE_ID = 'custom';

const MEASURE_IMAGE_BASE_PATH = 'images/measure/';

function encodeMeasureImagePath(fileName) {
  if (!fileName) {
    return null;
  }
  return encodeURI(MEASURE_IMAGE_BASE_PATH + fileName);
}

function resolveRealWorldSize(helper, dimensions, summary, fileName) {
  if (typeof helper !== 'function') {
    return null;
  }
  return (
    helper(dimensions || '') ||
    helper(summary || '') ||
    helper(fileName || '') ||
    null
  );
}

export function createFigureLibrary(options = {}) {
  const { extractRealWorldSizeFromText } = options;

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
    const realWorldSize = resolveRealWorldSize(
      extractRealWorldSizeFromText,
      dimensions,
      summary,
      fileName
    );
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

export function buildFigureData(options = {}) {
  const baseCategories = createFigureLibrary(options);
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

export function getFiguresGroupedByCategory(options = {}) {
  const data = buildFigureData(options);
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
