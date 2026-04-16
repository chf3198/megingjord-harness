# Ticket Status Model — Design Questions (Q4–Q6)

**Ticket**: #118 | **Part 4 of**: `ticket-status-model.md`
**Previous**: `ticket-status-questions.md` (Q1–Q3)

---


## Q4 — Should IN-PROGRESS be one status or three?

**The situation**: Right now IN-PROGRESS covers everything from "Collaborator
started" to "Collaborator finished and is ready to push". That span includes:
creating the branch, doing the actual work, running local tests, and making the
final commits that satisfy all ACs. That's a lot of ground for one label.

**Why it matters**: If the dashboard or event log can only see IN-PROGRESS, you
have no visibility into where within that span the work is. A ticket could be
IN-PROGRESS for 10 minutes (just branched) or 10 days (deeply stuck mid-coding)
and both look the same. For oversight and drift detection, finer granularity helps.

**The cost of splitting**: More statuses mean more transitions, more baton events,
more gate conditions to define, and more things that can go wrong. If the
Collaborator has to manually update status every time they push a commit, that's
friction that reduces compliance. The protocol becomes harder to follow.

**The three sub-states (if split)**:
- `BRANCHED`: Work has started, branch exists, no meaningful code yet
- `IN-PROGRESS`: Active development underway
- `READY-TO-COMMIT` or `COMMITTING`: ACs met locally, final commit sequence in
  progress before pushing to READY-FOR-TESTING

**What hinges on this**: How much observability vs. simplicity you want at the
Collaborator stage.

**Decision**: IN-PROGRESS stays atomic. Covers the full focused work period.

---

## Q5 — Does the merge happen before or after PASSED-TESTING is set?

**The situation**: Admin completes TESTING and everything passes. At some point the
branch needs to be merged into master. PASSED-TESTING is then set. The question is
the order: does the merge happen first (and PASSED-TESTING confirms it), or does
PASSED-TESTING get set first (and the merge happens as part of the handoff to
Consultant)?

**Why it matters**: This is a correctness and safety question. If PASSED-TESTING
means "Admin approved but not yet merged", you have a window — potentially days —
where approved work exists on an unmerged feature branch. During that window:
the Consultant could review code that never lands, or master could advance and
create conflicts that invalidate the approval. This is a dangerous intermediate
state.

**What hinges on this**: Who holds merge authority and what PASSED-TESTING certifies.

**Decision**: Admin is the single merge bottleneck. Collaborator's pull→test→commit→PR
reduces conflict chance; Admin still must pull before testing. PASSED-TESTING means
merge has already happened and been verified. See `ticket-status-merge-research.md`
for industry automation options (merge queue, merge trains).

---

## Q6 — Who can cancel a ticket, from which states, under what conditions?

**The situation**: CANCELLED needs to be a valid terminal state because sometimes
work becomes irrelevant before it finishes — requirements change, a duplicate
ticket is found, the feature is descoped. But CANCELLED is dangerous if it can be
used casually to bypass governance (e.g., someone cancels a ticket to avoid a
failing Consultant review).

**Why it matters**: Unlike CLOSED (which requires Consultant approval through the
full lifecycle), CANCELLED is a shortcut to a terminal state. Without guards, it
can be misused to "escape" the protocol. It also interacts with the event bus:
CANCELLED tickets should be evicted from the active baton just like CLOSED ones.

**The questions inside Q6**:
- **Who can cancel?** Manager only? Manager + Admin? Any role?
- **From which states?** Only pre-work states (BACKLOG, TODO)? Or any state
  including IN-PROGRESS? What about cancelling during TESTING?
- **What must be documented?** A CANCELLED ticket without a reason note is an
  audit gap. Should a reason be required before the transition is allowed?
- **Is there a time-lock?** Should a ticket that has reached IN-PROGRESS or later
  require Manager + a second role to cancel, to prevent unilateral escape?

**Decision**: Manager only, from any state, with a required reason note.
Optional governance: informal Consultant consultation for tickets past TODO.
No other role may cancel.
