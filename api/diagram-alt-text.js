'use strict';

function readJsonBody(req) {
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', chunk => {
      data += chunk;
      if (data.length > 1024 * 1024) {
        reject(new Error('Request body too large'));
        req.destroy();
      }
    });
    req.on('end', () => {
      if (!data) {
        resolve({});
        return;
      }
      try {
        resolve(JSON.parse(data));
      } catch (error) {
        reject(Object.assign(new Error('Invalid JSON body'), { cause: error }));
      }
    });
    req.on('error', reject);
  });
}

function sendJson(res, statusCode, payload) {
  res.statusCode = statusCode;
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Cache-Control', 'no-store');
  res.end(JSON.stringify(payload));
}

function describeDiagramType(type) {
  if (type === 'line') return 'linjediagram';
  if (type === 'grouped') return 'gruppert stolpediagram';
  if (type === 'stacked') return 'stablet stolpediagram';
  return 'stolpediagram';
}

function formatNumber(value) {
  if (!Number.isFinite(value)) return '0';
  let str = Number(value).toFixed(6);
  if (str.includes('.')) {
    str = str.replace(/0+$/, '').replace(/\.$/, '');
  }
  return str.length ? str.replace('.', ',') : '0';
}

function buildPromptFromContext(context) {
  if (!context || typeof context !== 'object') return '';
  const typeName = describeDiagramType(context.type);
  const parts = [`Diagramtype: ${typeName}`];
  if (context.title) parts.push(`Tittel: ${context.title}`);
  if (context.axisXLabel) parts.push(`X-akse: ${context.axisXLabel}`);
  if (context.axisYLabel) parts.push(`Y-akse: ${context.axisYLabel}`);
  const labels = Array.isArray(context.labels) && context.labels.length ? context.labels : Array.isArray(context.values) ? context.values.map((_, i) => `Kategori ${i + 1}`) : [];
  const series1Name = context.seriesNames && context.seriesNames[0] && context.seriesNames[0].trim() ? context.seriesNames[0].trim() : context.values2 && context.values2.length ? 'Serie 1' : 'Dataserien';
  const values1 = Array.isArray(context.values) ? context.values : [];
  parts.push(`Serie 1 (${series1Name}):`);
  labels.forEach((label, idx) => {
    const v = Number(values1[idx] || 0);
    parts.push(`- ${label}: ${formatNumber(v)}`);
  });
  if (Array.isArray(context.values2) && context.values2.length) {
    const series2Name = context.seriesNames && context.seriesNames[1] && context.seriesNames[1].trim() ? context.seriesNames[1].trim() : 'Serie 2';
    parts.push(`Serie 2 (${series2Name}):`);
    labels.forEach((label, idx) => {
      const v = Number(context.values2[idx] || 0);
      parts.push(`- ${label}: ${formatNumber(v)}`);
    });
    if (context.type === 'stacked') {
      parts.push('Totalsummer per kategori:');
      labels.forEach((label, idx) => {
        const total = Number(values1[idx] || 0) + Number(context.values2[idx] || 0);
        parts.push(`- ${label}: ${formatNumber(total)}`);
      });
    }
  }
  return `Lag en kort og tydelig alternativ tekst på norsk for et ${typeName}. Teksten skal være 2–3 setninger, beskrive hva diagrammet handler om, forklare aksene og fremheve tydelige trender eller ekstreme verdier. Ikke bruk punktlister eller Markdown.

Data:
${parts.join('\n')}`;
}

function toSentenceLower(value) {
  if (typeof value !== 'string') return '';
  const trimmed = value.trim();
  if (!trimmed) return '';
  return trimmed.charAt(0).toLowerCase() + trimmed.slice(1);
}

function normalizeLabels(context, length) {
  const rawLabels = Array.isArray(context.labels) ? context.labels : [];
  const labels = [];
  for (let index = 0; index < length; index += 1) {
    const raw = rawLabels[index];
    let label = typeof raw === 'string' ? raw.trim() : raw != null ? String(raw) : '';
    if (!label) {
      label = `Kategori ${index + 1}`;
    }
    labels.push(label);
  }
  return labels;
}

