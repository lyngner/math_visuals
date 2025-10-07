const { test, expect } = require('@playwright/test');

const AUTHOR_PATH = '/diagram/index.html';
const VIEWER_PATH = '/examples-viewer.html';
const STORAGE_KEY = 'examples_/diagram';
const DESCRIPTION_TEXT = `@task{title="Oppgave 1"\nFinn summen @math{2+2}.\n\n@answerbox{id=svarkasse label="Svar" type=number answer=4 correctText="Riktig!" incorrectText="Prøv igjen."}\n\n@table{Alternativ|Svar\nA|3\nB|4\nC|5}}`;

function prepareViewerStorage(context) {
  return context.addInitScript(({ key, description, deletedKey }) => {
    const payload = [{
      description,
      exampleNumber: 'Paritetstest',
      isDefault: true,
      config: { CFG: { type: 'bar' } }
    }];
    try {
      window.localStorage.setItem(key, JSON.stringify(payload));
    } catch (error) {}
    try {
      window.localStorage.setItem(deletedKey, '[]');
    } catch (error) {}
    try {
      window.sessionStorage.removeItem(key);
    } catch (error) {}
    if (window.__EXAMPLES_STORAGE__ && typeof window.__EXAMPLES_STORAGE__.setItem === 'function') {
      try {
        window.__EXAMPLES_STORAGE__.setItem(key, JSON.stringify(payload));
      } catch (error) {}
    }
    if (window.__EXAMPLES_FALLBACK_STORAGE__ && typeof window.__EXAMPLES_FALLBACK_STORAGE__.setItem === 'function') {
      try {
        window.__EXAMPLES_FALLBACK_STORAGE__.setItem(key, JSON.stringify(payload));
      } catch (error) {}
    }
  }, { key: STORAGE_KEY, deletedKey: `${STORAGE_KEY}_deletedProvidedExamples`, description: DESCRIPTION_TEXT });
}

test.describe('Beskrivelsesrendrer', () => {
  test('forfatter og viewer viser samme oppgave med validering', async ({ page, context }) => {
    await prepareViewerStorage(context);

    await page.goto(AUTHOR_PATH, { waitUntil: 'load' });
    const descriptionInput = page.locator('#exampleDescription');
    await expect(descriptionInput).toBeVisible();
    await descriptionInput.fill('');
    await descriptionInput.fill(DESCRIPTION_TEXT);

    const previewTask = page.locator('.example-description-preview .math-vis-task');
    await expect(previewTask).toHaveCount(1);

    const previewAnswer = page.locator('.example-description-preview .math-vis-answerbox__input').first();
    await previewAnswer.fill('4');
    const previewWrapper = page.locator('.example-description-preview .math-vis-answerbox').first();
    await expect(previewWrapper).toHaveAttribute('data-state', 'correct');

    const previewMath = page.locator('.example-description-preview .math-vis-description-math, .example-description-preview .katex');
    await expect(previewMath).not.toHaveCount(0);

    const previewTitle = await page.locator('.example-description-preview .math-vis-task__title').textContent();
    const previewTableRows = await page.locator('.example-description-preview table tr').allTextContents();

    const viewerPage = await context.newPage();
    await viewerPage.goto(VIEWER_PATH, { waitUntil: 'networkidle' });

    const viewerTask = viewerPage.locator('.example-description-preview .math-vis-task');
    await expect(viewerTask).toHaveCount(1);

    const viewerMath = viewerPage.locator('.example-description-preview .math-vis-description-math, .example-description-preview .katex');
    await expect(viewerMath).not.toHaveCount(0);

    const viewerTitle = viewerPage.locator('.example-description-preview .math-vis-task__title');
    await expect(viewerTitle).toHaveText(previewTitle || '');

    const viewerTableRows = await viewerPage.locator('.example-description-preview table tr').allTextContents();
    expect(viewerTableRows).toEqual(previewTableRows);

    const viewerAnswer = viewerPage.locator('.example-description-preview .math-vis-answerbox__input').first();
    await viewerAnswer.fill('4');
    const viewerWrapper = viewerPage.locator('.example-description-preview .math-vis-answerbox').first();
    await expect(viewerWrapper).toHaveAttribute('data-state', 'correct');

    // verify that incorrect answer results in same state
    await viewerAnswer.fill('5');
    await expect(viewerWrapper).toHaveAttribute('data-state', 'incorrect');
    await previewAnswer.fill('5');
    await expect(previewWrapper).toHaveAttribute('data-state', 'incorrect');
  });
});
