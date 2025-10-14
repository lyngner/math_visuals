var _CFG$a11y;
/* ============ ENKEL KONFIG (FORFATTER) ============ */
const SIMPLE = {
  nBeads: 10,
  // totalt antall perler
  startIndex: 2,
  // startposisjon for klypa (antall til venstre)

  altText: '',
  altTextSource: 'auto',

  // Fasit (velg én form):
  // correct: 8, // short-hand: leftCount = 8
  correct: {
    mode: "leftCount",
    value: 8
  },
  feedback: {
    correct: "Riktig!",
    wrong: "Prøv igjen",
    showLive: true
  }
};

/* ============ ADV KONFIG (TEKNISK/VALGFRITT) ============ */
const ADV = {
  groupSize: 5,
  rBase: 42,
  gapBase: 18,
  wireY: 325,
  kW: 4.2,
  // klype-bredde = kW * r
  kH: 11.5,
  // klype-høyde  = kH * r
  clipGapRatio: 0.39,
  // ekstra gap som klypa "krever" i forhold til klype-bredde

  assets: {
    rope: "https://test.kikora.no/img/drive/illustrasjoner/Matteobjekter/Hjelpemidler/snor20.svg",
    beadRed: "https://test.kikora.no/img/drive/figures/games/spheres/redDots.svg",
    beadBlue: "https://test.kikora.no/img/drive/figures/games/spheres/blueWave.svg",
    clip: "https://test.kikora.no/img/drive/figures/objects/tools/clothesPin.svg"
  },
  a11y: {
    ariaLabel: "Posisjon for klypa. Bruk piltaster eller dra.",
    pageJump: "group",
    // "group" eller tall (f.eks. 10)
    fineStep: 3,
    // Shift+pil i px (vertikalt)
    coarseStep: 12 // Pil i px (vertikalt)
  },
  ui: {
    showGroupTicks: true,
    leftColorClass: "red",
    // samsvarer med CSS-klassene i beadFallback
    rightColorClass: "blue"
  }
};
function getThemeApi() {
  const theme = typeof window !== 'undefined' ? window.MathVisualsTheme : null;
  return theme && typeof theme === 'object' ? theme : null;
}
function applyThemeToDocument() {
  const theme = getThemeApi();
  if (theme && typeof theme.applyToDocument === 'function') {
    theme.applyToDocument(document);
  }
}
applyThemeToDocument();

/* ============ DERIVERT KONFIG FOR RENDER (IKKE REDIGER) ============ */
function makeCFG() {
  var _SIMPLE$beadRadius;
  const rBase = (_SIMPLE$beadRadius = SIMPLE.beadRadius) !== null && _SIMPLE$beadRadius !== void 0 ? _SIMPLE$beadRadius : ADV.rBase;
  const scale = rBase / ADV.rBase;
  const gapBase = ADV.gapBase * scale;
  return {
    nBeads: SIMPLE.nBeads,
    startIndex: clamp(SIMPLE.startIndex, 0, SIMPLE.nBeads),
    groupSize: ADV.groupSize,
    rBase,
    gapBase,
    wireY: ADV.wireY,
    kW: ADV.kW,
    kH: ADV.kH,
    clipGapRatio: ADV.clipGapRatio,
    assets: ADV.assets,
    a11y: ADV.a11y,
    ui: ADV.ui
  };
}
let CFG = makeCFG();

/* ============ DOM & VIEWBOX ============ */
const svg = document.getElementById("beadSVG");
const VB_W = 1400,
  VB_H = 460;
const LM = 80,
  RM = 80; // marger
const INNER = VB_W - LM - RM;

/* ============ LAG ============ */
const gRope = mk("g");
const gLeft = mk("g"); // perler til venstre (under klypa)
const gClip = mk("g", {
  class: "clip"
});
const gRight = mk("g"); // perler til høyre (over klypa)
svg.append(gRope, gLeft, gClip, gRight);

