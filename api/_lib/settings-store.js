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
const COLOR_SLOT_GROUPS = Array.isArray(paletteConfig.COLOR_SLOT_GROUPS)
  ? paletteConfig.COLOR_SLOT_GROUPS.map(group => ({
      groupId: typeof group.groupId === 'string' ? group.groupId.trim().toLowerCase() : '',
      slots: Array.isArray(group.slots)
        ? group.slots.map((slot, slotIndex) => ({
            index: Number.isInteger(slot && slot.index) ? Number(slot.index) : slotIndex,
            groupId:
              slot && typeof slot.groupId === 'string'
                ? slot.groupId.trim().toLowerCase()
                : typeof group.groupId === 'string'
                ? group.groupId.trim().toLowerCase()
                : '',
            groupIndex: Number.isInteger(slot && slot.groupIndex) ? Number(slot.groupIndex) : slotIndex
          }))
        : []
    }))
  : COLOR_GROUP_IDS.map(groupId => ({ groupId, slots: [] }));
const GROUP_SLOT_INDICES = paletteConfig.GROUP_SLOT_INDICES && typeof paletteConfig.GROUP_SLOT_INDICES === 'object'
  ? paletteConfig.GROUP_SLOT_INDICES
  : {};
const GROUP_SLOT_COUNTS = COLOR_GROUP_IDS.reduce((acc, groupId) => {
  const indices = Array.isArray(GROUP_SLOT_INDICES[groupId]) ? GROUP_SLOT_INDICES[groupId] : [];
  acc[groupId] = indices.length;
  return acc;
}, {});
const PROJECT_FALLBACKS = paletteConfig.PROJECT_FALLBACKS;
const GRAFTEGNER_AXIS_DEFAULTS = paletteConfig.GRAFTEGNER_AXIS_DEFAULTS || {};
const DEFAULT_PROJECT_ORDER = Array.isArray(paletteConfig.DEFAULT_PROJECT_ORDER)
  ? paletteConfig.DEFAULT_PROJECT_ORDER.slice()
  : ['campus', 'kikora', 'annet'];
const PROJECT_FALLBACK_CACHE = new Map();
const PROJECT_FALLBACK_GROUP_CACHE = new Map();

const SLOT_META_BY_INDEX = new Map();
COLOR_SLOT_GROUPS.forEach(group => {
  if (!group || !group.groupId) return;
  group.slots.forEach((slot, slotIndex) => {
    if (!slot) return;
    const index = Number.isInteger(slot.index) && slot.index >= 0 ? slot.index : slotIndex;
    if (!Number.isInteger(index) || index < 0) return;
    SLOT_META_BY_INDEX.set(index, {
      groupId: group.groupId,
      groupIndex: Number.isInteger(slot.groupIndex) ? slot.groupIndex : slotIndex
    });
  });
});

const DEFAULT_GRAFTEGNER_GROUP_ID = 'graftegner';
const GRAFTEGNER_GROUP_ID = (() => {
  for (const group of COLOR_SLOT_GROUPS) {
    if (!group || !group.groupId) continue;
    if (group.groupId === DEFAULT_GRAFTEGNER_GROUP_ID) {
      return group.groupId;
    }
    const hasAxisSlot = Array.isArray(group.slots)
      ? group.slots.some(slot => Number.isInteger(slot && slot.index) && slot.index === 19)
      : false;
    if (hasAxisSlot) {
      return group.groupId;
    }
  }
  return DEFAULT_GRAFTEGNER_GROUP_ID;
})();

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

function getSanitizedFallbackBase(project) {
  const key = normalizeProjectKey(project) || 'default';
  if (PROJECT_FALLBACK_CACHE.has(key)) {
    return PROJECT_FALLBACK_CACHE.get(key).slice();
  }
  const base = PROJECT_FALLBACKS[key] || PROJECT_FALLBACKS.default || [];
  const sanitized = sanitizeColorList(base);
  if (!sanitized.length) {
    const fallbackDefault =
      sanitizeColor((PROJECT_FALLBACKS.default && PROJECT_FALLBACKS.default[0]) || '#1F4DE2') || '#1F4DE2';
    sanitized.push(fallbackDefault);
  }
  PROJECT_FALLBACK_CACHE.set(key, sanitized.slice());
  return sanitized.slice();
}

