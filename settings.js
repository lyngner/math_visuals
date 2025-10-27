(function () {
  if (typeof document === 'undefined') return;
  const form = document.querySelector('[data-settings-form]');
  if (!form) return;

  const colorList = form.querySelector('[data-color-list]');
  const addColorButton = form.querySelector('[data-add-color]');
  const resetButton = form.querySelector('[data-reset-settings]');
  const statusElement = form.querySelector('[data-status]');
  const lineInput = form.querySelector('#lineThickness');
  const linePreviewBar = form.querySelector('[data-line-preview-bar]');
  const projectSelect = form.querySelector('[data-project-select]');

  const MAX_COLORS = 12;
  const DEFAULT_LINE_THICKNESS = 3;
  const PROJECT_LABELS = {
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

  const settingsApi = resolveSettingsApi();
  const state = {
    projectOrder: [],
    colorsByProject: new Map(),
    activeProject: null,
    defaultLineThickness: DEFAULT_LINE_THICKNESS
  };
  let colors = [];

  function resolveSettingsApi() {
    if (typeof window === 'undefined') return null;
    const api = window.MathVisualsSettings;
    if (api && typeof api === 'object') return api;
    const legacy = window.mathVisuals && window.mathVisuals.settings;
    return legacy && typeof legacy === 'object' ? legacy : null;
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
    const key = typeof project === 'string' ? project.trim().toLowerCase() : '';
    const fallback = PROJECT_FALLBACKS[key] || PROJECT_FALLBACKS.default;
    return fallback.slice(0, MAX_COLORS);
  }

  function getFallbackColorForIndex(project, index) {
    const palette = getProjectFallbackPalette(project);
    if (!palette.length) return PROJECT_FALLBACKS.default[0];
    const normalizedIndex = Number.isInteger(index) && index >= 0 ? index : 0;
    return palette[normalizedIndex % palette.length] || palette[0];
  }

  function formatProjectLabel(name) {
    if (!name) return '';
    const key = name.trim().toLowerCase();
    if (PROJECT_LABELS[key]) return PROJECT_LABELS[key];
    return key.charAt(0).toUpperCase() + key.slice(1);
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
    const thickness = clampLineThickness(lineInput && lineInput.value);
    linePreviewBar.style.setProperty('--preview-thickness', `${thickness}px`);
  }

  function ensureActiveProject() {
    if (state.activeProject && state.colorsByProject.has(state.activeProject)) {
      return state.activeProject;
    }
    const candidate = state.projectOrder.find(name => state.colorsByProject.has(name));
    if (candidate) {
      state.activeProject = candidate;
      return candidate;
    }
    const fallback = 'campus';
    state.activeProject = fallback;
    if (!state.colorsByProject.has(fallback)) {
      state.colorsByProject.set(fallback, getProjectFallbackPalette(fallback));
    }
    return state.activeProject;
  }

  function populateProjectOptions() {
    if (!projectSelect) return;
    const previous = projectSelect.value;
    projectSelect.innerHTML = '';
    state.projectOrder.forEach(name => {
      const option = document.createElement('option');
      option.value = name;
      option.textContent = formatProjectLabel(name);
      projectSelect.appendChild(option);
    });
    const active = ensureActiveProject();
    if (state.projectOrder.includes(previous)) {
      projectSelect.value = previous;
    } else if (state.projectOrder.includes(active)) {
      projectSelect.value = active;
    } else if (projectSelect.options.length) {
      projectSelect.selectedIndex = 0;
      state.activeProject = projectSelect.value;
    }
  }

  function getActiveColors() {
    const project = ensureActiveProject();
    const palette = state.colorsByProject.get(project);
    if (Array.isArray(palette) && palette.length) {
      return palette.slice(0, MAX_COLORS);
    }
    return getProjectFallbackPalette(project);
  }

  function commitActiveColors(next) {
    const project = ensureActiveProject();
    const sanitized = [];
    next.forEach((value, index) => {
      const clean = sanitizeColor(value) || getFallbackColorForIndex(project, index);
      if (clean) sanitized.push(clean);
    });
    if (!sanitized.length) {
      sanitized.push(getFallbackColorForIndex(project, 0));
    }
    state.colorsByProject.set(project, sanitized.slice(0, MAX_COLORS));
    colors = sanitized.slice(0, MAX_COLORS);
  }

  function createColorItem(color, index) {
    const item = document.createElement('li');
    item.className = 'color-item';

    const colorLabel = document.createElement('label');
    const srOnly = document.createElement('span');
    srOnly.className = 'sr-only';
    srOnly.textContent = `Farge ${index + 1}`;
    const colorInput = document.createElement('input');
    colorInput.type = 'color';
    colorInput.value = color;
    colorLabel.appendChild(srOnly);
    colorLabel.appendChild(colorInput);

    const hexInput = document.createElement('input');
    hexInput.type = 'text';
    hexInput.value = color;
    hexInput.setAttribute('aria-label', `Fargekode ${index + 1}`);

    const removeButton = document.createElement('button');
    removeButton.type = 'button';
    removeButton.className = 'color-remove';
    removeButton.textContent = 'Fjern';
    removeButton.setAttribute('aria-label', `Fjern farge ${index + 1}`);

    colorInput.addEventListener('input', event => {
      const next = sanitizeColor(event.target.value) || colors[index];
      colors[index] = next;
      state.colorsByProject.set(state.activeProject, colors.slice());
      hexInput.value = next;
      event.target.value = next;
      clearStatus();
    });

    hexInput.addEventListener('blur', event => {
      const next = sanitizeColor(event.target.value);
      if (next) {
        colors[index] = next;
        hexInput.value = next;
        colorInput.value = next;
        state.colorsByProject.set(state.activeProject, colors.slice());
      } else {
        hexInput.value = colors[index];
      }
      clearStatus();
    });

    removeButton.addEventListener('click', () => {
      if (colors.length <= 1) {
        setStatus('Det må være minst én farge.', 'error');
        return;
      }
      colors.splice(index, 1);
      state.colorsByProject.set(state.activeProject, colors.slice());
      renderColors();
      clearStatus();
    });

    item.appendChild(colorLabel);
    item.appendChild(hexInput);
    item.appendChild(removeButton);
    return item;
  }

  function renderColors() {
    if (!colorList) return;
    const palette = getActiveColors();
    commitActiveColors(palette);
    colorList.innerHTML = '';
    colors.forEach((color, index) => {
      colorList.appendChild(createColorItem(color, index));
    });
  }

  function applySettings(snapshot) {
    const data = snapshot && typeof snapshot === 'object' ? snapshot : {};
    state.projectOrder = Array.isArray(data.projectOrder)
      ? Array.from(new Set(data.projectOrder.map(name => (typeof name === 'string' ? name.trim().toLowerCase() : '')))).filter(Boolean)
      : [];
    state.colorsByProject = new Map();
    const projects = data.projects && typeof data.projects === 'object' ? data.projects : {};
    Object.keys(projects).forEach(name => {
      const normalized = typeof name === 'string' ? name.trim().toLowerCase() : '';
      if (!normalized) return;
      const entry = projects[name];
      const palette = Array.isArray(entry && entry.defaultColors) ? entry.defaultColors : [];
      const sanitized = palette
        .map((value, index) => sanitizeColor(value) || getFallbackColorForIndex(normalized, index))
        .filter(Boolean)
        .slice(0, MAX_COLORS);
      state.colorsByProject.set(
        normalized,
        sanitized.length ? sanitized : getProjectFallbackPalette(normalized)
      );
      if (!state.projectOrder.includes(normalized)) {
        state.projectOrder.push(normalized);
      }
    });
    ['campus', 'kikora', 'annet'].forEach(name => {
      if (!state.projectOrder.includes(name)) {
        state.projectOrder.push(name);
      }
      if (!state.colorsByProject.has(name)) {
        state.colorsByProject.set(name, getProjectFallbackPalette(name));
      }
    });
    state.activeProject = typeof data.activeProject === 'string' ? data.activeProject.trim().toLowerCase() : null;
    ensureActiveProject();
    state.defaultLineThickness =
      data.defaultLineThickness != null ? clampLineThickness(data.defaultLineThickness) : DEFAULT_LINE_THICKNESS;
    if (lineInput) {
      lineInput.value = state.defaultLineThickness;
    }
    populateProjectOptions();
    const active = ensureActiveProject();
    if (projectSelect && projectSelect.value !== active) {
      projectSelect.value = active;
    }
    renderColors();
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
      applySettings(snapshot || {});
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

  function buildPayload() {
    const payload = {
      activeProject: ensureActiveProject(),
      defaultLineThickness: clampLineThickness(lineInput && lineInput.value),
      projects: {}
    };
    state.projectOrder.forEach(name => {
      const palette = state.colorsByProject.get(name) || getProjectFallbackPalette(name);
      payload.projects[name] = { defaultColors: palette.slice(0, MAX_COLORS) };
    });
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
      updateLinePreview();
      clearStatus();
    });
  }

  if (projectSelect) {
    projectSelect.addEventListener('change', () => {
      const value = projectSelect.value;
      if (!value) return;
      state.activeProject = value.trim().toLowerCase();
      if (!state.colorsByProject.has(state.activeProject)) {
        state.colorsByProject.set(state.activeProject, getProjectFallbackPalette(state.activeProject));
      }
      if (settingsApi && typeof settingsApi.setActiveProject === 'function') {
        try {
          settingsApi.setActiveProject(state.activeProject, { notify: true });
        } catch (_) {}
      }
      renderColors();
      updateLinePreview();
      clearStatus();
    });
  }

  if (addColorButton) {
    addColorButton.addEventListener('click', () => {
      ensureActiveProject();
      if (colors.length >= MAX_COLORS) {
        setStatus('Du kan ikke ha flere enn 12 standardfarger.', 'error');
        return;
      }
      const nextColor =
        getFallbackColorForIndex(state.activeProject, colors.length) || colors[colors.length - 1] || '#1F4DE2';
      colors.push(nextColor);
      state.colorsByProject.set(state.activeProject, colors.slice());
      renderColors();
      clearStatus();
    });
  }

  if (resetButton) {
    resetButton.addEventListener('click', async () => {
      setStatus('Tilbakestiller innstillinger...', 'info');
      setFormDisabled(true);
      try {
        const snapshot = await persistSettings('DELETE');
        applySettings(snapshot || {});
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

  form.addEventListener('submit', async event => {
    event.preventDefault();
    ensureActiveProject();
    setStatus('Lagrer innstillinger...', 'info');
    setFormDisabled(true);
    try {
      const payload = buildPayload();
      const snapshot = await persistSettings('PUT', payload);
      applySettings(snapshot || {});
      setStatus('Innstillingene er lagret.', 'success');
      if (settingsApi && typeof settingsApi.refresh === 'function') {
        try {
          settingsApi.refresh({ force: true, notify: true });
        } catch (_) {}
      }
      setFormDisabled(false);
    } catch (error) {
      console.error(error);
      setStatus('Kunne ikke lagre innstillingene.', 'error');
      setFormDisabled(false);
    }
  });

  if (settingsApi && typeof settingsApi.subscribe === 'function') {
    try {
      settingsApi.subscribe(snapshot => {
        if (!snapshot || typeof snapshot !== 'object') return;
        applySettings(snapshot);
        setStatus('Innstillingene er oppdatert.', 'info');
      });
    } catch (_) {}
  } else if (typeof window !== 'undefined' && typeof window.addEventListener === 'function') {
    window.addEventListener('math-visuals:settings-changed', event => {
      const detail = event && event.detail && event.detail.settings;
      if (detail && typeof detail === 'object') {
        applySettings(detail);
        setStatus('Innstillingene er oppdatert.', 'info');
      }
    });
  }

  applySettings({});
  loadSettings();
})();
