'use strict';

const { normalizePath } = require('./examples-store');

let cachedDefaultsPromise = null;

function toArray(value) {
  if (Array.isArray(value)) return value;
  return [];
}

function cloneExamples(items) {
  return toArray(items)
    .map(item => (item && typeof item === 'object' ? { ...item } : item))
    .filter(item => item != null);
}

async function loadDefaultExampleEntries() {
  if (!cachedDefaultsPromise) {
    cachedDefaultsPromise = import('../../scripts/default-example-entries.mjs')
      .then(mod => {
        const entries = Array.isArray(mod?.DEFAULT_EXAMPLE_ENTRIES)
          ? mod.DEFAULT_EXAMPLE_ENTRIES
          : Array.isArray(mod?.default)
            ? mod.default
            : [];
        const normalized = [];
        const seen = new Set();
        for (const entry of entries) {
          if (!entry || typeof entry !== 'object') continue;
          const normalizedPath = normalizePath(entry.path);
          if (!normalizedPath || seen.has(normalizedPath)) continue;
          seen.add(normalizedPath);
          normalized.push({
            path: normalizedPath,
            examples: cloneExamples(entry.examples),
            deletedProvided: toArray(entry.deletedProvided).filter(value => typeof value === 'string' && value.trim())
          });
        }
        return normalized;
      });
  }
  const defaults = await cachedDefaultsPromise;
  return defaults.map(entry => ({
    path: entry.path,
    examples: cloneExamples(entry.examples),
    deletedProvided: entry.deletedProvided.slice()
  }));
}

module.exports = {
  loadDefaultExampleEntries
};
