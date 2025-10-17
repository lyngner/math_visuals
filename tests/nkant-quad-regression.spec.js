const { test, expect } = require('@playwright/test');

test.describe('nKant firkant rettvinkel-resgresjon', () => {
  test('legger til rett vinkel for firkant uten vinkler', async ({ page }) => {
    await page.goto('/nkant.html', { waitUntil: 'load' });

    const specs = page.locator('#inpSpecs');
    await specs.fill('a=1, b=2, c=4, d=3');
    await page.click('#btnDraw');

    await expect.poll(async () => await page.locator('#paper polygon').count()).toBeGreaterThan(0);
    await expect(page.locator('#paper text', { hasText: 'angi vinkel' })).toHaveCount(0);
    const expectedNormalizedSpec = 'a=1, b=2, c=4, d=3, A=90';
    await expect(specs).toHaveValue(expectedNormalizedSpec);
  });

  test('fungerer også med firkant-prefiks', async ({ page }) => {
    await page.goto('/nkant.html', { waitUntil: 'load' });

    const specs = page.locator('#inpSpecs');
    await specs.fill('Firkant: a=1, b=2, c=4, d=3');
    await page.click('#btnDraw');

    await expect.poll(async () => await page.locator('#paper polygon').count()).toBeGreaterThan(0);
    await expect(page.locator('#paper text', { hasText: 'angi vinkel' })).toHaveCount(0);
    await expect(specs).toHaveValue('Firkant a=1, b=2, c=4, d=3, A=90');
  });

  test('normaliserer firkant med dupliserte sider og tegner rektangel', async ({ page }) => {
    await page.goto('/nkant.html', { waitUntil: 'load' });

    const specs = page.locator('#inpSpecs');
    await specs.fill('Firkant a=3, b=5');
    await page.click('#btnDraw');

    await expect.poll(async () => await page.locator('#paper polygon').count()).toBeGreaterThan(1);
    await expect(specs).toHaveValue('Firkant a=3, b=5, c=3, d=5, A=90');

    const polygonStats = await page.locator('#paper polygon').nth(1).evaluate(node => {
      const attr = node.getAttribute('points') || '';
      const coords = attr.trim().split(/\s+/).map(pair => pair.split(',').map(Number)).filter(pair => pair.length === 2);
      const round = value => Math.round(value);
      const unique = values => Array.from(new Set(values.map(round))).length;
      return {
        uniqueXs: unique(coords.map(([x]) => x)),
        uniqueYs: unique(coords.map(([, y]) => y))
      };
    });
    expect(polygonStats.uniqueXs).toBe(2);
    expect(polygonStats.uniqueYs).toBe(2);
  });
});
