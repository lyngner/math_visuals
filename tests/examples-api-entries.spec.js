const { test, expect } = require('@playwright/test');

const API_URL = 'https://math-visuals.vercel.app/api/examples';
const BASE_URL = 'https://math-visuals.vercel.app/';

test.describe.configure({ mode: 'serial' });

const normalizePublishedPath = value => {
  if (typeof value !== 'string') return '/';
  let path = value.trim();
  if (!path) return '/';
  if (!path.startsWith('/')) {
    path = `/${path}`;
  }
  const suffixMatch = path.match(/([?#].*)$/);
  let base = path;
  let suffix = '';
  if (suffixMatch) {
    suffix = suffixMatch[1];
    base = path.slice(0, -suffix.length);
  }
  if (base.length > 1 && base.endsWith('/')) {
    base = base.replace(/\/+$/g, '');
    if (!base) {
      base = '/';
    }
  }
  if (base === '/') {
    base = '/index.html';
    return `${base}${suffix}`;
  }
  if (/\.[a-z0-9]+$/i.test(base)) {
    return `${base}${suffix}`;
  }
  return `${base}.html${suffix}`;
};

const ensureJsonResponse = response => {
  const status = response.status();
  if (status !== 200) {
    throw new Error(`Forventet 200 fra ${API_URL}, men fikk ${status}`);
  }

  const contentType = response.headers()['content-type'] || '';
  if (!contentType.includes('application/json')) {
    throw new Error(`Forventet JSON fra ${API_URL}, men mottok Content-Type: ${contentType || 'ukjent'}`);
  }
};

test.describe('Examples API production entries', () => {
  test('all published entries render state', async ({ browser, request }) => {
    const response = await request.get(API_URL);
    ensureJsonResponse(response);

    const payload = await response.json();
    expect(Array.isArray(payload?.entries), 'Responsen mangler entries-listen').toBe(true);

    const context = await browser.newContext({ ignoreHTTPSErrors: true });
    const page = await context.newPage();
    page.setDefaultTimeout(15000);

    const consoleErrors = [];
    const pageErrors = [];

    page.on('console', message => {
      if (message.type() === 'error') {
        const text = message.text();
        console.error(`[examples-api-entries] console error: ${text}`);
        consoleErrors.push(text);
      }
    });

    page.on('pageerror', error => {
      console.error(`[examples-api-entries] JavaScript-feil: ${error.message}`);
      pageErrors.push(error);
    });

    try {
      for (const entry of payload.entries) {
        if (!entry || typeof entry.path !== 'string') {
          continue;
        }

        consoleErrors.length = 0;
        pageErrors.length = 0;

        const publishedPath = normalizePublishedPath(entry.path);
        const targetUrl = new URL(publishedPath, BASE_URL).toString();
        const gotoResponse = await page.goto(targetUrl, { waitUntil: 'domcontentloaded' });
        const status = gotoResponse?.status();

        if (!gotoResponse) {
          throw new Error(`Fikk ikke svar ved lasting av ${targetUrl}`);
        }

        if (status === 404) {
          const message = `[examples-api-entries] 404 Not Found: ${entry.path}`;
          console.error(message);
          throw new Error(message);
        }

        if (status && status >= 400) {
          const message = `[examples-api-entries] Uventet status ${status} for ${targetUrl}`;
          console.error(message);
          throw new Error(message);
        }

        try {
          await expect
            .poll(async () => {
              try {
                return await page.evaluate(() =>
                  Boolean(window.STATE || window.CFG || window.CONFIG || window.SIMPLE)
                );
              } catch (error) {
                console.error(`[examples-api-entries] eval-feil (${entry.path}): ${error?.message || error}`);
                throw error;
              }
            }, { message: `Mangler STATE/CFG/CONFIG/SIMPLE for ${entry.path}` })
            .toBe(true);
        } catch (error) {
          console.error(`[examples-api-entries] mangler binding for ${entry.path}`);
          throw error;
        }

        if (consoleErrors.length > 0 || pageErrors.length > 0) {
          const errorMessages = [
            ...consoleErrors.map(text => `console: ${text}`),
            ...pageErrors.map(err => `pageerror: ${err.message}`)
          ].join('\n');
          throw new Error(`[examples-api-entries] JavaScript-feil oppdaget for ${entry.path}:\n${errorMessages}`);
        }
      }
    } finally {
      await context.close();
    }
  });
});
