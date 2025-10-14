const { test, expect } = require('@playwright/test');

const { attachExamplesBackendMock } = require('./helpers/examples-backend-mock');

test.describe('task mode description preview', () => {
  let backend;

  test.beforeEach(async ({ page }) => {
    backend = await attachExamplesBackendMock(page.context());
  });

  test('hides preview until formatting is used', async ({ page }) => {
    await page.goto('/diagram/index.html', { waitUntil: 'load' });
    const input = page.locator('#exampleDescription');
    const preview = page.locator('.example-description-preview');

    await input.fill('');
    await expect(preview).toBeHidden();

    await input.fill('Vanlig tekst uten formatering');
    await expect(preview).toBeHidden();

    await input.fill('Vis @math{1 + 1} i teksten');
    await expect(preview).toBeVisible();
  });

  test('shows description text when switching to task mode', async ({ page }) => {
    await page.goto('/diagram/index.html', { waitUntil: 'load' });
    const description = 'Dette er en testoppgave';
    await page.fill('#exampleDescription', description);
    await page.evaluate(() => window.mathVisuals.setAppMode('task', { force: true }));
    const preview = page.locator('.example-description-preview');
    await expect(preview).toBeVisible();
    await expect(preview).toHaveText(description);

    const cfg = await page.evaluate(() => window.CFG);
    const htmlExample = [{
      descriptionHtml: '<p>Oppgave med <strong>fet</strong> tekst</p>',
      exampleNumber: '1',
      isDefault: true,
      config: { CFG: cfg }
    }];
    await backend.client.put('/diagram', { examples: htmlExample, deletedProvided: [] });
    await page.goto('/diagram/index.html?mode=oppgave', { waitUntil: 'load' });
    const htmlPreview = page.locator('.example-description-preview');
    await expect(htmlPreview).toBeVisible();
    await expect(htmlPreview).toHaveText('Oppgave med fet tekst');
  });

  test('renders math markup without exposing raw tokens in task mode', async ({ page }) => {
    await page.goto('/diagram/index.html', { waitUntil: 'load' });
    const description = 'Flytt punktene slik at linja gir @math{y=ax+b}.';
    await page.fill('#exampleDescription', description);
    await page.evaluate(() => window.mathVisuals.setAppMode('task', { force: true }));
    const preview = page.locator('.example-description-preview');
    await expect(preview).toBeVisible();
    await expect(preview).not.toContainText('@math');
    await expect(preview).toContainText(/y\s*=\s*ax\s*\+\s*b/);
  });

  test('renders KaTeX math and answer inputs in task mode', async ({ page }) => {
    await page.goto('/diagram/index.html', { waitUntil: 'load' });
    const description = 'Regn ut @math{\\tfrac{1}{2}} + @input[answer="7/12"|size="3"]';
    await page.fill('#exampleDescription', description);
    await page.evaluate(() => window.mathVisuals.setAppMode('task', { force: true }));

    const preview = page.locator('.example-description-preview');
    await expect(preview).toBeVisible();
    await expect(preview.locator('.math-vis-description-math .katex')).toHaveCount(1);

    const inputField = preview.locator('.math-vis-answerbox__input');
    await expect(inputField).toHaveCount(1);
    await expect(inputField).toHaveAttribute('size', '3');
  });
});
