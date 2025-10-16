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
    insideK: {
      right: 1.5,
      other: 1.5
    },
    // vinkelverdi (innsiden)
    outsideK: {
      right: 0.5,
      other: 0.50
    },
    // punktnavn (utsiden)
    outsidePad: 0,
    // Hindrer at punktnavn "flyr" for langt ut
    outsideMaxFactor: 0.90,
    // maks 90% av korteste naboside
    outsideMin: 6 // liten gulvavstand ut fra hjørnet
  },
  rightAngleMarker: {
    vertexScale: 0.68,
    vertexMin: 11,
    vertexMax: 24,
    heightScale: 0.38,
    heightMin: 11,
    heightMax: 18,
    heightMaxRatio: 0.65
  }
};

/* ---------- STATE (UI) ---------- */
const STATE = {
  specsText: "",
  fig1: {
    sides: {
      default: "value",
      a: "inherit",
      b: "inherit",
      c: "inherit",
      d: "inherit",
      aText: "a",
      bText: "b",
      cText: "c",
      dText: "d"
    },
    angles: {
      default: "custom+mark+value",
      A: "inherit",
      B: "inherit",
      C: "inherit",
      D: "inherit",
      AText: "A",
      BText: "B",
      CText: "C",
      DText: "D"
    }
  },
  fig2: {
    sides: {
      default: "none",
      a: "inherit",
      b: "inherit",
      c: "inherit",
      d: "inherit",
      aText: "a",
      bText: "b",
      cText: "c",
      dText: "d"
    },
    angles: {
      default: "custom+mark+value",
      A: "inherit",
      B: "inherit",
      C: "inherit",
      D: "inherit",
      AText: "A",
      BText: "B",
      CText: "C",
      DText: "D"
    }
  },
  layout: "row", // "row" | "col"
  altText: "",
  altTextSource: "auto"
};
const DEFAULT_STATE = JSON.parse(JSON.stringify(STATE));

const NKANT_DEFAULT_SIMPLE_STATE = {
  sides: 8,
  showDiagonals: true,
  snapAngle: 15,
  radius: 160,
  altText: "",
  altTextSource: "auto"
};

const NKANT_FIVE_POINT_STAR_STATE = {
  sides: 5,
  showDiagonals: true,
  snapAngle: 18,
  radius: 150,
  altText: "",
  altTextSource: "auto"
};

function ensureStateDefaults() {
  const fill = (target, defaults) => {
    if (!defaults || typeof defaults !== "object") return;
    Object.keys(defaults).forEach(key => {
      const defVal = defaults[key];
      const curVal = target[key];
      if (defVal && typeof defVal === "object" && !Array.isArray(defVal)) {
        if (!curVal || typeof curVal !== "object") {
          target[key] = Array.isArray(defVal) ? defVal.slice() : {
            ...defVal
          };
        }
        fill(target[key], defVal);
      } else if (!(key in target)) {
        target[key] = Array.isArray(defVal) ? defVal.slice() : defVal;
      }
    });
  };
  fill(STATE, DEFAULT_STATE);
  return STATE;
}
let altTextManager = null;
let lastRenderSummary = {
  layoutMode: STATE.layout || 'row',
  count: 0,
  jobs: []
};
const nkantNumberFormatter = typeof Intl !== 'undefined' ? new Intl.NumberFormat('nb-NO', {
  minimumFractionDigits: 0,
  maximumFractionDigits: 2
}) : null;
function nkantFormatNumber(value) {
  if (!Number.isFinite(value)) return String(value);
  if (nkantNumberFormatter) return nkantNumberFormatter.format(value);
  return String(Math.round(value * 100) / 100);
}
function nkantFormatList(items) {
  if (!Array.isArray(items) || items.length === 0) return '';
  if (items.length === 1) return items[0];
  if (items.length === 2) return `${items[0]} og ${items[1]}`;
  const head = items.slice(0, -1);
  const tail = items[items.length - 1];
  return `${head.join(', ')} og ${tail}`;
}
function cloneJobForSummary(job) {
  if (!job || typeof job !== 'object') return null;
  const cloneDimension = entry => {
    if (!entry || typeof entry !== 'object') return null;
    const label = typeof entry.label === 'string' ? entry.label : '';
    const value = Number.isFinite(entry.value) ? entry.value : null;
    const requested = Boolean(entry.requested);
    return {
      label,
      value,
      requested
    };
  };
  if (job.type === 'circle') {
    return {
      type: 'circle',
      radius: cloneDimension(job.obj && job.obj.radius),
      diameter: cloneDimension(job.obj && job.obj.diameter)
    };
  }
  if (job.type === 'polygon') {
    const summary = {
      type: 'polygon',
      sides: job.obj && Number.isFinite(job.obj.sides) ? Math.max(3, Math.round(job.obj.sides)) : null,
      side: cloneDimension(job.obj && job.obj.side)
    };
    const decorations = summarizeJobDecorations(job);
    if (decorations.length) summary.decorations = decorations;
    return summary;
  }
  if (job.type === 'polygonArc') {
    const base = job.obj && job.obj.polygon ? job.obj.polygon : null;
    return {
      type: 'polygonArc',
      polygon: base ? {
        sides: Number.isFinite(base.sides) ? Math.max(3, Math.round(base.sides)) : null,
        side: cloneDimension(base.side)
      } : null,
      side: typeof (job.obj && job.obj.side) === 'string' ? job.obj.side : '',
      radius: cloneDimension(job.obj && job.obj.radius),
      diameter: cloneDimension(job.obj && job.obj.diameter),
      decorations: summarizeJobDecorations(job)
    };
  }
  if (job.type === 'doubleTri') {
    const shared = job.obj && job.obj.shared ? job.obj.shared : null;
    const cloneValues = source => {
      const out = {};
      if (!source || typeof source !== 'object') return out;
      ['a', 'b', 'c', 'd', 'A', 'B', 'C', 'D'].forEach(key => {
        const val = source[key];
        if (typeof val === 'number' && Number.isFinite(val)) {
          out[key] = val;
        }
      });
      return out;
    };
    const result = {
      type: 'doubleTri',
      shared: shared ? {
        label: typeof shared.label === 'string' ? shared.label : '',
        value: Number.isFinite(shared.value) ? shared.value : null,
        requested: Boolean(shared.requested)
      } : null,
      first: {
        values: cloneValues(job.obj && job.obj.first)
      },
      second: {
        values: cloneValues(job.obj && job.obj.second)
      }
    };
    const decorations = summarizeJobDecorations(job);
    if (decorations.length) result.decorations = decorations;
    if (job.angleMarks && typeof job.angleMarks === 'object') {
      result.angleMarks = { ...job.angleMarks };
    }
    return result;
  }
  const values = {};
  const source = job.obj && typeof job.obj === 'object' ? job.obj : {};
  ['a', 'b', 'c', 'd', 'A', 'B', 'C', 'D'].forEach(key => {
    const val = source[key];
    if (typeof val === 'number' && Number.isFinite(val)) {
      values[key] = val;
    }
  });
  const decorations = summarizeJobDecorations(job);
  const result = {
    type: job.type === 'tri' ? 'tri' : 'quad',
    values
  };
  if (decorations.length) result.decorations = decorations;
  return result;
}
function summarizeJobDecorations(job) {
  if (!job || typeof job !== 'object' || !Array.isArray(job.decorations)) return [];
  const cloneDimension = entry => {
    if (!entry || typeof entry !== 'object') return null;
    const label = typeof entry.label === 'string' ? entry.label : '';
    const value = Number.isFinite(entry.value) ? entry.value : null;
    const requested = Boolean(entry.requested);
    return { label, value, requested };
  };
  const determineLetters = () => {
    if (job.type === 'tri') return ['A', 'B', 'C'];
    if (job.type === 'quad' || job.type === 'doubleTri') return ['A', 'B', 'C', 'D'];
    if (job.type === 'polygonArc') {
      const sides = job.obj && job.obj.polygon && Number.isFinite(job.obj.polygon.sides) ? Math.max(3, Math.round(job.obj.polygon.sides)) : null;
      if (Number.isFinite(sides)) {
        return Array.from({ length: sides }, (_, i) => indexToLetter(i, true));
      }
      return ['A', 'B', 'C', 'D'];
    }
    if (job.type === 'polygon') {
      const sides = job.obj && Number.isFinite(job.obj.sides) ? Math.max(3, Math.round(job.obj.sides)) : null;
      if (Number.isFinite(sides)) {
        return Array.from({ length: sides }, (_, i) => indexToLetter(i, true));
      }
      return ['A', 'B', 'C', 'D'];
    }
    return [];
  };
  const letters = determineLetters();
  if (!letters.length) return [];
  const seen = new Set();
  const out = [];
  job.decorations.forEach(dec => {
    if (!dec || typeof dec !== 'object') return;
    if (dec.type === 'diagonal') {
      const from = String(dec.from || '').toUpperCase();
      const to = String(dec.to || '').toUpperCase();
      if (!letters.includes(from) || !letters.includes(to) || from === to) return;
      const key = from < to ? `${from}${to}` : `${to}${from}`;
      const tag = `diag:${key}`;
      if (seen.has(tag)) return;
      seen.add(tag);
      out.push({
        type: 'diagonal',
        from: key[0],
        to: key[1]
      });
    } else if (dec.type === 'height') {
      const resolved = resolveHeightBase(dec, letters);
      if (!resolved) return;
      const tag = `height:${resolved.from}:${resolved.base}`;
      if (seen.has(tag)) return;
      seen.add(tag);
      out.push({
        type: 'height',
        from: resolved.from,
        base: resolved.base,
        implied: Boolean(resolved.implied)
      });
    } else if (dec.type === 'semicircle') {
      const from = String(dec.from || '').toUpperCase();
      const to = String(dec.to || '').toUpperCase();
      if (!from || !to || from === to) return;
      if (letters.length && (!letters.includes(from) || !letters.includes(to))) return;
      const key = from < to ? `${from}${to}` : `${to}${from}`;
      const tag = `semicircle:${key}`;
      if (seen.has(tag)) return;
      seen.add(tag);
      const entry = {
        type: 'semicircle',
        side: key
      };
      const radius = cloneDimension(dec.radius);
      const diameter = cloneDimension(dec.diameter);
      if (radius) entry.radius = radius;
      if (diameter) entry.diameter = diameter;
      out.push(entry);
    } else if (dec.type === 'square') {
      const from = String(dec.from || '').toUpperCase();
      const to = String(dec.to || '').toUpperCase();
      if (!letters.includes(from) || !letters.includes(to) || from === to) return;
      const key = from < to ? `${from}${to}` : `${to}${from}`;
      const tag = `square:${key}`;
      if (seen.has(tag)) return;
      seen.add(tag);
      out.push({
        type: 'square',
        side: key
      });
    }
  });
  return out;
}
function buildAngleMarkSummary(entries) {
  if (!Array.isArray(entries)) return {};
  const out = {};
  entries.forEach(entry => {
    if (!entry || entry.length < 3) return;
    const [key, res, angleDeg] = entry;
    if (!key) return;
    const info = typeof res === 'object' && res ? res : null;
    const label = info && typeof info.pointLabel === 'string' && info.pointLabel.trim() ? info.pointLabel.trim() : key;
    out[key] = {
      marked: Boolean(info && info.mark),
      right: Boolean(info && info.mark) && Math.abs(angleDeg - 90) < 0.5,
      label
    };
  });
  return out;
}
function describeAngleMarks(angleMarks) {
  if (!angleMarks || typeof angleMarks !== 'object') return '';
  const marked = Object.values(angleMarks).filter(info => info && info.marked);
  if (!marked.length) return '';
  const rightAngles = marked.filter(info => info.right).map(info => info.label).filter(Boolean);
  const otherAngles = marked.filter(info => !info.right).map(info => info.label).filter(Boolean);
  const parts = [];
  if (rightAngles.length) {
    const list = nkantFormatList(rightAngles);
    if (rightAngles.length === 1) {
      parts.push(`Vinkel ${rightAngles[0]} er markert som rett vinkel.`);
    } else {
      parts.push(`Vinklene ${list} er markert som rette vinkler.`);
    }
  }
  if (otherAngles.length) {
    const list = nkantFormatList(otherAngles);
    if (otherAngles.length === 1) {
      parts.push(`Vinkel ${otherAngles[0]} er markert.`);
    } else {
      parts.push(`Vinklene ${list} er markert.`);
    }
  }
  return parts.join(' ');
}
function describeDecorationsSummary(decorations) {
  if (!Array.isArray(decorations) || !decorations.length) return '';
  const diagonals = [];
  const heights = [];
  const semicircles = [];
  const squares = [];
  decorations.forEach(dec => {
    if (!dec || typeof dec !== 'object') return;
    if (dec.type === 'diagonal' && dec.from && dec.to) {
      diagonals.push(`${dec.from}${dec.to}`);
    } else if (dec.type === 'height' && dec.from && dec.base) {
      heights.push({
        from: dec.from,
        base: dec.base
      });
    } else if (dec.type === 'semicircle' && dec.side) {
      semicircles.push({
        side: dec.side,
        radius: dec.radius,
        diameter: dec.diameter
      });
    } else if (dec.type === 'square' && dec.side) {
      squares.push(dec.side);
    }
  });
  const parts = [];
  if (diagonals.length) {
    const list = nkantFormatList(diagonals);
    if (diagonals.length === 1) {
      parts.push(`Diagonal ${diagonals[0]} er tegnet som stiplet linje.`);
    } else {
      parts.push(`Diagonalene ${list} er tegnet som stiplede linjer.`);
    }
  }
  if (heights.length) {
    const phrases = heights.map(h => `fra ${h.from} til ${h.base}`);
    const list = nkantFormatList(phrases);
    if (heights.length === 1) {
      parts.push(`Høyden ${phrases[0]} er tegnet som stiplet linje.`);
    } else {
      parts.push(`Høydene ${list} er tegnet som stiplede linjer.`);
    }
  }
  if (semicircles.length) {
    const phrases = semicircles.map(info => {
      let base = `halvsirkel på side ${info.side}`;
      const dims = [];
      const radiusText = describeDimensionEntry(info.radius, 'radius');
      const diameterText = describeDimensionEntry(info.diameter, 'diameter');
      if (radiusText) dims.push(radiusText);
      if (diameterText) dims.push(diameterText);
      if (dims.length) {
        const dimList = nkantFormatList(dims);
        base += ` med ${dimList}`;
      }
      return base;
    });
    const list = nkantFormatList(phrases);
    if (phrases.length === 1) {
      parts.push(`Det er tegnet en ${phrases[0]}.`);
    } else {
      parts.push(`Det er tegnet ${list}.`);
    }
  }
  if (squares.length) {
    if (squares.length === 1) {
      parts.push(`Det er tegnet et kvadrat på side ${squares[0]}.`);
    } else {
      const list = nkantFormatList(squares.map(side => `side ${side}`));
      parts.push(`Det er tegnet kvadrater på ${list}.`);
    }
  }
  return parts.join(' ');
}
function describeDimensionEntry(entry, noun) {
  if (!entry || typeof entry !== 'object') return '';
  const label = typeof entry.label === 'string' ? entry.label.trim() : '';
  const numeric = Number.isFinite(entry.value) ? nkantFormatNumber(entry.value) : null;
  if (label && /^[-+]?\d+(?:[.,]\d+)?$/.test(label.replace(/,/g, '.'))) {
    return `${noun} ${label.replace('.', ',')}`;
  }
  if (label) {
    return `${noun} merket ${label}`;
  }
  if (numeric) {
    return `${noun} ${numeric}`;
  }
  return '';
}
function getNkantAltSummary() {
  const layoutMode = lastRenderSummary && typeof lastRenderSummary.layoutMode === 'string' ? lastRenderSummary.layoutMode : (STATE.layout || 'row');
  const jobs = lastRenderSummary && Array.isArray(lastRenderSummary.jobs) ? lastRenderSummary.jobs : [];
  const count = lastRenderSummary && typeof lastRenderSummary.count === 'number' ? lastRenderSummary.count : jobs.length;
  return {
    layoutMode,
    count,
    jobs
  };
}
function buildNkantAltText(summary) {
  const data = summary || getNkantAltSummary();
  const count = data && typeof data.count === 'number' ? data.count : 0;
  if (!count) {
    return 'Ingen figurer.';
  }
  const sentences = [];
  sentences.push(`Figuren viser ${count === 1 ? 'én figur' : `${count} figurer`}.`);
  if (count > 1) {
    const placement = data.layoutMode === 'col' ? 'under hverandre' : 'ved siden av hverandre';
    sentences.push(`Figurene er plassert ${placement}.`);
  }
  const jobs = Array.isArray(data.jobs) ? data.jobs : [];
  jobs.forEach((job, idx) => {
    if (!job) return;
    if (job.type === 'circle') {
      let sentence = `Figur ${idx + 1} er en sirkel.`;
      const radiusInfo = describeDimensionEntry(job.radius, 'Radius');
      if (radiusInfo) {
        sentence += ` ${radiusInfo}.`;
      }
      const diameterInfo = describeDimensionEntry(job.diameter, 'Diameter');
      if (job.diameter && diameterInfo) {
        sentence += ` ${diameterInfo}.`;
      }
      sentences.push(sentence.trim());
      return;
    }
    if (job.type === 'polygon') {
      const count = job.sides && Number.isFinite(job.sides) ? Math.max(3, Math.round(job.sides)) : 5;
      let sentence = `Figur ${idx + 1} er en mangekant med ${count} sider.`;
      const sideInfo = describeDimensionEntry(job.side, 'Side');
      if (sideInfo) {
        sentence += ` ${sideInfo}.`;
      }
      sentences.push(sentence.trim());
      return;
    }
    if (job.type === 'polygonArc') {
      const polygon = job.polygon || {};
      const count = polygon.sides && Number.isFinite(polygon.sides) ? Math.max(3, Math.round(polygon.sides)) : null;
      const sideLabel = typeof job.side === 'string' && job.side ? job.side : '';
      let sentence = `Figur ${idx + 1} er en mangekant${count ? ` med ${count} sider` : ''} med en halvsirkel på side${sideLabel ? ` ${sideLabel}` : ''}.`;
      const sideInfo = describeDimensionEntry(polygon.side, 'Side');
      if (sideInfo) {
        sentence += ` ${sideInfo}.`;
      }
      const radiusInfo = describeDimensionEntry(job.radius, 'Radius');
      if (radiusInfo) {
        sentence += ` ${radiusInfo}.`;
      }
      const diameterInfo = describeDimensionEntry(job.diameter, 'Diameter');
      if (job.diameter && diameterInfo) {
        sentence += ` ${diameterInfo}.`;
      }
      const decoSentence = describeDecorationsSummary(job.decorations);
      if (decoSentence) {
        sentence += ` ${decoSentence}`;
      }
      sentences.push(sentence.trim());
      return;
    }
    if (job.type === 'doubleTri') {
      const shared = job.shared || {};
      const sharedLabelRaw = shared && typeof shared.label === 'string' ? shared.label.trim() : '';
      const sharedLabel = sharedLabelRaw || 'AB';
      const sharedValue = shared && Number.isFinite(shared.value) ? nkantFormatNumber(shared.value) : null;
      let sentence = `Figur ${idx + 1} består av to trekanter som deler siden ${sharedLabel}.`;
      if (sharedValue) {
        sentence += ` Den delte siden ${sharedLabel} er ${sharedValue}.`;
      }
      const firstValues = job.first && job.first.values ? job.first.values : {};
      const secondValues = job.second && job.second.values ? job.second.values : {};
      const appendTriangleDescription = (values, label, angleKeys) => {
        const sideList = [];
        if (values.a != null && Number.isFinite(values.a)) sideList.push(`a=${nkantFormatNumber(values.a)}`);
        if (values.b != null && Number.isFinite(values.b)) sideList.push(`b=${nkantFormatNumber(values.b)}`);
        if (values.c != null && Number.isFinite(values.c)) sideList.push(`c=${nkantFormatNumber(values.c)}`);
        if (sideList.length) {
          sentence += ` Trekanten ${label} har sider ${nkantFormatList(sideList)}.`;
        } else {
          sentence += ` Trekanten ${label} er tegnet.`;
        }
        const angleList = angleKeys.map(key => {
          const val = values[key];
          if (val != null && Number.isFinite(val)) {
            return `${key}=${nkantFormatNumber(val)}°`;
          }
          return null;
        }).filter(Boolean);
        if (angleList.length) {
          sentence += ` Vinkler ${nkantFormatList(angleList)}.`;
        }
      };
      appendTriangleDescription(firstValues, 'ABC', ['A', 'B', 'C']);
      appendTriangleDescription(secondValues, 'ABD', ['A', 'B', 'D']);
      const markSentence = describeAngleMarks(job.angleMarks);
      if (markSentence) {
        sentence += ` ${markSentence}`;
      }
      const decoSentence = describeDecorationsSummary(job.decorations);
      if (decoSentence) {
        sentence += ` ${decoSentence}`;
      }
      sentences.push(sentence.trim());
      return;
    }
    const typeLabel = job.type === 'tri' ? 'trekant' : 'firkant';
    const sides = [];
    const angles = [];
    const values = job.values || {};
    ['a', 'b', 'c', 'd'].forEach(key => {
      if (values[key] != null && Number.isFinite(values[key])) {
        sides.push(`${key}=${nkantFormatNumber(values[key])}`);
      }
    });
    ['A', 'B', 'C', 'D'].forEach(key => {
      if (values[key] != null && Number.isFinite(values[key])) {
        angles.push(`${key}=${nkantFormatNumber(values[key])}°`);
      }
    });
    let sentence = `Figur ${idx + 1} er en ${typeLabel}`;
    if (sides.length) {
      sentence += ` med sider ${nkantFormatList(sides)}`;
    }
    sentence += '.';
    if (angles.length) {
      sentence += ` Vinkler ${nkantFormatList(angles)}.`;
    }
    const markSentence = describeAngleMarks(job.angleMarks);
    if (markSentence) {
      sentence += ` ${markSentence}`;
    }
    const decoSentence = describeDecorationsSummary(job.decorations);
    if (decoSentence) {
      sentence += ` ${decoSentence}`;
    }
    sentences.push(sentence.trim());
  });
  return sentences.join(' ');
}
function getNkantTitle() {
  const base = typeof document !== 'undefined' && document && document.title ? document.title : 'Nkant';
  const summary = getNkantAltSummary();
  const count = summary && typeof summary.count === 'number' ? summary.count : 0;
  if (!count) return base;
  const suffix = count === 1 ? '1 figur' : `${count} figurer`;
  return `${base} – ${suffix}`;
}
function getActiveNkantAltText() {
  const stored = typeof STATE.altText === 'string' ? STATE.altText.trim() : '';
  const source = STATE.altTextSource === 'manual' ? 'manual' : 'auto';
  if (source === 'manual' && stored) return stored;
  return stored || buildNkantAltText();
}
function maybeRefreshAltText(reason) {
  const summary = getNkantAltSummary();
  const signature = JSON.stringify(summary);
  if (altTextManager && typeof altTextManager.refresh === 'function') {
    altTextManager.refresh(reason || 'auto', signature);
  } else if (altTextManager && typeof altTextManager.notifyFigureChange === 'function') {
    altTextManager.notifyFigureChange(signature);
  }
}
function initAltTextManager() {
  if (typeof window === 'undefined' || !window.MathVisAltText) return;
  const svg = document.getElementById('paper');
  const container = document.getElementById('exportCard');
  if (!svg || !container) return;
  altTextManager = window.MathVisAltText.create({
    svg,
    container,
    getTitle: getNkantTitle,
    getState: () => ({
      text: typeof STATE.altText === 'string' ? STATE.altText : '',
      source: STATE.altTextSource === 'manual' ? 'manual' : 'auto'
    }),
    setState: (text, source) => {
      STATE.altText = text;
      STATE.altTextSource = source === 'manual' ? 'manual' : 'auto';
    },
    generate: () => buildNkantAltText(),
    getSignature: () => JSON.stringify(getNkantAltSummary()),
    getAutoMessage: reason => reason && reason.startsWith('manual') ? 'Alternativ tekst oppdatert.' : 'Alternativ tekst oppdatert automatisk.',
    getManualMessage: () => 'Alternativ tekst oppdatert manuelt.'
  });
  if (altTextManager) {
    altTextManager.applyCurrent();
    maybeRefreshAltText('init');
  }
}

