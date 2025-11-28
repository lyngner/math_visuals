const { expect } = require('@playwright/test');

async function openTaskDescriptionEditor(page, options = {}) {
  await page.evaluate(opts => {
    if (window.mathVisuals && typeof window.mathVisuals.startTaskDescriptionEdit === 'function') {
      window.mathVisuals.startTaskDescriptionEdit({
        focus: true,
        setTaskMode: opts.setTaskMode !== false,
        notifyParent: opts.notifyParent,
        preventScroll: opts.preventScroll
      });
    }
  }, options || {});
}

async function fillTaskDescription(page, value, options = {}) {
  await openTaskDescriptionEditor(page, options);
  const input = page.locator('#exampleDescription');
  await expect(input).toBeVisible();
  await input.fill('');
  await input.fill(value || '');
  await input.blur();
  await page.evaluate(() => {
    if (window.mathVisuals && typeof window.mathVisuals.stopTaskDescriptionEdit === 'function') {
      window.mathVisuals.stopTaskDescriptionEdit();
    }
  });
}

module.exports = {
  openTaskDescriptionEditor,
  fillTaskDescription
};
