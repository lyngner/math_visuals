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
      window.localStorage.clear();
      window.localStorage.setItem('archive_open_request', JSON.stringify(payload.request));
    }, { request: openRequest });

    await page.goto(TOOL_PATH, { waitUntil: 'networkidle' });

    await page.waitForFunction(() => {
      const api = window.MathVisExamples;
      return !!(api && typeof api.getExamples === 'function' && api.getExamples().length > 0);
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
        noticeShown: first.__openRequestNoticeShown === true
      };
    });

    expect(flags.count).toBeGreaterThan(0);
    expect(flags.temporary).toBe(true);
    expect(flags.hasTempFlag).toBe(true);
    expect(flags.noticeShown).toBe(true);

    await description.fill('Arkivoppgave oppdatert');
    await expect(description).toHaveValue('Arkivoppgave oppdatert');

    const storedValue = await page.evaluate(key => window.localStorage.getItem(key), STORAGE_KEY);
    expect(storedValue).toBeNull();
  });
});
