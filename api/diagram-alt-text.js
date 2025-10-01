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

  let prompt = '';
  if (typeof payload === 'string') {
    prompt = payload.trim();
  } else if (payload && typeof payload.prompt === 'string') {
    prompt = payload.prompt.trim();
  } else if (payload && typeof payload.context === 'object') {
    prompt = buildPromptFromContext(payload.context);
  }

  if (!prompt) {
    sendJson(res, 400, { error: 'Missing prompt' });
    return;
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    sendJson(res, 500, { error: 'Server misconfigured: missing OpenAI API key' });
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
    sendJson(res, 502, { error: 'Failed to reach OpenAI', message: error.message });
    return;
  }

  let data;
  try {
    data = await response.json();
  } catch (error) {
    sendJson(res, 502, { error: 'Failed to read OpenAI response', message: error.message });
    return;
  }

  if (!response.ok) {
    sendJson(res, response.status || 502, {
      error: 'OpenAI request failed',
      details: data
    });
    return;
  }

  const text = data && data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content;
  if (!text || !text.trim()) {
    sendJson(res, 502, { error: 'OpenAI returned empty content' });
    return;
  }

  sendJson(res, 200, { text: text.trim() });
};

