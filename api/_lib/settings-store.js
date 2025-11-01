'use strict';

const paletteConfig = require('../../palette/palette-config.js');

const SETTINGS_KEY = 'settings:projects';
const INJECTED_KV_CLIENT_KEY = '__MATH_VISUALS_SETTINGS_KV_CLIENT__';
const MAX_COLORS = paletteConfig.MAX_COLORS;
const MIN_COLOR_SLOTS = paletteConfig.MIN_COLOR_SLOTS;
const DEFAULT_PROJECT = typeof paletteConfig.DEFAULT_PROJECT === 'string' ? paletteConfig.DEFAULT_PROJECT : 'campus';
const GROUPED_PALETTE_ORDER = (Array.isArray(paletteConfig.DEFAULT_GROUP_ORDER)
  ? paletteConfig.DEFAULT_GROUP_ORDER
  : [
      'graftegner',
      'nkant',
      'diagram',
      'fractions',
      'figurtall',
      'arealmodell',
      'tallinje',
      'kvikkbilder',
      'trefigurer',
      'brokvegg',
      'prikktilprikk'
    ])
  .map(value => (typeof value === 'string' ? value.trim().toLowerCase() : ''))
  .filter(Boolean);
const COLOR_GROUP_IDS = Array.isArray(paletteConfig.COLOR_GROUP_IDS)
  ? paletteConfig.COLOR_GROUP_IDS.map(value => (typeof value === 'string' ? value.trim().toLowerCase() : '')).filter(Boolean)
  : GROUPED_PALETTE_ORDER.slice();
const GROUP_SLOT_INDICES = paletteConfig.GROUP_SLOT_INDICES && typeof paletteConfig.GROUP_SLOT_INDICES === 'object'
  ? paletteConfig.GROUP_SLOT_INDICES
  : {};
const GROUP_SLOT_COUNTS = COLOR_GROUP_IDS.reduce((acc, groupId) => {
  const indices = Array.isArray(GROUP_SLOT_INDICES[groupId]) ? GROUP_SLOT_INDICES[groupId] : [];
  acc[groupId] = indices.length;
  return acc;
}, {});
const PROJECT_FALLBACKS = paletteConfig.PROJECT_FALLBACKS;
const DEFAULT_PROJECT_ORDER = Array.isArray(paletteConfig.DEFAULT_PROJECT_ORDER)
  ? paletteConfig.DEFAULT_PROJECT_ORDER.slice()
  : ['campus', 'kikora', 'annet'];

const globalScope = typeof globalThis === 'object' && globalThis ? globalThis : global;
const memoryState = globalScope.__MATH_VISUALS_SETTINGS_STATE__ || {
  value: null,
  updatedAt: null
};

globalScope.__MATH_VISUALS_SETTINGS_STATE__ = memoryState;

let kvClientPromise = null;

class KvOperationError extends Error {
  constructor(message, options) {
    super(message);
    if (options && options.cause) {
      this.cause = options.cause;
    }
    this.code = options && options.code ? options.code : 'KV_OPERATION_FAILED';
  }
}

class KvConfigurationError extends Error {
  constructor(message) {
    super(message);
    this.code = 'KV_NOT_CONFIGURED';
  }
}

function isKvConfigured() {
  return Boolean(process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN);
}

function getStoreMode() {
  return isKvConfigured() ? 'kv' : 'memory';
}

function getInjectedKvClient() {
  return globalScope && globalScope[INJECTED_KV_CLIENT_KEY] ? globalScope[INJECTED_KV_CLIENT_KEY] : null;
}

async function loadKvClient() {
  const injected = getInjectedKvClient();
  if (injected) {
    if (!kvClientPromise || !kvClientPromise.__mathVisualsInjected) {
      const resolved = Promise.resolve(injected).then(client => {
        if (!client) {
          throw new KvOperationError('Injected KV client is not available');
        }
        return client;
      });
      resolved.__mathVisualsInjected = true;
      kvClientPromise = resolved;
    }
    return kvClientPromise;
  }
  if (!isKvConfigured()) {
    throw new KvConfigurationError(
      'Settings storage KV is not configured. Set KV_REST_API_URL and KV_REST_API_TOKEN to enable persistent settings.'
    );
  }
  if (!kvClientPromise) {
    kvClientPromise = import('@vercel/kv')
      .then(mod => {
        if (mod && mod.kv) {
          return mod.kv;
        }
        throw new KvOperationError('Failed to load @vercel/kv client module');
      })
      .catch(error => {
        throw new KvOperationError('Unable to initialize Vercel KV client', { cause: error });
      });
  }
  return kvClientPromise;
}

