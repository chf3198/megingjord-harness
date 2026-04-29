# #582 Task: Scripts readability and commenting remediation wave

**Type**: task | **Status**: ready | **Priority**: P1 | **Lane**: code-change
**Labels**: type:task, status:ready, role:collaborator, area:scripts

**Linked Epic**: #577 | **Blocked by**: #580

## Summary
Refactor global/wiki/hook scripts for readability and required JSDoc/inline comments.

## Scope
- Add JSDoc to public script functions and module exports.
- Add intent comments for non-obvious control flow and failure handling.
- Rename unclear variables and extract magic values.
- Normalize CLI argument parsing docs in file headers.

## Acceptance Criteria
- [ ] AC1: Public functions in touched script files have compliant JSDoc.
- [ ] AC2: Critical error paths include rationale comments.
- [ ] AC3: Readability warnings in scripts scope reduced by at least 60%.
- [ ] AC4: Script smoke checks + lint pass.

## Verification Gates
- **Collaborator**: scripted remediation complete with evidence deltas.
- **Admin**: CI and runtime smoke checks pass.
- **Consultant**: maintainability and onboarding clarity improved.

## MANAGER_HANDOFF
Prioritize scripts with highest operational blast radius first.

## Team&Model
- Collaborator: Pending
- Admin: Pending
- Consultant: Pending