function normalizeSeriesValues(values, length) {
  const list = Array.isArray(values) ? values : [];
  const result = [];
  for (let index = 0; index < length; index += 1) {
    const numeric = Number(list[index]);
    result.push(Number.isFinite(numeric) ? numeric : 0);
  }
  return result;
}

function getSeriesName(context, index, hasSecondSeries) {
  if (!context) return index === 0 ? 'Dataserien' : `Serie ${index + 1}`;
  const rawNames = Array.isArray(context.seriesNames) ? context.seriesNames : [];
  const candidate = typeof rawNames[index] === 'string' ? rawNames[index].trim() : '';
  if (candidate) return candidate;
  if (index === 0) {
    return hasSecondSeries ? 'Serie 1' : 'Dataserien';
  }
  return `Serie ${index + 1}`;
}

function describeSeriesPeak(name, values, labels) {
  if (!values || !values.length) return '';
  let maxIndex = -1;
  let maxValue = -Infinity;
  for (let index = 0; index < values.length; index += 1) {
    const value = Number(values[index]);
    if (!Number.isFinite(value)) continue;
    if (maxIndex === -1 || value > maxValue) {
      maxValue = value;
      maxIndex = index;
    }
  }
  if (maxIndex === -1) return '';
  const label = labels[maxIndex] || `Kategori ${maxIndex + 1}`;
  return `${name} er høyest for ${label} med ${formatNumber(maxValue)}`;
}

function buildFallbackAltText(context) {
  if (!context || typeof context !== 'object') return '';
  const type = context.type || 'bar';
  const typeName = describeDiagramType(type);
  const series1 = Array.isArray(context.values) ? context.values : [];
  const series2 = Array.isArray(context.values2) ? context.values2 : [];
  const labelCount = Math.max(
    series1.length,
    series2.length,
    Array.isArray(context.labels) ? context.labels.length : 0,
    0
  );
  const length = labelCount > 0 ? labelCount : 0;
  const labels = normalizeLabels(context, length || 0);
  const values = normalizeSeriesValues(series1, labels.length);
  const values2 = normalizeSeriesValues(series2, labels.length);
  const hasSecondSeries = Array.isArray(context.values2) && context.values2.length > 0;
  const sentences = [];
  const title = typeof context.title === 'string' ? context.title.trim() : '';
  const axisX = typeof context.axisXLabel === 'string' ? context.axisXLabel.trim() : '';
  const axisY = typeof context.axisYLabel === 'string' ? context.axisYLabel.trim() : '';

  const axisParts = [];
  if (axisX && type !== 'pie') {
    axisParts.push(`x-aksen viser ${toSentenceLower(axisX)}`);
  }
  if (axisY && type !== 'pie') {
    axisParts.push(`y-aksen viser ${toSentenceLower(axisY)}`);
  }
  const axisDescription = axisParts.length === 2 ? `${axisParts[0]} og ${axisParts[1]}` : axisParts[0] || '';

  if (type === 'pie') {
    const base = title ? `${title} er et ${typeName}` : `Figuren er et ${typeName}`;
    const sectorInfo = labels.length ? ` med ${labels.length} sektorer` : '';
    const axisInfo = axisY ? `, og ${axisDescription || `y-aksen viser ${toSentenceLower(axisY)}`}` : '';
    const sentence = `${base}${sectorInfo}${axisInfo}`;
    sentences.push(sentence.endsWith('.') ? sentence : `${sentence}.`);
  } else if (title) {
    if (axisDescription) {
      sentences.push(`${title} er et ${typeName} der ${axisDescription}.`);
    } else if (labels.length) {
      sentences.push(`${title} er et ${typeName} med ${labels.length} kategorier.`);
    } else {
      sentences.push(`${title} er et ${typeName}.`);
    }
  } else {
    const base = `Figuren er et ${typeName}`;
    if (axisDescription) {
      sentences.push(`${base} der ${axisDescription}.`);
    } else if (labels.length) {
      sentences.push(`${base} med ${labels.length} kategorier.`);
    } else {
      sentences.push(`${base}.`);
    }
  }

  const highlightParts = [];
  if (values.length) {
    const series1Name = getSeriesName(context, 0, hasSecondSeries);
    const description = describeSeriesPeak(series1Name, values, labels);
    if (description) highlightParts.push(description);
  }
  if (hasSecondSeries && values2.length) {
    const series2Name = getSeriesName(context, 1, hasSecondSeries);
    const description = describeSeriesPeak(series2Name, values2, labels);
    if (description) highlightParts.push(description);
  }
  if (hasSecondSeries && type === 'stacked' && values.length) {
    const totals = values.map((value, index) => value + (Number.isFinite(values2[index]) ? values2[index] : 0));
    const totalDescription = describeSeriesPeak('Totalt', totals, labels);
    if (totalDescription) {
      highlightParts.push(totalDescription.replace(/^Totalt/, 'Totalt er'));
    }
  }

  if (highlightParts.length) {
    const sentence = highlightParts.join('. ');
    sentences.push(sentence.endsWith('.') ? sentence : `${sentence}.`);
  } else if (labels.length) {
    sentences.push('Verdiene fordeler seg jevnt mellom kategoriene.');
  } else {
    sentences.push('Ingen detaljerte verdier er tilgjengelige for diagrammet.');
  }

  return sentences.join(' ');
}

