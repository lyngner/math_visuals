import { createHash } from 'crypto';
import { createReadStream } from 'fs';
import { promises as fs } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import process from 'process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '..');
const manifestPath = path.join(__dirname, 'vendor-manifest.json');
const vendorRoot = path.resolve(repoRoot, 'public', 'vendor');
const argv = process.argv.slice(2);
const checkMode = argv.includes('--check');

async function readManifest() {
  let raw;
  try {
    raw = await fs.readFile(manifestPath, 'utf8');
  } catch (error) {
    if (error && error.code === 'ENOENT') {
      throw new Error(`Fant ikke manifestfilen på ${manifestPath}`);
    }
    throw error;
  }
  try {
    const manifest = JSON.parse(raw);
    if (!manifest || typeof manifest !== 'object' || Array.isArray(manifest)) {
      throw new Error('Manifestet må være et objekt med pakkenavn som nøkler.');
    }
    return manifest;
  } catch (error) {
    throw new Error(`Kunne ikke tolke manifestet: ${error.message}`);
  }
}

async function ensureDirectory(dirPath) {
  await fs.mkdir(dirPath, { recursive: true });
}

async function hashFile(filePath) {
  return new Promise((resolve, reject) => {
    const hash = createHash('sha256');
    const stream = createReadStream(filePath);
    stream.on('error', reject);
    stream.on('data', chunk => hash.update(chunk));
    stream.on('end', () => resolve(hash.digest('hex')));
  });
}

async function pathsAreEqual(src, dest, srcStat, destStat = null) {
  try {
    let destStats = destStat;
    if (!destStats) {
      destStats = await fs.stat(dest);
    }
    if (!destStats.isFile()) return false;
    const sameMtime = Math.abs(destStats.mtimeMs - srcStat.mtimeMs) < 1;
    if (sameMtime && destStats.size === srcStat.size) {
      return true;
    }
    const [srcHash, destHash] = await Promise.all([
      hashFile(src),
      hashFile(dest)
    ]);
    return srcHash === destHash;
  } catch (error) {
    if (error && error.code === 'ENOENT') return false;
    throw error;
  }
}

async function copyFileIfNeeded(pkgName, sourceDir, fileName, { optional = false, mode = 'copy' } = {}) {
  const src = path.resolve(repoRoot, sourceDir, fileName);
  const destDir = path.resolve(vendorRoot, pkgName);
  const dest = path.join(destDir, fileName);

  let srcStat;
  try {
    srcStat = await fs.stat(src);
  } catch (error) {
    if (error && error.code === 'ENOENT') {
      if (optional) {
        return { status: 'missing-optional', pkgName, fileName };
      }
      throw new Error(`Fant ikke kildefilen for ${pkgName}: ${src}`);
    }
    throw error;
  }
  if (!srcStat.isFile()) {
    if (optional) {
      return { status: 'missing-optional', pkgName, fileName };
    }
    throw new Error(`Kilden er ikke en fil for ${pkgName}: ${src}`);
  }

  if (mode === 'check') {
    let destStat;
    try {
      destStat = await fs.stat(dest);
    } catch (error) {
      if (error && error.code === 'ENOENT') {
        return { status: optional ? 'missing-optional' : 'missing', pkgName, fileName };
      }
      throw error;
    }
    if (!destStat.isFile()) {
      return { status: optional ? 'missing-optional' : 'missing', pkgName, fileName };
    }
    if (await pathsAreEqual(src, dest, srcStat, destStat)) {
      return { status: 'ok', pkgName, fileName };
    }
    return { status: 'outdated', pkgName, fileName };
  }

  if (await pathsAreEqual(src, dest, srcStat)) {
    return { status: 'skipped', pkgName, fileName };
  }

  await ensureDirectory(destDir);
  await ensureDirectory(path.dirname(dest));
  await fs.copyFile(src, dest);
  await fs.utimes(dest, srcStat.atime, srcStat.mtime);
  return { status: 'copied', pkgName, fileName };
}

async function listFilesRecursively(rootDir) {
  const entries = await fs.readdir(rootDir, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const entryPath = path.join(rootDir, entry.name);
    if (entry.isDirectory()) {
      const subFiles = await listFilesRecursively(entryPath);
      for (const subFile of subFiles) {
        files.push(path.join(entry.name, subFile));
      }
    } else if (entry.isFile()) {
      files.push(entry.name);
    }
  }
  return files;
}

