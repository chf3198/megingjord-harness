# Ticket 161 — Governance Verifier v3 (Ready-SLA + Queue Checks)

Priority: P1 (High)
Type: Task
Area: scripts
Status: ready
Parent: #155

## Manager Scope

Objective:
- Extend governance verification checks for `ready` age SLA and merge-queue CI compatibility.

Acceptance Criteria:
1. Verifier reports stale P0/P1 `ready` tickets >24h without blocker note.
2. Verifier checks required workflow coverage for `merge_group` where queue gates apply.
3. JSON output includes machine-readable remediation hints.

## MANAGER_HANDOFF

- Status transition: `triage -> ready`.