function resolveGraftegnerAxisFallback(project) {
  const key = normalizeProjectKey(project) || 'default';
  const fallback =
    (GRAFTEGNER_AXIS_DEFAULTS && typeof GRAFTEGNER_AXIS_DEFAULTS[key] === 'string'
      ? GRAFTEGNER_AXIS_DEFAULTS[key]
      : null) || GRAFTEGNER_AXIS_DEFAULTS.default;
  const sanitized = sanitizeColor(fallback);
  if (sanitized) {
    return sanitized;
  }
  const base = getSanitizedFallbackBase(key);
  return base[0] || '#1F4DE2';
}

function buildFallbackGroupsFromBase(baseColors, project) {
  const sanitized = Array.isArray(baseColors) && baseColors.length ? baseColors : getSanitizedFallbackBase('default');
  const groups = {};
  COLOR_SLOT_GROUPS.forEach(group => {
    if (!group || !group.groupId) return;
    groups[group.groupId] = group.slots.map((slot, slotIndex) => {
      const index = Number.isInteger(slot && slot.index) && slot.index >= 0 ? slot.index : slotIndex;
      if (group.groupId === GRAFTEGNER_GROUP_ID && Number(slot && slot.groupIndex) === 1) {
        return resolveGraftegnerAxisFallback(project);
      }
      return sanitized[index % sanitized.length] || sanitized[0];
    });
  });
  return groups;
}

