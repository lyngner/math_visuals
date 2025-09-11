/* ============ ENKEL KONFIG (FORFATTER) ============ */
const SIMPLE = {
  bowls: [
    {
      colorCounts: [
        { color: "red", count: 4 },
        { color: "blue", count: 4 }
      ]
    }
  ]
};

/* ============ ADV KONFIG (TEKNISK/VALGFRITT) ============ */
const ADV = {
  beadRadius: 20,
  beadGap: 12,
  assets: {
    bowl:     "https://test.kikora.no/img/drive/illustrasjoner/Matteobjekter/Hjelpemidler/bowl.svg",
    beadRed:  "https://test.kikora.no/img/drive/figures/games/spheres/redDots.svg",
    beadBlue: "https://test.kikora.no/img/drive/figures/games/spheres/blueWave.svg"
  }
};

/* ============ DERIVERT KONFIG FOR RENDER (IKKE REDIGER) ============ */
function makeCFG(){
  return {
    bowls: SIMPLE.bowls.map(b => {
      const colors = [];
      (b.colorCounts || []).forEach(cc => {
        const key = "bead" + cc.color[0].toUpperCase() + cc.color.slice(1);
        const src = ADV.assets[key];
        if(src) for(let i=0;i<cc.count;i++) colors.push(src);
      });
      if(!colors.length) colors.push(ADV.assets.beadRed, ADV.assets.beadBlue);
      return { colors };
    }),
    beadRadius: ADV.beadRadius,
    beadGap: ADV.beadGap,
    assets: ADV.assets
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

const redInput = document.getElementById("redCount");
const blueInput = document.getElementById("blueCount");
redInput.addEventListener("input", updateFromInputs);
blueInput.addEventListener("input", updateFromInputs);

updateFromInputs();

/* ============ FUNKSJONER ============ */
function render(){
  gBowls.innerHTML = "";
  bowls.length = 0;
  CFG.bowls.forEach((bCfg, idx) => {
    const g = mk("g", {class:"bowl"});
    const bowlImg = img(CFG.assets.bowl, 0, 150, VB_W, 100, "bowlImg");
    g.appendChild(bowlImg);

    const gBeads = mk("g", {class:"beads"});
    const nBeads = bCfg.colors.length;
    const totalWidth = nBeads * 2 * CFG.beadRadius + (nBeads - 1) * CFG.beadGap;
    const startX = (VB_W - totalWidth) / 2 + CFG.beadRadius;
    const step = 2 * CFG.beadRadius + CFG.beadGap;
    const baseY = 150 - CFG.beadRadius;
    const midX = VB_W / 2;
    const halfW = totalWidth / 2;
    const BOWL_DEPTH = 60;
    for(let i=0;i<nBeads;i++){
      const cx = startX + i * step;
      const t = halfW ? (cx - midX) / halfW : 0;
      const cy = baseY + BOWL_DEPTH * (1 - t * t);
      const href = bCfg.colors[i % bCfg.colors.length];
      const bead = img(href, cx - CFG.beadRadius, cy - CFG.beadRadius, 2*CFG.beadRadius, 2*CFG.beadRadius, "bead beadShadow");
      gBeads.appendChild(bead);
    }
    g.appendChild(gBeads);
    gBowls.appendChild(g);
    bowls.push({group:g, beads:gBeads, cfg:bCfg});
  });
}

function updateFromInputs(){
  const red = parseInt(redInput.value) || 0;
  const blue = parseInt(blueInput.value) || 0;
  const bowl = SIMPLE.bowls[0];
  bowl.colorCounts = [
    { color: "red", count: red },
    { color: "blue", count: blue }
  ];
  CFG = makeCFG();
  render();
}

/* ===== helpers ===== */
function mk(n,attrs={}){ const e=document.createElementNS("http://www.w3.org/2000/svg",n);
  for(const [k,v] of Object.entries(attrs)) e.setAttribute(k,v); return e; }
function img(href,x,y,w,h,cls=""){ return mk("image",{href,x,y,width:w,height:h, class:cls}); }
