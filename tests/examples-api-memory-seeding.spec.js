const { test, expect } = require('@playwright/test');

const {
  invokeExamplesApi,
  resetExamplesMemoryStore
} = require('./helpers/examples-api-utils');

let originalKvUrl;
let originalKvToken;

test.describe('Examples API – memory mode without defaults', () => {
  test.beforeAll(() => {
    originalKvUrl = process.env.KV_REST_API_URL;
    originalKvToken = process.env.KV_REST_API_TOKEN;
  });

  test.beforeEach(async () => {
    delete process.env.KV_REST_API_URL;
    delete process.env.KV_REST_API_TOKEN;
    await resetExamplesMemoryStore();
  });

  test.afterAll(() => {
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

  test('GET /api/examples returns an empty list by default', async () => {
    const response = await invokeExamplesApi({ url: '/api/examples' });
    expect(response.statusCode).toBe(200);
    expect(response.json).toBeTruthy();
    expect(response.json.mode).toBe('memory');
    expect(response.json.storageMode).toBe('memory');
    expect(response.json.ephemeral).toBe(true);
    expect(Array.isArray(response.json.entries)).toBe(true);
    expect(response.json.entries.length).toBe(0);
  });

  test('GET /api/examples?path= responds with 404 for unknown paths', async () => {
    const response = await invokeExamplesApi({
      url: `/api/examples?path=${encodeURIComponent('/diagram')}`
    });

    expect(response.statusCode).toBe(404);
    expect(response.json).toBeTruthy();
    expect(response.json.error).toBe('Not Found');
    expect(response.json.mode).toBe('memory');
    expect(response.json.storageMode).toBe('memory');
  });
});
