#!/usr/bin/env node
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const {
  setEntry,
  normalizePath,
  isKvConfigured
} = require('../api/_lib/examples-store');

const DEFAULT_EXAMPLE_ENTRIES = [];

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

  if (DEFAULT_EXAMPLE_ENTRIES.length === 0) {
    console.log('No bundled example entries to seed.');
    return;
  }

  for (const entry of DEFAULT_EXAMPLE_ENTRIES) {
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
