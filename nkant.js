/* ==========================================================
   NKANT – ÉN SVG med 1–2 figurer
   • Sider: none | value | custom | custom+value
   • Vinkler/punkter: none | mark | mark+value | custom | custom+mark | custom+mark+value
   • Ved custom*: punktnavn vises utenfor langs vinkelhalveringen; vinkelverdi inne i sektoren
   ========================================================== */

/* ---------- DEFAULT SPECS (leses fra HTML) ---------- */
let DEFAULT_SPECS = "";

/* ---------- ADV (dine verdier) ---------- */
const ADV_CONFIG = {
  angle: {
    // radius = clamp(factor * min(|QP|,|QR|), [min,max])
    factor: 0.28,
    min: 18,
    max: 60,

    // Tekstplassering langs vinkelhalveringen:
    insideK:  { right: 1.5, other: 1.5 }, // vinkelverdi (innsiden)
    outsideK: { right: 0.5, other: 0.50 }, // punktnavn (utsiden)
    outsidePad: 0,

    // Hindrer at punktnavn "flyr" for langt ut
    outsideMaxFactor: 0.90, // maks 90% av korteste naboside
    outsideMin: 6          // liten gulvavstand ut fra hjørnet
  }
};

/* ---------- STATE (UI) ---------- */
const STATE = {
  specsText: "",
  fig1: {
    sides:  { default: "value", a:"inherit", b:"inherit", c:"inherit", d:"inherit",
              aText:"a", bText:"b", cText:"c", dText:"d" },
    angles: { default: "custom+mark+value", A:"inherit", B:"inherit", C:"inherit", D:"inherit",
              AText:"A", BText:"B", CText:"C", DText:"D" }
  },
  fig2: {
    sides:  { default: "none", a:"inherit", b:"inherit", c:"inherit", d:"inherit",
              aText:"a", bText:"b", cText:"c", dText:"d" },
    angles: { default: "custom+mark+value", A:"inherit", B:"inherit", C:"inherit", D:"inherit",
              AText:"A", BText:"B", CText:"C", DText:"D" }
  },
  layout: "row" // "row" | "col"
};

/* ---------- STIL ---------- */
const STYLE = {
  faceFill: "#f5f7fa",
  edgeStroke: "#333",
  edgeWidth: 4,
  angStroke: "#147a9c",
  angWidth: 4,
  angFill: "#147a9c22",
  textFill: "#111827",
  textHalo: "#fff",
  textHaloW: 6,
  sideFS: 26,
  ptFS: 32,
  angFS: 22
};

/* ---------- HJELPERE ---------- */
const deg  = r => r * 180 / Math.PI;
const rad  = d => d * Math.PI / 180;
const clamp = (x, lo, hi) => Math.max(lo, Math.min(hi, x));
const clampCos = x => clamp(x, -1, 1);
const fmt = n => (Math.round(n*10)/10).toString().replace(".", ",");

function deepAssign(target, src){
  if(!src) return;
  Object.entries(src).forEach(([k,v])=>{
    if(v && typeof v === "object" && !Array.isArray(v)){
      if(!target[k] || typeof target[k] !== "object") target[k] = {};
      deepAssign(target[k], v);
    } else {
      target[k] = v;
    }
  });
}

function add(parent, name, attrs = {}){
  const el = document.createElementNS("http://www.w3.org/2000/svg", name);
  Object.entries(attrs).forEach(([k,v]) => el.setAttribute(k, String(v)));
  parent.appendChild(el);
  return el;
}
const dist = (P,Q)=> Math.hypot(P.x-Q.x, P.y-Q.y);
const mid  = (P,Q)=> ({x:(P.x+Q.x)/2, y:(P.y+Q.y)/2});

function polygonArea(pts){
  let s=0; for(let i=0;i<pts.length;i++){const a=pts[i], b=pts[(i+1)%pts.length]; s+=a.x*b.y-b.x*a.y;}
  return s/2;
}
function polygonCentroid(pts){
  let A=0, cx=0, cy=0;
  for(let i=0;i<pts.length;i++){
    const p=pts[i], q=pts[(i+1)%pts.length];
    const c=p.x*q.y-q.x*p.y; A+=c; cx+=(p.x+q.x)*c; cy+=(p.y+q.y)*c;
  }
  A=A/2; if(Math.abs(A)<1e-9) return mid(pts[0], pts[2]||pts[0]);
  return {x:cx/(6*A), y:cy/(6*A)};
}

function fitTransformToRect(pts, rectW, rectH, margin=46){
  const xs=pts.map(p=>p.x), ys=pts.map(p=>p.y);
  const minx=Math.min(...xs), maxx=Math.max(...xs);
  const miny=Math.min(...ys), maxy=Math.max(...ys);
  const cw=Math.max(1e-6, maxx-minx);
  const ch=Math.max(1e-6, maxy-miny);
  const k = Math.min((rectW-2*margin)/cw, (rectH-2*margin)/ch);

  const T = p => ({ x: margin + k*(p.x - minx), y: (rectH - margin) - k*(p.y - miny) });
  return {T,k};
}

