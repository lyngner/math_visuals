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

test.describe('examples backend mock manual seeding', () => {
  test('stores provided initial state when requested', async () => {
    const context = createStubContext();
    const initialState = {
      '/tallinje': {
        examples: [
          {
            title: 'Tallinje eksempel',
            description: 'Øv på å plassere tall på linjen.'
          }
        ]
      }
    };
    const backend = await attachExamplesBackendMock(context, initialState, { mode: 'memory' });

    const entry = backend.read('/tallinje');
    expect(entry).toBeTruthy();
    expect(entry.mode).toBe('memory');
    expect(entry.storage).toBe('memory');
    expect(Array.isArray(entry.examples)).toBe(true);
    expect(entry.examples.length).toBe(initialState['/tallinje'].examples.length);
    expect(entry.examples[0]).toMatchObject({
      title: 'Tallinje eksempel'
    });
  });
});
