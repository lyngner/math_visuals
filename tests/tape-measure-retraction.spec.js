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
    const visible = parseFloat(style.getPropertyValue('--tape-strap-visible')) || 0;
    const dataVisible = tape.hasAttribute('data-visible-length')
      ? Number.parseFloat(tape.getAttribute('data-visible-length'))
      : null;
    return {
      visible,
      dataVisible
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

async function resolveHousingToZeroDirection(page) {
  const zeroAnchor = page.locator('[data-tape-zero-anchor]');
  const housing = page.locator('[data-tape-housing]');
  const zeroBox = await zeroAnchor.boundingBox();
  const housingBox = await housing.boundingBox();
  if (zeroBox && housingBox) {
    return getUnitVector(getBoxCenter(housingBox), getBoxCenter(zeroBox));
  }
  return page.evaluate(() => {
    const tape = document.querySelector('[data-tape-measure]');
    if (!tape) {
      return { x: 1, y: 0 };
    }
    const computed = window.getComputedStyle(tape);
    const transform = computed.transform && computed.transform !== 'none' ? computed.transform : undefined;
    const matrix = new DOMMatrixReadOnly(transform);
    const angle = Math.atan2(matrix.m21, matrix.m11);
    return { x: Math.cos(angle), y: Math.sin(angle) };
  });
}

test.describe('måling tape strap retraction when crossing housing', () => {
  const scenarios = [
    { handle: 'zero', selector: '[data-tape-zero-handle]' },
    { handle: 'housing', selector: '[data-tape-housing-shift-handle]' }
  ];

  for (const scenario of scenarios) {
    test(`${scenario.handle} handle crossing clamps strap length`, async ({ page }) => {
      await ensureTapeTool(page);
      await page.selectOption('#cfg-measurement-direction-lock', 'none');
      await page.waitForTimeout(20);

      const handleLocator = page.locator(scenario.selector);
      await expect(handleLocator).toBeVisible();

      const initialMetrics = await getTapeMetrics(page);
      expect(initialMetrics).not.toBeNull();

      const initialDirection = await resolveHousingToZeroDirection(page);
      const extendDistance = 240;
      const extendDelta =
        scenario.handle === 'zero'
          ? { x: initialDirection.x * extendDistance, y: initialDirection.y * extendDistance }
          : { x: -initialDirection.x * extendDistance, y: -initialDirection.y * extendDistance };
      await dragLocator(page, handleLocator, extendDelta);
      await page.waitForTimeout(60);

      const extendedMetrics = await getTapeMetrics(page);
      expect(extendedMetrics).not.toBeNull();
      expect(extendedMetrics.visible).toBeGreaterThan(initialMetrics.visible + 40);

      const updatedDirection = await resolveHousingToZeroDirection(page);
      const retractDistance = 420;
      const retractDelta =
        scenario.handle === 'zero'
          ? { x: -updatedDirection.x * retractDistance, y: -updatedDirection.y * retractDistance }
          : { x: updatedDirection.x * retractDistance, y: updatedDirection.y * retractDistance };
      await dragLocator(page, handleLocator, retractDelta);
      await page.waitForTimeout(80);

      const retractedMetrics = await getTapeMetrics(page);
      expect(retractedMetrics).not.toBeNull();

      expect(retractedMetrics.visible).toBeLessThan(extendedMetrics.visible - 40);
      expect(Math.abs(retractedMetrics.visible - initialMetrics.visible)).toBeLessThan(8);

      if (
        initialMetrics.dataVisible != null &&
        extendedMetrics.dataVisible != null &&
        retractedMetrics.dataVisible != null
      ) {
        expect(extendedMetrics.dataVisible).toBeGreaterThan(initialMetrics.dataVisible);
        expect(retractedMetrics.dataVisible).toBeLessThanOrEqual(initialMetrics.dataVisible + 0.2);
      }
    });
  }
});

