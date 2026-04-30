# Ticket 130 — Harness-coupled OpenClaw Reliability Hardening

Priority: P1 (High)
Type: Task
Area: scripts
Status: ready
Parent: #128

## Manager Scope

Objective:
- Harden DevEnv Ops Harness behavior now that device-side OpenClaw is reachable.

Acceptance Criteria:
1. `openclaw-chat` resolves fleet endpoint dynamically (not localhost-only default).
2. Preflight, chat health, and dispatch use consistent endpoint strategy.
3. Fleet execute path degrades gracefully with fallback decision when gateway is unhealthy.
4. Validation evidence captured (preflight + execute + health checks).

Constraints:
- Keep changes minimal and localized.
- Preserve existing lane policy semantics.
- Keep files under repository lint limits.

## MANAGER_HANDOFF

- Status transition: `triage -> ready`
- Ready for collaborator implementation under branch:
  - `feat/130-openclaw-harness-reliability-hardening`

## BLOCKER_NOTE

- owner: collaborator (OpenClaw integration)
- unblock_condition: #128 epic (OpenClaw infrastructure) reaches `status:ready` with preflight/dispatch stable
- eta_or_review_time: manager review by 2026-05-07 governance queue