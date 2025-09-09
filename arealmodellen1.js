/* =========================================================
   KONFIG – SIMPLE (viktigst) + ADV (alt annet)
   ========================================================= */
const CFG = {
  SIMPLE: {
    height: { cells: 16, handle: 5, show: true }, // rader, horisontal deling (fra bunn)
    length: { cells: 17, handle: 3, show: true }, // kolonner, vertikal deling (fra venstre)
  },
  ADV: {
    svgId: "area",
    unit: 40,
    margins: { l: 80, r: 40, t: 40, b: 120 },

    grid: false,
    splitLines: true,
    clickToMove: true,
    drag: { vertical: true, horizontal: true },
    limits: { minColsEachSide: 1, minRowsEachSide: 1 },

    // Håndtak (piler)
    handleIcons: {
      vert:  "https://test.kikora.no/img/drive/figures/UIclientObjects/arrows/moveV.svg",
      horiz: "https://test.kikora.no/img/drive/figures/UIclientObjects/arrows/moveH.svg",
      size: 84
    },

    classes: {
      outer: "outer",
      grid: "grid",
      split: "split",
      handle: "handleImg",
      labelCell: "labelCell",
      labelEdge: "labelEdge",
      cells: ["c1","c2","c3","c4"]
    },

    colors: ["#e07c7c", "#f0c667", "#7fb2d6", "#8bb889"],

    fit: {
      maxVh: 100,
      maxVw: 100,
      safePad: { top: 8, right: 8, bottom: 64, left: 8 } // ekstra plass i vinduet
    },

    labels: {
      cellMode: "factors",   // "factors" | "area" | "both" | "none"
      edgeMode: "counts",    // "counts" | "none"
      edgeInside: false,     // utenfor rektangelet
      dot: " · ",
      equals: " = "
    },

    check: { ten: 10 },

    export: {
      filename: "arealmodell_interaktiv.svg",
      includeGrid: false,
      includeHandlesIfHidden: true,
      // valgfri – brukes hvis satt:
      // filenameHtml: "arealmodell_interaktiv.html"
    }
  }
};
/* ========================================================= */

function readConfigFromHtml(){
  const height = parseInt(document.getElementById("height")?.value,10);
  if(Number.isFinite(height)) CFG.SIMPLE.height.cells = height;
  const length = parseInt(document.getElementById("length")?.value,10);
  if(Number.isFinite(length)) CFG.SIMPLE.length.cells = length;
  const hHandle = parseInt(document.getElementById("heightHandle")?.value,10);
  if(Number.isFinite(hHandle)) CFG.SIMPLE.height.handle = hHandle;
  const lHandle = parseInt(document.getElementById("lengthHandle")?.value,10);
  if(Number.isFinite(lHandle)) CFG.SIMPLE.length.handle = lHandle;
  CFG.ADV.grid = document.getElementById("grid")?.checked ?? CFG.ADV.grid;
  CFG.ADV.splitLines = document.getElementById("splitLines")?.checked ?? CFG.ADV.splitLines;
}

