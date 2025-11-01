const { test, expect } = require('@playwright/test');

const PAGE_PATH = '/måling.html';
const TOOL_SELECT = '#cfg-measurement-tool';

async function ensureTapeTool(page) {
  await page.goto(PAGE_PATH, { waitUntil: 'load' });
  await page.selectOption(TOOL_SELECT, 'tape');
  await page.waitForFunction(() => {
    const tape = document.querySelector('[data-tape-measure]');
    return !!tape && !tape.hasAttribute('hidden');
  });
  await expect(page.locator('[data-tape-housing]')).toBeVisible();
}

async function getTapeMetrics(page) {
  return page.evaluate(() => {
    const tape = document.querySelector('[data-tape-measure]');
    if (!tape) {
      return null;
    }
    const style = window.getComputedStyle(tape);
    const transform = style.transform && style.transform !== 'none' ? style.transform : undefined;
    const matrix = new DOMMatrixReadOnly(transform);
    const visible = parseFloat(style.getPropertyValue('--tape-strap-visible')) || 0;
    return {
      translateX: matrix.m41,
      translateY: matrix.m42,
      visible
    };
  });
}

async function dragLocator(page, locator, delta, options = {}) {
  const steps = options.steps ?? 10;
  await locator.scrollIntoViewIfNeeded();
  const box = await locator.boundingBox();
  if (!box) {
    throw new Error('Element bounding box unavailable');
  }
  const startX = box.x + (options.offsetX ?? box.width / 2);
  const startY = box.y + (options.offsetY ?? box.height / 2);
  await page.mouse.move(startX, startY);
  await page.mouse.down();
  await page.mouse.move(startX + delta.x, startY + delta.y, { steps });
  if (!options.keepDown) {
    await page.mouse.up();
  }
  return { startX, startY };
}

test.describe('måling tape housing interactions', () => {
  test('housing drags hand off to instrument move without changing strap length', async ({ page }) => {
    await ensureTapeTool(page);
    const tape = page.locator('[data-tape-measure]');
    const housing = page.locator('[data-tape-housing]');

    const beforeMetrics = await getTapeMetrics(page);
    const beforeBox = await tape.boundingBox();
    expect(beforeMetrics).not.toBeNull();
    expect(beforeBox).not.toBeNull();

    const dragDelta = { x: 0, y: 160 };
    await dragLocator(page, housing, dragDelta);
    await page.waitForTimeout(50);

    const afterMetrics = await getTapeMetrics(page);
    const afterBox = await tape.boundingBox();
    expect(afterMetrics).not.toBeNull();
    expect(afterBox).not.toBeNull();

    expect(Math.abs(afterMetrics.visible - beforeMetrics.visible)).toBeLessThan(5);
    expect(Math.abs((afterMetrics.translateY - beforeMetrics.translateY) - dragDelta.y)).toBeLessThan(20);
    expect(Math.abs((afterBox.y - beforeBox.y) - dragDelta.y)).toBeLessThan(20);
  });

  test('axial housing drags continue to extend the strap smoothly', async ({ page }) => {
    await ensureTapeTool(page);
    const tape = page.locator('[data-tape-measure]');
    const housing = page.locator('[data-tape-housing]');

    const beforeMetrics = await getTapeMetrics(page);
    const beforeBox = await tape.boundingBox();
    expect(beforeMetrics).not.toBeNull();
    expect(beforeBox).not.toBeNull();

    const dragDelta = { x: 160, y: 0 };
    await dragLocator(page, housing, dragDelta);
    await page.waitForTimeout(50);

    const afterMetrics = await getTapeMetrics(page);
    const afterBox = await tape.boundingBox();
    expect(afterMetrics).not.toBeNull();
    expect(afterBox).not.toBeNull();

    expect(afterMetrics.visible).toBeGreaterThan(beforeMetrics.visible + 40);
    expect((afterMetrics.translateX - beforeMetrics.translateX)).toBeGreaterThan(120);
    expect((afterBox.x - beforeBox.x)).toBeGreaterThan(80);
  });

  test('zero-handle drags still reposition the strap', async ({ page }) => {
    await ensureTapeTool(page);
    const zeroHandle = page.locator('[data-tape-zero-handle]');
    const zeroAnchor = page.locator('[data-tape-zero-anchor]');

    const beforeAnchorBox = await zeroAnchor.boundingBox();
    expect(beforeAnchorBox).not.toBeNull();

    const dragDelta = { x: 120, y: -60 };
    await dragLocator(page, zeroHandle, dragDelta);
    await page.waitForTimeout(50);

    const afterAnchorBox = await zeroAnchor.boundingBox();
    expect(afterAnchorBox).not.toBeNull();

    expect(Math.abs((afterAnchorBox.x - beforeAnchorBox.x) - dragDelta.x)).toBeLessThan(40);
    expect(Math.abs((afterAnchorBox.y - beforeAnchorBox.y) - dragDelta.y)).toBeLessThan(40);
  });
});
