// baton-fsm-invariants.spec.js — Contract tests for FSM model checker.
// Asserts all 7 invariants proven on canonical table AND detects
// injected violations (non-vacuous). Refs #3289, Epic #3284.
'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { checkInvariants } = require(
  '../scripts/global/baton-fsm/verify/model-checker'
);
const {
  STATES, EVENTS, EVIDENCE_BITS, TRANSITIONS,
} = require('../scripts/global/baton-fsm/transitions');

// ---- Canonical table: all invariants must be proven ----

describe('FSM invariants on canonical transition table', () => {
  const result = checkInvariants();

  it('allProven is true', () => {
    assert.equal(result.allProven, true,
      'Expected all invariants proven; got: ' +
      JSON.stringify(result.invariants, null, 2));
  });

  it('I1: no DONE without complete baton trail', () => {
    assert.equal(result.invariants.I1.proven, true,
      'I1 counterexample: ' + JSON.stringify(result.invariants.I1.counterexample));
  });

  it('I2: at most one execution role per state', () => {
    assert.equal(result.invariants.I2.proven, true,
      'I2 counterexample: ' + JSON.stringify(result.invariants.I2.counterexample));
  });

  it('I3: no deadlock in non-terminal states', () => {
    assert.equal(result.invariants.I3.proven, true,
      'I3 counterexample: ' + JSON.stringify(result.invariants.I3.counterexample));
  });

  it('I4: terminal states are sinks', () => {
    assert.equal(result.invariants.I4.proven, true,
      'I4 counterexample: ' + JSON.stringify(result.invariants.I4.counterexample));
  });

  it('I5: all states reachable from backlog', () => {
    assert.equal(result.invariants.I5.proven, true,
      'I5 counterexample: ' + JSON.stringify(result.invariants.I5.counterexample));
  });

  it('I6: disposition required for terminal transitions', () => {
    assert.equal(result.invariants.I6.proven, true,
      'I6 counterexample: ' + JSON.stringify(result.invariants.I6.counterexample));
  });

  it('I7: signer independence on admin gate', () => {
    assert.equal(result.invariants.I7.proven, true,
      'I7 counterexample: ' + JSON.stringify(result.invariants.I7.counterexample));
  });

  it('stats reflect canonical table dimensions', () => {
    assert.equal(result.stats.stateCount, 11);
    assert.equal(result.stats.eventCount, 12);
    assert.equal(result.stats.transitionCount, TRANSITIONS.length);
  });
});

// ---- Mutation tests: checker has teeth ----

describe('FSM model checker detects injected violations', () => {

  it('I1 violation: direct backlog->done with zero evidence', () => {
    const mutated = [
      ...TRANSITIONS,
      {
        fromState: STATES.BACKLOG,
        event: EVENTS.CONSULTANT_CLOSEOUT,
        toState: STATES.DONE,
        requiredMask: EVIDENCE_BITS.CONSULTANT_CLOSEOUT | EVIDENCE_BITS.PR_MERGED,
      },
    ];
    const result = checkInvariants(mutated);
    assert.equal(result.invariants.I1.proven, false,
      'I1 should detect missing baton trail on shortcut to DONE');
    assert.ok(result.invariants.I1.counterexample,
      'I1 should provide a counterexample');
    assert.ok(result.invariants.I1.counterexample.missingBits > 0,
      'I1 counterexample should report missing bits');
  });

  it('I3 violation: orphaned non-terminal state', () => {
    // Remove all transitions FROM the READY state
    const mutated = TRANSITIONS.filter(
      row => row.fromState !== STATES.READY
    );
    const result = checkInvariants(mutated);
    assert.equal(result.invariants.I3.proven, false,
      'I3 should detect deadlock when READY has no outgoing transitions');
    assert.ok(result.invariants.I3.counterexample,
      'I3 should provide a counterexample');
  });

  it('I6 violation: CANCELLED without DISPOSITION_RECORDED', () => {
    const mutated = TRANSITIONS.map(row => {
      if (row.toState === STATES.CANCELLED &&
          row.fromState === STATES.BACKLOG) {
        return { ...row, requiredMask: 0 };
      }
      return row;
    });
    const result = checkInvariants(mutated);
    assert.equal(result.invariants.I6.proven, false,
      'I6 should detect CANCELLED without DISPOSITION_RECORDED');
    assert.ok(result.invariants.I6.counterexample,
      'I6 should provide a counterexample');
  });

  it('I7 violation: ADMIN_HANDOFF without SIGNER_INDEPENDENT', () => {
    const mutated = TRANSITIONS.map(row => {
      if (row.event === EVENTS.ADMIN_HANDOFF) {
        // Strip the SIGNER_INDEPENDENT bit
        const stripped = row.requiredMask & ~EVIDENCE_BITS.SIGNER_INDEPENDENT;
        return { ...row, requiredMask: stripped };
      }
      return row;
    });
    const result = checkInvariants(mutated);
    assert.equal(result.invariants.I7.proven, false,
      'I7 should detect ADMIN_HANDOFF without SIGNER_INDEPENDENT');
    assert.ok(result.invariants.I7.counterexample,
      'I7 should provide a counterexample');
  });

  it('allProven is false when any invariant is violated', () => {
    const mutated = TRANSITIONS.map(row => {
      if (row.event === EVENTS.ADMIN_HANDOFF) {
        return { ...row, requiredMask: row.requiredMask & ~EVIDENCE_BITS.SIGNER_INDEPENDENT };
      }
      return row;
    });
    const result = checkInvariants(mutated);
    assert.equal(result.allProven, false);
  });
});
