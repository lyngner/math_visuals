'use strict';

function readJsonBody(req) {
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', chunk => {
      data += chunk;
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
  res.end(JSON.stringify(payload));
}

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS');

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

  const prompt = typeof payload === 'string' ? payload : payload && payload.prompt;
  if (!prompt || typeof prompt !== 'string') {
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
    response_format: {
      type: 'json_object'
    },
    messages: [
      {
        role: 'system',
        content: 'Returner kun JSON med tall for a,b,c,d,A,B,C,D.'
      },
      {
        role: 'user',
        content: prompt
      }
    ]
  };

  let openaiResponse;
  try {
    openaiResponse = await fetch('https://api.openai.com/v1/chat/completions', {
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

  let text;
  try {
    text = await openaiResponse.text();
  } catch (error) {
    sendJson(res, 502, { error: 'Failed to read OpenAI response', message: error.message });
    return;
  }

  let data;
  try {
    data = text ? JSON.parse(text) : {};
  } catch (error) {
    sendJson(res, openaiResponse.status || 502, {
      error: 'Invalid JSON from OpenAI',
      message: error.message,
      raw: text
    });
    return;
  }

  if (!openaiResponse.ok) {
    sendJson(res, openaiResponse.status || 502, {
      error: 'OpenAI request failed',
      details: data
    });
    return;
  }

  sendJson(res, 200, data);
};
