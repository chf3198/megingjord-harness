#!/usr/bin/env bash
# Sync skills from ~/.copilot/skills/ into this repo
# Usage: bash scripts/sync-skills.sh [--dry-run]
set -euo pipefail

SRC="$HOME/.copilot/skills"
DEST="$(dirname "$0")/../skills"
DRY_RUN=false

if [[ "${1:-}" == "--dry-run" ]]; then
  DRY_RUN=true
  echo "=== DRY RUN — no changes will be made ==="
fi

if [[ ! -d "$SRC" ]]; then
  echo "❌ Source not found: $SRC"
  exit 1
fi

DEST="$(cd "$DEST" && pwd)"
echo "Source:      $SRC"
echo "Destination: $DEST"
echo ""

count=0
for skill_dir in "$SRC"/*/; do
  name=$(basename "$skill_dir")
  if [[ "$name" == "*" ]]; then continue; fi
  target="$DEST/$name"

  if $DRY_RUN; then
    echo "  Would sync: $name"
  else
    mkdir -p "$target"
    cp -r "$skill_dir"* "$target/" 2>/dev/null || true
    echo "  ✅ Synced: $name"
  fi
  count=$((count + 1))
done

echo ""
echo "Total skills: $count"
if $DRY_RUN; then
  echo "Re-run without --dry-run to apply."
fi
