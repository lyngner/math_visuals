/* =======================
   KONFIG FRA HTML
   ======================= */
const SIMPLE = {
  pizzas: [],
  ops: []
};
if (typeof window !== 'undefined') window.SIMPLE = SIMPLE;
const PANEL_HTML = [];
function readConfigFromHtml() {
  const pizzas = [];
  for (let i = 1; i <= 3; i++) {
    var _document$getElementB, _document$getElementB2, _document$getElementB3, _document$getElementB4, _document$getElementB5, _document$getElementB6, _document$getElementB7, _document$getElementB8, _document$getElementB9, _document$getElementB0, _document$getElementB1, _document$getElementB10;
    const t = parseInt((_document$getElementB = document.getElementById(`p${i}T`)) === null || _document$getElementB === void 0 ? void 0 : _document$getElementB.value, 10);
    const n = parseInt((_document$getElementB2 = document.getElementById(`p${i}N`)) === null || _document$getElementB2 === void 0 ? void 0 : _document$getElementB2.value, 10);
    const lockN = (_document$getElementB3 = (_document$getElementB4 = document.getElementById(`p${i}LockN`)) === null || _document$getElementB4 === void 0 ? void 0 : _document$getElementB4.checked) !== null && _document$getElementB3 !== void 0 ? _document$getElementB3 : false;
    const lockT = (_document$getElementB5 = (_document$getElementB6 = document.getElementById(`p${i}LockT`)) === null || _document$getElementB6 === void 0 ? void 0 : _document$getElementB6.checked) !== null && _document$getElementB5 !== void 0 ? _document$getElementB5 : false;
    const text = (_document$getElementB7 = (_document$getElementB8 = document.getElementById(`p${i}Text`)) === null || _document$getElementB8 === void 0 ? void 0 : _document$getElementB8.value) !== null && _document$getElementB7 !== void 0 ? _document$getElementB7 : "none";
    const minN = parseInt((_document$getElementB9 = document.getElementById(`p${i}MinN`)) === null || _document$getElementB9 === void 0 ? void 0 : _document$getElementB9.value, 10);
    const maxN = parseInt((_document$getElementB0 = document.getElementById(`p${i}MaxN`)) === null || _document$getElementB0 === void 0 ? void 0 : _document$getElementB0.value, 10);
    const hideNVal = (_document$getElementB1 = (_document$getElementB10 = document.getElementById(`p${i}HideNVal`)) === null || _document$getElementB10 === void 0 ? void 0 : _document$getElementB10.checked) !== null && _document$getElementB1 !== void 0 ? _document$getElementB1 : false;
    pizzas.push({
      t: isFinite(t) ? t : 0,
      n: isFinite(n) ? n : 1,
      lockN,
      lockT,
      text,
      hideNVal,
      minN: isFinite(minN) ? minN : 1,
      maksN: isFinite(maxN) ? maxN : 24
    });
  }
  const ops = [];
  for (let i = 1; i <= 2; i++) {
    const rightPanel = document.getElementById(`panel${i + 1}`);
    const hasRightPizza = !!(rightPanel && rightPanel.style.display !== "none");
    const select = document.getElementById(`op${i}`);
    let op = "";
    if (hasRightPizza) {
      op = (select === null || select === void 0 ? void 0 : select.value) || "";
    } else if (select) {
      select.value = "";
    }
    ops.push(op);
  }
  return {
    pizzas,
    ops
  };
}

/* =======================
   Grunnoppsett
   ======================= */
const PIZZA_DEFAULTS = {
  minN: 1,
  maxN: 24,
  R: 180,
  stepN: 1,
  stepK: 1,
  metaMode: "none",
  lockDenominator: false,
  lockNumerator: false,
  showDenominatorValue: true
};
const PIZZA_DOM = [{
  svgId: "pizza1",
  fracId: "frac1",
  minusId: "nMinus1",
  plusId: "nPlus1",
  valId: "nVal1",
  index: 0
}, {
  svgId: "pizza2",
  fracId: "frac2",
  minusId: "nMinus2",
  plusId: "nPlus2",
  valId: "nVal2",
  index: 1
}, {
  svgId: "pizza3",
  fracId: "frac3",
  minusId: "nMinus3",
  plusId: "nPlus3",
  valId: "nVal3",
  index: 2
}];
const TAU = Math.PI * 2;
const norm = a => (a % TAU + TAU) % TAU;
const mk = (n, a = {}) => {
  const e = document.createElementNS("http://www.w3.org/2000/svg", n);
  for (const [k, v] of Object.entries(a)) e.setAttribute(k, v);
  return e;
};
const arcPath = (r, a0, a1) => {
  const raw = a1 - a0,
    span = (raw % TAU + TAU) % TAU,
    isFull = Math.abs(span) < 1e-6 && Math.abs(raw) > 1e-6;
  if (isFull) return `M ${r} 0 A ${r} ${r} 0 1 1 ${-r} 0 A ${r} ${r} 0 1 1 ${r} 0 Z`;
  const sweep = 1,
    large = span > Math.PI ? 1 : 0,
    x0 = r * Math.cos(a0),
    y0 = r * Math.sin(a0),
    x1 = r * Math.cos(a1),
    y1 = r * Math.sin(a1);
  return `M 0 0 L ${x0} ${y0} A ${r} ${r} 0 ${large} ${sweep} ${x1} ${y1} Z`;
};
const gcd = (a, b) => {
  a = Math.abs(a);
  b = Math.abs(b);
  while (b) {
    const t = b;
    b = a % b;
    a = t;
  }
  return a || 1;
};
const fmt = x => {
  const s = (Math.round(x * 100) / 100).toFixed(2);
  return s.replace(/\.?0+$/, "");
};

