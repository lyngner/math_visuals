const { test, expect } = require('@playwright/test');

const {
  invokeExamplesTrashApi
} = require('./helpers/examples-trash-api-utils');

const {
  setTrashEntries
} = require('../api/_lib/examples-store');

test.describe('Examples trash API', () => {
  test.beforeEach(async () => {
    await setTrashEntries([]);
  });

  test('POST stores trash entries and GET returns archived payload', async () => {
    const payload = {
      entries: [
        {
          id: 'trash-a',
          example: { title: 'Trash Example A' },
          deletedAt: '2024-01-01T00:00:00.000Z',
          sourcePath: '/diagram'
        },
        {
          id: 'trash-b',
          example: { title: 'Trash Example B' },
          deletedAt: '2024-02-01T00:00:00.000Z',
          sourcePath: '/diagram',
          importedFromHistory: true
        }
      ]
    };

    const postResponse = await invokeExamplesTrashApi({
      method: 'POST',
      url: '/api/examples/trash',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    expect(postResponse.statusCode).toBe(200);
    expect(Array.isArray(postResponse.json.entries)).toBe(true);
    expect(postResponse.json.entries.length).toBe(2);

    const getResponse = await invokeExamplesTrashApi({ url: '/api/examples/trash' });
    expect(getResponse.statusCode).toBe(200);
    expect(Array.isArray(getResponse.json.entries)).toBe(true);
    expect(getResponse.json.entries.length).toBe(2);

    const [first] = getResponse.json.entries;
    expect(first).toHaveProperty('id');
    expect(first.sourceArchived).toBe(true);
    expect(first.sourceActive).toBe(false);
  });

  test('DELETE removes specified trash entries', async () => {
    await setTrashEntries([
      { id: 'keep', example: { title: 'Keep' }, deletedAt: '2024-03-01T00:00:00.000Z' },
      { id: 'remove', example: { title: 'Remove' }, deletedAt: '2024-03-02T00:00:00.000Z' }
    ]);

    const deleteResponse = await invokeExamplesTrashApi({
      method: 'DELETE',
      url: '/api/examples/trash',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ids: ['remove'] })
    });

    expect(deleteResponse.statusCode).toBe(200);
    expect(deleteResponse.json.removed).toBe(1);

    const afterDelete = await invokeExamplesTrashApi({ url: '/api/examples/trash' });
    const ids = afterDelete.json.entries.map(entry => entry.id);
    expect(ids).toContain('keep');
    expect(ids).not.toContain('remove');
  });
});
