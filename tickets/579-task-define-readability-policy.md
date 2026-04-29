# #579 Task: Define enforceable readability and commenting policy

**Type**: task | **Status**: done | **Priority**: P1 | **Lane**: code-change
**Labels**: type:task, status:done, area:governance

**Linked Epic**: #577 | **Blocked by**: #578

## Summary
Convert research outcome into concrete repository policy docs and examples.

## Scope
- Create/update policy docs for formatting, naming, function size, comments, and JSDoc requirements.
- Define required contexts for JSDoc and acceptable inline-comment patterns.
- Define exception process and suppression rules.

## Acceptance Criteria
- [x] AC1: Policy clearly states MUST/SHOULD rules for readability and comments.
- [x] AC2: Includes before/after examples for common smell classes.
- [x] AC3: Includes language-specific sections (JS, shell, markdown).
- [x] AC4: Includes suppression governance (when allowed, how documented).

## Verification Gates
- **Collaborator**: policy docs complete and internally consistent.
- **Admin**: policy is enforceable with available tools.
- **Consultant**: policy balances strictness with maintainability.

## MANAGER_HANDOFF
Policy must be enforceable by tooling; avoid subjective-only language.

## Team&Model
- Collaborator: Pending
- Admin: Pending
- Consultant: Pending

## COLLABORATOR_HANDOFF

- Policy instruction created: `instructions/readability-commenting-governance.instructions.md`.
- Added enforceable standards, rollout model, language-specific rules, and examples.

## ADMIN_HANDOFF

- Policy is enforceable by tooling (`lint:readability`, ESLint/JSDoc, formatter checks).
- Scope aligns with harness-global governance direction.

## CONSULTANT_CLOSEOUT

- Policy clarity and maintainability acceptable for staged rollout.
- Suppression governance documented and constrained.
