# Ticket 154 — Governance Verification Harness v2

Priority: P1 (High)
Type: Task
Area: scripts
Status: ready
Parent: #147

## Manager Scope

Objective:
- Extend governance verification checks to enforce new SLA/evidence and CI queue rules.

Acceptance Criteria:
1. Checklist validates `ready` SLA compliance and closure evidence presence.
2. Checklist validates merge-queue `merge_group` compatibility where applicable.
3. Output format is consumable by Admin/Consultant closeout phases.

## MANAGER_HANDOFF

- Status transition: `triage -> ready`

## BLOCKER_NOTE

- owner: manager
- unblock_condition: begin after verifier v3 adoption period baseline is collected.
- eta_or_review_time: 2026-04-30 governance queue review.
