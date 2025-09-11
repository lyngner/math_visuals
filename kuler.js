/* ============ ENKEL KONFIG (FORFATTER) ============ */
const SIMPLE = {
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
const ADV = {
  beadRadius: 20,
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
    beadRadius: ADV.beadRadius,
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
const bowls = [];
const controls = document.getElementById("controls");
const colors = Object.keys(ADV.assets.beads);
const counts = {};
const displays = {};
let beadRadius = ADV.beadRadius;
let sizeDisplay;
let dragBead = null;
let dragOffX = 0, dragOffY = 0;
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
const sizeSpan = document.createElement("span");
sizeSpan.className = "count";
sizeSpan.textContent = beadRadius;
const sizePlus = document.createElement("button");
sizePlus.type = "button";
sizePlus.textContent = "+";
sizeMinus.addEventListener("click", () => changeSize(-2));
sizePlus.addEventListener("click", () => changeSize(2));
sizeRow.append(sizeLabel, sizeMinus, sizeSpan, sizePlus);
controls.appendChild(sizeRow);
sizeDisplay = sizeSpan;

render();

/* ============ FUNKSJONER ============ */
function render(){
  gBowls.innerHTML = "";
  bowls.length = 0;
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
    const perRow = Math.max(1, Math.floor((bowlWidth + CFG.beadGap) / (beadD + CFG.beadGap)));
    const startCy = rimY + bowlDepth - CFG.beadRadius;
    for(let i=0;i<nBeads;i++){
      const row = Math.floor(i / perRow);
      const col = i % perRow;
      const beadsInRow = Math.min(perRow, nBeads - row * perRow);
      const rowWidth = beadsInRow * beadD + Math.max(0, beadsInRow - 1) * CFG.beadGap;
      const startCx = midX - rowWidth / 2 + CFG.beadRadius;
      const cx = startCx + col * (beadD + CFG.beadGap);
      const cy = startCy - row * (beadD + CFG.beadGap);
      const src = bCfg.colors[i % bCfg.colors.length];
      const bead = mk("image", {
        href: src,
        x: cx - CFG.beadRadius,
        y: cy - CFG.beadRadius,
        width: beadD,
        height: beadD,
        class: "bead beadShadow"
      });
      bead.addEventListener("pointerdown", startDrag);
      gBeads.appendChild(bead);
    }
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
  beadRadius = Math.max(5, beadRadius + delta);
  sizeDisplay.textContent = beadRadius;
  updateConfig();
}

function updateConfig(){
  SIMPLE.bowls[0].colorCounts = colors.map(c => ({ color: c, count: counts[c] }));
  ADV.beadRadius = beadRadius;
  CFG = makeCFG();
  render();
}

function startDrag(e){
  dragBead = e.target;
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
}

function endDrag(e){
  svg.removeEventListener("pointermove", onDrag);
  svg.removeEventListener("pointerup", endDrag);
  svg.removeEventListener("pointercancel", endDrag);
  try{svg.releasePointerCapture(e.pointerId);}catch(_){}
  dragBead = null;
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