/* Tastatur/drag-overlay (legges FØR hendelser) */
const overlay = rect(0, 0, VB_W, VB_H, {
  fill: "transparent",
  class: "slider",
  tabindex: 0,
  role: "slider",
  "aria-valuemin": "0",
  "aria-valuemax": String(CFG.nBeads),
  "aria-valuenow": "0",
  "aria-label": ((_CFG$a11y = CFG.a11y) === null || _CFG$a11y === void 0 ? void 0 : _CFG$a11y.ariaLabel) || "Posisjon for klypa. Bruk piltastene eller dra.",
  "aria-describedby": "beadHelp"
});
overlay.style.cursor = "ew-resize";
svg.appendChild(overlay);

/* ============ STATE (init via applyConfig) ============ */
let r, gap, pitch, CLIP_W, CLIP_H, CLIP_GAP;
let centers = [];
let gapMids = [];
let idx = 0; // antall perler til venstre
let clipY = 0;
let CLIP_Y_MIN = -100,
  CLIP_Y_MAX = 100;
let CLIP_TOUCH_TOP = 0,
  CLIP_TOUCH_BOTTOM = 0;
const btnSvg = document.getElementById('btnSvg');
const btnPng = document.getElementById('btnPng');
const exportCard = document.getElementById('exportCard');
let altTextManager = null;
btnSvg === null || btnSvg === void 0 || btnSvg.addEventListener('click', () => downloadSVG(svg, 'perlesnor.svg'));
btnPng === null || btnPng === void 0 || btnPng.addEventListener('click', () => downloadPNG(svg, 'perlesnor.png', 2));
setupSettingsUI();
applyConfig();
initAltTextManager();
if (typeof window !== 'undefined' && typeof window.addEventListener === 'function') {
  window.addEventListener('message', event => {
    const data = event && event.data;
    const type = typeof data === 'string' ? data : data && data.type;
    if (type !== 'math-visuals:profile-change') return;
    applyThemeToDocument();
  });
}

/* ============ INTERAKSJON ============ */
let dragging = false;
let draggingClip = false;
let dragStartPointerY = 0;
let dragStartClipY = 0;
overlay.addEventListener("pointerdown", e => {
  dragging = true;
  overlay.setPointerCapture(e.pointerId);
  const p = pt(e);
  setIndex(nearestIndex(p.x));
  const clipTop = CLIP_TOUCH_TOP + clipY;
  const clipBottom = CLIP_TOUCH_BOTTOM + clipY;
  if (p.y >= clipTop && p.y <= clipBottom) {
    draggingClip = true;
    dragStartPointerY = p.y;
    dragStartClipY = clipY;
  } else {
    draggingClip = false;
    setClipYFromPoint(p.y);
  }
});
overlay.addEventListener("pointermove", e => {
  if (!dragging) return;
  const p = pt(e);
  setIndex(nearestIndex(p.x));
  if (draggingClip) {
    setClipY(dragStartClipY + (p.y - dragStartPointerY));
  } else {
    setClipYFromPoint(p.y);
  }
});
overlay.addEventListener("pointerup", e => {
  dragging = false;
  draggingClip = false;
  overlay.releasePointerCapture(e.pointerId);
});
overlay.addEventListener("pointercancel", () => {
  dragging = false;
  draggingClip = false;
});
overlay.addEventListener("keydown", e => {
  var _CFG$a11y$fineStep, _CFG$a11y2, _CFG$a11y$coarseStep, _CFG$a11y3, _CFG$a11y4, _CFG$a11y5;
  let used = true;
  const fine = (_CFG$a11y$fineStep = (_CFG$a11y2 = CFG.a11y) === null || _CFG$a11y2 === void 0 ? void 0 : _CFG$a11y2.fineStep) !== null && _CFG$a11y$fineStep !== void 0 ? _CFG$a11y$fineStep : 3;
  const coarse = (_CFG$a11y$coarseStep = (_CFG$a11y3 = CFG.a11y) === null || _CFG$a11y3 === void 0 ? void 0 : _CFG$a11y3.coarseStep) !== null && _CFG$a11y$coarseStep !== void 0 ? _CFG$a11y$coarseStep : 12;
  const pageJump = ((_CFG$a11y4 = CFG.a11y) === null || _CFG$a11y4 === void 0 ? void 0 : _CFG$a11y4.pageJump) === "group" ? CFG.groupSize : Number.isFinite((_CFG$a11y5 = CFG.a11y) === null || _CFG$a11y5 === void 0 ? void 0 : _CFG$a11y5.pageJump) ? CFG.a11y.pageJump : CFG.groupSize;
  switch (e.key) {
    case "ArrowRight":
      setIndex(idx + 1);
      break;
    case "ArrowLeft":
      setIndex(idx - 1);
      break;
    case "ArrowUp":
      setClipY(clipY - (e.shiftKey ? fine : coarse));
      break;
    case "ArrowDown":
      setClipY(clipY + (e.shiftKey ? fine : coarse));
      break;
    case "Home":
      setIndex(0);
      break;
    case "End":
      setIndex(CFG.nBeads);
      break;
    case "PageUp":
      setIndex(idx + pageJump);
      break;
    case "PageDown":
      setIndex(idx - pageJump);
      break;
    default:
      used = false;
  }
  if (used) {
    e.preventDefault();
    e.stopPropagation();
  }
});

