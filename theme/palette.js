(function (global) {
  const MAX_COLORS = 48;
  const DEFAULT_PROJECT = 'campus';
  const PROJECT_FALLBACKS = {
    campus: ['#DBE3FF', '#2C395B', '#E3B660', '#C5E5E9', '#F6E5BC', '#F1D0D9'],
    annet: ['#DBE3FF', '#2C395B', '#E3B660', '#C5E5E9', '#F6E5BC', '#F1D0D9'],
    kikora: ['#E31C3D', '#BF4474', '#873E79', '#534477', '#6C1BA2', '#B25FE3'],
    default: ['#1F4DE2', '#475569', '#ef4444', '#0ea5e9', '#10b981', '#f59e0b']
  };
  const GROUP_SLOT_INDICES = {
    graftegner: [0],
    nkant: [1, 2, 3],
    diagram: [4, 5, 6, 7, 8, 9, 10, 11, 12],
    fractions: [13, 14],
    figurtall: [15, 16, 17, 18, 19, 20],
    arealmodell: [21, 22, 23, 24],
    tallinje: [25, 26],
    kvikkbilder: [27],
    trefigurer: [28, 29],
    brokvegg: [30, 31, 32, 33, 34, 35],
    prikktilprikk: [36, 37]
  };
  const MIN_COLOR_SLOTS = Object.values(GROUP_SLOT_INDICES).reduce(
    (total, indices) => total + indices.length,
    0
  );
  const missingGroupWarnings = new Set();

  function normalizeProjectName(name) {
    if (typeof name !== 'string') return '';
    const trimmed = name.trim().toLowerCase();
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

  function readProjectPaletteFromApi(api, projectName) {
    if (!api || typeof api !== 'object') return null;
    if (typeof api.getProjectPalette === 'function') {
      try {
        const palette = api.getProjectPalette(projectName);
        if (Array.isArray(palette) && palette.length) {
          return palette.slice(0, MAX_COLORS);
        }
      } catch (_) {}
    }
    if (typeof api.getProjectSettings === 'function') {
      try {
        const settings = api.getProjectSettings(projectName);
        if (settings && Array.isArray(settings.defaultColors) && settings.defaultColors.length) {
          return settings.defaultColors.slice(0, MAX_COLORS);
        }
      } catch (_) {}
    }
    if (typeof api.getDefaultColors === 'function') {
      try {
        const palette = api.getDefaultColors(MAX_COLORS, { project: projectName });
        if (Array.isArray(palette) && palette.length) {
          return palette.slice(0, MAX_COLORS);
        }
      } catch (_) {}
    }
    if (Array.isArray(api.defaultColors) && api.defaultColors.length) {
      return api.defaultColors.slice(0, MAX_COLORS);
    }
    return null;
  }

  function readProjectPaletteFromSettingsObject(settings, projectName) {
    if (!settings || typeof settings !== 'object') return null;
    const projects = settings.projects && typeof settings.projects === 'object' ? settings.projects : null;
    if (projects) {
      const resolved = normalizeProjectName(projectName);
      if (projects[resolved] && Array.isArray(projects[resolved].defaultColors)) {
        const palette = projects[resolved].defaultColors.slice(0, MAX_COLORS);
        if (palette.length) {
          return palette;
        }
      }
    }
    if (Array.isArray(settings.defaultColors) && settings.defaultColors.length) {
      return settings.defaultColors.slice(0, MAX_COLORS);
    }
    return null;
  }

  function resolveProjectPalette(source, projectName) {
    if (!source) return null;
    const paletteFromApi = readProjectPaletteFromApi(source, projectName);
    if (paletteFromApi && paletteFromApi.length) {
      return paletteFromApi;
    }
    const paletteFromSettings = readProjectPaletteFromSettingsObject(source, projectName);
    if (paletteFromSettings && paletteFromSettings.length) {
      return paletteFromSettings;
    }
    return null;
  }

  function buildProjectPalette(source, projectName) {
    const projectPalette = resolveProjectPalette(source, projectName);
    const fallback = getProjectFallbackPalette(projectName);
    const globalFallback = getGlobalFallbackPalette();
    const sanitized = sanitizeColorList(projectPalette);
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
    if (groupId === 'extra') {
      const limit = Math.min(Number.isInteger(availableLength) ? availableLength : MAX_COLORS, MAX_COLORS);
      const indices = [];
      for (let index = MIN_COLOR_SLOTS; index < limit; index += 1) {
        indices.push(index);
      }
      return indices;
    }
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

    const projectPalette = buildProjectPalette(source, project);
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

    if (groupKey === 'extra') {
      let nextIndex = MIN_COLOR_SLOTS;
      const globalFallback = getGlobalFallbackPalette();
      while (colors.length < (count || colors.length) && nextIndex < projectPalette.length && nextIndex < MAX_COLORS) {
        const color = projectPalette[nextIndex] || fallbackPalette[nextIndex % fallbackPalette.length];
        colors.push(color || globalFallback[nextIndex % globalFallback.length]);
        nextIndex += 1;
      }
    }

    if (!colors.length) {
      warnMissingGroupConfiguration(groupKey, project);
    }

    const targetCount = count || (colors.length ? colors.length : groupIndices.length || 1);
    return ensurePaletteSize(colors, targetCount, fallbackPalette);
  }

  const api = {
    getGroupPalette
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
