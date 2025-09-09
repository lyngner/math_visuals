/* =======================
   KONFIG FRA HTML
   ======================= */
const SIMPLE = { pizzas: [] };
const PANEL_HTML = [];

function readConfigFromHtml(){
  const pizzas = [];
  for(let i=1;i<=2;i++){
    const show   = document.getElementById(`p${i}Show`)?.checked ?? false;
    const t      = parseInt(document.getElementById(`p${i}T`)?.value,10);
    const n      = parseInt(document.getElementById(`p${i}N`)?.value,10);
    const lockN  = document.getElementById(`p${i}LockN`)?.checked ?? false;
    const lockT  = document.getElementById(`p${i}LockT`)?.checked ?? false;
    const text   = document.getElementById(`p${i}Text`)?.value ?? "none";
    const minN   = parseInt(document.getElementById(`p${i}MinN`)?.value,10);
    const maxN   = parseInt(document.getElementById(`p${i}MaxN`)?.value,10);
    pizzas.push({
      show,
      t: isFinite(t)?t:0,
      n: isFinite(n)?n:1,
      lockN, lockT, text,
      minN: isFinite(minN)?minN:1,
      maksN: isFinite(maxN)?maxN:24
    });
  }
  return { pizzas };
}

/* =======================
   Grunnoppsett
   ======================= */
const PIZZA_DEFAULTS = {
  minN: 1, maxN: 24, R: 180, stepN: 1, stepK: 1,
  metaMode: "none", lockDenominator: false, lockNumerator: false
};
const PIZZA_DOM = [
  { svgId:"pizza1", fracId:"frac1", minusId:"nMinus1", plusId:"nPlus1", valId:"nVal1" },
  { svgId:"pizza2", fracId:"frac2", minusId:"nMinus2", plusId:"nPlus2", valId:"nVal2" }
];

const TAU=Math.PI*2;
const norm=a=>((a%TAU)+TAU)%TAU;
const mk=(n,a={})=>{const e=document.createElementNS("http://www.w3.org/2000/svg",n); for(const[k,v] of Object.entries(a)) e.setAttribute(k,v); return e;};
const arcPath=(r,a0,a1)=>{const raw=a1-a0,span=((raw%TAU)+TAU)%TAU,isFull=Math.abs(span)<1e-6&&Math.abs(raw)>1e-6;
  if(isFull) return `M ${r} 0 A ${r} ${r} 0 1 1 ${-r} 0 A ${r} ${r} 0 1 1 ${r} 0 Z`;
  const sweep=1,large=span>Math.PI?1:0,x0=r*Math.cos(a0),y0=r*Math.sin(a0),x1=r*Math.cos(a1),y1=r*Math.sin(a1);
  return `M 0 0 L ${x0} ${y0} A ${r} ${r} 0 ${large} ${sweep} ${x1} ${y1} Z`;};
const gcd=(a,b)=>{a=Math.abs(a);b=Math.abs(b);while(b){const t=b;b=a%b;a=t;}return a||1;};
const fmt=x=>{const s=(Math.round(x*100)/100).toFixed(2); return s.replace(/\.?0+$/,"");};

/* ==== Senter-justering: sirklene på LINJE ==== */
let _centerRaf=0;
function alignPanelsByCenter() {
  const panels=[...document.querySelectorAll(".pizzaPanel")].filter(p=>p.offsetParent!==null);
  if(!panels.length) return;
  const items=panels.map(p=>{
    const header=p.querySelector(".panelHeader");
    const svg=p.querySelector("svg.pizza");
    if(!header||!svg) return null;
    header.style.height="auto";
    const baseHeader=header.getBoundingClientRect().height;
    const svgH=svg.getBoundingClientRect().height;
    return {header, baseHeader, svgH};
  }).filter(Boolean);
  if(!items.length) return;
  const maxCenter=Math.max(...items.map(it=>it.baseHeader + it.svgH/2));
  items.forEach(it=>{
    const targetHeader=Math.max(0, maxCenter - it.svgH/2);
    const finalHeader=Math.max(targetHeader, it.baseHeader);
    it.header.style.height = finalHeader + "px";
  });
}
function scheduleCenterAlign(){ cancelAnimationFrame(_centerRaf); _centerRaf=requestAnimationFrame(alignPanelsByCenter); }
window.addEventListener("resize", scheduleCenterAlign);

