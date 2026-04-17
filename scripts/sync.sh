#!/usr/bin/env bash
# Sync all global resources from ~/.copilot/ into this repo
# Usage: bash scripts/sync.sh [--dry-run]
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
COPILOT="$HOME/.copilot"
DRY_RUN=false

if [[ "${1:-}" == "--dry-run" ]]; then
  DRY_RUN=true
  echo "=== DRY RUN — no changes will be made ==="
  echo ""
fi

sync_dir() {
  local src="$1" dest="$2" label="$3"
  if [[ ! -d "$src" ]]; then
    echo "⚠️  Source not found: $src"
    return
  fi
  echo "── $label ──"
  local count=0
  for item in "$src"/*/; do
    local name; name=$(basename "$item")
    [[ "$name" == "*" ]] && continue
    if $DRY_RUN; then
      echo "  Would sync: $name"
    else
      mkdir -p "$dest/$name"
      cp -r "$item"* "$dest/$name/" 2>/dev/null || true
      echo "  ✅ $name"
    fi
    count=$((count + 1))
  done
  echo "  Total: $count"
  echo ""
}

sync_files() {
  local src="$1" dest="$2" label="$3"
  if [[ ! -d "$src" ]]; then
    echo "⚠️  Source not found: $src"
    return
  fi
  echo "── $label ──"
  local count=0
  for file in "$src"/*; do
    [[ -f "$file" ]] || continue
    local name; name=$(basename "$file")
    if $DRY_RUN; then
      echo "  Would sync: $name"
    else
      cp "$file" "$dest/$name"
      echo "  ✅ $name"
    fi
    count=$((count + 1))
  done
  echo "  Total: $count"
  echo ""
}

echo "Syncing from: $COPILOT"
echo "Into:         $ROOT"
echo ""

sync_dir "$COPILOT/skills" "$ROOT/skills" "Skills"
sync_files "$COPILOT/instructions" "$ROOT/instructions" "Instructions"
sync_files "$COPILOT/scripts" "$ROOT/scripts/global" "Global Scripts"
sync_files "$COPILOT/agents" "$ROOT/agents" "Agents"
sync_dir "$COPILOT/wiki" "$ROOT/wiki" "Wiki"

# Hooks: copy files, skip __pycache__ and state/
echo "── Hooks ──"
if [[ -d "$COPILOT/hooks" ]]; then
  if $DRY_RUN; then
    find "$COPILOT/hooks" -type f \
      ! -path "*__pycache__*" ! -path "*/state/*" \
      -exec basename {} \; | while read -r f; do
      echo "  Would sync: $f"
    done
  else
    rsync -a --exclude='__pycache__' \
      --exclude='state/' \
      "$COPILOT/hooks/" "$ROOT/hooks/"
    echo "  ✅ Hooks synced (excluding cache/state)"
  fi
fi
echo ""

echo "Done. Review changes with: git diff --stat"
