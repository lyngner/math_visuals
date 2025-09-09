/* =========================================================
   Graftegning – Funksjoner (ES5-kompatibel)
   ========================================================= */

var SIMPLE = "f(x)=x^2-2\npoints=0";

var ADV = {
  axis: {
    labels: { x: "x", y: "y" },
    style:  { stroke: "#111827", width: 2 },
    grid:   { majorX: 1, majorY: 1, labelPrecision: 0 }
  },
  screen: null,
  lockAspect: true,
  interactions: {
    pan:  { enabled: false, needShift: false },
    zoom: { enabled: true,  wheel: true, needShift: false, factorX: 1.2, factorY: 1.2 }
  },
  points: {
    start:  [ [2, 3], [-3, 1] ],
    startX: [  1 ],
    showCoordsOnHover: true,
    decimals: 2,
    guideArrows: true,
    snap: { enabled: false, mode: "up", stepX: null, stepY: null }
  },
  curveName: { show: false },
  domainMarkers: { show: true, barPx: 22, tipFrac: 0.20, color: "#6b7280", width: 3, layer: 8 },
  asymptote: { detect: true, showVertical: true, hugeY: 30, trimY: 8 }
};

/* ---------------- Parser / modus ---------------- */
function parseSimple(txt){
  var lines = (txt||"").split("\n");
  var out = { funcs:[], pointsCount:0, startX:[], raw:txt };
  var fnRe = /^([a-zA-Z]\w*)\s*\(\s*x\s*\)\s*=\s*([^,]+?)(?:\s*,\s*x\s*in\s*(.+))?$/i;

  for(var i=0;i<lines.length;i++){
    var L = String(lines[i]).trim();
    if(!L) continue;

    var m = L.match(fnRe);
    if(m){
      var name = m[1], rhs = m[2].trim(), dom=(m[3]||"").trim();
      var domain = null;
      if(dom && !/^r$/i.test(dom)){
        var dm = dom.match(/^\[\s*([+-]?\d*\.?\d+)\s*,\s*([+-]?\d*\.?\d+)\s*\]$/i);
        if(dm) domain = [ +dm[1], +dm[2] ];
      }
      out.funcs.push({ name:name, rhs:rhs, domain:domain });
      continue;
    }
    var pm = L.match(/^points\s*=\s*(\d+)/i);
    if(pm){ out.pointsCount = +pm[1]; continue; }

    var sm = L.match(/^startx\s*=\s*(.+)$/i);
    if(sm){
      out.startX = sm[1].split(",").map(function(s){ return +s.trim(); })
        .filter(function(n){ return isFinite(n); });
      continue;
    }
  }
  return out;
}
var SIMPLE_PARSED = parseSimple(SIMPLE);

var ALLOWED_NAMES = ["sin","cos","tan","asin","acos","atan","sinh","cosh","tanh","log","ln","sqrt","exp","abs","min","max","floor","ceil","round","pow"];
function isExplicitRHS(rhs){
  var s = rhs.toLowerCase();
  ALLOWED_NAMES.forEach(function(k){ s = s.replace(new RegExp("\\b"+k+"\\b","g"), ""); });
  s = s.replace(/\bpi\b/g,"").replace(/\be\b/g,"").replace(/x/g,"");
  s = s.replace(/[0-9.+\-*/^()%\s]/g,"");
  return s.length===0;
}
function decideMode(parsed){
  var hasExplicit = parsed.funcs.some(function(f){ return isExplicitRHS(f.rhs); });
  return hasExplicit ? "functions" : "pointsOnly";
}
var MODE = decideMode(SIMPLE_PARSED);

