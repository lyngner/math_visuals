#!/usr/bin/env node
import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const {
  normalizePath,
  setEntry,
  deleteEntry,
  listEntries,
  setTrashEntries,
  getTrashEntries,
  isKvConfigured,
  KvConfigurationError,
} = require('../api/_lib/examples-store');

const REQUIRED_ENV_KEYS = ['REDIS_ENDPOINT', 'REDIS_PORT', 'REDIS_PASSWORD'];
const DEFAULT_DATASET_PATH = path.resolve(process.cwd(), 'docs/examples-seed.json');
const SAMPLE_DATASET_PATH = path.resolve(process.cwd(), 'docs/examples-seed.sample.json');

function printUsage() {
  console.log(`Bruk: npm run seed-examples [-- --input=fil.json] [--dry-run] [--clear] [--skip-trash]`);
  console.log('');
  console.log('Flagg:');
  console.log('  --input=fil      Velg en annen JSON-fil (standard: docs/examples-seed.json).');
  console.log('  --dry-run        Viser hva som ville blitt skrevet uten å kontakte Redis.');
  console.log('  --clear          Sletter alle eksisterende eksempler og søppel før seeding.');
  console.log('  --skip-trash     Hopper over søppelbøtta i datasettet.');
  console.log('  -h, --help       Viser denne hjelpen.');
}

function parseArgs(argv) {
  const options = {
    input: DEFAULT_DATASET_PATH,
    dryRun: false,
    clear: false,
    skipTrash: false,
  };
  for (const arg of argv) {
    if (arg === '--') {
      continue;
    }
    if (arg === '--dry-run') {
      options.dryRun = true;
      continue;
    }
    if (arg === '--clear') {
      options.clear = true;
      continue;
    }
    if (arg === '--skip-trash') {
      options.skipTrash = true;
      continue;
    }
    if (arg === '--help' || arg === '-h') {
      options.help = true;
      continue;
    }
    if (arg.startsWith('--input=')) {
      const candidate = arg.slice('--input='.length).trim();
      if (candidate) {
        options.input = path.resolve(process.cwd(), candidate);
      }
      continue;
    }
    console.error(`Ukjent flagg: ${arg}`);
    options.help = true;
    options.invalidFlag = true;
    break;
  }
  return options;
}

async function fileExists(targetPath) {
  try {
    await fs.access(targetPath);
    return true;
  } catch (error) {
    return false;
  }
}

function ensureRedisEnv() {
  const missing = REQUIRED_ENV_KEYS.filter(key => !process.env[key]);
  if (missing.length > 0) {
    throw new Error(
      `Mangler miljøvariabler: ${missing.join(', ')}. Sett verdiene fra infra/data-stacken før du seed-er.`,
    );
  }
  if (!isKvConfigured()) {
    throw new KvConfigurationError(
      'Examples KV is not configured. Set REDIS_ENDPOINT, REDIS_PORT og REDIS_PASSWORD for å aktivere seeding.',
    );
  }
}

function normalizeEntryRecord(record) {
  if (!record || typeof record !== 'object') {
    return null;
  }
  const pathCandidate = record.path || record.canonicalPath || record.key || record.storagePath;
  const normalizedPath = normalizePath(pathCandidate);
  if (!normalizedPath) {
    return null;
  }
  const examples = Array.isArray(record.examples) ? record.examples : [];
  const deletedProvided = Array.isArray(record.deletedProvided) ? record.deletedProvided : [];
  const payload = {
    examples,
    deletedProvided,
  };
  if (typeof record.updatedAt === 'string' && record.updatedAt.trim()) {
    payload.updatedAt = record.updatedAt;
  }
  if (typeof record.mode === 'string') {
    payload.mode = record.mode;
  }
  if (typeof record.storage === 'string') {
    payload.storage = record.storage;
  }
  if (record.metadata && typeof record.metadata === 'object') {
    payload.metadata = record.metadata;
  }
  return { path: normalizedPath, payload };
}

function coerceEntryList(dataset) {
  if (!dataset) return [];
  if (Array.isArray(dataset.entries)) {
    return dataset.entries;
  }
  if (Array.isArray(dataset)) {
    return dataset;
  }
  const reservedKeys = new Set(['version', 'generatedAt', 'trash']);
  if (dataset && typeof dataset === 'object') {
    const directPaths = Object.keys(dataset).filter(key => !reservedKeys.has(key));
    if (directPaths.length > 0) {
      return directPaths.map(pathKey => ({ path: pathKey, ...dataset[pathKey] }));
    }
  }
  return [];
}

function coerceTrashList(dataset) {
  if (!dataset) return [];
  if (Array.isArray(dataset.trash)) {
    return dataset.trash;
  }
  if (Array.isArray(dataset.trashEntries)) {
    return dataset.trashEntries;
  }
  return [];
}

