(function (global) {
  function getThemeApi(scope) {
    const root = scope || (typeof global !== 'undefined' ? global : typeof window !== 'undefined' ? window : typeof globalThis !== 'undefined' ? globalThis : null);
    if (!root) return null;
    const theme = root.MathVisualsTheme;
    return theme && typeof theme === 'object' ? theme : null;
  }

  function getPaletteApi(scope) {
    const root = scope || (typeof global !== 'undefined' ? global : typeof window !== 'undefined' ? window : typeof globalThis !== 'undefined' ? globalThis : null);
    if (!root) return null;
    const api = root.MathVisualsPalette;
    return api && typeof api.getGroupPalette === 'function' ? api : null;
  }

  function sanitizeColor(value) {
    if (typeof value !== 'string') return null;
    const trimmed = value.trim();
    if (!trimmed) return null;
    const match = /^#?([0-9a-fA-F]{3}|[0-9a-fA-F]{4}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/.exec(trimmed);
    if (!match) return trimmed.startsWith('var(') ? trimmed : null;
    let hex = match[1];
    if (hex.length === 3) {
      hex = hex.split('').map(ch => ch + ch).join('');
    } else if (hex.length === 4) {
      hex = hex
        .split('')
        .slice(0, 3)
        .map(ch => ch + ch)
        .join('');
    } else if (hex.length === 8) {
      hex = hex.slice(0, 6);
    }
    return `#${hex.toLowerCase()}`;
  }

  function sanitizePalette(values) {
    if (!Array.isArray(values)) return [];
    const out = [];
    for (const value of values) {
      const sanitized = sanitizeColor(value);
      if (sanitized) {
        out.push(sanitized);
      }
    }
    return out;
  }

  function ensurePalette(base, fallback, count) {
    const basePalette = sanitizePalette(base);
    const fallbackPalette = sanitizePalette(fallback);
    if (!Number.isFinite(count) || count <= 0) {
      if (basePalette.length) return basePalette.slice();
      if (fallbackPalette.length) return fallbackPalette.slice();
      return basePalette.length ? basePalette.slice() : fallbackPalette.slice();
    }
    const size = Math.max(1, Math.trunc(count));
    const result = [];
    for (let index = 0; index < size; index += 1) {
      const primary = basePalette[index];
      if (typeof primary === 'string' && primary) {
        result.push(primary);
        continue;
      }
      if (fallbackPalette.length) {
        const fallbackColor = fallbackPalette[index % fallbackPalette.length];
        if (typeof fallbackColor === 'string' && fallbackColor) {
          result.push(fallbackColor);
          continue;
        }
      }
      if (basePalette.length) {
        const cycled = basePalette[index % basePalette.length];
        if (typeof cycled === 'string' && cycled) {
          result.push(cycled);
        }
      }
    }
    if (!result.length && fallbackPalette.length) {
      result.push(fallbackPalette[0]);
    }
    return result;
  }

  function resolveGroupPalette(options) {
    const opts = options && typeof options === 'object' ? options : {};
    const groupId = typeof opts.groupId === 'string' ? opts.groupId.trim().toLowerCase() : '';
    if (!groupId) {
      return ensurePalette(opts.fallback, opts.fallback, opts.count);
    }
    const count = Number.isFinite(opts.count) && opts.count > 0 ? Math.trunc(opts.count) : undefined;
    const fallback = Array.isArray(opts.fallback) ? opts.fallback : [];
    const project = typeof opts.project === 'string' && opts.project ? opts.project : undefined;
    const paletteApi = getPaletteApi();
    let palette = null;
    if (paletteApi) {
      try {
        palette = paletteApi.getGroupPalette(groupId, {
          count,
          project,
          settings: opts.settings
        });
      } catch (_) {
        palette = null;
      }
    }
    if (!Array.isArray(palette) || !palette.length) {
      const theme = getThemeApi();
      if (theme && typeof theme.getGroupPalette === 'function') {
        try {
          palette = theme.getGroupPalette(groupId, count, project ? { project } : undefined);
        } catch (_) {
          palette = null;
        }
      }
    }
    if ((!Array.isArray(palette) || !palette.length) && opts.legacyPaletteId) {
      const theme = getThemeApi();
      if (theme && typeof theme.getPalette === 'function') {
        try {
          palette = theme.getPalette(opts.legacyPaletteId, count, {
            fallbackKinds: Array.isArray(opts.fallbackKinds) ? opts.fallbackKinds : undefined,
            project
          });
        } catch (_) {
          palette = null;
        }
      }
    }
    return ensurePalette(palette, fallback, count);
  }

  const api = {
    resolve: resolveGroupPalette,
    ensure: ensurePalette
  };

  if (typeof global !== 'undefined' && global && typeof global === 'object') {
    global.MathVisualsGroupPalette = api;
  }
  if (typeof window !== 'undefined' && window && typeof window === 'object') {
    window.MathVisualsGroupPalette = api;
  }
  if (typeof globalThis !== 'undefined' && globalThis && typeof globalThis === 'object') {
    globalThis.MathVisualsGroupPalette = api;
  }
  if (typeof module !== 'undefined' && module && module.exports) {
    module.exports = api;
  }
})(typeof window !== 'undefined' ? window : typeof globalThis !== 'undefined' ? globalThis : this);
