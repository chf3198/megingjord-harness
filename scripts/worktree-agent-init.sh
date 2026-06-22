#!/usr/bin/env bash
# scripts/worktree-agent-init.sh — per-agent worktree init helpers.
# Refs #3103. Sourced by worktree-session-start.sh.
# Adds: .env copy for antigravity, hooks path for antigravity.
set -euo pipefail

log() { echo "[$(date -u +%Y-%m-%dT%H:%M:%SZ)] $*"; }

# #3103: copy .env from main checkout for runtimes that need it.
# Currently: antigravity (gitignored sandbox .env incident, D-6).
copy_env_if_needed() {
  local agent="$1" worktree_root="$2"
  if [[ "$agent" != "antigravity" ]]; then return 0; fi
  local main_root
  main_root="$(git worktree list --porcelain | awk '/^worktree /{print $2; exit}')"
  if [[ -z "$main_root" || ! -f "$main_root/.env" ]]; then
    log ".env copy: no main .env found at $main_root; skipping"
    return 0
  fi
  if [[ -f "$worktree_root/.env" ]]; then
    log ".env copy: already present at $worktree_root/.env; skipping"
    return 0
  fi
  cp "$main_root/.env" "$worktree_root/.env"
  log ".env copy: $main_root/.env → $worktree_root/.env"
}

# Refs #2946: create the task branch in an ISOLATED worktree directory rather
# than switching the current (possibly canonical-main) checkout in place. An
# in-place branch switch stalls the moment a ticket needs new tracked files,
# because the canonical-main checkout is read-only for tracked paths (#2995).
# Depends on bootstrap_node_modules / configure_per_worktree_hooks / die from
# the sourcing worktree-session-start.sh (resolved at call time).
create_task_worktree() {
  local agent="$1" task_branch="$2"
  local ticket_num worktree_dir
  ticket_num="$(echo "$task_branch" | grep -oP '(?<=/)[0-9]+(?=-)' | head -1)"
  [[ -n "$ticket_num" ]] || die "cannot parse ticket number from task branch '$task_branch'"
  worktree_dir="$HOME/devenv-ops-${ticket_num}"
  [[ -e "$worktree_dir" ]] && die "worktree dir already exists: $worktree_dir (remove it first)"
  git worktree add "$worktree_dir" -b "$task_branch"
  bootstrap_node_modules "$worktree_dir"
  configure_per_worktree_hooks "$worktree_dir"
  copy_env_if_needed "$agent" "$worktree_dir"
  node "$worktree_dir/scripts/global/worktree-lifecycle-gate.js" --session-diagnosis 2>/dev/null || true
  log "worktree ready: $worktree_dir ($task_branch) — cd \"$worktree_dir\", implement, open PR with Refs #${ticket_num}"
}
