#!/usr/bin/env bash
# Deploy resources to ~/.copilot/. Default: dry-run. Pass --apply to deploy.
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
  echo "── Dashboard ── Would deploy: index.html + css/ + js/"
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

# Dashboard: static assets (HTML + css/ + js/)
echo "── Dashboard ──"
mkdir -p "$COPILOT/dashboard/css" "$COPILOT/dashboard/js"
cp "$ROOT/dashboard/index.html" "$COPILOT/dashboard/"
cp "$ROOT"/dashboard/css/*.css "$COPILOT/dashboard/css/"
cp "$ROOT"/dashboard/js/*.js "$COPILOT/dashboard/js/"
echo "  ✅ Dashboard deployed"
echo ""

for wf in "$ROOT/wiki/index.md" "$ROOT/wiki/log.md" "$ROOT/WIKI.md"; do
  [[ -f "$wf" ]] && cp "$wf" "$COPILOT/wiki/$(basename "$wf")"
done
rsync -a --exclude='__pycache__' --exclude='state/' "$ROOT/hooks/" "$COPILOT/hooks/"
echo "── Hooks ── ✅ Deployed (excluding cache/state)"
echo ""
echo "Done. Backup at: $BACKUP"
