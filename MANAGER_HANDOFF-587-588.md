# MANAGER_HANDOFF: #587 + #588 Haiku Lane Dispatch & Test Coverage

## Scope

**#587** — Fix haiku lane silently falling through to Sonnet in buildDecision()  
**#588** — Fix fleet-dispatch.spec.js AC3 test to cover actual fallback path

## Problem Statement

1. `buildDecision()` in `scripts/global/task-router-dispatch.js` lacks explicit handling for `haiku` lane
2. Mid-complexity tasks (0.3–0.7 complexity) are routed to `haiku` by `model-routing-engine.js` but silently escalate to Sonnet
3. Cost impact: 0.08× (haiku) vs 1.0× (Sonnet) = 12.5× cost multiplier difference  
4. Test suite lacks coverage for the unreachable-endpoint fallback chain

## Acceptance Criteria

### #587 AC1-AC4
- **AC1**: `buildDecision()` handles `haiku` lane with `action: 'recommend-haiku'`
- **AC2**: Telemetry records `lane: 'haiku'` (not `lane: 'premium'`) for mid-complexity dispatches
- **AC3**: Test in `tests/fleet-dispatch.spec.js` covers haiku lane decision path
- **AC4**: `recommend-haiku` action does not escalate to Sonnet unless Haiku unavailable

### #588 AC1-AC4
- **AC1**: Test exercises `buildDecision()` with unreachable `primaryUrl`
- **AC2**: Test verifies fallback URL is tried when primary returns `ok: false`
- **AC3**: Test verifies `action: 'fleet-unavailable'` when both URLs fail
- **AC4**: Test verifies `outcome: 'fail'` in emitted telemetry

## Implementation Plan

### Files to Edit
1. **scripts/global/task-router-dispatch.js** — Add haiku case to `buildDecision()`
2. **tests/fleet-dispatch.spec.js** — Add haiku classification test + fallback endpoint test

### Verification Gates
- Lint: All files ≤100 lines (enforced)
- Tests: `npm test` passes 100%
- Governance: ADR-010 labels correct on both issues after merge
- Readability: Code follows existing patterns (try/catch, action naming)

## Blockers & Dependencies
- None — both changes are self-contained
- #588 test can execute without #587 impl (will classify haiku but see recommend-sonnet)

## Role Handoff Sequence
1. **Collaborator** — Implement both AC sets, write tests
2. **Admin** — Validate CI/governance gates, merge
3. **Consultant** — Independent critique of scope, risk, and decisions
