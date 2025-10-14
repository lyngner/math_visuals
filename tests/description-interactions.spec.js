const { test, expect } = require('@playwright/test');

const DIAGRAM_PATH = '/diagram/index.html';

async function setDescription(page, value) {
  const input = page.locator('#exampleDescription');
  await expect(input).toBeVisible();
  await input.fill('');
  await input.fill(value);
}

test.describe('Description renderer interactions', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      window.__mathVisRenderIntoCalls = 0;
      window.__mathVisRenderIntoErrors = [];

      const ensurePatched = () => {
        const renderer = window.MathVisDescriptionRenderer;
        if (!renderer || typeof renderer.renderInto !== 'function') {
          return false;
        }
        if (renderer.renderInto.__mathVisPatched) {
          return true;
        }
        const original = renderer.renderInto.bind(renderer);
        const patched = function patchedRenderInto(...args) {
          try {
            const result = original(...args);
            window.__mathVisRenderIntoCalls += 1;
            return result;
          } catch (error) {
            if (!Array.isArray(window.__mathVisRenderIntoErrors)) {
              window.__mathVisRenderIntoErrors = [];
            }
            const message = error && (error.stack || error.message) ? error.stack || error.message : String(error);
            window.__mathVisRenderIntoErrors.push(message);
            throw error;
          }
        };
        patched.__mathVisPatched = true;
        renderer.renderInto = patched;
        return true;
      };

      window.__mathVisEnsureRendererPatched = ensurePatched;
      ensurePatched();
      window.__mathVisRendererWatcher = setInterval(() => {
        if (ensurePatched()) {
          clearInterval(window.__mathVisRendererWatcher);
          window.__mathVisRendererWatcher = null;
        }
      }, 10);
    });

    const response = await page.request.get('/description-renderer.js');
    expect(response.ok()).toBeTruthy();
    const body = await response.text();
    expect(body).toContain('MathVisDescriptionRenderer');
  });

  test('validates answer boxes as the user types', async ({ page }) => {
    await page.goto(DIAGRAM_PATH, { waitUntil: 'load' });

    await page.waitForFunction(() => !!(window.MathVisDescriptionRenderer && typeof window.MathVisDescriptionRenderer.renderInto === 'function'));

    await setDescription(
      page,
      [
        '@task{Regn ut|Hva er 5 + 7? @answer{value=12|placeholder=Skriv svaret}}',
        '@task{Regn ut igjen|Hva er 9 + 3? @answerbox[value=12|placeholder=Skriv svaret 2]}',
        '@task{Les av grafen|f(2) = @input[answer="0"|size="5"]}'
      ].join('\n\n')
    );

    const preview = page.locator('.example-description-preview');
    const answerBoxes = preview.locator('.math-vis-answerbox');

    await expect(answerBoxes).toHaveCount(3);

    const classicAnswer = answerBoxes.nth(0);
    const classicInput = classicAnswer.locator('.math-vis-answerbox__input');
    const classicStatus = classicAnswer.locator('.math-vis-answerbox__status');

    await expect(classicInput).toBeVisible();
    await expect(classicAnswer).toHaveClass(/math-vis-answerbox--empty/);

    await classicInput.fill('10');
    await expect(classicAnswer).toHaveClass(/math-vis-answerbox--incorrect/);
    await expect(classicStatus).toHaveText('Prøv igjen.');

    await classicInput.fill('12');
    await expect(classicAnswer).toHaveClass(/math-vis-answerbox--correct/);
    await expect(classicStatus).toHaveText('Riktig!');

    await classicInput.fill('');
    await expect(classicAnswer).toHaveClass(/math-vis-answerbox--empty/);
    await expect(classicStatus).toHaveText('');

    const aliasAnswer = answerBoxes.nth(1);
    const aliasInput = aliasAnswer.locator('.math-vis-answerbox__input');
    const aliasStatus = aliasAnswer.locator('.math-vis-answerbox__status');

    await expect(aliasInput).toBeVisible();
    await expect(aliasAnswer).toHaveClass(/math-vis-answerbox--empty/);

    await aliasInput.fill('11');
    await expect(aliasAnswer).toHaveClass(/math-vis-answerbox--incorrect/);
    await expect(aliasStatus).toHaveText('Prøv igjen.');

    await aliasInput.fill('12');
    await expect(aliasAnswer).toHaveClass(/math-vis-answerbox--correct/);
    await expect(aliasStatus).toHaveText('Riktig!');

    await aliasInput.fill('');
    await expect(aliasAnswer).toHaveClass(/math-vis-answerbox--empty/);
    await expect(aliasStatus).toHaveText('');

    const inlineAnswer = answerBoxes.nth(2);
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
    await expect(inlineStatus).toHaveText('Riktig!');

    await inlineInput.fill('');
    await expect(inlineAnswer).toHaveClass(/math-vis-answerbox--empty/);
    await expect(inlineStatus).toHaveText('');

    await page.waitForFunction(() => (window.__mathVisRenderIntoCalls || 0) > 0);
    const renderErrors = await page.evaluate(() => window.__mathVisRenderIntoErrors || []);
    expect(renderErrors).toEqual([]);
  });

  test('falls back to plain text math when KaTeX is unavailable', async ({ page }) => {
    await page.route('**/katex.min.js', route => route.abort());
    await page.goto(DIAGRAM_PATH, { waitUntil: 'load' });

    await page.waitForFunction(() => !!(window.MathVisDescriptionRenderer && typeof window.MathVisDescriptionRenderer.renderInto === 'function'));

    await setDescription(page, 'Formel: @math{a^2 + b^2 = c^2}');

    const mathNode = page.locator('.example-description-preview .math-vis-description-math');
    await expect(mathNode).toHaveText('a^2 + b^2 = c^2');
    await expect(mathNode.locator('.katex')).toHaveCount(0);

    await page.waitForFunction(() => (window.__mathVisRenderIntoCalls || 0) > 0);
    const renderErrors = await page.evaluate(() => window.__mathVisRenderIntoErrors || []);
    expect(renderErrors).toEqual([]);
  });
});
