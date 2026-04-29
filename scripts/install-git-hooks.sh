#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
HOOKS_DIR="$ROOT/.git/hooks"

if [[ ! -d "$HOOKS_DIR" ]]; then
  echo "⚠️  Git hooks directory not found: $HOOKS_DIR"
  exit 0
fi

install_hook() {
  local source_file="$1"
  local target_hook="$2"
  cp "$source_file" "$HOOKS_DIR/$target_hook"
  chmod +x "$HOOKS_DIR/$target_hook"
  echo "✅ Installed $target_hook"
}

install_hook "$ROOT/hooks/scripts/validate-branch-name.sh" "pre-commit"
install_hook "$ROOT/hooks/scripts/pre-push-readability.sh" "pre-push"