function angleAt(V, P, R){
  const ux=P.x-V.x, uy=P.y-V.y, vx=R.x-V.x, vy=R.y-V.y;
  const du=Math.hypot(ux,uy)||1, dv=Math.hypot(vx,vy)||1;
  const c = clampCos((ux*vx+uy*vy)/(du*dv));
  return deg(Math.acos(c));
}
function unitVec(A,B){ const dx=B.x-A.x, dy=B.y-A.y, L=Math.hypot(dx,dy)||1; return {x:dx/L, y:dy/L}; }

function addHaloText(parent, x, y, txt, fontSizePx, extraAttrs = {}){
  const t = add(parent, "text", {
    x, y, fill: STYLE.textFill, "font-size": fontSizePx,
    style: `paint-order:stroke fill;stroke:${STYLE.textHalo};stroke-width:${STYLE.textHaloW};stroke-linejoin:round;`
  });
  Object.entries(extraAttrs).forEach(([k,v])=>t.setAttribute(k, String(v)));
  t.textContent = txt;
  return t;
}

/* ---------- PARSE ---------- */
function parseSpec(str){
  const out = {};
  if(!str) return out;
  str.split(/[,;\n]/).forEach(chunk=>{
    const [kRaw, vRaw] = chunk.split("=");
    if(!kRaw || !vRaw) return;
    const key = kRaw.trim().replace(/\s+/g,""); // a,b,c,d,A,B,C,D
    const v = parseFloat(vRaw.trim().replace(",","."));
    if(!isFinite(v)) return;
    out[key] = v;
  });
  return out;
}

/* ---------- VISNINGSTEKSTER ---------- */
// Sider: none | value | custom | custom+value
function buildSideText(mode, valueStr, customText){
  const t = (mode ?? "value").toString().trim();
  if(t === "none")            return null;
  if(t === "value")           return valueStr;
  if(t === "custom")          return (customText ?? "");
  if(t === "custom+value")    return `${customText ?? ""}=${valueStr}`;
  return valueStr; // fallback
}

/* Vinkler/punkter:
   none | mark | mark+value | custom | custom+mark | custom+mark+value
   → { mark:bool, angleText:string|null, pointLabel:string|null } */
function parseAnglePointMode(modeStr, valueDeg, customText, fallbackPointLetter){
  // tolerer "custum..." som synonym
  let t = (modeStr ?? "mark+value").toString().trim();
  t = t.replace(/^custum/, "custom");

  if(t === "none") return { mark:false, angleText:null, pointLabel:null };
  const hasMark  = t.includes("mark");
  const hasVal   = t.includes("value");
  const isCustom = t.startsWith("custom");

  const angleText = hasVal ? `${Math.round(valueDeg)}°` : null;
  const pointLabel = isCustom ? (customText || fallbackPointLetter || "") : null;
  return { mark: hasMark, angleText, pointLabel };
}

/* ---------- ANGLE RADIUS (smart default + ADV) ---------- */
function angleRadius(Q, P, R){
  const f   = ADV_CONFIG.angle.factor;
  const r0  = f * Math.min(dist(Q,P), dist(Q,R));
  return clamp(r0, ADV_CONFIG.angle.min, ADV_CONFIG.angle.max);
}

