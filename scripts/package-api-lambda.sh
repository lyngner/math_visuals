#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
LAMBDA_DIR="$ROOT_DIR/infra/api/lambda"
BUILD_DIR="$ROOT_DIR/infra/api/build"
RUNTIME_DIR="$ROOT_DIR/infra/api/runtime"
API_SRC_DIR="$ROOT_DIR/api"
PALETTE_SRC_DIR="$ROOT_DIR/palette"
ARTIFACT_PATH="$ROOT_DIR/infra/api/api-lambda.zip"

# Install production dependencies for the Lambda runtime
npm ci --omit=dev --prefix "$LAMBDA_DIR"

# Prepare build directory
rm -rf "$BUILD_DIR"
mkdir -p "$BUILD_DIR/api" "$BUILD_DIR/palette"

cp "$RUNTIME_DIR/index.js" "$BUILD_DIR/index.js"
cp "$LAMBDA_DIR/package.json" "$BUILD_DIR/package.json"
if [ -f "$LAMBDA_DIR/package-lock.json" ]; then
  cp "$LAMBDA_DIR/package-lock.json" "$BUILD_DIR/package-lock.json"
fi
cp -R "$LAMBDA_DIR/node_modules" "$BUILD_DIR/node_modules"

rsync -a --exclude 'node_modules' "$API_SRC_DIR/" "$BUILD_DIR/api/"
rsync -a "$PALETTE_SRC_DIR/" "$BUILD_DIR/palette/"

if [ ! -f "$BUILD_DIR/palette/palette-config.js" ]; then
  echo "palette-config.js was not bundled into the Lambda artefact" >&2
  exit 1
fi

(
  cd "$BUILD_DIR"
  zip -qr "$ARTIFACT_PATH" .
)

echo "Packaged Lambda artefact at: $ARTIFACT_PATH"
