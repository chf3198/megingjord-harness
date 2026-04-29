# #575 Task: Build reproducible fleet benchmark runner

**Type**: task | **Status**: done | **Priority**: P1 | **Lane**: code-change
**Labels**: type:task, status:done, area:scripts, area:infra

**Linked Epic**: #573 | **Blocked by**: #574

## Summary
Create a deterministic benchmark tool for Ollama fleets to replace ad-hoc one-off terminal scripts.

## Scope
- Add script under scripts/global/ to benchmark cold/warm latency and tokens/sec.
- Emit structured JSON output + compact markdown summary.
- Capture HTTP status, timeout class, and model memory errors.
- Add retries and per-device timeout policy.

## Acceptance Criteria
- [x] AC1: Script accepts device list and prompt payload as input.
- [x] AC2: Script outputs machine-readable JSON with per-device/per-model metrics.
- [x] AC3: Error taxonomy included (timeout, memory, transport, HTTP-5xx).
- [x] AC4: At least one test validates output schema.
- [x] AC5: Lint/tests pass.

## Verification Gates
- **Collaborator**: script + tests complete.
- **Admin**: runner executes successfully on current fleet endpoints.
- **Consultant**: data quality and reproducibility approved.

## Team&Model
- Collaborator: Pending
- Admin: Pending
- Consultant: Pending

## ADMIN_HANDOFF

- Added `scripts/global/fleet-benchmark-runner.js`.
- Produced rerun evidence at `test-results/573-benchmark-rerun.json`.
- Verified taxonomy via `tests/fleet-remediation-runners.spec.js`.

## CONSULTANT_CLOSEOUT

- Benchmark runner is reproducible, deterministic, and machine-readable.
- Error capture quality improved materially over ad-hoc terminal execution.
