#!/usr/bin/env bash
set -euo pipefail

REPO_ROOT=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)
echo "[cloudshell-verify] Starter helsesjekk via scripts/cloudshell-verify.sh ..."
if bash "$REPO_ROOT/scripts/cloudshell-verify.sh" "$@"; then
  echo "[cloudshell-verify] Ferdig uten feil."
  exit 0
else
  status=$?
  echo "[cloudshell-verify] Feil fra helper (exit=${status})." >&2
  exit "$status"
fi
