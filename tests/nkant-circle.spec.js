const { test, expect } = require('@playwright/test');

test.describe('nKant sirkel-kommando', () => {
  test('tegner en sirkel når spesifikasjonen inneholder «sirkel»', async ({ page }) => {
    await page.goto('/nkant.html', { waitUntil: 'load' });

    const specs = page.locator('#inpSpecs');
    await specs.fill('sirkel radius: r');
    await page.click('#btnDraw');

    const circles = page.locator('#paper circle');
    await expect.poll(async () => await circles.count()).toBeGreaterThanOrEqual(3);

    const radii = await circles.evaluateAll(elements => elements.map(el => Number(el.getAttribute('r')) || 0));
    expect(Math.max(...radii)).toBeGreaterThan(100);

    const radiusLabel = page.locator('#paper text', { hasText: 'r' });
    await expect(radiusLabel.first()).toBeVisible();
  });

  test('tegner sirkel uten radiuslinje når ingen radius er spesifisert', async ({ page }) => {
    await page.goto('/nkant.html', { waitUntil: 'load' });

    const specs = page.locator('#inpSpecs');
    await specs.fill('sirkel');
    await page.click('#btnDraw');

    const circles = page.locator('#paper circle');
    await expect.poll(async () => await circles.count()).toBe(2);

    const radiusDot = page.locator('#paper circle[r="6"]');
    await expect(radiusDot).toHaveCount(0);
  });
});