/* ============ FUNKSJONER ============ */

function layout() {
  var _CFG$ui;
  // Skala s ≤ 1 som garanterer plass til maks-behov (inkl. klypegap)
  const R = CFG.rBase,
    G = CFG.gapBase;
  const clipExtraBase = CFG.clipGapRatio * (CFG.kW * R);
  const totalBase = 2 * R + (CFG.nBeads - 1) * (2 * R + G) + clipExtraBase;
  const s = Math.min(1, INNER / totalBase);
  r = R * s;
  gap = G * s;
  pitch = 2 * r + gap;
  CLIP_W = CFG.kW * r;
  CLIP_H = CFG.kH * r;
  CLIP_GAP = CFG.clipGapRatio * CLIP_W;
  centers = [];
  for (let i = 0; i < CFG.nBeads; i++) {
    centers.push(LM + r + i * pitch);
  }

  // snor
  gRope.innerHTML = "";
  const ropeH = r * 1.6;
  gRope.appendChild(img(CFG.assets.rope, 20, CFG.wireY - ropeH / 2, VB_W - 40, ropeH));

  // Valgfritt: lette gruppedelere (hver groupSize)
  if ((_CFG$ui = CFG.ui) !== null && _CFG$ui !== void 0 && _CFG$ui.showGroupTicks) {
    for (let i = CFG.groupSize; i < CFG.nBeads; i += CFG.groupSize) {
      const x = (centers[i - 1] + centers[i]) / 2;
      gRope.appendChild(mk("line", {
        x1: x,
        y1: CFG.wireY - ropeH * 0.75,
        x2: x,
        y2: CFG.wireY + ropeH * 0.75,
        stroke: "#000",
        "stroke-opacity": 0.08
      }));
    }
  }

  // klype (bygges på nytt i riktig størrelse)
  gClip.innerHTML = "";
  gClip.appendChild(img(CFG.assets.clip, -CLIP_W / 2, CFG.wireY - CLIP_H, CLIP_W, CLIP_H));
  const touchPadX = Math.max(gap * 0.75, CLIP_W * 0.15);
  const touchPadTop = CLIP_H * 0.35;
  const touchPadBottom = CLIP_H * 0.35;
  CLIP_TOUCH_TOP = CFG.wireY - CLIP_H - touchPadTop;
  CLIP_TOUCH_BOTTOM = CFG.wireY + touchPadBottom;
  const hitW = CLIP_W + touchPadX * 2;
  const hitH = CLIP_TOUCH_BOTTOM - CLIP_TOUCH_TOP;
  gClip.appendChild(rect(-hitW / 2, CLIP_TOUCH_TOP, hitW, hitH, {
    fill: "transparent"
  }));

  // tillatt Y-område for klypa (synlig i viewBox)
  CLIP_Y_MIN = -(CFG.wireY - 20);
  CLIP_Y_MAX = VB_H - (CFG.wireY + 20) - CLIP_H * 0.15;

  // eksakte gap-midt for robust snapping
  gapMids = [];
  gapMids.push(centers[0] - r * 0.95); // før første perle
  for (let i = 1; i < CFG.nBeads; i++) {
    gapMids.push((centers[i - 1] + centers[i]) / 2);
  }
  gapMids.push(centers[CFG.nBeads - 1] + r * 0.95); // etter siste perle
}
function draw() {
  gLeft.innerHTML = "";
  gRight.innerHTML = "";
  const shift = idx < CFG.nBeads ? CLIP_GAP : 0;
  for (let i = 0; i < CFG.nBeads; i++) {
    var _CFG$ui2, _CFG$ui3, _CFG$ui4;
    const colorClass = Math.floor(i / CFG.groupSize) % 2 === 0 ? ((_CFG$ui2 = CFG.ui) === null || _CFG$ui2 === void 0 ? void 0 : _CFG$ui2.leftColorClass) || "red" : ((_CFG$ui3 = CFG.ui) === null || _CFG$ui3 === void 0 ? void 0 : _CFG$ui3.rightColorClass) || "blue";
    const cx = centers[i] + (i >= idx ? shift : 0);
    const grp = i < idx ? gLeft : gRight;

    // fallback-sirkel vises umiddelbart
    grp.appendChild(circle(cx, CFG.wireY, r, `beadFallback ${colorClass}`));

    // svg-bilde oppå (hvis lastet)
    const href = colorClass === (((_CFG$ui4 = CFG.ui) === null || _CFG$ui4 === void 0 ? void 0 : _CFG$ui4.leftColorClass) || "red") ? CFG.assets.beadRed : CFG.assets.beadBlue;
    grp.appendChild(img(href, cx - r, CFG.wireY - r, r * 2, r * 2, "beadShadow"));
  }

  // klypeposisjon i gap-midt, og halvparten av gap-shift til høyre
  const clipX = gapMids[idx] + (idx === CFG.nBeads ? 0 : shift / 2);
  gClip.setAttribute("transform", `translate(${clipX},${clipY})`);
  overlay.setAttribute("aria-valuenow", String(idx));
  overlay.setAttribute("aria-valuetext", `${idx} til venstre, ${CFG.nBeads - idx} til høyre`);
  updateFeedbackUI();
}
function setIndex(v) {
  const cl = clamp(v, 0, CFG.nBeads);
  if (cl !== idx) {
    idx = cl;
    draw();
    syncAltText('interaction');
  }
}
function setClipYFromPoint(py) {
  setClipY(clamp(py - CFG.wireY, CLIP_Y_MIN, CLIP_Y_MAX));
}
function setClipY(v) {
  const cl = clamp(v, CLIP_Y_MIN, CLIP_Y_MAX);
  if (cl !== clipY) {
    clipY = cl;
    draw();
  }
}

