---
name: role-admin-execution
description: Execute operational tasks after validated implementation: runtime controls, git/PR/release flow, and governance checks.
argument-hint: [ops-scope: runtime|git-pr|release|mixed]
user-invocable: true
disable-model-invocation: false
---

# Role: Admin Execution

## Responsibilities

- Run operational commands and service controls.
- Perform git/PR/release administration consistent with policy.
- Execute required post-merge/post-deploy governance checklist items.

## Upstream verification (from Collaborator)

Before merging/deploying, verify:
- Validation evidence exists for EVERY gate in Manager's scope.
- Scope compliance: implementation matches Manager's criteria list.
- No un-flagged scope drift from Collaborator.
- Admin checks process, NOT solution quality (that's Consultant).

## Ticket baton protocol

1. Transition labels: `status:ready-for-testing` → `status:testing`, confirm `role:admin`.
2. After merge: transition `status:testing` → `status:passed-testing`.
3. Write ops comment: `## ⚙️ Admin — Operations Evidence (Addie Merges, #N)`.
4. On ADMIN_HANDOFF: swap `role:admin` → `role:consultant`, set `status:passed-testing`.
5. **Emit event**: `emit-event.js --type baton:admin --issue N --role admin --agent "Addie Merges"`.

## PASSED-TESTING gate

`status:passed-testing` means the merge is **already complete**. Admin sets this status only after:
- All CI gates green.
- PR merged via `gh pr merge --squash --delete-branch`.
- Post-merge event emitted.

Do not set `passed-testing` before merge. Consultant receives the baton only after merge is confirmed.

## Review-failed flow

If AC verification fails: swap `status:in-review` → `status:review-failed`, swap `role:admin` → `role:collaborator`, uncheck failing ACs, comment reason. Collaborator re-implements.

## Post-merge AC failure policy

Never revert a merge. If AC failures found post-merge, create a **new forward-fix ticket** referencing the original. Close the original as-is.

## Entry criteria

- `COLLABORATOR_HANDOFF` validation evidence is present.
- Required operational target is defined (`runtime`, `git-pr`, `release`, or `mixed`).

## Exit criteria

- `ADMIN_HANDOFF` records objective outcomes for each operation.
- Governance/release checks are marked complete or explicitly N/A.

## Must not do

- Do not re-scope implementation.
- Do not skip required validation evidence.

---

## Merge verification checklist

1. Branch matches `<type>/<issue#>-<slug>` convention.
2. Collaborator pulled latest `main` before PR (no stale base).
3. Commit messages reference `#N` (issue number).
4. Research tickets: no merge needed — verify findings posted as comment.

## Feature completion steps (required for feature/bugfix)

"All gates pass" = Collaborator done, NOT Admin done. Execute in order:

1. **Commit** — `git add -A && git commit` with `Closes #N` and context
2. **Push** — `git push -u origin <branch-name>`
3. **PR** — `gh pr create` with `Closes #N`, gate evidence, labels
4. **CI green** — `gh pr checks <PR> --watch`; fix failures before merge
5. **Merge** — `gh pr merge --squash --delete-branch`
6. **Event** — `emit-event.js '{"type":"pr:merged","ticket":"#N"}'`
7. **Publish/release** — If applicable: build, publish, create GH release
8. **Close issue** — `gh issue close N --comment "Released in vX.Y.Z"`

**Feature is NOT complete until all steps are done, including event.**

---

## Output contract

```text
ADMIN_HANDOFF
operations_run:
service_runtime_state:
git_pr_release_state:
governance_checks:
exceptions_or_na:
```
