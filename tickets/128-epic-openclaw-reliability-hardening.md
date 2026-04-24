# Ticket 128 — Epic: OpenClaw Reliability Hardening (IT + Harness)

Priority: P1 (High)
Type: Epic
Area: infra
Status: triage (`role:manager`)

## Manager Scope

Objective:
- Restore and harden fleet OpenClaw availability using a two-track plan:
  1) external IT/device hardening first, 2) harness-coupled reliability hardening next.

Children:
- #129 Device-side OpenClaw IT hardening (external IT lane)
- #130 Harness reliability hardening + endpoint consistency
- #131 Cutting-edge web research + wiki evolution for OpenClaw reliability

Acceptance Criteria:
1. Device-side OpenClaw is reachable over tailnet at the fleet endpoint.
2. Harness preflight/dispatch behavior is resilient and endpoint-consistent.
3. Epic includes web research and wiki updates with actionable guidance.
4. Baton protocol and status transitions are captured on child tickets.

## MANAGER_HANDOFF

- Status transition: `backlog -> triage`
- Epic remains manager-owned per epic governance.
- Child tickets created and sequenced: IT first, then harness + research/wiki.

## Epic Progress Update — #129 Complete

- Ticket: #129 — Device-side OpenClaw IT hardening
- Closed: 2026-04-23
- Deliverables: OpenClaw moved from loopback `127.0.0.1:18789` to tailnet `100.78.22.13:4000`; preflight now passes.
- Remaining children: #130, #131