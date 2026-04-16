# Ticket Status-Assignment-Work Relationship Model

**Research Ticket**: #118 | **Status**: IN-PROGRESS | **Started**: 2026-04-16
**Continuation**: `ticket-status-recommendations.md`

---

## Session 1 — Operator Design Input (2026-04-16)

1. Manager creates → BACKLOG if unassigned (brief baton, evict)
2. Manager assigns Collaborator → TODO → IN-PROGRESS (branch) → READY-FOR-TESTING
   - RFT gate: all ACs done, latest pulled, no conflicts, commits made
3. Admin receives → TESTING (re-verify branch against latest master)
4. Admin fails → back to Collaborator as TODO (failures noted, ACs unchecked); loop
   - Pass → PASSED-TESTING (merge) → Consultant
5. Consultant approves → CLOSED | Consultant rejects → BACKLOG (notes + unchecked ACs)

---

## Industry Comparison

| System | Status Model | Rework Loop |
|--------|-------------|-------------|
| Jira | Backlog→Todo→In Progress→In Review→Done | QA fail→reopen (informal) |
| Linear | Backlog→Todo→In Progress→Done→Cancelled | None |
| GitLab | Open/Closed + custom Status (Premium) | MR review→rework (author only) |
| MetaGPT | Role SOP handoff (Arch→Eng→QA→Review) | Implicit QA gate only |

**Novel aspects of this model vs. industry:**
- Status and assignee are **bound**: a status transition = role handoff
- No tool enforces "cannot enter TODO without a Collaborator assigned"
- No tool enforces Consultant-reject → BACKLOG with AC unchecking as first-class state

---

## Proposed Status Enum (v0.1)

| # | Status | Role | Forward | Backward |
|---|--------|------|---------|----------|
| 1 | BACKLOG | none | TODO | ← Consultant reject |
| 2 | TODO | Collaborator | IN-PROGRESS | ← TESTING fail |
| 3 | IN-PROGRESS | Collaborator | READY-FOR-TESTING | — |
| 4 | READY-FOR-TESTING | Admin | TESTING | — |
| 5 | TESTING | Admin | PASSED-TESTING | → TODO (fail) |
| 6 | PASSED-TESTING | Consultant | CLOSED | → BACKLOG (reject) |
| 7 | CLOSED | none | — | — |
| 8 | CANCELLED | none | — | — |

## Transition Guards

| Transition | Gate Condition |
|-----------|---------------|
| BACKLOG → TODO | Manager assigns Collaborator; ACs defined |
| TODO → IN-PROGRESS | Collaborator creates branch; emits `baton:collaborator` |
| IN-PROGRESS → READY-FOR-TESTING | All ACs checked; latest pulled; no conflicts; committed |
| READY-FOR-TESTING → TESTING | Admin verifies branch includes latest master |
| TESTING → PASSED-TESTING | All ACs verified; branch merged to master |
| TESTING → TODO | Admin notes failures; unchecks failed ACs; reassigns Collaborator |
| PASSED-TESTING → CLOSED | Consultant approves quality, governance, protocols |
| PASSED-TESTING → BACKLOG | Consultant rejects; notes why; unchecks ACs needing rework |

---

## Session 2 — Operator Decisions (2026-04-16)

**Q1 — BACKLOG ownership**: Manager owns BACKLOG. Tickets are **inactive-open**
while waiting for assignment; **active-open** only while Manager is editing or
considering assignment. Emit `ticket:created` only on creation — no `baton:manager`
until Manager actively assigns.

**Q2 — Rework assignee**: Always returns to the same Collaborator. Multi-ticket
model: Collaborator may hold TODO baton for multiple tickets simultaneously, but
only one ticket is IN-PROGRESS at a time.

**Q3 — Post-rejection assignment**: Consultant comments specifics before
rejecting. Manager sees inactive-open BACKLOG ticket with Consultant note and
unchecked ACs. Manager adds directives and assigns (same or new Collaborator based
on skill and expertise analysis). No Consultant assignment authority.

**Q4 — IN-PROGRESS atomicity**: Stays atomic. Covers the full focused work
period. No sub-states needed.

**Q5 — Merge authority and conflict risk**: Admin is the single merge bottleneck.
Collaborator's pull→test→commit→PR reduces but cannot eliminate conflict chance.
Admin must still pull latest into the branch before testing. See
`ticket-status-merge-research.md` for industry solutions (merge queues, merge
trains) that can automate this redundant pull step.

**Q6 — Cancellation**: Manager only, from any state, reason note required.
Governance option: informal Consultant consultation for tickets past TODO state.

---

## Open Design Questions

See `ticket-status-questions.md` for full exposition — now marked with decisions.
