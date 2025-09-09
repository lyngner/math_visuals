// ========== ENKEL KONFIG ==========
const cfg = {
  // Aksene: antall ruter (cells), startposisjon for deling (handle i ruter), og show (vis/ikke vis UI på aksen)
  height: { cells: 11, handle: 5, show: true },   // vertikal størrelse (rader) + horisontal deling (fra bunn)
  length: { cells: 17, handle: 3, show: true },   // horisontal størrelse (kolonner) + vertikal deling (fra venstre)

  // ========== ADVANCED (valgfritt) ==========
  adv: {
    svgId: "area",
    unit: 30, // px per rute
    margins: { left: 60, right: 40, top: 20, bottom: 60 },

    // Responsiv skalering (kan droppes helt — default verdier brukes)
    fit: {
      maxVh: 90, // maks høyde i prosent av viewport-høyde
      maxVw: 100 // maks bredde i prosent av viewport-bredde
    },

    labels: {
      // "factors" | "area" | "both" | "none"
      cellMode: "factors",
      // "counts" | "none"
      edgeMode: "counts",
      dot: " · ",
      equals: " = "
    },

    // Slå av/på globale UI-funksjoner (akse-spesifikk visning styres av height.show / length.show)
    grid: true,
    splitLines: true,
    clickToMove: true,
    drag: { vertical: true, horizontal: true }, // vertical: venstre håndtak (sy), horizontal: bunn-håndtak (sx)

    // Begrensninger (min. ruter pr. side)
    limits: { minColsEachSide: 1, minRowsEachSide: 1 },

    // CSS-klasser (bruker eksisterende stilene dine)
    classes: {
      outer: "outer",
      grid: "grid",
      split: "split",
      handle: "handle",
      labelCell: "labelCell",
      labelEdge: "labelEdge",
      cells: ["c1","c2","c3","c4"]
    }
  }
};
// ========== SLUTT KONFIG ==========

