'use strict';

const MOCK_SYMBOL = Symbol.for('math_visuals.kv_mock');

let sharedMockKv = null;

function createMockKv() {
  const data = new Map();
  const sets = new Map();
  const ensureSet = key => {
    if (!sets.has(key)) {
      sets.set(key, new Set());
    }
    return sets.get(key);
  };
  return {
    api: {
      async set(key, value) {
        data.set(key, value);
      },
      async get(key) {
        return data.has(key) ? data.get(key) : null;
      },
      async del(key) {
        data.delete(key);
      },
      async sadd(key, member) {
        ensureSet(key).add(member);
      },
      async srem(key, member) {
        if (!sets.has(key)) return;
        const target = sets.get(key);
        target.delete(member);
        if (target.size === 0) {
          sets.delete(key);
        }
      },
      async smembers(key) {
        return sets.has(key) ? Array.from(sets.get(key)) : [];
      }
    },
    clear() {
      data.clear();
      sets.clear();
    }
  };
}

function setupKvMock() {
  let mockKv = sharedMockKv;
  if (!mockKv) {
    mockKv = createMockKv();
    sharedMockKv = mockKv;
  }
  const hasExistingClient = Object.prototype.hasOwnProperty.call(global, '__MATH_VISUALS_KV_CLIENT__');
  const previousClient = global.__MATH_VISUALS_KV_CLIENT__;

  global.__MATH_VISUALS_KV_CLIENT__ = mockKv.api;
  Object.defineProperty(mockKv.api, MOCK_SYMBOL, {
    value: mockKv,
    configurable: true
  });

  const cleanup = () => {
    mockKv.clear();
    if (hasExistingClient) {
      global.__MATH_VISUALS_KV_CLIENT__ = previousClient;
    } else {
      delete global.__MATH_VISUALS_KV_CLIENT__;
    }
  };

  return { mockKv, cleanup };
}

module.exports = { createMockKv, setupKvMock };