/* ---------- STIL ---------- */
const STYLE_DEFAULTS = {
  faceFill: "#f5f7fa",
  edgeStroke: "#333",
  edgeWidth: 4,
  radiusStroke: null,
  angStroke: "#147a9c",
  angWidth: 4,
  angFill: "#147a9c22",
  textFill: "#111827",
  textHalo: null,
  textHaloW: 0,
  fontFamily: "system-ui, -apple-system, 'Segoe UI', 'Helvetica Neue', Arial, sans-serif",
  sideFS: 26,
  ptFS: 32,
  angFS: 22,
  constructionStroke: "#4b5563",
  constructionWidth: 3,
  constructionDash: "10 8"
};
const STYLE_PROFILE_OVERRIDES = {
  campus: {
    faceFill: "#2C395B",
    edgeStroke: "#2C395B",
    radiusStroke: "#ffffff",
    angStroke: "#ffffff",
    angFill: "rgba(255, 255, 255, 0.9)",
    textFill: "#ffffff",
    textHalo: "#2C395B",
    textHaloW: 5,
    constructionStroke: "#ffffff",
    constructionWidth: 4,
    constructionDash: "6 6"
  }
};
const STYLE = {
  ...STYLE_DEFAULTS
};

function getThemeApi() {
  const theme = typeof window !== "undefined" ? window.MathVisualsTheme : null;
  return theme && typeof theme === "object" ? theme : null;
}

function applyThemeToDocument() {
  const theme = getThemeApi();
  if (theme && typeof theme.applyToDocument === "function" && typeof document !== "undefined") {
    theme.applyToDocument(document);
  }
}

function applyThemeStyles() {
  const theme = getThemeApi();
  const profileName = theme && typeof theme.getActiveProfileName === "function" ? theme.getActiveProfileName() : null;
  const normalized = typeof profileName === "string" ? profileName.toLowerCase() : "";
  const overrides = normalized && STYLE_PROFILE_OVERRIDES[normalized] ? STYLE_PROFILE_OVERRIDES[normalized] : null;
  Object.assign(STYLE, STYLE_DEFAULTS);
  if (overrides) {
    Object.assign(STYLE, overrides);
  }
}

applyThemeToDocument();
applyThemeStyles();

/* ---------- HJELPERE ---------- */
const deg = r => r * 180 / Math.PI;
const rad = d => d * Math.PI / 180;
const clamp = (x, lo, hi) => Math.max(lo, Math.min(hi, x));
const clampCos = x => clamp(x, -1, 1);
const fmt = n => (Math.round(n * 10) / 10).toString().replace(".", ",");
const specFmt = n => (Math.round(n * 10) / 10).toString();
const rand = (min, max) => min + Math.random() * (max - min);
function deepAssign(target, src) {
  if (!src) return;
  Object.entries(src).forEach(([k, v]) => {
    if (v && typeof v === "object" && !Array.isArray(v)) {
      if (!target[k] || typeof target[k] !== "object") target[k] = {};
      deepAssign(target[k], v);
    } else {
      target[k] = v;
    }
  });
}
function add(parent, name, attrs = {}) {
  const el = document.createElementNS("http://www.w3.org/2000/svg", name);
  Object.entries(attrs).forEach(([k, v]) => el.setAttribute(k, String(v)));
  parent.appendChild(el);
  return el;
}
const dist = (P, Q) => Math.hypot(P.x - Q.x, P.y - Q.y);
const mid = (P, Q) => ({
  x: (P.x + Q.x) / 2,
  y: (P.y + Q.y) / 2
});
function perpendicularFoot(P, U, V) {
  const dx = V.x - U.x;
  const dy = V.y - U.y;
  const len2 = dx * dx + dy * dy;
  if (len2 < 1e-9) return { x: U.x, y: U.y };
  const t = ((P.x - U.x) * dx + (P.y - U.y) * dy) / len2;
  return {
    x: U.x + t * dx,
    y: U.y + t * dy
  };
}
function polygonArea(pts) {
  let s = 0;
  for (let i = 0; i < pts.length; i++) {
    const a = pts[i],
      b = pts[(i + 1) % pts.length];
    s += a.x * b.y - b.x * a.y;
  }
  return s / 2;
}
function polygonCentroid(pts) {
  let A = 0,
    cx = 0,
    cy = 0;
  for (let i = 0; i < pts.length; i++) {
    const p = pts[i],
      q = pts[(i + 1) % pts.length];
    const c = p.x * q.y - q.x * p.y;
    A += c;
    cx += (p.x + q.x) * c;
    cy += (p.y + q.y) * c;
  }
  A = A / 2;
  if (Math.abs(A) < 1e-9) return mid(pts[0], pts[2] || pts[0]);
  return {
    x: cx / (6 * A),
    y: cy / (6 * A)
  };
}
function fitTransformToRect(pts, rectW, rectH, margin = 46) {
  const xs = pts.map(p => p.x),
    ys = pts.map(p => p.y);
  const minx = Math.min(...xs),
    maxx = Math.max(...xs);
  const miny = Math.min(...ys),
    maxy = Math.max(...ys);
  const cw = Math.max(1e-6, maxx - minx);
  const ch = Math.max(1e-6, maxy - miny);
  const k = Math.min((rectW - 2 * margin) / cw, (rectH - 2 * margin) / ch);
  const T = p => ({
    x: margin + k * (p.x - minx),
    y: rectH - margin - k * (p.y - miny)
  });
  return {
    T,
    k
  };
}
function angleAt(V, P, R) {
  const ux = P.x - V.x,
    uy = P.y - V.y,
    vx = R.x - V.x,
    vy = R.y - V.y;
  const du = Math.hypot(ux, uy) || 1,
    dv = Math.hypot(vx, vy) || 1;
  const c = clampCos((ux * vx + uy * vy) / (du * dv));
  return deg(Math.acos(c));
}
function unitVec(A, B) {
  const dx = B.x - A.x,
    dy = B.y - A.y,
    L = Math.hypot(dx, dy) || 1;
  return {
    x: dx / L,
    y: dy / L
  };
}
function addHaloText(parent, x, y, txt, fontSizePx, extraAttrs = {}) {
  const t = add(parent, "text", {
    x,
    y,
    fill: STYLE.textFill,
    "font-size": fontSizePx,
    "font-family": STYLE.fontFamily,
  });
  if (STYLE.textHalo && STYLE.textHaloW > 0) {
    t.setAttribute(
      "style",
      `paint-order:stroke fill;stroke:${STYLE.textHalo};stroke-width:${STYLE.textHaloW};stroke-linejoin:round;`
    );
  }
  Object.entries(extraAttrs).forEach(([k, v]) => t.setAttribute(k, String(v)));
  t.textContent = txt;
  return t;
}
function drawConstructionLine(g, P, Q) {
  add(g, "line", {
    x1: P.x,
    y1: P.y,
    x2: Q.x,
    y2: Q.y,
    stroke: STYLE.constructionStroke,
    "stroke-width": STYLE.constructionWidth,
    "stroke-linecap": "round",
    "stroke-dasharray": STYLE.constructionDash
  });
}
function drawRightAngleMarker(g, foot, baseDir, altDir) {
  const baseLen = Math.hypot(baseDir.x, baseDir.y) || 1;
  const altLen = Math.hypot(altDir.x, altDir.y) || 1;
  const size = rightAngleSizeFromSegments(baseLen, altLen);
  if (!(size > 0)) return;
  const b = {
    x: baseDir.x / baseLen,
    y: baseDir.y / baseLen
  };
  const a = {
    x: altDir.x / altLen,
    y: altDir.y / altLen
  };
  const p1 = {
    x: foot.x + b.x * size,
    y: foot.y + b.y * size
  };
  const p2 = {
    x: p1.x + a.x * size,
    y: p1.y + a.y * size
  };
  const p3 = {
    x: foot.x + a.x * size,
    y: foot.y + a.y * size
  };
  add(g, "polyline", {
    points: `${foot.x},${foot.y} ${p1.x},${p1.y} ${p2.x},${p2.y} ${p3.x},${p3.y}`,
    fill: "none",
    stroke: STYLE.constructionStroke,
    "stroke-width": STYLE.constructionWidth * 0.8,
    "stroke-linejoin": "round"
  });
}
function mapHeightSideToBase(side, letters) {
  if (!side) return null;
  const upperLetters = Array.isArray(letters) ? letters.map(l => String(l).toUpperCase()) : [];
  const set = new Set(upperLetters);
  const normalizedSide = String(side).toLowerCase();
  const has = vals => vals.every(v => set.has(v));
  if (has(['A', 'B', 'C']) && ['a', 'b', 'c'].includes(normalizedSide)) {
    if (normalizedSide === 'a') return 'BC';
    if (normalizedSide === 'b') return 'AC';
    if (normalizedSide === 'c') return 'AB';
  }
  if (has(['A', 'B', 'C', 'D']) && ['a', 'b', 'c', 'd'].includes(normalizedSide)) {
    if (normalizedSide === 'a') return 'AB';
    if (normalizedSide === 'b') return 'BC';
    if (normalizedSide === 'c') return 'CD';
    if (normalizedSide === 'd') return 'DA';
  }
  return null;
}
function resolveHeightBase(dec, availableLetters) {
  if (!dec || !dec.from) return null;
  const from = String(dec.from).toUpperCase();
  const letters = Array.isArray(availableLetters) ? availableLetters.map(l => String(l).toUpperCase()) : [];
  if (!letters.includes(from)) return null;
  let baseLetters = '';
  let explicit = false;
  if (dec.base) {
    const sanitized = String(dec.base).toUpperCase().replace(/[^A-D]/g, '');
    if (sanitized.length >= 2) {
      const first = sanitized[0];
      const second = sanitized[1];
      if (letters.includes(first) && letters.includes(second) && first !== second && first !== from && second !== from) {
        baseLetters = `${first}${second}`;
        explicit = true;
      }
    }
  }
  if (!baseLetters && dec.baseSide) {
    const mapped = mapHeightSideToBase(dec.baseSide, letters);
    if (mapped && mapped[0] !== from && mapped[1] !== from) {
      baseLetters = mapped;
      explicit = true;
    }
  }
  if (!baseLetters && letters.length === 3) {
    const others = letters.filter(l => l !== from);
    if (others.length >= 2) {
      baseLetters = `${others[0]}${others[1]}`;
    }
  }
  if (baseLetters.length !== 2) return null;
  return {
    from,
    base: baseLetters,
    implied: !explicit
  };
}
function collectHeightInfos(points, decorations) {
  if (!points || typeof points !== 'object') return [];
  if (!Array.isArray(decorations) || !decorations.length) return [];
  const letters = Object.keys(points);
  if (!letters.length) return [];
  const seen = new Set();
  const infos = [];
  decorations.forEach(dec => {
    if (!dec || typeof dec !== 'object' || dec.type !== 'height') return;
    const resolved = resolveHeightBase(dec, letters);
    if (!resolved) return;
    const tag = `height:${resolved.from}:${resolved.base}`;
    if (seen.has(tag)) return;
    const from = resolved.from;
    const base = resolved.base;
    const vertex = points[from];
    const baseA = points[base[0]];
    const baseB = points[base[1]];
    if (!vertex || !baseA || !baseB) return;
    const foot = perpendicularFoot(vertex, baseA, baseB);
    if (!foot || Math.hypot(vertex.x - foot.x, vertex.y - foot.y) < 1e-6) return;
    infos.push({
      tag,
      from,
      base,
      vertex,
      basePoints: [baseA, baseB],
      foot
    });
    seen.add(tag);
  });
  return infos;
}
function centroidFromPointMap(points, order) {
  if (!points || typeof points !== 'object') return null;
  if (Array.isArray(order) && order.length >= 3) {
    const polygon = order.map(label => points[label]).filter(p => p && typeof p.x === 'number' && typeof p.y === 'number');
    if (polygon.length >= 3) {
      return polygonCentroid(polygon);
    }
  }
  const entries = Object.values(points).filter(p => p && typeof p.x === 'number' && typeof p.y === 'number');
  if (!entries.length) return null;
  let sumX = 0;
  let sumY = 0;
  entries.forEach(p => {
    sumX += p.x;
    sumY += p.y;
  });
  return {
    x: sumX / entries.length,
    y: sumY / entries.length
  };
}

function collectSemicircleExtentPoints(points, decorations, order) {
  if (!points || typeof points !== 'object') return [];
  if (!Array.isArray(decorations) || !decorations.length) return [];
  const centroid = centroidFromPointMap(points, order);
  if (!centroid) return [];
  const extras = [];
  decorations.forEach(dec => {
    if (!dec || typeof dec !== 'object' || dec.type !== 'semicircle') return;
    const from = String(dec.from || '').toUpperCase();
    const to = String(dec.to || '').toUpperCase();
    const P = points[from];
    const Q = points[to];
    if (!P || !Q) return;
    const chordVec = {
      x: Q.x - P.x,
      y: Q.y - P.y
    };
    const chordLen = Math.hypot(chordVec.x, chordVec.y);
    if (!(chordLen > 1e-6)) return;
    const center = {
      x: (P.x + Q.x) / 2,
      y: (P.y + Q.y) / 2
    };
    let normal = {
      x: chordVec.y / chordLen,
      y: -chordVec.x / chordLen
    };
    const interiorSign = (Q.x - P.x) * (centroid.y - P.y) - (Q.y - P.y) * (centroid.x - P.x);
    if (interiorSign < 0) {
      normal.x *= -1;
      normal.y *= -1;
    }
    const arcRadius = chordLen / 2;
    extras.push({
      x: center.x + normal.x * arcRadius,
      y: center.y + normal.y * arcRadius
    });
  });
  return extras;
}
function collectSquareExtentPoints(points, decorations, order) {
  if (!points || typeof points !== 'object') return [];
  if (!Array.isArray(decorations) || !decorations.length) return [];
  const centroid = centroidFromPointMap(points, order);
  if (!centroid) return [];
  const extras = [];
  decorations.forEach(dec => {
    if (!dec || typeof dec !== 'object' || dec.type !== 'square') return;
    const from = String(dec.from || '').toUpperCase();
    const to = String(dec.to || '').toUpperCase();
    const P = points[from];
    const Q = points[to];
    if (!P || !Q) return;
    const baseVec = {
      x: Q.x - P.x,
      y: Q.y - P.y
    };
    const baseLen = Math.hypot(baseVec.x, baseVec.y);
    if (!(baseLen > 1e-6)) return;
    let normal = {
      x: baseVec.y / baseLen,
      y: -baseVec.x / baseLen
    };
    const interiorSign = (Q.x - P.x) * (centroid.y - P.y) - (Q.y - P.y) * (centroid.x - P.x);
    if (interiorSign < 0) {
      normal.x *= -1;
      normal.y *= -1;
    }
    extras.push({
      x: Q.x + normal.x * baseLen,
      y: Q.y + normal.y * baseLen
    });
    extras.push({
      x: P.x + normal.x * baseLen,
      y: P.y + normal.y * baseLen
    });
  });
  return extras;
}
function renderDecorations(g, points, decorations, options = {}) {
  if (!Array.isArray(decorations) || !decorations.length) return;
  const letters = Object.keys(points);
  const seen = new Set();
  const skipHeights = options && options.skipHeights instanceof Set ? options.skipHeights : null;
  const pointOrder = options && Array.isArray(options.pointOrder) ? options.pointOrder : null;
  const baseCentroid = options && options.centroid ? options.centroid : centroidFromPointMap(points, pointOrder);
  decorations.forEach(dec => {
    if (!dec || typeof dec !== 'object') return;
    if (dec.type === 'diagonal') {
      const from = String(dec.from || '').toUpperCase();
      const to = String(dec.to || '').toUpperCase();
      if (!points[from] || !points[to] || from === to) return;
      const key = from < to ? `${from}${to}` : `${to}${from}`;
      const tag = `diag:${key}`;
      if (seen.has(tag)) return;
      seen.add(tag);
      drawConstructionLine(g, points[from], points[to]);
    } else if (dec.type === 'height') {
      const resolved = resolveHeightBase(dec, letters);
      if (!resolved) return;
      const from = resolved.from;
      const base = resolved.base;
      const A = base[0];
      const B = base[1];
      const P = points[from];
      const U = points[A];
      const V = points[B];
      if (!P || !U || !V) return;
      const tag = `height:${from}:${base}`;
      if (skipHeights && skipHeights.has(tag)) return;
      if (seen.has(tag)) return;
      seen.add(tag);
      const foot = perpendicularFoot(P, U, V);
      if (Math.hypot(P.x - foot.x, P.y - foot.y) < 1e-6) return;
      drawConstructionLine(g, P, foot);
      const baseDir = {
        x: V.x - U.x,
        y: V.y - U.y
      };
      const altDir = {
        x: P.x - foot.x,
        y: P.y - foot.y
      };
      if (Math.hypot(altDir.x, altDir.y) > 1e-6) {
        drawRightAngleMarker(g, foot, baseDir, altDir);
      }
    } else if (dec.type === 'semicircle') {
      const from = String(dec.from || '').toUpperCase();
      const to = String(dec.to || '').toUpperCase();
      if (!letters.includes(from) || !letters.includes(to) || from === to) return;
      const key = from < to ? `${from}${to}` : `${to}${from}`;
      const tag = `semicircle:${key}`;
      if (seen.has(tag)) return;
      seen.add(tag);
      const P = points[from];
      const Q = points[to];
      if (!P || !Q) return;
      const chordVec = {
        x: Q.x - P.x,
        y: Q.y - P.y
      };
      const chordLen = Math.hypot(chordVec.x, chordVec.y);
      if (!(chordLen > 1e-6)) return;
      const center = {
        x: (P.x + Q.x) / 2,
        y: (P.y + Q.y) / 2
      };
      let normal = {
        x: chordVec.y / chordLen,
        y: -chordVec.x / chordLen
      };
      const reference = baseCentroid || center;
      const interiorSign = (Q.x - P.x) * (reference.y - P.y) - (Q.y - P.y) * (reference.x - P.x);
      if (interiorSign < 0) {
        normal.x *= -1;
        normal.y *= -1;
      }
      const arcRadius = chordLen / 2;
      const midArc = {
        x: center.x + normal.x * arcRadius,
        y: center.y + normal.y * arcRadius
      };
      const cross = (Q.x - P.x) * (midArc.y - P.y) - (Q.y - P.y) * (midArc.x - P.x);
      const sweep = cross < 0 ? 1 : 0;
      add(g, 'path', {
        d: `M ${P.x} ${P.y} A ${arcRadius} ${arcRadius} 0 0 ${sweep} ${Q.x} ${Q.y}`,
        fill: 'none',
        stroke: STYLE.edgeStroke,
        'stroke-width': STYLE.edgeWidth,
        'stroke-linecap': 'round'
      });
      add(g, 'line', {
        x1: center.x,
        y1: center.y,
        x2: midArc.x,
        y2: midArc.y,
        stroke: STYLE.edgeStroke,
        'stroke-width': STYLE.edgeWidth * 0.75,
        'stroke-linecap': 'round'
      });
      add(g, 'circle', {
        cx: center.x,
        cy: center.y,
        r: 6,
        fill: STYLE.edgeStroke
      });
      const radiusEntry = dec.radius && typeof dec.radius === 'object' ? dec.radius : null;
      const diameterEntry = dec.diameter && typeof dec.diameter === 'object' ? dec.diameter : null;
      const showRadius = radiusEntry && radiusEntry.requested;
      const radiusText = showRadius ? normalizedDimensionText(radiusEntry, 'r') : '';
      if (showRadius && radiusText) {
        const labelPoint = {
          x: center.x + normal.x * arcRadius * 0.55,
          y: center.y + normal.y * arcRadius * 0.55
        };
        addHaloText(g, labelPoint.x, labelPoint.y, radiusText, STYLE.sideFS, {
          'text-anchor': 'middle',
          'dominant-baseline': 'middle'
        });
      }
      const diameterText = diameterEntry ? normalizedDimensionText(diameterEntry, 'd') : '';
      if (diameterEntry && diameterEntry.requested && diameterText) {
        const inward = {
          x: -normal.x,
          y: -normal.y
        };
        const diameterPoint = {
          x: center.x + inward.x * Math.min(arcRadius * 0.6, 40),
          y: center.y + inward.y * Math.min(arcRadius * 0.6, 40)
        };
        addHaloText(g, diameterPoint.x, diameterPoint.y, diameterText, STYLE.sideFS, {
          'text-anchor': 'middle',
          'dominant-baseline': 'middle'
        });
      }
    } else if (dec.type === 'square') {
      const from = String(dec.from || '').toUpperCase();
      const to = String(dec.to || '').toUpperCase();
      if (!letters.includes(from) || !letters.includes(to) || from === to) return;
      const key = from < to ? `${from}${to}` : `${to}${from}`;
      const tag = `square:${key}`;
      if (seen.has(tag)) return;
      seen.add(tag);
      const P = points[from];
      const Q = points[to];
      if (!P || !Q) return;
      const baseVec = {
        x: Q.x - P.x,
        y: Q.y - P.y
      };
      const baseLen = Math.hypot(baseVec.x, baseVec.y);
      if (!(baseLen > 1e-6)) return;
      let normal = {
        x: baseVec.y / baseLen,
        y: -baseVec.x / baseLen
      };
      const reference = baseCentroid || {
        x: (P.x + Q.x) / 2,
        y: (P.y + Q.y) / 2
      };
      const interiorSign = (Q.x - P.x) * (reference.y - P.y) - (Q.y - P.y) * (reference.x - P.x);
      if (interiorSign < 0) {
        normal.x *= -1;
        normal.y *= -1;
      }
      const R = {
        x: Q.x + normal.x * baseLen,
        y: Q.y + normal.y * baseLen
      };
      const S = {
        x: P.x + normal.x * baseLen,
        y: P.y + normal.y * baseLen
      };
      add(g, 'polygon', {
        points: ptsTo([P, Q, R, S]),
        fill: 'none',
        stroke: STYLE.edgeStroke,
        'stroke-width': STYLE.edgeWidth,
        'stroke-linejoin': 'round'
      });
    }
  });
}

