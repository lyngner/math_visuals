const { test, expect } = require('@playwright/test');

test.describe('task mode description preview', () => {
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
    await page.evaluate(exampleData => {
      localStorage.setItem('examples_/diagram', JSON.stringify(exampleData));
    }, htmlExample);
    await page.goto('/diagram/index.html?mode=oppgave', { waitUntil: 'load' });
    const htmlPreview = page.locator('.example-description-preview');
    await expect(htmlPreview).toBeVisible();
    await expect(htmlPreview).toHaveText('Oppgave med fet tekst');
  });
});
