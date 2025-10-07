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
      [
        '@task{Regn ut|Hva er 5 + 7? @answer{value=12|placeholder=Skriv svaret}}',
        '@task{Regn ut igjen|Hva er 9 + 3? @answerbox[value=12|placeholder=Skriv svaret 2]}'
      ].join('\n\n')
    );

    const preview = page.locator('.example-description-preview');
    const answerBoxes = preview.locator('.math-vis-answerbox');

    await expect(answerBoxes).toHaveCount(2);

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
