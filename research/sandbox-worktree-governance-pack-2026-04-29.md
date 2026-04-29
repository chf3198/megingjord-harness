# Sandbox Worktree Governance Pack (2026-04-29)

## Summary Table

| Problem | Evidence | Control | Expected outcome |
|---|---|---|---|
| Sandbox branches drift behind `main` | GitHub strict checks and merge drift behavior | Session-start reset to `origin/main` | No stale launcher branches |
| Commits happen on launcher branches | Worktree branch confusion in multi-repo UI | Pre-commit branch guard for `sandbox/*` | Delivery only from task branches |
| CI can pass PR but miss queue behavior | `merge_group` requires explicit workflow trigger | Include merge-group-compatible governance workflow | Merge queue readiness maintained |
| Governance process becomes narrative-only | Prior drift incidents in tickets #142/#161/#162/#574 | Executable audit command + required CI check | Detectable, enforceable compliance |

## Detailed Findings

1. Git worktrees are the right primitive for parallel branch execution, but they need
   explicit lifecycle management (`add/remove/prune/repair/lock`).
   Source: https://git-scm.com/docs/git-worktree

2. Local hooks are valid for fast feedback (`pre-commit`, `pre-push`) and can block
   bad local actions early, while server-side checks remain authoritative.
   Source: https://git-scm.com/docs/githooks

3. GitHub rulesets/protected branches should enforce merge safety in `main`, and
   merge queues require workflow support for `merge_group` events.
   Source: https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-rulesets/available-rules-for-rulesets
   Source: https://docs.github.com/en/actions/using-workflows/events-that-trigger-workflows#merge_group

4. VS Code intentionally shows each worktree as a separate SCM repo; this improves
   parallel visibility but raises operator error risk without branch-role conventions.
   Source: https://code.visualstudio.com/docs/sourcecontrol/branches-worktrees

5. Short-lived task branches with rapid merge/delete reduce integration pain and
   avoid long-lived launcher drift.
   Source: https://trunkbaseddevelopment.com/short-lived-feature-branches/

## Actionable Next Steps

1. Run `npm run governance:worktrees` at session start.
2. Use `npm run worktree:start -- <agent> feat/<issue#>-<slug>` for every new task.
3. Keep `sandbox/*` branches resettable and disposable; never deliver from them.
4. Keep `worktree-governance-required` required in branch protection/rulesets.

## Team&Model

- Human alias: curtisfranks
- Team&Model: GitHub Copilot + GPT-5.3-Codex

Last updated: 2026-04-29T00:00:00Z