/* =======================
   Pizza-klasse
   ======================= */
const REG = new Map(); // svgEl -> Pizza-instans (til eksport)
class Pizza{
  constructor(opts){
    const cfg={...PIZZA_DEFAULTS,...opts};
    this.cfg=cfg;

    this.minN=Math.max(1, cfg.minN ?? 1);
    this.maxN=Math.max(this.minN, cfg.maxN ?? 24);

    this.n=Math.min(Math.max(cfg.n ?? 6, this.minN), this.maxN);
    this.k=Math.min(cfg.k ?? 0, this.n);
    this.R=cfg.R ?? 180;
    this.theta=(this.k/this.n)*TAU;
    this.textMode = cfg.textMode ?? "none"; // "none" | "frac" | "percent" | "decimal"

    this.svg=document.getElementById(cfg.svgId);
    this.nMinus=document.getElementById(cfg.minusId);
    this.nPlus=document.getElementById(cfg.plusId);
    this.nVal=document.getElementById(cfg.valId);
    this.fracBox=document.getElementById(cfg.fracId);
    this.fracNum=this.fracBox?.querySelector(".num") || null;
    this.fracDen=this.fracBox?.querySelector(".den") || null;
    if(!this.svg) throw new Error(`Mangler SVG med id="${cfg.svgId}"`);

    // Header-slot (over SVG)
    this.header=document.createElement("div");
    this.header.className="panelHeader";
    this.svg.parentNode.insertBefore(this.header,this.svg);
    if(this.fracBox){
      this.header.appendChild(this.fracBox);
      this.fracBox.style.display = (this.textMode==="frac") ? "" : "none";
    }
    if(this.textMode==="percent" || this.textMode==="decimal"){
      this.metaLine=document.createElement("div");
      this.metaLine.style.fontSize = "28px";
      this.metaLine.style.lineHeight = "1";
      this.metaLine.style.opacity  = "0.9";
      this.metaLine.style.margin   = "0 0 6px 0";
      this.header.appendChild(this.metaLine);
    }

    // Lag i SVG
    this.gFill=mk("g"); this.gLinesBlack=mk("g"); this.gRim=mk("g"); this.defs=mk("defs"); this.gLinesWhite=mk("g"); this.gA11y=mk("g"); this.gHandle=mk("g");
    this.gFill.setAttribute("data-role","fill");
    this.gLinesBlack.setAttribute("data-role","linesB");
    this.gLinesWhite.setAttribute("data-role","linesW");

    this.svg.append(this.gFill,this.gLinesBlack,this.gRim,this.defs,this.gLinesWhite,this.gA11y,this.gHandle);
    this.gRim.appendChild(mk("circle",{cx:0,cy:0,r:this.R,class:"rim"}));

    this.clipFilledId=`${cfg.svgId}-clipFilled`;
    this.clipEmptyId =`${cfg.svgId}-clipEmpty`;
    this.clipFilled  =mk("clipPath",{id:this.clipFilledId});
    this.clipEmpty   =mk("clipPath",{id:this.clipEmptyId});
    this.defs.append(this.clipFilled,this.clipEmpty);
    this.gLinesWhite.setAttribute("clip-path",`url(#${this.clipFilledId})`);
    this.gLinesBlack.setAttribute("clip-path",`url(#${this.clipEmptyId})`);

    // Handle + a11y
    this.handle=mk("circle",{r:10,class:"handle",tabindex:-1});
    this.gHandle.appendChild(this.handle);
    this.slider=mk("circle",{cx:0,cy:0,r:this.R,fill:"transparent",class:"a11y",tabindex:0,role:"slider","aria-orientation":"horizontal"});
    this.slider.style.pointerEvents="none";
    this.gA11y.appendChild(this.slider);

    // Låse-logikk
    this.fullyLocked = !!(cfg.lockDenominator && cfg.lockNumerator);
    if(this.fullyLocked){
      this.gHandle.style.display="none";
      this.slider.setAttribute("tabindex","-1");
      this.slider.setAttribute("aria-disabled","true");
    }else{
      this.slider.setAttribute("aria-disabled", cfg.lockNumerator ? "true" : "false");
      if(cfg.lockNumerator) this.handle.style.cursor="default";
    }

    // Stepper synlighet
    const stepper=this.nMinus?.closest(".stepper");
    if(stepper) stepper.style.display = cfg.lockDenominator ? "none" : "";

    // Interaksjon
    this._dragging=false;
    this.nMinus?.addEventListener("click", ()=>{ if(cfg.lockDenominator) return; this.setN(this.n - this.cfg.stepN); });
    this.nPlus ?.addEventListener("click", ()=>{ if(cfg.lockDenominator) return; this.setN(this.n + this.cfg.stepN); });

    this.handle.addEventListener("pointerdown", e=>{ if(cfg.lockNumerator||this.fullyLocked) return; this._dragging=true; this.handle.setPointerCapture(e.pointerId); });
    this.handle.addEventListener("pointerup",   e=>{ if(cfg.lockNumerator||this.fullyLocked) return; this._dragging=false; this.handle.releasePointerCapture(e.pointerId); });
    this.svg.addEventListener("pointerleave", ()=>{ this._dragging=false; });
    this.svg.addEventListener("pointermove", e=>{
      if(!this._dragging || cfg.lockNumerator || this.fullyLocked) return;
      const {x,y}=this._pt(e); const a=norm(Math.atan2(y,x)); this._setTheta(a,true);
    });
    this.svg.addEventListener("click", e=>{
      if(e.target===this.handle) return;
      if(cfg.lockNumerator || this.fullyLocked) return;
      const {x,y}=this._pt(e); const a=norm(Math.atan2(y,x)); this._setTheta(a,true);
    });
    this.slider.addEventListener("keydown", e=>{
      if(this.fullyLocked) return;
      let used=true; const big=e.shiftKey?5:1;
      switch(e.key){
        case "ArrowRight": case "ArrowUp":    if(!cfg.lockNumerator) this.setK(this.k+this.cfg.stepK*big); else used=false; break;
        case "ArrowLeft":  case "ArrowDown":  if(!cfg.lockNumerator) this.setK(this.k-this.cfg.stepK*big); else used=false; break;
        case "Home": if(!cfg.lockNumerator) this.setK(0); else used=false; break;
        case "End":  if(!cfg.lockNumerator) this.setK(this.n); else used=false; break;
        case " ": case "Enter": if(!cfg.lockNumerator) this.setK(this.k+1); else used=false; break;
        case "PageUp":   if(!cfg.lockDenominator) this.setN(this.n+this.cfg.stepN*(e.shiftKey?5:1)); else used=false; break;
        case "PageDown": if(!cfg.lockDenominator) this.setN(this.n-this.cfg.stepN*(e.shiftKey?5:1)); else used=false; break;
        default: used=false;
      }
      if(used) e.preventDefault();
    });

    this.draw();
    REG.set(this.svg, this);
  }

