# Workflow Learnings (pointer index)

Thin chronological index. Full prose lives in the canonical home
[[workflow-learnings]] (`wiki/wisdom/project/research/workflow-learnings.md`) per Epic #3124 D4 —
one fact, one home, no duplicated prose. Each line points to its source ticket + the wiki entry.

## 2026-06-02

- #2617 — explicit overlap boundaries at manager handoff. See [[workflow-learnings]].
- #2626 — bound fleet calls with a timeout or guarded wrapper. See [[workflow-learnings]].

## 2026-06-07

- #2569 — never prompt the client for a credential already in local `.env`. See [[workflow-learnings]].

## 2026-06-08

- #2730 — multi-close batching is for inseparable single-diff work only. See [[workflow-learnings]].
- #2735 — advisory doc-coverage gate hid six bugs; fail-closed + spawnSync. See [[workflow-learnings]].
- #2726/#2737 — pretool hook state path + record `admin_ops.merge` after REST merge. See [[workflow-learnings]].
- #2726 — post all baton artifacts before `gh pr create`. See [[workflow-learnings]].
- #2697 — unbounded fleet calls stall the session. See [[workflow-learnings]].
- #3016 — a validator gated on an arg the caller never passes is dead code. See [[workflow-learnings]].
- #3098/#1948 — phantom completion: closed-with-prose but never merged. See [[workflow-learnings]].

## 2026-06-19

- #3121/#2716 — second phantom class: merged-but-unwired; need a wiring test. See [[workflow-learnings]].
- #3124/#3127 — drain MEMORY.md to pointers; measure with `npm run resident:budget`. See [[workflow-learnings]].

## 2026-06-23

- #3204/#2252 — stale MANAGER_HANDOFF without `worktree_branch:` bypassed #2876; authoritative latest-handoff gate added. See [[workflow-learnings]].

## 2026-06-24

- #3243/#3242 — file-editing tools on non-workspace worktree paths trigger VS Code auth dialogs on every call; use shell commands (sed -i, cat, patch) for paths outside registered workspace. See [[worktree-tool-boundary]].

## 2026-06-28

- #3290/#3284 — W2 keystone: the `baton-authority/merge` check re-derives the baton trail from GitHub truth (issue comments/labels/PR state) and Merkle-verifies the evidence digest; a stale local `admin_ops` cache can never authorize merge. See [[workflow-learnings]].