async function materializeVendor() {
  const manifest = await readManifest();
  const results = [];
  const expectedFiles = new Map();
  for (const [pkgName, descriptor] of Object.entries(manifest)) {
    if (!descriptor || typeof descriptor !== 'object') {
      throw new Error(`Ugyldig manifestoppføring for ${pkgName}`);
    }
    const { source, files } = descriptor;
    if (typeof source !== 'string' || !source) {
      throw new Error(`Oppføringen for ${pkgName} mangler 'source'.`);
    }
    if (!Array.isArray(files) || files.length === 0) {
      throw new Error(`Oppføringen for ${pkgName} må liste filer i 'files'.`);
    }
    const expectedSet = new Set();
    expectedFiles.set(pkgName, expectedSet);
    for (const fileDescriptor of files) {
      let fileName;
      let optional = false;
      if (typeof fileDescriptor === 'string') {
        fileName = fileDescriptor;
      } else if (fileDescriptor && typeof fileDescriptor === 'object' && !Array.isArray(fileDescriptor)) {
        const { name, optional: isOptional } = fileDescriptor;
        if (typeof name !== 'string' || !name) {
          throw new Error(`Oppføringen for ${pkgName} inneholder en ugyldig fil.`);
        }
        fileName = name;
        optional = Boolean(isOptional);
      } else {
        throw new Error(`Oppføringen for ${pkgName} inneholder en ugyldig fil.`);
      }
      expectedSet.add(fileName);
      const result = await copyFileIfNeeded(pkgName, source, fileName, { optional, mode: checkMode ? 'check' : 'copy' });
      results.push(result);
    }
  }

  if (checkMode) {
    let vendorEntries = [];
    try {
      vendorEntries = await fs.readdir(vendorRoot, { withFileTypes: true });
    } catch (error) {
      if (!(error && error.code === 'ENOENT')) {
        throw error;
      }
      vendorEntries = [];
    }
    for (const entry of vendorEntries) {
      if (!entry.isDirectory()) continue;
      const pkgName = entry.name;
      if (!expectedFiles.has(pkgName)) {
        const extraFiles = await listFilesRecursively(path.join(vendorRoot, pkgName));
        for (const fileName of extraFiles) {
          results.push({ status: 'extraneous', pkgName, fileName });
        }
      }
    }

    for (const [pkgName, expectedSet] of expectedFiles.entries()) {
      const packageVendorDir = path.resolve(vendorRoot, pkgName);
      let actualFiles = [];
      try {
        actualFiles = await listFilesRecursively(packageVendorDir);
      } catch (error) {
        if (!(error && error.code === 'ENOENT')) {
          throw error;
        }
        if (expectedSet.size === 0) {
          continue;
        }
        if (![...expectedSet].every(fileName => fileName.includes('fonts/'))) {
          // Missing directory already handled by file checks (missing status)
        }
        continue;
      }
      for (const fileName of actualFiles) {
        if (!expectedSet.has(fileName)) {
          results.push({ status: 'extraneous', pkgName, fileName });
        }
      }
    }
  }
  return results;
}

materializeVendor()
  .then(results => {
    let hasErrors = false;
    for (const result of results) {
      if (result.status === 'copied') {
        console.log(`Kopierte ${result.pkgName}/${result.fileName}`);
      } else if (result.status === 'skipped') {
        console.log(`Uendret ${result.pkgName}/${result.fileName}`);
      } else if (result.status === 'missing-optional') {
        console.log(`Mangler valgfri ${result.pkgName}/${result.fileName}`);
      } else if (result.status === 'ok') {
        console.log(`OK ${result.pkgName}/${result.fileName}`);
      } else if (result.status === 'missing') {
        console.error(`Mangler ${result.pkgName}/${result.fileName}`);
        hasErrors = true;
      } else if (result.status === 'outdated') {
        console.error(`Utdatert ${result.pkgName}/${result.fileName}`);
        hasErrors = true;
      } else if (result.status === 'extraneous') {
        console.error(`Overflødig fil i vendor: ${result.pkgName}/${result.fileName}`);
        hasErrors = true;
      } else {
        console.log(`${result.status} ${result.pkgName}/${result.fileName}`);
      }
    }
    if (checkMode && hasErrors) {
      console.error('Vendor-mappene er ikke oppdatert. Kjør "npm run materialize-vendor" for å regenerere filene.');
      process.exitCode = 1;
    }
  })
  .catch(error => {
    console.error(error.message || error);
    process.exitCode = 1;
  });

