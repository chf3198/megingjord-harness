#!/usr/bin/env bash
# pre-push-branch-check.sh — HAMR Wave 5 child 3 (#934).
# v3.2.2 §R9.2.1 hook contract: blocks push when HEAD branch ≠ refspec being pushed.
# Reads stdin lines from git: "<local_ref> <local_sha> <remote_ref> <remote_sha>".
set -euo pipefail

current_branch=$(git rev-parse --abbrev-ref HEAD)
repo_root=$(git rev-parse --show-toplevel)
preflight="$repo_root/scripts/global/parallel-git-preflight.sh"
audit_log="${HOME}/.megingjord/branch-ops-audit.log"
mkdir -p "$(dirname "$audit_log")"

if [ -x "$preflight" ]; then
  set +e
  "$preflight" --mode pre-push
  rc=$?
  set -e
  if [ "$rc" -eq 1 ]; then
    echo "Refusing push: parallel git preflight failed."
    exit 1
  fi
fi

DELETE_SHA="0000000000000000000000000000000000000000"
violations=0
while IFS=' ' read -r local_ref local_sha remote_ref _remote_sha; do
  [ -z "${local_ref:-}" ] && continue
  local_branch=${local_ref#refs/heads/}
  # A1 fix (#989): skip mismatch check on branch-delete refspec.
  # Git sets local_sha to all-zeros when pushing a delete (e.g., `git push --delete`).
  is_delete="false"
  [ "$local_sha" = "$DELETE_SHA" ] && is_delete="true"
  if [ "$is_delete" = "false" ] && [ -x "$preflight" ]; then
    set +e
    "$preflight" --mode pre-push --local-ref "$local_ref" --remote-ref "$remote_ref"
    preflight_rc=$?
    set -e
    if [ "$preflight_rc" -eq 1 ]; then
      violations=$((violations + 1))
    fi
  fi
  if [ "$is_delete" = "false" ] && [ "$local_branch" != "$current_branch" ]; then
    echo "❌ R9.2.1 violation: pushing $local_branch but HEAD is $current_branch"
    echo "    cwd: $(pwd)"
    echo "    refspec: $local_ref → $remote_ref"
    violations=$((violations + 1))
  fi
  printf '{"ts":%s,"op":"pre-push","cwd":"%s","head":"%s","local_ref":"%s","remote_ref":"%s","local_sha":"%s","is_delete":%s,"violation":%s}\n' \
    "$(date +%s%3N)" "$(pwd)" "$current_branch" "$local_ref" "$remote_ref" "$local_sha" "$is_delete" \
    "$([ "$is_delete" = "false" ] && [ "$local_branch" != "$current_branch" ] && echo true || echo false)" >> "$audit_log"
done

if [ "$violations" -gt 0 ]; then
  echo "Refusing push: $violations cwd-vs-branch mismatch(es). See ~/.megingjord/branch-ops-audit.log."
  exit 1
fi
exit 0
