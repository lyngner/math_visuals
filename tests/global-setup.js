const { execSync } = require('child_process');

module.exports = async () => {
  if (process.env.PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD === '1') {
    return;
  }

  try {
    execSync('npx playwright install', { stdio: 'inherit' });
  } catch (error) {
    console.error('Failed to ensure Playwright browsers are installed.');
    throw error;
  }
};
