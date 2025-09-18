/* ============ ENKEL KONFIG (FORFATTER) ============ */
const SIMPLE = {
  // Global radius for all beads. Optional – falls back to ADV.beadRadius.
  beadRadius: 30,
  bowls: [{
    colorCounts: [{
      color: "blue",
      count: 2
    }, {
      color: "red",
      count: 3
    }, {
      color: "green",
      count: 0
    }, {
      color: "yellow",
      count: 0
    }, {
      color: "pink",
      count: 0
    }, {
      color: "purple",
      count: 0
    }]
  }]
};

/* ============ ADV KONFIG (TEKNISK/VALGFRITT) ============ */
// Technical defaults. beadRadius here is only used if SIMPLE.beadRadius is not set.
const ADV = {
  beadRadius: 30,
  beadGap: 12,
  assets: {
    beads: {
      blue: "images/blueWave.svg",
      red: "images/redDots.svg",
      green: "images/greenStar.svg",
      yellow: "images/yellowGrid.svg",
      pink: "images/pinkLabyrinth.svg",
      purple: "images/purpleZigzag.svg"
    }
  }
};

/* ============ DERIVERT KONFIG FOR RENDER (IKKE REDIGER) ============ */
function makeCFG() {
  var _SIMPLE$beadRadius;
  const globalRadius = (_SIMPLE$beadRadius = SIMPLE.beadRadius) !== null && _SIMPLE$beadRadius !== void 0 ? _SIMPLE$beadRadius : ADV.beadRadius;
  const bowls = Array.isArray(SIMPLE.bowls) ? SIMPLE.bowls : [];
  const cfgBowls = bowls.map(b => {
    const colorsArr = [];
    const counts = Array.isArray(b.colorCounts) ? b.colorCounts : [];
    counts.forEach(cc => {
      const col = ADV.assets.beads[cc.color];
      const raw = cc === null || cc === void 0 ? void 0 : cc.count;
      const count = Number.isFinite(raw) ? Math.max(0, Math.round(raw)) : 0;
      if (col) for (let i = 0; i < count; i++) colorsArr.push(col);
    });
    if (!colorsArr.length) colorsArr.push(...Object.values(ADV.assets.beads));
    const radiusRaw = Number.isFinite(b === null || b === void 0 ? void 0 : b.beadRadius) ? b.beadRadius : globalRadius;
    const beadRadius = Math.min(60, Math.max(5, radiusRaw !== null && radiusRaw !== void 0 ? radiusRaw : ADV.beadRadius));
    return {
      colors: colorsArr,
      beadRadius
    };
  });
  if (!cfgBowls.length) {
    cfgBowls.push({
      colors: Object.values(ADV.assets.beads),
      beadRadius: Math.min(60, Math.max(5, globalRadius !== null && globalRadius !== void 0 ? globalRadius : ADV.beadRadius))
    });
  }
  return {
    bowls: cfgBowls,
    beadGap: ADV.beadGap
  };
}
let CFG = makeCFG();

/* ============ DOM & VIEWBOX ============ */
const SVG_IDS = ["bowlSVG1", "bowlSVG2"];
const VB_W = 500,
  VB_H = 300;
const figureViews = [];

