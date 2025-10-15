/* ============ ENKEL KONFIG (FORFATTER) ============ */
let typeIdCounter = 0;

const DEFAULT_ITEM_CONFIG = [{
  emoji: "🍎",
  label: "epler",
  count: 3
}, {
  emoji: "🍐",
  label: "pærer",
  count: 2
}];

const SIMPLE = {
  // Global radius for all beads. Optional – falls back to ADV.beadRadius.
  beadRadius: 30,
  bowls: [{
    items: cloneDefaultItems()
  }],
  altText: "",
  altTextSource: "auto"
};

/* ============ ADV KONFIG (TEKNISK/VALGFRITT) ============ */
// Technical defaults. beadRadius here is only used if SIMPLE.beadRadius is not set.
const ADV = {
  beadRadius: 30,
  beadGap: 12
};

/* ============ DERIVERT KONFIG FOR RENDER (IKKE REDIGER) ============ */
function makeCFG() {
  var _SIMPLE$beadRadius;
  const globalRadius = (_SIMPLE$beadRadius = SIMPLE.beadRadius) !== null && _SIMPLE$beadRadius !== void 0 ? _SIMPLE$beadRadius : ADV.beadRadius;
  const bowls = Array.isArray(SIMPLE.bowls) ? SIMPLE.bowls : [];
  const cfgBowls = bowls.map(b => {
    const instances = [];
    const items = Array.isArray(b.items) ? b.items : [];
    items.forEach(item => {
      const typeId = typeof (item === null || item === void 0 ? void 0 : item.id) === "string" && item.id ? item.id : createTypeId();
      const emoji = sanitizeEmoji(item === null || item === void 0 ? void 0 : item.emoji) || DEFAULT_ITEM_CONFIG[0].emoji;
      const raw = item === null || item === void 0 ? void 0 : item.count;
      const count = sanitizeCount(raw);
      for (let i = 0; i < count; i++) {
        instances.push({
          emoji,
          typeId
        });
      }
    });
    if (!instances.length) {
      fallbackInstances().forEach(inst => instances.push(inst));
    }
    const radiusRaw = Number.isFinite(b === null || b === void 0 ? void 0 : b.beadRadius) ? b.beadRadius : globalRadius;
    const beadRadius = Math.min(60, Math.max(5, radiusRaw !== null && radiusRaw !== void 0 ? radiusRaw : ADV.beadRadius));
    return {
      instances,
      beadRadius
    };
  });
  if (!cfgBowls.length) {
    cfgBowls.push({
      instances: fallbackInstances(),
      beadRadius: Math.min(60, Math.max(5, globalRadius !== null && globalRadius !== void 0 ? globalRadius : ADV.beadRadius))
    });
  }
  return {
    bowls: cfgBowls,
    beadGap: ADV.beadGap
  };
}
let CFG = makeCFG();

/* ============ DOM & VIEWBOX ============ */
const SVG_IDS = ["bowlSVG1", "bowlSVG2", "bowlSVG3", "bowlSVG4"];
const MAX_FIGURES = SVG_IDS.length;
const VB_W = 500,
  VB_H = 300;
const figureViews = [];

/* ============ STATE & INIT ============ */
const STATE = window.STATE && typeof window.STATE === "object" ? window.STATE : {};
window.STATE = STATE;
if (!Array.isArray(STATE.bowls)) STATE.bowls = [];
const LEGACY_COLOR_LABELS = {
  blue: "blå",
  red: "rød",
  green: "grønn",
  yellow: "gul",
  pink: "rosa",
  purple: "lilla"
};
const LEGACY_COLOR_EMOJIS = {
  blue: "🔵",
  red: "🔴",
  green: "🟢",
  yellow: "🟡",
  pink: "🩷",
  purple: "🟣"
};
const FALLBACK_TYPE_IDS = DEFAULT_ITEM_CONFIG.map((_, index) => `fallback-${index}`);
if (typeof SIMPLE.altText !== "string") SIMPLE.altText = "";
if (SIMPLE.altTextSource !== "manual") SIMPLE.altTextSource = "auto";
const controlsWrap = document.getElementById("controls");
const figureGridEl = document.querySelector(".figureGrid");
const addBtn = document.getElementById("addBowl");
const panelEls = SVG_IDS.map((_, idx) => document.getElementById(`panel${idx + 1}`));
const removeBtns = SVG_IDS.map((_, idx) => document.getElementById(`removeBowl${idx + 1}`));
const exportToolbarEls = SVG_IDS.map((_, idx) => document.getElementById(`exportToolbar${idx + 1}`));
const exportCard = document.getElementById("exportCard");
const gridEl = document.querySelector(".grid");
const initialSideWidth = (() => {
  if (!gridEl) return 360;
  const inlineVal = Number.parseFloat(gridEl.style.getPropertyValue("--side-width"));
  if (Number.isFinite(inlineVal)) return inlineVal;
  try {
    const computedVal = Number.parseFloat(getComputedStyle(gridEl).getPropertyValue("--side-width"));
    if (Number.isFinite(computedVal)) return computedVal;
  } catch (_) {}
  return 360;
})();
let lastVisibleCount = null;
if (!Array.isArray(SIMPLE.bowls)) SIMPLE.bowls = [];
if (Array.isArray(SIMPLE.bowls) && SIMPLE.bowls.length > MAX_FIGURES) {
  SIMPLE.bowls.length = MAX_FIGURES;
}
let altTextManager = null;
let altTextAnchor = null;
initializeVisibleCount();
SVG_IDS.forEach((id, idx) => {
  const svg = document.getElementById(id);
  if (!svg) return;
  svg.setAttribute("viewBox", `0 0 ${VB_W} ${VB_H}`);
  svg.innerHTML = "";
  const gBowls = mk("g", {
    class: "bowls"
  });
  svg.appendChild(gBowls);
  const fig = createFigure(idx, svg, gBowls);
  figureViews[idx] = fig;
});
render();
addBtn === null || addBtn === void 0 || addBtn.addEventListener("click", () => {
  const visible = getVisibleCount();
  if (visible >= MAX_FIGURES) return;
  const nextIdx = visible;
  ensureSimpleBowl(nextIdx);
  setVisibleCount(nextIdx + 1);
  render();
});
removeBtns.forEach((btn, idx) => {
  btn === null || btn === void 0 || btn.addEventListener("click", () => {
    removeBowl(idx);
  });
});
const downloadButtons = SVG_IDS.map((_, idx) => ({
  svgBtn: document.getElementById(`downloadSVG${idx + 1}`),
  pngBtn: document.getElementById(`downloadPNG${idx + 1}`),
  idx
}));
downloadButtons.forEach(({
  svgBtn,
  pngBtn,
  idx
}) => {
  svgBtn === null || svgBtn === void 0 || svgBtn.addEventListener("click", () => downloadSvgFigure(idx));
  pngBtn === null || pngBtn === void 0 || pngBtn.addEventListener("click", () => downloadPngFigure(idx));
});

