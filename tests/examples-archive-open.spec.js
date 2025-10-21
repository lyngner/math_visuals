const { test, expect } = require('@playwright/test');

const TOOL_PATH = '/diagram/index.html';
const STORAGE_KEY = 'examples_/diagram';

const ARCHIVE_EXAMPLE = {
  description: 'Arkivbeskrivelse',
  exampleNumber: 'Arkiv',
  config: {
    CFG: {
      type: 'bar',
      title: 'Fra arkivet',
      labels: ['A', 'B'],
      series1: '',
      start: [1, 2],
      answer: [1, 2],
      yMin: 0,
      yMax: 5,
      snap: 1,
      tolerance: 0,
      axisXLabel: 'Kategori',
      axisYLabel: 'Verdi',
      valueDisplay: 'none',
      locked: []
    }
  }
};

test.describe('Archive open integration', () => {
  test('injects archive example as temporary draft', async ({ page }) => {
    const openRequest = {
      id: 'diagram-archive-test',
      canonicalPath: '/diagram',
      path: '/diagram',
      createdAt: '2024-02-01T10:00:00.000Z',
      example: ARCHIVE_EXAMPLE
    };

    await page.addInitScript(payload => {
      try {
        window.localStorage.clear();
      } catch (_) {}
      window.__preparedOpenRequest = null;
      const descriptor = {
        configurable: true,
        get() {
          return undefined;
        },
        set(value) {
          Object.defineProperty(window, 'MathVisExamples', {
            value,
            writable: true,
            configurable: true,
            enumerable: true
          });
          if (value && typeof value.prepareOpenRequest === 'function') {
            try {
              const prepared = value.prepareOpenRequest(payload.request);
              window.__preparedOpenRequest = prepared || null;
            } catch (_) {
              window.__preparedOpenRequest = null;
            }
          }
        }
      };
      try {
        Object.defineProperty(window, 'MathVisExamples', descriptor);
      } catch (_) {
        window.MathVisExamples = undefined;
      }
    }, { request: openRequest });

    await page.goto(TOOL_PATH, { waitUntil: 'networkidle' });

    await page.waitForFunction(() => {
      const api = window.MathVisExamples;
      return !!(api && typeof api.getExamples === 'function' && api.getExamples().length > 0);
    });

    const preparedRequest = await page.evaluate(() => window.__preparedOpenRequest);
    expect(preparedRequest).toBeTruthy();
    expect(preparedRequest.example || preparedRequest.exampleState).toMatchObject({
      description: ARCHIVE_EXAMPLE.description,
      config: ARCHIVE_EXAMPLE.config
    });

    const activeTab = page.locator('#exampleTabs .example-tab.is-active');
    await expect(activeTab).toHaveAttribute('data-example-state', 'new');
    await expect(activeTab).toHaveClass(/is-new/);

    const description = page.locator('#exampleDescription');
    await expect(description).toHaveValue(ARCHIVE_EXAMPLE.description);

    const statusText = page.locator('.example-save-status__text');
    await expect(statusText).toContainText('arkivet');

    await page.waitForFunction(
      expectedTitle => window.CFG && window.CFG.title === expectedTitle,
      {},
      ARCHIVE_EXAMPLE.config.CFG.title
    );

    const flags = await page.evaluate(() => {
      const examples = window.MathVisExamples.getExamples();
      const first = examples[0] || {};
      return {
        count: examples.length,
        temporary: first.temporary === true,
        hasTempFlag: first.__isTemporaryExample === true,
        noticeShown: first.__openRequestNoticeShown === true,
        title: first.config && first.config.CFG && first.config.CFG.title,
        description: first.description
      };
    });

    expect(flags.count).toBeGreaterThan(0);
    expect(flags.temporary).toBe(true);
    expect(flags.hasTempFlag).toBe(true);
    expect(flags.noticeShown).toBe(true);
    expect(flags.title).toBe(ARCHIVE_EXAMPLE.config.CFG.title);
    expect(flags.description).toBe(ARCHIVE_EXAMPLE.description);

    await description.fill('Arkivoppgave oppdatert');
    await expect(description).toHaveValue('Arkivoppgave oppdatert');

    const storedValue = await page.evaluate(key => window.localStorage.getItem(key), STORAGE_KEY);
    expect(storedValue).toBeNull();
  });
});
