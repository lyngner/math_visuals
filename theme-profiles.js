(function () {
  const SETTINGS_STORAGE_KEY = 'mathVisuals:settings';
  const LEGACY_FRACTION_PALETTE = ['#B25FE3', '#6C1BA2', '#534477', '#873E79', '#BF4474', '#E31C3D'];
  function deepClone(value) {
    if (typeof structuredClone === 'function') {
      try {
        return structuredClone(value);
      } catch (err) {
      }
    }
    if (typeof window !== 'undefined' && typeof window.structuredClone === 'function') {
      try {
        return window.structuredClone(value);
      } catch (err) {
      }
    }
    try {
      return JSON.parse(JSON.stringify(value));
    } catch (err) {
      return value;
    }
  }
  function getSettingsApi() {
    if (typeof window === 'undefined') return null;
    const api = window.MathVisualsSettings;
    return api && typeof api === 'object' ? api : null;
  }
  function resolvePaletteHelper() {
    const scopes = [
      typeof window !== 'undefined' ? window : null,
      typeof globalThis !== 'undefined' ? globalThis : null,
      typeof global !== 'undefined' ? global : null
    ];
    for (const scope of scopes) {
      if (!scope) continue;
      const helper = scope.MathVisualsPalette;
      if (helper && typeof helper.getGroupPalette === 'function') {
        return helper;
      }
    }
    if (typeof require === 'function') {
      try {
        const mod = require('./theme/palette.js');
        if (mod && typeof mod.getGroupPalette === 'function') {
          return mod;
        }
      } catch (_) {}
    }
    return null;
  }
  const paletteHelper = resolvePaletteHelper();
  function sanitizeUserColor(value) {
    if (typeof value !== 'string') return null;
    const trimmed = value.trim();
    if (!trimmed) return null;
    const match = /^#?([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.exec(trimmed);
    if (!match) return null;
    let hex = match[1].toLowerCase();
    if (hex.length === 3) {
      hex = hex.split('').map(ch => ch + ch).join('');
    }
    return `#${hex}`;
  }
  function readStoredSettings() {
    if (typeof window === 'undefined' || !window.localStorage) return null;
    try {
      const raw = window.localStorage.getItem(SETTINGS_STORAGE_KEY);
      if (typeof raw !== 'string' || !raw) return null;
      const parsed = JSON.parse(raw);
      return parsed && typeof parsed === 'object' ? parsed : null;
    } catch (_) {
      return null;
    }
  }
  function flattenStoredPalette(palette) {
    if (Array.isArray(palette)) {
      return palette.map(sanitizeUserColor).filter(Boolean);
    }
    if (!palette || typeof palette !== 'object') return [];
    const colors = [];
    DEFAULT_PALETTE_GROUPS.forEach(groupId => {
      const values = Array.isArray(palette[groupId]) ? palette[groupId] : [];
      values.forEach(color => {
        const sanitized = sanitizeUserColor(color);
        if (sanitized) {
          colors.push(sanitized);
        }
      });
    });
    return colors;
  }
  const GROUP_FALLBACKS = {
    graftegner: ['figures', 'fractions'],
    nkant: ['figures', 'fractions'],
    diagram: ['fractions', 'figures'],
    fractions: ['fractions', 'figures'],
    brokvegg: ['fractions', 'figures'],
    arealmodell: ['fractions', 'figures'],
    kvikkbilder: ['figures', 'fractions'],
    trefigurer: ['figures', 'fractions'],
    tallinje: ['figures', 'fractions'],
    prikktilprikk: ['figures', 'fractions'],
    figurtall: ['figures', 'fractions'],
    default: ['fractions', 'figures']
  };
  const DEFAULT_PALETTE_GROUPS = [
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
    'prikktilprikk',
    'extra'
  ];
  const campusProfileBase = {
    palettes: {
      fractions: ['#DBE3FF', '#2C395B', '#E3B660', '#C5E5E9', '#F6E5BC', '#F1D0D9'],
      figures: ['#DBE3FF', '#2C395B', '#E3B660', '#C5E5E9', '#F6E5BC', '#F1D0D9']
    },
    colors: {
      ui: {
        primary: '#2C395B',
        secondary: '#C5E5E9',
        hover: '#E3B660',
        playButton: '#E3B660',
        playButtonHover: '#2C395B',
        playButtonText: '#2C395B'
      },
      dots: {
        default: '#2C395B',
        highlight: '#E3B660'
      },
      graphs: {
        axis: '#1F4DE2'
      },
      beads: {
        primary: {
          fill: '#E3B660',
          stroke: '#C0902F'
        },
        secondary: {
          fill: '#C5E5E9',
          stroke: '#8CB0B4'
        }
      },
      pizza: {
        fill: '#DBE3FF',
        rim: '#2C395B',
        dash: '#2C395B',
        handle: '#C5E5E9',
        handleStroke: '#2C395B'
      }
    }
  };
  const campusProfile = {
    palettes: deepClone(campusProfileBase.palettes),
    colors: deepClone(campusProfileBase.colors)
  };
  const annetProfile = {
    palettes: deepClone(campusProfileBase.palettes),
    colors: deepClone(campusProfileBase.colors)
  };
  const PROFILES = {
    kikora: {
      id: 'kikora',
      label: 'Kikora',
      palettes: {
        fractions: {
          byCount: {
            1: ['#6C1BA2'],
            2: ['#534477', '#BF4474'],
            3: ['#BF4474', '#6C1BA2', '#B25FE3'],
            4: ['#BF4474', '#873E79', '#534477', '#6C1BA2'],
            5: ['#BF4474', '#873E79', '#534477', '#6C1BA2', '#B25FE3'],
            6: ['#E31C3D', '#BF4474', '#873E79', '#534477', '#6C1BA2', '#B25FE3']
          },
          default: ['#E31C3D', '#BF4474', '#873E79', '#534477', '#6C1BA2', '#B25FE3']
        },
        figures: {
          byCount: {
            1: ['#6C1BA2'],
            2: ['#534477', '#BF4474'],
            3: ['#BF4474', '#6C1BA2', '#B25FE3'],
            4: ['#BF4474', '#873E79', '#534477', '#6C1BA2'],
            5: ['#BF4474', '#873E79', '#534477', '#6C1BA2', '#B25FE3'],
            6: ['#E31C3D', '#BF4474', '#873E79', '#534477', '#6C1BA2', '#B25FE3']
          },
          default: ['#E31C3D', '#BF4474', '#873E79', '#534477', '#6C1BA2', '#B25FE3']
        }
      },
      colors: {
        ui: {
          primary: '#6C1BA2',
          secondary: '#534477',
          hover: '#873E79',
          playButton: '#10b981',
          playButtonHover: '#059669',
          playButtonText: '#ffffff'
        },
        dots: {
          default: '#534477',
          highlight: '#BF4474'
        },
        graphs: {
          axis: '#111827'
        },
        beads: {
          primary: {
            fill: '#d24a2c',
            stroke: '#b23d22'
          },
          secondary: {
            fill: '#3f7dc0',
            stroke: '#2a5e91'
          }
        },
        pizza: {
          fill: '#5B2AA5',
          rim: '#333333',
          dash: '#000000',
          handle: '#e9e6f7',
          handleStroke: '#333333'
        }
      }
    },
    campus: {
      id: 'campus',
      label: 'Campus',
      palettes: campusProfile.palettes,
      colors: campusProfile.colors
    },
    annet: {
      id: 'annet',
      label: 'Annet',
      palettes: annetProfile.palettes,
      colors: annetProfile.colors
    }
  };
  const DEFAULT_PROFILE = 'campus';
  function getStoredProfileName() {
    try {
      return typeof window !== 'undefined' && window.localStorage ? window.localStorage.getItem('mathVisuals:themeProfile') : null;
    } catch (err) {
      return null;
    }
  }
  function storeProfileName(name) {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        window.localStorage.setItem('mathVisuals:themeProfile', name);
      }
    } catch (err) {
    }
  }
  function resolveProfileName(name) {
    if (typeof name !== 'string') return DEFAULT_PROFILE;
    const lower = name.toLowerCase();
    if (PROFILES[lower]) return lower;
    return DEFAULT_PROFILE;
  }
  function ensurePalette(base, count) {
    if (base && typeof base === 'object' && !Array.isArray(base)) {
      const byCount = base.byCount && typeof base.byCount === 'object' ? base.byCount : null;
      if (Number.isFinite(count) && count > 0 && byCount) {
        const direct = byCount[count];
        if (Array.isArray(direct) && direct.length) {
          return direct.slice(0, count);
        }
      }
      const defaultPalette = Array.isArray(base.default) && base.default.length ? base.default : null;
      if (defaultPalette) {
        return ensurePalette(defaultPalette, count);
      }
      if (byCount) {
        const sortedKeys = Object.keys(byCount)
          .map((key) => parseInt(key, 10))
          .filter((num) => Number.isFinite(num) && num > 0)
          .sort((a, b) => a - b);
        for (const key of sortedKeys) {
          const paletteForKey = byCount[key];
          if (Array.isArray(paletteForKey) && paletteForKey.length) {
            if (!Number.isFinite(count) || count <= 0) {
              return paletteForKey.slice();
            }
            if (count <= key) {
              return paletteForKey.slice(0, count);
            }
          }
        }
      }
      return ensurePalette(LEGACY_FRACTION_PALETTE, count);
    }
    const palette = Array.isArray(base) && base.length ? base.slice() : LEGACY_FRACTION_PALETTE.slice();
    if (!Number.isFinite(count) || count <= 0) return palette.slice();
    if (palette.length >= count) return palette.slice(0, count);
    const result = palette.slice();
    for (let i = palette.length; i < count; i++) {
      result.push(palette[i % palette.length]);
    }
    return result;
  }
  function resolveUserPalette(count, projectName) {
    const api = getSettingsApi();
    const project = typeof projectName === 'string' && projectName.trim()
      ? projectName.trim().toLowerCase()
      : null;
    if (api && typeof api.getDefaultColors === 'function') {
      try {
        const palette = api.getDefaultColors(count, project ? { project } : undefined);
        if (Array.isArray(palette) && palette.length) {
          return ensurePalette(palette, count);
        }
      } catch (_) {}
    }
    const stored = readStoredSettings();
    if (stored && typeof stored === 'object') {
      if (project && stored.projects && typeof stored.projects === 'object') {
        const projectSettings = stored.projects[project];
        if (projectSettings && projectSettings.defaultColors != null) {
          const sanitized = flattenStoredPalette(projectSettings.defaultColors);
          if (sanitized.length) {
            return ensurePalette(sanitized, count);
          }
        }
      }
      if (stored.defaultColors != null) {
        const sanitized = flattenStoredPalette(stored.defaultColors);
        if (sanitized.length) {
          return ensurePalette(sanitized, count);
        }
      }
    }
    return null;
  }
  function readColorToken(profile, token) {
    if (!profile || typeof profile !== 'object') return undefined;
    if (!token || typeof token !== 'string') return undefined;
    const direct = profile.colors && typeof profile.colors === 'object' ? profile.colors[token] : undefined;
    if (typeof direct === 'string' && direct) return direct;
    const parts = token.split('.');
    let current = profile.colors;
    for (const part of parts) {
      if (!current || typeof current !== 'object') return undefined;
      current = current[part];
    }
    return typeof current === 'string' && current ? current : undefined;
  }
  let activeProfileName = resolveProfileName(getStoredProfileName());
  function getProfile(name) {
    return PROFILES[resolveProfileName(name)] || PROFILES[DEFAULT_PROFILE];
  }
  function getActiveProfile() {
    return getProfile(activeProfileName);
  }
  function setProfile(name, options) {
    const resolved = resolveProfileName(name);
    const force = options && options.force;
    if (!force && resolved === activeProfileName) return activeProfileName;
    activeProfileName = resolved;
    storeProfileName(activeProfileName);
    const settingsApi = getSettingsApi();
    if (settingsApi && typeof settingsApi.setActiveProject === 'function') {
      try {
        settingsApi.setActiveProject(activeProfileName, { notify: true });
      } catch (_) {}
    }
    return activeProfileName;
  }
  function listProfiles() {
    return Object.keys(PROFILES);
  }
  function buildPalette(kind, count, opts) {
    const activeProfile = getActiveProfile();
    const projectOverride = opts && typeof opts.project === 'string' ? opts.project.trim().toLowerCase() : null;
    const projectName = projectOverride || (activeProfile && activeProfile.id ? activeProfile.id : activeProfileName);
    const userPalette = resolveUserPalette(count, projectName);
    if (userPalette && userPalette.length) {
      return ensurePalette(userPalette, count);
    }
    const profile = getActiveProfile();
    const requested = typeof kind === 'string' ? kind : 'fractions';
    const fallbackKinds = Array.isArray(opts && opts.fallbackKinds) ? opts.fallbackKinds : [];
    const seen = new Set();
    const queue = [requested, ...fallbackKinds, 'figures', 'fractions', 'default'];
    for (const item of queue) {
      if (typeof item !== 'string') continue;
      const key = item.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      const base = profile && profile.palettes ? profile.palettes[key] : undefined;
      if (Array.isArray(base) && base.length) {
        return ensurePalette(base, count);
      }
    }
    return ensurePalette(LEGACY_FRACTION_PALETTE, count);
  }
  function normalizeGroupPaletteOptions(countOrOptions, maybeOpts) {
    const result = {
      count: undefined,
      project: undefined,
      fallbackKinds: []
    };
    if (countOrOptions && typeof countOrOptions === 'object' && !Array.isArray(countOrOptions)) {
      if (Number.isFinite(countOrOptions.count) && countOrOptions.count > 0) {
        result.count = Math.trunc(countOrOptions.count);
      }
      if (typeof countOrOptions.project === 'string' && countOrOptions.project) {
        result.project = countOrOptions.project.trim().toLowerCase();
      }
      if (Array.isArray(countOrOptions.fallbackKinds)) {
        result.fallbackKinds = countOrOptions.fallbackKinds.filter(item => typeof item === 'string');
      }
      return result;
    }
    if (Number.isFinite(countOrOptions) && countOrOptions > 0) {
      result.count = Math.trunc(countOrOptions);
    }
    if (maybeOpts && typeof maybeOpts === 'object') {
      if (typeof maybeOpts.project === 'string' && maybeOpts.project) {
        result.project = maybeOpts.project.trim().toLowerCase();
      }
      if (Array.isArray(maybeOpts.fallbackKinds)) {
        result.fallbackKinds = maybeOpts.fallbackKinds.filter(item => typeof item === 'string');
      }
    }
    return result;
  }

  function buildGroupPalette(groupId, count, opts) {
    const normalizedId = typeof groupId === 'string' ? groupId.trim().toLowerCase() : '';
    const projectOverride = opts && typeof opts.project === 'string' ? opts.project.trim().toLowerCase() : null;
    const settingsApi = getSettingsApi();
    const activeProfile = getActiveProfile();
    const projectName = projectOverride || (activeProfile && activeProfile.id ? activeProfile.id : activeProfileName);
    if (settingsApi && typeof settingsApi.getGroupPalette === 'function') {
      try {
        if (settingsApi.getGroupPalette.length >= 3) {
          const palette = settingsApi.getGroupPalette(
            normalizedId || 'default',
            count,
            projectName ? { project: projectName } : undefined
          );
          if (Array.isArray(palette) && palette.length) {
            return ensurePalette(palette, count);
          }
        }
        const directPalette = settingsApi.getGroupPalette(
          normalizedId || 'default',
          {
            count,
            project: projectName || undefined
          }
        );
        if (Array.isArray(directPalette) && directPalette.length) {
          return ensurePalette(directPalette, count);
        }
      } catch (_) {}
    }
    const fallbackList = GROUP_FALLBACKS[normalizedId] || GROUP_FALLBACKS.default;
    const extraFallbacks = Array.isArray(opts && opts.fallbackKinds) ? opts.fallbackKinds : [];
    const dedupedFallbacks = Array.from(
      new Set([
        ...extraFallbacks.filter(item => typeof item === 'string'),
        ...fallbackList
      ])
    );
    return buildPalette(normalizedId || 'fractions', count, { ...opts, fallbackKinds: dedupedFallbacks });
  }
  function getColor(token, fallback) {
    const profile = getActiveProfile();
    const value = readColorToken(profile, token);
    if (typeof value === 'string' && value) return value;
    if (typeof fallback === 'string' && fallback) return fallback;
    return undefined;
  }
  function applyToDocument(doc) {
    const targetDoc = doc || (typeof document !== 'undefined' ? document : null);
    if (!targetDoc || !targetDoc.documentElement) return;
    const settingsApi = getSettingsApi();
    if (settingsApi && typeof settingsApi.applyToDocument === 'function') {
      try {
        settingsApi.applyToDocument(targetDoc);
      } catch (_) {}
    }
    const profile = getActiveProfile();
    const root = targetDoc.documentElement;
    const style = root.style;
    root.setAttribute('data-theme-profile', profile && profile.id ? profile.id : activeProfileName);
    const map = {
      '--ui-primary': 'ui.primary',
      '--ui-secondary': 'ui.secondary',
      '--ui-hover': 'ui.hover',
      '--bead-primary': 'beads.primary.fill',
      '--bead-primary-stroke': 'beads.primary.stroke',
      '--bead-secondary': 'beads.secondary.fill',
      '--bead-secondary-stroke': 'beads.secondary.stroke',
      '--pizza-fill': 'pizza.fill',
      '--pizza-rim': 'pizza.rim',
      '--pizza-dash': 'pizza.dash',
      '--pizza-handle': 'pizza.handle',
      '--pizza-handle-stroke': 'pizza.handleStroke',
      '--dot-fill': 'dots.default',
      '--dot-highlight': 'dots.highlight',
      '--play-button': 'ui.playButton',
      '--play-button-hover': 'ui.playButtonHover',
      '--play-button-text': 'ui.playButtonText'
    };
    Object.entries(map).forEach(([cssVar, token]) => {
      const color = getColor(token);
      if (typeof color === 'string' && color) {
        style.setProperty(cssVar, color);
      } else {
        style.removeProperty(cssVar);
      }
    });
  }
  const api = {
    getActiveProfileName() {
      return activeProfileName;
    },
    getActiveProfile,
    getProfile,
    setProfile,
    listProfiles,
    getPalette(kind, count, opts) {
      const size = Number.isFinite(count) && count > 0 ? Math.trunc(count) : undefined;
      return buildPalette(kind, size, opts);
    },
    getGroupPalette(groupId, countOrOptions, maybeOpts) {
      const { count, project, fallbackKinds } = normalizeGroupPaletteOptions(countOrOptions, maybeOpts);
      if (paletteHelper && typeof paletteHelper.getGroupPalette === 'function') {
        try {
          const palette = paletteHelper.getGroupPalette(groupId, {
            project,
            count
          });
          if (Array.isArray(palette) && palette.length) {
            return ensurePalette(palette, count);
          }
        } catch (error) {
          if (typeof console !== 'undefined' && console && typeof console.error === 'function') {
            console.error('[MathVisualsTheme] Klarte ikke hente gruppepalett fra MathVisualsPalette.', error);
          }
        }
      }
      return buildGroupPalette(groupId, count, { project, fallbackKinds });
    },
    getColor,
    applyToDocument
  };
  if (paletteHelper) {
    api.palette = paletteHelper;
    api.groupPaletteHelper = paletteHelper;
  }
  if (typeof window !== 'undefined') {
    window.MathVisualsTheme = api;
  }
  applyToDocument(typeof document !== 'undefined' ? document : null);
  function handleSettingsChanged() {
    applyToDocument(typeof document !== 'undefined' ? document : null);
  }
  function handleProfileMessage(event) {
    const data = event && event.data;
    let type = undefined;
    let profileName = undefined;
    if (typeof data === 'string') {
      type = data;
    } else if (data && typeof data === 'object') {
      type = data.type;
      profileName = data.profile || data.name || data.value;
    }
    if (type !== 'math-visuals:profile-change') return;
    if (profileName) setProfile(profileName);
    applyToDocument(typeof document !== 'undefined' ? document : null);
  }
  if (typeof window !== 'undefined' && typeof window.addEventListener === 'function') {
    window.addEventListener('math-visuals:settings-changed', handleSettingsChanged);
    window.addEventListener('message', handleProfileMessage);
  }
})();