/* --------- uttrykk → funksjon ---------- */
function parseFunctionSpec(spec){
  var rhs = (spec||"").toString().trim();
  var m = rhs.match(/^([a-zA-Z]\w*)\s*\(\s*x\s*\)\s*=\s*(.+)$/);
  if(m){ rhs = m[2]; }
  rhs = rhs
    .replace(/\^/g,"**")
    .replace(/(\d)([a-zA-Z(])/g,"$1*$2")
    .replace(/([x\)])\(/g,"$1*(")
    .replace(/x(\d)/g,"x*$1")
    .replace(/\bln\(/gi,"log(")
    .replace(/\bpi\b/gi,"PI")
    .replace(/\be\b/gi,"E")
    .replace(/\btau\b/gi,"(2*PI)");
  var fn;
  try{ fn = new Function("x","with(Math){return "+rhs+";}"); }
  catch(_){ fn = function(){ return NaN; }; }
  return fn;
}

/* ------------- Hjelpere ------------- */
function stepX(){ return (ADV.points.snap.stepX!=null ? ADV.points.snap.stepX : +ADV.axis.grid.majorX) || 1; }
function stepY(){ return (ADV.points.snap.stepY!=null ? ADV.points.snap.stepY : +ADV.axis.grid.majorY) || 1; }
function nearestMultiple(val, step){ return Math.round(val/step)*step; }
function decimalsForStep(step){
  if (!isFinite(step) || step<=0) return 0;
  if (Math.abs(step - Math.round(step)) < 1e-12) return 0;
  var s = String(step);
  if (s.indexOf("e")>-1){ var m = Math.abs(Math.log10(step)); return Math.min(6, Math.ceil(m)); }
  return Math.min(6, (s.split(".")[1]||"").length);
}
function toFixedTrim(n, d){ return (+n).toFixed(d).replace(/(\.\d*?)0+$/,"$1").replace(/\.$/,""); }
function fmtSmartVal(val, st){ var m=nearestMultiple(val, st); var digs=decimalsForStep(st); return toFixedTrim(m, digs); }
function fmtCoordsStatic(P){ return "(" + fmtSmartVal(P.X(), stepX()) + ", " + fmtSmartVal(P.Y(), stepY()) + ")"; }
function fmtCoordsDrag(P){ var d=ADV.points.decimals; return "(" + toFixedTrim(P.X(),d) + ", " + toFixedTrim(P.Y(),d) + ")"; }

/* ---------- Autozoom helpers ---------- */
function detectVerticalAsymptotes(fn, A, B, N, huge){
  N = N || 600; huge = (typeof huge==="number")? huge : ADV.asymptote.hugeY;
  var xs=[], ys=[];
  for(var i=0;i<=N;i++){ var x=A+(i*(B-A))/N, y; try{y=fn(x);}catch(_){y=NaN;} xs.push(x); ys.push(y); }
  var cand=[], tol=(B-A)/N*4;
  for(var j=1;j<ys.length;j++){
    var y0=ys[j-1], y1=ys[j];
    var blow0=!isFinite(y0)||Math.abs(y0)>huge;
    var blow1=!isFinite(y1)||Math.abs(y1)>huge;
    if(blow0||blow1) cand.push( (xs[j-1]+xs[j])*0.5 );
  }
  cand.sort(function(a,b){return a-b;});
  var merged=[];
  for(var k=0;k<cand.length;k++){
    if(!merged.length || Math.abs(cand[k]-merged[merged.length-1])>tol) merged.push(cand[k]);
  }
  return merged;
}
function sampleFeatures(fn, a, b){
  var N=800, trim=ADV.asymptote.trimY||8, ys=[], xs=[];
  for(var i=0;i<=N;i++){
    var x=a+(i*(b-a))/N, y;
    try{y=fn(x);}catch(_){y=NaN;}
    xs.push(x); ys.push(isFinite(y)?Math.max(-trim,Math.min(trim,y)):NaN);
  }
  var yvals=ys.filter(function(v){return isFinite(v);}).sort(function(u,v){return u-v;});
  var ymin=-5,ymax=5;
  if(yvals.length){
    ymin=yvals[Math.floor(0.02*(yvals.length-1))];
    ymax=yvals[Math.floor(0.98*(yvals.length-1))];
  }
  return {ymin:ymin,ymax:ymax,vas:detectVerticalAsymptotes(fn,a,b)};
}
function computeAutoSquareFunctions(){
  var funcs=SIMPLE_PARSED.funcs, anyDom=funcs.some(function(f){return !!f.domain;});
  var xmin=-5,xmax=5,ymin=-5,ymax=5, domMin=Infinity, domMax=-Infinity;

  for(var i=0;i<funcs.length;i++){
    var f=funcs[i], fn=parseFunctionSpec(f.name+"(x)="+f.rhs);
    var a=f.domain?f.domain[0]:-5, b=f.domain?f.domain[1]:5;
    var F=sampleFeatures(fn,a,b);
    if(f.domain){ domMin=Math.min(domMin,a); domMax=Math.max(domMax,b); }
    ymin=Math.min(ymin,F.ymin); ymax=Math.max(ymax,F.ymax);
    if(F.vas && F.vas.length){ xmin=Math.min(xmin,F.vas[0]); xmax=Math.max(xmax,F.vas[F.vas.length-1]); }
  }
  if(anyDom){ xmin=domMin; xmax=domMax; }
  xmin=Math.min(xmin,0); xmax=Math.max(xmax,0);
  ymin=Math.min(ymin,0); ymax=Math.max(ymax,0);
  var padX=0.08*(xmax-xmin||10), padY=0.08*(ymax-ymin||10);
  xmin-=padX; xmax+=padX; ymin-=padY; ymax+=padY;
  var cx=(xmin+xmax)/2, cy=(ymin+ymax)/2, span=Math.max(xmax-xmin,ymax-ymin), half=span/2;
  return [cx-half, cx+half, cy-half, cy+half];
}
function computeAutoSquarePoints(){
  var pts=ADV.points.start.slice(0,2), xs=[pts[0][0],pts[1][0]], ys=[pts[0][1],pts[1][1]];
  var xmin=Math.min(-5, xs[0], xs[1]), xmax=Math.max(5, xs[0], xs[1]);
  var ymin=Math.min(-5, ys[0], ys[1]), ymax=Math.max(5, ys[0], ys[1]);
  xmin=Math.min(xmin,0); xmax=Math.max(xmax,0); ymin=Math.min(ymin,0); ymax=Math.max(ymax,0);
  var cx=(xmin+xmax)/2, cy=(ymin+ymax)/2, span=Math.max(xmax-xmin,ymax-ymin,10), half=span/2*1.1;
  return [cx-half, cx+half, cy-half, cy+half];
}
function toBB(scr){ return [scr[0], scr[3], scr[1], scr[2]]; }

/* ------------- Init board ------------- */
JXG.Options.showCopyright=false;
JXG.Options.showNavigation=false;

var START_SCREEN =
  (ADV.screen!=null ? ADV.screen
   : (MODE==='functions' ? computeAutoSquareFunctions() : computeAutoSquarePoints()));

var brd = JXG.JSXGraph.initBoard("board",{
  boundingbox: toBB(START_SCREEN),
  axis: true, grid:false, showNavigation:false, showCopyright:false,
  pan:{enabled:ADV.interactions.pan.enabled,needShift:false},
  zoom:{enabled:ADV.interactions.zoom.enabled,wheel:true,needShift:false,
        factorX:ADV.interactions.zoom.factorX,factorY:ADV.interactions.zoom.factorY}
});

/* Akser */
["x","y"].forEach(function(ax){
  brd.defaultAxes[ax].setAttribute({
    withLabel:false, strokeColor:ADV.axis.style.stroke, strokeWidth:ADV.axis.style.width,
    firstArrow:false, lastArrow:true
  });
});
var axX=brd.defaultAxes.x, axY=brd.defaultAxes.y;

var xName=null, yName=null;
function placeAxisNames(){
  var bb=brd.getBoundingBox(), xmin=bb[0], ymax=bb[1], xmax=bb[2], ymin=bb[3];
  var rx=xmax-xmin, ry=ymax-ymin, off=0.02;
  if(!xName){
    xName = brd.create("text",[0,0,function(){return ADV.axis.labels.x||"x";}],
      {anchorX:"right",anchorY:"bottom",fixed:true,fontSize:16,layer:40,
       color:ADV.axis.style.stroke, cssStyle:"pointer-events:none;user-select:none;"});
  }
  if(!yName){
    yName = brd.create("text",[0,0,function(){return ADV.axis.labels.y||"y";}],
      {anchorX:"left",anchorY:"top",fixed:true,fontSize:16,layer:40,
       color:ADV.axis.style.stroke, cssStyle:"pointer-events:none;user-select:none;"});
  }
  xName.moveTo([xmax-off*rx, 0+off*ry]);
  yName.moveTo([0+off*rx, ymax-off*ry]);
}
placeAxisNames();

/* Grid + 1:1 */
var gridV=[],gridH=[];
function shouldLockAspect(){
  if(ADV.lockAspect===true) return true;
  return Math.abs(+ADV.axis.grid.majorX-(+ADV.axis.grid.majorY))<1e-12;
}
var enforcing=false;
function enforceAspectStrict(){
  if(!shouldLockAspect() || enforcing) return;
  enforcing=true;
  try{
    var bb=brd.getBoundingBox();
    var W=bb[2]-bb[0], H=bb[1]-bb[3];
    var pixAR=brd.canvasWidth/brd.canvasHeight, worldAR=W/H;
    if(Math.abs(worldAR-pixAR)<1e-9) return;
    var newW=W,newH=H;
    if(worldAR>pixAR){ newH=W/pixAR; } else { newW=H*pixAR; }
    var cx=(bb[0]+bb[2])/2, cy=(bb[1]+bb[3])/2;
    brd.setBoundingBox([cx-newW/2, cy+newH/2, cx+newW/2, cy-newH/2], false);
  } finally { enforcing=false; }
}
function rebuildGrid(){
  gridV.forEach(function(L){ brd.removeObject(L);});
  gridH.forEach(function(L){ brd.removeObject(L);});
  gridV=[]; gridH=[];
  enforceAspectStrict();
  var bb=brd.getBoundingBox(), xmin=bb[0],ymax=bb[1],xmax=bb[2],ymin=bb[3];
  var sx=(+ADV.axis.grid.majorX>1e-9?+ADV.axis.grid.majorX:1);
  var sy=(+ADV.axis.grid.majorY>1e-9?+ADV.axis.grid.majorY:1);
  var x0=Math.ceil(xmin/sx)*sx, y0=Math.ceil(ymin/sy)*sy;
  var attrs={straightFirst:false,straightLast:false,strokeColor:"#e5e7eb",strokeWidth:1,fixed:true,layer:0,highlight:false,cssStyle:"pointer-events:none;"};
  for(var x=x0;x<=xmax+1e-9;x+=sx) gridV.push(brd.create("line", [[x,ymin],[x,ymax]], attrs));
  for(var y=y0;y<=ymax+1e-9;y+=sy) gridH.push(brd.create("line", [[xmin,y],[xmax,y]], attrs));
}
rebuildGrid();

/* ---------- Funksjoner ---------- */
var graphs=[];
function colorFor(i){ var def=["#9333ea","#475569","#ef4444","#0ea5e9","#10b981","#f59e0b"]; return def[i%def.length]; }
function removeSegments(g){ if(g.segs){ g.segs.forEach(function(s){ brd.removeObject(s);}); g.segs=[]; } }
function rebuildFunctionSegmentsFor(g){
  var bb=brd.getBoundingBox(), L=bb[0], R=bb[2];
  if(g.domain && g.domain.length===2){ L=Math.max(L,g.domain[0]); R=Math.min(R,g.domain[1]); }
  if(!(R>L)) return;
  removeSegments(g);
  var vas=ADV.asymptote.detect && ADV.asymptote.showVertical ? detectVerticalAsymptotes(g.fn,L,R,800,ADV.asymptote.hugeY) : [];
  var xs=[L].concat(vas.filter(function(x){return x>L && x<R;})).concat([R]).sort(function(a,b){return a-b;});
  var eps=(R-L)*1e-6;
  function safe(x){ var y; try{y=g.fn(x);}catch(_){y=NaN;} return isFinite(y)?y:NaN; }
  g.segs=[];
  for(var i=0;i<xs.length-1;i++){
    var a=xs[i], b=xs[i+1], leftOpen=(i>0), rightOpen=(i<xs.length-2);
    if(leftOpen) a+=eps; if(rightOpen) b-=eps; if(b<=a) continue;
    g.segs.push( brd.create("functiongraph",[safe, function(){return a;}, function(){return b;}],
      {strokeColor:g.color, strokeWidth:4,fixed:true,highlight:false}) );
  }
}
function updateAllBrackets(){
  graphs.forEach(function(g){
    if(!g.domain || !ADV.domainMarkers.show) return;
    if(g._ba){ g._ba.forEach(function(o){brd.removeObject(o);}); }
    var bb=brd.getBoundingBox(), ymin=bb[3], ymax=bb[1];
    var style={strokeColor:ADV.domainMarkers.color, strokeWidth:ADV.domainMarkers.width,fixed:true,highlight:false,layer:ADV.domainMarkers.layer};
    g._ba=[
      brd.create("segment", [ [g.domain[0],(ymin+ymax)/2-0.6], [g.domain[0],(ymin+ymax)/2+0.6] ], style),
      brd.create("segment", [ [g.domain[1],(ymin+ymax)/2-0.6], [g.domain[1],(ymin+ymax)/2+0.6] ], style)
    ];
  });
}
function buildFunctions(){
  SIMPLE_PARSED.funcs.forEach(function(f,i){
    var color=colorFor(i);
    var fn=parseFunctionSpec(f.name+"(x)="+f.rhs);
    var g={ name:f.name, color:color, domain:f.domain||null };
    g.fn=function(x){ var y; try{y=fn(x);}catch(_){y=NaN;} return isFinite(y)?y:NaN; };
    g.segs=[];
    var xMinCarrier = g.domain ? g.domain[0] : function(){return brd.getBoundingBox()[0];};
    var xMaxCarrier = g.domain ? g.domain[1] : function(){return brd.getBoundingBox()[2];};
    g.carrier = brd.create("functiongraph",[g.fn, xMinCarrier, xMaxCarrier], {visible:false, strokeOpacity:0, fixed:true});
    graphs.push(g);
  });
  graphs.forEach(rebuildFunctionSegmentsFor);
  updateAllBrackets();

  // Glidere på første funksjon (naturlig glide – snap kun på 'up')
  var n = SIMPLE_PARSED.pointsCount|0;
  if(n>0 && graphs.length>0){
    var G=graphs[0];
    var sxList=(SIMPLE_PARSED.startX&&SIMPLE_PARSED.startX.length>0)?SIMPLE_PARSED.startX:(ADV.points.startX&&ADV.points.startX.length>0?ADV.points.startX:[0]);
    function clampToDomain(x){ return G.domain ? Math.min(G.domain[1], Math.max(G.domain[0], x)) : x; }
    function applySnap(P){
      var xs = clampToDomain(nearestMultiple(P.X(), stepX()));
      P.moveTo([xs, G.fn(xs)]);
    }

    for(var i=0;i<n;i++){
      var xi = sxList[i]!=null ? clampToDomain(sxList[i]) : clampToDomain(sxList[0]);
      (function(){
        var P=brd.create("glider",[xi,G.fn(xi),G.carrier], {name:"",withLabel:true,face:"o",size:3,strokeColor:G.color,fillColor:"#fff",showInfobox:false});

        // Ikke tving P under drag – glideren følger carrier selv.
        if(ADV.points.showCoordsOnHover){
          P.label.setAttribute({visible:false});
          P.on("over", function(){ P.label.setText(function(){return fmtCoordsStatic(P);}); P.label.setAttribute({visible:true}); });
          P.on("drag", function(){ P.label.setText(function(){return fmtCoordsDrag(P);}); P.label.setAttribute({visible:true}); });
          P.on("up",   function(){ P.label.setText(function(){return fmtCoordsStatic(P);}); });
          P.on("out",  function(){ P.label.setAttribute({visible:false}); });
        }
        if(ADV.points.snap.enabled && (ADV.points.snap.mode||"up")==="up"){
          P.on("up", function(){ applySnap(P); });
        }
        if(ADV.points.guideArrows){
          brd.create("arrow",[function(){return [P.X(),P.Y()];},function(){return [0,P.Y()];}],
            { strokeColor:"#64748b", strokeWidth:2, dash:2, lastArrow:true, firstArrow:false, fixed:true, layer:10, highlight:false });
          brd.create("arrow",[function(){return [P.X(),P.Y()];},function(){return [P.X(),0];}],
            { strokeColor:"#64748b", strokeWidth:2, dash:2, lastArrow:true, firstArrow:false, fixed:true, layer:10, highlight:false });
        }
      })();
    }
  }
}

/* ---------- Punkter-modus ---------- */
function makeGuideArrowsForPoint(P){
  if(!ADV.points.guideArrows) return;
  brd.create("arrow",[function(){return [P.X(),P.Y()];},function(){return [0,P.Y()];}],
    { strokeColor:"#64748b", strokeWidth:2, dash:2, lastArrow:true, firstArrow:false, fixed:true, layer:10, highlight:false });
  brd.create("arrow",[function(){return [P.X(),P.Y()];},function(){return [P.X(),0];}],
    { strokeColor:"#64748b", strokeWidth:2, dash:2, lastArrow:true, firstArrow:false, fixed:true, layer:10, highlight:false });
}
function buildPointsOnly(){
  var count = SIMPLE_PARSED.pointsCount|0;
  if(count<=0) return;

  var starts = ADV.points.start.slice(0, Math.max(1, count));
  while(starts.length<count){ starts.push([0,0]); }

  var pts=[];
  for(var i=0;i<count;i++){
    (function(i){
      var P=brd.create("point", starts[i].slice(), {name:"",size:3,face:"o",fillColor:"#fff",strokeColor:"#9333ea",withLabel:true,showInfobox:false});
      if(ADV.points.snap.enabled){
        var sx=stepX(), sy=stepY();
        var snap=function(){ P.moveTo([nearestMultiple(P.X(),sx), nearestMultiple(P.Y(),sy)]); };
        if((ADV.points.snap.mode||"up")==="drag"){ P.on("drag", snap); } else { P.on("up", snap); }
      }
      if(ADV.points.showCoordsOnHover){
        P.label.setAttribute({visible:false});
        P.on("over", function(){ P.label.setText(function(){return fmtCoordsStatic(P);}); P.label.setAttribute({visible:true}); });
        P.on("drag", function(){ P.label.setText(function(){return fmtCoordsDrag(P);}); P.label.setAttribute({visible:true}); });
        P.on("up",   function(){ P.label.setText(function(){return fmtCoordsStatic(P);}); });
        P.on("out",  function(){ P.label.setAttribute({visible:false}); });
      }
      makeGuideArrowsForPoint(P);
      pts.push(P);
    })(i);
  }
  if(pts.length===2){ brd.create("line",[pts[0], pts[1]], {strokeColor:"#9333ea", strokeWidth:4}); }
}

/* ---------- View updates ---------- */
function updateAfterViewChange(){
  enforceAspectStrict();
  rebuildGrid();
  axX.defaultTicks.setAttribute({ ticksDistance:+ADV.axis.grid.majorX||1, minorTicks:0, precision:ADV.axis.grid.labelPrecision });
  axY.defaultTicks.setAttribute({ ticksDistance:+ADV.axis.grid.majorY||1, minorTicks:0, precision:ADV.axis.grid.labelPrecision });
  placeAxisNames();
  graphs.forEach(rebuildFunctionSegmentsFor);
  updateAllBrackets();
}
brd.on("boundingbox", updateAfterViewChange);
window.addEventListener("resize", function(){ JXG.JSXGraph.resizeBoards(); updateAfterViewChange(); });

/* ---------- Reset & SVG ---------- */
document.getElementById("btnReset").addEventListener("click", function(){
  var scr = ADV.screen!=null ? ADV.screen : (MODE==="functions"?computeAutoSquareFunctions():computeAutoSquarePoints());
  brd.setBoundingBox(toBB(scr), true);
  updateAfterViewChange();
});
document.getElementById("btnSvg").addEventListener("click", function(){
  var src=brd.renderer.svgRoot.cloneNode(true);
  src.removeAttribute("style");
  var w=brd.canvasWidth,h=brd.canvasHeight;
  src.setAttribute("width",  String(w));
  src.setAttribute("height", String(h));
  src.setAttribute("viewBox","0 0 "+w+" "+h);
  src.setAttribute("xmlns","http://www.w3.org/2000/svg");
  src.setAttribute("xmlns:xlink","http://www.w3.org/1999/xlink");
  var xml=new XMLSerializer().serializeToString(src).replace(/\swidth="[^"]*"\s(?=.*width=")/," ").replace(/\sheight="[^"]*"\s(?=.*height=")/," ");
  var blob=new Blob([xml],{type:"image/svg+xml;charset=utf-8"});
  var a=document.createElement("a"); a.href=URL.createObjectURL(blob); a.download="graf.svg"; a.click(); URL.revokeObjectURL(a.href);
});