window.addEventListener("load", () => {
  // ----- hent adv + standardverdier -----
  const ADV = cfg.adv ?? {};
  const svgId = ADV.svgId ?? "area";
  const UNIT = Number.isFinite(ADV.unit) ? ADV.unit : 30;

  const ROWS = Math.max(2, Math.round(cfg.height?.cells ?? 15));
  const COLS = Math.max(2, Math.round(cfg.length?.cells ?? 17));

  const ML = ADV.margins?.left   ?? 60;
  const MR = ADV.margins?.right  ?? 40;
  const MT = ADV.margins?.top    ?? 20;
  const MB = ADV.margins?.bottom ?? 60;

  const W = COLS * UNIT, H = ROWS * UNIT;
  const VBW = ML + W + MR, VBH = MT + H + MB;

  const classes = {
    outer: ADV.classes?.outer ?? "outer",
    grid: ADV.classes?.grid ?? "grid",
    split: ADV.classes?.split ?? "split",
    handle: ADV.classes?.handle ?? "handle",
    labelCell: ADV.classes?.labelCell ?? "labelCell",
    labelEdge: ADV.classes?.labelEdge ?? "labelEdge",
    cells: ADV.classes?.cells ?? ["c1","c2","c3","c4"]
  };

  // Globale toggler
  const showGrid = ADV.grid !== false;
  const clickToMove = ADV.clickToMove !== false;

  // Per-akse "show" (default true)
  const showHeightAxis = cfg.height?.show !== false;
  const showLengthAxis = cfg.length?.show !== false;

  // Drag toggler (per akse + global)
  const dragVertical   = showHeightAxis && (ADV.drag?.vertical !== false);     // venstre håndtak (sy)
  const dragHorizontal = showLengthAxis && (ADV.drag?.horizontal !== false);   // bunn-håndtak (sx)

  // Delingslinjer per akse
  const splitLinesOn = ADV.splitLines !== false;
  const showHLine = splitLinesOn && showHeightAxis;  // horisontal delingslinje (styrt av height)
  const showVLine = splitLinesOn && showLengthAxis;  // vertikal delingslinje (styrt av length)

  const minColsEachSide = Math.max(1, ADV.limits?.minColsEachSide ?? 1);
  const minRowsEachSide = Math.max(1, ADV.limits?.minRowsEachSide ?? 1);

  // Startdeling i piksler – faller tilbake til midten hvis handle ikke er gitt
  const initLeftCols   = (cfg.length?.handle ?? Math.floor(COLS/2));
  const initBottomRows = (cfg.height?.handle ?? Math.floor(ROWS/2));

  // Håndtak synlighet: show må være true OG handle != null
  const showLeftHandle   = showHeightAxis && (cfg.height?.handle !== null);
  const showBottomHandle = showLengthAxis && (cfg.length?.handle !== null);

  // ----- helpers -----
  const NS = "http://www.w3.org/2000/svg";
  const el  = n => document.createElementNS(NS, n);
  const set = (node, n, v) => { node.setAttribute(n, v); return node; };
  const clamp = (v,a,b)=>Math.max(a,Math.min(b,v));
  const clampInt = (v,a,b)=>Math.max(a,Math.min(b,Math.round(v)));
  const snap  = v => Math.round(v/UNIT)*UNIT;

  const minX = ML + minColsEachSide*UNIT;
  const maxX = ML + W - minColsEachSide*UNIT;
  const minY = MT + minRowsEachSide*UNIT;
  const maxY = MT + H - minRowsEachSide*UNIT;

  // Faktiske delinger (px)
  let sx = clampInt(initLeftCols,   1, COLS-1) * UNIT; // bredde venstre del
  let sy = clampInt(initBottomRows, 1, ROWS-1) * UNIT; // høyde nederste del

  // ----- SVG-setup -----
  const svg = document.getElementById(svgId);
  set(svg, "viewBox", `0 0 ${VBW} ${VBH}`);

  // --- RESPONSIV SKALERING ---
  set(svg, "preserveAspectRatio", "xMidYMid meet");
  const maxVh = ADV.fit?.maxVh ?? 90;   // f.eks. 90vh
  const maxVw = ADV.fit?.maxVw ?? 100;  // f.eks. 100vw
  svg.style.width = "100%";
  svg.style.height = "auto";
  svg.style.maxHeight = `${maxVh}vh`;
  svg.style.maxWidth = `${maxVw}vw`;
  svg.style.display = "block";
  // --- SLUTT: RESPONSIV SKALERING ---

  // Ytre ramme
  const rectOuter = el("rect");
  set(rectOuter,"x",ML); set(rectOuter,"y",MT);
  set(rectOuter,"width",W); set(rectOuter,"height",H);
  set(rectOuter,"class",classes.outer);
  svg.appendChild(rectOuter);

  // defs + clip
  const defs = el("defs"); svg.appendChild(defs);
  const clip = el("clipPath"); set(clip,"id","clipR");
  const clipRect = el("rect");
  set(clipRect,"x",ML); set(clipRect,"y",MT); set(clipRect,"width",W); set(clipRect,"height",H);
  clip.appendChild(clipRect); defs.appendChild(clip);

  // Grid
  const gridGroup = el("g");
  set(gridGroup,"class",classes.grid);
  set(gridGroup,"clip-path","url(#clipR)");
  if (showGrid) {
    for (let x = ML + UNIT; x < ML + W; x += UNIT) {
      const ln = el("line"); set(ln,"x1",x); set(ln,"y1",MT); set(ln,"x2",x); set(ln,"y2",MT+H); gridGroup.appendChild(ln);
    }
    for (let y = MT + UNIT; y < MT + H; y += UNIT) {
      const ln = el("line"); set(ln,"x1",ML); set(ln,"y1",y); set(ln,"x2",ML+W); set(ln,"y2",y); gridGroup.appendChild(ln);
    }
  }
  svg.appendChild(gridGroup);

  // Fire felt
  const rTL = el("rect"), rTR = el("rect"), rBL = el("rect"), rBR = el("rect");
  set(rTL,"class",classes.cells[0]); set(rTR,"class",classes.cells[1]);
  set(rBL,"class",classes.cells[2]); set(rBR,"class",classes.cells[3]);
  svg.append(rTL, rTR, rBL, rBR);

  // Delingslinjer (opprett bare det som vises)
  let vLine = null, hLine = null;
  if (showVLine) { vLine = el("line"); set(vLine,"class",classes.split); svg.append(vLine); }
  if (showHLine) { hLine = el("line"); set(hLine,"class",classes.split); svg.append(hLine); }

  // Håndtak (venstre/bunn)
  const handleLeft  = el("circle"); set(handleLeft,"class",classes.handle); set(handleLeft,"r",10);
  const handleDown  = el("circle"); set(handleDown,"class",classes.handle); set(handleDown,"r",10);
  if (showLeftHandle)   svg.append(handleLeft);
  if (showBottomHandle) svg.append(handleDown);

  // Tekster
  const tTL = el("text"), tTR = el("text"), tBL = el("text"), tBR = el("text");
  [tTL,tTR,tBL,tBR].forEach(t=>{ set(t,"class",classes.labelCell); set(t,"text-anchor","middle"); });
  const leftTop  = el("text"), leftBot  = el("text"), botLeft = el("text"), botRight = el("text");
  set(leftTop,"class",classes.labelEdge);  set(leftTop,"text-anchor","end");
  set(leftBot,"class",classes.labelEdge);  set(leftBot,"text-anchor","end");
  set(botLeft,"class",classes.labelEdge);  set(botLeft,"text-anchor","middle");
  set(botRight,"class",classes.labelEdge); set(botRight,"text-anchor","middle");
  svg.append(tTL,tTR,tBL,tBR,leftTop,leftBot,botLeft,botRight);

  // Label-format
  const LBL = ADV.labels ?? {};
  const cellMode = LBL.cellMode ?? "factors";
  const edgeMode = LBL.edgeMode ?? "counts";
  const dot = LBL.dot ?? " · ";
  const equals = LBL.equals ?? " = ";

  function formatCellLabel(w,h){
    if (cellMode === "none") return "";
    if (cellMode === "factors") return `${w}${dot}${h}`;
    if (cellMode === "area") return `${w*h}`;
    return `${w}${dot}${h}${equals}${w*h}`; // both
  }
  const edgeOn = edgeMode === "counts";

  function redraw(){
    const wL = Math.round(sx/UNIT), wR = COLS - wL;
    const hB = Math.round(sy/UNIT), hT = ROWS - hB;

    // Felt
    set(rTL,"x",ML); set(rTL,"y",MT); set(rTL,"width",sx); set(rTL,"height",H-sy);
    set(rTR,"x",ML+sx); set(rTR,"y",MT); set(rTR,"width",W-sx); set(rTR,"height",H-sy);
    set(rBL,"x",ML); set(rBL,"y",MT+(H-sy)); set(rBL,"width",sx); set(rBL,"height",sy);
    set(rBR,"x",ML+sx); set(rBR,"y",MT+(H-sy)); set(rBR,"width",W-sx); set(rBR,"height",sy);

    // Delingslinjer
    if (vLine) {
      set(vLine,"x1",ML+sx); set(vLine,"y1",MT); set(vLine,"x2",ML+sx); set(vLine,"y2",MT+H);
    }
    if (hLine) {
      set(hLine,"x1",ML); set(hLine,"y1",MT+(H-sy)); set(hLine,"x2",ML+W); set(hLine,"y2",MT+(H-sy));
    }

    // Håndtakposisjoner
    if (showLeftHandle)   { set(handleLeft,"cx",ML); set(handleLeft,"cy",MT+(H-sy)); }
    if (showBottomHandle) { set(handleDown,"cx",ML+sx); set(handleDown,"cy",MT+H); }

    // Celle-etiketter
    set(tTL,"x",ML + sx/2);               set(tTL,"y",MT + (H - sy)/2 + 8);      tTL.textContent = formatCellLabel(wL, hT);
    set(tTR,"x",ML + sx + (W - sx)/2);    set(tTR,"y",MT + (H - sy)/2 + 8);      tTR.textContent = formatCellLabel(wR, hT);
    set(tBL,"x",ML + sx/2);               set(tBL,"y",MT + (H - sy) + sy/2 + 8); tBL.textContent = formatCellLabel(wL, hB);
    set(tBR,"x",ML + sx + (W - sx)/2);    set(tBR,"y",MT + (H - sy) + sy/2 + 8); tBR.textContent = formatCellLabel(wR, hB);

    // Kant-etiketter (per akse)
    if (edgeOn && showHeightAxis) {
      set(leftTop ,"x",ML-6); set(leftTop ,"y",MT + (H - sy)/2 + 10); leftTop.textContent  = `${hT}`;
      set(leftBot ,"x",ML-6); set(leftBot ,"y",MT + (H - sy) + sy/2 + 10); leftBot.textContent = `${hB}`;
    } else {
      leftTop.textContent = leftBot.textContent = "";
    }
    if (edgeOn && showLengthAxis) {
      set(botLeft ,"x",ML + sx/2);            set(botLeft ,"y",MT + H + 36); botLeft.textContent  = `${wL}`;
      set(botRight,"x",ML + sx + (W - sx)/2); set(botRight,"y",MT + H + 36); botRight.textContent = `${wR}`;
    } else {
      botLeft.textContent = botRight.textContent = "";
    }
  }
  redraw();

  // ----- dragging -----
  let dragL=false, dragD=false;

  // Venstre håndtak (horisontal deling / sy)
  if (showLeftHandle && dragVertical) {
    handleLeft.addEventListener("pointerdown", e => { dragL=true; handleLeft.setPointerCapture(e.pointerId); });
    handleLeft.addEventListener("pointerup",   e => { dragL=false; handleLeft.releasePointerCapture(e.pointerId); });
    handleLeft.addEventListener("pointermove", e => {
      if (!dragL) return;
      const pt=svg.createSVGPoint(); pt.x=e.clientX; pt.y=e.clientY;
      const {y}=pt.matrixTransform(svg.getScreenCTM().inverse());
      const yC = clamp(y, minY, maxY);
      sy = snap(MT + H - yC);
      redraw();
    });
  }

  // Bunn-håndtak (vertikal deling / sx)
  if (showBottomHandle && dragHorizontal) {
    handleDown.addEventListener("pointerdown", e => { dragD=true; handleDown.setPointerCapture(e.pointerId); });
    handleDown.addEventListener("pointerup",   e => { dragD=false; handleDown.releasePointerCapture(e.pointerId); });
    handleDown.addEventListener("pointermove", e => {
      if (!dragD) return;
      const pt=svg.createSVGPoint(); pt.x=e.clientX; pt.y=e.clientY;
      const {x}=pt.matrixTransform(svg.getScreenCTM().inverse());
      const xC = clamp(x, minX, maxX);
      sx = snap(xC - ML);
      redraw();
    });
  }

  // Klikk på kant for å flytte deling (respekter per-akse show + drag)
  if (clickToMove) {
    svg.addEventListener("click", e => {
      const pt=svg.createSVGPoint(); pt.x=e.clientX; pt.y=e.clientY;
      const p=pt.matrixTransform(svg.getScreenCTM().inverse());

      // Venstre kant (endrer sy)
      if (dragVertical && showHeightAxis && Math.abs(p.x - ML) < 12 && p.y >= MT && p.y <= MT+H) {
        const yC = clamp(p.y, MT, MT+H);
        sy = snap(MT + H - clamp(yC, minY, maxY));
        redraw();
      }
      // Bunn-kant (endrer sx)
      if (dragHorizontal && showLengthAxis && Math.abs(p.y - (MT + H)) < 12 && p.x >= ML && p.x <= ML+W) {
        const xC = clamp(p.x, ML, ML+W);
        sx = snap(clamp(xC, minX, maxX) - ML);
        redraw();
      }
    });
  }
});
