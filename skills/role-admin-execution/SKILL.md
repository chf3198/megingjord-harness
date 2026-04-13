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

## Ticket baton protocol

1. Transition labels: `status:in-progress` → `status:review`, confirm `role:admin`.
2. Write ops comment: `## ⚙️ Admin — Operations Evidence` listing commit/PR/CI/merge.
3. On ADMIN_HANDOFF: swap `role:admin` → `role:consultant`.

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

## Feature completion steps (required for feature/bugfix)

"All gates pass" = Collaborator done, NOT Admin done. Execute in order:

1. **Version check** — If extension changed: confirm version not already published
2. **Commit** — `git add -A && git commit` with `Closes #N` and "why" context
3. **Push** — `git push -u origin <branch-name>`
4. **PR** — `gh pr create` with `Closes #N`, gate evidence, labels, milestone
5. **CI green** — `gh pr checks <PR> --watch`; fix failures before merge
6. **Merge** — `gh pr merge --merge` (or `--squash`); never push to main directly
7. **Publish/release** — If applicable: build, publish, create GH release
8. **Close issue** — `gh issue close N --comment "Released in vX.Y.Z"`

**Feature is NOT complete until all applicable steps are done.**

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
