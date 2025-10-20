const { test, expect } = require('@playwright/test');

function createMockStorage() {
  const store = new Map();
  return {
    getItem(key) {
      return store.has(key) ? store.get(key) : null;
    },
    setItem(key, value) {
      store.set(key, String(value));
    },
    removeItem(key) {
      store.delete(key);
    }
  };
}

function createDomElementStub() {
  const noop = () => {};
  const element = {
    style: {},
    appendChild: noop,
    removeChild: noop,
    remove: noop,
    setAttribute: noop,
    getAttribute: () => null,
    addEventListener: noop,
    removeEventListener: noop,
    querySelector: () => null,
    querySelectorAll: () => [],
    closest: () => null,
    classList: {
      add: noop,
      remove: noop,
      contains: () => false
    },
    parentNode: null,
    textContent: '',
    innerHTML: '',
    isConnected: false,
    dataset: {}
  };
  return element;
}

function setupDomShim() {
  const noop = () => {};
  const element = createDomElementStub;
  const body = element();
  const head = element();
  const documentStub = {
    readyState: 'complete',
    body,
    head,
    documentElement: element(),
    createElement: () => element(),
    getElementById: () => null,
    querySelector: () => null,
    querySelectorAll: () => [],
    addEventListener: noop,
    removeEventListener: noop,
    createTextNode: text => ({ textContent: text })
  };
  body.appendChild = noop;
  head.appendChild = noop;
  const storage = createMockStorage();
  const windowStub = {
    location: { pathname: '/', search: '' },
    addEventListener: noop,
    removeEventListener: noop,
    localStorage: storage,
    requestAnimationFrame: cb => setTimeout(() => cb(Date.now()), 0),
    cancelAnimationFrame: id => clearTimeout(id),
    MathVisSvgExport: { showToast: noop },
    MutationObserver: function () {
      this.observe = noop;
      this.disconnect = noop;
    },
    SVGElement: function () {}
  };
  windowStub.document = documentStub;
  windowStub.Node = { ELEMENT_NODE: 1 };
  global.window = windowStub;
  global.document = documentStub;
  global.Node = windowStub.Node;
  global.MutationObserver = windowStub.MutationObserver;
  global.location = windowStub.location;
  global.localStorage = storage;
  global.navigator = { userAgent: 'node', language: 'en' };
}

setupDomShim();

const { createTrashQueueManager, TRASH_QUEUE_STORAGE_KEY } = require('../examples.js');

test.describe('examples trash queue manager', () => {
  test('enqueues entries and flushes them with the provided handler', async () => {
    const storage = createMockStorage();
    const calls = [];
    const manager = createTrashQueueManager({
      storage,
      storageKey: `${TRASH_QUEUE_STORAGE_KEY}::test`,
      sendEntry: async entry => {
        calls.push(entry);
      }
    });

    expect(manager.hasPending()).toBe(false);

    const queued = manager.enqueue({
      record: { id: 'alpha', example: { title: 'queued' } },
      mode: 'prepend',
      limit: 200
    });

    expect(queued).not.toBeNull();
    expect(manager.hasPending()).toBe(true);
    expect(manager.getQueueLength()).toBe(1);

    const stored = storage.getItem(`${TRASH_QUEUE_STORAGE_KEY}::test`);
    expect(stored).not.toBeNull();

    const result = await manager.flush();
    expect(result.processed).toBe(1);
    expect(manager.hasPending()).toBe(false);
    expect(manager.getQueueLength()).toBe(0);
    expect(storage.getItem(`${TRASH_QUEUE_STORAGE_KEY}::test`)).toBeNull();
    expect(calls).toHaveLength(1);
    expect(calls[0]).toMatchObject({ record: { id: 'alpha' }, mode: 'prepend' });
  });

  test('preserves queued entries when the handler fails', async () => {
    const storage = createMockStorage();
    const manager = createTrashQueueManager({
      storage,
      storageKey: `${TRASH_QUEUE_STORAGE_KEY}::failure`,
      sendEntry: async () => {
        throw new Error('offline');
      }
    });

    manager.enqueue({ record: { id: 'beta' }, mode: 'append' });

    await expect(manager.flush()).rejects.toThrow('offline');
    expect(manager.hasPending()).toBe(true);
    expect(manager.getQueueLength()).toBe(1);

    const raw = storage.getItem(`${TRASH_QUEUE_STORAGE_KEY}::failure`);
    expect(raw).not.toBeNull();
    const parsed = JSON.parse(raw);
    expect(Array.isArray(parsed)).toBe(true);
    expect(parsed).toHaveLength(1);
    expect(parsed[0]).toMatchObject({ record: { id: 'beta' }, mode: 'append' });
  });
});
