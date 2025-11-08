const { test, expect } = require('@playwright/test');

const MEASUREMENT_BUNDLE_PATH = '/figure-library/measurement.js';

function expectJavaScriptResponse(response) {
  expect(response.status(), `Unexpected status for ${MEASUREMENT_BUNDLE_PATH}`).toBe(200);
  const contentType = response.headers()['content-type'] || '';
  expect(contentType.includes('javascript') || contentType.includes('ecmascript')).toBe(true);
}

test.describe('figure library static assets', () => {
  test('serves measurement.js without proxy rewrites', async ({ request }) => {
    const response = await request.get(MEASUREMENT_BUNDLE_PATH);
    expectJavaScriptResponse(response);

    const body = await response.text();
    expect(body).toContain('getMeasurementFiguresGroupedByCategory');
  });
});
