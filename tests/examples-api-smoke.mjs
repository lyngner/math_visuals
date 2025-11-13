#!/usr/bin/env node
import http from 'http';
import { once } from 'events';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const handler = require('../api/examples');
const { isKvConfigured } = require('../api/_lib/examples-store');

const SMOKE_PATH = '/__ci-smoke-test__';

async function startServer() {
  const server = http.createServer((req, res) => {
    Promise.resolve(handler(req, res)).catch(error => {
      console.error('[examples-api-smoke] handler failure', error);
      try {
        res.statusCode = 500;
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({ error: 'handler_failed', message: error.message }));
      } catch (_) {
        // ignore secondary errors
      }
    });
  });
  server.listen(0);
  await once(server, 'listening');
  const address = server.address();
  if (!address || typeof address.port !== 'number') {
    server.close();
    throw new Error('Failed to determine smoke test server port');
  }
  return { server, port: address.port };
}

async function expectOk(response, allowedStatus = [200]) {
  if (!Array.isArray(allowedStatus)) {
    allowedStatus = [allowedStatus];
  }
  if (!response || !allowedStatus.includes(response.status)) {
    const body = await (response ? response.text() : Promise.resolve(''));
    throw new Error(`Unexpected response status ${response ? response.status : 'N/A'}: ${body}`);
  }
  return response;
}

async function runSmokeTest() {
  if (!isKvConfigured()) {
    throw new Error('REDIS_ENDPOINT, REDIS_PORT og REDIS_PASSWORD må være satt for røyk-testen.');
  }

  const { server, port } = await startServer();
  const baseUrl = `http://127.0.0.1:${port}/api/examples`;
  const queryParam = encodeURIComponent(SMOKE_PATH);

  try {
    const getResponse = await fetch(`${baseUrl}?path=${queryParam}`, { method: 'GET' });
    if (![200, 404].includes(getResponse.status)) {
      await expectOk(getResponse, [200, 404]);
    }

    const payload = {
      path: SMOKE_PATH,
      examples: [
        {
          description: 'CI smoke test example',
          isDefault: true,
          config: { STATE: { check: 'ok' } }
        }
      ],
      deletedProvided: []
    };

    const putResponse = await fetch(`${baseUrl}?path=${queryParam}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    await expectOk(putResponse, 200);

    const verifyResponse = await fetch(`${baseUrl}?path=${queryParam}`, { method: 'GET' });
    await expectOk(verifyResponse, 200);

    const cleanupResponse = await fetch(`${baseUrl}?path=${queryParam}`, { method: 'DELETE' });
    await expectOk(cleanupResponse, 200);
  } finally {
    await new Promise(resolve => server.close(resolve));
  }
}

runSmokeTest().catch(error => {
  console.error('[examples-api-smoke] Smoke test failed');
  if (error && error.message) {
    console.error(error.message);
  } else {
    console.error(error);
  }
  process.exitCode = 1;
});
