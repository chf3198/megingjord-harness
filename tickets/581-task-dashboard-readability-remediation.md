# #581 Task: Dashboard readability remediation wave

**Type**: task | **Status**: ready | **Priority**: P1 | **Lane**: code-change
**Labels**: type:task, status:ready, role:collaborator, area:dashboard

**Linked Epic**: #577 | **Blocked by**: #580

## Summary
Refactor dashboard JS for readability and required in-file documentation.

## Scope
- Eliminate single-letter variables unless conventional loop indices.
- Split oversized functions to policy limits.
- Replace magic numbers with named constants.
- Add/normalize JSDoc for exported/public functions and key render paths.

## Acceptance Criteria
- [ ] AC1: Dashboard readability warning count reduced by at least 70% from baseline.
- [ ] AC2: All dashboard exported/public functions include JSDoc per policy.
- [ ] AC3: Function-length and naming violations addressed in priority files.
- [ ] AC4: Dashboard tests and lint pass.

## Verification Gates
- **Collaborator**: refactor + docs complete with no behavior regressions.
- **Admin**: regression checks and CI pass verified.
- **Consultant**: readability gain validated against baseline.

## MANAGER_HANDOFF
Refactor in small batches; preserve UI behavior and avoid unrelated redesign.

## Team&Model
- Collaborator: Pending
- Admin: Pending
- Consultant: Pending