/* ---------- UI → SIMPLE ---------- */
function parseDomainInput(s){
  var t = String(s||"").trim();
  if(t==="" || /^r$/i.test(t)) return null;           // tom/R ⇒ R
  var m = t.match(/^\[\s*([+-]?\d*\.?\d+)\s*,\s*([+-]?\d*\.?\d+)\s*\]$/);
  if(m) return [ +m[1], +m[2] ];
  return null;
}
function parseScreenInput(s){
  var t=String(s||"").trim(); if(!t) return null;
  // Allow both "[a,b,c,d]" and "a,b,c,d" syntaxes
  var m=t.match(/^\[?\s*([+-]?\d*\.?\d+)\s*,\s*([+-]?\d*\.?\d+)\s*,\s*([+-]?\d*\.?\d+)\s*,\s*([+-]?\d*\.?\d+)\s*\]?$/);
  if(!m) return null; return [ +m[1], +m[2], +m[3], +m[4] ];
}
function readUIOverrides(){
  var fn1 = document.getElementById("fn1").value.trim();
  var dom1 = parseDomainInput(document.getElementById("dom1").value);
  var fn2 = document.getElementById("fn2").value.trim();
  var dom2 = parseDomainInput(document.getElementById("dom2").value);
  var screen = parseScreenInput(document.getElementById("screen").value);
  var pointsCount = +document.getElementById("pointsCount").value;
  ADV.interactions.pan.enabled = document.getElementById("panEnabled").checked;

  ADV.axis.labels.x = (document.getElementById("axisXLabel").value.trim() || "x");
  ADV.axis.labels.y = (document.getElementById("axisYLabel").value.trim() || "y");

  ADV.screen = screen || null;

  var lines=[];
  if(fn1){
    if(!/^[a-zA-Z]\w*\s*\(\s*x\s*\)\s*=/.test(fn1)) fn1="f(x)="+fn1;
    lines.push( fn1 + (dom1?(", x in ["+dom1[0]+", "+dom1[1]+"]"):"") );
  }
  if(fn2){
    if(!/^[a-zA-Z]\w*\s*\(\s*x\s*\)\s*=/.test(fn2)) fn2="g(x)="+fn2;
    lines.push( fn2 + (dom2?(", x in ["+dom2[0]+", "+dom2[1]+"]"):"") );
  }
  lines.push("points="+pointsCount);

  SIMPLE = lines.join("\n");
  SIMPLE_PARSED = parseSimple(SIMPLE);
  MODE = decideMode(SIMPLE_PARSED);
}

