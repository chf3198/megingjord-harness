## Summary

<!-- One-line description of what this PR does -->

## Linked Issue

Refs #<!-- issue number -->

## Merge Evidence

<!-- PREFERRED: deferred-finalize marker — satisfies merge-evidence gate WITHOUT auto-closing
     the issue on merge. Consultant retains explicit terminal-finalize authority and closes
     the issue manually via `gh issue close #N` after CONSULTANT_CLOSEOUT is posted. -->
merge-evidence-deferred-final: #<!-- issue number -->

<!-- BACKWARD COMPAT: `Closes #N` remains accepted by merge-evidence-pr-gate and triggers
     GitHub auto-close on merge. Use only when Consultant-explicit-close is not required. -->

## Changes

<!-- Bullet list of what changed -->

## Role Evidence

<!-- IMPORTANT: Baton CI gates check the LINKED ISSUE (#N above), not this PR body.
     Post each artifact as a comment on the linked issue. Strings here do NOT satisfy gates. -->

- **Manager**: <!-- link to MANAGER_HANDOFF comment on linked issue -->
- **Collaborator**: <!-- link to COLLABORATOR_HANDOFF comment on linked issue -->
- **Admin**: <!-- link to ADMIN_HANDOFF comment on linked issue -->
- **Consultant**: <!-- link to CONSULTANT_CLOSEOUT comment on linked issue -->

## Test strategy

<!-- Per instructions/test-methodology-matrix.instructions.md.
     Must match MANAGER_HANDOFF.test_strategy on linked issue. -->

- Strategy: <!-- tdd-pyramid|tdd-trophy|contract-test|golden-file|eval-harness|visual-regression|drift-lint|peer-review|manual-verify|stress-test|none -->
- Evidence artifact: <!-- spec file path / fixture path / VISUAL_QA_EVIDENCE link / "see linked issue MANAGER_HANDOFF" -->

## Validation

- [ ] `npm run lint` — clean
- [ ] `npm test` — all pass (or N/A per matrix)
- [ ] CHANGELOG updated
- [ ] Docs synced to behavioral changes
- [ ] `test-evidence` gate passes (consumes test_strategy from linked issue MANAGER_HANDOFF)

## Risk

<!-- low / medium / high — and why -->
