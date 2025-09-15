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
  const beadRadius = SIMPLE.beadRadius ?? ADV.beadRadius;
  return {
    bowls: SIMPLE.bowls.map(b => {
      const colors = [];
      (b.colorCounts || []).forEach(cc => {
        const col = ADV.assets.beads[cc.color];
        if(col) for(let i=0;i<cc.count;i++) colors.push(col);
      });
      if(!colors.length) colors.push(...Object.values(ADV.assets.beads));
      return { colors };
    }),
    beadRadius,
    beadGap: ADV.beadGap
  };
}
let CFG = makeCFG();

/* ============ DOM & VIEWBOX ============ */
const svg = document.getElementById("bowlSVG");
const VB_W = 500, VB_H = 300;
svg.setAttribute("viewBox", `0 0 ${VB_W} ${VB_H}`);

/* ============ LAG ============ */
const gBowls = mk("g",{class:"bowls"});
svg.appendChild(gBowls);

/* ============ STATE ============ */
const STATE = (window.STATE && typeof window.STATE === "object") ? window.STATE : {};
window.STATE = STATE;
if(!Array.isArray(STATE.bowls)) STATE.bowls = [];

const bowls = [];
const controls = document.getElementById("controls");
const colors = Object.keys(ADV.assets.beads);
const assetToColor = Object.entries(ADV.assets.beads).reduce((acc, [color, src]) => {
  acc[src] = color;
  return acc;
}, {});
const counts = {};
const displays = {};
let beadRadius = CFG.beadRadius;
let sizeDisplay, sizeSlider;
let dragBead = null;
let dragOffX = 0, dragOffY = 0;
let dragInfo = null;
colors.forEach(color => {
  const existing = (SIMPLE.bowls[0].colorCounts || []).find(cc => cc.color === color);
  counts[color] = existing ? existing.count : 0;
  const row = document.createElement("div");
  row.className = "ctrlRow";
  const label = document.createElement("span");
  label.textContent = `${cap(color)} kuler`;
  const minus = document.createElement("button");
  minus.type = "button";
  minus.textContent = "−";
  const countSpan = document.createElement("span");
  countSpan.className = "count";
  countSpan.textContent = counts[color];
  const plus = document.createElement("button");
  plus.type = "button";
  plus.textContent = "+";
  minus.addEventListener("click", () => change(color, -1));
  plus.addEventListener("click", () => change(color, 1));
  row.append(label, minus, countSpan, plus);
  controls.appendChild(row);
  displays[color] = countSpan;
});

const sizeRow = document.createElement("div");
sizeRow.className = "ctrlRow";
const sizeLabel = document.createElement("span");
sizeLabel.textContent = "Kulestørrelse";
const sizeMinus = document.createElement("button");
sizeMinus.type = "button";
sizeMinus.textContent = "−";
const sizeInput = document.createElement("input");
sizeInput.type = "range";
sizeInput.min = "5";
sizeInput.max = "60";
sizeInput.value = beadRadius;
sizeInput.style.flex = "1";
const sizeSpan = document.createElement("span");
sizeSpan.className = "count";
sizeSpan.textContent = beadRadius;
const sizePlus = document.createElement("button");
sizePlus.type = "button";
sizePlus.textContent = "+";
sizeMinus.addEventListener("click", () => changeSize(-2));
sizePlus.addEventListener("click", () => changeSize(2));
sizeInput.addEventListener("input", () => setSize(parseInt(sizeInput.value)));
sizeRow.append(sizeLabel, sizeMinus, sizeInput, sizePlus, sizeSpan);
controls.appendChild(sizeRow);
sizeDisplay = sizeSpan;
sizeSlider = sizeInput;

render();

document.getElementById("downloadSVG").addEventListener("click", downloadSVG);
document.getElementById("downloadPNG").addEventListener("click", downloadPNG);

/* ============ FUNKSJONER ============ */
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

function render(){
  gBowls.innerHTML = "";
  bowls.length = 0;
  if(STATE.bowls.length > CFG.bowls.length) STATE.bowls.length = CFG.bowls.length;
  CFG.bowls.forEach((bCfg, idx) => {
    const g = mk("g", {class:"bowl"});
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

    const gBeads = mk("g", {class:"beads"});
    const nBeads = bCfg.colors.length;
    const beadD = CFG.beadRadius * 2;
    const bowlState = getBowlState(idx);
    const colorPositions = bowlState.byColor;
    const colorUsage = {};
    const placed = [];
    const cx = midX;
    const cy = rimY + bowlDepth;
    const rx = bowlWidth / 2 - CFG.beadRadius;
    const ry = bowlDepth - CFG.beadRadius;
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
    for(let i=0;i<nBeads;i++){
      const src = bCfg.colors[i % bCfg.colors.length];
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
        x: pos.x - CFG.beadRadius,
        y: pos.y - CFG.beadRadius,
        width: beadD,
        height: beadD,
        class: "bead beadShadow"
      });
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
    gBowls.appendChild(g);
    bowls.push({group:g, beads:gBeads, cfg:bCfg});
  });
}