function respondWithFallback(res, context, warning) {
  const fallback = buildFallbackAltText(context) || 'Diagrammet er vist, men alternativ tekst kan ikke genereres automatisk.';
  const payload = { text: fallback, source: 'fallback' };
  if (warning) {
    payload.warning = warning;
  }
  sendJson(res, 200, payload);
}


module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS');
  res.setHeader('Cache-Control', 'no-store');

  if (req.method === 'OPTIONS') {
    res.statusCode = 204;
    res.end();
    return;
  }

  if (req.method !== 'POST') {
    sendJson(res, 405, { error: 'Method Not Allowed' });
    return;
  }

  let payload;
  try {
    payload = await readJsonBody(req);
  } catch (error) {
    sendJson(res, 400, { error: error.message || 'Invalid request body' });
    return;
  }

  const context = payload && typeof payload.context === 'object' ? payload.context : null;

  let prompt = '';
  if (typeof payload === 'string') {
    prompt = payload.trim();
  } else if (payload && typeof payload.prompt === 'string') {
    prompt = payload.prompt.trim();
  }
  if (!prompt && context) {
    prompt = buildPromptFromContext(context);
  }

  if (!prompt && !context) {
    sendJson(res, 400, { error: 'Missing prompt' });
    return;
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    respondWithFallback(res, context, 'Server mangler OpenAI API-nøkkel');
    return;
  }

  const body = {
    model: 'gpt-4o-mini',
    messages: [{
      role: 'system',
      content: 'Du skriver korte og tydelige alternative tekster (2–3 setninger) på norsk for diagrammer. Inkluder hovedtendenser, topper/bunner og hva aksene viser. Ingen punktlister eller Markdown.'
    }, {
      role: 'user',
      content: prompt
    }],
    temperature: 0.4
  };

  let response;
  try {
    response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`
      },
      body: JSON.stringify(body)
    });
  } catch (error) {
    respondWithFallback(res, context, 'Kunne ikke kontakte OpenAI');
    return;
  }

  let data;
  try {
    data = await response.json();
  } catch (error) {
    respondWithFallback(res, context, 'Ugyldig svar fra OpenAI');
    return;
  }

  if (!response.ok) {
    respondWithFallback(res, context, 'OpenAI-returnerte en feil');
    return;
  }

  const text = data && data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content;
  if (!text || !text.trim()) {
    respondWithFallback(res, context, 'OpenAI returnerte tomt svar');
    return;
  }

  sendJson(res, 200, { text: text.trim() });
};

