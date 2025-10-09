import { createHash } from 'crypto';
import { createReadStream } from 'fs';
import { promises as fs } from 'fs';
import { execFile } from 'child_process';
import path from 'path';
import { promisify } from 'util';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '..');
const manifestPath = path.join(__dirname, 'vendor-manifest.json');
const execFileAsync = promisify(execFile);
const args = new Set(process.argv.slice(2));
const checkMode = args.has('--check');
const verifyMode = args.has('--verify') || checkMode;

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

async function pathsAreEqual(src, dest, srcStat) {
  try {
    const destStat = await fs.stat(dest);
    if (!destStat.isFile()) return false;
    const sameMtime = Math.abs(destStat.mtimeMs - srcStat.mtimeMs) < 1;
    if (sameMtime && destStat.size === srcStat.size) {
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

async function copyFileIfNeeded(pkgName, sourceDir, fileName, { optional = false } = {}) {
  const src = path.resolve(repoRoot, sourceDir, fileName);
  const destDir = path.resolve(repoRoot, 'public', 'vendor', pkgName);
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

  if (await pathsAreEqual(src, dest, srcStat)) {
    return { status: 'skipped', pkgName, fileName };
  }

  await ensureDirectory(destDir);
  await ensureDirectory(path.dirname(dest));
  await fs.copyFile(src, dest);
  await fs.utimes(dest, srcStat.atime, srcStat.mtime);
  return { status: 'copied', pkgName, fileName };
}

function normalizeFiles(pkgName, descriptor) {
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
  const normalized = [];
  for (const fileDescriptor of files) {
    if (typeof fileDescriptor === 'string') {
      normalized.push({ name: fileDescriptor, optional: false });
    } else if (fileDescriptor && typeof fileDescriptor === 'object' && !Array.isArray(fileDescriptor)) {
      const { name, optional: isOptional } = fileDescriptor;
      if (typeof name !== 'string' || !name) {
        throw new Error(`Oppføringen for ${pkgName} inneholder en ugyldig fil.`);
      }
      normalized.push({ name, optional: Boolean(isOptional) });
    } else {
      throw new Error(`Oppføringen for ${pkgName} inneholder en ugyldig fil.`);
    }
  }
  return { source, files: normalized };
}

async function materializeVendor(manifest) {
  const results = [];
  for (const [pkgName, descriptor] of Object.entries(manifest)) {
    const { source, files } = normalizeFiles(pkgName, descriptor);
    for (const { name: fileName, optional } of files) {
      const result = await copyFileIfNeeded(pkgName, source, fileName, { optional });
      results.push(result);
    }
  }
  return results;
}

async function verifyMaterialized(manifest) {
  const missing = [];
  for (const [pkgName, descriptor] of Object.entries(manifest)) {
    const { files } = normalizeFiles(pkgName, descriptor);
    for (const { name, optional } of files) {
      const dest = path.resolve(repoRoot, 'public', 'vendor', pkgName, name);
      try {
        const stat = await fs.stat(dest);
        if (!stat.isFile()) {
          if (!optional) {
            missing.push(`${pkgName}/${name}`);
          }
        }
      } catch (error) {
        if (!(error && error.code === 'ENOENT')) {
          throw error;
        }
        if (!optional) {
          missing.push(`${pkgName}/${name}`);
        }
      }
    }
  }
  if (missing.length > 0) {
    throw new Error(`Følgende vendorfiler mangler etter materialisering:\n- ${missing.join('\n- ')}`);
  }
}

function getExpectedVendorFiles(manifest) {
  const expected = new Set();
  for (const [pkgName, descriptor] of Object.entries(manifest)) {
    const { files } = normalizeFiles(pkgName, descriptor);
    for (const { name } of files) {
      const normalized = path.posix.join(pkgName, name.split(path.sep).join(path.posix.sep));
      expected.add(normalized);
    }
  }
  expected.add('.gitignore');
  return expected;
}

async function listVendorFiles(relativeDir = '') {
  const vendorRoot = path.resolve(repoRoot, 'public', 'vendor');
  const targetDir = path.resolve(vendorRoot, relativeDir);
  let dirEntries;
  try {
    dirEntries = await fs.readdir(targetDir, { withFileTypes: true });
  } catch (error) {
    if (error && error.code === 'ENOENT') {
      return [];
    }
    throw error;
  }
  const results = [];
  for (const entry of dirEntries) {
    const relativePath = path.posix.join(
      relativeDir.split(path.sep).join(path.posix.sep),
      entry.name
    );
    if (entry.isDirectory()) {
      const nested = await listVendorFiles(path.join(relativeDir, entry.name));
      results.push(...nested);
    } else if (entry.isFile()) {
      results.push(relativePath);
    }
  }
  return results;
}

async function assertNoUnexpectedVendorFiles(manifest) {
  const expected = getExpectedVendorFiles(manifest);
  const actual = await listVendorFiles();
  const unexpected = actual
    .map(entry => entry.split(path.sep).join(path.posix.sep))
    .filter(entry => !expected.has(entry));
  if (unexpected.length > 0) {
    throw new Error(
      `Fant uventede filer i public/vendor/:\n- ${unexpected.sort().join('\n- ')}\n` +
      'Fjern filene eller oppdater manifestet.'
    );
  }
}

async function assertVendorCleanInGit() {
  try {
    const { stdout: trackedStdout } = await execFileAsync('git', ['ls-files', '--', 'public/vendor']);
    const trackedFiles = trackedStdout
      .split('\n')
      .map(line => line.trim())
      .filter(Boolean)
      .filter(file => file !== 'public/vendor/.gitignore');
    if (trackedFiles.length > 0) {
      throw new Error(`Vendor-artefakter er sjekket inn i Git:\n- ${trackedFiles.join('\n- ')}`);
    }

    const { stdout: statusStdout } = await execFileAsync('git', ['status', '--porcelain', '--', 'public/vendor']);
    const clean = statusStdout
      .split('\n')
      .map(line => line.trim())
      .filter(Boolean)
      .length === 0;
    if (!clean) {
      throw new Error('public/vendor/ inneholder sporede endringer i Git.');
    }
  } catch (error) {
    if (error && error.code === 'ENOENT') {
      throw new Error('Git er ikke tilgjengelig i dette miljøet, kan ikke sjekke vendor-tilstand.');
    }
    throw error;
  }
}

readManifest()
  .then(async manifest => {
    const results = await materializeVendor(manifest);
    for (const result of results) {
      if (result.status === 'copied') {
        console.log(`Kopierte ${result.pkgName}/${result.fileName}`);
      } else if (result.status === 'missing-optional') {
        console.log(`Mangler valgfri ${result.pkgName}/${result.fileName}`);
      } else {
        console.log(`Uendret ${result.pkgName}/${result.fileName}`);
      }
    }
    if (verifyMode) {
      await verifyMaterialized(manifest);
      await assertNoUnexpectedVendorFiles(manifest);
    }
    if (checkMode) {
      await assertVendorCleanInGit();
    }
  })
  .catch(error => {
    console.error(error.message || error);
    process.exitCode = 1;
  });

