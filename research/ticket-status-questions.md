# Ticket Status Model — Design Questions (Q1–Q3)

**Ticket**: #118 | **Part 3 of**: `ticket-status-model.md`
**Continues in**: `ticket-status-questions-2.md` (Q4–Q6)

---


## Q1 — What event fires when a ticket is created with no Collaborator?

**The situation**: Manager creates a ticket. No Collaborator is assigned yet. The
ticket lands in BACKLOG and just sits there waiting for assignment.

**Why it matters**: In the current event-bus.js model, a `baton:manager` event
signals that the Manager is actively holding the baton and working. But if the
Manager just created the ticket and walked away — no active work is happening —
then emitting `baton:manager` is misleading. The dashboard would show the Manager
as the active baton holder for a ticket that is essentially dormant.

**The two options**:
- **Only `ticket:created`**: The ticket appears in the log but no baton changes
  hands. The Manager isn't "holding" anything yet. This is honest.
- **`ticket:created` + `baton:manager`**: The Manager is on the hook until they
  assign someone. This creates accountability pressure to assign promptly.

**What hinges on this**: Whether BACKLOG is a "no-owner" state or a
"Manager-owned" state. That has downstream implications for dashboard rendering
and for how we define the Manager's responsibilities at ticket creation time.

**Decision**: Manager owns BACKLOG. Tickets are inactive-open while waiting;
active-open only when Manager is editing or assigning. Emit `ticket:created` only.
No `baton:manager` until Manager actively assigns a Collaborator.

---

## Q2 — When Admin fails testing, must it return to the same Collaborator?

**The situation**: Admin runs TESTING, finds failures, and needs to send the
ticket back. The ticket returns to TODO status. Your design says the Collaborator
gets it back. The question is: *which* Collaborator?

**Why it matters**: In most cases it should go back to the original Collaborator
— they know the work, they wrote the code, they should fix it. But there are edge
cases: the Collaborator left the project, is on leave, is overloaded, or the
failure reveals the wrong person was assigned from the start.

**The two options**:
- **Same Collaborator always**: The Admin has no say in who fixes it. Consistent,
  but inflexible. Requires the Manager to intervene manually if re-assignment is
  needed (which adds friction).
- **Manager re-assigns on fail**: When Admin sends TESTING→TODO, they flag it as
  a fail but the Manager decides who picks it up. This is more flexible but adds a
  required Manager touch point to every rework cycle — which may slow things down.

**What hinges on this**: How much authority the Admin role has at the TESTING→TODO
transition, and whether the Manager must be in the loop on every rework iteration.

**Decision**: Always returns to the same Collaborator. Collaborator may hold TODO
baton for multiple tickets simultaneously; only one is IN-PROGRESS at a time.

---

## Q3 — After Consultant rejects to BACKLOG, who assigns the next Collaborator?

**The situation**: Consultant reviews PASSED-TESTING work and rejects it, sending
the ticket back to BACKLOG. The ticket now has no active assignee. Someone has to
decide who picks it up and when.

**Why it matters**: This is a role boundary question. The Consultant's job is to
evaluate and close — not to plan or assign. The Manager's job is to assign and
plan. But after a rejection, there's a gap: the ticket is unassigned and the
Manager may not have been in the loop on why it was rejected.

**The two options**:
- **Manager picks up from BACKLOG**: The Consultant rejects and that's the end of
  the Consultant's involvement. The Manager sees the rejection notes, decides whether
  to re-assign the same Collaborator or a different one, and moves the ticket to
  TODO. This respects role boundaries cleanly.
- **Consultant assigns immediately**: To speed things up, the Consultant names a
  Collaborator when rejecting. The ticket goes to BACKLOG but is pre-tagged with
  the next Collaborator, and can move to TODO without a Manager touch point.

**What hinges on this**: Whether BACKLOG always requires a Manager touch point
before anything can move forward, or whether the Consultant can effectively
"plant" the next assignment on their way out.

**Decision**: Manager always picks up from BACKLOG. Consultant comments specifics
of the rejection. Manager reads note, adds directives, assigns same or new
Collaborator based on skill/expertise analysis.

---
