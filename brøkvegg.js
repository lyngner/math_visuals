(function(){
  const SVG_NS = 'http://www.w3.org/2000/svg';
  const TEXT_MODES = ['fraction','percent','decimal'];
  const MODE_LABELS = {
    fraction: 'brøk',
    percent: 'prosent',
    decimal: 'desimaltall'
  };
  const DEFAULT_DENOMS = [1, 2, 3, 4, 5, 6, 8, 9, 10, 12];
  const COLOR_PALETTE = ['#B25FE3', '#6C1BA2', '#534477', '#873E79', '#BF4474', '#E31C3D'];
  const TEXT_COLOR_DARK = '#0f172a';
  const TEXT_COLOR_LIGHT = '#ffffff';
  const TILE_AREA_WIDTH = 800;
  const LABEL_WIDTH = 140;
  const ROW_HEIGHT = 72;
  const ROW_GAP = 16;
  const MARGIN_X = 32;
  const MARGIN_Y = 32;
  const TILE_RADIUS = 14;
  const MIN_SCALE = 0.35;
  const MAX_SCALE = 1.05;
  const DEFAULT_DECIMAL_DIGITS = 3;
  const DEFAULT_PERCENT_DIGITS = 1;
  const MAX_DECIMAL_DIGITS = 4;
  const MAX_PERCENT_DIGITS = 3;

  function parseHexColor(hex){
    if(typeof hex !== 'string') return null;
    const match = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
    if(!match) return null;
    const value = match[1];
    return {
      r: parseInt(value.slice(0, 2), 16),
      g: parseInt(value.slice(2, 4), 16),
      b: parseInt(value.slice(4, 6), 16)
    };
  }

  function srgbToLinear(value){
    const channel = value / 255;
    return channel <= 0.03928 ? channel / 12.92 : Math.pow((channel + 0.055) / 1.055, 2.4);
  }

  function relativeLuminance(r, g, b){
    const R = srgbToLinear(r);
    const G = srgbToLinear(g);
    const B = srgbToLinear(b);
    return 0.2126 * R + 0.7152 * G + 0.0722 * B;
  }

  function luminanceFromHex(hex){
    const rgb = parseHexColor(hex);
    if(!rgb) return null;
    return relativeLuminance(rgb.r, rgb.g, rgb.b);
  }

  const DARK_TEXT_LUMINANCE = luminanceFromHex(TEXT_COLOR_DARK) ?? 0;
  const LIGHT_TEXT_LUMINANCE = luminanceFromHex(TEXT_COLOR_LIGHT) ?? 1;

  function contrastRatio(l1, l2){
    const lighter = Math.max(l1, l2);
    const darker = Math.min(l1, l2);
    return (lighter + 0.05) / (darker + 0.05);
  }

  function pickTileTextColor(backgroundHex){
    const bgLuminance = luminanceFromHex(backgroundHex);
    if(bgLuminance == null) return TEXT_COLOR_DARK;
    const darkContrast = contrastRatio(bgLuminance, DARK_TEXT_LUMINANCE);
    const lightContrast = contrastRatio(bgLuminance, LIGHT_TEXT_LUMINANCE);
    return darkContrast >= lightContrast ? TEXT_COLOR_DARK : TEXT_COLOR_LIGHT;
  }

  const svg = document.getElementById('fractionWallSvg');
  if(!svg) return;

  const denomInput = document.getElementById('denominatorInput');
  const showLabelsCheckbox = document.getElementById('showRowLabels');
  const textScaleRange = document.getElementById('textScale');
  const textScaleValue = document.getElementById('textScaleValue');
  const decimalDigitsInput = document.getElementById('decimalDigits');
  const percentDigitsInput = document.getElementById('percentDigits');
  const presetButtons = document.querySelectorAll('[data-denom-preset]');
  const setModeButtons = document.querySelectorAll('[data-set-mode]');
  const resetModesButton = document.getElementById('resetModes');
  const downloadSvgButton = document.getElementById('btnDownloadSvg');
  const downloadPngButton = document.getElementById('btnDownloadPng');

  const STATE = (window.STATE && typeof window.STATE === 'object') ? window.STATE : {};
  window.STATE = STATE;

  function clamp(value, min, max){
    if(!Number.isFinite(value)) return min;
    if(value < min) return min;
    if(value > max) return max;
    return value;
  }

  function clampInt(value, min, max, fallback){
    const num = Number.parseInt(value, 10);
    if(!Number.isFinite(num)) return clamp(fallback, min, max);
    return clamp(num, min, max);
  }

  function sanitizeDenominators(value){
    if(Array.isArray(value)){
      return value
        .map(v => Number.parseInt(v, 10))
        .filter(v => Number.isFinite(v) && v > 0 && v <= 48)
        .filter((v, idx, arr) => arr.indexOf(v) === idx)
        .sort((a, b) => a - b);
    }
    if(typeof value === 'string'){
      const parts = value.split(/[^0-9]+/);
      const numbers = [];
      for(const part of parts){
        if(!part) continue;
        const num = Number.parseInt(part, 10);
        if(Number.isFinite(num) && num > 0 && num <= 48) numbers.push(num);
      }
      return sanitizeDenominators(numbers);
    }
    return [];
  }

  function ensureStateDefaults(){
    const denoms = sanitizeDenominators(STATE.denominators);
    STATE.denominators = denoms.length ? denoms : DEFAULT_DENOMS.slice();
    if(!STATE.tileModes || typeof STATE.tileModes !== 'object') STATE.tileModes = {};
    if(!TEXT_MODES.includes(STATE.defaultMode)) STATE.defaultMode = 'fraction';
    STATE.showLabels = typeof STATE.showLabels === 'boolean' ? STATE.showLabels : true;
    const scale = Number(STATE.textScale);
    STATE.textScale = clamp(Number.isFinite(scale) ? scale : 0.7, MIN_SCALE, MAX_SCALE);
    STATE.decimalDigits = clampInt(STATE.decimalDigits, 0, MAX_DECIMAL_DIGITS, DEFAULT_DECIMAL_DIGITS);
    STATE.percentDigits = clampInt(STATE.percentDigits, 0, MAX_PERCENT_DIGITS, DEFAULT_PERCENT_DIGITS);
  }

  ensureStateDefaults();

  function cleanTileModes(){
    const validKeys = new Set();
    for(const den of STATE.denominators){
      for(let i=0;i<den;i++){
        validKeys.add(`${den}:${i}`);
      }
    }
    Object.keys(STATE.tileModes).forEach(key => {
      const mode = STATE.tileModes[key];
      if(!validKeys.has(key) || !TEXT_MODES.includes(mode)){
        delete STATE.tileModes[key];
      }
    });
  }

  cleanTileModes();

  function updateModeButtons(){
    setModeButtons.forEach(btn => {
      if(!btn || !btn.dataset.setMode) return;
      btn.classList.toggle('is-active', btn.dataset.setMode === STATE.defaultMode);
    });
  }

  function updateTextScaleDisplay(){
    if(textScaleValue){
      const percentage = Math.round(STATE.textScale * 100);
      textScaleValue.textContent = `${percentage}%`;
    }
  }

  function updateControlsFromState(){
    if(denomInput){
      const joined = STATE.denominators.join(', ');
      denomInput.value = joined;
    }
    if(showLabelsCheckbox) showLabelsCheckbox.checked = !!STATE.showLabels;
    if(textScaleRange) textScaleRange.value = String(STATE.textScale);
    if(decimalDigitsInput) decimalDigitsInput.value = String(STATE.decimalDigits);
    if(percentDigitsInput) percentDigitsInput.value = String(STATE.percentDigits);
    updateTextScaleDisplay();
    updateModeButtons();
  }

  updateControlsFromState();

  function createSvgElement(name, attrs){
    const el = document.createElementNS(SVG_NS, name);
    if(attrs){
      for(const [key, value] of Object.entries(attrs)){
        if(value == null) continue;
        if(key === 'textContent') el.textContent = value;
        else el.setAttribute(key, value);
      }
    }
    return el;
  }

  function lightenColor(hex, amount){
    if(typeof hex !== 'string') return hex;
    const match = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
    if(!match) return hex;
    const base = match[1];
    const r = parseInt(base.slice(0,2), 16);
    const g = parseInt(base.slice(2,4), 16);
    const b = parseInt(base.slice(4,6), 16);
    const ratio = clamp(Number(amount) || 0, 0, 1);
    const mix = (channel) => Math.round(channel + (255 - channel) * ratio);
    const nr = mix(r);
    const ng = mix(g);
    const nb = mix(b);
    return `#${nr.toString(16).padStart(2,'0')}${ng.toString(16).padStart(2,'0')}${nb.toString(16).padStart(2,'0')}`;
  }

  function getTileMode(den, index){
    const key = `${den}:${index}`;
    const stored = STATE.tileModes[key];
    if(TEXT_MODES.includes(stored)) return stored;
    return STATE.defaultMode;
  }

  function setTileMode(den, index, mode){
    const key = `${den}:${index}`;
    if(!TEXT_MODES.includes(mode)) return;
    if(mode === STATE.defaultMode){
      delete STATE.tileModes[key];
    }else{
      STATE.tileModes[key] = mode;
    }
  }

  function cycleTileMode(den, index){
    const current = getTileMode(den, index);
    const idx = TEXT_MODES.indexOf(current);
    const next = TEXT_MODES[(idx + 1) % TEXT_MODES.length];
    setTileMode(den, index, next);
    render();
  }

  function formatFraction(den){
    if(den === 1) return '1';
    return `1/${den}`;
  }

  const decimalFormatterCache = new Map();
  function formatDecimal(value, digits){
    const key = `${digits}`;
    let formatter = decimalFormatterCache.get(key);
    if(!formatter){
      formatter = new Intl.NumberFormat('nb-NO', {
        minimumFractionDigits: digits,
        maximumFractionDigits: digits
      });
      decimalFormatterCache.set(key, formatter);
    }
    return formatter.format(value);
  }

  function formatValue(mode, den){
    switch(mode){
      case 'percent':
        return `${formatDecimal(100 / den, STATE.percentDigits)}%`;
      case 'decimal':
        return formatDecimal(1 / den, STATE.decimalDigits);
      case 'fraction':
      default:
        return formatFraction(den);
    }
  }

  function tileAriaLabel(den, index, mode){
    const position = index + 1;
    const total = den;
    const label = MODE_LABELS[mode] || mode;
    return `Del ${position} av ${total}. Viser ${label}. Klikk for å bytte visning.`;
  }

  function createFractionGroup(den, centerX, centerY, tileWidth, textColor){
    const group = createSvgElement('g', {'aria-hidden': 'true'});
    const fontSize = Math.max(10, Math.min(ROW_HEIGHT * STATE.textScale, tileWidth * 0.6));
    const spacing = fontSize * 0.75;
    const numerator = createSvgElement('text', {
      x: centerX,
      y: centerY - spacing / 2,
      textContent: '1'
    });
    numerator.setAttribute('fill', textColor);
    numerator.style.fill = textColor;
    numerator.style.fontSize = `${fontSize}px`;

    const denominator = createSvgElement('text', {
      x: centerX,
      y: centerY + spacing / 2,
      textContent: String(den)
    });
    denominator.setAttribute('fill', textColor);
    denominator.style.fill = textColor;
    denominator.style.fontSize = `${fontSize}px`;

    const lineLength = Math.min(tileWidth * 0.6, fontSize * 1.8);
    const line = createSvgElement('line', {
      x1: centerX - lineLength / 2,
      y1: centerY,
      x2: centerX + lineLength / 2,
      y2: centerY,
      stroke: textColor,
      'stroke-width': Math.max(2, fontSize * 0.12),
      'stroke-linecap': 'round',
      'aria-hidden': 'true'
    });

    group.appendChild(numerator);
    group.appendChild(line);
    group.appendChild(denominator);
    return group;
  }

  function render(){
    ensureStateDefaults();
    cleanTileModes();
    updateControlsFromState();

    const denominators = STATE.denominators;
    const labelWidth = STATE.showLabels ? LABEL_WIDTH : 0;
    const contentHeight = denominators.length * ROW_HEIGHT + Math.max(0, denominators.length - 1) * ROW_GAP;
    const totalHeight = contentHeight + MARGIN_Y * 2;
    const totalWidth = MARGIN_X * 2 + labelWidth + TILE_AREA_WIDTH;

    svg.setAttribute('viewBox', `0 0 ${totalWidth} ${Math.max(totalHeight, 120)}`);

    const fragment = document.createDocumentFragment();
    const title = createSvgElement('title', {id:'fractionWallTitle', textContent:'Brøkvegg'});
    const descText = denominators.length ? `Viser rader for nevnerne ${denominators.join(', ')}.` : 'Ingen rader valgt.';
    const desc = createSvgElement('desc', {id:'fractionWallDesc', textContent:descText});
    fragment.appendChild(title);
    fragment.appendChild(desc);

    let y = MARGIN_Y;
    denominators.forEach((den, rowIndex) => {
      const rowGroup = createSvgElement('g', {transform:`translate(${MARGIN_X}, ${y})`});
      const baseColor = COLOR_PALETTE[rowIndex % COLOR_PALETTE.length] || '#B25FE3';

      if(STATE.showLabels){
        const labelGroup = createSvgElement('g');
        const rect = createSvgElement('rect', {
          class: 'rowLabelRect',
          x: 0,
          y: 0,
          width: LABEL_WIDTH,
          height: ROW_HEIGHT,
          rx: 12,
          ry: 12,
          fill: lightenColor(baseColor, 0.6),
          stroke: lightenColor(baseColor, 0.25),
          'stroke-width': 2,
          'aria-hidden': 'true'
        });
        const labelText = createSvgElement('text', {
          class: 'rowLabelText',
          x: LABEL_WIDTH / 2,
          y: ROW_HEIGHT / 2 - 6,
          'aria-hidden': 'true'
        });
        labelText.textContent = String(den);
        const subLabel = createSvgElement('text', {
          class: 'rowLabelSub',
          x: LABEL_WIDTH / 2,
          y: ROW_HEIGHT / 2 + 4,
          'aria-hidden': 'true'
        });
        subLabel.textContent = den === 1 ? 'hel' : `${den} deler`;
        labelGroup.appendChild(rect);
        labelGroup.appendChild(labelText);
        labelGroup.appendChild(subLabel);
        rowGroup.appendChild(labelGroup);
      }

      const tilesGroup = createSvgElement('g', {
        transform: `translate(${STATE.showLabels ? LABEL_WIDTH : 0}, 0)`
      });
      const tileWidth = TILE_AREA_WIDTH / den;
      for(let i=0;i<den;i++){
        const mode = getTileMode(den, i);
        const displayValue = formatValue(mode, den);
        const tile = createSvgElement('g', {
          class: 'tile',
          tabindex: '0',
          role: 'button',
          'data-denominator': String(den),
          'data-index': String(i),
          'aria-label': tileAriaLabel(den, i, mode)
        });
        const tileX = tileWidth * i;
        const color = i % 2 === 0 ? baseColor : lightenColor(baseColor, 0.12);
        const textColor = pickTileTextColor(color);
        const tooltip = createSvgElement('title', {
          textContent: `${displayValue} – ${MODE_LABELS[mode] || mode}`
        });
        const cornerRadius = Math.min(TILE_RADIUS, tileWidth / 2);
        const rect = createSvgElement('rect', {
          x: tileX,
          y: 0,
          width: tileWidth,
          height: ROW_HEIGHT,
          rx: cornerRadius,
          ry: cornerRadius,
          fill: color,
          'aria-hidden': 'true'
        });
        tile.appendChild(tooltip);
        tile.appendChild(rect);
        if(mode === 'fraction' && den > 1){
          const fractionGroup = createFractionGroup(den, tileX + tileWidth / 2, ROW_HEIGHT / 2, tileWidth, textColor);
          tile.appendChild(fractionGroup);
        }else{
          const text = createSvgElement('text', {
            x: tileX + tileWidth / 2,
            y: ROW_HEIGHT / 2
          });
          const fontSize = Math.max(10, Math.min(ROW_HEIGHT * STATE.textScale, tileWidth * 0.8));
          text.textContent = displayValue;
          text.setAttribute('fill', textColor);
          text.style.fill = textColor;
          text.style.fontSize = `${fontSize}px`;
          tile.appendChild(text);
        }
        tile.addEventListener('click', (event)=>{
          event.preventDefault();
          cycleTileMode(den, i);
        });
        tile.addEventListener('keydown', (event)=>{
          if(event.key === 'Enter' || event.key === ' ' || event.key === 'Spacebar'){
            event.preventDefault();
            cycleTileMode(den, i);
          }
        });
        tilesGroup.appendChild(tile);
      }

      rowGroup.appendChild(tilesGroup);
      fragment.appendChild(rowGroup);
      y += ROW_HEIGHT + ROW_GAP;
    });

    svg.replaceChildren(fragment);
  }

  render();
  window.render = render;

  function setDenominatorsFromInput(raw){
    const parsed = sanitizeDenominators(raw);
    STATE.denominators = parsed.length ? parsed : DEFAULT_DENOMS.slice();
    cleanTileModes();
    render();
  }

  denomInput?.addEventListener('change', (event)=>{
    setDenominatorsFromInput(event.target.value);
  });
  denomInput?.addEventListener('blur', (event)=>{
    setDenominatorsFromInput(event.target.value);
  });

  presetButtons.forEach(btn => {
    btn.addEventListener('click', ()=>{
      const preset = btn.dataset.denomPreset || '';
      setDenominatorsFromInput(preset);
    });
  });

  showLabelsCheckbox?.addEventListener('change', ()=>{
    STATE.showLabels = !!showLabelsCheckbox.checked;
    render();
  });

  textScaleRange?.addEventListener('input', ()=>{
    const value = Number(textScaleRange.value);
    STATE.textScale = clamp(value, MIN_SCALE, MAX_SCALE);
    updateTextScaleDisplay();
    render();
  });

  decimalDigitsInput?.addEventListener('change', ()=>{
    STATE.decimalDigits = clampInt(decimalDigitsInput.value, 0, MAX_DECIMAL_DIGITS, STATE.decimalDigits);
    render();
  });

  percentDigitsInput?.addEventListener('change', ()=>{
    STATE.percentDigits = clampInt(percentDigitsInput.value, 0, MAX_PERCENT_DIGITS, STATE.percentDigits);
    render();
  });

  setModeButtons.forEach(btn => {
    btn.addEventListener('click', ()=>{
      const mode = btn.dataset.setMode;
      if(!TEXT_MODES.includes(mode)) return;
      STATE.defaultMode = mode;
      STATE.tileModes = {};
      render();
    });
  });

  resetModesButton?.addEventListener('click', ()=>{
    STATE.defaultMode = 'fraction';
    STATE.tileModes = {};
    render();
  });

  function svgToString(svgEl){
    const clone = svgEl.cloneNode(true);
    const styles = Array.from(document.querySelectorAll('style'))
      .map(style => style.textContent)
      .join('\n');
    if(styles){
      const styleEl = document.createElement('style');
      styleEl.textContent = styles;
      clone.insertBefore(styleEl, clone.firstChild);
    }
    clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
    clone.setAttribute('xmlns:xlink', 'http://www.w3.org/1999/xlink');
    return `<?xml version="1.0" encoding="UTF-8"?>\n${new XMLSerializer().serializeToString(clone)}`;
  }

  function downloadSvg(svgEl, filename){
    const data = svgToString(svgEl);
    const blob = new Blob([data], {type:'image/svg+xml;charset=utf-8'});
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename.endsWith('.svg') ? filename : `${filename}.svg`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setTimeout(()=>URL.revokeObjectURL(url), 1000);
  }

  function downloadPng(svgEl, filename, scale = 2){
    const data = svgToString(svgEl);
    const blob = new Blob([data], {type:'image/svg+xml;charset=utf-8'});
    const url = URL.createObjectURL(blob);
    const img = new Image();
    img.onload = ()=>{
      const canvas = document.createElement('canvas');
      const viewBox = svgEl.viewBox?.baseVal;
      const width = viewBox ? viewBox.width : svgEl.clientWidth;
      const height = viewBox ? viewBox.height : svgEl.clientHeight;
      canvas.width = Math.round(width * scale);
      canvas.height = Math.round(height * scale);
      const ctx = canvas.getContext('2d');
      ctx.fillStyle = '#fff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      URL.revokeObjectURL(url);
      canvas.toBlob(blob => {
        if(!blob) return;
        const pngUrl = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = pngUrl;
        link.download = filename.endsWith('.png') ? filename : `${filename}.png`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        setTimeout(()=>URL.revokeObjectURL(pngUrl), 1000);
      }, 'image/png');
    };
    img.src = url;
  }

  downloadSvgButton?.addEventListener('click', ()=>{
    downloadSvg(svg, 'brokvegg');
  });

  downloadPngButton?.addEventListener('click', ()=>{
    downloadPng(svg, 'brokvegg');
  });

  window.addEventListener('examples:collect', (event)=>{
    if(!event || !event.detail) return;
    try{
      event.detail.svgOverride = svgToString(svg);
    }catch(_){ }
  });
})();
