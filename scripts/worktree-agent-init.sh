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