function sanitizeColor(value) {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  const match = /^#?([0-9a-fA-F]{3,4}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/.exec(trimmed);
  if (!match) return null;
  let hex = match[1].toLowerCase();
  if (hex.length === 3) {
    hex = hex.split('').map(ch => ch + ch).join('');
  } else if (hex.length === 4) {
    const rgb = hex.slice(0, 3).split('');
    hex = rgb.map(ch => ch + ch).join('');
  } else if (hex.length === 8) {
    hex = hex.slice(0, 6);
  }
  return `#${hex}`;
}

function sanitizeColorList(values) {
  if (!Array.isArray(values)) return [];
  const out = [];
  for (const value of values) {
    const sanitized = sanitizeColor(value);
    if (sanitized) {
      out.push(sanitized);
      if (out.length >= MAX_COLORS) {
        break;
      }
    }
  }
  return out;
}

function normalizeProjectKey(value) {
  if (typeof value !== 'string') return '';
  const trimmed = value.trim().toLowerCase();
  return trimmed || '';
}

function normalizeGroupId(value) {
  if (typeof value !== 'string') return '';
  const trimmed = value.trim().toLowerCase();
  return trimmed || '';
}

function sanitizeGroupPaletteList(values, limit) {
  if (!Array.isArray(values)) return [];
  const maxSize = Number.isInteger(limit) && limit >= 0 ? limit : MAX_COLORS;
  const sanitized = [];
  for (const value of values) {
    const clean = sanitizeColor(value);
    if (clean) {
      sanitized.push(clean);
      if (sanitized.length >= maxSize) {
        break;
      }
    }
  }
  return sanitized;
}

function cloneGroupPalettes(source) {
  const result = {};
  if (!source || typeof source !== 'object') {
    return result;
  }
  Object.keys(source).forEach(key => {
    const normalized = normalizeGroupId(key);
    if (!normalized || !COLOR_GROUP_IDS.includes(normalized)) return;
    if (Array.isArray(source[key])) {
      result[normalized] = source[key].slice();
    }
  });
  return result;
}

const FALLBACK_GROUP_PALETTE_CACHE = new Map();

function getFallbackGroupPalettes(projectName) {
  const normalized = normalizeProjectKey(projectName);
  const cacheKey = normalized || '__default__';
  if (FALLBACK_GROUP_PALETTE_CACHE.has(cacheKey)) {
    return cloneGroupPalettes(FALLBACK_GROUP_PALETTE_CACHE.get(cacheKey));
  }
  const fallbackBase = sanitizeColorList(
    PROJECT_FALLBACKS[normalized] || PROJECT_FALLBACKS.default || []
  );
  const colors = fallbackBase.length ? fallbackBase : sanitizeColorList(PROJECT_FALLBACKS.default);
  const groups = {};
  let cursor = 0;
  COLOR_GROUP_IDS.forEach(groupId => {
    const limit = GROUP_SLOT_COUNTS[groupId] || 0;
    const groupColors = [];
    if (limit > 0) {
      for (let index = 0; index < limit; index += 1) {
        const color = colors[cursor] || colors[index % (colors.length || 1)] || null;
        if (color) {
          groupColors.push(color);
        }
        if (cursor < colors.length) {
          cursor += 1;
        }
      }
    }
    groups[groupId] = groupColors;
  });
  FALLBACK_GROUP_PALETTE_CACHE.set(cacheKey, cloneGroupPalettes(groups));
  return cloneGroupPalettes(groups);
}

function applyGroupPaletteOverlay(target, source) {
  if (!target || typeof target !== 'object' || !source || typeof source !== 'object') {
    return;
  }
  const normalizedSource = {};
  Object.keys(source).forEach(key => {
    const normalized = normalizeGroupId(key);
    if (!normalized) return;
    normalizedSource[normalized] = source[key];
  });
  COLOR_GROUP_IDS.forEach(groupId => {
    const limit = GROUP_SLOT_COUNTS[groupId] || 0;
    if (!limit) return;
    const incoming = sanitizeGroupPaletteList(normalizedSource[groupId], limit);
    if (!incoming.length) return;
    const existing = Array.isArray(target[groupId]) ? target[groupId].slice() : [];
    const merged = [];
    for (let index = 0; index < limit; index += 1) {
      const color = incoming[index] || existing[index];
      if (color) {
        merged.push(color);
      }
    }
    while (merged.length < limit) {
      const fallback = existing[merged.length] || existing[0] || null;
      if (fallback) {
        merged.push(fallback);
      } else {
        break;
      }
    }
    target[groupId] = merged;
  });
}

