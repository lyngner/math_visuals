'use strict';

const path = require('path');
const { pathToFileURL } = require('url');
const {
  normalizePath,
  setMemoryEntry
} = require('../../api/_lib/examples-store');

const defaultsModuleUrl = pathToFileURL(
  path.resolve(__dirname, '../../scripts/default-example-entries.mjs')
).href;

let cachedDefaultsPromise = null;

function deepClone(value) {
  if (value === undefined) return undefined;
  try {
    return JSON.parse(JSON.stringify(value));
  } catch (error) {
    return value;
  }
}

async function loadDefaultExampleEntries() {
  if (!cachedDefaultsPromise) {
    cachedDefaultsPromise = import(defaultsModuleUrl)
      .then(mod => {
        const raw = mod && (mod.DEFAULT_EXAMPLE_ENTRIES || mod.default);
        if (!Array.isArray(raw)) {
          return [];
        }
        return raw
          .map(entry => {
            const normalizedPath = normalizePath(entry && entry.path);
            if (!normalizedPath) return null;
            const examples = Array.isArray(entry.examples) ? deepClone(entry.examples) : [];
            const deletedProvided = Array.isArray(entry.deletedProvided)
              ? deepClone(entry.deletedProvided)
              : [];
            const provided = Array.isArray(entry.provided) ? deepClone(entry.provided) : [];
            return {
              path: normalizedPath,
              examples,
              deletedProvided,
              provided
            };
          })
          .filter(Boolean);
      })
      .catch(() => []);
  }
  const entries = await cachedDefaultsPromise;
  return entries.map(entry => ({
    path: entry.path,
    examples: deepClone(entry.examples) || [],
    deletedProvided: deepClone(entry.deletedProvided) || [],
    provided: Array.isArray(entry.provided) ? deepClone(entry.provided) : []
  }));
}

async function seedDefaultExampleEntries(options = {}) {
  const entries = await loadDefaultExampleEntries();
  const apply = typeof options.apply === 'function' ? options.apply : defaultApply;
  const results = [];
  for (const entry of entries) {
    const payload = {
      examples: deepClone(entry.examples) || [],
      deletedProvided: deepClone(entry.deletedProvided) || [],
      provided: Array.isArray(entry.provided) ? deepClone(entry.provided) : []
    };
    const result = await apply(entry.path, payload, entry);
    results.push({ path: entry.path, payload, result });
  }
  return results;
}

function defaultApply(path, payload) {
  const { examples, deletedProvided } = payload;
  return setMemoryEntry(path, { examples, deletedProvided });
}

module.exports = {
  loadDefaultExampleEntries,
  seedDefaultExampleEntries
};
