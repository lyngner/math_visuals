const { test, expect } = require('@playwright/test');
const http = require('http');
const { once } = require('events');

const handler = require('../api/svg/raw');
const {
  setSvg,
  deleteSvg
} = require('../api/_lib/svg-store');

const originalKvUrl = process.env.KV_REST_API_URL;
const originalKvToken = process.env.KV_REST_API_TOKEN;

function clearMemoryStore() {
  if (global.__SVG_MEMORY_STORE__) {
    global.__SVG_MEMORY_STORE__.clear();
  }
  if (global.__SVG_MEMORY_INDEX__) {
    global.__SVG_MEMORY_INDEX__.clear();
  }
}

async function startServer() {
  const server = http.createServer((req, res) => {
    const originalUrl = req.url || '';
    const [pathPart, searchPart = ''] = originalUrl.split('?');
    if (pathPart.startsWith('/svg/')) {
      const slugPath = pathPart.slice('/svg'.length);
      const normalizedPath = slugPath.startsWith('/') ? slugPath : `/${slugPath}`;
      const query = new URLSearchParams(searchPart);
      if (!query.has('path')) {
        query.set('path', normalizedPath);
      }
      req.url = `/api/svg/raw?${query.toString()}`;
    }

    if (req.url && req.url.startsWith('/api/svg/raw')) {
      Promise.resolve(handler(req, res)).catch(error => {
        console.error('[svg-raw-test] handler failure', error);
        try {
          res.statusCode = 500;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ error: 'handler_failed' }));
        } catch (_) {
          // ignore secondary errors
        }
      });
      return;
    }

    res.statusCode = 404;
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.end('Not Found');
  });

  server.listen(0);
  await once(server, 'listening');
  const address = server.address();
  if (!address || typeof address.port !== 'number') {
    throw new Error('Failed to determine SVG raw test server port');
  }
  return { server, port: address.port };
}

test.describe('SVG raw delivery endpoint', () => {
  test.beforeEach(async () => {
    delete process.env.KV_REST_API_URL;
    delete process.env.KV_REST_API_TOKEN;
    clearMemoryStore();
  });

  test.afterAll(() => {
    clearMemoryStore();
    if (originalKvUrl !== undefined) {
      process.env.KV_REST_API_URL = originalKvUrl;
    } else {
      delete process.env.KV_REST_API_URL;
    }
    if (originalKvToken !== undefined) {
      process.env.KV_REST_API_TOKEN = originalKvToken;
    } else {
      delete process.env.KV_REST_API_TOKEN;
    }
  });

  test('serves uploaded SVG markup with correct headers', async () => {
    const stored = await setSvg('icons/test-shape.svg', {
      title: 'Test shape',
      tool: 'integration-test',
      svg: '<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10"><rect width="10" height="10" fill="red" /></svg>'
    });
    expect(stored).not.toBeNull();

    const { server, port } = await startServer();
    const baseUrl = `http://127.0.0.1:${port}`;

    try {
      const response = await fetch(`${baseUrl}/svg/icons/test-shape.svg`);
      expect(response.status).toBe(200);
      expect(response.headers.get('content-type')).toContain('image/svg+xml');
      const body = await response.text();
      expect(body).toContain('<svg');
      expect(body).toContain('<rect');
    } finally {
      await new Promise(resolve => server.close(resolve));
      await deleteSvg('icons/test-shape.svg');
    }
  });

  test('returns 404 for unknown SVG slugs', async () => {
    const { server, port } = await startServer();
    const baseUrl = `http://127.0.0.1:${port}`;

    try {
      const response = await fetch(`${baseUrl}/svg/does-not-exist.svg`);
      expect(response.status).toBe(404);
      expect(response.headers.get('content-type')).toContain('text/plain');
    } finally {
      await new Promise(resolve => server.close(resolve));
    }
  });
});
