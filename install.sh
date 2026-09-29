#!/usr/bin/env bash
# Installs the Pi + Gentle Shell + Ponytail + NaN project-local stack.
#
# Remote:  curl -fsSL https://raw.githubusercontent.com/Huntsman1756/gentle-shell-_ponytail_Pi_NAN/main/install.sh | bash
# Local:   ./install.sh [target-dir]   (from a clone of this repo; defaults to cwd)
set -euo pipefail

REPO="Huntsman1756/gentle-shell-_ponytail_Pi_NAN"
TARGET="$(cd "${1:-.}" && pwd)"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]:-install.sh}")" 2>/dev/null && pwd || true)"
SOURCE="${SCRIPT_DIR:-.}/.pi"

if [ ! -d "$SOURCE" ]; then
  TMP="$(mktemp -d)"
  echo "Downloading template from github.com/$REPO ..."
  curl -fsSL "https://github.com/$REPO/archive/refs/heads/main.tar.gz" -o "$TMP/repo.tar.gz"
  tar -xzf "$TMP/repo.tar.gz" -C "$TMP"
  SOURCE="$TMP/gentle-shell-_ponytail_Pi_NAN-main/.pi"
fi

[ -d "$SOURCE" ] || { echo "Could not locate the .pi template." >&2; exit 1; }
cp -R "$SOURCE" "$TARGET/"
echo "Copied .pi -> $TARGET"

GITIGNORE="$TARGET/.gitignore"
touch "$GITIGNORE"
for entry in '.pi/npm/*' '!.pi/npm/.gitignore' '.atl/'; do
  grep -qxF "$entry" "$GITIGNORE" || echo "$entry" >> "$GITIGNORE"
done

cat <<EOF

Next steps:
  1. Set the key (once per machine):
       export NAN_BUILDERS_API_KEY="sk-..."   # add to your shell profile
  2. cd "$TARGET"
  3. pi            -> accept the project-trust prompt; packages install automatically
  4. If npm blocks the gentle-pi postinstall, run once:
       node .pi/npm/node_modules/gentle-pi/scripts/install-gentle-ai.mjs
  5. Smoke test:   pi -p "say READY"
EOF