/* ---------- VINKELTEGNING + PLASSERING (NY) ---------- */
function renderAngle(g, Q, P, R, r, opts){
  const aDeg = angleAt(Q,P,R);
  const isRight = Math.abs(aDeg - 90) < 0.5;

  // retningsvektorer og vinkelhalvering
  const u = unitVec(Q,P), v = unitVec(Q,R);
  const bisLen = Math.hypot(u.x+v.x, u.y+v.y) || 1;
  const bis  = { x:(u.x+v.x)/bisLen, y:(u.y+v.y)/bisLen }; // inn i sektoren
  const nBis = { x:-bis.x,          y:-bis.y          };   // ut av figuren

  // markering (bue/kvadrat)
  if(opts.mark){
    if (isRight){
      const s = r * 1.0;
      const q  = {x:Q.x,               y:Q.y};
      const p1 = {x:Q.x + u.x*s,       y:Q.y + u.y*s};
      const p2 = {x:Q.x + (u.x+v.x)*s, y:Q.y + (u.y+v.y)*s};
      const p3 = {x:Q.x + v.x*s,       y:Q.y + v.y*s};
      add(g,"polygon",{ points:`${q.x},${q.y} ${p1.x},${p1.y} ${p2.x},${p2.y} ${p3.x},${p3.y}`, fill: STYLE.angFill, stroke:"none" });
      add(g,"polyline",{ points:`${p1.x},${p1.y} ${p2.x},${p2.y} ${p3.x},${p3.y}`, fill:"none", stroke: STYLE.angStroke, "stroke-width": STYLE.angWidth, "stroke-linejoin":"round", "stroke-linecap":"round" });
    } else {
      const a1 = Math.atan2(P.y-Q.y, P.x-Q.x);
      const a2 = Math.atan2(R.y-Q.y, R.x-Q.x);
      let d = a2 - a1; while(d<=-Math.PI) d+=2*Math.PI; while(d>Math.PI) d-=2*Math.PI;
      const o = Math.sign((P.x-Q.x)*(R.y-Q.y) - (P.y-Q.y)*(R.x-Q.x));
      if(o>0 && d<0) d+=2*Math.PI;
      if(o<0 && d>0) d-=2*Math.PI;
      const large = Math.abs(d)>Math.PI ? 1 : 0;
      const sweep = (o>0)?1:0;
      const A1 = {x:Q.x + r*Math.cos(a1),   y:Q.y + r*Math.sin(a1)};
      const B1 = {x:Q.x + r*Math.cos(a1+d), y:Q.y + r*Math.sin(a1+d)};
      const path = `M ${Q.x} ${Q.y} L ${A1.x} ${A1.y} A ${r} ${r} 0 ${large} ${sweep} ${B1.x} ${B1.y} Z`;
      add(g,"path",{ d:path, fill: STYLE.angFill, stroke:"none" });
      add(g,"path",{ d:path.replace("Z",""), fill:"none", stroke: STYLE.angStroke, "stroke-width": STYLE.angWidth });
    }
  }

  const cfg = ADV_CONFIG.angle;
  const insideK  = isRight ? cfg.insideK.right  : cfg.insideK.other;
  const outsideK = isRight ? cfg.outsideK.right : cfg.outsideK.other;

  // 90°: hvis markert, dropp verditekst
  const showAngleValue = opts.angleText && !(isRight && opts.mark);

  // vinkelverdi (inne i sektoren)
  if(showAngleValue){
    const Ti = { x: Q.x + bis.x * (insideK*r), y: Q.y + bis.y * (insideK*r) };
    addHaloText(g, Ti.x, Ti.y, opts.angleText, STYLE.angFS, {
      "text-anchor":"middle", "dominant-baseline":"middle"
    });
  }

  // punktnavn (ute på samme linje) – med clamp
  if(opts.pointLabel){
    const baseLen   = Math.min(dist(Q,P), dist(Q,R));
    const outTarget = outsideK*r + cfg.outsidePad;
    const outMax    = (cfg.outsideMaxFactor ?? 0.9) * baseLen;
    const outLen    = clamp(outTarget, (cfg.outsideMin ?? 0), outMax);
    const To = { x: Q.x + nBis.x * outLen, y: Q.y + nBis.y * outLen };
    addHaloText(g, To.x, To.y, opts.pointLabel, STYLE.ptFS, {
      "text-anchor":"middle", "dominant-baseline":"middle"
    });
  }
}

/* ---------- TEKST FOR SIDER ---------- */
function sideLabelText(g, P, Q, text, rotate, centroid, offset = 14) {
  if(!text) return;
  const M = { x: (P.x + Q.x) / 2, y: (P.y + Q.y) / 2 };
  const vx = Q.x - P.x, vy = Q.y - P.y;

  const nx = -vy, ny = vx;
  const dot = (centroid.x - M.x) * nx + (centroid.y - M.y) * ny;
  const sgn = dot > 0 ? 1 : -1;
  const nlen = Math.hypot(nx, ny) || 1;

  const adj = Math.max(offset, Math.min(22, dist(P,Q)*0.18));
  const x = M.x + (sgn * adj * nx) / nlen;
  const y = M.y + (sgn * adj * ny) / nlen;

  const t = addHaloText(g, x, y, text, STYLE.sideFS, { "text-anchor":"middle", "dominant-baseline":"middle" });

  if (rotate) {
    let theta = Math.atan2(vy, vx) * 180 / Math.PI;
    if (theta > 90)  theta -= 180;
    if (theta < -90) theta += 180;
    t.setAttribute("transform", `rotate(${theta}, ${x}, ${y})`);
  }
}

/* ---------- TEGN FIGURER ---------- */
function ptsTo(arr){ return arr.map(p=>`${p.x},${p.y}`).join(" "); }
function shift(P, rect){ return {x:P.x + rect.x, y:P.y + rect.y}; }
function errorBox(g, rect, msg){
  add(g,"rect",{x:rect.x+10, y:rect.y+10, width:rect.w-20, height:40, rx:8, fill:"#ffecec", stroke:"#ffb3b3"});
  add(g,"text",{x:rect.x+20, y:rect.y+36, fill:"#c00", "font-size":16}).textContent = msg;
}

