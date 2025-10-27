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
  const MAX_COLORS = 12;
  const FALLBACK_COLORS = ['#1F4DE2', '#475569', '#ef4444', '#0ea5e9', '#10b981', '#f59e0b'];
  const DEFAULT_LINE_THICKNESS = 3;

  function resolveSettingsApi() {
    if (typeof window === 'undefined') return null;
    const api = window.MathVisualsSettings;
    if (api && typeof api === 'object') return api;
    const legacy = window.mathVisuals && window.mathVisuals.settings;
    return legacy && typeof legacy === 'object' ? legacy : null;
  }
  const settingsApi = resolveSettingsApi();
  function fallbackSanitizeColor(value) {
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
  function sanitizeColor(value) {
    if (settingsApi && typeof settingsApi.sanitizeColor === 'function') {
      const sanitized = settingsApi.sanitizeColor(value);
      if (typeof sanitized === 'string' && sanitized) return sanitized;
    }
    return fallbackSanitizeColor(value);
  }
  function clampLineThickness(value) {
    const num = Number.parseFloat(value);
    if (!Number.isFinite(num)) {
      return DEFAULT_LINE_THICKNESS;
    }
    if (num < 1) return 1;
    if (num > 12) return 12;
    return Math.round(num);
  }
  function getFallbackPalette() {
    if (settingsApi && Array.isArray(settingsApi.fallbackColors) && settingsApi.fallbackColors.length) {
      return settingsApi.fallbackColors.slice();
    }
    return FALLBACK_COLORS.slice();
  }
  function getFallbackColorForIndex(index) {
    const palette = getFallbackPalette();
    if (!palette.length) return '#1F4DE2';
    return palette[index % palette.length] || palette[0];
  }
  let colors = [];
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
  function updateLinePreview() {
    if (!linePreviewBar) return;
    const thickness = clampLineThickness(lineInput && lineInput.value);
    linePreviewBar.style.setProperty('--preview-thickness', `${thickness}px`);
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
      const next = sanitizeColor(event.target.value) || color;
      colors[index] = next;
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
    colorList.innerHTML = '';
    if (!colors.length) {
      colors = [getFallbackColorForIndex(0)];
    }
    colors.forEach((color, index) => {
      const sanitized = sanitizeColor(color) || getFallbackColorForIndex(index);
      colors[index] = sanitized;
      colorList.appendChild(createColorItem(sanitized, index));
    });
  }
  function loadFromSettings() {
    let snapshot = null;
    if (settingsApi && typeof settingsApi.getSettings === 'function') {
      try {
        snapshot = settingsApi.getSettings();
      } catch (_) {}
    }
    if (!snapshot) {
      const stored = resolveSettingsSnapshot();
      if (stored) snapshot = stored;
    }
    const palette = snapshot && Array.isArray(snapshot.defaultColors) && snapshot.defaultColors.length
      ? snapshot.defaultColors.map(color => sanitizeColor(color)).filter(Boolean)
      : getFallbackPalette();
    colors = palette.length ? palette.slice(0, MAX_COLORS) : [getFallbackColorForIndex(0)];
    if (lineInput) {
      const fromSettings = snapshot && snapshot.defaultLineThickness;
      const thickness = clampLineThickness(fromSettings != null ? fromSettings : DEFAULT_LINE_THICKNESS);
      lineInput.value = thickness;
    }
    renderColors();
    updateLinePreview();
  }
  function resolveSettingsSnapshot() {
    if (settingsApi && typeof settingsApi.getSettings === 'function') {
      try {
        return settingsApi.getSettings();
      } catch (_) {}
    }
    if (typeof window === 'undefined' || !window.localStorage) return null;
    try {
      const raw = window.localStorage.getItem('mathVisuals:settings');
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      return parsed && typeof parsed === 'object' ? parsed : null;
    } catch (_) {
      return null;
    }
  }

  if (!settingsApi) {
    if (statusElement) {
      statusElement.dataset.status = 'error';
      statusElement.textContent = 'Kunne ikke laste innstillingene. Prøv å laste siden på nytt.';
    }
    if (form) {
      Array.from(form.elements).forEach(el => {
        el.disabled = true;
      });
    }
    return;
  }

  if (lineInput) {
    lineInput.addEventListener('input', () => {
      updateLinePreview();
      clearStatus();
    });
  }

  if (addColorButton) {
    addColorButton.addEventListener('click', () => {
      if (colors.length >= MAX_COLORS) {
        setStatus('Du kan ikke ha flere enn 12 standardfarger.', 'error');
        return;
      }
      const nextColor = getFallbackColorForIndex(colors.length) || colors[colors.length - 1] || '#1F4DE2';
      colors.push(nextColor);
      renderColors();
      clearStatus();
    });
  }

  if (resetButton) {
    resetButton.addEventListener('click', () => {
      try {
        if (typeof settingsApi.resetSettings === 'function') {
          settingsApi.resetSettings();
        } else if (typeof settingsApi.setSettings === 'function' && typeof settingsApi.defaults === 'function') {
          settingsApi.setSettings(settingsApi.defaults());
        }
        loadFromSettings();
        setStatus('Innstillingene ble tilbakestilt.', 'success');
      } catch (error) {
        console.error(error);
        setStatus('Kunne ikke tilbakestille innstillingene.', 'error');
      }
    });
  }

  form.addEventListener('submit', event => {
    event.preventDefault();
    const sanitizedColors = colors.map(color => sanitizeColor(color)).filter(Boolean).slice(0, MAX_COLORS);
    const thickness = clampLineThickness(lineInput && lineInput.value);
    try {
      if (typeof settingsApi.updateSettings === 'function') {
        settingsApi.updateSettings({
          defaultColors: sanitizedColors,
          defaultLineThickness: thickness
        });
      } else if (typeof settingsApi.setSettings === 'function') {
        const next = settingsApi.getSettings ? settingsApi.getSettings() : {};
        next.defaultColors = sanitizedColors;
        next.defaultLineThickness = thickness;
        settingsApi.setSettings(next);
      }
      loadFromSettings();
      setStatus('Innstillingene er lagret.', 'success');
    } catch (error) {
      console.error(error);
      setStatus('Kunne ikke lagre innstillingene.', 'error');
    }
  });

  window.addEventListener('math-visuals:settings-changed', event => {
    const detail = event && event.detail && event.detail.settings;
    if (detail) {
      const palette = Array.isArray(detail.defaultColors) ? detail.defaultColors : null;
      if (palette && palette.length) {
        colors = palette.map(color => sanitizeColor(color)).filter(Boolean).slice(0, MAX_COLORS);
      }
      if (lineInput && detail.defaultLineThickness != null) {
        lineInput.value = clampLineThickness(detail.defaultLineThickness);
      }
    }
    renderColors();
    updateLinePreview();
    setStatus('Innstillingene er oppdatert.', 'info');
  });

  loadFromSettings();
})();
