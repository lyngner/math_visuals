const { test, expect } = require('@playwright/test');

const kvClient = require('../api/_lib/kv-client');
const envKeys = [
  'REDIS_ENDPOINT',
  'REDIS_PORT',
  'REDIS_PASSWORD',
  'REDIS_HOST',
  'REDIS_SERVER',
  'REDIS_ADDRESS',
  'REDIS_URL',
  'REDIS_URI',
  'REDIS_AUTH_TOKEN',
  'REDIS_SECRET',
  'REDIS_PASS',
  'REDIS_DB',
  'REDIS_DATABASE',
  'REDIS_TLS',
  'REDIS_USE_TLS'
];

function captureEnv() {
  const snapshot = {};
  for (const key of envKeys) {
    if (Object.prototype.hasOwnProperty.call(process.env, key)) {
      snapshot[key] = process.env[key];
    } else {
      snapshot[key] = undefined;
    }
  }
  return snapshot;
}

function restoreEnv(snapshot) {
  for (const key of envKeys) {
    if (snapshot[key] === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = snapshot[key];
    }
  }
}

test.describe('kv-client Redis environment detection', () => {
  let originalEnv;

  test.beforeAll(() => {
    originalEnv = captureEnv();
  });

  test.afterAll(() => {
    restoreEnv(originalEnv);
  });

  test.beforeEach(() => {
    for (const key of envKeys) {
      delete process.env[key];
    }
  });

  test('uses REDIS_* variables for host, port and password', () => {
    process.env.REDIS_ENDPOINT = 'redis.test.local';
    process.env.REDIS_PORT = '6380';
    process.env.REDIS_PASSWORD = 'test-token';

    const env = kvClient.getRedisEnvironment();

    expect(env).toBeTruthy();
    expect(env.host).toBe('redis.test.local');
    expect(env.port).toBe(6380);
    expect(env.password).toBe('test-token');
    expect(kvClient.isKvConfigured()).toBe(true);
  });

  test('returns null environment when host information is missing', () => {
    process.env.REDIS_PORT = '6380';
    process.env.REDIS_PASSWORD = 'test-token';

    const env = kvClient.getRedisEnvironment();

    expect(env).toBeNull();
    expect(kvClient.isKvConfigured()).toBe(false);
  });
});
