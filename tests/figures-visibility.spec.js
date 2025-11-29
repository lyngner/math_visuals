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
    selector: '#board svg',
    description: 'Graftegner should instantiate a JSXGraph SVG board.'
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

test.describe('Figure visibility smoke tests', () => {
  for (const { name, path, selector, description } of FIGURE_PAGES) {
    test(`${name} figure is visible`, async ({ page, attachScreenshot }) => {
      await page.goto(path, { waitUntil: 'networkidle' });
      const figure = page.locator(selector);

      try {
        await expect(figure, description).toBeVisible();
      } finally {
        await attachScreenshot(`${name}-figure.png`);
      }
    });
  }
});