function drawTriangleToGroup(g, rect, specStr, adv){
  const s = parseSpec(specStr);
  const sol = solveTriangle(s);

  // y-opp konfig
  const A0={x:0, y:0};
  const B0={x:sol.c, y:0};
  const Cs = circleCircle(A0, sol.b, B0, sol.a);
  if(Cs.length===0) throw new Error("Trekant: ingen løsning fra oppgitte verdier.");
  const C0 = (Cs[0].y >= (Cs[1]?.y ?? -1e9) ? Cs[0] : (Cs[1] || Cs[0]));

  const base=[A0,B0,C0];
  const {T} = fitTransformToRect(base, rect.w, rect.h, 46);
  const A=shift(T(A0),rect), B=shift(T(B0),rect), C=shift(T(C0),rect), poly=[A,B,C];

  add(g,"polygon",{points:ptsTo(poly), fill:STYLE.faceFill, stroke:"none"});
  const ctr = polygonCentroid(poly);

  // sider
  const m = adv.sides.mode, st = adv.sides.text;
  sideLabelText(g, B, C, buildSideText(m.a ?? m.default, fmt(sol.a), st.a), true, ctr);
  sideLabelText(g, C, A, buildSideText(m.b ?? m.default, fmt(sol.b), st.b), true, ctr);
  sideLabelText(g, A, B, buildSideText(m.c ?? m.default, fmt(sol.c), st.c), true, ctr);

  // vinkler/punkter
  const am = adv.angles.mode, at = adv.angles.text;
  const Ares = parseAnglePointMode(am.A ?? am.default, angleAt(A,B,C), at.A, "A");
  const Bres = parseAnglePointMode(am.B ?? am.default, angleAt(B,C,A), at.B, "B");
  const Cres = parseAnglePointMode(am.C ?? am.default, angleAt(C,A,B), at.C, "C");

  renderAngle(g, A, B, C, angleRadius(A,B,C), { mark:Ares.mark, angleText:Ares.angleText, pointLabel:Ares.pointLabel });
  renderAngle(g, B, C, A, angleRadius(B,C,A), { mark:Bres.mark, angleText:Bres.angleText, pointLabel:Bres.pointLabel });
  renderAngle(g, C, A, B, angleRadius(C,A,B), { mark:Cres.mark, angleText:Cres.angleText, pointLabel:Cres.pointLabel });

  add(g,"polygon",{points:ptsTo(poly), fill:"none", stroke:STYLE.edgeStroke, "stroke-width": STYLE.edgeWidth, "stroke-linejoin":"round","stroke-linecap":"round"});
}

function drawQuadToGroup(g, rect, specStr, adv){
  const s = parseSpec(specStr);
  const a=s.a, b=s.b, c=s.c, d=s.d;
  if(!(a>0 && b>0 && c>0 && d>0)) throw new Error("Firkant: må ha a, b, c, d > 0.");
  const angleKey = ["A","B","C","D"].find(k => k in s);
  if(!angleKey) throw new Error("Firkant: angi én vinkel (A, B, C eller D).");

  const A0={x:0,y:0}, B0={x:a,y:0}; let C0, D0;

  const pickCCW_D = (C, D1, D2) => {
    const area1 = polygonArea([A0,B0,C,D1]);
    const area2 = polygonArea([A0,B0,C,D2]);
    if(area1 >= 0 && area2 < 0) return D1;
    if(area2 >= 0 && area1 < 0) return D2;
    return (area1 >= area2) ? D1 : D2;
  };

  if(angleKey === "A"){
    const theta = rad(s.A);
    D0 = {x: A0.x + d*Math.cos(theta), y: A0.y + d*Math.sin(theta)};
    const Cs = circleCircle(B0, b, D0, c);
    if(Cs.length===0) throw new Error("Firkant (A): ingen løsning – sjekk mål.");
    C0 = (Cs.length===1) ? Cs[0] : (polygonArea([A0,B0,Cs[0],D0]) > polygonArea([A0,B0,Cs[1],D0]) ? Cs[0] : Cs[1]);
  } else if(angleKey === "B"){
    const theta = Math.PI - rad(s.B);
    C0 = {x: B0.x + b*Math.cos(theta), y: B0.y + b*Math.sin(theta)};
    const Ds = circleCircle(A0, d, C0, c);
    if(Ds.length===0) throw new Error("Firkant (B): ingen løsning – sjekk mål.");
    D0 = (Ds.length===1) ? Ds[0] : pickCCW_D(C0, Ds[0], Ds[1]);
  } else {
    const Cs = circleCircle(A0, b, B0, a);
    if(Cs.length===0) throw new Error(`Firkant (${angleKey}): ingen løsning – sjekk mål.`);
    C0 = (Cs[0].y >= (Cs[1]?.y ?? -1e9) ? Cs[0] : (Cs[1] || Cs[0]));
    const Ds = circleCircle(A0, d, C0, c);
    if(Ds.length===0) throw new Error(`Firkant (${angleKey}): ingen løsning – sjekk mål.`);
    if(Ds.length===1){ D0 = Ds[0]; }
    else{
      if(angleKey === "C"){
        const cand = Ds.map(Dc => ({D: Dc, ang: angleAt(C0, B0, Dc)}));
        cand.sort((u,v)=> Math.abs(u.ang - s.C) - Math.abs(v.ang - s.C));
        D0 = cand[0].D;
        if(polygonArea([A0,B0,C0,D0]) < 0) D0 = (Ds[0]===D0 ? Ds[1] : Ds[0]);
      } else if(angleKey === "D"){
        const cand = Ds.map(Dc => ({D: Dc, ang: angleAt(Dc, C0, A0)}));
        cand.sort((u,v)=> Math.abs(u.ang - s.D) - Math.abs(v.ang - s.D));
        D0 = cand[0].D;
        if(polygonArea([A0,B0,C0,D0]) < 0) D0 = (Ds[0]===D0 ? Ds[1] : Ds[0]);
      } else {
        D0 = pickCCW_D(C0, Ds[0], Ds[1]);
      }
    }
  }

  const base=[A0,B0,C0,D0];
  const {T} = fitTransformToRect(base, rect.w, rect.h, 46);
  const A=shift(T(A0),rect), B=shift(T(B0),rect), C=shift(T(C0),rect), D=shift(T(D0),rect);
  const poly=[A,B,C,D];

  add(g,"polygon",{points:ptsTo(poly), fill:STYLE.faceFill, stroke:"none"});
  const ctr = polygonCentroid(poly);

  // sider
  const m = adv.sides.mode, st = adv.sides.text;
  sideLabelText(g, A, B, buildSideText(m.a ?? m.default, fmt(a), st.a), true, ctr);
  sideLabelText(g, B, C, buildSideText(m.b ?? m.default, fmt(b), st.b), true, ctr);
  sideLabelText(g, C, D, buildSideText(m.c ?? m.default, fmt(c), st.c), true, ctr);
  sideLabelText(g, D, A, buildSideText(m.d ?? m.default, fmt(d), st.d), true, ctr);

  // vinkler/punkter
  const am = adv.angles.mode, at = adv.angles.text;
  const Ares = parseAnglePointMode(am.A ?? am.default, angleAt(A,D,B), at.A, "A");
  const Bres = parseAnglePointMode(am.B ?? am.default, angleAt(B,A,C), at.B, "B");
  const Cres = parseAnglePointMode(am.C ?? am.default, angleAt(C,B,D), at.C, "C");
  const Dres = parseAnglePointMode(am.D ?? am.default, angleAt(D,C,A), at.D, "D");

  renderAngle(g, A, D, B, angleRadius(A,D,B), { mark:Ares.mark, angleText:Ares.angleText, pointLabel:Ares.pointLabel });
  renderAngle(g, B, A, C, angleRadius(B,A,C), { mark:Bres.mark, angleText:Bres.angleText, pointLabel:Bres.pointLabel });
  renderAngle(g, C, B, D, angleRadius(C,B,D), { mark:Cres.mark, angleText:Cres.angleText, pointLabel:Cres.pointLabel });
  renderAngle(g, D, C, A, angleRadius(D,C,A), { mark:Dres.mark, angleText:Dres.angleText, pointLabel:Dres.pointLabel });

  add(g,"polygon",{points:ptsTo(poly), fill:"none", stroke:STYLE.edgeStroke, "stroke-width": STYLE.edgeWidth, "stroke-linejoin":"round","stroke-linecap":"round"});
}

