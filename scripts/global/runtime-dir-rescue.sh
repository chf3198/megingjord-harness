#!/usr/bin/env bash
# Runtime-dir rescue (Epic #3576 W-A / A5; ADR-021 "operative ruleset is the working tree").
# Brings a team's live-policy runtime dir under LOCAL version control WITHOUT committing
# secrets or ephemeral state. Strategy: DEFAULT-DENY .gitignore + explicit policy allowlist
# + fail-closed staged-credential backstop (G4). Idempotent.
# Usage: runtime-dir-rescue.sh <runtime-dir> <team> <allowlist-path>...
set -euo pipefail
DIR="${1:?usage: runtime-dir-rescue.sh <dir> <team> <allow>...}"
TEAM="${2:?team required}"; shift 2
ALLOW=("$@")
[ -d "$DIR" ] || { echo "no such dir: $DIR" >&2; exit 2; }
cd "$DIR"

# 1. default-deny .gitignore + allowlist (regenerated each run; secrets/ephemeral stay ignored)
{
  echo "# Managed by runtime-dir-rescue.sh (Epic #3576 W-A / ADR-021)."
  echo "# DEFAULT-DENY: nothing is tracked unless explicitly allowlisted below."
  echo "# auth.json, *.sqlite*, sessions/, cache/, tokens & all other state stay IGNORED (G4)."
  echo "*"
  echo '!.gitignore'
  for p in "${ALLOW[@]}"; do
    if [ -d "$p" ]; then printf '!%s/\n!%s/**\n' "${p%/}" "${p%/}"; else printf '!%s\n' "$p"; fi
  done
} > .gitignore

# 2. init if needed
[ -d .git ] || git init -q

# 3. stage per gitignore
git add -A

# 4. fail-closed backstop: refuse to commit if any staged content matches a credential VALUE class
LEAK=$(git diff --cached -U0 2>/dev/null | grep -aE \
  'sk-[A-Za-z0-9]{20,}|ghp_[A-Za-z0-9]{36}|github_pat_[A-Za-z0-9_]{40,}|AKIA[0-9A-Z]{16}|-----BEGIN [A-Z ]*PRIVATE KEY-----|eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}' \
  || true)
if [ -n "$LEAK" ]; then
  echo "ABORT ($TEAM): staged content matches a credential pattern (G4); not committing." >&2
  git reset -q; exit 3
fi

# 5. report + snapshot
N=$(git diff --cached --name-only | wc -l | tr -d ' ')
echo "[$TEAM] staging $N policy file(s):"; git diff --cached --name-only | sed 's/^/  /'
if git diff --cached --quiet; then
  echo "[$TEAM] nothing new to snapshot (already current)"
else
  git -c commit.gpgsign=false -c core.hooksPath=/dev/null commit -q -m \
"chore(rescue): version-control $TEAM live-policy surface (#3580)

Default-deny snapshot of the policy plane; secrets & ephemeral state excluded (G4).
Epic #3576 W-A A5 / ADR-021 (operative ruleset is the working tree)."
fi
echo "[$TEAM] $DIR is a git repo @ $(git -C "$DIR" rev-parse --short HEAD)"