/* Bruker gapMids og binærsøk for å finne nærmeste index */
function nearestIndex(x) {
  let lo = 0,
    hi = gapMids.length - 1;
  while (hi - lo > 1) {
    const mid = lo + hi >> 1;
    if (x < gapMids[mid]) hi = mid;else lo = mid;
  }
  return Math.abs(x - gapMids[lo]) <= Math.abs(x - gapMids[hi]) ? lo : hi;
}
function applyConfig() {
  CFG = makeCFG();
  idx = clamp(CFG.startIndex, 0, CFG.nBeads);
  clipY = 0;
  overlay.setAttribute("aria-valuemax", String(CFG.nBeads));
  overlay.setAttribute("aria-valuenow", String(idx));
  layout();
  draw();
  syncAltText('config');
}
function setupSettingsUI() {
  var _SIMPLE$correct;
  const nInput = document.getElementById("cfg-nBeads");
  const startInput = document.getElementById("cfg-startIndex");
  const correctInput = document.getElementById("cfg-correct");
  if (!nInput || !startInput || !correctInput) return;
  nInput.value = SIMPLE.nBeads;
  startInput.value = SIMPLE.startIndex;
  if (((_SIMPLE$correct = SIMPLE.correct) === null || _SIMPLE$correct === void 0 ? void 0 : _SIMPLE$correct.value) != null) correctInput.value = SIMPLE.correct.value;
  startInput.max = correctInput.max = SIMPLE.nBeads;
  function update() {
    SIMPLE.nBeads = parseInt(nInput.value) || SIMPLE.nBeads;
    startInput.max = correctInput.max = SIMPLE.nBeads;
    SIMPLE.startIndex = parseInt(startInput.value) || 0;
    const c = parseInt(correctInput.value);
    if (!isNaN(c)) SIMPLE.correct = {
      mode: "leftCount",
      value: c
    };
    applyConfig();
  }
  nInput.addEventListener("change", update);
  startInput.addEventListener("change", update);
  correctInput.addEventListener("change", update);
}

