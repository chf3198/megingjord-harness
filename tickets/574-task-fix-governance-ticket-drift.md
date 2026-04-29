# #574 Task: Fix governance and ticket-state drift from #567

**Type**: task | **Status**: done | **Priority**: P1 | **Lane**: code-change
**Labels**: type:task, status:done, area:governance, area:tickets

**Linked Epic**: #573 | **Blocked by**: none

## Summary
Repair ticket hygiene drift so #567 artifacts reflect factual outcomes and governance rules.

## Scope
- Reconcile #567/#571/#572 AC checkboxes with measured evidence.
- Replace non-binary AC markers with pass/fail statements and explicit variance notes.
- Correct baton section ordering and closeout semantics.
- Ensure status labels match real completion state.

## Acceptance Criteria
- [x] AC1: No non-binary AC markers remain in #567/#571/#572.
- [x] AC2: Every checked AC has direct evidence; unmet ACs are unchecked with cause.
- [x] AC3: Admin and Consultant handoff text aligns with role protocol and outcome truth.
- [x] AC4: Lint passes after ticket corrections.

## Verification Gates
- **Collaborator**: ticket corrections + evidence mapping complete.
- **Admin**: governance sanity pass complete.
- **Consultant**: closeout integrity approved.

## Team&Model
- Collaborator: Pending
- Admin: Pending
- Consultant: Pending

## ADMIN_HANDOFF

- Corrected #567/#571/#572 away from optimistic done-state semantics.
- Replaced warning markers with binary checkbox truth and explicit cause notes.
- Verified ticket files remain within lint line limits.

## CONSULTANT_CLOSEOUT

- Ticket integrity restored for the remediation target set.
- Outcome truth now matches measured evidence and governance protocol.