function distributeFlatPaletteToGroups(palette) {
  const sanitized = sanitizeColorList(palette);
  const result = {};
  let cursor = 0;
  COLOR_GROUP_IDS.forEach(groupId => {
    const limit = GROUP_SLOT_COUNTS[groupId] || 0;
    if (!limit) {
      result[groupId] = [];
      return;
    }
    const groupColors = [];
    for (let index = 0; index < limit && cursor < sanitized.length; index += 1) {
      groupColors.push(sanitized[cursor]);
      cursor += 1;
    }
    result[groupId] = groupColors;
  });
  return result;
}

function normalizeProjectGroupPalettes(projectName, palette) {
  const base = getFallbackGroupPalettes(projectName);
  if (Array.isArray(palette)) {
    applyGroupPaletteOverlay(base, distributeFlatPaletteToGroups(palette));
    return base;
  }
  if (palette && typeof palette === 'object') {
    if (Array.isArray(palette.defaultColors)) {
      applyGroupPaletteOverlay(base, distributeFlatPaletteToGroups(palette.defaultColors));
    } else if (palette.defaultColors && typeof palette.defaultColors === 'object') {
      applyGroupPaletteOverlay(base, palette.defaultColors);
    }
    if (palette.groupPalettes && typeof palette.groupPalettes === 'object') {
      applyGroupPaletteOverlay(base, palette.groupPalettes);
    } else {
      applyGroupPaletteOverlay(base, palette);
    }
    return base;
  }
  return base;
}

function flattenProjectPalette(palette) {
  if (!palette) return [];
  if (Array.isArray(palette)) {
    return sanitizeColorList(palette);
  }
  if (typeof palette !== 'object') {
    return [];
  }
  const source = palette.groupPalettes && typeof palette.groupPalettes === 'object' ? palette.groupPalettes : palette;
  const normalizedGroups = {};
  Object.keys(source).forEach(key => {
    const normalizedKey = normalizeGroupId(key);
    if (!normalizedKey) return;
    normalizedGroups[normalizedKey] = source[key];
  });
  const flattened = [];
  for (const groupId of GROUPED_PALETTE_ORDER) {
    if (flattened.length >= MAX_COLORS) break;
    const normalizedGroup = normalizeGroupId(groupId);
    if (!normalizedGroup || !COLOR_GROUP_IDS.includes(normalizedGroup)) continue;
    const limit = GROUP_SLOT_COUNTS[normalizedGroup] || 0;
    if (!limit) continue;
    const values = Array.isArray(normalizedGroups[normalizedGroup])
      ? sanitizeGroupPaletteList(normalizedGroups[normalizedGroup], limit || MAX_COLORS)
      : [];
    for (const value of values) {
      if (flattened.length >= MAX_COLORS) break;
      flattened.push(value);
    }
  }
  return flattened;
}

function expandPalette(projectName, palette) {
  const normalizedProject = normalizeProjectKey(projectName) || DEFAULT_PROJECT;
  const groupPalettes = normalizeProjectGroupPalettes(normalizedProject, palette);
  const flattened = flattenProjectPalette({ groupPalettes });
  const sanitized = sanitizeColorList(flattened);
  const fallbackBase = sanitizeColorList(
    PROJECT_FALLBACKS[normalizedProject] || PROJECT_FALLBACKS.default || []
  );
  const fallback = fallbackBase.length ? fallbackBase : sanitizeColorList(PROJECT_FALLBACKS.default);
  const limit = Math.min(MAX_COLORS, Math.max(MIN_COLOR_SLOTS, sanitized.length, fallback.length || 0));
  const result = [];
  for (let index = 0; index < limit; index += 1) {
    const fallbackColor = fallback[index % (fallback.length || 1)] || fallback[0] || null;
    const color = sanitized[index] || fallbackColor || PROJECT_FALLBACKS.default[0];
    result.push(color);
  }
  if (!result.length) {
    result.push(PROJECT_FALLBACKS.default[0]);
  }
  return result;
}

function resolveProjectName(name, projects) {
  const available = projects && typeof projects === 'object' ? projects : null;
  if (typeof name === 'string' && name) {
    const normalized = name.trim().toLowerCase();
    if (normalized && available && available[normalized]) {
      return normalized;
    }
  }
  if (available && available[DEFAULT_PROJECT]) {
    return DEFAULT_PROJECT;
  }
  if (available) {
    const keys = Object.keys(available);
    if (keys.length) {
      return keys[0];
    }
  }
  return DEFAULT_PROJECT;
}