/* ---------- ORKESTRERING ---------- */
const BASE_W = 600, BASE_H = 420, GAP = 60;

function collectJobsFromSpecs(text){
  const lines = String(text).split(/\n/).map(s=>s.trim()).filter(Boolean);
  const jobs = [];
  for(const line of lines){
    const obj = parseSpec(line);
    if(Object.keys(obj).length===0) continue;
    const isQuad = ("d" in obj) && (("A" in obj)||("B" in obj)||("C" in obj)||("D" in obj));
    jobs.push({type: isQuad ? "quad" : "tri", spec: line});
    if(jobs.length>=2) break;
  }
  return jobs;
}

function svgToString(svgEl){
  const clone = svgEl.cloneNode(true);
  clone.setAttribute("xmlns","http://www.w3.org/2000/svg");
  clone.setAttribute("xmlns:xlink","http://www.w3.org/1999/xlink");
  return '<?xml version="1.0" encoding="UTF-8"?>\n' + new XMLSerializer().serializeToString(clone);
}
function downloadSVG(svgEl, filename){
  const data = svgToString(svgEl);
  const blob = new Blob([data], {type:"image/svg+xml;charset=utf-8"});
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = filename.endsWith(".svg")? filename : filename + ".svg";
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(()=>URL.revokeObjectURL(url), 1000);
}

/* ---------- PNG-EKSPORT ---------- */
function downloadPNG(svgEl, filename, scale = 2, bg = "#fff"){
  // hent dimensjoner fra viewBox
  const vb = svgEl.viewBox.baseVal;
  const w = vb?.width  || svgEl.clientWidth  || 1200;
  const h = vb?.height || svgEl.clientHeight || 800;

  // gjør SVG om til data-URL
  const svgData = svgToString(svgEl);
  const blob = new Blob([svgData], { type: "image/svg+xml;charset=utf-8" });
  const url  = URL.createObjectURL(blob);

  const img = new Image();
  img.onload = () => {
    const canvas = document.createElement("canvas");
    canvas.width  = Math.round(w * scale);
    canvas.height = Math.round(h * scale);
    const ctx = canvas.getContext("2d");
    // hvit bakgrunn
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    // tegn svg inn
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    URL.revokeObjectURL(url);

    canvas.toBlob((pngBlob)=>{
      const urlPng = URL.createObjectURL(pngBlob);
      const a = document.createElement("a");
      a.href = urlPng;
      a.download = filename.endsWith(".png") ? filename : filename + ".png";
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(()=>URL.revokeObjectURL(urlPng), 1000);
    }, "image/png");
  };
  img.src = url;
}

