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

export const DEFAULT_EXAMPLE_ENTRIES = [
  { path: '/arealmodell', examples: [] },
  { path: '/arealmodell0', examples: [] },
  { path: '/arealmodellen1', examples: [] },
  { path: '/brøkfigurer', examples: [] },
  { path: '/brøkpizza', examples: [] },
  { path: '/brøkvegg', examples: [] },
  { path: '/diagram', examples: [] },
  { path: '/examples-trash', examples: [] },
  { path: '/figurtall', examples: [] },
  { path: '/fortegnsskjema', examples: [] },
  { path: '/graftegner', examples: [] },
  { path: '/kuler', examples: [] },
  { path: '/kvikkbilder', examples: [] },
  { path: '/kvikkbilder-monster', examples: [] },
  { path: '/nkant', examples: [] },
  { path: '/perlesnor', examples: [] },
  { path: '/prikktilprikk', examples: [] },
  {
    path: '/tallinje',
    examples: [
      {
        title: 'Plasser brøkene',
        description: 'Dra de tre brøkene til riktig plass på tallinjen.',
        isDefault: true,
        config: {
          STATE: DEFAULT_TALLINJE_STATE
        }
      }
    ]
  },
  { path: '/tenkeblokker', examples: [] },
  { path: '/tenkeblokker-stepper', examples: [] },
  { path: '/trefigurer', examples: [] }
];

export default DEFAULT_EXAMPLE_ENTRIES;