/* ---------- Oppdater graf ved endringer ---------- */
function rebuildBoard(){
  readUIOverrides();

  JXG.JSXGraph.freeBoard(brd);
  graphs = [];
  START_SCREEN = (ADV.screen!=null ? ADV.screen
                  : (MODE === "functions" ? computeAutoSquareFunctions() : computeAutoSquarePoints()));
  brd = JXG.JSXGraph.initBoard("board", {
    boundingbox: toBB(START_SCREEN),
    axis: true, grid: false, showNavigation: false, showCopyright: false,
    pan: { enabled: ADV.interactions.pan.enabled, needShift: false },
    zoom: { enabled: ADV.interactions.zoom.enabled, wheel: true, needShift: false,
            factorX: ADV.interactions.zoom.factorX, factorY: ADV.interactions.zoom.factorY }
  });
  ["x", "y"].forEach(function(ax){
    brd.defaultAxes[ax].setAttribute({
      withLabel: false, strokeColor: ADV.axis.style.stroke, strokeWidth: ADV.axis.style.width,
      firstArrow: false, lastArrow: true
    });
  });
  axX = brd.defaultAxes.x; axY = brd.defaultAxes.y;
  // When reinitializing the board the previous text objects are destroyed.
  // Reset the references so new axis labels are created for the fresh board.
  xName = null;
  yName = null;
  placeAxisNames();
  axX.defaultTicks.setAttribute({drawLabels:true, precision:ADV.axis.grid.labelPrecision, ticksDistance:+ADV.axis.grid.majorX||1, minorTicks:0, label:{anchorX:"middle", anchorY:"top", offset:[0,-8]}});
  axY.defaultTicks.setAttribute({drawLabels:true, precision:ADV.axis.grid.labelPrecision, ticksDistance:+ADV.axis.grid.majorY||1, minorTicks:0, label:{anchorX:"right", anchorY:"middle", offset:[-8,0]}});
  rebuildGrid();

  if(MODE === "functions"){ buildFunctions(); } else { buildPointsOnly(); }
  brd.on("boundingbox", updateAfterViewChange);
}

/* Lytt på alle innstillinger */
Array.prototype.forEach.call(
  document.querySelectorAll('#uiOverrides input, #uiOverrides select'),
  function(el){
    var ev = el.tagName.toLowerCase() === 'select' ? 'change' : 'input';
    el.addEventListener(ev, rebuildBoard);
  }
);

/* Første init */
(function firstRun(){
  readUIOverrides();
  placeAxisNames();
  if(MODE==="functions"){ buildFunctions(); } else { buildPointsOnly(); }
})();
