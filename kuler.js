/* ============ ENKEL KONFIG (FORFATTER) ============ */
const SIMPLE = {
  bowls: [
    {
      colorCounts: [
        { color: "blue", count: 2 },
        { color: "red", count: 3 }
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
      red:    "images/redDots.svg"
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
    const rx = bowlWidth/2 - CFG.beadRadius;
    const ry = bowlDepth - CFG.beadRadius;
    for(let i=0;i<nBeads;i++){
      const angle = Math.random() * Math.PI;
      const radius = Math.sqrt(Math.random());
      const cx = midX + rx * radius * Math.cos(angle);
      const cy = rimY + ry * radius * Math.sin(angle);
      const src = bCfg.colors[i % bCfg.colors.length];
      const bead = mk("image", {
        href: src,
        x: cx - CFG.beadRadius,
        y: cy - CFG.beadRadius,
        width: CFG.beadRadius * 2,
        height: CFG.beadRadius * 2,
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

function updateConfig(){
  SIMPLE.bowls[0].colorCounts = colors.map(c => ({ color: c, count: counts[c] }));
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
