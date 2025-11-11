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

  const prehistoricCategory = ensureCategoryCalls.find((entry) => entry.id === 'prehistoric-animals');
  assert.ok(prehistoricCategory, 'Fant ikke measurement-kategorien «prehistoric-animals»');
  assert.equal(prehistoricCategory.type, 'measurement', 'Measurement-kategorier skal markeres med type=measurement');

  const tierbrettCategory = ensureCategoryCalls.find((entry) => entry.id === 'tierbrett');
  assert.ok(tierbrettCategory, 'Fant ikke mengdekategorien «tierbrett»');
  assert.equal(tierbrettCategory.type, 'amount', 'Mengdekategorier skal markeres med type=amount');
  assert.equal(tierbrettCategory.label, 'Tierbrett');

  const allosaurusCall = setFigureCalls.find((entry) => entry.slug === 'allosaurus');
  assert.ok(allosaurusCall, 'Forventet at figuren «allosaurus» blir skrevet');
  assert.equal(allosaurusCall.payload.name, 'Allosaurus');
  assert.ok(
    allosaurusCall.payload.summary.startsWith('12 m × 4,32 m'),
    'Sammendraget skal inkludere målangivelsen først'
  );
  assert.equal(allosaurusCall.payload.category.id, 'prehistoric-animals');
  assert.equal(allosaurusCall.payload.category.label, 'Forhistoriske dyr');
  assert.match(allosaurusCall.payload.svg, /^<svg[^>]*>/, 'SVG-markup mangler i payloaden');

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
