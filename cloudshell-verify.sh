#!/usr/bin/env bash
set -euo pipefail
SCRIPT_DIR=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)
echo "starting verifier"

if bash "$SCRIPT_DIR/scripts/cloudshell-verify.sh" "$@"; then
  status=0
else
  status=$?
fi

echo "verifier completed"
exit "$status"
