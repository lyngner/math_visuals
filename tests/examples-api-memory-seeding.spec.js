const { test, expect } = require('@playwright/test');

const {
  invokeExamplesApi,
  resetExamplesMemoryStore
} = require('./helpers/examples-api-utils');

let originalRedisEndpoint;
let originalRedisPort;
let originalRedisPassword;

test.describe('Examples API – memory mode without defaults', () => {
  test.beforeAll(() => {
    originalRedisEndpoint = process.env.REDIS_ENDPOINT;
    originalRedisPort = process.env.REDIS_PORT;
    originalRedisPassword = process.env.REDIS_PASSWORD;
  });

  test.beforeEach(async () => {
    delete process.env.REDIS_ENDPOINT;
    delete process.env.REDIS_PORT;
    delete process.env.REDIS_PASSWORD;
    await resetExamplesMemoryStore();
  });

  test.afterAll(() => {
    if (originalRedisEndpoint !== undefined) {
      process.env.REDIS_ENDPOINT = originalRedisEndpoint;
    } else {
      delete process.env.REDIS_ENDPOINT;
    }
    if (originalRedisPort !== undefined) {
      process.env.REDIS_PORT = originalRedisPort;
    } else {
      delete process.env.REDIS_PORT;
    }
    if (originalRedisPassword !== undefined) {
      process.env.REDIS_PASSWORD = originalRedisPassword;
    } else {
      delete process.env.REDIS_PASSWORD;
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
