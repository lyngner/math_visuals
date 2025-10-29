(function () {
  if (typeof document === 'undefined') return;
  const form = document.querySelector('[data-settings-form]');
  if (!form) return;

  const colorGroupsContainer = form.querySelector('[data-color-groups]');
  const addColorButton = form.querySelector('[data-add-color]');
  const resetButton = form.querySelector('[data-reset-settings]');
  const statusElement = form.querySelector('[data-status]');
  const lineInput = form.querySelector('#lineThickness');
  const linePreviewBar = form.querySelector('[data-line-preview-bar]');
  const lineSaveButton = form.querySelector('[data-save-line]');
  const projectHeadingElement = document.querySelector('[data-project-heading]');
  const projectLegendElement = form.querySelector('[data-project-legend]');

  function resolvePaletteConfig() {
    const scopes = [
      typeof window !== 'undefined' ? window : null,
      typeof globalThis !== 'undefined' ? globalThis : null,
      typeof global !== 'undefined' ? global : null
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
        const mod = require('./palette/palette-config.js');
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
        '[MathVisualsSettings] Mangler fargekonfigurasjon. Sørg for at palette/palette-config.js lastes før settings.js.'
      );
    }
    return;
  }

  const MAX_COLORS = paletteConfig.MAX_COLORS;
  const DEFAULT_LINE_THICKNESS = 3;
  const PROJECT_LABELS = {
    kikora: 'Kikora',
    campus: 'Campus',
    annet: 'Annet'
  };
  const PROJECT_HEADINGS = {
    kikora: 'Kikora',
    campus: 'Campus',
    annet: 'Annet'
  };
  const EXTRA_GROUP_ID = paletteConfig.EXTRA_GROUP_ID;
  const PROJECT_FALLBACKS = paletteConfig.PROJECT_FALLBACKS;
  const COLOR_SLOT_GROUPS = paletteConfig.COLOR_SLOT_GROUPS.map(group => ({
    groupId: group.groupId,
    title: group.title,
    description: group.description,
    groupIndex: Number.isInteger(group.groupIndex) ? group.groupIndex : undefined,
    slots: group.slots.map(slot => ({
      index: slot.index,
      label: slot.label,
      description: slot.description,
      groupId: slot.groupId,
      groupIndex: slot.groupIndex
    }))
  }));
  const GROUP_IDS = Array.isArray(paletteConfig.COLOR_GROUP_IDS)
    ? paletteConfig.COLOR_GROUP_IDS.slice()
    : COLOR_SLOT_GROUPS.map(group => group.groupId);
  const SLOT_META_BY_INDEX = new Map();
  COLOR_SLOT_GROUPS.forEach(group => {
    group.slots.forEach(slot => {
      if (!slot) return;
      const index = Number(slot.index);
      if (!Number.isInteger(index) || index < 0) return;
      SLOT_META_BY_INDEX.set(index, {
        groupId: group.groupId,
        groupIndex: Number(slot.groupIndex) || 0
      });
    });
  });
  const MIN_COLOR_SLOTS = Number.isInteger(paletteConfig.MIN_COLOR_SLOTS)
    ? paletteConfig.MIN_COLOR_SLOTS
    : COLOR_SLOT_GROUPS.reduce((total, group) => total + group.slots.length, 0);
  const PROJECT_FALLBACK_CACHE = new Map();
  const PROJECT_FALLBACK_GROUP_CACHE = new Map();
  const SLOTS_PER_ROW = 3;

  function normalizeProjectName(name) {
    if (typeof name !== 'string') return '';
    return name.trim().toLowerCase();
  }

  const settingsApi = resolveSettingsApi();
  const state = {
    projectOrder: [],
    colorsByProject: new Map(),
    persistedColorsByProject: new Map(),
    activeProject: null,
    defaultLineThickness: DEFAULT_LINE_THICKNESS,
    persistedLineThickness: DEFAULT_LINE_THICKNESS,
    preferredProject: null
  };
  let colors = [];
  const slotBindings = new Map();
  let extraGroupSection = null;
  let extraSlotsContainer = null;
  let extraGroupSaveButton = null;

  function resolveSettingsApi() {
    if (typeof window === 'undefined') return null;
    const api = window.MathVisualsSettings;
    if (api && typeof api === 'object') return api;
    const legacy = window.mathVisuals && window.mathVisuals.settings;
    return legacy && typeof legacy === 'object' ? legacy : null;
  }

  function clonePersistedColorMap() {
    const map = new Map();
    if (state.persistedColorsByProject && typeof state.persistedColorsByProject.forEach === 'function') {
      state.persistedColorsByProject.forEach((palette, name) => {
        map.set(name, cloneProjectPalette(palette));
      });
    }
    state.colorsByProject.forEach((palette, name) => {
      if (!map.has(name)) {
        map.set(name, cloneProjectPalette(palette));
      }
    });
    return map;
  }

  function collectGroupIndices(groupId) {
    const groups = new Set();
    const normalizedGroup = typeof groupId === 'string' ? groupId.trim().toLowerCase() : '';
    if (!normalizedGroup) return groups;
    if (normalizedGroup === EXTRA_GROUP_ID) {
      groups.add(EXTRA_GROUP_ID);
      return groups;
    }
    const group = COLOR_SLOT_GROUPS.find(entry => entry.groupId === normalizedGroup);
    if (!group) return groups;
    groups.add(group.groupId);
    return groups;
  }

  function buildProjectColorsForSave(projectName, indices) {
    const map = clonePersistedColorMap();
    const normalizedProject = normalizeProjectName(projectName);
    if (!normalizedProject) return map;
    const targetGroups = indices instanceof Set ? indices : new Set(indices || []);
    if (!targetGroups.size) return map;
    const editingPalette = normalizeProjectPalette(
      normalizedProject,
      state.colorsByProject.get(normalizedProject) || getProjectFallbackPalette(normalizedProject)
    );
    const base = map.get(normalizedProject) || getProjectFallbackPalette(normalizedProject);
    const next = cloneProjectPalette(base);
    targetGroups.forEach(groupId => {
      if (groupId === EXTRA_GROUP_ID) {
        const extraSource = Array.isArray(editingPalette[EXTRA_GROUP_ID]) ? editingPalette[EXTRA_GROUP_ID] : [];
        next[EXTRA_GROUP_ID] = extraSource.slice(0, Math.max(0, MAX_COLORS - MIN_COLOR_SLOTS));
        return;
      }
      const group = COLOR_SLOT_GROUPS.find(entry => entry.groupId === groupId);
      if (!group) return;
      const source = Array.isArray(editingPalette[group.groupId]) ? editingPalette[group.groupId] : [];
      next[group.groupId] = group.slots.map((slot, slotIndex) => {
        const color = source[slotIndex];
        const fallback = getFallbackColorForIndex(normalizedProject, slot.index);
        return sanitizeColor(color) || fallback;
      });
    });
    map.set(normalizedProject, next);
    return map;
  }

  function captureUnsavedChanges(excludedProject, excludedGroups) {
    const excludedName = normalizeProjectName(excludedProject);
    const excludedSet = excludedGroups instanceof Set ? excludedGroups : new Set();
    const changes = new Map();
    state.colorsByProject.forEach((palette, project) => {
      const normalizedProject = normalizeProjectName(project);
      if (!normalizedProject) return;
      const currentPalette = normalizeProjectPalette(normalizedProject, palette);
      const persistedPalette = normalizeProjectPalette(
        normalizedProject,
        state.persistedColorsByProject.get(normalizedProject) || getProjectFallbackPalette(normalizedProject)
      );
      const entries = new Map();
      GROUP_IDS.forEach(groupId => {
        if (normalizedProject === excludedName && excludedSet.has(groupId)) return;
        const currentGroup = Array.isArray(currentPalette[groupId]) ? currentPalette[groupId] : [];
        const baselineGroup = Array.isArray(persistedPalette[groupId]) ? persistedPalette[groupId] : [];
        const diff = [];
        let hasDiff = false;
        const limit = Math.max(currentGroup.length, baselineGroup.length);
        for (let index = 0; index < limit; index += 1) {
          const currentColor = currentGroup[index];
          const baselineColor = baselineGroup[index];
          if (typeof currentColor === 'string' && currentColor && currentColor !== baselineColor) {
            diff[index] = currentColor;
            hasDiff = true;
          }
        }
        if (hasDiff) {
          entries.set(groupId, diff);
        }
      });
      if (!(normalizedProject === excludedName && excludedSet.has(EXTRA_GROUP_ID))) {
        const currentExtra = Array.isArray(currentPalette[EXTRA_GROUP_ID]) ? currentPalette[EXTRA_GROUP_ID] : [];
        const baselineExtra = Array.isArray(persistedPalette[EXTRA_GROUP_ID]) ? persistedPalette[EXTRA_GROUP_ID] : [];
        if (currentExtra.length !== baselineExtra.length || currentExtra.some((color, index) => color !== baselineExtra[index])) {
          entries.set(EXTRA_GROUP_ID, currentExtra.slice());
        }
      }
      if (entries.size) {
        changes.set(normalizedProject, entries);
      }
    });
    return changes;
  }

  function restoreUnsavedChanges(changes) {
    if (!changes || typeof changes.forEach !== 'function') return;
    let shouldSyncActive = false;
    changes.forEach((groups, project) => {
      const normalizedProject = normalizeProjectName(project);
      if (!normalizedProject || !groups || typeof groups.forEach !== 'function') return;
      const currentPalette = normalizeProjectPalette(
        normalizedProject,
        state.colorsByProject.get(normalizedProject) || getProjectFallbackPalette(normalizedProject)
      );
      groups.forEach((values, groupId) => {
        if (groupId === EXTRA_GROUP_ID) {
          const extraValues = Array.isArray(values) ? values : [];
          const sanitizedExtra = [];
          for (let index = 0; index < extraValues.length && MIN_COLOR_SLOTS + sanitizedExtra.length < MAX_COLORS; index += 1) {
            const clean = sanitizeColor(extraValues[index]);
            if (clean) {
              sanitizedExtra.push(clean);
            }
          }
          currentPalette[EXTRA_GROUP_ID] = sanitizedExtra;
          return;
        }
        const group = COLOR_SLOT_GROUPS.find(entry => entry.groupId === groupId);
        if (!group) return;
        const incoming = Array.isArray(values) ? values : [];
        const target = Array.isArray(currentPalette[groupId]) ? currentPalette[groupId].slice() : [];
        group.slots.forEach((slot, slotIndex) => {
          const nextColor = incoming[slotIndex];
          if (typeof nextColor === 'string' && nextColor) {
            target[slotIndex] = sanitizeColor(nextColor) || target[slotIndex] || getFallbackColorForIndex(normalizedProject, slot.index);
          }
        });
        currentPalette[groupId] = target;
      });
      state.colorsByProject.set(normalizedProject, cloneProjectPalette(currentPalette));
      if (normalizedProject === state.activeProject) {
        commitActiveColors(currentPalette, normalizedProject);
        shouldSyncActive = true;
      }
    });
    if (shouldSyncActive) {
      syncBindings();
    }
  }

  async function saveColorGroup(groupId, groupTitle) {
    const normalizedId = typeof groupId === 'string' ? groupId.trim() : '';
    if (!normalizedId) return;
    const activeProject = ensureActiveProject();
    const groups = collectGroupIndices(normalizedId);
    if (!groups.size) {
      const emptyLabel = groupTitle && groupTitle.trim() ? groupTitle.trim() : 'gruppen';
      setStatus(`Ingen endringer å lagre for ${emptyLabel}.`, 'info');
      return;
    }
    const editingPalette = normalizeProjectPalette(
      activeProject,
      state.colorsByProject.get(activeProject) || getProjectFallbackPalette(activeProject)
    );
    const persistedPalette = normalizeProjectPalette(
      activeProject,
      state.persistedColorsByProject.get(activeProject) || getProjectFallbackPalette(activeProject)
    );
    let hasChanges = false;
    groups.forEach(groupKey => {
      if (hasChanges) return;
      if (groupKey === EXTRA_GROUP_ID) {
        const currentExtra = Array.isArray(editingPalette[EXTRA_GROUP_ID]) ? editingPalette[EXTRA_GROUP_ID] : [];
        const persistedExtra = Array.isArray(persistedPalette[EXTRA_GROUP_ID]) ? persistedPalette[EXTRA_GROUP_ID] : [];
        if (
          currentExtra.length !== persistedExtra.length ||
          currentExtra.some((color, index) => color !== persistedExtra[index])
        ) {
          hasChanges = true;
        }
        return;
      }
      const group = COLOR_SLOT_GROUPS.find(entry => entry.groupId === groupKey);
      if (!group) return;
      const currentGroup = Array.isArray(editingPalette[groupKey]) ? editingPalette[groupKey] : [];
      const persistedGroup = Array.isArray(persistedPalette[groupKey]) ? persistedPalette[groupKey] : [];
      const limit = Math.max(currentGroup.length, persistedGroup.length);
      for (let index = 0; index < limit; index += 1) {
        if ((currentGroup[index] || '') !== (persistedGroup[index] || '')) {
          hasChanges = true;
          break;
        }
      }
    });
    if (!hasChanges) {
      const unchangedLabel = groupTitle && groupTitle.trim() ? groupTitle.trim() : 'gruppen';
      setStatus(`Ingen endringer å lagre for ${unchangedLabel}.`, 'info');
      return;
    }
    const label = groupTitle && groupTitle.trim() ? groupTitle.trim() : 'gruppen';
    const unsavedChanges = captureUnsavedChanges(activeProject, groups);
    const colorsForSave = buildProjectColorsForSave(activeProject, groups);
    const pendingLineThickness = state.defaultLineThickness;
    const restoreLineThickness = pendingLineThickness !== state.persistedLineThickness;
    setStatus(`Lagrer fargene for ${label}...`, 'info');
    setFormDisabled(true);
    try {
      const payload = buildPayload({
        projectColors: colorsForSave,
        lineThickness: state.persistedLineThickness,
        activeProject
      });
      const snapshot = await persistSettings('PUT', payload);
      applySettings(snapshot || {}, { forceActiveProject: activeProject });
      restoreUnsavedChanges(unsavedChanges);
      if (restoreLineThickness && lineInput) {
        state.defaultLineThickness = clampLineThickness(pendingLineThickness);
        lineInput.value = String(state.defaultLineThickness);
        updateLinePreview();
      }
      if (settingsApi && typeof settingsApi.refresh === 'function') {
        try {
          settingsApi.refresh({ force: true, notify: true });
        } catch (_) {}
      }
      setStatus(`Fargene for ${label} er lagret.`, 'success');
    } catch (error) {
      console.error(error);
      setStatus(`Kunne ikke lagre fargene for ${label}.`, 'error');
    } finally {
      setFormDisabled(false);
    }
  }

  async function saveLineThickness() {
    if (!lineInput) return;
    const activeProject = ensureActiveProject();
    const thickness = clampLineThickness(lineInput.value);
    state.defaultLineThickness = thickness;
    if (String(lineInput.value) !== String(thickness)) {
      lineInput.value = String(thickness);
    }
    updateLinePreview();
    if (thickness === state.persistedLineThickness) {
      setStatus('Linjetykkelsen er allerede lagret.', 'info');
      return;
    }
    const unsavedChanges = captureUnsavedChanges(null, null);
    setStatus('Lagrer linjetykkelsen...', 'info');
    setFormDisabled(true);
    try {
      const payload = buildPayload({
        projectColors: clonePersistedColorMap(),
        lineThickness: thickness,
        activeProject
      });
      const snapshot = await persistSettings('PUT', payload);
      applySettings(snapshot || {}, { forceActiveProject: activeProject });
      restoreUnsavedChanges(unsavedChanges);
      if (settingsApi && typeof settingsApi.refresh === 'function') {
        try {
          settingsApi.refresh({ force: true, notify: true });
        } catch (_) {}
      }
      setStatus('Linjetykkelsen er lagret.', 'success');
    } catch (error) {
      console.error(error);
      setStatus('Kunne ikke lagre linjetykkelsen.', 'error');
    } finally {
      setFormDisabled(false);
    }
  }

  function resolveApiUrl() {
    if (settingsApi && typeof settingsApi.getApiUrl === 'function') {
      try {
        const hint = settingsApi.getApiUrl();
        if (typeof hint === 'string' && hint.trim()) {
          return hint.trim();
        }
      } catch (_) {}
    }
    if (typeof window !== 'undefined') {
      if (window.MATH_VISUALS_SETTINGS_API_URL) {
        const hint = String(window.MATH_VISUALS_SETTINGS_API_URL).trim();
        if (hint) return hint;
      }
      const origin = window.location && window.location.origin;
      if (typeof origin === 'string' && /^https?:/i.test(origin)) {
        return '/api/settings';
      }
    }
    return null;
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

  function sanitizeColorList(values, limit = MAX_COLORS) {
    if (!Array.isArray(values) || !values.length) return [];
    const result = [];
    const max = Number.isInteger(limit) && limit > 0 ? limit : MAX_COLORS;
    for (let index = 0; index < values.length && result.length < max; index += 1) {
      const sanitized = sanitizeColor(values[index]);
      if (sanitized) {
        result.push(sanitized);
      }
    }
    return result;
  }

  function getSanitizedFallbackBase(project) {
    const key = normalizeProjectName(project) || 'default';
    if (PROJECT_FALLBACK_CACHE.has(key)) {
      return PROJECT_FALLBACK_CACHE.get(key).slice();
    }
    const base = PROJECT_FALLBACKS[key] || PROJECT_FALLBACKS.default || [];
    const sanitized = sanitizeColorList(base, MAX_COLORS);
    if (!sanitized.length) {
      const fallbackDefault =
        (PROJECT_FALLBACKS.default && PROJECT_FALLBACKS.default[0]) || '#1F4DE2';
      sanitized.push(fallbackDefault);
    }
    PROJECT_FALLBACK_CACHE.set(key, sanitized.slice());
    return sanitized.slice();
  }

  function buildFallbackGroupsFromBase(baseColors) {
    const sanitized = Array.isArray(baseColors) && baseColors.length ? baseColors : getSanitizedFallbackBase('default');
    const groups = {};
    COLOR_SLOT_GROUPS.forEach(group => {
      groups[group.groupId] = group.slots.map(slot => {
        const index = Number.isInteger(slot.index) && slot.index >= 0 ? slot.index : 0;
        return sanitized[index % sanitized.length] || sanitized[0];
      });
    });
    groups[EXTRA_GROUP_ID] = [];
    return groups;
  }

  function ensureProjectPaletteShape(palette) {
    const target = palette && typeof palette === 'object' ? palette : {};
    GROUP_IDS.forEach(groupId => {
      if (!Array.isArray(target[groupId])) {
        target[groupId] = [];
      }
    });
    if (!Array.isArray(target[EXTRA_GROUP_ID])) {
      target[EXTRA_GROUP_ID] = [];
    }
    return target;
  }

  function cloneProjectPalette(palette) {
    const shaped = ensureProjectPaletteShape(palette);
    const copy = {};
    GROUP_IDS.forEach(groupId => {
      const source = Array.isArray(shaped[groupId]) ? shaped[groupId] : [];
      copy[groupId] = source.slice(0, MAX_COLORS);
    });
    const extraLimit = Math.max(0, MAX_COLORS - MIN_COLOR_SLOTS);
    const extraSource = Array.isArray(shaped[EXTRA_GROUP_ID]) ? shaped[EXTRA_GROUP_ID] : [];
    copy[EXTRA_GROUP_ID] = extraSource.slice(0, extraLimit);
    return copy;
  }

  function convertLegacyPalette(project, palette) {
    if (!Array.isArray(palette) || !palette.length) return {};
    const sanitized = sanitizeColorList(palette, MAX_COLORS);
    const converted = {};
    COLOR_SLOT_GROUPS.forEach(group => {
      converted[group.groupId] = group.slots.map(slot => {
        const index = Number.isInteger(slot.index) && slot.index >= 0 ? slot.index : 0;
        return sanitized[index] || null;
      });
    });
    const extra = [];
    for (let index = MIN_COLOR_SLOTS; index < sanitized.length && extra.length + MIN_COLOR_SLOTS < MAX_COLORS; index += 1) {
      if (sanitized[index]) {
        extra.push(sanitized[index]);
      }
    }
    converted[EXTRA_GROUP_ID] = extra;
    return converted;
  }

  function sanitizeProjectPalette(project, palette) {
    const fallback = getProjectFallbackPalette(project);
    const fallbackBase = getSanitizedFallbackBase(project);
    const shaped = ensureProjectPaletteShape(palette);
    const sanitized = {};
    COLOR_SLOT_GROUPS.forEach(group => {
      const fallbackColors = Array.isArray(fallback[group.groupId]) ? fallback[group.groupId] : [];
      const incoming = Array.isArray(shaped[group.groupId]) ? shaped[group.groupId] : [];
      sanitized[group.groupId] = group.slots.map((slot, slotIndex) => {
        const clean = sanitizeColor(incoming[slotIndex]);
        if (clean) return clean;
        if (fallbackColors[slotIndex]) return fallbackColors[slotIndex];
        if (fallbackColors[0]) return fallbackColors[0];
        if (fallbackBase.length) {
          const baseIndex = Number.isInteger(slot.index) && slot.index >= 0 ? slot.index : slotIndex;
          return fallbackBase[baseIndex % fallbackBase.length] || fallbackBase[0];
        }
        return '#1F4DE2';
      });
    });
    const extra = Array.isArray(shaped[EXTRA_GROUP_ID]) ? shaped[EXTRA_GROUP_ID] : [];
    const sanitizedExtra = [];
    const extraLimit = Math.max(0, MAX_COLORS - MIN_COLOR_SLOTS);
    for (let index = 0; index < extra.length && sanitizedExtra.length < extraLimit; index += 1) {
      const clean = sanitizeColor(extra[index]);
      if (clean) {
        sanitizedExtra.push(clean);
      }
    }
    sanitized[EXTRA_GROUP_ID] = sanitizedExtra;
    return sanitized;
  }

  function normalizeProjectPalette(project, palette) {
    if (Array.isArray(palette)) {
      return sanitizeProjectPalette(project, convertLegacyPalette(project, palette));
    }
    if (palette && typeof palette === 'object') {
      return sanitizeProjectPalette(project, palette);
    }
    return getProjectFallbackPalette(project);
  }

  function flattenProjectPalette(project, palette, minimumLength = MIN_COLOR_SLOTS) {
    const normalized = normalizeProjectPalette(project, palette);
    const flattened = [];
    COLOR_SLOT_GROUPS.forEach(group => {
      const colors = Array.isArray(normalized[group.groupId]) ? normalized[group.groupId] : [];
      group.slots.forEach((slot, slotIndex) => {
        const value = colors[slotIndex];
        flattened.push(value || getFallbackColorForIndex(project, flattened.length));
      });
    });
    const extra = Array.isArray(normalized[EXTRA_GROUP_ID]) ? normalized[EXTRA_GROUP_ID] : [];
    extra.forEach(color => {
      if (flattened.length < MAX_COLORS) {
        const clean = sanitizeColor(color);
        if (clean) {
          flattened.push(clean);
        }
      }
    });
    const min = Number.isInteger(minimumLength) && minimumLength > 0 ? minimumLength : 0;
    while (flattened.length < min && flattened.length < MAX_COLORS) {
      flattened.push(getFallbackColorForIndex(project, flattened.length));
    }
    return flattened.slice(0, MAX_COLORS);
  }

  function assignColorToPalette(palette, index, color) {
    const meta = SLOT_META_BY_INDEX.get(index);
    if (meta) {
      if (!Array.isArray(palette[meta.groupId])) {
        palette[meta.groupId] = [];
      }
      palette[meta.groupId][meta.groupIndex] = color;
      return;
    }
    const extraIndex = index - MIN_COLOR_SLOTS;
    if (extraIndex >= 0) {
      if (!Array.isArray(palette[EXTRA_GROUP_ID])) {
        palette[EXTRA_GROUP_ID] = [];
      }
      palette[EXTRA_GROUP_ID][extraIndex] = color;
    }
  }

  function clampLineThickness(value) {
    const num = Number.parseFloat(value);
    if (!Number.isFinite(num)) return DEFAULT_LINE_THICKNESS;
    if (num < 1) return 1;
    if (num > 12) return 12;
    return Math.round(num);
  }

  function getProjectFallbackPalette(project) {
    const key = normalizeProjectName(project) || 'default';
    if (!PROJECT_FALLBACK_GROUP_CACHE.has(key)) {
      const base = getSanitizedFallbackBase(key);
      PROJECT_FALLBACK_GROUP_CACHE.set(key, buildFallbackGroupsFromBase(base));
    }
    return cloneProjectPalette(PROJECT_FALLBACK_GROUP_CACHE.get(key));
  }

  function getFallbackColorForIndex(project, index) {
    const key = normalizeProjectName(project) || 'default';
    const baseColors = getSanitizedFallbackBase(key);
    if (!baseColors.length) {
      return (PROJECT_FALLBACKS.default && PROJECT_FALLBACKS.default[0]) || '#1F4DE2';
    }
    const normalizedIndex = Number.isInteger(index) && index >= 0 ? index : 0;
    const meta = SLOT_META_BY_INDEX.get(normalizedIndex);
    if (meta) {
      if (!PROJECT_FALLBACK_GROUP_CACHE.has(key)) {
        const base = getSanitizedFallbackBase(key);
        PROJECT_FALLBACK_GROUP_CACHE.set(key, buildFallbackGroupsFromBase(base));
      }
      const groups = PROJECT_FALLBACK_GROUP_CACHE.get(key) || {};
      const groupColors = groups[meta.groupId] || [];
      const candidate = groupColors[meta.groupIndex];
      if (candidate) {
        return candidate;
      }
    }
    return baseColors[normalizedIndex % baseColors.length] || baseColors[0];
  }

  function formatProjectLabel(name) {
    if (!name) return '';
    const key = normalizeProjectName(name);
    if (PROJECT_LABELS[key]) return PROJECT_LABELS[key];
    return key.charAt(0).toUpperCase() + key.slice(1);
  }

  function resolveProjectHeading(name) {
    const normalized = normalizeProjectName(name);
    if (PROJECT_HEADINGS[normalized]) {
      return PROJECT_HEADINGS[normalized];
    }
    const label = formatProjectLabel(name);
    return label || 'Farger';
  }

  function updateProjectHeading(project) {
    const active = project ? normalizeProjectName(project) : ensureActiveProject();
    const headingText = resolveProjectHeading(active);
    if (projectHeadingElement) {
      const fullHeading = headingText
        ? `Default fargeinnstillinger ${headingText}`
        : 'Default fargeinnstillinger';
      projectHeadingElement.textContent = fullHeading;
    }
    if (projectLegendElement) {
      projectLegendElement.textContent = headingText;
    }
  }

  function setStatus(message, tone) {
    if (!statusElement) return;
    statusElement.textContent = message || '';
    if (message) {
      statusElement.dataset.status = tone || 'success';
    } else {
      statusElement.removeAttribute('data-status');
    }
  }

  function clearStatus() {
    setStatus('', 'info');
  }

  function notifySettingsUpdated() {
    if (statusElement && statusElement.dataset.status === 'success') {
      return;
    }
    setStatus('Innstillingene er oppdatert.', 'info');
  }

  function setFormDisabled(disabled) {
    const elements = Array.from(form.querySelectorAll('input, button, select, textarea'));
    elements.forEach(el => {
      if (disabled) {
        el.setAttribute('disabled', 'disabled');
      } else {
        el.removeAttribute('disabled');
      }
    });
  }

  function updateLinePreview() {
    if (!linePreviewBar) return;
    const thickness = clampLineThickness(state.defaultLineThickness);
    linePreviewBar.style.setProperty('--preview-thickness', `${thickness}px`);
  }

  function getApiActiveProject() {
    if (!settingsApi || typeof settingsApi.getActiveProject !== 'function') return null;
    try {
      const value = normalizeProjectName(settingsApi.getActiveProject());
      return value || null;
    } catch (_) {
      return null;
    }
  }

  function ensureProjectColors(name) {
    const normalized = normalizeProjectName(name);
    if (!normalized) return;
    if (!state.colorsByProject.has(normalized)) {
      const palette = normalizeProjectPalette(normalized, getProjectFallbackPalette(normalized));
      state.colorsByProject.set(normalized, cloneProjectPalette(palette));
    }
    if (!state.persistedColorsByProject.has(normalized)) {
      const palette = state.colorsByProject.get(normalized);
      state.persistedColorsByProject.set(normalized, cloneProjectPalette(palette));
    }
  }

  function ensureActiveProject() {
    const seen = new Set();
    const candidates = [];
    const addCandidate = value => {
      const normalized = normalizeProjectName(value);
      if (!normalized || seen.has(normalized)) return;
      seen.add(normalized);
      candidates.push(normalized);
    };
    addCandidate(state.preferredProject);
    addCandidate(state.activeProject);
    addCandidate(getApiActiveProject());
    state.projectOrder.forEach(addCandidate);
    addCandidate('campus');
    addCandidate('kikora');
    addCandidate('annet');

    for (const candidate of candidates) {
      ensureProjectColors(candidate);
      state.activeProject = candidate;
      return candidate;
    }

    const fallback = 'campus';
    ensureProjectColors(fallback);
    state.activeProject = fallback;
    return fallback;
  }

  function getActiveColors(projectName) {
    const project = projectName ? normalizeProjectName(projectName) : ensureActiveProject();
    const palette = state.colorsByProject.get(project);
    if (palette) {
      return cloneProjectPalette(palette);
    }
    return getProjectFallbackPalette(project);
  }

  function expandPalette(projectName, basePalette, minimumLength = 0) {
    const project = projectName ? normalizeProjectName(projectName) : ensureActiveProject();
    const normalizedPalette = normalizeProjectPalette(project, basePalette);
    return flattenProjectPalette(project, normalizedPalette, minimumLength);
  }

  function commitActiveColors(next, projectName) {
    const project = projectName ? normalizeProjectName(projectName) : ensureActiveProject();
    const normalizedPalette = normalizeProjectPalette(project, next);
    state.colorsByProject.set(project, cloneProjectPalette(normalizedPalette));
    colors = flattenProjectPalette(project, normalizedPalette, MIN_COLOR_SLOTS);
  }

  function ensureColorCapacity(index, projectName) {
    const project = projectName ? normalizeProjectName(projectName) : ensureActiveProject();
    if (!Number.isInteger(index) || index < 0) return;
    const palette = normalizeProjectPalette(
      project,
      state.colorsByProject.get(project) || getProjectFallbackPalette(project)
    );
    while (colors.length <= index && colors.length < MAX_COLORS) {
      const fallback = getFallbackColorForIndex(project, colors.length);
      colors.push(fallback);
      assignColorToPalette(palette, colors.length - 1, fallback);
    }
    state.colorsByProject.set(project, cloneProjectPalette(palette));
  }

  function updateBindingsForIndex(index, value) {
    const bindings = slotBindings.get(index);
    if (!bindings) return;
    bindings.forEach(binding => {
      if (binding.colorInput.value !== value) {
        binding.colorInput.value = value;
      }
      if (binding.hexInput.value !== value) {
        binding.hexInput.value = value;
      }
    });
  }

  function setColorValue(index, value, projectName) {
    const project = projectName ? normalizeProjectName(projectName) : ensureActiveProject();
    ensureColorCapacity(index, project);
    const fallback = getFallbackColorForIndex(project, index);
    const clean = sanitizeColor(value) || fallback;
    colors[index] = clean;
    const palette = normalizeProjectPalette(
      project,
      state.colorsByProject.get(project) || getProjectFallbackPalette(project)
    );
    assignColorToPalette(palette, index, clean);
    state.colorsByProject.set(project, cloneProjectPalette(palette));
    updateBindingsForIndex(index, clean);
  }

  function handleColorInput(index, event) {
    if (!event || !event.target) return;
    const project = ensureActiveProject();
    ensureColorCapacity(index, project);
    const next = sanitizeColor(event.target.value) || colors[index] || getFallbackColorForIndex(project, index);
    setColorValue(index, next, project);
    clearStatus();
  }

  function handleHexBlur(index, event) {
    if (!event || !event.target) return;
    const project = ensureActiveProject();
    ensureColorCapacity(index, project);
    const next = sanitizeColor(event.target.value);
    if (next) {
      setColorValue(index, next, project);
    } else {
      updateBindingsForIndex(index, colors[index] || getFallbackColorForIndex(project, index));
    }
    clearStatus();
  }

  function registerSlotBinding(index, binding) {
    if (!binding || !binding.colorInput || !binding.hexInput) return;
    const normalizedIndex = Number(index);
    if (!Number.isInteger(normalizedIndex) || normalizedIndex < 0) return;
    const list = slotBindings.get(normalizedIndex) || [];
    list.push(binding);
    slotBindings.set(normalizedIndex, list);
    binding.colorInput.addEventListener('input', event => handleColorInput(normalizedIndex, event));
    binding.hexInput.addEventListener('blur', event => handleHexBlur(normalizedIndex, event));
    binding.hexInput.addEventListener('keydown', event => {
      if (event.key === 'Enter') {
        event.preventDefault();
        binding.hexInput.blur();
      }
    });
    binding.hexInput.addEventListener('input', () => {
      clearStatus();
    });
  }

  function createColorSlotElement(slot) {
    const item = document.createElement('div');
    item.className = 'color-slot';
    item.dataset.colorIndex = String(slot.index);

    const label = document.createElement('span');
    label.className = 'color-slot__label';
    label.textContent = slot.label;

    const hexInput = document.createElement('input');
    hexInput.type = 'text';
    hexInput.value = '#1f4de2';
    hexInput.setAttribute('aria-label', `${slot.label} kode`);
    hexInput.setAttribute('placeholder', '#000000');
    hexInput.setAttribute('spellcheck', 'false');
    hexInput.setAttribute('autocomplete', 'off');
    hexInput.setAttribute('inputmode', 'text');
    hexInput.setAttribute('pattern', '#?[0-9a-fA-F]{3,6}');
    hexInput.maxLength = 7;

    const colorInput = document.createElement('input');
    colorInput.type = 'color';
    colorInput.value = '#1f4de2';
    colorInput.setAttribute('aria-label', `${slot.label} farge`);
    colorInput.setAttribute('title', slot.label);

    item.appendChild(label);
    item.appendChild(hexInput);
    item.appendChild(colorInput);

    registerSlotBinding(slot.index, { colorInput, hexInput });
    return item;
  }

  function appendSlotToTable(container, slotElement) {
    if (!container || !slotElement) return;
    let row = container.lastElementChild;
    if (!row || !row.classList.contains('color-row') || row.children.length >= SLOTS_PER_ROW) {
      row = document.createElement('div');
      row.className = 'color-row';
      container.appendChild(row);
    }
    row.appendChild(slotElement);
  }

  function ensureExtraGroup() {
    if (!colorGroupsContainer) return;
    if (extraGroupSection && extraSlotsContainer) return;

    extraGroupSection = document.createElement('section');
    extraGroupSection.className = 'color-group color-group--extra';
    extraGroupSection.hidden = true;

    const header = document.createElement('div');
    header.className = 'color-group__header';

    const title = document.createElement('h3');
    title.className = 'color-group__title';
    title.textContent = 'Ekstra farger';
    header.appendChild(title);

    const actions = document.createElement('div');
    actions.className = 'color-group__actions';

    extraGroupSaveButton = document.createElement('button');
    extraGroupSaveButton.type = 'button';
    extraGroupSaveButton.className = 'btn btn--inline';
    extraGroupSaveButton.textContent = 'Lagre';
    extraGroupSaveButton.dataset.saveGroup = EXTRA_GROUP_ID;
    extraGroupSaveButton.dataset.groupTitle = 'Ekstra farger';
    extraGroupSaveButton.setAttribute('aria-label', 'Lagre fargene for ekstra farger');
    actions.appendChild(extraGroupSaveButton);

    header.appendChild(actions);
    extraGroupSection.appendChild(header);

    extraSlotsContainer = document.createElement('div');
    extraSlotsContainer.className = 'color-table';
    extraGroupSection.appendChild(extraSlotsContainer);

    colorGroupsContainer.appendChild(extraGroupSection);
  }

  function ensureExtraSlot(index) {
    ensureExtraGroup();
    if (!extraSlotsContainer) return;
    if (slotBindings.has(index)) return;
    const slot = {
      index,
      label: `Farge ${index + 1}`,
      description: null
    };
    const element = createColorSlotElement(slot);
    appendSlotToTable(extraSlotsContainer, element);
  }

  function buildColorLayout() {
    if (!colorGroupsContainer || slotBindings.size) return;

    COLOR_SLOT_GROUPS.forEach(group => {
      const section = document.createElement('section');
      section.className = 'color-group';

      const header = document.createElement('div');
      header.className = 'color-group__header';

      const title = document.createElement('h3');
      title.className = 'color-group__title';
      title.textContent = group.title;
      header.appendChild(title);

      const actions = document.createElement('div');
      actions.className = 'color-group__actions';

      const saveButton = document.createElement('button');
      saveButton.type = 'button';
      saveButton.className = 'btn btn--inline';
      saveButton.textContent = 'Lagre';
      saveButton.dataset.saveGroup = group.groupId;
      saveButton.dataset.groupTitle = group.title;
      saveButton.setAttribute('aria-label', `Lagre fargene for ${group.title}`);
      actions.appendChild(saveButton);

      header.appendChild(actions);
      section.appendChild(header);

      const table = document.createElement('div');
      table.className = 'color-table';
      group.slots.forEach(slot => {
        appendSlotToTable(table, createColorSlotElement(slot));
      });
      section.appendChild(table);
      colorGroupsContainer.appendChild(section);
    });

    ensureExtraGroup();
  }

  function updateExtraGroupVisibility() {
    if (!extraGroupSection) return;
    const hasExtraColors = colors.length > MIN_COLOR_SLOTS;
    extraGroupSection.hidden = !hasExtraColors;
    if (extraGroupSaveButton) {
      extraGroupSaveButton.disabled = !hasExtraColors;
    }
  }

  function syncBindings() {
    for (let index = 0; index < colors.length; index += 1) {
      updateBindingsForIndex(index, colors[index]);
    }
    updateExtraGroupVisibility();
  }

  function renderColors(projectName) {
    if (!colorGroupsContainer) return;
    buildColorLayout();
    let project = typeof projectName === 'string' ? normalizeProjectName(projectName) : '';
    if (project) {
      ensureProjectColors(project);
      state.activeProject = project;
    } else {
      project = ensureActiveProject();
    }
    updateProjectHeading(project);
    const palette = getActiveColors(project);
    commitActiveColors(palette, project);
    for (let index = MIN_COLOR_SLOTS; index < colors.length; index += 1) {
      ensureExtraSlot(index);
    }
    syncBindings();
  }

  function requestActiveProfileFromParent() {
    if (typeof window === 'undefined') return;
    const parentWindow = window.parent && window.parent !== window ? window.parent : null;
    if (!parentWindow) return;
    try {
      parentWindow.postMessage({ type: 'math-visuals:request-profile' }, '*');
    } catch (_) {}
  }

  function handleProfileMessage(event) {
    const data = event && event.data;
    let type;
    let profileName;
    if (typeof data === 'string') {
      type = data;
    } else if (data && typeof data === 'object') {
      type = data.type;
      profileName = data.profile || data.name || data.value;
    }
    if (type !== 'math-visuals:profile-change') return;
    const normalized = normalizeProjectName(profileName);
    if (normalized) {
      state.preferredProject = normalized;
      let current = null;
      if (settingsApi && typeof settingsApi.getActiveProject === 'function') {
        try {
          current = normalizeProjectName(settingsApi.getActiveProject());
        } catch (_) {}
      }
      if (
        settingsApi &&
        typeof settingsApi.setActiveProject === 'function' &&
        current !== normalized
      ) {
        try {
          settingsApi.setActiveProject(normalized, { notify: true });
        } catch (_) {}
      }
      renderColors(normalized);
    } else {
      state.preferredProject = null;
      renderColors();
    }
    clearStatus();
  }

  function applySettings(snapshot, options = {}) {
    const data = snapshot && typeof snapshot === 'object' ? snapshot : {};
    state.projectOrder = Array.isArray(data.projectOrder)
      ? Array.from(new Set(data.projectOrder.map(normalizeProjectName))).filter(Boolean)
      : [];
    state.colorsByProject = new Map();
    state.persistedColorsByProject = new Map();
    const projects = data.projects && typeof data.projects === 'object' ? data.projects : {};
    Object.keys(projects).forEach(name => {
      const normalized = normalizeProjectName(name);
      if (!normalized) return;
      const entry = projects[name];
      const paletteData = entry && entry.defaultColors ? entry.defaultColors : getProjectFallbackPalette(normalized);
      const normalizedPalette = normalizeProjectPalette(normalized, paletteData);
      const cloned = cloneProjectPalette(normalizedPalette);
      state.colorsByProject.set(normalized, cloned);
      state.persistedColorsByProject.set(normalized, cloneProjectPalette(cloned));
      if (!state.projectOrder.includes(normalized)) {
        state.projectOrder.push(normalized);
      }
    });
    ['campus', 'kikora', 'annet'].forEach(name => {
      if (!state.projectOrder.includes(name)) {
        state.projectOrder.push(name);
      }
      if (!state.colorsByProject.has(name)) {
        const palette = getProjectFallbackPalette(name);
        state.colorsByProject.set(name, cloneProjectPalette(palette));
        state.persistedColorsByProject.set(name, cloneProjectPalette(palette));
      } else if (!state.persistedColorsByProject.has(name)) {
        const palette = state.colorsByProject.get(name);
        state.persistedColorsByProject.set(name, cloneProjectPalette(palette));
      }
    });
    const incomingActiveProject = normalizeProjectName(data.activeProject);
    const forcedActive = options.forceActiveProject ? normalizeProjectName(options.forceActiveProject) : '';
    state.activeProject = forcedActive || incomingActiveProject;
    const active = ensureActiveProject();
    state.activeProject = active;
    state.defaultLineThickness =
      data.defaultLineThickness != null ? clampLineThickness(data.defaultLineThickness) : DEFAULT_LINE_THICKNESS;
    state.persistedLineThickness = state.defaultLineThickness;
    if (lineInput) {
      lineInput.value = state.defaultLineThickness;
    }
    renderColors(state.activeProject);
    updateLinePreview();
  }

  async function loadSettings() {
    const url = resolveApiUrl();
    if (!url) {
      setStatus('Fant ikke endepunkt for innstillinger.', 'error');
      setFormDisabled(true);
      return;
    }
    setStatus('Laster innstillinger...', 'info');
    setFormDisabled(true);
    try {
      const response = await fetch(url, { headers: { Accept: 'application/json' } });
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      const payload = await response.json().catch(() => ({}));
      const snapshot = payload && typeof payload === 'object' && payload.settings ? payload.settings : payload;
      applySettings(snapshot || {}, { forceActiveProject: state.activeProject });
      setStatus('Innstillingene er lastet.', 'info');
      if (settingsApi && typeof settingsApi.refresh === 'function') {
        try {
          settingsApi.refresh({ force: true, notify: true });
        } catch (_) {}
      }
    } catch (error) {
      console.error(error);
      setStatus('Kunne ikke laste innstillingene.', 'error');
    }
    setFormDisabled(false);
  }

  function buildPayload(options = {}) {
    const colorsByProject =
      options.projectColors instanceof Map ? options.projectColors : state.colorsByProject;
    const activeProject = options.activeProject
      ? normalizeProjectName(options.activeProject)
      : ensureActiveProject();
    const payload = {
      activeProject,
      defaultLineThickness:
        options.lineThickness != null
          ? clampLineThickness(options.lineThickness)
          : clampLineThickness(state.defaultLineThickness),
      projectOrder: [],
      projects: {}
    };

    const seenProjects = new Set();
    const registerProject = projectName => {
      const normalized = normalizeProjectName(projectName);
      if (!normalized || seenProjects.has(normalized)) return;
      const storedPalette = colorsByProject.get(normalized);
      const normalizedPalette = normalizeProjectPalette(
        normalized,
        storedPalette || getProjectFallbackPalette(normalized)
      );
      payload.projects[normalized] = { defaultColors: cloneProjectPalette(normalizedPalette) };
      payload.projectOrder.push(normalized);
      seenProjects.add(normalized);
    };

    state.projectOrder.forEach(registerProject);
    if (colorsByProject && typeof colorsByProject.forEach === 'function') {
      colorsByProject.forEach((_, name) => registerProject(name));
    }
    state.colorsByProject.forEach((_, name) => registerProject(name));
    ['campus', 'kikora', 'annet'].forEach(registerProject);

    return payload;
  }

  async function persistSettings(method, body) {
    const url = resolveApiUrl();
    if (!url) {
      throw new Error('Ingen endepunkt for innstillinger');
    }
    const response = await fetch(url, {
      method,
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json'
      },
      body: body ? JSON.stringify(body) : undefined
    });
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    const payload = await response.json().catch(() => ({}));
    return payload && typeof payload === 'object' && payload.settings ? payload.settings : payload;
  }

  if (lineInput) {
    lineInput.addEventListener('input', () => {
      state.defaultLineThickness = clampLineThickness(lineInput.value);
      updateLinePreview();
      clearStatus();
    });
  }

  if (addColorButton) {
    addColorButton.addEventListener('click', () => {
      const project = ensureActiveProject();
      if (colors.length >= MAX_COLORS) {
        setStatus(`Du kan ikke ha flere enn ${MAX_COLORS} standardfarger.`, 'error');
        return;
      }
      const nextIndex = colors.length;
      const nextColor =
        getFallbackColorForIndex(project, nextIndex) || colors[nextIndex - 1] || '#1f4de2';
      colors.push(nextColor);
      const palette = normalizeProjectPalette(
        project,
        state.colorsByProject.get(project) || getProjectFallbackPalette(project)
      );
      assignColorToPalette(palette, nextIndex, nextColor);
      state.colorsByProject.set(project, cloneProjectPalette(palette));
      ensureExtraSlot(nextIndex);
      updateBindingsForIndex(nextIndex, nextColor);
      updateExtraGroupVisibility();
      clearStatus();
    });
  }

  if (colorGroupsContainer) {
    colorGroupsContainer.addEventListener('click', event => {
      const button = event && event.target && event.target.closest('[data-save-group]');
      if (!button || !colorGroupsContainer.contains(button)) return;
      event.preventDefault();
      const groupId = button.getAttribute('data-save-group');
      const groupTitle = button.getAttribute('data-group-title') || button.dataset.groupTitle || '';
      void saveColorGroup(groupId, groupTitle);
    });
  }

  if (resetButton) {
    resetButton.addEventListener('click', async () => {
      setStatus('Tilbakestiller innstillinger...', 'info');
      setFormDisabled(true);
      const activeProject = state.activeProject;
      try {
        const snapshot = await persistSettings('DELETE');
        applySettings(snapshot || {}, { forceActiveProject: activeProject });
        setStatus('Innstillingene ble tilbakestilt.', 'success');
        if (settingsApi && typeof settingsApi.refresh === 'function') {
          try {
            settingsApi.refresh({ force: true, notify: true });
          } catch (_) {}
        }
        setFormDisabled(false);
      } catch (error) {
        console.error(error);
        setStatus('Kunne ikke tilbakestille innstillingene.', 'error');
        setFormDisabled(false);
      }
    });
  }

  if (lineSaveButton) {
    lineSaveButton.addEventListener('click', () => {
      void saveLineThickness();
    });
  }

  form.addEventListener('submit', event => {
    event.preventDefault();
  });

  if (settingsApi && typeof settingsApi.subscribe === 'function') {
    try {
      settingsApi.subscribe(snapshot => {
        if (!snapshot || typeof snapshot !== 'object') return;
        applySettings(snapshot, { forceActiveProject: state.activeProject });
        notifySettingsUpdated();
      });
    } catch (_) {}
  } else if (typeof window !== 'undefined' && typeof window.addEventListener === 'function') {
    window.addEventListener('math-visuals:settings-changed', event => {
      const detail = event && event.detail && event.detail.settings;
      if (detail && typeof detail === 'object') {
        applySettings(detail, { forceActiveProject: state.activeProject });
        notifySettingsUpdated();
      }
    });
  }

  if (typeof window !== 'undefined' && typeof window.addEventListener === 'function') {
    window.addEventListener('message', handleProfileMessage);
  }

  applySettings({});
  if (typeof window !== 'undefined') {
    setTimeout(requestActiveProfileFromParent, 0);
  }
  loadSettings();
})();
