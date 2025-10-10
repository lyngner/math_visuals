export const DEFAULT_TALLINJE_STATE = {
  from: 0,
  to: 1,
  mainStep: 0.25,
  subdivisions: 1,
  numberType: 'mixedFraction',
  decimalDigits: 2,
  labelFontSize: 18,
  clampToRange: true,
  lockLine: true,
  altText: '',
  altTextSource: 'auto',
  draggableItems: [
    {
      id: 'draggable-1',
      label: '',
      value: 0.25,
      startPosition: { value: 0.05, offsetY: -120 },
      currentValue: 0.05,
      currentOffsetY: -120,
      isPlaced: false
    },
    {
      id: 'draggable-2',
      label: 'En halv',
      value: 0.5,
      startPosition: { value: 0.85, offsetY: -120 },
      currentValue: 0.85,
      currentOffsetY: -120,
      isPlaced: false
    },
    {
      id: 'draggable-3',
      label: '',
      value: 0.75,
      startPosition: { value: 0.35, offsetY: -120 },
      currentValue: 0.35,
      currentOffsetY: -120,
      isPlaced: false
    }
  ]
};

const DEFAULT_AREALMODELL_CFG = {
  SIMPLE: {
    layout: 'quad',
    height: {
      cells: 8,
      handle: 4,
      show: true,
      showHandle: true
    },
    length: {
      cells: 12,
      handle: 3,
      show: true,
      showHandle: true
    },
    totalHandle: {
      show: true,
      maxCols: 30,
      maxRows: 30
    },
    challenge: {
      enabled: true,
      area: 24,
      dedupeOrderless: true,
      autoExpandMax: true
    },
    altText: '',
    altTextSource: 'auto'
  },
  ADV: {
    svgId: 'area',
    unit: 40,
    margins: {
      l: 140,
      r: 60,
      t: 60,
      b: 120
    },
    colors: {
      fill: '#8bb889',
      edge: '#1f2937',
      grid: '#bcccdc',
      text: '#1f2937'
    }
  }
};

const DEFAULT_AREALMODELL0_CFG = {
  SIMPLE: {
    length: {
      cells: 4,
      max: 12,
      show: true
    },
    height: {
      cells: 3,
      max: 12,
      show: true
    },
    showGrid: true,
    snap: 1,
    areaLabel: 'areal',
    challenge: {
      enabled: true,
      area: 12,
      dedupeOrderless: true,
      autoExpandMax: true
    }
  },
  ADV: {}
};

const DEFAULT_BRØKFIGURER_STATE = {
  rows: 2,
  cols: 2,
  colorCount: 3,
  colors: ['#f97316', '#2563eb', '#10b981'],
  allowWrong: false,
  showDivisionLines: true,
  showOutline: true,
  figures: {
    A: {
      shape: 'circle',
      parts: 4,
      division: 'pie',
      filled: [
        [0, 1],
        [1, 1]
      ],
      labels: {
        fraction: '1/2',
        text: 'Halv pizza'
      }
    },
    B: {
      shape: 'rectangle',
      parts: 6,
      division: 'grid',
      filled: [
        [0, 2],
        [1, 2],
        [2, 2]
      ],
      labels: {
        fraction: '3/6',
        text: 'Tre av seks deler'
      }
    }
  },
  altText: '',
  altTextSource: 'auto'
};

const DEFAULT_BRØKPIZZA_SIMPLE = {
  layout: 'triple',
  pizzas: [
    {
      slices: 8,
      filled: [0, 1, 2, 3],
      text: '4/8',
      hint: 'Halv pizza'
    },
    {
      slices: 6,
      filled: [0, 1, 2, 3, 4],
      text: '5/6',
      hint: 'Nesten hel'
    },
    {
      slices: 5,
      filled: [0, 1],
      text: '2/5',
      hint: 'To av fem'
    }
  ],
  altText: '',
  altTextSource: 'auto'
};

const DEFAULT_BRØKVEGG_STATE = {
  denominators: [2, 3, 4, 6, 8, 12],
  tileModes: {
    '6': 'percent'
  },
  defaultMode: 'fraction',
  showLabels: true,
  textScale: 0.82,
  decimalDigits: 2,
  percentDigits: 1,
  trimTrailingZeros: true,
  altText: '',
  altTextSource: 'auto'
};