initAltTextManager();

function clampVisibleCount(value) {
  if (!Number.isFinite(value)) return 1;
  const rounded = Math.round(value);
  return Math.min(MAX_FIGURES, Math.max(1, rounded));
}
function setVisibleCount(value) {
  const sanitized = clampVisibleCount(value);
  STATE.visibleCount = sanitized;
  STATE.figure2Visible = sanitized > 1;
}
function getVisibleCount() {
  const sanitized = clampVisibleCount(STATE.visibleCount);
  if (sanitized !== STATE.visibleCount) {
    STATE.visibleCount = sanitized;
    STATE.figure2Visible = sanitized > 1;
  }
  return sanitized;
}
function initializeVisibleCount() {
  if (!Number.isFinite(STATE.visibleCount)) {
    const parsed = Number.parseInt(STATE.visibleCount, 10);
    if (Number.isFinite(parsed)) {
      STATE.visibleCount = parsed;
    }
  }
  if (!Number.isFinite(STATE.visibleCount)) {
    if (typeof STATE.figure2Visible === "boolean") {
      STATE.visibleCount = STATE.figure2Visible ? 2 : 1;
    } else if (Array.isArray(SIMPLE.bowls) && SIMPLE.bowls.length > 0) {
      STATE.visibleCount = SIMPLE.bowls.length;
    } else {
      STATE.visibleCount = 1;
    }
  }
  setVisibleCount(STATE.visibleCount);
}