/* ===== Riktig/vurdering ===== */
function normalizeCorrect(simple, nBeads) {
  const c = simple.correct;
  if (typeof c === "number") {
    return {
      mode: "leftCount",
      value: c
    }; // short-hand
  }
  if (!c || typeof c !== "object") {
    return null;
  }
  const mode = c.mode || "leftCount";
  const out = {
    mode
  };
  if (Array.isArray(c.values)) out.values = [...c.values];
  if (Array.isArray(c.range) && c.range.length === 2) out.range = [c.range[0], c.range[1]];
  if (typeof c.value === "number") out.value = c.value;
  const clamp01 = v => Math.max(0, Math.min(nBeads, v));
  if (out.value != null) out.value = clamp01(out.value);
  if (out.values) out.values = out.values.map(clamp01);
  if (out.range) out.range = [clamp01(out.range[0]), clamp01(out.range[1])];
  return out;
}
function evaluateCorrect(idx, simple, nBeads) {
  const rule = normalizeCorrect(simple, nBeads);
  if (!rule) return {
    ok: false,
    reason: "Ingen fasit definert"
  };
  const left = idx;
  const right = nBeads - idx;
  const inSet = (v, arr) => arr && arr.includes(v);
  const inRange = (v, rng) => rng && v >= rng[0] && v <= rng[1];
  let ok = false;
  switch (rule.mode) {
    case "leftCount":
      if (rule.value != null) ok = left === rule.value;else if (rule.values) ok = inSet(left, rule.values);else if (rule.range) ok = inRange(left, rule.range);
      break;
    case "rightCount":
      if (rule.value != null) ok = right === rule.value;else if (rule.values) ok = inSet(right, rule.values);else if (rule.range) ok = inRange(right, rule.range);
      break;
    case "index":
      if (rule.value != null) ok = idx === rule.value;else if (rule.values) ok = inSet(idx, rule.values);else if (rule.range) ok = inRange(idx, rule.range);
      break;
    case "indexSet":
      ok = inSet(idx, rule.values || []);
      break;
    default:
      ok = false;
  }
  const fb = simple.feedback || {};
  const reason = ok ? fb.correct || "Riktig!" : fb.wrong || "Prøv igjen";
  return {
    ok,
    reason
  };
}

