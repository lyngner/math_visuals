const { test, expect } = require('@playwright/test');

async function blockJsdelivr(page) {
  await page.route('**/*', route => {
    const url = route.request().url();
    if (url.includes('jsdelivr.net')) {
      return route.abort();
    }
    return route.continue();
  });
}

async function expectMathLiveReady(page, { requireExistingField = true } = {}) {
  await expect.poll(async () => {
    return page.evaluate(() => Boolean(customElements.get('math-field')));
  }).toBeTruthy();
  await expect.poll(async () => {
    return page.evaluate(() => typeof window.MathLive?.MathfieldElement === 'function');
  }).toBeTruthy();
  await expect.poll(async () => {
    return page.evaluate(requireExisting => {
      let field = document.querySelector('math-field');
      let added = false;
      if (!requireExisting && !field) {
        field = document.createElement('math-field');
        added = true;
        document.body.appendChild(field);
      }
      const ready = Boolean(field && typeof field.setValue === 'function');
      if (added && field) {
        field.remove();
      }
      return ready;
    }, requireExistingField);
  }).toBeTruthy();
}

test.describe('MathLive offline readiness', () => {
  test('fortegnsskjema loads MathLive assets locally', async ({ page }) => {
    await blockJsdelivr(page);
    await page.goto('/fortegnsskjema.html');
    await expectMathLiveReady(page, { requireExistingField: true });
  });

  test('graftegner loads MathLive assets locally', async ({ page }) => {
    await blockJsdelivr(page);
    await page.goto('/graftegner.html');
    await expectMathLiveReady(page, { requireExistingField: false });
  });
});