function buildDefaultProjects() {
  const projects = {};
  Object.keys(PROJECT_FALLBACKS).forEach(name => {
    if (name === 'default') return;
    const groupPalettes = getFallbackGroupPalettes(name);
    projects[name] = {
      groupPalettes,
      defaultColors: expandPalette(name, { groupPalettes })
    };
  });
  return projects;
}

function normalizeSettings(value) {
  const input = value && typeof value === 'object' ? value : {};
  const inputProjects = input.projects && typeof input.projects === 'object' ? input.projects : null;
  const projects = buildDefaultProjects();
  const order = DEFAULT_PROJECT_ORDER.slice();

  if (inputProjects) {
    Object.keys(inputProjects).forEach(name => {
      const normalized = typeof name === 'string' ? name.trim().toLowerCase() : '';
      if (!normalized) return;
      const source = inputProjects[name];
      const normalizedGroupPalettes = normalizeProjectGroupPalettes(normalized, source);
      const baseTarget = projects[normalized] ? projects[normalized] : {};
      const groupPalettes = cloneGroupPalettes(normalizedGroupPalettes);
      const defaultColors = expandPalette(normalized, { groupPalettes });
      const updated = {
        ...baseTarget,
        groupPalettes,
        defaultColors
      };
      projects[normalized] = updated;
      if (!order.includes(normalized)) {
        order.push(normalized);
      }
    });
  }

  if (input.defaultColors != null) {
    const projectName = resolveProjectName(input.activeProject || input.project || input.defaultProject, projects);
    const normalizedGroupPalettes = normalizeProjectGroupPalettes(projectName, input.defaultColors);
    const groupPalettes = cloneGroupPalettes(normalizedGroupPalettes);
    const defaultColors = expandPalette(projectName, { groupPalettes });
    projects[projectName] = {
      ...projects[projectName],
      groupPalettes,
      defaultColors
    };
    if (!order.includes(projectName)) {
      order.push(projectName);
    }
  }

  const activeProject = resolveProjectName(input.activeProject || input.project || input.defaultProject, projects);
  const normalized = {
    version: 1,
    projects,
    activeProject,
    projectOrder: order,
    updatedAt: new Date().toISOString()
  };

  const active = projects[activeProject];
  const palette = expandPalette(
    activeProject,
    active && active.groupPalettes ? { groupPalettes: active.groupPalettes } : PROJECT_FALLBACKS.default
  );
  normalized.defaultColors = palette;
  return normalized;
}

const DEFAULT_SETTINGS = normalizeSettings({});

function cloneSettings(settings) {
  if (!settings || typeof settings !== 'object') {
    return normalizeSettings({});
  }
  try {
    return JSON.parse(JSON.stringify(settings));
  } catch (_) {
    return normalizeSettings(settings);
  }
}

async function readStoredSettings() {
  if (getStoreMode() === 'kv') {
    try {
      const kv = await loadKvClient();
      const raw = await kv.get(SETTINGS_KEY);
      if (!raw) return null;
      if (typeof raw === 'string') {
        return JSON.parse(raw);
      }
      if (typeof raw === 'object') {
        return raw;
      }
      return null;
    } catch (error) {
      if (error instanceof KvConfigurationError) {
        return null;
      }
      throw error;
    }
  }
  return memoryState.value ? cloneSettings(memoryState.value) : null;
}

async function writeStoredSettings(next) {
  const payload = cloneSettings(next);
  if (getStoreMode() === 'kv') {
    const kv = await loadKvClient();
    await kv.set(SETTINGS_KEY, payload);
    return;
  }
  memoryState.value = payload;
  memoryState.updatedAt = payload && payload.updatedAt ? payload.updatedAt : new Date().toISOString();
}

async function getSettings() {
  try {
    const stored = await readStoredSettings();
    if (stored) {
      return normalizeSettings(stored);
    }
  } catch (error) {
    if (!(error instanceof KvConfigurationError)) {
      throw error;
    }
  }
  return cloneSettings(DEFAULT_SETTINGS);
}

async function setSettings(next) {
  const normalized = normalizeSettings(next);
  normalized.updatedAt = new Date().toISOString();
  await writeStoredSettings(normalized);
  return normalized;
}

async function resetSettings() {
  const normalized = cloneSettings(DEFAULT_SETTINGS);
  normalized.updatedAt = new Date().toISOString();
  await writeStoredSettings(normalized);
  return normalized;
}

module.exports = {
  DEFAULT_SETTINGS,
  MAX_COLORS,
  PROJECT_FALLBACKS,
  getSettings,
  setSettings,
  resetSettings,
  getStoreMode,
  sanitizeColor,
  sanitizeColorList,
  flattenProjectPalette,
  normalizeSettings,
  resolveProjectName,
  KvOperationError,
  KvConfigurationError
};