/* Minimal UI-hook: marker korrekthet + a11y-tekst */
function updateFeedbackUI() {
  var _SIMPLE$feedback;
  const res = evaluateCorrect(idx, SIMPLE, SIMPLE.nBeads);
  if ((_SIMPLE$feedback = SIMPLE.feedback) !== null && _SIMPLE$feedback !== void 0 && _SIMPLE$feedback.showLive) {
    svg.setAttribute("data-correct", res.ok ? "true" : "false");
    overlay.setAttribute("aria-valuetext", `${idx} til venstre, ${SIMPLE.nBeads - idx} til høyre – ${res.reason}`);
  }
}

/* ===== ALT-TEKST ===== */
function initAltTextManager() {
  if (!window.MathVisAltText || !exportCard) return;
  altTextManager = window.MathVisAltText.create({
    svg,
    container: exportCard,
    getTitle: () => document.title || 'Perlesnor',
    getState: () => ({
      text: typeof SIMPLE.altText === 'string' ? SIMPLE.altText : '',
      source: SIMPLE.altTextSource === 'manual' ? 'manual' : 'auto'
    }),
    setState: (text, source) => {
      SIMPLE.altText = text;
      SIMPLE.altTextSource = source === 'manual' ? 'manual' : 'auto';
    },
    generate: () => buildPerlesnorAltText(),
    getSignature: () => buildPerlesnorAltText(),
    getAutoMessage: reason => reason && reason.startsWith('manual') ? 'Alternativ tekst oppdatert.' : 'Alternativ tekst oppdatert automatisk.',
    getManualMessage: () => 'Alternativ tekst oppdatert manuelt.'
  });
  if (altTextManager) {
    altTextManager.applyCurrent();
    syncAltText('init');
  }
}

function syncAltText(reason) {
  const signature = buildPerlesnorAltText();
  if (altTextManager && typeof altTextManager.refresh === 'function') {
    altTextManager.refresh(reason || 'auto', signature);
  } else if (altTextManager && typeof altTextManager.notifyFigureChange === 'function') {
    altTextManager.notifyFigureChange(signature);
  }
}

function buildPerlesnorAltText() {
  const total = CFG.nBeads;
  const left = idx;
  const right = total - left;
  const sentences = [];
  sentences.push(`Figuren viser en perlesnor med ${formatCount(total, 'perle')} fordelt på to farger.`);
  sentences.push(`Klypa deler snoren slik at ${formatCount(left, 'perle')} ligger til venstre og ${formatCount(right, 'perle')} til høyre.`);
  if (CFG.groupSize > 1) {
    sentences.push(`Perlene er markert i grupper på ${CFG.groupSize}.`);
  }
  const rule = normalizeCorrect(SIMPLE, CFG.nBeads);
  const ruleSentence = describeCorrectRule(rule);
  if (ruleSentence) sentences.push(ruleSentence);
  return sentences.join(' ');
}

function formatCount(n, singular) {
  const abs = Math.abs(n);
  const word = abs === 1 ? singular : `${singular}r`;
  return `${n} ${word}`;
}

function formatNumberList(values) {
  if (!Array.isArray(values) || values.length === 0) return '';
  const unique = [...new Set(values)].sort((a, b) => a - b);
  if (unique.length === 1) return String(unique[0]);
  const last = unique[unique.length - 1];
  const rest = unique.slice(0, -1);
  return `${rest.join(', ')} eller ${last}`;
}

function describeRange(range) {
  if (!Array.isArray(range) || range.length !== 2) return '';
  const [min, max] = range;
  if (min === max) return String(min);
  return `${min}–${max}`;
}

