const { test, expect } = require('@playwright/test');

async function waitForAltText(page) {
  const textarea = page.locator('#altText');
  await expect(textarea).not.toHaveValue('', { timeout: 10000 });
  return textarea;
}

test.describe('Alt-tekstoppdateringer', () => {
  test('perlesnor genererer automatisk alt-tekst når figuren endres', async ({ page }) => {
    await page.goto('/perlesnor.html', { waitUntil: 'load' });

    const textarea = await waitForAltText(page);
    const initial = await textarea.inputValue();

    const beadsInput = page.locator('#cfg-nBeads');
    await beadsInput.fill('14');
    await beadsInput.evaluate(el => el.dispatchEvent(new Event('change', { bubbles: true })));

    await expect(textarea).not.toHaveValue(initial, { timeout: 10000 });
    await expect(textarea).toContainText('14 perler', { timeout: 10000 });
  });

  test('perlesnor markerer manuell alt-tekst som utdatert og lar brukeren regenerere', async ({ page }) => {
    await page.goto('/perlesnor.html', { waitUntil: 'load' });

    const textarea = await waitForAltText(page);
    await textarea.fill('Manuell testtekst');

    const beadsInput = page.locator('#cfg-nBeads');
    await beadsInput.fill('7');
    await beadsInput.evaluate(el => el.dispatchEvent(new Event('change', { bubbles: true })));

    const status = page.locator('#altTextStatus');
    await expect(status).toContainText('utdatert', { timeout: 10000 });
    await expect(textarea).toHaveValue('Manuell testtekst');

    const regenerateButton = status.getByRole('button', { name: 'Generer automatisk' });
    await expect(regenerateButton).toBeVisible();
    await regenerateButton.click();

    await expect(textarea).not.toHaveValue('Manuell testtekst', { timeout: 10000 });
    await expect(status).not.toContainText('utdatert', { timeout: 10000 });
  });
});