/* bygg adv fra STATE (sider + vinkler/punkter) */
function buildAdvForFig(figState){
  const sidesMode = { default: figState.sides.default };
  ["a","b","c","d"].forEach(k=>{
    const mode = figState.sides[k];
    if(mode && mode !== "inherit") sidesMode[k] = mode;
  });
  const sidesText = {
    a: figState.sides.aText, b: figState.sides.bText, c: figState.sides.cText, d: figState.sides.dText
  };

  const angMode = { default: figState.angles.default };
  ["A","B","C","D"].forEach(k=>{
    const mode = figState.angles[k];
    if(mode && mode !== "inherit") angMode[k] = mode;
  });
  const angText = {
    A: figState.angles.AText, B: figState.angles.BText, C: figState.angles.CText, D: figState.angles.DText
  };

  return { sides: {mode: sidesMode, text: sidesText}, angles: {mode: angMode, text: angText} };
}

function renderCombined(){
  const svg = document.getElementById("paper");
  svg.innerHTML = "";

  const jobs = collectJobsFromSpecs(STATE.specsText);
  const n = jobs.length;

  if(n===0){
    svg.setAttribute("viewBox", `0 0 ${BASE_W} ${BASE_H}`);
    add(svg,"text",{x:20,y:40,fill:"#6b7280","font-size":18}).textContent = "Skriv 1–2 SPECS-linjer for å tegne figur(er).";
    svg.setAttribute("aria-label","");
    return;
  }

  let totalW = BASE_W, totalH = BASE_H;
  if(n===1){
    totalW = BASE_W; totalH = BASE_H;
  } else if(STATE.layout === "row"){
    totalW = BASE_W*2 + GAP; totalH = BASE_H;
  } else {
    totalW = BASE_W; totalH = BASE_H*2 + GAP;
  }
  svg.setAttribute("viewBox", `0 0 ${totalW} ${totalH}`);

  const groups = [];
  for(let i=0;i<n;i++) groups.push(add(svg,"g",{}));

  const rects = [];
  if(n===1){
    rects.push({x:0, y:0, w:BASE_W, h:BASE_H});
  } else if(STATE.layout === "row"){
    rects.push({x:0, y:0, w:BASE_W, h:BASE_H});
    rects.push({x:BASE_W+GAP, y:0, w:BASE_W, h:BASE_H});
  } else {
    rects.push({x:0, y:0, w:BASE_W, h:BASE_H});
    rects.push({x:0, y:BASE_H+GAP, w:BASE_W, h:BASE_H});
  }

  for(let i=0;i<n;i++){
    const {type, spec} = jobs[i];
    const adv = buildAdvForFig(i===0 ? STATE.fig1 : STATE.fig2);
    try{
      if(type==="tri") drawTriangleToGroup(groups[i], rects[i], spec, adv);
      else            drawQuadToGroup(groups[i], rects[i], spec, adv);
    }catch(e){
      errorBox(groups[i], rects[i], String(e.message||e));
    }
  }

  svg.setAttribute("aria-label", n===1 ? "Én figur" : "To figurer i samme bilde");
}