  _pt(e){ const p=this.svg.createSVGPoint(); p.x=e.clientX; p.y=e.clientY; return p.matrixTransform(this.svg.getScreenCTM().inverse()); }
  _setTheta(a,updateK){ this.theta=norm(a); if(updateK){ const step=TAU/this.n; this.k=Math.max(0,Math.min(this.n,Math.round(this.theta/step))); } this.draw(); }
  setN(n){ const nn=Math.max(this.minN,Math.min(this.maxN,Math.round(n))); this.n=nn; const step=TAU/this.n; this.k=Math.max(0,Math.min(this.n,Math.round(this.theta/step))); this.draw(); }
  setK(k){ const kk=Math.max(0,Math.min(this.n,Math.round(k))); this.k=kk; this.theta=(this.k/this.n)*TAU; this.draw(); }

  _updateTextAbove(){
    if(this.metaLine){
      this.metaLine.textContent =
        (this.textMode==="percent") ? (fmt(this.n?this.k/this.n*100:0)+" %") :
        (this.textMode==="decimal") ? fmt(this.n?this.k/this.n:0) : "";
    }
    if(this.fracBox && this.textMode==="frac"){
      const g=gcd(this.k,this.n);
      if(this.fracNum) this.fracNum.textContent=this.k/g;
      if(this.fracDen) this.fracDen.textContent=this.n/g;
    }
  }
  _updateAria(){
    const g=gcd(this.k,this.n), dec=fmt(this.n?this.k/this.n:0), pct=fmt(this.n?this.k/this.n*100:0)+" %";
    const simp=g>1?` (${this.k/g}/${this.n/g})`:"";
    this.slider.setAttribute("aria-valuemin","0");
    this.slider.setAttribute("aria-valuemax",String(this.n));
    this.slider.setAttribute("aria-valuenow",String(this.k));
    this.slider.setAttribute("aria-valuetext",`${this.k} av ${this.n}${simp}, ${dec} som desimal, ${pct}`);
  }

