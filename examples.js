(function ensureVercelRedirect() {
  if (typeof window === 'undefined') return;
  if (window.__MATH_VISUALS_REDIRECT_INITIALIZED__) return;
  const { hostname, pathname, search, hash } = window.location;
  if (!hostname || !hostname.endsWith('github.io')) return;
  window.__MATH_VISUALS_REDIRECT_INITIALIZED__ = true;
  const targetOrigin = 'https://math-visuals.vercel.app';
  const repoBasePath = '/math_visuals';
  let path = typeof pathname === 'string' && pathname ? pathname : '/';
  if (!path.startsWith('/')) {
    path = `/${path}`;
  }
  const normalizedRepoPath = repoBasePath.toLowerCase();
  if (normalizedRepoPath && path.toLowerCase().startsWith(normalizedRepoPath)) {
    path = path.slice(repoBasePath.length) || '/';
  }
  if (!path.startsWith('/')) {
    path = `/${path}`;
  }
  const destination = new URL(`${path}${search || ''}${hash || ''}`, targetOrigin).toString();
  if (destination === window.location.href) return;
  try {
    window.location.replace(destination);
  } catch (_) {
    window.location.href = destination;
  }
})();

(function removeRestoreExampleButtons() {
  if (typeof document === 'undefined') return;
  const targetText = 'gjenopprett eksempler';
  const isElement = node => {
    if (typeof Node === 'undefined') return !!(node && node.nodeType === 1);
    return !!(node && node.nodeType === Node.ELEMENT_NODE);
  };
  const normalizeText = value => {
    if (typeof value !== 'string') return '';
    return value.replace(/\s+/g, ' ').trim().toLowerCase();
  };
  const shouldRemove = button => {
    if (!button) return false;
    const text = normalizeText(button.textContent || '');
    return text === targetText;
  };
  const removeButtonsIn = root => {
    let removed = false;
    if (!root) return removed;
    const process = element => {
      if (!element) return;
      if (shouldRemove(element)) {
        element.remove();
        removed = true;
      }
    };
    if (root === document || root === document.documentElement || root === document.body) {
      const buttons = document.querySelectorAll('button');
      buttons.forEach(process);
      return removed;
    }
    if (isElement(root)) {
      if (root.tagName === 'BUTTON') {
        process(root);
      }
      root.querySelectorAll && root.querySelectorAll('button').forEach(process);
    } else if (root && typeof root.querySelectorAll === 'function') {
      root.querySelectorAll('button').forEach(process);
    }
    return removed;
  };
  const removeAll = () => {
    if (!document.body) return false;
    return removeButtonsIn(document);
  };
  const initRemoval = () => {
    removeAll();
  };
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initRemoval, { once: true });
  } else {
    initRemoval();
  }
  if (typeof MutationObserver !== 'function') return;
  const observer = new MutationObserver(mutations => {
    let removed = false;
    mutations.forEach(mutation => {
      mutation.addedNodes && mutation.addedNodes.forEach(node => {
        if (removeButtonsIn(node)) removed = true;
      });
    });
    if (removed) {
      removeAll();
    }
  });
  observer.observe(document.documentElement, {
    childList: true,
    subtree: true
  });
})();

(function removeTaskDescriptionFormattingField() {
  if (typeof document === 'undefined') return;
  const TARGET_TEXT = 'Forklaring til formatering av oppgavetekst';
  const normalize = value => {
    if (typeof value !== 'string') return '';
    return value.replace(/\s+/g, ' ').trim().toLowerCase();
  };
  const targetNormalized = normalize(TARGET_TEXT);
  if (!targetNormalized) return;

  const matchesTarget = element => {
    if (!element) return false;
    const text = normalize(element.textContent || '');
    if (text && text.includes(targetNormalized)) {
      return true;
    }
    if (element.attributes && element.attributes.length) {
      for (let i = 0; i < element.attributes.length; i++) {
        const attr = element.attributes[i];
        if (!attr) continue;
        const value = normalize(attr.value || '');
        if (value && value.includes(targetNormalized)) {
          return true;
        }
      }
    }
    return false;
  };

  const removeNode = element => {
    if (!element || !element.parentNode) return;
    let container = element;
    if (typeof element.closest === 'function') {
      const closest = element.closest(
        'details, [data-description-formatting], .description-formatting, .example-description-formatting'
      );
      if (closest) container = closest;
    }
    if (container.parentNode) {
      try {
        container.parentNode.removeChild(container);
      } catch (_) {}
    }
  };

  const processRoot = root => {
    if (!root) return;
    const visited = new WeakSet();
    const walk = node => {
      if (!node || visited.has(node)) return;
      visited.add(node);
      const nodeType = node.nodeType;
      if (nodeType === 1) {
        const element = node;
        if (matchesTarget(element)) {
          removeNode(element);
          return;
        }
        if (element.shadowRoot) {
          walk(element.shadowRoot);
        }
      } else if (nodeType !== 9 && nodeType !== 11) {
        if (node.parentNode) {
          walk(node.parentNode);
        }
        return;
      }
      if (nodeType === 11 && node.host && matchesTarget(node.host)) {
        removeNode(node.host);
        return;
      }
      const children = node.childNodes;
      if (children && children.length) {
        for (let i = 0; i < children.length; i++) {
          walk(children[i]);
        }
      }
    };
    walk(root);
  };

  const init = () => {
    if (!document.body) return;
    processRoot(document.body);
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init, { once: true });
  } else {
    init();
  }

  if (typeof MutationObserver !== 'function') return;
  const observer = new MutationObserver(mutations => {
    mutations.forEach(mutation => {
      if (!mutation.addedNodes) return;
      mutation.addedNodes.forEach(node => {
        if (!node) return;
        if (node.nodeType === 1) {
          processRoot(node);
        }
      });
    });
  });
  observer.observe(document.documentElement, {
    childList: true,
    subtree: true
  });
})();

(function initGlobalSettings() {
  const globalScope = typeof window !== 'undefined' ? window : typeof globalThis !== 'undefined' ? globalThis : null;
  if (!globalScope) return;

  const DEFAULT_LINE_THICKNESS = 3;
  const MAX_COLORS = 48;
  const MIN_COLOR_SLOTS = 38;
  const FALLBACK_COLORS = [
    '#1F4DE2',
    '#475569',
    '#EF4444',
    '#0EA5E9',
    '#10B981',
    '#F59E0B',
    '#6366F1',
    '#D946EF',
    '#F97316',
    '#14B8A6',
    '#22C55E',
    '#EAB308',
    '#EC4899',
    '#8B5CF6',
    '#0EA5A5',
    '#2563EB',
    '#FACC15',
    '#F87171'
  ];
  const PROJECT_FALLBACKS = {
    campus: ['#DBE3FF', '#2C395B', '#E3B660', '#C5E5E9', '#F6E5BC', '#F1D0D9'],
    annet: ['#DBE3FF', '#2C395B', '#E3B660', '#C5E5E9', '#F6E5BC', '#F1D0D9'],
    kikora: ['#E31C3D', '#BF4474', '#873E79', '#534477', '#6C1BA2', '#B25FE3'],
    default: FALLBACK_COLORS.slice()
  };
  const DEFAULT_PROJECT = 'campus';
  const DEFAULT_PROJECT_ORDER = ['campus', 'kikora', 'annet'];
  const SETTINGS_STORAGE_KEY = 'mathVisuals:settings';

  const listeners = new Set();
  let remoteLoadPromise = null;

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
        if (out.length >= MAX_COLORS) break;
      }
    }
    return out;
  }

  function expandPalette(projectName, basePalette, minimumLength = MIN_COLOR_SLOTS) {
    const normalized = typeof projectName === 'string' ? projectName.trim().toLowerCase() : '';
    const sanitized = sanitizeColorList(basePalette);
    const fallback = PROJECT_FALLBACKS[normalized] || PROJECT_FALLBACKS.default;
    const min = Number.isInteger(minimumLength) && minimumLength > 0 ? minimumLength : 0;
    const limit = Math.min(MAX_COLORS, Math.max(sanitized.length, min));
    const result = [];
    for (let index = 0; index < limit; index += 1) {
      const color = sanitized[index] || fallback[index % fallback.length] || FALLBACK_COLORS[index % FALLBACK_COLORS.length];
      result.push(color);
    }
    if (!result.length) {
      result.push(FALLBACK_COLORS[0]);
    }
    return result;
  }

  function clampLineThickness(value) {
    const num = Number.parseFloat(value);
    if (!Number.isFinite(num)) return DEFAULT_LINE_THICKNESS;
    if (num < 1) return 1;
    if (num > 12) return 12;
    return Math.round(num);
  }

  function ensureColorCount(base, count) {
    const palette = Array.isArray(base) && base.length ? base.slice() : FALLBACK_COLORS.slice();
    if (!Number.isFinite(count) || count <= 0) {
      return palette.slice();
    }
    const result = [];
    for (let i = 0; i < count; i += 1) {
      result.push(palette[i % palette.length]);
    }
    return result;
  }

  function resolveProjectName(name, projects) {
    const collection = projects && typeof projects === 'object' ? projects : null;
    if (typeof name === 'string') {
      const normalized = name.trim().toLowerCase();
      if (normalized && collection && collection[normalized]) {
        return normalized;
      }
    }
    if (collection && collection[DEFAULT_PROJECT]) {
      return DEFAULT_PROJECT;
    }
    if (collection) {
      const keys = Object.keys(collection);
      if (keys.length) return keys[0];
    }
    return DEFAULT_PROJECT;
  }

  function buildDefaultProjects() {
    const projects = {};
    Object.keys(PROJECT_FALLBACKS).forEach(name => {
      if (name === 'default') return;
      projects[name] = {
        defaultColors: expandPalette(name, PROJECT_FALLBACKS[name])
      };
    });
    return projects;
  }

  function cloneProjects(projects) {
    const out = {};
    if (!projects || typeof projects !== 'object') return out;
    Object.keys(projects).forEach(name => {
      const entry = projects[name];
      if (!entry || typeof entry !== 'object') return;
      out[name] = {
        defaultColors: Array.isArray(entry.defaultColors)
          ? expandPalette(name, entry.defaultColors)
          : expandPalette(name, PROJECT_FALLBACKS[name] || PROJECT_FALLBACKS.default),
        defaultLineThickness:
          entry.defaultLineThickness != null ? clampLineThickness(entry.defaultLineThickness) : undefined
      };
    });
    return out;
  }

  function normalizeSettings(value) {
    const input = value && typeof value === 'object' ? value : {};
    const rawProjects = input.projects && typeof input.projects === 'object' ? input.projects : null;
    const projects = buildDefaultProjects();
    const order = DEFAULT_PROJECT_ORDER.slice();

    if (rawProjects) {
      Object.keys(rawProjects).forEach(name => {
        const normalized = typeof name === 'string' ? name.trim().toLowerCase() : '';
        if (!normalized) return;
        const source = rawProjects[name];
        const target = projects[normalized] ? projects[normalized] : { defaultColors: [] };
        if (!projects[normalized]) {
          projects[normalized] = target;
        }
        if (source && Array.isArray(source.defaultColors)) {
          const colors = sanitizeColorList(source.defaultColors);
          if (colors.length) {
            target.defaultColors = expandPalette(normalized, colors);
          } else if (!target.defaultColors || !target.defaultColors.length) {
            const fallback = PROJECT_FALLBACKS[normalized] || PROJECT_FALLBACKS.default;
            target.defaultColors = expandPalette(normalized, fallback);
          }
        }
        if (source && source.defaultLineThickness != null) {
          target.defaultLineThickness = clampLineThickness(source.defaultLineThickness);
        }
        if (!order.includes(normalized)) {
          order.push(normalized);
        }
      });
    }

    if (Array.isArray(input.defaultColors)) {
      const legacy = sanitizeColorList(input.defaultColors);
      if (legacy.length) {
        const projectName = resolveProjectName(input.activeProject || input.project || input.defaultProject, projects);
        projects[projectName] = projects[projectName] || { defaultColors: [] };
        projects[projectName].defaultColors = expandPalette(projectName, legacy);
        if (!order.includes(projectName)) {
          order.push(projectName);
        }
      }
    }

    const activeProject = resolveProjectName(input.activeProject || input.project || input.defaultProject, projects);
    const defaultLineThickness =
      input.defaultLineThickness != null ? clampLineThickness(input.defaultLineThickness) : DEFAULT_LINE_THICKNESS;

    const normalized = {
      version: 1,
      projects,
      activeProject,
      defaultLineThickness,
      projectOrder: order,
      updatedAt: new Date().toISOString()
    };

    const active = projects[activeProject];
    const palette = expandPalette(
      activeProject,
      active && Array.isArray(active.defaultColors) && active.defaultColors.length
        ? active.defaultColors
        : PROJECT_FALLBACKS.default
    );
    normalized.defaultColors = palette;
    return normalized;
  }

  const DEFAULT_SETTINGS = normalizeSettings({
    projects: buildDefaultProjects(),
    activeProject: DEFAULT_PROJECT,
    defaultLineThickness: DEFAULT_LINE_THICKNESS
  });

  function cloneSettings(source) {
    const target = source && typeof source === 'object' ? source : settings;
    try {
      return JSON.parse(JSON.stringify(target));
    } catch (_) {
      return normalizeSettings(target);
    }
  }

  let settings = cloneSettings(DEFAULT_SETTINGS);
  let activeProject = settings.activeProject;

  function getProjectPalette(name) {
    const resolved = resolveProjectName(name || activeProject, settings.projects);
    const project = settings.projects[resolved];
    if (project && Array.isArray(project.defaultColors) && project.defaultColors.length) {
      return expandPalette(resolved, project.defaultColors);
    }
    const fallback = PROJECT_FALLBACKS[resolved] || PROJECT_FALLBACKS.default;
    return expandPalette(resolved, fallback);
  }

  function parseInlineStyle(element) {
    const map = new Map();
    if (!element || typeof element.getAttribute !== 'function') return map;
    const raw = element.getAttribute('style');
    if (!raw || typeof raw !== 'string') return map;
    raw
      .split(';')
      .map(chunk => chunk.trim())
      .filter(Boolean)
      .forEach(chunk => {
        const separatorIndex = chunk.indexOf(':');
        if (separatorIndex === -1) return;
        const prop = chunk.slice(0, separatorIndex).trim();
        const value = chunk.slice(separatorIndex + 1).trim();
        if (prop) {
          map.set(prop, value);
        }
      });
    return map;
  }

  function serializeInlineStyle(map) {
    return Array.from(map.entries())
      .map(([prop, value]) => `${prop}: ${value}`)
      .join('; ');
  }

  function applyToDocument(doc) {
    const targetDoc = doc || (typeof document !== 'undefined' ? document : null);
    if (!targetDoc || !targetDoc.documentElement) return;
    const root = targetDoc.documentElement;
    const style = root.style;
    const canUseNativeStyle = style && typeof style.setProperty === 'function' && typeof style.removeProperty === 'function';
    const inlineStyle = canUseNativeStyle ? null : parseInlineStyle(root);
    const setStyleProperty = (name, value) => {
      if (canUseNativeStyle) {
        style.setProperty(name, value);
      } else if (inlineStyle) {
        inlineStyle.set(name, value);
      }
    };
    const removeStyleProperty = name => {
      if (canUseNativeStyle) {
        style.removeProperty(name);
      } else if (inlineStyle) {
        inlineStyle.delete(name);
      }
    };
    const basePalette = getProjectPalette(activeProject);
    const palette = ensureColorCount(basePalette, Math.max(basePalette.length, FALLBACK_COLORS.length));
    const limit = Math.max(palette.length, FALLBACK_COLORS.length);
    for (let i = 0; i < limit; i += 1) {
      const color = palette[i % palette.length];
      if (color) {
        setStyleProperty(`--mv-default-color-${i + 1}`, color);
      } else {
        removeStyleProperty(`--mv-default-color-${i + 1}`);
      }
    }
    setStyleProperty('--mv-default-line-thickness', String(settings.defaultLineThickness));
    if (!canUseNativeStyle && inlineStyle && typeof root.setAttribute === 'function') {
      const serialized = serializeInlineStyle(inlineStyle);
      if (serialized) {
        root.setAttribute('style', serialized);
      } else {
        root.removeAttribute('style');
      }
    }
    if (typeof activeProject === 'string' && activeProject) {
      root.setAttribute('data-mv-active-project', activeProject);
    }
  }

  function notifyChange(options) {
    applyToDocument(typeof document !== 'undefined' ? document : null);
    const snapshot = cloneSettings();
    listeners.forEach(listener => {
      try {
        listener(snapshot);
      } catch (_) {}
    });
    if (!options || options.emitEvent !== false) {
      try {
        if (globalScope && typeof globalScope.dispatchEvent === 'function' && typeof CustomEvent === 'function') {
          globalScope.dispatchEvent(new CustomEvent('math-visuals:settings-changed', { detail: { settings: snapshot } }));
        }
      } catch (_) {}
    }
  }

  function buildPersistPayload(next) {
    return {
      version: next && next.version ? next.version : 1,
      activeProject: next && next.activeProject ? next.activeProject : activeProject,
      defaultLineThickness: next && next.defaultLineThickness != null ? clampLineThickness(next.defaultLineThickness) : settings.defaultLineThickness,
      projects: cloneProjects(next && next.projects ? next.projects : settings.projects)
    };
  }

  function resolveApiUrl() {
    if (!globalScope) return null;
    if (globalScope.MATH_VISUALS_SETTINGS_API_URL) {
      const hint = String(globalScope.MATH_VISUALS_SETTINGS_API_URL).trim();
      if (hint) return hint;
    }
    const origin = globalScope.location && globalScope.location.origin;
    if (typeof origin === 'string' && /^https?:/i.test(origin)) {
      return '/api/settings';
    }
    return null;
  }

  function persistSettings(next) {
    const url = resolveApiUrl();
    if (!url || typeof globalScope.fetch !== 'function') {
      return Promise.resolve();
    }
    const payload = buildPersistPayload(next);
    return globalScope
      .fetch(url, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify(payload)
      })
      .then(response => {
        if (!response || !response.ok) {
          throw new Error('Failed to persist settings');
        }
        return response
          .json()
          .catch(() => null)
          .then(data => (data && typeof data === 'object' && data.settings ? data.settings : data));
      })
      .then(remote => {
        if (!remote || typeof remote !== 'object') return;
        settings = normalizeSettings(remote);
        activeProject = settings.activeProject;
        notifyChange({ emitEvent: true });
      })
      .catch(error => {
        console.error(error);
      });
  }

  function commitSettings(next, options) {
    settings = normalizeSettings(next);
    activeProject = settings.activeProject;
    if (!options || options.persist !== false) {
      persistSettings(settings);
    }
    if (!options || options.notify !== false) {
      notifyChange({ emitEvent: !options || options.emitEvent !== false });
    }
    return cloneSettings();
  }

  function getDefaultColors(count, opts) {
    const size = Number.isFinite(count) && count > 0 ? Math.trunc(count) : undefined;
    const projectName = opts && opts.project ? resolveProjectName(opts.project, settings.projects) : activeProject;
    const palette = getProjectPalette(projectName);
    return ensureColorCount(palette, size || palette.length);
  }

  function getSettings() {
    return cloneSettings();
  }

  function mergeProjectUpdates(base, updates) {
    if (!updates || typeof updates !== 'object') return;
    Object.keys(updates).forEach(name => {
      const normalized = typeof name === 'string' ? name.trim().toLowerCase() : '';
      if (!normalized) return;
      const source = updates[name];
      if (!base[normalized]) {
        base[normalized] = { defaultColors: [] };
      }
      if (source && Array.isArray(source.defaultColors)) {
        const colors = sanitizeColorList(source.defaultColors);
        if (colors.length) {
          base[normalized].defaultColors = expandPalette(normalized, colors);
        } else if (source.defaultColors.length === 0) {
          base[normalized].defaultColors = [];
        }
      }
      if (source && source.defaultLineThickness != null) {
        base[normalized].defaultLineThickness = clampLineThickness(source.defaultLineThickness);
      }
    });
  }

  function setSettings(next) {
    return commitSettings(next, { persist: true, notify: true });
  }

  function updateSettings(patch) {
    const merged = cloneSettings(settings);
    if (patch && typeof patch === 'object') {
      if (patch.defaultLineThickness != null) {
        merged.defaultLineThickness = clampLineThickness(patch.defaultLineThickness);
      }
      if (Array.isArray(patch.defaultColors)) {
        const colors = sanitizeColorList(patch.defaultColors);
        const targetProject = resolveProjectName(patch.activeProject || activeProject, merged.projects);
        merged.projects[targetProject] = merged.projects[targetProject] || {};
        if (colors.length) {
          merged.projects[targetProject].defaultColors = expandPalette(targetProject, colors);
        } else if (patch.defaultColors.length === 0) {
          merged.projects[targetProject].defaultColors = [];
        }
      }
      if (patch.projects) {
        mergeProjectUpdates(merged.projects, patch.projects);
      }
      if (patch.activeProject) {
        merged.activeProject = resolveProjectName(patch.activeProject, merged.projects);
      }
    }
    return commitSettings(merged, { persist: true, notify: true });
  }

  function resetSettings() {
    return commitSettings(DEFAULT_SETTINGS, { persist: true, notify: true });
  }

  function getDefaultLineThickness() {
    return settings.defaultLineThickness;
  }

  function subscribe(callback) {
    if (typeof callback !== 'function') {
      return () => {};
    }
    listeners.add(callback);
    return () => {
      listeners.delete(callback);
    };
  }

  function setActiveProject(name, options) {
    const resolved = resolveProjectName(name, settings.projects);
    if (resolved === activeProject) {
      if (!options || options.notify !== false) {
        notifyChange({ emitEvent: !options || options.emitEvent !== false });
      }
      return resolved;
    }
    activeProject = resolved;
    settings.activeProject = resolved;
    settings.defaultColors = getProjectPalette(resolved);
    if (!options || options.notify !== false) {
      notifyChange({ emitEvent: !options || options.emitEvent !== false });
    }
    if (options && options.persist) {
      persistSettings(settings);
    }
    return resolved;
  }

  function getActiveProject() {
    return activeProject;
  }

  function listProjects() {
    return Array.isArray(settings.projectOrder) ? settings.projectOrder.slice() : Object.keys(settings.projects);
  }

  function getProjectSettings(name) {
    const resolved = resolveProjectName(name, settings.projects);
    const project = settings.projects[resolved];
    if (!project || typeof project !== 'object') {
      return { defaultColors: [] };
    }
    try {
      return JSON.parse(JSON.stringify(project));
    } catch (_) {
      return {
        defaultColors: Array.isArray(project.defaultColors) ? project.defaultColors.slice() : [],
        defaultLineThickness:
          project.defaultLineThickness != null ? clampLineThickness(project.defaultLineThickness) : undefined
      };
    }
  }

  function loadFromRemote(options) {
    const opts = options && typeof options === 'object' ? options : {};
    if (remoteLoadPromise && !opts.force) {
      return remoteLoadPromise;
    }
    const url = resolveApiUrl();
    if (!url || typeof globalScope.fetch !== 'function') {
      remoteLoadPromise = Promise.resolve(cloneSettings());
      return remoteLoadPromise;
    }
    remoteLoadPromise = globalScope
      .fetch(url, { headers: { Accept: 'application/json' } })
      .then(response => {
        if (!response || !response.ok) {
          throw new Error('Failed to load settings');
        }
        return response
          .json()
          .catch(() => null)
          .then(data => (data && typeof data === 'object' && data.settings ? data.settings : data));
      })
      .then(remote => {
        if (!remote || typeof remote !== 'object') return cloneSettings();
        settings = normalizeSettings(remote);
        activeProject = settings.activeProject;
        if (opts.notify !== false) {
          notifyChange({ emitEvent: opts.emitEvent !== false });
        }
        return cloneSettings();
      })
      .catch(error => {
        console.error(error);
        return cloneSettings();
      })
      .finally(() => {
        remoteLoadPromise = null;
      });
    return remoteLoadPromise;
  }

  const settingsApi =
    globalScope.MathVisualsSettings && typeof globalScope.MathVisualsSettings === 'object'
      ? globalScope.MathVisualsSettings
      : {};
  const paletteHelper =
    globalScope.MathVisualsPalette && typeof globalScope.MathVisualsPalette.getGroupPalette === 'function'
      ? globalScope.MathVisualsPalette
      : typeof require === 'function'
      ? (() => {
          try {
            return require('./theme/palette.js');
          } catch (_) {
            return null;
          }
        })()
      : null;

  settingsApi.getSettings = () => getSettings();
  settingsApi.setSettings = next => setSettings(next);
  settingsApi.updateSettings = patch => updateSettings(patch);
  settingsApi.resetSettings = () => resetSettings();
  settingsApi.getDefaultColors = (count, opts) => getDefaultColors(count, opts);
  settingsApi.getDefaultLineThickness = () => getDefaultLineThickness();
  settingsApi.subscribe = callback => subscribe(callback);
  settingsApi.applyToDocument = doc => applyToDocument(doc);
  settingsApi.ensureColorCount = (base, count) => ensureColorCount(base, count);
  settingsApi.sanitizeColor = value => sanitizeColor(value);
  settingsApi.sanitizeColorList = values => sanitizeColorList(values);
  settingsApi.defaults = () => cloneSettings(DEFAULT_SETTINGS);
  settingsApi.fallbackColors = FALLBACK_COLORS.slice();
  settingsApi.STORAGE_KEY = SETTINGS_STORAGE_KEY;
  settingsApi.getActiveProject = () => getActiveProject();
  settingsApi.setActiveProject = (name, options) => setActiveProject(name, options);
  settingsApi.listProjects = () => listProjects();
  settingsApi.getProjectSettings = name => getProjectSettings(name);
  settingsApi.getGroupPalette = (groupId, countOrOptions, maybeOptions) => {
    let options = {};
    if (Number.isFinite(countOrOptions)) {
      const legacyCount = Math.trunc(countOrOptions);
      const extra = maybeOptions && typeof maybeOptions === 'object' ? maybeOptions : {};
      options = { ...extra, count: legacyCount };
    } else if (countOrOptions && typeof countOrOptions === 'object') {
      options = { ...countOrOptions };
    }
    const size = Number.isFinite(options.count) && options.count > 0 ? Math.trunc(options.count) : undefined;
    const projectName = options.project
      ? resolveProjectName(options.project, settings.projects)
      : activeProject;
    const fallbackKinds = Array.isArray(options.fallbackKinds) ? options.fallbackKinds : undefined;
    if (paletteHelper && typeof paletteHelper.getGroupPalette === 'function') {
      return paletteHelper.getGroupPalette(groupId, {
        project: projectName,
        count: size,
        fallbackKinds,
        settings: {
          projects: settings.projects,
          activeProject,
          getActiveProject: () => activeProject,
          getProjectSettings: name => getProjectSettings(name),
          getDefaultColors: (desiredCount, opt) => getDefaultColors(desiredCount, opt)
        }
      });
    }
    const basePalette = getProjectPalette(projectName);
    return ensureColorCount(basePalette, size || basePalette.length);
  };
  settingsApi.refresh = options => loadFromRemote(options);
  settingsApi.getApiUrl = () => resolveApiUrl();

  globalScope.MathVisualsSettings = settingsApi;

  notifyChange({ emitEvent: true });
  loadFromRemote({ notify: true }).catch(() => {});
})();

