import { createHash } from 'crypto';
import { createReadStream } from 'fs';
import { promises as fs } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '..');
const manifestPath = path.join(__dirname, 'vendor-manifest.json');

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

async function copyFileIfNeeded(pkgName, sourceDir, fileName) {
  const src = path.resolve(repoRoot, sourceDir, fileName);
  const destDir = path.resolve(repoRoot, 'public', 'vendor', pkgName);
  const dest = path.join(destDir, fileName);

  let srcStat;
  try {
    srcStat = await fs.stat(src);
  } catch (error) {
    if (error && error.code === 'ENOENT') {
      throw new Error(`Fant ikke kildefilen for ${pkgName}: ${src}`);
    }
    throw error;
  }
  if (!srcStat.isFile()) {
    throw new Error(`Kilden er ikke en fil for ${pkgName}: ${src}`);
  }

  if (await pathsAreEqual(src, dest, srcStat)) {
    return { status: 'skipped', pkgName, fileName };
  }

  await ensureDirectory(destDir);
  await fs.copyFile(src, dest);
  await fs.utimes(dest, srcStat.atime, srcStat.mtime);
  return { status: 'copied', pkgName, fileName };
}

async function materializeVendor() {
  const manifest = await readManifest();
  const results = [];
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
    for (const fileName of files) {
      if (typeof fileName !== 'string' || !fileName) {
        throw new Error(`Oppføringen for ${pkgName} inneholder en ugyldig fil.`);
      }
      const result = await copyFileIfNeeded(pkgName, source, fileName);
      results.push(result);
    }
  }
  return results;
}

materializeVendor()
  .then(results => {
    for (const result of results) {
      if (result.status === 'copied') {
        console.log(`Kopierte ${result.pkgName}/${result.fileName}`);
      } else {
        console.log(`Uendret ${result.pkgName}/${result.fileName}`);
      }
    }
  })
  .catch(error => {
    console.error(error.message || error);
    process.exitCode = 1;
  });

