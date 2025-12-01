const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const CACHE_DIR = path.join(__dirname, '..', '.cache');
const SENTINEL = path.join(CACHE_DIR, 'playwright-browsers-installed');

module.exports = async () => {
  try {
    execSync('npm run materialize-vendor', { stdio: 'inherit' });
  } catch (error) {
    console.error('Failed to materialize vendor assets for Playwright.');
    throw error;
  }

  if (
    process.env.PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD === '1' ||
    process.env.PLAYWRIGHT_SKIP_BROWSER_TESTS === '1'
  ) {
    console.warn('[playwright] Skipping browser installation.');
    return;
  }

  if (fs.existsSync(SENTINEL)) {
    return;
  }

  try {
    execSync('npx playwright install', { stdio: 'inherit' });
    fs.mkdirSync(CACHE_DIR, { recursive: true });
    fs.writeFileSync(SENTINEL, String(Date.now()));
  } catch (error) {
    console.error('Failed to ensure Playwright browsers are installed.');
    console.error('Set PLAYWRIGHT_SKIP_BROWSER_TESTS=1 to bypass Playwright when downloads are blocked.');
    throw error;
  }
};
