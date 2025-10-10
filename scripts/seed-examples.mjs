#!/usr/bin/env node
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const {
  setEntry,
  normalizePath,
  isKvConfigured
} = require('../api/_lib/examples-store');

const DEFAULT_TALLINJE_STATE = {
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

const DEFAULT_ENTRIES = [
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

async function seedEntry(entry) {
  const payload = {
    examples: Array.isArray(entry.examples) ? entry.examples : [],
    deletedProvided: Array.isArray(entry.deletedProvided) ? entry.deletedProvided : []
  };
  if (entry.updatedAt) {
    payload.updatedAt = entry.updatedAt;
  }
  const stored = await setEntry(entry.path, payload);
  const normalized = normalizePath(entry.path);
  console.log(`Seeded ${normalized || entry.path}`);
  return stored;
}

async function main() {
  if (!isKvConfigured()) {
    throw new Error('Examples KV client is not configured. Set KV_REST_API_URL and KV_REST_API_TOKEN before seeding.');
  }

  for (const entry of DEFAULT_ENTRIES) {
    await seedEntry(entry);
  }
}

main().catch(error => {
  console.error('[seed-examples] Failed to seed examples');
  if (error && error.message) {
    console.error(error.message);
  } else {
    console.error(error);
  }
  process.exitCode = 1;
});
