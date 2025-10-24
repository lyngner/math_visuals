const { test, expect } = require('@playwright/test');

const { attachExamplesBackendMock } = require('./helpers/examples-backend-mock');

const DIAGRAM_PATH = '/diagram/index.html';

const EMPTY_DIAGRAM_ENTRY = {
  examples: [],
  deletedProvided: [],
  updatedAt: new Date(0).toISOString()
};

const TRASH_RESPONSE_BASE = {
  storage: 'memory',
  storageMode: 'memory',
  mode: 'memory',
  persistent: false,
  ephemeral: true,
  limitation: 'Test-arkiv (midlertidig lagring).'
};

async function setDescription(page, value) {
  const input = page.locator('#exampleDescription');
  await expect(input).toBeVisible();
  await input.fill('');
  await input.fill(value);
}

test.describe('Description renderer interactions', () => {
  let backend;
  let trashRouteHandler;

  test.beforeEach(async ({ page }) => {
    backend = await attachExamplesBackendMock(page.context(), {
      '/diagram': EMPTY_DIAGRAM_ENTRY
    });

    trashRouteHandler = async route => {
      const { method } = route.request();
      if (method === 'GET') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            ...TRASH_RESPONSE_BASE,
            entries: []
          })
        });
        return;
      }

      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ ok: true })
      });
    };

    await page.context().route('**/api/examples/trash**', trashRouteHandler);
  });

  test.afterEach(async ({ page }) => {
    if (backend) {
      await backend.dispose();
      backend = null;
    }
    if (trashRouteHandler) {
      await page.context().unroute('**/api/examples/trash**', trashRouteHandler);
      trashRouteHandler = null;
    }
  });

  test('serves renderer assets without console errors', async ({ page }) => {
    const consoleErrors = [];
    const pageErrors = [];
    page.on('console', message => {
      if (message.type() === 'error') {
        consoleErrors.push(message.text());
      }
    });
    page.on('pageerror', error => {
      pageErrors.push(error && error.message ? error.message : String(error));
    });
    const rendererResponsePromise = page.waitForResponse(response => {
      if (!response.url().includes('description-renderer.js')) return false;
      try {
        const url = new URL(response.url());
        return url.pathname.endsWith('/description-renderer.js');
      } catch (error) {
        return /description-renderer\.js(?:$|\?)/.test(response.url());
      }
    });

    await page.goto(DIAGRAM_PATH, { waitUntil: 'load' });
    expect(consoleErrors).toEqual([]);
    expect(pageErrors).toEqual([]);
    const rendererResponse = await rendererResponsePromise;
    expect(rendererResponse.ok()).toBe(true);

    await setDescription(page, 'Test @math{1 + 1} og @input[answer="2"|placeholder=Svar]');
    const preview = page.locator('.example-description-preview');
    await expect(preview).toBeVisible();
    await expect(preview.locator('.math-vis-description-math')).toHaveCount(1);

    expect(consoleErrors).toEqual([]);
    expect(pageErrors).toEqual([]);
  });

  test('validates input fields as the user types', async ({ page }) => {
    await page.goto(DIAGRAM_PATH, { waitUntil: 'load' });

    await setDescription(
      page,
      [
        'Regn ut: @input[answer="12"|placeholder=Skriv svaret]',
        'Ny oppgave: @input[answer="12"|placeholder=Skriv svaret 2|label=Oppgave 2]',
        'Les av grafen: f(2) = @input[answer="0"|size="5"]'
      ].join('\n\n')
    );

    const preview = page.locator('.example-description-preview');
    const inputFields = preview.locator('.math-vis-answerbox');

    await expect(inputFields).toHaveCount(3);

    const classicAnswer = inputFields.nth(0);
    const classicInput = classicAnswer.locator('.math-vis-answerbox__input');
    const classicStatus = classicAnswer.locator('.math-vis-answerbox__status');

    await expect(classicInput).toBeVisible();
    await expect(classicAnswer).toHaveClass(/math-vis-answerbox--empty/);

    await classicInput.fill('10');
    await expect(classicAnswer).toHaveClass(/math-vis-answerbox--incorrect/);
    await expect(classicStatus).toHaveText('Prøv igjen.');

    await classicInput.fill('12');
    await expect(classicAnswer).toHaveClass(/math-vis-answerbox--correct/);
    await expect(classicAnswer).not.toHaveClass(/math-vis-answerbox--incorrect/);
    await expect(classicStatus).toHaveText('Riktig!');

    await classicInput.fill('');
    await expect(classicAnswer).toHaveClass(/math-vis-answerbox--empty/);
    await expect(classicStatus).toHaveText('');

    const labelledAnswer = inputFields.nth(1);
    const labelledPrompt = labelledAnswer.locator('.math-vis-answerbox__prompt');
    const labelledInput = labelledAnswer.locator('.math-vis-answerbox__input');
    const labelledStatus = labelledAnswer.locator('.math-vis-answerbox__status');

    await expect(labelledPrompt).toHaveText('Oppgave 2');
    await expect(labelledInput).toBeVisible();
    await expect(labelledAnswer).toHaveClass(/math-vis-answerbox--empty/);

    await labelledInput.fill('11');
    await expect(labelledAnswer).toHaveClass(/math-vis-answerbox--incorrect/);
    await expect(labelledStatus).toHaveText('Prøv igjen.');

    await labelledInput.fill('12');
    await expect(labelledAnswer).toHaveClass(/math-vis-answerbox--correct/);
    await expect(labelledAnswer).not.toHaveClass(/math-vis-answerbox--incorrect/);
    await expect(labelledStatus).toHaveText('Riktig!');

    await labelledInput.fill('');
    await expect(labelledAnswer).toHaveClass(/math-vis-answerbox--empty/);
    await expect(labelledStatus).toHaveText('');

    const inlineAnswer = inputFields.nth(2);
    const inlineInput = inlineAnswer.locator('.math-vis-answerbox__input');
    const inlineStatus = inlineAnswer.locator('.math-vis-answerbox__status');

    await expect(inlineAnswer).toHaveClass(/math-vis-answerbox--input/);
    await expect(inlineAnswer).toHaveClass(/math-vis-answerbox--empty/);
    await expect(inlineInput).toHaveAttribute('size', '5');

    await inlineInput.fill('1');
    await expect(inlineAnswer).toHaveClass(/math-vis-answerbox--incorrect/);
    await expect(inlineStatus).toHaveText('Prøv igjen.');

    await inlineInput.fill('0');
    await expect(inlineAnswer).toHaveClass(/math-vis-answerbox--correct/);
    await expect(inlineAnswer).not.toHaveClass(/math-vis-answerbox--incorrect/);
    await expect(inlineStatus).toHaveText('Riktig!');

    await inlineInput.fill('');
    await expect(inlineAnswer).toHaveClass(/math-vis-answerbox--empty/);
    await expect(inlineStatus).toHaveText('');
  });

  test('falls back to plain text math when KaTeX is unavailable', async ({ page }) => {
    await page.route('**/katex.min.js', route => route.abort());
    await page.goto(DIAGRAM_PATH, { waitUntil: 'load' });

    await setDescription(page, 'Formel: @math{a^2 + b^2 = c^2}');

    const mathNode = page.locator('.example-description-preview .math-vis-description-math');
    await expect(mathNode).toHaveText('a^2 + b^2 = c^2');
    await expect(mathNode.locator('.katex')).toHaveCount(0);
  });
});
