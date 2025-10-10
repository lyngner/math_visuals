'use strict';

const {
  normalizePath,
  getMemoryEntry,
  setMemoryEntry,
  listMemoryEntries
} = require('./examples-store');

let cachedDefaults = null;
let loadingPromise = null;

function cloneData(value) {
  if (typeof globalThis.structuredClone === 'function') {
    try {
      return globalThis.structuredClone(value);
    } catch (_) {}
  }
  try {
    return JSON.parse(JSON.stringify(value));
  } catch (_) {
    return value;
  }
}

function normalizeDeletedProvided(list) {
  if (!Array.isArray(list)) return [];
  const seen = new Set();
  const out = [];
  for (const value of list) {
    if (typeof value !== 'string') continue;
    const trimmed = value.trim();
    if (!trimmed || seen.has(trimmed)) continue;
    seen.add(trimmed);
    out.push(trimmed);
  }
  return out;
}

function normalizeExamples(examples) {
  if (!Array.isArray(examples)) return [];
  const normalized = [];
  for (const item of examples) {
    if (!item || typeof item !== 'object') continue;
    normalized.push(cloneData(item));
  }
  return normalized;
}

function normalizeEntry(entry) {
  if (!entry || typeof entry !== 'object') return null;
  const normalizedPath = normalizePath(entry.path);
  if (!normalizedPath) return null;
  const examples = normalizeExamples(entry.examples);
  const deletedProvided = normalizeDeletedProvided(entry.deletedProvided);
  return {
    path: normalizedPath,
    examples,
    deletedProvided
  };
}

function cloneDefaultEntry(entry) {
  if (!entry) return null;
  return {
    path: entry.path,
    examples: normalizeExamples(entry.examples),
    deletedProvided: normalizeDeletedProvided(entry.deletedProvided)
  };
}

function cloneDefaultEntries(entries) {
  if (!Array.isArray(entries)) return [];
  return entries.map(entry => cloneDefaultEntry(entry)).filter(Boolean);
}

async function importDefaultEntriesModule() {
  const module = await import('../../scripts/default-example-entries.mjs');
  if (module && Array.isArray(module.DEFAULT_EXAMPLE_ENTRIES)) {
    return module.DEFAULT_EXAMPLE_ENTRIES;
  }
  if (module && Array.isArray(module.default)) {
    return module.default;
  }
  return [];
}

async function loadDefaultExampleEntries() {
  if (cachedDefaults) {
    return cloneDefaultEntries(cachedDefaults);
  }
  if (!loadingPromise) {
    loadingPromise = importDefaultEntriesModule()
      .then(rawEntries => {
        const map = new Map();
        if (Array.isArray(rawEntries)) {
          for (const entry of rawEntries) {
            const normalized = normalizeEntry(entry);
            if (!normalized) continue;
            if (map.has(normalized.path)) continue;
            map.set(normalized.path, normalized);
          }
        }
        cachedDefaults = Array.from(map.values());
        return cachedDefaults;
      })
      .finally(() => {
        loadingPromise = null;
      });
  }
  const resolved = await loadingPromise;
  return cloneDefaultEntries(resolved || cachedDefaults);
}

async function seedMemoryDefaults() {
  const existingEntries = listMemoryEntries();
  const entriesByPath = new Map();
  const ordered = [];
  for (const entry of existingEntries) {
    const normalizedPath = normalizePath(entry.path);
    if (!normalizedPath || entriesByPath.has(normalizedPath)) continue;
    entriesByPath.set(normalizedPath, entry);
    ordered.push(entry);
  }
  const defaults = await loadDefaultExampleEntries();
  for (const entry of defaults) {
    const normalizedPath = normalizePath(entry.path);
    if (!normalizedPath || entriesByPath.has(normalizedPath)) continue;
    const stored = setMemoryEntry(normalizedPath, {
      examples: entry.examples,
      deletedProvided: entry.deletedProvided
    });
    if (stored) {
      entriesByPath.set(normalizedPath, stored);
      ordered.push(stored);
    }
  }
  return ordered;
}

async function ensureMemoryEntry(path) {
  const normalizedPath = normalizePath(path);
  if (!normalizedPath) return null;
  const existing = getMemoryEntry(normalizedPath);
  if (existing) {
    return existing;
  }
  const defaults = await loadDefaultExampleEntries();
  const match = defaults.find(entry => entry.path === normalizedPath);
  if (!match) {
    return null;
  }
  const stored = setMemoryEntry(normalizedPath, {
    examples: match.examples,
    deletedProvided: match.deletedProvided
  });
  return stored;
}

module.exports = {
  loadDefaultExampleEntries,
  seedMemoryDefaults,
  ensureMemoryEntry
};