/* ==== Senter-justering: sirklene på LINJE ==== */
let _centerRaf = 0;
function alignPanelsByCenter() {
  const panels = [...document.querySelectorAll(".pizzaPanel")].filter(p => p.offsetParent !== null);
  if (!panels.length) return;
  const items = panels.map(p => {
    const header = p.querySelector(".panelHeader");
    const svg = p.querySelector("svg.pizza");
    if (!header || !svg) return null;
    header.style.height = "auto";
    const baseHeader = header.getBoundingClientRect().height;
    const svgH = svg.getBoundingClientRect().height;
    return {
      header,
      baseHeader,
      svgH
    };
  }).filter(Boolean);
  if (!items.length) return;
  const maxCenter = Math.max(...items.map(it => it.baseHeader + it.svgH / 2));
  items.forEach(it => {
    const targetHeader = Math.max(0, maxCenter - it.svgH / 2);
    const finalHeader = Math.max(targetHeader, it.baseHeader);
    it.header.style.height = finalHeader + "px";
  });
}
function scheduleCenterAlign() {
  cancelAnimationFrame(_centerRaf);
  _centerRaf = requestAnimationFrame(alignPanelsByCenter);
}
window.addEventListener("resize", scheduleCenterAlign);
function fitPizzasToLine() {
  const container = document.querySelector(".grid2");
  if (!container) return;
  const panels = [...container.querySelectorAll(".pizzaPanel")].filter(p => p.style.display !== "none");
  if (!panels.length) return;
  const ops = [...container.querySelectorAll(".opDisplay")].filter(op => op.style.display !== "none");
  const addBtn = document.getElementById("addPizza");
  const extras = [...ops];
  if (addBtn && addBtn.style.display !== "none") extras.push(addBtn);
  const parent = container.parentElement;
  let availWidth = container.clientWidth;
  if (parent) {
    const parentStyles = getComputedStyle(parent);
    const padL = parseFloat(parentStyles.paddingLeft || "0") || 0;
    const padR = parseFloat(parentStyles.paddingRight || "0") || 0;
    const parentInner = (parent.clientWidth || 0) - padL - padR;
    if (Number.isFinite(parentInner) && parentInner > 0 && (!availWidth || parentInner < availWidth)) {
      availWidth = parentInner;
    }
  }
  if (!availWidth || !Number.isFinite(availWidth) || availWidth <= 0) {
    availWidth = container.getBoundingClientRect().width;
  }
  if (!availWidth || !Number.isFinite(availWidth)) return;
  const extrasWidth = extras.reduce((sum, el) => sum + el.getBoundingClientRect().width, 0);
  const cs = getComputedStyle(container);
  const gap = parseFloat(cs.columnGap || cs.gap || "0");
  const totalItems = panels.length + extras.length;
  const totalGap = gap * Math.max(0, totalItems - 1);
  let computed = (availWidth - extrasWidth - totalGap) / panels.length;
  if (!Number.isFinite(computed)) computed = container.clientWidth;
  const MIN = 160;
  const MAX = 420;
  computed = Math.min(MAX, Math.max(MIN, computed));
  container.style.setProperty("--panel-min", `${computed}px`);
  panels.forEach(panel => {
    const svg = panel.querySelector("svg.pizza");
    if (svg) svg.style.width = "100%";
  });
}
window.addEventListener("resize", fitPizzasToLine);
function hidePizzaPanel(index) {
  const panel = document.getElementById(`panel${index}`);
  if (panel) panel.style.display = "none";
  const fieldset = document.getElementById(`fieldset${index}`);
  if (fieldset) fieldset.style.display = "none";
}
function setupRemovePizzaButtons() {
  const addBtn = document.getElementById('addPizza');
  const remove2 = document.getElementById('removePizza2');
  if (remove2 && !remove2.dataset.bound) {
    remove2.dataset.bound = 'true';
    remove2.addEventListener('click', () => {
      hidePizzaPanel(3);
      hidePizzaPanel(2);
      if (addBtn) addBtn.style.display = '';
      initFromHtml();
    });
  }
  const remove3 = document.getElementById('removePizza3');
  if (remove3 && !remove3.dataset.bound) {
    remove3.dataset.bound = 'true';
    remove3.addEventListener('click', () => {
      hidePizzaPanel(3);
      if (addBtn) addBtn.style.display = '';
      initFromHtml();
    });
  }
}

/* =======================
   Pizza-klasse
   ======================= */
