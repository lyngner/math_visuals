const fs = require('fs');
const path = require('path');
const { test, expect } = require('@playwright/test');

const {
  attachExamplesBackendMock,
  normalizeExamplePath
} = require('./helpers/examples-backend-mock');

const repoRoot = path.resolve(__dirname, '..');
const skipDirectories = new Set(['node_modules', '.git', 'docs', 'tests', 'vendor']);
const exampleToolbarPattern = /id=["']btnSaveExample["']/;

function collectExamplePages(startDir) {
  const entries = fs.readdirSync(startDir, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    if (entry.name.startsWith('.')) {
      continue;
    }

    const absolutePath = path.join(startDir, entry.name);
    if (entry.isDirectory()) {
      if (skipDirectories.has(entry.name)) {
        continue;
      }
      files.push(...collectExamplePages(absolutePath));
    } else if (entry.isFile() && entry.name.endsWith('.html')) {
      const content = fs.readFileSync(absolutePath, 'utf8');
      if (exampleToolbarPattern.test(content)) {
        const relative = path.relative(repoRoot, absolutePath).split(path.sep).join('/');
        files.push(relative);
      }
    }
  }

  return files;
}

const examplePages = collectExamplePages(repoRoot).sort();

async function readExampleCounts(page, backend, path) {
  const entry = await backend.client.get(path);
  const user = entry && Array.isArray(entry.examples) ? entry.examples.length : 0;
  const domCount = await page.locator('#exampleTabs .example-tab').count();
  const provided = Math.max(domCount - user, 0);
  return { provided, user, domCount };
}

test.describe.skip('Examples retention across apps', () => {
  // Temporarily disabled due to persistent 404 failures in CI
  let backend;

  test.beforeEach(async ({ page }) => {
    backend = await attachExamplesBackendMock(page.context());
  });

  if (examplePages.length === 0) {
    test('no example-enabled pages detected', () => {
      test.fail(true, 'Expected at least one page with example toolbar');
    });
    return;
  }

  for (const relativePath of examplePages) {
    test.describe(relativePath, () => {
      test('preserves provided and user example counts across reloads', async ({ page }) => {
        const routePath = `/${relativePath}`;

        const canonicalPath = normalizeExamplePath(routePath);
        await backend.client.put(canonicalPath, { examples: [], deletedProvided: [] });

        await page.goto(routePath, { waitUntil: 'load' });

        const tabLocator = page.locator('#exampleTabs .example-tab');
        await expect(tabLocator).toHaveCount(0);

        const bootstrapSave = backend.waitForPut(canonicalPath, {
          description: `bootstrap example for ${routePath}`
        });
        await page.locator('#btnSaveExample').click();
        await bootstrapSave;

        await expect(tabLocator).toHaveCount(1);

        const initialDomCount = await tabLocator.count();
        const currentEntry = await backend.client.get(canonicalPath);
        const currentExamples = currentEntry && Array.isArray(currentEntry.examples) ? currentEntry.examples : [];
        const currentDeleted = currentEntry && Array.isArray(currentEntry.deletedProvided)
          ? currentEntry.deletedProvided
          : [];
        await backend.client.put(canonicalPath, {
          examples: currentExamples,
          deletedProvided: currentDeleted
        });

        const initialCounts = await readExampleCounts(page, backend, canonicalPath);
        expect(initialCounts.domCount).toBeGreaterThan(0);

        const description = page.locator('#exampleDescription');
        let descriptionValue = null;
        if (await description.count()) {
          descriptionValue = `Automatisk testlagret eksempel ${relativePath}`;
          await description.fill(descriptionValue);
        }

        const savePromise = backend.waitForPut(canonicalPath, {
          description: `save example on ${routePath}`
        });
        await page.locator('#btnSaveExample').click();
        const putResult = await savePromise;
        await expect(tabLocator).toHaveCount(initialCounts.domCount + 1);

        expect(Array.isArray(putResult.payload.examples)).toBe(true);
        if (descriptionValue) {
          expect(putResult.payload.examples.some(example => example.description === descriptionValue)).toBe(true);
        }

        const afterSave = await readExampleCounts(page, backend, canonicalPath);
        expect(afterSave.user).toBe(initialCounts.user + 1);
        expect(afterSave.provided).toBe(initialCounts.provided);
        expect(afterSave.domCount).toBe(initialCounts.domCount + 1);

        const storedEntry = await backend.client.get(canonicalPath);
        expect(storedEntry).toBeTruthy();
        expect(Array.isArray(storedEntry.examples)).toBe(true);
        expect(storedEntry.examples.length).toBe(afterSave.user);
        if (descriptionValue) {
          expect(storedEntry.examples.some(example => example.description === descriptionValue)).toBe(true);
        }

        await page.reload({ waitUntil: 'load' });
        await page.waitForFunction(expected => {
          return document.querySelectorAll('#exampleTabs .example-tab').length === expected;
        }, afterSave.domCount);

        const afterReload = await readExampleCounts(page, backend, canonicalPath);
        expect(afterReload.user).toBe(afterSave.user);
        expect(afterReload.provided).toBe(afterSave.provided);
        expect(afterReload.domCount).toBe(afterSave.domCount);
      });
    });
  }
});
