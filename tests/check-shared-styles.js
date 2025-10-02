#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

const repoRoot = path.resolve(__dirname, '..');
const skipDirectories = new Set(['node_modules', '.git', 'docs', 'tests', 'vendor']);
const skipFiles = new Set(['index.html']);

function collectHtmlFiles(startDir) {
  const entries = fs.readdirSync(startDir, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    if (entry.name.startsWith('.')) {
      continue;
    }

    const absolutePath = path.join(startDir, entry.name);
    if (entry.isDirectory()) {
      if (skipDirectories.has(entry.name)) {
        continue;
      }
      files.push(...collectHtmlFiles(absolutePath));
    } else if (entry.isFile() && entry.name.endsWith('.html')) {
      const relative = path.relative(repoRoot, absolutePath);
      if (!skipFiles.has(relative)) {
        files.push({ absolute: absolutePath, relative });
      }
    }
  }

  return files;
}

const htmlFiles = collectHtmlFiles(repoRoot);

const checks = [
  {
    name: 'viewport meta tag',
    pattern: /<meta\s+name=["']viewport["']\s+content=["']width=device-width,initial-scale=1["']\s*\/?\s*>/i,
  },
  {
    name: 'base.css stylesheet',
    pattern: /<link[^>]+href=["'](?:(?:\.\.?\/)+|\/)?base\.css["'][^>]*>/i,
  },
  {
    name: '.wrap layout container',
    pattern: /class=["'][^"']*\bwrap\b[^"']*["']/i,
  },
  {
    name: '.grid layout container',
    pattern: /class=["'][^"']*\bgrid\b[^"']*["']/i,
  },
];

const failures = [];

for (const file of htmlFiles) {
  const content = fs.readFileSync(file.absolute, 'utf8');
  for (const check of checks) {
    if (!check.pattern.test(content)) {
      failures.push(`${file.relative}: missing ${check.name}`);
    }
  }
}

if (failures.length > 0) {
  console.error('Shared styling check failed:');
  for (const failure of failures) {
    console.error(`  - ${failure}`);
  }
  process.exitCode = 1;
} else {
  console.log(`Shared styling check passed for ${htmlFiles.length} files.`);
}
