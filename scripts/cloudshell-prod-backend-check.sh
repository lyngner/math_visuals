#!/usr/bin/env bash

set -euo pipefail

SCRIPT_DIR=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
REPO_ROOT=$(cd "$SCRIPT_DIR/.." && pwd)

API_URL="${API_URL:-https://g1qrbtynta9rw9nc3v.cloudfront.net/api/examples}"

cd "$REPO_ROOT"

if [[ ! -d node_modules ]]; then
  echo "Installerer npm-avhengigheter (første gangs kjøring i CloudShell)..."
  npm install --ignore-scripts
fi

echo "Kjører helsesjekk mot ${API_URL} ..."
npm run check-examples-api -- --url="$API_URL"
