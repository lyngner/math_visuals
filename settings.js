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

  const MAX_COLORS = 48;
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
  const PROJECT_FALLBACKS = {
    kikora: ['#E31C3D', '#BF4474', '#873E79', '#534477', '#6C1BA2', '#B25FE3'],
    campus: ['#DBE3FF', '#2C395B', '#E3B660', '#C5E5E9', '#F6E5BC', '#F1D0D9'],
    annet: ['#DBE3FF', '#2C395B', '#E3B660', '#C5E5E9', '#F6E5BC', '#F1D0D9'],
    default: ['#1F4DE2', '#475569', '#ef4444', '#0ea5e9', '#10b981', '#f59e0b']
  };
  const COLOR_SLOT_GROUPS = [
    {
      id: 'graftegner',
      title: 'Graftegner',
      description: 'Standardfarge for nye grafer og funksjoner.',
      slots: [{ index: 0, label: 'Graf', description: 'Brukes for grafer og koordinatsystem.' }]
    },
    {
      id: 'nkant',
      title: 'nKant',
      description: 'Farger for linjer, vinkler og fyll i nKant.',
      slots: [
        { index: 1, label: 'Linje', description: 'Kanter, diagonaler og hjelpelinjer.' },
        { index: 2, label: 'Vinkel', description: 'Markeringer og vinkelflater.' },
        { index: 3, label: 'Fyll', description: 'Utfylling av polygonflater.' }
      ]
    },
    {
      id: 'diagram',
      title: 'Diagram',
      description: 'Standardfarger for stolpe- og sektordiagram.',
      slots: [
        { index: 4, label: 'En stolpe', description: 'Når et stolpediagram har én dataserie.' },
        { index: 5, label: 'Stolpe1', description: 'Første dataserie i sammenlignende stolpediagram.' },
        { index: 6, label: 'Stolpe2', description: 'Andre dataserie i sammenlignende stolpediagram.' },
        { index: 7, label: 'Sektor1', description: 'Første sektor i sektordiagram.' },
        { index: 8, label: 'Sektor2', description: 'Andre sektor i sektordiagram.' },
        { index: 9, label: 'Sektor3', description: 'Tredje sektor i sektordiagram.' },
        { index: 10, label: 'Sektor4', description: 'Fjerde sektor i sektordiagram.' },
        { index: 11, label: 'Sektor5', description: 'Femte sektor i sektordiagram.' },
        { index: 12, label: 'Sektor6', description: 'Sjette sektor i sektordiagram.' }
      ]
    },
    {
      id: 'fractions',
      title: 'Brøk og tenkeblokker',
      description: 'Farger for linjer og fyll i brøkmodeller og tenkeblokker.',
      slots: [
        { index: 13, label: 'Linje', description: 'Konturer i brøker og tenkeblokker.' },
        { index: 14, label: 'Fyll', description: 'Fyllfarge for brøker og tenkeblokker.' }
      ]
    },
    {
      id: 'figurtall',
      title: 'Figurtall',
      description: 'Seks standardfarger for figurer i mønstre.',
      slots: [
        { index: 15, label: 'Fyll 1', description: 'Første farge i figurtall.' },
        { index: 16, label: 'Fyll 2', description: 'Andre farge i figurtall.' },
        { index: 17, label: 'Fyll 3', description: 'Tredje farge i figurtall.' },
        { index: 18, label: 'Fyll 4', description: 'Fjerde farge i figurtall.' },
        { index: 19, label: 'Fyll 5', description: 'Femte farge i figurtall.' },
        { index: 20, label: 'Fyll 6', description: 'Sjette farge i figurtall.' }
      ]
    },
    {
      id: 'arealmodell',
      title: 'Arealmodell',
      description: 'Farger for rutene i arealmodellen.',
      slots: [
        { index: 21, label: 'Farge 1', description: 'Første rute i arealmodellen.' },
        { index: 22, label: 'Farge 2', description: 'Andre rute i arealmodellen.' },
        { index: 23, label: 'Farge 3', description: 'Tredje rute i arealmodellen.' },
        { index: 24, label: 'Farge 4', description: 'Fjerde rute i arealmodellen.' }
      ]
    },
    {
      id: 'tallinje',
      title: 'Tallinje',
      description: 'Standardfarger for tallinjen.',
      slots: [
        { index: 25, label: 'Linje', description: 'Selve tallinjen og markeringer.' },
        { index: 26, label: 'Fyll', description: 'Utfylling av områder på tallinjen.' }
      ]
    },
    {
      id: 'kvikkbilder',
      title: 'Kvikkbilder',
      description: 'Fyllfargen i kvikkbilder.',
      slots: [{ index: 27, label: 'Fyll', description: 'Brukes på figurer i kvikkbilder.' }]
    },
    {
      id: 'trefigurer',
      title: '3D-figurer',
      description: 'Standardfarger for romfigurer.',
      slots: [
        { index: 28, label: 'Linje', description: 'Kanter og hjelpelinjer i romfigurer.' },
        { index: 29, label: 'Fyll', description: 'Fyllfarge for romfigurer.' }
      ]
    },
    {
      id: 'brokvegg',
      title: 'Brøkvegg',
      description: 'Farger for nivåene i brøkveggen.',
      slots: [
        { index: 30, label: 'Fyll 1', description: 'Øverste nivå i brøkveggen.' },
        { index: 31, label: 'Fyll 2', description: 'Andre nivå i brøkveggen.' },
        { index: 32, label: 'Fyll 3', description: 'Tredje nivå i brøkveggen.' },
        { index: 33, label: 'Fyll 4', description: 'Fjerde nivå i brøkveggen.' },
        { index: 34, label: 'Fyll 5', description: 'Femte nivå i brøkveggen.' },
        { index: 35, label: 'Fyll 6', description: 'Sjette nivå i brøkveggen.' }
      ]
    },
    {
      id: 'prikktilprikk',
      title: 'Prikk til prikk',
      description: 'Farger for punkter og linjer i prikk til prikk.',
      slots: [
        { index: 36, label: 'Prikk', description: 'Standardfarge for punktene.' },
        { index: 37, label: 'Linje', description: 'Linjen som binder punktene sammen.' }
      ]
    }
  ];
  const MIN_COLOR_SLOTS = COLOR_SLOT_GROUPS.reduce((total, group) => total + group.slots.length, 0);
  const SLOTS_PER_ROW = 3;

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
        map.set(name, Array.isArray(palette) ? palette.slice() : []);
      });
    }
    state.colorsByProject.forEach((palette, name) => {
      if (!map.has(name)) {
        map.set(name, Array.isArray(palette) ? palette.slice() : []);
      }
    });
    return map;
  }

  function collectGroupIndices(groupId, projectName) {
    const indices = new Set();
    const normalizedGroup = typeof groupId === 'string' ? groupId.trim() : '';
    if (!normalizedGroup) return indices;
    if (normalizedGroup === 'extra') {
      const palette = state.colorsByProject.get(normalizeProjectName(projectName)) || [];
      for (let index = MIN_COLOR_SLOTS; index < Math.min(palette.length, MAX_COLORS); index += 1) {
        indices.add(index);
      }
      return indices;
    }
    const group = COLOR_SLOT_GROUPS.find(entry => entry.id === normalizedGroup);
    if (!group) return indices;
    group.slots.forEach(slot => {
      if (!slot) return;
      const idx = Number(slot.index);
      if (Number.isInteger(idx) && idx >= 0 && idx < MAX_COLORS) {
        indices.add(idx);
      }
    });
    return indices;
  }

  function buildProjectColorsForSave(projectName, indices) {
    const map = clonePersistedColorMap();
    const normalizedProject = normalizeProjectName(projectName);
    if (!normalizedProject) return map;
    const targetIndices = indices instanceof Set ? indices : new Set(indices || []);
    if (!targetIndices.size) return map;
    const editingPalette = state.colorsByProject.get(normalizedProject) || [];
    const base = map.get(normalizedProject) || [];
    const next = Array.isArray(base) ? base.slice() : [];
    targetIndices.forEach(index => {
      if (!Number.isInteger(index) || index < 0 || index >= MAX_COLORS) return;
      while (next.length <= index && next.length < MAX_COLORS) {
        next.push(getFallbackColorForIndex(normalizedProject, next.length));
      }
      const current = editingPalette[index];
      const sanitized =
        typeof current === 'string' && current
          ? sanitizeColor(current) || getFallbackColorForIndex(normalizedProject, index)
          : getFallbackColorForIndex(normalizedProject, index);
      next[index] = sanitized;
    });
    map.set(normalizedProject, next);
    return map;
  }

  function captureUnsavedChanges(excludedProject, excludedIndices) {
    const excludedName = normalizeProjectName(excludedProject);
    const excludedSet = excludedIndices instanceof Set ? excludedIndices : new Set();
    const changes = new Map();
    state.colorsByProject.forEach((palette, project) => {
      const normalizedProject = normalizeProjectName(project);
      if (!normalizedProject || !Array.isArray(palette)) return;
      const persisted = state.persistedColorsByProject.get(normalizedProject) || [];
      const limit = Math.min(Math.max(palette.length, persisted.length), MAX_COLORS);
      const entries = new Map();
      for (let index = 0; index < limit; index += 1) {
        if (normalizedProject === excludedName && excludedSet.has(index)) {
          continue;
        }
        const current = palette[index];
        const baseline = persisted[index];
        if (typeof current === 'string' && current && current !== baseline) {
          entries.set(index, current);
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
    changes.forEach((indices, project) => {
      const normalizedProject = normalizeProjectName(project);
      if (!normalizedProject || !indices || !indices.size) return;
      const currentPalette = state.colorsByProject.get(normalizedProject) || [];
      const next = Array.isArray(currentPalette) ? currentPalette.slice() : [];
      indices.forEach((value, index) => {
        if (!Number.isInteger(index) || index < 0 || index >= MAX_COLORS) return;
        while (next.length <= index && next.length < MAX_COLORS) {
          next.push(getFallbackColorForIndex(normalizedProject, next.length));
        }
        const sanitized = sanitizeColor(value) || getFallbackColorForIndex(normalizedProject, index);
        next[index] = sanitized;
      });
      state.colorsByProject.set(normalizedProject, next.slice());
      if (normalizedProject === state.activeProject) {
        commitActiveColors(next, normalizedProject);
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
    const indices = collectGroupIndices(normalizedId, activeProject);
    if (!indices.size) {
      const emptyLabel = groupTitle && groupTitle.trim() ? groupTitle.trim() : 'gruppen';
      setStatus(`Ingen endringer å lagre for ${emptyLabel}.`, 'info');
      return;
    }
    const editingPalette = state.colorsByProject.get(activeProject) || [];
    const persistedPalette = state.persistedColorsByProject.get(activeProject) || [];
    let hasChanges = false;
    indices.forEach(index => {
      if (hasChanges) return;
      const current = editingPalette[index];
      const baseline = persistedPalette[index];
      if (typeof current === 'string' && current && current !== baseline) {
        hasChanges = true;
      } else if (current && baseline == null) {
        hasChanges = true;
      }
    });
    if (!hasChanges) {
      const unchangedLabel = groupTitle && groupTitle.trim() ? groupTitle.trim() : 'gruppen';
      setStatus(`Ingen endringer å lagre for ${unchangedLabel}.`, 'info');
      return;
    }
    const label = groupTitle && groupTitle.trim() ? groupTitle.trim() : 'gruppen';
    const unsavedChanges = captureUnsavedChanges(activeProject, indices);
    const colorsForSave = buildProjectColorsForSave(activeProject, indices);
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
    const match = /^#?([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.exec(trimmed);
    if (!match) return null;
    let hex = match[1].toLowerCase();
    if (hex.length === 3) {
      hex = hex.split('').map(ch => ch + ch).join('');
    }
    return `#${hex}`;
  }

  function clampLineThickness(value) {
    const num = Number.parseFloat(value);
    if (!Number.isFinite(num)) return DEFAULT_LINE_THICKNESS;
    if (num < 1) return 1;
    if (num > 12) return 12;
    return Math.round(num);
  }

  function getProjectFallbackPalette(project) {
    const key = normalizeProjectName(project);
    const fallback = PROJECT_FALLBACKS[key] || PROJECT_FALLBACKS.default;
    return fallback.slice(0, MAX_COLORS);
  }

  function getFallbackColorForIndex(project, index) {
    const palette = getProjectFallbackPalette(project);
    if (!palette.length) return PROJECT_FALLBACKS.default[0];
    const normalizedIndex = Number.isInteger(index) && index >= 0 ? index : 0;
    return palette[normalizedIndex % palette.length] || palette[0];
  }

  function normalizeProjectName(name) {
    if (typeof name !== 'string') return '';
    return name.trim().toLowerCase();
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
      const palette = expandPalette(normalized, getProjectFallbackPalette(normalized), MIN_COLOR_SLOTS);
      state.colorsByProject.set(normalized, palette.slice());
    }
    if (!state.persistedColorsByProject.has(normalized)) {
      const palette = state.colorsByProject.get(normalized);
      state.persistedColorsByProject.set(
        normalized,
        Array.isArray(palette) ? palette.slice() : expandPalette(normalized, getProjectFallbackPalette(normalized), MIN_COLOR_SLOTS)
      );
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
    if (Array.isArray(palette) && palette.length) {
      return palette.slice(0, MAX_COLORS);
    }
    return getProjectFallbackPalette(project);
  }

  function expandPalette(projectName, basePalette, minimumLength = 0) {
    const project = projectName ? normalizeProjectName(projectName) : ensureActiveProject();
    const source = Array.isArray(basePalette) ? basePalette : [];
    const min = Number.isInteger(minimumLength) && minimumLength > 0 ? minimumLength : 0;
    const limit = Math.min(MAX_COLORS, Math.max(source.length, min));
    const result = [];
    for (let index = 0; index < limit; index += 1) {
      const clean = sanitizeColor(source[index]) || getFallbackColorForIndex(project, index);
      result.push(clean);
    }
    if (!result.length) {
      result.push(getFallbackColorForIndex(project, 0));
    }
    return result;
  }

  function commitActiveColors(next, projectName) {
    const project = projectName ? normalizeProjectName(projectName) : ensureActiveProject();
    const expanded = expandPalette(project, Array.isArray(next) ? next : [], MIN_COLOR_SLOTS);
    state.colorsByProject.set(project, expanded.slice());
    colors = expanded.slice();
  }

  function ensureColorCapacity(index, projectName) {
    const project = projectName ? normalizeProjectName(projectName) : ensureActiveProject();
    if (!Number.isInteger(index) || index < 0) return;
    while (colors.length <= index && colors.length < MAX_COLORS) {
      colors.push(getFallbackColorForIndex(project, colors.length));
    }
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
    state.colorsByProject.set(project, colors.slice());
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
    extraGroupSaveButton.dataset.saveGroup = 'extra';
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
      saveButton.dataset.saveGroup = group.id;
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
      const palette = Array.isArray(entry && entry.defaultColors) ? entry.defaultColors : [];
      const sanitized = palette
        .map((value, index) => sanitizeColor(value) || getFallbackColorForIndex(normalized, index))
        .filter(Boolean)
        .slice(0, MAX_COLORS);
      const expanded = expandPalette(
        normalized,
        sanitized.length ? sanitized : getProjectFallbackPalette(normalized),
        MIN_COLOR_SLOTS
      );
      state.colorsByProject.set(normalized, expanded);
      state.persistedColorsByProject.set(normalized, expanded.slice());
      if (!state.projectOrder.includes(normalized)) {
        state.projectOrder.push(normalized);
      }
    });
    ['campus', 'kikora', 'annet'].forEach(name => {
      if (!state.projectOrder.includes(name)) {
        state.projectOrder.push(name);
      }
      if (!state.colorsByProject.has(name)) {
        const palette = expandPalette(name, getProjectFallbackPalette(name), MIN_COLOR_SLOTS);
        state.colorsByProject.set(name, palette.slice());
        state.persistedColorsByProject.set(name, palette.slice());
      } else if (!state.persistedColorsByProject.has(name)) {
        const palette = state.colorsByProject.get(name);
        state.persistedColorsByProject.set(name, Array.isArray(palette) ? palette.slice() : []);
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
      const palette = Array.isArray(storedPalette) && storedPalette.length
        ? storedPalette
        : getProjectFallbackPalette(normalized);
      payload.projects[normalized] = { defaultColors: palette.slice(0, MAX_COLORS) };
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
      state.colorsByProject.set(project, colors.slice());
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
        setStatus('Innstillingene er oppdatert.', 'info');
      });
    } catch (_) {}
  } else if (typeof window !== 'undefined' && typeof window.addEventListener === 'function') {
    window.addEventListener('math-visuals:settings-changed', event => {
      const detail = event && event.detail && event.detail.settings;
      if (detail && typeof detail === 'object') {
        applySettings(detail, { forceActiveProject: state.activeProject });
        setStatus('Innstillingene er oppdatert.', 'info');
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
