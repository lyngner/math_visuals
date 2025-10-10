const { test, expect } = require('@playwright/test');

const {
  invokeExamplesApi,
  resetExamplesMemoryStore
} = require('./helpers/examples-api-utils');

const DEFAULT_SEEDED_PATH = '/tallinje';
const ADDITIONAL_SEEDED_PATHS = ['/brøkpizza', '/graftegner'];

let originalKvUrl;
let originalKvToken;

test.describe('Examples API – memory auto-seeding', () => {
  test.beforeAll(() => {
    originalKvUrl = process.env.KV_REST_API_URL;
    originalKvToken = process.env.KV_REST_API_TOKEN;
  });

  test.beforeEach(() => {
    delete process.env.KV_REST_API_URL;
    delete process.env.KV_REST_API_TOKEN;
    resetExamplesMemoryStore();
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

  test('GET /api/examples seeds defaults into the memory store', async () => {
    const response = await invokeExamplesApi({ url: '/api/examples' });
    expect(response.statusCode).toBe(200);
    expect(response.json).toBeTruthy();
    expect(response.json.mode).toBe('memory');
    expect(response.json.storageMode).toBe('memory');
    expect(response.json.ephemeral).toBe(true);
    expect(Array.isArray(response.json.entries)).toBe(true);
    expect(response.json.entries.length).toBeGreaterThan(0);

    const tallinjeEntry = response.json.entries.find(entry => entry.path === DEFAULT_SEEDED_PATH);
    expect(tallinjeEntry).toBeTruthy();
    expect(Array.isArray(tallinjeEntry.examples)).toBe(true);
    expect(tallinjeEntry.examples.length).toBeGreaterThan(0);

    for (const path of ADDITIONAL_SEEDED_PATHS) {
      const entry = response.json.entries.find(item => item.path === path);
      expect(entry).toBeTruthy();
      expect(Array.isArray(entry.examples)).toBe(true);
      expect(entry.examples.length).toBeGreaterThan(0);
      expect(entry.examples[0].__builtinKey).toBeTruthy();
    }
  });

  test('GET /api/examples?path= seeds specific entry when missing', async () => {
    const response = await invokeExamplesApi({
      url: `/api/examples?path=${encodeURIComponent('/diagram')}`
    });

    expect(response.statusCode).toBe(200);
    expect(response.json).toBeTruthy();
    expect(response.json.path).toBe('/diagram');
    expect(response.json.mode).toBe('memory');
    expect(response.json.storage).toBe('memory');
    expect(Array.isArray(response.json.examples)).toBe(true);
    expect(response.json.examples.length).toBeGreaterThan(0);
    expect(response.json.examples[0].__builtinKey).toBeTruthy();
  });
});
