# #577 Epic: Readability and commenting hardening across codebase

**Type**: epic | **Status**: in-progress | **Priority**: P1 | **Lane**: code-change
**Labels**: type:epic, status:in-progress, role:collaborator, area:governance, area:scripts, area:dashboard

## Summary
Establish and enforce modern readability/commenting standards, then remediate existing code smells across JS and shell assets.

## Baseline Smell Snapshot (Manager audit)
- `npm run lint:readability` reports 389 warnings.
- JS coverage sample: ~94 JS files, ~6212 JS lines, ~15 JSDoc blocks.
- Dominant smells: long functions, single-letter names, magic numbers, weak inline documentation.

## Objective
Adopt cut-through tooling and standards so new code is consistently pretty, self-documenting, and reviewable.

## Scope
- Research and decide standards (formatting + comment/JSDoc policy).
- Add and wire tools in repo and CI.
- Package governance/tooling as harness-global install assets for downstream repos.
- Remediate existing smells in prioritized waves.
- Add regression guards to prevent future drift.

## Acceptance Criteria
- [x] AC1: Readability/commenting standards documented with rationale and examples.
- [x] AC2: Formatting + lint/comment tools configured and runnable locally and CI.
- [x] AC3: Global harness install path distributes readability/commenting governance to repos that opt in.
- [ ] AC4: Existing major smell classes remediated in dashboard and scripts.
- [x] AC5: Policy gates block regressions for formatting/readability/commenting.
- [ ] AC6: All remediation tickets closed with evidence and lint/test pass.

## Verification Gates
- **Manager**: Scope locked, smell baseline recorded.
- **Collaborator**: Standards, tooling, and code changes implemented.
- **Admin**: CI/workflow gates operational, branch/PR governance validated.
- **Consultant**: Risk review and closeout of residual readability debt.

## Children
- #578 Research readability/commenting standards and toolchain
- #579 Define enforceable policy + examples + migration rules
- #580 Install and wire prettify/lint/comment tooling in repo+CI
- #581 Dashboard remediation wave: naming, function-size, magic numbers, docs
- #582 Scripts remediation wave: JSDoc + inline comments + readability
- #583 Regression-prevention gates: hooks, CI checks, and autofix workflow

## MANAGER_HANDOFF
Scope approved. Start with #578 research before any broad code rewrite.

## Team&Model
- Manager (Scope): GitHub Copilot (GPT-5.3-Codex), 2026-04-29
- Collaborator: ACTIVE — #578/#579/#580/#583 complete, #581/#582 next
- Admin: Pending
- Consultant: Pending
