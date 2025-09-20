(() => {
  const svg = document.getElementById('chart');
  const overlay = document.getElementById('chartOverlay');
  const exprInput = document.getElementById('exprInput');
  const btnGenerate = document.getElementById('btnGenerate');
  const btnCheck = document.getElementById('btnCheck');
  const btnAddPoint = document.getElementById('btnAddPoint');
  const btnAddRow = document.getElementById('btnAddRow');
  const overlayAddPoint = document.getElementById('overlayAddPoint');
  const overlayAddRow = document.getElementById('overlayAddRow');
  const pointsList = document.getElementById('pointsList');
  const rowsList = document.getElementById('rowsList');
  const autoSyncInput = document.getElementById('autoSync');
  const domainMinInput = document.getElementById('domainMin');
  const domainMaxInput = document.getElementById('domainMax');
  const decimalPlacesInput = document.getElementById('decimalPlaces');
  const checkStatus = document.getElementById('checkStatus');
  if (!svg || !exprInput) {
    return;
  }
  const DEFAULT_AUTO_DOMAIN = {
    min: -5,
    max: 5
  };
  const state = {
    expression: '',
    autoSync: false,
    criticalPoints: [],
    signRows: [],
    solution: null,
    domain: {
      min: null,
      max: null
    },
    autoDomain: { ...DEFAULT_AUTO_DOMAIN },
    decimalPlaces: 4
  };
  let pointIdCounter = 1;
  let rowIdCounter = 1;
  let currentScale = null;
  let dragging = null;
  const MIN_DECIMAL_PLACES = 0;
  const MAX_DECIMAL_PLACES = 6;
  function clampDecimalPlaces(value) {
    if (!Number.isFinite(value)) {
      return MIN_DECIMAL_PLACES;
    }
    return Math.min(MAX_DECIMAL_PLACES, Math.max(MIN_DECIMAL_PLACES, Math.round(value)));
  }
  function getDecimalPlaces() {
    return clampDecimalPlaces(state.decimalPlaces);
  }
  function getNumberStep() {
    const decimals = getDecimalPlaces();
    if (decimals <= 0) {
      return '1';
    }
    return (1 / Math.pow(10, decimals)).toString();
  }
  state.decimalPlaces = clampDecimalPlaces(state.decimalPlaces);
  function formatPointValue(value) {
    if (!Number.isFinite(value)) {
      return '';
    }
    const decimals = getDecimalPlaces();
    const rounded = Number.parseFloat(value.toFixed(decimals));
    if (!Number.isFinite(rounded)) {
      return `${value}`;
    }
    if (Object.is(rounded, -0)) {
      return '0';
    }
    return `${rounded}`;
  }
  function createDefaultRow() {
    if (!state.signRows.length) {
      state.signRows.push({
        id: `row-${rowIdCounter++}`,
        label: 'f(x)',
        segments: [1]
      });
    }
  }
  function sortPoints() {
    state.criticalPoints.sort((a, b) => a.value - b.value);
  }
  function syncSegments() {
    const expected = state.criticalPoints.length + 1;
    state.signRows.forEach(row => {
      if (!Array.isArray(row.segments)) {
        row.segments = [];
      }
      if (expected <= 0) {
        row.segments = [1];
        return;
      }
      if (row.segments.length === 0) {
        row.segments = Array(expected).fill(1);
      } else if (row.segments.length > expected) {
        row.segments = row.segments.slice(0, expected);
      } else if (row.segments.length < expected) {
        var _row$segments;
        const last = (_row$segments = row.segments[row.segments.length - 1]) !== null && _row$segments !== void 0 ? _row$segments : 1;
        while (row.segments.length < expected) {
          row.segments.push(last);
        }
      }
    });
    if (!state.signRows.length) {
      createDefaultRow();
    }
  }
  function sanitizeExpression(raw) {
    if (!raw) return '';
    let expr = raw.replace(/,/g, '.').replace(/\s+/g, '');
    expr = expr.toLowerCase();
    expr = expr.replace(/([0-9x)])\(/g, '$1*(');
    expr = expr.replace(/\)([0-9x])/g, ')*$1');
    expr = expr.replace(/(x)([0-9])/g, '$1*$2');
    expr = expr.replace(/([0-9])(x)/g, '$1*$2');
    expr = expr.replace(/\^/g, '**');
    return expr;
  }
  function createSafeFunction(expr) {
    try {
      return new Function('x', `with(Math){return ${expr};}`);
    } catch (err) {
      return null;
    }
  }
  function stripOuterParens(str) {
    let result = str.trim();
    while (result.startsWith('(') && result.endsWith(')')) {
      let depth = 0;
      let balanced = true;
      for (let i = 0; i < result.length; i += 1) {
        const ch = result[i];
        if (ch === '(') depth += 1;else if (ch === ')') {
          depth -= 1;
          if (depth === 0 && i < result.length - 1) {
            balanced = false;
            break;
          }
          if (depth < 0) {
            balanced = false;
            break;
          }
        }
      }
      if (balanced && depth === 0) {
        result = result.slice(1, -1).trim();
      } else {
        break;
      }
    }
    return result;
  }
  function splitByMultiplication(str) {
    const parts = [];
    let current = '';
    let depth = 0;
    for (let i = 0; i < str.length; i += 1) {
      const ch = str[i];
      if (ch === '(') {
        depth += 1;
        current += ch;
        continue;
      }
      if (ch === ')') {
        depth -= 1;
        current += ch;
        continue;
      }
      if (ch === '*' && depth === 0) {
        if (str[i + 1] === '*') {
          current += '**';
          i += 1;
          continue;
        }
        parts.push(current);
        current = '';
        continue;
      }
      current += ch;
    }
    if (current) parts.push(current);
    return parts;
  }
  function evaluateConstant(expr) {
    const fn = createSafeFunction(expr);
    if (!fn) return null;
    try {
      const v0 = fn(0);
      const v1 = fn(1);
      if (!Number.isFinite(v0) || !Number.isFinite(v1)) return null;
      if (Math.abs(v0 - v1) > 1e-6) return null;
      if (Math.abs(v0) < 1e-10) return 0;
      return v0;
    } catch (err) {
      return null;
    }
  }
  function parseLinearFactor(segment) {
    let str = segment.trim();
    if (!str) return null;
    let exponent = 1;
    const expMatch = str.match(/^(.*?)(?:\*\*|\^)(-?\d+)$/);
    if (expMatch) {
      exponent = parseInt(expMatch[2], 10);
      if (!Number.isFinite(exponent) || exponent < 1) exponent = 1;
      str = expMatch[1];
    }
    str = stripOuterParens(str);
    if (!/x/.test(str)) {
      return null;
    }
    const fn = createSafeFunction(str);
    if (!fn) return null;
    try {
      const f0 = fn(0);
      const f1 = fn(1);
      if (!Number.isFinite(f0) || !Number.isFinite(f1)) return null;
      const slope = f1 - f0;
      if (Math.abs(slope) < 1e-9) return null;
      const intercept = f0;
      const root = -intercept / slope;
      if (!Number.isFinite(root)) return null;
      const sign = slope >= 0 ? 1 : -1;
      return {
        root,
        multiplicity: exponent,
        sign
      };
    } catch (err) {
      return null;
    }
  }
  function parseProduct(value) {
    let str = stripOuterParens(value);
    if (!str) {
      return {
        factors: [],
        constantSign: 1
      };
    }
    const parts = splitByMultiplication(str);
    const factors = [];
    let constantSign = 1;
    for (const part of parts) {
      const clean = stripOuterParens(part);
      if (!clean) continue;
      const factor = parseLinearFactor(clean);
      if (factor) {
        factors.push({
          value: factor.root,
          multiplicity: factor.multiplicity
        });
        if (factor.sign < 0 && factor.multiplicity % 2 === 1) {
          constantSign *= -1;
        }
      } else {
        const constant = evaluateConstant(clean);
        if (constant === null) {
          throw new Error(`Kan ikke tolke faktor '${part}'`);
        }
        if (constant < 0) {
          constantSign *= -1;
        }
      }
    }
    return {
      factors,
      constantSign
    };
  }
  function tokenizeExpression(expr) {
    const tokens = [];
    let current = '';
    let depth = 0;
    let currentOp = '*';
    for (let i = 0; i < expr.length; i += 1) {
      const ch = expr[i];
      if (ch === '(') {
        depth += 1;
        current += ch;
        continue;
      }
      if (ch === ')') {
        depth -= 1;
        current += ch;
        continue;
      }
      if ((ch === '*' || ch === '/') && depth === 0) {
        if (ch === '*' && expr[i + 1] === '*') {
          current += '**';
          i += 1;
          continue;
        }
        tokens.push({
          operator: currentOp,
          value: current
        });
        current = '';
        currentOp = ch;
        continue;
      }
      current += ch;
    }
    tokens.push({
      operator: currentOp,
      value: current
    });
    return tokens.filter(token => token.value !== '');
  }
  function extractStructure(expr) {
    const tokens = tokenizeExpression(expr);
    const zeros = [];
    const poles = [];
    let constantSign = 1;
    tokens.forEach(token => {
      const parsed = parseProduct(token.value);
      const destination = token.operator === '/' ? poles : zeros;
      parsed.factors.forEach(factor => {
        destination.push({
          value: factor.value,
          multiplicity: factor.multiplicity
        });
      });
      if (parsed.constantSign < 0) {
        constantSign *= -1;
      }
    });
    return {
      zeros,
      poles,
      constantSign
    };
  }
  function buildPoints(structure) {
    const map = new Map();
    function addEntries(entries, type) {
      entries.forEach(entry => {
        const normalized = Number.parseFloat(Number(entry.value).toFixed(6));
        const key = `${type}:${normalized}`;
        if (map.has(key)) {
          map.get(key).multiplicity += entry.multiplicity;
        } else {
          map.set(key, {
            value: normalized,
            type,
            multiplicity: entry.multiplicity
          });
        }
      });
    }
    addEntries(structure.zeros, 'zero');
    addEntries(structure.poles, 'pole');
    return Array.from(map.values()).sort((a, b) => a.value - b.value);
  }
  function computeAutoDomain(points) {
    if (!points.length) {
      state.autoDomain = { ...DEFAULT_AUTO_DOMAIN };
      return state.autoDomain;
    }
    const values = points.map(p => p.value).filter(value => Number.isFinite(value));
    if (!values.length) {
      state.autoDomain = { ...DEFAULT_AUTO_DOMAIN };
      return state.autoDomain;
    }
    const minValue = Math.min(...values);
    const maxValue = Math.max(...values);
    if (values.length === 1) {
      const value = values[0];
      const prevMin = state.autoDomain && Number.isFinite(state.autoDomain.min) ? state.autoDomain.min : value - 2;
      const prevMax = state.autoDomain && Number.isFinite(state.autoDomain.max) ? state.autoDomain.max : value + 2;
      let min = prevMin;
      let max = prevMax;
      if (!(max > min)) {
        const span = 4;
        min = value - span / 2;
        max = value + span / 2;
      }
      const span = Math.max(max - min, 1e-6);
      const margin = Math.max(span * 0.2, 1);
      if (value < min + margin) {
        const shift = min + margin - value;
        min -= shift;
        max -= shift;
      } else if (value > max - margin) {
        const shift = value - (max - margin);
        min += shift;
        max += shift;
      }
      state.autoDomain = {
        min,
        max
      };
      return state.autoDomain;
    }
    let min = minValue;
    let max = maxValue;
    if (Math.abs(max - min) < 1e-6) {
      min -= 1;
      max += 1;
    }
    const span = max - min;
    const margin = Math.max(span * 0.2, 1);
    state.autoDomain = {
      min: min - margin,
      max: max + margin
    };
    return state.autoDomain;
  }
  function getDomainInfo() {
    const auto = computeAutoDomain(state.criticalPoints);
    const overrideMin = Number.isFinite(state.domain.min) ? state.domain.min : null;
    const overrideMax = Number.isFinite(state.domain.max) ? state.domain.max : null;
    let min = overrideMin ?? auto.min;
    let max = overrideMax ?? auto.max;
    const invalid = {
      min: false,
      max: false
    };
    if (!(max > min)) {
      const span = Math.max(auto.max - auto.min, 2);
      if (overrideMin != null && overrideMax != null) {
        invalid.min = true;
        invalid.max = true;
        const center = (overrideMin + overrideMax) / 2 || overrideMin || overrideMax || 0;
        min = center - span / 2;
        max = center + span / 2;
      } else if (overrideMin != null) {
        min = overrideMin;
        max = overrideMin + span;
      } else if (overrideMax != null) {
        max = overrideMax;
        min = overrideMax - span;
      } else {
        const center = (min + max) / 2 || 0;
        min = center - span / 2;
        max = center + span / 2;
      }
    }
    if (!Number.isFinite(min) || !Number.isFinite(max)) {
      min = auto.min;
      max = auto.max;
    }
    if (Math.abs(max - min) < 1e-6) {
      const center = (max + min) / 2;
      min = center - 1;
      max = center + 1;
    }
    return {
      auto,
      override: {
        min: overrideMin,
        max: overrideMax
      },
      active: {
        min,
        max
      },
      invalid
    };
  }
  function renderDomainControls(domainInfo) {
    if (!domainMinInput || !domainMaxInput) return;
    const info = domainInfo || getDomainInfo();
    const step = getNumberStep();
    domainMinInput.step = step;
    domainMaxInput.step = step;
    const minValue = info.override.min != null ? info.override.min : info.auto.min;
    const maxValue = info.override.max != null ? info.override.max : info.auto.max;
    if (document.activeElement !== domainMinInput) {
      domainMinInput.value = formatPointValue(minValue);
    }
    if (document.activeElement !== domainMaxInput) {
      domainMaxInput.value = formatPointValue(maxValue);
    }
    domainMinInput.placeholder = formatPointValue(info.auto.min);
    domainMaxInput.placeholder = formatPointValue(info.auto.max);
    domainMinInput.classList.toggle('input-invalid', info.invalid.min);
    domainMaxInput.classList.toggle('input-invalid', info.invalid.max);
  }
  function tryEvaluate(fn, x) {
    try {
      const value = fn(x);
      if (!Number.isFinite(value)) return NaN;
      return value;
    } catch (err) {
      return NaN;
    }
  }
  function chooseSample(a, b) {
    if (!Number.isFinite(a) && Number.isFinite(b)) return b - 1;
    if (!Number.isFinite(b) && Number.isFinite(a)) return a + 1;
    if (!Number.isFinite(a) && !Number.isFinite(b)) return 0;
    let sample = (a + b) / 2;
    if (!Number.isFinite(sample)) {
      sample = a + (b - a) / 2;
    }
    if (Math.abs(sample - a) < 1e-4) {
      sample = a + (b - a) * 0.3;
    }
    if (Math.abs(sample - b) < 1e-4) {
      sample = b - (b - a) * 0.3;
    }
    return sample;
  }
  function computeSegments(fn, points, domain) {
    const sorted = [...points].sort((a, b) => a.value - b.value);
    const boundaries = [domain.min, ...sorted.map(p => p.value), domain.max];
    const segments = [];
    for (let i = 0; i < boundaries.length - 1; i += 1) {
      const left = boundaries[i];
      const right = boundaries[i + 1];
      let sample = chooseSample(left, right);
      let value = tryEvaluate(fn, sample);
      if (!Number.isFinite(value)) {
        const ratios = [0.25, 0.75, 0.1, 0.9];
        for (const ratio of ratios) {
          sample = left + (right - left) * ratio;
          value = tryEvaluate(fn, sample);
          if (Number.isFinite(value)) break;
        }
      }
      if (!Number.isFinite(value)) {
        segments.push(segments.length ? segments[segments.length - 1] : 1);
        continue;
      }
      segments.push(value >= 0 ? 1 : -1);
    }
    return segments;
  }
  function generateSolutionFromExpression() {
    const raw = exprInput.value.trim();
    if (!raw) {
      throw new Error('Skriv inn et funksjonsuttrykk.');
    }
    const sanitized = sanitizeExpression(raw);
    if (!sanitized) {
      throw new Error('Kunne ikke tolke funksjonsuttrykket.');
    }
    if (!/^[0-9x+\-*/().*]*$/.test(sanitized)) {
      throw new Error('Kun tall, x og de fire regneartene støttes i autogenereringen.');
    }
    const fn = createSafeFunction(sanitized);
    if (!fn) {
      throw new Error('Kunne ikke tolke funksjonsuttrykket.');
    }
    const structure = extractStructure(sanitized);
    const points = buildPoints(structure);
    const domain = computeAutoDomain(points);
    const segments = computeSegments(fn, points, domain);
    return {
      points,
      segments,
      domain,
      expression: sanitized
    };
  }
  function setCheckMessage(message, type = 'info') {
    if (!message) {
      checkStatus.hidden = true;
      checkStatus.textContent = '';
      return;
    }
    checkStatus.hidden = false;
    checkStatus.textContent = message;
    checkStatus.className = `status status--${type}`;
  }
  function signValue(value) {
    return value >= 0 ? 1 : -1;
  }
  function runCheck() {
    if (!state.solution) {
      setCheckMessage('Generer fasit før du sjekker.', 'info');
      return;
    }
    if (!state.signRows.length) {
      setCheckMessage('Ingen fortegnslinjer definert.', 'err');
      return;
    }
    const solutionPoints = state.solution.points;
    const tolerance = 1e-2;
    if (state.criticalPoints.length !== solutionPoints.length) {
      setCheckMessage('Antall punkter stemmer ikke med fasit.', 'err');
      return;
    }
    for (let i = 0; i < solutionPoints.length; i += 1) {
      const sol = solutionPoints[i];
      const user = state.criticalPoints[i];
      if (sol.type !== user.type) {
        setCheckMessage(`Punkt ${i + 1} har feil type.`, 'err');
        return;
      }
      if (Math.abs(sol.value - user.value) > tolerance) {
        setCheckMessage(`Punkt ${i + 1} har feil plassering.`, 'err');
        return;
      }
    }
    const solutionSegments = state.solution.segments;
    const row = state.signRows[0];
    if (!row || row.segments.length !== solutionSegments.length) {
      setCheckMessage('Fortegnslinjen har feil antall intervaller.', 'err');
      return;
    }
    for (let i = 0; i < solutionSegments.length; i += 1) {
      if (signValue(row.segments[i]) !== signValue(solutionSegments[i])) {
        setCheckMessage(`Segment ${i + 1} har feil fortegn.`, 'err');
        return;
      }
    }
    setCheckMessage('Fortegnsskjemaet stemmer!', 'ok');
  }
  function renderPointsList() {
    pointsList.innerHTML = '';
    if (!state.criticalPoints.length) {
      const empty = document.createElement('div');
      empty.className = 'note';
      empty.textContent = 'Ingen punkter definert.';
      pointsList.appendChild(empty);
      return;
    }
    state.criticalPoints.forEach(point => {
      const row = document.createElement('div');
      const valueLabel = document.createElement('label');
      valueLabel.classList.add('value-field');
      valueLabel.innerHTML = '<span>Verdi</span>';
      const input = document.createElement('input');
      input.type = 'number';
      input.step = getNumberStep();
      input.value = formatPointValue(point.value);
      input.addEventListener('change', event => {
        const value = parseFloat(event.target.value);
        if (Number.isFinite(value)) {
          setPointValue(point.id, value);
        }
      });
      valueLabel.appendChild(input);
      row.appendChild(valueLabel);
      const typeLabel = document.createElement('label');
      typeLabel.innerHTML = '<span>Type</span>';
      const select = document.createElement('select');
      const optionZero = document.createElement('option');
      optionZero.value = 'zero';
      optionZero.textContent = '0 (nullpunkt)';
      const optionPole = document.createElement('option');
      optionPole.value = 'pole';
      optionPole.textContent = '>< (pol)';
      select.append(optionZero, optionPole);
      select.value = point.type === 'pole' ? 'pole' : 'zero';
      select.addEventListener('change', event => {
        point.type = event.target.value === 'pole' ? 'pole' : 'zero';
        renderChart();
      });
      typeLabel.appendChild(select);
      row.appendChild(typeLabel);
      const removeBtn = document.createElement('button');
      removeBtn.type = 'button';
      removeBtn.className = 'btn danger';
      removeBtn.textContent = 'Fjern';
      removeBtn.addEventListener('click', () => {
        removePoint(point.id);
      });
      row.appendChild(removeBtn);
      pointsList.appendChild(row);
    });
  }
  function renderRowsList() {
    rowsList.innerHTML = '';
    if (!state.signRows.length) {
      const info = document.createElement('div');
      info.className = 'note';
      info.textContent = 'Ingen fortegnslinjer.';
      rowsList.appendChild(info);
      return;
    }
    state.signRows.forEach((row, index) => {
      const rowEl = document.createElement('div');
      const label = document.createElement('label');
      label.className = 'row-label';
      label.innerHTML = '<span>Navn</span>';
      const input = document.createElement('input');
      input.type = 'text';
      input.value = row.label || '';
      input.placeholder = `rad ${index + 1}`;
      input.addEventListener('input', event => {
        row.label = event.target.value;
        renderChart();
      });
      label.appendChild(input);
      rowEl.appendChild(label);
      if (state.autoSync && index === 0 && state.solution) {
        const note = document.createElement('span');
        note.className = 'note';
        note.textContent = 'Synkronisert med fasit';
        rowEl.appendChild(note);
      }
      const removeBtn = document.createElement('button');
      removeBtn.type = 'button';
      removeBtn.className = 'btn danger';
      removeBtn.textContent = 'Fjern';
      if (state.signRows.length === 1) {
        removeBtn.disabled = true;
      } else {
        removeBtn.addEventListener('click', () => {
          removeRow(row.id);
        });
      }
      rowEl.appendChild(removeBtn);
      rowsList.appendChild(rowEl);
    });
  }
  function createSvgElement(name, attrs = {}) {
    const el = document.createElementNS('http://www.w3.org/2000/svg', name);
    Object.entries(attrs).forEach(([key, value]) => {
      if (value !== null && value !== undefined) {
        el.setAttribute(key, value);
      }
    });
    return el;
  }
  function renderChart() {
    sortPoints();
    const points = state.criticalPoints;
    const domainInfo = getDomainInfo();
    const domain = domainInfo.active;
    const width = svg.clientWidth || svg.parentElement.clientWidth || 900;
    const rowSpacing = 70;
    const arrowY = 70;
    const marginLeft = 70;
    const marginRight = 40;
    const baseHeight = arrowY + 60 + Math.max(1, state.signRows.length) * rowSpacing + 60;
    svg.setAttribute('viewBox', `0 0 ${width} ${baseHeight}`);
    svg.style.height = `${baseHeight}px`;
    svg.innerHTML = '';
    if (overlay) {
      overlay.innerHTML = '';
      overlay.style.height = `${baseHeight}px`;
    }
    const axisStart = marginLeft;
    const axisEnd = width - marginRight;
    const axisWidth = axisEnd - axisStart;
    const min = domain.min;
    const max = domain.max;
    currentScale = {
      toCoord: value => axisStart + (value - min) / (max - min) * axisWidth,
      toValue: coord => min + (coord - axisStart) / axisWidth * (max - min),
      axisStart,
      axisWidth,
      domainMin: min,
      domainMax: max
    };
    renderDomainControls(domainInfo);
    const axisLine = createSvgElement('line', {
      x1: axisStart,
      y1: arrowY,
      x2: axisEnd,
      y2: arrowY,
      stroke: '#4b5563',
      'stroke-width': 2
    });
    svg.append(axisLine);
    const arrowHead = createSvgElement('path', {
      d: `M ${axisEnd} ${arrowY} l -12 -6 v12 z`,
      fill: '#4b5563'
    });
    svg.append(arrowHead);
    const axisLabel = createSvgElement('text', {
      x: axisEnd + 16,
      y: arrowY + 4,
      'font-size': 14,
      'font-weight': 600,
      fill: '#111827'
    });
    axisLabel.textContent = 'x';
    svg.append(axisLabel);
    const sortedPoints = [...points];
    const values = sortedPoints.map(p => p.value);
    const baseRowY = arrowY + 60;
    const lastRowY = baseRowY + (state.signRows.length - 1) * rowSpacing;
    sortedPoints.forEach(point => {
      const px = currentScale.toCoord(point.value);
      if (!Number.isFinite(px)) return;
      const vertical = createSvgElement('line', {
        x1: px,
        y1: arrowY + 8,
        x2: px,
        y2: lastRowY + 20,
        stroke: '#d1d5db',
        'stroke-width': 1.2,
        'data-point-id': point.id,
        'pointer-events': 'stroke',
        cursor: 'ew-resize'
      });
      svg.append(vertical);
      const labelY = point.type === 'pole' ? arrowY + 6 : baseRowY + 6;
      const label = createSvgElement('text', {
        x: px,
        y: labelY,
        'text-anchor': 'middle',
        'font-size': 16,
        'font-weight': 600,
        fill: point.type === 'pole' ? '#b91c1c' : '#111827',
        'pointer-events': 'none'
      });
      label.textContent = point.type === 'pole' ? '><' : '0';
      svg.append(label);
      const dragHandle = createSvgElement('circle', {
        cx: px,
        cy: arrowY,
        r: 12,
        fill: 'transparent',
        stroke: 'transparent',
        'data-point-id': point.id,
        'pointer-events': 'all',
        cursor: 'ew-resize'
      });
      svg.append(dragHandle);
      if (overlay) {
        const valueBadge = document.createElement('div');
        valueBadge.className = 'chart-overlay__value';
        valueBadge.style.left = `${px}px`;
        valueBadge.style.top = `${arrowY}px`;
        valueBadge.dataset.pointId = point.id;
        const valueInput = document.createElement('input');
        valueInput.type = 'number';
        valueInput.className = 'chart-overlay__value-input';
        valueInput.step = getNumberStep();
        valueInput.value = formatPointValue(point.value);
        valueInput.setAttribute('aria-label', point.type === 'pole' ? 'x-verdi for pol' : 'x-verdi for nullpunkt');
        valueInput.addEventListener('focus', () => {
          valueInput.select();
        });
        const commitInputValue = () => {
          const raw = valueInput.value.trim().replace(',', '.');
          if (raw === '') {
            valueInput.value = formatPointValue(point.value);
            return;
          }
          const value = Number.parseFloat(raw);
          if (Number.isFinite(value)) {
            setPointValue(point.id, value);
          } else {
            valueInput.value = formatPointValue(point.value);
          }
        };
        valueInput.addEventListener('change', commitInputValue);
        valueInput.addEventListener('keydown', event => {
          if (event.key === 'Enter') {
            commitInputValue();
            valueInput.blur();
          } else if (event.key === 'Escape') {
            valueInput.value = formatPointValue(point.value);
            valueInput.blur();
          }
        });
        valueBadge.addEventListener('pointerdown', event => {
          if (event.button !== 0) return;
          if (event.target === valueInput) {
            return;
          }
          event.preventDefault();
          startDragging(point.id, event.pointerId, false);
        });
        valueBadge.appendChild(valueInput);
        overlay.appendChild(valueBadge);
      }
    });
    const boundaries = [min, ...values, max];
    state.signRows.forEach((row, rowIndex) => {
      const y = baseRowY + rowIndex * rowSpacing;
      const baseline = createSvgElement('line', {
        x1: axisStart,
        y1: y,
        x2: axisEnd,
        y2: y,
        stroke: '#d1d5db',
        'stroke-width': 1
      });
      svg.append(baseline);
      const label = createSvgElement('text', {
        x: marginLeft - 30,
        y: y + 4,
        'text-anchor': 'end',
        'font-size': 16,
        'font-weight': 600,
        fill: '#111827'
      });
      label.textContent = row.label || `rad ${rowIndex + 1}`;
      svg.append(label);
      const locked = state.autoSync && rowIndex === 0 && state.solution;
      const segments = row.segments;
      for (let i = 0; i < boundaries.length - 1; i += 1) {
        const startVal = boundaries[i];
        const endVal = boundaries[i + 1];
        const startX = currentScale.toCoord(startVal);
        const endX = currentScale.toCoord(endVal);
        if (!Number.isFinite(startX) || !Number.isFinite(endX)) continue;
        const sign = segments[i] >= 0 ? 1 : -1;
        const line = createSvgElement('line', {
          x1: startX,
          y1: y,
          x2: endX,
          y2: y,
          stroke: sign > 0 ? '#111827' : '#dc2626',
          'stroke-width': 3,
          'stroke-linecap': 'round',
          'data-row-id': row.id,
          'data-index': i,
          cursor: locked ? 'not-allowed' : 'pointer'
        });
        if (sign < 0) {
          line.setAttribute('stroke-dasharray', '14 10');
        }
        if (!locked) {
          line.addEventListener('pointerdown', event => {
            event.preventDefault();
            toggleSegment(row.id, i);
          });
        }
        svg.append(line);
      }
    });
  }
  function setPointValue(id, value, fromDrag = false) {
    const point = state.criticalPoints.find(p => p.id === id);
    if (!point) return;
    if (fromDrag && Math.abs(point.value - value) < 1e-9) {
      return;
    }
    point.value = value;
    sortPoints();
    if (fromDrag) {
      if (dragging) {
        dragging.moved = true;
      }
      renderPointsList();
      renderChart();
    } else {
      syncSegments();
      renderAll();
    }
  }
  function removePoint(id) {
    const index = state.criticalPoints.findIndex(p => p.id === id);
    if (index === -1) return;
    state.criticalPoints.splice(index, 1);
    syncSegments();
    renderAll();
  }
  function removeRow(id) {
    if (state.signRows.length <= 1) return;
    const index = state.signRows.findIndex(row => row.id === id);
    if (index === -1) return;
    state.signRows.splice(index, 1);
    renderAll();
  }
  function toggleSegment(rowId, index) {
    const row = state.signRows.find(r => r.id === rowId);
    if (!row) return;
    const rowIndex = state.signRows.indexOf(row);
    if (state.autoSync && rowIndex === 0 && state.solution) {
      return;
    }
    row.segments[index] = row.segments[index] >= 0 ? -1 : 1;
    renderChart();
  }
  function addPoint(type = 'zero', value = 0) {
    state.criticalPoints.push({
      id: `p${pointIdCounter++}`,
      type,
      value
    });
    sortPoints();
    syncSegments();
    renderAll();
  }
  function addRow() {
    const expected = Math.max(1, state.criticalPoints.length + 1);
    const segments = Array(expected).fill(1);
    state.signRows.push({
      id: `row-${rowIdCounter++}`,
      label: `rad ${state.signRows.length + 1}`,
      segments
    });
    renderAll();
  }
  function applySolutionToState(solution) {
    state.criticalPoints = solution.points.map(point => ({
      id: `p${pointIdCounter++}`,
      type: point.type,
      value: point.value
    }));
    if (!state.signRows.length) {
      state.signRows.push({
        id: `row-${rowIdCounter++}`,
        label: 'f(x)',
        segments: []
      });
    }
    state.signRows[0].segments = solution.segments.slice();
    if (!state.signRows[0].label) {
      state.signRows[0].label = 'f(x)';
    }
    syncSegments();
    renderAll();
  }
  function ensureSolution() {
    if (!state.solution && exprInput.value.trim()) {
      try {
        state.solution = generateSolutionFromExpression();
      } catch (err) {
        setCheckMessage(err.message, 'err');
        return false;
      }
    }
    return !!state.solution;
  }
  function renderAll() {
    sortPoints();
    syncSegments();
    renderPointsList();
    renderRowsList();
    renderChart();
  }
  function startDragging(pointId, pointerId, capture = true) {
    if (!pointId) return;
    dragging = {
      id: pointId,
      pointerId,
      moved: false
    };
    if (capture && pointerId !== undefined && svg.setPointerCapture) {
      try {
        svg.setPointerCapture(pointerId);
      } catch (err) {
        /* ignore */
      }
    }
  }
  svg.addEventListener('pointerdown', event => {
    const target = event.target;
    if (!(target instanceof SVGElement)) return;
    const pointId = target.getAttribute('data-point-id');
    if (!pointId) return;
    event.preventDefault();
    startDragging(pointId, event.pointerId);
  });
  function stopDragging(event) {
    if (!dragging) return;
    const pointerId = event.pointerId !== undefined ? event.pointerId : dragging.pointerId;
    if (pointerId !== undefined && svg.hasPointerCapture(pointerId)) {
      svg.releasePointerCapture(pointerId);
    }
    const moved = dragging.moved;
    dragging = null;
    if (moved) {
      syncSegments();
      renderAll();
    }
  }
  window.addEventListener('pointermove', event => {
    if (!dragging || !currentScale) return;
    const rect = svg.getBoundingClientRect();
    const relativeX = event.clientX - rect.left;
    const value = currentScale.toValue(relativeX);
    if (!Number.isFinite(value)) return;
    setPointValue(dragging.id, value, true);
  });
  window.addEventListener('pointerup', stopDragging);
  window.addEventListener('pointercancel', stopDragging);
  function handleAddPoint() {
    addPoint('zero', 0);
    setCheckMessage('');
  }
  function handleAddRow() {
    addRow();
    setCheckMessage('');
  }
  if (btnAddPoint) {
    btnAddPoint.addEventListener('click', handleAddPoint);
  }
  if (overlayAddPoint) {
    overlayAddPoint.addEventListener('click', handleAddPoint);
  }
  if (btnAddRow) {
    btnAddRow.addEventListener('click', handleAddRow);
  }
  if (overlayAddRow) {
    overlayAddRow.addEventListener('click', handleAddRow);
  }
  function handleDomainChange(key, event) {
    const input = event.target;
    const raw = input.value.trim().replace(',', '.');
    if (raw === '') {
      state.domain[key] = null;
      input.classList.remove('input-invalid');
      renderAll();
      return;
    }
    const value = Number.parseFloat(raw);
    if (Number.isFinite(value)) {
      state.domain[key] = value;
      input.value = formatPointValue(value);
      input.classList.remove('input-invalid');
      renderAll();
    } else {
      input.classList.add('input-invalid');
    }
  }
  function handleDomainInput(event) {
    const raw = event.target.value.trim().replace(',', '.');
    if (raw === '' || Number.isFinite(Number.parseFloat(raw))) {
      event.target.classList.remove('input-invalid');
    } else {
      event.target.classList.add('input-invalid');
    }
  }
  function handleDecimalPlacesInput(event) {
    const raw = event.target.value.trim().replace(',', '.');
    if (raw === '' || Number.isFinite(Number.parseFloat(raw))) {
      event.target.classList.remove('input-invalid');
    } else {
      event.target.classList.add('input-invalid');
    }
  }
  function handleDecimalPlacesChange(event) {
    const input = event.target;
    const raw = input.value.trim().replace(',', '.');
    if (raw === '') {
      input.value = `${getDecimalPlaces()}`;
      input.classList.remove('input-invalid');
      return;
    }
    const value = Number.parseFloat(raw);
    if (Number.isFinite(value)) {
      const sanitized = clampDecimalPlaces(value);
      state.decimalPlaces = sanitized;
      input.value = `${sanitized}`;
      input.classList.remove('input-invalid');
      renderAll();
    } else {
      input.classList.add('input-invalid');
    }
  }
  if (domainMinInput) {
    domainMinInput.addEventListener('change', handleDomainChange.bind(null, 'min'));
    domainMinInput.addEventListener('input', handleDomainInput);
  }
  if (domainMaxInput) {
    domainMaxInput.addEventListener('change', handleDomainChange.bind(null, 'max'));
    domainMaxInput.addEventListener('input', handleDomainInput);
  }
  if (decimalPlacesInput) {
    decimalPlacesInput.value = `${getDecimalPlaces()}`;
    decimalPlacesInput.addEventListener('change', handleDecimalPlacesChange);
    decimalPlacesInput.addEventListener('input', handleDecimalPlacesInput);
  }
  btnGenerate.addEventListener('click', () => {
    try {
      const solution = generateSolutionFromExpression();
      state.expression = exprInput.value.trim();
      state.solution = solution;
      if (state.autoSync) {
        applySolutionToState(solution);
        setCheckMessage('Fortegnslinjen er oppdatert fra fasit.', 'ok');
      } else {
        setCheckMessage('Fasit generert. Bruk Sjekk for å sammenligne.', 'info');
      }
    } catch (err) {
      setCheckMessage(err.message, 'err');
    }
  });
  btnCheck.addEventListener('click', () => {
    if (!ensureSolution()) {
      return;
    }
    runCheck();
  });
  autoSyncInput.addEventListener('change', event => {
    state.autoSync = event.target.checked;
    if (state.autoSync && ensureSolution()) {
      applySolutionToState(state.solution);
      setCheckMessage('Fortegnslinjen oppdateres automatisk fra fasit.', 'info');
    } else {
      renderRowsList();
    }
  });
  exprInput.addEventListener('input', () => {
    state.expression = exprInput.value.trim();
  });
  window.addEventListener('resize', () => {
    renderChart();
  });
  createDefaultRow();
  renderAll();
})();