const DEFAULT_DIAGRAM_CFG = {
  type: 'bar',
  title: 'Favorittidretter i 5B',
  labels: ['Klatring', 'Fotball', 'Håndball', 'Basket', 'Tennis', 'Bowling'],
  series1: 'Svar',
  start: [6, 7, 3, 5, 8, 2],
  answer: [6, 7, 3, 5, 8, 2],
  yMin: 0,
  yMax: 8,
  snap: 1,
  tolerance: 0,
  axisXLabel: 'Idrett',
  axisYLabel: 'Antall elever',
  valueDisplay: 'none',
  pieLabelPosition: 'outside',
  locked: [],
  altText: '',
  altTextSource: 'auto'
};

const DEFAULT_EXAMPLES_TRASH_STATE = {
  notes: 'Eksempellageret i memory-modus',
  previewPaths: ['/tallinje'],
  altText: '',
  altTextSource: 'auto'
};

const DEFAULT_FIGURTALL_STATE = {
  step: 3,
  max: 6,
  showNumbers: true,
  showStep: true,
  figures: [
    {
      id: 'f1',
      label: 'Triangel 1',
      points: [[0, 0], [1, 0], [0.5, 0.866]],
      color: '#2563eb'
    },
    {
      id: 'f2',
      label: 'Triangel 2',
      points: [[0, 0], [2, 0], [1, 1.732]],
      color: '#f59e0b'
    }
  ],
  altText: '',
  altTextSource: 'auto'
};

const DEFAULT_FORTEGNSSKJEMA_STATE = {
  expression: '(x-2)(x+3)',
  domain: [-6, 6],
  evaluationPoints: [-5, -3, 0, 2, 5],
  intervals: [
    { from: -Infinity, to: -3, sign: '-' },
    { from: -3, to: 2, sign: '+' },
    { from: 2, to: Infinity, sign: '-' }
  ],
  altText: '',
  altTextSource: 'auto'
};

const DEFAULT_GRAFTEGNER_SIMPLE = {
  axes: {
    xMin: -5,
    xMax: 5,
    yMin: -4,
    yMax: 6
  },
  expressions: [
    {
      id: 'expr-1',
      latex: 'y=x^2-1',
      color: '#2563eb',
      visible: true
    },
    {
      id: 'expr-2',
      latex: 'y=2x+3',
      color: '#f97316',
      visible: true
    }
  ],
  altText: '',
  altTextSource: 'auto'
};

const DEFAULT_KULER_SIMPLE = {
  beadRadius: 28,
  bowls: [
    {
      label: 'Bolle A',
      colorCounts: [
        { color: 'blue', count: 3 },
        { color: 'red', count: 2 },
        { color: 'green', count: 1 }
      ]
    },
    {
      label: 'Bolle B',
      colorCounts: [
        { color: 'blue', count: 1 },
        { color: 'red', count: 4 },
        { color: 'yellow', count: 2 }
      ]
    }
  ],
  altText: '',
  altTextSource: 'auto'
};

const DEFAULT_KVIKKBILDER_CFG = {
  category: 'geometry',
  seed: 17,
  showLabels: true,
  altText: '',
  altTextSource: 'auto'
};

const DEFAULT_KVIKKBILDER_MONSTER_CFG = {
  pattern: 'striped',
  rows: 4,
  cols: 4,
  palette: ['#0ea5e9', '#facc15', '#14b8a6'],
  altText: '',
  altTextSource: 'auto'
};

const DEFAULT_NKANT_STATE = {
  sides: 8,
  showDiagonals: true,
  snapAngle: 15,
  radius: 160,
  altText: '',
  altTextSource: 'auto'
};

const DEFAULT_PERLESNOR_SIMPLE = {
  nBeads: 20,
  startIndex: 5,
  correct: {
    mode: 'leftCount',
    value: 8
  },
  feedback: {
    correct: 'Riktig!',
    wrong: 'Prøv igjen',
    showLive: true
  },
  altText: '',
  altTextSource: 'auto'
};

const DEFAULT_PRIKKTILPRIKK_STATE = {
  mode: 'connect',
  showNumbers: true,
  lines: [
    {
      id: 'line-1',
      points: [
        { x: 20, y: 120 },
        { x: 140, y: 40 },
        { x: 260, y: 140 },
        { x: 380, y: 60 },
        { x: 500, y: 120 }
      ]
    }
  ],
  altText: '',
  altTextSource: 'auto'
};