  draw(){
    const step=TAU/this.n, aEnd=this.k*step;
    if(this.nVal) this.nVal.textContent=this.n;

    this.gFill.innerHTML="";
    for(let i=0;i<this.n;i++){
      const a0=i*step,a1=a0+step,filled=i<this.k;
      this.gFill.appendChild(mk("path",{d:arcPath(this.R,a0,a1),class:`sector ${filled?"sector-fill":"sector-empty"}`}));
    }

    this.clipFilled.innerHTML=""; this.clipEmpty.innerHTML="";
    if(this.k<=0) this.clipEmpty.appendChild(mk("circle",{cx:0,cy:0,r:this.R}));
    else if(this.k>=this.n) this.clipFilled.appendChild(mk("circle",{cx:0,cy:0,r:this.R}));
    else { this.clipFilled.appendChild(mk("path",{d:arcPath(this.R,0,aEnd)})); this.clipEmpty.appendChild(mk("path",{d:arcPath(this.R,aEnd,TAU)})); }

    this.gLinesBlack.innerHTML=""; this.gLinesWhite.innerHTML="";
    if(this.n>1){
      for(let i=0;i<this.n;i++){
        const a=i*step,x=this.R*Math.cos(a),y=this.R*Math.sin(a);
        const lnB=mk("line",{x1:0,y1:0,x2:x,y2:y,class:"dash"});
        const lnW=mk("line",{x1:0,y1:0,x2:x,y2:y,class:"dash"}); lnW.setAttribute("stroke","#fff");
        this.gLinesBlack.appendChild(lnB); this.gLinesWhite.appendChild(lnW);
      }
    }

    if(this.fullyLocked){
      this.gHandle.style.display="none";
    }else{
      this.gHandle.style.display="";
      this.handle.setAttribute("cx", this.R*Math.cos(this.theta));
      this.handle.setAttribute("cy", this.R*Math.sin(this.theta));
    }

    this._updateAria();
    this._updateTextAbove();
    scheduleCenterAlign();
  }
}

/* =======================
   SVG-eksport – stil
   ======================= */
const EXPORT_SVG_STYLE = `
.rim{fill:none;stroke:#333;stroke-width:6}
.sector{stroke:#fff;stroke-width:6}
.sector-fill{fill:#5B2AA5}
.sector-empty{fill:#fff}
.dash{stroke:#444;stroke-dasharray:6 6;stroke-width:2}
.handle{fill:#e9e6f7;stroke:#333;stroke-width:2;cursor:pointer}
.a11y:focus{outline:none;stroke:#1e88e5;stroke-width:3}
.btn{fill:#fff;stroke:#cfcfcf;stroke-width:1;cursor:pointer}
.btnLabel{font-size:18px;dominant-baseline:middle;text-anchor:middle;pointer-events:none}
.meta, .fracNum, .fracDen{font-size:22px;text-anchor:middle}
.fracLine{stroke:#000;stroke-width:2}
`;

/* =======================
   Nedlasting: statisk SVG
   ======================= */
