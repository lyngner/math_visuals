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

async function processManifestEntry(pkgName, sourceDir, fileName, { optional = false, mode = 'materialize' } = {}) {
  const src = path.resolve(repoRoot, sourceDir, fileName);
  const destDir = path.resolve(repoRoot, 'public', 'vendor', pkgName);
  const dest = path.join(destDir, fileName);

  let srcStat;
  try {
    srcStat = await fs.stat(src);
  } catch (error) {
    if (error && error.code === 'ENOENT') {
      if (optional) {
        return { status: 'missing-optional-source', pkgName, fileName };
      }
      throw new Error(`Fant ikke kildefilen for ${pkgName}: ${src}`);
    }
    throw error;
  }
  if (!srcStat.isFile()) {
    if (optional) {
      return { status: 'missing-optional-source', pkgName, fileName };
    }
    throw new Error(`Kilden er ikke en fil for ${pkgName}: ${src}`);
  }

  let destStat = null;
  let destExists = false;
  try {
    destStat = await fs.stat(dest);
    if (!destStat.isFile()) {
      throw new Error(`Målbanen er ikke en fil for ${pkgName}: ${dest}`);
    }
    destExists = true;
  } catch (error) {
    if (!(error && error.code === 'ENOENT')) {
      throw error;
    }
  }

  if (mode === 'verify') {
    if (!destExists) {
      if (optional) {
        return { status: 'missing-optional-dest', pkgName, fileName };
      }
      throw new Error(`Generert fil mangler for ${pkgName}: ${dest}`);
    }
    return { status: 'present', pkgName, fileName };
  }

  if (destExists && await pathsAreEqual(src, dest, srcStat)) {
    return { status: 'skipped', pkgName, fileName };
  }

  if (mode === 'check') {
    if (optional) {
      return { status: 'would-copy-optional', pkgName, fileName };
    }
    return { status: 'would-copy', pkgName, fileName };
  }

  await ensureDirectory(destDir);
  await ensureDirectory(path.dirname(dest));
  await fs.copyFile(src, dest);
  await fs.utimes(dest, srcStat.atime, srcStat.mtime);
  return { status: 'copied', pkgName, fileName };
}

async function materializeVendor({ mode = 'materialize' } = {}) {
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
      const result = await processManifestEntry(pkgName, source, fileName, { optional, mode });
      results.push(result);
    }
  }
  return results;
}

function printResult(result, mode) {
  if (result.status === 'copied') {
    console.log(`Kopierte ${result.pkgName}/${result.fileName}`);
    return;
  }
  if (result.status === 'skipped') {
    console.log(`Uendret ${result.pkgName}/${result.fileName}`);
    return;
  }
  if (result.status === 'present') {
    console.log(`Verifisert ${result.pkgName}/${result.fileName}`);
    return;
  }
  if (result.status === 'would-copy') {
    console.log(`Må regenerere ${result.pkgName}/${result.fileName}`);
    return;
  }
  if (result.status === 'would-copy-optional') {
    console.log(`Må regenerere (valgfri) ${result.pkgName}/${result.fileName}`);
    return;
  }
  if (result.status === 'missing-optional-source') {
    if (mode === 'verify') {
      console.log(`Mangler valgfri kildefil ${result.pkgName}/${result.fileName}`);
    } else {
      console.log(`Mangler valgfri kildefil ${result.pkgName}/${result.fileName}`);
    }
    return;
  }
  if (result.status === 'missing-optional-dest') {
    console.log(`Mangler valgfri generert fil ${result.pkgName}/${result.fileName}`);
    return;
  }
  console.log(`Ukjent status for ${result.pkgName}/${result.fileName}: ${result.status}`);
}

function hasBlockingIssues(results) {
  return results.some(result => result.status === 'would-copy' || result.status === 'would-copy-optional');
}

const args = new Set(process.argv.slice(2));
const checkMode = args.has('--check');
const verifyMode = args.has('--verify');

if (checkMode && verifyMode) {
  console.error('Bruk enten --check eller --verify, ikke begge.');
  process.exit(1);
}

const mode = verifyMode ? 'verify' : checkMode ? 'check' : 'materialize';

materializeVendor({ mode })
  .then(results => {
    for (const result of results) {
      printResult(result, mode);
    }
    if (mode === 'check' && hasBlockingIssues(results)) {
      console.error('Vendor-artefakter er ikke oppdatert. Kjør npm run materialize-vendor.');
      process.exitCode = 1;
    }
  })
  .catch(error => {
    console.error(error.message || error);
    process.exitCode = 1;
  });

