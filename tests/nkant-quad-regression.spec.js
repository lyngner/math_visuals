const { test, expect } = require('@playwright/test');

test.describe('nKant firkant rettvinkel-resgresjon', () => {
  test('legger til rett vinkel for firkant uten vinkler', async ({ page }) => {
    await page.goto('/nkant.html', { waitUntil: 'load' });

    const specs = page.locator('#inpSpecs');
    await specs.fill('a=1, b=2, c=4, d=3');
    await page.click('#btnDraw');

    await expect.poll(async () => await page.locator('#paper polygon').count()).toBeGreaterThan(0);
    await expect(page.locator('#paper text', { hasText: 'angi vinkel' })).toHaveCount(0);
    await expect(specs).toHaveValue('a=1, b=2, c=4, d=3, A=90');
  });

  test('fungerer også med firkant-prefiks', async ({ page }) => {
    await page.goto('/nkant.html', { waitUntil: 'load' });

    const specs = page.locator('#inpSpecs');
    await specs.fill('Firkant: a=1, b=2, c=4, d=3');
    await page.click('#btnDraw');

    await expect.poll(async () => await page.locator('#paper polygon').count()).toBeGreaterThan(0);
    await expect(page.locator('#paper text', { hasText: 'angi vinkel' })).toHaveCount(0);
    await expect(specs).toHaveValue('a=1, b=2, c=4, d=3, A=90');
  });
});
