#!/usr/bin/env bash
# Layer 2 worktree convention (#738 / ADR-012)
# Idempotently creates a per-vendor worktree at .harness/worktrees/<vendor>/
# Usage: scripts/agent-worktree.sh <vendor>
# Vendors: codex | copilot | continue | cursor
set -euo pipefail

VALID_VENDORS=("codex" "copilot" "continue" "cursor")
VENDOR="${1:-}"

if [[ -z "$VENDOR" ]]; then
  echo "Usage: $0 <vendor>" >&2
  echo "  vendor: ${VALID_VENDORS[*]}" >&2
  exit 1
fi

VALID=0
for v in "${VALID_VENDORS[@]}"; do
  if [[ "$v" == "$VENDOR" ]]; then VALID=1; break; fi
done
if [[ $VALID -eq 0 ]]; then
  echo "Error: '$VENDOR' is not a recognized vendor" >&2
  echo "  valid: ${VALID_VENDORS[*]}" >&2
  exit 2
fi

# Confirm we're inside a git repo
REPO_ROOT="$(git rev-parse --show-toplevel 2>/dev/null || true)"
if [[ -z "$REPO_ROOT" ]]; then
  echo "Error: not inside a git repository" >&2
  exit 3
fi

# #3088: dedicated-IDE runtimes (cursor, antigravity) get a STANDING SIBLING worktree
# (devenv-ops-<vendor>) on a sandbox/<vendor> branch — their IDE opens it as workspace root.
# Other vendors keep the nested .harness/worktrees/<vendor> convention (ADR-012).
DEDICATED_IDE=("cursor" "antigravity")
IS_DEDICATED=0
for v in "${DEDICATED_IDE[@]}"; do [[ "$v" == "$VENDOR" ]] && IS_DEDICATED=1; done
if [[ $IS_DEDICATED -eq 1 ]]; then
  WORKTREE_DIR="$(cd "$REPO_ROOT/.." && pwd)/$(basename "$REPO_ROOT")-$VENDOR"
else
  WORKTREE_DIR="$REPO_ROOT/.harness/worktrees/$VENDOR"
  mkdir -p "$REPO_ROOT/.harness/worktrees"
fi
# Standing worktrees use a dedicated sandbox/<vendor> branch — NOT the current branch, which
# avoids "fatal: 'main' is already checked out" when run from the main checkout (Cursor UAT note).
WORKTREE_BRANCH="sandbox/$VENDOR"

if [[ -d "$WORKTREE_DIR/.git" ]] || [[ -f "$WORKTREE_DIR/.git" ]]; then
  echo "Worktree already exists at: $WORKTREE_DIR"
  echo "  $(cd "$WORKTREE_DIR" && git rev-parse --abbrev-ref HEAD 2>/dev/null || echo 'unknown branch')"
  echo "$WORKTREE_DIR"
  exit 0
fi

git fetch origin --quiet 2>/dev/null || true
if git show-ref --verify --quiet "refs/heads/$WORKTREE_BRANCH"; then
  git worktree add "$WORKTREE_DIR" "$WORKTREE_BRANCH" >&2          # reuse existing local branch
elif git show-ref --verify --quiet "refs/remotes/origin/$WORKTREE_BRANCH"; then
  git worktree add -b "$WORKTREE_BRANCH" "$WORKTREE_DIR" "origin/$WORKTREE_BRANCH" >&2  # remote-only branch
else
  git worktree add -b "$WORKTREE_BRANCH" "$WORKTREE_DIR" "$(git rev-parse --verify origin/main 2>/dev/null || echo HEAD)" >&2  # fresh from main
fi || { echo "Error: git worktree add failed for branch '$WORKTREE_BRANCH'" >&2; exit 4; }

# Provision per config/worktree-provisioning.json (links node_modules + .env from main, #3088).
node "$REPO_ROOT/scripts/global/worktree-provision.js" --main="$REPO_ROOT" >&2 \
  || echo "warn: worktree-provision skipped" >&2

echo "Created worktree for vendor='$VENDOR' (branch $WORKTREE_BRANCH) at:"
echo "$WORKTREE_DIR"
