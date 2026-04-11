#!/usr/bin/env bash
# Deploy skills from this repo back to ~/.copilot/skills/
# Default: dry-run. Pass --apply to actually deploy.
set -euo pipefail

SRC="$(dirname "$0")/../skills"
DEST="$HOME/.copilot/skills"
BACKUP="$HOME/.copilot/skills-backup-$(date +%Y%m%d-%H%M%S)"
APPLY=false

if [[ "${1:-}" == "--apply" ]]; then
  APPLY=true
fi

SRC="$(cd "$SRC" && pwd)"
echo "Source:      $SRC"
echo "Destination: $DEST"

if ! $APPLY; then
  echo ""
  echo "=== DRY RUN (pass --apply to deploy) ==="
  echo ""
  for skill_dir in "$SRC"/*/; do
    name=$(basename "$skill_dir")
    if [[ "$name" == "*" || "$name" == "README.md" ]]; then
      continue
    fi
    if [[ -d "$DEST/$name" ]]; then
      echo "  Would update: $name"
      diff -rq "$skill_dir" "$DEST/$name" 2>/dev/null || true
    else
      echo "  Would create: $name"
    fi
  done
  echo ""
  echo "Re-run with --apply to deploy changes."
  exit 0
fi

# Backup existing skills
echo "Backing up to: $BACKUP"
cp -r "$DEST" "$BACKUP"

count=0
for skill_dir in "$SRC"/*/; do
  name=$(basename "$skill_dir")
  if [[ "$name" == "*" || "$name" == "README.md" ]]; then
    continue
  fi
  mkdir -p "$DEST/$name"
  cp -r "$skill_dir"* "$DEST/$name/"
  echo "  ✅ Deployed: $name"
  count=$((count + 1))
done

echo ""
echo "Deployed $count skills. Backup at: $BACKUP"
