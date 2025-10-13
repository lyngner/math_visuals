const { test, expect } = require('@playwright/test');

const API_URL = 'https://math-visuals.vercel.app/api/examples';
const BASE_URL = 'https://math-visuals.vercel.app/';

test.describe.configure({ mode: 'serial' });

test.describe('Examples API production entries', () => {
  test('all published entries render state', async ({ page, request }) => {
    const response = await request.get(API_URL);
    expect(response.ok(), 'Kunne ikke hente produksjonslisten fra /api/examples').toBeTruthy();

    const json = await response.json();
    expect(Array.isArray(json?.entries), 'Responsen mangler entries-listen').toBe(true);

    for (const entry of json.entries) {
      if (!entry || typeof entry.path !== 'string') {
        continue;
      }

      const targetUrl = new URL(entry.path, BASE_URL).toString();
      const gotoResponse = await page.goto(targetUrl, { waitUntil: 'domcontentloaded' });
      const status = gotoResponse?.status();

      if (status === 404) {
        console.error(`[examples-api-entries] 404 Not Found: ${entry.path}`);
      }

      expect(gotoResponse, `Fikk ikke svar ved lasting av ${targetUrl}`).toBeTruthy();
      expect(status, `Forventet 200 for ${targetUrl}, men fikk ${status ?? 'ukjent'}`).not.toBe(404);

      try {
        await expect
          .poll(async () => {
            const { hasState } = await page.evaluate(() => ({
              hasState:
                !!(window.STATE || window.CFG || window.CONFIG || window.SIMPLE)
            }));
            return hasState === true;
          }, { message: `Mangler STATE/CFG/CONFIG/SIMPLE for ${entry.path}` })
          .toBe(true);
      } catch (error) {
        console.error(`[examples-api-entries] mangler init-state: ${entry.path}`);
        throw error;
      }
    }
  });
});
