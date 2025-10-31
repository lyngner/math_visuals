(function (global) {
  function resolvePaletteConfig() {
    const scopes = [
      typeof global !== 'undefined' ? global : null,
      typeof globalThis !== 'undefined' ? globalThis : null,
      typeof window !== 'undefined' ? window : null
    ];
    for (const scope of scopes) {
      if (!scope || typeof scope !== 'object') continue;
      const config = scope.MathVisualsPaletteConfig;
      if (config && typeof config === 'object') {
        return config;
      }
    }
    if (typeof require === 'function') {
      try {
        const mod = require('../palette/palette-config.js');
        if (mod && typeof mod === 'object') {
          return mod;
        }
      } catch (_) {}
    }
    return null;
  }

  const paletteConfig = resolvePaletteConfig();
  if (!paletteConfig) {
    if (typeof console !== 'undefined' && console && typeof console.error === 'function') {
      console.error(
        '[MathVisualsPalette] Mangler fargekonfigurasjon. Sørg for at palette/palette-config.js lastes før theme/palette.js.'
      );
    }
    return;
  }

  const MAX_COLORS = paletteConfig.MAX_COLORS;
  const DEFAULT_PROJECT = typeof paletteConfig.DEFAULT_PROJECT === 'string'
    ? paletteConfig.DEFAULT_PROJECT
    : 'campus';
  const PROJECT_FALLBACKS = paletteConfig.PROJECT_FALLBACKS;
  const GROUP_SLOT_INDICES = paletteConfig.GROUP_SLOT_INDICES;
  const MIN_COLOR_SLOTS = Number.isInteger(paletteConfig.MIN_COLOR_SLOTS)
    ? paletteConfig.MIN_COLOR_SLOTS
    : Object.values(GROUP_SLOT_INDICES).reduce((total, indices) => total + indices.length, 0);
  const COLOR_GROUP_IDS = Array.isArray(paletteConfig.COLOR_GROUP_IDS)
    ? paletteConfig.COLOR_GROUP_IDS.map(value => (typeof value === 'string' ? value.trim().toLowerCase() : '')).filter(Boolean)
    : Object.keys(GROUP_SLOT_INDICES).map(key => (typeof key === 'string' ? key.trim().toLowerCase() : '')).filter(Boolean);
  const GROUP_SLOT_COUNTS = COLOR_GROUP_IDS.reduce((acc, groupId) => {
    const indices = Array.isArray(GROUP_SLOT_INDICES[groupId]) ? GROUP_SLOT_INDICES[groupId] : [];
    acc[groupId] = indices.length;
    return acc;
  }, {});
  const GROUPED_PALETTE_ORDER = Array.isArray(paletteConfig.DEFAULT_GROUP_ORDER)
    ? paletteConfig.DEFAULT_GROUP_ORDER.map(value => (typeof value === 'string' ? value.trim().toLowerCase() : '')).filter(Boolean)
    : COLOR_GROUP_IDS.slice();
  const missingGroupWarnings = new Set();

  function normalizeProjectName(name) {
    if (typeof name !== 'string') return '';
    const trimmed = name.trim().toLowerCase();
    return trimmed || '';
  }

  function normalizeGroupId(value) {
    if (typeof value !== 'string') return '';
    const trimmed = value.trim().toLowerCase();
    return trimmed || '';
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

  function sanitizeGroupPalette(values, limit) {
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
        const limit = GROUP_SLOT_COUNTS[normalized] || MAX_COLORS;
        result[normalized] = sanitizeGroupPalette(source[key], limit);
      }
    });
    return result;
  }

  const PROJECT_FALLBACK_GROUP_CACHE = new Map();

  function getProjectFallbackGroupPalettes(projectName) {
    const normalized = normalizeProjectName(projectName) || 'default';
    if (PROJECT_FALLBACK_GROUP_CACHE.has(normalized)) {
      return cloneGroupPalettes(PROJECT_FALLBACK_GROUP_CACHE.get(normalized));
    }
    const fallbackPalette = getProjectFallbackPalette(normalized);
    const fallbackColors = fallbackPalette.length ? fallbackPalette : getGlobalFallbackPalette();
    const groups = {};
    let cursor = 0;
    COLOR_GROUP_IDS.forEach(groupId => {
      const limit = GROUP_SLOT_COUNTS[groupId] || 0;
      const colors = [];
      if (limit > 0) {
        for (let index = 0; index < limit; index += 1) {
          const color = fallbackColors[cursor] || fallbackColors[index % (fallbackColors.length || 1)] || fallbackColors[0];
          if (color) {
            colors.push(color);
          }
          if (cursor < fallbackColors.length) {
            cursor += 1;
          }
        }
        if (!colors.length && fallbackColors.length) {
          for (let index = 0; index < limit; index += 1) {
            colors.push(fallbackColors[index % fallbackColors.length]);
          }
        }
      }
      groups[groupId] = colors;
    });
    PROJECT_FALLBACK_GROUP_CACHE.set(normalized, cloneGroupPalettes(groups));
    return cloneGroupPalettes(groups);
  }

  function applyGroupPaletteOverlay(target, source) {
    if (!target || typeof target !== 'object' || !source || typeof source !== 'object') {
      return;
    }
    const normalizedSource = cloneGroupPalettes(source);
    COLOR_GROUP_IDS.forEach(groupId => {
      const limit = GROUP_SLOT_COUNTS[groupId] || 0;
      if (!limit) return;
      const incoming = sanitizeGroupPalette(normalizedSource[groupId], limit);
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
    const groups = {};
    let cursor = 0;
    COLOR_GROUP_IDS.forEach(groupId => {
      const limit = GROUP_SLOT_COUNTS[groupId] || 0;
      const colors = [];
      for (let index = 0; index < limit && cursor < sanitized.length; index += 1) {
        colors.push(sanitized[cursor]);
        cursor += 1;
      }
      groups[groupId] = colors;
    });
    return groups;
  }

  function normalizeProjectGroupPalettes(projectName, palette) {
    const base = getProjectFallbackGroupPalettes(projectName);
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

  function flattenGroupPalettes(groupPalettes) {
    const source = groupPalettes && typeof groupPalettes === 'object' ? groupPalettes : {};
    const flattened = [];
    GROUPED_PALETTE_ORDER.forEach(groupId => {
      if (flattened.length >= MAX_COLORS) return;
      const normalized = normalizeGroupId(groupId);
      if (!normalized || !COLOR_GROUP_IDS.includes(normalized)) return;
      const limit = GROUP_SLOT_COUNTS[normalized] || 0;
      if (!limit) return;
      const values = Array.isArray(source[normalized])
        ? sanitizeGroupPalette(source[normalized], limit)
        : [];
      values.forEach(color => {
        if (flattened.length < MAX_COLORS) {
          flattened.push(color);
        }
      });
    });
    return flattened;
  }

  function getProjectFallbackPalette(projectName) {
    const key = normalizeProjectName(projectName);
    const fallback = PROJECT_FALLBACKS[key] || PROJECT_FALLBACKS.default;
    return fallback.slice(0, MAX_COLORS);
  }

  function getGlobalFallbackPalette() {
    return PROJECT_FALLBACKS.default.slice(0, MAX_COLORS);
  }

  function resolveSettingsSource(source) {
    if (source && typeof source === 'object') {
      return source;
    }
    const scope =
      typeof global !== 'undefined' && global && global.MathVisualsSettings
        ? global
        : typeof globalThis !== 'undefined'
        ? globalThis
        : typeof window !== 'undefined'
        ? window
        : null;
    if (scope && scope.MathVisualsSettings && typeof scope.MathVisualsSettings === 'object') {
      return scope.MathVisualsSettings;
    }
    return null;
  }

  function resolveProjectName(source, hint) {
    const normalizedHint = normalizeProjectName(hint);
    if (normalizedHint) return normalizedHint;
    if (source && typeof source.getActiveProject === 'function') {
      try {
        const active = normalizeProjectName(source.getActiveProject());
        if (active) return active;
      } catch (_) {}
    }
    if (source && typeof source.activeProject === 'string') {
      const active = normalizeProjectName(source.activeProject);
      if (active) return active;
    }
    if (source && source.projects && typeof source.projects === 'object') {
      const keys = Object.keys(source.projects)
        .map(normalizeProjectName)
        .filter(Boolean);
      if (keys.length) return keys[0];
    }
    return DEFAULT_PROJECT;
  }

  function readProjectGroupPalettesFromApi(api, projectName) {
    if (!api || typeof api !== 'object') return null;
    if (typeof api.getProjectGroupPalettes === 'function') {
      try {
        const groups = api.getProjectGroupPalettes(projectName);
        if (groups && typeof groups === 'object') {
          return groups;
        }
      } catch (_) {}
    }
    if (typeof api.getProjectSettings === 'function') {
      try {
        const settings = api.getProjectSettings(projectName);
        if (settings && typeof settings === 'object') {
          if (settings.groupPalettes && typeof settings.groupPalettes === 'object') {
            return settings.groupPalettes;
          }
          if (Array.isArray(settings.defaultColors) && settings.defaultColors.length) {
            return distributeFlatPaletteToGroups(settings.defaultColors.slice(0, MAX_COLORS));
          }
        }
      } catch (_) {}
    }
    if (typeof api.getProjectPalette === 'function') {
      try {
        const palette = api.getProjectPalette(projectName);
        if (Array.isArray(palette) && palette.length) {
          return distributeFlatPaletteToGroups(palette.slice(0, MAX_COLORS));
        }
        if (palette && typeof palette === 'object' && palette.groupPalettes) {
          return palette.groupPalettes;
        }
      } catch (_) {}
    }
    if (typeof api.getDefaultColors === 'function') {
      try {
        const palette = api.getDefaultColors(MAX_COLORS, { project: projectName });
        if (Array.isArray(palette) && palette.length) {
          return distributeFlatPaletteToGroups(palette.slice(0, MAX_COLORS));
        }
      } catch (_) {}
    }
    if (Array.isArray(api.defaultColors) && api.defaultColors.length) {
      return distributeFlatPaletteToGroups(api.defaultColors.slice(0, MAX_COLORS));
    }
    return null;
  }

  function readProjectGroupPalettesFromSettingsObject(settings, projectName) {
    if (!settings || typeof settings !== 'object') return null;
    const projects = settings.projects && typeof settings.projects === 'object' ? settings.projects : null;
    if (projects) {
      const resolved = normalizeProjectName(projectName);
      if (projects[resolved]) {
        const entry = projects[resolved];
        if (entry && typeof entry === 'object') {
          if (entry.groupPalettes && typeof entry.groupPalettes === 'object') {
            return entry.groupPalettes;
          }
          if (Array.isArray(entry.defaultColors) && entry.defaultColors.length) {
            return distributeFlatPaletteToGroups(entry.defaultColors.slice(0, MAX_COLORS));
          }
        }
      }
    }
    if (Array.isArray(settings.defaultColors) && settings.defaultColors.length) {
      return distributeFlatPaletteToGroups(settings.defaultColors.slice(0, MAX_COLORS));
    }
    return null;
  }

  function resolveProjectGroupPalettes(source, projectName) {
    const resolvedProject = normalizeProjectName(projectName);
    const paletteFromApi = readProjectGroupPalettesFromApi(source, resolvedProject);
    if (paletteFromApi && typeof paletteFromApi === 'object') {
      return normalizeProjectGroupPalettes(resolvedProject, { groupPalettes: paletteFromApi });
    }
    const paletteFromSettings = readProjectGroupPalettesFromSettingsObject(source, resolvedProject);
    if (paletteFromSettings && typeof paletteFromSettings === 'object') {
      return normalizeProjectGroupPalettes(resolvedProject, { groupPalettes: paletteFromSettings });
    }
    return normalizeProjectGroupPalettes(resolvedProject, null);
  }

  function buildProjectPalette(source, projectName, precomputedGroupPalettes) {
    const groupPalettes =
      precomputedGroupPalettes && typeof precomputedGroupPalettes === 'object'
        ? precomputedGroupPalettes
        : resolveProjectGroupPalettes(source, projectName);
    const fallback = getProjectFallbackPalette(projectName);
    const globalFallback = getGlobalFallbackPalette();
    const flattened = flattenGroupPalettes(groupPalettes);
    const sanitized = sanitizeColorList(flattened);
    const result = [];
    const limit = MAX_COLORS;
    for (let index = 0; index < limit; index += 1) {
      if (sanitized[index]) {
        result.push(sanitized[index]);
        continue;
      }
      if (fallback[index % fallback.length]) {
        result.push(fallback[index % fallback.length]);
        continue;
      }
      result.push(globalFallback[index % globalFallback.length]);
    }
    if (!result.length) {
      result.push(globalFallback[0]);
    }
    return result;
  }

  function readGroupPaletteOverrides(settings, projectName, groupId) {
    const settingsObject = settings && typeof settings === 'object' ? settings : null;
    if (!settingsObject) return [];

    function extractPalette(entry) {
      if (!entry) return null;
      if (Array.isArray(entry)) return entry;
      if (entry && typeof entry === 'object') {
        if (Array.isArray(entry.colors)) return entry.colors;
        if (Array.isArray(entry.palette)) return entry.palette;
        if (Array.isArray(entry.values)) return entry.values;
        if (projectName) {
          const projectKey = normalizeProjectName(projectName);
          const projectEntries = entry.project || entry.projects || entry.byProject;
          if (projectEntries && typeof projectEntries === 'object') {
            const projectPalette = extractPalette(projectEntries[projectKey]);
            if (projectPalette && projectPalette.length) {
              return projectPalette;
            }
          }
          if (entry[projectKey] != null) {
            const projectPalette = extractPalette(entry[projectKey]);
            if (projectPalette && projectPalette.length) {
              return projectPalette;
            }
          }
        }
        if (entry.default != null) {
          const defaultPalette = extractPalette(entry.default);
          if (defaultPalette && defaultPalette.length) {
            return defaultPalette;
          }
        }
        if (entry.fallback != null) {
          const fallbackPalette = extractPalette(entry.fallback);
          if (fallbackPalette && fallbackPalette.length) {
            return fallbackPalette;
          }
        }
      }
      return null;
    }

    const projectKey = normalizeProjectName(projectName);
    const projects = settingsObject.projects && typeof settingsObject.projects === 'object' ? settingsObject.projects : null;
    if (projectKey && projects && projects[projectKey]) {
      const projectEntry = projects[projectKey];
      const projectGroups =
        projectEntry.groupPalettes || projectEntry.groups || projectEntry.palettes || projectEntry.group || null;
      if (projectGroups && typeof projectGroups === 'object') {
        const groupEntry = projectGroups[groupId] || projectGroups.default || null;
        const palette = extractPalette(groupEntry);
        if (palette && palette.length) {
          return sanitizeColorList(palette);
        }
      }
    }

    const rootGroups =
      settingsObject.groupPalettes ||
      (settingsObject.palettes && settingsObject.palettes.groups) ||
      settingsObject.groups ||
      null;
    if (rootGroups && typeof rootGroups === 'object') {
      const groupEntry = rootGroups[groupId] || rootGroups.default || null;
      const palette = extractPalette(groupEntry);
      if (palette && palette.length) {
        return sanitizeColorList(palette);
      }
    }

    return [];
  }

  function warnMissingGroupConfiguration(groupId, projectName) {
    const projectLabel = normalizeProjectName(projectName) || 'ukjent';
    const normalizedGroup = typeof groupId === 'string' ? groupId.trim().toLowerCase() : '';
    const cacheKey = `${projectLabel}::${normalizedGroup || '(none)'}`;
    if (missingGroupWarnings.has(cacheKey)) {
      return;
    }
    missingGroupWarnings.add(cacheKey);
    if (typeof console !== 'undefined' && console && typeof console.warn === 'function') {
      if (!normalizedGroup) {
        console.warn('[MathVisualsPalette] Forespurt fargegruppe mangler identifikator. Bruker globale tilbakefallsfarger.');
      } else {
        console.warn(
          `[MathVisualsPalette] Fant ingen fargekonfigurasjon for gruppen "${normalizedGroup}" i prosjekt "${projectLabel}". ` +
            'Bruker tilbakefallsfarger.'
        );
      }
    }
  }

  function collectGroupIndices(groupId, projectName, availableLength) {
    const base = GROUP_SLOT_INDICES[groupId];
    if (Array.isArray(base)) {
      return base.slice();
    }
    warnMissingGroupConfiguration(groupId, projectName);
    return [];
  }

  function ensurePaletteSize(colors, count, fallbackPalette) {
    const palette = colors.filter(color => typeof color === 'string' && color);
    const fallback = fallbackPalette && fallbackPalette.length ? fallbackPalette : getGlobalFallbackPalette();
    if (!palette.length) {
      palette.push(fallback[0]);
    }
    if (!Number.isFinite(count) || count <= 0) {
      return palette.slice();
    }
    const size = Math.trunc(count);
    const result = [];
    for (let index = 0; index < size; index += 1) {
      const color = palette[index % palette.length] || fallback[index % fallback.length];
      result.push(color || fallback[0]);
    }
    return result;
  }

  function getGroupPalette(groupId, options) {
    const groupKey = typeof groupId === 'string' ? groupId.trim().toLowerCase() : '';
    const opts = options && typeof options === 'object' ? options : {};
    const source = resolveSettingsSource(opts.settings);
    const project = resolveProjectName(source, opts.project);
    const count = Number.isFinite(opts.count) && opts.count > 0 ? Math.trunc(opts.count) : undefined;
    const fallbackPalette = getProjectFallbackPalette(project);

    if (!groupKey) {
      warnMissingGroupConfiguration(groupKey, project);
      return ensurePaletteSize([], count || 0, fallbackPalette);
    }

    const overridePalette = readGroupPaletteOverrides(source, project, groupKey);
    if (overridePalette.length) {
      return ensurePaletteSize(overridePalette, count || overridePalette.length, fallbackPalette);
    }

    const projectGroupPalettes = resolveProjectGroupPalettes(source, project);
    const baseGroupPalette = Array.isArray(projectGroupPalettes[groupKey])
      ? sanitizeGroupPalette(
          projectGroupPalettes[groupKey],
          GROUP_SLOT_COUNTS[groupKey] || MAX_COLORS
        )
      : [];
    if (baseGroupPalette.length) {
      return ensurePaletteSize(baseGroupPalette, count || baseGroupPalette.length, fallbackPalette);
    }

    const projectPalette = buildProjectPalette(source, project, projectGroupPalettes);
    const groupIndices = collectGroupIndices(groupKey, project, projectPalette.length);
    const colors = [];
    if (groupIndices.length) {
      groupIndices.forEach(index => {
        const color = projectPalette[index];
        if (typeof color === 'string' && color) {
          colors.push(color);
        } else {
          const fallback = fallbackPalette[index % fallbackPalette.length];
          const globalFallback = getGlobalFallbackPalette();
          colors.push(fallback || globalFallback[index % globalFallback.length]);
        }
      });
    }

    if (!colors.length) {
      warnMissingGroupConfiguration(groupKey, project);
    }

    const targetCount = count || (colors.length ? colors.length : groupIndices.length || 1);
    return ensurePaletteSize(colors, targetCount, fallbackPalette);
  }

  function getProjectGroupPalettes(projectName, options) {
    const opts = options && typeof options === 'object' ? options : {};
    const source = resolveSettingsSource(opts.settings);
    const project = resolveProjectName(source, opts.project || projectName);
    const groupPalettes = resolveProjectGroupPalettes(source, project);
    return cloneGroupPalettes(groupPalettes);
  }

  function getProjectPalette(projectName, options) {
    const opts = options && typeof options === 'object' ? options : {};
    const source = resolveSettingsSource(opts.settings);
    const project = resolveProjectName(source, opts.project || projectName);
    const groupPalettes = resolveProjectGroupPalettes(source, project);
    return buildProjectPalette(source, project, groupPalettes);
  }

  const api = {
    getGroupPalette,
    getProjectGroupPalettes,
    getProjectPalette
  };

  if (typeof global !== 'undefined' && global && typeof global === 'object') {
    global.MathVisualsPalette = api;
  }
  if (typeof window !== 'undefined' && window && typeof window === 'object') {
    window.MathVisualsPalette = api;
  }
  if (typeof globalThis !== 'undefined' && globalThis && typeof globalThis === 'object') {
    globalThis.MathVisualsPalette = api;
  }
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }
})(typeof window !== 'undefined' ? window : typeof globalThis !== 'undefined' ? globalThis : this);
