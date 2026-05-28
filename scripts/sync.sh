#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
COPILOT="$HOME/.copilot"
DRY_RUN=false
TARGET="copilot"
ALLOW_CANONICAL_WRITE=false
CODEX_ARGS=()

while [[ $# -gt 0 ]]; do
  case "$1" in
    --dry-run) DRY_RUN=true ;;
    --target) TARGET="${2:-copilot}"; shift ;;
    --allow-canonical-write) ALLOW_CANONICAL_WRITE=true ;;
    *) echo "Usage: sync.sh [--dry-run] [--target copilot|codex|claude|both|all] [--allow-canonical-write]"; exit 1 ;;
  esac
  shift
done

[[ "$TARGET" =~ ^(copilot|codex|claude|both|all)$ ]] || { echo "Invalid target: $TARGET"; exit 1; }
$DRY_RUN && CODEX_ARGS+=(--dry-run)

CANONICAL_MAIN="$HOME/devenv-ops"
if [[ "$ROOT" == "$CANONICAL_MAIN" && "$ALLOW_CANONICAL_WRITE" != "true" && "$DRY_RUN" != "true" ]]; then
  echo "x canonical-main read-only: sync.sh writes from \$COPILOT (~/.copilot/) INTO this checkout (~/devenv-ops/)." >&2
  echo "  Running from canonical main would overwrite tracked source files with stale deployed-runtime content," >&2
  echo "  causing the same drift class as #2355 (working-tree regression of merged PRs)." >&2
  echo "" >&2
  echo "  Correct flows:" >&2
  echo "    - Forward deploy (main -> ~/.copilot/):    npm run deploy:apply  (uses scripts/deploy.sh)" >&2
  echo "    - Inverse reload (~/.copilot/ -> checkout): run from a worktree, not canonical main." >&2
  echo "    - IT-ops one-shot override:                bash scripts/sync.sh --allow-canonical-write (cite IT-ops bypass)" >&2
  echo "" >&2
  exit 2
fi

sync_dir() {
  local src="$1" dest="$2" label="$3"
  [[ -d "$src" ]] || { echo "Warn: source not found: $src"; return; }
  echo "-- $label --"
  local count=0
  for item in "$src"/*/; do
    local name; name=$(basename "$item")
    [[ "$name" == "*" ]] && continue
    if $DRY_RUN; then
      echo "  Would sync: $name"
    else
      mkdir -p "$dest/$name"
      cp -r "$item"* "$dest/$name/" 2>/dev/null || true
      echo "  ok $name"
    fi
    count=$((count + 1))
  done
  echo "  Total: $count"
  echo ""
}

sync_files() {
  local src="$1" dest="$2" label="$3"
  [[ -d "$src" ]] || { echo "Warn: source not found: $src"; return; }
  echo "-- $label --"
  local count=0
  for file in "$src"/*; do
    [[ -f "$file" ]] || continue
    local name; name=$(basename "$file")
    if $DRY_RUN; then
      echo "  Would sync: $name"
    else
      cp "$file" "$dest/$name"
      echo "  ok $name"
    fi
    count=$((count + 1))
  done
  echo "  Total: $count"
  echo ""
}

if [[ "$TARGET" == "codex" || "$TARGET" == "both" || "$TARGET" == "all" ]]; then
  node "$ROOT/scripts/global/codex-runtime.js" sync "${CODEX_ARGS[@]}"
fi
[[ "$TARGET" == "codex" ]] && exit 0
if [[ "$TARGET" == "claude" || "$TARGET" == "all" ]]; then
  $DRY_RUN && echo "(dry run) Would sync ~/.claude/ -> .claude/" || rsync -a --exclude='*.local*' "$HOME/.claude/" "$ROOT/.claude/" && echo "ok ~/.claude/ -> .claude/"
  [[ "$TARGET" == "claude" ]] && exit 0; fi
echo "Syncing from: $COPILOT -> $ROOT"
sync_dir "$COPILOT/skills" "$ROOT/skills" "Skills"
sync_files "$COPILOT/instructions" "$ROOT/instructions" "Instructions"
sync_files "$COPILOT/scripts" "$ROOT/scripts/global" "Global Scripts"
sync_files "$COPILOT/agents" "$ROOT/agents" "Agents"
sync_dir "$COPILOT/wiki" "$ROOT/wiki" "Wiki"
echo "-- Dashboard --"
if [[ -d "$COPILOT/dashboard" ]]; then
  if $DRY_RUN; then
    echo "  Would sync: dashboard/ (html, css, js)"
  else
    mkdir -p "$ROOT/dashboard/css" "$ROOT/dashboard/js"
    cp "$COPILOT/dashboard/index.html" "$ROOT/dashboard/" 2>/dev/null || true
    cp "$COPILOT"/dashboard/css/*.css "$ROOT/dashboard/css/" 2>/dev/null || true
    cp "$COPILOT"/dashboard/js/*.js "$ROOT/dashboard/js/" 2>/dev/null || true
    echo "  ok Dashboard synced"
  fi
fi
echo ""
echo "-- Hooks --"
if [[ -d "$COPILOT/hooks" ]]; then
  if $DRY_RUN; then
    echo "  Would sync: hooks/"
  else
    rsync -a --exclude='__pycache__' --exclude='state/' "$COPILOT/hooks/" "$ROOT/hooks/"
    echo "  ok Hooks synced"
  fi
fi
echo "Done. Review changes with: git diff --stat"
