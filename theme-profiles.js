(function () {
  const LEGACY_FRACTION_PALETTE = ['#B25FE3', '#6C1BA2', '#534477', '#873E79', '#BF4474', '#E31C3D'];
  const PROFILES = {
    kikora: {
      id: 'kikora',
      label: 'Kikora',
      palettes: {
        fractions: LEGACY_FRACTION_PALETTE,
        figures: LEGACY_FRACTION_PALETTE
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
      palettes: {
        fractions: ['#2C395B', '#C5E5E9', '#F6E5BC', '#F1D0D9', '#E2DFF1', '#E3B660'],
        figures: ['#2C395B', '#C5E5E9', '#F6E5BC', '#F1D0D9', '#E2DFF1', '#E3B660']
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
          fill: '#F6E5BC',
          rim: '#2C395B',
          dash: '#2C395B',
          handle: '#C5E5E9',
          handleStroke: '#2C395B'
        }
      }
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
    const palette = Array.isArray(base) && base.length ? base.slice() : LEGACY_FRACTION_PALETTE.slice();
    if (!Number.isFinite(count) || count <= 0) return palette.slice();
    if (palette.length >= count) return palette.slice(0, count);
    const result = palette.slice();
    for (let i = palette.length; i < count; i++) {
      result.push(palette[i % palette.length]);
    }
    return result;
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
    return activeProfileName;
  }
  function listProfiles() {
    return Object.keys(PROFILES);
  }
  function buildPalette(kind, count, opts) {
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
    window.addEventListener('message', handleProfileMessage);
  }
})();
