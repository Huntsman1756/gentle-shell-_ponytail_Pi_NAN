#!/usr/bin/env bash
set -euo pipefail
TARGET="$(cd "${1:-.}" && pwd)"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]:-install.sh}")" 2>/dev/null && pwd || true)"
SOURCE="$SCRIPT_DIR"
TMP=""
cleanup() { if [ -n "$TMP" ]; then rm -rf -- "$TMP"; fi; }
trap cleanup EXIT
if [ ! -f "$SOURCE/scripts/install-template.mjs" ]; then
  TMP="$(mktemp -d)"
  curl -fsSL 'https://github.com/Huntsman1756/gentle-shell-_ponytail_Pi_NAN/archive/refs/heads/main.tar.gz' -o "$TMP/repo.tar.gz"
  tar -xzf "$TMP/repo.tar.gz" -C "$TMP"
  SOURCE="$TMP/gentle-shell-_ponytail_Pi_NAN-main"
fi
node "$SOURCE/scripts/install-template.mjs" "$TARGET"
printf '\nEnable controlled startup: source "%s/.pi/bin/activate.sh"\n' "$TARGET"
printf 'Then use: pi --stack-check; pi; pi --stack-rollback\n'