function render(){
  const ADV = CFG.ADV, SV = CFG.SIMPLE;

  const UNIT = +ADV.unit || 40;
  const ROWS = Math.max(2, Math.round(SV.height?.cells ?? 16));
  const COLS = Math.max(2, Math.round(SV.length?.cells ?? 17));
  const TEN  = Math.max(1, Math.round(ADV.check?.ten ?? 10));

  // spacing for kant-tekst utenfor
  const EDGE_GAP = { x: 14, y: 32 };

  // pilstørrelse + auto-margin
  const HANDLE_SIZE = Math.max(12, ADV.handleIcons?.size ?? 84);
  const MLconf = ADV.margins?.l ?? 80;
  const MR = ADV.margins?.r ?? 40;
  const MT = ADV.margins?.t ?? 40;
  const MBconf = ADV.margins?.b ?? 120;

  const ML = Math.max(MLconf, HANDLE_SIZE / 2 + 18);
  const MB = Math.max(MBconf, HANDLE_SIZE / 2 + EDGE_GAP.y + 18);

  const W = COLS * UNIT, H = ROWS * UNIT;
  const VBW = ML + W + MR, VBH = MT + H + MB;

  const classes = {
    outer: ADV.classes?.outer ?? "outer",
    grid: ADV.classes?.grid ?? "grid",
    split: ADV.classes?.split ?? "split",
    handle: ADV.classes?.handle ?? "handleImg",
    labelCell: ADV.classes?.labelCell ?? "labelCell",
    labelEdge: ADV.classes?.labelEdge ?? "labelEdge",
    cells: ADV.classes?.cells ?? ["c1","c2","c3","c4"]
  };

  const showGrid       = ADV.grid !== false;
  const clickToMove    = ADV.clickToMove !== false;
  const showHeightAxis = SV.height?.show !== false;
  const showLengthAxis = SV.length?.show !== false;

  const dragVertical   = showHeightAxis && (ADV.drag?.vertical   !== false);
  const dragHorizontal = showLengthAxis && (ADV.drag?.horizontal !== false);

  const splitLinesOn = ADV.splitLines !== false;
  const showHLine = splitLinesOn && showHeightAxis;
  const showVLine = splitLinesOn && showLengthAxis;

  const minColsEachSide = Math.max(1, ADV.limits?.minColsEachSide ?? 1);
  const minRowsEachSide = Math.max(1, ADV.limits?.minRowsEachSide ?? 1);

  const initLeftCols   = (SV.length?.handle ?? Math.floor(COLS/2));
  const initBottomRows = (SV.height?.handle ?? Math.floor(ROWS/2));

  const showLeftHandle   = showHeightAxis && (SV.height?.handle !== null);
  const showBottomHandle = showLengthAxis && (SV.length?.handle !== null);

  // helpers
  const NS  = "http://www.w3.org/2000/svg";
  const el  = n => document.createElementNS(NS, n);
  const set = (node, n, v) => { node.setAttribute(n, v); return node; };
  const clamp = (v,a,b)=>Math.max(a,Math.min(b,v));
  const clampInt = (v,a,b)=>Math.max(a,Math.min(b,Math.round(v)));
  const snap  = v => Math.round(v/UNIT)*UNIT;

  const minX = ML + minColsEachSide*UNIT;
  const maxX = ML + W  - minColsEachSide*UNIT;
  const minY = MT + minRowsEachSide*UNIT;
  const maxY = MT + H  - minRowsEachSide*UNIT;

  const H_ICON_URL  = ADV.handleIcons?.horiz ?? "";
  const V_ICON_URL  = ADV.handleIcons?.vert  ?? "";

  // state
  let sx = clampInt(initLeftCols,   1, COLS-1) * UNIT;
  let sy = clampInt(initBottomRows, 1, ROWS-1) * UNIT;

  injectRuntimeStyles();

  // DOM
  const svg = document.getElementById(ADV.svgId);
  svg.innerHTML = "";
  set(svg, "viewBox", `0 0 ${VBW} ${VBH}`);
  set(svg, "preserveAspectRatio", "xMidYMid meet");
  Object.assign(svg.style, {
    width: "100vw",
    height: "auto",
    maxHeight: (ADV.fit?.maxVh ?? 100) + "vh",
    maxWidth:  (ADV.fit?.maxVw ?? 100) + "vw",
    display: "block",
    touchAction: "none"
  });

  const rectOuter = el("rect");
  set(rectOuter,"x",ML); set(rectOuter,"y",MT);
  set(rectOuter,"width",W); set(rectOuter,"height",H);
  set(rectOuter,"class",classes.outer);
  svg.appendChild(rectOuter);

  const defs = el("defs"); svg.appendChild(defs);
  const clip = el("clipPath"); set(clip,"id","clipR");
  const clipRect = el("rect");
  set(clipRect,"x",ML); set(clipRect,"y",MT); set(clipRect,"width",W); set(clipRect,"height",H);
  clip.appendChild(clipRect); defs.appendChild(clip);

  const gridGroup = el("g"); set(gridGroup,"class",classes.grid); set(gridGroup,"clip-path","url(#clipR)");
  if (showGrid) {
    for (let x = ML + UNIT; x < ML + W; x += UNIT) {
      const ln = el("line"); set(ln,"x1",x); set(ln,"y1",MT); set(ln,"x2",x); set(ln,"y2",MT+H); gridGroup.appendChild(ln);
    }
    for (let y = MT + UNIT; y < MT + H; y += UNIT) {
      const ln = el("line"); set(ln,"x1",ML); set(ln,"y1",y); set(ln,"x2",ML+W); set(ln,"y2",y); gridGroup.appendChild(ln);
    }
  }
  svg.appendChild(gridGroup);

  const rTL = el("rect"), rTR = el("rect"), rBL = el("rect"), rBR = el("rect");
  set(rTL,"class",classes.cells[0]); set(rTR,"class",classes.cells[1]);
  set(rBL,"class",classes.cells[2]); set(rBR,"class",classes.cells[3]);
  svg.append(rTL,rTR,rBL,rBR);

  // delingslinjer
  let vLine=null,hLine=null;
  if (showVLine) { vLine = el("line"); set(vLine,"class",classes.split); svg.append(vLine); }
  if (showHLine) { hLine = el("line"); set(hLine,"class",classes.split); svg.append(hLine); }

  // håndtak + hit-soner
  let handleLeft = null, handleDown = null, hitLeft = null, hitDown = null;
  if (showLeftHandle) {
    handleLeft = el("image");
    set(handleLeft, "class", classes.handle);
    set(handleLeft, "width", HANDLE_SIZE);
    set(handleLeft, "height", HANDLE_SIZE);
    set(handleLeft, "href", V_ICON_URL);
    svg.append(handleLeft);

    hitLeft = el("circle");
    set(hitLeft, "class", "handleHit");
    set(hitLeft, "r", (HANDLE_SIZE*0.55));
    svg.append(hitLeft);
  }
  if (showBottomHandle) {
    handleDown = el("image");
    set(handleDown, "class", classes.handle);
    set(handleDown, "width", HANDLE_SIZE);
    set(handleDown, "height", HANDLE_SIZE);
    set(handleDown, "href", H_ICON_URL);
    svg.append(handleDown);

    hitDown = el("circle");
    set(hitDown, "class", "handleHit");
    set(hitDown, "r", (HANDLE_SIZE*0.55));
    svg.append(hitDown);
  }

  // tekster
  const tTL = el("text"), tTR = el("text"), tBL = el("text"), tBR = el("text");
  [tTL,tTR,tBL,tBR].forEach(t=>{ set(t,"class",classes.labelCell); set(t,"text-anchor","middle"); });

  const leftTop  = el("text"), leftBot  = el("text"), botLeft = el("text"), botRight = el("text");
  set(leftTop ,'class',classes.labelEdge);  set(leftTop ,'text-anchor', "end");
  set(leftBot ,'class',classes.labelEdge);  set(leftBot ,'text-anchor', "end");
  set(botLeft ,'class',classes.labelEdge);  set(botLeft ,'text-anchor',"middle");
  set(botRight,'class',classes.labelEdge);  set(botRight,'text-anchor',"middle");
  svg.append(tTL,tTR,tBL,tBR,leftTop,leftBot,botLeft,botRight);

  const dot    = ADV.labels?.dot ?? " · ";
  const equals = ADV.labels?.equals ?? " = ";
  const edgeOn = (ADV.labels?.edgeMode ?? "counts") === "counts";
  const cellMode = ADV.labels?.cellMode ?? "factors";
  function formatCellLabel(w,h){
    if (cellMode === "none")   return "";
    if (cellMode === "factors")return `${w}${dot}${h}`;
    if (cellMode === "area")   return `${w*h}`;
    return `${w}${dot}${h}${equals}${w*h}`;
  }

  // ------- Rask mapping: klient → viewBox -------
  let svgRect = svg.getBoundingClientRect();
  function clientToSvg(e){
    const vb = svg.viewBox.baseVal;
    const sx = vb.width  / svgRect.width;
    const sy = vb.height / svgRect.height;
    return {
      x: vb.x + (e.clientX - svgRect.left) * sx,
      y: vb.y + (e.clientY - svgRect.top ) * sy
    };
  }
  function refreshSvgRect(){ svgRect = svg.getBoundingClientRect(); }

  // ------- rAF-basert redraw -------
  let rafId = 0;
  function scheduleRedraw(){
    if (rafId) return;
    rafId = requestAnimationFrame(() => { rafId = 0; redraw(); });
  }

  function redraw(){
    const wL = Math.round(sx/UNIT), wR = COLS - wL;
    const hB = Math.round(sy/UNIT), hT = ROWS - hB;

    set(rTL,"x",ML); set(rTL,"y",MT); set(rTL,"width",sx); set(rTL,"height",H-sy);
    set(rTR,"x",ML+sx); set(rTR,"y",MT); set(rTR,"width",W-sx); set(rTR,"height",H-sy);
    set(rBL,"x",ML); set(rBL,"y",MT+(H-sy)); set(rBL,"width",sx); set(rBL,"height",sy);
    set(rBR,"x",ML+sx); set(rBR,"y",MT+(H-sy)); set(rBR,"width",W-sx); set(rBR,"height",sy);

    if (vLine) { set(vLine,"x1",ML+sx); set(vLine,"y1",MT); set(vLine,"x2",ML+sx); set(vLine,"y2",MT+H); }
    if (hLine) { set(hLine,"x1",ML); set(hLine,"y1",MT+(H-sy)); set(hLine,"x2",ML+W); set(hLine,"y2",MT+(H-sy)); }

    const hLeftCX = ML,      hLeftCY = MT + (H - sy);
    const hDownCX = ML + sx, hDownCY = MT + H;

    if (handleLeft) { set(handleLeft, "x", hLeftCX - HANDLE_SIZE/2); set(handleLeft, "y", hLeftCY - HANDLE_SIZE/2); }
    if (handleDown) { set(handleDown, "x", hDownCX - HANDLE_SIZE/2); set(handleDown, "y", hDownCY - HANDLE_SIZE/2); }
    if (hitLeft)    { set(hitLeft,    "cx", hLeftCX); set(hitLeft,    "cy", hLeftCY); }
    if (hitDown)    { set(hitDown,    "cx", hDownCX); set(hitDown,    "cy", hDownCY); }

    // cell-etiketter
    set(tTL,"x",ML + sx/2);               set(tTL,"y",MT + (H - sy)/2 + 8);      tTL.textContent = formatCellLabel(wL, hT);
    set(tTR,"x",ML + sx + (W - sx)/2);    set(tTR,"y",MT + (H - sy)/2 + 8);      tTR.textContent = formatCellLabel(wR, hT);
    set(tBL,"x",ML + sx/2);               set(tBL,"y",MT + (H - sy) + sy/2 + 8); tBL.textContent = formatCellLabel(wL, hB);
    set(tBR,"x",ML + sx + (W - sx)/2);    set(tBR,"y",MT + (H - sy) + sy/2 + 8); tBR.textContent = formatCellLabel(wR, hB);

    // kant-etiketter (utenfor, med luft)
    const leftXOutside   = ML - (HANDLE_SIZE/2) - EDGE_GAP.x;
    const bottomYOutside = MT + H + (HANDLE_SIZE/2) + EDGE_GAP.y;

    if (edgeOn && showHeightAxis) {
      set(leftTop,"x",leftXOutside); set(leftTop,"y",MT + (H - sy)/2 + 10);  leftTop.textContent  = `${hT}`;
      set(leftBot,"x",leftXOutside); set(leftBot,"y",MT + (H - sy) + sy/2 + 10); leftBot.textContent = `${hB}`;
    } else { leftTop.textContent = leftBot.textContent = ""; }

    if (edgeOn && showLengthAxis) {
      set(botLeft,"x",ML + sx/2);            set(botLeft,"y",bottomYOutside);
      set(botRight,"x",ML + sx + (W - sx)/2); set(botRight,"y",bottomYOutside);
      botLeft.textContent  = `${wL}`; botRight.textContent = `${wR}`;
    } else { botLeft.textContent = botRight.textContent = ""; }

    // “Riktig” – doble linjer når begge sider har en tier
    const okX = (wL === TEN || wR === TEN);
    const okY = (hB === TEN || hT === TEN);
    const on  = okX && okY;
    if (vLine) vLine.setAttribute("class", classes.split + (on ? " ok" : ""));
    if (hLine) hLine.setAttribute("class", classes.split + (on ? " ok" : ""));

    // hold håndtak/hit-soner øverst
    if (handleLeft)  svg.append(handleLeft);
    if (hitLeft)     svg.append(hitLeft);
    if (handleDown)  svg.append(handleDown);
    if (hitDown)     svg.append(hitDown);
  }

  // ---- Responsiv skalering ----
  function fitToViewport(){
    const SAFE = ADV.fit?.safePad || {top:8,right:8,bottom:64,left:8};
    const availW = Math.max(100, window.innerWidth  - (SAFE.left + SAFE.right));
    const availH = Math.max(100, window.innerHeight - (SAFE.top  + SAFE.bottom));
    const s = Math.min(availW / VBW, availH / VBH);
    svg.setAttribute("width",  VBW * s);
    svg.setAttribute("height", VBH * s);
    refreshSvgRect();
  }

  redraw();
  fitToViewport();
  window.addEventListener("resize", fitToViewport, { passive: true });

  // ======== DRAGGING – pointer capture + touch-lock + rAF ========
  let active = { axis: null, pointerId: null, captor: null };
  let justDragged = false;
  const armJustDragged = ()=>{ justDragged = true; setTimeout(()=>{ justDragged = false; }, 220); };

  function lockTouch(){
    document.documentElement.style.touchAction = "none";
    document.body.style.touchAction = "none";
    document.documentElement.style.overscrollBehavior = "contain";
    document.body.style.overscrollBehavior = "contain";
  }
  function unlockTouch(){
    document.documentElement.style.touchAction = "";
    document.body.style.touchAction = "";
    document.documentElement.style.overscrollBehavior = "";
    document.body.style.overscrollBehavior = "";
  }

  function onMove(e){
    if (e.pointerId !== active.pointerId) return;
    e.preventDefault();
    const p = clientToSvg(e);
    if (active.axis === "v") {
      const y = clamp(p.y, minY, maxY);
      const newSy = MT + H - y;
      if (newSy !== sy) { sy = newSy; scheduleRedraw(); }
    } else if (active.axis === "h") {
      const x = clamp(p.x, minX, maxX);
      const newSx = x - ML;
      if (newSx !== sx) { sx = newSx; scheduleRedraw(); }
    }
  }
  function onUp(e){
    if (e.pointerId !== active.pointerId) return;
    e.preventDefault();
    if (active.axis === "v") sy = snap(sy);
    if (active.axis === "h") sx = snap(sx);
    if (active.captor && active.captor.releasePointerCapture) { try { active.captor.releasePointerCapture(e.pointerId); } catch(_){} }
    if (active.captor) active.captor.classList.remove("dragging");
    active.axis = null; active.pointerId = null; active.captor = null;
    window.removeEventListener("pointermove", onMove);
    window.removeEventListener("pointerup", onUp);
    window.removeEventListener("pointercancel", onUp);
    unlockTouch();
    armJustDragged();
    scheduleRedraw();
  }

  function startDrag(axis, e){
    active.axis = axis;
    active.pointerId = e.pointerId;
    active.captor = e.currentTarget || e.target;
    if (active.captor && active.captor.setPointerCapture) { try { active.captor.setPointerCapture(e.pointerId); } catch(_){} }
    if (active.captor) active.captor.classList.add("dragging");
    lockTouch();
    window.addEventListener("pointermove", onMove, { passive: false });
    window.addEventListener("pointerup", onUp, { passive: false });
    window.addEventListener("pointercancel", onUp, { passive: false });
  }

  if (dragVertical && hitLeft) {
    hitLeft.style.touchAction = "none";
    hitLeft.addEventListener("pointerdown", e => { e.preventDefault(); startDrag("v", e); }, { passive: false });
  }
  if (dragHorizontal && hitDown) {
    hitDown.style.touchAction = "none";
    hitDown.addEventListener("pointerdown", e => { e.preventDefault(); startDrag("h", e); }, { passive: false });
  }

  if (clickToMove) {
    svg.addEventListener("click", e => {
      if (justDragged) return;
      const p = clientToSvg(e);
      if (dragVertical   && showHeightAxis && Math.abs(p.x - ML) < 12 && p.y >= MT && p.y <= MT+H) { sy = snap(MT + H - clamp(p.y, minY, maxY)); scheduleRedraw(); }
      if (dragHorizontal && showLengthAxis && Math.abs(p.y - (MT + H)) < 12 && p.x >= ML && p.x <= ML+W) { sx = snap(clamp(p.x, minX, maxX) - ML); scheduleRedraw(); }
    });
  }

  // Reset
  const btnReset = document.getElementById("btnReset");
  if(btnReset) btnReset.onclick = () => {
    sx = clampInt(initLeftCols,   1, COLS-1) * UNIT;
    sy = clampInt(initBottomRows, 1, ROWS-1) * UNIT;
    scheduleRedraw();
  };

  // ===== Eksporter interaktiv SVG =====
  const btnSvg = document.getElementById("btnSvg");
  if(btnSvg) btnSvg.onclick = () => {
    const includeHandles = (showLeftHandle || showBottomHandle) || ADV.export?.includeHandlesIfHidden;

    const svgStr = buildInteractiveSvgString({
      unit: UNIT, rows: ROWS, cols: COLS,
      margins: { ML, MR, MT, MB },
      width: W, height: H, vbw: VBW, vbh: VBH,
      sx, sy, TEN,
      limits: { minColsEachSide, minRowsEachSide },
      classes,
      includeGrid: !!ADV.export?.includeGrid,
      showHeightAxis, showLengthAxis,
      includeHandles,
      colorsCSS: getInlineStyleDefaults(),
      handleSize: HANDLE_SIZE,
      icons: { horizUrl: ADV.handleIcons.horiz, vertUrl: ADV.handleIcons.vert },
      edgeGap: EDGE_GAP,
      safePad: ADV.fit?.safePad || {top:8,right:8,bottom:64,left:8}
    });
    downloadText(ADV.export?.filename || "arealmodell_interaktiv.svg", svgStr, "image/svg+xml");
  };

  // ===== Eksporter interaktiv HTML =====
  const btnHtml = document.getElementById("btnHtml");
  if(btnHtml) btnHtml.onclick = () => {
    const includeHandles = (showLeftHandle || showBottomHandle) || ADV.export?.includeHandlesIfHidden;

    const htmlStr = buildInteractiveHtmlString({
      unit: UNIT, rows: ROWS, cols: COLS,
      margins: { ML, MR, MT, MB },
      width: W, height: H, vbw: VBW, vbh: VBH,
      sx, sy, TEN,
      limits: { minColsEachSide, minRowsEachSide },
      classes,
      includeGrid: !!ADV.export?.includeGrid,
      showHeightAxis, showLengthAxis,
      includeHandles,
      colorsCSS: getInlineStyleDefaults(),
      handleSize: HANDLE_SIZE,
      icons: { horizUrl: ADV.handleIcons.horiz, vertUrl: ADV.handleIcons.vert },
      edgeGap: EDGE_GAP,
      safePad: ADV.fit?.safePad || {top:8,right:8,bottom:64,left:8}
    });
    const fname = ADV.export?.filenameHtml || "arealmodell_interaktiv.html";
    downloadText(fname, htmlStr, "text/html;charset=utf-8");
  };

  // ===== helpers =====
  function downloadText(filename, text, mime){
    const blob = new Blob([text], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = filename;
    document.body.appendChild(a); a.click(); a.remove();
    URL.revokeObjectURL(url);
  }

  // === FARGER/typografi ===
  function getInlineStyleDefaults(){
    const cols = ADV.colors || ["#e07c7c", "#f0c667", "#7fb2d6", "#8bb889"];
    return `
.outer { fill: white; stroke: #333; stroke-width: 3; pointer-events: none; }
.split { stroke: #333; stroke-width: 3; transition: stroke-width .12s ease; pointer-events: none; }
.split.ok { stroke-width: 6; }
.cell  { stroke: #333; stroke-width: 2; pointer-events: none; }

.c1 { fill: ${cols[0]}; }
.c2 { fill: ${cols[1]}; }
.c3 { fill: ${cols[2]}; }
.c4 { fill: ${cols[3]}; }

.grid line { stroke: #000; stroke-opacity: .28; stroke-width: 1; pointer-events: none; }
.labelCell { font: 600 22px system-ui, -apple-system, Segoe UI, Roboto, Arial; fill: #222; pointer-events: none; }
.labelEdge { font: 600 26px system-ui, -apple-system, Segoe UI, Roboto, Arial; fill: #333; pointer-events: none; }

.handleImg { pointer-events: none; }
.handleHit, .hot, svg { touch-action: none; }
.handleHit { fill: rgba(0,0,0,0.004); cursor: grab; pointer-events: all; }
`;
  }

  function injectRuntimeStyles(){
    if (document.getElementById("arealmodell-runtime-css")) return;
    const style = document.createElement("style");
    style.id = "arealmodell-runtime-css";
    style.textContent = getInlineStyleDefaults();
    document.head.appendChild(style);
  }

  // -------- Base-SVG uten skript --------
  function buildBaseSvgMarkup(o, includeXmlHeader){
    const ML = o.margins.ML, MT = o.margins.MT;
    const wL = Math.round(o.sx/o.unit), wR = o.cols - wL;
    const hB = Math.round(o.sy/o.unit), hT = o.rows - hB;
    const HS = o.handleSize ?? 84;
    const gapX = o.edgeGap?.x ?? 14, gapY = o.edgeGap?.y ?? 32;

    let gridStr = "";
    if (o.includeGrid) {
      let lines = [];
      for (let i=1;i<o.cols;i++){
        const x = ML + o.unit*i;
        lines.push('<line x1="'+x+'" y1="'+MT+'" x2="'+x+'" y2="'+(MT+o.height)+'" />');
      }
      for (let j=1;j<o.rows;j++){
        const y = MT + o.unit*j;
        lines.push('<line x1="'+ML+'" y1="'+y+'" x2="'+(ML+o.width)+'" y2="'+y+'" />');
      }
      gridStr = '<g class="'+o.classes.grid+'" clip-path="url(#clipR)">'+lines.join("")+'</g>';
    }

    const vLineStr = o.showLengthAxis ? '<line id="vLine" class="'+o.classes.split+'" x1="'+(ML+o.sx)+'" y1="'+MT+'" x2="'+(ML+o.sx)+'" y2="'+(MT+o.height)+'"/>' : "";
    const hLineStr = o.showHeightAxis ? '<line id="hLine" class="'+o.classes.split+'" x1="'+ML+'" y1="'+(MT+o.height-o.sy)+'" x2="'+(ML+o.width)+'" y2="'+(MT+o.height-o.sy)+'"/>' : "";

    const hLeftImg  = (o.includeHandles && o.showHeightAxis)
      ? '<image id="hLeft" class="'+o.classes.handle+'" href="'+(o.icons.vertUrl||'')+'" width="'+HS+'" height="'+HS+'" x="'+(ML-HS/2)+'" y="'+(MT+o.height-o.sy-HS/2)+'"/>' : "";
    const hDownImg  = (o.includeHandles && o.showLengthAxis)
      ? '<image id="hDown" class="'+o.classes.handle+'" href="'+(o.icons.horizUrl||'')+'" width="'+HS+'" height="'+HS+'" x="'+(ML+o.sx-HS/2)+'" y="'+(MT+o.height-HS/2)+'"/>' : "";

    // Start på riktig posisjon
    const hLeftHit  = (o.includeHandles && o.showHeightAxis)
      ? '<circle id="hLeftHit" class="handleHit" r="'+(HS*0.55)+'" cx="'+(ML)+'" cy="'+(MT+o.height-o.sy)+'" style="cursor:grab"/>' : "";
    const hDownHit  = (o.includeHandles && o.showLengthAxis)
      ? '<circle id="hDownHit" class="handleHit" r="'+(HS*0.55)+'" cx="'+(ML+o.sx)+'" cy="'+(MT+o.height)+'" style="cursor:grab"/>' : "";

    const hotLeftStr   = o.showHeightAxis ? '<rect id="hotLeft" class="hot" x="'+(ML-10)+'" y="'+MT+'" width="10" height="'+o.height+'"/>' : "";
    const hotBottomStr = o.showLengthAxis ? '<rect id="hotBottom" class="hot" x="'+ML+'" y="'+(MT+o.height)+'" width="'+o.width+'" height="10"/>' : "";

    const parts = [];
    if (includeXmlHeader) parts.push('<?xml version="1.0" encoding="UTF-8"?>');
    parts.push('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 '+o.vbw+' '+o.vbh+'" width="'+o.vbw+'" height="'+o.vbh+'" tabindex="0">');
    parts.push('<title>Arealmodell – dragbare delinger</title>');
    parts.push('<style>'+o.colorsCSS+'</style>');
    parts.push('<defs><clipPath id="clipR"><rect x="'+ML+'" y="'+MT+'" width="'+o.width+'" height="'+o.height+'"/></clipPath></defs>');
    parts.push('<rect class="'+o.classes.outer+'" x="'+ML+'" y="'+MT+'" width="'+o.width+'" height="'+o.height+'"/>');
    parts.push(gridStr);

    parts.push('<rect id="rTL" class="cell '+o.classes.cells[0]+'" x="'+ML+'" y="'+MT+'" width="'+o.sx+'" height="'+(o.height-o.sy)+'"></rect>');
    parts.push('<rect id="rTR" class="cell '+o.classes.cells[1]+'" x="'+(ML+o.sx)+'" y="'+MT+'" width="'+(o.width-o.sx)+'" height="'+(o.height-o.sy)+'"></rect>');
    parts.push('<rect id="rBL" class="cell '+o.classes.cells[2]+'" x="'+ML+'" y="'+(MT+o.height-o.sy)+'" width="'+o.sx+'" height="'+o.sy+'"></rect>');
    parts.push('<rect id="rBR" class="cell '+o.classes.cells[3]+'" x="'+(ML+o.sx)+'" y="'+(MT+o.height-o.sy)+'" width="'+(o.width-o.sx)+'" height="'+o.sy+'"></rect>');

    parts.push(vLineStr, hLineStr, hotLeftStr, hotBottomStr, hLeftImg, hDownImg, hLeftHit, hDownHit);

    // cell-tekster
    parts.push('<text id="tTL" class="labelCell" x="'+(ML+o.sx/2)+'" y="'+(MT+(o.height-o.sy)/2+8)+'" text-anchor="middle">'+(wL)+' · '+(hT)+'</text>');
    parts.push('<text id="tTR" class="labelCell" x="'+(ML+o.sx+(o.width-o.sx)/2)+'" y="'+(MT+(o.height-o.sy)/2+8)+'" text-anchor="middle">'+(wR)+' · '+(hT)+'</text>');
    parts.push('<text id="tBL" class="labelCell" x="'+(ML+o.sx/2)+'" y="'+(MT+(o.height-o.sy)+o.sy/2+8)+'" text-anchor="middle">'+(wL)+' · '+(hB)+'</text>');
    parts.push('<text id="tBR" class="labelCell" x="'+(ML+o.sx+(o.width-o.sx)/2)+'" y="'+(MT+(o.height-o.sy)+o.sy/2+8)+'" text-anchor="middle">'+(wR)+' · '+(hB)+'</text>');

    // kant-tekst Utenfor, med luft:
    const xL = ML - (HS/2) - (gapX);
    const yB = MT + o.height + (HS/2) + (gapY);
    if (o.showHeightAxis) {
      parts.push('<text id="leftTop" class="labelEdge" x="'+xL+'" y="'+(MT+(o.height-o.sy)/2+10)+'" text-anchor="end">'+(hT)+'</text>');
      parts.push('<text id="leftBot" class="labelEdge" x="'+xL+'" y="'+(MT+(o.height-o.sy)+o.sy/2+10)+'" text-anchor="end">'+(hB)+'</text>');
    }
    if (o.showLengthAxis) {
      parts.push('<text id="botLeft"  class="labelEdge" x="'+(ML+o.sx/2)+'" y="'+yB+'" text-anchor="middle">'+(wL)+'</text>');
      parts.push('<text id="botRight" class="labelEdge" x="'+(ML+o.sx+(o.width-o.sx)/2)+'" y="'+yB+'" text-anchor="middle">'+(wR)+'</text>');
    }

    parts.push("</svg>");
    return parts.join("\n");
  }

  // runtime-skript (eksportert SVG/HTML)
  function buildRuntimeScriptText(o, rootExpr){
    const ML = o.margins.ML, MT = o.margins.MT;
    return [
      "(function(){",
      "var UNIT="+o.unit+", ROWS="+o.rows+", COLS="+o.cols+", TEN="+o.TEN+";",
      "var ML="+ML+", MT="+MT+", W="+o.width+", H="+o.height+";",
      "var minColsEachSide="+o.limits.minColsEachSide+", minRowsEachSide="+o.limits.minRowsEachSide+";",
      "var SPLIT_C=\""+o.classes.split.replace(/\"/g,"&quot;")+"\";",
      "var HS="+(o.handleSize ?? 84)+", GAPX="+(o.edgeGap?.x ?? 14)+", GAPY="+(o.edgeGap?.y ?? 32)+";",
      "var SAFE="+JSON.stringify(o.safePad || {top:8,right:8,bottom:64,left:8})+";",
      "var root="+rootExpr+"; root.style.touchAction='none';",
      "var rTL=document.getElementById('rTL'), rTR=document.getElementById('rTR'), rBL=document.getElementById('rBL'), rBR=document.getElementById('rBR');",
      "var vLine=document.getElementById('vLine'), hLine=document.getElementById('hLine');",
      "var tTL=document.getElementById('tTL'), tTR=document.getElementById('tTR'), tBL=document.getElementById('tBL'), tBR=document.getElementById('tBR');",
      "var leftTop=document.getElementById('leftTop'), leftBot=document.getElementById('leftBot'), botLeft=document.getElementById('botLeft'), botRight=document.getElementById('botRight');",
      "var hLeft=document.getElementById('hLeft'), hDown=document.getElementById('hDown');",
      "var hitLeft=document.getElementById('hLeftHit'), hitDown=document.getElementById('hDownHit');",
      "var hotLeft=document.getElementById('hotLeft'), hotBottom=document.getElementById('hotBottom');",
      "var vb=root.viewBox.baseVal; var sx="+o.sx+", sy="+o.sy+";",
      "function set(el,a,v){ if(el) el.setAttribute(a,v); }",
      "function clamp(v,a,b){ return Math.max(a, Math.min(b, v)); }",
      "function snap(v){ return Math.round(v/UNIT)*UNIT; }",
      "var rect=root.getBoundingClientRect(); function refreshRect(){ rect=root.getBoundingClientRect(); }",
      "function clientToSvg(e){ var sx=vb.width/rect.width, sy=vb.height/rect.height; return { x: vb.x+(e.clientX-rect.left)*sx, y: vb.y+(e.clientY-rect.top)*sy }; }",
      "var raf=0; function schedule(){ if(raf) return; raf=requestAnimationFrame(function(){ raf=0; redraw(); }); }",
      "function redraw(){ var wL=Math.round(sx/UNIT), wR=COLS-wL; var hB=Math.round(sy/UNIT), hT=ROWS-hB;",
      " set(rTL,'x',ML); set(rTL,'y',MT); set(rTL,'width',sx); set(rTL,'height',H-sy);",
      " set(rTR,'x',ML+sx); set(rTR,'y',MT); set(rTR,'width',W-sx); set(rTR,'height',H-sy);",
      " set(rBL,'x',ML); set(rBL,'y',MT+(H-sy)); set(rBL,'width',sx); set(rBL,'height',sy);",
      " set(rBR,'x',ML+sx); set(rBR,'y',MT+(H-sy)); set(rBR,'width',W-sx); set(rBR,'height',sy);",
      " if(vLine){ set(vLine,'x1',ML+sx); set(vLine,'y1',MT); set(vLine,'x2',ML+sx); set(vLine,'y2',MT+H); }",
      " if(hLine){ set(hLine,'x1',ML); set(hLine,'y1',MT+(H-sy)); set(hLine,'x2',ML+W); set(hLine,'y2',MT+(H-sy)); }",
      " var hLeftCX=ML, hLeftCY=MT+(H-sy), hDownCX=ML+sx, hDownCY=MT+H;",
      " if(hLeft){ set(hLeft,'x',hLeftCX-HS/2); set(hLeft,'y',hLeftCY-HS/2); }",
      " if(hDown){ set(hDown,'x',hDownCX-HS/2); set(hDown,'y',hDownCY-HS/2); }",
      " if(hitLeft){ set(hitLeft,'cx',hLeftCX); set(hitLeft,'cy',hLeftCY); }",
      " if(hitDown){ set(hitDown,'cx',hDownCX); set(hitDown,'cy',hDownCY); }",
      " var leftXOutside = ML-(HS/2)-GAPX, bottomYOutside = MT+H+(HS/2)+GAPY;",
      " if(tTL){ set(tTL,'x',ML+sx/2); set(tTL,'y',MT+(H-sy)/2+8); tTL.textContent=wL+' · '+hT; }",
      " if(tTR){ set(tTR,'x',ML+sx+(W-sx)/2); set(tTR,'y',MT+(H-sy)/2+8); tTR.textContent=wR+' · '+hT; }",
      " if(tBL){ set(tBL,'x',ML+sx/2); set(tBL,'y',MT+(H-sy)+sy/2+8); tBL.textContent=wL+' · '+hB; }",
      " if(tBR){ set(tBR,'x',ML+sx+(W-sx)/2); set(tBR,'y',MT+(H-sy)+sy/2+8); tBR.textContent=wR+' · '+hB; }",
      " if(leftTop){ leftTop.textContent=String(hT); set(leftTop,'x',leftXOutside); set(leftTop,'y',MT+(H-sy)/2+10); }",
      " if(leftBot){ leftBot.textContent=String(hB); set(leftBot,'x',leftXOutside); set(leftBot,'y',MT+(H-sy)+sy/2+10); }",
      " if(botLeft){ botLeft.textContent=String(wL); set(botLeft,'x',ML+sx/2); set(botLeft,'y',bottomYOutside); }",
      " if(botRight){ botRight.textContent=String(wR); set(botRight,'x',ML+sx+(W-sx)/2); set(botRight,'y',bottomYOutside); }",
      " var on=((wL===TEN||wR===TEN)&&(hB===TEN||hT===TEN));",
      " if(vLine){ vLine.setAttribute('class',SPLIT_C+(on?' ok':'')); }",
      " if(hLine){ hLine.setAttribute('class',SPLIT_C+(on?' ok':'')); }",
      " if(hLeft) root.append(hLeft); if(hitLeft) root.append(hitLeft); if(hDown) root.append(hDown); if(hitDown) root.append(hitDown);",
      "}",
      "function fit(){ var availW=Math.max(100, window.innerWidth-(SAFE.left+SAFE.right)); var availH=Math.max(100, window.innerHeight-(SAFE.top+SAFE.bottom)); var s=Math.min(availW/vb.width, availH/vb.height); root.setAttribute('width', vb.width*s); root.setAttribute('height', vb.height*s); refreshRect(); }",
      "fit(); redraw(); window.addEventListener('resize', fit, {passive:true});",
      "var active={axis:null,id:null,captor:null}; var justDragged=false; function arm(){ justDragged=true; setTimeout(function(){ justDragged=false; },220); }",
      "function lock(){ document.documentElement.style.touchAction='none'; document.body.style.touchAction='none'; document.documentElement.style.overscrollBehavior='contain'; document.body.style.overscrollBehavior='contain'; }",
      "function unlock(){ document.documentElement.style.touchAction=''; document.body.style.touchAction=''; document.documentElement.style.overscrollBehavior=''; document.body.style.overscrollBehavior=''; }",
      "function onMove(e){ if(e.pointerId!==active.id) return; e.preventDefault(); var p=clientToSvg(e); if(active.axis==='v'){ var y=Math.max(MT+minRowsEachSide*UNIT, Math.min(MT+H-minRowsEachSide*UNIT, p.y)); var n=(MT+H)-y; if(n!==sy){ sy=n; schedule(); } } else if(active.axis==='h'){ var x=Math.max(ML+minColsEachSide*UNIT, Math.min(ML+W-minColsEachSide*UNIT, p.x)); var n=x-ML; if(n!==sx){ sx=n; schedule(); } }}",
      "function onUp(e){ if(e.pointerId!==active.id) return; e.preventDefault(); if(active.axis==='v') sy=snap(sy); if(active.axis==='h') sx=snap(sx); if(active.captor&&active.captor.releasePointerCapture){try{active.captor.releasePointerCapture(e.pointerId);}catch(_){}} if(active.captor){active.captor.setAttribute('class',(active.captor.getAttribute('class')||'').replace(/\\bdragging\\b/,'').trim());} active.axis=null; active.id=null; active.captor=null; window.removeEventListener('pointermove', onMove); window.removeEventListener('pointerup', onUp); window.removeEventListener('pointercancel', onUp); unlock(); arm(); schedule(); }",
      "function start(axis,e){ active.axis=axis; active.id=e.pointerId; active.captor=e.currentTarget||e.target; if(active.captor&&active.captor.setPointerCapture){try{active.captor.setPointerCapture(e.pointerId);}catch(_){}} var cls=(active.captor.getAttribute('class')||''); active.captor.setAttribute('class', (cls+' dragging').trim()); lock(); window.addEventListener('pointermove', onMove, {passive:false}); window.addEventListener('pointerup', onUp, {passive:false}); window.addEventListener('pointercancel', onUp, {passive:false}); }",
      "if(hitLeft){ hitLeft.style.touchAction='none'; hitLeft.addEventListener('pointerdown', function(e){ e.preventDefault(); start('v',e); }, {passive:false}); }",
      "if(hitDown){ hitDown.style.touchAction='none'; hitDown.addEventListener('pointerdown', function(e){ e.preventDefault(); start('h',e); }, {passive:false}); }",
      (ADV.clickToMove!==false
        ? "root.addEventListener('click',function(e){ if(justDragged) return; var p=clientToSvg(e); if(Math.abs(p.x-ML)<12 && p.y>=MT && p.y<=MT+H){ sy=Math.round(((MT+H)-Math.max(MT+minRowsEachSide*UNIT,Math.min(MT+H-minRowsEachSide*UNIT,p.y)))/UNIT)*UNIT; schedule(); } else if(Math.abs(p.y-(MT+H))<12 && p.x>=ML && p.x<=ML+W){ sx=Math.round((Math.max(ML+minColsEachSide*UNIT,Math.min(ML+W-minColsEachSide*UNIT,p.x))-ML)/UNIT)*UNIT; schedule(); } });"
        : ""),
      "})();"
    ].join("\n");
  }

  function buildInteractiveSvgString(o){
    const svgNoScript = buildBaseSvgMarkup(o, true);
    const scriptText  = buildRuntimeScriptText(o, "document.documentElement");
    return svgNoScript.replace("</svg>",
      "<script><![CDATA[\n" + scriptText + "\n]]>" + "</" + "script>\n</svg>");
  }

  // Selvstendig HTML med interaktiv SVG
  function buildInteractiveHtmlString(o){
    let svgMarkup = buildBaseSvgMarkup(o, false).replace('<svg ', '<svg id="rootSvg" ');
    const scriptText  = buildRuntimeScriptText(o, "document.getElementById('rootSvg')");
    const safeScript  = "<script>" + scriptText.replace(/<\/script>/gi, "<\\/script>") + "</" + "script>";
    const resetCss =
      "html,body{margin:0;padding:0;height:100%;background:#fff;}" +
      "body{display:flex;align-items:center;justify-content:center;}";

    return [
      "<!DOCTYPE html>",
      "<html lang='no'><head><meta charset='utf-8'/>",
      "<meta name='viewport' content='width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no'/>",
      "<title>Arealmodell – interaktiv</title>",
      "<style>", resetCss, "</style>",
      "</head><body>",
      svgMarkup,
      safeScript,
      "</body></html>"
    ].join("");
  }
}

function initFromHtml(){
  readConfigFromHtml();
  render();
}

function setSimpleConfig(o={}){
  if(o.height != null) CFG.SIMPLE.height.cells = Math.round(o.height);
  if(o.length != null) CFG.SIMPLE.length.cells = Math.round(o.length);
  if(o.heightHandle != null) CFG.SIMPLE.height.handle = Math.round(o.heightHandle);
  if(o.lengthHandle != null) CFG.SIMPLE.length.handle = Math.round(o.lengthHandle);
  const setVal = (id,v)=>{ const el=document.getElementById(id); if(el && v!=null) el.value=v; };
  setVal("height", CFG.SIMPLE.height.cells);
  setVal("length", CFG.SIMPLE.length.cells);
  setVal("heightHandle", CFG.SIMPLE.height.handle);
  setVal("lengthHandle", CFG.SIMPLE.length.handle);
  render();
}

window.setArealmodellBConfig = setSimpleConfig;

window.addEventListener('load', () => {
  initFromHtml();
  document.querySelectorAll('.settings input').forEach(el => {
    el.addEventListener('change', initFromHtml);
    el.addEventListener('input', initFromHtml);
  });
});
