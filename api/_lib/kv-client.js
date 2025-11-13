'use strict';

const Redis = require('ioredis');

const DEFAULT_INJECTION_KEY = '__MATH_VISUALS_KV_CLIENT__';
const globalScope = typeof globalThis === 'object' && globalThis ? globalThis : global;

const HOST_ENV_KEYS = ['REDIS_HOST', 'REDIS_ENDPOINT', 'REDIS_SERVER', 'REDIS_ADDRESS'];
const URL_ENV_KEYS = ['REDIS_URL', 'REDIS_URI'];
const PORT_ENV_KEYS = ['REDIS_PORT'];
const PASSWORD_ENV_KEYS = ['REDIS_PASSWORD', 'REDIS_AUTH_TOKEN', 'REDIS_SECRET', 'REDIS_PASS'];
const DB_ENV_KEYS = ['REDIS_DB', 'REDIS_DATABASE'];
const TLS_ENV_KEYS = ['REDIS_TLS', 'REDIS_USE_TLS'];
const TLS_HOST_PATTERNS = [/\.amazonaws\.com$/i, /memorydb/i];

let sharedClientPromise = null;
const injectionPromises = new Map();

class KvOperationError extends Error {
  constructor(message, options) {
    super(message);
    if (options && options.cause) {
      this.cause = options.cause;
    }
    this.code = options && options.code ? options.code : 'KV_OPERATION_FAILED';
  }
}

class KvConfigurationError extends Error {
  constructor(message) {
    super(message);
    this.code = 'KV_NOT_CONFIGURED';
  }
}

function readEnvValue(key) {
  if (!key) return null;
  const raw = process.env[key];
  if (typeof raw !== 'string') return null;
  const trimmed = raw.trim();
  return trimmed ? trimmed : null;
}

function parseBoolean(value) {
  if (value == null) return null;
  const normalized = String(value).trim().toLowerCase();
  if (!normalized) return null;
  if (['1', 'true', 'yes', 'y', 'on', 'enabled'].includes(normalized)) return true;
  if (['0', 'false', 'no', 'n', 'off', 'disabled'].includes(normalized)) return false;
  return null;
}

function gatherEnvValue(keys) {
  for (const key of keys) {
    const value = readEnvValue(key);
    if (value) {
      return value;
    }
  }
  return null;
}

function parsePort(value) {
  if (value == null) return null;
  const parsed = Number.parseInt(String(value), 10);
  if (Number.isInteger(parsed) && parsed > 0 && parsed < 65536) {
    return parsed;
  }
  return null;
}

function shouldUseTls(host, explicit) {
  if (typeof explicit === 'boolean') {
    return explicit;
  }
  if (host && TLS_HOST_PATTERNS.some(pattern => pattern.test(host))) {
    return true;
  }
  return false;
}

function parseRedisUrl(urlValue) {
  if (!urlValue) return null;
  let urlString = urlValue;
  if (!/^[a-zA-Z][a-zA-Z0-9+.-]*:\/\//.test(urlString)) {
    urlString = `redis://${urlString}`;
  }
  try {
    return new URL(urlString);
  } catch (error) {
    return null;
  }
}

