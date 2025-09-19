(function () {
  const cfgType = document.getElementById('cfg-type');
  const klosserConfig = document.getElementById('klosserConfig');
  const rektangelConfig = document.getElementById('rektangelConfig');
  const monsterConfig = document.getElementById('monsterConfig');
  const cfgAntallX = document.getElementById('cfg-antallX');
  const cfgAntallY = document.getElementById('cfg-antallY');
  const cfgBredde = document.getElementById('cfg-bredde');
  const cfgHoyde = document.getElementById('cfg-hoyde');
  const cfgDybde = document.getElementById('cfg-dybde');
  const cfgRektangelAntallX = document.getElementById('cfg-rektangel-antallX');
  const cfgRektangelAntallY = document.getElementById('cfg-rektangel-antallY');
  const cfgRektangelBredde = document.getElementById('cfg-rektangel-bredde');
  const cfgRektangelHoyde = document.getElementById('cfg-rektangel-hoyde');
  const cfgVisibility = document.getElementById('cfg-visibility');
  const cfgShowExpression = document.getElementById('cfg-show-expression');
  const cfgMonsterAntallX = document.getElementById('cfg-monster-antallX');
  const cfgMonsterAntallY = document.getElementById('cfg-monster-antallY');
  const cfgAntall = document.getElementById('cfg-antall');
  const cfgMonsterCircleRadius = document.getElementById('cfg-monster-circleRadius');
  const cfgMonsterLevelScale = document.getElementById('cfg-monster-levelScale');
  const cfgMonsterPatternGap = document.getElementById('cfg-monster-patternGap');
  const brickContainer = document.getElementById('brickContainer');
  const rectContainer = document.getElementById('rectContainer');
  const patternContainer = document.getElementById('patternContainer');
  const playBtn = document.getElementById('playBtn');
  const expression = document.getElementById('expression');
  const btnSvg = document.getElementById('btnSvg');
  const btnPng = document.getElementById('btnPng');
  let BRICK_SRC;
  const MONSTER_POINT_RADIUS_MIN = 1;
  const MONSTER_POINT_RADIUS_MAX = 60;
  const MONSTER_POINT_SPACING_MIN = 0;
  const MONSTER_POINT_SPACING_MAX = 60;
  const MAX_VISIBILITY_DURATION = 10;
  const DOT = ' · ';
  const DEFAULT_CFG = {
    type: 'klosser',
    showExpression: true,
    klosser: {
      antallX: 5,
      antallY: 2,
      bredde: 2,
      hoyde: 3,
      dybde: 2,
      duration: 3,
      showBtn: false
    },
    rektangel: {
      antallX: 5,
      antallY: 2,
      bredde: 2,
      hoyde: 3,
      duration: 3,
      showBtn: false
    },
    monster: {
      antallX: 2,
      antallY: 2,
      antall: 9,
      circleRadius: 10,
      dotSpacing: 3,
      levelScale: 1,
      patternGap: 18,
      duration: 3,
      showBtn: false
    }
  };
  function deepClone(value) {
    if (value == null) return value;
    if (typeof structuredClone === 'function') {
      try {
        return structuredClone(value);
      } catch (_) {}
    }
    try {
      return JSON.parse(JSON.stringify(value));
    } catch (_) {
      return value;
    }
  }
  function createExampleCfg(overrides) {
    const base = deepClone(DEFAULT_CFG) || {};
    const normalized = overrides && typeof overrides === 'object' ? overrides : {};
    if (typeof normalized.type === 'string') {
      base.type = ['monster', 'rektangel'].includes(normalized.type) ? normalized.type : 'klosser';
    }
    if (Object.prototype.hasOwnProperty.call(normalized, 'showExpression')) {
      base.showExpression = normalized.showExpression !== false;
    }
    if (normalized.klosser && typeof normalized.klosser === 'object') {
      base.klosser = Object.assign({}, base.klosser, normalized.klosser);
    }
    if (normalized.rektangel && typeof normalized.rektangel === 'object') {
      base.rektangel = Object.assign({}, base.rektangel, normalized.rektangel);
    }
    if (normalized.monster && typeof normalized.monster === 'object') {
      base.monster = Object.assign({}, base.monster, normalized.monster);
    }
    return base;
  }
  const DEFAULT_KVIKKBILDER_EXAMPLES = [{
    id: 'kvikkbilder-klosser-1',
    exampleNumber: '1',
    title: '4 · 2 · (2 · 3 · 2)',
    isDefault: true,
    config: {
      CFG: createExampleCfg({
        type: 'klosser',
        showExpression: true,
        klosser: {
          antallX: 4,
          antallY: 2,
          bredde: 2,
          hoyde: 3,
          dybde: 2,
          showBtn: false
        }
      })
    }
  }, {
    id: 'kvikkbilder-klosser-2',
    exampleNumber: '2',
    title: '3 · 3 · (3 · 2 · 1)',
    config: {
      CFG: createExampleCfg({
        type: 'klosser',
        showExpression: true,
        klosser: {
          antallX: 3,
          antallY: 3,
          bredde: 3,
          hoyde: 2,
          dybde: 1,
          showBtn: false
        }
      })
    }
  }, {
    id: 'kvikkbilder-rektangel-3',
    exampleNumber: '3',
    title: '5 · 2 · (2 · 3)',
    config: {
      CFG: createExampleCfg({
        type: 'rektangel',
        showExpression: true,
        rektangel: {
          antallX: 5,
          antallY: 2,
          bredde: 2,
          hoyde: 3,
          showBtn: false
        }
      })
    }
  }, {
    id: 'kvikkbilder-monster-3',
    exampleNumber: '4',
    title: 'Numbervisual 12',
    config: {
      CFG: createExampleCfg({
        type: 'monster',
        showExpression: true,
        monster: {
          antallX: 2,
          antallY: 2,
          antall: 12,
          showBtn: false
        }
      })
    }
  }];
  if (typeof window !== 'undefined') {
    window.__EXAMPLES_FORCE_PROVIDED__ = true;
    window.DEFAULT_EXAMPLES = DEFAULT_KVIKKBILDER_EXAMPLES.map(example => {
      var _example$config;
      return {
        ...example,
        config: {
          ...example.config,
          CFG: deepClone((_example$config = example.config) === null || _example$config === void 0 ? void 0 : _example$config.CFG)
        }
      };
    });
  }
  const globalCfg = typeof window.CFG === 'object' && window.CFG ? window.CFG : {};
  const CFG = window.CFG = globalCfg;
  function iso(x, y, z, tileW, tileH, unitH) {
    return {
      x: (x - y) * tileW / 2,
      y: (x + y) * tileH / 2 - z * unitH
    };
  }
  function createBrick(bredde, hoyde, dybde) {
    if (!BRICK_SRC) return document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    const tileW = 26;
    const tileH = 13;
    const unitH = 13;
    const imgW = 26;
    const imgH = 32.5;
    const offsetX = 0.5;
    const offsetY = 25.75;
    const p = (x, y, z) => iso(x, y, z, tileW, tileH, unitH);
    const widthCount = Math.max(1, Math.trunc(bredde));
    const heightCount = Math.max(1, Math.trunc(hoyde));
    const depthCount = Math.max(1, Math.trunc(dybde));
    const bricks = [];
    for (let z = 0; z < heightCount; z++) {
      for (let y = 0; y < depthCount; y++) {
        for (let x = 0; x < widthCount; x++) {
          const pos = p(x, y, z);
          bricks.push({
            x,
            y,
            z,
            pos
          });
        }
      }
    }
    bricks.sort((a, b) => a.x + a.y + a.z - (b.x + b.y + b.z));
    let minX = Infinity,
      minY = Infinity,
      maxX = -Infinity,
      maxY = -Infinity;
    bricks.forEach(({
      pos
    }) => {
      const x = pos.x - offsetX;
      const y = pos.y - offsetY;
      if (x < minX) minX = x;
      if (y < minY) minY = y;
      if (x + imgW > maxX) maxX = x + imgW;
      if (y + imgH > maxY) maxY = y + imgH;
    });
    const w = Math.max(1, maxX - minX);
    const diagonalLayers = Math.max(0, widthCount - 1) + Math.max(0, depthCount - 1);
    const diagonalHeight = diagonalLayers * (tileH / 2);
    const targetHeight = Math.max(1, imgH + (heightCount - 1) * unitH + diagonalHeight);
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('viewBox', `0 0 ${w} ${targetHeight}`);
    svg.setAttribute('width', '100%');
    svg.setAttribute('height', '100%');
    const group = document.createElementNS(svg.namespaceURI, 'g');
    const translateX = -minX;
    const translateY = -minY;
    const transforms = [];
    if (translateX !== 0 || translateY !== 0) {
      transforms.push(`translate(${translateX},${translateY})`);
    }
    if (transforms.length) {
      group.setAttribute('transform', transforms.join(' '));
    }
    bricks.forEach(({
      pos
    }) => {
      const img = document.createElementNS(svg.namespaceURI, 'image');
      img.setAttributeNS('http://www.w3.org/1999/xlink', 'href', BRICK_SRC);
      img.setAttribute('href', BRICK_SRC);
      img.setAttribute('width', imgW);
      img.setAttribute('height', imgH);
      img.setAttribute('x', pos.x - offsetX);
      img.setAttribute('y', pos.y - offsetY);
      group.appendChild(img);
    });
    svg.appendChild(group);
    return svg;
  }
  function createRectFigure(bredde, hoyde) {
    const widthCount = Math.max(1, Math.trunc(bredde));
    const heightCount = Math.max(1, Math.trunc(hoyde));
    const dotRadius = 8;
    const dotDiameter = dotRadius * 2;
    const gap = 8;
    const stepX = dotDiameter + gap;
    const stepY = dotDiameter + gap;
    const svgWidth = (widthCount - 1) * stepX + dotDiameter;
    const svgHeight = (heightCount - 1) * stepY + dotDiameter;
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('viewBox', `0 0 ${svgWidth} ${svgHeight}`);
    svg.setAttribute('width', '100%');
    svg.setAttribute('height', '100%');
    for (let y = 0; y < heightCount; y++) {
      for (let x = 0; x < widthCount; x++) {
        const cx = x * stepX + dotRadius;
        const cy = y * stepY + dotRadius;
        const circle = document.createElementNS(svg.namespaceURI, 'circle');
        circle.setAttribute('cx', cx);
        circle.setAttribute('cy', cy);
        circle.setAttribute('r', dotRadius);
        circle.setAttribute('fill', '#111827');
        svg.appendChild(circle);
      }
    }
    return svg;
  }
  function filterUnitFactors(factors) {
    if (!Array.isArray(factors)) return [];
    return factors.filter(value => value !== 1);
  }
  function joinFactors(factors) {
    return factors.map(value => `${value}`).join(DOT);
  }
  function formatOuterInnerExpression(outerFactors, innerFactors) {
    const filteredOuter = filterUnitFactors(outerFactors);
    const filteredInner = filterUnitFactors(innerFactors);
    if (filteredOuter.length && filteredInner.length) {
      const outerExpr = joinFactors(filteredOuter);
      const innerExpr = filteredInner.length > 1 ? `(${joinFactors(filteredInner)})` : `${filteredInner[0]}`;
      return `${outerExpr}${DOT}${innerExpr}`;
    }
    if (filteredOuter.length) {
      return joinFactors(filteredOuter);
    }
    if (filteredInner.length) {
      return filteredInner.length > 1 ? `(${joinFactors(filteredInner)})` : `${filteredInner[0]}`;
    }
    return '1';
  }
  function formatProductStep(factors) {
    const filtered = filterUnitFactors(factors);
    return {
      text: filtered.length ? joinFactors(filtered) : '',
      count: filtered.length
    };
  }
  function renderKlosser() {
    const {
      antallX = 0,
      antallY = 0,
      bredde = 0,
      hoyde = 0,
      dybde = 0
    } = CFG.klosser || {};
    const cols = Math.max(0, Math.trunc(antallX));
    const rows = Math.max(0, Math.trunc(antallY));
    const width = Math.max(1, Math.trunc(bredde));
    const height = Math.max(1, Math.trunc(hoyde));
    const depth = Math.max(1, Math.trunc(dybde));
    brickContainer.innerHTML = '';
    brickContainer.style.gridTemplateColumns = cols > 0 ? `repeat(${cols}, 1fr)` : '';
    brickContainer.style.gridTemplateRows = rows > 0 ? `repeat(${rows}, 1fr)` : '';
    const perFig = width * height * depth;
    const total = cols * rows * perFig;
    const firstExpression = formatOuterInnerExpression([cols, rows], [width, height, depth]);
    const productStep = formatProductStep([cols * rows, perFig]);
    const parts = [firstExpression];
    if (productStep.count >= 2) {
      parts.push(`= ${productStep.text}`);
    }
    parts.push(`= ${total}`);
    expression.textContent = parts.join(' ');
    if (!BRICK_SRC) return;
    const totalFigures = cols * rows;
    for (let i = 0; i < totalFigures; i++) {
      const fig = createBrick(width, height, depth);
      fig.setAttribute('aria-label', `${width}x${height}x${depth} kloss`);
      brickContainer.appendChild(fig);
    }
  }
  function renderRektangel() {
    if (!rectContainer) return;
    const {
      antallX = 0,
      antallY = 0,
      bredde = 0,
      hoyde = 0
    } = CFG.rektangel || {};
    const cols = Math.max(0, Math.trunc(antallX));
    const rows = Math.max(0, Math.trunc(antallY));
    const width = Math.max(1, Math.trunc(bredde));
    const height = Math.max(1, Math.trunc(hoyde));
    rectContainer.innerHTML = '';
    rectContainer.style.gridTemplateColumns = cols > 0 ? `repeat(${cols}, 1fr)` : '';
    rectContainer.style.gridTemplateRows = rows > 0 ? `repeat(${rows}, 1fr)` : '';
    const perFig = width * height;
    const totalFigures = cols * rows;
    const total = totalFigures * perFig;
    const firstExpression = formatOuterInnerExpression([cols, rows], [width, height]);
    const productStep = formatProductStep([totalFigures, perFig]);
    const parts = [firstExpression];
    if (productStep.count >= 2) {
      parts.push(`= ${productStep.text}`);
    }
    parts.push(`= ${total}`);
    expression.textContent = parts.join(' ');
    for (let i = 0; i < totalFigures; i++) {
      const wrapper = document.createElement('div');
      wrapper.className = 'rect-item';
      const fig = createRectFigure(width, height);
      fig.setAttribute('aria-label', `${width}x${height} rektangel prikkbilde`);
      wrapper.appendChild(fig);
      rectContainer.appendChild(wrapper);
    }
  }
  function primeFactors(n) {
    const factors = [];
    let num = n;
    let p = 2;
    while (num > 1 && factors.length < 6) {
      while (num % p === 0 && factors.length < 6) {
        factors.push(p);
        num /= p;
      }
      p++;
    }
    while (factors.length < 6) factors.push(1);
    return factors;
  }
  function computeKs(n, f) {
    const [f1, f2, f3, f4, f5, f6] = f;
    let k1 = (n <= 9 ? 0.5 : 1) / (f2 * f3 * f4 * f5);
    if (f3 === 2 && f4 === 2) k1 *= f5 < 3 ? 0.25 : 0.5;
    if (f4 === 2 && f5 === 2) k1 *= 0.5;
    if (f1 === 2 && f2 === 2 && f3 === 2 && f4 < 3) k1 *= 2;
    if (f1 === 2 && f2 === 2 && f3 === 2 && f4 === 2) k1 *= 2;
    if (f3 === 3) k1 *= f2 / f1;
    if (f1 === f2 && f2 === f3 && f3 === f4 && f4 === f5) k1 *= 2;
    if (n === 1) k1 = 0;
    let k2;
    if (f2 === 1) k2 = 1;else if (f1 === 2 && f2 === 2) k2 = k1;else if (f3 === 1) k2 = 1 - 1 / f2;else if (f2 === f1) k2 = k1 * f2;else if (f3 === f2 && f2 === 3) k2 = k1 * f1;else if (f3 === f2) k2 = k1 * f2;else if (f1 * f2 === 6 && f3 < 3) k2 = k1 * f3 / f1;else k2 = 1 / (f3 * f4 * f5 * f6);
    let k3;
    if (f3 === 1) k3 = 1;else {
      if (f4 === 1) k3 = 1 - k1;else {
        k3 = 1;
        if (f2 * f3 === 4 && f5 === 1) k3 *= Math.max(...f) / f1;
        if (f1 * f2 * f3 === 8 && f6 === 1) k3 *= 1 / f2;
        if (f1 === 2 && f2 === 2 && f3 === 2 && f4 === 2) k3 *= 2;
        k3 *= 1 / (f4 * f5);
      }
      k3 *= 1 / f6;
    }
    if (f1 * f2 * f3 * f4 === 16 && f5 > 2) k3 *= 2;
    let k4;
    if (f4 === 1) k4 = 1;else if (f5 === 1 && f1 * f2 === 4) k4 = 1 - k3;else if (f5 === 1) k4 = 1 - k1;else k4 = 1 / (f5 * f6);
    let k5;
    if (f5 === 1) k5 = 1;else if (f6 === 1) {
      const mul = f1 === 2 && f2 === 2 && f3 === 2 && f4 === 2 ? 0.5 : 1;
      k5 = 1 - mul * k3;
    } else {
      k5 = 1 / f6;
    }
    const k6 = f6 === 1 ? 1 : 1 - k3;
    return [k1, k2, k3, k4, k5, k6];
  }
  function rotate(points, angle) {
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);
    return points.map(p => ({
      x: p.x * cos - p.y * sin,
      y: p.x * sin + p.y * cos
    }));
  }
  function translate(points, tx, ty) {
    return points.map(p => ({
      x: p.x + tx,
      y: p.y + ty
    }));
  }
  function buildLevel(points, factor, r) {
    if (factor === 1) return points;
    const res = [];
    for (let i = 0; i < factor; i++) {
      const rotAngle = -2 * Math.PI * i / factor;
      const rotated = rotate(points, rotAngle);
      const baseAngle = 2 * Math.PI * i / factor;
      let tx, ty;
      if (factor === 2) {
        tx = r * Math.cos(baseAngle);
        ty = r * Math.sin(baseAngle);
      } else {
        tx = r * Math.sin(baseAngle);
        ty = r * Math.cos(baseAngle);
      }
      res.push(...translate(rotated, tx, ty));
    }
    return res;
  }
  function normalizeScale(value, fallback) {
    if (!Number.isFinite(value) || value <= 0) return fallback;
    return value;
  }
  function byggMonster(n, levelScale = 1) {
    if (n <= 0) return [];
    const factors = primeFactors(n);
    const normalizedLevel = normalizeScale(levelScale, 1);
    const ks = computeKs(n, factors).map((value, index) => {
      if (!Number.isFinite(value)) return 0;
      if (index === 0) return value;
      return value * normalizedLevel;
    });
    let pts = [];
    const f1 = factors[0];
    for (let i = 0; i < f1; i++) {
      const angle = 2 * Math.PI * i / f1;
      pts.push({
        x: ks[0] * Math.sin(angle),
        y: ks[0] * Math.cos(angle)
      });
    }
    pts = buildLevel(pts, factors[1], ks[1]);
    pts = buildLevel(pts, factors[2], ks[2]);
    pts = buildLevel(pts, factors[3], ks[3]);
    pts = buildLevel(pts, factors[4], ks[4]);
    pts = buildLevel(pts, factors[5], ks[5]);
    const scale = 0.3;
    return pts.map(p => ({
      x: p.x * scale,
      y: p.y * scale
    }));
  }
  function createPatternSvg(points, options = {}) {
    if (!points.length) return null;
    const radiusRaw = options.radius;
    const spacingRaw = options.spacing;
    const radius = Number.isFinite(radiusRaw) && radiusRaw > 0 ? radiusRaw : 10;
    const spacing = Number.isFinite(spacingRaw) && spacingRaw >= 0 ? spacingRaw : 3;
    const desiredCenterDistance = radius * 2 + spacing;
    const seen = new Set();
    const uniquePoints = [];
    const precision = 1e4;
    points.forEach(p => {
      const key = `${Math.round(p.x * precision)}:${Math.round(p.y * precision)}`;
      if (!seen.has(key)) {
        seen.add(key);
        uniquePoints.push(p);
      }
    });
    let minDist = Infinity;
    for (let i = 0; i < uniquePoints.length; i++) {
      for (let j = i + 1; j < uniquePoints.length; j++) {
        const dx = uniquePoints[i].x - uniquePoints[j].x;
        const dy = uniquePoints[i].y - uniquePoints[j].y;
        const dist = Math.hypot(dx, dy);
        if (dist > 0 && dist < minDist) minDist = dist;
      }
    }
    if (!Number.isFinite(minDist) || minDist <= 0) minDist = desiredCenterDistance;
    let scale = desiredCenterDistance / minDist;
    if (!Number.isFinite(scale) || scale <= 0) scale = 1;else if (scale < 1) scale = 1;
    const scaledPoints = points.map(p => ({
      x: p.x * scale,
      y: p.y * scale
    }));
    let minX = Infinity,
      maxX = -Infinity,
      minY = Infinity,
      maxY = -Infinity;
    scaledPoints.forEach(({
      x,
      y
    }) => {
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
    });
    const pad = radius + spacing;
    const contentWidth = maxX - minX;
    const contentHeight = maxY - minY;
    const baseW = contentWidth + pad * 2;
    const baseH = contentHeight + pad * 2;
    const minSize = Math.max(radius * 4, 40);
    const vbW = Math.max(baseW, minSize);
    const vbH = Math.max(baseH, minSize);
    const extraX = (vbW - baseW) / 2;
    const extraY = (vbH - baseH) / 2;
    const offsetX = pad + extraX - minX;
    const offsetY = pad + extraY - minY;
    const svgNS = 'http://www.w3.org/2000/svg';
    const svg = document.createElementNS(svgNS, 'svg');
    svg.setAttribute('viewBox', `0 0 ${vbW} ${vbH}`);
    svg.setAttribute('width', '100%');
    svg.setAttribute('height', '100%');
    svg.setAttribute('preserveAspectRatio', 'xMidYMid meet');
    scaledPoints.forEach(({
      x,
      y
    }) => {
      const c = document.createElementNS(svgNS, 'circle');
      c.setAttribute('cx', x + offsetX);
      c.setAttribute('cy', y + offsetY);
      c.setAttribute('r', radius);
      c.setAttribute('fill', '#534477');
      svg.appendChild(c);
    });
    return svg;
  }
  function renderMonster() {
    if (!patternContainer) return;
    const {
      antallX = 0,
      antallY = 0,
      antall = 0,
      circleRadius = 10,
      dotSpacing = 3,
      levelScale = 1,
      patternGap = 18
    } = CFG.monster || {};
    patternContainer.innerHTML = '';
    const cols = Math.max(0, Math.trunc(antallX));
    const rows = Math.max(0, Math.trunc(antallY));
    patternContainer.style.gridTemplateColumns = cols > 0 ? `repeat(${cols},minmax(0,1fr))` : '';
    patternContainer.style.gridTemplateRows = rows > 0 ? `repeat(${rows},minmax(0,1fr))` : '';
    const maxDimension = Math.max(cols, rows);
    const gapNumber = Number.isFinite(patternGap) ? patternGap : Number.parseFloat(patternGap);
    const allowGapOverride = !(cols <= 1 && rows <= 1);
    const gapOverride = allowGapOverride && Number.isFinite(gapNumber) && gapNumber >= 0 ? gapNumber : null;
    const gapPx = gapOverride !== null ? gapOverride : maxDimension <= 1 ? 64 : maxDimension === 2 ? 56 : maxDimension === 3 ? 44 : maxDimension === 4 ? 36 : 28;
    const itemPaddingPx = gapOverride !== null ? Math.max(0, Math.round(gapPx * 0.5)) : Math.min(72, Math.max(18, Math.round(gapPx * 0.65)));
    const containerPaddingPx = gapOverride !== null ? Math.max(0, Math.round(gapPx * 0.3)) : Math.min(48, Math.max(12, Math.round(gapPx * 0.4)));
    patternContainer.style.setProperty('--pattern-gap', `${gapPx}px`);
    patternContainer.style.setProperty('--pattern-item-padding', `${itemPaddingPx}px`);
    patternContainer.style.setProperty('--pattern-padding', `${containerPaddingPx}px`);
    const count = Math.max(0, Math.trunc(antall));
    const points = byggMonster(count, levelScale);
    const factors = primeFactors(count).filter(x => x > 1);
    const baseExpression = factors.length ? `${factors.join(DOT)} = ${count}` : `${count}`;
    if (!points.length || cols <= 0 || rows <= 0) {
      expression.textContent = baseExpression;
      return;
    }
    const svg = createPatternSvg(points, {
      radius: circleRadius,
      spacing: dotSpacing
    });
    if (!svg) {
      expression.textContent = baseExpression;
      return;
    }
    const totalFigures = cols * rows;
    svg.setAttribute('aria-label', `Numbervisual ${count}`);
    for (let i = 0; i < totalFigures; i++) {
      const wrapper = document.createElement('div');
      wrapper.className = 'pattern-item';
      wrapper.appendChild(svg.cloneNode(true));
      patternContainer.appendChild(wrapper);
    }
    if (totalFigures > 1) {
      const outerFactors = filterUnitFactors([cols, rows]);
      const firstExpression = outerFactors.length ? `${joinFactors(outerFactors)}${DOT}(${baseExpression})` : baseExpression;
      const productStep = formatProductStep([totalFigures, count]);
      const parts = [firstExpression];
      if (productStep.count >= 2) {
        parts.push(`= ${productStep.text}`);
      }
      parts.push(`= ${totalFigures * count}`);
      expression.textContent = parts.join(' ');
    } else {
      expression.textContent = baseExpression;
    }
  }
  function applyExpressionVisibility() {
    if (!expression) return;
    const enabled = CFG.showExpression !== false;
    const playVisible = playBtn.style.display !== 'none';
    expression.style.display = enabled && !playVisible ? 'block' : 'none';
  }
  function updateVisibilityKlosser() {
    var _CFG$klosser;
    patternContainer.style.display = 'none';
    if (rectContainer) rectContainer.style.display = 'none';
    if ((_CFG$klosser = CFG.klosser) !== null && _CFG$klosser !== void 0 && _CFG$klosser.showBtn) {
      playBtn.style.display = 'flex';
      brickContainer.style.display = 'none';
    } else {
      playBtn.style.display = 'none';
      brickContainer.style.display = 'grid';
    }
    applyExpressionVisibility();
  }
  function updateVisibilityMonster() {
    var _CFG$monster;
    brickContainer.style.display = 'none';
    if (rectContainer) rectContainer.style.display = 'none';
    if ((_CFG$monster = CFG.monster) !== null && _CFG$monster !== void 0 && _CFG$monster.showBtn) {
      playBtn.style.display = 'flex';
      patternContainer.style.display = 'none';
    } else {
      playBtn.style.display = 'none';
      patternContainer.style.display = 'grid';
    }
    applyExpressionVisibility();
  }
  function updateVisibilityRektangel() {
    var _CFG$rektangel;
    if (!rectContainer) {
      playBtn.style.display = 'none';
      applyExpressionVisibility();
      return;
    }
    brickContainer.style.display = 'none';
    patternContainer.style.display = 'none';
    if ((_CFG$rektangel = CFG.rektangel) !== null && _CFG$rektangel !== void 0 && _CFG$rektangel.showBtn) {
      playBtn.style.display = 'flex';
      rectContainer.style.display = 'none';
    } else {
      playBtn.style.display = 'none';
      rectContainer.style.display = 'grid';
    }
    applyExpressionVisibility();
  }
  function clampInt(value, min, fallback) {
    const num = Number.parseInt(value, 10);
    if (Number.isFinite(num)) {
      const safeMin = Number.isFinite(min) ? min : -Infinity;
      return Math.max(safeMin, Math.trunc(num));
    }
    return fallback;
  }
  function clampFloat(value, min, fallback, max) {
    const num = Number.parseFloat(value);
    const safeMin = Number.isFinite(min) ? min : -Infinity;
    const safeMax = Number.isFinite(max) ? max : Infinity;
    if (Number.isFinite(num)) {
      return Math.min(safeMax, Math.max(safeMin, num));
    }
    const normalizedFallback = Number.isFinite(fallback) ? fallback : Number.isFinite(min) ? min : 0;
    return Math.min(safeMax, Math.max(safeMin, normalizedFallback));
  }
  function updateMonsterPatternGapState() {
    if (!cfgMonsterPatternGap) return;
    const disableGap = CFG.monster.antallX <= 1 && CFG.monster.antallY <= 1;
    cfgMonsterPatternGap.disabled = disableGap;
    if (disableGap) {
      cfgMonsterPatternGap.setAttribute('title', 'Figuravstand er tilgjengelig når det er flere figurer.');
    } else {
      cfgMonsterPatternGap.removeAttribute('title');
    }
  }
  function sanitizeCfg() {
    if (!['monster', 'klosser', 'rektangel'].includes(CFG.type)) {
      CFG.type = DEFAULT_CFG.type;
    }
    CFG.showExpression = CFG.showExpression !== false;
    if (!CFG.klosser || typeof CFG.klosser !== 'object') CFG.klosser = {};
    if (!CFG.rektangel || typeof CFG.rektangel !== 'object') CFG.rektangel = {};
    if (!CFG.monster || typeof CFG.monster !== 'object') CFG.monster = {};
    const k = CFG.klosser;
    const dk = DEFAULT_CFG.klosser;
    k.antallX = clampInt(k.antallX, 0, dk.antallX);
    k.antallY = clampInt(k.antallY, 0, dk.antallY);
    k.bredde = clampInt(k.bredde, 1, dk.bredde);
    k.hoyde = clampInt(k.hoyde, 1, dk.hoyde);
    k.dybde = clampInt(k.dybde, 1, dk.dybde);
    k.duration = clampInt(k.duration, 0, dk.duration);
    k.showBtn = k.showBtn === true;
    if (k.showBtn) {
      const normalizedDuration = Number.isFinite(k.duration) ? k.duration : dk.duration;
      k.duration = Math.min(MAX_VISIBILITY_DURATION, Math.max(1, normalizedDuration));
    } else {
      k.duration = Math.max(0, k.duration);
    }
    const r = CFG.rektangel;
    const dr = DEFAULT_CFG.rektangel;
    r.antallX = clampInt(r.antallX, 0, dr.antallX);
    r.antallY = clampInt(r.antallY, 0, dr.antallY);
    r.bredde = clampInt(r.bredde, 1, dr.bredde);
    r.hoyde = clampInt(r.hoyde, 1, dr.hoyde);
    r.duration = clampInt(r.duration, 0, dr.duration);
    r.showBtn = r.showBtn === true;
    if (r.showBtn) {
      const normalizedDuration = Number.isFinite(r.duration) ? r.duration : dr.duration;
      r.duration = Math.min(MAX_VISIBILITY_DURATION, Math.max(1, normalizedDuration));
    } else {
      r.duration = Math.max(0, r.duration);
    }
    const m = CFG.monster;
    const dm = DEFAULT_CFG.monster;
    m.antallX = clampInt(m.antallX, 0, dm.antallX);
    m.antallY = clampInt(m.antallY, 0, dm.antallY);
    m.antall = clampInt(m.antall, 0, dm.antall);
    m.circleRadius = clampFloat(m.circleRadius, MONSTER_POINT_RADIUS_MIN, dm.circleRadius, MONSTER_POINT_RADIUS_MAX);
    m.dotSpacing = clampFloat(m.dotSpacing, MONSTER_POINT_SPACING_MIN, dm.dotSpacing, MONSTER_POINT_SPACING_MAX);
    m.levelScale = clampFloat(m.levelScale, 0.1, dm.levelScale);
    m.patternGap = clampFloat(m.patternGap, 0, dm.patternGap);
    m.duration = clampInt(m.duration, 0, dm.duration);
    m.showBtn = m.showBtn === true;
    if (m.showBtn) {
      const normalizedDuration = Number.isFinite(m.duration) ? m.duration : dm.duration;
      m.duration = Math.min(MAX_VISIBILITY_DURATION, Math.max(1, normalizedDuration));
    } else {
      m.duration = Math.max(0, m.duration);
    }
    return CFG;
  }
  function resolveVisibilityValue(config) {
    if (!config || config.showBtn !== true) {
      return 'always';
    }
    const normalizedDuration = Number.isFinite(config.duration) ? config.duration : 1;
    const clampedDuration = Math.min(MAX_VISIBILITY_DURATION, Math.max(1, normalizedDuration));
    return String(clampedDuration);
  }
  function updateVisibilityControlValue() {
    if (!cfgVisibility) return;
    let activeCfg;
    if (CFG.type === 'monster') activeCfg = CFG.monster;
    else if (CFG.type === 'rektangel') activeCfg = CFG.rektangel;
    else activeCfg = CFG.klosser;
    cfgVisibility.value = resolveVisibilityValue(activeCfg);
  }
  function syncControlsToCfg() {
    sanitizeCfg();
    if (cfgType) cfgType.value = CFG.type;
    if (cfgShowExpression) cfgShowExpression.checked = CFG.showExpression !== false;
    if (cfgAntallX) cfgAntallX.value = CFG.klosser.antallX;
    if (cfgAntallY) cfgAntallY.value = CFG.klosser.antallY;
    if (cfgBredde) cfgBredde.value = CFG.klosser.bredde;
    if (cfgHoyde) cfgHoyde.value = CFG.klosser.hoyde;
    if (cfgDybde) cfgDybde.value = CFG.klosser.dybde;
    if (cfgRektangelAntallX) cfgRektangelAntallX.value = CFG.rektangel.antallX;
    if (cfgRektangelAntallY) cfgRektangelAntallY.value = CFG.rektangel.antallY;
    if (cfgRektangelBredde) cfgRektangelBredde.value = CFG.rektangel.bredde;
    if (cfgRektangelHoyde) cfgRektangelHoyde.value = CFG.rektangel.hoyde;
    if (cfgMonsterAntallX) cfgMonsterAntallX.value = CFG.monster.antallX;
    if (cfgMonsterAntallY) cfgMonsterAntallY.value = CFG.monster.antallY;
    if (cfgAntall) cfgAntall.value = CFG.monster.antall;
    if (cfgMonsterCircleRadius) cfgMonsterCircleRadius.value = CFG.monster.circleRadius;
    if (cfgMonsterLevelScale) cfgMonsterLevelScale.value = CFG.monster.levelScale;
    if (cfgMonsterPatternGap) {
      cfgMonsterPatternGap.value = CFG.monster.patternGap;
      updateMonsterPatternGapState();
    }
    updateVisibilityControlValue();
  }
  function renderView() {
    sanitizeCfg();
    updateVisibilityControlValue();
    if (CFG.type === 'klosser') {
      if (klosserConfig) klosserConfig.style.display = 'block';
      if (rektangelConfig) rektangelConfig.style.display = 'none';
      if (monsterConfig) monsterConfig.style.display = 'none';
      renderKlosser();
      updateVisibilityKlosser();
    } else if (CFG.type === 'rektangel') {
      if (klosserConfig) klosserConfig.style.display = 'none';
      if (rektangelConfig) rektangelConfig.style.display = 'block';
      if (monsterConfig) monsterConfig.style.display = 'none';
      renderRektangel();
      updateVisibilityRektangel();
    } else {
      if (klosserConfig) klosserConfig.style.display = 'none';
      if (rektangelConfig) rektangelConfig.style.display = 'none';
      if (monsterConfig) monsterConfig.style.display = 'block';
      renderMonster();
      updateVisibilityMonster();
      updateMonsterPatternGapState();
    }
  }
  function render() {
    syncControlsToCfg();
    renderView();
  }
  window.render = render;
  function bindNumberInput(input, targetGetter, key, min = 0) {
    if (!input) return;
    input.addEventListener('input', () => {
      const target = targetGetter();
      if (!target) return;
      const num = Number.parseInt(input.value, 10);
      if (Number.isFinite(num)) {
        target[key] = Math.max(min, Math.trunc(num));
        input.value = String(target[key]);
      }
      renderView();
    });
  }
  function bindFloatInput(input, targetGetter, key, min = 0, fallback = 0, max = Infinity) {
    if (!input) return;
    input.addEventListener('input', () => {
      const target = targetGetter();
      if (!target) return;
      const raw = input.value.trim();
      if (raw === '') {
        const normalizedFallback = Number.isFinite(fallback) ? fallback : min;
        const clampedFallback = Math.min(max, Math.max(min, normalizedFallback));
        target[key] = clampedFallback;
        input.value = String(target[key]);
        renderView();
        return;
      }
      const num = Number.parseFloat(raw);
      if (Number.isFinite(num)) {
        target[key] = Math.min(max, Math.max(min, num));
        input.value = String(target[key]);
      }
      renderView();
    });
  }
  sanitizeCfg();
  bindNumberInput(cfgAntallX, () => CFG.klosser, 'antallX', 0);
  bindNumberInput(cfgAntallY, () => CFG.klosser, 'antallY', 0);
  bindNumberInput(cfgBredde, () => CFG.klosser, 'bredde', 1);
  bindNumberInput(cfgHoyde, () => CFG.klosser, 'hoyde', 1);
  bindNumberInput(cfgDybde, () => CFG.klosser, 'dybde', 1);
  bindNumberInput(cfgRektangelAntallX, () => CFG.rektangel, 'antallX', 0);
  bindNumberInput(cfgRektangelAntallY, () => CFG.rektangel, 'antallY', 0);
  bindNumberInput(cfgRektangelBredde, () => CFG.rektangel, 'bredde', 1);
  bindNumberInput(cfgRektangelHoyde, () => CFG.rektangel, 'hoyde', 1);
  bindNumberInput(cfgMonsterAntallX, () => CFG.monster, 'antallX', 0);
  bindNumberInput(cfgMonsterAntallY, () => CFG.monster, 'antallY', 0);
  bindNumberInput(cfgAntall, () => CFG.monster, 'antall', 0);
  bindFloatInput(cfgMonsterCircleRadius, () => CFG.monster, 'circleRadius', MONSTER_POINT_RADIUS_MIN, DEFAULT_CFG.monster.circleRadius, MONSTER_POINT_RADIUS_MAX);
  bindFloatInput(cfgMonsterLevelScale, () => CFG.monster, 'levelScale', 0.1, DEFAULT_CFG.monster.levelScale);
  bindFloatInput(cfgMonsterPatternGap, () => CFG.monster, 'patternGap', 0, DEFAULT_CFG.monster.patternGap);
  if (cfgVisibility) {
    cfgVisibility.addEventListener('change', () => {
      let target;
      if (CFG.type === 'monster') target = CFG.monster;
      else if (CFG.type === 'rektangel') target = CFG.rektangel;
      else target = CFG.klosser;
      if (!target) return;
      const value = cfgVisibility.value;
      if (value === 'always') {
        target.showBtn = false;
      } else {
        const num = Number.parseInt(value, 10);
        if (Number.isFinite(num)) {
          target.showBtn = true;
          target.duration = Math.min(MAX_VISIBILITY_DURATION, Math.max(1, num));
        } else {
          target.showBtn = false;
        }
      }
      renderView();
    });
  }
  cfgType === null || cfgType === void 0 || cfgType.addEventListener('change', () => {
    const selected = cfgType.value;
    CFG.type = ['monster', 'rektangel'].includes(selected) ? selected : 'klosser';
    cfgType.value = CFG.type;
    renderView();
  });
  cfgShowExpression === null || cfgShowExpression === void 0 || cfgShowExpression.addEventListener('change', () => {
    CFG.showExpression = !!cfgShowExpression.checked;
    applyExpressionVisibility();
  });
  playBtn.addEventListener('click', () => {
    sanitizeCfg();
    if (CFG.type === 'klosser') {
      const duration = Math.max(0, Number.isFinite(CFG.klosser.duration) ? CFG.klosser.duration : 0);
      renderKlosser();
      playBtn.style.display = 'none';
      brickContainer.style.display = 'grid';
      applyExpressionVisibility();
      setTimeout(() => {
        updateVisibilityKlosser();
      }, duration * 1000);
    } else if (CFG.type === 'rektangel') {
      const duration = Math.max(0, Number.isFinite(CFG.rektangel.duration) ? CFG.rektangel.duration : 0);
      renderRektangel();
      playBtn.style.display = 'none';
      if (rectContainer) rectContainer.style.display = 'grid';
      applyExpressionVisibility();
      setTimeout(() => {
        updateVisibilityRektangel();
      }, duration * 1000);
    } else {
      const duration = Math.max(0, Number.isFinite(CFG.monster.duration) ? CFG.monster.duration : 0);
      renderMonster();
      playBtn.style.display = 'none';
      patternContainer.style.display = 'grid';
      applyExpressionVisibility();
      setTimeout(() => {
        updateVisibilityMonster();
      }, duration * 1000);
    }
  });
  btnSvg === null || btnSvg === void 0 || btnSvg.addEventListener('click', () => {
    const svg = brickContainer.querySelector('svg') || (rectContainer === null || rectContainer === void 0 ? void 0 : rectContainer.querySelector('svg')) || patternContainer.querySelector('svg');
    if (svg) {
      const fileName = CFG.type === 'monster' ? 'numbervisuals.svg' : 'kvikkbilder.svg';
      downloadSVG(svg, fileName);
    }
  });
  btnPng === null || btnPng === void 0 || btnPng.addEventListener('click', () => {
    const svg = brickContainer.querySelector('svg') || (rectContainer === null || rectContainer === void 0 ? void 0 : rectContainer.querySelector('svg')) || patternContainer.querySelector('svg');
    if (svg) {
      const fileName = CFG.type === 'monster' ? 'numbervisuals.png' : 'kvikkbilder.png';
      downloadPNG(svg, fileName, 2);
    }
  });
  function svgToString(svgEl) {
    const clone = svgEl.cloneNode(true);
    const css = [...document.querySelectorAll('style')].map(s => s.textContent).join('\n');
    const style = document.createElement('style');
    style.textContent = css;
    clone.insertBefore(style, clone.firstChild);
    clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
    clone.setAttribute('xmlns:xlink', 'http://www.w3.org/1999/xlink');
    return '<?xml version="1.0" encoding="UTF-8"?>\n' + new XMLSerializer().serializeToString(clone);
  }
  function downloadSVG(svgEl, filename) {
    const data = svgToString(svgEl);
    const blob = new Blob([data], {
      type: 'image/svg+xml;charset=utf-8'
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename.endsWith('.svg') ? filename : filename + '.svg';
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  function downloadPNG(svgEl, filename, scale = 2, bg = '#fff') {
    var _svgEl$viewBox;
    const vb = (_svgEl$viewBox = svgEl.viewBox) === null || _svgEl$viewBox === void 0 ? void 0 : _svgEl$viewBox.baseVal;
    const w = (vb === null || vb === void 0 ? void 0 : vb.width) || svgEl.clientWidth || 420;
    const h = (vb === null || vb === void 0 ? void 0 : vb.height) || svgEl.clientHeight || 420;
    const data = svgToString(svgEl);
    const blob = new Blob([data], {
      type: 'image/svg+xml;charset=utf-8'
    });
    const url = URL.createObjectURL(blob);
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = Math.round(w * scale);
      canvas.height = Math.round(h * scale);
      const ctx = canvas.getContext('2d');
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      URL.revokeObjectURL(url);
      canvas.toBlob(blob => {
        const urlPng = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = urlPng;
        a.download = filename.endsWith('.png') ? filename : filename + '.png';
        document.body.appendChild(a);
        a.click();
        a.remove();
        setTimeout(() => URL.revokeObjectURL(urlPng), 1000);
      }, 'image/png');
    };
    img.src = url;
  }
  render();
  fetch('images/brick1.svg').then(r => r.text()).then(txt => {
    BRICK_SRC = `data:image/svg+xml;base64,${btoa(txt)}`;
    renderView();
  });
})();
