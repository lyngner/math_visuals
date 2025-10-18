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

    const uploadRequests = [];
    await page.route('**/api/svg', async route => {
      const request = route.request();
      try {
        uploadRequests.push(await request.postDataJSON());
      } catch (err) {
        uploadRequests.push(null);
      }
      await route.fulfill({ status: 200, body: '{}' });
    });
    page.on('dialog', dialog => dialog.accept());

    const firstDownloadPromise = page.waitForEvent('download');
    const secondDownloadPromise = page.waitForEvent('download');
    await page.click('#downloadSVG1');
    const [firstDownload, secondDownload] = await Promise.all([
      firstDownloadPromise,
      secondDownloadPromise
    ]);

    const downloads = [firstDownload, secondDownload];
    const svgDownload = downloads.find(download => download.suggestedFilename().endsWith('.svg'));
    const pngDownload = downloads.find(download => download.suggestedFilename().endsWith('.png'));
    expect(svgDownload).toBeTruthy();
    expect(pngDownload).toBeTruthy();
    expect(svgDownload && svgDownload.suggestedFilename()).toBe('kuler1.svg');
    expect(pngDownload && pngDownload.suggestedFilename()).toBe('kuler1.png');

    const svgPath = testInfo.outputPath('kuler-export.svg');
    await svgDownload.saveAs(svgPath);

    const svgContent = await fs.promises.readFile(svgPath, 'utf-8');
    expect(svgContent).toContain('<svg');
    expect(svgContent).toContain('viewBox="0 0 500 300"');
    expect(svgContent).not.toContain('href="images/');
    expect(svgContent).toMatch(/<image[^>]+href="data:image\/svg\+xml;base64/);
    const pngPath = testInfo.outputPath('kuler-export.png');
    await pngDownload.saveAs(pngPath);

    const pngBuffer = await fs.promises.readFile(pngPath);
    const png = PNG.sync.read(pngBuffer);
    expect(png.width).toBe(500);
    expect(png.height).toBe(300);
    const colors = await collectUniqueColors(png);
    expect(colors.size).toBeGreaterThan(10);

    expect(uploadRequests.length).toBeGreaterThan(0);
    const uploads = uploadRequests.filter(Boolean);
    expect(uploads.length).toBeGreaterThan(0);
    const lastUpload = uploads[uploads.length - 1];
    expect(lastUpload).toBeTruthy();
    expect(lastUpload.filename).toBe('kuler1.svg');
    expect(lastUpload.baseName).toBe('kuler1');
    expect(lastUpload.tool).toBe('kuler');
    expect(lastUpload.toolId).toBe('kuler');
    expect(lastUpload.slug).toBe('bildearkiv/kuler1');
    expect(typeof lastUpload.svg).toBe('string');
    expect(lastUpload.svg).toContain('<svg');
    expect(typeof lastUpload.png).toBe('string');
    expect(lastUpload.png).toMatch(/^data:image\/png;base64,/);
  });
});
