'use strict';

module.exports = function widgetsHandler(req, res) {
  const headers = req && req.headers ? req.headers : {};
  const origin = headers.origin || 'https://example.test';
  res.setHeader('Access-Control-Allow-Origin', origin);
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  if (req && req.method === 'OPTIONS') {
    res.statusCode = 204;
    res.end();
    return;
  }
  res.statusCode = 200;
  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify({ ok: true, method: req ? req.method : 'UNKNOWN' }));
};