/* ============ FUNKSJONER ============ */
function createFigure(idx, svg, gBowls) {
  var _SIMPLE$beadRadius3, _SIMPLE$beadRadius4;
  const fieldset = document.createElement("fieldset");
  fieldset.className = "bowlFieldset";
  fieldset.id = `kuler${idx + 1}`;
  const legend = document.createElement("legend");
  legend.textContent = `Kuler ${idx + 1}`;
  fieldset.appendChild(legend);
  const typeList = document.createElement("div");
  typeList.className = "emojiTypeList";
  fieldset.appendChild(typeList);
  const addTypeBtn = document.createElement("button");
  addTypeBtn.type = "button";
  addTypeBtn.className = "btn emojiAddBtn";
  addTypeBtn.textContent = "Legg til type";
  addTypeBtn.addEventListener("click", () => addType(idx));
  fieldset.appendChild(addTypeBtn);
  const sizeRow = document.createElement("div");
  sizeRow.className = "ctrlRow ctrlRow--size";
  const sizeLabel = document.createElement("span");
  sizeLabel.className = "ctrlLabel ctrlLabel--size";
  sizeLabel.textContent = "Kulestørrelse";
  const sizeMinus = document.createElement("button");
  sizeMinus.type = "button";
  sizeMinus.textContent = "−";
  const sizeInput = document.createElement("input");
  sizeInput.type = "range";
  sizeInput.min = "5";
  sizeInput.max = "60";
  sizeInput.style.flex = "1 1 160px";
  const sizePlus = document.createElement("button");
  sizePlus.type = "button";
  sizePlus.textContent = "+";
  const sizeSpan = document.createElement("span");
  sizeSpan.className = "count";
  sizeSpan.textContent = "0";
  sizeMinus.addEventListener("click", () => adjustSize(idx, -2));
  sizePlus.addEventListener("click", () => adjustSize(idx, 2));
  sizeInput.addEventListener("input", () => setSize(idx, parseInt(sizeInput.value, 10)));
  sizeRow.append(sizeLabel, sizeMinus, sizeInput, sizePlus, sizeSpan);
  fieldset.appendChild(sizeRow);
  controlsWrap === null || controlsWrap === void 0 || controlsWrap.appendChild(fieldset);
  return {
    idx,
    svg,
    gBowls,
    fieldset,
    typeList,
    addTypeBtn,
    sizeDisplay: sizeSpan,
    sizeSlider: sizeInput,
    beadRadius: Math.min(60, Math.max(5, (_SIMPLE$beadRadius3 = SIMPLE.beadRadius) !== null && _SIMPLE$beadRadius3 !== void 0 ? _SIMPLE$beadRadius3 : ADV.beadRadius)),
    renderRadius: Math.min(60, Math.max(5, (_SIMPLE$beadRadius4 = SIMPLE.beadRadius) !== null && _SIMPLE$beadRadius4 !== void 0 ? _SIMPLE$beadRadius4 : ADV.beadRadius))
  };
}
function ensureSimpleBowl(idx) {
  var _SIMPLE$beadRadius5;
  if (!Array.isArray(SIMPLE.bowls)) SIMPLE.bowls = [];
  const globalRadius = (_SIMPLE$beadRadius5 = SIMPLE.beadRadius) !== null && _SIMPLE$beadRadius5 !== void 0 ? _SIMPLE$beadRadius5 : ADV.beadRadius;
  let bowl = SIMPLE.bowls[idx];
  if (!bowl || typeof bowl !== "object") {
    const template = idx > 0 ? ensureSimpleBowl(0) : null;
    const templateItems = template && Array.isArray(template.items) ? template.items : [];
    const items = templateItems.length ? templateItems.map(item => ({
      id: createTypeId(),
      emoji: sanitizeEmoji(item === null || item === void 0 ? void 0 : item.emoji),
      label: sanitizeLabel(item === null || item === void 0 ? void 0 : item.label),
      count: sanitizeCount(item === null || item === void 0 ? void 0 : item.count)
    })) : cloneDefaultItems();
    const radiusSource = Number.isFinite(template === null || template === void 0 ? void 0 : template.beadRadius) ? template.beadRadius : globalRadius;
    bowl = {
      items,
      beadRadius: radiusSource
    };
    SIMPLE.bowls[idx] = bowl;
  } else {
    if (!Array.isArray(bowl.items) && Array.isArray(bowl.colorCounts)) {
      bowl.items = bowl.colorCounts.map(cc => ({
        id: createTypeId(),
        emoji: LEGACY_COLOR_EMOJIS[cc.color] || DEFAULT_ITEM_CONFIG[0].emoji,
        label: LEGACY_COLOR_LABELS[cc.color] || cc.color,
        count: sanitizeCount(cc === null || cc === void 0 ? void 0 : cc.count)
      }));
      delete bowl.colorCounts;
    }
    if (!Array.isArray(bowl.items)) bowl.items = [];
    const seen = new Set();
    bowl.items = bowl.items.map(item => {
      let id = typeof (item === null || item === void 0 ? void 0 : item.id) === "string" && item.id ? item.id : createTypeId();
      while (seen.has(id)) id = createTypeId();
      seen.add(id);
      return {
        id,
        emoji: sanitizeEmoji(item === null || item === void 0 ? void 0 : item.emoji),
        label: sanitizeLabel(item === null || item === void 0 ? void 0 : item.label),
        count: sanitizeCount(item === null || item === void 0 ? void 0 : item.count)
      };
    });
    if (!bowl.items.length) bowl.items = [createEmptyItem()];
    const radiusSource = Number.isFinite(bowl.beadRadius) ? bowl.beadRadius : globalRadius;
    bowl.beadRadius = Math.min(60, Math.max(5, radiusSource));
  }
  return bowl;
}
function applySimpleToFigures(options = {}) {
  const visible = getVisibleCount();
  figureViews.forEach(fig => {
    var _SIMPLE$beadRadius7;
    if (!fig) return;
    if (fig.idx >= visible) return;
    const bowl = ensureSimpleBowl(fig.idx);
    const radius = Math.min(60, Math.max(5, Number.isFinite(bowl === null || bowl === void 0 ? void 0 : bowl.beadRadius) ? bowl.beadRadius : (_SIMPLE$beadRadius7 = SIMPLE.beadRadius) !== null && _SIMPLE$beadRadius7 !== void 0 ? _SIMPLE$beadRadius7 : ADV.beadRadius));
    fig.beadRadius = radius;
    fig.renderRadius = radius;
    if (fig.sizeDisplay) fig.sizeDisplay.textContent = radius;
    if (fig.sizeSlider) fig.sizeSlider.value = String(radius);
    updateFigureTypeControls(fig, bowl, options);
  });
}
function syncSimpleFromFigures() {
  const visible = getVisibleCount();
  figureViews.forEach(fig => {
    var _ref, _ref2, _fig$beadRadius;
    if (!fig) return;
    if (fig.idx >= visible) return;
    const bowl = ensureSimpleBowl(fig.idx);
    bowl.beadRadius = Math.min(60, Math.max(5, (_ref = (_ref2 = (_fig$beadRadius = fig.beadRadius) !== null && _fig$beadRadius !== void 0 ? _fig$beadRadius : bowl.beadRadius) !== null && _ref2 !== void 0 ? _ref2 : SIMPLE.beadRadius) !== null && _ref !== void 0 ? _ref : ADV.beadRadius));
  });
  if (figureViews[0]) SIMPLE.beadRadius = figureViews[0].beadRadius;
}
function changeCount(idx, typeId, delta) {
  const fig = figureViews[idx];
  if (!fig) return;
  const bowl = ensureSimpleBowl(idx);
  if (!Array.isArray(bowl.items)) bowl.items = [];
  const item = bowl.items.find(entry => entry.id === typeId);
  if (!item) return;
  const current = sanitizeCount(item.count);
  const next = Math.max(0, current + delta);
  item.count = next;
  updateConfig();
}
function changeEmoji(idx, typeId, value, selection) {
  const bowl = ensureSimpleBowl(idx);
  if (!Array.isArray(bowl.items)) bowl.items = [];
  const item = bowl.items.find(entry => entry.id === typeId);
  if (!item) return;
  const sanitized = sanitizeEmoji(value);
  if (item.emoji === sanitized) return;
  item.emoji = sanitized;
  updateConfig({
    focus: makeFocusState(idx, typeId, "emoji", selection, sanitized.length)
  });
}
function changeLabel(idx, typeId, value, selection) {
  const bowl = ensureSimpleBowl(idx);
  if (!Array.isArray(bowl.items)) bowl.items = [];
  const item = bowl.items.find(entry => entry.id === typeId);
  if (!item) return;
  const sanitized = sanitizeLabel(value);
  if (item.label === sanitized) return;
  item.label = sanitized;
  updateConfig({
    focus: makeFocusState(idx, typeId, "label", selection, sanitized.length)
  });
}
function makeFocusState(bowlIdx, typeId, field, selection, fallbackLength) {
  const state = {
    bowlIdx,
    typeId,
    field
  };
  if (selection && typeof selection.start === "number" && typeof selection.end === "number") {
    state.selectionStart = selection.start;
    state.selectionEnd = selection.end;
  } else if (typeof fallbackLength === "number") {
    state.selectionStart = fallbackLength;
    state.selectionEnd = fallbackLength;
  }
  return state;
}
function addType(idx) {
  const bowl = ensureSimpleBowl(idx);
  if (!Array.isArray(bowl.items)) bowl.items = [];
  const newItem = {
    id: createTypeId(),
    emoji: "",
    label: "",
    count: 1
  };
  bowl.items.push(newItem);
  updateConfig({
    focus: makeFocusState(idx, newItem.id, "emoji", {
      start: newItem.emoji.length,
      end: newItem.emoji.length
    })
  });
}
function removeType(idx, typeId) {
  const bowl = ensureSimpleBowl(idx);
  if (!Array.isArray(bowl.items)) bowl.items = [];
  const nextItems = bowl.items.filter(item => item.id !== typeId);
  bowl.items = nextItems.length ? nextItems : [createEmptyItem()];
  const bowlState = getBowlState(idx);
  if (bowlState.byType && bowlState.byType[typeId]) {
    delete bowlState.byType[typeId];
  }
  updateConfig();
}
function updateFigureTypeControls(fig, bowl, options = {}) {
  if (!fig || !fig.typeList) return;
  const list = fig.typeList;
  list.innerHTML = "";
  const items = Array.isArray(bowl.items) ? bowl.items : [];
  const focus = options.focus && options.focus.bowlIdx === fig.idx ? options.focus : null;
  items.forEach(item => {
    const row = document.createElement("div");
    row.className = "ctrlRow ctrlRow--emoji";
    row.dataset.typeId = item.id;
    const emojiInput = document.createElement("input");
    emojiInput.type = "text";
    emojiInput.className = "emojiInput";
    emojiInput.maxLength = 8;
    const emojiValue = sanitizeEmoji(item === null || item === void 0 ? void 0 : item.emoji);
    emojiInput.value = emojiValue;
    emojiInput.placeholder = DEFAULT_ITEM_CONFIG[0].emoji;
    emojiInput.dataset.typeId = item.id;
    emojiInput.dataset.field = "emoji";
    emojiInput.addEventListener("input", e => {
      const target = e.target;
      const rawStart = target.selectionStart;
      const sanitizedValue = sanitizeEmoji(target.value);
      if (sanitizedValue !== target.value) {
        target.value = sanitizedValue;
        if (typeof target.setSelectionRange === "function") {
          const pos = typeof rawStart === "number" ? Math.min(sanitizedValue.length, rawStart) : sanitizedValue.length;
          try {
            target.setSelectionRange(pos, pos);
          } catch (_) {}
        }
      }
      changeEmoji(fig.idx, item.id, sanitizedValue, {
        start: target.selectionStart,
        end: target.selectionEnd
      });
    });
    const labelInput = document.createElement("input");
    labelInput.type = "text";
    labelInput.className = "emojiLabelInput";
    labelInput.placeholder = "Navn (valgfritt)";
    const labelValue = sanitizeLabel(item === null || item === void 0 ? void 0 : item.label);
    labelInput.value = labelValue;
    labelInput.dataset.typeId = item.id;
    labelInput.dataset.field = "label";
    labelInput.maxLength = 40;
    labelInput.addEventListener("input", e => {
      const target = e.target;
      const sanitizedValue = sanitizeLabel(target.value);
      if (sanitizedValue !== target.value) {
        target.value = sanitizedValue;
        if (typeof target.setSelectionRange === "function") {
          const pos = sanitizedValue.length;
          try {
            target.setSelectionRange(pos, pos);
          } catch (_) {}
        }
      }
      changeLabel(fig.idx, item.id, sanitizedValue, {
        start: target.selectionStart,
        end: target.selectionEnd
      });
    });
    const minus = document.createElement("button");
    minus.type = "button";
    minus.textContent = "−";
    minus.addEventListener("click", () => changeCount(fig.idx, item.id, -1));
    const countSpan = document.createElement("span");
    countSpan.className = "count";
    countSpan.textContent = String(sanitizeCount(item === null || item === void 0 ? void 0 : item.count));
    const plus = document.createElement("button");
    plus.type = "button";
    plus.textContent = "+";
    plus.addEventListener("click", () => changeCount(fig.idx, item.id, 1));
    const removeBtn = document.createElement("button");
    removeBtn.type = "button";
    removeBtn.className = "removeTypeBtn";
    removeBtn.setAttribute("aria-label", "Fjern type");
    removeBtn.textContent = "×";
    removeBtn.addEventListener("click", () => removeType(fig.idx, item.id));
    row.append(emojiInput, labelInput, minus, countSpan, plus, removeBtn);
    list.appendChild(row);
  });
  if (focus) {
    const selector = `[data-type-id="${focus.typeId}"][data-field="${focus.field}"]`;
    const target = list.querySelector(selector);
    if (target && typeof target.focus === "function") {
      target.focus();
      if (typeof focus.selectionStart === "number" && typeof focus.selectionEnd === "number" && typeof target.setSelectionRange === "function") {
        try {
          target.setSelectionRange(focus.selectionStart, focus.selectionEnd);
        } catch (_) {}
      }
    }
  }
  if (fig.addTypeBtn) {
    fig.addTypeBtn.disabled = false;
  }
}
function adjustSize(idx, delta) {
  const fig = figureViews[idx];
  if (!fig) return;
  setSize(idx, fig.beadRadius + delta);
}
function setSize(idx, value) {
  const fig = figureViews[idx];
  if (!fig) return;
  const next = Math.min(60, Math.max(5, Number.isFinite(value) ? value : fig.beadRadius));
  fig.beadRadius = next;
  if (fig.sizeDisplay) fig.sizeDisplay.textContent = next;
  if (fig.sizeSlider && fig.sizeSlider.value !== String(next)) fig.sizeSlider.value = String(next);
  updateConfig();
}
function updateConfig(options = {}) {
  syncSimpleFromFigures();
  render(options);
}
function removeBowl(idx) {
  var _dragState$fig;
  if (idx < 0) return;
  if (Array.isArray(SIMPLE.bowls)) {
    if (idx === 0) {
      if (SIMPLE.bowls.length <= 1) return;
    }
    if (idx >= 0 && idx < SIMPLE.bowls.length) {
      SIMPLE.bowls.splice(idx, 1);
    }
  }
  if (Array.isArray(STATE.bowls)) {
    if (idx === 0) {
      if (STATE.bowls.length > 1) {
        STATE.bowls.splice(0, 1);
      } else if (STATE.bowls.length === 1) {
        STATE.bowls[0] = {};
      }
    } else if (idx >= 0 && idx < STATE.bowls.length) {
      STATE.bowls.splice(idx, 1);
    }
  }
  if (dragState && ((_dragState$fig = dragState.fig) === null || _dragState$fig === void 0 ? void 0 : _dragState$fig.idx) === idx) {
    const {
      fig,
      pointerId
    } = dragState;
    if (fig !== null && fig !== void 0 && fig.svg) {
      fig.svg.removeEventListener("pointermove", onDrag);
      fig.svg.removeEventListener("pointerup", endDrag);
      fig.svg.removeEventListener("pointercancel", endDrag);
      try {
        fig.svg.releasePointerCapture(pointerId);
      } catch (_) {}
    }
    dragState = null;
  }
  if (Array.isArray(SIMPLE.bowls) && SIMPLE.bowls.length === 0) {
    var _SIMPLE$beadRadius8;
    SIMPLE.bowls.push({
      items: cloneDefaultItems(),
      beadRadius: (_SIMPLE$beadRadius8 = SIMPLE.beadRadius) !== null && _SIMPLE$beadRadius8 !== void 0 ? _SIMPLE$beadRadius8 : ADV.beadRadius
    });
  }
  const available = Array.isArray(SIMPLE.bowls) ? SIMPLE.bowls.length : 0;
  const desired = Math.max(1, Math.min(MAX_FIGURES, available));
  setVisibleCount(desired);
  render();
}
function render(options = {}) {
  const available = Array.isArray(SIMPLE.bowls) ? SIMPLE.bowls.length : 0;
  const maxVisible = Math.max(1, Math.min(MAX_FIGURES, available || 1));
  const currentVisible = getVisibleCount();
  if (currentVisible > maxVisible) {
    setVisibleCount(maxVisible);
  } else {
    setVisibleCount(currentVisible);
  }
  CFG = makeCFG();
  applySimpleToFigures(options);
  if (STATE.bowls.length > CFG.bowls.length) STATE.bowls.length = CFG.bowls.length;
  figureViews.forEach(fig => renderFigure(fig));
  applyFigureVisibility();
  refreshAltText("render");
}
function renderFigure(fig) {
  var _cfg$beadRadius, _ref3, _fig$beadRadius2;
  if (!fig || !fig.svg) return;
  const idx = fig.idx;
  if (idx >= getVisibleCount()) {
    fig.gBowls.innerHTML = "";
    return;
  }
  const cfg = CFG.bowls[idx];
  fig.gBowls.innerHTML = "";
  if (!cfg) return;
  const beadRadius = (_cfg$beadRadius = cfg.beadRadius) !== null && _cfg$beadRadius !== void 0 ? _cfg$beadRadius : (_ref3 = (_fig$beadRadius2 = fig.beadRadius) !== null && _fig$beadRadius2 !== void 0 ? _fig$beadRadius2 : SIMPLE.beadRadius) !== null && _ref3 !== void 0 ? _ref3 : ADV.beadRadius;
  fig.renderRadius = beadRadius;
  const beadD = beadRadius * 2;
  const g = mk("g", {
    class: "bowl"
  });
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
  const gBeads = mk("g", {
    class: "beads"
  });
  const instances = Array.isArray(cfg.instances) ? cfg.instances : [];
  const nBeads = instances.length;
  const bowlState = getBowlState(idx);
  const typePositions = bowlState.byType;
  const typeUsage = {};
  const placed = [];
  const cx = midX;
  const cy = rimY + bowlDepth;
  const rx = bowlWidth / 2 - beadRadius;
  const ry = bowlDepth - beadRadius;
  const minX = VB_W * 0.3;
  const maxX = VB_W * 0.7;
  const minY = VB_H * 0.5;
  const maxY = VB_H * 0.9;
  function randPos() {
    let candidate = null;
    for (let tries = 0; tries < 1000; tries++) {
      const x = minX + Math.random() * (maxX - minX);
      const y = minY + Math.random() * (maxY - minY);
      if ((x - cx) ** 2 / rx ** 2 + (y - cy) ** 2 / ry ** 2 > 1) continue;
      candidate = {
        x,
        y
      };
      const collision = placed.some(p => (p.x - candidate.x) ** 2 + (p.y - candidate.y) ** 2 < (beadD + CFG.beadGap) ** 2);
      if (!collision) return candidate;
    }
    return candidate || {
      x: cx,
      y: rimY + bowlDepth * 0.6
    };
  }
  for (let i = 0; i < nBeads; i++) {
    var _typeUsage$typeKey;
    const instance = instances[i];
    const typeKey = instance && typeof instance.typeId === "string" && instance.typeId ? instance.typeId : `type-${i}`;
    const emoji = sanitizeEmoji(instance === null || instance === void 0 ? void 0 : instance.emoji) || DEFAULT_ITEM_CONFIG[0].emoji;
    const useIdx = (_typeUsage$typeKey = typeUsage[typeKey]) !== null && _typeUsage$typeKey !== void 0 ? _typeUsage$typeKey : 0;
    const arr = Array.isArray(typePositions[typeKey]) ? typePositions[typeKey] : typePositions[typeKey] = [];
    let pos = arr[useIdx];
    if (!pos || !Number.isFinite(pos.x) || !Number.isFinite(pos.y)) {
      pos = randPos();
      arr[useIdx] = pos;
    }
    placed.push(pos);
    typeUsage[typeKey] = useIdx + 1;
    const bead = mk("text", {
      x: pos.x,
      y: pos.y,
      class: "bead beadShadow",
      "text-anchor": "middle",
      "dominant-baseline": "middle",
      "font-size": String(beadRadius * 1.6)
    });
    bead.textContent = emoji || DEFAULT_ITEM_CONFIG[0].emoji;
    bead.dataset.figure = String(idx);
    bead.dataset.bowl = String(idx);
    bead.dataset.type = typeKey;
    bead.dataset.typeIndex = String(useIdx);
    bead.addEventListener("pointerdown", startDrag);
    gBeads.appendChild(bead);
  }
  Object.keys(typePositions).forEach(key => {
    var _typeUsage$key;
    const used = (_typeUsage$key = typeUsage[key]) !== null && _typeUsage$key !== void 0 ? _typeUsage$key : 0;
    if (!Array.isArray(typePositions[key])) {
      typePositions[key] = [];
    } else if (typePositions[key].length > used) {
      typePositions[key].length = used;
    }
  });
  g.appendChild(bowlImg);
  g.appendChild(gBeads);
  fig.gBowls.appendChild(g);
}
function applyFigureVisibility() {
  const visible = getVisibleCount();
  if (figureGridEl) {
    if (visible > 0) {
      figureGridEl.dataset.figures = String(visible);
    } else {
      delete figureGridEl.dataset.figures;
    }
    if (visible < MAX_FIGURES) {
      figureGridEl.dataset.addVisible = "true";
    } else {
      delete figureGridEl.dataset.addVisible;
    }
  }
  if (controlsWrap) controlsWrap.classList.toggle("controlsWrap--split", visible > 1);
  if (gridEl && visible !== lastVisibleCount) {
    if (visible > 1) {
      const current = Number.parseFloat(gridEl.style.getPropertyValue("--side-width"));
      const base = Number.isFinite(current) ? current : initialSideWidth;
      const desired = Math.max(base, 500);
      gridEl.style.setProperty("--side-width", `${desired}px`);
    } else {
      gridEl.style.setProperty("--side-width", `${initialSideWidth}px`);
    }
  }
  lastVisibleCount = visible;
  if (addBtn) addBtn.style.display = visible < MAX_FIGURES ? "" : "none";
  panelEls.forEach((panel, idx) => {
    if (!panel) return;
    panel.style.display = idx < visible ? "" : "none";
  });
  exportToolbarEls.forEach((toolbar, idx) => {
    if (!toolbar) return;
    toolbar.style.display = idx < visible ? "" : "none";
  });
  figureViews.forEach(fig => {
    if (!fig || !fig.fieldset) return;
    fig.fieldset.style.display = fig.idx < visible ? "" : "none";
  });
  removeBtns.forEach((btn, idx) => {
    if (!btn) return;
    if (idx === 0) {
      const extraBowl = Array.isArray(SIMPLE.bowls) ? SIMPLE.bowls.length > 1 : false;
      btn.disabled = !(visible > 1 && extraBowl);
    } else {
      btn.disabled = idx >= visible;
    }
  });
}
function getBowlState(idx) {
  if (!STATE.bowls[idx] || typeof STATE.bowls[idx] !== "object" || Array.isArray(STATE.bowls[idx])) {
    STATE.bowls[idx] = {};
  }
  const bowlState = STATE.bowls[idx];
  if (!bowlState.byType || typeof bowlState.byType !== "object") {
    if (bowlState.byColor && typeof bowlState.byColor === "object") {
      bowlState.byType = bowlState.byColor;
    } else {
      bowlState.byType = {};
    }
  }
  if (bowlState.byColor) delete bowlState.byColor;
  return bowlState;
}
let dragState = null;
function startDrag(e) {
  const bead = e.target;
  if (!bead || typeof bead.getAttribute !== "function") return;
  const figIdx = Number.parseInt(bead.dataset.figure, 10);
  const fig = figureViews[figIdx];
  if (!fig || !fig.svg) return;
  const bowlIdx = Number.parseInt(bead.dataset.bowl, 10);
  const typeIdx = Number.parseInt(bead.dataset.typeIndex, 10);
  const typeKey = bead.dataset.type;
  const info = {
    bowlIdx: Number.isNaN(bowlIdx) ? null : bowlIdx,
    typeKey: typeof typeKey === "string" && typeKey ? typeKey : null,
    typeIndex: Number.isNaN(typeIdx) ? null : typeIdx
  };
  const pt = svgPoint(fig.svg, e);
  const x = parseFloat(bead.getAttribute("x"));
  const y = parseFloat(bead.getAttribute("y"));
  const offsetX = pt.x - x;
  const offsetY = pt.y - y;
  dragState = {
    bead,
    fig,
    info,
    offsetX,
    offsetY,
    pointerId: e.pointerId
  };
  fig.svg.addEventListener("pointermove", onDrag);
  fig.svg.addEventListener("pointerup", endDrag);
  fig.svg.addEventListener("pointercancel", endDrag);
  try {
    fig.svg.setPointerCapture(e.pointerId);
  } catch (_) {}
}
function onDrag(e) {
  if (!dragState) return;
  const {
    bead,
    fig,
    offsetX,
    offsetY
  } = dragState;
  const pt = svgPoint(fig.svg, e);
  bead.setAttribute("x", pt.x - offsetX);
  bead.setAttribute("y", pt.y - offsetY);
  storeDragPosition();
}
function endDrag(e) {
  if (!dragState) return;
  const {
    fig,
    pointerId
  } = dragState;
  fig.svg.removeEventListener("pointermove", onDrag);
  fig.svg.removeEventListener("pointerup", endDrag);
  fig.svg.removeEventListener("pointercancel", endDrag);
  try {
    fig.svg.releasePointerCapture(pointerId);
  } catch (_) {}
  storeDragPosition();
  dragState = null;
}
function storeDragPosition() {
  if (!dragState) return;
  const {
    bead,
    info
  } = dragState;
  const {
    bowlIdx,
    typeKey,
    typeIndex
  } = info;
  if (bowlIdx == null || typeKey == null || typeIndex == null) return;
  const x = parseFloat(bead.getAttribute("x"));
  const y = parseFloat(bead.getAttribute("y"));
  if (!Number.isFinite(x) || !Number.isFinite(y)) return;
  const bowlState = getBowlState(bowlIdx);
  const typePositions = bowlState.byType;
  const arr = Array.isArray(typePositions[typeKey]) ? typePositions[typeKey] : typePositions[typeKey] = [];
  arr[typeIndex] = {
    x,
    y
  };
}
function svgPoint(svgEl, evt) {
  const p = svgEl.createSVGPoint();
  p.x = evt.clientX;
  p.y = evt.clientY;
  return p.matrixTransform(svgEl.getScreenCTM().inverse());
}
function collectVisibleFigureClones() {
  const visible = getVisibleCount();
  const clones = [];
  for (let i = 0; i < visible; i++) {
    const fig = figureViews[i];
    if (!(fig !== null && fig !== void 0 && fig.svg)) continue;
    const clone = fig.svg.cloneNode(true);
    clone.removeAttribute("id");
    clones.push(clone);
  }
  return clones;
}
function layoutForExport(count) {
  const columns = count > 1 ? 2 : 1;
  const rows = Math.max(1, Math.ceil(count / columns));
  return {
    columns,
    rows,
    width: columns * VB_W,
    height: rows * VB_H
  };
}
async function buildExportSvg() {
  const clones = collectVisibleFigureClones();
  if (!clones.length) return null;
  const layout = layoutForExport(clones.length);
  const exportSvg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  exportSvg.setAttribute("xmlns", "http://www.w3.org/2000/svg");
  exportSvg.setAttribute("viewBox", `0 0 ${layout.width} ${layout.height}`);
  exportSvg.setAttribute("width", String(layout.width));
  exportSvg.setAttribute("height", String(layout.height));
  clones.forEach((clone, index) => {
    const col = index % layout.columns;
    const row = Math.floor(index / layout.columns);
    clone.setAttribute("x", String(col * VB_W));
    clone.setAttribute("y", String(row * VB_H));
    clone.setAttribute("width", String(VB_W));
    clone.setAttribute("height", String(VB_H));
    clone.setAttribute("id", `export-bowl-${index + 1}`);
    exportSvg.appendChild(clone);
  });
  annotateExportClones(clones);
  await inlineImages(exportSvg);
  return {
    svg: exportSvg,
    layout,
    count: clones.length
  };
}
function exportFileName(idx, count, type) {
  const base = count > 1 ? "kuler" : `kuler${idx + 1}`;
  return `${base}.${type}`;
}
async function downloadSvgFigure(idx) {
  if (idx >= getVisibleCount()) return;
  const exportData = await buildExportSvg();
  if (!exportData) return;
  const data = new XMLSerializer().serializeToString(exportData.svg);
  const blob = new Blob([data], {
    type: "image/svg+xml"
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = exportFileName(idx, exportData.count, "svg");
  a.click();
  URL.revokeObjectURL(url);
}
async function downloadPngFigure(idx) {
  if (idx >= getVisibleCount()) return;
  const exportData = await buildExportSvg();
  if (!exportData) return;
  const data = new XMLSerializer().serializeToString(exportData.svg);
  const svgBlob = new Blob([data], {
    type: "image/svg+xml"
  });
  const url = URL.createObjectURL(svgBlob);
  const img = new Image();
  img.onload = () => {
    const canvas = document.createElement("canvas");
    canvas.width = exportData.layout.width;
    canvas.height = exportData.layout.height;
    const ctx = canvas.getContext("2d");
    ctx.drawImage(img, 0, 0);
    URL.revokeObjectURL(url);
    canvas.toBlob(blob => {
      if (!blob) return;
      const pngUrl = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = pngUrl;
      a.download = exportFileName(idx, exportData.count, "png");
      a.click();
      URL.revokeObjectURL(pngUrl);
    });
  };
  img.src = url;
}

/* ===== ALT-TEKST ===== */
function getAltTextState() {
  return {
    text: typeof SIMPLE.altText === "string" ? SIMPLE.altText : "",
    source: SIMPLE.altTextSource === "manual" ? "manual" : "auto"
  };
}

function getKulerTitle() {
  if (typeof document !== "undefined" && document && typeof document.title === "string" && document.title.trim()) {
    return document.title.trim();
  }
  return "Kuler";
}

function ensureAltTextAnchor() {
  if (typeof document === "undefined") return null;
  if (altTextAnchor && document.body && document.body.contains(altTextAnchor)) {
    return altTextAnchor;
  }
  altTextAnchor = document.getElementById("kuler-alt-anchor");
  if (!altTextAnchor) {
    altTextAnchor = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    altTextAnchor.setAttribute("id", "kuler-alt-anchor");
    altTextAnchor.setAttribute("width", "0");
    altTextAnchor.setAttribute("height", "0");
    altTextAnchor.style.position = "absolute";
    altTextAnchor.style.left = "-9999px";
    altTextAnchor.style.width = "0";
    altTextAnchor.style.height = "0";
    if (document.body) document.body.appendChild(altTextAnchor);
  }
  return altTextAnchor;
}

function getItemLabel(item) {
  if (!item || typeof item !== "object") return "";
  const label = sanitizeLabel(item.label);
  if (label) return label;
  const emoji = sanitizeEmoji(item.emoji);
  if (emoji) return emoji;
  return "element";
}

function formatItemCount(count, item) {
  const safe = sanitizeCount(count);
  if (!safe) return "";
  const label = getItemLabel(item);
  if (label) return `${safe} ${label}`;
  return safe === 1 ? "1 element" : `${safe} elementer`;
}

function formatList(items) {
  if (!Array.isArray(items) || items.length === 0) return "";
  if (items.length === 1) return items[0];
  if (items.length === 2) return `${items[0]} og ${items[1]}`;
  const last = items[items.length - 1];
  return `${items.slice(0, -1).join(", ")} og ${last}`;
}

function buildBowlSummaries() {
  const visible = getVisibleCount();
  const summaries = [];
  for (let i = 0; i < visible; i++) {
    const bowl = ensureSimpleBowl(i);
    const counts = Array.isArray(bowl === null || bowl === void 0 ? void 0 : bowl.items) ? bowl.items : [];
    let total = 0;
    const parts = [];
    counts.forEach(item => {
      const value = sanitizeCount(item === null || item === void 0 ? void 0 : item.count);
      if (value > 0) {
        parts.push(formatItemCount(value, item));
        total += value;
      }
    });
    const indexLabel = `Bolle ${i + 1}`;
    const title = `${indexLabel} med symboler`;
    let description;
    if (total === 0) {
      description = `${indexLabel} er tom.`;
    } else {
      const details = formatList(parts);
      description = details ? `${indexLabel} inneholder ${details}.` : `${indexLabel} inneholder symboler.`;
    }
    summaries.push({
      title,
      description,
      total
    });
  }
  return summaries;
}

function buildKulerAltText() {
  const summaries = buildBowlSummaries();
  if (!summaries.length) return "Illustrasjonen viser ingen boller.";
  const intro = summaries.length === 1 ? "Illustrasjonen viser en bolle med symboler." : `Illustrasjonen viser ${summaries.length} boller med symboler.`;
  const details = summaries.map(s => s.description).join(" ");
  return `${intro} ${details}`.trim();
}

function applyAltTextToDom(autoAltText) {
  if (typeof window === "undefined" || !window.MathVisAltText) return;
  const state = getAltTextState();
  const trimmed = (state.text || "").trim();
  const useManual = state.source === "manual" && trimmed;
  const generated = typeof autoAltText === "string" ? autoAltText : buildKulerAltText();
  const description = useManual ? trimmed : generated;
  const anchor = ensureAltTextAnchor();
  if (!anchor) return;
  const nodes = window.MathVisAltText.ensureSvgA11yNodes(anchor);
  const title = getKulerTitle();
  if (nodes.titleEl) nodes.titleEl.textContent = title;
  if (nodes.descEl) nodes.descEl.textContent = description;
  if (figureGridEl) {
    figureGridEl.setAttribute("role", "img");
    figureGridEl.setAttribute("aria-label", title);
    if (nodes.titleEl && nodes.titleEl.id) {
      figureGridEl.setAttribute("aria-labelledby", nodes.titleEl.id);
    }
    if (nodes.descEl && nodes.descEl.id) {
      figureGridEl.setAttribute("aria-describedby", nodes.descEl.id);
    }
  }
  const summaries = buildBowlSummaries();
  const visible = getVisibleCount();
  figureViews.forEach((fig, idx) => {
    if (!fig || !fig.svg) return;
    if (idx >= visible) {
      fig.svg.setAttribute("aria-hidden", "true");
      fig.svg.removeAttribute("role");
      fig.svg.removeAttribute("aria-label");
      fig.svg.removeAttribute("aria-labelledby");
      fig.svg.removeAttribute("aria-describedby");
      return;
    }
    fig.svg.removeAttribute("aria-hidden");
    const bowlInfo = summaries[idx];
    const bowlTitle = bowlInfo ? bowlInfo.title : `Bolle ${idx + 1}`;
    const bowlDesc = useManual ? trimmed : bowlInfo ? bowlInfo.description : description;
    const svgNodes = window.MathVisAltText.ensureSvgA11yNodes(fig.svg);
    if (svgNodes.titleEl) svgNodes.titleEl.textContent = bowlTitle;
    if (svgNodes.descEl) svgNodes.descEl.textContent = bowlDesc;
    fig.svg.setAttribute("role", "img");
    fig.svg.setAttribute("aria-label", bowlTitle);
    if (svgNodes.titleEl && svgNodes.titleEl.id) fig.svg.setAttribute("aria-labelledby", svgNodes.titleEl.id);
    if (svgNodes.descEl && svgNodes.descEl.id) fig.svg.setAttribute("aria-describedby", svgNodes.descEl.id);
  });
}

function refreshAltText(reason) {
  if (typeof window === "undefined" || !window.MathVisAltText) return;
  const signature = buildKulerAltText();
  applyAltTextToDom(signature);
  if (!altTextManager) return;
  altTextManager.refresh(reason || "auto", signature);
}

function initAltTextManager() {
  if (altTextManager || typeof window === "undefined" || !window.MathVisAltText || !exportCard) return;
  const anchor = ensureAltTextAnchor();
  altTextManager = window.MathVisAltText.create({
    svg: () => anchor,
    container: exportCard,
    getTitle: getKulerTitle,
    getState: () => getAltTextState(),
    setState: (text, source) => {
      SIMPLE.altText = typeof text === "string" ? text : "";
      SIMPLE.altTextSource = source === "manual" ? "manual" : "auto";
      applyAltTextToDom();
    },
    generate: () => buildKulerAltText(),
    getSignature: () => buildKulerAltText(),
    getAutoMessage: reason => reason && reason.startsWith("manual") ? "Alternativ tekst oppdatert." : "Alternativ tekst oppdatert automatisk.",
    getManualMessage: () => "Alternativ tekst oppdatert manuelt."
  });
  if (altTextManager) {
    altTextManager.applyCurrent();
    applyAltTextToDom();
  }
}

function annotateExportClones(clones) {
  if (!Array.isArray(clones) || !clones.length || typeof window === "undefined" || !window.MathVisAltText) return;
  const signature = buildKulerAltText();
  if (altTextManager && typeof altTextManager.refresh === "function") {
    altTextManager.refresh("export", signature);
    altTextManager.applyCurrent();
  } else if (altTextManager && typeof altTextManager.notifyFigureChange === "function") {
    altTextManager.notifyFigureChange(signature);
  }
  const state = getAltTextState();
  const trimmed = (state.text || "").trim();
  const useManual = state.source === "manual" && trimmed;
  const fallback = useManual ? trimmed : signature;
  const summaries = buildBowlSummaries();
  clones.forEach((clone, index) => {
    if (!clone) return;
    const bowlInfo = summaries[index];
    const bowlTitle = bowlInfo ? bowlInfo.title : `Bolle ${index + 1}`;
    const bowlDesc = useManual ? trimmed : bowlInfo ? bowlInfo.description : fallback;
    const nodes = window.MathVisAltText.ensureSvgA11yNodes(clone);
    if (nodes.titleEl) nodes.titleEl.textContent = bowlTitle;
    if (nodes.descEl) nodes.descEl.textContent = bowlDesc;
    clone.setAttribute("role", "img");
    clone.setAttribute("aria-label", bowlTitle);
    if (nodes.titleEl && nodes.titleEl.id) clone.setAttribute("aria-labelledby", nodes.titleEl.id);
    if (nodes.descEl && nodes.descEl.id) clone.setAttribute("aria-describedby", nodes.descEl.id);
  });
}

/* ===== helpers ===== */
function mk(n, attrs = {}) {
  const e = document.createElementNS("http://www.w3.org/2000/svg", n);
  for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v);
  return e;
}
function createTypeId() {
  typeIdCounter += 1;
  return `emoji-type-${typeIdCounter}`;
}
function cloneDefaultItems() {
  return DEFAULT_ITEM_CONFIG.map(item => ({
    id: createTypeId(),
    emoji: sanitizeEmoji(item.emoji),
    label: sanitizeLabel(item.label),
    count: sanitizeCount(item.count)
  }));
}
function createEmptyItem() {
  return {
    id: createTypeId(),
    emoji: "",
    label: "",
    count: 0
  };
}
function fallbackInstances() {
  const instances = [];
  DEFAULT_ITEM_CONFIG.forEach((item, index) => {
    const emoji = sanitizeEmoji(item.emoji) || DEFAULT_ITEM_CONFIG[0].emoji;
    const count = Math.max(1, sanitizeCount(item.count));
    const typeId = FALLBACK_TYPE_IDS[index] || `fallback-${index}`;
    for (let i = 0; i < count; i++) {
      instances.push({
        emoji,
        typeId
      });
    }
  });
  if (!instances.length) {
    instances.push({
      emoji: DEFAULT_ITEM_CONFIG[0].emoji,
      typeId: FALLBACK_TYPE_IDS[0] || "fallback-0"
    });
  }
  return instances;
}
function sanitizeCount(value) {
  const num = Number.isFinite(value) ? Math.round(value) : 0;
  return Math.max(0, num);
}
function sanitizeEmoji(value) {
  if (typeof value !== "string") return "";
  return value.trim().slice(0, 8);
}
function sanitizeLabel(value) {
  if (typeof value !== "string") return "";
  return value.trim().slice(0, 40);
}
async function inlineImages(svgEl) {
  const imgs = svgEl.querySelectorAll("image");
  await Promise.all(Array.from(imgs).map(async img => {
    const src = img.getAttribute("href");
    if (!src) return;
    const res = await fetch(src);
    const blob = await res.blob();
    const dataUrl = await new Promise(resolve => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.readAsDataURL(blob);
    });
    img.setAttribute("href", dataUrl);
  }));
}