function downloadSVG(svgEl, filename="pizza.svg") {
  if(!svgEl) return;
  const clone = svgEl.cloneNode(true);

  // Fjern interaktive elementer
  clone.querySelectorAll(".handle, .a11y").forEach(el => el.remove());

  clone.setAttribute("xmlns","http://www.w3.org/2000/svg");
  clone.setAttribute("xmlns:xlink","http://www.w3.org/1999/xlink");

  let [minX,minY,w,h] = (clone.getAttribute("viewBox")||"-210 -210 420 420").trim().split(/\s+/).map(Number);
  clone.setAttribute("width", w);
  clone.setAttribute("height", h);

  const bg = mk("rect", { x: minX, y: minY, width: w, height: h, fill:"#fff" });
  clone.insertBefore(bg, clone.firstChild);

  const styleEl = document.createElementNS("http://www.w3.org/2000/svg","style");
  styleEl.setAttribute("type","text/css");
  styleEl.appendChild(document.createTextNode(EXPORT_SVG_STYLE));
  clone.insertBefore(styleEl, clone.firstChild);

  const xml = new XMLSerializer().serializeToString(clone);
  const file = `<?xml version="1.0" encoding="UTF-8"?>\n` + xml;

  const blob = new Blob([file], {type: "image/svg+xml;charset=utf-8"});
  const url  = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

/* =======================
   Nedlasting: interaktiv SVG
   – brøk OVER, +/− UNDER, pen spacing
   ======================= */
function downloadInteractiveSVG(svgEl, filename="pizza-interaktiv.svg") {
  if(!svgEl) return;
  const clone = svgEl.cloneNode(true);

  clone.setAttribute("xmlns","http://www.w3.org/2000/svg");
  clone.setAttribute("xmlns:xlink","http://www.w3.org/1999/xlink");

  // Utvid viewBox for topp/bunn
  let [minX,minY,w,h] = (clone.getAttribute("viewBox")||"-210 -210 420 420").trim().split(/\s+/).map(Number);
  const M_TOP = 78;
  const M_BOTTOM = 96;
  minY = minY - M_TOP;
  h    = h + M_TOP + M_BOTTOM;
  clone.setAttribute("viewBox", `${minX} ${minY} ${w} ${h}`);
  clone.setAttribute("width", w);
  clone.setAttribute("height", h);

  // Hvit bakgrunn
  const bg = mk("rect", { x: minX, y: minY, width: w, height: h, fill:"#fff" });
  clone.insertBefore(bg, clone.firstChild);

  // Innebygd stil
  const styleEl = document.createElementNS("http://www.w3.org/2000/svg","style");
  styleEl.setAttribute("type","text/css");
  styleEl.appendChild(document.createTextNode(EXPORT_SVG_STYLE));
  clone.insertBefore(styleEl, clone.firstChild);

  // State fra levende instans
  const inst = REG.get(svgEl);
  const textMode = inst?.textMode || "none";
  const nMin = inst?.minN ?? 1;
  const nMax = inst?.maxN ?? 24;

  // n, k, R
  const n = clone.querySelectorAll(".sector").length || 1;
  const k = clone.querySelectorAll(".sector-fill").length || 0;
  const rEl = clone.querySelector("circle.rim");
  const R = rEl ? parseFloat(rEl.getAttribute("r")||"180") : 180;

  // Sørg for at handle vises
  const hndl = clone.querySelector(".handle");
  if(hndl && hndl.parentNode && hndl.parentNode.style) hndl.parentNode.style.display = "";

  // Data for skriptet
  clone.setAttribute("data-n", String(n));
  clone.setAttribute("data-k", String(k));
  clone.setAttribute("data-r", String(R));
  clone.setAttribute("data-textmode", textMode);
  clone.setAttribute("data-nmin", String(nMin));
  clone.setAttribute("data-nmax", String(nMax));

  // Inline-skript (med rettet parentes-feil)
  const scriptCode = `
/*<![CDATA[*/
(function(){
  "use strict";
  var root=document.documentElement, TAU=Math.PI*2;
  function el(n,a){var e=document.createElementNS("http://www.w3.org/2000/svg",n); for(var k in a){e.setAttribute(k,a[k]);} return e;}
  function arc(r,a0,a1){var raw=a1-a0,s=((raw%TAU)+TAU)%TAU,full=Math.abs(s)<1e-6&&Math.abs(raw)>1e-6;
    if(full) return "M "+r+" 0 A "+r+" "+r+" 0 1 1 "+(-r)+" 0 A "+r+" "+r+" 0 1 1 "+r+" 0 Z";
    var sw=1,lg=s>Math.PI?1:0,x0=r*Math.cos(a0),y0=r*Math.sin(a0),x1=r*Math.cos(a1),y1=r*Math.sin(a1);
    return "M 0 0 L "+x0+" "+y0+" A "+r+" "+r+" 0 "+lg+" "+sw+" "+x1+" "+y1+" Z";
  }
  function gcd(a,b){a=Math.abs(a);b=Math.abs(b);while(b){var t=b;b=a%b;a=t;}return a||1;}
  function fmt(x){var s=(Math.round(x*100)/100).toFixed(2);return s.replace(/\\.?0+$/,"");}

  var textMode=root.getAttribute("data-textmode")||"none";
  var nmin=+root.getAttribute("data-nmin")||1, nmax=+root.getAttribute("data-nmax")||24;
  var n=+root.getAttribute("data-n")||10, k=+root.getAttribute("data-k")||0, R=+root.getAttribute("data-r")||180;

  var fill=root.querySelector('[data-role="fill"]')||root.querySelectorAll("g")[0];
  var linesB=root.querySelector('[data-role="linesB"]')||el("g",{}); if(!linesB.parentNode) root.appendChild(linesB);
  var linesW=root.querySelector('[data-role="linesW"]')||el("g",{}); if(!linesW.parentNode) root.appendChild(linesW);
  var handle=root.querySelector(".handle");
  var clipFilled=root.querySelector('clipPath[id$="clipFilled"]');
  var clipEmpty=root.querySelector('clipPath[id$="clipEmpty"]');

  function setHandle(a){ if(!handle){ handle=el("circle",{r:10,"class":"handle"}); root.appendChild(handle); }
    handle.setAttribute("cx",R*Math.cos(a)); handle.setAttribute("cy",R*Math.sin(a)); }

  function rebuildLines(){
    while(linesB.firstChild) linesB.removeChild(linesB.firstChild);
    while(linesW.firstChild) linesW.removeChild(linesW.firstChild);
    var step=TAU/n;
    for(var i=0;i<n;i++){
      var a=i*step, x=R*Math.cos(a), y=R*Math.sin(a);
      var b=el("line",{x1:0,y1:0,x2:x,y2:y,"class":"dash"});
      var w=el("line",{x1:0,y1:0,x2:x,y2:y,"class":"dash"}); w.setAttribute("stroke","#fff");
      linesB.appendChild(b); linesW.appendChild(w);
    }
  }
  function rebuildSectors(){
    while(fill.firstChild) fill.removeChild(fill.firstChild);
    var step=TAU/n;
    for(var i=0;i<n;i++){ var a0=i*step,a1=a0+step,f=i<k;
      fill.appendChild(el("path",{d:arc(R,a0,a1),"class":"sector "+(f?"sector-fill":"sector-empty")}));
    }
    if(clipFilled&&clipEmpty){
      while(clipFilled.firstChild) clipFilled.removeChild(clipFilled.firstChild);
      while(clipEmpty.firstChild)  clipEmpty.removeChild(clipEmpty.firstChild);
      var aEnd=k*step;
      if(k<=0) clipEmpty.appendChild(el("circle",{cx:0,cy:0,r:R}));
      else if(k>=n) clipFilled.appendChild(el("circle",{cx:0,cy:0,r:R}));
      else { clipFilled.appendChild(el("path",{d:arc(R,0,aEnd)})); clipEmpty.appendChild(el("path",{d:arc(R,aEnd,TAU)})); }
      setHandle(aEnd);
    }
  }

  /* ---- TEKST OVER ---- */
  var textLayer=el("g",{id:"textLayer"}); root.appendChild(textLayer);
  var yTop=-R-30; // over sirkelen
  var tMeta=null,tNum=null,tDen=null,tLine=null;
  if(textMode==="percent"||textMode==="decimal"){
    tMeta=el("text",{x:0,y:yTop,"class":"meta"}); textLayer.appendChild(tMeta);
  }else if(textMode==="frac"){
    var HALF=18;        // kortere strek
    tNum =el("text",{x:0,y:yTop-12,"class":"fracNum"});
    tDen =el("text",{x:0,y:yTop+24,"class":"fracDen"});
    tLine=el("line",{x1:-HALF,y1:yTop,x2:HALF,y2:yTop,"class":"fracLine"});
    textLayer.appendChild(tNum); textLayer.appendChild(tLine); textLayer.appendChild(tDen);
  }
  function updateTexts(){
    if(textMode==="percent"&&tMeta){ var p=n?(k/n*100):0; tMeta.textContent=fmt(p)+" %"; }
    else if(textMode==="decimal"&&tMeta){ var d=n?(k/n):0; tMeta.textContent=fmt(d); }
    else if(textMode==="frac"&&tNum&&tDen){ var g=gcd(k,n); tNum.textContent=(k/g).toString(); tDen.textContent=(n/g).toString(); }
  }

  /* ---- KNAPPER UNDER ---- */
  var controls=el("g",{id:"nControls"});
  var BW=46,BH=30,GAP=28;
  var y=R+34;
  var xMinus=-(BW+GAP), xPlus=GAP;
  var btnMinus=el("rect",{x:xMinus,y:y,width:BW,height:BH,rx:8,ry:8,"class":"btn",tabindex:0});
  var btnPlus =el("rect",{x:xPlus ,y:y,width:BW,height:BH,rx:8,ry:8,"class":"btn",tabindex:0});
  var lblMinus=el("text",{x:xMinus+BW/2,y:y+BH/2,"class":"btnLabel"}); lblMinus.textContent="−";
  var lblPlus =el("text",{x:xPlus +BW/2,y:y+BH/2,"class":"btnLabel"});  lblPlus.textContent="+";
  var nValText=el("text",{x:0,y:y+BH/2,"class":"btnLabel"}); nValText.textContent=String(n);
  controls.appendChild(btnMinus); controls.appendChild(btnPlus);
  controls.appendChild(lblMinus); controls.appendChild(lblPlus); controls.appendChild(nValText);
  root.appendChild(controls);

  function setN(nn){
    nn=Math.max(nmin,Math.min(nmax,Math.round(nn)));
    if(nn===n) return;
    n=nn; if(k>n) k=n;
    nValText.textContent=String(n);
    rebuildSectors(); rebuildLines(); updateTexts();
  }

  // Interaksjon for k (teller)
  var dragging=false;
  if(handle){
    handle.setAttribute("tabindex","0");
    handle.addEventListener("pointerdown",function(e){dragging=true;try{handle.setPointerCapture(e.pointerId);}catch(_){}})
    handle.addEventListener("pointerup",function(e){dragging=false;try{handle.releasePointerCapture(e.pointerId);}catch(_){}})
    root.addEventListener("pointerleave",function(){dragging=false;});
    root.addEventListener("pointermove",function(e){
      if(!dragging) return;
      var pt=root.createSVGPoint(); pt.x=e.clientX; pt.y=e.clientY;
      var p=pt.matrixTransform(root.getScreenCTM().inverse());
      var ang=Math.atan2(p.y,p.x); if(ang<0) ang+=TAU;
      var step=TAU/n; k=Math.max(0,Math.min(n,Math.round(ang/step)));
      rebuildSectors(); updateTexts();
    });
    root.addEventListener("click",function(e){
      if(e.target===handle||e.target===btnMinus||e.target===btnPlus) return;
      var pt=root.createSVGPoint(); pt.x=e.clientX; pt.y=e.clientY;
      var p=pt.matrixTransform(root.getScreenCTM().inverse());
      var ang=Math.atan2(p.y,p.x); if(ang<0) ang+=TAU;
      var step=TAU/n; k=Math.max(0,Math.min(n,Math.round(ang/step)));
      rebuildSectors(); updateTexts();
    });
    handle.addEventListener("keydown",function(e){
      var used=false;
      switch(e.key){
        case "ArrowRight": case "ArrowUp":   k=Math.min(n,k+1); used=true; break;
        case "ArrowLeft":  case "ArrowDown": k=Math.max(0,k-1); used=true; break;
        case "Home": k=0; used=true; break;
        case "End":  k=n; used=true; break;
      }
      if(used){ e.preventDefault(); rebuildSectors(); updateTexts(); }
    });
  }
  function clickMinus(){ setN(n-1); }
  function clickPlus(){ setN(n+1); }
  btnMinus.addEventListener("click",clickMinus);
  btnPlus .addEventListener("click",clickPlus);
  btnMinus.addEventListener("keydown",function(e){
    if(e.key==="Enter"||e.key===" "||e.key==="-"||e.key==="ArrowLeft"){e.preventDefault();clickMinus();}
    if(e.key==="PageDown"){e.preventDefault();setN(n-5);}
  });
  btnPlus.addEventListener("keydown",function(e){
    if(e.key==="Enter"||e.key===" "||e.key==="+"||e.key==="ArrowRight"){e.preventDefault();clickPlus();}
    if(e.key==="PageUp"){e.preventDefault();setN(n+5);}
  });

  // Init
  rebuildLines(); rebuildSectors(); updateTexts();
})();
/*]]>*/
  `;

  const scriptEl = document.createElementNS("http://www.w3.org/2000/svg","script");
  scriptEl.setAttribute("type","application/ecmascript");
  scriptEl.appendChild(document.createTextNode(scriptCode));
  clone.appendChild(scriptEl);

  const xml = new XMLSerializer().serializeToString(clone);
  const file = `<?xml version="1.0" encoding="UTF-8"?>\n` + xml;

  const blob = new Blob([file], {type: "image/svg+xml;charset=utf-8"});
  const url  = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

/* =======================
   UI-knapper under hver pizza i appen
   ======================= */
function addDownloadButtons(svgId) {
  const svg = document.getElementById(svgId);
  if(!svg) return;
  const panel = svg.closest(".pizzaPanel") || svg.parentNode;

  const wrap = document.createElement("div");
  wrap.style.display = "flex";
  wrap.style.gap = "8px";
  wrap.style.flexWrap = "wrap";
  wrap.style.alignItems = "center";
  wrap.style.marginTop = "6px";

  const mkBtn = (label)=> {
    const b = document.createElement("button");
    b.type = "button";
    b.textContent = label;
    b.setAttribute("aria-label", label);
    b.style.cssText = "padding:6px 10px;border:1px solid #cfcfcf;border-radius:8px;background:#fff;cursor:pointer;";
    return b;
  };

  const btnStatic = mkBtn("Last ned SVG");
  btnStatic.addEventListener("click", ()=> downloadSVG(svg, svgId + ".svg"));

  const btnInteractive = mkBtn("Last ned interaktiv SVG");
  btnInteractive.addEventListener("click", ()=> downloadInteractiveSVG(svg, svgId + "-interaktiv.svg"));

  wrap.append(btnStatic, btnInteractive);
  panel.appendChild(wrap);
}

/* =======================
   Init
   ======================= */
function initFromHtml(){
  const cfg = readConfigFromHtml();
  SIMPLE.pizzas = cfg.pizzas;
  REG.clear();

  PIZZA_DOM.forEach((map,i)=>{
    const panel=document.getElementById(map.svgId)?.closest(".pizzaPanel");
    if(!panel) return;
    if(PANEL_HTML[i]==null) PANEL_HTML[i]=panel.innerHTML;
    panel.innerHTML = PANEL_HTML[i];
    const pcfg = cfg.pizzas[i];
    panel.style.display = pcfg?.show ? "" : "none";
    if(!pcfg?.show) return;

    const minN=Math.max(1, pcfg.minN ?? 1);
    const maxN=Math.max(minN, pcfg.maksN ?? 24);

    new Pizza({
      ...map,
      n: pcfg.n ?? 1,
      k: Math.min(pcfg.t ?? 0, pcfg.n ?? 1),
      minN, maxN,
      textMode: (pcfg.text ?? "none"),
      lockDenominator: !!pcfg.lockN,
      lockNumerator:   !!pcfg.lockT
    });

    addDownloadButtons(map.svgId);
  });
  scheduleCenterAlign();
}

window.addEventListener("load", ()=>{
  initFromHtml();
  document.getElementById("btnApply")?.addEventListener("click", initFromHtml);
});