/* ---------- UI BIND ---------- */
function bindUI(){
  const $ = sel => document.querySelector(sel);
  const inpSpecs = $("#inpSpecs");
  const layoutRadios = document.querySelectorAll('input[name="layout"]');
  const btnSvg = $("#btnSvg");
  const btnPng = $("#btnPng");
  const btnReset = $("#btnReset");
  const inpAdv = $("#advConfig");

  const f1Sides=$("#f1Sides"), f1Angles=$("#f1Angles");
  const f2Sides=$("#f2Sides"), f2Angles=$("#f2Angles");

  function wireSide(figKey, key, selId, txtId, placeholder){
    const sel = $(selId), txt = $(txtId);
    const fig = STATE[figKey];
    sel.value = fig.sides[key] ?? "inherit";
    txt.value = fig.sides[key+"Text"] ?? placeholder;
    function toggleTxt(){ txt.disabled = !sel.value.includes("custom"); }
    toggleTxt();
    sel.addEventListener("change", ()=>{ fig.sides[key] = sel.value; toggleTxt(); renderCombined(); });
    txt.addEventListener("input", ()=>{ fig.sides[key+"Text"] = txt.value; renderCombined(); });
  }
  function wireAng(figKey, key, selId, txtId, placeholder){
    const sel = $(selId), txt = $(txtId);
    const fig = STATE[figKey];
    sel.value = fig.angles[key] ?? "inherit";
    txt.value = fig.angles[key+"Text"] ?? placeholder;
    function toggleTxt(){
      const v = sel.value; // aksepter både custom* og custum*
      txt.disabled = !(v.startsWith("custom") || v.startsWith("custum"));
    }
    toggleTxt();
    sel.addEventListener("change", ()=>{ fig.angles[key] = sel.value; toggleTxt(); renderCombined(); });
    txt.addEventListener("input", ()=>{ fig.angles[key+"Text"] = txt.value; renderCombined(); });
  }

  // init
  DEFAULT_SPECS = inpSpecs?.value || "";
  STATE.specsText = DEFAULT_SPECS;
  if(inpAdv){
    try{ deepAssign(ADV_CONFIG, JSON.parse(inpAdv.value)); }catch(_){ }
    inpAdv.addEventListener("input", ()=>{ try{ deepAssign(ADV_CONFIG, JSON.parse(inpAdv.value)); renderCombined(); }catch(_){ }});
  }

  inpSpecs.value = STATE.specsText;
  f1Sides.value  = STATE.fig1.sides.default;
  f1Angles.value = STATE.fig1.angles.default;
  f2Sides.value  = STATE.fig2.sides.default;
  f2Angles.value = STATE.fig2.angles.default;
  layoutRadios.forEach(r => r.checked = (r.value===STATE.layout));

  inpSpecs.addEventListener("input", ()=>{ STATE.specsText = inpSpecs.value; renderCombined(); });
  f1Sides.addEventListener("change",  ()=>{ STATE.fig1.sides.default  = f1Sides.value;  renderCombined(); });
  f1Angles.addEventListener("change", ()=>{ STATE.fig1.angles.default = f1Angles.value; renderCombined(); });
  f2Sides.addEventListener("change",  ()=>{ STATE.fig2.sides.default  = f2Sides.value;  renderCombined(); });
  f2Angles.addEventListener("change", ()=>{ STATE.fig2.angles.default = f2Angles.value; renderCombined(); });

  // figur 1
  wireSide("fig1","a","#f1SideA","#f1SideATxt","a");
  wireSide("fig1","b","#f1SideB","#f1SideBTxt","b");
  wireSide("fig1","c","#f1SideC","#f1SideCTxt","c");
  wireSide("fig1","d","#f1SideD","#f1SideDTxt","d");
  wireAng ("fig1","A","#f1AngA","#f1AngATxt","A");
  wireAng ("fig1","B","#f1AngB","#f1AngBTxt","B");
  wireAng ("fig1","C","#f1AngC","#f1AngCTxt","C");
  wireAng ("fig1","D","#f1AngD","#f1AngDTxt","D");

  // figur 2
  wireSide("fig2","a","#f2SideA","#f2SideATxt","a");
  wireSide("fig2","b","#f2SideB","#f2SideBTxt","b");
  wireSide("fig2","c","#f2SideC","#f2SideCTxt","c");
  wireSide("fig2","d","#f2SideD","#f2SideDTxt","d");
  wireAng ("fig2","A","#f2AngA","#f2AngATxt","A");
  wireAng ("fig2","B","#f2AngB","#f2AngBTxt","B");
  wireAng ("fig2","C","#f2AngC","#f2AngCTxt","C");
  wireAng ("fig2","D","#f2AngD","#f2AngDTxt","D");

  layoutRadios.forEach(r => r.addEventListener("change", ()=>{
    if(r.checked){ STATE.layout = r.value; renderCombined(); }
  }));

  if(btnSvg){
    btnSvg.addEventListener("click", ()=>{
      const svg = document.getElementById("paper");
      downloadSVG(svg, "nkant.svg");
    });
  }
  if(btnPng){
    btnPng.addEventListener("click", ()=>{
      const svg = document.getElementById("paper");
      downloadPNG(svg, "nkant.png", 2); // 2× oppløsning
    });
  }

  btnReset?.addEventListener("click", ()=>{
    Object.assign(STATE, {
      specsText: DEFAULT_SPECS,
      fig1: {
        sides:{ default:"value", a:"inherit", b:"inherit", c:"inherit", d:"inherit",
                aText:"a", bText:"b", cText:"c", dText:"d" },
        angles:{ default:"custom+mark+value", A:"inherit", B:"inherit", C:"inherit", D:"inherit",
                 AText:"A", BText:"B", CText:"C", DText:"D" }
      },
      fig2: {
        sides:{ default:"none", a:"inherit", b:"inherit", c:"inherit", d:"inherit",
                aText:"a", bText:"b", cText:"c", dText:"d" },
        angles:{ default:"custom+mark+value", A:"inherit", B:"inherit", C:"inherit", D:"inherit",
                 AText:"A", BText:"B", CText:"C", DText:"D" }
      },
      layout: "row"
    });

    inpSpecs.value = STATE.specsText;
    f1Sides.value  = STATE.fig1.sides.default;
    f1Angles.value = STATE.fig1.angles.default;
    f2Sides.value  = STATE.fig2.sides.default;
    f2Angles.value = STATE.fig2.angles.default;
    document.querySelectorAll('input[name="layout"]').forEach(r=> r.checked = (r.value===STATE.layout));

    ["A","B","C","D"].forEach(K=>{
      const f = (p)=>{ document.querySelector(p+K).value="inherit"; document.querySelector(p+K+"Txt").value=K; };
      f("#f1Ang"); f("#f2Ang");
    });
    ["a","b","c","d"].forEach(k=>{
      const u = k.toUpperCase();
      document.querySelector("#f1Side"+u).value="inherit"; document.querySelector("#f1Side"+u+"Txt").value=k;
      document.querySelector("#f2Side"+u).value="inherit"; document.querySelector("#f2Side"+u+"Txt").value=k;
    });

    renderCombined();
  });
}

