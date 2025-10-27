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
  const projectHeadingElement = document.querySelector('[data-project-heading]');
  const projectLegendElement = form.querySelector('[data-project-legend]');

  const MAX_COLORS = 12;
  const DEFAULT_LINE_THICKNESS = 3;
  const PROJECT_LABELS = {
    kikora: 'Kikora',
    campus: 'Campus',
    annet: 'Annet'
  };
  const PROJECT_HEADINGS = {
    kikora: 'Standardfarger for Kikora',
    campus: 'Standardfarger for Camus',
    annet: 'Standardfarger for Andre prosjekter'
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
    return label ? `Standardfarger for ${label}` : 'Standardfarger';
  }

  function updateProjectHeading(project) {
    const active = project ? normalizeProjectName(project) : ensureActiveProject();
    const headingText = resolveProjectHeading(active);
    if (projectHeadingElement) {
      projectHeadingElement.textContent = headingText;
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
    const thickness = clampLineThickness(lineInput && lineInput.value);
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
      state.colorsByProject.set(normalized, getProjectFallbackPalette(normalized));
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
    addCandidate(getApiActiveProject());
    addCandidate(state.activeProject);
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

  function commitActiveColors(next, projectName) {
    const project = projectName ? normalizeProjectName(projectName) : ensureActiveProject();
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
    const project = ensureActiveProject();
    updateProjectHeading(project);
    const palette = getActiveColors(project);
    commitActiveColors(palette, project);
    colorList.innerHTML = '';
    colors.forEach((color, index) => {
      colorList.appendChild(createColorItem(color, index));
    });
  }

  function applySettings(snapshot) {
    const data = snapshot && typeof snapshot === 'object' ? snapshot : {};
    state.projectOrder = Array.isArray(data.projectOrder)
      ? Array.from(new Set(data.projectOrder.map(normalizeProjectName))).filter(Boolean)
      : [];
    state.colorsByProject = new Map();
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
    state.activeProject = normalizeProjectName(data.activeProject);
    ensureActiveProject();
    updateProjectHeading(state.activeProject);
    state.defaultLineThickness =
      data.defaultLineThickness != null ? clampLineThickness(data.defaultLineThickness) : DEFAULT_LINE_THICKNESS;
    if (lineInput) {
      lineInput.value = state.defaultLineThickness;
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
