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

function getBoxCenter(box) {
  return {
    x: box.x + box.width / 2,
    y: box.y + box.height / 2
  };
}

function getUnitVector(from, to) {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const length = Math.hypot(dx, dy);
  if (!Number.isFinite(length) || length < 1e-6) {
    return { x: 1, y: 0 };
  }
  return { x: dx / length, y: dy / length };
}

test.describe('måling tape housing interactions', () => {
  test('zero-handle drags stretch the strap while housing stays fixed without lock', async ({ page }) => {
    await ensureTapeTool(page);
    await page.selectOption('#cfg-measurement-direction-lock', 'none');
    await page.waitForTimeout(20);

    const zeroHandle = page.locator('[data-tape-zero-handle]');
    const zeroAnchor = page.locator('[data-tape-zero-anchor]');
    const housing = page.locator('[data-tape-housing]');

    const beforeZeroBox = await zeroAnchor.boundingBox();
    const beforeHousingBox = await housing.boundingBox();
    const beforeMetrics = await getTapeMetrics(page);
    expect(beforeZeroBox).not.toBeNull();
    expect(beforeHousingBox).not.toBeNull();
    expect(beforeMetrics).not.toBeNull();

    const zeroCenterBefore = getBoxCenter(beforeZeroBox);
    const housingCenterBefore = getBoxCenter(beforeHousingBox);
    const directionHousingToZero = getUnitVector(housingCenterBefore, zeroCenterBefore);
    const dragDelta = {
      x: directionHousingToZero.x * 220,
      y: directionHousingToZero.y * 220
    };

    await dragLocator(page, zeroHandle, dragDelta);
    await page.waitForTimeout(50);

    const afterZeroBox = await zeroAnchor.boundingBox();
    const afterHousingBox = await housing.boundingBox();
    const afterMetrics = await getTapeMetrics(page);
    expect(afterZeroBox).not.toBeNull();
    expect(afterHousingBox).not.toBeNull();
    expect(afterMetrics).not.toBeNull();

    const zeroCenterAfter = getBoxCenter(afterZeroBox);
    const housingCenterAfter = getBoxCenter(afterHousingBox);

    expect(afterMetrics.visible).toBeGreaterThan(beforeMetrics.visible + 40);
    expect(Math.abs(housingCenterAfter.x - housingCenterBefore.x)).toBeLessThan(30);
    expect(Math.abs(housingCenterAfter.y - housingCenterBefore.y)).toBeLessThan(30);
    expect(Math.abs(zeroCenterAfter.x - zeroCenterBefore.x)).toBeGreaterThan(120);
  });

  test('housing stays fixed when extending from a fully retracted strap', async ({ page }) => {
    await ensureTapeTool(page);
    await page.selectOption('#cfg-measurement-direction-lock', 'none');
    await page.waitForTimeout(20);

    const zeroHandle = page.locator('[data-tape-zero-handle]');
    const zeroAnchor = page.locator('[data-tape-zero-anchor]');
    const housing = page.locator('[data-tape-housing]');

    const initialZeroBox = await zeroAnchor.boundingBox();
    const initialHousingBox = await housing.boundingBox();
    expect(initialZeroBox).not.toBeNull();
    expect(initialHousingBox).not.toBeNull();

    const initialZeroCenter = getBoxCenter(initialZeroBox);
    const initialHousingCenter = getBoxCenter(initialHousingBox);
    const directionHousingToZero = getUnitVector(initialHousingCenter, initialZeroCenter);

    const retractDelta = {
      x: -directionHousingToZero.x * 260,
      y: -directionHousingToZero.y * 260
    };
    await dragLocator(page, zeroHandle, retractDelta);
    await page.waitForTimeout(50);

    const retractedZeroBox = await zeroAnchor.boundingBox();
    const retractedHousingBox = await housing.boundingBox();
    expect(retractedZeroBox).not.toBeNull();
    expect(retractedHousingBox).not.toBeNull();

    const retractedZeroCenter = getBoxCenter(retractedZeroBox);
    const retractedHousingCenter = getBoxCenter(retractedHousingBox);
    const retractedDistance = Math.hypot(
      retractedZeroCenter.x - retractedHousingCenter.x,
      retractedZeroCenter.y - retractedHousingCenter.y
    );
    expect(retractedDistance).toBeLessThan(24);

    const retractedMetrics = await getTapeMetrics(page);
    expect(retractedMetrics).not.toBeNull();

    const extendDelta = {
      x: directionHousingToZero.x * 220,
      y: directionHousingToZero.y * 220
    };
    await dragLocator(page, zeroHandle, extendDelta);
    await page.waitForTimeout(50);

    const afterZeroBox = await zeroAnchor.boundingBox();
    const afterHousingBox = await housing.boundingBox();
    const afterMetrics = await getTapeMetrics(page);
    expect(afterZeroBox).not.toBeNull();
    expect(afterHousingBox).not.toBeNull();
    expect(afterMetrics).not.toBeNull();

    const afterZeroCenter = getBoxCenter(afterZeroBox);
    const afterHousingCenter = getBoxCenter(afterHousingBox);

    expect(afterMetrics.visible).toBeGreaterThan(retractedMetrics.visible + 40);
    expect(Math.abs(afterZeroCenter.x - retractedZeroCenter.x)).toBeGreaterThan(120);
    expect(Math.abs(afterZeroCenter.y - retractedZeroCenter.y)).toBeLessThan(40);
    expect(Math.abs(afterHousingCenter.x - retractedHousingCenter.x)).toBeLessThan(6);
    expect(Math.abs(afterHousingCenter.y - retractedHousingCenter.y)).toBeLessThan(6);
  });

  test('housing drags stretch the strap while zero stays fixed without lock', async ({ page }) => {
    await ensureTapeTool(page);
    await page.selectOption('#cfg-measurement-direction-lock', 'none');
    await page.waitForTimeout(20);

    const housing = page.locator('[data-tape-housing]');
    const zeroAnchor = page.locator('[data-tape-zero-anchor]');

    const beforeHousingBox = await housing.boundingBox();
    const beforeZeroBox = await zeroAnchor.boundingBox();
    const beforeMetrics = await getTapeMetrics(page);
    expect(beforeHousingBox).not.toBeNull();
    expect(beforeZeroBox).not.toBeNull();
    expect(beforeMetrics).not.toBeNull();

    const housingCenterBefore = getBoxCenter(beforeHousingBox);
    const zeroCenterBefore = getBoxCenter(beforeZeroBox);
    const directionZeroToHousing = getUnitVector(zeroCenterBefore, housingCenterBefore);
    const dragDelta = {
      x: directionZeroToHousing.x * 220,
      y: directionZeroToHousing.y * 220
    };

    await dragLocator(page, housing, dragDelta);
    await page.waitForTimeout(50);

    const afterHousingBox = await housing.boundingBox();
    const afterZeroBox = await zeroAnchor.boundingBox();
    const afterMetrics = await getTapeMetrics(page);
    expect(afterHousingBox).not.toBeNull();
    expect(afterZeroBox).not.toBeNull();
    expect(afterMetrics).not.toBeNull();

    const housingCenterAfter = getBoxCenter(afterHousingBox);
    const zeroCenterAfter = getBoxCenter(afterZeroBox);

    expect(afterMetrics.visible).toBeGreaterThan(beforeMetrics.visible + 40);
    expect(Math.abs(zeroCenterAfter.x - zeroCenterBefore.x)).toBeLessThan(30);
    expect(Math.abs(zeroCenterAfter.y - zeroCenterBefore.y)).toBeLessThan(30);
    expect(Math.abs(housingCenterAfter.x - housingCenterBefore.x)).toBeGreaterThan(120);
  });

  test('center grip drags translate the tape without stretching it', async ({ page }) => {
    await ensureTapeTool(page);
    await page.selectOption('#cfg-measurement-direction-lock', 'none');
    await page.waitForTimeout(20);

    const moveHandle = page.locator('[data-tape-move-handle]');
    const zeroAnchor = page.locator('[data-tape-zero-anchor]');
    const housing = page.locator('[data-tape-housing]');

    const beforeZeroBox = await zeroAnchor.boundingBox();
    const beforeHousingBox = await housing.boundingBox();
    const beforeMetrics = await getTapeMetrics(page);
    expect(beforeZeroBox).not.toBeNull();
    expect(beforeHousingBox).not.toBeNull();
    expect(beforeMetrics).not.toBeNull();

    const zeroCenterBefore = getBoxCenter(beforeZeroBox);
    const housingCenterBefore = getBoxCenter(beforeHousingBox);
    const dragDelta = { x: 140, y: -80 };

    await dragLocator(page, moveHandle, dragDelta);
    await page.waitForTimeout(50);

    const afterZeroBox = await zeroAnchor.boundingBox();
    const afterHousingBox = await housing.boundingBox();
    const afterMetrics = await getTapeMetrics(page);
    expect(afterZeroBox).not.toBeNull();
    expect(afterHousingBox).not.toBeNull();
    expect(afterMetrics).not.toBeNull();

    const zeroCenterAfter = getBoxCenter(afterZeroBox);
    const housingCenterAfter = getBoxCenter(afterHousingBox);
    const zeroShift = {
      x: zeroCenterAfter.x - zeroCenterBefore.x,
      y: zeroCenterAfter.y - zeroCenterBefore.y
    };
    const housingShift = {
      x: housingCenterAfter.x - housingCenterBefore.x,
      y: housingCenterAfter.y - housingCenterBefore.y
    };

    expect(Math.abs(zeroShift.x - dragDelta.x)).toBeLessThan(40);
    expect(Math.abs(zeroShift.y - dragDelta.y)).toBeLessThan(40);
    expect(Math.abs(housingShift.x - dragDelta.x)).toBeLessThan(40);
    expect(Math.abs(housingShift.y - dragDelta.y)).toBeLessThan(40);
    expect(Math.abs(zeroShift.x - housingShift.x)).toBeLessThan(20);
    expect(Math.abs(zeroShift.y - housingShift.y)).toBeLessThan(20);
    expect(Math.abs(afterMetrics.visible - beforeMetrics.visible)).toBeLessThan(10);
  });

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

  test('zero-handle drags respect horizontal lock without moving housing', async ({ page }) => {
    await ensureTapeTool(page);
    await page.selectOption('#cfg-measurement-direction-lock', 'horizontal');
    await page.waitForTimeout(50);

    const zeroHandle = page.locator('[data-tape-zero-handle]');

    const beforeMetrics = await getTapeMetrics(page);
    expect(beforeMetrics).not.toBeNull();

    const dragDelta = { x: 220, y: 0 };
    await dragLocator(page, zeroHandle, dragDelta);
    await page.waitForTimeout(50);

    const afterMetrics = await getTapeMetrics(page);
    expect(afterMetrics).not.toBeNull();

    expect(afterMetrics.visible).toBeGreaterThan(beforeMetrics.visible + 40);
    expect(Math.abs(afterMetrics.translateX - beforeMetrics.translateX)).toBeLessThan(10);
    expect(Math.abs(afterMetrics.translateY - beforeMetrics.translateY)).toBeLessThan(10);
  });

  test('direction lock anchors the opposite endpoint during handle drags', async ({ page }) => {
    await ensureTapeTool(page);
    await page.selectOption('#cfg-measurement-direction-lock', 'horizontal');
    await page.waitForTimeout(50);

    const zeroHandle = page.locator('[data-tape-zero-handle]');
    const zeroAnchor = page.locator('[data-tape-zero-anchor]');
    const housing = page.locator('[data-tape-housing]');

    const initialZeroBox = await zeroAnchor.boundingBox();
    const initialHousingBox = await housing.boundingBox();
    expect(initialZeroBox).not.toBeNull();
    expect(initialHousingBox).not.toBeNull();

    const initialZeroCenter = getBoxCenter(initialZeroBox);
    const initialHousingCenter = getBoxCenter(initialHousingBox);
    const initialMetrics = await getTapeMetrics(page);
    expect(initialMetrics).not.toBeNull();

    const zeroDrag = { x: 200, y: 120 };
    await dragLocator(page, zeroHandle, zeroDrag);
    await page.waitForTimeout(50);

    const afterZeroZeroBox = await zeroAnchor.boundingBox();
    const afterZeroHousingBox = await housing.boundingBox();
    const afterZeroMetrics = await getTapeMetrics(page);
    expect(afterZeroZeroBox).not.toBeNull();
    expect(afterZeroHousingBox).not.toBeNull();
    expect(afterZeroMetrics).not.toBeNull();

    const afterZeroZeroCenter = getBoxCenter(afterZeroZeroBox);
    const afterZeroHousingCenter = getBoxCenter(afterZeroHousingBox);

    expect(Math.abs(afterZeroZeroCenter.x - initialZeroCenter.x)).toBeGreaterThan(120);
    expect(Math.abs(afterZeroZeroCenter.y - initialZeroCenter.y)).toBeLessThan(20);
    expect(Math.abs(afterZeroHousingCenter.x - initialHousingCenter.x)).toBeLessThan(8);
    expect(Math.abs(afterZeroHousingCenter.y - initialHousingCenter.y)).toBeLessThan(8);
    expect(afterZeroMetrics.visible).toBeGreaterThan(initialMetrics.visible + 40);

    const housingDrag = { x: -180, y: 0 };
    const zeroCenterBeforeHousing = afterZeroZeroCenter;
    const housingCenterBeforeHousing = afterZeroHousingCenter;
    const metricsBeforeHousing = afterZeroMetrics;

    await dragLocator(page, housing, housingDrag);
    await page.waitForTimeout(50);

    const afterHousingZeroBox = await zeroAnchor.boundingBox();
    const afterHousingHousingBox = await housing.boundingBox();
    const afterHousingMetrics = await getTapeMetrics(page);
    expect(afterHousingZeroBox).not.toBeNull();
    expect(afterHousingHousingBox).not.toBeNull();
    expect(afterHousingMetrics).not.toBeNull();

    const afterHousingZeroCenter = getBoxCenter(afterHousingZeroBox);
    const afterHousingHousingCenter = getBoxCenter(afterHousingHousingBox);

    expect(Math.abs(afterHousingZeroCenter.x - zeroCenterBeforeHousing.x)).toBeLessThan(8);
    expect(Math.abs(afterHousingZeroCenter.y - zeroCenterBeforeHousing.y)).toBeLessThan(8);
    expect(Math.abs((afterHousingHousingCenter.x - housingCenterBeforeHousing.x) - housingDrag.x)).toBeLessThan(40);
    expect(Math.abs(afterHousingHousingCenter.y - housingCenterBeforeHousing.y)).toBeLessThan(20);
    expect(Math.abs((afterHousingMetrics.translateX - metricsBeforeHousing.translateX) - housingDrag.x)).toBeLessThan(60);
  });
});