const REG = new Map(); // svgEl -> Pizza-instans (til eksport)
class Pizza {
  constructor(opts) {
    var _cfg$minN, _cfg$maxN, _cfg$n, _cfg$k, _cfg$R, _cfg$textMode, _this$fracBox, _this$fracBox2, _this$nMinus, _this$nMinus2, _this$nPlus;
    const cfg = {
      ...PIZZA_DEFAULTS,
      ...opts
    };
    this.cfg = cfg;
    this.index = typeof cfg.index === "number" ? cfg.index : null;
    this.minN = Math.max(1, (_cfg$minN = cfg.minN) !== null && _cfg$minN !== void 0 ? _cfg$minN : 1);
    this.maxN = Math.max(this.minN, (_cfg$maxN = cfg.maxN) !== null && _cfg$maxN !== void 0 ? _cfg$maxN : 24);
    this.n = Math.min(Math.max((_cfg$n = cfg.n) !== null && _cfg$n !== void 0 ? _cfg$n : 6, this.minN), this.maxN);
    this.k = Math.min((_cfg$k = cfg.k) !== null && _cfg$k !== void 0 ? _cfg$k : 0, this.n);
    this.R = (_cfg$R = cfg.R) !== null && _cfg$R !== void 0 ? _cfg$R : 180;
    this.theta = this.k / this.n * TAU;
    this.textMode = (_cfg$textMode = cfg.textMode) !== null && _cfg$textMode !== void 0 ? _cfg$textMode : "none"; // "none" | "frac" | "percent" | "decimal"

    this.svg = document.getElementById(cfg.svgId);
    this.nMinus = document.getElementById(cfg.minusId);
    this.nPlus = document.getElementById(cfg.plusId);
    this.nVal = document.getElementById(cfg.valId);
    this.showDenominatorValue = cfg.showDenominatorValue !== false;
    this.fracBox = document.getElementById(cfg.fracId);
    this.fracNum = ((_this$fracBox = this.fracBox) === null || _this$fracBox === void 0 ? void 0 : _this$fracBox.querySelector(".num")) || null;
    this.fracDen = ((_this$fracBox2 = this.fracBox) === null || _this$fracBox2 === void 0 ? void 0 : _this$fracBox2.querySelector(".den")) || null;
    if (!this.svg) throw new Error(`Mangler SVG med id="${cfg.svgId}"`);
    if (this.nVal && !this.showDenominatorValue) this.nVal.style.display = "none";

    // Header-slot (over SVG)
    this.header = document.createElement("div");
    this.header.className = "panelHeader";
    this.svg.parentNode.insertBefore(this.header, this.svg);
    if (this.fracBox) {
      this.header.appendChild(this.fracBox);
      this.fracBox.style.display = this.textMode === "frac" ? "" : "none";
    }
    if (this.textMode === "percent" || this.textMode === "decimal") {
      this.metaLine = document.createElement("div");
      this.metaLine.style.fontSize = "28px";
      this.metaLine.style.lineHeight = "1";
      this.metaLine.style.opacity = "0.9";
      this.metaLine.style.margin = "0 0 6px 0";
      this.header.appendChild(this.metaLine);
    }

    // Lag i SVG
    this.gFill = mk("g");
    this.gLinesBlack = mk("g");
    this.gRim = mk("g");
    this.defs = mk("defs");
    this.gLinesWhite = mk("g");
    this.gA11y = mk("g");
    this.gHandle = mk("g");
    this.gFill.setAttribute("data-role", "fill");
    this.gLinesBlack.setAttribute("data-role", "linesB");
    this.gLinesWhite.setAttribute("data-role", "linesW");
    this.svg.append(this.gFill, this.gLinesBlack, this.gRim, this.defs, this.gLinesWhite, this.gA11y, this.gHandle);
    this.gRim.appendChild(mk("circle", {
      cx: 0,
      cy: 0,
      r: this.R,
      class: "rim"
    }));
    this.clipFilledId = `${cfg.svgId}-clipFilled`;
    this.clipEmptyId = `${cfg.svgId}-clipEmpty`;
    this.clipFilled = mk("clipPath", {
      id: this.clipFilledId
    });
    this.clipEmpty = mk("clipPath", {
      id: this.clipEmptyId
    });
    this.defs.append(this.clipFilled, this.clipEmpty);
    this.gLinesWhite.setAttribute("clip-path", `url(#${this.clipFilledId})`);
    this.gLinesBlack.setAttribute("clip-path", `url(#${this.clipEmptyId})`);

    // Handle + a11y
    this.handle = mk("circle", {
      r: 10,
      class: "handle",
      tabindex: -1
    });
    this.gHandle.appendChild(this.handle);
    this.slider = mk("circle", {
      cx: 0,
      cy: 0,
      r: this.R,
      fill: "transparent",
      class: "a11y",
      tabindex: 0,
      role: "slider",
      "aria-orientation": "horizontal"
    });
    this.slider.style.pointerEvents = "none";
    this.gA11y.appendChild(this.slider);

    // <title>/<desc> for eksport og live-oppdatering
    this.titleEl = this.svg.querySelector('title');
    this.descEl = this.svg.querySelector('desc');

    // Låse-logikk
    this.fullyLocked = !!(cfg.lockDenominator && cfg.lockNumerator);
    if (this.fullyLocked) {
      this.gHandle.style.display = "none";
      this.slider.setAttribute("tabindex", "-1");
      this.slider.setAttribute("aria-disabled", "true");
    } else {
      this.slider.setAttribute("aria-disabled", cfg.lockNumerator ? "true" : "false");
      if (cfg.lockNumerator) this.handle.style.cursor = "default";
    }

    // Stepper synlighet
    const stepper = (_this$nMinus = this.nMinus) === null || _this$nMinus === void 0 ? void 0 : _this$nMinus.closest(".stepper");
    if (stepper) stepper.style.display = cfg.lockDenominator ? "none" : "";

    // Interaksjon
    this._dragging = false;
    (_this$nMinus2 = this.nMinus) === null || _this$nMinus2 === void 0 || _this$nMinus2.addEventListener("click", () => {
      if (cfg.lockDenominator) return;
      this.setN(this.n - this.cfg.stepN);
    });
    (_this$nPlus = this.nPlus) === null || _this$nPlus === void 0 || _this$nPlus.addEventListener("click", () => {
      if (cfg.lockDenominator) return;
      this.setN(this.n + this.cfg.stepN);
    });
    this.handle.addEventListener("pointerdown", e => {
      if (cfg.lockNumerator || this.fullyLocked) return;
      this._dragging = true;
      this.handle.setPointerCapture(e.pointerId);
    });
    this.handle.addEventListener("pointerup", e => {
      if (cfg.lockNumerator || this.fullyLocked) return;
      this._dragging = false;
      this.handle.releasePointerCapture(e.pointerId);
    });
    this.svg.addEventListener("pointerleave", () => {
      this._dragging = false;
    });
    this.svg.addEventListener("pointermove", e => {
      if (!this._dragging || cfg.lockNumerator || this.fullyLocked) return;
      const {
        x,
        y
      } = this._pt(e);
      const a = norm(Math.atan2(y, x));
      this._setTheta(a, true);
    });
    this.svg.addEventListener("click", e => {
      if (e.target === this.handle) return;
      if (cfg.lockNumerator || this.fullyLocked) return;
      const {
        x,
        y
      } = this._pt(e);
      const a = norm(Math.atan2(y, x));
      this._setTheta(a, true);
    });
    this.slider.addEventListener("keydown", e => {
      if (this.fullyLocked) return;
      let used = true;
      const big = e.shiftKey ? 5 : 1;
      switch (e.key) {
        case "ArrowRight":
        case "ArrowUp":
          if (!cfg.lockNumerator) this.setK(this.k + this.cfg.stepK * big);else used = false;
          break;
        case "ArrowLeft":
        case "ArrowDown":
          if (!cfg.lockNumerator) this.setK(this.k - this.cfg.stepK * big);else used = false;
          break;
        case "Home":
          if (!cfg.lockNumerator) this.setK(0);else used = false;
          break;
        case "End":
          if (!cfg.lockNumerator) this.setK(this.n);else used = false;
          break;
        case " ":
        case "Enter":
          if (!cfg.lockNumerator) this.setK(this.k + 1);else used = false;
          break;
        case "PageUp":
          if (!cfg.lockDenominator) this.setN(this.n + this.cfg.stepN * (e.shiftKey ? 5 : 1));else used = false;
          break;
        case "PageDown":
          if (!cfg.lockDenominator) this.setN(this.n - this.cfg.stepN * (e.shiftKey ? 5 : 1));else used = false;
          break;
        default:
          used = false;
      }
      if (used) e.preventDefault();
    });
    this.draw();
    this.syncSimpleConfig();
    REG.set(this.svg, this);
  }
  _pt(e) {
    const p = this.svg.createSVGPoint();
    p.x = e.clientX;
    p.y = e.clientY;
    return p.matrixTransform(this.svg.getScreenCTM().inverse());
  }
  _setTheta(a, updateK) {
    this.theta = norm(a);
    if (updateK) {
      const step = TAU / this.n;
      this.k = Math.max(0, Math.min(this.n, Math.round(this.theta / step)));
    }
    this.draw();
    if (updateK) this.syncSimpleConfig();
  }
  setN(n) {
    const nn = Math.max(this.minN, Math.min(this.maxN, Math.round(n)));
    this.n = nn;
    const step = TAU / this.n;
    this.k = Math.max(0, Math.min(this.n, Math.round(this.theta / step)));
    this.draw();
    this.syncSimpleConfig();
  }
  setK(k) {
    const kk = Math.max(0, Math.min(this.n, Math.round(k)));
    this.k = kk;
    this.theta = this.k / this.n * TAU;
    this.draw();
    this.syncSimpleConfig();
  }
  syncSimpleConfig() {
    if (this.index == null) return;
    const idx = this.index;
    if (Array.isArray(SIMPLE.pizzas)) {
      if (!SIMPLE.pizzas[idx]) SIMPLE.pizzas[idx] = {};
      SIMPLE.pizzas[idx].n = this.n;
      SIMPLE.pizzas[idx].t = this.k;
    }
    const field = id => document.getElementById(id);
    const base = idx + 1;
    const nField = field(`p${base}N`);
    if (nField) nField.value = String(this.n);
    const tField = field(`p${base}T`);
    if (tField) tField.value = String(this.k);
    const nVal = field(`nVal${base}`);
    if (nVal) nVal.textContent = String(this.n);
  }
  _updateTextAbove() {
    if (this.metaLine) {
      this.metaLine.textContent = this.textMode === "percent" ? fmt(this.n ? this.k / this.n * 100 : 0) + " %" : this.textMode === "decimal" ? fmt(this.n ? this.k / this.n : 0) : "";
    }
    if (this.fracBox && this.textMode === "frac") {
      if (this.fracNum) this.fracNum.textContent = this.k;
      if (this.fracDen) this.fracDen.textContent = this.n;
    }
  }
  _updateAria() {
    const g = gcd(this.k, this.n),
      dec = fmt(this.n ? this.k / this.n : 0),
      pct = fmt(this.n ? this.k / this.n * 100 : 0) + " %";
    const simp = g > 1 ? ` (${this.k / g}/${this.n / g})` : "";
    this.slider.setAttribute("aria-valuemin", "0");
    this.slider.setAttribute("aria-valuemax", String(this.n));
    this.slider.setAttribute("aria-valuenow", String(this.k));
    this.slider.setAttribute("aria-valuetext", `${this.k} av ${this.n}${simp}, ${dec} som desimal, ${pct}`);
    if (this.titleEl) this.titleEl.textContent = `Brøkpizza: ${this.k}/${this.n}`;
    if (this.descEl) this.descEl.textContent = `Viser ${this.n} sektorer totalt, ${this.k} av dem er fylt`;
  }
  draw() {
    const step = TAU / this.n,
      aEnd = this.k * step;
    if (this.nVal && this.showDenominatorValue) this.nVal.textContent = this.n;
    this.gFill.innerHTML = "";
    for (let i = 0; i < this.n; i++) {
      const a0 = i * step,
        a1 = a0 + step,
        filled = i < this.k;
      this.gFill.appendChild(mk("path", {
        d: arcPath(this.R, a0, a1),
        class: `sector ${filled ? "sector-fill" : "sector-empty"}`
      }));
    }
    this.clipFilled.innerHTML = "";
    this.clipEmpty.innerHTML = "";
    if (this.k <= 0) this.clipEmpty.appendChild(mk("circle", {
      cx: 0,
      cy: 0,
      r: this.R
    }));else if (this.k >= this.n) this.clipFilled.appendChild(mk("circle", {
      cx: 0,
      cy: 0,
      r: this.R
    }));else {
      this.clipFilled.appendChild(mk("path", {
        d: arcPath(this.R, 0, aEnd)
      }));
      this.clipEmpty.appendChild(mk("path", {
        d: arcPath(this.R, aEnd, TAU)
      }));
    }
    this.gLinesBlack.innerHTML = "";
    this.gLinesWhite.innerHTML = "";
    if (this.n > 1) {
      for (let i = 0; i < this.n; i++) {
        const a = i * step,
          x = this.R * Math.cos(a),
          y = this.R * Math.sin(a);
        const lnB = mk("line", {
          x1: 0,
          y1: 0,
          x2: x,
          y2: y,
          class: "dash"
        });
        const lnW = mk("line", {
          x1: 0,
          y1: 0,
          x2: x,
          y2: y,
          class: "dash"
        });
        this.gLinesBlack.appendChild(lnB);
        this.gLinesWhite.appendChild(lnW);
      }
    }
    if (this.fullyLocked) {
      this.gHandle.style.display = "none";
    } else {
      this.gHandle.style.display = "";
      this.handle.setAttribute("cx", this.R * Math.cos(this.theta));
      this.handle.setAttribute("cy", this.R * Math.sin(this.theta));
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
.dash{stroke:#000;stroke-dasharray:4 4;stroke-width:2}
.handle{fill:#e9e6f7;stroke:#333;stroke-width:2;cursor:pointer}
.a11y:focus{outline:none;stroke:#1e88e5;stroke-width:3}
.btn{fill:#fff;stroke:#cfcfcf;stroke-width:1;cursor:pointer}
.btnLabel{font-size:18px;dominant-baseline:middle;text-anchor:middle;pointer-events:none}
.meta, .fracNum, .fracDen{font-size:22px;text-anchor:middle}
.fracLine{stroke:#000;stroke-width:2}
`;
const INTERACTIVE_SVG_SCRIPT = `
/*<![CDATA[*/
(function(){
  "use strict";
  var root=document.currentScript.parentNode, TAU=Math.PI*2;
  function el(n,a){var e=document.createElementNS("http://www.w3.org/2000/svg",n); for(var k in a){e.setAttribute(k,a[k]);} return e;}
  function arc(r,a0,a1){var raw=a1-a0,s=((raw%TAU)+TAU)%TAU,full=Math.abs(s)<1e-6&&Math.abs(raw)>1e-6;
    if(full) return "M "+r+" 0 A "+r+" "+r+" 0 1 1 "+(-r)+" 0 A "+r+" "+r+" 0 1 1 "+r+" 0 Z";
    var sw=1,lg=s>Math.PI?1:0,x0=r*Math.cos(a0),y0=r*Math.sin(a0),x1=r*Math.cos(a1),y1=r*Math.sin(a1);
    return "M 0 0 L "+x0+" "+y0+" A "+r+" "+r+" 0 "+lg+" "+sw+" "+x1+" "+y1+" Z";
  }
  function gcd(a,b){a=Math.abs(a);b=Math.abs(b);while(b){var t=b;b=a%b;a=t;}return a||1;}
  function fmt(x){var s=(Math.round(x*100)/100).toFixed(2);return s.replace(/\.?0+$/,"");}

  var textMode=root.getAttribute("data-textmode")||"none";
  var nmin=+root.getAttribute("data-nmin")||1, nmax=+root.getAttribute("data-nmax")||24;
  var n=+root.getAttribute("data-n")||10, k=+root.getAttribute("data-k")||0, R=+root.getAttribute("data-r")||180;
  var showNVal=root.getAttribute("data-show-nval")!=="0";

  var fill=root.querySelector('[data-role="fill"]')||root.querySelectorAll("g")[0];
  var linesB=root.querySelector('[data-role="linesB"]')||el("g",{}); if(!linesB.parentNode) root.appendChild(linesB);
  var linesW=root.querySelector('[data-role="linesW"]')||el("g",{}); if(!linesW.parentNode) root.appendChild(linesW);
  var handle=root.querySelector(".handle");
  var a11y=root.querySelector('.a11y');
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
      var w=el("line",{x1:0,y1:0,x2:x,y2:y,"class":"dash"});
      linesB.appendChild(b); linesW.appendChild(w);
    }
  }
  function updateAria(){
    if(!a11y) return;
    var g=gcd(k,n), dec=fmt(n?k/n:0), pct=fmt(n?k/n*100:0)+" %";
    var simp=g>1?" ("+(k/g)+"/"+(n/g)+")":"";
    a11y.setAttribute("aria-valuemin","0");
    a11y.setAttribute("aria-valuemax",String(n));
    a11y.setAttribute("aria-valuenow",String(k));
    a11y.setAttribute("aria-valuetext",k+" av "+n+simp+", "+dec+" som desimal, "+pct);
    var t=root.querySelector('title');
    var d=root.querySelector('desc');
    if(t) t.textContent="Brøkpizza: "+k+"/"+n;
    if(d) d.textContent="Viser "+n+" sektorer totalt, "+k+" av dem er fylt";
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
    var HALF=18;
    tNum =el("text",{x:0,y:yTop-12,"class":"fracNum"});
    tDen =el("text",{x:0,y:yTop+24,"class":"fracDen"});
    tLine=el("line",{x1:-HALF,y1:yTop,x2:HALF,y2:yTop,"class":"fracLine"});
    textLayer.appendChild(tNum); textLayer.appendChild(tLine); textLayer.appendChild(tDen);
  }
  function updateTexts(){
    if(textMode==="percent"&&tMeta){ var p=n?(k/n*100):0; tMeta.textContent=fmt(p)+" %"; }
    else if(textMode==="decimal"&&tMeta){ var d=n?(k/n):0; tMeta.textContent=fmt(d); }
    else if(textMode==="frac"&&tNum&&tDen){ tNum.textContent=String(k); tDen.textContent=String(n); }
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
  if(!showNVal) nValText.setAttribute("display","none");
  controls.appendChild(btnMinus); controls.appendChild(btnPlus);
  controls.appendChild(lblMinus); controls.appendChild(lblPlus); controls.appendChild(nValText);
  root.appendChild(controls);

  function setN(nn){
    nn=Math.max(nmin,Math.min(nmax,Math.round(nn)));
    if(nn===n) return;
    n=nn; if(k>n) k=n;
    if(showNVal) nValText.textContent=String(n);
    rebuildSectors(); rebuildLines(); updateTexts(); updateAria();
  }

  var dragging=false;
  if(handle){
    handle.setAttribute("tabindex","0");
    handle.addEventListener("pointerdown",function(e){dragging=true;try{handle.setPointerCapture(e.pointerId);}catch(_){}});
    handle.addEventListener("pointerup",function(e){dragging=false;try{handle.releasePointerCapture(e.pointerId);}catch(_){}});
    root.addEventListener("pointerleave",function(){dragging=false;});
    root.addEventListener("pointermove",function(e){
      if(!dragging) return;
      var pt=root.createSVGPoint(); pt.x=e.clientX; pt.y=e.clientY;
      var p=pt.matrixTransform(root.getScreenCTM().inverse());
      var ang=Math.atan2(p.y,p.x); if(ang<0) ang+=TAU;
      var step=TAU/n; k=Math.max(0,Math.min(n,Math.round(ang/step)));
      rebuildSectors(); updateTexts(); updateAria();
    });
    root.addEventListener("click",function(e){
      if(e.target===handle||e.target===btnMinus||e.target===btnPlus) return;
      var pt=root.createSVGPoint(); pt.x=e.clientX; pt.y=e.clientY;
      var p=pt.matrixTransform(root.getScreenCTM().inverse());
      var ang=Math.atan2(p.y,p.x); if(ang<0) ang+=TAU;
      var step=TAU/n; k=Math.max(0,Math.min(n,Math.round(ang/step)));
      rebuildSectors(); updateTexts(); updateAria();
    });
    handle.addEventListener("keydown",function(e){
      var used=false;
      switch(e.key){
        case "ArrowRight": case "ArrowUp":   k=Math.min(n,k+1); used=true; break;
        case "ArrowLeft":  case "ArrowDown": k=Math.max(0,k-1); used=true; break;
        case "Home": k=0; used=true; break;
        case "End":  k=n; used=true; break;
      }
      if(used){ e.preventDefault(); rebuildSectors(); updateTexts(); updateAria(); }
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

  rebuildLines(); rebuildSectors(); updateTexts(); updateAria();
})();
/*]]>*/
`;

/* =======================
   Last ned figurer: statisk SVG
   ======================= */
function downloadSVG(svgEl, filename = "pizza.svg") {
  if (!svgEl) return;
  const clone = svgEl.cloneNode(true);

  // Fjern interaktive elementer
  clone.querySelectorAll(".handle, .a11y").forEach(el => el.remove());
  clone.setAttribute("xmlns", "http://www.w3.org/2000/svg");
  clone.setAttribute("xmlns:xlink", "http://www.w3.org/1999/xlink");
  let [minX, minY, w, h] = (clone.getAttribute("viewBox") || "-210 -210 420 420").trim().split(/\s+/).map(Number);
  clone.setAttribute("width", w);
  clone.setAttribute("height", h);
  const bg = mk("rect", {
    x: minX,
    y: minY,
    width: w,
    height: h,
    fill: "#fff"
  });
  clone.insertBefore(bg, clone.firstChild);
  const styleEl = document.createElementNS("http://www.w3.org/2000/svg", "style");
  styleEl.setAttribute("type", "text/css");
  styleEl.appendChild(document.createTextNode(EXPORT_SVG_STYLE));
  clone.insertBefore(styleEl, clone.firstChild);
  const xml = new XMLSerializer().serializeToString(clone);
  const file = `<?xml version="1.0" encoding="UTF-8"?>\n` + xml;
  const blob = new Blob([file], {
    type: "image/svg+xml;charset=utf-8"
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

/* =======================
   Last ned figurer: interaktiv SVG
   – brøk OVER, +/− UNDER, pen spacing
   ======================= */
function downloadInteractiveSVG(svgEl, filename = "pizza-interaktiv.svg") {
  var _inst$minN, _inst$maxN;
  if (!svgEl) return;
  const clone = svgEl.cloneNode(true);
  clone.setAttribute("xmlns", "http://www.w3.org/2000/svg");
  clone.setAttribute("xmlns:xlink", "http://www.w3.org/1999/xlink");

  // Utvid viewBox for topp/bunn
  let [minX, minY, w, h] = (clone.getAttribute("viewBox") || "-210 -210 420 420").trim().split(/\s+/).map(Number);
  const M_TOP = 78;
  const M_BOTTOM = 96;
  minY = minY - M_TOP;
  h = h + M_TOP + M_BOTTOM;
  clone.setAttribute("viewBox", `${minX} ${minY} ${w} ${h}`);
  clone.setAttribute("width", w);
  clone.setAttribute("height", h);

  // Hvit bakgrunn
  const bg = mk("rect", {
    x: minX,
    y: minY,
    width: w,
    height: h,
    fill: "#fff"
  });
  clone.insertBefore(bg, clone.firstChild);

  // Innebygd stil
  const styleEl = document.createElementNS("http://www.w3.org/2000/svg", "style");
  styleEl.setAttribute("type", "text/css");
  styleEl.appendChild(document.createTextNode(EXPORT_SVG_STYLE));
  clone.insertBefore(styleEl, clone.firstChild);

  // State fra levende instans
  const inst = REG.get(svgEl);
  const textMode = (inst === null || inst === void 0 ? void 0 : inst.textMode) || "none";
  const nMin = (_inst$minN = inst === null || inst === void 0 ? void 0 : inst.minN) !== null && _inst$minN !== void 0 ? _inst$minN : 1;
  const nMax = (_inst$maxN = inst === null || inst === void 0 ? void 0 : inst.maxN) !== null && _inst$maxN !== void 0 ? _inst$maxN : 24;
  const showNVal = (inst === null || inst === void 0 ? void 0 : inst.showDenominatorValue) !== false;

  // n, k, R
  const n = clone.querySelectorAll(".sector").length || 1;
  const k = clone.querySelectorAll(".sector-fill").length || 0;
  const rEl = clone.querySelector("circle.rim");
  const R = rEl ? parseFloat(rEl.getAttribute("r") || "180") : 180;

  // Oppdater beskrivelses-elementer slik at eksportert SVG forklarer
  // gjeldende brøk og totalt sektortall. Dette gjør at både skjermlesere
  // og videre interaksjon via innebygd skript starter med korrekt tekst.
  const tEl = clone.querySelector('title');
  const dEl = clone.querySelector('desc');
  if (tEl) tEl.textContent = `Brøkpizza: ${k}/${n}`;
  if (dEl) dEl.textContent = `Viser ${n} sektorer totalt, ${k} av dem er fylt`;

  // Sørg for at handle vises
  const hndl = clone.querySelector(".handle");
  if (hndl && hndl.parentNode && hndl.parentNode.style) hndl.parentNode.style.display = "";

  // Data for skriptet
  clone.setAttribute("data-n", String(n));
  clone.setAttribute("data-k", String(k));
  clone.setAttribute("data-r", String(R));
  clone.setAttribute("data-textmode", textMode);
  clone.setAttribute("data-nmin", String(nMin));
  clone.setAttribute("data-nmax", String(nMax));
  clone.setAttribute("data-show-nval", showNVal ? "1" : "0");

  // Inline-skript (med rettet parentes-feil)
  const scriptEl = document.createElementNS("http://www.w3.org/2000/svg", "script");
  scriptEl.setAttribute("type", "application/ecmascript");
  scriptEl.appendChild(document.createTextNode(INTERACTIVE_SVG_SCRIPT));
  clone.appendChild(scriptEl);
  const xml = new XMLSerializer().serializeToString(clone);
  const file = `<?xml version="1.0" encoding="UTF-8"?>\n` + xml;
  const blob = new Blob([file], {
    type: "image/svg+xml;charset=utf-8"
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
function getVisiblePizzas() {
  return PIZZA_DOM.map(m => document.getElementById(m.svgId)).filter(svg => {
    var _svg$closest;
    return svg && ((_svg$closest = svg.closest(".pizzaPanel")) === null || _svg$closest === void 0 ? void 0 : _svg$closest.style.display) !== "none";
  });
}
function buildAllPizzasSVG() {
  const svgs = getVisiblePizzas();
  if (!svgs.length) return null;
  const gap = 24,
    size = 420,
    opW = 80,
    ops = SIMPLE.ops || [];
  const opCount = ops.slice(0, svgs.length - 1).filter(o => o).length;
  const w = size * svgs.length + gap * (svgs.length - 1) + opW * opCount;
  const h = size;
  const root = mk("svg", {
    xmlns: "http://www.w3.org/2000/svg",
    "xmlns:xlink": "http://www.w3.org/1999/xlink",
    width: w,
    height: h,
    viewBox: `0 0 ${w} ${h}`
  });
  const bg = mk("rect", {
    x: 0,
    y: 0,
    width: w,
    height: h,
    fill: "#fff"
  });
  root.appendChild(bg);
  const styleEl = mk("style", {
    type: "text/css"
  });
  styleEl.appendChild(document.createTextNode(EXPORT_SVG_STYLE));
  root.appendChild(styleEl);
  let x = 0;
  svgs.forEach((svg, i) => {
    const clone = svg.cloneNode(true);
    clone.querySelectorAll(".handle, .a11y").forEach(el => el.remove());
    clone.setAttribute("x", x);
    clone.setAttribute("y", 0);
    clone.setAttribute("width", size);
    clone.setAttribute("height", size);
    root.appendChild(clone);
    x += size;
    const sign = ops[i];
    if (i < svgs.length - 1) {
      if (sign) {
        x += opW / 2;
        const t = mk("text", {
          x: x,
          y: size / 2,
          "text-anchor": "middle",
          "dominant-baseline": "middle",
          "font-size": "80"
        });
        t.textContent = sign;
        root.appendChild(t);
        x += opW / 2;
      }
      x += gap;
    }
  });
  const xml = new XMLSerializer().serializeToString(root);
  return `<?xml version="1.0" encoding="UTF-8"?>\n` + xml;
}
function downloadAllPizzasSVG(filename = "broksirkler.svg") {
  const file = buildAllPizzasSVG();
  if (!file) return;
  const blob = new Blob([file], {
    type: "image/svg+xml;charset=utf-8"
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
function downloadAllPizzasPNG(filename = "broksirkler.png") {
  const file = buildAllPizzasSVG();
  if (!file) return;
  const blob = new Blob([file], {
    type: "image/svg+xml;charset=utf-8"
  });
  const url = URL.createObjectURL(blob);
  const img = new Image();
  img.onload = () => {
    const w = img.width,
      h = img.height;
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, w, h);
    ctx.drawImage(img, 0, 0, w, h);
    URL.revokeObjectURL(url);
    canvas.toBlob(b => {
      const urlPng = URL.createObjectURL(b);
      const a = document.createElement('a');
      a.href = urlPng;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(urlPng);
    }, 'image/png');
  };
  img.src = url;
}
function downloadAllPizzasInteractiveSVG(filename = "broksirkler-interaktiv.svg") {
  const svgs = getVisiblePizzas();
  if (!svgs.length) return;
  const gap = 24,
    size = 420,
    M_TOP = 78,
    M_BOTTOM = 96,
    opW = 80,
    ops = SIMPLE.ops || [];
  const opCount = ops.slice(0, svgs.length - 1).filter(o => o).length;
  const w = size * svgs.length + gap * (svgs.length - 1) + opW * opCount;
  const h = size + M_TOP + M_BOTTOM;
  const root = mk("svg", {
    xmlns: "http://www.w3.org/2000/svg",
    "xmlns:xlink": "http://www.w3.org/1999/xlink",
    width: w,
    height: h,
    viewBox: `0 0 ${w} ${h}`
  });
  const bg = mk("rect", {
    x: 0,
    y: 0,
    width: w,
    height: h,
    fill: "#fff"
  });
  root.appendChild(bg);
  const styleEl = mk("style", {
    type: "text/css"
  });
  styleEl.appendChild(document.createTextNode(EXPORT_SVG_STYLE));
  root.appendChild(styleEl);
  let x = 0;
  svgs.forEach((svg, i) => {
    var _inst$minN2, _inst$maxN2;
    const clone = svg.cloneNode(true);
    const inst = REG.get(svg);
    const textMode = (inst === null || inst === void 0 ? void 0 : inst.textMode) || "none";
    const nMin = (_inst$minN2 = inst === null || inst === void 0 ? void 0 : inst.minN) !== null && _inst$minN2 !== void 0 ? _inst$minN2 : 1;
    const nMax = (_inst$maxN2 = inst === null || inst === void 0 ? void 0 : inst.maxN) !== null && _inst$maxN2 !== void 0 ? _inst$maxN2 : 24;
    const showNVal = (inst === null || inst === void 0 ? void 0 : inst.showDenominatorValue) !== false;
    const n = clone.querySelectorAll(".sector").length || 1;
    const k = clone.querySelectorAll(".sector-fill").length || 0;
    const rEl = clone.querySelector("circle.rim");
    const R = rEl ? parseFloat(rEl.getAttribute("r") || "180") : 180;
    const hndl = clone.querySelector(".handle");
    if (hndl && hndl.parentNode && hndl.parentNode.style) hndl.parentNode.style.display = "";
    // Sikre at hver eksportert SVG får oppdatert <title>/<desc>
    // slik at tilgjengelighetsbeskrivelsen matcher gjeldende brøk.
    const tEl = clone.querySelector('title');
    const dEl = clone.querySelector('desc');
    if (tEl) tEl.textContent = `Brøkpizza: ${k}/${n}`;
    if (dEl) dEl.textContent = `Viser ${n} sektorer totalt, ${k} av dem er fylt`;
    clone.setAttribute("data-n", String(n));
    clone.setAttribute("data-k", String(k));
    clone.setAttribute("data-r", String(R));
    clone.setAttribute("data-textmode", textMode);
    clone.setAttribute("data-nmin", String(nMin));
    clone.setAttribute("data-nmax", String(nMax));
    clone.setAttribute("data-show-nval", showNVal ? "1" : "0");
    clone.setAttribute("x", x);
    clone.setAttribute("y", M_TOP);
    clone.setAttribute("width", size);
    clone.setAttribute("height", size);
    const scriptEl = document.createElementNS("http://www.w3.org/2000/svg", "script");
    scriptEl.setAttribute("type", "application/ecmascript");
    scriptEl.appendChild(document.createTextNode(INTERACTIVE_SVG_SCRIPT));
    clone.appendChild(scriptEl);
    root.appendChild(clone);
    x += size;
    const sign = ops[i];
    if (i < svgs.length - 1) {
      if (sign) {
        x += opW / 2;
        const t = mk("text", {
          x: x,
          y: M_TOP + size / 2,
          "text-anchor": "middle",
          "dominant-baseline": "middle",
          "font-size": "80"
        });
        t.textContent = sign;
        root.appendChild(t);
        x += opW / 2;
      }
      x += gap;
    }
  });
  const xml = new XMLSerializer().serializeToString(root);
  const file = `<?xml version="1.0" encoding="UTF-8"?>\n` + xml;
  const blob = new Blob([file], {
    type: "image/svg+xml;charset=utf-8"
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
function setupGlobalDownloadButtons() {
  const btnStatic = document.getElementById("btnStaticAll");
  const btnInteractive = document.getElementById("btnInteractiveAll");
  const btnPng = document.getElementById("btnPngAll");
  if (btnStatic) btnStatic.addEventListener("click", () => downloadAllPizzasSVG());
  if (btnInteractive) btnInteractive.addEventListener("click", () => downloadAllPizzasInteractiveSVG());
  if (btnPng) btnPng.addEventListener("click", () => downloadAllPizzasPNG());
}

/* =======================
   Init
   ======================= */
function initFromHtml() {
  const cfg = readConfigFromHtml();
  SIMPLE.pizzas = cfg.pizzas;
  SIMPLE.ops = cfg.ops;
  let visibleCount = 0;
  REG.clear();
  PIZZA_DOM.forEach((map, i) => {
    var _document$getElementB12, _pcfg$minN, _pcfg$maksN, _map$index, _pcfg$n, _pcfg$t, _pcfg$n2, _pcfg$text;
    const panel = (_document$getElementB12 = document.getElementById(map.svgId)) === null || _document$getElementB12 === void 0 ? void 0 : _document$getElementB12.closest(".pizzaPanel");
    if (!panel) return;
    if (PANEL_HTML[i] == null) PANEL_HTML[i] = panel.innerHTML;
    panel.innerHTML = PANEL_HTML[i];
    const isVisible = panel.style.display !== "none";
    if (!SIMPLE.pizzas[i]) SIMPLE.pizzas[i] = {};
    SIMPLE.pizzas[i].visible = isVisible;
    if (!isVisible) return;
    visibleCount++;
    const pcfg = cfg.pizzas[i];
    const minN = Math.max(1, (_pcfg$minN = pcfg.minN) !== null && _pcfg$minN !== void 0 ? _pcfg$minN : 1);
    const maxN = Math.max(minN, (_pcfg$maksN = pcfg.maksN) !== null && _pcfg$maksN !== void 0 ? _pcfg$maksN : 24);
    new Pizza({
      ...map,
      index: (_map$index = map.index) !== null && _map$index !== void 0 ? _map$index : i,
      n: (_pcfg$n = pcfg.n) !== null && _pcfg$n !== void 0 ? _pcfg$n : 1,
      k: Math.min((_pcfg$t = pcfg.t) !== null && _pcfg$t !== void 0 ? _pcfg$t : 0, (_pcfg$n2 = pcfg.n) !== null && _pcfg$n2 !== void 0 ? _pcfg$n2 : 1),
      minN,
      maxN,
      textMode: (_pcfg$text = pcfg.text) !== null && _pcfg$text !== void 0 ? _pcfg$text : "none",
      lockDenominator: !!pcfg.lockN,
      lockNumerator: !!pcfg.lockT,
      showDenominatorValue: !pcfg.hideNVal
    });
  });
  cfg.ops.forEach((op, i) => {
    const displayEl = document.getElementById(`opDisplay${i + 1}`);
    const nextPanel = document.getElementById(`panel${i + 2}`);
    const wrapper = document.getElementById(`op${i + 1}Wrapper`);
    const select = document.getElementById(`op${i + 1}`);
    const hasRightPizza = !!(nextPanel && nextPanel.style.display !== "none");
    if (wrapper) wrapper.style.display = hasRightPizza ? "" : "none";
    if (!hasRightPizza && select) select.value = "";
    if (!displayEl) return;
    if (op && hasRightPizza) {
      displayEl.textContent = op;
      displayEl.style.display = "";
    } else {
      displayEl.style.display = "none";
    }
  });
  scheduleCenterAlign();
  fitPizzasToLine();
  setupRemovePizzaButtons();
  if (visibleCount <= 0) {
    const firstPanel = document.getElementById('panel1');
    if (firstPanel && firstPanel.style.display !== "none") visibleCount = 1;else visibleCount = 0;
  }
  SIMPLE.visibleCount = visibleCount || 1;
}
window.addEventListener("load", () => {
  initFromHtml();
  setupGlobalDownloadButtons();
  const addBtn = document.getElementById('addPizza');
  const fieldset2 = document.getElementById('fieldset2');
  const fieldset3 = document.getElementById('fieldset3');
  addBtn === null || addBtn === void 0 || addBtn.addEventListener('click', () => {
    const panel2 = document.getElementById('panel2');
    const panel3 = document.getElementById('panel3');
    if (panel2 && panel2.style.display === 'none') {
      panel2.style.display = '';
      if (fieldset2) fieldset2.style.display = '';
    } else if (panel3 && panel3.style.display === 'none') {
      panel3.style.display = '';
      if (fieldset3) fieldset3.style.display = '';
      addBtn.style.display = 'none';
    }
    initFromHtml();
  });
  document.querySelectorAll("input, select").forEach(el => {
    el.addEventListener("input", initFromHtml);
    el.addEventListener("change", initFromHtml);
  });
});
function applySimpleConfigToInputs() {
  const pizzas = Array.isArray(SIMPLE.pizzas) ? SIMPLE.pizzas : [];
  const ops = Array.isArray(SIMPLE.ops) ? SIMPLE.ops : [];
  const clampCount = val => {
    const num = Number(val);
    if (!Number.isFinite(num)) return null;
    return Math.min(3, Math.max(1, Math.round(num)));
  };
  let visible = clampCount(SIMPLE.visibleCount);
  if (visible == null) {
    visible = pizzas.reduce((acc, p, idx) => {
      if (idx === 0) return acc + 1;
      if (p && (p.visible || p !== null && p !== void 0 && p.lockN || p !== null && p !== void 0 && p.lockT || p !== null && p !== void 0 && p.text || p !== null && p !== void 0 && p.t || p !== null && p !== void 0 && p.n)) return acc + 1;
      return acc;
    }, 0);
    if (!visible) visible = 1;
  }
  for (let i = 1; i <= 3; i++) {
    const panel = document.getElementById(`panel${i}`);
    const fieldset = document.getElementById(`fieldset${i}`);
    const shouldShow = i <= visible;
    if (panel) panel.style.display = shouldShow ? "" : "none";
    if (fieldset) fieldset.style.display = shouldShow ? "" : "none";
    if (!SIMPLE.pizzas[i - 1]) SIMPLE.pizzas[i - 1] = {};
    SIMPLE.pizzas[i - 1].visible = shouldShow;
  }
  const addBtn = document.getElementById('addPizza');
  if (addBtn) addBtn.style.display = visible >= 3 ? 'none' : '';
  SIMPLE.visibleCount = visible;
  const ensurePizza = idx => {
    var _base$text;
    const base = pizzas[idx] || {};
    return {
      t: Number.isFinite(base.t) ? base.t : idx === 0 ? 3 : 0,
      n: Number.isFinite(base.n) ? Math.max(1, base.n) : 10,
      lockN: !!base.lockN,
      lockT: !!base.lockT,
      text: (_base$text = base.text) !== null && _base$text !== void 0 ? _base$text : 'none',
      hideNVal: !!base.hideNVal,
      minN: Number.isFinite(base.minN) ? base.minN : 1,
      maksN: Number.isFinite(base.maksN) ? base.maksN : 24
    };
  };
  const setVal = (id, value) => {
    const el = document.getElementById(id);
    if (el && value != null) el.value = String(value);
  };
  const setChk = (id, checked) => {
    const el = document.getElementById(id);
    if (el) el.checked = !!checked;
  };
  for (let i = 1; i <= 3; i++) {
    const cfg = ensurePizza(i - 1);
    setVal(`p${i}T`, cfg.t);
    setVal(`p${i}N`, cfg.n);
    setChk(`p${i}LockN`, cfg.lockN);
    setChk(`p${i}LockT`, cfg.lockT);
    setVal(`p${i}Text`, cfg.text);
    setChk(`p${i}HideNVal`, cfg.hideNVal);
    setVal(`p${i}MinN`, cfg.minN);
    setVal(`p${i}MaxN`, cfg.maksN);
    const textSel = document.getElementById(`p${i}Text`);
    if (textSel && cfg.text) textSel.value = cfg.text;
  }
  ops.forEach((op, idx) => {
    const wrapper = document.getElementById(`op${idx + 1}Wrapper`);
    const selectId = `op${idx + 1}`;
    const select = document.getElementById(selectId);
    const rightPanel = document.getElementById(`panel${idx + 2}`);
    const shouldShow = !!(rightPanel && rightPanel.style.display !== "none");
    if (wrapper) wrapper.style.display = shouldShow ? "" : "none";
    if (shouldShow) {
      setVal(selectId, op !== null && op !== void 0 ? op : "");
    } else if (select) {
      select.value = "";
    }
  });
}
function applyExamplesConfig() {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', applyExamplesConfig, {
      once: true
    });
    return;
  }
  applySimpleConfigToInputs();
  initFromHtml();
}
if (typeof window !== 'undefined') {
  window.applyConfig = applyExamplesConfig;
  window.render = applyExamplesConfig;
}
