const { test, expect } = require('@playwright/test');

const DIAGRAM_PATH = '/diagram/index.html';

async function setDescription(page, value) {
  const input = page.locator('#exampleDescription');
  await expect(input).toBeVisible();
  await input.fill('');
  await input.fill(value);
}

test.describe('Description renderer interactions', () => {
  test('validates answer boxes as the user types', async ({ page }) => {
    await page.goto(DIAGRAM_PATH, { waitUntil: 'load' });

    await setDescription(
      page,
      '@task{Regn ut|Hva er 5 + 7? @answer{value=12|placeholder=Skriv svaret}}'
    );

    const preview = page.locator('.example-description-preview');
    const answerBox = preview.locator('.math-vis-answerbox');
    const input = answerBox.locator('.math-vis-answerbox__input');
    const status = answerBox.locator('.math-vis-answerbox__status');

    await expect(input).toBeVisible();
    await expect(answerBox).toHaveClass(/math-vis-answerbox--empty/);

    await input.fill('10');
    await expect(answerBox).toHaveClass(/math-vis-answerbox--incorrect/);
    await expect(status).toHaveText('Prøv igjen.');

    await input.fill('12');
    await expect(answerBox).toHaveClass(/math-vis-answerbox--correct/);
    await expect(status).toHaveText('Riktig!');

    await input.fill('');
    await expect(answerBox).toHaveClass(/math-vis-answerbox--empty/);
    await expect(status).toHaveText('');
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