/* ---------- INIT ---------- */
window.addEventListener("DOMContentLoaded", () => {
  bindUI();
  renderCombined();
});

/* ---------- GEOMETRI ---------- */
function solveTriangle(g){
  let {a,b,c,A,B,C} = g;

  const lawCosSide = (ang, s1, s2) => Math.sqrt(Math.max(0, s1*s1 + s2*s2 - 2*s1*s2*Math.cos(rad(ang))));
  const lawCosAng  = (opp, s1, s2) => deg(Math.acos(clampCos((s1*s1 + s2*s2 - opp*opp)/(2*s1*s2))));
  const lawSinAng  = (A0,a0,sx)=> deg(Math.asin(clamp(sx*Math.sin(rad(A0))/a0,-1,1)));
  const lawSinSide = (A0,a0,Ax)=> a0*Math.sin(rad(Ax))/Math.sin(rad(A0));

  if(A && B && !C) C = 180 - A - B;
  if(A && C && !B) B = 180 - A - C;
  if(B && C && !A) A = 180 - B - C;

  if(A && b && c && !a){ a = lawCosSide(A,b,c); }
  if(B && a && c && !b){ b = lawCosSide(B,a,c); }
  if(C && a && b && !c){ c = lawCosSide(C,a,b); }

  if(a && b && c){
    if(!A) A = lawCosAng(a,b,c);
    if(!B) B = lawCosAng(b,a,c);
    if(!C) C = 180 - A - B;
  }

  const fillBySines = ()=>{
    if(A && B && a && (!b || !c)){ b = b || lawSinSide(A,a,B); c = c || lawSinSide(A,a,180-A-B); }
    if(A && C && a && (!b || !c)){ b = b || lawSinSide(A,a,180-A-C); c = c || lawSinSide(A,a,C); }
    if(B && C && b && (!a || !c)){ a = a || lawSinSide(B,b,180-B-C); c = c || lawSinSide(B,b,C); }
    if(A && B && c && (!a || !b)){ a = a || lawSinSide(180-A-B,c,A); b = b || lawSinSide(180-A-B,c,B); }
  };
  fillBySines();

  const solveSSA = ()=>{
    if(A && a && b && !B){ const B1 = lawSinAng(A,a,b); if(isFinite(B1)){ B=B||B1; C=C|| (180-A-B); c=c|| lawSinSide(A,a,C); } }
    if(A && a && c && !C){ const C1 = lawSinAng(A,a,c); if(isFinite(C1)){ C=C||C1; B=B|| (180-A-C); b=b|| lawSinSide(A,a,B); } }
    if(B && b && a && !A){ const A1 = lawSinAng(B,b,a); if(isFinite(A1)){ A=A||A1; C=C|| (180-A-B); c=c|| lawSinSide(B,b,C); } }
    if(B && b && c && !C){ const C1 = lawSinAng(B,b,c); if(isFinite(C1)){ C=C||C1; A=A|| (180-B-C); a=a|| lawSinSide(B,b,A); } }
    if(C && c && a && !A){ const A1 = lawSinAng(C,c,a); if(isFinite(A1)){ A=A||A1; B=B|| (180-A-C); b=b|| lawSinSide(C,c,B); } }
    if(C && c && b && !B){ const B1 = lawSinAng(C,c,b); if(isFinite(B1)){ B=B||B1; A=A|| (180-B-C); a=a|| lawSinSide(C,c,A); } }
  };
  solveSSA();

  if(!(a>0 && b>0 && c>0 && A>0 && B>0 && C>0))
    throw new Error("Trekant-spesifikasjonen er ikke tilstrekkelig eller er ugyldig.");

  return {a,b,c,A,B,C};
}

function circleCircle(A, r, B, s){
  const dx=B.x-A.x, dy=B.y-A.y, d=Math.hypot(dx,dy);
  if(d===0 || d>r+s || d<Math.abs(r-s)) return [];
  const a=(r*r - s*s + d*d)/(2*d);
  const h=Math.sqrt(Math.max(0, r*r - a*a));
  const xm=A.x + a*dx/d, ym=A.y + a*dy/d;
  const rx=-dy*(h/d),   ry= dx*(h/d);
  return [{x:xm+rx,y:ym+ry},{x:xm-rx,y:ym-ry}];
}
