# #578 Research: Readability/commenting standards and tooling

**Type**: research | **Status**: done | **Priority**: P1 | **Lane**: code-change
**Labels**: type:research, status:done, area:governance, area:scripts

**Linked Epic**: #577 | **Blocked by**: none

## Summary
Research best-practice readability and documentation standards for JS/shell repos with no build step.

## Scope
- Evaluate modern formatting/lint toolchains (Prettier, ESLint v9 flat, JSDoc plugins, markdownlint, shellcheck).
- Evaluate comment policy options: required JSDoc contexts, inline comment rules, file headers.
- Evaluate enforcement patterns: pre-commit hooks, PR checks, autofix workflows.
- Produce recommendation matrix with adoption cost and risk.

## Acceptance Criteria
- [x] AC1: Comparative matrix for at least 3 toolchain profiles (strict/balanced/minimal).
- [x] AC2: Proposed standards include naming, function length, magic-number policy, and JSDoc coverage targets.
- [x] AC3: Migration plan includes staged rollout and autofix-first strategy.
- [x] AC4: Research artifact added under research/ with actionable next steps.

## Verification Gates
- **Collaborator**: matrix + recommendation complete.
- **Admin**: feasibility check against existing CI and hooks complete.
- **Consultant**: recommendation quality and risk profile approved.

## MANAGER_HANDOFF
Research must be evidence-backed and include explicit “recommended default profile”.

## Team&Model
- Collaborator: Pending
- Admin: Pending
- Consultant: Pending

## COLLABORATOR_HANDOFF

- Research artifact created: `research/readability-commenting-standards-2026-04-29.md`.
- Included profile matrix (minimal/balanced/strict) and recommended default profile.
- Included migration strategy and actionable next steps.

## ADMIN_HANDOFF

- Feasibility verified against existing stack (`npm`, ESLint flat config, readability lint).
- No build-step requirement preserved.

## CONSULTANT_CLOSEOUT

- Recommendation quality acceptable.
- Risk-balanced default (Balanced profile) chosen for low-cost multi-repo adoption.