function getFallbackColorForIndex(project, index) {
  const key = normalizeProjectKey(project) || 'default';
  const baseColors = getSanitizedFallbackBase(key);
  if (!baseColors.length) {
    return '#1F4DE2';
  }
  const normalizedIndex = Number.isInteger(index) && index >= 0 ? index : 0;
  const meta = SLOT_META_BY_INDEX.get(normalizedIndex);
  if (meta) {
    if (!PROJECT_FALLBACK_GROUP_CACHE.has(key)) {
      const base = getSanitizedFallbackBase(key);
      PROJECT_FALLBACK_GROUP_CACHE.set(key, buildFallbackGroupsFromBase(base, key));
    }
    const groups = PROJECT_FALLBACK_GROUP_CACHE.get(key) || {};
    const groupColors = Array.isArray(groups[meta.groupId]) ? groups[meta.groupId] : [];
    const candidate = sanitizeColor(groupColors[meta.groupIndex]);
    if (candidate) {
      return candidate;
    }
  }
  return baseColors[normalizedIndex % baseColors.length] || baseColors[0];
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
  if (PROJECT_FALLBACK_GROUP_CACHE.has(normalized)) {
    return cloneGroupPalettes(PROJECT_FALLBACK_GROUP_CACHE.get(normalized));
  }
  if (FALLBACK_GROUP_PALETTE_CACHE.has(cacheKey)) {
    const cached = FALLBACK_GROUP_PALETTE_CACHE.get(cacheKey);
    PROJECT_FALLBACK_GROUP_CACHE.set(normalized, cached);
    return cloneGroupPalettes(cached);
  }
  const base = getSanitizedFallbackBase(normalized);
  const groups = buildFallbackGroupsFromBase(base, normalized);
  const cached = cloneGroupPalettes(groups);
  PROJECT_FALLBACK_GROUP_CACHE.set(normalized, cached);
  FALLBACK_GROUP_PALETTE_CACHE.set(cacheKey, cached);
  return cloneGroupPalettes(cached);
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

function distributeFlatPaletteToGroups(palette, projectName) {
  const normalizedProject = normalizeProjectKey(projectName) || DEFAULT_PROJECT;
  const source = Array.isArray(palette) ? palette : [];
  const result = {};
  COLOR_SLOT_GROUPS.forEach(group => {
    if (!group || !group.groupId) return;
    const groupColors = [];
    group.slots.forEach((slot, slotIndex) => {
      const targetIndex = Number.isInteger(slot && slot.index) && slot.index >= 0 ? slot.index : slotIndex;
      const color = sanitizeColor(source[targetIndex]);
      const fallback = getFallbackColorForIndex(normalizedProject, targetIndex);
      groupColors[slotIndex] = color || fallback;
    });
    result[group.groupId] = groupColors;
  });
  return result;
}

function normalizeProjectGroupPalettes(projectName, palette) {
  const normalizedProject = normalizeProjectKey(projectName) || DEFAULT_PROJECT;
  const base = getFallbackGroupPalettes(normalizedProject);
  if (Array.isArray(palette)) {
    applyGroupPaletteOverlay(base, distributeFlatPaletteToGroups(palette, normalizedProject));
    return base;
  }
  if (palette && typeof palette === 'object') {
    if (Array.isArray(palette.defaultColors)) {
      applyGroupPaletteOverlay(
        base,
        distributeFlatPaletteToGroups(palette.defaultColors, normalizedProject)
      );
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

function flattenProjectPalette(projectName, palette, minimumLength = MIN_COLOR_SLOTS) {
  let resolvedProject = projectName;
  let resolvedPalette = palette;
  let resolvedMinimum = Number.isInteger(minimumLength) && minimumLength > 0 ? minimumLength : 0;
  if (typeof resolvedProject !== 'string') {
    resolvedMinimum = Number.isInteger(palette) && palette > 0 ? palette : resolvedMinimum;
    resolvedPalette = resolvedProject;
    resolvedProject = DEFAULT_PROJECT;
  }
  const project = normalizeProjectKey(resolvedProject) || DEFAULT_PROJECT;
  const normalizedGroups = normalizeProjectGroupPalettes(project, resolvedPalette);
  const flattened = [];
  let highestSlotIndex = -1;
  COLOR_SLOT_GROUPS.forEach(group => {
    if (!group || !group.groupId) return;
    const groupColors = Array.isArray(normalizedGroups[group.groupId]) ? normalizedGroups[group.groupId] : [];
    group.slots.forEach((slot, slotIndex) => {
      const targetIndex = Number.isInteger(slot && slot.index) && slot.index >= 0 ? slot.index : slotIndex;
      if (targetIndex > highestSlotIndex) {
        highestSlotIndex = targetIndex;
      }
      const color = sanitizeColor(groupColors[slotIndex]);
      const fallback = getFallbackColorForIndex(project, targetIndex);
      flattened[targetIndex] = color || fallback;
    });
  });
  const min = resolvedMinimum;
  const targetLength = Math.min(MAX_COLORS, Math.max(min, highestSlotIndex + 1));
  for (let index = 0; index < targetLength; index += 1) {
    if (!sanitizeColor(flattened[index])) {
      flattened[index] = getFallbackColorForIndex(project, index);
    }
  }
  return flattened.slice(0, targetLength);
}

function expandPalette(projectName, palette) {
  const normalizedProject = normalizeProjectKey(projectName) || DEFAULT_PROJECT;
  const groupPalettes = normalizeProjectGroupPalettes(normalizedProject, palette);
  const flattened = flattenProjectPalette(normalizedProject, groupPalettes, MIN_COLOR_SLOTS);
  const targetLength = Math.min(MAX_COLORS, Math.max(MIN_COLOR_SLOTS, flattened.length));
  const result = [];
  for (let index = 0; index < targetLength; index += 1) {
    const color = sanitizeColor(flattened[index]) || getFallbackColorForIndex(normalizedProject, index);
    result.push(color);
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
  distributeFlatPaletteToGroups,
  expandPalette,
  flattenProjectPalette,
  normalizeSettings,
  resolveProjectName,
  KvOperationError,
  KvConfigurationError
};
