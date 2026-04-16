# Ticket Status Model — Recommendations & Design Notes

**Ticket**: #118 | **Part 2 of**: `ticket-status-model.md`

---

## Agent Recommendations (v0.1 — for operator review)

**R1 — Status IS the role contract.**
Unlike Jira/Linear where status and assignee are independent fields, this model
binds them: `{status, assignedRole}` is a compound record. A status transition
without an assignment change is invalid. This is the core design insight.

**R2 — The rework loop is the most novel and valuable part.**
No PM tool enforces Admin→fail→same-Collaborator with AC unchecking. This is a
genuine protocol innovation. It should be a first-class governance gate, not a
convention.

**R3 — READY-FOR-TESTING is the Collaborator's Definition of Done.**
The three conditions (all ACs checked, latest pulled, no conflicts) should become
an explicit checklist in the issue template — not a guideline, a gate.

**R4 — PASSED-TESTING should encode the merge, not just Admin approval.**
If PASSED-TESTING means "approved but not yet merged", you have a dangerous
intermediate state where approved work lives on an unmerged branch. Recommend:
merge happens during TESTING→PASSED-TESTING, status is set after merge confirms.

**R5 — Consultant rejection to BACKLOG is a powerful quality gate.**
No major tool has this. It creates full accountability loops. Recommend: use only
for governance failures (wrong protocol, security, scope breach), not style. Strict
criteria should be documented in the Consultant role skill.

**R6 — Align event-bus.js CLOSED_STATUSES after adoption.**
Current set: `{closed, cancelled, done}`. When this model is adopted, update to:
`{closed, cancelled}` (done→passed-testing pathway changes). Add status-to-role
mapping so event bus can validate baton ownership on each transition.

---

## Design Tensions to Resolve

**Tension A — Who owns READY-FOR-TESTING?**
The status is "waiting for Admin". Is the assignee still the Collaborator (who
pushed to RFT) or the Admin (who will test)? Recommend: assignee changes to Admin
the moment RFT is set, making the handoff explicit.

**Tension B — PASSED-TESTING timing.**
Two valid interpretations: (a) merge happens and THEN status is set PASSED-TESTING,
or (b) Admin sets PASSED-TESTING and THEN hands to Consultant who merges.
Recommend (a): merge is an Admin action, not a Consultant action. Consultant
only evaluates the result.

**Tension C — Baton events vs. status transitions.**
Should every status change emit a baton event, or only role-handoff transitions?
Current baton events: `baton:manager`, `baton:collaborator`, `baton:admin`,
`baton:consultant`. Recommend: status changes within a role (TODO→IN-PROGRESS by
Collaborator) emit `ticket:status` only. Role-handoff transitions (IN-PROGRESS→
READY-FOR-TESTING) emit both `ticket:status` + `baton:<next-role>`.

---

## How This Maps to event-bus.js Architecture

```
Current:  CLOSED_STATUSES = {closed, cancelled, done}
Proposed: CLOSED_STATUSES = {closed, cancelled}

New status-role binding (proposed):
  STATUS_ROLE_MAP = {
    backlog: null,
    todo: 'collaborator',
    'in-progress': 'collaborator',
    'ready-for-testing': 'admin',
    testing: 'admin',
    'passed-testing': 'consultant',
    closed: null,
    cancelled: null
  }
```

This would allow `event-bus.js` to validate that a `baton:*` event matches
the expected role for the current status. Mismatches surface as console warnings.

---

## Next Steps (post operator feedback)

1. Resolve Q1–Q6 from `ticket-status-model.md`
2. Resolve Tensions A, B, C above
3. Draft ADR-008: Canonical Ticket Lifecycle and Status-Role Binding
4. Update `role-baton-routing.instructions.md` with the full status enum
5. Update `ticket-log.js` STATUS_META to include all 8 states
6. Update `event-bus.js` CLOSED_STATUSES and add STATUS_ROLE_MAP
