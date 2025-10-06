const { test, expect } = require('@playwright/test');

const AUTHOR_PATH = '/diagram/index.html';
const VIEWER_PATH = '/examples-viewer.html';
const STORAGE_KEY = 'examples_/diagram/index.html';
const SAMPLE_DESCRIPTION = `
@task{Regn ut $2+2$ og skriv svaret: @answerbox{4|04}}
@task{Skriv brøken som desimal: @answerbox{1/2|0.5|0,5}}
@table{
Oppgave|Fasit
1|4
2|1/2
}
`;

test.describe('Description renderer parity', () => {
  test('viewer matches author preview rendering and behaviour', async ({ page }) => {
    await page.goto(AUTHOR_PATH, { waitUntil: 'load' });

    const descriptionField = page.locator('#exampleDescription');
    await descriptionField.fill(SAMPLE_DESCRIPTION.trim());

    const preview = page.locator('.example-description-preview');
    await expect(preview).toHaveAttribute('data-empty', 'false');
    await expect(preview.locator('.example-task')).toHaveCount(2);
    await expect(preview.locator('.example-answerbox__input')).toHaveCount(2);
    await expect(preview.locator('.katex')).toHaveCount(1);

    const previewHTML = await preview.evaluate(el => el.innerHTML);

    // Validate behaviour in the author preview
    const previewFirstAnswer = preview.locator('.example-answerbox').first();
    const previewSecondAnswer = preview.locator('.example-answerbox').nth(1);
    await previewFirstAnswer.locator('.example-answerbox__input').fill('4');
    await expect(previewFirstAnswer).toHaveClass(/example-answerbox--correct/);
    await previewSecondAnswer.locator('.example-answerbox__input').fill('0,5');
    await expect(previewSecondAnswer).toHaveClass(/example-answerbox--correct/);

    // Prepare viewer with the same stored example
    const viewerPage = await page.context().newPage();
    await viewerPage.addInitScript(({ key, value }) => {
      try {
        window.localStorage.clear();
      } catch (error) {}
      if (window.__EXAMPLES_STORAGE__ && window.__EXAMPLES_STORAGE__ !== window.localStorage) {
        try {
          window.__EXAMPLES_STORAGE__.clear();
        } catch (error) {}
      }
      window.localStorage.setItem(key, value);
    }, { key: STORAGE_KEY, value: JSON.stringify([{ description: SAMPLE_DESCRIPTION.trim() }]) });

    await viewerPage.goto(VIEWER_PATH, { waitUntil: 'load' });
    const viewerDescription = viewerPage.locator('section .example-description').first();
    await expect(viewerDescription).toHaveCount(1);
    await expect(viewerDescription.locator('.example-task')).toHaveCount(2);
    await expect(viewerDescription.locator('.example-answerbox__input')).toHaveCount(2);
    await expect(viewerDescription.locator('.katex')).toHaveCount(1);

    const viewerHTML = await viewerDescription.evaluate(el => el.innerHTML);
    expect(viewerHTML).toBe(previewHTML);

    const viewerFirstAnswer = viewerDescription.locator('.example-answerbox').first();
    const viewerSecondAnswer = viewerDescription.locator('.example-answerbox').nth(1);
    await viewerFirstAnswer.locator('.example-answerbox__input').fill('4');
    await expect(viewerFirstAnswer).toHaveClass(/example-answerbox--correct/);
    await viewerSecondAnswer.locator('.example-answerbox__input').fill('0.5');
    await expect(viewerSecondAnswer).toHaveClass(/example-answerbox--correct/);
  });
});
