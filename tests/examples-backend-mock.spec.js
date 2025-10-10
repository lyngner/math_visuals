const { test, expect } = require('@playwright/test');

const { attachExamplesBackendMock } = require('./helpers/examples-backend-mock');

function createStubContext() {
  const routes = new Set();
  const initScripts = [];
  return {
    routes,
    initScripts,
    async addInitScript(script) {
      initScripts.push(script);
    },
    async route(pattern, handler) {
      routes.add({ pattern, handler });
    },
    async unroute(pattern, handler) {
      for (const entry of Array.from(routes)) {
        if (entry.pattern !== pattern) continue;
        if (handler && entry.handler !== handler) continue;
        routes.delete(entry);
      }
    }
  };
}

test.describe('examples backend mock defaults', () => {
  test('auto-seeds bundled defaults when requested', async () => {
    const context = createStubContext();
    const backend = await attachExamplesBackendMock(context, undefined, { mode: 'memory', seedDefaults: true });

    const entry = backend.read('/tallinje');
    expect(entry).toBeTruthy();
    expect(entry.mode).toBe('memory');
    expect(entry.storage).toBe('memory');
    expect(Array.isArray(entry.examples)).toBe(true);
    expect(entry.examples.length).toBeGreaterThan(0);
    expect(entry.examples[0]).toMatchObject({
      title: 'Plasser brøkene',
      isDefault: true
    });

    await backend.dispose();
  });
});
