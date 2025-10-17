const { test, expect } = require('@playwright/test');

function parsePoints(pointsAttr) {
  if (!pointsAttr) return [];
  return pointsAttr.trim().split(/\s+/).map(pair => pair.split(',').map(Number)).filter(pair => pair.length === 2 && pair.every(n => Number.isFinite(n)));
}

function distance(p, q) {
  return Math.hypot(p[0] - q[0], p[1] - q[1]);
}

test.describe('nKant firkant-prefix', () => {
  test('normaliserer firkant med manglende sider', async ({ page }) => {
    await page.goto('/nkant.html', { waitUntil: 'load' });

    const specs = page.locator('#inpSpecs');
    await specs.fill('Firkant: a=2, b=5, A=90, B=90');
    await page.click('#btnDraw');

    const polygonPoints = await page.locator('#paper polygon').evaluateAll(elements => elements.map(el => el.getAttribute('points')));
    const usablePoints = polygonPoints.map(parsePoints).find(points => points.length >= 4);
    expect(usablePoints, 'Fant ingen polygon med minst fire punkter').toBeDefined();
    const [p0, p1, p2, p3] = usablePoints.slice(0, 4);
    const s01 = distance(p0, p1);
    const s12 = distance(p1, p2);
    const s23 = distance(p2, p3);
    const s30 = distance(p3, p0);
    expect(Math.abs(s01 - s23)).toBeLessThan(0.5);
    expect(Math.abs(s12 - s30)).toBeLessThan(0.5);

    await expect.poll(async () => await specs.inputValue()).toContain('c=2');
    await expect.poll(async () => await specs.inputValue()).toContain('d=5');
  });
});
