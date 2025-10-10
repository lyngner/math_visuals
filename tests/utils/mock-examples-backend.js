/**
 * Helper for Playwright tests to mock the /api/examples backend.
 *
 * Usage:
 *   const mock = await attachExamplesBackendMock(context, initialState, sharedStore);
 *   // Interact with the page that hits /api/examples?path=...
 *   await mock.waitForPut('/path');
 *   await mock.reset(); // or mock.dispose(); when finished
 */
const DEFAULT_HEADERS = { 'Content-Type': 'application/json' };

function normaliseInitialState(initialState) {
  if (!initialState) return [];
  if (initialState instanceof Map) {
    return Array.from(initialState.entries());
  }
  if (Array.isArray(initialState)) {
    return initialState.map(([key, value]) => [key, value]);
  }
  if (typeof initialState === 'object') {
    return Object.entries(initialState);
  }
  return [];
}

function parseRequestBody(request) {
  try {
    const data = request.postData();
    if (!data) return {};
    return JSON.parse(data);
  } catch (error) {
    return {};
  }
}

function resolveWaiters(waiters, payload) {
  if (!waiters) return;
  while (waiters.length) {
    const waiter = waiters.shift();
    try {
      waiter.resolve(payload);
    } catch (error) {
      // Ignore failures from awaiters rejecting.
    }
  }
}

function rejectWaiters(waiters, reason) {
  if (!waiters) return;
  while (waiters.length) {
    const waiter = waiters.shift();
    try {
      waiter.reject(reason);
    } catch (error) {
      // Ignore failures from awaiters rejecting.
    }
  }
}

function extractPathFromRequest(request) {
  const url = new URL(request.url());
  const path = url.searchParams.get('path');
  return path ?? url.pathname;
}

async function handleGet(route, store, path) {
  if (store.has(path)) {
    const payload = store.get(path);
    await route.fulfill({ status: 200, headers: DEFAULT_HEADERS, body: JSON.stringify(payload) });
  } else {
    await route.fulfill({
      status: 404,
      headers: DEFAULT_HEADERS,
      body: JSON.stringify({ error: 'Not Found', path })
    });
  }
}

async function handlePut(route, request, store, waitersByPath, path) {
  const payload = parseRequestBody(request);
  store.set(path, payload);
  const waiters = waitersByPath.get(path);
  resolveWaiters(waiters, payload);
  if (waiters) {
    waitersByPath.delete(path);
  }
  await route.fulfill({ status: 200, headers: DEFAULT_HEADERS, body: JSON.stringify(payload) });
}

async function handleDelete(route, store, path) {
  store.delete(path);
  await route.fulfill({ status: 200, headers: DEFAULT_HEADERS, body: JSON.stringify({ ok: true }) });
}

function handlerFactory(store, waitersByPath, disposedRef) {
  return async function handler(route) {
    if (disposedRef.disposed) {
      await route.fallback();
      return;
    }

    const request = route.request();
    const method = request.method();
    const path = extractPathFromRequest(request);

    if (!path) {
      await route.fulfill({
        status: 400,
        headers: DEFAULT_HEADERS,
        body: JSON.stringify({ error: 'Missing path parameter' })
      });
      return;
    }

    if (method === 'GET') {
      await handleGet(route, store, path);
      return;
    }

    if (method === 'PUT') {
      await handlePut(route, request, store, waitersByPath, path);
      return;
    }

    if (method === 'DELETE') {
      await handleDelete(route, store, path);
      return;
    }

    await route.fulfill({
      status: 405,
      headers: DEFAULT_HEADERS,
      body: JSON.stringify({ error: 'Method Not Allowed', method })
    });
  };
}

async function registerRoute(context, handler) {
  await context.route('**/api/examples**', handler);
}

function seedInitialState(store, initialState) {
  for (const [key, value] of normaliseInitialState(initialState)) {
    store.set(key, value);
  }
}

function clearStore(store) {
  store.clear();
}

function clearWaiters(waitersByPath, reason) {
  for (const waiters of waitersByPath.values()) {
    rejectWaiters(waiters, reason);
  }
  waitersByPath.clear();
}

async function removeRoute(context, handler, disposedRef) {
  if (disposedRef.disposed) return;
  disposedRef.disposed = true;
  await context.unroute('**/api/examples**', handler);
}

async function attachExamplesBackendMock(context, initialState = {}, sharedStore) {
  const store = sharedStore ?? new Map();
  const waitersByPath = new Map();
  const disposedRef = { disposed: false };
  const handler = handlerFactory(store, waitersByPath, disposedRef);

  seedInitialState(store, initialState);
  await registerRoute(context, handler);

  function seed(path, payload) {
    store.set(path, payload);
  }

  function read(path) {
    return store.get(path);
  }

  function remove(path) {
    store.delete(path);
  }

  function waitForPut(path) {
    return new Promise((resolve, reject) => {
      const entry = waitersByPath.get(path);
      if (entry) {
        entry.push({ resolve, reject });
      } else {
        waitersByPath.set(path, [{ resolve, reject }]);
      }
    });
  }

  async function reset() {
    clearStore(store);
    clearWaiters(waitersByPath, new Error('Mock backend reset'));
    await removeRoute(context, handler, disposedRef);
  }

  async function dispose() {
    await reset();
  }

  return {
    store,
    seed,
    read,
    remove,
    waitForPut,
    reset,
    dispose
  };
}

module.exports = { attachExamplesBackendMock };