/* ============ STATE & INIT ============ */
const STATE = window.STATE && typeof window.STATE === "object" ? window.STATE : {};
window.STATE = STATE;
if (!Array.isArray(STATE.bowls)) STATE.bowls = [];
const colors = Object.keys(ADV.assets.beads);
const assetToColor = Object.entries(ADV.assets.beads).reduce((acc, [color, src]) => {
  acc[src] = color;
  return acc;
}, {});
const controlsWrap = document.getElementById("controls");
const figureGridEl = document.querySelector(".figureGrid");
const addBtn = document.getElementById("addBowl");
const panelEls = [document.getElementById("panel1"), document.getElementById("panel2")];
const removeBtn1 = document.getElementById("removeBowl1");
const removeBtn2 = document.getElementById("removeBowl2");
const exportToolbar2 = document.getElementById("exportToolbar2");
const gridEl = document.querySelector(".grid");
const initialSideWidth = (() => {
  if (!gridEl) return 360;
  const inlineVal = Number.parseFloat(gridEl.style.getPropertyValue("--side-width"));
  if (Number.isFinite(inlineVal)) return inlineVal;
  try {
    const computedVal = Number.parseFloat(getComputedStyle(gridEl).getPropertyValue("--side-width"));
    if (Number.isFinite(computedVal)) return computedVal;
  } catch (_) {}
  return 360;
})();
let lastShowSecond = null;
if (!Array.isArray(SIMPLE.bowls)) SIMPLE.bowls = [];
if (typeof STATE.figure2Visible !== "boolean") {
  STATE.figure2Visible = SIMPLE.bowls.length > 1;
}
SVG_IDS.forEach((id, idx) => {
  const svg = document.getElementById(id);
  if (!svg) return;
  svg.setAttribute("viewBox", `0 0 ${VB_W} ${VB_H}`);
  svg.innerHTML = "";
  const gBowls = mk("g", {
    class: "bowls"
  });
  svg.appendChild(gBowls);
  const fig = createFigure(idx, svg, gBowls);
  figureViews[idx] = fig;
});
render();
addBtn === null || addBtn === void 0 || addBtn.addEventListener("click", () => {
  var _SIMPLE$beadRadius2;
  const first = ensureSimpleBowl(0);
  const copyCounts = colors.map(color => {
    const entry = Array.isArray(first === null || first === void 0 ? void 0 : first.colorCounts) ? first.colorCounts.find(cc => cc.color === color) : null;
    const count = Number.isFinite(entry === null || entry === void 0 ? void 0 : entry.count) ? Math.max(0, Math.round(entry.count)) : 0;
    return {
      color,
      count
    };
  });
  const radiusSource = Number.isFinite(first === null || first === void 0 ? void 0 : first.beadRadius) ? first.beadRadius : (_SIMPLE$beadRadius2 = SIMPLE.beadRadius) !== null && _SIMPLE$beadRadius2 !== void 0 ? _SIMPLE$beadRadius2 : ADV.beadRadius;
  SIMPLE.bowls[1] = {
    colorCounts: copyCounts,
    beadRadius: radiusSource
  };
  STATE.figure2Visible = true;
  render();
});
removeBtn1 === null || removeBtn1 === void 0 || removeBtn1.addEventListener("click", () => {
  removeBowl(0);
});
removeBtn2 === null || removeBtn2 === void 0 || removeBtn2.addEventListener("click", () => {
  removeBowl(1);
});
const downloadButtons = [{
  svgBtn: document.getElementById("downloadSVG1"),
  pngBtn: document.getElementById("downloadPNG1"),
  idx: 0
}, {
  svgBtn: document.getElementById("downloadSVG2"),
  pngBtn: document.getElementById("downloadPNG2"),
  idx: 1
}];
downloadButtons.forEach(({
  svgBtn,
  pngBtn,
  idx
}) => {
  svgBtn === null || svgBtn === void 0 || svgBtn.addEventListener("click", () => downloadSvgFigure(idx));
  pngBtn === null || pngBtn === void 0 || pngBtn.addEventListener("click", () => downloadPngFigure(idx));
});