/* ---------- PARSE ---------- */
const SPEC_SIDE_MAP_TRI = {
  AB: 'c',
  BA: 'c',
  BC: 'a',
  CB: 'a',
  AC: 'b',
  CA: 'b'
};
const SPEC_SIDE_MAP_QUAD = {
  AB: 'a',
  BA: 'a',
  BC: 'b',
  CB: 'b',
  CD: 'c',
  DC: 'c',
  AD: 'd',
  DA: 'd'
};
function normalizeSpecKey(rawKey, shapeHint) {
  if (!rawKey) return null;
  const letters = rawKey.replace(/[^A-Za-z]/g, '');
  if (!letters) return null;
  if (letters.length === 1) {
    const single = letters;
    if (/[abcd]/.test(single)) return single.toLowerCase();
    if (/[ABCD]/.test(single)) return single.toUpperCase();
    return single;
  }
  if (letters.length === 2) {
    const up = letters.toUpperCase();
    if (shapeHint === 'quad' && SPEC_SIDE_MAP_QUAD[up]) return SPEC_SIDE_MAP_QUAD[up];
    if (shapeHint === 'tri' && SPEC_SIDE_MAP_TRI[up]) return SPEC_SIDE_MAP_TRI[up];
    if (SPEC_SIDE_MAP_QUAD[up]) return SPEC_SIDE_MAP_QUAD[up];
    if (SPEC_SIDE_MAP_TRI[up]) return SPEC_SIDE_MAP_TRI[up];
    return null;
  }
  if (letters.length === 3) {
    const mid = letters[1].toUpperCase();
    if (/[ABCD]/.test(mid)) return mid;
  }
  return null;
}
function parseSpec(str) {
  const out = {};
  if (!str) return out;
  let shapeHint = null;
  const prefixMatch = str.match(/^\s*(trekant|triangel|firkant|rektangel|kvadrat)\b/i);
  if (prefixMatch) {
    const keyword = prefixMatch[1].toLowerCase();
    if (keyword.startsWith('trek') || keyword.startsWith('tria')) {
      shapeHint = 'tri';
    } else {
      shapeHint = 'quad';
    }
    str = str.slice(prefixMatch[0].length);
    str = str.replace(/^[\s:=,-]+/, '');
  }
  str = str.replace(/\bog\b/gi, ',');
  const pairRegex = /([A-Za-z]{1,3})\s*=\s*([-+]?(?:\d+[.,]\d+|\d+|\.[0-9]+))(?:\s*(?:°|[a-zA-Z]+))?/g;
  let match;
  while (match = pairRegex.exec(str)) {
    const key = normalizeSpecKey(match[1].trim(), shapeHint);
    if (!key) continue;
    const rawValue = match[2];
    const value = parseFloat(rawValue.replace(',', '.'));
    if (!Number.isFinite(value)) continue;
    out[key] = value;
  }
  return out;
}
function escapeRegExp(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
function parseLabeledSegments(str, entries) {
  const result = {};
  if (!str || !Array.isArray(entries) || entries.length === 0) return result;
  const keywords = entries.flatMap(entry => entry.keywords || []).filter(Boolean);
  if (keywords.length === 0) return result;
  const splitter = new RegExp(`(?=\\b(?:${keywords.map(escapeRegExp).join('|')})\\b)`, 'i');
  const keywordPattern = new RegExp(`^\\s*\\b(${keywords.map(escapeRegExp).join('|')})\\b`, 'i');
  const quoteTrim = str => {
    if (!str) return str;
    const first = str[0];
    const last = str[str.length - 1];
    if ((first === '"' && last === '"') || (first === '\'' && last === '\'') || (first === '(' && last === ')') || (first === '[' && last === ']')) {
      return str.slice(1, -1).trim();
    }
    return str;
  };
  const segments = str.split(splitter);
  segments.forEach(segment => {
    const match = segment.match(keywordPattern);
    if (!match) return;
    const keyword = match[1].toLowerCase();
    const entry = entries.find(item => Array.isArray(item.keywords) && item.keywords.some(k => k.toLowerCase() === keyword));
    if (!entry || result[entry.id]) return;
    let remainder = segment.slice(match[0].length);
    let hadSeparator = false;
    const sepMatch = remainder.match(/^\s*([:=])/);
    if (sepMatch) {
      hadSeparator = true;
      remainder = remainder.slice(sepMatch[0].length);
    }
    let label = quoteTrim(remainder.trim());
    label = label.replace(/[,;|]+$/g, '').replace(/\s{2,}/g, ' ').trim();
    if (!label) {
      if (hadSeparator) {
        label = '';
      } else {
        label = typeof entry.defaultLabel === 'string' ? entry.defaultLabel : '';
      }
    }
    const numericSource = label.replace(/,/g, '.');
    const numericMatch = numericSource.match(/[-+]?\d*\.?\d+(?:[eE][-+]?\d+)?/);
    const value = numericMatch ? parseFloat(numericMatch[0]) : null;
    result[entry.id] = {
      label,
      value: Number.isFinite(value) ? value : null,
      requested: true
    };
  });
  return result;
}
function normalizedDimensionText(entry, fallback) {
  if (!entry) {
    return typeof fallback === 'string' ? fallback : '';
  }
  const label = typeof entry.label === 'string' ? entry.label.trim() : '';
  if (label) return label;
  if (Number.isFinite(entry.value)) {
    return nkantFormatNumber(entry.value);
  }
  return typeof fallback === 'string' ? fallback : '';
}
function parseArcSideTokens(text) {
  if (!text) return [];
  const matches = String(text).toUpperCase().match(/[A-Z]+/g);
  if (!matches || !matches.length) return [];
  if (matches.length >= 2) {
    return matches.slice(0, 2);
  }
  const single = matches[0];
  if (single.length >= 2) {
    return [single.slice(0, 1), single.slice(1, 2)];
  }
  return [single];
}
function parseSpecFreeform(str) {
  const out = {};
  if (!str) return out;

  // Håndter eksplisitte nøkkel/verdi-par før vi normaliserer teksten
  const pairRegex = /([abcdABCD])\s*=\s*([0-9]+(?:[.,][0-9]+)?)/g;
  let m;
  while (m = pairRegex.exec(str)) {
    out[m[1]] = parseFloat(m[2].replace(',', '.'));
  }
  if (Object.keys(out).length > 0) return out;
  let text = str.toLowerCase();
  const angMatch = text.match(/rett\s*vinkel\s*(?:i|ved)?\s*([abcd])/);
  if (angMatch) {
    const letter = angMatch[1].toUpperCase();
    out[letter] = 90;
    text = text.replace(angMatch[0], "");
  }
  let sidePart = text;
  const mSides = text.match(/(sider?|sidelengder?)\s+(.*)/);
  if (mSides) sidePart = mSides[2];
  const nums = [];
  sidePart.split(/[^0-9.,]+/).forEach(tok => {
    if (!tok) return;
    if (/^\d+[.,]\d+$/.test(tok)) {
      nums.push(parseFloat(tok.replace(',', '.')));
    } else {
      tok.split(/,+/).forEach(n => {
        if (n) nums.push(parseFloat(n));
      });
    }
  });
  if (/kvadrat/.test(text)) {
    var _nums$;
    const s = (_nums$ = nums[0]) !== null && _nums$ !== void 0 ? _nums$ : rand(1, 5);
    Object.assign(out, {
      a: s,
      b: s,
      c: s,
      d: s,
      B: 90
    });
    return out;
  }
  if (/firkant/.test(text)) {
    if (nums.length >= 2) {
      const w = nums[0];
      const h = nums[1];
      Object.assign(out, {
        a: w,
        c: w,
        b: h,
        d: h,
        B: 90
      });
    } else {
      var _nums$2;
      const s = (_nums$2 = nums[0]) !== null && _nums$2 !== void 0 ? _nums$2 : rand(1, 5);
      Object.assign(out, {
        a: s,
        b: s,
        c: s,
        d: s,
        B: 90
      });
    }
    return out;
  }
  if (/rektangel/.test(text)) {
    let w, h;
    if (nums.length >= 2) {
      [w, h] = nums;
    } else if (nums.length === 1) {
      w = nums[0];
      h = rand(1, 5);
      if (Math.abs(h - w) < 1e-6) h += 1;
    } else {
      w = rand(1, 5);
      h = rand(1, 5);
      if (Math.abs(h - w) < 1e-6) h += 1;
    }
    Object.assign(out, {
      a: w,
      c: w,
      b: h,
      d: h,
      B: 90
    });
    return out;
  }
  if (/parallellogram/.test(text)) {
    var _nums$3, _nums$4, _nums$5;
    const w = (_nums$3 = nums[0]) !== null && _nums$3 !== void 0 ? _nums$3 : rand(1, 5);
    const h = (_nums$4 = nums[1]) !== null && _nums$4 !== void 0 ? _nums$4 : rand(1, 5);
    let B = (_nums$5 = nums[2]) !== null && _nums$5 !== void 0 ? _nums$5 : rand(60, 120);
    if (Math.abs(B - 90) < 1e-6) B = 60;
    Object.assign(out, {
      a: w,
      c: w,
      b: h,
      d: h,
      B
    });
    return out;
  }
  if (/rombe/.test(text)) {
    var _nums$6, _nums$7;
    const s = (_nums$6 = nums[0]) !== null && _nums$6 !== void 0 ? _nums$6 : rand(1, 5);
    let B = (_nums$7 = nums[1]) !== null && _nums$7 !== void 0 ? _nums$7 : rand(60, 120);
    if (Math.abs(B - 90) < 1e-6) B = 60;
    Object.assign(out, {
      a: s,
      b: s,
      c: s,
      d: s,
      B
    });
    return out;
  }
  if (/likesidet/.test(text) && /trekant/.test(text)) {
    var _nums$8;
    const s = (_nums$8 = nums[0]) !== null && _nums$8 !== void 0 ? _nums$8 : 1;
    Object.assign(out, {
      a: s,
      b: s,
      c: s
    });
    return out;
  }
  if (/likebeint/.test(text) && /trekant/.test(text)) {
    let s, base;
    if (nums.length >= 2) {
      s = nums[0];
      base = nums[1];
    } else if (nums.length === 1) {
      s = nums[0];
      base = Math.min(2 * s - 0.1, rand(1, 2 * s - 0.1));
    } else {
      s = rand(2, 6);
      base = rand(1, 2 * s - 0.5);
    }
    if (base >= 2 * s) base = 2 * s - 0.1;
    Object.assign(out, {
      a: s,
      b: s,
      c: base
    });
    return out;
  }
  if (/rettvinkle[dt]/.test(text) && /trekant/.test(text)) {
    const rightLetter = ["A", "B", "C"].find(L => out[L] === 90) || "C";
    const legKeys = rightLetter === "A" ? ["b", "c"] : rightLetter === "B" ? ["a", "c"] : ["a", "b"];
    if (nums.length === 2) {
      const [x, y] = nums;
      out[legKeys[0]] = x;
      out[legKeys[1]] = y;
      out[rightLetter] = 90;
      return out;
    }
    if (nums.length === 0) {
      const k = rand(1, 4);
      out[legKeys[0]] = 3 * k;
      out[legKeys[1]] = 4 * k;
      out[rightLetter] = 90;
      return out;
    }
    out[rightLetter] = 90;
  }
  if (/trekant/.test(text) && nums.length === 0) {
    const a = rand(2, 6);
    const b = rand(2, 6);
    const cMin = Math.abs(a - b) + 0.5;
    const cMax = a + b - 0.5;
    const c = rand(cMin, cMax);
    Object.assign(out, {
      a,
      b,
      c
    });
    return out;
  }
  if (nums.length >= 3) {
    const sides = nums.slice(0, 3);
    const assignRemaining = (letters, values) => {
      letters.forEach((L, i) => out[L] = values[i]);
    };
    if (out.A === 90 || out.B === 90 || out.C === 90) {
      const max = Math.max(...sides);
      const idx = sides.indexOf(max);
      const others = sides.slice(0, idx).concat(sides.slice(idx + 1));
      if (out.A === 90) {
        out.a = max;
        assignRemaining(["b", "c"], others);
      } else if (out.B === 90) {
        out.b = max;
        assignRemaining(["a", "c"], others);
      } else if (out.C === 90) {
        out.c = max;
        assignRemaining(["a", "b"], others);
      }
    } else {
      assignRemaining(["a", "b", "c"], sides);
    }
  }
  return out;
}
function parseCircleSpecLine(str) {
  if (!str || !/sirkel/i.test(str)) return null;
  if (/halvsirkel/i.test(str) || /halv\s*sirkel/i.test(str)) return null;
  const dims = parseLabeledSegments(str, [{
    id: 'radius',
    keywords: ['radius', 'rad'],
    defaultLabel: 'r'
  }, {
    id: 'diameter',
    keywords: ['diameter', 'diam'],
    defaultLabel: 'd'
  }]);
  const radiusEntry = dims.radius ? { ...dims.radius } : null;
  if (radiusEntry) {
    if (!radiusEntry.label) radiusEntry.label = 'r';
    radiusEntry.requested = true;
  }
  const diameterEntry = dims.diameter ? { ...dims.diameter, requested: true } : null;
  const job = {
    type: 'circle',
    obj: {
      radius: radiusEntry,
      diameter: diameterEntry
    }
  };
  return {
    job,
    normalized: str.trim()
  };
}
const NKANT_SPELLED_NUMBERS = {
  tre: 3,
  fire: 4,
  fem: 5,
  seks: 6,
  sek: 6,
  sju: 7,
  syv: 7,
  åtte: 8,
  otte: 8,
  ni: 9,
  ti: 10,
  elleve: 11,
  tolv: 12,
  tretten: 13,
  fjorten: 14,
  femten: 15,
  seksten: 16,
  sytten: 17,
  atten: 18,
  nitten: 19,
  tjue: 20
};
function detectPolygonSidesFromText(str) {
  if (!str) return null;
  const lower = str.toLowerCase();
  const numMatch = lower.match(/\b(\d+)(?:\s*|-)?kant(?:er)?\b/);
  if (numMatch) {
    const value = parseInt(numMatch[1], 10);
    if (Number.isFinite(value)) return Math.max(3, value);
  }
  const wordMatch = lower.match(/\b([a-zæøå]+)(?:\s*|-)?kant(?:er)?\b/);
  if (wordMatch) {
    const word = wordMatch[1].replace(/[^a-zæøå]/g, '');
    if (word) {
      const mapped = NKANT_SPELLED_NUMBERS[word];
      if (Number.isFinite(mapped)) return Math.max(3, mapped);
    }
  }
  return null;
}
function parsePolygonSpecLine(str) {
  if (!str) return null;
  const lower = str.toLowerCase();
  if (/\btrekant/i.test(lower) || /\btriangel/i.test(lower)) {
    return null;
  }
  const sidesFromWord = detectPolygonSidesFromText(str);
  const hasKeyword = /mangekant/i.test(str);
  if (!hasKeyword && sidesFromWord == null) return null;
  const dims = parseLabeledSegments(str, [{
    id: 'count',
    keywords: ['sider', 'antall sider', 'kanter'],
    defaultLabel: ''
  }, {
    id: 'side',
    keywords: ['side', 'kant', 'kantlengde', 'sidekant', 'lengde'],
    defaultLabel: 'a'
  }]);
  let sides = sidesFromWord != null ? sidesFromWord : 5;
  if (dims.count) {
    if (Number.isFinite(dims.count.value)) {
      sides = Math.max(3, Math.round(dims.count.value));
    } else {
      const parsed = parseInt(dims.count.label, 10);
      if (Number.isFinite(parsed)) sides = Math.max(3, parsed);
    }
  }
  const sideEntry = dims.side ? { ...dims.side } : {
    label: 'a',
    value: null,
    requested: false
  };
  if (!sideEntry.label) sideEntry.label = 'a';
  sideEntry.requested = Boolean(dims.side);
  const job = {
    type: 'polygon',
    obj: {
      sides,
      side: sideEntry
    }
  };
  const sideText = normalizedDimensionText(sideEntry, 'a');
  const normalized = sideText ? `mangekant sider: ${sides} side: ${sideText}` : `mangekant sider: ${sides}`;
  return {
    job,
    normalized
  };
}
function parsePolygonArcSpecLine(str) {
  if (!str || !/halvsirkel/i.test(str)) return null;
  const polygonBase = parsePolygonSpecLine(str);
  const polygonObj = polygonBase ? polygonBase.job && polygonBase.job.obj : null;
  const baseSides = polygonObj && Number.isFinite(polygonObj.sides) ? Math.max(3, Math.round(polygonObj.sides)) : 5;
  const baseSideEntry = polygonObj && polygonObj.side ? {
    ...polygonObj.side
  } : {
    label: 'a',
    value: null,
    requested: false
  };
  if (!baseSideEntry.label) baseSideEntry.label = 'a';
  const dims = parseLabeledSegments(str, [{
    id: 'radius',
    keywords: ['radius', 'rad'],
    defaultLabel: 'r'
  }, {
    id: 'diameter',
    keywords: ['diameter', 'diam'],
    defaultLabel: 'd'
  }]);
  const radiusEntry = dims.radius ? {
    ...dims.radius
  } : null;
  if (radiusEntry && !radiusEntry.label) radiusEntry.label = 'r';
  if (radiusEntry) radiusEntry.requested = true;
  const diameterEntry = dims.diameter ? {
    ...dims.diameter,
    requested: true
  } : null;
  const sideSegmentMatch = str.match(/halvsirkel\s+([A-Za-z]+(?:\s*[A-Za-z]+)?)/i);
  const sideSegment = sideSegmentMatch ? sideSegmentMatch[1] : '';
  const resolvedSide = normalizeArcSideSpecifier(sideSegment, baseSides);
  const job = {
    type: 'polygonArc',
    obj: {
      polygon: {
        sides: baseSides,
        side: baseSideEntry
      },
      side: resolvedSide.label,
      radius: radiusEntry,
      diameter: diameterEntry
    }
  };
  const normalizedParts = [`halvsirkel ${resolvedSide.label}`];
  const radiusText = radiusEntry && radiusEntry.requested ? normalizedDimensionText(radiusEntry, 'r') : '';
  if (radiusText) normalizedParts.push(`radius ${radiusText}`);
  if (diameterEntry) {
    const diameterText = normalizedDimensionText(diameterEntry, 'd');
    if (diameterText) normalizedParts.push(`diameter ${diameterText}`);
  }
  if (polygonBase && polygonBase.normalized) {
    normalizedParts.push(polygonBase.normalized);
  }
  return {
    job,
    normalized: normalizedParts.join('; '),
    allowDecorations: true
  };
}

function parseDoubleTriangleSpecLine(str) {
  if (!str) return null;
  const keywordPattern = /(dobbel\s*-?\s*trekant|double\s*-?\s*triangle)/i;
  if (!keywordPattern.test(str)) return null;
  if (!/trekant|triangle/i.test(str)) return null;
  let working = str.replace(keywordPattern, '').trim();
  if (!working) return null;
  const stripQuotes = value => {
    if (typeof value !== 'string') return '';
    const trimmed = value.trim();
    if (!trimmed) return '';
    if ((trimmed.startsWith('"') && trimmed.endsWith('"')) || (trimmed.startsWith('\'') && trimmed.endsWith('\''))) {
      return trimmed.slice(1, -1).trim();
    }
    if (trimmed.startsWith('(') && trimmed.endsWith(')')) {
      return trimmed.slice(1, -1).trim();
    }
    return trimmed;
  };
  let sharedLabel = '';
  let hadSharedLabel = false;
  const sharedPattern = /(felles|shared)?\s*side\s*(?:[:=])?\s*("[^"]+"|'[^']+'|\([^)]+\)|[A-Za-zÅÆØØåæø0-9]+)?/i;
  const sharedMatch = working.match(sharedPattern);
  if (sharedMatch) {
    const raw = stripQuotes(sharedMatch[2] || '');
    if (raw) {
      sharedLabel = raw;
      hadSharedLabel = true;
    }
    working = (working.slice(0, sharedMatch.index) + working.slice(sharedMatch.index + sharedMatch[0].length)).trim();
  }
  if (!working) return null;
  const cleanSegment = segment => {
    if (!segment) return '';
    let cleaned = segment.trim();
    cleaned = cleaned.replace(/^(?:øverste|øvre|nedre|første|andre|trekant\s*1|trekant\s*2|tri\s*1|tri\s*2|triangle\s*1|triangle\s*2|top|bottom|upper|lower|først|sist)\s*[:=-]?\s*/i, '');
    return cleaned.trim();
  };
  const separators = [/\s*\|\s*/, /\s*\/\s*/, /\s*\+\s*/, /\bog\b/i, /\s*;\s*/];
  let segments = null;
  for (const sep of separators) {
    const parts = working.split(sep).map(cleanSegment).filter(Boolean);
    if (parts.length >= 2) {
      segments = parts.slice(0, 2);
      break;
    }
  }
  if (!segments || segments.length < 2) return null;
  const parseTriangleSegment = text => {
    if (!text) return {};
    const direct = parseSpec(text);
    if (Object.keys(direct).length > 0) return direct;
    return parseSpecFreeform(text);
  };
  const first = parseTriangleSegment(segments[0]);
  const second = parseTriangleSegment(segments[1]);
  if (Object.keys(first).length === 0 || Object.keys(second).length === 0) return null;
  const sharedEntry = {
    label: sharedLabel || '',
    value: Number.isFinite(first.c) ? first.c : Number.isFinite(second.c) ? second.c : null,
    requested: hadSharedLabel
  };
  const normalizedParts = ['dobbel trekant'];
  if (sharedEntry.label) normalizedParts.push(`felles side ${sharedEntry.label}`);
  const firstText = objToSpec(first);
  const secondText = objToSpec(second);
  if (firstText) normalizedParts.push(`trekant 1: ${firstText}`);
  if (secondText) normalizedParts.push(`trekant 2: ${secondText}`);
  const job = {
    type: 'doubleTri',
    obj: {
      shared: sharedEntry,
      first,
      second
    }
  };
  return {
    job,
    normalized: normalizedParts.join(' | '),
    allowDecorations: true
  };
}
function parseShapeSpec(str) {
  const circle = parseCircleSpecLine(str);
  if (circle) return {
    ...circle,
    allowDecorations: false
  };
  const polygonWithArc = parsePolygonArcSpecLine(str);
  if (polygonWithArc) return polygonWithArc;
  const polygon = parsePolygonSpecLine(str);
  if (polygon) return polygon;
  return null;
}
function parseDecorationSegment(segment) {
  const trimmed = segment && segment.trim ? segment.trim() : '';
  if (!trimmed) {
    return {
      handled: true,
      decorations: [],
      normalized: []
    };
  }
  if (/^diagonal(?:er)?/i.test(trimmed)) {
    let rest = trimmed.replace(/^diagonal(?:er)?/i, '').trim();
    if (rest.startsWith(':') || rest.startsWith('=')) rest = rest.slice(1).trim();
    rest = rest.replace(/\bog\b/gi, ',');
    rest = rest.replace(/[-–—]/g, ' ');
    const pairs = rest.toUpperCase().match(/[A-D]{2}/g) || [];
    const seen = new Set();
    const decorations = [];
    const normalized = [];
    pairs.forEach(pair => {
      if (pair[0] === pair[1]) return;
      const sorted = pair[0] <= pair[1] ? pair : `${pair[1]}${pair[0]}`;
      if (seen.has(sorted)) return;
      seen.add(sorted);
      decorations.push({
        type: 'diagonal',
        from: pair[0],
        to: pair[1]
      });
      normalized.push(`diagonal ${pair}`);
    });
    return {
      handled: true,
      decorations,
      normalized
    };
  }
  if (/^halvsirkel/i.test(trimmed)) {
    const dims = parseLabeledSegments(trimmed, [{
      id: 'radius',
      keywords: ['radius', 'rad'],
      defaultLabel: 'r'
    }, {
      id: 'diameter',
      keywords: ['diameter', 'diam'],
      defaultLabel: 'd'
    }]);
    const radiusEntry = dims.radius ? {
      ...dims.radius,
      requested: true
    } : null;
    if (radiusEntry && !radiusEntry.label) radiusEntry.label = 'r';
    const diameterEntry = dims.diameter ? {
      ...dims.diameter,
      requested: true
    } : null;
    if (diameterEntry && !diameterEntry.label) diameterEntry.label = 'd';
    const sideMatch = trimmed.match(/halvsirkel\s+([A-Za-z]+(?:\s*[A-Za-z]+)?)/i);
    const sideSegment = sideMatch ? sideMatch[1] : '';
    const tokens = parseArcSideTokens(sideSegment);
    let first = tokens[0] || 'A';
    let second = tokens[1] || '';
    if (!second) {
      if (tokens[0] && tokens[0].length >= 2) {
        second = tokens[0].slice(1, 2);
      } else {
        second = String.fromCharCode(first.charCodeAt(0) + 1);
      }
    }
    first = first.slice(0, 1).toUpperCase();
    second = second.slice(0, 1).toUpperCase();
    if (!first) first = 'A';
    if (!second) second = first === 'Z' ? 'A' : String.fromCharCode(first.charCodeAt(0) + 1);
    if (first === second) {
      second = second === 'Z' ? 'A' : String.fromCharCode(second.charCodeAt(0) + 1);
    }
    const normalizedParts = [`halvsirkel ${first}${second}`];
    const radiusText = radiusEntry && radiusEntry.requested ? normalizedDimensionText(radiusEntry, 'r') : '';
    const diameterText = diameterEntry ? normalizedDimensionText(diameterEntry, 'd') : '';
    if (radiusEntry && radiusEntry.requested && radiusText) normalizedParts.push(`radius ${radiusText}`);
    if (diameterEntry && diameterEntry.requested && diameterText) normalizedParts.push(`diameter ${diameterText}`);
    const decoration = {
      type: 'semicircle',
      from: first,
      to: second
    };
    if (radiusEntry) decoration.radius = radiusEntry;
    if (diameterEntry) decoration.diameter = diameterEntry;
    return {
      handled: true,
      decorations: [decoration],
      normalized: normalizedParts
    };
  }
  if (/^kvadrat/i.test(trimmed)) {
    const sideMatch = trimmed.match(/kvadrat\s+([A-Za-z]+(?:\s*[A-Za-z]+)?)/i);
    const sideSegment = sideMatch ? sideMatch[1] : '';
    const tokens = parseArcSideTokens(sideSegment);
    let first = tokens[0] || 'A';
    let second = tokens[1] || '';
    if (!second) {
      if (tokens[0] && tokens[0].length >= 2) {
        second = tokens[0].slice(1, 2);
      } else {
        second = String.fromCharCode(first.charCodeAt(0) + 1);
      }
    }
    first = first.slice(0, 1).toUpperCase();
    second = second.slice(0, 1).toUpperCase();
    if (!first) first = 'A';
    if (!second) second = first === 'Z' ? 'A' : String.fromCharCode(first.charCodeAt(0) + 1);
    if (first === second) {
      second = second === 'Z' ? 'A' : String.fromCharCode(second.charCodeAt(0) + 1);
    }
    const decoration = {
      type: 'square',
      from: first,
      to: second
    };
    const normalized = [`kvadrat ${first}${second}`];
    return {
      handled: true,
      decorations: [decoration],
      normalized
    };
  }
  if (/^h(?:øy|oy)der?/i.test(trimmed)) {
    let rest = trimmed.replace(/^h(?:øy|oy)der?/i, '').trim();
    if (rest.startsWith(':') || rest.startsWith('=')) rest = rest.slice(1).trim();
    rest = rest.replace(/\bog\b/gi, ',');
    const parts = rest.split(/[,;]/).map(p => p.trim()).filter(Boolean);
    const decorations = [];
    const normalized = [];
    parts.forEach(part => {
      const spec = parseHeightSpec(part);
      if (!spec) return;
      decorations.push({
        type: 'height',
        from: spec.from,
        base: spec.base,
        baseSide: spec.baseSide,
        explicitBase: spec.explicitBase
      });
      const baseText = spec.base ? `/${spec.base}` : spec.baseSide ? `/${spec.baseSide}` : '';
      normalized.push(`høyde ${spec.from}${baseText}`);
    });
    return {
      handled: true,
      decorations,
      normalized
    };
  }
  const heightInlineMatch = trimmed.match(/^([A-D])\s+(til|på|mot)\b/i);
  if (heightInlineMatch) {
    const spec = parseHeightSpec(trimmed);
    if (spec) {
      const decorations = [{
        type: 'height',
        from: spec.from,
        base: spec.base,
        baseSide: spec.baseSide,
        explicitBase: spec.explicitBase
      }];
      const baseText = spec.base ? `/${spec.base}` : spec.baseSide ? `/${spec.baseSide}` : '';
      return {
        handled: true,
        decorations,
        normalized: [`høyde ${spec.from}${baseText}`]
      };
    }
  }
  return {
    handled: false,
    decorations: [],
    normalized: []
  };
}
function parseHeightSpec(text) {
  if (!text) return null;
  let t = text.trim();
  if (!t) return null;
  t = t.replace(/^fra\s+/i, '');
  t = t.replace(/\s+(?:til|på|mot)\s+/gi, '/');
  t = t.replace(/[→↦↠→−–—]/g, '/');
  t = t.replace(/->/g, '/');
  t = t.replace(/-/g, '/');
  t = t.replace(/\s*\/\s*/g, '/');
  t = t.replace(/\s+/g, ' ').trim();
  const sanitize = (str, maxLetters) => {
    if (!str) return '';
    const letters = (str.match(/[A-D]/gi) || []).join('').toUpperCase();
    return letters.slice(0, maxLetters);
  };
  const parts = t.split('/');
  const left = parts[0] || '';
  const basePart = parts[1] || '';
  const leftLetters = sanitize(left, 3);
  if (!leftLetters) return null;
  let from = leftLetters.slice(0, 1);
  let baseLetters = '';
  let explicitBase = false;
  let baseSide = null;
  if (parts.length >= 2) {
    baseLetters = sanitize(basePart, 2);
    if (baseLetters.length === 2) {
      explicitBase = true;
    } else {
      const sideMatch = basePart.match(/\b([abcd])\b/i);
      if (sideMatch) {
        baseSide = sideMatch[1].toLowerCase();
        explicitBase = true;
      }
    }
  } else if (leftLetters.length >= 3) {
    baseLetters = leftLetters.slice(1, 3);
    explicitBase = baseLetters.length === 2;
  }
  if (baseLetters.length !== 2) baseLetters = '';
  return {
    from,
    base: baseLetters || null,
    baseSide,
    explicitBase
  };
}
function extractDecorations(line) {
  const extras = [];
  const normalizedExtras = [];
  if (!line) {
    return {
      core: '',
      extras,
      normalizedExtras
    };
  }
  const decorationLead = /,(\s*(?:diagonal(?:er)?|h(?:øy|oy)der?|[A-D]\s+(?:til|på|mot)\b))/gi;
  const normalizedLine = String(line).replace(decorationLead, ';$1');
  const segments = normalizedLine.split(';');
  const coreSegments = [];
  segments.forEach(seg => {
    const trimmed = seg.trim();
    if (!trimmed) return;
    const parsed = parseDecorationSegment(trimmed);
    if (parsed.handled && parsed.decorations.length) {
      parsed.decorations.forEach(dec => extras.push(dec));
      parsed.normalized.forEach(norm => {
        if (norm && !normalizedExtras.includes(norm)) normalizedExtras.push(norm);
      });
    } else {
      coreSegments.push(trimmed);
    }
  });
  const core = coreSegments.join('; ').trim();
  return {
    core,
    extras,
    normalizedExtras
  };
}
function combineNormalizedText(core, extras) {
  const base = typeof core === 'string' ? core.trim() : '';
  const list = Array.isArray(extras) ? extras.filter(item => typeof item === 'string' && item.trim()) : [];
  if (!list.length) return base;
  const extrasText = list.join('; ');
  if (base) return `${base}; ${extrasText}`;
  return extrasText;
}
function objToSpec(obj) {
  const order = ["a", "b", "c", "d", "A", "B", "C", "D"];
  return order.filter(k => k in obj).map(k => `${k}=${specFmt(obj[k])}`).join(', ');
}
function resolveBackendEndpoint() {
  if (typeof window === 'undefined') return null;
  if (window.MATH_VISUALS_API_URL) {
    return window.MATH_VISUALS_API_URL;
  }
  var _window$location;
  const origin = (_window$location = window.location) === null || _window$location === void 0 ? void 0 : _window$location.origin;
  if (typeof origin === 'string' && /^https?:/i.test(origin)) {
    return '/api/nkant-parse';
  }
  return null;
}
async function requestSpecFromBackend(str) {
  const endpoint = resolveBackendEndpoint();
  if (!endpoint) return null;
  const res = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      prompt: str
    })
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Backend error ${res.status}${text ? `: ${text}` : ''}`);
  }
  return res.json();
}
async function parseSpecAI(str) {
  const direct = parseSpec(str);
  if (Object.keys(direct).length > 0) return direct;
  const quick = parseSpecFreeform(str);
  if (Object.keys(quick).length > 0) return quick;
  let data = null;
  let backendFailed = false;
  try {
    data = await requestSpecFromBackend(str);
  } catch (error) {
    backendFailed = true;
    if (error) console.warn('parseSpecAI backend fallback', error);
  }
  if (!data) {
    try {
      var _data$choices;
      const apiKey = typeof window !== 'undefined' ? window.OPENAI_API_KEY : null;
      if (!apiKey) throw new Error('missing api key');
      const body = {
        model: 'gpt-4o-mini',
        response_format: {
          type: 'json_object'
        },
        messages: [{
          role: 'system',
          content: 'Returner kun JSON med tall for a,b,c,d,A,B,C,D.'
        }, {
          role: 'user',
          content: str
        }]
      };
      const res = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`
        },
        body: JSON.stringify(body)
      });
      data = await res.json();
      const txt = (_data$choices = data.choices) === null || _data$choices === void 0 || (_data$choices = _data$choices[0]) === null || _data$choices === void 0 || (_data$choices = _data$choices.message) === null || _data$choices === void 0 ? void 0 : _data$choices.content;
      if (!txt) throw new Error('no content');
      const parsed = JSON.parse(txt);
      const out = {};
      Object.entries(parsed).forEach(([k, v]) => {
        if (/^[abcdABCD]$/.test(k)) {
          const n = parseFloat(String(v).replace(',', '.'));
          if (isFinite(n)) out[k] = n;
        }
      });
      if (Object.keys(out).length === 0) return parseSpec(str);
      return out;
    } catch (err) {
      if (!backendFailed) console.warn('parseSpecAI fallback', err);
      return parseSpec(str);
    }
  }
  try {
    var _data$choices2;
    const txt = (_data$choices2 = data.choices) === null || _data$choices2 === void 0 || (_data$choices2 = _data$choices2[0]) === null || _data$choices2 === void 0 || (_data$choices2 = _data$choices2.message) === null || _data$choices2 === void 0 ? void 0 : _data$choices2.content;
    if (!txt) throw new Error('no content');
    const parsed = JSON.parse(txt);
    const out = {};
    Object.entries(parsed).forEach(([k, v]) => {
      if (/^[abcdABCD]$/.test(k)) {
        const n = parseFloat(String(v).replace(',', '.'));
        if (isFinite(n)) out[k] = n;
      }
    });
    if (Object.keys(out).length === 0) return parseSpec(str);
    return out;
  } catch (err) {
    console.warn('parseSpecAI parse error', err);
    return parseSpec(str);
  }
}

