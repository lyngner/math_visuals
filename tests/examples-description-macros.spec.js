const { test, expect } = require('@playwright/test');

const ANSWERBOX_DESCRIPTION = '@task{Test svaret: @answerbox[answer=4 placeholder="Svar"]}';
const MATH_DESCRIPTION = '@math{x^2 + 1}';

test.describe('Oppgavetekst-makroer', () => {
  test('answerbox viser og validerer brukerinput', async ({ page }) => {
    await page.goto('/diagram/index.html');

    const textarea = page.locator('#exampleDescription');
    await textarea.fill(ANSWERBOX_DESCRIPTION);

    const preview = page.locator('.example-description-preview');
    await expect(preview).toHaveAttribute('data-empty', 'false');

    const input = preview.locator('input.example-answerbox');
    await expect(input).toHaveCount(1);
    await expect(input).toHaveAttribute('placeholder', 'Svar');

    await input.fill('5');
    await expect(input).toHaveAttribute('aria-invalid', 'true');
    await expect(input).toHaveClass(/example-answerbox--incorrect/);

    await input.fill('4');
    await expect(input).toHaveAttribute('aria-invalid', 'false');
    await expect(input).toHaveClass(/example-answerbox--correct/);
  });

  test('math-makro faller tilbake til tekst når KaTeX mangler', async ({ page }) => {
    await page.goto('/arealmodell.html');

    const textarea = page.locator('#exampleDescription');
    await textarea.fill(MATH_DESCRIPTION);

    const math = page.locator('.example-description-preview .example-math');
    await expect(math).toHaveCount(1);
    await expect(math).toHaveText('x^2 + 1');
    await expect(math.locator('.katex')).toHaveCount(0);
  });
});
