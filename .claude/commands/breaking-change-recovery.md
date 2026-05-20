---
description: "Execute the six-phase breaking-change recovery workflow: Detect, Revert, Triage, Fix, Re-merge with smoke, Casualty re-author."
argument-hint: "sha or issue number of the breaking change (e.g. abc1234 or #1917)"
---

# Breaking-Change Recovery

Loads `instructions/breaking-change-recovery.instructions.md` and runs the
governed recovery workflow for the breaking change identified by `$ARGUMENTS`.

## Phase guidance

### 1. Detect
Confirm the breaking change: runtime crash, CI regression, or schema rejection.
Classify severity (P0/P1/P2). Post `INCIDENT_OPEN` on the causal issue.

### 2. Revert
`git revert <sha> --no-edit`. Record `reverted_sha` and `revert_sha`.
List casualty branches/tickets in the `INCIDENT_OPEN` comment.

### 3. Triage ticket
File `fix: [description]` child ticket with `type:bug`, correct priority,
`status:triage`, `role:manager`. Include `smoke_requirements` in MANAGER_HANDOFF.

### 4. Fix
Branch: `fix/<triage-ticket#>-<slug>`. Run pre-commit hooks. Add regression test.
Obtain peer-review comment before push.

### 5. Re-merge with smoke
Post `SMOKE_EVIDENCE` comment in PR body:
- Agent runtime starts without error
- Regression test passes
- Hook fires correctly (for schema/hook fixes)
- Affected team confirms unblocked (P0 only)

### 6. Casualty re-author
For each casualty: close original with `resolution:superseded`, file new ticket
with `Refs #N`, rebase on clean main post-fix.

## References
- Full protocol: `instructions/breaking-change-recovery.instructions.md`
- Escalation source: `instructions/workflow-resilience.instructions.md`
- Worked example: #1917 → #1951 → #1952 → c857ce8 → #1953 → #1954
