import { expect, Locator, Page, test } from '@playwright/test';

const PAGE_PATH = '/måling.html';
const TOOL_SELECT = '#cfg-measurement-tool';
const DIRECTION_LOCK_SELECT = '#cfg-measurement-direction-lock';

type Vector = { x: number; y: number };

type TapeMetrics = {
  visible: number;
  dataVisible: number | null;
};

async function ensureTapeTool(page: Page): Promise<void> {
  await page.goto(PAGE_PATH, { waitUntil: 'load' });
  await page.selectOption(TOOL_SELECT, 'tape');
  await page.waitForFunction(() => {
    const tape = document.querySelector('[data-tape-measure]');
    return !!tape && !tape.hasAttribute('hidden');
  });
  await expect(page.locator('[data-tape-housing]')).toBeVisible();
}

async function getTapeMetrics(page: Page): Promise<TapeMetrics | null> {
  return page.evaluate(() => {
    const tape = document.querySelector('[data-tape-measure]');
    if (!tape) {
      return null;
    }
    const style = window.getComputedStyle(tape);
    const visible = parseFloat(style.getPropertyValue('--tape-strap-visible')) || 0;
    const rawDataVisible = tape.hasAttribute('data-visible-length')
      ? Number.parseFloat(tape.getAttribute('data-visible-length') || '')
      : NaN;
    return {
      visible,
      dataVisible: Number.isFinite(rawDataVisible) ? rawDataVisible : null
    };
  });
}

async function dragLocator(
  page: Page,
  locator: Locator,
  delta: Vector,
  options: { steps?: number; offsetX?: number; offsetY?: number } = {}
): Promise<void> {
  const steps = options.steps ?? 12;
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
  await page.mouse.up();
}

function getBoxCenter(box: { x: number; y: number; width: number; height: number }): Vector {
  return {
    x: box.x + box.width / 2,
    y: box.y + box.height / 2
  };
}

function normalize(from: Vector, to: Vector): Vector {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const length = Math.hypot(dx, dy);
  if (!Number.isFinite(length) || length < 1e-6) {
    return { x: 1, y: 0 };
  }
  return { x: dx / length, y: dy / length };
}

async function resolveHousingToZeroDirection(page: Page): Promise<Vector> {
  const zeroAnchor = page.locator('[data-tape-zero-anchor]');
  const housing = page.locator('[data-tape-housing]');
  const zeroBox = await zeroAnchor.boundingBox();
  const housingBox = await housing.boundingBox();
  if (zeroBox && housingBox) {
    return normalize(getBoxCenter(housingBox), getBoxCenter(zeroBox));
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

function dot(a: Vector, b: Vector): number {
  return a.x * b.x + a.y * b.y;
}

test.describe('måling tape measure endpoint stability', () => {
  const scenarios: Array<{ name: string; selector: string; retractMultiplier: number }> = [
    { name: 'zero handle', selector: '[data-tape-zero-handle]', retractMultiplier: -1 },
    { name: 'housing shift handle', selector: '[data-tape-housing-shift-handle]', retractMultiplier: 1 }
  ];

  for (const scenario of scenarios) {
    test(`dragging ${scenario.name} shortens strap without zero jumping right`, async ({ page }) => {
      await ensureTapeTool(page);
      await page.selectOption(DIRECTION_LOCK_SELECT, 'none');
      await page.waitForTimeout(20);

      const zeroHandle = page.locator('[data-tape-zero-handle]');
      await expect(zeroHandle).toBeVisible();

      const initialDirection = await resolveHousingToZeroDirection(page);
      const extendDistance = 160;
      await dragLocator(page, zeroHandle, {
        x: initialDirection.x * extendDistance,
        y: initialDirection.y * extendDistance
      });
      await page.waitForTimeout(80);

      const metricsBefore = await getTapeMetrics(page);
      expect(metricsBefore).not.toBeNull();
      if (!metricsBefore) {
        return;
      }
      expect(metricsBefore.visible).toBeGreaterThan(40);

      const retractDirection = await resolveHousingToZeroDirection(page);
      const zeroBox = await zeroHandle.boundingBox();
      expect(zeroBox).not.toBeNull();
      if (!zeroBox) {
        return;
      }
      const zeroStart = getBoxCenter(zeroBox);

      const handleLocator = page.locator(scenario.selector);
      await expect(handleLocator).toBeVisible();
      const retractDistance = 220;
      await dragLocator(page, handleLocator, {
        x: retractDirection.x * scenario.retractMultiplier * retractDistance,
        y: retractDirection.y * scenario.retractMultiplier * retractDistance
      });
      await page.waitForTimeout(100);

      const metricsAfter = await getTapeMetrics(page);
      expect(metricsAfter).not.toBeNull();
      if (!metricsAfter) {
        return;
      }
      expect(metricsAfter.visible).toBeLessThan(metricsBefore.visible - 20);
      if (
        metricsBefore.dataVisible != null &&
        metricsAfter.dataVisible != null
      ) {
        expect(metricsAfter.dataVisible).toBeLessThan(metricsBefore.dataVisible - 0.1);
      }

      const zeroEndBox = await zeroHandle.boundingBox();
      expect(zeroEndBox).not.toBeNull();
      if (!zeroEndBox) {
        return;
      }
      const zeroEnd = getBoxCenter(zeroEndBox);
      const displacement: Vector = {
        x: zeroEnd.x - zeroStart.x,
        y: zeroEnd.y - zeroStart.y
      };
      const forwardComponent = dot(displacement, retractDirection);
      expect(forwardComponent).toBeLessThanOrEqual(8);
    });
  }
});
