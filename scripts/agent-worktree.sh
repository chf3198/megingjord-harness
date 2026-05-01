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

WORKTREE_DIR="$REPO_ROOT/.harness/worktrees/$VENDOR"
CURRENT_BRANCH="$(git rev-parse --abbrev-ref HEAD)"

mkdir -p "$REPO_ROOT/.harness/worktrees"

if [[ -d "$WORKTREE_DIR/.git" ]] || [[ -f "$WORKTREE_DIR/.git" ]]; then
  echo "Worktree already exists at: $WORKTREE_DIR"
  echo "  $(cd "$WORKTREE_DIR" && git rev-parse --abbrev-ref HEAD 2>/dev/null || echo 'unknown branch')"
  echo "$WORKTREE_DIR"
  exit 0
fi

# Create new worktree based on current branch tip
git worktree add "$WORKTREE_DIR" "$CURRENT_BRANCH" >&2 || {
  echo "Error: git worktree add failed; check that branch '$CURRENT_BRANCH' is suitable" >&2
  exit 4
}

echo "Created worktree for vendor='$VENDOR' at:"
echo "$WORKTREE_DIR"
