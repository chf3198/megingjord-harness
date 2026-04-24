# Ticket 132 — Epic: Fleet Live Usage Indicator (Low Overhead)

Priority: P1 (High)
Type: Epic
Area: infra
Status: triage (`role:manager`)

## Manager Scope

Objective:
- Provide live, low-resource usage visibility on fleet devices without reducing inference capacity.

Children:
- #133 Research: live indicator options + constraints + wiki evolution
- #134 Implement terminal-first low-overhead live indicator
- #135 Remote view workflow (open terminal/browser/app on fleet devices)

Execution Order (mandatory):
1. Complete #133 first (research + wiki updates).
2. Then execute #134 and #135 using #133 findings.

Acceptance Criteria:
1. Research includes current-state validation and cutting-edge references.
2. Terminal-first indicator runs with minimal overhead on both fleet devices.
3. Remote viewing workflow is documented and repeatable.
4. Wiki is updated with validated operational guidance.
5. No implementation ticket starts before #133 is complete.

## MANAGER_HANDOFF

- Status transition: `backlog -> triage`
- Epic remains manager-owned; child tickets carry active role baton.

## Epic Progress Update — #134 Complete

- Ticket: #134 — Implement terminal-first low-overhead live indicator
- Closed: 2026-04-23
- Deliverables: live terminal indicators, single-line rendering, stress harnesses, and UAT telemetry.
- Remaining children: #135

## Epic Progress Update — #135 Complete

- Ticket: #135 — Remote fleet view workflow
- Closed: 2026-04-23
- Deliverables: terminal-first remote view workflow and UAT process with real prompt/response visibility.
- Remaining children: none