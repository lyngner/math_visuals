#!/usr/bin/env node
const { spawnSync } = require('child_process');

const cli = require.resolve('@playwright/test/cli');
const env = { ...process.env };
if (!env.PLAYWRIGHT_DOWNLOAD_HOST) {
  env.PLAYWRIGHT_DOWNLOAD_HOST = 'https://playwright.azureedge.net';
}

const result = spawnSync(process.execPath, [cli, ...process.argv.slice(2)], {
  stdio: 'inherit',
  env,
});

if (result.error) {
  throw result.error;
}
process.exit(result.status ?? 1);