/* ---------- VISNINGSTEKSTER ---------- */
// Sider: none | value | custom | custom+value
function buildSideText(mode, valueStr, customText) {
  const t = (mode !== null && mode !== void 0 ? mode : "value").toString().trim();
  if (t === "none") return null;
  if (t === "value") return valueStr;
  if (t === "custom") return customText !== null && customText !== void 0 ? customText : "";
  if (t === "custom+value") return `${customText !== null && customText !== void 0 ? customText : ""}=${valueStr}`;
  return valueStr; // fallback
}

/* Vinkler/punkter:
   none | mark | mark+value | custom | custom+mark | custom+mark+value
   → { mark:bool, angleText:string|null, pointLabel:string|null } */
function parseAnglePointMode(modeStr, valueDeg, customText, fallbackPointLetter) {
  // tolerer "custum..." som synonym
  let t = (modeStr !== null && modeStr !== void 0 ? modeStr : "mark+value").toString().trim();
  t = t.replace(/^custum/, "custom");
  if (t === "none") return {
    mark: false,
    angleText: null,
    pointLabel: null
  };
  const hasMark = t.includes("mark");
  const hasVal = t.includes("value");
  const isCustom = t.startsWith("custom");
  const angleText = hasVal ? `${Math.round(valueDeg)}°` : null;
  const pointLabel = isCustom ? customText || fallbackPointLetter || "" : null;
  return {
    mark: hasMark,
    angleText,
    pointLabel
  };
}

