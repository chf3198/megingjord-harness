# Epic #1466 Phase-0 — Agent Baton fidelity diagnosis
Date: 2026-05-13

## Summary Table
| Topic | Finding |
|---|---|
| Incident | Baton showed non-active tickets and missed actively worked tickets. |
| Likely root | Event/label normalization gaps between event bus and GitHub sync paths. |
| Risk | Parallel team work can be hidden or misrepresented in live baton panel. |
| Next step | Ship mapping + filtering fixes with regression coverage before broader UI changes. |

## Findings (code-path audit)
1. `dashboard/js/event-bus.js` keeps `_batonTickets` only when incoming events include `role`.
2. `dashboard/js/event-bus.js` defines `STATUS_ROLE_MAP` but does not apply it to infer role from `status`.
3. `dashboard/js/github-sync.js` resolves `status`/`activeRole`, but this reconciliation does not guarantee baton-map hydration for active items.
4. `dashboard/js/baton-flow.js` renders from normalized baton state, so upstream omission causes missing active rows.
5. Closed-status eviction is event-driven; if close/state drift arrives asymmetrically, stale active rows can survive until pruned.

## Reproduction Matrix
| Scenario | Expected | Observed risk |
|---|---|---|
| `status:in-progress` set, no `role:*` label/event yet | Visible as active collaborator row | Can be omitted from baton map |
| Parallel Claude/Copilot active tickets | Both rows visible independently | One stream can dominate if role/event hydration is incomplete |
| Ticket moved to done/closed | Removed from active baton quickly | Can remain stale if close event path misses baton map state |

## Recommended Delivery Sequence
1. **Mapping hardening**: infer role from status when explicit role is absent.
2. **Active filter hardening**: use authoritative active-status set and explicit closed-state eviction.
3. **Parallel-feed tests**: synthetic two-team event streams validating independent visibility.
4. **Verification artifact**: before/after screenshots + event traces.

## Last-updated
2026-05-13T00:00:00Z

## Actionable Next Steps
1. Implement mapper + baton hydration fix in `event-bus.js` / `github-sync.js`.
2. Add regression tests for missing-role active tickets and parallel-team visibility.
3. Publish post-fix evidence against incident screenshot behavior.

Signed-by: Nova Mason
Team&Model: copilot:gpt-5.3-codex@github
Role: manager