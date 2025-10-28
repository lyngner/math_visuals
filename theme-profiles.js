(function () {
  const SETTINGS_STORAGE_KEY = 'mathVisuals:settings';
  const LEGACY_FRACTION_PALETTE = ['#B25FE3', '#6C1BA2', '#534477', '#873E79', '#BF4474', '#E31C3D'];
  function getSettingsApi() {
    if (typeof window === 'undefined') return null;
    const api = window.MathVisualsSettings;
    return api && typeof api === 'object' ? api : null;
  }
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
      palettes: campusProfileBase.palettes,
      colors: campusProfileBase.colors
    },
    annet: {
      id: 'annet',
      label: 'Annet',
      palettes: campusProfileBase.palettes,
      colors: campusProfileBase.colors
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
    const storedActiveProject =
      stored && typeof stored.activeProject === 'string' ? stored.activeProject.trim().toLowerCase() : null;
    if (stored && typeof stored === 'object') {
      if (project && stored.projects && typeof stored.projects === 'object') {
        const projectSettings = stored.projects[project];
        if (projectSettings && Array.isArray(projectSettings.defaultColors)) {
          const sanitized = projectSettings.defaultColors.map(sanitizeUserColor).filter(Boolean);
          if (sanitized.length) {
            return ensurePalette(sanitized, count);
          }
        }
      }
      const canUseStoredDefault = project && storedActiveProject && storedActiveProject === project;
      if (canUseStoredDefault && Array.isArray(stored.defaultColors)) {
        const sanitized = stored.defaultColors.map(sanitizeUserColor).filter(Boolean);
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
    const userPalette = resolveUserPalette(count, activeProfile && activeProfile.id ? activeProfile.id : activeProfileName);
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
    getColor,
    applyToDocument
  };
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
