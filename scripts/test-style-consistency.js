#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

const rootDir = path.resolve(__dirname, '..');
const skipDirs = new Set(['node_modules', 'vendor', '.git', '.github']);

function collectHtmlFiles(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    if (skipDirs.has(entry.name)) {
      continue;
    }
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...collectHtmlFiles(fullPath));
    } else if (entry.isFile() && entry.name.toLowerCase().endsWith('.html')) {
      files.push(fullPath);
    }
  }
  return files;
}

function hasWrapClass(content) {
  return /class\s*=\s*"[^"]*\bwrap\b[^"]*"/.test(content) || /class\s*=\s*'[^']*\bwrap\b[^']*'/.test(content);
}

function extractBlock(content, selector) {
  const match = content.match(new RegExp(`${selector}\\s*{([\\s\\S]*?)}`));
  return match ? match[1] : '';
}

const htmlFiles = collectHtmlFiles(rootDir);
const errors = [];
const checkedFiles = [];

for (const filePath of htmlFiles) {
  const content = fs.readFileSync(filePath, 'utf8');
  if (!hasWrapClass(content)) {
    continue;
  }

  const relativePath = path.relative(rootDir, filePath);
  checkedFiles.push(relativePath);

  const rootCss = extractBlock(content, ':root');
  const bodyCss = extractBlock(content, 'body');

  const checks = [
    {
      test: /<link[^>]+href=["'][^"']*base\.css["']/i,
      message: 'mangler lenke til base.css',
    },
    {
      test: /class\s*=\s*"[^"]*\bgrid\b[^"]*"/,
      fallback: /class\s*=\s*'[^']*\bgrid\b[^']*'/,
      message: 'mangler element med class="grid"',
    },
  ];

  for (const { test, fallback, message, context } of checks) {
    const target = context !== undefined ? context : content;
    const passed = test.test(target) || (fallback ? fallback.test(target) : false);
    if (!passed) {
      errors.push(`- ${relativePath}: ${message}`);
    }
  }

  if (rootCss) {
    if (!/--gap\s*:\s*18px/i.test(rootCss)) {
      errors.push(`- ${relativePath}: :root må sette --gap til 18px når den er definert`);
    }
  }

  if (bodyCss) {
    const marginMatch = bodyCss.match(/margin\s*:\s*([^;]+);/i);
    if (marginMatch && marginMatch[1].trim() !== '0') {
      errors.push(`- ${relativePath}: body margin forventes å være 0`);
    }

    const fontMatch = bodyCss.match(/font-family\s*:\s*([^;]+);/i);
    if (fontMatch && !/system-ui/i.test(fontMatch[1])) {
      errors.push(`- ${relativePath}: body font-family skal inkludere system-ui`);
    }

    const colorMatch = bodyCss.match(/color\s*:\s*([^;]+);/i);
    if (colorMatch) {
      const value = colorMatch[1].trim().toLowerCase();
      if (value !== '#111827' && value !== 'var(--text-color)') {
        errors.push(`- ${relativePath}: body color skal være #111827 eller var(--text-color)`);
      }
    }

    const backgroundMatch = bodyCss.match(/background\s*:\s*([^;]+);/i);
    if (backgroundMatch) {
      const value = backgroundMatch[1].trim().toLowerCase();
      if (value !== '#f7f8fb' && value !== 'var(--surface-bg)') {
        errors.push(`- ${relativePath}: body background skal være #f7f8fb eller var(--surface-bg)`);
      }
    }

    const paddingMatch = bodyCss.match(/padding\s*:\s*([^;]+);/i);
    if (paddingMatch) {
      const value = paddingMatch[1].trim().toLowerCase();
      if (value !== '20px') {
        errors.push(`- ${relativePath}: body padding skal være 20px dersom den overstyres`);
      }
    }
  }
}

if (checkedFiles.length === 0) {
  console.warn('Fant ingen visualiseringer med class="wrap" å teste.');
  process.exit(0);
}

if (errors.length > 0) {
  console.error('Styling-samsvarstest feilet for følgende filer:');
  for (const error of errors) {
    console.error(error);
  }
  process.exit(1);
}

console.log('Styling-samsvarstest bestått for', checkedFiles.length, 'visualiseringer.');
process.exit(0);
