#!/usr/bin/env bash
# Deploy all global resources from this repo to ~/.copilot/
# Default: dry-run. Pass --apply to actually deploy.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
COPILOT="$HOME/.copilot"
BACKUP="$HOME/.copilot-backup-$(date +%Y%m%d-%H%M%S)"
APPLY=false

if [[ "${1:-}" == "--apply" ]]; then
  APPLY=true
fi

echo "Source: $ROOT"
echo "Target: $COPILOT"
echo ""

deploy_dir() {
  local src="$1" dest="$2" label="$3"
  echo "── $label ──"
  local count=0
  for item in "$src"/*/; do
    local name; name=$(basename "$item")
    [[ "$name" == "*" ]] && continue
    if $APPLY; then
      mkdir -p "$dest/$name"
      cp -r "$item"* "$dest/$name/"
      echo "  ✅ $name"
    else
      if [[ -d "$dest/$name" ]]; then
        echo "  Would update: $name"
      else
        echo "  Would create: $name"
      fi
    fi
    count=$((count + 1))
  done
  echo "  Total: $count"
  echo ""
}

deploy_files() {
  local src="$1" dest="$2" label="$3"
  echo "── $label ──"
  local count=0
  for file in "$src"/*; do
    [[ -f "$file" ]] || continue
    local name; name=$(basename "$file")
    if $APPLY; then
      cp "$file" "$dest/$name"
      echo "  ✅ $name"
    else
      echo "  Would deploy: $name"
    fi
    count=$((count + 1))
  done
  echo "  Total: $count"
  echo ""
}

if ! $APPLY; then
  echo "=== DRY RUN (pass --apply to deploy) ==="
  echo ""
  deploy_dir "$ROOT/skills" "$COPILOT/skills" "Skills"
  deploy_files "$ROOT/instructions" "$COPILOT/instructions" "Instructions"
  deploy_files "$ROOT/scripts/global" "$COPILOT/scripts" "Global Scripts"
  deploy_files "$ROOT/agents" "$COPILOT/agents" "Agents"
  deploy_dir "$ROOT/wiki" "$COPILOT/wiki" "Wiki (read-only)"
  echo "Re-run with --apply to deploy changes."
  exit 0
fi

echo "Backing up $COPILOT → $BACKUP"
cp -r "$COPILOT" "$BACKUP"
echo ""

deploy_dir "$ROOT/skills" "$COPILOT/skills" "Skills"
deploy_files "$ROOT/instructions" "$COPILOT/instructions" "Instructions"
deploy_files "$ROOT/scripts/global" "$COPILOT/scripts" "Global Scripts"
deploy_files "$ROOT/agents" "$COPILOT/agents" "Agents"
deploy_dir "$ROOT/wiki" "$COPILOT/wiki" "Wiki (read-only)"

# Deploy wiki index + log + schema
for wf in "$ROOT/wiki/index.md" "$ROOT/wiki/log.md" "$ROOT/WIKI.md"; do
  [[ -f "$wf" ]] && cp "$wf" "$COPILOT/wiki/$(basename "$wf")"
done

# Hooks: deploy excluding pycache/state
rsync -a --exclude='__pycache__' \
  --exclude='state/' \
  "$ROOT/hooks/" "$COPILOT/hooks/"
echo "── Hooks ──"
echo "  ✅ Deployed (excluding cache/state)"
echo ""

echo "Done. Backup at: $BACKUP"