function getRedisEnvironment() {
  const urlValue = gatherEnvValue(URL_ENV_KEYS);
  const parsedUrl = parseRedisUrl(urlValue);

  let host = parsedUrl ? parsedUrl.hostname : null;
  let port = parsedUrl ? parsePort(parsedUrl.port) : null;
  let password = parsedUrl && parsedUrl.password ? parsedUrl.password : null;
  let db = parsedUrl && parsedUrl.pathname ? parsePort(parsedUrl.pathname.replace(/^\//, '')) : null;

  const hostCandidate = gatherEnvValue(HOST_ENV_KEYS);
  if (hostCandidate) {
    if (/^[a-zA-Z][a-zA-Z0-9+.-]*:\/\//.test(hostCandidate)) {
      const hostUrl = parseRedisUrl(hostCandidate);
      if (hostUrl) {
        host = hostUrl.hostname || host;
        port = parsePort(hostUrl.port) || port;
        if (hostUrl.password) {
          password = hostUrl.password;
        }
        if (hostUrl.pathname && hostUrl.pathname.length > 1) {
          db = parsePort(hostUrl.pathname.replace(/^\//, '')) || db;
        }
      }
    } else if (!host) {
      host = hostCandidate;
    }
  }

  const portCandidate = gatherEnvValue(PORT_ENV_KEYS);
  if (portCandidate != null) {
    port = parsePort(portCandidate) || port;
  }

  const passwordCandidate = gatherEnvValue(PASSWORD_ENV_KEYS);
  if (passwordCandidate) {
    password = passwordCandidate;
  }

  const dbCandidate = gatherEnvValue(DB_ENV_KEYS);
  if (dbCandidate != null) {
    db = parsePort(dbCandidate) ?? db;
  }

  const tlsCandidate = gatherEnvValue(TLS_ENV_KEYS);
  const explicitTls = parseBoolean(tlsCandidate);
  const useTls = shouldUseTls(host, explicitTls == null ? (parsedUrl ? parsedUrl.protocol === 'rediss:' : null) : explicitTls);

  if (!host) {
    return null;
  }

  const env = { host };
  if (Number.isInteger(port)) {
    env.port = port;
  }
  if (password) {
    env.password = password;
  }
  if (Number.isInteger(db)) {
    env.db = db;
  }
  if (useTls) {
    env.tls = {};
  }

  return env;
}

function isKvConfigured() {
  return Boolean(getRedisEnvironment());
}

function getInjectedClient(injectionKey) {
  if (!globalScope || typeof globalScope !== 'object') {
    return null;
  }
  if (injectionKey && globalScope[injectionKey]) {
    return globalScope[injectionKey];
  }
  if (globalScope[DEFAULT_INJECTION_KEY]) {
    return globalScope[DEFAULT_INJECTION_KEY];
  }
  return null;
}

function normalizeInjectionKey(key) {
  if (typeof key !== 'string') {
    return DEFAULT_INJECTION_KEY;
  }
  const trimmed = key.trim();
  return trimmed ? trimmed : DEFAULT_INJECTION_KEY;
}

function createRedisClient(env) {
  const options = {
    lazyConnect: true,
    enableAutoPipelining: false
  };
  if (env.host) {
    options.host = env.host;
  }
  if (Number.isInteger(env.port)) {
    options.port = env.port;
  }
  if (env.password) {
    options.password = env.password;
  }
  if (env.tls) {
    options.tls = env.tls;
  }
  if (Number.isInteger(env.db)) {
    options.db = env.db;
  }
  const redis = new Redis(options);
  return redis;
}

function serializeValue(value) {
  if (value === undefined) {
    return 'null';
  }
  try {
    return JSON.stringify(value);
  } catch (error) {
    throw new KvOperationError('Failed to serialize value for Redis KV set', { cause: error });
  }
}

function deserializeValue(raw) {
  if (raw == null) return raw;
  try {
    return JSON.parse(raw);
  } catch (_) {
    return raw;
  }
}

function flattenMembers(members) {
  const result = [];
  const stack = Array.isArray(members) ? members.slice() : [members];
  while (stack.length) {
    const value = stack.shift();
    if (Array.isArray(value)) {
      stack.unshift(...value);
      continue;
    }
    if (value == null) continue;
    result.push(typeof value === 'string' ? value : String(value));
  }
  return result;
}

function wrapRedisClient(redis) {
  return {
    __redis: redis,
    async set(key, value) {
      const payload = serializeValue(value);
      await redis.set(key, payload);
      return 'OK';
    },
    async get(key) {
      const raw = await redis.get(key);
      if (raw == null) {
        return null;
      }
      return deserializeValue(raw);
    },
    async del(key) {
      return redis.del(key);
    },
    async sadd(key, ...members) {
      const flat = flattenMembers(members);
      if (!flat.length) return 0;
      return redis.sadd(key, ...flat);
    },
    async srem(key, ...members) {
      const flat = flattenMembers(members);
      if (!flat.length) return 0;
      return redis.srem(key, ...flat);
    },
    async smembers(key) {
      const values = await redis.smembers(key);
      return Array.isArray(values) ? values : [];
    }
  };
}

function createSharedClientPromise() {
  const env = getRedisEnvironment();
  if (!env) {
    throw new KvConfigurationError(
      'Redis KV is not configured. Set REDIS_ENDPOINT (or REDIS_HOST), REDIS_PORT, and REDIS_PASSWORD.'
    );
  }
  const pending = (async () => {
    const redis = createRedisClient(env);
    try {
      await redis.connect();
    } catch (error) {
      redis.disconnect();
      throw new KvOperationError('Unable to establish Redis connection', { cause: error });
    }
    return wrapRedisClient(redis);
  })();
  return pending
    .then(client => client)
    .catch(error => {
      sharedClientPromise = null;
      throw error;
    });
}

async function loadKvClient(options) {
  const injectionKey = options && options.injectionKey ? normalizeInjectionKey(options.injectionKey) : DEFAULT_INJECTION_KEY;
  const injected = getInjectedClient(injectionKey);
  if (injected) {
    const existing = injectionPromises.get(injectionKey);
    if (existing && existing.promise && existing.promise.__mathVisualsInjected) {
      return existing.promise;
    }
    const resolved = Promise.resolve(injected).then(client => {
      if (!client) {
        throw new KvOperationError('Injected KV client is not available');
      }
      return client;
    });
    resolved.__mathVisualsInjected = true;
    injectionPromises.set(injectionKey, { promise: resolved });
    return resolved;
  }

  if (!sharedClientPromise || sharedClientPromise.__mathVisualsInjected) {
    sharedClientPromise = createSharedClientPromise();
  }
  return sharedClientPromise;
}

function hasInjectedClient(options = {}) {
  const injectionKey = options && options.injectionKey ? normalizeInjectionKey(options.injectionKey) : DEFAULT_INJECTION_KEY;
  return Boolean(getInjectedClient(injectionKey));
}

function getStoreMode(options = {}) {
  if (hasInjectedClient(options)) {
    return 'kv';
  }
  return isKvConfigured() ? 'kv' : 'memory';
}

module.exports = {
  loadKvClient,
  isKvConfigured,
  getStoreMode,
  hasInjectedClient,
  KvOperationError,
  KvConfigurationError,
  getRedisEnvironment,
  DEFAULT_INJECTION_KEY
};
