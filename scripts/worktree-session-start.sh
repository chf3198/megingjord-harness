#!/usr/bin/env bash
set -euo pipefail

log() { echo "[$(date -u +%Y-%m-%dT%H:%M:%SZ)] $*"; }
die() { log "ERROR: $*"; exit 1; }
warn() { log "WARN: $*"; exit 2; }

# #1378: auto-link node_modules; idempotent.
bootstrap_node_modules() {
  local worktree_root="$1"
  local main_root resolved
  main_root="$(git worktree list --porcelain | awk '/^worktree /{print $2; exit}')"
  if [[ -z "$main_root" || ! -d "$main_root/node_modules" ]]; then
    log "node_modules bootstrap: no main checkout node_modules found at $main_root; skipping"
    return 0
  fi
  if [[ -L "$main_root/node_modules" ]]; then
    resolved="$(readlink -f "$main_root/node_modules" 2>/dev/null || echo BROKEN)"
    if [[ "$resolved" == "BROKEN" || "$resolved" == "$main_root/node_modules" ]]; then
      log "node_modules bootstrap: main's node_modules is a broken/self-symlink at $main_root; skipping (see #1539 / #1548)"
      return 0
    fi
  fi
  if [[ "$worktree_root" == "$main_root" ]]; then
    log "node_modules bootstrap: this IS the main checkout; nothing to link"
    return 0
  fi
  if [[ -e "$worktree_root/node_modules" ]]; then
    log "node_modules bootstrap: already present at $worktree_root/node_modules; skipping"
    return 0
  fi
  ln -sf "$main_root/node_modules" "$worktree_root/node_modules"
  log "node_modules bootstrap: linked $worktree_root/node_modules → $main_root/node_modules"
}

# C4 (#2105): set per-worktree core.hooksPath (Fix #2).
configure_per_worktree_hooks() {
  local worktree_root="$1"
  local hooks_path=""
  if [[ -d "$HOME/.codex/devenv-ops/hooks/scripts" ]]; then
    hooks_path="$HOME/.codex/devenv-ops/hooks/scripts"
  elif [[ -d "$HOME/.copilot/hooks/scripts" ]]; then
    hooks_path="$HOME/.copilot/hooks/scripts"
  fi
  if [[ -z "$hooks_path" ]]; then
    log "per-worktree hooks: no deployed hooks dir found; skipping core.hooksPath"
    return 0
  fi
  git -C "$worktree_root" config extensions.worktreeConfig true 2>/dev/null || true
  git -C "$worktree_root" config --worktree core.hooksPath "$hooks_path"
  log "per-worktree hooks: core.hooksPath → $hooks_path"
}
# shellcheck source=scripts/worktree-agent-init.sh
source "$(dirname "$0")/worktree-agent-init.sh" # Refs #3103
if [[ $# -lt 1 || $# -gt 2 ]]; then
  echo "Usage: bash scripts/worktree-session-start.sh <copilot|codex|claude-code|antigravity> [feat/<ticket#>-<slug>]"
  exit 1
fi

agent="$1"
task_branch="${2:-}"

case "$agent" in
  copilot|codex|claude-code|antigravity) ;;
  *) die "invalid agent '$agent' (expected: copilot|codex|claude-code|antigravity)" ;;
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
bootstrap_node_modules "$root"
configure_per_worktree_hooks "$root"
copy_env_if_needed "$agent" "$root"
log "ready on task branch: $task_branch"
