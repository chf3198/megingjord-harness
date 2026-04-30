#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
GIT_COMMON_DIR="$(git -C "$ROOT" rev-parse --git-common-dir 2>/dev/null || true)"
if [[ -z "$GIT_COMMON_DIR" ]]; then
  echo "⚠️  Unable to resolve git common dir for hooks"
  exit 0
fi
[[ "$GIT_COMMON_DIR" = /* ]] || GIT_COMMON_DIR="$ROOT/$GIT_COMMON_DIR"
HOOKS_DIR="$GIT_COMMON_DIR/hooks"

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
