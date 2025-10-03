const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');

const projectRoot = path.resolve(__dirname, '..');
const htmlFiles = fs
  .readdirSync(projectRoot)
  .filter((file) => file.endsWith('.html'))
  .sort();

test.describe('Styling consistency across visualizations', () => {
  for (const file of htmlFiles) {
    test(`${file} should share the base styling`, async ({ page }) => {
      await page.goto(`/${file}`, { waitUntil: 'domcontentloaded' });

      const styles = await page.evaluate(() => {
        const rootStyle = getComputedStyle(document.documentElement);
        const bodyStyle = getComputedStyle(document.body);

        const probeButton = document.createElement('button');
        probeButton.className = 'btn';
        document.body.appendChild(probeButton);
        const buttonStyle = getComputedStyle(probeButton);

        const stylesSnapshot = {
          root: {
            surfaceBg: rootStyle.getPropertyValue('--surface-bg').trim(),
            textColor: rootStyle.getPropertyValue('--text-color').trim(),
            controlRadius: rootStyle.getPropertyValue('--control-radius').trim()
          },
          body: {
            background: bodyStyle.backgroundColor,
            color: bodyStyle.color,
            fontFamily: bodyStyle.fontFamily,
            padding: bodyStyle.padding
          },
          button: {
            borderRadius: buttonStyle.borderRadius,
            background: buttonStyle.backgroundColor,
            color: buttonStyle.color,
            fontFamily: buttonStyle.fontFamily
          }
        };

        probeButton.remove();

        return stylesSnapshot;
      });

      expect.soft(styles.root.surfaceBg).toBe('#f7f8fb');
      expect.soft(styles.root.textColor).toBe('#111827');
      expect.soft(styles.root.controlRadius).toBe('10px');

      expect.soft(styles.body.background).toBe('rgb(247, 248, 251)');
      expect.soft(styles.body.color).toBe('rgb(17, 24, 39)');
      expect.soft(styles.body.padding).toBe('20px');
      expect.soft(styles.body.fontFamily.toLowerCase()).toContain('system-ui');

      expect.soft(styles.button.borderRadius).toBe('10px');
      expect.soft(styles.button.background).toBe('rgb(255, 255, 255)');
      expect.soft(styles.button.color).toBe('rgb(17, 24, 39)');
      expect.soft(styles.button.fontFamily.toLowerCase()).toContain('system-ui');
    });
  }
});
