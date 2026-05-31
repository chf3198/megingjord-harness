# Antigravity worktree pattern howto

For the Antigravity Team operator: how to default to git worktrees rather than committing on the canonical main checkout, restoring G5 portability and matching the harness canonical-main read-only contract.

## Why this matters

Per Phase-0 #2470, the Antigravity Orchestrator runtime historically defaulted to canonical main checkouts because its internal tool-naming convention diverged from the validator allowlist. Post-#2360 the allowlist was widened, and post-#2471 an advisory signer-based guard flags Antigravity-signed commits landing on the trunk branch. This howto documents the operator-side discipline so detections trend toward zero.

## The canonical-main read-only contract

Quoted from instructions/global-standards.instructions.md:

> The main checkout is canonical-only during sessions.
> Writes permitted: ONLY to paths matching .gitignore patterns.
> Writes rejected: tracked files; branch switches off the trunk; commits.

All ticket-bound work happens in ${HOME}/devenv-ops-<ticket-N>/ worktrees.

## Per-ticket worktree workflow

```
# Step 1: set up the worktree for ticket N (run from any cwd)
cd ${HOME}/devenv-ops
git worktree add ${HOME}/devenv-ops-<N> -b <type>/<N>-<slug>
cd ${HOME}/devenv-ops-<N>

# Step 2: bootstrap node_modules link (one-time per worktree)
npm run worktree:bootstrap

# Step 3: do work, commit, push, open PR — ALL inside the worktree
git add <files>
git commit -m "<type>(<scope>): description #<N>"
git push -u origin <type>/<N>-<slug>
gh pr create --title "..." --body "Refs #<N>"

# Step 4: after merge, return to the trunk checkout and cleanup
cd ${HOME}/devenv-ops   # CRITICAL: cd OUT before worktree remove
git worktree remove --force ${HOME}/devenv-ops-<N>
git worktree prune
git pull origin <trunk-branch>
```

## Antigravity Orchestrator-specific notes

1. **Tool invocations**: any apply_patch, create_file, or runtime-equivalent must target paths under the worktree directory, not the canonical checkout.
2. **Cwd discipline**: when the runtime spawns a tool, ensure cwd is set to the worktree path. If the runtime does not expose cwd selection, prefix every shell invocation with `cd ${HOME}/devenv-ops-<N> && ...`.
3. **Branch state**: the worktree starts on its own feature branch. Never switch the worktree branch back to the trunk from within the worktree.
4. **Sync behavior**: if the runtime auto-syncs ~/.copilot/ or similar deployed-runtime paths from the canonical checkout, ensure no sync runs target the canonical checkout — sync from worktree to runtime, not the inverse direction.

## How the Phase-1 guard fires

When MEGINGJORD_ANTIGRAVITY_GUARD=1 is set in the session env, every commit message authored by the team is checked against the Antigravity-team signer pattern. If detected AND the commit lands on the trunk branch, an advisory event is appended to ~/.megingjord/incidents.jsonl:

```json
{"ts":"...","version":3,"service":"antigravity-guard","event":"advisory-detection",
 "pattern_id":"antigravity-commit-on-main","severity":"low","tier":"advisory",
 "evidence":{"signer":"Apollo Harper","branch":"main","message_preview":"..."}}
```

The guard does NOT block the commit — it only logs. Trend monitoring is the goal. As detection counts drop toward zero (worktree pattern adopted), the Phase-2 follow-on could escalate to blocking; until then, the advisory data informs the team.

## Verification checklist

After adopting the pattern, verify:

- `git -C ${HOME}/devenv-ops branch --show-current` returns the trunk name (always)
- `git -C ${HOME}/devenv-ops status` returns a clean working tree (no untracked tracked-like paths)
- Recent commits show branch names matching <type>/<N>-<slug>, NOT direct-on-trunk commits
- `tail -10 ~/.megingjord/incidents.jsonl | jq` filtered on pattern_id antigravity-commit-on-main returns nothing (detection trends to zero)

## Related

- Epic #2362 (parent)
- #2360 (canonical-main allowlist widening — predecessor)
- #2470 (Phase-0 audit — this howto evidence base)
- #2471 (Phase-1 advisory guard)
- instructions/global-standards.instructions.md — canonical-main contract
- Epic #2356 (sibling — broader guardrail hardening)
