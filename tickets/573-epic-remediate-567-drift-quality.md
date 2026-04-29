# #573 Epic: Remediate Epic #567 drift and engineering quality gaps

**Type**: epic | **Status**: done | **Priority**: P1 | **Lane**: code-change
**Labels**: type:epic, status:done, area:governance, area:infra, area:scripts

## Summary
Remediate governance/process drift and engineering-quality defects introduced during #567 execution, then re-validate benchmark/deploy evidence with reproducible tooling.

## Objective
Restore ticket integrity (binary AC truthfulness, baton correctness), harden benchmark execution quality, and produce reliable rollout evidence.

## Scope
- Correct ticket state and AC truth values for #567/#571/#572.
- Implement reproducible benchmark + rollout tooling (timeouts, retries, error capture).
- Re-run benchmarks and rollout validation using hardened scripts.
- Publish objective evidence and finalize Consultant closeout.

## Acceptance Criteria
- [x] AC1: #567/#571/#572 statuses and AC markers reflect factual outcomes only (no optimistic closeout drift).
- [x] AC2: New benchmark runner committed with deterministic output format (JSON + summary table).
- [x] AC3: New rollout runner committed with pull progress tracking and bounded retry policy.
- [x] AC4: Evidence rerun completed on all reachable devices; each failure has machine-readable reason.
- [x] AC5: Lint/tests pass and all files remain within line-limit policy.

## Verification Gates
- **Manager**: remediation scope + ACs locked.
- **Collaborator**: tooling + evidence produced.
- **Admin**: ops execution verified, deploy gate verified.
- **Consultant**: residual-risk critique and final closeout.

## Children
- #574 Fix governance/ticket drift from #567
- #575 Build reproducible benchmark runner
- #576 Build robust remote rollout runner and rerun evidence

## Team&Model
- Manager: Pending
- Collaborator: Pending
- Admin: Pending
- Consultant: Pending

## ADMIN_HANDOFF

- Completed child remediation tasks #574, #575, and #576.
- Produced reproducible evidence artifacts for benchmark and rollout reruns.
- Revalidated repo policy with lint and focused tests passing.

## CONSULTANT_CLOSEOUT

- Drift remediated to acceptable standard.
- Residual operational risk remains in fleet connectivity/performance, not in process or tooling quality.