/* ============ FUNKSJONER ============ */
function createFigure(idx, svg, gBowls) {
  var _SIMPLE$beadRadius3, _SIMPLE$beadRadius4;
  const fieldset = document.createElement("fieldset");
  fieldset.className = "bowlFieldset";
  fieldset.id = `kuler${idx + 1}`;
  const legend = document.createElement("legend");
  legend.textContent = `Kuler ${idx + 1}`;
  fieldset.appendChild(legend);
  const counts = {};
  const displays = {};
  colors.forEach(color => {
    const row = document.createElement("div");
    row.className = "ctrlRow";
    const label = document.createElement("span");
    label.textContent = `${cap(color)} kuler`;
    const minus = document.createElement("button");
    minus.type = "button";
    minus.textContent = "−";
    const countSpan = document.createElement("span");
    countSpan.className = "count";
    countSpan.textContent = "0";
    const plus = document.createElement("button");
    plus.type = "button";
    plus.textContent = "+";
    minus.addEventListener("click", () => changeCount(idx, color, -1));
    plus.addEventListener("click", () => changeCount(idx, color, 1));
    row.append(label, minus, countSpan, plus);
    fieldset.appendChild(row);
    displays[color] = countSpan;
    counts[color] = 0;
  });
  const sizeRow = document.createElement("div");
  sizeRow.className = "ctrlRow ctrlRow--size";
  const sizeLabel = document.createElement("span");
  sizeLabel.className = "ctrlLabel ctrlLabel--size";
  sizeLabel.textContent = "Kulestørrelse";
  const sizeMinus = document.createElement("button");
  sizeMinus.type = "button";
  sizeMinus.textContent = "−";
  const sizeInput = document.createElement("input");
  sizeInput.type = "range";
  sizeInput.min = "5";
  sizeInput.max = "60";
  sizeInput.style.flex = "1 1 160px";
  const sizePlus = document.createElement("button");
  sizePlus.type = "button";
  sizePlus.textContent = "+";
  const sizeSpan = document.createElement("span");
  sizeSpan.className = "count";
  sizeSpan.textContent = "0";
  sizeMinus.addEventListener("click", () => adjustSize(idx, -2));
  sizePlus.addEventListener("click", () => adjustSize(idx, 2));
  sizeInput.addEventListener("input", () => setSize(idx, parseInt(sizeInput.value, 10)));
  sizeRow.append(sizeLabel, sizeMinus, sizeInput, sizePlus, sizeSpan);
  fieldset.appendChild(sizeRow);
  controlsWrap === null || controlsWrap === void 0 || controlsWrap.appendChild(fieldset);
  return {
    idx,
    svg,
    gBowls,
    fieldset,
    counts,
    displays,
    sizeDisplay: sizeSpan,
    sizeSlider: sizeInput,
    beadRadius: Math.min(60, Math.max(5, (_SIMPLE$beadRadius3 = SIMPLE.beadRadius) !== null && _SIMPLE$beadRadius3 !== void 0 ? _SIMPLE$beadRadius3 : ADV.beadRadius)),
    renderRadius: Math.min(60, Math.max(5, (_SIMPLE$beadRadius4 = SIMPLE.beadRadius) !== null && _SIMPLE$beadRadius4 !== void 0 ? _SIMPLE$beadRadius4 : ADV.beadRadius))
  };
}
function ensureSimpleBowl(idx) {
  var _SIMPLE$beadRadius5;
  if (!Array.isArray(SIMPLE.bowls)) SIMPLE.bowls = [];
  const globalRadius = (_SIMPLE$beadRadius5 = SIMPLE.beadRadius) !== null && _SIMPLE$beadRadius5 !== void 0 ? _SIMPLE$beadRadius5 : ADV.beadRadius;
  let bowl = SIMPLE.bowls[idx];
  if (!bowl || typeof bowl !== "object") {
    const template = idx > 0 ? ensureSimpleBowl(0) : null;
    const counts = new Map();
    if (template && Array.isArray(template.colorCounts)) {
      template.colorCounts.forEach(cc => {
        const count = Number.isFinite(cc === null || cc === void 0 ? void 0 : cc.count) ? Math.max(0, Math.round(cc.count)) : 0;
        counts.set(cc.color, count);
      });
    }
    const colorCounts = colors.map(color => {
      var _counts$get;
      return {
        color,
        count: (_counts$get = counts.get(color)) !== null && _counts$get !== void 0 ? _counts$get : 0
      };
    });
    const radiusSource = Number.isFinite(template === null || template === void 0 ? void 0 : template.beadRadius) ? template.beadRadius : globalRadius;
    bowl = {
      colorCounts,
      beadRadius: radiusSource
    };
    SIMPLE.bowls[idx] = bowl;
  } else {
    const counts = new Map();
    (bowl.colorCounts || []).forEach(cc => {
      const count = Number.isFinite(cc === null || cc === void 0 ? void 0 : cc.count) ? Math.max(0, Math.round(cc.count)) : 0;
      counts.set(cc.color, count);
    });
    bowl.colorCounts = colors.map(color => {
      var _counts$get2;
      return {
        color,
        count: (_counts$get2 = counts.get(color)) !== null && _counts$get2 !== void 0 ? _counts$get2 : 0
      };
    });
    const radiusSource = Number.isFinite(bowl.beadRadius) ? bowl.beadRadius : globalRadius;
    bowl.beadRadius = Math.min(60, Math.max(5, radiusSource));
  }
  return bowl;
}
function applySimpleToFigures() {
  figureViews.forEach(fig => {
    var _SIMPLE$beadRadius7;
    if (!fig) return;
    if (fig.idx > 0 && !STATE.figure2Visible && !SIMPLE.bowls[fig.idx]) {
      var _SIMPLE$beadRadius6;
      const first = ensureSimpleBowl(0);
      const radius = Math.min(60, Math.max(5, Number.isFinite(first === null || first === void 0 ? void 0 : first.beadRadius) ? first.beadRadius : (_SIMPLE$beadRadius6 = SIMPLE.beadRadius) !== null && _SIMPLE$beadRadius6 !== void 0 ? _SIMPLE$beadRadius6 : ADV.beadRadius));
      fig.beadRadius = radius;
      fig.renderRadius = radius;
      if (fig.sizeDisplay) fig.sizeDisplay.textContent = radius;
      if (fig.sizeSlider) fig.sizeSlider.value = String(radius);
      colors.forEach(color => {
        const entry = Array.isArray(first === null || first === void 0 ? void 0 : first.colorCounts) ? first.colorCounts.find(cc => cc.color === color) : null;
        const count = Number.isFinite(entry === null || entry === void 0 ? void 0 : entry.count) ? Math.max(0, Math.round(entry.count)) : 0;
        fig.counts[color] = count;
        if (fig.displays[color]) fig.displays[color].textContent = String(count);
      });
      return;
    }
    const bowl = ensureSimpleBowl(fig.idx);
    const radius = Math.min(60, Math.max(5, Number.isFinite(bowl === null || bowl === void 0 ? void 0 : bowl.beadRadius) ? bowl.beadRadius : (_SIMPLE$beadRadius7 = SIMPLE.beadRadius) !== null && _SIMPLE$beadRadius7 !== void 0 ? _SIMPLE$beadRadius7 : ADV.beadRadius));
    fig.beadRadius = radius;
    fig.renderRadius = radius;
    if (fig.sizeDisplay) fig.sizeDisplay.textContent = radius;
    if (fig.sizeSlider) fig.sizeSlider.value = String(radius);
    colors.forEach(color => {
      const entry = bowl.colorCounts.find(cc => cc.color === color);
      const count = Number.isFinite(entry === null || entry === void 0 ? void 0 : entry.count) ? Math.max(0, Math.round(entry.count)) : 0;
      fig.counts[color] = count;
      if (fig.displays[color]) fig.displays[color].textContent = String(count);
    });
  });
}
function syncSimpleFromFigures() {
  figureViews.forEach(fig => {
    var _ref, _ref2, _fig$beadRadius;
    if (!fig) return;
    if (fig.idx > 0 && !STATE.figure2Visible) return;
    const bowl = ensureSimpleBowl(fig.idx);
    bowl.colorCounts = colors.map(color => {
      const value = Number.isFinite(fig.counts[color]) ? Math.max(0, Math.round(fig.counts[color])) : 0;
      return {
        color,
        count: value
      };
    });
    bowl.beadRadius = Math.min(60, Math.max(5, (_ref = (_ref2 = (_fig$beadRadius = fig.beadRadius) !== null && _fig$beadRadius !== void 0 ? _fig$beadRadius : bowl.beadRadius) !== null && _ref2 !== void 0 ? _ref2 : SIMPLE.beadRadius) !== null && _ref !== void 0 ? _ref : ADV.beadRadius));
  });
  if (figureViews[0]) SIMPLE.beadRadius = figureViews[0].beadRadius;
}
function changeCount(idx, color, delta) {
  const fig = figureViews[idx];
  if (!fig) return;
  const current = Number.isFinite(fig.counts[color]) ? fig.counts[color] : 0;
  const next = Math.max(0, current + delta);
  fig.counts[color] = next;
  if (fig.displays[color]) fig.displays[color].textContent = String(next);
  updateConfig();
}
function adjustSize(idx, delta) {
  const fig = figureViews[idx];
  if (!fig) return;
  setSize(idx, fig.beadRadius + delta);
}
function setSize(idx, value) {
  const fig = figureViews[idx];
  if (!fig) return;
  const next = Math.min(60, Math.max(5, Number.isFinite(value) ? value : fig.beadRadius));
  fig.beadRadius = next;
  if (fig.sizeDisplay) fig.sizeDisplay.textContent = next;
  if (fig.sizeSlider && fig.sizeSlider.value !== String(next)) fig.sizeSlider.value = String(next);
  updateConfig();
}
function updateConfig() {
  syncSimpleFromFigures();
  render();
}
function removeBowl(idx) {
  var _dragState$fig;
  if (idx < 0) return;
  if (Array.isArray(SIMPLE.bowls)) {
    if (idx === 0) {
      if (SIMPLE.bowls.length <= 1) return;
      SIMPLE.bowls.splice(0, 1);
    } else {
      SIMPLE.bowls.splice(idx);
    }
  }
  if (Array.isArray(STATE.bowls)) {
    if (idx === 0) {
      if (STATE.bowls.length > 1) {
        STATE.bowls.splice(0, 1);
      } else if (STATE.bowls.length === 1) {
        STATE.bowls[0] = {};
      }
    } else {
      STATE.bowls.splice(idx);
    }
  }
  if (dragState && ((_dragState$fig = dragState.fig) === null || _dragState$fig === void 0 ? void 0 : _dragState$fig.idx) === idx) {
    const {
      fig,
      pointerId
    } = dragState;
    if (fig !== null && fig !== void 0 && fig.svg) {
      fig.svg.removeEventListener("pointermove", onDrag);
      fig.svg.removeEventListener("pointerup", endDrag);
      fig.svg.removeEventListener("pointercancel", endDrag);
      try {
        fig.svg.releasePointerCapture(pointerId);
      } catch (_) {}
    }
    dragState = null;
  }
  if (Array.isArray(SIMPLE.bowls) && SIMPLE.bowls.length === 0) {
    var _SIMPLE$beadRadius8;
    const fallback = colors.map(color => ({
      color,
      count: 0
    }));
    SIMPLE.bowls.push({
      colorCounts: fallback,
      beadRadius: (_SIMPLE$beadRadius8 = SIMPLE.beadRadius) !== null && _SIMPLE$beadRadius8 !== void 0 ? _SIMPLE$beadRadius8 : ADV.beadRadius
    });
  }
  STATE.figure2Visible = Array.isArray(SIMPLE.bowls) ? SIMPLE.bowls.length > 1 : false;
  render();
}
function render() {
  if (typeof STATE.figure2Visible !== "boolean") {
    STATE.figure2Visible = SIMPLE.bowls.length > 1;
  }
  CFG = makeCFG();
  applySimpleToFigures();
  if (STATE.bowls.length > CFG.bowls.length) STATE.bowls.length = CFG.bowls.length;
  figureViews.forEach(fig => renderFigure(fig));
  applyFigureVisibility();
}
function renderFigure(fig) {
  var _cfg$beadRadius, _ref3, _fig$beadRadius2;
  if (!fig || !fig.svg) return;
  const idx = fig.idx;
  const cfg = CFG.bowls[idx];
  fig.gBowls.innerHTML = "";
  if (!cfg) return;
  const beadRadius = (_cfg$beadRadius = cfg.beadRadius) !== null && _cfg$beadRadius !== void 0 ? _cfg$beadRadius : (_ref3 = (_fig$beadRadius2 = fig.beadRadius) !== null && _fig$beadRadius2 !== void 0 ? _fig$beadRadius2 : SIMPLE.beadRadius) !== null && _ref3 !== void 0 ? _ref3 : ADV.beadRadius;
  fig.renderRadius = beadRadius;
  const beadD = beadRadius * 2;
  const g = mk("g", {
    class: "bowl"
  });
  const midX = VB_W / 2;
  const bowlSvgW = 273;
  const bowlSvgH = 251;
  const rimSvgY = 41;
  const bowlScale = VB_H / bowlSvgH;
  const bowlWidth = bowlSvgW * bowlScale;
  const rimY = rimSvgY * bowlScale;
  const bowlDepth = VB_H - rimY;
  const bowlImg = mk("image", {
    href: "images/bowl.svg",
    x: 0,
    y: 0,
    width: VB_W,
    height: VB_H,
    preserveAspectRatio: "xMidYMax meet"
  });
  const gBeads = mk("g", {
    class: "beads"
  });
  const nBeads = cfg.colors.length;
  const bowlState = getBowlState(idx);
  const colorPositions = bowlState.byColor;
  const colorUsage = {};
  const placed = [];
  const cx = midX;
  const cy = rimY + bowlDepth;
  const rx = bowlWidth / 2 - beadRadius;
  const ry = bowlDepth - beadRadius;
  const minX = VB_W * 0.3;
  const maxX = VB_W * 0.7;
  const minY = VB_H * 0.5;
  const maxY = VB_H * 0.9;
  function randPos() {
    let candidate = null;
    for (let tries = 0; tries < 1000; tries++) {
      const x = minX + Math.random() * (maxX - minX);
      const y = minY + Math.random() * (maxY - minY);
      if ((x - cx) ** 2 / rx ** 2 + (y - cy) ** 2 / ry ** 2 > 1) continue;
      candidate = {
        x,
        y
      };
      const collision = placed.some(p => (p.x - candidate.x) ** 2 + (p.y - candidate.y) ** 2 < (beadD + CFG.beadGap) ** 2);
      if (!collision) return candidate;
    }
    return candidate || {
      x: cx,
      y: rimY + bowlDepth * 0.6
    };
  }
  for (let i = 0; i < nBeads; i++) {
    var _colorUsage$colorKey;
    const src = cfg.colors[i % cfg.colors.length];
    const colorKey = assetToColor[src] || src;
    const useIdx = (_colorUsage$colorKey = colorUsage[colorKey]) !== null && _colorUsage$colorKey !== void 0 ? _colorUsage$colorKey : 0;
    const arr = Array.isArray(colorPositions[colorKey]) ? colorPositions[colorKey] : colorPositions[colorKey] = [];
    let pos = arr[useIdx];
    if (!pos || !Number.isFinite(pos.x) || !Number.isFinite(pos.y)) {
      pos = randPos();
      arr[useIdx] = pos;
    }
    placed.push(pos);
    colorUsage[colorKey] = useIdx + 1;
    const bead = mk("image", {
      href: src,
      x: pos.x - beadRadius,
      y: pos.y - beadRadius,
      width: beadD,
      height: beadD,
      class: "bead beadShadow"
    });
    bead.dataset.figure = String(idx);
    bead.dataset.bowl = String(idx);
    bead.dataset.color = colorKey;
    bead.dataset.colorIndex = String(useIdx);
    bead.addEventListener("pointerdown", startDrag);
    gBeads.appendChild(bead);
  }
  Object.keys(colorPositions).forEach(key => {
    var _colorUsage$key;
    const used = (_colorUsage$key = colorUsage[key]) !== null && _colorUsage$key !== void 0 ? _colorUsage$key : 0;
    if (!Array.isArray(colorPositions[key])) {
      colorPositions[key] = [];
    } else if (colorPositions[key].length > used) {
      colorPositions[key].length = used;
    }
  });
  g.appendChild(bowlImg);
  g.appendChild(gBeads);
  fig.gBowls.appendChild(g);
}
function applyFigureVisibility() {
  var _figureViews$;
  const secondExists = !!figureViews[1];
  const showSecond = !!STATE.figure2Visible && secondExists;
  const firstExists = !!figureViews[0];
  const figureCount = firstExists ? showSecond ? 2 : 1 : 0;
  const addVisible = !showSecond && secondExists;
  if (figureGridEl) {
    if (figureCount > 0) {
      figureGridEl.dataset.figures = String(figureCount);
    } else {
      delete figureGridEl.dataset.figures;
    }
    if (addVisible) {
      figureGridEl.dataset.addVisible = "true";
    } else {
      delete figureGridEl.dataset.addVisible;
    }
  }
  if (controlsWrap) controlsWrap.classList.toggle("controlsWrap--split", showSecond);
  if (gridEl && showSecond !== lastShowSecond) {
    if (showSecond) {
      const current = Number.parseFloat(gridEl.style.getPropertyValue("--side-width"));
      const base = Number.isFinite(current) ? current : initialSideWidth;
      const desired = Math.max(base, 500);
      gridEl.style.setProperty("--side-width", `${desired}px`);
    } else {
      gridEl.style.setProperty("--side-width", `${initialSideWidth}px`);
    }
  }
  lastShowSecond = showSecond;
  if (addBtn) addBtn.style.display = addVisible ? "" : "none";
  if (panelEls[1]) panelEls[1].style.display = showSecond ? "" : "none";
  if (exportToolbar2) exportToolbar2.style.display = showSecond ? "" : "none";
  if ((_figureViews$ = figureViews[1]) !== null && _figureViews$ !== void 0 && _figureViews$.fieldset) figureViews[1].fieldset.style.display = showSecond ? "" : "none";
  if (removeBtn1) {
    const extraBowl = Array.isArray(SIMPLE.bowls) ? SIMPLE.bowls.length > 1 : false;
    removeBtn1.disabled = !(showSecond && extraBowl);
  }
}
function getBowlState(idx) {
  if (!STATE.bowls[idx] || typeof STATE.bowls[idx] !== "object" || Array.isArray(STATE.bowls[idx])) {
    STATE.bowls[idx] = {};
  }
  const bowlState = STATE.bowls[idx];
  if (!bowlState.byColor || typeof bowlState.byColor !== "object") {
    bowlState.byColor = {};
  }
  return bowlState;
}
let dragState = null;
function startDrag(e) {
  const bead = e.target;
  if (!bead || typeof bead.getAttribute !== "function") return;
  const figIdx = Number.parseInt(bead.dataset.figure, 10);
  const fig = figureViews[figIdx];
  if (!fig || !fig.svg) return;
  const bowlIdx = Number.parseInt(bead.dataset.bowl, 10);
  const colorIdx = Number.parseInt(bead.dataset.colorIndex, 10);
  const colorKey = bead.dataset.color;
  const info = {
    bowlIdx: Number.isNaN(bowlIdx) ? null : bowlIdx,
    colorKey: typeof colorKey === "string" && colorKey ? colorKey : null,
    colorIndex: Number.isNaN(colorIdx) ? null : colorIdx
  };
  const pt = svgPoint(fig.svg, e);
  const x = parseFloat(bead.getAttribute("x"));
  const y = parseFloat(bead.getAttribute("y"));
  const offsetX = pt.x - x;
  const offsetY = pt.y - y;
  dragState = {
    bead,
    fig,
    info,
    offsetX,
    offsetY,
    pointerId: e.pointerId
  };
  fig.svg.addEventListener("pointermove", onDrag);
  fig.svg.addEventListener("pointerup", endDrag);
  fig.svg.addEventListener("pointercancel", endDrag);
  try {
    fig.svg.setPointerCapture(e.pointerId);
  } catch (_) {}
}
function onDrag(e) {
  if (!dragState) return;
  const {
    bead,
    fig,
    offsetX,
    offsetY
  } = dragState;
  const pt = svgPoint(fig.svg, e);
  bead.setAttribute("x", pt.x - offsetX);
  bead.setAttribute("y", pt.y - offsetY);
  storeDragPosition();
}
function endDrag(e) {
  if (!dragState) return;
  const {
    fig,
    pointerId
  } = dragState;
  fig.svg.removeEventListener("pointermove", onDrag);
  fig.svg.removeEventListener("pointerup", endDrag);
  fig.svg.removeEventListener("pointercancel", endDrag);
  try {
    fig.svg.releasePointerCapture(pointerId);
  } catch (_) {}
  storeDragPosition();
  dragState = null;
}
function storeDragPosition() {
  var _ref4, _fig$renderRadius, _SIMPLE$beadRadius9;
  if (!dragState) return;
  const {
    bead,
    info,
    fig
  } = dragState;
  const {
    bowlIdx,
    colorKey,
    colorIndex
  } = info;
  if (bowlIdx == null || colorKey == null || colorIndex == null) return;
  const x = parseFloat(bead.getAttribute("x"));
  const y = parseFloat(bead.getAttribute("y"));
  if (!Number.isFinite(x) || !Number.isFinite(y)) return;
  const bowlState = getBowlState(bowlIdx);
  const colorPositions = bowlState.byColor;
  const arr = Array.isArray(colorPositions[colorKey]) ? colorPositions[colorKey] : colorPositions[colorKey] = [];
  const radius = (_ref4 = (_fig$renderRadius = fig.renderRadius) !== null && _fig$renderRadius !== void 0 ? _fig$renderRadius : fig.beadRadius) !== null && _ref4 !== void 0 ? _ref4 : (_SIMPLE$beadRadius9 = SIMPLE.beadRadius) !== null && _SIMPLE$beadRadius9 !== void 0 ? _SIMPLE$beadRadius9 : ADV.beadRadius;
  arr[colorIndex] = {
    x: x + radius,
    y: y + radius
  };
}
function svgPoint(svgEl, evt) {
  const p = svgEl.createSVGPoint();
  p.x = evt.clientX;
  p.y = evt.clientY;
  return p.matrixTransform(svgEl.getScreenCTM().inverse());
}
async function downloadSvgFigure(idx) {
  const fig = figureViews[idx];
  if (!fig || !fig.svg) return;
  const clone = fig.svg.cloneNode(true);
  await inlineImages(clone);
  const data = new XMLSerializer().serializeToString(clone);
  const blob = new Blob([data], {
    type: "image/svg+xml"
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `kuler${idx + 1}.svg`;
  a.click();
  URL.revokeObjectURL(url);
}
async function downloadPngFigure(idx) {
  const fig = figureViews[idx];
  if (!fig || !fig.svg) return;
  const clone = fig.svg.cloneNode(true);
  await inlineImages(clone);
  const data = new XMLSerializer().serializeToString(clone);
  const svgBlob = new Blob([data], {
    type: "image/svg+xml"
  });
  const url = URL.createObjectURL(svgBlob);
  const img = new Image();
  img.onload = () => {
    const canvas = document.createElement("canvas");
    canvas.width = VB_W;
    canvas.height = VB_H;
    const ctx = canvas.getContext("2d");
    ctx.drawImage(img, 0, 0);
    URL.revokeObjectURL(url);
    canvas.toBlob(blob => {
      if (!blob) return;
      const pngUrl = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = pngUrl;
      a.download = `kuler${idx + 1}.png`;
      a.click();
      URL.revokeObjectURL(pngUrl);
    });
  };
  img.src = url;
}

/* ===== helpers ===== */
function mk(n, attrs = {}) {
  const e = document.createElementNS("http://www.w3.org/2000/svg", n);
  for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v);
  return e;
}
function cap(s) {
  return s[0].toUpperCase() + s.slice(1);
}
async function inlineImages(svgEl) {
  const imgs = svgEl.querySelectorAll("image");
  await Promise.all(Array.from(imgs).map(async img => {
    const src = img.getAttribute("href");
    if (!src) return;
    const res = await fetch(src);
    const blob = await res.blob();
    const dataUrl = await new Promise(resolve => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.readAsDataURL(blob);
    });
    img.setAttribute("href", dataUrl);
  }));
}
