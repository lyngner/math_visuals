/* ============ ENKEL KONFIG (FORFATTER) ============ */
const SIMPLE = {
  bowls: [
    {
      colorCounts: [
        { color: "red", count: 4 },
        { color: "blue", count: 4 },
        { color: "green", count: 4 },
        { color: "yellow", count: 4 },
        { color: "pink", count: 4 },
        { color: "purple", count: 4 }
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
      red:    "images/redDots.svg",
      blue:   "images/blueWave.svg",
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
const inputs = {};
Object.keys(ADV.assets.beads).forEach(color => {
  const label = document.createElement("label");
  label.textContent = `${cap(color)} kuler`;
  const input = document.createElement("input");
  input.type = "number";
  input.min = "0";
  const bowl = SIMPLE.bowls[0];
  const existing = (bowl.colorCounts || []).find(cc => cc.color === color);
  input.value = existing ? existing.count : 0;
  input.dataset.color = color;
  label.appendChild(input);
  controls.appendChild(label);
  inputs[color] = input;
  input.addEventListener("input", updateFromInputs);
});

updateFromInputs();

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
      gBeads.appendChild(bead);
    }
    g.appendChild(bowlImg);
    g.appendChild(gBeads);
    gBowls.appendChild(g);
    bowls.push({group:g, beads:gBeads, cfg:bCfg});
  });
}

function updateFromInputs(){
  const bowl = SIMPLE.bowls[0];
  bowl.colorCounts = Object.entries(inputs).map(([color, inp]) => ({
    color, count: parseInt(inp.value) || 0
  }));
  CFG = makeCFG();
  render();
}

/* ===== helpers ===== */
function mk(n,attrs={}){ const e=document.createElementNS("http://www.w3.org/2000/svg",n);
  for(const [k,v] of Object.entries(attrs)) e.setAttribute(k,v); return e; }
function cap(s){ return s[0].toUpperCase()+s.slice(1); }