/* ---------- ANGLE RADIUS (smart default + ADV) ---------- */
function angleRadius(Q, P, R) {
  const f = ADV_CONFIG.angle.factor;
  const r0 = f * Math.min(dist(Q, P), dist(Q, R));
  return clamp(r0, ADV_CONFIG.angle.min, ADV_CONFIG.angle.max);
}

function rightAngleSizeFromRadius(r) {
  const cfg = ADV_CONFIG.rightAngleMarker || {};
  const scale = cfg.vertexScale != null ? cfg.vertexScale : 0.7;
  const minSize = cfg.vertexMin != null ? cfg.vertexMin : 12;
  const maxSize = cfg.vertexMax != null ? cfg.vertexMax : 24;
  return clamp(r * scale, minSize, maxSize);
}

function rightAngleSizeFromSegments(baseLen, altLen) {
  const cfg = ADV_CONFIG.rightAngleMarker || {};
  const scale = cfg.heightScale != null ? cfg.heightScale : 0.35;
  const minSize = cfg.heightMin != null ? cfg.heightMin : 12;
  const maxSize = cfg.heightMax != null ? cfg.heightMax : 18;
  const maxRatio = cfg.heightMaxRatio != null ? cfg.heightMaxRatio : 0.65;
  const base = Math.min(baseLen, altLen);
  if (!(base > 0)) return 0;
  const raw = base * scale;
  const hi = Math.max(0, Math.min(maxSize, base * maxRatio));
  if (!(hi > 0)) return 0;
  const lo = Math.min(minSize, hi);
  return clamp(raw, lo, hi);
}

/* ---------- VINKELTEGNING + PLASSERING (NY) ---------- */
function renderAngle(g, Q, P, R, r, opts) {
  const aDeg = angleAt(Q, P, R);
  const isRight = Math.abs(aDeg - 90) < 0.5;

  // retningsvektorer og vinkelhalvering
  const u = unitVec(Q, P),
    v = unitVec(Q, R);
  const bisLen = Math.hypot(u.x + v.x, u.y + v.y) || 1;
  const bis = {
    x: (u.x + v.x) / bisLen,
    y: (u.y + v.y) / bisLen
  }; // inn i sektoren
  const nBis = {
    x: -bis.x,
    y: -bis.y
  }; // ut av figuren

  // markering (bue/kvadrat)
  if (opts.mark) {
    if (isRight) {
      const s = rightAngleSizeFromRadius(r);
      if (s > 0) {
        const q = {
          x: Q.x,
          y: Q.y
        };
        const p1 = {
          x: Q.x + u.x * s,
          y: Q.y + u.y * s
        };
        const p2 = {
          x: Q.x + (u.x + v.x) * s,
          y: Q.y + (u.y + v.y) * s
        };
        const p3 = {
          x: Q.x + v.x * s,
          y: Q.y + v.y * s
        };
        add(g, "polygon", {
          points: `${q.x},${q.y} ${p1.x},${p1.y} ${p2.x},${p2.y} ${p3.x},${p3.y}`,
          fill: STYLE.angFill,
          stroke: "none"
        });
        add(g, "polyline", {
          points: `${p1.x},${p1.y} ${p2.x},${p2.y} ${p3.x},${p3.y}`,
          fill: "none",
          stroke: STYLE.angStroke,
          "stroke-width": STYLE.angWidth,
          "stroke-linejoin": "round",
          "stroke-linecap": "round"
        });
      }
    } else {
      const a1 = Math.atan2(P.y - Q.y, P.x - Q.x);
      const a2 = Math.atan2(R.y - Q.y, R.x - Q.x);
      let d = a2 - a1;
      while (d <= -Math.PI) d += 2 * Math.PI;
      while (d > Math.PI) d -= 2 * Math.PI;
      const o = Math.sign((P.x - Q.x) * (R.y - Q.y) - (P.y - Q.y) * (R.x - Q.x));
      if (o > 0 && d < 0) d += 2 * Math.PI;
      if (o < 0 && d > 0) d -= 2 * Math.PI;
      const large = Math.abs(d) > Math.PI ? 1 : 0;
      const sweep = o > 0 ? 1 : 0;
      const A1 = {
        x: Q.x + r * Math.cos(a1),
        y: Q.y + r * Math.sin(a1)
      };
      const B1 = {
        x: Q.x + r * Math.cos(a1 + d),
        y: Q.y + r * Math.sin(a1 + d)
      };
      const path = `M ${Q.x} ${Q.y} L ${A1.x} ${A1.y} A ${r} ${r} 0 ${large} ${sweep} ${B1.x} ${B1.y} Z`;
      add(g, "path", {
        d: path,
        fill: STYLE.angFill,
        stroke: "none"
      });
      add(g, "path", {
        d: path.replace("Z", ""),
        fill: "none",
        stroke: STYLE.angStroke,
        "stroke-width": STYLE.angWidth
      });
    }
  }
  const cfg = ADV_CONFIG.angle;
  const insideK = isRight ? cfg.insideK.right : cfg.insideK.other;
  const outsideK = isRight ? cfg.outsideK.right : cfg.outsideK.other;

  // 90°: hvis markert, dropp verditekst
  const showAngleValue = opts.angleText && !(isRight && opts.mark);

  // vinkelverdi (inne i sektoren)
  if (showAngleValue) {
    const Ti = {
      x: Q.x + bis.x * (insideK * r),
      y: Q.y + bis.y * (insideK * r)
    };
    addHaloText(g, Ti.x, Ti.y, opts.angleText, STYLE.angFS, {
      "text-anchor": "middle",
      "dominant-baseline": "middle"
    });
  }

  // punktnavn (ute på samme linje) – med clamp
  if (opts.pointLabel) {
    var _cfg$outsideMaxFactor, _cfg$outsideMin;
    const baseLen = Math.min(dist(Q, P), dist(Q, R));
    const outTarget = outsideK * r + cfg.outsidePad;
    const outMax = ((_cfg$outsideMaxFactor = cfg.outsideMaxFactor) !== null && _cfg$outsideMaxFactor !== void 0 ? _cfg$outsideMaxFactor : 0.9) * baseLen;
    const outLen = clamp(outTarget, (_cfg$outsideMin = cfg.outsideMin) !== null && _cfg$outsideMin !== void 0 ? _cfg$outsideMin : 0, outMax);
    const To = {
      x: Q.x + nBis.x * outLen,
      y: Q.y + nBis.y * outLen
    };
    addHaloText(g, To.x, To.y, opts.pointLabel, STYLE.ptFS, {
      "text-anchor": "middle",
      "dominant-baseline": "middle"
    });
  }
}

/* ---------- TEKST FOR SIDER ---------- */
function sideLabelText(g, P, Q, text, rotate, centroid, offset = 14) {
  if (!text) return;
  const M = {
    x: (P.x + Q.x) / 2,
    y: (P.y + Q.y) / 2
  };
  const vx = Q.x - P.x,
    vy = Q.y - P.y;
  const nx = -vy,
    ny = vx;
  const dot = (centroid.x - M.x) * nx + (centroid.y - M.y) * ny;
  const sgn = dot > 0 ? 1 : -1;
  const nlen = Math.hypot(nx, ny) || 1;
  const adj = Math.max(offset, Math.min(22, dist(P, Q) * 0.18));
  const x = M.x + sgn * adj * nx / nlen;
  const y = M.y + sgn * adj * ny / nlen;
  const t = addHaloText(g, x, y, text, STYLE.sideFS, {
    "text-anchor": "middle",
    "dominant-baseline": "middle"
  });
  if (rotate) {
    let theta = Math.atan2(vy, vx) * 180 / Math.PI;
    if (theta > 90) theta -= 180;
    if (theta < -90) theta += 180;
    t.setAttribute("transform", `rotate(${theta}, ${x}, ${y})`);
  }
}

/* ---------- TEGN FIGURER ---------- */
function ptsTo(arr) {
  return arr.map(p => `${p.x},${p.y}`).join(" ");
}
function shift(P, rect) {
  return {
    x: P.x + rect.x,
    y: P.y + rect.y
  };
}
function errorBox(g, rect, msg) {
  add(g, "rect", {
    x: rect.x + 10,
    y: rect.y + 10,
    width: rect.w - 20,
    height: 40,
    rx: 8,
    fill: "#ffecec",
    stroke: "#ffb3b3"
  });
  add(g, "text", {
    x: rect.x + 20,
    y: rect.y + 36,
    fill: "#c00",
    "font-size": 16
  }).textContent = msg;
}
function drawTriangleToGroup(g, rect, spec, adv, decorations) {
  var _Cs$1$y, _Cs$, _m$a, _m$b, _m$c, _m$d, _am$A, _am$B, _am$C, _am$D;
  const s = typeof spec === 'string' ? parseSpec(spec) : spec;
  const sol = solveTriangle(s);

  // y-opp konfig
  const A0 = {
    x: 0,
    y: 0
  };
  const B0 = {
    x: sol.c,
    y: 0
  };
  const Cs = circleCircle(A0, sol.b, B0, sol.a);
  if (Cs.length === 0) throw new Error("Trekant: ingen løsning fra oppgitte verdier.");
  const C0 = Cs[0].y >= ((_Cs$1$y = (_Cs$ = Cs[1]) === null || _Cs$ === void 0 ? void 0 : _Cs$.y) !== null && _Cs$1$y !== void 0 ? _Cs$1$y : -1e9) ? Cs[0] : Cs[1] || Cs[0];
  const base = [A0, B0, C0];
  const basePointsMap = {
    A: A0,
    B: B0,
    C: C0
  };
  const semicircleExtents = collectSemicircleExtentPoints(basePointsMap, decorations, ['A', 'B', 'C']);
  const squareExtents = collectSquareExtentPoints(basePointsMap, decorations, ['A', 'B', 'C']);
  const extraPts = semicircleExtents.concat(squareExtents);
  const fitPts = extraPts.length ? base.concat(extraPts) : base;
  const {
    T,
    k: renderScale
  } = fitTransformToRect(fitPts, rect.w, rect.h, 46);
  const A = shift(T(A0), rect),
    B = shift(T(B0), rect),
    C = shift(T(C0), rect),
    poly = [A, B, C];
  add(g, "polygon", {
    points: ptsTo(poly),
    fill: STYLE.faceFill,
    stroke: "none"
  });
  const ctr = polygonCentroid(poly);
  const pointsMap = {
    A,
    B,
    C
  };
  const heightInfos = collectHeightInfos(pointsMap, decorations);
  const activeHeight = heightInfos.length ? heightInfos[0] : null;
  let heightPoint = null;
  let heightTag = null;
  let heightLength = null;
  let baseForAngle = null;
  let heightAngleValue = null;
  let heightAngleMode = null;
  if (activeHeight) {
    heightPoint = activeHeight.foot;
    heightTag = activeHeight.tag;
    pointsMap.D = heightPoint;
    const vertex = activeHeight.vertex;
    const pixelHeight = dist(vertex, heightPoint);
    const scale = renderScale > 0 ? renderScale : 1;
    heightLength = pixelHeight / scale;
    const [baseA, baseB] = activeHeight.basePoints;
    const distToA = dist(baseA, vertex);
    const distToB = dist(baseB, vertex);
    baseForAngle = distToA <= distToB ? baseA : baseB;
    heightAngleValue = angleAt(heightPoint, baseForAngle, vertex);
    const am = adv.angles.mode,
      at = adv.angles.text;
    heightAngleMode = parseAnglePointMode((_am$D = am.D) !== null && _am$D !== void 0 ? _am$D : am.default, heightAngleValue, at.D, "D");
    drawConstructionLine(g, vertex, heightPoint);
    if (heightAngleMode.mark) {
      const baseDir = {
        x: activeHeight.basePoints[1].x - activeHeight.basePoints[0].x,
        y: activeHeight.basePoints[1].y - activeHeight.basePoints[0].y
      };
      const altDir = {
        x: vertex.x - heightPoint.x,
        y: vertex.y - heightPoint.y
      };
      const shouldDrawMarker = !(heightAngleMode.angleText || heightAngleMode.pointLabel);
      if (shouldDrawMarker) {
        drawRightAngleMarker(g, heightPoint, baseDir, altDir);
      }
    }
  }

  // sider
  const m = adv.sides.mode,
    st = adv.sides.text;
  sideLabelText(g, B, C, buildSideText((_m$a = m.a) !== null && _m$a !== void 0 ? _m$a : m.default, fmt(sol.a), st.a), true, ctr);
  sideLabelText(g, C, A, buildSideText((_m$b = m.b) !== null && _m$b !== void 0 ? _m$b : m.default, fmt(sol.b), st.b), true, ctr);
  sideLabelText(g, A, B, buildSideText((_m$c = m.c) !== null && _m$c !== void 0 ? _m$c : m.default, fmt(sol.c), st.c), true, ctr);
  if (activeHeight && heightLength !== null) {
    const heightText = buildSideText((_m$d = m.d) !== null && _m$d !== void 0 ? _m$d : m.default, fmt(heightLength), st.d);
    if (heightText) {
      sideLabelText(g, activeHeight.vertex, heightPoint, heightText, true, ctr, 12);
    }
  }

  // vinkler/punkter
  const am = adv.angles.mode,
    at = adv.angles.text;
  const angleAVal = angleAt(A, B, C);
  const angleBVal = angleAt(B, C, A);
  const angleCVal = angleAt(C, A, B);
  const Ares = parseAnglePointMode((_am$A = am.A) !== null && _am$A !== void 0 ? _am$A : am.default, angleAVal, at.A, "A");
  const Bres = parseAnglePointMode((_am$B = am.B) !== null && _am$B !== void 0 ? _am$B : am.default, angleBVal, at.B, "B");
  const Cres = parseAnglePointMode((_am$C = am.C) !== null && _am$C !== void 0 ? _am$C : am.default, angleCVal, at.C, "C");
  if (activeHeight && heightAngleMode && (heightAngleMode.mark || heightAngleMode.angleText || heightAngleMode.pointLabel)) {
    renderAngle(g, heightPoint, baseForAngle, activeHeight.vertex, angleRadius(heightPoint, baseForAngle, activeHeight.vertex), {
      mark: heightAngleMode.mark,
      angleText: heightAngleMode.angleText,
      pointLabel: heightAngleMode.pointLabel
    });
  }
  renderAngle(g, A, B, C, angleRadius(A, B, C), {
    mark: Ares.mark,
    angleText: Ares.angleText,
    pointLabel: Ares.pointLabel
  });
  renderAngle(g, B, C, A, angleRadius(B, C, A), {
    mark: Bres.mark,
    angleText: Bres.angleText,
    pointLabel: Bres.pointLabel
  });
  renderAngle(g, C, A, B, angleRadius(C, A, B), {
    mark: Cres.mark,
    angleText: Cres.angleText,
    pointLabel: Cres.pointLabel
  });
  add(g, "polygon", {
    points: ptsTo(poly),
    fill: "none",
    stroke: STYLE.edgeStroke,
    "stroke-width": STYLE.edgeWidth,
    "stroke-linejoin": "round",
    "stroke-linecap": "round"
  });
  const skipHeights = heightTag ? new Set([heightTag]) : null;
  renderDecorations(g, pointsMap, decorations, {
    skipHeights,
    centroid: ctr,
    pointOrder: ['A', 'B', 'C']
  });
  const summary = cloneJobForSummary({
    type: 'tri',
    obj: {
      a: sol.a,
      b: sol.b,
      c: sol.c,
      d: heightLength,
      A: angleAVal,
      B: angleBVal,
      C: angleCVal,
      D: heightAngleValue
    },
    decorations
  });
  if (summary) {
    const entries = [
      ['A', Ares, angleAVal],
      ['B', Bres, angleBVal],
      ['C', Cres, angleCVal]
    ];
    if (activeHeight && heightAngleMode) {
      entries.push(['D', heightAngleMode, heightAngleValue]);
    }
    summary.angleMarks = buildAngleMarkSummary(entries);
  }
  return summary;
}

function rotateTriangleSolution(sol, rotation) {
  if (!sol || typeof sol !== "object") return null;
  const r = ((rotation % 3) + 3) % 3;
  if (r === 0) {
    return {
      a: sol.a,
      b: sol.b,
      c: sol.c,
      A: sol.A,
      B: sol.B,
      C: sol.C
    };
  }
  const sideOrder = [
    ["a", "b", "c"],
    ["b", "c", "a"],
    ["c", "a", "b"]
  ];
  const angleOrder = [
    ["A", "B", "C"],
    ["B", "C", "A"],
    ["C", "A", "B"]
  ];
  const sides = sideOrder[r];
  const angles = angleOrder[r];
  return {
    a: sol[sides[0]],
    b: sol[sides[1]],
    c: sol[sides[2]],
    A: sol[angles[0]],
    B: sol[angles[1]],
    C: sol[angles[2]]
  };
}

function inferSharedSideKey(label) {
  if (!label || typeof label !== "string") return null;
  const trimmed = label.trim();
  if (!trimmed) return null;
  if (/^[abc]$/i.test(trimmed)) return trimmed.toLowerCase();
  const letters = trimmed.toUpperCase().replace(/[^A-Z]/g, "");
  if (!letters) return null;
  const pair = letters.length >= 2 ? letters.slice(0, 2) : letters;
  const map = {
    AB: "c",
    BA: "c",
    BC: "a",
    CB: "a",
    AC: "b",
    CA: "b"
  };
  return map[pair] || null;
}

function pickSharedSideForDoubleTriangle(firstSol, secondSol, firstSpec, secondSpec, sharedLabel) {
  if (!firstSol || !secondSol) return null;
  const sideKeys = ["a", "b", "c"];
  const firstExplicit = new Set(sideKeys.filter(key => firstSpec && Object.prototype.hasOwnProperty.call(firstSpec, key)));
  const secondExplicit = new Set(sideKeys.filter(key => secondSpec && Object.prototype.hasOwnProperty.call(secondSpec, key)));
  const combos = [];
  sideKeys.forEach(firstKey => {
    const v1 = firstSol[firstKey];
    if (!(v1 > 0)) return;
    sideKeys.forEach(secondKey => {
      const v2 = secondSol[secondKey];
      if (!(v2 > 0)) return;
      const diff = Math.abs(v1 - v2);
      const relDiff = diff / Math.max(v1, v2, 1e-9);
      combos.push({
        firstKey,
        secondKey,
        firstValue: v1,
        secondValue: v2,
        diff,
        relDiff,
        explicitFirst: firstExplicit.has(firstKey),
        explicitSecond: secondExplicit.has(secondKey),
        sameLetter: firstKey === secondKey
      });
    });
  });
  if (!combos.length) return null;
  combos.sort((a, b) => {
    const explicitA = (a.explicitFirst ? 1 : 0) + (a.explicitSecond ? 1 : 0);
    const explicitB = (b.explicitFirst ? 1 : 0) + (b.explicitSecond ? 1 : 0);
    if (explicitA !== explicitB) return explicitB - explicitA;
    if (a.sameLetter !== b.sameLetter) return (b.sameLetter ? 1 : 0) - (a.sameLetter ? 1 : 0);
    if (a.relDiff !== b.relDiff) return a.relDiff - b.relDiff;
    if (a.diff !== b.diff) return a.diff - b.diff;
    return 0;
  });
  const REL_TOLERANCE = 0.02;
  const ABS_TOLERANCE = 1e-3;
  const withinTolerance = combo => combo.relDiff <= REL_TOLERANCE || combo.diff <= ABS_TOLERANCE;
  const preferredKey = inferSharedSideKey(sharedLabel);
  if (preferredKey) {
    const preferredCombos = combos.filter(combo => combo.firstKey === preferredKey && combo.secondKey === preferredKey);
    for (const combo of preferredCombos) {
      if (withinTolerance(combo)) {
        return combo;
      }
    }
  }
  for (const combo of combos) {
    if (withinTolerance(combo)) {
      return combo;
    }
  }
  if (preferredKey) {
    const fallbackPreferred = combos.find(combo => combo.firstKey === preferredKey && combo.secondKey === preferredKey);
    if (fallbackPreferred) {
      return fallbackPreferred;
    }
  }
  return combos[0];
}

