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

function formatCount(value, singular, plural) {
  const num = Number(value) || 0;
  const rounded = Math.max(0, Math.round(num));
  const label = rounded === 1 ? singular : plural || `${singular}er`;
  return `${rounded === 1 ? '1' : String(rounded)} ${label}`;
}

function joinWithOg(items) {
  const filtered = items.filter(Boolean);
  if (filtered.length === 0) return '';
  if (filtered.length === 1) return filtered[0];
  if (filtered.length === 2) return `${filtered[0]} og ${filtered[1]}`;
  return `${filtered.slice(0, -1).join(', ')} og ${filtered[filtered.length - 1]}`;
}

function formatColumnRange(start, end) {
  const from = Number(start);
  const to = Number(end);
  if (!Number.isFinite(from) || !Number.isFinite(to)) return '';
  const fromLabel = `kolonne ${from + 1}`;
  if (from === to) return fromLabel;
  return `${fromLabel}–${to + 1}`;
}

function describeRow(row) {
  if (!row || !Number.isFinite(row.count) || row.count <= 0) return '';
  const rowIndex = Number.isFinite(row.rowIndex) ? row.rowIndex + 1 : null;
  const segments = Array.isArray(row.segments) ? row.segments : [];
  const segmentParts = segments.map(seg => formatColumnRange(seg.start, seg.end)).filter(Boolean);
  const segmentText = segmentParts.length ? ` i ${joinWithOg(segmentParts)}` : '';
  const offsetText = row.isOffset ? ' (forskjøvet)' : '';
  const rowLabel = rowIndex !== null ? `Rad ${rowIndex}` : 'Rad';
  return `${rowLabel}${offsetText}: ${formatCount(row.count, 'rute', 'ruter')}${segmentText}.`;
}

function buildPromptFromContext(context) {
  if (!context || typeof context !== 'object') return '';
  const rows = Number(context.rows) || 0;
  const cols = Number(context.cols) || 0;
  const lines = [];
  if (rows > 0 && cols > 0) {
    lines.push(`Rutenett: ${rows} rader x ${cols} kolonner.`);
  }
  if (context.offset && rows > 1) {
    lines.push('Annenhver rad er forskjøvet.');
  }
  lines.push(context.circleMode ? 'Fylte posisjoner vises som sirkler.' : 'Fylte posisjoner vises som kvadrater.');
  if (context.showGrid === false) {
    lines.push('Rutenettet er skjult.');
  }
  const figures = Array.isArray(context.figures) ? context.figures : [];
  figures.forEach((fig, idx) => {
    const name = fig && typeof fig.name === 'string' && fig.name.trim() ? fig.name.trim() : `Figur ${idx + 1}`;
    const filled = Number(fig && fig.filled) || 0;
    lines.push(`${name}: ${filled} markerte posisjoner.`);
    const rowDetails = Array.isArray(fig && fig.rowDetails) ? fig.rowDetails : [];
    rowDetails.forEach(row => {
      const rowText = describeRow(row);
      if (rowText) lines.push(`- ${rowText}`);
    });
    const colorUsage = Array.isArray(fig && fig.colorUsage) ? fig.colorUsage : [];
    const colorParts = colorUsage
      .map((count, colorIdx) => (Number(count) > 0 ? `${Number(count)} i farge ${colorIdx + 1}` : ''))
      .filter(Boolean);
    if (colorParts.length) {
      lines.push(`- Fargebruk: ${colorParts.join(', ')}.`);
    }
  });
  if (figures.length > 1) {
    const totals = figures.map((fig, idx) => {
      const name = fig && typeof fig.name === 'string' && fig.name.trim() ? fig.name.trim() : `Figur ${idx + 1}`;
      const filled = Number(fig && fig.filled) || 0;
      return `${name}: ${filled}`;
    });
    if (totals.length) {
      lines.push(`Totalt per figur: ${totals.join(', ')}.`);
    }
  }
  const header = 'Lag en alternativ tekst på norsk for en serie figurtall. Beskriv tydelig hvordan mønsteret utvikler seg fra figur til figur slik at en elev kan forstå mønsteret uten å se figuren. Hold deg til 2–3 setninger, unngå punktlister og fokuser på utviklingen i antall og plassering.';
  return `${header}\n\nData:\n${lines.join('\n')}`;
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
    messages: [
      {
        role: 'system',
        content:
          'Du beskriver serier av figurtall på norsk for elever. Teksten skal være 2–3 setninger, forklare mønsteret mellom figurene og hvordan antall og plassering endrer seg. Ikke bruk punktlister eller Markdown.'
      },
      {
        role: 'user',
        content: prompt
      }
    ],
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