const DEFAULT_TENKEBLOKKER_CONFIG = {
  blocks: [
    { id: 'hundre', value: 100, count: 2 },
    { id: 'ti', value: 10, count: 5 },
    { id: 'en', value: 1, count: 8 }
  ],
  goal: 258,
  altText: '',
  altTextSource: 'auto'
};

const DEFAULT_TENKEBLOKKER_STEPPER_CONFIG = {
  steps: [
    { id: 'step-1', value: 100 },
    { id: 'step-2', value: 50 },
    { id: 'step-3', value: 7 }
  ],
  total: 157,
  altText: '',
  altTextSource: 'auto'
};

const DEFAULT_TREFIGURER_STATE = {
  rawInput: 'trekant(0,0) (2,0) (1,2)\nfirkant(0,0) (0,2) (2,2) (2,0)',
  figures: [],
  rotationLocked: false,
  freeFigure: false,
  useCustomColor: false,
  customColor: '#1e3a8a',
  altText: '',
  altTextSource: 'auto'
};

export const DEFAULT_EXAMPLE_ENTRIES = [
  {
    path: '/arealmodell',
    examples: [
      {
        __builtinKey: 'arealmodell-utforsk-faktorpar',
        title: 'Finn faktorpar for 24',
        description: 'Flytt håndtakene og finn rektangler som har areal 24.',
        config: {
          CFG: DEFAULT_AREALMODELL_CFG
        }
      }
    ]
  },
  {
    path: '/arealmodell0',
    examples: [
      {
        __builtinKey: 'arealmodell0-grunnrutenett',
        title: 'Bygg rektangel',
        description: 'Bruk rutenettet for å tegne et 4×3-rektangel.',
        config: {
          CFG: DEFAULT_AREALMODELL0_CFG
        }
      }
    ]
  },
  {
    path: '/arealmodellen1',
    examples: [
      {
        __builtinKey: 'arealmodellen1-fargelegg',
        title: 'Fargelagte ruter',
        description: 'Utforsk firedelte arealer med ulike farger.',
        config: {
          CFG: DEFAULT_AREALMODELL_CFG
        }
      }
    ]
  },
  {
    path: '/brøkfigurer',
    examples: [
      {
        __builtinKey: 'brøkfigurer-halv-sirkel',
        title: 'Halv sirkel og rektangel',
        description: 'Vis to brøkfigurer og sammenlign brøkene.',
        config: {
          STATE: DEFAULT_BRØKFIGURER_STATE
        }
      }
    ]
  },
  {
    path: '/brøkpizza',
    examples: [
      {
        __builtinKey: 'brøkpizza-tre-pizzaer',
        title: 'Sammenlign brøkpizzaer',
        description: 'Tre pizzaer viser ulike brøkdelinger.',
        config: {
          SIMPLE: DEFAULT_BRØKPIZZA_SIMPLE
        }
      }
    ]
  },
  {
    path: '/brøkvegg',
    examples: [
      {
        __builtinKey: 'brøkvegg-standard',
        title: 'Brøkvegg med prosent',
        description: 'Sammenlign brøker og prosent på en brøkvegg.',
        config: {
          STATE: DEFAULT_BRØKVEGG_STATE
        }
      }
    ]
  },
  {
    path: '/diagram',
    examples: [
      {
        __builtinKey: 'diagram-favorittidrett',
        title: 'Favorittidretter',
        description: 'Søylediagram over elevenes favorittidretter.',
        config: {
          CFG: DEFAULT_DIAGRAM_CFG
        }
      }
    ]
  },
  {
    path: '/examples-trash',
    examples: [
      {
        __builtinKey: 'examples-trash-memory-info',
        title: 'Memory-modus',
        description: 'Eksempelpost for å demonstrere memory-modus.',
        config: {
          STATE: DEFAULT_EXAMPLES_TRASH_STATE
        }
      }
    ]
  },
  {
    path: '/figurtall',
    examples: [
      {
        __builtinKey: 'figurtall-triangelvekst',
        title: 'Triangelmønster',
        description: 'Vis hvordan triangelmønsteret vokser.',
        config: {
          STATE: DEFAULT_FIGURTALL_STATE
        }
      }
    ]
  },
  {
    path: '/fortegnsskjema',
    examples: [
      {
        __builtinKey: 'fortegnsskjema-faktoriser',
        title: 'Fortegn for (x−2)(x+3)',
        description: 'Analyser fortegnene til produktet (x−2)(x+3).',
        config: {
          STATE: DEFAULT_FORTEGNSSKJEMA_STATE
        }
      }
    ]
  },
  {
    path: '/graftegner',
    examples: [
      {
        __builtinKey: 'graftegner-parabel-og-linje',
        title: 'Parabel og linje',
        description: 'Tegn grafene til y = x² − 1 og y = 2x + 3.',
        config: {
          SIMPLE: DEFAULT_GRAFTEGNER_SIMPLE
        }
      }
    ]
  },
  {
    path: '/kuler',
    examples: [
      {
        __builtinKey: 'kuler-trekk-baller',
        title: 'Baller i to skåler',
        description: 'Sammenlign fargefordelingen i to skåler.',
        config: {
          SIMPLE: DEFAULT_KULER_SIMPLE
        }
      }
    ]
  },
  {
    path: '/kvikkbilder',
    examples: [
      {
        __builtinKey: 'kvikkbilder-geometri',
        title: 'Geometrisk mønster',
        description: 'Generer et kvikkbilde med fokus på geometri.',
        config: {
          CFG: DEFAULT_KVIKKBILDER_CFG
        }
      }
    ]
  },
  {
    path: '/kvikkbilder-monster',
    examples: [
      {
        __builtinKey: 'kvikkbilder-monster-stripet',
        title: 'Stripet mønster',
        description: 'Utforsk et stripet kvikkbildemønster.',
        config: {
          CFG: DEFAULT_KVIKKBILDER_MONSTER_CFG
        }
      }
    ]
  },
  {
    path: '/nkant',
    examples: [
      {
        __builtinKey: 'nkant-åttekant',
        title: 'Regulær åttekant',
        description: 'Konstruer en regulær åttekant med diagonaler.',
        config: {
          STATE: DEFAULT_NKANT_STATE
        }
      }
    ]
  },
  {
    path: '/perlesnor',
    examples: [
      {
        __builtinKey: 'perlesnor-telle-til-20',
        title: 'Tell med perlesnor',
        description: 'Trekk klypa til riktig tall på perlesnoren.',
        config: {
          SIMPLE: DEFAULT_PERLESNOR_SIMPLE
        }
      }
    ]
  },
  {
    path: '/prikktilprikk',
    examples: [
      {
        __builtinKey: 'prikktilprikk-bølge',
        title: 'Prikk til prikk-bølge',
        description: 'Koble punktene i rekkefølge for å lage en bølge.',
        config: {
          STATE: DEFAULT_PRIKKTILPRIKK_STATE
        }
      }
    ]
  },
  {
    path: '/tallinje',
    examples: [
      {
        __builtinKey: 'tallinje-plasser-brok',
        title: 'Plasser brøkene',
        description: 'Dra de tre brøkene til riktig plass på tallinjen.',
        isDefault: true,
        config: {
          STATE: DEFAULT_TALLINJE_STATE
        }
      }
    ]
  },
  {
    path: '/tenkeblokker',
    examples: [
      {
        __builtinKey: 'tenkeblokker-258',
        title: 'Bygg tallet 258',
        description: 'Bruk hundrere, tiere og enere for å bygge tallet 258.',
        config: {
          CONFIG: DEFAULT_TENKEBLOKKER_CONFIG
        }
      }
    ]
  },
  {
    path: '/tenkeblokker-stepper',
    examples: [
      {
        __builtinKey: 'tenkeblokker-stepper-157',
        title: 'Trappetelling til 157',
        description: 'Bruk tre steg for å bygge tallet 157.',
        config: {
          CONFIG: DEFAULT_TENKEBLOKKER_STEPPER_CONFIG
        }
      }
    ]
  },
  {
    path: '/trefigurer',
    examples: [
      {
        __builtinKey: 'trefigurer-sammensatt',
        title: 'Kombinerte figurer',
        description: 'Tegn en trekant og et kvadrat og undersøk egenskapene.',
        config: {
          STATE: DEFAULT_TREFIGURER_STATE
        }
      }
    ]
  }
];

export default DEFAULT_EXAMPLE_ENTRIES;
