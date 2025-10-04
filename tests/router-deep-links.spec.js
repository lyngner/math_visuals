const { test, expect } = require('@playwright/test');

const FORTEGN_NAV_SELECTOR = 'nav a[href="fortegnsskjema.html"]';
const IFRAME_SELECTOR = 'iframe[name="content"]';

test.describe('deep links', () => {
  test('direct visit to fortegnsskjema route loads the app', async ({ page }) => {
    await page.goto('/fortegnsskjema-under-utvikling');
    await expect(page.locator(IFRAME_SELECTOR)).toHaveAttribute('src', /fortegnsskjema\.html/);
    await expect(page.locator(FORTEGN_NAV_SELECTOR)).toHaveAttribute('aria-current', 'page');
  });

  test('deep link with example segment keeps the example selection', async ({ page }) => {
    await page.goto('/fortegnsskjema-under-utvikling/eksempel2');
    await expect(page.locator(IFRAME_SELECTOR)).toHaveAttribute('src', /fortegnsskjema\.html\?example=2/);
    await expect(page.locator(FORTEGN_NAV_SELECTOR)).toHaveAttribute('aria-current', 'page');
  });
});