function change(color, delta){
  counts[color] = Math.max(0, counts[color] + delta);
  displays[color].textContent = counts[color];
  updateConfig();
}

function changeSize(delta){
    setSize(beadRadius + delta);
  }

function setSize(value){
    beadRadius = Math.max(5, value);
    sizeDisplay.textContent = beadRadius;
    if(sizeSlider) sizeSlider.value = beadRadius;
    updateConfig();
  }

function updateConfig(){
    SIMPLE.bowls[0].colorCounts = colors.map(c => ({ color: c, count: counts[c] }));
    SIMPLE.beadRadius = beadRadius;
    CFG = makeCFG();
    render();
  }

function startDrag(e){
  dragBead = e.target;
  const bowlIdx = Number.parseInt(dragBead.dataset.bowl, 10);
  const colorIdx = Number.parseInt(dragBead.dataset.colorIndex, 10);
  const colorKey = dragBead.dataset.color;
  dragInfo = {
    bowlIdx: Number.isNaN(bowlIdx) ? null : bowlIdx,
    colorKey: typeof colorKey === "string" && colorKey ? colorKey : null,
    colorIndex: Number.isNaN(colorIdx) ? null : colorIdx
  };
  const pt = svgPoint(e);
  const x = parseFloat(dragBead.getAttribute("x"));
  const y = parseFloat(dragBead.getAttribute("y"));
  dragOffX = pt.x - x;
  dragOffY = pt.y - y;
  svg.addEventListener("pointermove", onDrag);
  svg.addEventListener("pointerup", endDrag);
  svg.addEventListener("pointercancel", endDrag);
  try{svg.setPointerCapture(e.pointerId);}catch(_){}
}

function onDrag(e){
  if(!dragBead) return;
  const pt = svgPoint(e);
  dragBead.setAttribute("x", pt.x - dragOffX);
  dragBead.setAttribute("y", pt.y - dragOffY);
  storeDragPosition();
}

function endDrag(e){
  svg.removeEventListener("pointermove", onDrag);
  svg.removeEventListener("pointerup", endDrag);
  svg.removeEventListener("pointercancel", endDrag);
  try{svg.releasePointerCapture(e.pointerId);}catch(_){}
  storeDragPosition();
  dragBead = null;
  dragInfo = null;
}

function storeDragPosition(){
  if(!dragBead || !dragInfo) return;
  const { bowlIdx, colorKey, colorIndex } = dragInfo;
  if(bowlIdx == null || colorKey == null || colorIndex == null) return;
  const x = parseFloat(dragBead.getAttribute("x"));
  const y = parseFloat(dragBead.getAttribute("y"));
  if(!Number.isFinite(x) || !Number.isFinite(y)) return;
  const bowlState = getBowlState(bowlIdx);
  const colorPositions = bowlState.byColor;
  const arr = Array.isArray(colorPositions[colorKey]) ? colorPositions[colorKey] : (colorPositions[colorKey] = []);
  arr[colorIndex] = { x: x + CFG.beadRadius, y: y + CFG.beadRadius };
}

function svgPoint(evt){
  const p = svg.createSVGPoint();
  p.x = evt.clientX;
  p.y = evt.clientY;
  return p.matrixTransform(svg.getScreenCTM().inverse());
}

/* ===== helpers ===== */
function mk(n,attrs={}){ const e=document.createElementNS("http://www.w3.org/2000/svg",n);
  for(const [k,v] of Object.entries(attrs)) e.setAttribute(k,v); return e; }
function cap(s){ return s[0].toUpperCase()+s.slice(1); }

async function inlineImages(svgEl){
  const imgs = svgEl.querySelectorAll("image");
  await Promise.all(Array.from(imgs).map(async img => {
    const src = img.getAttribute("href");
    const res = await fetch(src);
    const blob = await res.blob();
    const dataUrl = await new Promise(res => {
      const reader = new FileReader();
      reader.onload = () => res(reader.result);
      reader.readAsDataURL(blob);
    });
    img.setAttribute("href", dataUrl);
  }));
}

async function downloadSVG(){
  const clone = svg.cloneNode(true);
  await inlineImages(clone);
  const data = new XMLSerializer().serializeToString(clone);
  const blob = new Blob([data], {type:"image/svg+xml"});
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "kuler.svg";
  a.click();
  URL.revokeObjectURL(url);
}

async function downloadPNG(){
  const clone = svg.cloneNode(true);
  await inlineImages(clone);
  const data = new XMLSerializer().serializeToString(clone);
  const svgBlob = new Blob([data], {type:"image/svg+xml"});
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
      const pngUrl = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = pngUrl;
      a.download = "kuler.png";
      a.click();
      URL.revokeObjectURL(pngUrl);
    });
  };
  img.src = url;
}
