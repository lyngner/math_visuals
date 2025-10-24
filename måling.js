(function initMeasurementApp() {
  const board = document.querySelector('[data-board]');
  const ruler = board ? board.querySelector('[data-ruler]') : null;
  if (!board || !ruler) {
    return;
  }

  const rulerSvg = ruler.querySelector('[data-ruler-svg]');
  const statusNote = document.querySelector('[data-status-note]');
  const descriptionField = document.getElementById('exampleDescription');
  const btnSvg = document.getElementById('btnSvg');
  const controls = {
    length: document.getElementById('cfg-length'),
    subdivisions: document.getElementById('cfg-subdivisions'),
    unitLabel: document.getElementById('cfg-unit'),
    figureLabel: document.getElementById('cfg-figure-label'),
    figureImage: document.getElementById('cfg-figure-image')
  };
  const numberFormatter = typeof Intl !== 'undefined' ? new Intl.NumberFormat('nb-NO') : null;

  const state = {
    x: 0,
    y: 0,
    rotation: 0
  };

  let currentSettings = null;
  let isUpdatingControls = false;

  const activePointers = new Map();
  let boardRect = board.getBoundingClientRect();
  const baseSize = {
    width: ruler.offsetWidth,
    height: ruler.offsetHeight
  };

  initializeRuler();
  setupControls();
  setupExport();

  function applyTransform() {
    ruler.style.transform = `translate3d(${state.x}px, ${state.y}px, 0) rotate(${state.rotation}rad)`;
  }

  function centerRuler() {
    boardRect = board.getBoundingClientRect();
    baseSize.width = ruler.offsetWidth;
    baseSize.height = ruler.offsetHeight;
    const offsetX = (boardRect.width - baseSize.width) / 2;
    const offsetY = Math.max(boardRect.height - baseSize.height - 32, 16);
    state.x = offsetX;
    state.y = offsetY;
    state.rotation = 0;
    applyTransform();
  }

  centerRuler();

  function normalizeAngle(angle) {
    const twoPi = Math.PI * 2;
    let value = angle;
    while (value <= -Math.PI) value += twoPi;
    while (value > Math.PI) value -= twoPi;
    return value;
  }

  function updateFromSinglePointer(pointerEntry) {
    const dx = pointerEntry.clientX - pointerEntry.prevX;
    const dy = pointerEntry.clientY - pointerEntry.prevY;
    if (!Number.isFinite(dx) || !Number.isFinite(dy)) {
      return;
    }
    state.x += dx;
    state.y += dy;
    applyTransform();
  }

  function updateFromGesture(currentEntry) {
    const pointers = Array.from(activePointers.values());
    if (pointers.length === 0) {
      return;
    }
    if (pointers.length === 1) {
      updateFromSinglePointer(currentEntry);
      return;
    }

    const [p1, p2] = pointers;
    const prevPoints = [
      { x: p1 === currentEntry ? currentEntry.prevX : p1.clientX, y: p1 === currentEntry ? currentEntry.prevY : p1.clientY },
      { x: p2 === currentEntry ? currentEntry.prevX : p2.clientX, y: p2 === currentEntry ? currentEntry.prevY : p2.clientY }
    ];
    const nextPoints = [
      { x: p1.clientX, y: p1.clientY },
      { x: p2.clientX, y: p2.clientY }
    ];

    const prevCenter = {
      x: (prevPoints[0].x + prevPoints[1].x) / 2,
      y: (prevPoints[0].y + prevPoints[1].y) / 2
    };
    const nextCenter = {
      x: (nextPoints[0].x + nextPoints[1].x) / 2,
      y: (nextPoints[0].y + nextPoints[1].y) / 2
    };

    const prevAngle = Math.atan2(prevPoints[1].y - prevPoints[0].y, prevPoints[1].x - prevPoints[0].x);
    const nextAngle = Math.atan2(nextPoints[1].y - nextPoints[0].y, nextPoints[1].x - nextPoints[0].x);

    state.x += nextCenter.x - prevCenter.x;
    state.y += nextCenter.y - prevCenter.y;
    state.rotation = normalizeAngle(state.rotation + normalizeAngle(nextAngle - prevAngle));
    applyTransform();
  }

  function handlePointerDown(event) {
    if (event.button && event.button !== 0) {
      return;
    }
    if (activePointers.size >= 2 && !activePointers.has(event.pointerId)) {
      return;
    }
    event.preventDefault();
    const entry = {
      pointerId: event.pointerId,
      clientX: event.clientX,
      clientY: event.clientY,
      prevX: event.clientX,
      prevY: event.clientY
    };
    activePointers.set(event.pointerId, entry);
    try {
      ruler.setPointerCapture(event.pointerId);
    } catch (_) {}
  }

  function handlePointerMove(event) {
    const entry = activePointers.get(event.pointerId);
    if (!entry) {
      return;
    }
    entry.prevX = entry.clientX;
    entry.prevY = entry.clientY;
    entry.clientX = event.clientX;
    entry.clientY = event.clientY;
    updateFromGesture(entry);
  }

  function handlePointerEnd(event) {
    const entry = activePointers.get(event.pointerId);
    if (!entry) {
      return;
    }
    activePointers.delete(event.pointerId);
    try {
      ruler.releasePointerCapture(event.pointerId);
    } catch (_) {}
  }

  function handleResize() {
    const prevRect = boardRect;
    boardRect = board.getBoundingClientRect();
    const widthChanged = !prevRect || Math.abs(boardRect.width - prevRect.width) > 1;
    const heightChanged = !prevRect || Math.abs(boardRect.height - prevRect.height) > 1;
    baseSize.width = ruler.offsetWidth;
    baseSize.height = ruler.offsetHeight;

    if (activePointers.size === 0 && (widthChanged || heightChanged)) {
      centerRuler();
      return;
    }

    const maxX = boardRect.width;
    const maxY = boardRect.height;
    state.x = Math.min(Math.max(state.x, -maxX), maxX);
    state.y = Math.min(Math.max(state.y, -maxY), maxY);
    applyTransform();
  }

  function initializeRuler() {
    const settings = normalizeSettings();
    applySettings(settings);
  }

  function normalizeSettings(overrides = {}) {
    const defaults = {
      length: 10,
      subdivisions: 10,
      unitLabel: 'cm',
      figureLabel: 'Kylling',
      figureImage: 'images/measure/kylling%20(7cm_7cm)%201_1.svg'
    };

    const globalScope = typeof window !== 'undefined' ? window : null;
    const globalCfg = globalScope && typeof globalScope.CFG === 'object' && globalScope.CFG ? globalScope.CFG : {};
    if (globalScope && (!globalScope.CFG || typeof globalScope.CFG !== 'object')) {
      globalScope.CFG = globalCfg;
    }
    const cfgTarget =
      globalCfg && typeof globalCfg.measurement === 'object' && globalCfg.measurement ? globalCfg.measurement : globalCfg;

    const resolveNumber = value => {
      if (Number.isFinite(value)) {
        return value;
      }
      const parsed = Number.parseFloat(value);
      return Number.isFinite(parsed) ? parsed : NaN;
    };

    const lengthRaw = resolveNumber(
      overrides.length ?? cfgTarget.length ?? cfgTarget.rulerLength ?? cfgTarget.maxValue
    );
    const subdivisionsRaw = resolveNumber(
      overrides.subdivisions ?? cfgTarget.subdivisions ?? cfgTarget.marksBetween ?? cfgTarget.minorTicks
    );
    const unitRaw = typeof (overrides.unitLabel ?? cfgTarget.unitLabel) === 'string'
      ? (overrides.unitLabel ?? cfgTarget.unitLabel).trim()
      : '';
    const figureLabelRaw = typeof (overrides.figureLabel ?? cfgTarget.figureLabel) === 'string'
      ? (overrides.figureLabel ?? cfgTarget.figureLabel).trim()
      : '';
    const figureImageRaw = typeof (overrides.figureImage ?? cfgTarget.figureImage) === 'string'
      ? (overrides.figureImage ?? cfgTarget.figureImage).trim()
      : '';

    let length = Number.isFinite(lengthRaw) ? Math.round(lengthRaw) : defaults.length;
    if (!(length >= 1)) length = defaults.length;
    length = Math.min(100, Math.max(1, length));

    let subdivisions = Number.isFinite(subdivisionsRaw) ? Math.round(subdivisionsRaw) : defaults.subdivisions;
    if (!(subdivisions >= 0)) subdivisions = defaults.subdivisions;
    subdivisions = Math.min(20, Math.max(0, subdivisions));

    let unitLabel = unitRaw || defaults.unitLabel;
    let figureLabel = figureLabelRaw || defaults.figureLabel;
    let figureImage = figureImageRaw || defaults.figureImage;

    if (cfgTarget) {
      cfgTarget.length = length;
      cfgTarget.subdivisions = subdivisions;
      cfgTarget.unitLabel = unitLabel;
      cfgTarget.figureLabel = figureLabel;
      cfgTarget.figureImage = figureImage;
    }

    return { length, subdivisions, unitLabel, figureLabel, figureImage };
  }

  function applySettings(settings, options = {}) {
    currentSettings = settings;
    renderRuler(settings);
    updateAccessibility(settings);
    applyBoardAppearance(settings);
    if (!options || options.skipControlUpdate !== true) {
      updateControls(settings);
    }
  }

  function renderRuler(settings) {
    if (!rulerSvg) {
      return;
    }

    const { length, subdivisions } = settings;

    const inset = 8;
    const marginLeft = 44;
    const marginRight = 44;
    const unitSpacing = 60;
    const totalHeight = 120;
    const baselineY = inset + 26;
    const majorTickLength = (totalHeight - inset - 20 - baselineY) / 2;
    const majorTickBottom = baselineY + majorTickLength;
    const minorTickBottom = baselineY + majorTickLength * 0.58;
    const labelY = majorTickBottom + 24;
    const contentWidth = marginLeft + marginRight + unitSpacing * length;

    const baselineStartX = marginLeft;
    const baselineEndX = contentWidth - marginRight;

    const majorTickMarkup = Array.from({ length: length + 1 }, (_, index) => {
      const x = marginLeft + unitSpacing * index;
      return `<line x1="${x}" y1="${baselineY}" x2="${x}" y2="${majorTickBottom}" class="ruler-svg__tick ruler-svg__tick--major" />`;
    }).join('');

    let minorTickMarkup = '';
    if (subdivisions > 1) {
      const step = unitSpacing / subdivisions;
      for (let unitIndex = 0; unitIndex < length; unitIndex += 1) {
        const unitStart = marginLeft + unitSpacing * unitIndex;
        for (let subIndex = 1; subIndex < subdivisions; subIndex += 1) {
          const x = unitStart + step * subIndex;
          minorTickMarkup += `<line x1="${x}" y1="${baselineY}" x2="${x}" y2="${minorTickBottom}" class="ruler-svg__tick ruler-svg__tick--minor" />`;
        }
      }
    }

    const labelMarkup = Array.from({ length: length + 1 }, (_, index) => {
      const x = marginLeft + unitSpacing * index;
      const anchor = index === 0 ? 'start' : index === length ? 'end' : 'middle';
      const dx = anchor === 'start' ? -6 : anchor === 'end' ? 6 : 0;
      const labelText = formatNumber(index);
      return `<text x="${x}" y="${labelY}" text-anchor="${anchor}"${dx !== 0 ? ` dx="${dx}"` : ''} class="ruler-svg__label">${labelText}</text>`;
    }).join('');

    rulerSvg.setAttribute('viewBox', `0 0 ${contentWidth} ${totalHeight}`);
    rulerSvg.innerHTML = `
      <rect x="8" y="8" width="${contentWidth - 16}" height="${totalHeight - 16}" rx="18" ry="18" class="ruler-svg__background" />
      <line x1="${baselineStartX}" y1="${baselineY}" x2="${baselineEndX}" y2="${baselineY}" class="ruler-svg__baseline" />
      ${minorTickMarkup}
      ${majorTickMarkup}
      ${labelMarkup}
    `;

    ruler.style.setProperty('--ruler-width', `${contentWidth}px`);
    ruler.style.setProperty('--ruler-height', `${totalHeight}px`);
  }

  function updateAccessibility(settings) {
    const { length, unitLabel, figureLabel } = settings;
    const formattedLength = formatNumber(length);
    const unitText = unitLabel ? ` ${unitLabel}` : '';
    const trimmedFigure = typeof figureLabel === 'string' ? figureLabel.trim() : '';
    const figureText = trimmedFigure || 'figuren';
    const figureSuffix = trimmedFigure ? ` for å måle ${trimmedFigure}` : '';
    ruler.setAttribute('aria-label', `Flyttbar linjal på ${formattedLength}${unitText}${figureSuffix}`);
    if (statusNote) {
      const suffix = unitLabel ? ` ${unitLabel}` : '';
      statusNote.textContent = `Linjalens lengde er ${formattedLength}${suffix}. Bruk den til å måle ${figureText}.`;
    }
  }

  function applyBoardAppearance(settings) {
    const figureLabel = typeof settings.figureLabel === 'string' ? settings.figureLabel.trim() : '';
    board.dataset.figureLabel = figureLabel;
    const figureImage = typeof settings.figureImage === 'string' ? settings.figureImage.trim() : '';
    const url = figureImage ? `url("${escapeForCssUrl(figureImage)}")` : 'none';
    board.style.setProperty('--figure-image', url);
  }

  function formatNumber(value) {
    if (numberFormatter) {
      return numberFormatter.format(value);
    }
    return String(value);
  }

  function escapeForCssUrl(value) {
    return String(value)
      .replace(/\\/g, '\\\\')
      .replace(/"/g, '\\"')
      .replace(/'/g, "\\'")
      .replace(/[\n\r\f]/g, ' ')
      .replace(/\u0000/g, '');
  }

  function setupControls() {
    const inputs = Object.values(controls).filter(Boolean);
    if (!inputs.length) {
      return;
    }
    inputs.forEach(input => {
      input.addEventListener('change', handleControlInput);
      input.addEventListener('input', handleControlInput);
    });
    if (currentSettings) {
      updateControls(currentSettings);
    }
  }

  function updateControls(settings) {
    isUpdatingControls = true;
    try {
      if (controls.length) {
        controls.length.value = settings.length;
      }
      if (controls.subdivisions) {
        controls.subdivisions.value = settings.subdivisions;
      }
      if (controls.unitLabel) {
        controls.unitLabel.value = settings.unitLabel;
      }
      if (controls.figureLabel) {
        controls.figureLabel.value = settings.figureLabel;
      }
      if (controls.figureImage) {
        controls.figureImage.value = settings.figureImage;
      }
    } finally {
      isUpdatingControls = false;
    }
  }

  function handleControlInput() {
    if (isUpdatingControls) {
      return;
    }
    const overrides = readControlValues();
    const settings = normalizeSettings(overrides);
    applySettings(settings);
  }

  function readControlValues() {
    const lengthValue = controls.length ? controls.length.value : undefined;
    const subdivisionsValue = controls.subdivisions ? controls.subdivisions.value : undefined;
    const unitValue = controls.unitLabel ? controls.unitLabel.value : undefined;
    const figureLabelValue = controls.figureLabel ? controls.figureLabel.value : undefined;
    const figureImageValue = controls.figureImage ? controls.figureImage.value : undefined;
    return {
      length: lengthValue,
      subdivisions: subdivisionsValue,
      unitLabel: unitValue,
      figureLabel: figureLabelValue,
      figureImage: figureImageValue
    };
  }

  function setupExport() {
    if (!btnSvg || !rulerSvg) {
      return;
    }
    btnSvg.addEventListener('click', () => {
      downloadSvg(rulerSvg).catch(error => {
        console.error('Kunne ikke eksportere SVG:', error);
      });
    });
  }

  async function downloadSvg(svgElement) {
    if (!svgElement) return;
    const helper = typeof window !== 'undefined' ? window.MathVisSvgExport : null;
    const description = descriptionField && typeof descriptionField.value === 'string' ? descriptionField.value : '';
    const figureLabel = currentSettings && currentSettings.figureLabel ? currentSettings.figureLabel : 'måling';
    const summary = figureLabel ? `Linjal for ${figureLabel}` : 'Linjal';
    if (helper && typeof helper.exportSvgWithArchive === 'function') {
      const baseName = helper.slugify ? helper.slugify(figureLabel, 'måling') : figureLabel;
      await helper.exportSvgWithArchive(svgElement, figureLabel, 'måling', {
        description,
        defaultBaseName: baseName || 'måling',
        summary
      });
      return;
    }
    const serializer = new XMLSerializer();
    const source = serializer.serializeToString(svgElement);
    const blob = new Blob([source], { type: 'image/svg+xml;charset=utf-8' });
    const urlApi = typeof URL !== 'undefined' ? URL : window.URL;
    const url = urlApi.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    const fileBase = (figureLabel || 'måling').toLowerCase().replace(/[^a-z0-9]+/gi, '-').replace(/^-+|-+$/g, '') || 'måling';
    anchor.download = `${fileBase}.svg`;
    anchor.style.display = 'none';
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    setTimeout(() => {
      try {
        urlApi.revokeObjectURL(url);
      } catch (_) {}
    }, 0);
  }

  ruler.addEventListener('pointerdown', handlePointerDown, { passive: false });
  ruler.addEventListener('pointermove', handlePointerMove);
  ruler.addEventListener('pointerup', handlePointerEnd);
  ruler.addEventListener('pointercancel', handlePointerEnd);
  ruler.addEventListener('lostpointercapture', event => {
    if (event.pointerId != null) {
      activePointers.delete(event.pointerId);
    }
  });

  board.addEventListener('dblclick', event => {
    event.preventDefault();
    if (activePointers.size === 0) {
      centerRuler();
    }
  });

  window.addEventListener('resize', handleResize);
})();
