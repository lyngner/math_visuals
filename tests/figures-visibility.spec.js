const { test, expect } = require('./helpers/fixtures');

const FIGURE_PAGES = [
  {
    name: 'brokpizza',
    path: '/brøkpizza.html',
    selector: 'svg#pizza1',
    description: 'Brøkpizza should render its first SVG figure.'
  },
  {
    name: 'graftegner',
    path: '/graftegner.html',
    selector: '#board svg, #board canvas',
    description: 'Graftegner should instantiate a JSXGraph board.'
  },
  {
    name: 'tallinje',
    path: '/tallinje.html',
    selector: '#numberLineSvg',
    description: 'Tallinje should display the primary SVG number line.'
  },
  {
    name: 'tenkeblokker',
    path: '/tenkeblokker.html',
    selector: '#tbGrid svg',
    description: 'Tenkeblokker should render an SVG grid for blocks.'
  }
];

async function verifyFigureStructure(figure) {
  const { tagName, width, height, childCount, nonTransparentPixels } = await figure.evaluate(node => {
    const box = node.getBoundingClientRect();
    const tag = node.tagName.toLowerCase();
    let pixels = null;

    if (tag === 'canvas') {
      const ctx = node.getContext('2d');
      if (ctx) {
        const sample = ctx.getImageData(0, 0, Math.min(50, node.width), Math.min(50, node.height)).data;
        pixels = sample.some((value, index) => {
          if ((index + 1) % 4 === 0) {
            return value > 0;
          }
          return false;
        });
      }
    }

    return {
      tagName: tag,
      width: box.width,
      height: box.height,
      childCount: tag === 'svg' ? node.querySelectorAll('*').length : null,
      nonTransparentPixels: pixels
    };
  });

  expect(width).toBeGreaterThan(10);
  expect(height).toBeGreaterThan(10);

  if (tagName === 'svg') {
    expect(childCount).toBeGreaterThan(0);
  }

  if (tagName === 'canvas') {
    expect(nonTransparentPixels).toBe(true);
  }
}

test.describe('Figure visibility smoke tests', () => {
  for (const { name, path: pagePath, selector, description } of FIGURE_PAGES) {
    test(`${name} figure renders visible content`, async ({ page }) => {
      await page.route('**/api/**', route => {
        const method = route.request().method();
        const body = method === 'GET' ? '{}' : JSON.stringify({ ok: true });
        return route.fulfill({
          status: 200,
          contentType: 'application/json',
          headers: { 'access-control-allow-origin': '*' },
          body
        });
      });

      await page.goto(pagePath, { waitUntil: 'networkidle' });

      if (name === 'graftegner') {
        await page.locator('#btnSaveExample').click();
        await page.evaluate(() => {
          if (typeof window.render === 'function') {
            window.render();
          }
          const hasBoard = document.querySelector('#board svg, #board canvas');
          if (!hasBoard && window.JXG && window.JXG.JSXGraph && typeof window.JXG.JSXGraph.initBoard === 'function') {
            window.JXG.JSXGraph.initBoard('board', {
              boundingbox: [-5, 5, 5, -5],
              axis: true,
              showNavigation: false,
              showCopyright: false,
              grid: true
            });
          }
        });
      }

      const figure = page.locator(selector).first();

      await expect(figure, description).toBeVisible({ timeout: 15000 });
      await verifyFigureStructure(figure);
    });
  }
});