function describeCorrectRule(rule) {
  if (!rule) return '';
  const targetSide = side => side === 'left' ? 'til venstre for klypa' : side === 'right' ? 'til høyre for klypa' : 'på posisjonen til klypa';
  const buildSentence = (side, ruleData) => {
    if (!ruleData) return '';
    if (ruleData.value != null) {
      return `Målet er at ${formatCount(ruleData.value, 'perle')} skal ligge ${targetSide(side)}.`;
    }
    if (ruleData.values && ruleData.values.length) {
      return `Målet er at ${targetSide(side)} skal være ${formatNumberList(ruleData.values)} perler.`;
    }
    if (ruleData.range && ruleData.range.length === 2) {
      return `Målet er at ${targetSide(side)} skal være mellom ${describeRange(ruleData.range)} perler.`;
    }
    return '';
  };
  switch (rule.mode) {
    case 'leftCount':
      return buildSentence('left', rule);
    case 'rightCount':
      return buildSentence('right', rule);
    case 'index':
      return buildSentence('index', rule);
    case 'indexSet':
      if (rule.values && rule.values.length) {
        return `Klypa kan stå på ${formatNumberList(rule.values)} av mellomrommene.`;
      }
      return '';
    default:
      return '';
  }
}

/* ===== helpers ===== */
function mk(n, attrs = {}) {
  const e = document.createElementNS("http://www.w3.org/2000/svg", n);
  for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v);
  return e;
}
function img(href, x, y, w, h, cls = "") {
  return mk("image", {
    href,
    x,
    y,
    width: w,
    height: h,
    class: cls
  });
}
function rect(x, y, w, h, attrs) {
  return mk("rect", {
    x,
    y,
    width: w,
    height: h,
    ...attrs
  });
}
function circle(cx, cy, r, cls) {
  return mk("circle", {
    cx,
    cy,
    r,
    class: cls
  });
}
function clamp(v, a, b) {
  return Math.max(a, Math.min(b, v));
}
function pt(e) {
  const p = svg.createSVGPoint();
  p.x = e.clientX;
  p.y = e.clientY;
  return p.matrixTransform(svg.getScreenCTM().inverse());
}
function svgToString(svgEl) {
  const clone = svgEl.cloneNode(true);
  const figureTitle = document.title || 'Perlesnor';
  const activeAltText = (typeof SIMPLE.altText === 'string' ? SIMPLE.altText : '').trim() || buildPerlesnorAltText();
  if (window.MathVisAltText) {
    const { titleEl, descEl } = window.MathVisAltText.ensureSvgA11yNodes(clone);
    if (titleEl) titleEl.textContent = figureTitle;
    if (descEl) descEl.textContent = activeAltText;
    clone.setAttribute('role', 'img');
    clone.setAttribute('aria-label', figureTitle);
    if (titleEl && titleEl.id) clone.setAttribute('aria-labelledby', titleEl.id);
    if (descEl && descEl.id) clone.setAttribute('aria-describedby', descEl.id);
  }
  const css = [...document.querySelectorAll('style')].map(s => s.textContent).join('\n');
  const style = document.createElement('style');
  style.textContent = css;
  clone.insertBefore(style, clone.firstChild);

  // Kopier beskrivelser referert av aria-describedby inn i SVG-en
  const ids = new Set();
  clone.querySelectorAll('[aria-describedby]').forEach(el => {
    var _el$getAttribute;
    (_el$getAttribute = el.getAttribute('aria-describedby')) === null || _el$getAttribute === void 0 || _el$getAttribute.split(/\s+/).forEach(id => ids.add(id));
  });
  ids.forEach(id => {
    if (!id || clone.getElementById(id)) return;
    const src = document.getElementById(id);
    if (src) {
      const desc = document.createElementNS('http://www.w3.org/2000/svg', 'desc');
      desc.setAttribute('id', id);
      desc.textContent = src.textContent;
      clone.insertBefore(desc, style.nextSibling);
    }
  });
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
  const vb = svgEl.viewBox.baseVal;
  const w = (vb === null || vb === void 0 ? void 0 : vb.width) || svgEl.clientWidth || VB_W;
  const h = (vb === null || vb === void 0 ? void 0 : vb.height) || svgEl.clientHeight || VB_H;
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
