#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
COPILOT="$HOME/.copilot"
DRY_RUN=false
TARGET="copilot"
ALLOW_CANONICAL=false
CODEX_ARGS=()

while [[ $# -gt 0 ]]; do
  case "$1" in
    --dry-run) DRY_RUN=true ;;
    --target) TARGET="${2:-copilot}"; shift ;;
    --allow-canonical-write) ALLOW_CANONICAL=true ;;
    *) echo "Usage: sync.sh [--dry-run] [--target copilot|codex|claude|both|all] [--allow-canonical-write]"; exit 1 ;;
  esac
  shift
done

[[ "$TARGET" =~ ^(copilot|codex|claude|both|all)$ ]] || { echo "Invalid target: $TARGET"; exit 1; }
$DRY_RUN && CODEX_ARGS+=(--dry-run)

# #2355 guardrail: refuse canonical-main writes; emit incident JSONL on trip (exit 2).
if [[ "$ROOT" == "$HOME/devenv-ops" && "$ALLOW_CANONICAL" != "true" && "$DRY_RUN" != "true" ]]; then
  echo "x canonical-main read-only: sync.sh writes ~/.copilot/ INTO ~/devenv-ops/ (#2355 exit 2)." >&2
  echo "  Stale ~/.copilot/ regresses tracked files. Use 'npm run deploy:apply' (forward)" >&2
  echo "  or run from a worktree; pass --allow-canonical-write for IT-ops override." >&2
  mkdir -p "$HOME/.megingjord" 2>/dev/null || true
  printf '{"ts":"%s","version":"v3","service":"megingjord-harness","env":"local","event":"sync-canonical-main-refused","pattern_id":"sync-sh-reverse-direction-regresses-main","severity":"medium","ticket":2355,"_summary":"sync.sh refused canonical-main write"}\n' "$(date -u +%Y-%m-%dT%H:%M:%SZ)" >> "$HOME/.megingjord/incidents.jsonl" 2>/dev/null || true
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
    if $DRY_RUN; then echo "  Would sync: $name"
    else mkdir -p "$dest/$name"; cp -r "$item"* "$dest/$name/" 2>/dev/null || true; echo "  ok $name"
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
    if $DRY_RUN; then echo "  Would sync: $name"
    else cp "$file" "$dest/$name"; echo "  ok $name"
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
  if $DRY_RUN; then echo "  Would sync: dashboard/ (html, css, js)"
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
  if $DRY_RUN; then echo "  Would sync: hooks/"
  else rsync -a --exclude='__pycache__' --exclude='state/' "$COPILOT/hooks/" "$ROOT/hooks/"; echo "  ok Hooks synced"
  fi
fi
echo "Done. Review changes with: git diff --stat"