(function () {
  const globalScope = typeof window !== 'undefined' ? window : typeof globalThis !== 'undefined' ? globalThis : null;
  const DEFAULT_APP_MODE = 'default';
  const APP_MODE_ALIASES = {
    task: 'task',
    tasks: 'task',
    oppgave: 'task',
    oppgaver: 'task',
    oppgavemodus: 'task',
    student: 'task',
    elev: 'task',
    default: DEFAULT_APP_MODE,
    standard: DEFAULT_APP_MODE,
    teacher: DEFAULT_APP_MODE,
    undervisning: DEFAULT_APP_MODE,
    edit: DEFAULT_APP_MODE,
    rediger: DEFAULT_APP_MODE,
    author: DEFAULT_APP_MODE,
    editor: DEFAULT_APP_MODE
  };
  const originalSplitSideWidths = new WeakMap();
  let currentAppMode = DEFAULT_APP_MODE;
  let lastAppliedAppMode = null;
  let splitterObserver = null;
  let splitterObserverStarted = false;
  let taskModeDescriptionRenderRetryScheduled = false;
  function normalizeAppMode(value) {
    if (typeof value !== 'string') return null;
    const trimmed = value.trim().toLowerCase();
    if (!trimmed) return null;
    if (APP_MODE_ALIASES[trimmed]) return APP_MODE_ALIASES[trimmed];
    if (trimmed === 'task-mode') return 'task';
    return null;
  }
  function adjustSplitLayoutForMode(isTaskMode) {
    if (typeof document === 'undefined') return;
    const grids = document.querySelectorAll('.grid');
    grids.forEach(grid => {
      if (!(grid instanceof HTMLElement)) return;
      const side = grid.querySelector('.side');
      if (!side) return;
      if (isTaskMode) {
        if (!originalSplitSideWidths.has(grid)) {
          const rect = side.getBoundingClientRect();
          if (rect && Number.isFinite(rect.width) && rect.width > 0) {
            originalSplitSideWidths.set(grid, `${Math.round(rect.width)}px`);
          } else {
            const current = grid.style.getPropertyValue('--side-width');
            originalSplitSideWidths.set(grid, current || '');
          }
        }
        grid.style.setProperty('--side-width', 'min(360px, 100%)');
      } else if (originalSplitSideWidths.has(grid)) {
        const previous = originalSplitSideWidths.get(grid);
        originalSplitSideWidths.delete(grid);
        if (previous) {
          grid.style.setProperty('--side-width', previous);
        } else {
          grid.style.removeProperty('--side-width');
        }
      } else {
        grid.style.removeProperty('--side-width');
      }
    });
  }
  let pendingAppModeForBody = null;
  let pendingAppModeApplyScheduled = false;
  let descriptionVisibilityUpdateScheduled = false;

  function scheduleDescriptionVisibilityUpdate(targetMode) {
    if (descriptionVisibilityUpdateScheduled) return;
    descriptionVisibilityUpdateScheduled = true;
    setTimeout(() => {
      descriptionVisibilityUpdateScheduled = false;
      try {
        updateDescriptionEditVisibilityForMode(targetMode);
      } catch (_) {}
    }, 0);
  }

  function applyAppMode(mode) {
    if (typeof document === 'undefined') return;
    const normalized = normalizeAppMode(mode) || DEFAULT_APP_MODE;
    const execute = targetMode => {
      if (typeof document === 'undefined') return;
      const body = document.body;
      if (!body) return;
      if (body.dataset.appMode !== targetMode) {
        body.dataset.appMode = targetMode;
      }
      const isTaskMode = targetMode === 'task';
      adjustSplitLayoutForMode(isTaskMode);
      updateDescriptionEditVisibilityForMode(targetMode);
      if (isTaskMode) {
        const raf =
          typeof window !== 'undefined' && typeof window.requestAnimationFrame === 'function'
            ? window.requestAnimationFrame
            : null;
        if (raf) {
          raf(() => adjustSplitLayoutForMode(true));
        } else {
          setTimeout(() => adjustSplitLayoutForMode(true), 16);
        }
      }
      lastAppliedAppMode = targetMode;
    };
    if (!document.body) {
      pendingAppModeForBody = normalized;
      if (!pendingAppModeApplyScheduled) {
        pendingAppModeApplyScheduled = true;
        const applyWhenReady = () => {
          pendingAppModeApplyScheduled = false;
          const target = pendingAppModeForBody != null ? pendingAppModeForBody : currentAppMode;
          pendingAppModeForBody = null;
          if (document.body) {
            execute(target);
          } else if (typeof window !== 'undefined') {
            setTimeout(applyWhenReady, 16);
          }
        };
        const schedule = () => {
          if (document.body) {
            applyWhenReady();
          } else if (typeof window !== 'undefined') {
            setTimeout(schedule, 16);
          }
        };
        if (document.readyState === 'loading') {
          document.addEventListener('DOMContentLoaded', schedule, { once: true });
        } else {
          schedule();
        }
      }
      return;
    }
    execute(normalized);
  }
  function postParentAppMode(mode) {
    if (typeof window === 'undefined') return;
    if (!window.parent || window.parent === window) return;
    try {
      window.parent.postMessage({
        type: 'math-visuals:mode-change',
        mode
      }, '*');
    } catch (error) {}
  }
  function setAppMode(mode, options) {
    const normalized = normalizeAppMode(mode) || DEFAULT_APP_MODE;
    const opts = options && typeof options === 'object' ? options : {};
    const notifyParent = opts.notifyParent !== false;
    const force = opts.force === true;
    const changed = normalized !== currentAppMode;
    currentAppMode = normalized;
    if (force || normalized !== lastAppliedAppMode) {
      applyAppMode(normalized);
    }
    if (normalized === 'task') {
      ensureTaskModeDescriptionRendered();
    }
    if (notifyParent && (changed || opts.alwaysNotify === true)) {
      postParentAppMode(normalized);
    }
    if ((changed || force) && typeof window !== 'undefined' && typeof window.dispatchEvent === 'function') {
      try {
        window.dispatchEvent(new CustomEvent('math-visuals:app-mode-changed', {
          detail: {
            mode: normalized
          }
        }));
      } catch (error) {}
    }
    return normalized;
  }
  function parseInitialAppMode() {
    if (typeof window === 'undefined') return null;
    try {
      if (typeof URLSearchParams !== 'undefined') {
        const params = new URLSearchParams(window.location && window.location.search ? window.location.search : '');
        const fromQuery = normalizeAppMode(params.get('mode'));
        if (fromQuery) return fromQuery;
      }
    } catch (error) {}
    return null;
  }
  function requestParentAppMode() {
    if (typeof window === 'undefined') return;
    if (!window.parent || window.parent === window) return;
    try {
      window.parent.postMessage({
        type: 'math-visuals:request-mode'
      }, '*');
    } catch (error) {}
  }
  function handleParentMessage(event) {
    if (!event) return;
    const data = event.data;
    if (!data || typeof data !== 'object') return;
    if (data.type === 'math-visuals:mode-change') {
      setAppMode(data.mode, {
        notifyParent: false
      });
    }
  }
  function handleLocalModeEvent(event) {
    if (!event) return;
    const detail = event.detail;
    if (!detail || typeof detail !== 'object') return;
    setAppMode(detail.mode, {
      notifyParent: detail.notifyParent !== false,
      force: detail.force === true
    });
  }
  function ensureSplitterObserver() {
    if (typeof document === 'undefined') return;
    if (typeof MutationObserver !== 'function') return;
    if (splitterObserver) return;
    splitterObserver = new MutationObserver(mutations => {
      if (currentAppMode !== 'task') return;
      let shouldAdjust = false;
      mutations.forEach(mutation => {
        if (shouldAdjust) return;
        if (!mutation.addedNodes) return;
        mutation.addedNodes.forEach(node => {
          if (shouldAdjust) return;
          if (node && node.nodeType === 1) {
            const element = node;
            if (element.classList && element.classList.contains('splitter')) {
              shouldAdjust = true;
              return;
            }
            if (element.querySelector && element.querySelector('.splitter')) {
              shouldAdjust = true;
            }
          }
        });
      });
      if (shouldAdjust) {
        adjustSplitLayoutForMode(true);
      }
    });
    const startObserving = () => {
      if (!document.body || !splitterObserver || splitterObserverStarted) return;
      splitterObserver.observe(document.body, {
        childList: true,
        subtree: true
      });
      splitterObserverStarted = true;
    };
    if (!document.body) {
      const initWhenReady = () => {
        if (document.body) {
          startObserving();
        } else if (typeof window !== 'undefined') {
          setTimeout(initWhenReady, 16);
        }
      };
      if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initWhenReady, { once: true });
      } else {
        initWhenReady();
      }
      return;
    }
    startObserving();
  }
  ensureSplitterObserver();
  const initialAppMode = parseInitialAppMode() || DEFAULT_APP_MODE;
  setAppMode(initialAppMode, {
    notifyParent: false,
    force: true
  });
  if (typeof window !== 'undefined') {
    window.addEventListener('message', handleParentMessage);
    window.addEventListener('math-visuals:set-mode', handleLocalModeEvent);
  }
  if (typeof document !== 'undefined') {
    document.addEventListener('math-visuals:set-mode', handleLocalModeEvent);
  }
  if (typeof window !== 'undefined') {
    if (window.parent && window.parent !== window) {
      const request = () => {
        requestParentAppMode();
      };
      if (document && (document.readyState === 'interactive' || document.readyState === 'complete')) {
        request();
      } else if (document) {
        document.addEventListener('DOMContentLoaded', request, {
          once: true
        });
      } else {
        request();
      }
    }
  }
  if (globalScope) {
    globalScope.mathVisuals =
      globalScope.mathVisuals && typeof globalScope.mathVisuals === 'object' ? globalScope.mathVisuals : {};
    globalScope.mathVisuals.applyAppMode = applyAppMode;
    globalScope.mathVisuals.setAppMode = (mode, options) => setAppMode(mode, options);
    globalScope.mathVisuals.getAppMode = () => currentAppMode;
    globalScope.mathVisuals.evaluateTaskInputs = () => evaluateTaskInputs();
    globalScope.mathVisuals.resetTaskInputs = () => resetTaskInputs();
    if (!globalScope.mathVisuals.settings && globalScope.MathVisualsSettings) {
      globalScope.mathVisuals.settings = globalScope.MathVisualsSettings;
    }
  }
  const STORAGE_GLOBAL_KEY = '__EXAMPLES_STORAGE__';
  function createMemoryStorage(initialData) {
    const data = new Map();
    if (initialData && typeof initialData === 'object') {
      Object.keys(initialData).forEach(key => {
        const normalized = String(key);
        const value = initialData[key];
        data.set(normalized, value == null ? 'null' : String(value));
      });
    }
    return {
      get length() {
        return data.size;
      },
      key(index) {
        if (!Number.isInteger(index) || index < 0 || index >= data.size) return null;
        let i = 0;
        for (const key of data.keys()) {
          if (i === index) return key;
          i += 1;
        }
        return null;
      },
      getItem(key) {
        if (key == null) return null;
        const normalized = String(key);
        return data.has(normalized) ? data.get(normalized) : null;
      },
      setItem(key, value) {
        if (key == null) return;
        const normalized = String(key);
        data.set(normalized, value == null ? 'null' : String(value));
      },
      removeItem(key) {
        if (key == null) return;
        data.delete(String(key));
      },
      clear() {
        data.clear();
      }
    };
  }
  let sharedMemoryStorage = null;
  function getSharedMemoryStorage() {
    if (sharedMemoryStorage && typeof sharedMemoryStorage.getItem === 'function') {
      return sharedMemoryStorage;
    }
    if (globalScope) {
      try {
        const localStore = globalScope.localStorage;
        if (
          localStore &&
          typeof localStore.getItem === 'function' &&
          typeof localStore.setItem === 'function'
        ) {
          const testKey = `${STORAGE_GLOBAL_KEY}__test__`;
          try {
            localStore.setItem(testKey, testKey);
            localStore.removeItem(testKey);
            sharedMemoryStorage = localStore;
            return sharedMemoryStorage;
          } catch (error) {
            try {
              localStore.removeItem(testKey);
            } catch (_) {}
          }
        }
      } catch (_) {}
      if (globalScope[STORAGE_GLOBAL_KEY] && typeof globalScope[STORAGE_GLOBAL_KEY].getItem === 'function') {
        sharedMemoryStorage = globalScope[STORAGE_GLOBAL_KEY];
        return sharedMemoryStorage;
      }
    }
    sharedMemoryStorage = createMemoryStorage();
    if (globalScope) {
      globalScope[STORAGE_GLOBAL_KEY] = sharedMemoryStorage;
    }
    return sharedMemoryStorage;
  }
  function storageGetItem(key) {
    if (key == null) return null;
    const store = getSharedMemoryStorage();
    if (!store || typeof store.getItem !== 'function') return null;
    try {
      return store.getItem(key);
    } catch (_) {
      return null;
    }
  }
  function storageSetItem(key, value) {
    if (key == null) return;
    const store = getSharedMemoryStorage();
    if (!store || typeof store.setItem !== 'function') return;
    try {
      store.setItem(String(key), value == null ? 'null' : String(value));
    } catch (_) {}
  }
  function storageRemoveItem(key) {
    if (key == null) return;
    const store = getSharedMemoryStorage();
    if (!store || typeof store.removeItem !== 'function') return;
    try {
      store.removeItem(String(key));
    } catch (_) {}
  }
  let updateRestoreButtonState = () => {};
  let updateActionButtonState = () => {};
  let actionButtonsBusy = false;
  let lastKnownActionButtonCount = 0;
  let setActionButtonsBusy = value => {
    actionButtonsBusy = value === true;
    if (typeof updateActionButtonState === 'function') {
      try {
        updateActionButtonState(lastKnownActionButtonCount);
      } catch (_) {}
    }
  };
  const BACKEND_FETCH_TIMEOUT_MS = 8000;

  function fetchWithTimeout(resource, options, timeoutMs) {
    if (typeof fetch !== 'function') {
      return Promise.reject(new Error('Fetch is not available'));
    }
    const opts = options && typeof options === 'object' ? { ...options } : {};
    const timeout = Number.isFinite(timeoutMs) && timeoutMs > 0 ? timeoutMs : BACKEND_FETCH_TIMEOUT_MS;
    if (typeof AbortController !== 'function' || timeout <= 0 || opts.signal) {
      return fetch(resource, opts);
    }
    const controller = new AbortController();
    const timer = setTimeout(() => {
      try {
        controller.abort();
      } catch (_) {}
    }, timeout);
    opts.signal = controller.signal;
    return fetch(resource, opts).finally(() => {
      clearTimeout(timer);
    });
  }

  function resolveExamplesApiBase() {
    if (typeof window === 'undefined') return null;
    if (window.MATH_VISUALS_EXAMPLES_API_URL) {
      const value = String(window.MATH_VISUALS_EXAMPLES_API_URL).trim();
      if (value) return value;
    }
    const { location } = window;
    if (!location || typeof location !== 'object') return null;
    const origin = typeof location.origin === 'string' && location.origin ? location.origin : null;
    if (origin && /^https?:/i.test(origin)) {
      return '/api/examples';
    }
    const protocol = typeof location.protocol === 'string' ? location.protocol : '';
    const host = typeof location.host === 'string' ? location.host : '';
    if (protocol && /^https?:$/i.test(protocol) && host) {
      return '/api/examples';
    }
    return null;
  }
  function buildExamplesApiUrl(base, path) {
    if (!base) return null;
    if (typeof window === 'undefined') {
      if (!path) return base;
      const sep = base.includes('?') ? '&' : '?';
      return `${base}${sep}path=${encodeURIComponent(path)}`;
    }
    try {
      const url = new URL(base, window.location && window.location.href ? window.location.href : undefined);
      if (path) {
        url.searchParams.set('path', path);
      }
      return url.toString();
    } catch (error) {
      if (!path) return base;
      const sep = base.includes('?') ? '&' : '?';
      return `${base}${sep}path=${encodeURIComponent(path)}`;
    }
  }
  function buildTrashApiBase(base) {
    if (!base) return null;
    const trimmed = base.replace(/\/+$/, '');
    return `${trimmed}/trash`;
  }
  function buildTrashApiUrl(base) {
    if (!base) return null;
    if (typeof window === 'undefined') {
      return base;
    }
    try {
      const url = new URL(base, window.location && window.location.href ? window.location.href : undefined);
      return url.toString();
    } catch (error) {
      return base;
    }
  }
  function extractContentType(headers) {
    if (!headers) return null;
    let value = null;
    try {
      if (typeof headers.get === 'function') {
        value = headers.get('content-type') || headers.get('Content-Type');
      }
    } catch (_) {
      value = null;
    }
    if (!value && typeof headers === 'object') {
      try {
        value = headers['content-type'] || headers['Content-Type'] || null;
      } catch (_) {
        value = null;
      }
    }
    return typeof value === 'string' ? value : null;
  }
  function isJsonContentType(value) {
    if (typeof value !== 'string') return false;
    const [first] = value.split(';', 1);
    const normalized = (first || value).trim().toLowerCase();
    if (!normalized) return false;
    if (normalized === 'application/json') return true;
    if (normalized.endsWith('+json')) return true;
    if (/\bjson\b/.test(normalized)) return true;
    return false;
  }
  function responseLooksLikeJson(res) {
    if (!res) return false;
    const header = extractContentType(res.headers);
    return isJsonContentType(header);
  }
  function stripTrailingExampleSegment(path) {
    if (typeof path !== 'string') return path;
    const examplePattern = /^eksempel[-_]?\d+$/i;
    let working = path;
    while (true) {
      if (!working || working === '/') {
        return working || '/';
      }
      let trimmed = working;
      while (trimmed.length > 1 && trimmed.endsWith('/')) {
        trimmed = trimmed.slice(0, -1);
      }
      if (!trimmed || trimmed === '/') {
        return trimmed || '/';
      }
      const lastSlash = trimmed.lastIndexOf('/');
      const segment = trimmed.slice(lastSlash + 1);
      if (!examplePattern.test(segment)) {
        return trimmed;
      }
      if (lastSlash <= 0) {
        working = '/';
      } else {
        working = trimmed.slice(0, lastSlash);
      }
    }
  }
  function normalizePathname(pathname, options) {
    const preserveCase = !!(options && options.preserveCase);
    if (typeof pathname !== 'string') return '/';
    let path = pathname.trim();
    if (!path) return '/';
    if (!path.startsWith('/')) path = '/' + path;
    // Replace backslashes (possible in file:// URLs) and collapse duplicate slashes
    path = path.replace(/\+/g, '/');
    path = path.replace(/\/+/g, '/');
    // Remove trailing index.html or index.htm
    path = path.replace(/\/index\.html?$/i, '/');
    // Treat page.html and page.htm as the same canonical location as /page
    if (/\.html?$/i.test(path)) {
      path = path.replace(/\.html?$/i, '');
      if (!path) path = '/';
    }
    path = stripTrailingExampleSegment(path);
    if (path.length > 1 && path.endsWith('/')) {
      path = path.slice(0, -1);
    }
    if (!path) return '/';
    let decoded = path;
    try {
      decoded = decodeURI(path);
    } catch (_) {}
    if (!preserveCase && typeof decoded === 'string') {
      decoded = decoded.toLowerCase();
    }
    let encoded = decoded;
    try {
      encoded = encodeURI(decoded);
    } catch (_) {
      if (preserveCase) {
        encoded = path;
      } else {
        encoded = typeof path === 'string' ? path.toLowerCase() : path;
      }
    }
    if (!encoded) return '/';
    const normalized = encoded.replace(/%[0-9a-f]{2}/gi, match => match.toUpperCase());
    return normalized;
  }
  const STORAGE_KEY_PREFIX = 'examples_';

  function computeLegacyStorageKeys(rawPath, canonicalPath) {
    const prefix = STORAGE_KEY_PREFIX;
    const canonicalKey = prefix + canonicalPath;
    const paths = new Set();
    const seenCandidates = new Set();
    const addCandidate = candidate => {
      if (typeof candidate !== 'string') return;
      const trimmed = candidate.trim();
      if (!trimmed) return;
      if (seenCandidates.has(trimmed)) return;
      seenCandidates.add(trimmed);
      paths.add(trimmed);
      if (trimmed.startsWith('/') && trimmed.length > 1) {
        addCandidate(trimmed.slice(1));
      } else if (!trimmed.startsWith('/')) {
        addCandidate(`/${trimmed}`);
      }
      try {
        const normalizedSlashes = trimmed.replace(/\+/g, '/').replace(/\/+/g, '/');
        if (normalizedSlashes && normalizedSlashes !== trimmed) {
          addCandidate(normalizedSlashes);
        }
      } catch (_) {}
      if (trimmed.endsWith('/')) {
        const withoutTrailing = trimmed.replace(/\/+$/, '');
        if (withoutTrailing && withoutTrailing !== trimmed) {
          addCandidate(withoutTrailing);
        }
      }
      try {
        const parts = trimmed.split('/');
        const capitalizedParts = parts.map((segment, idx) => {
          if (!segment) return segment;
          if (idx === 0 && segment === '') return segment;
          const first = segment.charAt(0);
          if (!first) return segment;
          const upper = first.toLocaleUpperCase('nb-NO');
          if (upper === first) return segment;
          return upper + segment.slice(1);
        });
        const capitalized = capitalizedParts.join('/');
        if (capitalized && capitalized !== trimmed) {
          addCandidate(capitalized);
        }
      } catch (_) {}
      const upperEncoded = trimmed.replace(/%[0-9a-fA-F]{2}/g, match => match.toUpperCase());
      if (upperEncoded && upperEncoded !== trimmed) {
        addCandidate(upperEncoded);
      }
      const lowerEncoded = trimmed.replace(/%[0-9a-fA-F]{2}/g, match => match.toLowerCase());
      if (lowerEncoded && lowerEncoded !== trimmed) {
        addCandidate(lowerEncoded);
      }
    };
    const addPath = value => {
      if (typeof value !== 'string') return;
      const trimmed = value.trim();
      if (!trimmed) return;
      addCandidate(trimmed);
      const attemptDecoded = decoder => {
        try {
          const decoded = decoder(trimmed);
          if (decoded && decoded !== trimmed) {
            addCandidate(decoded);
            try {
              const reencoded = encodeURI(decoded);
              if (reencoded && reencoded !== trimmed) {
                addCandidate(reencoded);
              }
            } catch (_) {}
          }
        } catch (_) {}
      };
      attemptDecoded(decodeURI);
      attemptDecoded(decodeURIComponent);
    };
    addPath(rawPath);
    if (typeof rawPath === 'string') {
      const trimmed = rawPath.trim();
      if (trimmed) {
        if (trimmed.endsWith('/')) {
          const normalized = trimmed.replace(/\+/g, '/').replace(/\/+/g, '/').replace(/\/+$/, '');
          addPath(normalized);
        } else {
          addPath(trimmed + '/');
        }
        if (/index\.html?$/i.test(trimmed)) {
          addPath(trimmed.replace(/index\.html?$/i, ''));
        } else {
          const base = trimmed.endsWith('/') ? trimmed : trimmed + '/';
          addPath(base + 'index.html');
        }
      }
    }
    addPath(canonicalPath);
    if (canonicalPath && canonicalPath !== '/' && !canonicalPath.endsWith('/')) {
      addPath(canonicalPath + '/');
    }
    if (canonicalPath && canonicalPath !== '/' && !/\.html?$/i.test(canonicalPath)) {
      addPath(`${canonicalPath}.html`);
      addPath(`${canonicalPath}.htm`);
    }
    const canonicalBase = canonicalPath.endsWith('/') ? canonicalPath : `${canonicalPath}/`;
    addPath(canonicalBase + 'index.html');
    const legacyCanonicalPath = normalizePathname(rawPath, { preserveCase: true });
    if (legacyCanonicalPath && legacyCanonicalPath !== canonicalPath) {
      addPath(legacyCanonicalPath);
      if (legacyCanonicalPath !== '/' && !legacyCanonicalPath.endsWith('/')) {
        addPath(`${legacyCanonicalPath}/`);
      }
      if (legacyCanonicalPath !== '/' && !/\.html?$/i.test(legacyCanonicalPath)) {
        addPath(`${legacyCanonicalPath}.html`);
        addPath(`${legacyCanonicalPath}.htm`);
      }
      const legacyBase = legacyCanonicalPath.endsWith('/') ? legacyCanonicalPath : `${legacyCanonicalPath}/`;
      addPath(legacyBase + 'index.html');
    }
    const keys = [];
    paths.forEach(path => {
      if (!path) return;
      const key = prefix + path;
      if (key !== canonicalKey) keys.push(key);
    });
    return keys;
  }

  function storageKeyToPath(storageKey) {
    if (typeof storageKey !== 'string') return null;
    if (!storageKey.startsWith(STORAGE_KEY_PREFIX)) return null;
    const suffix = storageKey.slice(STORAGE_KEY_PREFIX.length);
    if (!suffix) return '/';
    return suffix.startsWith('/') ? suffix : `/${suffix}`;
  }
  const rawPath =
    typeof location !== 'undefined' && location && typeof location.pathname === 'string'
      ? location.pathname
      : '/';
  const storagePath = normalizePathname(rawPath);
  const key = STORAGE_KEY_PREFIX + storagePath;
  const historyKey = key + '_history';
  const trashKey = key + '_trash';
  const trashMigratedKey = key + '_trash_migrated_v1';
  const updatedAtKey = key + '_updatedAtMs';
  const OPEN_REQUEST_STORAGE_KEY = 'archive_open_request';
  const TEMPORARY_EXAMPLE_FLAG = '__isTemporaryExample';
  const TEMPORARY_EXAMPLE_REQUEST_ID = '__openRequestId';
  const TEMPORARY_EXAMPLE_SOURCE_PATH = '__openRequestSourcePath';
  const TEMPORARY_EXAMPLE_CREATED_AT = '__openRequestCreatedAt';
  const TEMPORARY_EXAMPLE_NOTICE_PENDING = '__openRequestNoticePending';
  const TEMPORARY_EXAMPLE_NOTICE_SHOWN = '__openRequestNoticeShown';
  const MAX_TRASH_ENTRIES = 200;
  const TRASH_QUEUE_STORAGE_KEY = 'mathvis:examples:trashQueue:v1';
  const MAX_HISTORY_ENTRIES = 10;
  let lastStoredRawValue = null;
  let historyEntriesCache = null;
  let historyEntriesLoaded = false;
  let trashMigrationAttempted = false;
  function parseUpdatedAtValue(value) {
    if (value == null) return 0;
    const trimmed = typeof value === 'string' ? value.trim() : '';
    if (!trimmed) return 0;
    const numeric = Number(trimmed);
    if (Number.isFinite(numeric) && numeric > 0) {
      return numeric;
    }
    const parsed = Date.parse(trimmed);
    if (Number.isFinite(parsed) && parsed > 0) {
      return parsed;
    }
    return 0;
  }
  function loadPersistedUpdatedAt() {
    let raw = null;
    try {
      raw = storageGetItem(updatedAtKey);
    } catch (_) {
      raw = null;
    }
    return parseUpdatedAtValue(raw);
  }
  function persistLocalUpdatedAt(value) {
    if (!Number.isFinite(value) || value <= 0) {
      try {
        storageRemoveItem(updatedAtKey);
      } catch (_) {}
      return;
    }
    try {
      storageSetItem(updatedAtKey, String(value));
    } catch (_) {}
  }
  function normalizeHistoryEntry(entry) {
    if (!entry || typeof entry !== 'object') return null;
    const raw = typeof entry.data === 'string' ? entry.data.trim() : '';
    if (!raw) return null;
    const normalized = {
      data: raw,
      reason: typeof entry.reason === 'string' && entry.reason.trim() ? entry.reason.trim() : 'unknown',
      savedAt: typeof entry.savedAt === 'string' && entry.savedAt.trim() ? entry.savedAt.trim() : new Date().toISOString()
    };
    return normalized;
  }
  function loadHistoryEntries() {
    if (historyEntriesLoaded) return historyEntriesCache || [];
    historyEntriesLoaded = true;
    historyEntriesCache = [];
    let rawHistory = null;
    try {
      rawHistory = storageGetItem(historyKey);
    } catch (_) {
      rawHistory = null;
    }
    if (typeof rawHistory === 'string' && rawHistory.trim()) {
      try {
        const parsed = JSON.parse(rawHistory);
        if (Array.isArray(parsed)) {
          const entries = [];
          parsed.forEach(item => {
            const normalized = normalizeHistoryEntry(item);
            if (normalized) entries.push(normalized);
          });
          historyEntriesCache = entries.slice(0, MAX_HISTORY_ENTRIES);
        }
      } catch (_) {
        historyEntriesCache = [];
      }
    }
    return historyEntriesCache;
  }
  function persistHistoryEntries(entries) {
    historyEntriesCache = Array.isArray(entries) ? entries.slice(0, MAX_HISTORY_ENTRIES) : [];
    historyEntriesLoaded = true;
    if (!historyEntriesCache.length) {
      try {
        storageRemoveItem(historyKey);
      } catch (_) {}
    } else {
      try {
        storageSetItem(historyKey, JSON.stringify(historyEntriesCache));
      } catch (_) {}
    }
    try {
      updateRestoreButtonState();
    } catch (_) {}
    return historyEntriesCache;
  }
  function rememberHistoryRaw(rawValue, reason) {
    if (typeof rawValue !== 'string') return;
    const trimmed = rawValue.trim();
    if (!trimmed) return;
    const existing = loadHistoryEntries();
    const entries = [];
    const seen = new Set();
    const pushEntry = (entry, defaultReason) => {
      const normalized = normalizeHistoryEntry(entry);
      if (!normalized) return;
      const key = normalized.data;
      if (seen.has(key)) return;
      seen.add(key);
      entries.push({
        data: key,
        reason: normalized.reason || defaultReason || 'unknown',
        savedAt: normalized.savedAt
      });
    };
    pushEntry({
      data: trimmed,
      reason: typeof reason === 'string' && reason.trim() ? reason.trim() : 'unknown',
      savedAt: new Date().toISOString()
    });
    existing.forEach(entry => pushEntry(entry));
    persistHistoryEntries(entries);
  }

  function deserializeTrashEntries(raw) {
    if (typeof raw !== 'string' || !raw.trim()) {
      return [];
    }
    try {
      const parsed = JSON.parse(raw);
      const value = deserializeExampleValue(parsed, new WeakMap());
      return Array.isArray(value) ? value : [];
    } catch (error) {
      return [];
    }
  }

  function deriveExampleLabel(example) {
    if (!example || typeof example !== 'object') return '';
    if (typeof example.title === 'string' && example.title.trim()) {
      return example.title.trim();
    }
    if (typeof example.exampleNumber === 'string' && example.exampleNumber.trim()) {
      return example.exampleNumber.trim();
    }
    if (typeof example.exampleNumber === 'number' && Number.isFinite(example.exampleNumber)) {
      return String(example.exampleNumber);
    }
    if (typeof example.description === 'string' && example.description.trim()) {
      const condensed = example.description.replace(/\s+/g, ' ').trim();
      if (condensed.length <= 80) return condensed;
      return `${condensed.slice(0, 77)}…`;
    }
    return '';
  }

  function generateTrashId() {
    const rand = Math.random().toString(36).slice(2, 10);
    const timestamp = Date.now().toString(36);
    return `${timestamp}-${rand}`;
  }

  function normalizeTrashEntry(entry) {
    if (!entry || typeof entry !== 'object') return null;
    const normalizedExample = entry.example && typeof entry.example === 'object' ? cloneValue(entry.example) : null;
    if (!normalizedExample) return null;
    const now = new Date().toISOString();
    const label = typeof entry.label === 'string' && entry.label.trim() ? entry.label.trim() : deriveExampleLabel(normalizedExample);
    return {
      id: typeof entry.id === 'string' && entry.id.trim() ? entry.id.trim() : generateTrashId(),
      example: normalizedExample,
      deletedAt: typeof entry.deletedAt === 'string' && entry.deletedAt.trim() ? entry.deletedAt.trim() : now,
      sourcePath: typeof entry.sourcePath === 'string' && entry.sourcePath.trim() ? entry.sourcePath.trim() : storagePath,
      sourceHref: typeof entry.sourceHref === 'string' && entry.sourceHref.trim() ? entry.sourceHref.trim() : rawPath,
      sourceTitle: typeof entry.sourceTitle === 'string' ? entry.sourceTitle : typeof document !== 'undefined' && document.title ? document.title : '',
      reason: typeof entry.reason === 'string' && entry.reason.trim() ? entry.reason.trim() : 'delete',
      removedAtIndex: Number.isInteger(entry.removedAtIndex) ? entry.removedAtIndex : null,
      label,
      importedFromHistory: entry.importedFromHistory === true
    };
  }

  function loadLegacyTrashEntries() {
    let raw = null;
    try {
      raw = storageGetItem(trashKey);
    } catch (_) {
      raw = null;
    }
    if (typeof raw !== 'string' || !raw.trim()) {
      return [];
    }
    const parsed = deserializeTrashEntries(raw);
    if (!Array.isArray(parsed)) {
      return [];
    }
    const normalized = [];
    parsed.forEach(item => {
      const normalizedEntry = normalizeTrashEntry(item);
      if (normalizedEntry) {
        normalized.push(normalizedEntry);
      }
    });
    return normalized;
  }

  function clearLegacyTrashEntries() {
    try {
      storageRemoveItem(trashKey);
    } catch (_) {}
  }

  function buildTrashPayload(entries, options) {
    const normalized = Array.isArray(entries)
      ? entries.map(normalizeTrashEntry).filter(Boolean)
      : [];
    const payload = { entries: normalized };
    if (options && options.replace === true) {
      payload.replace = true;
    }
    if (options && typeof options.mode === 'string' && options.mode.trim()) {
      payload.mode = options.mode.trim();
    }
    if (options && Number.isInteger(options.limit) && options.limit > 0) {
      payload.limit = options.limit;
    }
    return payload;
  }

  async function postTrashEntries(entries, options) {
    if (!trashApiBase) {
      return null;
    }
    if (typeof fetch !== 'function') {
      return null;
    }
    const url = buildTrashApiUrl(trashApiBase);
    if (!url) {
      return null;
    }
    const payload = buildTrashPayload(entries, options);
    if (!payload.entries.length && payload.replace !== true) {
      return null;
    }
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if (!response.ok) {
        throw new Error(`Trash API responded with ${response.status}`);
      }
      return response;
    } catch (error) {
      console.error('[examples] failed to communicate with trash API', error);
      return null;
    }
  }

  function createMemoryStorage() {
    const map = new Map();
    return {
      getItem(key) {
        if (!map.has(key)) return null;
        return map.get(key);
      },
      setItem(key, value) {
        map.set(key, String(value));
      },
      removeItem(key) {
        map.delete(key);
      }
    };
  }

  function createTrashQueueManager({ storage, storageKey = TRASH_QUEUE_STORAGE_KEY, sendEntry } = {}) {
    const resolvedStorage = storage && typeof storage.getItem === 'function' ? storage : createMemoryStorage();
    let cache = null;
    let flushPromise = null;
    const listeners = new Set();

    function emit(event) {
      if (!event || typeof event !== 'object') return;
      listeners.forEach(listener => {
        if (typeof listener !== 'function') return;
        try {
          listener(event);
        } catch (_) {}
      });
    }

    function cloneEntry(entry) {
      if (!entry || typeof entry !== 'object') return null;
      try {
        return cloneValue(entry);
      } catch (_) {
        try {
          return JSON.parse(JSON.stringify(entry));
        } catch (error) {
          return { ...entry };
        }
      }
    }

    function readQueue() {
      if (Array.isArray(cache)) {
        return cache;
      }
      let raw = null;
      try {
        raw = resolvedStorage.getItem(storageKey);
      } catch (error) {
        raw = null;
      }
      if (!raw) {
        cache = [];
        return cache;
      }
      try {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          cache = parsed.filter(item => item && typeof item === 'object');
        } else {
          cache = [];
        }
      } catch (error) {
        cache = [];
      }
      return cache;
    }

    function writeQueue(list) {
      cache = Array.isArray(list) ? list : [];
      if (!cache.length) {
        try {
          resolvedStorage.removeItem(storageKey);
        } catch (_) {}
        emit({ type: 'update', queue: [] });
        return;
      }
      try {
        resolvedStorage.setItem(storageKey, JSON.stringify(cache));
      } catch (error) {}
      emit({ type: 'update', queue: cache.map(cloneEntry).filter(Boolean) });
    }

    function normalizeMode(mode) {
      return mode === 'append' ? 'append' : 'prepend';
    }

    function normalizeEntry(entry) {
      if (!entry || typeof entry !== 'object') return null;
      const record = entry.record && typeof entry.record === 'object' ? cloneEntry(entry.record) : null;
      if (!record) return null;
      const normalized = {
        record,
        mode: normalizeMode(entry.mode),
        queuedAt:
          typeof entry.queuedAt === 'string' && entry.queuedAt.trim()
            ? entry.queuedAt.trim()
            : (() => {
                try {
                  return new Date().toISOString();
                } catch (_) {
                  return '';
                }
              })()
      };
      const limit = Number.isInteger(entry.limit) && entry.limit > 0 ? entry.limit : null;
      if (limit) {
        normalized.limit = limit;
      }
      return normalized;
    }

    function getQueueSnapshot() {
      return readQueue()
        .map(cloneEntry)
        .filter(entry => entry && typeof entry === 'object');
    }

    function enqueue(entry) {
      const normalized = normalizeEntry(entry);
      if (!normalized) return null;
      const queue = readQueue();
      queue.push(normalized);
      writeQueue(queue);
      emit({ type: 'enqueue', entry: cloneEntry(normalized), queue: getQueueSnapshot() });
      return cloneEntry(normalized);
    }

    async function flush() {
      if (flushPromise) {
        return flushPromise;
      }
      const queue = readQueue();
      if (!queue.length) {
        return { processed: 0, remaining: 0 };
      }
      if (typeof sendEntry !== 'function') {
        throw new Error('Trash queue is missing a sendEntry handler.');
      }
      let processed = 0;
      flushPromise = (async () => {
        while (queue.length) {
          const current = queue[0];
          if (!current || !current.record) {
            queue.shift();
            processed++;
            writeQueue(queue);
            continue;
          }
          try {
            await sendEntry(cloneEntry(current));
          } catch (error) {
            emit({ type: 'error', error, entry: cloneEntry(current), processed, remaining: queue.length });
            throw error;
          }
          queue.shift();
          processed++;
          writeQueue(queue);
          emit({ type: 'processed', entry: cloneEntry(current), processed, remaining: queue.length });
        }
        return { processed, remaining: queue.length };
      })();
      try {
        const result = await flushPromise;
        emit({ type: 'flushed', result, queue: getQueueSnapshot() });
        return result;
      } finally {
        flushPromise = null;
      }
    }

    function hasPending() {
      return readQueue().length > 0;
    }

    function getQueueLength() {
      return readQueue().length;
    }

    function clear() {
      writeQueue([]);
    }

    function subscribe(listener) {
      if (typeof listener !== 'function') {
        return () => {};
      }
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    }

    return {
      enqueue,
      flush,
      hasPending,
      getQueue: getQueueSnapshot,
      getQueueLength,
      clear,
      subscribe,
      storage: resolvedStorage,
      storageKey
    };
  }

  function getDefaultTrashQueueStorage() {
    if (typeof window === 'undefined' || !window.localStorage) {
      return createMemoryStorage();
    }
    try {
      const storage = window.localStorage;
      const probeKey = `${TRASH_QUEUE_STORAGE_KEY}__probe`;
      storage.setItem(probeKey, '1');
      storage.removeItem(probeKey);
      return storage;
    } catch (error) {
      return createMemoryStorage();
    }
  }

  let trashToastStyleInjected = false;
  let trashToastContainer = null;

  function ensureTrashToastContainer(doc) {
    if (!doc || typeof doc.createElement !== 'function') return null;
    if (!trashToastStyleInjected) {
      const style = doc.createElement('style');
      style.type = 'text/css';
      style.textContent =
        '.examples-trash-toast-container{position:fixed;bottom:1.5rem;right:1.5rem;display:flex;flex-direction:column;gap:0.5rem;z-index:2147483000;max-width:min(28rem,calc(100vw - 2rem));}' +
        '.examples-trash-toast{background:#1c1c1f;color:#fff;padding:0.75rem 1rem;border-radius:0.75rem;box-shadow:0 0.75rem 2rem rgba(0,0,0,0.2);font-size:0.95rem;line-height:1.4;display:flex;align-items:flex-start;gap:0.75rem;transition:opacity 200ms ease,transform 200ms ease;}' +
        '.examples-trash-toast--error{background:#b3261e;color:#fff;}' +
        '.examples-trash-toast--success{background:#0b6a0b;color:#fff;}' +
        '.examples-trash-toast--info{background:#1c1c1f;color:#fff;}' +
        '.examples-trash-toast--closing{opacity:0;transform:translateY(25%);}';
      try {
        doc.head.appendChild(style);
        trashToastStyleInjected = true;
      } catch (error) {}
    }
    if (trashToastContainer && trashToastContainer.isConnected) {
      return trashToastContainer;
    }
    const container = doc.createElement('div');
    container.className = 'examples-trash-toast-container';
    try {
      doc.body.appendChild(container);
      trashToastContainer = container;
      return container;
    } catch (error) {
      return null;
    }
  }

  function showTrashToast(message, type = 'info') {
    if (typeof document === 'undefined') {
      if (type === 'error') {
        console.error(message);
      } else {
        console.log(message);
      }
      return null;
    }
    const doc = document;
    const container = ensureTrashToastContainer(doc);
    if (!container) {
      if (type === 'error') {
        console.error(message);
      } else {
        console.log(message);
      }
      return null;
    }
    const toast = doc.createElement('div');
    toast.className = `examples-trash-toast examples-trash-toast--${type}`;
    toast.setAttribute('role', 'status');
    toast.setAttribute('aria-live', 'polite');
    toast.textContent = String(message || '');
    container.appendChild(toast);
    const timeout = setTimeout(() => {
      toast.classList.add('examples-trash-toast--closing');
      const removeTimer = setTimeout(() => {
        if (toast.isConnected) {
          toast.remove();
        }
        clearTimeout(removeTimer);
      }, 220);
    }, 6000);
    toast.addEventListener('click', () => {
      toast.classList.add('examples-trash-toast--closing');
      clearTimeout(timeout);
      setTimeout(() => {
        if (toast.isConnected) {
          toast.remove();
        }
      }, 200);
    });
    return toast;
  }

  function describeTrashQueueError(error) {
    if (!error) return 'ukjent feil';
    if (typeof error === 'string') return error;
    if (error && typeof error.message === 'string' && error.message.trim()) {
      return error.message.trim();
    }
    try {
      return JSON.stringify(error);
    } catch (_) {
      return String(error);
    }
  }

  const trashQueueManager = createTrashQueueManager({
    storage: getDefaultTrashQueueStorage(),
    sendEntry: async entry => {
      if (!entry || typeof entry !== 'object' || !entry.record) {
        return null;
      }
      const mode = entry.mode === 'append' ? 'append' : 'prepend';
      const limit = Number.isInteger(entry.limit) && entry.limit > 0 ? entry.limit : MAX_TRASH_ENTRIES;
      const response = await postTrashEntries([entry.record], { mode, limit });
      if (!response) {
        throw new Error('Kunne ikke nå tjenesten for slettede figurer.');
      }
      return response;
    }
  });

  function queueTrashEntryForRetry(entry, reason) {
    const queued = trashQueueManager.enqueue(entry);
    if (!queued) {
      showTrashToast('Kunne ikke lagre slettet eksempel for opplasting senere.', 'error');
      return;
    }
    const message =
      reason === 'flush-failed'
        ? 'Kunne ikke sende slettede figurer til arkivet. Vi prøver igjen senere.'
        : 'Kunne ikke sende slettet eksempel til arkivet. Vi prøver igjen senere.';
    showTrashToast(message, 'error');
  }

  let trashQueueRetryInitialized = false;

  function flushQueuedTrashEntries({ silent = false } = {}) {
    if (!trashQueueManager.hasPending()) {
      if (!silent) {
        showTrashToast('Ingen slettede figurer venter på opplasting.', 'info');
      }
      return Promise.resolve({ processed: 0, remaining: 0 });
    }
    return trashQueueManager
      .flush()
      .then(result => {
        if (!silent) {
          showTrashToast('Ventende slettede figurer ble sendt til arkivet.', 'success');
        }
        return result;
      })
      .catch(error => {
        if (!silent) {
          const message = describeTrashQueueError(error);
          showTrashToast(`Kunne ikke sende ventende slettinger: ${message}.`, 'error');
        }
        throw error;
      });
  }

  function ensureTrashQueueRetryListeners() {
    if (trashQueueRetryInitialized) {
      return;
    }
    if (typeof window === 'undefined') {
      return;
    }
    const retry = (silentReason = true) => {
      flushQueuedTrashEntries({ silent: silentReason !== false }).catch(() => {});
    };
    window.addEventListener('focus', () => retry(true));
    window.addEventListener('online', () => retry(true));
    if (typeof document !== 'undefined' && document) {
      document.addEventListener('visibilitychange', () => {
        if (!document.hidden) {
          retry(true);
        }
      });
      if (document.readyState === 'complete') {
        retry(true);
      } else {
        document.addEventListener(
          'DOMContentLoaded',
          () => {
            retry(true);
          },
          { once: true }
        );
      }
    } else {
      retry(true);
    }
    trashQueueRetryInitialized = true;
  }

  ensureTrashQueueRetryListeners();

  if (globalScope) {
    const publicInterface = {
      enqueue(entry) {
        return trashQueueManager.enqueue(entry);
      },
      flush(options) {
        return flushQueuedTrashEntries(options || {});
      },
      flushPending(options) {
        return flushQueuedTrashEntries(options || {});
      },
      hasPending() {
        return trashQueueManager.hasPending();
      },
      getQueue() {
        return trashQueueManager.getQueue();
      },
      getQueueLength() {
        return trashQueueManager.getQueueLength();
      },
      storageKey: TRASH_QUEUE_STORAGE_KEY,
      __isMathVisTrashQueue: true
    };
    globalScope.MathVisExamplesTrashQueue = publicInterface;
  }

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = module.exports || {};
    module.exports.createTrashQueueManager = createTrashQueueManager;
    module.exports.TRASH_QUEUE_STORAGE_KEY = TRASH_QUEUE_STORAGE_KEY;
  }

  function buildExampleSignature(example) {
    if (!example || typeof example !== 'object') return '';
    try {
      const serialized = serializeExamplesForStorage([example]);
      return serialized || '';
    } catch (error) {
      try {
        return JSON.stringify(example);
      } catch (_) {
        return '';
      }
    }
  }

  async function addExampleToTrash(example, options) {
    if (!example || typeof example !== 'object') return;
    const opts = options && typeof options === 'object' ? options : {};
    const normalizedExample = opts.preNormalized === true && example && typeof example === 'object' ? cloneValue(example) : normalizeExamplesForStorage([example])[0] || {};
    let sanitizedPreview = null;
    if (opts.capturePreview === true) {
      try {
        const previewSvg = collectExampleSvgMarkup();
        sanitizedPreview = sanitizeSvgForStorage(previewSvg);
        if (sanitizedPreview) {
          normalizedExample.svg = sanitizedPreview;
        }
      } catch (error) {
        console.error('[examples] failed to capture svg preview for trash entry', error);
      }
    }
    const thumbnailSource = sanitizedPreview || (typeof normalizedExample.svg === 'string' ? normalizedExample.svg : '');
    if (thumbnailSource) {
      try {
        const thumbnail = await generateExampleThumbnail(thumbnailSource);
        if (thumbnail) {
          normalizedExample.thumbnail = thumbnail;
        }
      } catch (error) {
        console.error('[examples] failed to generate svg thumbnail for trash entry', error);
      }
    }
    const record = normalizeTrashEntry({
      id: typeof opts.id === 'string' && opts.id.trim() ? opts.id.trim() : undefined,
      example: normalizedExample,
      deletedAt: typeof opts.deletedAt === 'string' ? opts.deletedAt : undefined,
      sourcePath: typeof opts.sourcePath === 'string' ? opts.sourcePath : storagePath,
      sourceHref: typeof opts.sourceHref === 'string' ? opts.sourceHref : rawPath,
      sourceTitle: typeof opts.sourceTitle === 'string' ? opts.sourceTitle : undefined,
      reason: typeof opts.reason === 'string' ? opts.reason : 'delete',
      removedAtIndex: Number.isInteger(opts.index) ? opts.index : null,
      label: typeof opts.label === 'string' ? opts.label : undefined,
      importedFromHistory: opts.importedFromHistory === true
    });
    if (!record) return;
    const mode = opts.prepend === false ? 'append' : 'prepend';
    try {
      const response = await postTrashEntries([record], {
        mode,
        limit: MAX_TRASH_ENTRIES
      });
      if (!response) {
        throw new Error('Trash API returned et tomt svar.');
      }
    } catch (error) {
      console.error('[examples] failed to persist trash entry', error);
      queueTrashEntryForRetry({
        record,
        mode,
        limit: MAX_TRASH_ENTRIES
      });
    }
  }

  async function ensureTrashHistoryMigration() {
    if (trashMigrationAttempted) return;
    trashMigrationAttempted = true;
    let alreadyMigrated = false;
    try {
      const marker = storageGetItem(trashMigratedKey);
      if (typeof marker === 'string' && marker.trim()) {
        alreadyMigrated = true;
      }
    } catch (_) {
      alreadyMigrated = false;
    }
    const existingTrash = loadLegacyTrashEntries();
    if (alreadyMigrated && existingTrash.length === 0) {
      return;
    }
    const working = existingTrash.slice();
    const seenSignatures = new Set();
    working.forEach(entry => {
      const signature = buildExampleSignature(entry && entry.example);
      if (signature) {
        seenSignatures.add(signature);
      }
    });
    const currentExamples = getExamples();
    const normalizedCurrent = normalizeExamplesForStorage(currentExamples);
    normalizedCurrent.forEach(example => {
      const signature = buildExampleSignature(example);
      if (signature) {
        seenSignatures.add(signature);
      }
    });
    const historyEntries = loadHistoryEntries();
    historyEntries.forEach(entry => {
      if (!entry || typeof entry.data !== 'string') return;
      const parsed = parseExamplesFromRaw(entry.data);
      if (parsed.status !== 'ok' || !Array.isArray(parsed.examples)) return;
      const normalized = normalizeExamplesForStorage(parsed.examples);
      normalized.forEach((example, idx) => {
        const signature = buildExampleSignature(example);
        if (!signature || seenSignatures.has(signature)) return;
        const record = normalizeTrashEntry({
          example,
          deletedAt: typeof entry.savedAt === 'string' ? entry.savedAt : undefined,
          reason: 'history',
          removedAtIndex: idx,
          importedFromHistory: true
        });
        if (record) {
          working.push(record);
          seenSignatures.add(signature);
        }
      });
    });
    const finalEntries = working.slice(0, MAX_TRASH_ENTRIES);
    if (trashApiBase && typeof fetch === 'function') {
      const result = await postTrashEntries(finalEntries, {
        replace: true,
        limit: MAX_TRASH_ENTRIES
      });
      if (result) {
        clearLegacyTrashEntries();
      }
    }
    try {
      storageSetItem(trashMigratedKey, new Date().toISOString());
    } catch (_) {}
  }
  function parseExamplesFromRaw(rawValue) {
    if (rawValue == null) {
      return {
        status: 'empty',
        examples: []
      };
    }
    if (typeof rawValue !== 'string') {
      return {
        status: 'invalid',
        examples: []
      };
    }
    const trimmed = rawValue.trim();
    if (!trimmed) {
      return {
        status: 'empty',
        examples: []
      };
    }
    try {
      const parsed = deserializeExamplesFromRaw(trimmed);
      if (Array.isArray(parsed)) {
        return {
          status: 'ok',
          examples: parsed
        };
      }
      return {
        status: 'invalid',
        examples: []
      };
    } catch (error) {
      return {
        status: 'error',
        error,
        examples: []
      };
    }
  }
  function getFirstRestorableHistoryEntry() {
    const entries = loadHistoryEntries();
    for (const entry of entries) {
      if (!entry || typeof entry.data !== 'string') continue;
      const parsed = parseExamplesFromRaw(entry.data);
      if (parsed.status === 'ok' && Array.isArray(parsed.examples) && parsed.examples.length > 0) {
        return {
          raw: entry.data,
          entry,
          parsed
        };
      }
    }
    return null;
  }
  function applyRawExamples(rawValue, options) {
    const opts = options && typeof options === 'object' ? options : {};
    const reason = typeof opts.reason === 'string' && opts.reason.trim() ? opts.reason.trim() : 'update';
    const skipHistory = opts.skipHistory === true;
    const normalizedRaw = typeof rawValue === 'string' ? rawValue.trim() : '';
    if (!normalizedRaw) {
      if (!skipHistory && typeof lastStoredRawValue === 'string' && lastStoredRawValue.trim()) {
        rememberHistoryRaw(lastStoredRawValue, reason);
      }
      cachedExamples = [];
      cachedExamplesInitialized = true;
      try {
        storageRemoveItem(key);
      } catch (_) {}
      lastStoredRawValue = null;
      lastLocalUpdateMs = 0;
      persistLocalUpdatedAt(0);
      try {
        updateRestoreButtonState();
      } catch (_) {}
      return true;
    }
    const parsed = parseExamplesFromRaw(normalizedRaw);
    if (parsed.status !== 'ok') {
      return false;
    }
    if (!skipHistory && typeof lastStoredRawValue === 'string' && lastStoredRawValue.trim() && lastStoredRawValue.trim() !== normalizedRaw) {
      rememberHistoryRaw(lastStoredRawValue, reason);
    }
    cachedExamples = Array.isArray(parsed.examples) ? parsed.examples : [];
    cachedExamplesInitialized = true;
    try {
      storageSetItem(key, normalizedRaw);
    } catch (_) {}
    lastStoredRawValue = normalizedRaw;
    try {
      updateRestoreButtonState();
    } catch (_) {}
    return true;
  }
  function attemptHistoryRecovery(currentRawValue) {
    const entries = loadHistoryEntries();
    if (!entries || entries.length === 0) return false;
    const currentTrimmed = typeof currentRawValue === 'string' ? currentRawValue.trim() : '';
    for (const entry of entries) {
      if (!entry || typeof entry.data !== 'string') continue;
      const candidateRaw = entry.data.trim();
      if (!candidateRaw) continue;
      const parsed = parseExamplesFromRaw(candidateRaw);
      if (parsed.status !== 'ok') continue;
      if (currentTrimmed && currentTrimmed === candidateRaw) continue;
      if (currentTrimmed) {
        rememberHistoryRaw(currentTrimmed, 'auto-recovery');
      }
      const applied = applyRawExamples(candidateRaw, {
        reason: 'auto-recovery',
        skipHistory: true
      });
      if (applied) {
        cachedExamples = Array.isArray(parsed.examples) ? parsed.examples : [];
        cachedExamplesInitialized = true;
        return true;
      }
    }
    return false;
  }
  function formatHistoryTimestamp(value) {
    if (typeof value !== 'string') return '';
    const trimmed = value.trim();
    if (!trimmed) return '';
    const date = new Date(trimmed);
    if (Number.isNaN(date.getTime())) {
      return trimmed;
    }
    try {
      return date.toLocaleString('nb-NO');
    } catch (_) {
      try {
        return date.toLocaleString();
      } catch (_) {}
    }
    try {
      return date.toISOString();
    } catch (_) {}
    return trimmed;
  }
  const legacyKeys = computeLegacyStorageKeys(rawPath, storagePath);
  try {
    let canonicalValue = storageGetItem(key);
    if (canonicalValue == null) {
      for (const legacyKey of legacyKeys) {
        const legacyValue = storageGetItem(legacyKey);
        if (legacyValue != null) {
          storageSetItem(key, legacyValue);
          canonicalValue = legacyValue;
          break;
        }
      }
    }
    if (canonicalValue != null) {
      legacyKeys.forEach(legacyKey => {
        if (legacyKey === key) return;
        try {
          const legacyValue = storageGetItem(legacyKey);
          if (legacyValue != null && legacyValue === canonicalValue) {
            storageRemoveItem(legacyKey);
          }
        } catch (_) {}
      });
      if (typeof canonicalValue === 'string') {
        lastStoredRawValue = canonicalValue;
      }
    }
    const deletedKey = key + '_deletedProvidedExamples';
    let canonicalDeletedValue = storageGetItem(deletedKey);
    if (canonicalDeletedValue == null) {
      for (const legacyKey of legacyKeys) {
        const candidate = legacyKey + '_deletedProvidedExamples';
        const legacyValue = storageGetItem(candidate);
        if (legacyValue != null) {
          storageSetItem(deletedKey, legacyValue);
          canonicalDeletedValue = legacyValue;
          break;
        }
      }
    }
    if (canonicalDeletedValue != null) {
      legacyKeys.forEach(legacyKey => {
        const candidate = legacyKey + '_deletedProvidedExamples';
        try {
          const legacyValue = storageGetItem(candidate);
          if (legacyValue != null && legacyValue === canonicalDeletedValue) {
            storageRemoveItem(candidate);
          }
        } catch (_) {}
      });
    }
  } catch (_) {}
  if (lastStoredRawValue == null) {
    try {
      const initialRaw = storageGetItem(key);
      if (typeof initialRaw === 'string') {
        lastStoredRawValue = initialRaw;
      }
    } catch (_) {
      lastStoredRawValue = null;
    }
  }
  const examplesApiBase = resolveExamplesApiBase();
  const trashApiBase = examplesApiBase ? buildTrashApiBase(examplesApiBase) : null;

  function normalizeBackendStoreMode(value) {
    if (typeof value !== 'string') return null;
    const normalized = value.trim().toLowerCase();
    if (!normalized) return null;
    if (normalized === 'kv' || normalized === 'vercel-kv') return 'kv';
    if (normalized === 'memory' || normalized === 'mem' || normalized === 'unconfigured') return 'memory';
    return null;
  }

  function readStoreModeFromHeadersLike(headers) {
    if (!headers) return null;
    try {
      if (typeof headers.get === 'function') {
        const value = headers.get('X-Examples-Store-Mode');
        const normalized = normalizeBackendStoreMode(value);
        if (normalized) return normalized;
      }
    } catch (_) {}
    try {
      const direct = headers['X-Examples-Store-Mode'] || headers['x-examples-store-mode'];
      const normalized = normalizeBackendStoreMode(direct);
      if (normalized) return normalized;
    } catch (_) {}
    return null;
  }

  function readStoreModeFromPayload(payload) {
    if (!payload || typeof payload !== 'object') return null;
    const direct = normalizeBackendStoreMode(
      payload.mode || payload.storage || payload.storageMode || payload.storeMode
    );
    if (direct) return direct;
    if (Array.isArray(payload.entries)) {
      for (const entry of payload.entries) {
        const entryMode = readStoreModeFromPayload(entry);
        if (entryMode) return entryMode;
      }
    }
    return null;
  }

  function resolveStoreModeFromResponse(res, payload) {
    const headerMode = readStoreModeFromHeadersLike(res && res.headers);
    if (headerMode) return headerMode;
    return readStoreModeFromPayload(payload);
  }
  const BACKEND_STORAGE_MODE_KEY = key + '_backend_store_mode';
  let persistedBackendMode = null;
  function loadPersistedBackendMode() {
    if (!examplesApiBase) return null;
    let stored = null;
    try {
      stored = storageGetItem(BACKEND_STORAGE_MODE_KEY);
    } catch (_) {
      stored = null;
    }
    return normalizeBackendStoreMode(stored);
  }
  function persistBackendMode(mode) {
    if (!examplesApiBase) return;
    const normalized = normalizeBackendStoreMode(mode);
    if (!normalized) {
      persistedBackendMode = null;
      try {
        storageRemoveItem(BACKEND_STORAGE_MODE_KEY);
      } catch (_) {}
      return;
    }
    persistedBackendMode = normalized;
    try {
      storageSetItem(BACKEND_STORAGE_MODE_KEY, normalized);
    } catch (_) {}
  }
  persistedBackendMode = examplesApiBase ? loadPersistedBackendMode() : null;
  let backendAvailable = !examplesApiBase;
  let backendStatusKnown = !examplesApiBase;
  let backendReady = !examplesApiBase;
  let backendMode = !examplesApiBase ? 'disabled' : persistedBackendMode || null;
  let backendSyncDeferred = false;
  let applyingBackendUpdate = false;
  let backendSyncTimer = null;
  let backendSyncPromise = null;
  let backendSyncRequested = false;
  let backendNoticeElement = null;
  let backendNoticeDomReadyHandler = null;
  let backendNoticeMode = null;
  let backendUnavailableReason = null;
  let backendStatusLastMessage = '';
  let backendStatusLastType = '';

  function ensureExamplesStatusElement() {
    if (typeof document === 'undefined') return null;
    if (
      ensureExamplesStatusElement.element &&
      ensureExamplesStatusElement.element.isConnected
    ) {
      return ensureExamplesStatusElement.element;
    }
    let el = document.getElementById('examples-status');
    if (!el) {
      el = document.createElement('p');
      el.id = 'examples-status';
      el.className = 'examples-status';
      el.setAttribute('role', 'status');
      el.hidden = true;
      const host = resolveBackendNoticeHost();
      if (host && host.parentNode) {
        host.parentNode.insertBefore(el, host);
      } else if (document.body) {
        document.body.insertBefore(el, document.body.firstChild || null);
      }
    }
    ensureExamplesStatusElement.element = el;
    return el;
  }

  function setBackendStatusMessage(message, type) {
    const normalizedMessage = typeof message === 'string' ? message : '';
    const normalizedType = typeof type === 'string' ? type : '';
    if (
      normalizedMessage === backendStatusLastMessage &&
      normalizedType === backendStatusLastType
    ) {
      return;
    }
    backendStatusLastMessage = normalizedMessage;
    backendStatusLastType = normalizedType;
    const el = ensureExamplesStatusElement();
    if (!el) return;
    el.textContent = normalizedMessage;
    el.hidden = !normalizedMessage;
    if (normalizedType) {
      el.dataset.statusType = normalizedType;
    } else if (el.dataset && Object.prototype.hasOwnProperty.call(el.dataset, 'statusType')) {
      delete el.dataset.statusType;
    }
    el.classList.toggle('examples-status--error', normalizedType === 'error');
    el.classList.toggle('examples-status--warning', normalizedType === 'warning');
  }

  function applyBackendStatusMessage(mode) {
    const normalizedMode = mode === 'missing' ? 'missing' : mode === 'memory' ? 'memory' : mode === 'offline' ? 'offline' : '';
    if (!normalizedMode) {
      setBackendStatusMessage('', '');
      return;
    }
    if (normalizedMode === 'missing') {
      setBackendStatusMessage(
        'Eksempeltjenesten er ikke tilgjengelig. Fant ikke back-end (/api/examples).',
        'error'
      );
      return;
    }
    if (normalizedMode === 'memory') {
      setBackendStatusMessage(
        'Eksempeltjenesten kjører i minnemodus. Eksempler tilbakestilles ved omstart.',
        'warning'
      );
      return;
    }
    setBackendStatusMessage(
      'Kunne ikke koble til eksempeltjenesten. Endringer lagres midlertidig.',
      'warning'
    );
  }

  function resolveBackendNoticeHost() {
    if (typeof document === 'undefined') return null;
    const specific = document.querySelector('.card--examples');
    if (specific instanceof HTMLElement) return specific;
    const generic = document.querySelector('.card');
    if (generic instanceof HTMLElement) return generic;
    return document.body || null;
  }

  function hideBackendNotice() {
    if (typeof document !== 'undefined' && backendNoticeDomReadyHandler) {
      try {
        document.removeEventListener('DOMContentLoaded', backendNoticeDomReadyHandler);
      } catch (_) {}
    }
    backendNoticeDomReadyHandler = null;
    const notice = backendNoticeElement;
    if (!notice) return;
    backendNoticeElement = null;
    backendNoticeMode = null;
    try {
      if (typeof notice.remove === 'function') {
        notice.remove();
      } else if (notice.parentElement) {
        notice.parentElement.removeChild(notice);
      }
    } catch (_) {}
  }

  function showBackendNotice(mode) {
    if (typeof document === 'undefined') return;
    const normalizedMode = mode === 'memory' ? 'memory' : mode === 'missing' ? 'missing' : 'offline';
    const render = () => {
      const host = resolveBackendNoticeHost();
      if (!host) return;
      let notice = backendNoticeElement;
      if (!(notice instanceof HTMLElement)) {
        notice = document.createElement('div');
        notice.className = 'example-backend-notice';
        notice.setAttribute('role', 'alert');
        const title = document.createElement('strong');
        title.className = 'example-backend-notice__title';
        title.textContent =
          normalizedMode === 'memory'
            ? 'Midlertidig lagring'
            : normalizedMode === 'missing'
            ? 'Eksempeltjenesten mangler'
            : 'Ingen backend-tilkobling';
        const message = document.createElement('span');
        message.className = 'example-backend-notice__message';
        message.textContent =
          normalizedMode === 'memory'
            ? 'Denne instansen bruker midlertidig minnelagring. Eksempler tilbakestilles når serveren starter på nytt.'
            : normalizedMode === 'missing'
            ? 'Fant ikke eksempeltjenesten (/api/examples). Sjekk at back-end kjører med serverless-funksjoner.'
            : 'Endringer lagres midlertidig og kan gå tapt hvis siden lastes på nytt.';
        notice.appendChild(title);
        notice.appendChild(document.createTextNode(' '));
        notice.appendChild(message);
      } else {
        const title = notice.querySelector('.example-backend-notice__title');
        if (title) {
          title.textContent =
            normalizedMode === 'memory'
              ? 'Midlertidig lagring'
              : normalizedMode === 'missing'
              ? 'Eksempeltjenesten mangler'
              : 'Ingen backend-tilkobling';
        }
        const message = notice.querySelector('.example-backend-notice__message');
        if (message) {
          message.textContent =
            normalizedMode === 'memory'
              ? 'Denne instansen bruker midlertidig minnelagring. Eksempler tilbakestilles når serveren starter på nytt.'
              : normalizedMode === 'missing'
              ? 'Fant ikke eksempeltjenesten (/api/examples). Sjekk at back-end kjører med serverless-funksjoner.'
              : 'Endringer lagres midlertidig og kan gå tapt hvis siden lastes på nytt.';
        }
      }
      notice.hidden = false;
      notice.dataset.noticeMode = normalizedMode;
      if (!notice.isConnected) {
        host.insertBefore(notice, host.firstChild);
      }
      backendNoticeElement = notice;
      backendNoticeMode = normalizedMode;
    };
    if (document.readyState === 'loading') {
      if (!backendNoticeDomReadyHandler) {
        backendNoticeDomReadyHandler = () => {
          backendNoticeDomReadyHandler = null;
          render();
        };
        document.addEventListener('DOMContentLoaded', backendNoticeDomReadyHandler, { once: true });
      }
      return;
    }
    render();
  }

  function updateBackendNotice() {
    if (!examplesApiBase) {
      hideBackendNotice();
      applyBackendStatusMessage('');
      return;
    }
    if (!backendAvailable || backendMode === 'offline' || backendMode === 'missing') {
      const desiredMode =
        backendMode === 'missing' || backendUnavailableReason === 'missing' ? 'missing' : 'offline';
      if (backendNoticeMode !== desiredMode || !backendNoticeElement) {
        showBackendNotice(desiredMode);
      }
      applyBackendStatusMessage(desiredMode);
      return;
    }
    if (backendMode === 'memory') {
      if (backendNoticeMode !== 'memory' || !backendNoticeElement) {
        showBackendNotice('memory');
      }
      applyBackendStatusMessage('memory');
      return;
    }
    hideBackendNotice();
    applyBackendStatusMessage('');
  }

  function updateBackendUiState() {
    backendStatusKnown = true;
    try {
      const examples = getExamples();
      const count = Array.isArray(examples) ? examples.length : 0;
      updateActionButtonState(count);
    } catch (_) {
      updateActionButtonState(0);
    }
    updateBackendNotice();
  }

  function markBackendAvailable(mode) {
    backendAvailable = true;
    backendUnavailableReason = null;
    const resolved = normalizeBackendStoreMode(mode);
    if (resolved) {
      backendMode = resolved;
      persistBackendMode(resolved);
    } else if (backendMode && backendMode !== 'offline' && backendMode !== 'disabled') {
      persistBackendMode(backendMode);
    } else if (persistedBackendMode) {
      backendMode = persistedBackendMode;
    } else {
      backendMode = 'kv';
      persistBackendMode(backendMode);
    }
    applyBackendStatusMessage(backendMode === 'memory' ? 'memory' : '');
    updateBackendUiState();
  }
  function markBackendUnavailable(reason) {
    backendAvailable = false;
    backendUnavailableReason = typeof reason === 'string' ? reason : null;
    backendMode = reason === 'missing' ? 'missing' : 'offline';
    applyBackendStatusMessage(backendMode);
    updateBackendUiState();
  }
  function schedulePostSyncReload() {
    if (!examplesApiBase) return;
    if (typeof setTimeout !== 'function') return;
    setTimeout(() => {
      try {
        const promise = loadExamplesFromBackend();
        if (promise && typeof promise.then === 'function') {
          promise.catch(() => {});
        }
      } catch (_) {}
    }, 0);
  }
  async function performBackendSync(options) {
    if (!examplesApiBase || applyingBackendUpdate) return null;
    const opts = options && typeof options === 'object' ? options : {};
    const skipStatusUpdate = opts.skipStatusUpdate === true;
    const url = buildExamplesApiUrl(examplesApiBase, storagePath);
    if (!url) return null;
    const examples = Array.isArray(cachedExamples) ? cachedExamples : [];
    const backendExamples = normalizeBackendExamples(examples);
    const deletedSet = getDeletedProvidedExamples();
    const deletedProvidedList = deletedSet ? Array.from(deletedSet).map(normalizeKey).filter(Boolean) : [];
    const hasExamples = backendExamples.length > 0;
    const hasDeleted = deletedProvidedList.length > 0;
    const result = {
      action: null,
      payload: null,
      merged: null
    };
    try {
      const initiatedByDelete = opts.initiatedBy === 'delete';
      if (!hasExamples && !hasDeleted && !initiatedByDelete) {
        const res = await fetch(url, {
          method: 'DELETE'
        });
        if (!responseLooksLikeJson(res)) {
          markBackendUnavailable('missing');
          const missingError = new Error('Examples backend mangler');
          missingError.backendReason = 'missing';
          throw missingError;
        }
        let payload = null;
        try {
          payload = await res.json();
        } catch (_) {}
        if (res.ok || res.status === 404) {
          const mode = resolveStoreModeFromResponse(res, payload);
          markBackendAvailable(mode);
          clearLegacyExamplesStorageArtifacts();
          const merged = mergeBackendSyncPayload(payload);
          try {
            updateActionButtonState(0);
          } catch (_) {}
          result.action = 'delete';
          result.payload = payload;
          result.merged = merged;
          if (!skipStatusUpdate && pendingUserSaveReason) {
            markUserSaveSuccess(merged || payload);
          }
          return result;
        }
        const error = new Error(`Backend sync failed (${res.status})`);
        throw error;
      }
      let payloadExamples = backendExamples;
      try {
        const serializedExamples = serializeExamplesForStorage(backendExamples);
        if (typeof serializedExamples === 'string') {
          payloadExamples = JSON.parse(serializedExamples);
        }
      } catch (_) {
        payloadExamples = backendExamples;
      }
      const payload = {
        path: storagePath,
        examples: payloadExamples,
        deletedProvided: deletedProvidedList,
        updatedAt: new Date().toISOString()
      };
      const payloadMode = normalizeBackendStoreMode(backendMode) || persistedBackendMode;
      if (payloadMode) {
        payload.storage = payloadMode;
      }
      const res = await fetch(url, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });
      if (!responseLooksLikeJson(res)) {
        markBackendUnavailable('missing');
        const missingError = new Error('Examples backend mangler');
        missingError.backendReason = 'missing';
        throw missingError;
      }
      let responsePayload = null;
      try {
        responsePayload = await res.json();
      } catch (_) {
        responsePayload = null;
      }
      if (!res.ok) {
        const error = new Error(`Backend sync failed (${res.status})`);
        throw error;
      }
      const mode = resolveStoreModeFromResponse(res, responsePayload);
      markBackendAvailable(mode);
      clearLegacyExamplesStorageArtifacts();
      const merged = mergeBackendSyncPayload(responsePayload || payload);
      try {
        const finalCount =
          merged && Array.isArray(merged.examples)
            ? merged.examples.length
            : backendExamples.length;
        updateActionButtonState(finalCount);
      } catch (_) {}
      result.action = 'put';
      result.payload = responsePayload;
      result.merged = merged;
      schedulePostSyncReload();
      if (!skipStatusUpdate && pendingUserSaveReason) {
        markUserSaveSuccess((merged && merged.updatedAt) || responsePayload);
      }
      return result;
    } catch (error) {
      backendSyncRequested = true;
      if (!skipStatusUpdate && pendingUserSaveReason) {
        markUserSaveError(error);
      }
      if (!(error && error.backendReason === 'missing')) {
        markBackendUnavailable();
      }
      throw error;
    }
  }
  function flushBackendSync(options) {
    if (backendSyncTimer) {
      clearTimeout(backendSyncTimer);
      backendSyncTimer = null;
    }
    if (!examplesApiBase || applyingBackendUpdate) {
      return backendSyncPromise || null;
    }
    if (!backendSyncRequested) {
      return backendSyncPromise || null;
    }
    if (backendSyncPromise) {
      return backendSyncPromise;
    }
    backendSyncRequested = false;
    backendSyncPromise = performBackendSync(options).finally(() => {
      backendSyncPromise = null;
      if (backendSyncRequested) {
        scheduleBackendSync();
      }
    });
    return backendSyncPromise;
  }
  function shouldSkipBackendSyncForEmptyState() {
    if (localChangesSinceLoad) return false;
    if (pendingUserSaveReason) return false;
    const examples = Array.isArray(cachedExamples) ? cachedExamples : [];
    if (examples.length > 0) return false;
    const storedRaw = typeof lastStoredRawValue === 'string' ? lastStoredRawValue.trim() : '';
    if (storedRaw && storedRaw !== '[]') return false;
    return true;
  }
  function scheduleBackendSync(options) {
    if (!examplesApiBase || applyingBackendUpdate) return;
    const opts = options && typeof options === 'object' ? options : {};
    const force = opts.force === true;
    if (!force && shouldSkipBackendSyncForEmptyState()) {
      backendSyncRequested = false;
      return;
    }
    backendSyncRequested = true;
    if (backendSyncPromise) return;
    if (backendSyncTimer) return;
    backendSyncTimer = setTimeout(() => {
      backendSyncTimer = null;
      flushBackendSync();
    }, 200);
  }
  function notifyBackendChange(options) {
    if (!examplesApiBase || applyingBackendUpdate) return;
    const opts = options && typeof options === 'object' ? options : {};
    const force = opts.force === true;
    scheduleBackendSync({ force });
  }
  async function applyBackendData(data) {
    applyingBackendUpdate = true;
    try {
      const existingExamples = getExamples();
      const preservedTemporaryExamples = collectTemporaryExamplesForPreservation(existingExamples);
      const previousIndex = Number.isInteger(currentExampleIndex) ? currentExampleIndex : null;
      let examples = normalizeBackendExamples(data && data.examples);
      let backendUpdatedAtMs = 0;
      if (data && data.updatedAt != null) {
        if (typeof data.updatedAt === 'number' && Number.isFinite(data.updatedAt)) {
          backendUpdatedAtMs = data.updatedAt;
        } else {
          const parsed = Date.parse(data.updatedAt);
          if (Number.isFinite(parsed)) {
            backendUpdatedAtMs = parsed;
          }
        }
      }
      const backendHasTimestamp = backendUpdatedAtMs > 0;
      const backendIsStale = backendHasTimestamp && backendUpdatedAtMs < lastLocalUpdateMs;
      if (!backendIsStale) {
        await store(examples, {
          reason: 'backend-sync'
        });
        let restoreResult = null;
        if (preservedTemporaryExamples.length > 0) {
          try {
            restoreResult = restoreTemporaryExamplesAfterSync(preservedTemporaryExamples);
          } catch (_) {
            restoreResult = null;
          }
        }
        if (initialLoadPerformed) {
          try {
            const refreshed = (restoreResult && Array.isArray(restoreResult.examples))
              ? restoreResult.examples
              : getExamples();
            if (Array.isArray(refreshed) && refreshed.length > 0) {
              let indexToLoad = Number.isInteger(previousIndex) ? previousIndex : 0;
              if (
                restoreResult &&
                restoreResult.indexMap &&
                Number.isInteger(previousIndex) &&
                restoreResult.indexMap.has(previousIndex)
              ) {
                const mapped = restoreResult.indexMap.get(previousIndex);
                if (Number.isInteger(mapped)) {
                  indexToLoad = mapped;
                }
              }
              if (indexToLoad < 0) {
                indexToLoad = 0;
              } else if (indexToLoad >= refreshed.length) {
                indexToLoad = refreshed.length - 1;
              }
              loadExample(indexToLoad);
            } else {
              currentExampleIndex = null;
              updateTabSelection();
              setDescriptionValue('');
              if (currentAppMode === 'task') {
                ensureTaskModeDescriptionRendered();
              }
            }
          } catch (_) {}
        }
        if (backendUpdatedAtMs > lastLocalUpdateMs) {
          lastLocalUpdateMs = backendUpdatedAtMs;
          persistLocalUpdatedAt(lastLocalUpdateMs);
        }
      }
      const deletedProvided = data && Array.isArray(data.deletedProvided) ? data.deletedProvided : [];
      if (!backendIsStale) {
        deletedProvidedExamples = new Set();
        deletedProvided.forEach(value => {
          const key = normalizeKey(value);
          if (key) deletedProvidedExamples.add(key);
        });
        if (deletedProvidedExamples.size > 0) {
          storageSetItem(DELETED_PROVIDED_KEY, JSON.stringify(Array.from(deletedProvidedExamples)));
        } else {
          storageRemoveItem(DELETED_PROVIDED_KEY);
        }
      }
    } catch (error) {
      deletedProvidedExamples = deletedProvidedExamples || new Set();
    } finally {
      applyingBackendUpdate = false;
    }
  }
  async function migrateLegacyBackendEntry(legacyPath, data) {
    if (!examplesApiBase) return;
    if (!legacyPath || legacyPath === storagePath) return;
    const canonicalUrl = buildExamplesApiUrl(examplesApiBase, storagePath);
    const legacyUrl = buildExamplesApiUrl(examplesApiBase, legacyPath);
    if (!canonicalUrl || !legacyUrl) return;
    const examples = normalizeBackendExamples(data && data.examples);
    const deletedRaw = Array.isArray(data && data.deletedProvided) ? data.deletedProvided : [];
    const deletedProvidedList = deletedRaw.map(normalizeKey).filter(Boolean);
    const hasExamples = examples.length > 0;
    const hasDeleted = deletedProvidedList.length > 0;
    let canonicalOk = false;
    try {
      if (!hasExamples && !hasDeleted) {
        const deleteRes = await fetch(canonicalUrl, { method: 'DELETE' });
        canonicalOk = !!deleteRes && (deleteRes.ok || deleteRes.status === 404);
      } else {
        const payload = {
          path: storagePath,
          examples,
          deletedProvided: deletedProvidedList,
          updatedAt: new Date().toISOString()
        };
        const putRes = await fetch(canonicalUrl, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(payload)
        });
        canonicalOk = !!putRes && putRes.ok;
        if (canonicalOk) {
          clearLegacyExamplesStorageArtifacts();
        }
      }
    } catch (_) {
      canonicalOk = false;
    }
    if (!canonicalOk) return;
    try {
      const res = await fetch(legacyUrl, { method: 'DELETE' });
      if (res && (res.ok || res.status === 404)) {
        return;
      }
    } catch (_) {}
  }
  async function deleteLegacyBackendEntries(paths, skipPath) {
    if (!examplesApiBase) return;
    if (!Array.isArray(paths) || paths.length === 0) return;
    const canonicalSkips = new Set();
    const registerSkip = value => {
      if (typeof value !== 'string') return;
      const trimmed = value.trim();
      if (!trimmed) return;
      canonicalSkips.add(trimmed);
      if (!trimmed.endsWith('/')) {
        canonicalSkips.add(`${trimmed}/`);
      }
      try {
        const normalized = normalizePathname(trimmed);
        if (normalized) {
          canonicalSkips.add(normalized);
          if (!normalized.endsWith('/')) {
            canonicalSkips.add(`${normalized}/`);
          }
        }
      } catch (_) {}
    };
    const canonicalPath = typeof storagePath === 'string' ? storagePath.trim() : '';
    let normalizedStoragePath = '';
    if (canonicalPath) {
      registerSkip(canonicalPath);
      try {
        normalizedStoragePath = normalizePathname(canonicalPath);
        if (normalizedStoragePath && normalizedStoragePath !== canonicalPath) {
          registerSkip(normalizedStoragePath);
        }
      } catch (_) {
        normalizedStoragePath = '';
      }
    }
    const skipExact = typeof skipPath === 'string' ? skipPath.trim() : '';
    if (skipExact) {
      registerSkip(skipExact);
    }
    const attempted = new Set();
    const buildDeleteVariants = legacyPath => {
      const variants = [];
      const trimmed = typeof legacyPath === 'string' ? legacyPath.trim() : '';
      if (!trimmed) return variants;
      variants.push(trimmed);
      try {
        const normalized = normalizePathname(trimmed, { preserveCase: true });
        if (normalized && normalized !== trimmed) {
          variants.push(normalized);
        }
        const appendIndex = value => {
          if (!value || /\.html?$/i.test(value)) return;
          const base = value.endsWith('/') ? value : `${value}/`;
          variants.push(base + 'index.html');
        };
        appendIndex(trimmed);
        appendIndex(normalized);
      } catch (_) {}
      return variants;
    };
    for (const legacyPath of paths) {
      const candidates = buildDeleteVariants(legacyPath);
      for (const candidate of candidates) {
        if (!candidate) continue;
        const trimmedCandidate = candidate.trim();
        if (!trimmedCandidate) continue;
        if (attempted.has(trimmedCandidate)) continue;
        let normalizedCandidate = '';
        try {
          normalizedCandidate = normalizePathname(trimmedCandidate);
        } catch (_) {
          normalizedCandidate = '';
        }
        if (normalizedCandidate) {
          if (attempted.has(normalizedCandidate)) continue;
          attempted.add(normalizedCandidate);
        }
        attempted.add(trimmedCandidate);
        if (canonicalSkips.has(trimmedCandidate)) continue;
        if (normalizedCandidate && canonicalSkips.has(normalizedCandidate)) continue;
        if (normalizedStoragePath && normalizedCandidate === normalizedStoragePath) continue;
        const deleteTarget = normalizedCandidate || trimmedCandidate;
        if (!deleteTarget || canonicalSkips.has(deleteTarget)) continue;
        const legacyUrl = buildExamplesApiUrl(examplesApiBase, deleteTarget);
        if (!legacyUrl) continue;
        try {
          const res = await fetch(legacyUrl, { method: 'DELETE' });
          if (!res || (!res.ok && res.status !== 404)) {
            continue;
          }
        } catch (_) {}
      }
    }
  }
  async function migrateLegacyExamples() {
    if (!examplesApiBase) return;
    if (typeof window === 'undefined') return;
    if (hasCompletedExamplesMigration()) return;
    if (window.__EXAMPLES_MIGRATION_RUNNING__) {
      return;
    }
    window.__EXAMPLES_MIGRATION_RUNNING__ = true;
    let migrationCompleted = false;
    let shouldClearLocal = false;
    try {
      const canonicalUrl = buildExamplesApiUrl(examplesApiBase, storagePath);
      if (!canonicalUrl) {
        migrationCompleted = true;
        return;
      }
      let rawExamples = null;
      try {
        rawExamples = storageGetItem(key);
      } catch (_) {
        rawExamples = null;
      }
      let rawDeleted = null;
      try {
        rawDeleted = storageGetItem(DELETED_PROVIDED_KEY);
      } catch (_) {
        rawDeleted = null;
      }
      const parsed = parseExamplesFromRaw(rawExamples);
      const examples = parsed.status === 'ok' ? normalizeBackendExamples(parsed.examples) : [];
      const deletedProvidedList = [];
      if (typeof rawDeleted === 'string' && rawDeleted.trim()) {
        try {
          const parsedDeleted = JSON.parse(rawDeleted);
          if (Array.isArray(parsedDeleted)) {
            parsedDeleted.forEach(value => {
              const normalized = normalizeKey(value);
              if (normalized && !deletedProvidedList.includes(normalized)) {
                deletedProvidedList.push(normalized);
              }
            });
          }
        } catch (error) {
          console.warn('Examples migration: failed to parse deleted markers', error);
        }
      }
      const hasLegacyData = examples.length > 0 || deletedProvidedList.length > 0;
      if (!hasLegacyData) {
        migrationCompleted = true;
        return;
      }
      let res;
      try {
        res = await fetch(canonicalUrl, {
          headers: {
            Accept: 'application/json'
          }
        });
      } catch (error) {
        console.warn('Examples migration: failed to inspect backend state', error);
        return;
      }
      let backendEmpty = false;
      if (res && res.status === 404) {
        backendEmpty = true;
      } else if (res && res.ok) {
        try {
          const backendPayload = await res.json();
          const backendExamples = Array.isArray(backendPayload && backendPayload.examples)
            ? backendPayload.examples
            : [];
          const backendDeleted = Array.isArray(backendPayload && backendPayload.deletedProvided)
            ? backendPayload.deletedProvided
            : [];
          backendEmpty = backendExamples.length === 0 && backendDeleted.length === 0;
        } catch (error) {
          console.warn('Examples migration: failed to parse backend payload', error);
          return;
        }
        if (!backendEmpty) {
          shouldClearLocal = true;
          migrationCompleted = true;
          return;
        }
      } else {
        console.warn('Examples migration: unexpected backend response', res && res.status);
        return;
      }
      if (!backendEmpty) {
        migrationCompleted = true;
        return;
      }
      const payload = {
        path: storagePath,
        examples,
        deletedProvided: deletedProvidedList,
        updatedAt: new Date().toISOString()
      };
      let postRes;
      try {
        postRes = await fetch(examplesApiBase, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(payload)
        });
      } catch (error) {
        console.warn('Examples migration: failed to migrate legacy examples', error);
        return;
      }
      if (!postRes || !postRes.ok) {
        console.warn('Examples migration: backend rejected legacy examples', postRes && postRes.status);
        return;
      }
      shouldClearLocal = true;
      migrationCompleted = true;
    } finally {
      if (shouldClearLocal) {
        clearLegacyExamplesStorageArtifacts();
      }
      if (migrationCompleted) {
        markExamplesMigrationComplete();
      }
      delete window.__EXAMPLES_MIGRATION_RUNNING__;
    }
  }
  async function loadExamplesFromBackend() {
    if (!examplesApiBase) return null;
    const canonicalUrl = buildExamplesApiUrl(examplesApiBase, storagePath);
    if (!canonicalUrl) {
      backendReady = true;
      if (backendSyncDeferred) {
        backendSyncDeferred = false;
      }
      return null;
    }
    let backendWasEmpty = false;
    try {
      const fetchOptions = {
        headers: {
          Accept: 'application/json'
        }
      };
      const legacyPaths = [];
      const seenLegacyPaths = new Set();
      for (const legacyKey of legacyKeys) {
        const candidatePath = storageKeyToPath(legacyKey);
        if (!candidatePath || candidatePath === storagePath) continue;
        if (seenLegacyPaths.has(candidatePath)) continue;
        seenLegacyPaths.add(candidatePath);
        legacyPaths.push(candidatePath);
      }
      let res;
      try {
        res = await fetchWithTimeout(canonicalUrl, fetchOptions, BACKEND_FETCH_TIMEOUT_MS);
      } catch (error) {
        markBackendUnavailable();
        return null;
      }
      if (!responseLooksLikeJson(res)) {
        markBackendUnavailable('missing');
        return null;
      }
      let legacyPathUsed = null;
      if (res && res.status === 404 && legacyPaths.length > 0) {
        for (const legacyPath of legacyPaths) {
          const legacyUrl = buildExamplesApiUrl(examplesApiBase, legacyPath);
          if (!legacyUrl) continue;
          let legacyRes;
          try {
            legacyRes = await fetchWithTimeout(legacyUrl, fetchOptions, BACKEND_FETCH_TIMEOUT_MS);
          } catch (error) {
            markBackendUnavailable();
            return null;
          }
          if (!responseLooksLikeJson(legacyRes)) {
            markBackendUnavailable('missing');
            return null;
          }
          if (legacyRes.status === 404) {
            continue;
          }
          if (!legacyRes.ok) {
            markBackendUnavailable();
            return null;
          }
          res = legacyRes;
          legacyPathUsed = legacyPath;
          break;
        }
        if (!legacyPathUsed && (!res || res.status === 404)) {
          const mode = resolveStoreModeFromResponse(res);
          markBackendAvailable(mode);
          backendWasEmpty = true;
          try {
            updateActionButtonState(0);
          } catch (_) {}
          return {
            path: storagePath,
            examples: [],
            deletedProvided: []
          };
        }
      } else if (res && res.status === 404) {
        const mode = resolveStoreModeFromResponse(res);
        markBackendAvailable(mode);
        backendWasEmpty = true;
        try {
          updateActionButtonState(0);
        } catch (_) {}
        return {
          path: storagePath,
          examples: [],
          deletedProvided: []
        };
      }
      if (!responseLooksLikeJson(res)) {
        markBackendUnavailable('missing');
        return null;
      }
      if (!res || !res.ok) {
        markBackendUnavailable();
        return null;
      }
      let backendData = null;
      try {
        backendData = await res.json();
      } catch (error) {
        markBackendUnavailable();
        return null;
      }
      const responseMode = resolveStoreModeFromResponse(res, backendData);
      markBackendAvailable(responseMode);
      const normalized = backendData && typeof backendData === 'object' ? { ...backendData } : {};
      const normalizedMode =
        normalizeBackendStoreMode(responseMode) ||
        normalizeBackendStoreMode(normalized.storage || normalized.mode || normalized.storageMode || normalized.storeMode);
      if (normalizedMode) {
        normalized.storage = normalizedMode;
      } else if (Object.prototype.hasOwnProperty.call(normalized, 'storage')) {
        delete normalized.storage;
      }
      normalized.path = storagePath;
      const backendExamples = Array.isArray(normalized.examples) ? normalized.examples : [];
      const backendDeleted = Array.isArray(normalized.deletedProvided) ? normalized.deletedProvided : [];
      backendWasEmpty = backendExamples.length === 0 && backendDeleted.length === 0;
      try {
        updateActionButtonState(backendExamples.length);
      } catch (_) {}
      await applyBackendData(normalized);
      renderOptions();
      if (legacyPathUsed) {
        try {
          await migrateLegacyBackendEntry(legacyPathUsed, normalized);
        } catch (_) {}
      }
      const cleanupTargets = legacyPaths.filter(
        path => path && path !== storagePath && path !== legacyPathUsed
      );
      if (cleanupTargets.length > 0) {
        try {
          await deleteLegacyBackendEntries(cleanupTargets, legacyPathUsed);
        } catch (_) {}
      }
      return normalized;
    } finally {
      backendReady = true;
      if (backendSyncDeferred) {
        if (backendWasEmpty) {
          backendSyncDeferred = false;
          scheduleBackendSync();
        } else if (backendAvailable) {
          backendSyncDeferred = false;
          scheduleBackendSync();
        }
      }
    }
  }
  let initialLoadPerformed = false;
  let currentExampleIndex = null;
  let tabsContainer = null;
  let tabButtons = [];
  let descriptionInput = null;
  const descriptionInputsWithListeners = new WeakSet();
  const descriptionContainersWithListeners = new WeakSet();
  let descriptionContainer = null;
  let descriptionPreview = null;
  let descriptionRendererPromise = null;
  let lastDescriptionRenderToken = 0;
  let loadingOverlayElement = null;
  let loadingOverlayVisible = false;
  let loadingOverlayHideTimer = null;
  let loadingOverlayLastShownAt = 0;

  const descriptionRendererLogPrefix = '[math-vis:description-loader]';
  function logDescriptionRendererEvent(level, message, details) {
    const root =
      (typeof window !== 'undefined' && window && window.console && window) ||
      (typeof globalThis !== 'undefined' && globalThis && globalThis.console && globalThis) ||
      null;
    if (!root || !root.console) return;
    const consoleRef = root.console;
    const method = typeof consoleRef[level] === 'function' ? consoleRef[level] : consoleRef.log;
    try {
      if (details !== undefined) {
        method.call(consoleRef, `${descriptionRendererLogPrefix} ${message}`, details);
      } else {
        method.call(consoleRef, `${descriptionRendererLogPrefix} ${message}`);
      }
    } catch (_) {}
  }

  function resolveDescriptionRendererUrl() {
    if (typeof document === 'undefined') {
      return 'description-renderer.js';
    }
    const candidates = [];
    const seenBases = new Set();
    const addCandidate = (base, reason, priority = 1) => {
      if (typeof base !== 'string') return;
      const trimmed = base.trim();
      if (!trimmed) return;
      if (seenBases.has(trimmed)) return;
      seenBases.add(trimmed);
      candidates.push({ base: trimmed, reason, priority, order: candidates.length });
    };
    const { currentScript } = document;
    if (currentScript && currentScript.src) {
      addCandidate(currentScript.src, 'document.currentScript.src', 0);
    }
    const scripts = typeof document.getElementsByTagName === 'function' ? document.getElementsByTagName('script') : null;
    if (scripts && scripts.length) {
      for (let i = scripts.length - 1; i >= 0; i--) {
        const script = scripts[i];
        if (!script || !script.src) continue;
        const src = script.src;
        addCandidate(src, 'script[src]', 0);
        if (/\bexamples(?:\.min)?\.js(?:\?|#|$)/.test(src)) {
          addCandidate(src, 'examples.js script[src]', 0);
          break;
        }
      }
    }
    if (typeof window !== 'undefined' && window.location) {
      const { origin, href } = window.location;
      if (typeof origin === 'string' && origin && origin !== 'null') {
        addCandidate(origin.endsWith('/') ? origin : `${origin}/`, 'window.location.origin', 2);
      }
      if (typeof href === 'string' && href) {
        addCandidate(href, 'window.location.href', 3);
      }
    }
    if (typeof document.baseURI === 'string' && document.baseURI) {
      addCandidate(document.baseURI, 'document.baseURI', 3);
    }
    const orderedCandidates = candidates.slice().sort((a, b) => {
      if (a.priority === b.priority) {
        return a.order - b.order;
      }
      return a.priority - b.priority;
    });
    logDescriptionRendererEvent('debug', 'Evaluating description renderer URL candidates', orderedCandidates);
    for (const candidate of orderedCandidates) {
      const base = candidate && candidate.base;
      if (typeof base !== 'string' || !base) continue;
      try {
        const resolved = new URL('description-renderer.js', base).toString();
        logDescriptionRendererEvent('debug', 'Resolved description renderer URL candidate', {
          base,
          reason: candidate.reason,
          resolved
        });
        return resolved;
      } catch (error) {
        logDescriptionRendererEvent('warn', 'Failed to resolve description renderer URL candidate', {
          base,
          reason: candidate.reason,
          error: error && error.message ? error.message : String(error)
        });
      }
    }
    logDescriptionRendererEvent('warn', 'Falling back to relative description renderer URL');
    return 'description-renderer.js';
  }

  function loadDescriptionRenderer() {
    if (typeof window === 'undefined' || typeof document === 'undefined') {
      return Promise.resolve(null);
    }
    if (window.MathVisDescriptionRenderer) {
      logDescriptionRendererEvent('debug', 'Description renderer already available on window');
      return Promise.resolve(window.MathVisDescriptionRenderer);
    }
    if (descriptionRendererPromise) {
      logDescriptionRendererEvent('debug', 'Reusing pending description renderer load promise');
      return descriptionRendererPromise;
    }
    descriptionRendererPromise = new Promise((resolve, reject) => {
      const scriptUrl = resolveDescriptionRendererUrl();
      logDescriptionRendererEvent('info', 'Loading description renderer script', { url: scriptUrl });
      const script = document.createElement('script');
      script.async = true;
      script.src = scriptUrl;
      script.setAttribute('data-mathvis-description-loader', 'true');
      script.addEventListener('load', () => {
        if (window.MathVisDescriptionRenderer) {
          logDescriptionRendererEvent('info', 'Description renderer script loaded successfully', { url: scriptUrl });
          resolve(window.MathVisDescriptionRenderer);
        } else {
          descriptionRendererPromise = null;
          logDescriptionRendererEvent('error', 'Description renderer script loaded without exposing global', {
            url: scriptUrl
          });
          reject(new Error('Description renderer loaded without exposing the expected global.'));
        }
      }, { once: true });
      script.addEventListener('error', () => {
        descriptionRendererPromise = null;
        logDescriptionRendererEvent('error', 'Failed to load description renderer script', { url: scriptUrl });
        reject(new Error('Failed to load description renderer.'));
      }, { once: true });
      document.head.appendChild(script);
    });
    return descriptionRendererPromise;
  }

  if (typeof window !== 'undefined') {
    loadDescriptionRenderer();
  }

  const DESCRIPTION_FALLBACK_FIELDS = [
    'descriptionHtml',
    'descriptionHTML',
    'description_html',
    'descriptionRich',
    'description_rich',
    'descriptionRichText',
    'description_rich_text',
    'richDescription',
    'taskDescription',
    'task_description',
    'taskText',
    'task_text',
    'task',
    'oppgave',
    'oppgavetekst',
    'oppgaveTekst'
  ];

  function normalizeDescriptionString(value) {
    if (typeof value !== 'string') return '';
    const normalized = value
      .replace(/\r\n?/g, '\n')
      .replace(/\u00a0/g, ' ')
      .replace(/[ \t]+\n/g, '\n')
      .replace(/\n{3,}/g, '\n\n');
    return normalized.trim();
  }

  function convertHtmlToPlainText(html) {
    if (typeof html !== 'string') return '';
    const trimmed = html.trim();
    if (!trimmed) return '';
    const sanitized = trimmed
      .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '')
      .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, '');
    const replaced = sanitized
      .replace(/<\s*br\s*\/?>/gi, '\n')
      .replace(/<\s*li\b[^>]*>/gi, '\n- ')
      .replace(/<\/(?:p|div|section|article|li|tr|thead|tbody|tfoot|table|h[1-6])\s*>/gi, '\n');
    if (typeof document !== 'undefined') {
      const container = document.createElement('div');
      container.innerHTML = replaced;
      return normalizeDescriptionString(container.textContent || '');
    }
    const stripped = replaced.replace(/<[^>]+>/g, '');
    return normalizeDescriptionString(stripped);
  }

  function extractDescriptionFromExample(example) {
    if (!example || typeof example !== 'object') return '';
    if (typeof example.description === 'string' && example.description.trim()) {
      return normalizeDescriptionString(example.description);
    }
    for (const key of DESCRIPTION_FALLBACK_FIELDS) {
      if (!Object.prototype.hasOwnProperty.call(example, key)) continue;
      const value = example[key];
      if (typeof value !== 'string') continue;
      if (!value.trim()) continue;
      const processed = /html|rich/i.test(key) ? convertHtmlToPlainText(value) : normalizeDescriptionString(value);
      if (processed) return processed;
    }
    if (typeof example.description === 'string') {
      return normalizeDescriptionString(example.description);
    }
    return '';
  }

  const MAX_SVG_STORAGE_BYTES = 120000;
  const MAX_THUMBNAIL_STORAGE_BYTES = 24000;
  const MAX_THUMBNAIL_DIMENSION = 256;
  function computeByteLength(str) {
    if (typeof str !== 'string') return 0;
    if (typeof TextEncoder === 'function') {
      try {
        return new TextEncoder().encode(str).length;
      } catch (_) {}
    }
    return str.length;
  }
  function sanitizeSvgForStorage(svg) {
    if (typeof svg !== 'string') return '';
    const trimmed = svg.trim();
    if (!trimmed) return '';
    if (computeByteLength(trimmed) <= MAX_SVG_STORAGE_BYTES) {
      return trimmed;
    }
    const normalized = trimmed.replace(/\s{2,}/g, ' ');
    if (computeByteLength(normalized) <= MAX_SVG_STORAGE_BYTES) {
      return normalized;
    }
    return '';
  }
  function normalizeExamplesForStorage(examples) {
    const list = Array.isArray(examples) ? examples : [];
    return list.map(example => {
      const copy = cloneValue(example);
      if (!copy || typeof copy !== 'object') {
        return {};
      }
      const description = extractDescriptionFromExample(copy);
      if (typeof description === 'string') {
        copy.description = description;
      }
      if (copy.description == null) {
        copy.description = '';
      } else if (typeof copy.description === 'string') {
        copy.description = normalizeDescriptionString(copy.description);
      }
      if (copy.svg != null) {
        copy.svg = sanitizeSvgForStorage(copy.svg);
      }
      if (Object.prototype.hasOwnProperty.call(copy, TEMPORARY_EXAMPLE_FLAG)) {
        delete copy[TEMPORARY_EXAMPLE_FLAG];
      }
      if (Object.prototype.hasOwnProperty.call(copy, 'temporary')) {
        delete copy.temporary;
      }
      if (Object.prototype.hasOwnProperty.call(copy, TEMPORARY_EXAMPLE_REQUEST_ID)) {
        delete copy[TEMPORARY_EXAMPLE_REQUEST_ID];
      }
      if (Object.prototype.hasOwnProperty.call(copy, TEMPORARY_EXAMPLE_SOURCE_PATH)) {
        delete copy[TEMPORARY_EXAMPLE_SOURCE_PATH];
      }
      if (Object.prototype.hasOwnProperty.call(copy, TEMPORARY_EXAMPLE_CREATED_AT)) {
        delete copy[TEMPORARY_EXAMPLE_CREATED_AT];
      }
      if (Object.prototype.hasOwnProperty.call(copy, TEMPORARY_EXAMPLE_NOTICE_PENDING)) {
        delete copy[TEMPORARY_EXAMPLE_NOTICE_PENDING];
      }
      if (Object.prototype.hasOwnProperty.call(copy, TEMPORARY_EXAMPLE_NOTICE_SHOWN)) {
        delete copy[TEMPORARY_EXAMPLE_NOTICE_SHOWN];
      }
      DESCRIPTION_FALLBACK_FIELDS.forEach(field => {
        if (field !== 'description' && Object.prototype.hasOwnProperty.call(copy, field)) {
          delete copy[field];
        }
      });
      return copy;
    });
  }

  const EXAMPLE_VALUE_TYPE_KEY = '__mathVisualsType__';
  const EXAMPLE_VALUE_DATA_KEY = '__mathVisualsValue__';

  function serializeExampleValue(value, seen) {
    if (value == null) return value;
    const valueType = typeof value;
    if (valueType === 'function' || valueType === 'symbol') return undefined;
    if (valueType !== 'object') return value;
    if (seen.has(value)) return seen.get(value);
    const tag = Object.prototype.toString.call(value);
    if (tag === '[object Map]') {
      const entries = [];
      const marker = {
        [EXAMPLE_VALUE_TYPE_KEY]: 'map',
        [EXAMPLE_VALUE_DATA_KEY]: entries
      };
      seen.set(value, marker);
      value.forEach((entryValue, entryKey) => {
        entries.push([
          serializeExampleValue(entryKey, seen),
          serializeExampleValue(entryValue, seen)
        ]);
      });
      return marker;
    }
    if (tag === '[object Set]') {
      const items = [];
      const marker = {
        [EXAMPLE_VALUE_TYPE_KEY]: 'set',
        [EXAMPLE_VALUE_DATA_KEY]: items
      };
      seen.set(value, marker);
      value.forEach(entryValue => {
        items.push(serializeExampleValue(entryValue, seen));
      });
      return marker;
    }
    if (tag === '[object Date]') {
      return {
        [EXAMPLE_VALUE_TYPE_KEY]: 'date',
        [EXAMPLE_VALUE_DATA_KEY]: value.toISOString()
      };
    }
    if (tag === '[object RegExp]') {
      return {
        [EXAMPLE_VALUE_TYPE_KEY]: 'regexp',
        pattern: value.source,
        flags: value.flags || ''
      };
    }
    if (Array.isArray(value)) {
      const arr = [];
      seen.set(value, arr);
      for (let i = 0; i < value.length; i++) {
        arr[i] = serializeExampleValue(value[i], seen);
      }
      return arr;
    }
    if (value && typeof value === 'object' && Object.prototype.hasOwnProperty.call(value, EXAMPLE_VALUE_TYPE_KEY)) {
      const clone = {};
      seen.set(value, clone);
      Object.keys(value).forEach(key => {
        const encoded = serializeExampleValue(value[key], seen);
        if (encoded !== undefined) {
          clone[key] = encoded;
        }
      });
      return clone;
    }
    const obj = {};
    seen.set(value, obj);
    Object.keys(value).forEach(key => {
      const encoded = serializeExampleValue(value[key], seen);
      if (encoded !== undefined) {
        obj[key] = encoded;
      }
    });
    return obj;
  }

  function deserializeExampleValue(value, seen) {
    if (value == null || typeof value !== 'object') {
      return value;
    }
    if (seen.has(value)) {
      return seen.get(value);
    }
    if (Array.isArray(value)) {
      const arr = [];
      seen.set(value, arr);
      for (let i = 0; i < value.length; i++) {
        arr[i] = deserializeExampleValue(value[i], seen);
      }
      return arr;
    }
    const type = value[EXAMPLE_VALUE_TYPE_KEY];
    if (type === 'map') {
      const result = new Map();
      seen.set(value, result);
      const entries = Array.isArray(value[EXAMPLE_VALUE_DATA_KEY]) ? value[EXAMPLE_VALUE_DATA_KEY] : [];
      entries.forEach(entry => {
        if (!Array.isArray(entry) || entry.length < 2) return;
        const key = deserializeExampleValue(entry[0], seen);
        const entryValue = deserializeExampleValue(entry[1], seen);
        try {
          result.set(key, entryValue);
        } catch (_) {}
      });
      return result;
    }
    if (type === 'set') {
      const result = new Set();
      seen.set(value, result);
      const items = Array.isArray(value[EXAMPLE_VALUE_DATA_KEY]) ? value[EXAMPLE_VALUE_DATA_KEY] : [];
      items.forEach(item => {
        result.add(deserializeExampleValue(item, seen));
      });
      return result;
    }
    if (type === 'date') {
      const isoValue = value[EXAMPLE_VALUE_DATA_KEY];
      const date = typeof isoValue === 'string' ? new Date(isoValue) : new Date(NaN);
      return date;
    }
    if (type === 'regexp') {
      const pattern = typeof value.pattern === 'string' ? value.pattern : '';
      const flags = typeof value.flags === 'string' ? value.flags : '';
      try {
        return new RegExp(pattern, flags);
      } catch (_) {
        try {
          return new RegExp(pattern);
        } catch (_) {
          return new RegExp('');
        }
      }
    }
    const obj = {};
    seen.set(value, obj);
    Object.keys(value).forEach(key => {
      obj[key] = deserializeExampleValue(value[key], seen);
    });
    return obj;
  }

  function serializeExamplesForStorage(examples) {
    const seen = new WeakMap();
    return JSON.stringify(examples, (_, value) => serializeExampleValue(value, seen));
  }

  function deserializeExamplesFromRaw(raw) {
    try {
      const parsed = JSON.parse(raw);
      return deserializeExampleValue(parsed, new WeakMap());
    } catch (error) {
      throw error;
    }
  }

  function getDescriptionContainer() {
    if (descriptionContainer && descriptionContainer.isConnected) return descriptionContainer;
    if (typeof document === 'undefined') return null;
    const container = document.querySelector('.example-description');
    if (container instanceof HTMLElement) {
      descriptionContainer = container;
      return container;
    }
    descriptionContainer = null;
    return null;
  }

  function getDescriptionPreviewElement() {
    const ensurePreviewPosition = (previewElement, containerElement) => {
      if (!previewElement || !containerElement) return;
      if (typeof containerElement.querySelector !== 'function') return;
      const checkHost = containerElement.querySelector('[data-task-check-host]');
      if (checkHost && typeof containerElement.insertBefore === 'function') {
        if (checkHost.previousElementSibling !== previewElement) {
          containerElement.insertBefore(previewElement, checkHost);
        }
      } else if (previewElement.parentElement !== containerElement) {
        containerElement.appendChild(previewElement);
      }
    };

    if (descriptionPreview && descriptionPreview.isConnected) {
      ensurePreviewPosition(descriptionPreview, descriptionPreview.parentElement);
      return descriptionPreview;
    }

    const container = getDescriptionContainer();
    if (!container) return null;
    let preview = container.querySelector('.example-description-preview');
    if (!(preview instanceof HTMLElement)) {
      preview = document.createElement('div');
      preview.className = 'example-description-preview';
      preview.setAttribute('aria-hidden', 'true');
      preview.setAttribute('hidden', '');
      preview.dataset.empty = 'true';
      const checkHost = container.querySelector('[data-task-check-host]');
      if (checkHost && typeof container.insertBefore === 'function') {
        container.insertBefore(preview, checkHost);
      } else {
        container.appendChild(preview);
      }
    }

    ensurePreviewPosition(preview, container);
    descriptionPreview = preview;
    return preview;
  }

  function updateTaskCheckAvailability(preview) {
    if (!preview || typeof preview.querySelector !== 'function') return;
    const container = preview.closest('.example-description');
    if (!container) return;
    const checkHost = container.querySelector('[data-task-check-host]');
    if (!checkHost) return;
    let hasInputs = false;
    if (typeof window !== 'undefined' && window.MathVisDescriptionRenderer) {
      const renderer = window.MathVisDescriptionRenderer;
      if (renderer && typeof renderer.hasInputs === 'function') {
        try {
          hasInputs = renderer.hasInputs(preview) === true;
        } catch (_) {}
      }
    }
    if (!hasInputs) {
      hasInputs = preview.querySelector('.math-vis-answerbox__input') != null;
    }
    if (hasInputs) {
      checkHost.dataset.hasAnswerInputs = 'true';
      container.dataset.hasAnswerInputs = 'true';
    } else {
      delete checkHost.dataset.hasAnswerInputs;
      delete container.dataset.hasAnswerInputs;
    }
    if (typeof checkHost.dispatchEvent === 'function') {
      try {
        checkHost.dispatchEvent(
          new CustomEvent('math-visuals:task-check-availability', {
            detail: { hasAnswerInputs: hasInputs }
          })
        );
      } catch (_) {}
    }
  }

  function clearChildren(node) {
    if (!node) return;
    while (node.firstChild) {
      node.removeChild(node.firstChild);
    }
  }

  const DESCRIPTION_MARKERS = [
    { type: 'math', marker: '@math{', open: '{', close: '}' },
    { type: 'task', marker: '@task{', open: '{', close: '}' },
    { type: 'answerbox', marker: '@answerbox[', open: '[', close: ']' },
    { type: 'answer', marker: '@answer[', open: '[', close: ']' },
    { type: 'input', marker: '@input[', open: '[', close: ']' }
  ].map(marker => ({ ...marker, markerLower: marker.marker.toLowerCase() }));

  function hasDescriptionFormatting(value) {
    if (typeof value !== 'string') return false;
    const trimmed = value.trim();
    if (!trimmed) return false;
    if (findNextDescriptionMarker(trimmed, 0)) return true;
    const lower = trimmed.toLowerCase();
    if (/@table\s*\{/.test(lower)) return true;
    return false;
  }

  function extractBalancedSegment(text, startIndex, openChar, closeChar) {
    if (typeof text !== 'string') return null;
    let depth = 1;
    for (let i = startIndex; i < text.length; i++) {
      const char = text[i];
      if (char === openChar) {
        depth += 1;
      } else if (char === closeChar) {
        depth -= 1;
      }
      if (depth === 0) {
        return {
          content: text.slice(startIndex, i),
          endIndex: i
        };
      }
    }
    return null;
  }

  function findNextDescriptionMarker(text, startIndex) {
    if (typeof text !== 'string') return null;
    const lower = text.toLowerCase();
    let next = null;
    DESCRIPTION_MARKERS.forEach(marker => {
      const index = lower.indexOf(marker.markerLower, startIndex);
      if (index === -1) return;
      if (
        !next ||
        index < next.index ||
        (index === next.index && marker.marker.length > next.marker.length)
      ) {
        next = { ...marker, index };
      }
    });
    return next;
  }

  function extractOptionValue(options, keys) {
    if (typeof options !== 'string') return '';
    for (const key of keys) {
      const pattern = new RegExp(
        `(?:^|[|,])\\s*${key}\\s*=\\s*(\"([^\"]*)\"|'([^']*)'|([^|"'\]]+))`,
        'i'
      );
      const match = options.match(pattern);
      if (match) {
        const value = match[2] || match[3] || match[4] || '';
        if (value) return value.trim();
      }
    }
    return '';
  }

  function stripDescriptionMarkup(text) {
    if (typeof text !== 'string' || text.indexOf('@') === -1) return text;
    let result = '';
    let index = 0;
    while (index < text.length) {
      const marker = findNextDescriptionMarker(text, index);
      if (!marker) {
        result += text.slice(index);
        break;
      }
      result += text.slice(index, marker.index);
      const offset = marker.index + marker.marker.length;
      const extraction = extractBalancedSegment(text, offset, marker.open, marker.close);
      if (!extraction) {
        result += text.slice(marker.index);
        break;
      }
      const { content, endIndex } = extraction;
      if (marker.type === 'math' || marker.type === 'task') {
        result += content;
      } else {
        const placeholder = extractOptionValue(content, ['placeholder', 'label']);
        result += placeholder || '____';
      }
      index = endIndex + 1;
    }
    return result;
  }

  function appendDescriptionText(fragment, text) {
    if (!fragment || typeof fragment.appendChild !== 'function') return;
    if (typeof text !== 'string') return;
    const stripped = stripDescriptionMarkup(text);
    const normalized = stripped.replace(/\r\n?/g, '\n');
    const paragraphs = normalized.split(/\n{2,}/);
    paragraphs.forEach(paragraph => {
      if (!paragraph.trim()) return;
      const lines = paragraph.split('\n');
      const p = document.createElement('p');
      lines.forEach((line, index) => {
        p.appendChild(document.createTextNode(line));
        if (index < lines.length - 1) {
          p.appendChild(document.createElement('br'));
        }
      });
      fragment.appendChild(p);
    });
  }

  function createDescriptionTable(content) {
    if (typeof content !== 'string') return null;
    const normalized = content.replace(/\r\n?/g, '\n').trim();
    if (!normalized) return null;
    const lines = normalized
      .split('\n')
      .map(line => line.trim())
      .filter(line => line);
    if (!lines.length) return null;
    const rows = lines.map(line => line.split('|').map(cell => cell.trim()));
    const columnCount = rows.reduce((max, row) => (row.length > max ? row.length : max), 0);
    if (!columnCount) return null;
    const table = document.createElement('table');
    table.className = 'example-description-table';
    let bodyStartIndex = 0;
    if (rows.length > 1) {
      const thead = document.createElement('thead');
      const headRow = document.createElement('tr');
      for (let i = 0; i < columnCount; i++) {
        const th = document.createElement('th');
        th.textContent = rows[0][i] != null ? rows[0][i] : '';
        headRow.appendChild(th);
      }
      thead.appendChild(headRow);
      table.appendChild(thead);
      bodyStartIndex = 1;
    }
    const tbody = document.createElement('tbody');
    const appendRow = row => {
      const tr = document.createElement('tr');
      for (let i = 0; i < columnCount; i++) {
        const cell = document.createElement('td');
        const value = row && row[i] != null ? stripDescriptionMarkup(row[i]) : '';
        cell.textContent = value;
        tr.appendChild(cell);
      }
      tbody.appendChild(tr);
    };
    if (rows.length === 1) {
      appendRow(rows[0]);
    } else {
      for (let i = bodyStartIndex; i < rows.length; i++) {
        appendRow(rows[i]);
      }
    }
    table.appendChild(tbody);
    return table;
  }

  function buildDescriptionPreview(value) {
    const fragment = document.createDocumentFragment();
    if (typeof value !== 'string') return fragment;
    const normalized = value.replace(/\r\n?/g, '\n');
    const pattern = /@table\s*\{([\s\S]*?)\}/gi;
    let lastIndex = 0;
    let match = null;
    while ((match = pattern.exec(normalized)) !== null) {
      const before = normalized.slice(lastIndex, match.index);
      appendDescriptionText(fragment, before);
      const table = createDescriptionTable(match[1]);
      if (table) {
        fragment.appendChild(table);
      } else {
        appendDescriptionText(fragment, match[0]);
      }
      lastIndex = pattern.lastIndex;
    }
    const after = normalized.slice(lastIndex);
    appendDescriptionText(fragment, after);
    return fragment;
  }

  let lastRenderedDescriptionValue = null;

  function renderDescriptionPreviewFromValue(value, options) {
    const preview = getDescriptionPreviewElement();
    if (!preview) return;
    preview.classList.add('math-vis-description-rendered');
    const opts = options && typeof options === 'object' ? options : {};
    const force = opts.force === true;
    const bypassFormattingCheck = opts.bypassFormattingCheck === true;
    const stringValue = typeof value === 'string' ? value : '';
    if (!force && stringValue === lastRenderedDescriptionValue) {
      return preview.dataset.empty !== 'true';
    }
    const applyState = hasContent => {
      const emptyValue = hasContent ? 'false' : 'true';
      preview.dataset.empty = emptyValue;
      if (hasContent) {
        preview.removeAttribute('hidden');
        preview.setAttribute('aria-hidden', 'false');
      } else {
        preview.setAttribute('hidden', '');
        preview.setAttribute('aria-hidden', 'true');
      }
    };
    const markRendered = hasContent => {
      lastRenderedDescriptionValue = stringValue;
      return hasContent;
    };
    const trimmedValue = stringValue.trim();
    if (!trimmedValue) {
      clearChildren(preview);
      delete preview.dataset.placeholder;
      applyState(false);
      return markRendered(false);
    }
    if (!bypassFormattingCheck && !hasDescriptionFormatting(stringValue)) {
      clearChildren(preview);
      delete preview.dataset.placeholder;
      applyState(false);
      return markRendered(false);
    }
    const renderPlainText = () => {
      const fragment = buildDescriptionPreview(stringValue);
      const hasFragmentContent = fragment && fragment.childNodes && fragment.childNodes.length > 0;
      clearChildren(preview);
      if (hasFragmentContent) {
        preview.appendChild(fragment);
      } else {
        preview.textContent = stringValue;
      }
      updateTaskCheckAvailability(preview);
      return hasFragmentContent || !!trimmedValue;
    };
    let placeholderRendered = false;
    const renderPlainTextPlaceholder = () => {
      if (placeholderRendered) return true;
      const hasContent = renderPlainText();
      preview.dataset.placeholder = 'true';
      applyState(hasContent);
      markRendered(hasContent);
      placeholderRendered = true;
      return hasContent;
    };
    const renderLegacy = () => {
      const hasContent = renderPlainText();
      delete preview.dataset.placeholder;
      applyState(hasContent);
      updateTaskCheckAvailability(preview);
      return markRendered(hasContent);
    };
    const token = ++lastDescriptionRenderToken;
    const renderWith = renderer => {
      if (!renderer || token !== lastDescriptionRenderToken) return;
      try {
        const hasContent = !!renderer.renderInto(preview, stringValue);
        if (hasContent) {
          delete preview.dataset.placeholder;
          applyState(hasContent);
          markRendered(hasContent);
        } else if (!preview.childNodes || preview.childNodes.length === 0) {
          renderPlainTextPlaceholder();
        }
        updateTaskCheckAvailability(preview);
      } catch (error) {
        if (token === lastDescriptionRenderToken) {
          renderLegacy();
        }
      }
    };

    if (window.MathVisDescriptionRenderer && typeof window.MathVisDescriptionRenderer.renderInto === 'function') {
      renderWith(window.MathVisDescriptionRenderer);
      return;
    }

    const loader = loadDescriptionRenderer();
    if (!loader || typeof loader.then !== 'function') {
      renderLegacy();
      return;
    }
    renderPlainTextPlaceholder();
    loader
      .then(renderer => {
        if (token !== lastDescriptionRenderToken) return;
        if (renderer && typeof renderer.renderInto === 'function') {
          renderWith(renderer);
        } else {
          renderLegacy();
        }
      })
      .catch(() => {
        if (token === lastDescriptionRenderToken) {
          renderLegacy();
        }
      });
  }

  function evaluateTaskInputs() {
    const preview = getDescriptionPreviewElement();
    if (!preview) return null;
    if (typeof window === 'undefined') return null;
    const renderer = window.MathVisDescriptionRenderer;
    if (!renderer || typeof renderer.evaluateInputs !== 'function') return null;
    try {
      return renderer.evaluateInputs(preview);
    } catch (_) {
      return null;
    }
  }

  function resetTaskInputs() {
    const preview = getDescriptionPreviewElement();
    if (!preview) return;
    if (typeof window === 'undefined') return;
    const renderer = window.MathVisDescriptionRenderer;
    if (!renderer || typeof renderer.resetInputs !== 'function') return;
    try {
      renderer.resetInputs(preview);
    } catch (_) {}
  }

  function updateDescriptionEditVisibilityForMode(mode) {
    const normalized = normalizeAppMode(mode != null ? mode : currentAppMode) || DEFAULT_APP_MODE;
    const isTaskMode = normalized === 'task';
    let input = null;
    try {
      input = getDescriptionInput();
    } catch (error) {
      scheduleDescriptionVisibilityUpdate(normalized);
      return;
    }
    if (!input) {
      scheduleDescriptionVisibilityUpdate(normalized);
      return;
    }

    renderDescriptionPreviewFromValue(input.value, { force: true });

    const container = input.closest('.example-description');
    if (container) {
      if (isTaskMode) {
        container.classList.add('example-description--task-mode');
      } else {
        container.classList.remove('example-description--task-mode');
      }
    }
    if (isTaskMode) {
      input.setAttribute('data-task-mode-hidden', 'true');
      input.hidden = true;
      input.setAttribute('aria-hidden', 'true');
    } else {
      if (input.getAttribute('data-task-mode-hidden') === 'true') {
        input.hidden = false;
        input.removeAttribute('hidden');
      }
      input.removeAttribute('data-task-mode-hidden');
      input.removeAttribute('aria-hidden');
    }
    const preview = getDescriptionPreviewElement();
    if (preview) {
      if (isTaskMode) {
        if (preview.dataset.empty === 'true') {
          preview.setAttribute('hidden', '');
          preview.setAttribute('aria-hidden', 'true');
        } else {
          preview.removeAttribute('hidden');
          preview.setAttribute('aria-hidden', 'false');
        }
      } else if (preview.dataset.empty === 'true') {
        preview.setAttribute('hidden', '');
        preview.setAttribute('aria-hidden', 'true');
      }
    }
  }

  function ensureTaskModeDescriptionRendered() {
    let input;
    try {
      input = getDescriptionInput();
    } catch (error) {
      if (error && typeof error.message === 'string' && error.message.includes('descriptionInput')) {
        if (!taskModeDescriptionRenderRetryScheduled) {
          taskModeDescriptionRenderRetryScheduled = true;
          setTimeout(() => {
            taskModeDescriptionRenderRetryScheduled = false;
            try {
              ensureTaskModeDescriptionRendered();
            } catch (_) {}
          }, 0);
        }
        return;
      }
      throw error;
    }
    if (!input) return;
    updateDescriptionEditVisibilityForMode('task');
    let value = typeof input.value === 'string' ? input.value : '';
    let trimmed = value && typeof value.trim === 'function' ? value.trim() : '';
    if (!trimmed) {
      try {
        const examples = getExamples();
        const index = getActiveExampleIndex(examples);
        if (index != null) {
          const example = examples[index];
          const fallback = extractDescriptionFromExample(example);
          if (fallback && typeof fallback === 'string' && fallback.trim()) {
            setDescriptionValue(fallback);
            value = fallback;
            trimmed = fallback.trim();
          }
        }
      } catch (error) {
        if (error && typeof error.message === 'string' && error.message.includes('descriptionInput')) {
          if (!taskModeDescriptionRenderRetryScheduled) {
            taskModeDescriptionRenderRetryScheduled = true;
            setTimeout(() => {
              taskModeDescriptionRenderRetryScheduled = false;
              try {
                ensureTaskModeDescriptionRendered();
              } catch (_) {}
            }, 0);
          }
          return;
        }
        return;
      }
      if (!trimmed) return;
    }
    const renderResult = renderDescriptionPreviewFromValue(value, { force: true, bypassFormattingCheck: true });
    if (renderResult === true) return;
    if (renderResult == null) return;
    if (renderResult !== false) return;
    const preview = getDescriptionPreviewElement();
    if (!preview) return;
    clearChildren(preview);
    preview.textContent = trimmed;
    preview.dataset.empty = 'false';
    preview.removeAttribute('hidden');
    preview.setAttribute('aria-hidden', 'false');
  }

  function updateDescriptionCollapsedState(target) {
    const input = target && target.nodeType === 1 ? target : getDescriptionInput();
    if (!input || typeof input.value !== 'string') return;
    const container = input.closest('.example-description');
    if (!container) return;
    container.classList.remove('example-description--collapsed');
  }

  function ensureDescriptionListeners(input) {
    if (!input || descriptionInputsWithListeners.has(input)) return;
    descriptionInputsWithListeners.add(input);
    const update = () => {
      updateDescriptionCollapsedState(input);
      renderDescriptionPreviewFromValue(input.value);
    };
    input.addEventListener('input', update);
    input.addEventListener('change', update);
    input.addEventListener('focus', update);
    input.addEventListener('blur', update);
    const container = input.closest('.example-description');
    if (container && !descriptionContainersWithListeners.has(container)) {
      const handleContainerClick = event => {
        if (!input || currentAppMode === 'task') return;
        if (event && event.defaultPrevented) return;
        const target = event && event.target;
        if (target && typeof target.closest === 'function') {
          if (target.closest('textarea') === input) return;
          const preview = container.querySelector('.example-description-preview');
          if (preview && preview.contains(target) && !preview.hasAttribute('hidden') && preview.dataset.empty !== 'true') {
            return;
          }
        }
        if (typeof input.focus === 'function' && document.activeElement !== input) {
          try {
            input.focus({ preventScroll: true });
          } catch (_) {
            try {
              input.focus();
            } catch (_) {}
          }
        }
      };
      container.addEventListener('click', handleContainerClick);
      descriptionContainersWithListeners.add(container);
    }
    setTimeout(update, 0);
  }

  function getDescriptionInput() {
    if (descriptionInput && descriptionInput.isConnected) return descriptionInput;
    descriptionInput = document.getElementById('exampleDescription');
    if (descriptionInput) ensureDescriptionListeners(descriptionInput);
    return descriptionInput || null;
  }
  function getDescriptionValue() {
    const input = getDescriptionInput();
    if (!input) return '';
    const value = input.value;
    return typeof value === 'string' ? value : '';
  }
  function setDescriptionValue(value) {
    const input = getDescriptionInput();
    if (!input) return;
    if (typeof value === 'string') {
      input.value = value;
    } else {
      input.value = '';
    }
    updateDescriptionCollapsedState(input);
    renderDescriptionPreviewFromValue(input.value, { force: true });
  }
  let tabsHostCard = null;
  let toolbarElement = null;
  const hasUrlOverrides = (() => {
    if (typeof URLSearchParams === 'undefined') return false;
    const currentLocation =
      typeof window !== 'undefined' && window && window.location ? window.location : null;
    const searchValue = currentLocation && typeof currentLocation.search === 'string' ? currentLocation.search : '';
    if (!searchValue) {
      return false;
    }
    const search = new URLSearchParams(searchValue);
    for (const key of search.keys()) {
      if (key === 'example') continue;
      if (/^fun\d+$/i.test(key) || /^dom\d+$/i.test(key)) return true;
      switch (key) {
        case 'coords':
        case 'points':
        case 'startx':
        case 'screen':
        case 'xName':
        case 'yName':
        case 'pan':
        case 'q1':
        case 'lock':
          return true;
        default:
          break;
      }
    }
    return false;
  })();
  if (hasUrlOverrides) {
    initialLoadPerformed = true;
  }
  let cachedExamples = [];
  let cachedExamplesInitialized = false;
  let pendingArchiveExampleNotice = null;
  let lastLocalUpdateMs = loadPersistedUpdatedAt();
  let saveStatusElement = null;
  let saveStatusTextElement = null;
  let pendingUserSaveReason = null;
  let lastSuccessfulSaveIso = null;
  let localChangesSinceLoad = false;
  function hydrateCachedExamples() {
    if (cachedExamplesInitialized) return;
    cachedExamplesInitialized = true;
    const rawValue = typeof lastStoredRawValue === 'string' ? lastStoredRawValue.trim() : '';
    if (rawValue) {
      try {
        const parsed = parseExamplesFromRaw(rawValue);
        if (parsed && parsed.status === 'ok' && Array.isArray(parsed.examples)) {
          cachedExamples = parsed.examples.slice();
          return;
        }
        if (parsed && parsed.status !== 'ok') {
          try {
            if (attemptHistoryRecovery(rawValue)) {
              return;
            }
          } catch (_) {}
        }
      } catch (_) {}
    }
    if (Array.isArray(cachedExamples)) {
      cachedExamples = cachedExamples.slice();
    } else {
      cachedExamples = [];
    }
  }
  function getExamples() {
    if (!cachedExamplesInitialized) {
      hydrateCachedExamples();
    }
    return cachedExamples;
  }
  function createTemporaryExample(example, options) {
    const examples = getExamples();
    const opts = options && typeof options === 'object' ? options : {};
    const skipNotice = opts.skipNotice === true;
    if (!example || typeof example !== 'object') return null;
    const sanitizedList = normalizeExamplesForStorage([example]);
    const sanitized = Array.isArray(sanitizedList) && sanitizedList.length > 0 ? sanitizedList[0] : null;
    const normalized = sanitized && typeof sanitized === 'object' ? { ...sanitized } : null;
    if (!normalized) return null;
    if (!normalized.config || typeof normalized.config !== 'object') {
      normalized.config = {};
    }
    const requestIdRaw = opts.requestId != null ? opts.requestId : normalized.id || null;
    const requestId = requestIdRaw != null ? String(requestIdRaw) : null;
    normalized[TEMPORARY_EXAMPLE_FLAG] = true;
    normalized.temporary = true;
    if (skipNotice) {
      if (Object.prototype.hasOwnProperty.call(normalized, TEMPORARY_EXAMPLE_NOTICE_PENDING)) {
        delete normalized[TEMPORARY_EXAMPLE_NOTICE_PENDING];
      }
      if (Object.prototype.hasOwnProperty.call(normalized, TEMPORARY_EXAMPLE_NOTICE_SHOWN)) {
        delete normalized[TEMPORARY_EXAMPLE_NOTICE_SHOWN];
      }
    } else {
      normalized[TEMPORARY_EXAMPLE_NOTICE_PENDING] = true;
      if (Object.prototype.hasOwnProperty.call(normalized, TEMPORARY_EXAMPLE_NOTICE_SHOWN)) {
        delete normalized[TEMPORARY_EXAMPLE_NOTICE_SHOWN];
      }
    }
    if (requestId) {
      normalized[TEMPORARY_EXAMPLE_REQUEST_ID] = requestId;
    }
    if (opts.sourcePath) {
      normalized[TEMPORARY_EXAMPLE_SOURCE_PATH] = String(opts.sourcePath);
    }
    if (Object.prototype.hasOwnProperty.call(opts, 'createdAt') && opts.createdAt != null) {
      normalized[TEMPORARY_EXAMPLE_CREATED_AT] = opts.createdAt;
    } else if (!Object.prototype.hasOwnProperty.call(normalized, TEMPORARY_EXAMPLE_CREATED_AT)) {
      try {
        normalized[TEMPORARY_EXAMPLE_CREATED_AT] = new Date().toISOString();
      } catch (_) {}
    }
    let targetIndex = Number.isInteger(opts.index) ? Math.max(0, Math.min(examples.length, opts.index)) : examples.length;
    if (requestId) {
      const existingIndex = examples.findIndex(item => item && item[TEMPORARY_EXAMPLE_REQUEST_ID] === requestId);
      if (existingIndex >= 0) {
        examples.splice(existingIndex, 1, normalized);
        return { index: existingIndex, example: normalized };
      }
    }
    examples.splice(targetIndex, 0, normalized);
    return { index: targetIndex, example: normalized };
  }
  function readArchiveOpenRequest() {
    let raw = null;
    try {
      raw = storageGetItem(OPEN_REQUEST_STORAGE_KEY);
    } catch (_) {
      raw = null;
    }
    if (!raw) return null;
    try {
      return JSON.parse(raw);
    } catch (error) {
      return null;
    }
  }
  function writeArchiveOpenRequest(payload) {
    if (!payload || typeof payload !== 'object') {
      try {
        storageRemoveItem(OPEN_REQUEST_STORAGE_KEY);
      } catch (_) {}
      return;
    }
    try {
      storageSetItem(OPEN_REQUEST_STORAGE_KEY, JSON.stringify(payload));
    } catch (error) {}
  }
  function prepareArchiveOpenRequest(rawRequest, options) {
    const request = rawRequest && typeof rawRequest === 'object' ? { ...rawRequest } : {};
    const opts = options && typeof options === 'object' ? options : {};
    const parseExample = value => {
      if (!value) return null;
      if (typeof value === 'string') {
        const trimmed = value.trim();
        if (!trimmed) return null;
        try {
          return JSON.parse(trimmed);
        } catch (_) {
          return null;
        }
      }
      if (typeof value === 'object') {
        return value;
      }
      return null;
    };
    let exampleState =
      parseExample(opts.exampleState) ||
      parseExample(opts.example) ||
      parseExample(request.exampleState) ||
      parseExample(request.example) ||
      parseExample(request.exampleData) ||
      parseExample(request.payload);
    if (exampleState) {
      const normalizedList = normalizeExamplesForStorage([exampleState]);
      const normalizedExample = Array.isArray(normalizedList) && normalizedList.length > 0 ? normalizedList[0] : null;
      if (normalizedExample) {
        request.exampleState = normalizedExample;
        request.example = normalizedExample;
        request.exampleData = normalizedExample;
        request.payload = normalizedExample;
      }
    }
    const pathCandidates = [
      opts.canonicalPath,
      opts.targetPath,
      opts.path,
      request.canonicalPath,
      request.storagePath,
      request.path,
      request.target,
      request.href,
      request.targetUrl
    ];
    for (const candidate of pathCandidates) {
      if (typeof candidate !== 'string') continue;
      const trimmed = candidate.trim();
      if (!trimmed) continue;
      try {
        const normalized = normalizePathname(trimmed);
        if (normalized) {
          request.canonicalPath = normalized;
          if (!request.path) {
            request.path = normalized;
          }
          if (!request.storagePath) {
            request.storagePath = normalized;
          }
          break;
        }
      } catch (_) {}
    }
    if (!request.canonicalPath) {
      try {
        const normalizedStorage = normalizePathname(storagePath);
        if (normalizedStorage) {
          request.canonicalPath = normalizedStorage;
          if (!request.path) {
            request.path = normalizedStorage;
          }
          if (!request.storagePath) {
            request.storagePath = normalizedStorage;
          }
        }
      } catch (_) {}
    }
    try {
      writeArchiveOpenRequest(request);
    } catch (_) {}
    return request;
  }
  function clearArchiveOpenRequest() {
    try {
      storageRemoveItem(OPEN_REQUEST_STORAGE_KEY);
    } catch (_) {}
  }
  const USER_INITIATED_REASONS = new Set(['manual-save', 'manual-update', 'delete', 'history']);
  function isUserInitiatedReason(reason) {
    return typeof reason === 'string' && USER_INITIATED_REASONS.has(reason);
  }
  function ensureSaveStatusElement() {
    if (typeof document === 'undefined') return null;
    if (saveStatusElement && saveStatusElement.isConnected) {
      if (toolbarElement && saveStatusElement.parentElement !== toolbarElement) {
        try {
          toolbarElement.appendChild(saveStatusElement);
        } catch (_) {}
      }
      return saveStatusElement;
    }
    const host = toolbarElement || document.querySelector('.toolbar') || document.body;
    if (!host || typeof host.appendChild !== 'function') {
      return null;
    }
    const status = document.createElement('div');
    status.className = 'example-save-status';
    status.setAttribute('role', 'status');
    status.setAttribute('aria-live', 'polite');
    status.hidden = true;
    status.dataset.status = 'idle';
    const spinner = document.createElement('span');
    spinner.className = 'example-save-status__spinner';
    spinner.setAttribute('aria-hidden', 'true');
    const text = document.createElement('span');
    text.className = 'example-save-status__text';
    status.appendChild(spinner);
    status.appendChild(text);
    try {
      host.appendChild(status);
    } catch (error) {
      if (host !== document.body || !document.body) {
        return null;
      }
      document.body.appendChild(status);
    }
    saveStatusElement = status;
    saveStatusTextElement = text;
    return saveStatusElement;
  }
  function formatSaveStatusTime(value) {
    let date = null;
    if (value instanceof Date) {
      date = Number.isFinite(value.getTime()) ? value : null;
    } else if (typeof value === 'number' && Number.isFinite(value)) {
      date = new Date(value);
    } else if (typeof value === 'string' && value) {
      const parsed = Date.parse(value);
      if (Number.isFinite(parsed)) {
        date = new Date(parsed);
      }
    }
    if (!date) return null;
    try {
      return date.toLocaleTimeString('nb-NO', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: false
      });
    } catch (error) {
      const hours = String(date.getHours()).padStart(2, '0');
      const minutes = String(date.getMinutes()).padStart(2, '0');
      return `${hours}:${minutes}`;
    }
  }
  function normalizeUpdatedAtIso(details) {
    if (!details) return null;
    if (typeof details === 'string' && details) {
      const parsed = Date.parse(details);
      if (Number.isFinite(parsed)) {
        return new Date(parsed).toISOString();
      }
      return details;
    }
    if (typeof details === 'number' && Number.isFinite(details)) {
      return new Date(details).toISOString();
    }
    if (typeof details === 'object') {
      if (typeof details.updatedAt === 'string' && details.updatedAt) {
        const parsed = Date.parse(details.updatedAt);
        if (Number.isFinite(parsed)) {
          return new Date(parsed).toISOString();
        }
        return details.updatedAt;
      }
      if (typeof details.updatedAt === 'number' && Number.isFinite(details.updatedAt)) {
        return new Date(details.updatedAt).toISOString();
      }
      if (typeof details.updatedAtMs === 'number' && Number.isFinite(details.updatedAtMs)) {
        return new Date(details.updatedAtMs).toISOString();
      }
    }
    return null;
  }
  function setSaveStatusState(state, details = {}) {
    if (typeof document === 'undefined') return;
    const host = ensureSaveStatusElement();
    if (!host) return;
    const normalizedState = typeof state === 'string' && state ? state : 'idle';
    host.dataset.status = normalizedState;
    host.hidden = normalizedState === 'idle';
    if (!saveStatusTextElement) return;
    let message = '';
    if (normalizedState === 'saving') {
      message = typeof details.message === 'string' && details.message ? details.message : 'Lagrer …';
      if (host.dataset.updatedAt) {
        delete host.dataset.updatedAt;
      }
    } else if (normalizedState === 'pending-sync') {
      message =
        typeof details.message === 'string' && details.message
          ? details.message
          : 'Lagret lokalt – venter på server…';
      if (host.dataset.updatedAt) {
        delete host.dataset.updatedAt;
      }
    } else if (normalizedState === 'success') {
      const iso = normalizeUpdatedAtIso(details) || lastSuccessfulSaveIso || new Date().toISOString();
      const timeText = formatSaveStatusTime(iso) || formatSaveStatusTime(Date.now());
      message =
        typeof details.message === 'string' && details.message
          ? details.message
          : timeText
          ? `Sist lagret kl. ${timeText}`
          : 'Sist lagret.';
      host.dataset.updatedAt = iso;
    } else if (normalizedState === 'error') {
      message = typeof details.message === 'string' && details.message ? details.message : 'Kunne ikke lagre endringer.';
      if (host.dataset.updatedAt) {
        delete host.dataset.updatedAt;
      }
    } else {
      message = typeof details.message === 'string' ? details.message : '';
      if (host.dataset.updatedAt) {
        delete host.dataset.updatedAt;
      }
    }
    saveStatusTextElement.textContent = message;
  }
  function beginUserSaveStatus(reason) {
    if (typeof reason === 'string' && reason) {
      pendingUserSaveReason = reason;
    } else {
      pendingUserSaveReason = 'user-action';
    }
    setSaveStatusState('saving');
  }
  function markUserSaveDeferred() {
    if (!pendingUserSaveReason) {
      pendingUserSaveReason = 'user-action';
    }
    setSaveStatusState('pending-sync');
  }
  function markUserSaveSuccess(details) {
    const iso = normalizeUpdatedAtIso(details) || lastSuccessfulSaveIso || new Date().toISOString();
    lastSuccessfulSaveIso = iso;
    pendingUserSaveReason = null;
    setSaveStatusState('success', { updatedAt: iso });
  }
  function markUserSaveError(error) {
    pendingUserSaveReason = null;
    let message = 'Kunne ikke lagre endringer.';
    if (error && typeof error === 'object') {
      if (typeof error.userMessage === 'string' && error.userMessage.trim()) {
        message = error.userMessage.trim();
      } else if (typeof error.message === 'string' && error.message.trim()) {
        message = error.message.trim();
      }
    } else if (typeof error === 'string' && error.trim()) {
      message = error.trim();
    }
    setSaveStatusState('error', { message });
  }
  function announceArchiveTemporaryExample(example) {
    if (!example || typeof example !== 'object') return;
    if (pendingUserSaveReason) return;
    try {
      const message = 'Eksemplet er åpnet fra arkivet. Trykk «Lagre» for å beholde det permanent.';
      setSaveStatusState('pending-sync', { message });
    } catch (_) {}
  }
  function maybeAnnounceTemporaryExample(index, example) {
    if (!Number.isInteger(index)) return;
    if (!example || typeof example !== 'object') return;
    if (!example[TEMPORARY_EXAMPLE_FLAG]) return;
    if (example[TEMPORARY_EXAMPLE_NOTICE_SHOWN]) return;
    const shouldAnnounce =
      example[TEMPORARY_EXAMPLE_NOTICE_PENDING] === true ||
      (pendingArchiveExampleNotice && pendingArchiveExampleNotice.index === index);
    if (!shouldAnnounce) return;
    announceArchiveTemporaryExample(example);
    example[TEMPORARY_EXAMPLE_NOTICE_SHOWN] = true;
    if (Object.prototype.hasOwnProperty.call(example, TEMPORARY_EXAMPLE_NOTICE_PENDING)) {
      delete example[TEMPORARY_EXAMPLE_NOTICE_PENDING];
    }
    if (pendingArchiveExampleNotice && pendingArchiveExampleNotice.index === index) {
      pendingArchiveExampleNotice = null;
    }
  }
  function parseBackendUpdatedAt(value) {
    if (typeof value === 'number' && Number.isFinite(value)) {
      return value;
    }
    if (typeof value === 'string' && value) {
      const parsed = Date.parse(value);
      if (Number.isFinite(parsed)) {
        return parsed;
      }
    }
    return null;
  }
  function collectTemporaryExamplesForPreservation(examples) {
    if (!Array.isArray(examples) || examples.length === 0) {
      return [];
    }
    const preserved = [];
    for (let index = 0; index < examples.length; index++) {
      const example = examples[index];
      if (!example || typeof example !== 'object') continue;
      if (!example[TEMPORARY_EXAMPLE_FLAG]) continue;
      let clone = null;
      try {
        clone = cloneValue(example);
      } catch (_) {
        clone = example && typeof example === 'object' ? { ...example } : null;
      }
      if (!clone || typeof clone !== 'object') continue;
      clone[TEMPORARY_EXAMPLE_FLAG] = true;
      if (clone.temporary !== true) {
        clone.temporary = true;
      }
      preserved.push({ index, example: clone });
    }
    return preserved;
  }
  function restoreTemporaryExamplesAfterSync(temporaryEntries, baseExamples) {
    if (!Array.isArray(temporaryEntries) || temporaryEntries.length === 0) {
      return null;
    }
    const sourceList = Array.isArray(baseExamples) ? baseExamples : getExamples();
    const baseList = Array.isArray(sourceList) ? sourceList.slice() : [];
    const normalizedEntries = temporaryEntries
      .map(entry => {
        if (!entry || typeof entry !== 'object') return null;
        const preservedExample = entry.example && typeof entry.example === 'object' ? entry.example : null;
        if (!preservedExample) return null;
        if (preservedExample[TEMPORARY_EXAMPLE_FLAG] !== true) {
          preservedExample[TEMPORARY_EXAMPLE_FLAG] = true;
        }
        if (preservedExample.temporary !== true) {
          preservedExample.temporary = true;
        }
        const originalIndex = Number.isInteger(entry.index) ? entry.index : baseList.length;
        return { originalIndex, example: preservedExample };
      })
      .filter(Boolean)
      .sort((a, b) => a.originalIndex - b.originalIndex);
    if (normalizedEntries.length === 0) {
      return { examples: baseList.slice(), indexMap: new Map() };
    }
    const nextExamples = baseList.slice();
    const indexMap = new Map();
    normalizedEntries.forEach(item => {
      let targetIndex = item.originalIndex;
      if (!Number.isInteger(targetIndex)) {
        targetIndex = nextExamples.length;
      }
      if (targetIndex < 0) {
        targetIndex = 0;
      } else if (targetIndex > nextExamples.length) {
        targetIndex = nextExamples.length;
      }
      nextExamples.splice(targetIndex, 0, item.example);
      indexMap.set(item.originalIndex, targetIndex);
    });
    cachedExamples = nextExamples;
    cachedExamplesInitialized = true;
    return { examples: nextExamples, indexMap };
  }
  function mergeBackendSyncPayload(payload) {
    if (!payload || typeof payload !== 'object') {
      return null;
    }
    const existingExamples = getExamples();
    const preservedTemporaryExamples = collectTemporaryExamplesForPreservation(existingExamples);
    const examplesFromServer = Array.isArray(payload.examples) ? payload.examples : [];
    const normalizedExamples = normalizeExamplesForStorage(examplesFromServer);
    const serialized = serializeExamplesForStorage(normalizedExamples);
    if (typeof serialized === 'string') {
      applyRawExamples(serialized, {
        reason: 'backend-sync',
        skipHistory: true,
        skipBackendSync: true
      });
    }
    let restoreResult = null;
    if (preservedTemporaryExamples.length > 0) {
      try {
        restoreResult = restoreTemporaryExamplesAfterSync(preservedTemporaryExamples);
      } catch (_) {
        restoreResult = null;
      }
    }
    const deletedProvidedList = Array.isArray(payload.deletedProvided) ? payload.deletedProvided : [];
    replaceDeletedProvidedExamples(deletedProvidedList);
    let updatedAtMs = null;
    if (Object.prototype.hasOwnProperty.call(payload, 'updatedAt')) {
      updatedAtMs = parseBackendUpdatedAt(payload.updatedAt);
    }
    if (updatedAtMs == null && Object.prototype.hasOwnProperty.call(payload, 'updatedAtMs')) {
      updatedAtMs = parseBackendUpdatedAt(payload.updatedAtMs);
    }
    if (updatedAtMs != null) {
      lastLocalUpdateMs = updatedAtMs;
      persistLocalUpdatedAt(lastLocalUpdateMs);
    }
    const updatedAtIso =
      updatedAtMs != null
        ? new Date(updatedAtMs).toISOString()
        : normalizeUpdatedAtIso(payload) || null;
    const finalExamples =
      (restoreResult && Array.isArray(restoreResult.examples)) ? restoreResult.examples : getExamples();
    return {
      examples: finalExamples,
      deletedProvided: deletedProvidedList.map(normalizeKey).filter(Boolean),
      updatedAt: updatedAtIso,
      updatedAtMs
    };
  }
  const MINIMUM_EXAMPLE_WARNING_MESSAGE = 'Du må ha minst ett lagret eksempel.';

  function showMinimumExampleWarning() {
    try {
      setSaveStatusState('error', { message: MINIMUM_EXAMPLE_WARNING_MESSAGE });
    } catch (_) {}
  }

  function showTrashRestoreHelp() {
    try {
      setSaveStatusState('success', {
        message: 'Slettede eksempler ligger i arkivet. Åpne svg-arkiv.html og trykk «Vis slettede figurer».'
      });
    } catch (_) {}
  }

  async function store(examples, options) {
    const previousExamples = getExamples();
    const previousCount = Array.isArray(previousExamples) ? previousExamples.length : 0;
    const normalized = normalizeExamplesForStorage(examples);
    const nextCount = Array.isArray(normalized) ? normalized.length : 0;
    const serialized = serializeExamplesForStorage(normalized);
    const opts = options && typeof options === 'object' ? options : {};
    const reason = typeof opts.reason === 'string' ? opts.reason : '';
    if (reason === 'delete' && (previousCount <= 1 || nextCount <= 0)) {
      lastKnownActionButtonCount = previousCount;
      showMinimumExampleWarning();
      try {
        updateActionButtonState(previousCount);
      } catch (_) {}
      return {
        ok: false,
        reason: 'minimum-examples',
        examples: previousExamples
      };
    }
    const applied = applyRawExamples(serialized, opts);
    if (!applied) {
      return { ok: false, examples: getExamples() };
    }
    lastKnownActionButtonCount = Array.isArray(normalized) ? normalized.length : 0;
    const userInitiated = isUserInitiatedReason(reason);
    if (userInitiated) {
      localChangesSinceLoad = true;
    }
    if (userInitiated) {
      lastLocalUpdateMs = Date.now();
      persistLocalUpdatedAt(lastLocalUpdateMs);
      beginUserSaveStatus(reason);
    }
    const shouldSkipSync = opts.skipBackendSync === true || !backendReady;
    const shouldLockButtons = userInitiated && !shouldSkipSync;
    if (shouldSkipSync) {
      backendSyncDeferred = true;
      if (userInitiated) {
        markUserSaveDeferred();
      }
      return { ok: true, deferred: true, examples: getExamples(), updatedAt: null };
    }
    backendSyncDeferred = false;
    notifyBackendChange({ force: userInitiated });
    const syncOptions = {
      initiatedBy: userInitiated ? reason : null,
      skipStatusUpdate: userInitiated
    };
    let syncResult = null;
    let syncError = null;
    try {
      if (shouldLockButtons) {
        setActionButtonsBusy(true);
      }
      const syncPromise = flushBackendSync(syncOptions);
      if (syncPromise) {
        syncResult = await syncPromise;
      } else {
        syncResult = await performBackendSync(syncOptions);
      }
    } catch (error) {
      if (userInitiated) {
        markUserSaveError(error);
      }
      syncError = error;
    } finally {
      if (shouldLockButtons) {
        setActionButtonsBusy(false);
      }
    }
    if (syncError) {
      return {
        ok: true,
        offline: true,
        error: syncError,
        examples: getExamples(),
        updatedAt: null
      };
    }
    const updatedAtIso =
      (syncResult && syncResult.merged && syncResult.merged.updatedAt) ||
      (syncResult && syncResult.payload && normalizeUpdatedAtIso(syncResult.payload)) ||
      null;
    if (userInitiated) {
      markUserSaveSuccess(updatedAtIso);
    }
    return {
      ok: true,
      result: syncResult,
      merged: syncResult ? syncResult.merged || null : null,
      payload: syncResult ? syncResult.payload || null : null,
      examples: getExamples(),
      updatedAt: updatedAtIso
    };
  }
  const BINDING_NAMES = ['STATE', 'CFG', 'CONFIG', 'SIMPLE'];
  const DELETED_PROVIDED_KEY = key + '_deletedProvidedExamples';
  const MIGRATION_FLAG_STORAGE_KEY = key + '_backend_migrated_v1';
  let deletedProvidedExamples = null;
  function normalizeKey(value) {
    return (typeof value === 'string' ? value.trim() : '') || '';
  }

  function normalizeBackendExample(example) {
    if (!example || typeof example !== 'object') {
      return {};
    }
    const normalizedList = normalizeExamplesForStorage([example]);
    const base = Array.isArray(normalizedList) && normalizedList.length > 0 && normalizedList[0]
      ? normalizedList[0]
      : {};
    const copy = { ...base };
    const fallbackDescription = extractDescriptionFromExample(example);
    if (fallbackDescription) {
      copy.description = fallbackDescription;
    } else if (typeof copy.description === 'string') {
      copy.description = copy.description.trim();
    }
    if (!copy.description && copy.description !== '') {
      copy.description = '';
    }
    if (Object.prototype.hasOwnProperty.call(copy, '__builtinKey')) {
      const key = normalizeKey(copy.__builtinKey);
      if (key) {
        copy.__builtinKey = key;
      } else {
        delete copy.__builtinKey;
      }
    }
    return copy;
  }

  function normalizeBackendExamples(examples) {
    if (!Array.isArray(examples)) {
      return [];
    }
    return examples.map(example => normalizeBackendExample(example));
  }
  function getDeletedProvidedExamples() {
    if (deletedProvidedExamples) return deletedProvidedExamples;
    deletedProvidedExamples = new Set();
    try {
      const stored = storageGetItem(DELETED_PROVIDED_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed)) {
          parsed.forEach(value => {
            const key = normalizeKey(value);
            if (key) deletedProvidedExamples.add(key);
          });
        }
      }
    } catch (error) {
      deletedProvidedExamples = new Set();
    }
    return deletedProvidedExamples;
  }
  function persistDeletedProvidedExamples() {
    if (!deletedProvidedExamples) return;
    try {
      storageSetItem(DELETED_PROVIDED_KEY, JSON.stringify(Array.from(deletedProvidedExamples)));
    } catch (error) {}
    if (deletedProvidedExamples.size > 0) {
      localChangesSinceLoad = true;
    }
    notifyBackendChange({ force: true });
  }
  function replaceDeletedProvidedExamples(list) {
    const next = new Set();
    if (Array.isArray(list)) {
      list.forEach(value => {
        const key = normalizeKey(value);
        if (key) {
          next.add(key);
        }
      });
    }
    deletedProvidedExamples = next;
    if (deletedProvidedExamples.size > 0) {
      try {
        storageSetItem(DELETED_PROVIDED_KEY, JSON.stringify(Array.from(deletedProvidedExamples)));
      } catch (_) {}
    } else {
      try {
        storageRemoveItem(DELETED_PROVIDED_KEY);
      } catch (_) {}
    }
    return deletedProvidedExamples;
  }
  function hasCompletedExamplesMigration() {
    if (typeof window === 'undefined') return true;
    if (window.__EXAMPLES_MIGRATION_DONE__ === true) {
      return true;
    }
    let stored = null;
    try {
      stored = storageGetItem(MIGRATION_FLAG_STORAGE_KEY);
    } catch (_) {
      stored = null;
    }
    if (stored === '1') {
      window.__EXAMPLES_MIGRATION_DONE__ = true;
      return true;
    }
    return false;
  }
  function markExamplesMigrationComplete() {
    if (typeof window !== 'undefined') {
      window.__EXAMPLES_MIGRATION_DONE__ = true;
    }
    try {
      storageSetItem(MIGRATION_FLAG_STORAGE_KEY, '1');
    } catch (_) {}
  }
  function clearLegacyExamplesStorageArtifacts() {
    try {
      storageRemoveItem(key);
    } catch (_) {}
    try {
      storageRemoveItem(DELETED_PROVIDED_KEY);
    } catch (_) {}
  }
  function markProvidedExampleDeleted(value) {
    const key = normalizeKey(value);
    if (!key) return;
    const set = getDeletedProvidedExamples();
    if (!set.has(key)) {
      set.add(key);
      persistDeletedProvidedExamples();
    }
  }
  function flushPendingChanges() {
    const fields = document.querySelectorAll('input, textarea, select');
    fields.forEach(field => {
      ['input', 'change'].forEach(type => {
        try {
          field.dispatchEvent(new Event(type, {
            bubbles: true
          }));
        } catch (_) {}
      });
    });
    const syncFns = ['applyCfg', 'applyConfig'];
    syncFns.forEach(name => {
      const fn = window[name];
      if (typeof fn === 'function') {
        try {
          fn();
        } catch (_) {}
      }
    });
  }
  async function generateExampleThumbnail(svgMarkup) {
    if (typeof svgMarkup !== 'string') return null;
    const sanitized = svgMarkup.trim();
    if (!sanitized) return null;
    if (typeof document === 'undefined') return null;
    if (typeof Blob !== 'function' || typeof Image !== 'function') return null;
    if (typeof URL === 'undefined' || typeof URL.createObjectURL !== 'function') return null;
    const createCanvas = () => {
      if (typeof document.createElement === 'function') {
        try {
          const canvas = document.createElement('canvas');
          if (canvas && typeof canvas.getContext === 'function') {
            return canvas;
          }
        } catch (_) {}
      }
      if (typeof OffscreenCanvas === 'function') {
        try {
          return new OffscreenCanvas(1, 1);
        } catch (_) {}
      }
      return null;
    };
    const canvas = createCanvas();
    if (!canvas) return null;
    let objectUrl = null;
    try {
      const blob = new Blob([sanitized], { type: 'image/svg+xml' });
      objectUrl = URL.createObjectURL(blob);
      const image = await new Promise((resolve, reject) => {
        const img = new Image();
        const cleanup = () => {
          img.onload = null;
          img.onerror = null;
        };
        img.onload = () => {
          cleanup();
          resolve(img);
        };
        img.onerror = () => {
          cleanup();
          reject(new Error('Failed to load SVG for thumbnail'));
        };
        img.src = objectUrl;
      });
      if (image && typeof image.decode === 'function') {
        try {
          await image.decode();
        } catch (_) {}
      }
      const naturalWidth = Number(image && (image.naturalWidth || image.width || 0));
      const naturalHeight = Number(image && (image.naturalHeight || image.height || 0));
      const fallbackSize = MAX_THUMBNAIL_DIMENSION;
      const rawWidth = Number.isFinite(naturalWidth) && naturalWidth > 0 ? naturalWidth : fallbackSize;
      const rawHeight = Number.isFinite(naturalHeight) && naturalHeight > 0 ? naturalHeight : fallbackSize;
      const longestSide = Math.max(rawWidth, rawHeight, 1);
      const scale = longestSide > MAX_THUMBNAIL_DIMENSION ? MAX_THUMBNAIL_DIMENSION / longestSide : 1;
      const width = Math.max(1, Math.round(rawWidth * scale));
      const height = Math.max(1, Math.round(rawHeight * scale));
      if (typeof canvas.width === 'number') {
        canvas.width = width;
      }
      if (typeof canvas.height === 'number') {
        canvas.height = height;
      }
      const context = typeof canvas.getContext === 'function' ? canvas.getContext('2d') : null;
      if (!context || typeof context.drawImage !== 'function') {
        return null;
      }
      if (typeof context.clearRect === 'function') {
        context.clearRect(0, 0, width, height);
      }
      try {
        context.drawImage(image, 0, 0, width, height);
      } catch (_) {
        return null;
      }
      let dataUrl = null;
      if (typeof canvas.toDataURL === 'function') {
        try {
          dataUrl = canvas.toDataURL('image/png');
        } catch (_) {
          dataUrl = null;
        }
      } else if (typeof canvas.convertToBlob === 'function' && typeof FileReader === 'function') {
        try {
          const pngBlob = await canvas.convertToBlob({ type: 'image/png' });
          dataUrl = await new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => {
              resolve(typeof reader.result === 'string' ? reader.result : '');
            };
            reader.onerror = () => {
              reject(new Error('Failed to read thumbnail blob'));
            };
            reader.readAsDataURL(pngBlob);
          });
        } catch (_) {
          dataUrl = null;
        }
      }
      if (typeof dataUrl !== 'string') {
        return null;
      }
      const trimmedUrl = dataUrl.trim();
      if (!trimmedUrl || !/^data:image\/png;base64,/i.test(trimmedUrl)) {
        return null;
      }
      if (computeByteLength(trimmedUrl) > MAX_THUMBNAIL_STORAGE_BYTES) {
        return null;
      }
      return trimmedUrl;
    } catch (_) {
      return null;
    } finally {
      if (objectUrl && typeof URL.revokeObjectURL === 'function') {
        try {
          URL.revokeObjectURL(objectUrl);
        } catch (_) {}
      }
    }
  }
  function collectExampleSvgMarkup(options) {
    if (typeof document === 'undefined') return '';
    const opts = options && typeof options === 'object' ? options : {};
    if (opts.flush !== false) {
      try {
        flushPendingChanges();
      } catch (_) {}
    }
    const detail = { svgOverride: null };
    if (typeof window !== 'undefined' && window) {
      try {
        let evt;
        if (typeof CustomEvent === 'function') {
          evt = new CustomEvent('examples:collect', {
            detail
          });
        } else {
          evt = new Event('examples:collect');
          try {
            evt.detail = detail;
          } catch (_) {}
        }
        window.dispatchEvent(evt);
      } catch (error) {
        try {
          const evt = new Event('examples:collect');
          try {
            evt.detail = detail;
          } catch (_) {}
          window.dispatchEvent(evt);
        } catch (_) {}
      }
    }
    let svgMarkup = '';
    const override = detail.svgOverride;
    if (override != null) {
      if (typeof override === 'string') {
        svgMarkup = override;
      } else if (override && typeof override.outerHTML === 'string') {
        svgMarkup = override.outerHTML;
      }
    }
    if (!svgMarkup) {
      const svg = document.querySelector('svg');
      if (svg && typeof svg.outerHTML === 'string') {
        svgMarkup = svg.outerHTML;
      }
    }
    return typeof svgMarkup === 'string' ? svgMarkup : '';
  }
  function ensureLoadingOverlayElement() {
    if (typeof document === 'undefined') return null;
    if (loadingOverlayElement && loadingOverlayElement.isConnected) {
      return loadingOverlayElement;
    }
    const existing = document.getElementById('exampleLoadingOverlay');
    if (existing && existing.classList && existing.classList.contains('example-loading-overlay')) {
      loadingOverlayElement = existing;
    } else {
      const overlay = document.createElement('div');
      overlay.id = 'exampleLoadingOverlay';
      overlay.className = 'example-loading-overlay';
      overlay.setAttribute('aria-hidden', 'true');
      const content = document.createElement('div');
      content.className = 'example-loading-overlay__content';
      content.setAttribute('role', 'status');
      content.setAttribute('aria-live', 'polite');
      const spinner = document.createElement('div');
      spinner.className = 'example-loading-overlay__spinner';
      const text = document.createElement('div');
      text.className = 'example-loading-overlay__text';
      text.textContent = 'Laster inn eksempel …';
      content.appendChild(spinner);
      content.appendChild(text);
      overlay.appendChild(content);
      loadingOverlayElement = overlay;
    }
    const attachOverlay = () => {
      const parent = document.body || document.documentElement;
      if (!parent || !loadingOverlayElement) return false;
      if (loadingOverlayElement.parentNode === parent) return true;
      try {
        parent.appendChild(loadingOverlayElement);
        return true;
      } catch (_) {
        return false;
      }
    };
    if (!attachOverlay()) {
      const onReady = () => {
        document.removeEventListener('DOMContentLoaded', onReady);
        attachOverlay();
      };
      document.addEventListener('DOMContentLoaded', onReady);
    }
    return loadingOverlayElement;
  }
  function showLoadingOverlay() {
    if (typeof document === 'undefined') return;
    const overlay = ensureLoadingOverlayElement();
    if (!overlay) return;
    if (loadingOverlayHideTimer) {
      clearTimeout(loadingOverlayHideTimer);
      loadingOverlayHideTimer = null;
    }
    loadingOverlayVisible = true;
    loadingOverlayLastShownAt = Date.now();
    overlay.classList.add('is-visible');
    overlay.setAttribute('aria-hidden', 'false');
  }
  function hideLoadingOverlay(options) {
    if (typeof document === 'undefined') return;
    const overlay = ensureLoadingOverlayElement();
    if (!overlay) return;
    const opts = options && typeof options === 'object' ? options : {};
    const immediate = opts.immediate === true;
    const finalize = () => {
      overlay.classList.remove('is-visible');
      overlay.setAttribute('aria-hidden', 'true');
      loadingOverlayVisible = false;
      if (loadingOverlayHideTimer) {
        clearTimeout(loadingOverlayHideTimer);
        loadingOverlayHideTimer = null;
      }
    };
    if (!loadingOverlayVisible && !immediate) {
      finalize();
      return;
    }
    if (immediate) {
      finalize();
      return;
    }
    const minVisibleMs = 150;
    const elapsed = Date.now() - loadingOverlayLastShownAt;
    const delay = elapsed < minVisibleMs ? minVisibleMs - elapsed : 0;
    if (delay > 0) {
      if (loadingOverlayHideTimer) {
        clearTimeout(loadingOverlayHideTimer);
      }
      loadingOverlayHideTimer = setTimeout(finalize, delay);
    } else {
      finalize();
    }
  }
  function ensureTabStyles() {
    if (document.getElementById('exampleTabStyles')) return;
    const style = document.createElement('style');
    style.id = 'exampleTabStyles';
    style.textContent = `
.example-tabs{display:flex;flex-wrap:wrap;gap:6px;margin-top:10px;margin-bottom:0;align-items:flex-end;padding-bottom:0;}
.example-tab{appearance:none;border:1px solid #d1d5db;border-bottom:none;background:#f3f4f6;color:#374151;border-radius:10px 10px 0 0;padding:6px 14px;font-size:14px;line-height:1;cursor:pointer;transition:background-color .2s,border-color .2s,color .2s;box-shadow:0 -1px 0 rgba(15,23,42,.08) inset;margin-bottom:-1px;}
.example-tab:hover{background:#e5e7eb;}
.example-tab.is-active{background:#fff;color:#111827;border-color:var(--purple,#5B2AA5);border-bottom:1px solid #fff;box-shadow:0 -2px 0 var(--purple,#5B2AA5) inset;}
.example-tab:focus-visible{outline:2px solid var(--purple,#5B2AA5);outline-offset:2px;}
.example-tab.is-new{position:relative;}
.example-tab.is-new::after{content:'NY';margin-left:8px;font-size:11px;font-weight:700;color:#b91c1c;text-transform:uppercase;letter-spacing:.04em;}
.example-tabs-empty{font-size:13px;color:#6b7280;padding:12px 0;display:flex;flex-wrap:wrap;align-items:center;gap:10px;}
.example-tabs-empty__message{flex:0 0 auto;}
.example-tabs-empty__cta{appearance:none;border:1px solid #d1d5db;background:#fff;color:#374151;border-radius:9999px;padding:6px 16px;font-size:13px;line-height:1;cursor:pointer;transition:background-color .2s,border-color .2s,color .2s,box-shadow .2s;}
.example-tabs-empty__cta:hover{background:#f3f4f6;border-color:#cbd5f5;}
.example-tabs-empty__cta:focus-visible{outline:2px solid var(--purple,#5B2AA5);outline-offset:2px;}
.example-backend-notice{margin-top:12px;margin-bottom:12px;padding:10px 14px;border-radius:10px;background:#fee2e2;border:1px solid #f87171;color:#991b1b;font-size:14px;line-height:1.4;display:flex;flex-wrap:wrap;gap:4px;align-items:center;}
.example-backend-notice__title{font-weight:600;display:inline-flex;align-items:center;}
.example-backend-notice__message{display:inline-flex;align-items:center;}
.example-save-status{margin-left:auto;display:flex;align-items:center;gap:6px;font-size:12px;color:#6b7280;line-height:1.2;}
.example-save-status[data-status="success"]{color:#047857;}
.example-save-status[data-status="error"]{color:#b91c1c;}
.example-save-status__spinner{display:none;width:14px;height:14px;border-radius:50%;border:2px solid rgba(107,114,128,.35);border-top-color:var(--purple,#5B2AA5);animation:example-save-status-spin .8s linear infinite;}
.example-save-status[data-status="saving"] .example-save-status__spinner,.example-save-status[data-status="pending-sync"] .example-save-status__spinner{display:inline-flex;}
.example-save-status__text{display:inline-flex;align-items:center;}
@keyframes example-save-status-spin{to{transform:rotate(360deg);}}
.example-loading-overlay{position:fixed;z-index:2147483640;inset:0;background:rgba(255,255,255,.95);display:flex;align-items:center;justify-content:center;opacity:0;pointer-events:none;transition:opacity .2s ease;}
.example-loading-overlay.is-visible{opacity:1;pointer-events:auto;}
.example-loading-overlay__content{display:flex;flex-direction:column;align-items:center;gap:12px;padding:24px 32px;border-radius:16px;background:#fff;box-shadow:0 10px 40px rgba(15,23,42,.15);color:#1f2937;text-align:center;}
.example-loading-overlay__spinner{width:48px;height:48px;border-radius:50%;border:4px solid rgba(107,114,128,.25);border-top-color:var(--purple,#5B2AA5);animation:example-loading-overlay-spin .9s linear infinite;}
.example-loading-overlay__text{font-size:16px;font-weight:600;}
@keyframes example-loading-overlay-spin{to{transform:rotate(360deg);}}
.card-has-settings .example-settings{margin-top:6px;padding-top:12px;border-top:1px solid #e5e7eb;display:flex;flex-direction:column;gap:10px;}
.card-has-settings .example-settings > .example-tabs{margin-top:0;margin-bottom:0;}
.card-has-settings .example-settings > h2:first-child{margin-top:0;}
.card-has-settings .example-settings > .example-tabs + h2{margin-top:0;}
`;
    document.head.appendChild(style);
  }
  function placeTabsInsideSettings(exampleCard) {
    if (!tabsContainer || !exampleCard) return;
    const settingsWrapper = exampleCard.querySelector(':scope > .example-settings');
    if (!settingsWrapper) return;
    let firstChild = settingsWrapper.firstChild;
    if (firstChild === tabsContainer) return;
    tabsContainer.remove();
    while (firstChild && firstChild.nodeType === Node.TEXT_NODE && !firstChild.textContent.trim()) {
      const toRemove = firstChild;
      firstChild = firstChild.nextSibling;
      settingsWrapper.removeChild(toRemove);
    }
    settingsWrapper.insertBefore(tabsContainer, firstChild);
  }
  function adjustTabsSpacing() {
    if (!tabsContainer) return;
    const parent = tabsContainer.parentElement;
    if (parent && parent.classList && parent.classList.contains('example-settings')) {
      tabsContainer.style.marginTop = '0';
      tabsContainer.style.marginBottom = '0';
    } else {
      tabsContainer.style.removeProperty('margin-top');
      tabsContainer.style.removeProperty('margin-bottom');
    }
  }
  function moveDescriptionBelowTabs() {
    if (!tabsContainer) return;
    const description = document.querySelector('.example-description');
    if (!description || !description.parentElement) return;
    const settingsWrapper = tabsContainer.closest('.example-settings');
    const targetParent = settingsWrapper || tabsContainer.parentElement;
    if (!targetParent) return;
    let referenceNode = tabsContainer.nextSibling;
    while (referenceNode && referenceNode.nodeType === Node.TEXT_NODE && !referenceNode.textContent.trim()) {
      referenceNode = referenceNode.nextSibling;
    }
    if (referenceNode === description) return;
    if (description.parentElement !== targetParent) {
      if (referenceNode) {
        targetParent.insertBefore(description, referenceNode);
      } else {
        targetParent.appendChild(description);
      }
      return;
    }
    if (referenceNode) {
      targetParent.insertBefore(description, referenceNode);
    } else {
      targetParent.appendChild(description);
    }
  }
  function moveSettingsIntoExampleCard() {
    if (!toolbarElement) return;
    const exampleCard = toolbarElement.closest('.card');
    if (!exampleCard) return;
    tabsHostCard = exampleCard;
    if (!exampleCard.classList.contains('card-has-settings')) {
      let candidate = exampleCard.nextElementSibling;
      let settingsCard = null;
      while (candidate) {
        if (candidate.nodeType !== Node.ELEMENT_NODE) {
          candidate = candidate.nextElementSibling;
          continue;
        }
        if (!candidate.classList.contains('card')) {
          candidate = candidate.nextElementSibling;
          continue;
        }
        if (candidate.classList.contains('card--settings') || candidate.getAttribute('data-card') === 'settings') {
          settingsCard = candidate;
          break;
        }
        const heading = candidate.querySelector(':scope > h2');
        const text = heading ? heading.textContent.trim().toLowerCase() : '';
        if (text === 'innstillinger' || text === 'innstilling') {
          settingsCard = candidate;
          break;
        }
        candidate = candidate.nextElementSibling;
      }
      if (settingsCard) {
        const settingsWrapper = document.createElement('div');
        settingsWrapper.className = 'example-settings';
        while (settingsCard.firstChild) {
          settingsWrapper.appendChild(settingsCard.firstChild);
        }
        exampleCard.appendChild(settingsWrapper);
        settingsCard.remove();
        exampleCard.classList.add('card-has-settings');
      }
    }
    placeTabsInsideSettings(exampleCard);
    adjustTabsSpacing();
    moveDescriptionBelowTabs();
  }
  function getBinding(name) {
    if (name in window && window[name]) return window[name];
    try {
      switch (name) {
        case 'STATE':
          return typeof STATE !== 'undefined' && STATE ? STATE : undefined;
        case 'CFG':
          return typeof CFG !== 'undefined' && CFG ? CFG : undefined;
        case 'CONFIG':
          return typeof CONFIG !== 'undefined' && CONFIG ? CONFIG : undefined;
        case 'SIMPLE':
          return typeof SIMPLE !== 'undefined' && SIMPLE ? SIMPLE : undefined;
        default:
          return undefined;
      }
    } catch (error) {
      return undefined;
    }
  }
  function valueRequiresCustomClone(value, seen) {
    if (value == null || typeof value !== 'object') return false;
    if (seen.has(value)) return false;
    seen.add(value);
    const tag = Object.prototype.toString.call(value);
    if (tag === '[object Map]' || tag === '[object Set]' || tag === '[object Date]' || tag === '[object RegExp]') {
      return true;
    }
    if (Array.isArray(value)) {
      for (let i = 0; i < value.length; i++) {
        if (valueRequiresCustomClone(value[i], seen)) {
          return true;
        }
      }
      return false;
    }
    const keys = Object.keys(value);
    for (let i = 0; i < keys.length; i++) {
      const key = keys[i];
      if (valueRequiresCustomClone(value[key], seen)) {
        return true;
      }
    }
    return false;
  }
  function cloneValue(value) {
    if (value == null) return value;
    if (typeof structuredClone === 'function') {
      try {
        return structuredClone(value);
      } catch (error) {}
    }
    if (!valueRequiresCustomClone(value, new WeakSet())) {
      try {
        return JSON.parse(JSON.stringify(value));
      } catch (error) {}
    }
    return cloneValueFallback(value, new WeakMap());
  }
  function cloneValueFallback(value, seen) {
    if (value == null || typeof value !== 'object') return value;
    if (seen.has(value)) return seen.get(value);
    if (Array.isArray(value)) {
      const arr = [];
      seen.set(value, arr);
      for (let i = 0; i < value.length; i++) {
        arr[i] = cloneValueFallback(value[i], seen);
      }
      return arr;
    }
    const tag = Object.prototype.toString.call(value);
    if (tag === '[object Date]') {
      return new Date(value.getTime());
    }
    if (tag === '[object RegExp]') {
      return new RegExp(value);
    }
    if (tag === '[object Map]') {
      const map = new Map();
      seen.set(value, map);
      value.forEach((v, k) => {
        map.set(cloneValueFallback(k, seen), cloneValueFallback(v, seen));
      });
      return map;
    }
    if (tag === '[object Set]') {
      const set = new Set();
      seen.set(value, set);
      value.forEach(v => {
        set.add(cloneValueFallback(v, seen));
      });
      return set;
    }
    if (tag !== '[object Object]') {
      return value;
    }
    const clone = {};
    seen.set(value, clone);
    Object.keys(value).forEach(key => {
      clone[key] = cloneValueFallback(value[key], seen);
    });
    return clone;
  }
  function replaceContents(target, source) {
    if (!target || source == null) return false;
    if (Array.isArray(target) && Array.isArray(source)) {
      target.length = 0;
      target.push(...source);
      return true;
    }
    if (typeof target === 'object' && typeof source === 'object') {
      Object.keys(target).forEach(key => {
        if (!Object.prototype.hasOwnProperty.call(source, key)) delete target[key];
      });
      Object.assign(target, source);
      return true;
    }
    return false;
  }
  function applyBinding(name, value) {
    if (value == null) return;
    const applyToTarget = target => {
      if (!target) return false;
      const cloned = cloneValue(value);
      return replaceContents(target, cloned);
    };
    const target = getBinding(name);
    const appliedToTarget = applyToTarget(target);
    if (target && window[name] !== target) {
      window[name] = target;
    }
    if (appliedToTarget) {
      return;
    }
    const winVal = name in window ? window[name] : undefined;
    if (applyToTarget(winVal)) return;
    window[name] = cloneValue(value);
  }
  if (typeof window !== 'undefined') {
    for (const name of BINDING_NAMES) {
      const binding = getBinding(name);
      if (binding != null && window[name] !== binding) {
        window[name] = binding;
      }
    }
  }
  function triggerRefresh(index) {
    const tried = new Set();
    const candidates = ['render', 'renderAll', 'draw', 'drawAll', 'update', 'updateAll', 'init', 'initAll', 'initFromCfg', 'initFromHtml', 'refresh', 'redraw', 'rerender', 'recalc', 'applyCfg', 'applyConfig', 'applyState', 'setup', 'rebuild'];
    for (const name of candidates) {
      const fn = window[name];
      if (typeof fn === 'function' && !tried.has(fn)) {
        try {
          fn();
        } catch (_) {}
        tried.add(fn);
      }
    }
    let dispatched = false;
    if (typeof CustomEvent === 'function') {
      try {
        window.dispatchEvent(new CustomEvent('examples:loaded', {
          detail: {
            index
          }
        }));
        dispatched = true;
      } catch (_) {}
    }
    if (!dispatched) {
      try {
        window.dispatchEvent(new Event('examples:loaded'));
      } catch (_) {}
    }
  }
  function collectCurrentConfig() {
    flushPendingChanges();
    const svgMarkup = collectExampleSvgMarkup({ flush: false });
    const cfg = {};
    for (const name of BINDING_NAMES) {
      const binding = getBinding(name);
      if (binding != null && typeof binding !== 'function') {
        cfg[name] = cloneValue(binding);
      }
    }
    return {
      config: cfg,
      svg: svgMarkup,
      description: getDescriptionValue()
    };
  }
  function notifyParentExampleChange(index) {
    if (typeof window === 'undefined') return;
    const targetWindow = (() => {
      try {
        return window.parent;
      } catch (_) {
        return null;
      }
    })();
    const normalizedIndex = Number.isInteger(index) && index >= 0 ? index : null;
    const exampleNumber = normalizedIndex != null ? normalizedIndex + 1 : null;
    try {
      if (typeof history !== 'undefined' && typeof history.replaceState === 'function') {
        const url = new URL(window.location.href);
        if (exampleNumber != null) {
          url.searchParams.set('example', String(exampleNumber));
        } else {
          url.searchParams.delete('example');
        }
        history.replaceState(history.state, document.title, `${url.pathname}${url.search}${url.hash}`);
      }
    } catch (_) {}
    if (!targetWindow || targetWindow === window || typeof targetWindow.postMessage !== 'function') return;
    try {
      targetWindow.postMessage({
        type: 'math-visuals:example-change',
        exampleIndex: normalizedIndex,
        exampleNumber,
        path: window.location.pathname,
        href: window.location.href
      }, '*');
    } catch (_) {}
  }
  function loadExample(index) {
    const scheduleOverlayHide = immediate => {
      if (immediate) {
        hideLoadingOverlay({ immediate: true });
        return;
      }
      const raf =
        typeof window !== 'undefined' && typeof window.requestAnimationFrame === 'function'
          ? window.requestAnimationFrame
          : null;
      if (raf) {
        raf(() => {
          raf(() => hideLoadingOverlay());
        });
      } else {
        setTimeout(() => hideLoadingOverlay(), 32);
      }
    };
    showLoadingOverlay();
    const examples = getExamples();
    const ex = examples[index];
    if (!ex || !ex.config) {
      setDescriptionValue('');
      scheduleOverlayHide(true);
      return false;
    }
    const description = extractDescriptionFromExample(ex);
    setDescriptionValue(description);
    if (currentAppMode === 'task') {
      ensureTaskModeDescriptionRendered();
    }
    const cfg = ex.config;
    let applied = false;
    for (const name of BINDING_NAMES) {
      if (cfg[name] != null) {
        applyBinding(name, cfg[name]);
        applied = true;
      }
    }
    if (applied) {
      currentExampleIndex = index;
      pendingRequestedIndex = null;
      initialLoadPerformed = true;
      updateTabSelection();
      triggerRefresh(index);
      notifyParentExampleChange(index);
      maybeAnnounceTemporaryExample(index, ex);
      scheduleOverlayHide(false);
    } else {
      scheduleOverlayHide(true);
    }
    return applied;
  }
  function updateTabSelection() {
    if (!tabsContainer || !Array.isArray(tabButtons)) return;
    tabButtons.forEach((btn, idx) => {
      if (!btn) return;
      const isActive = idx === currentExampleIndex;
      btn.classList.toggle('is-active', isActive);
      btn.setAttribute('aria-selected', isActive ? 'true' : 'false');
      btn.tabIndex = isActive ? 0 : -1;
    });
  }
  function extractExampleFromOpenRequest(request) {
    if (!request || typeof request !== 'object') return null;
    const direct = request.example || request.exampleData || request.payload;
    if (direct && typeof direct === 'object') {
      return direct;
    }
    if (Array.isArray(request.examples) && request.examples.length > 0) {
      const idx = Number.isInteger(request.index) && request.index >= 0 && request.index < request.examples.length ? request.index : 0;
      const candidate = request.examples[idx];
      if (candidate && typeof candidate === 'object') {
        return candidate;
      }
    }
    return null;
  }
  function getOpenRequestTargetPath(request) {
    if (!request || typeof request !== 'object') return null;
    const candidates = [request.canonicalPath, request.path, request.target, request.href];
    for (const candidate of candidates) {
      if (typeof candidate !== 'string') continue;
      const trimmed = candidate.trim();
      if (!trimmed) continue;
      try {
        const normalized = normalizePathname(trimmed);
        if (normalized) return normalized;
      } catch (_) {}
    }
    return null;
  }
  function handleArchiveOpenRequest(request, options) {
    if (!request || typeof request !== 'object') return null;
    const targetPath = getOpenRequestTargetPath(request);
    if (targetPath && targetPath !== storagePath) {
      return null;
    }
    const exampleData = extractExampleFromOpenRequest(request);
    const opts = options && typeof options === 'object' ? options : {};
    const deferRender = opts.deferRender === true || opts.skipRender === true;
    const deferLoad = opts.deferLoad === true || opts.skipLoad === true;
    const skipNotice = opts.skipNotice === true;
    const metadata = {
      index: Number.isInteger(request.index) ? Math.max(0, request.index) : undefined,
      requestId: request.id || request.requestId || request.referenceId || request.createdAt || opts.requestId || null,
      sourcePath: typeof request.path === 'string' ? request.path : typeof request.sourcePath === 'string' ? request.sourcePath : null,
      createdAt: request.createdAt || request.created || null
    };
    const normalizedRequestId =
      metadata.requestId != null && metadata.requestId !== '' ? String(metadata.requestId) : null;
    const normalizedSourcePath =
      typeof metadata.sourcePath === 'string' && metadata.sourcePath.trim() ? metadata.sourcePath.trim() : null;
    metadata.requestId = normalizedRequestId;
    metadata.sourcePath = normalizedSourcePath;
    if (normalizedRequestId || normalizedSourcePath) {
      const examples = getExamples();
      if (Array.isArray(examples) && examples.length > 0) {
        for (let idx = examples.length - 1; idx >= 0; idx--) {
          const candidate = examples[idx];
          if (!candidate || typeof candidate !== 'object') {
            continue;
          }
          const candidateRequestId =
            typeof candidate[TEMPORARY_EXAMPLE_REQUEST_ID] === 'string'
              ? candidate[TEMPORARY_EXAMPLE_REQUEST_ID]
              : null;
          const candidateSourcePath =
            typeof candidate[TEMPORARY_EXAMPLE_SOURCE_PATH] === 'string'
              ? candidate[TEMPORARY_EXAMPLE_SOURCE_PATH]
              : null;
          const requestMatches = normalizedRequestId && candidateRequestId === normalizedRequestId;
          const sourceMatches = normalizedSourcePath && candidateSourcePath === normalizedSourcePath;
          if (!requestMatches && !sourceMatches) {
            continue;
          }
          examples.splice(idx, 1);
          if (Number.isInteger(metadata.index) && idx <= metadata.index) {
            metadata.index = Math.max(0, metadata.index - 1);
          }
        }
      }
    }
    if (exampleData) {
      const inserted = createTemporaryExample(exampleData, { ...metadata, skipNotice });
      if (!inserted) {
        return { handled: false, type: 'archive', reason: 'insert-failed', metadata };
      }
      if (!skipNotice && Number.isInteger(inserted.index)) {
        pendingArchiveExampleNotice = {
          index: inserted.index,
          requestId:
            metadata.requestId != null
              ? String(metadata.requestId)
              : inserted.example && inserted.example[TEMPORARY_EXAMPLE_REQUEST_ID]
              ? String(inserted.example[TEMPORARY_EXAMPLE_REQUEST_ID])
              : null,
          sourcePath: metadata.sourcePath || null,
          createdAt: metadata.createdAt || null
        };
      } else if (skipNotice && pendingArchiveExampleNotice && pendingArchiveExampleNotice.index === inserted.index) {
        pendingArchiveExampleNotice = null;
      }
      if (deferRender) {
        return {
          handled: true,
          type: 'archive',
          mode: deferLoad ? 'injected' : 'queued',
          index: inserted.index,
          example: inserted.example,
          metadata
        };
      }
      currentExampleIndex = inserted.index;
      renderOptions();
      let loaded = true;
      if (!deferLoad) {
        loaded = loadExample(inserted.index);
      }
      return {
        handled: !!loaded,
        type: 'archive',
        mode: deferLoad ? 'queued' : 'loaded',
        index: inserted.index,
        example: inserted.example,
        metadata
      };
    }
    if (Number.isInteger(metadata.index)) {
      const indexToLoad = Math.max(0, metadata.index);
      if (deferRender) {
        return {
          handled: true,
          type: 'archive',
          mode: 'queued',
          index: indexToLoad,
          example: null,
          metadata
        };
      }
      if (deferLoad) {
        currentExampleIndex = indexToLoad;
        renderOptions();
        return {
          handled: true,
          type: 'archive',
          mode: 'queued',
          index: indexToLoad,
          example: null,
          metadata
        };
      }
      const loaded = loadExample(indexToLoad);
      return {
        handled: !!loaded,
        type: 'archive',
        mode: 'loaded',
        index: indexToLoad,
        example: null,
        metadata
      };
    }
    return { handled: false, type: 'archive', reason: 'no-example', metadata };
  }
  function handleLegacyOpenRequest(request) {
    if (!request || typeof request !== 'object') return false;
    const normalizedPath = typeof request.path === 'string' ? normalizePathname(request.path) : null;
    if (normalizedPath && normalizedPath !== storagePath) {
      return false;
    }
    const index = Number.isInteger(request.index) ? request.index : Number.isInteger(request.exampleIndex) ? request.exampleIndex : null;
    if (index == null || index < 0) {
      return false;
    }
    return loadExample(index);
  }
  function consumeOpenRequest(options) {
    const opts = options && typeof options === 'object' ? options : {};
    const skipArchive = opts.skipArchive === true;
    const skipLegacy = opts.skipLegacy === true;
    const returnDetails = opts.returnDetails === true;
    let archiveResult = null;
    if (!skipArchive) {
      const archiveRequest = readArchiveOpenRequest();
      if (archiveRequest) {
        archiveResult = handleArchiveOpenRequest(archiveRequest, opts);
        if (archiveResult && archiveResult.handled) {
          clearArchiveOpenRequest();
        }
      }
    }
    let legacyHandled = false;
    if (!skipLegacy) {
      let legacyRaw = null;
      try {
        legacyRaw = storageGetItem('example_to_load');
      } catch (_) {
        legacyRaw = null;
      }
      if (legacyRaw) {
        let legacyRequest = null;
        try {
          legacyRequest = JSON.parse(legacyRaw);
        } catch (error) {
          legacyRequest = null;
        }
        legacyHandled = handleLegacyOpenRequest(legacyRequest);
        try {
          storageRemoveItem('example_to_load');
        } catch (_) {}
      }
    }
    const handled = (archiveResult && archiveResult.handled) || legacyHandled;
    if (returnDetails) {
      return {
        handled,
        archive: archiveResult,
        legacy: legacyHandled
      };
    }
    return handled;
  }
  if (typeof window !== 'undefined') {
    const existingApi = window.MathVisExamples && typeof window.MathVisExamples === 'object' ? window.MathVisExamples : {};
    const api = {
      ...existingApi,
      collectConfig: () => collectCurrentConfig(),
      collectCurrentState: () => {
        try {
          return collectCurrentExampleState();
        } catch (error) {
          return null;
        }
      },
      createTemporaryExample: (example, options) => createTemporaryExample(example, options),
      readOpenRequest: () => readArchiveOpenRequest(),
      writeOpenRequest: payload => writeArchiveOpenRequest(payload),
      prepareOpenRequest: (request, options) => {
        try {
          return prepareArchiveOpenRequest(request, options);
        } catch (error) {
          return null;
        }
      },
      clearOpenRequest: () => clearArchiveOpenRequest(),
      consumeOpenRequest: options => consumeOpenRequest(options),
      getExamples: () => getExamples().slice()
    };
    window.MathVisExamples = api;
  }
  // Load example if viewer requested (handled after initial setup)
  const createBtn = document.getElementById('btnSaveExample');
  const updateBtn = document.getElementById('btnUpdateExample');
  const deleteBtn = document.getElementById('btnDeleteExample');
  if (!createBtn && !updateBtn && !deleteBtn) return;

  function serializeValueForComparison(value) {
    const normalized = serializeExampleValue(value, new WeakMap());
    if (normalized === undefined) {
      return 'undefined';
    }
    try {
      return JSON.stringify(normalized);
    } catch (error) {
      try {
        return JSON.stringify(cloneValue(normalized));
      } catch (_) {
        return '';
      }
    }
  }

  function hasMeaningfulExampleChanges(previous, next) {
    if (!previous && next) return true;
    if (!next) return false;
    const prevConfig = previous && typeof previous === 'object' ? previous.config : undefined;
    const nextConfig = next && typeof next === 'object' ? next.config : undefined;
    if (serializeValueForComparison(prevConfig) !== serializeValueForComparison(nextConfig)) {
      return true;
    }
    const prevDescription = extractDescriptionFromExample(previous);
    const nextDescription = extractDescriptionFromExample(next);
    if (prevDescription !== nextDescription) {
      return true;
    }
    const prevSvg = sanitizeSvgForStorage(previous && previous.svg);
    const nextSvg = sanitizeSvgForStorage(next && next.svg);
    return prevSvg !== nextSvg;
  }

  function detachProvidedMetadata(example) {
    if (!example || typeof example !== 'object') return;
    if (Object.prototype.hasOwnProperty.call(example, '__builtinKey')) {
      delete example.__builtinKey;
    }
    if (Object.prototype.hasOwnProperty.call(example, 'id')) {
      delete example.id;
    }
  }
  ensureTabStyles();
  toolbarElement =
    (updateBtn === null || updateBtn === void 0 ? void 0 : updateBtn.parentElement) ||
    (createBtn === null || createBtn === void 0 ? void 0 : createBtn.parentElement) ||
    (deleteBtn === null || deleteBtn === void 0 ? void 0 : deleteBtn.parentElement) ||
    toolbarElement;
  if (toolbarElement) {
    ensureSaveStatusElement();
  }
  tabsContainer = document.createElement('div');
  tabsContainer.id = 'exampleTabs';
  tabsContainer.className = 'example-tabs';
  tabsContainer.setAttribute('role', 'tablist');
  tabsContainer.setAttribute('aria-orientation', 'horizontal');
  tabsContainer.setAttribute('aria-label', 'Lagrede eksempler');
  const toolbarParent = (toolbarElement === null || toolbarElement === void 0 ? void 0 : toolbarElement.parentElement) || toolbarElement;
  if (toolbarParent) {
    if (toolbarElement !== null && toolbarElement !== void 0 && toolbarElement.nextSibling) {
      toolbarParent.insertBefore(tabsContainer, toolbarElement.nextSibling);
    } else {
      toolbarParent.appendChild(tabsContainer);
    }
  } else {
    document.body.appendChild(tabsContainer);
  }
  moveSettingsIntoExampleCard();
  moveDescriptionBelowTabs();
  window.addEventListener('resize', adjustTabsSpacing);
  updateActionButtonState = count => {
    const totalExamples = Number.isFinite(count) ? Math.max(0, Math.floor(count)) : 0;
    lastKnownActionButtonCount = totalExamples;
    const disableAll = actionButtonsBusy === true;
    if (deleteBtn) deleteBtn.disabled = disableAll || totalExamples <= 1;
    if (updateBtn) updateBtn.disabled = disableAll || totalExamples === 0;
    if (createBtn) createBtn.disabled = disableAll;
  };
  function clampExampleIndex(index, length) {
    if (!Number.isInteger(index)) return null;
    if (!Number.isInteger(length) || length <= 0) return null;
    if (index < 0) return 0;
    if (index >= length) return length - 1;
    return index;
  }
  let pendingRequestedIndex = parseInitialExampleIndex();
  if (!hasUrlOverrides) {
    try {
      const initialOpenRequest = consumeOpenRequest({
        deferRender: true,
        deferLoad: true,
        skipLegacy: true,
        returnDetails: true
      });
      const archiveDetails = initialOpenRequest && initialOpenRequest.archive;
      if (archiveDetails && archiveDetails.handled && Number.isInteger(archiveDetails.index)) {
        pendingRequestedIndex = archiveDetails.index;
      }
    } catch (_) {}
  }
  function attemptInitialLoad() {
    if (initialLoadPerformed) return;
    if (pendingRequestedIndex == null) return;
    const examples = getExamples();
    const total = Array.isArray(examples) ? examples.length : 0;
    if (total <= 0) {
      return;
    }
    const normalizedIndex = clampExampleIndex(pendingRequestedIndex, total);
    if (normalizedIndex == null) {
      pendingRequestedIndex = null;
      return;
    }
    if (normalizedIndex !== pendingRequestedIndex) {
      pendingRequestedIndex = normalizedIndex;
    }
    const loadNow = () => {
      if (initialLoadPerformed) return;
      if (loadExample(normalizedIndex)) {
        initialLoadPerformed = true;
        pendingRequestedIndex = null;
      }
    };
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', loadNow, {
      once: true
    });else setTimeout(loadNow, 0);
  }
  function renderOptions() {
    const examples = getExamples();
    const total = Array.isArray(examples) ? examples.length : 0;
    if (total === 0) {
      currentExampleIndex = null;
      hideLoadingOverlay({ immediate: true });
    } else {
      if (pendingRequestedIndex != null) {
        const normalized = clampExampleIndex(pendingRequestedIndex, total);
        pendingRequestedIndex = normalized == null ? pendingRequestedIndex : normalized;
      }
      if (currentExampleIndex == null || currentExampleIndex >= total) {
        const fallback = currentExampleIndex == null ? 0 : total - 1;
        currentExampleIndex = Math.min(total - 1, Math.max(0, fallback));
      }
    }
    if (tabsContainer) {
      tabsContainer.innerHTML = '';
      tabButtons = [];
      if (total === 0) {
        tabsContainer.setAttribute('role', 'presentation');
        tabsContainer.setAttribute('aria-label', 'Ingen lagrede eksempler');
        tabsContainer.removeAttribute('aria-orientation');
        const empty = document.createElement('div');
        empty.className = 'example-tabs-empty';
        empty.setAttribute('role', 'status');
        empty.setAttribute('aria-live', 'polite');
        const message = document.createElement('span');
        message.className = 'example-tabs-empty__message';
        message.textContent = 'Ingen lagrede eksempler ennå.';
        empty.appendChild(message);
        if (createBtn) {
          const cta = document.createElement('button');
          cta.type = 'button';
          cta.className = 'example-tabs-empty__cta';
          cta.textContent = 'Lag nytt eksempel';
          cta.addEventListener('click', () => {
            if (createBtn && typeof createBtn.click === 'function') {
              createBtn.click();
            }
          });
          empty.appendChild(cta);
        }
        tabsContainer.appendChild(empty);
      } else {
        tabsContainer.setAttribute('role', 'tablist');
        tabsContainer.setAttribute('aria-label', 'Lagrede eksempler');
        tabsContainer.setAttribute('aria-orientation', 'horizontal');
        const numericLabelPattern = /^[0-9]+$/;
        examples.forEach((ex, idx) => {
          const btn = document.createElement('button');
          btn.type = 'button';
          btn.className = 'example-tab';
          const defaultLabel = String(idx + 1);
          let label = defaultLabel;
          if (ex && typeof ex.exampleNumber === 'string') {
            const trimmed = ex.exampleNumber.trim();
            if (trimmed) {
              if (!numericLabelPattern.test(trimmed)) {
                label = trimmed;
              } else if (Number(trimmed) === idx + 1) {
                label = trimmed;
              }
            }
          }
          btn.textContent = label;
          btn.dataset.exampleIndex = String(idx);
          btn.setAttribute('role', 'tab');
          let ariaLabel = `Eksempel ${label}`;
          if (ex && ex[TEMPORARY_EXAMPLE_FLAG]) {
            btn.classList.add('is-new');
            btn.dataset.exampleState = 'new';
            ariaLabel = `${ariaLabel} (nytt)`;
            btn.title = `${label} – nytt eksempel`;
          }
          btn.setAttribute('aria-label', ariaLabel);
          btn.addEventListener('click', () => {
            loadExample(idx);
          });
          btn.addEventListener('keydown', event => {
            var _tabButtons$next;
            if (event.key !== 'ArrowRight' && event.key !== 'ArrowLeft') return;
            event.preventDefault();
            if (!tabButtons.length) return;
            const dir = event.key === 'ArrowRight' ? 1 : -1;
            const totalButtons = tabButtons.length;
            let next = idx;
            do {
              next = (next + dir + totalButtons) % totalButtons;
            } while (next !== idx && !tabButtons[next]);
            loadExample(next);
            (_tabButtons$next = tabButtons[next]) === null || _tabButtons$next === void 0 || _tabButtons$next.focus();
          });
          tabsContainer.appendChild(btn);
          tabButtons.push(btn);
        });
        updateTabSelection();
      }
    }
    if (total > 0 && !initialLoadPerformed) {
      showLoadingOverlay();
    }
    updateActionButtonState(total);
    attemptInitialLoad();
    if (!initialLoadPerformed && pendingRequestedIndex == null && total > 0) {
      let idx = Number.isInteger(currentExampleIndex) ? currentExampleIndex : 0;
      if (idx < 0) idx = 0;
      if (idx >= total) idx = total - 1;
      if (loadExample(idx)) initialLoadPerformed = true;
    }
  }
  function collectCurrentExampleState() {
    let ex;
    try {
      ex = collectCurrentConfig();
    } catch (error) {
      console.error('[examples] failed to collect config for example', error);
      const fallbackConfig = {};
      for (const name of BINDING_NAMES) {
        const binding = getBinding(name);
        if (binding != null && typeof binding !== 'function') {
          fallbackConfig[name] = cloneValue(binding);
        }
      }
      ex = {
        config: fallbackConfig,
        svg: '',
        description: getDescriptionValue()
      };
    }
    if (!ex || typeof ex !== 'object') {
      ex = {
        config: {},
        svg: '',
        description: getDescriptionValue()
      };
    }
    return ex;
  }
  function getActiveExampleIndex(examples) {
    if (!Array.isArray(examples) || examples.length === 0) return null;
    let index = Number.isInteger(currentExampleIndex) ? currentExampleIndex : NaN;
    if (!Number.isInteger(index)) {
      var _tabsContainer;
      const activeTab = (_tabsContainer = tabsContainer) === null || _tabsContainer === void 0 ? void 0 : _tabsContainer.querySelector('.example-tab.is-active');
      const parsed = activeTab ? Number(activeTab.dataset.exampleIndex) : NaN;
      if (Number.isInteger(parsed)) index = parsed;
    }
    if (!Number.isInteger(index)) {
      index = examples.length - 1;
    }
    if (!Number.isInteger(index)) return null;
    index = Math.max(0, Math.min(examples.length - 1, index));
    return index;
  }
  if (createBtn) {
    createBtn.addEventListener('click', async () => {
      const examples = getExamples();
      const nextExamples = Array.isArray(examples) ? examples.slice() : [];
      const ex = collectCurrentExampleState();
      nextExamples.push(ex);
      try {
        const result = await store(nextExamples, {
          reason: 'manual-save'
        });
        if (!result || result.ok !== true) {
          return;
        }
        const useCachedExamples = !!(result && result.offline);
        const finalExamples = useCachedExamples
          ? getExamples()
          : result && Array.isArray(result.examples)
          ? result.examples
          : getExamples();
        const total = Array.isArray(finalExamples) ? finalExamples.length : 0;
        currentExampleIndex = total > 0 ? total - 1 : null;
        renderOptions();
        if (currentExampleIndex != null && total > 0) {
          loadExample(currentExampleIndex);
        }
      } catch (error) {
        console.error('[examples] failed to save example', error);
      }
    });
  }
  if (updateBtn) {
    updateBtn.addEventListener('click', async () => {
      const examples = getExamples();
      if (examples.length === 0) {
        if (createBtn && typeof createBtn.click === 'function') {
          createBtn.click();
        }
        return;
      }
      const indexToUpdate = getActiveExampleIndex(examples);
      if (indexToUpdate == null) return;
      const payload = collectCurrentExampleState();
      const existing = examples[indexToUpdate];
      const updated = existing && typeof existing === 'object' ? { ...existing } : {};
      updated.config = payload && typeof payload.config === 'object' ? payload.config : {};
      updated.svg = typeof (payload === null || payload === void 0 ? void 0 : payload.svg) === 'string' ? payload.svg : '';
      if (payload && Object.prototype.hasOwnProperty.call(payload, 'description')) {
        updated.description = typeof payload.description === 'string' ? payload.description : '';
      } else {
        updated.description = getDescriptionValue();
      }
      if (Object.prototype.hasOwnProperty.call(updated, TEMPORARY_EXAMPLE_FLAG)) {
        delete updated[TEMPORARY_EXAMPLE_FLAG];
      }
      if (Object.prototype.hasOwnProperty.call(updated, 'temporary')) {
        delete updated.temporary;
      }
      if (Object.prototype.hasOwnProperty.call(updated, TEMPORARY_EXAMPLE_REQUEST_ID)) {
        delete updated[TEMPORARY_EXAMPLE_REQUEST_ID];
      }
      if (Object.prototype.hasOwnProperty.call(updated, TEMPORARY_EXAMPLE_SOURCE_PATH)) {
        delete updated[TEMPORARY_EXAMPLE_SOURCE_PATH];
      }
      if (Object.prototype.hasOwnProperty.call(updated, TEMPORARY_EXAMPLE_CREATED_AT)) {
        delete updated[TEMPORARY_EXAMPLE_CREATED_AT];
      }
      if (Object.prototype.hasOwnProperty.call(updated, TEMPORARY_EXAMPLE_NOTICE_PENDING)) {
        delete updated[TEMPORARY_EXAMPLE_NOTICE_PENDING];
      }
      if (Object.prototype.hasOwnProperty.call(updated, TEMPORARY_EXAMPLE_NOTICE_SHOWN)) {
        delete updated[TEMPORARY_EXAMPLE_NOTICE_SHOWN];
      }
      const shouldDetach = existing && typeof existing === 'object' && typeof existing.__builtinKey === 'string' && existing.__builtinKey && hasMeaningfulExampleChanges(existing, updated);
      if (shouldDetach) {
        detachProvidedMetadata(updated);
      }
      const nextExamples = Array.isArray(examples) ? examples.slice() : [];
      nextExamples[indexToUpdate] = updated;
      try {
        const result = await store(nextExamples, {
          reason: 'manual-update'
        });
        if (!result || result.ok !== true) {
          return;
        }
        const useCachedExamples = !!(result && result.offline);
        const finalExamples = useCachedExamples
          ? getExamples()
          : result && Array.isArray(result.examples)
          ? result.examples
          : getExamples();
        const total = Array.isArray(finalExamples) ? finalExamples.length : 0;
        const boundedIndex = total === 0 ? null : Math.max(0, Math.min(indexToUpdate, total - 1));
        currentExampleIndex = boundedIndex;
        renderOptions();
        if (boundedIndex != null) {
          loadExample(boundedIndex);
        }
      } catch (error) {
        console.error('[examples] failed to update example', error);
      }
    });
  }
  if (deleteBtn) {
    deleteBtn.addEventListener('click', async () => {
      const examples = getExamples();
      if (examples.length <= 1) {
        showMinimumExampleWarning();
        try {
          updateActionButtonState(examples.length);
        } catch (_) {}
        return;
      }
      const indexToUpdate = getActiveExampleIndex(examples);
      if (indexToUpdate == null) {
        return;
      }
      const indexToRemove = indexToUpdate;
      const removedExample = examples[indexToRemove];
      if (removedExample && typeof removedExample === 'object') {
        markProvidedExampleDeleted(removedExample.__builtinKey);
      }
      const nextExamples = Array.isArray(examples)
        ? examples.map(example => (example && typeof example === 'object' ? { ...example } : example))
        : [];
      nextExamples.splice(indexToRemove, 1);
      nextExamples.forEach((ex, idx) => {
        if (!ex || typeof ex !== 'object') return;
        if (idx === 0) {
          ex.isDefault = true;
        } else if (Object.prototype.hasOwnProperty.call(ex, 'isDefault')) {
          delete ex.isDefault;
        }
      });
      try {
        const result = await store(nextExamples, {
          reason: 'delete'
        });
        if (!result || result.ok !== true) {
          return;
        }
        const useCachedExamples = !!(result && result.offline);
        const finalExamples = useCachedExamples
          ? getExamples()
          : result && Array.isArray(result.examples)
          ? result.examples
          : getExamples();
        if (removedExample && typeof removedExample === 'object' && !removedExample[TEMPORARY_EXAMPLE_FLAG]) {
          await addExampleToTrash(removedExample, {
            index: indexToRemove,
            reason: 'delete',
            capturePreview: true
          });
          showTrashRestoreHelp();
        }
        if (!Array.isArray(finalExamples) || finalExamples.length === 0) {
          currentExampleIndex = null;
        } else if (indexToRemove >= finalExamples.length) {
          currentExampleIndex = finalExamples.length - 1;
        } else {
          currentExampleIndex = indexToRemove;
        }
        renderOptions();
        if (currentExampleIndex != null && currentExampleIndex >= 0 && finalExamples.length > 0) {
          loadExample(currentExampleIndex);
        }
      } catch (error) {
        console.error('[examples] failed to delete example', error);
      }
    });
  }
  const trashMigrationPromise = ensureTrashHistoryMigration();
  if (trashMigrationPromise && typeof trashMigrationPromise.catch === 'function') {
    trashMigrationPromise.catch(() => {});
  }
  renderOptions();
  if (!hasUrlOverrides) {
    consumeOpenRequest();
  }
  if (typeof window !== 'undefined' && typeof window.addEventListener === 'function') {
    window.addEventListener('math-visuals:app-mode-changed', () => {
      if (currentAppMode === 'task') {
        ensureTaskModeDescriptionRendered();
      }
      const examples = getExamples();
      if (!examples.length) return;
      const normalizedIndex = clampExampleIndex(currentExampleIndex, examples.length);
      const targetIndex = normalizedIndex == null ? 0 : normalizedIndex;
      if (currentAppMode === 'task') {
        const currentDescription = normalizeDescriptionString(getDescriptionValue());
        if (currentDescription) {
          const example = examples[targetIndex];
          const exampleDescription = extractDescriptionFromExample(example);
          if (!exampleDescription || currentDescription !== exampleDescription) {
            return;
          }
        }
      }
      loadExample(targetIndex);
    });
  }
  if (examplesApiBase) {
    const migrationPromise = migrateLegacyExamples();
    if (migrationPromise && typeof migrationPromise.then === 'function') {
      migrationPromise.catch(() => {}).then(() => {
        loadExamplesFromBackend();
      });
    } else {
      loadExamplesFromBackend();
    }
  }
  function parseInitialExampleIndex() {
    const parseValue = value => {
      if (value == null) return null;
      const num = Number(value);
      if (!Number.isFinite(num) || !Number.isInteger(num)) return null;
      if (num > 0) return num - 1;
      if (num === 0) return 0;
      return null;
    };
    if (typeof URLSearchParams !== 'undefined') {
      const search = new URLSearchParams(window.location.search);
      const fromSearch = parseValue(search.get('example'));
      if (fromSearch != null) return fromSearch;
    }
    const hashMatch = window.location.hash && window.location.hash.match(/example=([0-9]+)/i);
    if (hashMatch) return parseValue(hashMatch[1]);
    const pathname = typeof window.location.pathname === 'string' ? window.location.pathname : '';
    if (pathname) {
      const segments = pathname.split('/').filter(Boolean);
      for (let i = segments.length - 1; i >= 0; i--) {
        const segment = segments[i];
        let decoded = segment;
        try {
          decoded = decodeURIComponent(segment);
        } catch (_) {}
        const match = decoded.match(/^eksempel[-_]?([0-9]+)$/i);
        if (match) {
          const parsed = parseValue(match[1]);
          if (parsed != null) {
            return parsed;
          }
        }
      }
    }
    return null;
  }
})();
