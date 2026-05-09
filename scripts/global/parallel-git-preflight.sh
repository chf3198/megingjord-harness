#!/usr/bin/env bash
set -euo pipefail

ts() { date -u +%Y-%m-%dT%H:%M:%SZ; }
log() { echo "[$(ts)] $*"; }

mode="manual"
local_ref=""
remote_ref=""
while [[ $# -gt 0 ]]; do
  case "$1" in
    --mode) mode="${2:-manual}"; shift 2 ;;
    --local-ref) local_ref="${2:-}"; shift 2 ;;
    --remote-ref) remote_ref="${2:-}"; shift 2 ;;
    *) log "WARN: unknown arg '$1'"; shift ;;
  esac
done

errors=0
warnings=0
repo_root="$(git rev-parse --show-toplevel 2>/dev/null || true)"
[[ -n "$repo_root" ]] || { log "ERROR: not in git repository"; exit 1; }
branch="$(git rev-parse --abbrev-ref HEAD 2>/dev/null || echo DETACHED)"

fail() { log "ERROR: $*"; errors=$((errors + 1)); }
warn() { log "WARN: $*"; warnings=$((warnings + 1)); }

valid='^(main|master|sandbox/[a-z0-9._-]+|(feat|fix|chore|docs|style|test|refactor|perf|release|hotfix)/[a-z0-9._-]+)$'
[[ "$branch" =~ $valid ]] || fail "branch '$branch' violates naming policy"

worktree_count="$(git worktree list --porcelain | awk -v b="refs/heads/$branch" '/^branch /{if($2==b)c++} END{print c+0}')"
[[ "$worktree_count" -le 1 ]] || fail "branch '$branch' is active in $worktree_count worktrees"

upstream="$(git rev-parse --abbrev-ref --symbolic-full-name '@{upstream}' 2>/dev/null || true)"
if [[ -z "$upstream" ]]; then
  warn "no upstream configured for '$branch'"
else
  counts="$(git rev-list --left-right --count "$upstream...HEAD")"
  behind="$(awk '{print $1}' <<<"$counts")"
  ahead="$(awk '{print $2}' <<<"$counts")"
  [[ "$behind" -eq 0 ]] || fail "branch behind upstream by $behind commit(s)"
  [[ "$ahead" -lt 50 ]] || warn "branch ahead by $ahead commit(s); consider rebasing"
fi

if [[ -n "$local_ref" ]] && [[ "$local_ref" != "refs/heads/$branch" ]]; then
  fail "local ref '$local_ref' does not match HEAD '$branch'"
fi

if [[ -n "$remote_ref" ]]; then
  target="${remote_ref#refs/heads/}"
  case "$branch" in
    release/*|hotfix/*) [[ "$target" == "main" ]] || fail "'$branch' must target main" ;;
    sandbox/*) [[ "$target" == sandbox/* ]] || fail "'$branch' must target sandbox/*" ;;
    feat/*|fix/*|chore/*|docs/*|style/*|test/*|refactor/*|perf/*)
      [[ "$target" != "main" && "$target" != "master" ]] || fail "feature branches cannot target $target"
      ;;
  esac
fi

audit_log="$HOME/.megingjord/git-preflight.log"
mkdir -p "$(dirname "$audit_log")"
printf '{"ts":"%s","mode":"%s","cwd":"%s","branch":"%s","local_ref":"%s","remote_ref":"%s","errors":%s,"warnings":%s}\n' \
  "$(ts)" "$mode" "$(pwd)" "$branch" "$local_ref" "$remote_ref" "$errors" "$warnings" >> "$audit_log"

if [[ "$errors" -gt 0 ]]; then
  log "preflight failed ($errors errors, $warnings warnings)"
  exit 1
fi
if [[ "$warnings" -gt 0 ]]; then
  log "preflight warning state ($warnings warning(s))"
  exit 2
fi
log "preflight passed"
exit 0