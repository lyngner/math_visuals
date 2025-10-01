const { test, expect } = require('@playwright/test');
const fs = require('fs');
const { PNG } = require('pngjs');

async function collectUniqueColors(png) {
  const unique = new Set();
  const data = png.data;
  for (let i = 0; i < data.length; i += 4) {
    const alpha = data[i + 3];
    if (!alpha) continue;
    const key = `${data[i]},${data[i + 1]},${data[i + 2]},${alpha}`;
    unique.add(key);
    if (unique.size > 32) break;
  }
  return unique;
}

test.describe('Kuler export buttons', () => {
  test('exported SVG and PNG have expected content', async ({ page }, testInfo) => {
    await page.goto('/kuler.html', { waitUntil: 'load' });

    const svgDownloadPromise = page.waitForEvent('download');
    await page.click('#downloadSVG1');
    const svgDownload = await svgDownloadPromise;
    expect(svgDownload.suggestedFilename()).toBe('kuler1.svg');
    const svgPath = testInfo.outputPath('kuler-export.svg');
    await svgDownload.saveAs(svgPath);

    const svgContent = await fs.promises.readFile(svgPath, 'utf-8');
    expect(svgContent).toContain('<svg');
    expect(svgContent).toContain('viewBox="0 0 500 300"');
    expect(svgContent).not.toContain('href="images/');
    expect(svgContent).toMatch(/<image[^>]+href="data:image\/svg\+xml;base64/);

    const pngDownloadPromise = page.waitForEvent('download');
    await page.click('#downloadPNG1');
    const pngDownload = await pngDownloadPromise;
    expect(pngDownload.suggestedFilename()).toBe('kuler1.png');
    const pngPath = testInfo.outputPath('kuler-export.png');
    await pngDownload.saveAs(pngPath);

    const pngBuffer = await fs.promises.readFile(pngPath);
    const png = PNG.sync.read(pngBuffer);
    expect(png.width).toBe(500);
    expect(png.height).toBe(300);
    const colors = await collectUniqueColors(png);
    expect(colors.size).toBeGreaterThan(10);
  });
});
