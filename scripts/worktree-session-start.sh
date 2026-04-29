#!/usr/bin/env bash
set -euo pipefail

log() { echo "[$(date -u +%Y-%m-%dT%H:%M:%SZ)] $*"; }
die() { log "ERROR: $*"; exit 1; }
warn() { log "WARN: $*"; exit 2; }

if [[ $# -lt 1 || $# -gt 2 ]]; then
  echo "Usage: bash scripts/worktree-session-start.sh <copilot|codex|claude-code> [feat/<ticket#>-<slug>]"
  exit 1
fi

agent="$1"
task_branch="${2:-}"

case "$agent" in
  copilot|codex|claude-code) ;;
  *) die "invalid agent '$agent' (expected: copilot|codex|claude-code)" ;;
esac

if [[ -n "$task_branch" && ! "$task_branch" =~ ^(feat|fix|hotfix)/[0-9]+-[a-z0-9][-a-z0-9]*$ ]]; then
  die "invalid task branch '$task_branch' (expected feat/<ticket#>-<slug>)"
fi

sandbox="sandbox/$agent"
root="$(git rev-parse --show-toplevel 2>/dev/null || true)"
[[ -n "$root" ]] || die "not inside a git repository"

cd "$root"
log "syncing sandbox launcher branch: $sandbox"

git fetch origin --prune
if ! git show-ref --verify --quiet "refs/heads/$sandbox"; then
  die "missing local sandbox branch '$sandbox'"
fi

git switch "$sandbox"
git reset --hard origin/main
git clean -fd

if [[ -z "$task_branch" ]]; then
  log "sandbox refreshed at origin/main; no task branch requested"
  exit 0
fi

if git show-ref --verify --quiet "refs/heads/$task_branch"; then
  warn "task branch already exists locally: $task_branch"
fi

git switch -c "$task_branch"
log "ready on task branch: $task_branch"
log "next: implement scoped changes and open PR with Refs #<ticket>"
