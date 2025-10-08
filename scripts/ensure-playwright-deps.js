#!/usr/bin/env node
const { spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const CACHE_DIR = path.join(__dirname, '..', '.cache');
const SENTINEL = path.join(CACHE_DIR, 'playwright-deps-installed');

async function markInstalled() {
  await fs.promises.mkdir(CACHE_DIR, { recursive: true });
  await fs.promises.writeFile(SENTINEL, String(Date.now()));
}

async function validateDependencies() {
  try {
    const { registry } = require('playwright-core/lib/server');
    const executables = registry.defaultExecutables();
    if (!executables.length) {
      return { ok: true };
    }
    const sdkLanguage = process.env.PW_LANG_NAME || 'javascript';
    await registry.validateHostRequirementsForExecutablesIfNeeded(executables, sdkLanguage);
    return { ok: true };
  } catch (error) {
    return { ok: false, error };
  }
}

async function main() {
  if (process.env.SKIP_PLAYWRIGHT_DEPS_INSTALL) {
    return;
  }

  if (process.platform !== 'linux') {
    return;
  }

  if (fs.existsSync(SENTINEL)) {
    return;
  }

  const validationResult = await validateDependencies();
  if (validationResult.ok) {
    await markInstalled();
    return;
  }

  const errorMessage = validationResult.error?.message?.trim() || validationResult.error?.toString();
  if (errorMessage) {
    console.error('[playwright] Unable to verify system dependencies automatically.');
    console.error(errorMessage);
  }

  if (process.getuid && process.getuid() !== 0) {
    console.error('[playwright] Missing browser system dependencies.');
    console.error('Run `sudo npx playwright install-deps` (or manually install the dependencies) before running the tests.');
    process.exit(1);
  }

  const result = spawnSync('npx', ['playwright', 'install-deps'], { stdio: 'inherit' });
  if (result.status !== 0) {
    console.error('[playwright] Failed to install system dependencies automatically.');
    console.error('Please run `npx playwright install-deps` manually to review the error output.');
    process.exit(result.status ?? 1);
  }

  await markInstalled();
}

main().catch((error) => {
  const message = error?.message || error?.toString() || 'Unknown error';
  console.error('[playwright] ensure-playwright-deps.js failed:', message);
  process.exit(1);
});
