(function () {
  const SVG_NS = 'http://www.w3.org/2000/svg';
  const svg = document.getElementById('numberLineSvg');
  if (!svg) return;

  const fromInput = document.getElementById('cfg-from');
  const toInput = document.getElementById('cfg-to');
  const mainStepInput = document.getElementById('cfg-mainStep');
  const subdivisionsInput = document.getElementById('cfg-subdivisions');
  const numberTypeSelect = document.getElementById('cfg-numberType');
  const decimalDigitsInput = document.getElementById('cfg-decimalDigits');
  const btnSvg = document.getElementById('btnSvg');
  const btnPng = document.getElementById('btnPng');
  const exportCard = document.getElementById('exportCard');

  const STATE = window.STATE && typeof window.STATE === 'object' ? window.STATE : {};
  window.STATE = STATE;

  const DEFAULT_STATE = {
    from: 0,
    to: 10,
    mainStep: 1,
    subdivisions: 4,
    numberType: 'integer',
    decimalDigits: 1,
    altText: '',
    altTextSource: 'auto'
  };

  const integerFormatter = typeof Intl !== 'undefined' ? new Intl.NumberFormat('nb-NO', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  }) : null;
  const altNumberFormatter = typeof Intl !== 'undefined' ? new Intl.NumberFormat('nb-NO', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 6
  }) : null;
  const decimalFormatterCache = new Map();

  let altTextManager = null;
  let lastRenderSummary = null;

  function cloneState(source) {
    return JSON.parse(JSON.stringify(source));
  }

  function ensureStateDefaults() {
    const defaults = cloneState(DEFAULT_STATE);
    Object.keys(defaults).forEach(key => {
      if (!(key in STATE)) STATE[key] = defaults[key];
    });

    let from = Number(STATE.from);
    if (!Number.isFinite(from)) from = defaults.from;
    let to = Number(STATE.to);
    if (!Number.isFinite(to)) to = from + 10;

    if (to < from) {
      const swap = to;
      to = from;
      from = swap;
    }

    let mainStep = Number(STATE.mainStep);
    const range = Math.abs(to - from);
    if (!Number.isFinite(mainStep) || mainStep <= 0) {
      mainStep = range > 0 ? range / 4 : 1;
    }
    if (!Number.isFinite(mainStep) || mainStep <= 0) mainStep = 1;

    let subdivisions = Math.round(Number(STATE.subdivisions));
    if (!Number.isFinite(subdivisions) || subdivisions < 0) subdivisions = defaults.subdivisions;
    subdivisions = Math.min(Math.max(subdivisions, 0), 20);

    let numberType = STATE.numberType;
    if (numberType !== 'integer' && numberType !== 'decimal' && numberType !== 'fraction') {
      numberType = defaults.numberType;
    }

    let decimalDigits = Math.round(Number(STATE.decimalDigits));
    if (!Number.isFinite(decimalDigits) || decimalDigits < 0) {
      decimalDigits = defaults.decimalDigits;
    }
    decimalDigits = Math.min(Math.max(decimalDigits, 0), 6);

    if (typeof STATE.altText !== 'string') STATE.altText = '';
    STATE.altTextSource = STATE.altTextSource === 'manual' ? 'manual' : 'auto';

    STATE.from = from;
    STATE.to = to;
    STATE.mainStep = mainStep;
    STATE.subdivisions = subdivisions;
    STATE.numberType = numberType;
    STATE.decimalDigits = decimalDigits;
  }

  function getDecimalFormatter(digits) {
    const key = Math.min(Math.max(Math.round(Number(digits)) || 0, 0), 6);
    if (!decimalFormatterCache.has(key) && typeof Intl !== 'undefined') {
      decimalFormatterCache.set(key, new Intl.NumberFormat('nb-NO', {
        minimumFractionDigits: key,
        maximumFractionDigits: key
      }));
    }
    return decimalFormatterCache.get(key) || null;
  }

  function formatInteger(value) {
    if (!Number.isFinite(value)) return String(value);
    if (integerFormatter) return integerFormatter.format(Math.round(value));
    return String(Math.round(value));
  }

  function formatDecimal(value, digits) {
    if (!Number.isFinite(value)) return String(value);
    const formatter = getDecimalFormatter(digits);
    if (formatter) return formatter.format(value);
    return value.toFixed(Math.max(0, digits));
  }

  function gcd(a, b) {
    let x = Math.abs(a);
    let y = Math.abs(b);
    while (y) {
      const t = y;
      y = x % y;
      x = t;
    }
    return x || 1;
  }

  function approximateFraction(value, maxDenominator) {
    if (!Number.isFinite(value)) return null;
    if (value === 0) return { numerator: 0, denominator: 1 };
    const sign = value < 0 ? -1 : 1;
    let x = Math.abs(value);
    if (Math.abs(x - Math.round(x)) < 1e-10) {
      return { numerator: sign * Math.round(x), denominator: 1 };
    }
    let lowerN = 0;
    let lowerD = 1;
    let upperN = 1;
    let upperD = 0;
    let bestN = 1;
    let bestD = 1;
    const limit = Math.max(1, Math.floor(maxDenominator));
    for (let i = 0; i < 64; i++) {
      const mediantN = lowerN + upperN;
      const mediantD = lowerD + upperD;
      if (mediantD > limit) break;
      const mediant = mediantN / mediantD;
      bestN = mediantN;
      bestD = mediantD;
      if (Math.abs(mediant - x) <= 1e-9) break;
      if (mediant < x) {
        lowerN = mediantN;
        lowerD = mediantD;
      } else {
        upperN = mediantN;
        upperD = mediantD;
      }
    }
    const upperVal = upperN / upperD;
    const lowerVal = lowerN / lowerD;
    const upperDiff = Math.abs(upperVal - x);
    const lowerDiff = Math.abs(lowerVal - x);
    let chosenN = bestN;
    let chosenD = bestD;
    if (upperD <= limit && upperDiff < Math.abs(chosenN / chosenD - x)) {
      chosenN = upperN;
      chosenD = upperD;
    }
    if (lowerD <= limit && lowerDiff < Math.abs(chosenN / chosenD - x)) {
      chosenN = lowerN;
      chosenD = lowerD;
    }
    if (chosenD === 0) {
      chosenN = bestN;
      chosenD = bestD;
    }
    const divisor = gcd(chosenN, chosenD);
    return {
      numerator: sign * Math.round(chosenN / divisor),
      denominator: Math.round(chosenD / divisor)
    };
  }

  function formatFraction(value) {
    const maxDen = Math.pow(10, Math.min(Math.max(STATE.decimalDigits + 2, 1), 6));
    const approx = approximateFraction(value, maxDen);
    if (!approx) return formatDecimal(value, STATE.decimalDigits || 2);
    const { numerator, denominator } = approx;
    if (denominator === 1) return formatInteger(numerator);
    const absNum = Math.abs(numerator);
    const whole = Math.trunc(absNum / denominator);
    const remainder = absNum % denominator;
    const fractionText = `${remainder}⁄${denominator}`;
    if (whole === 0) {
      return numerator < 0 ? `-${fractionText}` : fractionText;
    }
    if (remainder === 0) {
      return formatInteger(numerator / denominator);
    }
    const wholeValue = numerator < 0 ? -whole : whole;
    return `${formatInteger(wholeValue)} ${fractionText}`;
  }

  function buildFractionDisplay(value) {
    const maxDen = Math.pow(10, Math.min(Math.max(STATE.decimalDigits + 2, 1), 6));
    const approx = approximateFraction(value, maxDen);
    if (!approx) {
      return { type: 'text', value: formatDecimal(value, STATE.decimalDigits || 2) };
    }
    const { numerator, denominator } = approx;
    if (denominator === 1) {
      return { type: 'text', value: formatInteger(numerator) };
    }
    const absNum = Math.abs(numerator);
    const whole = Math.trunc(absNum / denominator);
    const remainder = absNum % denominator;
    if (remainder === 0) {
      return { type: 'text', value: formatInteger(numerator / denominator) };
    }
    const fractionLatex = `\\frac{${remainder}}{${denominator}}`;
    if (whole === 0) {
      return {
        type: 'latex',
        value: `${numerator < 0 ? '-' : ''}${fractionLatex}`
      };
    }
    const wholeLatex = String(whole);
    const sign = numerator < 0 ? '-' : '';
    return {
      type: 'latex',
      value: `${sign}${wholeLatex}\\,${fractionLatex}`
    };
  }

  function formatLabel(value) {
    switch (STATE.numberType) {
      case 'decimal':
        return formatDecimal(value, STATE.decimalDigits);
      case 'fraction':
        return formatFraction(value);
      case 'integer':
      default:
        return formatInteger(value);
    }
  }

  function getLabelDisplay(value) {
    switch (STATE.numberType) {
      case 'decimal':
        return { type: 'text', value: formatDecimal(value, STATE.decimalDigits) };
      case 'fraction':
        return buildFractionDisplay(value);
      case 'integer':
      default:
        return { type: 'text', value: formatInteger(value) };
    }
  }

  function formatAltNumber(value) {
    if (!Number.isFinite(value)) return String(value);
    if (altNumberFormatter) return altNumberFormatter.format(value);
    return String(Math.round(value * 1e6) / 1e6);
  }

  function updateControlsFromState() {
    if (fromInput) fromInput.value = String(STATE.from);
    if (toInput) toInput.value = String(STATE.to);
    if (mainStepInput) mainStepInput.value = String(STATE.mainStep);
    if (subdivisionsInput) subdivisionsInput.value = String(STATE.subdivisions);
    if (numberTypeSelect) numberTypeSelect.value = STATE.numberType;
    if (decimalDigitsInput) {
      decimalDigitsInput.value = String(STATE.decimalDigits);
      decimalDigitsInput.disabled = STATE.numberType !== 'decimal';
    }
  }

  function mk(name, attrs) {
    const el = document.createElementNS(SVG_NS, name);
    if (attrs) {
      for (const [key, value] of Object.entries(attrs)) {
        if (value == null) continue;
        if (key === 'textContent') {
          el.textContent = value;
        } else {
          el.setAttribute(key, value);
        }
      }
    }
    return el;
  }

  function computeMajorValues(from, to, step) {
    const values = [];
    const epsilon = Math.max(Math.abs(step) * 1e-7, 1e-9);
    if (step > 0) {
      const span = Math.abs(to - from);
      const approxCount = span > 0 ? Math.floor(span / step) + 1 : 1;
      const maxIterations = Math.min(5000, approxCount + 2);
      for (let i = 0; i < maxIterations; i++) {
        const value = from + step * i;
        if (value > to + epsilon) break;
        values.push(Math.round(value * 1e9) / 1e9);
      }
    }
    if (!values.length || Math.abs(values[0] - from) > epsilon) {
      values.unshift(Math.round(from * 1e9) / 1e9);
    }
    const last = values[values.length - 1];
    if (Math.abs(last - to) > epsilon) {
      values.push(Math.round(to * 1e9) / 1e9);
    }
    return values;
  }

  function render() {
    ensureStateDefaults();
    updateControlsFromState();

    const { from, to, mainStep, subdivisions } = STATE;
    const majorValues = computeMajorValues(from, to, Math.max(mainStep, 1e-9));

    while (svg.firstChild) {
      svg.removeChild(svg.firstChild);
    }

    const paddingLeft = 0;
    const paddingRight = 0;
    const width = 1000;
    const baselineY = 140;
    const majorTickHeight = 32;
    const minorTickHeight = 18;
    const labelOffset = 52;
    const labelWidth = 140;
    const labelHeight = 48;
    const labelCenterY = baselineY + labelOffset;

    const span = to - from;
    const effectiveRange = Math.max(Math.abs(span), 1e-6);
    const margin = effectiveRange * 0.1 || Math.max(Math.abs(mainStep), 1);
    const domainMin = from - margin;
    const domainMax = to + margin;
    const innerWidth = width - paddingLeft - paddingRight;

    const mapValue = value => {
      if (domainMax === domainMin) return paddingLeft + innerWidth / 2;
      const ratio = (value - domainMin) / (domainMax - domainMin);
      return paddingLeft + ratio * innerWidth;
    };

    const axisGroup = mk('g');
    svg.appendChild(axisGroup);

    axisGroup.appendChild(mk('line', {
      x1: 0,
      y1: baselineY,
      x2: width,
      y2: baselineY,
      class: 'number-line-base'
    }));

    if (subdivisions > 0 && majorValues.length > 1) {
      for (let i = 0; i < majorValues.length - 1; i++) {
        const start = majorValues[i];
        const end = majorValues[i + 1];
        const delta = (end - start) / (subdivisions + 1);
        if (!Number.isFinite(delta) || delta <= 0) continue;
        for (let j = 1; j <= subdivisions; j++) {
          const value = start + delta * j;
          const x = mapValue(value);
          axisGroup.appendChild(mk('line', {
            x1: x,
            y1: baselineY - minorTickHeight,
            x2: x,
            y2: baselineY + minorTickHeight,
            class: 'minor-tick'
          }));
        }
      }
    }

    majorValues.forEach(value => {
      const x = mapValue(value);
      axisGroup.appendChild(mk('line', {
        x1: x,
        y1: baselineY - majorTickHeight,
        x2: x,
        y2: baselineY + majorTickHeight,
        class: 'major-tick'
      }));
      const labelDisplay = getLabelDisplay(value);
      const fallbackText = formatLabel(value);
      const labelFo = mk('foreignObject', {
        x: x - labelWidth / 2,
        y: labelCenterY - labelHeight / 2,
        width: labelWidth,
        height: labelHeight,
        class: 'major-label-fo'
      });
      const labelDiv = document.createElementNS('http://www.w3.org/1999/xhtml', 'div');
      labelDiv.className = 'major-label';
      if (fallbackText) {
        labelDiv.setAttribute('title', fallbackText);
      }
      renderLabelContent(labelDiv, labelDisplay, fallbackText);
      labelFo.appendChild(labelDiv);
      axisGroup.appendChild(labelFo);
    });

    lastRenderSummary = {
      from,
      to,
      mainStep,
      subdivisions,
      majorValues: majorValues.slice()
    };

    refreshAltText('render');
  }

  function renderLabelContent(target, display, fallbackText) {
    if (!target) return;
    const safeFallback = fallbackText != null ? String(fallbackText) : '';
    if (
      display &&
      display.type === 'latex' &&
      display.value &&
      typeof window !== 'undefined' &&
      window.katex &&
      typeof window.katex.render === 'function'
    ) {
      try {
        window.katex.render(display.value, target, { throwOnError: false });
        return;
      } catch (_) {}
    }
    const textValue = display && display.type === 'text' ? display.value : safeFallback;
    target.textContent = textValue != null ? String(textValue) : '';
  }

  function getNumberTypeLabel() {
    switch (STATE.numberType) {
      case 'decimal':
        return 'desimaltall';
      case 'fraction':
        return 'brøker';
      default:
        return 'heltall';
    }
  }

  function buildTallinjeAltText() {
    const summary = lastRenderSummary || {
      from: STATE.from,
      to: STATE.to,
      mainStep: STATE.mainStep,
      subdivisions: STATE.subdivisions,
      majorValues: computeMajorValues(STATE.from, STATE.to, Math.max(STATE.mainStep, 1e-9))
    };
    if (!summary || !Array.isArray(summary.majorValues) || !summary.majorValues.length) {
      return 'Tallinjen viser ingen markeringer.';
    }
    const { from, to, mainStep, subdivisions, majorValues } = summary;
    const typeLabel = getNumberTypeLabel();
    const parts = [];
    parts.push(`Tallinjen viser området fra ${formatAltNumber(from)} til ${formatAltNumber(to)}.`);
    const majorCount = majorValues.length;
    if (majorCount === 1) {
      parts.push('Det er én hovedmarkering.');
    } else {
      parts.push(`Det er ${majorCount} hovedmarkeringer med omtrent ${formatAltNumber(mainStep)} enhet mellom.`);
    }
    if (subdivisions > 0) {
      parts.push(`Hver hovedmarkering er delt i ${subdivisions} delmarkeringer.`);
    } else {
      parts.push('Ingen delmarkeringer er aktivert.');
    }
    parts.push(`Tallene vises som ${typeLabel}.`);
    return parts.join(' ');
  }

  function getTallinjeTitle() {
    const summary = lastRenderSummary;
    if (!summary || !Array.isArray(summary.majorValues)) return document.title || 'Tallinje';
    const count = summary.majorValues.length;
    const base = document.title || 'Tallinje';
    if (!count) return base;
    return `${base} – ${count} markering${count === 1 ? '' : 'er'}`;
  }

  function ensureAltTextManager() {
    if (altTextManager || typeof window === 'undefined' || !window.MathVisAltText || !exportCard) return;
    altTextManager = window.MathVisAltText.create({
      svg,
      container: exportCard,
      getTitle: getTallinjeTitle,
      getState: () => ({
        text: typeof STATE.altText === 'string' ? STATE.altText : '',
        source: STATE.altTextSource === 'manual' ? 'manual' : 'auto'
      }),
      setState: (text, source) => {
        STATE.altText = typeof text === 'string' ? text : '';
        STATE.altTextSource = source === 'manual' ? 'manual' : 'auto';
      },
      generate: () => buildTallinjeAltText(),
      getAutoMessage: reason => reason && reason.startsWith('manual') ? 'Alternativ tekst oppdatert.' : 'Alternativ tekst oppdatert automatisk.',
      getManualMessage: () => 'Alternativ tekst oppdatert manuelt.'
    });
    if (altTextManager) {
      altTextManager.applyCurrent();
    }
  }

  function refreshAltText(reason) {
    if (typeof window === 'undefined' || !window.MathVisAltText) return;
    ensureAltTextManager();
    if (altTextManager) {
      altTextManager.refresh(reason || 'auto');
    } else {
      const nodes = window.MathVisAltText.ensureSvgA11yNodes(svg);
      if (nodes && nodes.descEl) nodes.descEl.textContent = buildTallinjeAltText();
      if (nodes && nodes.titleEl) nodes.titleEl.textContent = getTallinjeTitle();
    }
  }

  function svgToString(svgEl) {
    const clone = svgEl.cloneNode(true);
    clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
    clone.setAttribute('xmlns:xlink', 'http://www.w3.org/1999/xlink');
    return '<?xml version="1.0" encoding="UTF-8"?>\n' + new XMLSerializer().serializeToString(clone);
  }

  function downloadSVG(svgEl, filename) {
    const data = svgToString(svgEl);
    const blob = new Blob([data], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename.endsWith('.svg') ? filename : `${filename}.svg`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  function downloadPNG(svgEl, filename, scale = 2, background = '#ffffff') {
    const vb = svgEl.viewBox.baseVal;
    const width = vb && vb.width ? vb.width : svgEl.clientWidth || 1000;
    const height = vb && vb.height ? vb.height : svgEl.clientHeight || 260;
    const data = svgToString(svgEl);
    const blob = new Blob([data], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = Math.round(width * scale);
      canvas.height = Math.round(height * scale);
      const ctx = canvas.getContext('2d');
      ctx.fillStyle = background;
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      URL.revokeObjectURL(url);
      canvas.toBlob(blobData => {
        if (!blobData) return;
        const pngUrl = URL.createObjectURL(blobData);
        const a = document.createElement('a');
        a.href = pngUrl;
        a.download = filename.endsWith('.png') ? filename : `${filename}.png`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        setTimeout(() => URL.revokeObjectURL(pngUrl), 1000);
      }, 'image/png');
    };
    img.src = url;
  }

  if (fromInput) {
    fromInput.addEventListener('input', () => {
      const value = Number(fromInput.value);
      if (!Number.isFinite(value)) return;
      STATE.from = value;
      render();
    });
  }

  if (toInput) {
    toInput.addEventListener('input', () => {
      const value = Number(toInput.value);
      if (!Number.isFinite(value)) return;
      STATE.to = value;
      render();
    });
  }

  if (mainStepInput) {
    mainStepInput.addEventListener('input', () => {
      const value = Number(mainStepInput.value);
      if (!Number.isFinite(value)) return;
      STATE.mainStep = value;
      render();
    });
  }

  if (subdivisionsInput) {
    subdivisionsInput.addEventListener('input', () => {
      const value = Number(subdivisionsInput.value);
      if (!Number.isFinite(value)) return;
      STATE.subdivisions = Math.max(0, Math.round(value));
      render();
    });
  }

  if (numberTypeSelect) {
    numberTypeSelect.addEventListener('change', () => {
      const value = numberTypeSelect.value;
      if (value === 'integer' || value === 'decimal' || value === 'fraction') {
        STATE.numberType = value;
        render();
      }
    });
  }

  if (decimalDigitsInput) {
    decimalDigitsInput.addEventListener('input', () => {
      const value = Number(decimalDigitsInput.value);
      if (!Number.isFinite(value)) return;
      STATE.decimalDigits = Math.max(0, Math.min(6, Math.round(value)));
      render();
    });
  }

  if (btnSvg) {
    btnSvg.addEventListener('click', () => downloadSVG(svg, 'tallinje.svg'));
  }

  if (btnPng) {
    btnPng.addEventListener('click', () => downloadPNG(svg, 'tallinje.png'));
  }

  if (typeof window !== 'undefined') {
    window.addEventListener('katexloaded', () => render());
  }

  window.render = render;

  ensureStateDefaults();
  render();
  ensureAltTextManager();

  const DEFAULT_TALLINJE_EXAMPLES = [{
    id: 'tallinje-1',
    exampleNumber: '1',
    isDefault: true,
    config: {
      STATE: {
        from: 0,
        to: 10,
        mainStep: 1,
        subdivisions: 4,
        numberType: 'integer',
        decimalDigits: 1,
        altText: '',
        altTextSource: 'auto'
      }
    }
  }, {
    id: 'tallinje-2',
    exampleNumber: '2',
    config: {
      STATE: {
        from: -2,
        to: 2,
        mainStep: 0.5,
        subdivisions: 2,
        numberType: 'decimal',
        decimalDigits: 1,
        altText: '',
        altTextSource: 'auto'
      }
    }
  }, {
    id: 'tallinje-3',
    exampleNumber: '3',
    config: {
      STATE: {
        from: 0,
        to: 2,
        mainStep: 0.5,
        subdivisions: 1,
        numberType: 'fraction',
        decimalDigits: 2,
        altText: '',
        altTextSource: 'auto'
      }
    }
  }];

  window.DEFAULT_EXAMPLES = DEFAULT_TALLINJE_EXAMPLES.map(example => ({
    ...example,
    config: {
      ...example.config,
      STATE: example.config && example.config.STATE ? cloneState(example.config.STATE) : undefined
    }
  }));
})();