function drawDoubleTriangleToGroup(g, rect, spec, adv, decorations) {
  const sharedSpec = spec && spec.shared ? { ...spec.shared } : { label: '', value: null, requested: false };
  const firstSpec = spec && spec.first ? spec.first : {};
  const secondSpec = spec && spec.second ? spec.second : {};
  let firstSol = solveTriangle(firstSpec);
  let secondSol = solveTriangle(secondSpec);
  const shared = pickSharedSideForDoubleTriangle(firstSol, secondSol, firstSpec, secondSpec, sharedSpec && sharedSpec.label);
  if (!shared) {
    throw new Error('Dobbel trekant: begge trekantene må ha en felles side.');
  }
  const rotationMap = { a: 1, b: 2, c: 0 };
  const firstRot = rotateTriangleSolution(firstSol, rotationMap[shared.firstKey] || 0);
  const secondRot = rotateTriangleSolution(secondSol, rotationMap[shared.secondKey] || 0);
  if (!firstRot || !secondRot) {
    throw new Error('Dobbel trekant: klarte ikke å identifisere felles side.');
  }
  firstSol = firstRot;
  secondSol = secondRot;
  const baseDiff = Math.abs(firstSol.c - secondSol.c);
  const baseTol = Math.max(1e-3, Math.max(firstSol.c, secondSol.c) * 0.02);
  if (!(firstSol.c > 0) || !(secondSol.c > 0) || baseDiff > baseTol) {
    throw new Error('Dobbel trekant: felles side må være lik i begge spesifikasjonene.');
  }
  sharedSpec.value = firstSol.c;
  secondSol = { ...secondSol, c: firstSol.c };
  const baseLength = firstSol.c;
  const A0 = { x: 0, y: 0 };
  const B0 = { x: baseLength, y: 0 };
  const topCandidates = circleCircle(A0, firstSol.b, B0, firstSol.a);
  if (!topCandidates.length) {
    throw new Error('Dobbel trekant: klarte ikke å konstruere øvre trekant.');
  }
  let C0 = topCandidates[0];
  if (topCandidates.length === 2) {
    C0 = topCandidates[0].y >= topCandidates[1].y ? topCandidates[0] : topCandidates[1];
  }
  if (C0.y < 0) C0 = { x: C0.x, y: Math.abs(C0.y) };
  if (Math.abs(C0.y) < 1e-6) {
    C0 = { x: C0.x, y: Math.max(baseLength * 0.4, 1) };
  }
  const bottomCandidates = circleCircle(A0, secondSol.b, B0, secondSol.a);
  if (!bottomCandidates.length) {
    throw new Error('Dobbel trekant: klarte ikke å konstruere nedre trekant.');
  }
  let D0 = bottomCandidates[0];
  if (bottomCandidates.length === 2) {
    D0 = bottomCandidates[0].y <= bottomCandidates[1].y ? bottomCandidates[0] : bottomCandidates[1];
  }
  if (D0.y > 0) D0 = { x: D0.x, y: -Math.abs(D0.y) };
  if (Math.abs(D0.y) < 1e-6) {
    D0 = { x: D0.x, y: -Math.max(baseLength * 0.4, 1) };
  }
  const basePointsMap = { A: A0, B: B0, C: C0, D: D0 };
  const semicircleExtents = collectSemicircleExtentPoints(basePointsMap, decorations, ['A', 'B', 'C', 'D']);
  const squareExtents = collectSquareExtentPoints(basePointsMap, decorations, ['A', 'B', 'C', 'D']);
  const basePts = [A0, B0, C0, D0];
  const extraPts = semicircleExtents.concat(squareExtents);
  const fitPts = extraPts.length ? basePts.concat(extraPts) : basePts;
  const { T } = fitTransformToRect(fitPts, rect.w, rect.h, 46);
  const A = shift(T(A0), rect);
  const B = shift(T(B0), rect);
  const C = shift(T(C0), rect);
  const D = shift(T(D0), rect);
  const topPoly = [A, B, C];
  const bottomPoly = [A, B, D];
  add(g, 'polygon', {
    points: ptsTo(bottomPoly),
    fill: STYLE.faceFill,
    stroke: 'none'
  });
  add(g, 'polygon', {
    points: ptsTo(topPoly),
    fill: STYLE.faceFill,
    stroke: 'none'
  });
  const edges = [
    [A, B],
    [B, C],
    [C, A],
    [B, D],
    [D, A]
  ];
  edges.forEach(([P, Q]) => {
    add(g, 'line', {
      x1: P.x,
      y1: P.y,
      x2: Q.x,
      y2: Q.y,
      stroke: STYLE.edgeStroke,
      'stroke-width': STYLE.edgeWidth,
      'stroke-linecap': 'round'
    });
  });
  const advSides = adv && adv.sides ? adv.sides : { mode: {}, text: {} };
  const advAngles = adv && adv.angles ? adv.angles : { mode: {}, text: {} };
  const centroidTop = polygonCentroid(topPoly);
  const centroidBottom = polygonCentroid(bottomPoly);
  const sharedLabel = typeof sharedSpec.label === 'string' ? sharedSpec.label.trim() : '';
  const baseMode = advSides.mode && advSides.mode.c ? advSides.mode.c : advSides.mode && advSides.mode.default;
  const baseCustom = advSides.text && typeof advSides.text.c === 'string' && advSides.text.c.trim() ? advSides.text.c : (sharedLabel || 'c');
  const baseValueStr = fmt(firstSol.c);
  const baseText = buildSideText(baseMode, baseValueStr, baseCustom);
  if (baseText) {
    sideLabelText(g, A, B, baseText, true, centroidTop, 24);
  }
  const sideMode = key => advSides.mode && advSides.mode[key] ? advSides.mode[key] : advSides.mode && advSides.mode.default;
  const sideText = (key, fallback) => {
    const txt = advSides.text && advSides.text[key];
    if (typeof txt === 'string' && txt.trim()) return txt;
    return fallback;
  };
  const topAVal = fmt(firstSol.a);
  const topBVal = fmt(firstSol.b);
  const topAText = buildSideText(sideMode('a'), topAVal, sideText('a', 'a'));
  if (topAText) sideLabelText(g, B, C, topAText, true, centroidTop);
  const topBText = buildSideText(sideMode('b'), topBVal, sideText('b', 'b'));
  if (topBText) sideLabelText(g, A, C, topBText, true, centroidTop);
  const bottomAVal = fmt(secondSol.a);
  const bottomBVal = fmt(secondSol.b);
  const bottomAText = buildSideText(sideMode('d'), bottomAVal, sideText('d', 'a₂'));
  if (bottomAText) sideLabelText(g, B, D, bottomAText, true, centroidBottom);
  const bottomBText = buildSideText(sideMode('e'), bottomBVal, sideText('e', 'b₂'));
  if (bottomBText) sideLabelText(g, A, D, bottomBText, true, centroidBottom);
  const angleMode = key => advAngles.mode && advAngles.mode[key] ? advAngles.mode[key] : advAngles.mode && advAngles.mode.default;
  const angleText = key => advAngles.text && advAngles.text[key];
  const AresTop = parseAnglePointMode(angleMode('A'), firstSol.A, angleText('A'), 'A');
  const BresTop = parseAnglePointMode(angleMode('B'), firstSol.B, angleText('B'), 'B');
  const CresTop = parseAnglePointMode(angleMode('C'), firstSol.C, angleText('C'), 'C');
  renderAngle(g, B, A, C, angleRadius(B, A, C), {
    mark: AresTop.mark,
    angleText: AresTop.angleText,
    pointLabel: AresTop.pointLabel
  });
  renderAngle(g, A, B, C, angleRadius(A, B, C), {
    mark: BresTop.mark,
    angleText: BresTop.angleText,
    pointLabel: BresTop.pointLabel
  });
  renderAngle(g, A, C, B, angleRadius(A, C, B), {
    mark: CresTop.mark,
    angleText: CresTop.angleText,
    pointLabel: CresTop.pointLabel
  });
  const AresBottom = parseAnglePointMode(angleMode('A'), secondSol.A, angleText('A'), 'A');
  const BresBottom = parseAnglePointMode(angleMode('B'), secondSol.B, angleText('B'), 'B');
  const DresBottom = parseAnglePointMode(angleMode('D'), secondSol.C, angleText('D'), 'D');
  renderAngle(g, B, A, D, angleRadius(B, A, D), {
    mark: AresBottom.mark,
    angleText: AresBottom.angleText,
    pointLabel: AresBottom.pointLabel
  });
  renderAngle(g, A, B, D, angleRadius(A, B, D), {
    mark: BresBottom.mark,
    angleText: BresBottom.angleText,
    pointLabel: BresBottom.pointLabel
  });
  renderAngle(g, A, D, B, angleRadius(A, D, B), {
    mark: DresBottom.mark,
    angleText: DresBottom.angleText,
    pointLabel: DresBottom.pointLabel
  });
  const pointsMap = { A, B, C, D };
  if (decorations && decorations.length) {
    const decoCentroid = centroidFromPointMap(pointsMap, ['A', 'B', 'C', 'D']);
    renderDecorations(g, pointsMap, decorations, {
      centroid: decoCentroid,
      pointOrder: ['A', 'B', 'C', 'D']
    });
  }
  const angleMarksTop = buildAngleMarkSummary([
    ['A', AresTop, firstSol.A],
    ['B', BresTop, firstSol.B],
    ['C', CresTop, firstSol.C]
  ]);
  const angleMarksBottom = buildAngleMarkSummary([
    ['A', AresBottom, secondSol.A],
    ['B', BresBottom, secondSol.B],
    ['D', DresBottom, secondSol.C]
  ]);
  const angleMarks = { ...angleMarksTop };
  Object.entries(angleMarksBottom).forEach(([key, info]) => {
    if (!info) return;
    if (!angleMarks[key]) {
      angleMarks[key] = { ...info };
    } else {
      angleMarks[key] = {
        label: info.label || angleMarks[key].label,
        marked: Boolean((angleMarks[key] && angleMarks[key].marked) || info.marked),
        right: Boolean((angleMarks[key] && angleMarks[key].right) || info.right)
      };
      if (!angleMarks[key].label && angleMarksTop[key]) {
        angleMarks[key].label = angleMarksTop[key].label;
      }
    }
  });
  const summary = cloneJobForSummary({
    type: 'doubleTri',
    obj: {
      shared: {
        label: sharedLabel,
        value: firstSol.c,
        requested: Boolean(sharedSpec && sharedSpec.requested)
      },
      first: {
        a: firstSol.a,
        b: firstSol.b,
        c: firstSol.c,
        A: firstSol.A,
        B: firstSol.B,
        C: firstSol.C
      },
      second: {
        a: secondSol.a,
        b: secondSol.b,
        c: secondSol.c,
        A: secondSol.A,
        B: secondSol.B,
        D: secondSol.C
      }
    },
    decorations
  });
  if (summary) {
    summary.angleMarks = angleMarks;
  }
  return summary;
}
function drawQuadToGroup(g, rect, spec, adv, decorations) {
  var _m$a2, _m$b2, _m$c2, _m$d, _am$A2, _am$B2, _am$C2, _am$D;
  const s = typeof spec === 'string' ? parseSpec(spec) : spec;
  let {
    a,
    b,
    c,
    d,
    A: AngA,
    B: AngB,
    C: AngC,
    D: AngD
  } = s;
  if (!(a > 0 && b > 0 && c > 0)) throw new Error("Firkant: må ha a, b, c > 0.");
  const angleKeys = ["A", "B", "C", "D"].filter(k => k in s);
  if (angleKeys.length === 0) throw new Error("Firkant: angi vinkel (minst én).");
  const A0 = {
      x: 0,
      y: 0
    },
    B0 = {
      x: a,
      y: 0
    };
  let C0, D0;
  const pickCCW_D = (C, D1, D2) => {
    const area1 = polygonArea([A0, B0, C, D1]);
    const area2 = polygonArea([A0, B0, C, D2]);
    if (area1 >= 0 && area2 < 0) return D1;
    if (area2 >= 0 && area1 < 0) return D2;
    return area1 >= area2 ? D1 : D2;
  };
  if (angleKeys.length === 1 && d > 0) {
    const angleKey = angleKeys[0];
    if (angleKey === "A") {
      const theta = rad(AngA);
      D0 = {
        x: A0.x + d * Math.cos(theta),
        y: A0.y + d * Math.sin(theta)
      };
      const Cs = circleCircle(B0, b, D0, c);
      if (Cs.length === 0) throw new Error("Firkant (A): ingen løsning – sjekk mål.");
      C0 = Cs.length === 1 ? Cs[0] : polygonArea([A0, B0, Cs[0], D0]) > polygonArea([A0, B0, Cs[1], D0]) ? Cs[0] : Cs[1];
    } else if (angleKey === "B") {
      const theta = Math.PI - rad(AngB);
      C0 = {
        x: B0.x + b * Math.cos(theta),
        y: B0.y + b * Math.sin(theta)
      };
      const Ds = circleCircle(A0, d, C0, c);
      if (Ds.length === 0) throw new Error("Firkant (B): ingen løsning – sjekk mål.");
      D0 = Ds.length === 1 ? Ds[0] : pickCCW_D(C0, Ds[0], Ds[1]);
    } else {
      var _Cs$1$y2, _Cs$2;
      const Cs = circleCircle(A0, b, B0, a);
      if (Cs.length === 0) throw new Error(`Firkant (${angleKey}): ingen løsning – sjekk mål.`);
      C0 = Cs[0].y >= ((_Cs$1$y2 = (_Cs$2 = Cs[1]) === null || _Cs$2 === void 0 ? void 0 : _Cs$2.y) !== null && _Cs$1$y2 !== void 0 ? _Cs$1$y2 : -1e9) ? Cs[0] : Cs[1] || Cs[0];
      const Ds = circleCircle(A0, d, C0, c);
      if (Ds.length === 0) throw new Error(`Firkant (${angleKey}): ingen løsning – sjekk mål.`);
      if (Ds.length === 1) {
        D0 = Ds[0];
      } else {
        if (angleKey === "C") {
          const cand = Ds.map(Dc => ({
            D: Dc,
            ang: angleAt(C0, B0, Dc)
          }));
          cand.sort((u, v) => Math.abs(u.ang - AngC) - Math.abs(v.ang - AngC));
          D0 = cand[0].D;
          if (polygonArea([A0, B0, C0, D0]) < 0) D0 = Ds[0] === D0 ? Ds[1] : Ds[0];
        } else if (angleKey === "D") {
          const cand = Ds.map(Dc => ({
            D: Dc,
            ang: angleAt(Dc, C0, A0)
          }));
          cand.sort((u, v) => Math.abs(u.ang - AngD) - Math.abs(v.ang - AngD));
          D0 = cand[0].D;
          if (polygonArea([A0, B0, C0, D0]) < 0) D0 = Ds[0] === D0 ? Ds[1] : Ds[0];
        } else {
          D0 = pickCCW_D(C0, Ds[0], Ds[1]);
        }
      }
    }
  } else if (angleKeys.length === 2 && !d) {
    if (angleKeys.includes("B") && angleKeys.includes("D")) {
      const thetaB = Math.PI - rad(AngB);
      C0 = {
        x: B0.x + b * Math.cos(thetaB),
        y: B0.y + b * Math.sin(thetaB)
      };
      const AC = dist(A0, C0);
      const cosD = Math.cos(rad(AngD)),
        sinD = Math.sin(rad(AngD));
      const disc = AC * AC - c * sinD * (c * sinD);
      if (disc < 0) throw new Error("Firkant (B&D): ingen løsning – sjekk mål.");
      d = c * cosD + Math.sqrt(disc);
      const Ds = circleCircle(A0, d, C0, c);
      if (Ds.length === 0) throw new Error("Firkant (B&D): ingen løsning – sjekk mål.");
      D0 = Ds.length === 1 ? Ds[0] : pickCCW_D(C0, Ds[0], Ds[1]);
    } else {
      throw new Error("Firkant: to vinkler støttes bare for B og D.");
    }
  } else {
    throw new Error("Firkant: støttes med d+1 vinkel eller to vinkler B og D.");
  }
  const base = [A0, B0, C0, D0];
  const basePointsMap = {
    A: A0,
    B: B0,
    C: C0,
    D: D0
  };
  const semicircleExtents = collectSemicircleExtentPoints(basePointsMap, decorations, ['A', 'B', 'C', 'D']);
  const squareExtents = collectSquareExtentPoints(basePointsMap, decorations, ['A', 'B', 'C', 'D']);
  const extraPts = semicircleExtents.concat(squareExtents);
  const fitPts = extraPts.length ? base.concat(extraPts) : base;
  const {
    T
  } = fitTransformToRect(fitPts, rect.w, rect.h, 46);
  const A = shift(T(A0), rect),
    B = shift(T(B0), rect),
    C = shift(T(C0), rect),
    D = shift(T(D0), rect);
  const poly = [A, B, C, D];
  add(g, "polygon", {
    points: ptsTo(poly),
    fill: STYLE.faceFill,
    stroke: "none"
  });
  const ctr = polygonCentroid(poly);

  // sider
  const m = adv.sides.mode,
    st = adv.sides.text;
  sideLabelText(g, A, B, buildSideText((_m$a2 = m.a) !== null && _m$a2 !== void 0 ? _m$a2 : m.default, fmt(a), st.a), true, ctr);
  sideLabelText(g, B, C, buildSideText((_m$b2 = m.b) !== null && _m$b2 !== void 0 ? _m$b2 : m.default, fmt(b), st.b), true, ctr);
  sideLabelText(g, C, D, buildSideText((_m$c2 = m.c) !== null && _m$c2 !== void 0 ? _m$c2 : m.default, fmt(c), st.c), true, ctr);
  sideLabelText(g, D, A, buildSideText((_m$d = m.d) !== null && _m$d !== void 0 ? _m$d : m.default, fmt(d), st.d), true, ctr);

  // vinkler/punkter
  const am = adv.angles.mode,
    at = adv.angles.text;
  const angleAVal = angleAt(A, D, B);
  const angleBVal = angleAt(B, A, C);
  const angleCVal = angleAt(C, B, D);
  const angleDVal = angleAt(D, C, A);
  const Ares = parseAnglePointMode((_am$A2 = am.A) !== null && _am$A2 !== void 0 ? _am$A2 : am.default, angleAVal, at.A, "A");
  const Bres = parseAnglePointMode((_am$B2 = am.B) !== null && _am$B2 !== void 0 ? _am$B2 : am.default, angleBVal, at.B, "B");
  const Cres = parseAnglePointMode((_am$C2 = am.C) !== null && _am$C2 !== void 0 ? _am$C2 : am.default, angleCVal, at.C, "C");
  const Dres = parseAnglePointMode((_am$D = am.D) !== null && _am$D !== void 0 ? _am$D : am.default, angleDVal, at.D, "D");
  renderAngle(g, A, D, B, angleRadius(A, D, B), {
    mark: Ares.mark,
    angleText: Ares.angleText,
    pointLabel: Ares.pointLabel
  });
  renderAngle(g, B, A, C, angleRadius(B, A, C), {
    mark: Bres.mark,
    angleText: Bres.angleText,
    pointLabel: Bres.pointLabel
  });
  renderAngle(g, C, B, D, angleRadius(C, B, D), {
    mark: Cres.mark,
    angleText: Cres.angleText,
    pointLabel: Cres.pointLabel
  });
  renderAngle(g, D, C, A, angleRadius(D, C, A), {
    mark: Dres.mark,
    angleText: Dres.angleText,
    pointLabel: Dres.pointLabel
  });
  add(g, "polygon", {
    points: ptsTo(poly),
    fill: "none",
    stroke: STYLE.edgeStroke,
    "stroke-width": STYLE.edgeWidth,
    "stroke-linejoin": "round",
    "stroke-linecap": "round"
  });
  renderDecorations(g, {
    A,
    B,
    C,
    D
  }, decorations, {
    centroid: ctr,
    pointOrder: ['A', 'B', 'C', 'D']
  });
  const summary = cloneJobForSummary({
    type: 'quad',
    obj: {
      a,
      b,
      c,
      d,
      A: angleAVal,
      B: angleBVal,
      C: angleCVal,
      D: angleDVal
    },
    decorations
  });
  if (summary) {
    summary.angleMarks = buildAngleMarkSummary([
      ['A', Ares, angleAVal],
      ['B', Bres, angleBVal],
      ['C', Cres, angleCVal],
      ['D', Dres, angleDVal]
    ]);
  }
  return summary;
}
function drawCircleToGroup(g, rect, spec) {
  const cx = rect.x + rect.w / 2;
  const cy = rect.y + rect.h / 2;
  const radius = Math.max(40, Math.min(rect.w, rect.h) / 2 - 50);
  const circleRadius = radius > 0 ? radius : Math.min(rect.w, rect.h) * 0.35;
  const radiusEntry = spec && spec.radius;
  const showRadius = radiusEntry && radiusEntry.requested;
  const radiusText = showRadius ? normalizedDimensionText(radiusEntry, 'r') : '';
  const diameter = spec && spec.diameter;
  const diameterText = diameter ? normalizedDimensionText(diameter, 'd') : '';
  add(g, "circle", {
    cx,
    cy,
    r: circleRadius,
    fill: STYLE.faceFill,
    stroke: "none"
  });
  add(g, "circle", {
    cx,
    cy,
    r: circleRadius,
    fill: "none",
    stroke: STYLE.edgeStroke,
    "stroke-width": STYLE.edgeWidth
  });
  const radiusAngle = -Math.PI / 4;
  if (showRadius) {
    const endX = cx + circleRadius * Math.cos(radiusAngle);
    const endY = cy + circleRadius * Math.sin(radiusAngle);
    add(g, "line", {
      x1: cx,
      y1: cy,
      x2: endX,
      y2: endY,
      stroke: STYLE.radiusStroke || STYLE.edgeStroke,
      "stroke-width": STYLE.edgeWidth * 0.75,
      "stroke-linecap": "round"
    });
    add(g, "circle", {
      cx,
      cy,
      r: 6,
      fill: STYLE.radiusStroke || STYLE.edgeStroke
    });
  }
  if (showRadius && radiusText) {
    const midX = cx + circleRadius * Math.cos(radiusAngle) * 0.55;
    const midY = cy + circleRadius * Math.sin(radiusAngle) * 0.55;
    const labelOffset = 16;
    const labelX = midX + Math.cos(radiusAngle + Math.PI / 2) * labelOffset;
    const labelY = midY + Math.sin(radiusAngle + Math.PI / 2) * labelOffset;
    addHaloText(g, labelX, labelY, radiusText, STYLE.sideFS, {
      "text-anchor": "middle",
      "dominant-baseline": "middle"
    });
  }
  if (diameter && diameter.requested && diameterText) {
    add(g, "line", {
      x1: cx - circleRadius,
      y1: cy,
      x2: cx + circleRadius,
      y2: cy,
      stroke: STYLE.edgeStroke,
      "stroke-width": STYLE.edgeWidth * 0.6,
      "stroke-linecap": "round",
      "stroke-dasharray": "12 10"
    });
    addHaloText(g, cx, cy - circleRadius * 0.4, diameterText, STYLE.sideFS, {
      "text-anchor": "middle",
      "dominant-baseline": "middle"
    });
  }
}
function indexToLetter(idx, upperCase) {
  const alphabet = upperCase ? 'ABCDEFGHIJKLMNOPQRSTUVWXYZ' : 'abcdefghijklmnopqrstuvwxyz';
  const baseLen = alphabet.length;
  let n = Math.max(0, Math.floor(idx));
  let out = '';
  do {
    out = alphabet[n % baseLen] + out;
    n = Math.floor(n / baseLen) - 1;
  } while (n >= 0);
  return out;
}
function normalizeArcSideSpecifier(sideSpec, count) {
  const cappedCount = Math.max(3, Math.floor(count || 0) || 3);
  const defaultLabels = Array.from({
    length: cappedCount
  }, (_, i) => indexToLetter(i, true));
  const tokens = parseArcSideTokens(sideSpec);
  let first = tokens[0] || '';
  let second = tokens[1] || '';
  if (!first) first = defaultLabels[0];
  if (!second) second = defaultLabels[(1) % cappedCount];
  let idxA = defaultLabels.findIndex(label => label === first);
  let idxB = defaultLabels.findIndex(label => label === second);
  if (idxA === -1 && idxB === -1) {
    idxA = 0;
    idxB = 1 % cappedCount;
  } else if (idxA === -1) {
    idxA = (idxB - 1 + cappedCount) % cappedCount;
  } else if (idxB === -1) {
    idxB = (idxA + 1) % cappedCount;
  }
  if ((idxA + 1) % cappedCount === idxB) {
    return {
      startIndex: idxA,
      endIndex: idxB,
      label: `${defaultLabels[idxA]}${defaultLabels[idxB]}`
    };
  }
  if ((idxB + 1) % cappedCount === idxA) {
    return {
      startIndex: idxB,
      endIndex: idxA,
      label: `${defaultLabels[idxB]}${defaultLabels[idxA]}`
    };
  }
  const startIndex = Math.max(0, idxA);
  const endIndex = (startIndex + 1) % cappedCount;
  return {
    startIndex,
    endIndex,
    label: `${defaultLabels[startIndex]}${defaultLabels[endIndex]}`
  };
}
function deriveSequentialLabel(base, index, upperCase) {
  const fallback = indexToLetter(index, upperCase);
  if (!base) return fallback;
  const trimmed = base.trim();
  if (/^[A-Za-z]$/.test(trimmed)) {
    const offset = trimmed.toLowerCase().charCodeAt(0) - 97;
    return indexToLetter(offset + index, upperCase);
  }
  if (upperCase && !/^[A-Za-z]/.test(trimmed)) {
    return fallback;
  }
  if (index === 0) {
    return upperCase ? trimmed.toUpperCase() : trimmed;
  }
  return `${upperCase ? trimmed.toUpperCase() : trimmed}${index + 1}`;
}
function drawRegularPolygonToGroup(g, rect, spec, adv) {
  const countRaw = spec && Number.isFinite(spec.sides) ? spec.sides : 5;
  const count = Math.max(3, Math.round(countRaw));
  const cx = rect.x + rect.w / 2;
  const cy = rect.y + rect.h / 2;
  const radius = Math.max(40, Math.min(rect.w, rect.h) / 2 - 50);
  const polyRadius = radius > 0 ? radius : Math.min(rect.w, rect.h) * 0.35;
  const pts = [];
  const startAngle = -Math.PI / 2;
  for (let i = 0; i < count; i++) {
    const theta = startAngle + i * 2 * Math.PI / count;
    pts.push({
      x: cx + polyRadius * Math.cos(theta),
      y: cy + polyRadius * Math.sin(theta)
    });
  }
  add(g, "polygon", {
    points: ptsTo(pts),
    fill: STYLE.faceFill,
    stroke: "none"
  });
  add(g, "polygon", {
    points: ptsTo(pts),
    fill: "none",
    stroke: STYLE.edgeStroke,
    "stroke-width": STYLE.edgeWidth,
    "stroke-linejoin": "round"
  });
  const ctr = polygonCentroid(pts);
  const advSides = adv && adv.sides ? adv.sides : { mode: {}, text: {} };
  const advAngles = adv && adv.angles ? adv.angles : { mode: {}, text: {} };
  const sideValueStr = spec && spec.side && Number.isFinite(spec.side.value) ? fmt(spec.side.value) : '';
  const baseSideLabel = normalizedDimensionText(spec && spec.side, 'a');
  for (let i = 0; i < count; i++) {
    const P = pts[i];
    const Q = pts[(i + 1) % count];
    const sideKey = indexToLetter(i, false);
    const mode = advSides.mode && advSides.mode[sideKey] ? advSides.mode[sideKey] : advSides.mode && advSides.mode.default;
    const customText = advSides.text && advSides.text[sideKey] ? advSides.text[sideKey] : deriveSequentialLabel(baseSideLabel, i, false);
    let label = buildSideText(mode, sideValueStr, customText);
    if (!label && customText) {
      label = customText;
    }
    if (label) {
      sideLabelText(g, P, Q, label, true, ctr, 18);
    }
  }
  for (let i = 0; i < count; i++) {
    const prev = pts[(i - 1 + count) % count];
    const cur = pts[i];
    const next = pts[(i + 1) % count];
    const angleKey = indexToLetter(i, true);
    const mode = advAngles.mode && advAngles.mode[angleKey] ? advAngles.mode[angleKey] : advAngles.mode && advAngles.mode.default;
    if (!mode || String(mode).toLowerCase() === 'none') continue;
    const customText = advAngles.text && advAngles.text[angleKey] ? advAngles.text[angleKey] : deriveSequentialLabel(baseSideLabel, i, true);
    const angleVal = angleAt(cur, prev, next);
    const parsed = parseAnglePointMode(mode, angleVal, customText, angleKey);
    renderAngle(g, cur, prev, next, angleRadius(cur, prev, next), {
      mark: parsed.mark,
      angleText: parsed.angleText,
      pointLabel: parsed.pointLabel
    });
  }
  // Previously the number of sides was annotated in the centre of the polygon
  // (e.g. "n=10"). This visual label is no longer desired, so we omit it.
}
function drawPolygonWithArcToGroup(g, rect, spec, adv, decorations) {
  const polygonSpec = spec && spec.polygon ? spec.polygon : {};
  const countRaw = polygonSpec && Number.isFinite(polygonSpec.sides) ? polygonSpec.sides : 5;
  const count = Math.max(3, Math.round(countRaw));
  const cx = rect.x + rect.w / 2;
  const cy = rect.y + rect.h / 2;
  const radius = Math.max(40, Math.min(rect.w, rect.h) / 2 - 50);
  const polyRadius = radius > 0 ? radius : Math.min(rect.w, rect.h) * 0.35;
  const pts = [];
  const startAngle = -Math.PI / 2;
  for (let i = 0; i < count; i++) {
    const theta = startAngle + i * 2 * Math.PI / count;
    pts.push({
      x: cx + polyRadius * Math.cos(theta),
      y: cy + polyRadius * Math.sin(theta)
    });
  }
  add(g, "polygon", {
    points: ptsTo(pts),
    fill: STYLE.faceFill,
    stroke: "none"
  });
  add(g, "polygon", {
    points: ptsTo(pts),
    fill: "none",
    stroke: STYLE.edgeStroke,
    "stroke-width": STYLE.edgeWidth,
    "stroke-linejoin": "round"
  });
  const ctr = polygonCentroid(pts);
  const advSides = adv && adv.sides ? adv.sides : { mode: {}, text: {} };
  const advAngles = adv && adv.angles ? adv.angles : { mode: {}, text: {} };
  const sideValueStr = polygonSpec && polygonSpec.side && Number.isFinite(polygonSpec.side.value) ? fmt(polygonSpec.side.value) : '';
  const baseSideLabel = normalizedDimensionText(polygonSpec && polygonSpec.side, 'a');
  for (let i = 0; i < count; i++) {
    const P = pts[i];
    const Q = pts[(i + 1) % count];
    const sideKey = indexToLetter(i, false);
    const mode = advSides.mode && advSides.mode[sideKey] ? advSides.mode[sideKey] : advSides.mode && advSides.mode.default;
    const customText = advSides.text && advSides.text[sideKey] ? advSides.text[sideKey] : deriveSequentialLabel(baseSideLabel, i, false);
    let label = buildSideText(mode, sideValueStr, customText);
    if (!label && customText) {
      label = customText;
    }
    if (label) {
      sideLabelText(g, P, Q, label, true, ctr, 18);
    }
  }
  for (let i = 0; i < count; i++) {
    const prev = pts[(i - 1 + count) % count];
    const cur = pts[i];
    const next = pts[(i + 1) % count];
    const angleKey = indexToLetter(i, true);
    const mode = advAngles.mode && advAngles.mode[angleKey] ? advAngles.mode[angleKey] : advAngles.mode && advAngles.mode.default;
    if (!mode || String(mode).toLowerCase() === 'none') continue;
    const customText = advAngles.text && advAngles.text[angleKey] ? advAngles.text[angleKey] : deriveSequentialLabel(baseSideLabel, i, true);
    const angleVal = angleAt(cur, prev, next);
    const parsed = parseAnglePointMode(mode, angleVal, customText, angleKey);
    renderAngle(g, cur, prev, next, angleRadius(cur, prev, next), {
      mark: parsed.mark,
      angleText: parsed.angleText,
      pointLabel: parsed.pointLabel
    });
  }
  const resolvedSide = normalizeArcSideSpecifier(spec && spec.side, count);
  const startIndex = resolvedSide.startIndex;
  const endIndex = resolvedSide.endIndex;
  const P = pts[startIndex];
  const Q = pts[endIndex];
  const chordVec = {
    x: Q.x - P.x,
    y: Q.y - P.y
  };
  const chordLen = Math.hypot(chordVec.x, chordVec.y) || 1;
  const center = {
    x: (P.x + Q.x) / 2,
    y: (P.y + Q.y) / 2
  };
  let normal = {
    x: chordVec.y / chordLen,
    y: -chordVec.x / chordLen
  };
  const interiorSign = (Q.x - P.x) * (ctr.y - P.y) - (Q.y - P.y) * (ctr.x - P.x);
  if (interiorSign < 0) {
    normal.x *= -1;
    normal.y *= -1;
  }
  const arcRadius = chordLen / 2;
  const midArc = {
    x: center.x + normal.x * arcRadius,
    y: center.y + normal.y * arcRadius
  };
  const cross = (Q.x - P.x) * (midArc.y - P.y) - (Q.y - P.y) * (midArc.x - P.x);
  const sweep = cross < 0 ? 1 : 0;
  add(g, "path", {
    d: `M ${P.x} ${P.y} A ${arcRadius} ${arcRadius} 0 0 ${sweep} ${Q.x} ${Q.y}`,
    fill: "none",
    stroke: STYLE.edgeStroke,
    "stroke-width": STYLE.edgeWidth,
    "stroke-linecap": "round"
  });
  const radiusEntry = spec && spec.radius;
  const showRadius = radiusEntry && radiusEntry.requested;
  const diameterEntry = spec && spec.diameter;
  const radiusText = showRadius ? normalizedDimensionText(radiusEntry, 'r') : '';
  const diameterText = diameterEntry ? normalizedDimensionText(diameterEntry, 'd') : '';
  add(g, "line", {
    x1: center.x,
    y1: center.y,
    x2: midArc.x,
    y2: midArc.y,
    stroke: STYLE.edgeStroke,
    "stroke-width": STYLE.edgeWidth * 0.75,
    "stroke-linecap": "round"
  });
  add(g, "circle", {
    cx: center.x,
    cy: center.y,
    r: 6,
    fill: STYLE.edgeStroke
  });
  if (showRadius && radiusText) {
    const labelPoint = {
      x: center.x + normal.x * arcRadius * 0.55,
      y: center.y + normal.y * arcRadius * 0.55
    };
    addHaloText(g, labelPoint.x, labelPoint.y, radiusText, STYLE.sideFS, {
      "text-anchor": "middle",
      "dominant-baseline": "middle"
    });
  }
  if (diameterEntry && diameterEntry.requested && diameterText) {
    const inward = {
      x: -normal.x,
      y: -normal.y
    };
    const diameterPoint = {
      x: center.x + inward.x * Math.min(arcRadius * 0.6, 40),
      y: center.y + inward.y * Math.min(arcRadius * 0.6, 40)
    };
    addHaloText(g, diameterPoint.x, diameterPoint.y, diameterText, STYLE.sideFS, {
      "text-anchor": "middle",
      "dominant-baseline": "middle"
    });
  }
  const pointsMap = {};
  const pointOrder = [];
  for (let i = 0; i < count; i++) {
    const label = indexToLetter(i, true);
    pointOrder.push(label);
    pointsMap[label] = pts[i];
  }
  if (decorations && decorations.length) {
    renderDecorations(g, pointsMap, decorations, {
      centroid: ctr,
      pointOrder
    });
  }
}

