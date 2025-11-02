import { readdirSync, readFileSync, existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import commonjs from "@rollup/plugin-commonjs";
import resolve from "@rollup/plugin-node-resolve";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const packagesDir = path.join(__dirname, "packages");

function readPackageConfig(packageDir) {
  const manifestPath = path.join(packageDir, "package.json");
  if (!existsSync(manifestPath)) {
    return {};
  }
  return JSON.parse(readFileSync(manifestPath, "utf8"));
}

function createBuildConfig(packageName) {
  const packageDir = path.join(packagesDir, packageName);
  const input = path.join(packageDir, "src", "index.js");

  if (!existsSync(input)) {
    return null;
  }

  const pkg = readPackageConfig(packageDir);
  const external = new Set([
    ...Object.keys(pkg.dependencies || {}),
    ...Object.keys(pkg.peerDependencies || {})
  ]);

  return {
    input,
    output: [
      {
        file: path.join(packageDir, "dist", "index.mjs"),
        format: "es",
        sourcemap: true
      },
      {
        file: path.join(packageDir, "dist", "index.cjs"),
        format: "cjs",
        sourcemap: true,
        exports: "named"
      }
    ],
    external: [...external],
    plugins: [
      resolve({ extensions: [".js", ".mjs", ".json"] }),
      commonjs()
    ]
  };
}

const configs = existsSync(packagesDir)
  ? readdirSync(packagesDir, { withFileTypes: true })
      .filter((dirent) => dirent.isDirectory())
      .map((dirent) => createBuildConfig(dirent.name))
      .filter(Boolean)
  : [];

export default configs;
