const fs = require('fs');
const path = require('path');
const { test, expect } = require('@playwright/test');

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

async function clearExamplesForCurrentPage(page) {
  await page.evaluate(() => {
    function normalizePathname(pathname, options) {
      const preserveCase = !!(options && options.preserveCase);
      if (typeof pathname !== 'string') return '/';
      let path = pathname.trim();
      if (!path) return '/';
      if (!path.startsWith('/')) path = '/' + path;
      path = path.replace(/\\+/g, '/');
      path = path.replace(/\/+/g, '/');
      path = path.replace(/\/index\.html?$/i, '/');
      if (/\.html?$/i.test(path)) {
        path = path.replace(/\.html?$/i, '');
        if (!path) path = '/';
      }
      if (path.length > 1 && path.endsWith('/')) {
        path = path.slice(0, -1);
      }
      if (!path) return '/';
      let decoded = path;
      try {
        decoded = decodeURI(path);
      } catch (_) {}
      if (!preserveCase && typeof decoded === 'string') {
        decoded = decoded.toLowerCase();
      }
      let encoded = decoded;
      try {
        encoded = encodeURI(decoded);
      } catch (_) {
        if (preserveCase) {
          encoded = path;
        } else {
          encoded = typeof path === 'string' ? path.toLowerCase() : path;
        }
      }
      if (!encoded) return '/';
      const normalized = encoded.replace(/%[0-9a-f]{2}/gi, match => match.toUpperCase());
      return normalized;
    }

    const rawPath =
      (typeof window.__EXAMPLES_ACTIVE_PATH__ === 'string' && window.__EXAMPLES_ACTIVE_PATH__)
        ? window.__EXAMPLES_ACTIVE_PATH__
        : (window.location && typeof window.location.pathname === 'string')
            ? window.location.pathname
            : '/';
    const normalizedPath = normalizePathname(rawPath);
    const storageKey = `examples_${normalizedPath}`;
    const deletedKey = `${storageKey}_deletedProvidedExamples`;
    const seen = new Set();
    const addStore = store => {
      if (store && typeof store.removeItem === 'function' && !seen.has(store)) {
        seen.add(store);
        try {
          store.removeItem(storageKey);
        } catch (_) {}
        try {
          store.removeItem(deletedKey);
        } catch (_) {}
      }
    };

    try {
      if (typeof window.localStorage !== 'undefined') {
        addStore(window.localStorage);
      }
    } catch (_) {}
    addStore(window.__EXAMPLES_STORAGE__);
    addStore(window.__EXAMPLES_FALLBACK_STORAGE__);
  });
}

async function readExampleCounts(page) {
  return page.evaluate(() => {
    function normalizePathname(pathname, options) {
      const preserveCase = !!(options && options.preserveCase);
      if (typeof pathname !== 'string') return '/';
      let path = pathname.trim();
      if (!path) return '/';
      if (!path.startsWith('/')) path = '/' + path;
      path = path.replace(/\\+/g, '/');
      path = path.replace(/\/+/g, '/');
      path = path.replace(/\/index\.html?$/i, '/');
      if (/\.html?$/i.test(path)) {
        path = path.replace(/\.html?$/i, '');
        if (!path) path = '/';
      }
      if (path.length > 1 && path.endsWith('/')) {
        path = path.slice(0, -1);
      }
      if (!path) return '/';
      let decoded = path;
      try {
        decoded = decodeURI(path);
      } catch (_) {}
      if (!preserveCase && typeof decoded === 'string') {
        decoded = decoded.toLowerCase();
      }
      let encoded = decoded;
      try {
        encoded = encodeURI(decoded);
      } catch (_) {
        if (preserveCase) {
          encoded = path;
        } else {
          encoded = typeof path === 'string' ? path.toLowerCase() : path;
        }
      }
      if (!encoded) return '/';
      const normalized = encoded.replace(/%[0-9a-f]{2}/gi, match => match.toUpperCase());
      return normalized;
    }

    const rawPath =
      (typeof window.__EXAMPLES_ACTIVE_PATH__ === 'string' && window.__EXAMPLES_ACTIVE_PATH__)
        ? window.__EXAMPLES_ACTIVE_PATH__
        : (window.location && typeof window.location.pathname === 'string')
            ? window.location.pathname
            : '/';
    const normalizedPath = normalizePathname(rawPath);
    const storageKey = `examples_${normalizedPath}`;
    const stores = [];
    const seenStores = new Set();

    const addStore = store => {
      if (store && typeof store.getItem === 'function' && !seenStores.has(store)) {
        seenStores.add(store);
        stores.push(store);
      }
    };

    try {
      if (typeof window.localStorage !== 'undefined') {
        addStore(window.localStorage);
      }
    } catch (_) {}
    addStore(window.__EXAMPLES_STORAGE__);
    addStore(window.__EXAMPLES_FALLBACK_STORAGE__);

    let payload = null;
    for (const store of stores) {
      try {
        const raw = store.getItem(storageKey);
        if (!raw) {
          continue;
        }
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          payload = parsed;
          break;
        }
      } catch (_) {}
    }

    const examples = Array.isArray(payload) ? payload : [];
    let provided = 0;
    let user = 0;
    for (const example of examples) {
      if (!example || typeof example !== 'object') {
        continue;
      }
      if (example.__builtinKey) {
        provided += 1;
      } else {
        user += 1;
      }
    }

    const domCount = document.querySelectorAll('#exampleTabs .example-tab').length;
    return { provided, user, domCount };
  });
}

test.describe('Examples retention across apps', () => {
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

        await page.goto(routePath, { waitUntil: 'load' });
        await clearExamplesForCurrentPage(page);
        await page.reload({ waitUntil: 'load' });

        await page.waitForFunction(() => {
          return document.querySelectorAll('#exampleTabs .example-tab').length > 0;
        });

        const initialCounts = await readExampleCounts(page);
        expect(initialCounts.domCount).toBeGreaterThan(0);

        const tabs = page.locator('#exampleTabs .example-tab');
        const initialTabCount = initialCounts.domCount;

        const description = page.locator('#exampleDescription');
        if (await description.count()) {
          await description.fill('Automatisk testlagret eksempel');
        }

        await page.locator('#btnSaveExample').click();
        await expect(tabs).toHaveCount(initialTabCount + 1);

        const afterSave = await readExampleCounts(page);
        expect(afterSave.user).toBe(initialCounts.user + 1);
        expect(afterSave.provided).toBe(initialCounts.provided);
        expect(afterSave.domCount).toBe(initialTabCount + 1);

        await page.reload({ waitUntil: 'load' });
        await page.waitForFunction(expected => {
          return document.querySelectorAll('#exampleTabs .example-tab').length === expected;
        }, afterSave.domCount);

        const afterReload = await readExampleCounts(page);
        expect(afterReload.user).toBe(afterSave.user);
        expect(afterReload.provided).toBe(afterSave.provided);
        expect(afterReload.domCount).toBe(afterSave.domCount);
      });
    });
  }
});
