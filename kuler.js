/* ============ ENKEL KONFIG (FORFATTER) ============ */
const SIMPLE = {
  bowls: [
    { nBeads: 8, colors: [] }
  ]
};

/* ============ ADV KONFIG (TEKNISK/VALGFRITT) ============ */
const ADV = {
  beadRadius: 30,
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
    bowls: SIMPLE.bowls.map(b => ({
      nBeads: b.nBeads,
      colors: (b.colors && b.colors.length) ? b.colors : [ADV.assets.beadRed, ADV.assets.beadBlue]
    })),
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

render();

/* ============ FUNKSJONER ============ */
function render(){
  gBowls.innerHTML = "";
  bowls.length = 0;
  CFG.bowls.forEach((bCfg, idx) => {
    const g = mk("g", {class:"bowl"});
    const bowlImg = img(CFG.assets.bowl, 0, 150, VB_W, 100, "bowlImg");
    g.appendChild(bowlImg);

    const gBeads = mk("g", {class:"beads"});
    const totalWidth = bCfg.nBeads * 2 * CFG.beadRadius + (bCfg.nBeads - 1) * CFG.beadGap;
    let x = (VB_W - totalWidth) / 2;
    const y = 150 - CFG.beadRadius;
    for(let i=0;i<bCfg.nBeads;i++){
      const href = bCfg.colors[i % bCfg.colors.length];
      const bead = img(href, x, y, 2*CFG.beadRadius, 2*CFG.beadRadius, "bead beadShadow");
      gBeads.appendChild(bead);
      x += 2*CFG.beadRadius + CFG.beadGap;
    }
    g.appendChild(gBeads);
    gBowls.appendChild(g);
    bowls.push({group:g, beads:gBeads, cfg:bCfg});
  });
}

/* ===== helpers ===== */
function mk(n,attrs={}){ const e=document.createElementNS("http://www.w3.org/2000/svg",n);
  for(const [k,v] of Object.entries(attrs)) e.setAttribute(k,v); return e; }
function img(href,x,y,w,h,cls=""){ return mk("image",{href,x,y,width:w,height:h, class:cls}); }