/* ---------- ORKESTRERING ---------- */
const BASE_W = 600,
  BASE_H = 420,
  GAP = 60;
async function collectJobsFromSpecs(text) {
  const lines = String(text).split(/\n/);
  const jobs = [];
  const newLines = [];
  for (const raw of lines) {
    const line = raw.trim();
    if (!line) {
      newLines.push("");
      continue;
    }
    const { core, extras, normalizedExtras } = extractDecorations(line);
    const baseLine = core || '';
    const doubleTri = parseDoubleTriangleSpecLine(baseLine);
    if (doubleTri) {
      const job = doubleTri.job ? { ...doubleTri.job } : null;
      if (job && doubleTri.allowDecorations && extras.length) {
        job.decorations = extras.map(dec => ({ ...dec }));
      } else if (job) {
        job.decorations = doubleTri.allowDecorations ? extras.map(dec => ({ ...dec })) : [];
      }
      if (job) jobs.push(job);
      const normalized = combineNormalizedText(doubleTri.normalized || baseLine, normalizedExtras);
      newLines.push(normalized || (doubleTri.normalized || line));
      continue;
    }
    const special = parseShapeSpec(baseLine);
    if (special) {
      const job = special.job ? { ...special.job } : null;
      if (job && special.allowDecorations && extras.length) {
        job.decorations = extras.map(dec => ({ ...dec }));
      }
      if (job) jobs.push(job);
      const normalized = combineNormalizedText(special.normalized || baseLine, normalizedExtras);
      newLines.push(normalized || (special.normalized || line));
      continue;
    }
    const obj = await parseSpecAI(baseLine);
    if (Object.keys(obj).length === 0) {
      newLines.push(line);
      continue;
    }
    const isQuad = "d" in obj || "D" in obj;
    jobs.push({
      type: isQuad ? "quad" : "tri",
      obj,
      decorations: extras
    });
    const normalized = combineNormalizedText(objToSpec(obj), normalizedExtras);
    newLines.push(normalized || objToSpec(obj));
  }
  const newText = newLines.join("\n");
  if (newText !== text) {
    STATE.specsText = newText;
    const el = document.querySelector("#inpSpecs");
    if (el) el.value = newText;
  }
  return jobs;
}
function svgToString(svgEl) {
  const clone = svgEl.cloneNode(true);
  const css = [...document.querySelectorAll('style')].map(s => s.textContent).join('\n');
  const style = document.createElement('style');
  style.textContent = css;
  clone.insertBefore(style, clone.firstChild);
  clone.setAttribute("xmlns", "http://www.w3.org/2000/svg");
  clone.setAttribute("xmlns:xlink", "http://www.w3.org/1999/xlink");
  return '<?xml version="1.0" encoding="UTF-8"?>\n' + new XMLSerializer().serializeToString(clone);
}
function downloadSVG(svgEl, filename) {
  const data = svgToString(svgEl);
  const blob = new Blob([data], {
    type: "image/svg+xml;charset=utf-8"
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename.endsWith(".svg") ? filename : filename + ".svg";
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/* ---------- PNG-EKSPORT ---------- */
function downloadPNG(svgEl, filename, scale = 2, bg = "#fff") {
  // hent dimensjoner fra viewBox
  const vb = svgEl.viewBox.baseVal;
  const w = (vb === null || vb === void 0 ? void 0 : vb.width) || svgEl.clientWidth || 1200;
  const h = (vb === null || vb === void 0 ? void 0 : vb.height) || svgEl.clientHeight || 800;

  // gjør SVG om til data-URL
  const svgData = svgToString(svgEl);
  const blob = new Blob([svgData], {
    type: "image/svg+xml;charset=utf-8"
  });
  const url = URL.createObjectURL(blob);
  const img = new Image();
  img.onload = () => {
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(w * scale);
    canvas.height = Math.round(h * scale);
    const ctx = canvas.getContext("2d");
    // hvit bakgrunn
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    // tegn svg inn
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    URL.revokeObjectURL(url);
    canvas.toBlob(pngBlob => {
      const urlPng = URL.createObjectURL(pngBlob);
      const a = document.createElement("a");
      a.href = urlPng;
      a.download = filename.endsWith(".png") ? filename : filename + ".png";
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(urlPng), 1000);
    }, "image/png");
  };
  img.src = url;
}

/* bygg adv fra STATE (sider + vinkler/punkter) */
function buildAdvForFig(figState) {
  const sidesMode = {
    default: figState.sides.default
  };
  ["a", "b", "c", "d"].forEach(k => {
    const mode = figState.sides[k];
    if (mode && mode !== "inherit") sidesMode[k] = mode;
  });
  const sidesText = {
    a: figState.sides.aText,
    b: figState.sides.bText,
    c: figState.sides.cText,
    d: figState.sides.dText
  };
  const angMode = {
    default: figState.angles.default
  };
  ["A", "B", "C", "D"].forEach(k => {
    const mode = figState.angles[k];
    if (mode && mode !== "inherit") angMode[k] = mode;
  });
  const angText = {
    A: figState.angles.AText,
    B: figState.angles.BText,
    C: figState.angles.CText,
    D: figState.angles.DText
  };
  return {
    sides: {
      mode: sidesMode,
      text: sidesText
    },
    angles: {
      mode: angMode,
      text: angText
    }
  };
}
async function renderCombined() {
  const svg = document.getElementById("paper");
  svg.innerHTML = "";
  const jobs = await collectJobsFromSpecs(STATE.specsText);
  const n = jobs.length;
  const fig2Settings = document.getElementById("fig2Settings");
  if (fig2Settings) fig2Settings.style.display = n >= 2 ? "" : "none";
  if (n === 0) {
    svg.setAttribute("viewBox", `0 0 ${BASE_W} ${BASE_H}`);
    add(svg, "text", {
      x: 20,
      y: 40,
      fill: "#6b7280",
      "font-size": 18
    }).textContent = "Skriv én linje per figur for å tegne.";
    svg.setAttribute("aria-label", "");
    lastRenderSummary = {
      layoutMode: STATE.layout || 'row',
      count: 0,
      jobs: []
    };
    maybeRefreshAltText('config');
    return;
  }
  const gapTotal = Math.max(0, n - 1) * GAP;
  const rowLayout = n === 1 ? true : STATE.layout === "row";
  const totalW = rowLayout ? BASE_W * n + gapTotal : BASE_W;
  const totalH = rowLayout ? BASE_H : BASE_H * n + gapTotal;
  svg.setAttribute("viewBox", `0 0 ${totalW} ${totalH}`);
  const groups = Array.from({
    length: n
  }, () => add(svg, "g", {}));
  const rects = groups.map((_, i) => rowLayout ? {
    x: i * (BASE_W + GAP),
    y: 0,
    w: BASE_W,
    h: BASE_H
  } : {
    x: 0,
    y: i * (BASE_H + GAP),
    w: BASE_W,
    h: BASE_H
  });
  const summaries = [];
  for (let i = 0; i < n; i++) {
    const {
      type,
      obj
    } = jobs[i];
    const adv = buildAdvForFig(i === 0 ? STATE.fig1 : STATE.fig2);
    let summaryEntry = null;
    try {
      if (type === "tri") {
        summaryEntry = drawTriangleToGroup(groups[i], rects[i], obj, adv, jobs[i].decorations);
      } else if (type === "quad") {
        summaryEntry = drawQuadToGroup(groups[i], rects[i], obj, adv, jobs[i].decorations);
      } else if (type === "doubleTri") {
        summaryEntry = drawDoubleTriangleToGroup(groups[i], rects[i], obj, adv, jobs[i].decorations);
      } else if (type === "circle") {
        drawCircleToGroup(groups[i], rects[i], obj);
      } else if (type === "polygon") {
        drawRegularPolygonToGroup(groups[i], rects[i], obj, adv);
      } else if (type === "polygonArc") {
        drawPolygonWithArcToGroup(groups[i], rects[i], obj, adv, jobs[i].decorations);
      } else {
        throw new Error(`Ukjent figurtype: ${type}`);
      }
    } catch (e) {
      errorBox(groups[i], rects[i], String(e.message || e));
    }
    if (!summaryEntry) summaryEntry = cloneJobForSummary(jobs[i]);
    if (summaryEntry) summaries.push(summaryEntry);
  }
  lastRenderSummary = {
    layoutMode: rowLayout ? 'row' : 'col',
    count: n,
    jobs: summaries
  };
  maybeRefreshAltText('config');
  svg.setAttribute("aria-label", n === 1 ? "Én figur" : `${n} figurer i samme bilde`);
}

function handleThemeProfileChange(event) {
  const data = event && event.data;
  const type = typeof data === "string" ? data : data && data.type;
  if (type !== "math-visuals:profile-change") return;
  applyThemeToDocument();
  applyThemeStyles();
  const result = renderCombined();
  if (result && typeof result.catch === "function") {
    result.catch(() => {});
  }
}

if (typeof window !== "undefined" && typeof window.addEventListener === "function") {
  window.addEventListener("message", handleThemeProfileChange);
}

/* ---------- UI BIND ---------- */
function bindUI() {
  ensureStateDefaults();
  const $ = sel => document.querySelector(sel);
  const inpSpecs = $("#inpSpecs");
  const layoutRadios = document.querySelectorAll('input[name="layout"]');
  const btnSvg = $("#btnSvg");
  const btnPng = $("#btnPng");
  const btnDraw = $("#btnDraw");
  const f1Sides = $("#f1Sides"),
    f1Angles = $("#f1Angles");
  const f2Sides = $("#f2Sides"),
    f2Angles = $("#f2Angles");
  const sideToggles = [],
    angToggles = [];
  function wireSide(figKey, key, selId, txtId, placeholder) {
    var _sides$key, _sides$textKey;
    const sel = $(selId),
      txt = $(txtId);
    const textKey = key + "Text";
    const getFig = () => STATE[figKey];
    const getSides = () => {
      var _getFig;
      return (_getFig = getFig()) === null || _getFig === void 0 ? void 0 : _getFig.sides;
    };
    const sides = getSides() || {};
    sel.value = (_sides$key = sides[key]) !== null && _sides$key !== void 0 ? _sides$key : "inherit";
    txt.value = (_sides$textKey = sides[textKey]) !== null && _sides$textKey !== void 0 ? _sides$textKey : placeholder;
    function toggleTxt() {
      var _curSides$default;
      const curSides = getSides();
      const fallback = (_curSides$default = curSides === null || curSides === void 0 ? void 0 : curSides.default) !== null && _curSides$default !== void 0 ? _curSides$default : "";
      const mode = sel.value === "inherit" ? fallback : sel.value;
      txt.disabled = !String(mode).includes("custom");
    }
    toggleTxt();
    sel.addEventListener("change", () => {
      const curSides = getSides();
      if (curSides) curSides[key] = sel.value;
      toggleTxt();
      renderCombined();
    });
    txt.addEventListener("input", () => {
      const curSides = getSides();
      if (curSides) curSides[textKey] = txt.value;
      renderCombined();
    });
    sideToggles.push({
      figKey,
      toggleTxt
    });
  }
  function wireAng(figKey, key, selId, txtId, placeholder) {
    var _angles$key, _angles$textKey;
    const sel = $(selId),
      txt = $(txtId);
    const textKey = key + "Text";
    const getFig = () => STATE[figKey];
    const getAngles = () => {
      var _getFig2;
      return (_getFig2 = getFig()) === null || _getFig2 === void 0 ? void 0 : _getFig2.angles;
    };
    const angles = getAngles() || {};
    sel.value = (_angles$key = angles[key]) !== null && _angles$key !== void 0 ? _angles$key : "inherit";
    txt.value = (_angles$textKey = angles[textKey]) !== null && _angles$textKey !== void 0 ? _angles$textKey : placeholder;
    function toggleTxt() {
      var _curAngles$default;
      const curAngles = getAngles();
      const rawMode = sel.value === "inherit" ? (_curAngles$default = curAngles === null || curAngles === void 0 ? void 0 : curAngles.default) !== null && _curAngles$default !== void 0 ? _curAngles$default : "" : sel.value;
      const normalized = String(rawMode);
      txt.disabled = !(normalized.startsWith("custom") || normalized.startsWith("custum"));
    }
    toggleTxt();
    sel.addEventListener("change", () => {
      const curAngles = getAngles();
      if (curAngles) curAngles[key] = sel.value;
      toggleTxt();
      renderCombined();
    });
    txt.addEventListener("input", () => {
      const curAngles = getAngles();
      if (curAngles) curAngles[textKey] = txt.value;
      renderCombined();
    });
    angToggles.push({
      figKey,
      toggleTxt
    });
  }

  // init
  DEFAULT_SPECS = (inpSpecs === null || inpSpecs === void 0 ? void 0 : inpSpecs.value) || "";
  STATE.specsText = DEFAULT_SPECS;
  inpSpecs.value = STATE.specsText;
  f1Sides.value = STATE.fig1.sides.default;
  f1Angles.value = STATE.fig1.angles.default;
  f2Sides.value = STATE.fig2.sides.default;
  f2Angles.value = STATE.fig2.angles.default;
  layoutRadios.forEach(r => r.checked = r.value === STATE.layout);

  // Oppdater lokal STATE mens bruker skriver, slik at lagring av eksempler får med uendrede endringer
  inpSpecs.addEventListener("input", () => {
    STATE.specsText = inpSpecs.value;
  });

  // Oppdater når bruker trykker Enter, forlater feltet eller trykker Tegn-knappen
  inpSpecs.addEventListener("blur", () => {
    if (STATE.specsText !== inpSpecs.value) {
      STATE.specsText = inpSpecs.value;
      renderCombined();
    }
  });
  inpSpecs.addEventListener("keyup", e => {
    if (e.key === "Enter") {
      STATE.specsText = inpSpecs.value;
      renderCombined();
    }
  });
  f1Sides.addEventListener("change", () => {
    STATE.fig1.sides.default = f1Sides.value;
    sideToggles.filter(t => t.figKey === "fig1").forEach(t => t.toggleTxt());
    renderCombined();
  });
  f1Angles.addEventListener("change", () => {
    STATE.fig1.angles.default = f1Angles.value;
    angToggles.filter(t => t.figKey === "fig1").forEach(t => t.toggleTxt());
    renderCombined();
  });
  f2Sides.addEventListener("change", () => {
    STATE.fig2.sides.default = f2Sides.value;
    sideToggles.filter(t => t.figKey === "fig2").forEach(t => t.toggleTxt());
    renderCombined();
  });
  f2Angles.addEventListener("change", () => {
    STATE.fig2.angles.default = f2Angles.value;
    angToggles.filter(t => t.figKey === "fig2").forEach(t => t.toggleTxt());
    renderCombined();
  });
  if (btnDraw) {
    btnDraw.addEventListener("click", () => {
      STATE.specsText = inpSpecs.value;
      renderCombined();
    });
  }

  // figur 1
  wireSide("fig1", "a", "#f1SideA", "#f1SideATxt", "a");
  wireSide("fig1", "b", "#f1SideB", "#f1SideBTxt", "b");
  wireSide("fig1", "c", "#f1SideC", "#f1SideCTxt", "c");
  wireSide("fig1", "d", "#f1SideD", "#f1SideDTxt", "d");
  wireAng("fig1", "A", "#f1AngA", "#f1AngATxt", "A");
  wireAng("fig1", "B", "#f1AngB", "#f1AngBTxt", "B");
  wireAng("fig1", "C", "#f1AngC", "#f1AngCTxt", "C");
  wireAng("fig1", "D", "#f1AngD", "#f1AngDTxt", "D");

  // figur 2
  wireSide("fig2", "a", "#f2SideA", "#f2SideATxt", "a");
  wireSide("fig2", "b", "#f2SideB", "#f2SideBTxt", "b");
  wireSide("fig2", "c", "#f2SideC", "#f2SideCTxt", "c");
  wireSide("fig2", "d", "#f2SideD", "#f2SideDTxt", "d");
  wireAng("fig2", "A", "#f2AngA", "#f2AngATxt", "A");
  wireAng("fig2", "B", "#f2AngB", "#f2AngBTxt", "B");
  wireAng("fig2", "C", "#f2AngC", "#f2AngCTxt", "C");
  wireAng("fig2", "D", "#f2AngD", "#f2AngDTxt", "D");
  layoutRadios.forEach(r => r.addEventListener("change", () => {
    if (r.checked) {
      STATE.layout = r.value;
      renderCombined();
    }
  }));
  if (btnSvg) {
    btnSvg.addEventListener("click", () => {
      const svg = document.getElementById("paper");
      downloadSVG(svg, "nkant.svg");
    });
  }
  if (btnPng) {
    btnPng.addEventListener("click", () => {
      const svg = document.getElementById("paper");
      downloadPNG(svg, "nkant.png", 2); // 2× oppløsning
    });
  }
}

/* ---------- INIT ---------- */
window.addEventListener("DOMContentLoaded", async () => {
  bindUI();
  initAltTextManager();
  await renderCombined();
});

window.addEventListener("examples:loaded", () => {
  applyStateToUI();
  if (!altTextManager) {
    initAltTextManager();
  }
  if (altTextManager) {
    altTextManager.applyCurrent();
    maybeRefreshAltText("examples");
  }
});

window.addEventListener("examples:collect", () => {
  if (altTextManager) {
    altTextManager.applyCurrent();
  }
});
function applyStateToUI() {
  var _STATE$specsText;
  const specInput = document.getElementById("inpSpecs");
  if (specInput) specInput.value = (_STATE$specsText = STATE.specsText) !== null && _STATE$specsText !== void 0 ? _STATE$specsText : "";
  const layout = STATE.layout || "row";
  document.querySelectorAll('input[name="layout"]').forEach(radio => {
    radio.checked = radio.value === layout;
  });
  const updateFigure = (figState, prefix, sideFallback, angFallback) => {
    var _sides$default, _angles$default;
    const sides = (figState === null || figState === void 0 ? void 0 : figState.sides) || {};
    const angles = (figState === null || figState === void 0 ? void 0 : figState.angles) || {};
    const defaultSides = (_sides$default = sides.default) !== null && _sides$default !== void 0 ? _sides$default : sideFallback;
    const defaultAngles = (_angles$default = angles.default) !== null && _angles$default !== void 0 ? _angles$default : angFallback;
    const sidesSel = document.getElementById(`${prefix}Sides`);
    if (sidesSel) sidesSel.value = defaultSides;
    const angSel = document.getElementById(`${prefix}Angles`);
    if (angSel) angSel.value = defaultAngles;
    const sideKeys = ["a", "b", "c", "d"];
    sideKeys.forEach(letter => {
      var _sides$letter;
      const upper = letter.toUpperCase();
      const sel = document.getElementById(`${prefix}Side${upper}`);
      if (sel) sel.value = (_sides$letter = sides[letter]) !== null && _sides$letter !== void 0 ? _sides$letter : "inherit";
      const txt = document.getElementById(`${prefix}Side${upper}Txt`);
      if (txt) {
        const val = sides[`${letter}Text`];
        txt.value = val != null ? val : letter;
      }
      if (sel && txt) {
        const mode = sel.value === "inherit" ? defaultSides !== null && defaultSides !== void 0 ? defaultSides : "" : sel.value;
        txt.disabled = !String(mode).includes("custom");
      }
    });
    const angKeys = ["A", "B", "C", "D"];
    angKeys.forEach(letter => {
      var _angles$letter;
      const sel = document.getElementById(`${prefix}Ang${letter}`);
      if (sel) sel.value = (_angles$letter = angles[letter]) !== null && _angles$letter !== void 0 ? _angles$letter : "inherit";
      const txt = document.getElementById(`${prefix}Ang${letter}Txt`);
      if (txt) {
        const val = angles[`${letter}Text`];
        txt.value = val != null ? val : letter;
      }
      if (sel && txt) {
        const rawMode = sel.value === "inherit" ? defaultAngles !== null && defaultAngles !== void 0 ? defaultAngles : "" : sel.value;
        const normalized = String(rawMode).toLowerCase();
        txt.disabled = !(normalized.startsWith("custom") || normalized.startsWith("custum"));
      }
    });
  };
  updateFigure(STATE.fig1, "f1", "value", "custom+mark+value");
  updateFigure(STATE.fig2, "f2", "none", "custom+mark+value");
}
function applyExamplesConfig() {
  ensureStateDefaults();
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", applyExamplesConfig, {
      once: true
    });
    return;
  }
  applyStateToUI();
  renderCombined();
}
if (typeof window !== "undefined") {
  window.applyConfig = applyExamplesConfig;
  window.applyState = applyExamplesConfig;
  window.render = applyExamplesConfig;
  window.renderCombined = renderCombined;
}

