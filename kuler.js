/* ============ ENKEL KONFIG (FORFATTER) ============ */
const SIMPLE = {
  // Global radius for all beads. Optional – falls back to ADV.beadRadius.
  beadRadius: 30,
  bowls: [
    {
      colorCounts: [
        { color: "blue", count: 2 },
        { color: "red", count: 3 },
        { color: "green", count: 0 },
        { color: "yellow", count: 0 },
        { color: "pink", count: 0 },
        { color: "purple", count: 0 }
      ]
    }
  ]
};

/* ============ ADV KONFIG (TEKNISK/VALGFRITT) ============ */
// Technical defaults. beadRadius here is only used if SIMPLE.beadRadius is not set.
const ADV = {
  beadRadius: 30,
  beadGap: 12,
  assets: {
    beads: {
      blue:   "images/blueWave.svg",
      red:    "images/redDots.svg",
      green:  "images/greenStar.svg",
      yellow: "images/yellowGrid.svg",
      pink:   "images/pinkLabyrinth.svg",
      purple: "images/purpleZigzag.svg"
    }
  }
};

/* ============ DERIVERT KONFIG FOR RENDER (IKKE REDIGER) ============ */
function makeCFG(){
  const globalRadius = SIMPLE.beadRadius ?? ADV.beadRadius;
  const bowls = Array.isArray(SIMPLE.bowls) ? SIMPLE.bowls : [];
  const cfgBowls = bowls.map(b => {
    const colorsArr = [];
    const counts = Array.isArray(b.colorCounts) ? b.colorCounts : [];
    counts.forEach(cc => {
      const col = ADV.assets.beads[cc.color];
      const raw = cc?.count;
      const count = Number.isFinite(raw) ? Math.max(0, Math.round(raw)) : 0;
      if(col) for(let i=0; i<count; i++) colorsArr.push(col);
    });
    if(!colorsArr.length) colorsArr.push(...Object.values(ADV.assets.beads));
    const radiusRaw = Number.isFinite(b?.beadRadius) ? b.beadRadius : globalRadius;
    const beadRadius = Math.min(60, Math.max(5, radiusRaw ?? ADV.beadRadius));
    return { colors: colorsArr, beadRadius };
  });
  if(!cfgBowls.length){
    cfgBowls.push({
      colors: Object.values(ADV.assets.beads),
      beadRadius: Math.min(60, Math.max(5, globalRadius ?? ADV.beadRadius))
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
const VB_W = 500, VB_H = 300;
const figureViews = [];

/* ============ STATE & INIT ============ */
const STATE = (window.STATE && typeof window.STATE === "object") ? window.STATE : {};
window.STATE = STATE;
if(!Array.isArray(STATE.bowls)) STATE.bowls = [];

const colors = Object.keys(ADV.assets.beads);
const assetToColor = Object.entries(ADV.assets.beads).reduce((acc, [color, src]) => {
  acc[src] = color;
  return acc;
}, {});
const controlsWrap = document.getElementById("controls");
const figureGridEl = document.querySelector(".figureGrid");
const addBtn = document.getElementById("addBowl");
const panelEls = [document.getElementById("panel1"), document.getElementById("panel2")];
const removeBtn2 = document.getElementById("removeBowl2");
const exportToolbar2 = document.getElementById("exportToolbar2");
const gridEl = document.querySelector(".grid");

const initialSideWidth = (() => {
  if(!gridEl) return 360;
  const inlineVal = Number.parseFloat(gridEl.style.getPropertyValue("--side-width"));
  if(Number.isFinite(inlineVal)) return inlineVal;
  try{
    const computedVal = Number.parseFloat(getComputedStyle(gridEl).getPropertyValue("--side-width"));
    if(Number.isFinite(computedVal)) return computedVal;
  }catch(_){ }
  return 360;
})();

let lastShowSecond = null;

if(!Array.isArray(SIMPLE.bowls)) SIMPLE.bowls = [];
if(typeof STATE.figure2Visible !== "boolean"){
  STATE.figure2Visible = SIMPLE.bowls.length > 1;
}

SVG_IDS.forEach((id, idx) => {
  const svg = document.getElementById(id);
  if(!svg) return;
  svg.setAttribute("viewBox", `0 0 ${VB_W} ${VB_H}`);
  svg.innerHTML = "";
  const gBowls = mk("g", { class: "bowls" });
  svg.appendChild(gBowls);
  const fig = createFigure(idx, svg, gBowls);
  figureViews[idx] = fig;
});

render();

addBtn?.addEventListener("click", () => {
  const first = ensureSimpleBowl(0);
  const copyCounts = colors.map(color => {
    const entry = Array.isArray(first?.colorCounts) ? first.colorCounts.find(cc => cc.color === color) : null;
    const count = Number.isFinite(entry?.count) ? Math.max(0, Math.round(entry.count)) : 0;
    return { color, count };
  });
  const radiusSource = Number.isFinite(first?.beadRadius) ? first.beadRadius : (SIMPLE.beadRadius ?? ADV.beadRadius);
  SIMPLE.bowls[1] = { colorCounts: copyCounts, beadRadius: radiusSource };
  STATE.figure2Visible = true;
  render();
});

removeBtn2?.addEventListener("click", () => {
  removeBowl(1);
});

const downloadButtons = [
  { svgBtn: document.getElementById("downloadSVG1"), pngBtn: document.getElementById("downloadPNG1"), idx: 0 },
  { svgBtn: document.getElementById("downloadSVG2"), pngBtn: document.getElementById("downloadPNG2"), idx: 1 }
];
downloadButtons.forEach(({ svgBtn, pngBtn, idx }) => {
  svgBtn?.addEventListener("click", () => downloadSvgFigure(idx));
  pngBtn?.addEventListener("click", () => downloadPngFigure(idx));
});

/* ============ FUNKSJONER ============ */
function createFigure(idx, svg, gBowls){
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

  controlsWrap?.appendChild(fieldset);

  return {
    idx,
    svg,
    gBowls,
    fieldset,
    counts,
    displays,
    sizeDisplay: sizeSpan,
    sizeSlider: sizeInput,
    beadRadius: Math.min(60, Math.max(5, SIMPLE.beadRadius ?? ADV.beadRadius)),
    renderRadius: Math.min(60, Math.max(5, SIMPLE.beadRadius ?? ADV.beadRadius))
  };
}

function ensureSimpleBowl(idx){
  if(!Array.isArray(SIMPLE.bowls)) SIMPLE.bowls = [];
  const globalRadius = SIMPLE.beadRadius ?? ADV.beadRadius;
  let bowl = SIMPLE.bowls[idx];
  if(!bowl || typeof bowl !== "object"){
    const template = idx > 0 ? ensureSimpleBowl(0) : null;
    const counts = new Map();
    if(template && Array.isArray(template.colorCounts)){
      template.colorCounts.forEach(cc => {
        const count = Number.isFinite(cc?.count) ? Math.max(0, Math.round(cc.count)) : 0;
        counts.set(cc.color, count);
      });
    }
    const colorCounts = colors.map(color => ({ color, count: counts.get(color) ?? 0 }));
    const radiusSource = Number.isFinite(template?.beadRadius) ? template.beadRadius : globalRadius;
    bowl = { colorCounts, beadRadius: radiusSource };
    SIMPLE.bowls[idx] = bowl;
  }else{
    const counts = new Map();
    (bowl.colorCounts || []).forEach(cc => {
      const count = Number.isFinite(cc?.count) ? Math.max(0, Math.round(cc.count)) : 0;
      counts.set(cc.color, count);
    });
    bowl.colorCounts = colors.map(color => ({ color, count: counts.get(color) ?? 0 }));
    const radiusSource = Number.isFinite(bowl.beadRadius) ? bowl.beadRadius : globalRadius;
    bowl.beadRadius = Math.min(60, Math.max(5, radiusSource));
  }
  return bowl;
}

function applySimpleToFigures(){
  figureViews.forEach(fig => {
    if(!fig) return;
    if(fig.idx > 0 && !STATE.figure2Visible && !SIMPLE.bowls[fig.idx]){
      const first = ensureSimpleBowl(0);
      const radius = Math.min(60, Math.max(5, Number.isFinite(first?.beadRadius) ? first.beadRadius : (SIMPLE.beadRadius ?? ADV.beadRadius)));
      fig.beadRadius = radius;
      fig.renderRadius = radius;
      if(fig.sizeDisplay) fig.sizeDisplay.textContent = radius;
      if(fig.sizeSlider) fig.sizeSlider.value = String(radius);
      colors.forEach(color => {
        const entry = Array.isArray(first?.colorCounts) ? first.colorCounts.find(cc => cc.color === color) : null;
        const count = Number.isFinite(entry?.count) ? Math.max(0, Math.round(entry.count)) : 0;
        fig.counts[color] = count;
        if(fig.displays[color]) fig.displays[color].textContent = String(count);
      });
      return;
    }
    const bowl = ensureSimpleBowl(fig.idx);
    const radius = Math.min(60, Math.max(5, Number.isFinite(bowl?.beadRadius) ? bowl.beadRadius : (SIMPLE.beadRadius ?? ADV.beadRadius)));
    fig.beadRadius = radius;
    fig.renderRadius = radius;
    if(fig.sizeDisplay) fig.sizeDisplay.textContent = radius;
    if(fig.sizeSlider) fig.sizeSlider.value = String(radius);
    colors.forEach(color => {
      const entry = bowl.colorCounts.find(cc => cc.color === color);
      const count = Number.isFinite(entry?.count) ? Math.max(0, Math.round(entry.count)) : 0;
      fig.counts[color] = count;
      if(fig.displays[color]) fig.displays[color].textContent = String(count);
    });
  });
}

function syncSimpleFromFigures(){
  figureViews.forEach(fig => {
    if(!fig) return;
    if(fig.idx > 0 && !STATE.figure2Visible) return;
    const bowl = ensureSimpleBowl(fig.idx);
    bowl.colorCounts = colors.map(color => {
      const value = Number.isFinite(fig.counts[color]) ? Math.max(0, Math.round(fig.counts[color])) : 0;
      return { color, count: value };
    });
    bowl.beadRadius = Math.min(60, Math.max(5, fig.beadRadius ?? bowl.beadRadius ?? SIMPLE.beadRadius ?? ADV.beadRadius));
  });
  if(figureViews[0]) SIMPLE.beadRadius = figureViews[0].beadRadius;
}

function changeCount(idx, color, delta){
  const fig = figureViews[idx];
  if(!fig) return;
  const current = Number.isFinite(fig.counts[color]) ? fig.counts[color] : 0;
  const next = Math.max(0, current + delta);
  fig.counts[color] = next;
  if(fig.displays[color]) fig.displays[color].textContent = String(next);
  updateConfig();
}

function adjustSize(idx, delta){
  const fig = figureViews[idx];
  if(!fig) return;
  setSize(idx, fig.beadRadius + delta);
}

function setSize(idx, value){
  const fig = figureViews[idx];
  if(!fig) return;
  const next = Math.min(60, Math.max(5, Number.isFinite(value) ? value : fig.beadRadius));
  fig.beadRadius = next;
  if(fig.sizeDisplay) fig.sizeDisplay.textContent = next;
  if(fig.sizeSlider && fig.sizeSlider.value !== String(next)) fig.sizeSlider.value = String(next);
  updateConfig();
}

function updateConfig(){
  syncSimpleFromFigures();
  render();
}

function removeBowl(idx){
  if(idx <= 0) return;
  if(Array.isArray(SIMPLE.bowls)){
    SIMPLE.bowls.splice(idx);
  }
  if(Array.isArray(STATE.bowls)){
    STATE.bowls.splice(idx);
  }
  if(dragState && dragState.fig?.idx === idx){
    const { fig, pointerId } = dragState;
    if(fig?.svg){
      fig.svg.removeEventListener("pointermove", onDrag);
      fig.svg.removeEventListener("pointerup", endDrag);
      fig.svg.removeEventListener("pointercancel", endDrag);
      try{ fig.svg.releasePointerCapture(pointerId); }catch(_){ }
    }
    dragState = null;
  }
  STATE.figure2Visible = false;
  render();
}

function render(){
  if(typeof STATE.figure2Visible !== "boolean"){
    STATE.figure2Visible = SIMPLE.bowls.length > 1;
  }
  CFG = makeCFG();
  applySimpleToFigures();
  if(STATE.bowls.length > CFG.bowls.length) STATE.bowls.length = CFG.bowls.length;
  figureViews.forEach(fig => renderFigure(fig));
  applyFigureVisibility();
}

function renderFigure(fig){
  if(!fig || !fig.svg) return;
  const idx = fig.idx;
  const cfg = CFG.bowls[idx];
  fig.gBowls.innerHTML = "";
  if(!cfg) return;
  const beadRadius = cfg.beadRadius ?? (fig.beadRadius ?? SIMPLE.beadRadius ?? ADV.beadRadius);
  fig.renderRadius = beadRadius;
  const beadD = beadRadius * 2;
  const g = mk("g", { class: "bowl" });
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

  const gBeads = mk("g", { class: "beads" });
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
  function randPos(){
    let candidate = null;
    for(let tries=0; tries<1000; tries++){
      const x = minX + Math.random() * (maxX - minX);
      const y = minY + Math.random() * (maxY - minY);
      if(((x - cx) ** 2) / (rx ** 2) + ((y - cy) ** 2) / (ry ** 2) > 1) continue;
      candidate = { x, y };
      const collision = placed.some(p => (p.x - candidate.x) ** 2 + (p.y - candidate.y) ** 2 < (beadD + CFG.beadGap) ** 2);
      if(!collision) return candidate;
    }
    return candidate || { x: cx, y: rimY + bowlDepth * 0.6 };
  }
  for(let i=0; i<nBeads; i++){
    const src = cfg.colors[i % cfg.colors.length];
    const colorKey = assetToColor[src] || src;
    const useIdx = colorUsage[colorKey] ?? 0;
    const arr = Array.isArray(colorPositions[colorKey]) ? colorPositions[colorKey] : (colorPositions[colorKey] = []);
    let pos = arr[useIdx];
    if(!pos || !Number.isFinite(pos.x) || !Number.isFinite(pos.y)){
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
    const used = colorUsage[key] ?? 0;
    if(!Array.isArray(colorPositions[key])){
      colorPositions[key] = [];
    }else if(colorPositions[key].length > used){
      colorPositions[key].length = used;
    }
  });

  g.appendChild(bowlImg);
  g.appendChild(gBeads);
  fig.gBowls.appendChild(g);
}

function applyFigureVisibility(){
  const secondExists = !!figureViews[1];
  const showSecond = !!STATE.figure2Visible && secondExists;
  const firstExists = !!figureViews[0];
  const figureCount = firstExists ? (showSecond ? 2 : 1) : 0;
  if(figureGridEl){
    if(figureCount > 0){
      figureGridEl.dataset.figures = String(figureCount);
    }else{
      delete figureGridEl.dataset.figures;
    }
  }
  if(controlsWrap) controlsWrap.classList.toggle("controlsWrap--split", showSecond);
  if(gridEl && showSecond !== lastShowSecond){
    if(showSecond){
      const current = Number.parseFloat(gridEl.style.getPropertyValue("--side-width"));
      const base = Number.isFinite(current) ? current : initialSideWidth;
      const desired = Math.max(base, 540);
      gridEl.style.setProperty("--side-width", `${desired}px`);
    }else{
      gridEl.style.setProperty("--side-width", `${initialSideWidth}px`);
    }
  }
  lastShowSecond = showSecond;
  if(addBtn) addBtn.style.display = (showSecond || !secondExists) ? "none" : "";
  if(panelEls[1]) panelEls[1].style.display = showSecond ? "" : "none";
  if(exportToolbar2) exportToolbar2.style.display = showSecond ? "" : "none";
  if(figureViews[1]?.fieldset) figureViews[1].fieldset.style.display = showSecond ? "" : "none";
}

function getBowlState(idx){
  if(!STATE.bowls[idx] || typeof STATE.bowls[idx] !== "object" || Array.isArray(STATE.bowls[idx])){
    STATE.bowls[idx] = {};
  }
  const bowlState = STATE.bowls[idx];
  if(!bowlState.byColor || typeof bowlState.byColor !== "object"){
    bowlState.byColor = {};
  }
  return bowlState;
}

let dragState = null;

function startDrag(e){
  const bead = e.target;
  if(!bead || typeof bead.getAttribute !== "function") return;
  const figIdx = Number.parseInt(bead.dataset.figure, 10);
  const fig = figureViews[figIdx];
  if(!fig || !fig.svg) return;
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
  dragState = { bead, fig, info, offsetX, offsetY, pointerId: e.pointerId };
  fig.svg.addEventListener("pointermove", onDrag);
  fig.svg.addEventListener("pointerup", endDrag);
  fig.svg.addEventListener("pointercancel", endDrag);
  try{ fig.svg.setPointerCapture(e.pointerId); }catch(_){ }
}

function onDrag(e){
  if(!dragState) return;
  const { bead, fig, offsetX, offsetY } = dragState;
  const pt = svgPoint(fig.svg, e);
  bead.setAttribute("x", pt.x - offsetX);
  bead.setAttribute("y", pt.y - offsetY);
  storeDragPosition();
}

function endDrag(e){
  if(!dragState) return;
  const { fig, pointerId } = dragState;
  fig.svg.removeEventListener("pointermove", onDrag);
  fig.svg.removeEventListener("pointerup", endDrag);
  fig.svg.removeEventListener("pointercancel", endDrag);
  try{ fig.svg.releasePointerCapture(pointerId); }catch(_){ }
  storeDragPosition();
  dragState = null;
}

function storeDragPosition(){
  if(!dragState) return;
  const { bead, info, fig } = dragState;
  const { bowlIdx, colorKey, colorIndex } = info;
  if(bowlIdx == null || colorKey == null || colorIndex == null) return;
  const x = parseFloat(bead.getAttribute("x"));
  const y = parseFloat(bead.getAttribute("y"));
  if(!Number.isFinite(x) || !Number.isFinite(y)) return;
  const bowlState = getBowlState(bowlIdx);
  const colorPositions = bowlState.byColor;
  const arr = Array.isArray(colorPositions[colorKey]) ? colorPositions[colorKey] : (colorPositions[colorKey] = []);
  const radius = fig.renderRadius ?? fig.beadRadius ?? (SIMPLE.beadRadius ?? ADV.beadRadius);
  arr[colorIndex] = { x: x + radius, y: y + radius };
}

function svgPoint(svgEl, evt){
  const p = svgEl.createSVGPoint();
  p.x = evt.clientX;
  p.y = evt.clientY;
  return p.matrixTransform(svgEl.getScreenCTM().inverse());
}

async function downloadSvgFigure(idx){
  const fig = figureViews[idx];
  if(!fig || !fig.svg) return;
  const clone = fig.svg.cloneNode(true);
  await inlineImages(clone);
  const data = new XMLSerializer().serializeToString(clone);
  const blob = new Blob([data], { type: "image/svg+xml" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `kuler${idx + 1}.svg`;
  a.click();
  URL.revokeObjectURL(url);
}

async function downloadPngFigure(idx){
  const fig = figureViews[idx];
  if(!fig || !fig.svg) return;
  const clone = fig.svg.cloneNode(true);
  await inlineImages(clone);
  const data = new XMLSerializer().serializeToString(clone);
  const svgBlob = new Blob([data], { type: "image/svg+xml" });
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
      if(!blob) return;
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
function mk(n, attrs = {}){
  const e = document.createElementNS("http://www.w3.org/2000/svg", n);
  for(const [k, v] of Object.entries(attrs)) e.setAttribute(k, v);
  return e;
}
function cap(s){
  return s[0].toUpperCase() + s.slice(1);
}

async function inlineImages(svgEl){
  const imgs = svgEl.querySelectorAll("image");
  await Promise.all(Array.from(imgs).map(async img => {
    const src = img.getAttribute("href");
    if(!src) return;
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
