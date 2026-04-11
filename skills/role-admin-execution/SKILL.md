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

## Entry criteria

- `COLLABORATOR_HANDOFF` validation evidence is present.
- Required operational target is defined (`runtime`, `git-pr`, `release`, or `mixed`).

## Exit criteria

- `ADMIN_HANDOFF` records objective outcomes for each operation.
- Governance/release checks are marked complete or explicitly N/A.

## Must not do

- Do not re-scope implementation.
- Do not skip required validation evidence.

## Escalation triggers

- Operational preconditions fail.
- Release/governance integrity checks fail.

---

## Feature Completion Checklist (required for any feature/bugfix work)

**"All validation gates pass" = Collaborator done. It does NOT mean Admin done.**

When COLLABORATOR_HANDOFF is received for feature or bugfix work, execute these steps in order. Do not stop after gates pass; do not ask the user to do any of these steps.

1. **Version collision check**
   - If `vscode-extension/` changed: confirm `package.json` version is not already published to Marketplace
   - If collision: bump patch version in `package.json` and both CHANGELOGs before committing
   - Command: `npx vsce show CurtisFranks.mem-watchdog-status --json 2>/dev/null | node -e "..."`

2. **Commit**
   - `git add -A && git commit -m "type(scope): imperative description"`
   - Commit body must include `Closes #N` for the linked issue
   - Include "why" (failure mode or root cause) per repo commit format

3. **Push**
   - `git push -u origin <branch-name>`

4. **PR creation**
   - `gh pr create --title "..." --body "..." --label "..." --milestone "..."`
   - Body must include: `Closes #N`, gate-suite evidence (test counts, shellcheck, docs-integrity results)
   - Assign labels: type label + domain label + priority label

5. **Wait for CI green**
   - Poll: `gh pr checks <PR-number> --watch`
   - Do NOT merge with any failing check — fix root cause first

6. **Merge**
   - `gh pr merge <PR-number> --merge` (or `--squash` per repo policy)
   - Never push directly to main; always go through PR + CI

7. **Extension publish** (if `vscode-extension/` changed)
   - `cd vscode-extension && npm run build && source ../.env && npx vsce publish --pat "$VSCE_PAT"`
   - Confirm Marketplace version matches `package.json` after publish

8. **Release integrity check**
   - `bash scripts/release-integrity-check.sh --post-publish`
   - Must pass all checks; fix any failures before proceeding

9. **GitHub Release object**
   - `gh release create vX.Y.Z --title "vX.Y.Z — <feature title>" --notes "..."`
   - Releases must exist for every published Marketplace version

10. **Close source issue**
    - `gh issue close N --comment "Released in vX.Y.Z (Marketplace) — <brief summary>"`

**A feature is NOT complete until all applicable steps above are done.**

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