/* ---------- GEOMETRI ---------- */
function buildRightAngleVariants(input) {
  const EPS = 1e-6;
  const isPos = v => typeof v === "number" && isFinite(v) && v > 0;
  const isRight = ang => typeof ang === "number" && isFinite(ang) && Math.abs(ang - 90) < 1e-3;
  const variants = [];
  const push = mut => {
    const clone = {
      ...input
    };
    mut(clone);
    variants.push(clone);
  };
  const handle = (angVal, oppKey, legKey1, legKey2) => {
    if (!isRight(angVal)) return;
    const oppVal = input[oppKey];
    const leg1 = input[legKey1];
    const leg2 = input[legKey2];
    const suspicious = isPos(oppVal) && (isPos(leg1) && oppVal <= leg1 + EPS || isPos(leg2) && oppVal <= leg2 + EPS);
    if (suspicious) {
      push(clone => {
        delete clone[oppKey];
      });
    }
    if (isPos(oppVal)) {
      if (!isPos(leg1)) {
        push(clone => {
          clone[legKey1] = oppVal;
          delete clone[oppKey];
        });
      }
      if (!isPos(leg2)) {
        push(clone => {
          clone[legKey2] = oppVal;
          delete clone[oppKey];
        });
      }
    }
  };
  handle(input.A, "a", "b", "c");
  handle(input.B, "b", "c", "a");
  handle(input.C, "c", "a", "b");
  return variants;
}
function solveTriangle(g) {
  const lawCosSide = (ang, s1, s2) => Math.sqrt(Math.max(0, s1 * s1 + s2 * s2 - 2 * s1 * s2 * Math.cos(rad(ang))));
  const lawCosAng = (opp, s1, s2) => deg(Math.acos(clampCos((s1 * s1 + s2 * s2 - opp * opp) / (2 * s1 * s2))));
  const lawSinAng = (A0, a0, sx) => deg(Math.asin(clamp(sx * Math.sin(rad(A0)) / a0, -1, 1)));
  const lawSinSide = (A0, a0, Ax) => a0 * Math.sin(rad(Ax)) / Math.sin(rad(A0));
  const attempt = spec => {
    let {
      a,
      b,
      c,
      A,
      B,
      C
    } = spec;
    if (A && B && !C) C = 180 - A - B;
    if (A && C && !B) B = 180 - A - C;
    if (B && C && !A) A = 180 - B - C;
    if (A && b && c && !a) {
      a = lawCosSide(A, b, c);
    }
    if (B && a && c && !b) {
      b = lawCosSide(B, a, c);
    }
    if (C && a && b && !c) {
      c = lawCosSide(C, a, b);
    }
    if (a && b && c) {
      if (!A) A = lawCosAng(a, b, c);
      if (!B) B = lawCosAng(b, a, c);
      if (!C) C = 180 - A - B;
    }
    const fillBySines = () => {
      if (A && B && a && (!b || !c)) {
        b = b || lawSinSide(A, a, B);
        c = c || lawSinSide(A, a, 180 - A - B);
      }
      if (A && C && a && (!b || !c)) {
        b = b || lawSinSide(A, a, 180 - A - C);
        c = c || lawSinSide(A, a, C);
      }
      if (B && C && b && (!a || !c)) {
        a = a || lawSinSide(B, b, 180 - B - C);
        c = c || lawSinSide(B, b, C);
      }
      if (A && B && c && (!a || !b)) {
        a = a || lawSinSide(180 - A - B, c, A);
        b = b || lawSinSide(180 - A - B, c, B);
      }
    };
    fillBySines();
    const solveSSA = () => {
      if (A && a && b && !B) {
        const B1 = lawSinAng(A, a, b);
        if (isFinite(B1)) {
          B = B || B1;
          C = C || 180 - A - B;
          c = c || lawSinSide(A, a, C);
        }
      }
      if (A && a && c && !C) {
        const C1 = lawSinAng(A, a, c);
        if (isFinite(C1)) {
          C = C || C1;
          B = B || 180 - A - C;
          b = b || lawSinSide(A, a, B);
        }
      }
      if (B && b && a && !A) {
        const A1 = lawSinAng(B, b, a);
        if (isFinite(A1)) {
          A = A || A1;
          C = C || 180 - A - B;
          c = c || lawSinSide(B, b, C);
        }
      }
      if (B && b && c && !C) {
        const C1 = lawSinAng(B, b, c);
        if (isFinite(C1)) {
          C = C || C1;
          A = A || 180 - B - C;
          a = a || lawSinSide(B, b, A);
        }
      }
      if (C && c && a && !A) {
        const A1 = lawSinAng(C, c, a);
        if (isFinite(A1)) {
          A = A || A1;
          B = B || 180 - A - C;
          b = b || lawSinSide(C, c, B);
        }
      }
      if (C && c && b && !B) {
        const B1 = lawSinAng(C, c, b);
        if (isFinite(B1)) {
          B = B || B1;
          A = A || 180 - B - C;
          a = a || lawSinSide(C, c, A);
        }
      }
    };
    solveSSA();
    if (a > 0 && b > 0 && c > 0 && A > 0 && B > 0 && C > 0) return {
      a,
      b,
      c,
      A,
      B,
      C
    };
    return null;
  };
  const direct = attempt(g);
  if (direct) return direct;
  const variants = buildRightAngleVariants(g);
  for (const variant of variants) {
    const solved = attempt(variant);
    if (solved) return solved;
  }
  throw new Error("Trekant-spesifikasjonen er ikke tilstrekkelig eller er ugyldig.");
}
function circleCircle(A, r, B, s) {
  const dx = B.x - A.x,
    dy = B.y - A.y,
    d = Math.hypot(dx, dy);
  if (d === 0 || d > r + s || d < Math.abs(r - s)) return [];
  const a = (r * r - s * s + d * d) / (2 * d);
  const h = Math.sqrt(Math.max(0, r * r - a * a));
  const xm = A.x + a * dx / d,
    ym = A.y + a * dy / d;
  const rx = -dy * (h / d),
    ry = dx * (h / d);
  return [{
    x: xm + rx,
    y: ym + ry
  }, {
    x: xm - rx,
    y: ym - ry
  }];
}
