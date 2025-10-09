#!/usr/bin/env node
import { readFile, mkdir, copyFile, rm } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { resolve, dirname, join } from 'node:path';
import { readdir } from 'node:fs/promises';

const CHECK_FLAGS = new Set(['--check', '--verify']);
const args = process.argv.slice(2);
const checkOnly = args.some((arg) => CHECK_FLAGS.has(arg));

const manifestPath = resolve('scripts/vendor-manifest.json');
let manifest;
try {
  manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
} catch (error) {
  console.error(`Failed to read vendor manifest at ${manifestPath}`);
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
  process.exit(1);
}

const outputRoot = resolve(manifest.outputRoot ?? 'vendor/cdn');
const packages = manifest.packages ?? {};

const expectedFiles = new Map(); // destRel -> srcAbs

async function ensureDir(dirPath) {
  await mkdir(dirPath, { recursive: true });
}

async function collectDirectory(baseDir, relDir) {
  const abs = resolve(baseDir, relDir);
  const entries = await readdir(abs, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const entryRel = join(relDir, entry.name);
    if (entry.isDirectory()) {
      files.push(...await collectDirectory(baseDir, entryRel));
    } else if (entry.isFile()) {
      files.push(entryRel);
    }
  }
  return files;
}

async function fileHash(path) {
  try {
    const data = await readFile(path);
    const hash = createHash('sha256').update(data).digest('hex');
    return hash;
  } catch (error) {
    if (error && error.code === 'ENOENT') {
      return null;
    }
    throw error;
  }
}

async function addExpectedFiles(pkgName, pkgConfig) {
  const baseDir = resolve(pkgConfig.baseDir);
  const packageOutputRoot = join(outputRoot, pkgName);
  await ensureDir(packageOutputRoot);

  const fileList = Array.isArray(pkgConfig.files) ? [...pkgConfig.files] : [];
  const directories = Array.isArray(pkgConfig.directories) ? pkgConfig.directories : [];

  for (const dirRel of directories) {
    const collected = await collectDirectory(baseDir, dirRel);
    fileList.push(...collected);
  }

  for (const relPath of fileList) {
    const src = resolve(baseDir, relPath);
    const destRel = join(pkgName, relPath);
    const dest = join(outputRoot, destRel);
    expectedFiles.set(destRel.replace(/\\/g, '/'), { src, dest });
  }
}

for (const [pkgName, pkgConfig] of Object.entries(packages)) {
  await addExpectedFiles(pkgName, pkgConfig);
}

const operations = [];
const problems = [];

for (const [destRel, { src, dest }] of expectedFiles.entries()) {
  operations.push((async () => {
    const destDir = dirname(dest);
    await ensureDir(destDir);
    const [srcHash, destHash] = await Promise.all([fileHash(src), fileHash(dest)]);
    if (srcHash == null) {
      problems.push(`Source missing: ${src}`);
      return;
    }
    if (destHash !== srcHash) {
      if (checkOnly) {
        problems.push(`Out of date: ${destRel}`);
      } else {
        await copyFile(src, dest);
      }
    }
  })());
}

await Promise.all(operations);

async function listDestFiles(rootDir, prefix = '') {
  const abs = join(rootDir, prefix);
  const entries = await readdir(abs, { withFileTypes: true });
  let files = [];
  for (const entry of entries) {
    if (entry.name === '.gitignore') {
      continue;
    }
    const nextPrefix = join(prefix, entry.name);
    const absPath = join(rootDir, nextPrefix);
    if (entry.isDirectory()) {
      files.push(...await listDestFiles(rootDir, nextPrefix));
    } else if (entry.isFile()) {
      files.push({ rel: nextPrefix.replace(/\\/g, '/'), absPath });
    }
  }
  return files;
}

let extraneous = [];
try {
  extraneous = await listDestFiles(outputRoot);
} catch (error) {
  if (error && error.code !== 'ENOENT') {
    throw error;
  }
}

for (const { rel, absPath } of extraneous) {
  if (!expectedFiles.has(rel)) {
    if (checkOnly) {
      problems.push(`Unexpected file: ${rel}`);
    } else {
      await rm(absPath, { force: true });
    }
  }
}

if (checkOnly) {
  if (problems.length > 0) {
    console.error('Vendor verification failed:\n' + problems.join('\n'));
    console.error('\nKjør `npm run materialize-vendor` for å oppdatere vendorfiler fra `node_modules`.');
    process.exitCode = 1;
  } else {
    console.log('Vendor assets are up to date.');
  }
} else {
  if (problems.length > 0) {
    console.error('Encountered issues while copying vendor assets:\n' + problems.join('\n'));
    process.exitCode = 1;
  }
}
