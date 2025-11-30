import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createRequire } from 'node:module';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const require = createRequire(import.meta.url);
const storeModulePath = require.resolve('../../api/_lib/figure-library-store.js');
const originalCacheEntry = require.cache[storeModulePath];

const ensureCategoryCalls = [];
const setFigureCalls = [];

require.cache[storeModulePath] = {
  id: storeModulePath,
  filename: storeModulePath,
  loaded: true,
  exports: {
    ensureCategory: async (payload) => {
      ensureCategoryCalls.push(payload);
    },
    setFigure: async (slug, payload) => {
      setFigureCalls.push({ slug, payload });
    }
  }
};

try {
  const scriptUrl = pathToFileURL(path.resolve(__dirname, '../../scripts/seed-figure-library.mjs'));
  const { seedFigures } = await import(scriptUrl.href);

  const result = await seedFigures({ dryRun: false });

  assert.ok(ensureCategoryCalls.length > 0, 'Forventet minst ett ensureCategory-kall');
  assert.ok(setFigureCalls.length > 0, 'Forventet minst ett setFigure-kall');

  const tierbrettCategory = ensureCategoryCalls.find((entry) => entry.id === 'tierbrett');
  assert.ok(tierbrettCategory, 'Fant ikke mengdekategorien «tierbrett»');
  assert.equal(tierbrettCategory.type, 'amount', 'Mengdekategorier skal markeres med type=amount');
  assert.equal(tierbrettCategory.label, 'Tierbrett');

  const measurementCategories = ensureCategoryCalls.filter((entry) => entry.type === 'measurement');
  assert.equal(measurementCategories.length, 0, 'Forventet ingen forhåndsbundne målekategorier');

  const tierbrettFigureCall = setFigureCalls.find((entry) => entry.slug === 'tb1');
  assert.ok(tierbrettFigureCall, 'Forventet at minst én tierbrett-figur blir skrevet');
  assert.equal(tierbrettFigureCall.payload.category.id, 'tierbrett');
  assert.match(tierbrettFigureCall.payload.svg, /^<svg[^>]*>/, 'SVG-markup mangler i payloaden');

  assert.equal(
    result.categories.ensured,
    ensureCategoryCalls.length,
    'Antall kategorier i returverdien skal samsvare med antall ensureCategory-kall'
  );
  assert.equal(
    result.figures.seeded,
    setFigureCalls.length,
    'Antall figurer i returverdien skal samsvare med antall setFigure-kall'
  );

  console.log('seed-figure-library seeding test passed');
} finally {
  if (originalCacheEntry) {
    require.cache[storeModulePath] = originalCacheEntry;
  } else {
    delete require.cache[storeModulePath];
  }
}