async function loadDataset(datasetPath) {
  const contents = await fs.readFile(datasetPath, 'utf8');
  let parsed;
  try {
    parsed = JSON.parse(contents);
  } catch (error) {
    throw new Error(`Kunne ikke lese JSON fra ${datasetPath}: ${error.message}`);
  }
  const rawEntries = coerceEntryList(parsed);
  const rawTrash = coerceTrashList(parsed);
  const entryMap = new Map();
  rawEntries.forEach(record => {
    const normalized = normalizeEntryRecord(record);
    if (!normalized) {
      return;
    }
    entryMap.set(normalized.path, normalized.payload);
  });
  return {
    entries: Array.from(entryMap.entries()).map(([path, payload]) => ({ path, payload })),
    trash: Array.isArray(rawTrash) ? rawTrash.filter(item => item && typeof item === 'object') : [],
  };
}

async function clearExistingData({ dryRun }) {
  const existingEntries = await listEntries();
  const existingTrash = await getTrashEntries();
  let clearedEntries = 0;
  for (const entry of existingEntries) {
    const targetPath = normalizePath(entry && entry.path);
    if (!targetPath) continue;
    clearedEntries += 1;
    if (dryRun) {
      console.log(`[dry-run] Sletter ${targetPath}`);
      continue;
    }
    await deleteEntry(targetPath);
  }
  if (existingTrash.length > 0) {
    if (dryRun) {
      console.log(`[dry-run] Tømmer ${existingTrash.length} søppeloppføring(er)`);
    } else {
      await setTrashEntries([]);
    }
  }
  return { clearedEntries, clearedTrash: existingTrash.length };
}

async function seedEntries(entries, { dryRun }) {
  let written = 0;
  for (const entry of entries) {
    const { path: entryPath, payload } = entry;
    const exampleCount = Array.isArray(payload.examples) ? payload.examples.length : 0;
    if (dryRun) {
      console.log(`[dry-run] Vil skrive ${entryPath} (${exampleCount} eksempel(er))`);
      written += 1;
      continue;
    }
    await setEntry(entryPath, payload);
    console.log(`✅ Lagret ${entryPath} (${exampleCount} eksempel(er))`);
    written += 1;
  }
  return written;
}

async function seedTrash(trashEntries, { dryRun, skipTrash }) {
  if (skipTrash || trashEntries.length === 0) {
    return 0;
  }
  if (dryRun) {
    console.log(`[dry-run] Vil skrive ${trashEntries.length} søppeloppføring(er)`);
    return trashEntries.length;
  }
  const sanitized = await setTrashEntries(trashEntries);
  console.log(`♻️  Oppdaterte søppelarkivet med ${sanitized.length} oppføring(er)`);
  return sanitized.length;
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  if (options.help) {
    printUsage();
    process.exitCode = options.invalidFlag ? 1 : 0;
    return;
  }

  ensureRedisEnv();

  const datasetPath = options.input;
  const datasetExists = await fileExists(datasetPath);
  if (!datasetExists) {
    const sampleHint = await fileExists(SAMPLE_DATASET_PATH)
      ? ` Kopier ${path.relative(process.cwd(), SAMPLE_DATASET_PATH)} til ${path.relative(process.cwd(), datasetPath)} og fyll inn eksporterte eksempler.`
      : '';
    throw new Error(`Fant ikke dataset ${datasetPath}.${sampleHint}`);
  }

  const dataset = await loadDataset(datasetPath);
  if (dataset.entries.length === 0 && dataset.trash.length === 0) {
    console.log(`Datasettet ${datasetPath} er tomt. Ingenting å gjøre.`);
    return;
  }

  if (options.clear) {
    const cleared = await clearExistingData({ dryRun: options.dryRun });
    console.log(
      `Ryddet bort ${cleared.clearedEntries} eksisterende oppføring(er) og ${cleared.clearedTrash} søppeloppføring(er) før seeding.`,
    );
  }

  const writtenCount = await seedEntries(dataset.entries, { dryRun: options.dryRun });
  const trashCount = await seedTrash(dataset.trash, { dryRun: options.dryRun, skipTrash: options.skipTrash });

  console.log('');
  if (options.dryRun) {
    console.log(`Tørrkjøring ferdig – ${writtenCount} oppføring(er) og ${trashCount} søppeloppføring(er) ville blitt skrevet.`);
  } else {
    console.log(`Ferdig – ${writtenCount} oppføring(er) lagret og ${trashCount} søppeloppføring(er) synkronisert.`);
  }
}

main().catch(error => {
  console.error('❌ Seeding feilet.');
  console.error(error && error.message ? error.message : error);
  process.exitCode = 1;
});
