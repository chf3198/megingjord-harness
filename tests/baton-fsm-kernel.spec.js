// baton-fsm-kernel.spec.js — Unit tests for baton FSM kernel.
// tdd-pyramid strategy. Refs #3287, Epic #3284.
'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const {
  STATES, EVENTS, EVIDENCE_BITS, DECISIONS, TRANSITIONS, isTerminal,
  STATE_NAMES, EVENT_NAMES, EVIDENCE_BIT_NAMES, DECISION_NAMES,
} = require('../scripts/global/baton-fsm/transitions');
const { decide, pack, unpack, REASON_ILLEGAL_TRANSITION, REASON_NONE } = require('../scripts/global/baton-fsm/kernel');

const EB = EVIDENCE_BITS;
const ST = STATES;
const EV = EVENTS;

// Helper to unpack and check a decision
function expectAllow(packed, expectedToState) {
  const result = unpack(packed);
  assert.equal(result.decision, DECISIONS.ALLOW, 'expected ALLOW, got ' + result.decisionName);
  assert.equal(result.reasonCode, REASON_NONE, 'expected no reason, got ' + result.reasonName);
  assert.equal(result.requiredNext, expectedToState, 'expected toState ' + expectedToState + ', got ' + result.requiredNext);
}

function expectDeny(packed, expectedReasonCode) {
  const result = unpack(packed);
  assert.equal(result.decision, DECISIONS.DENY, 'expected DENY, got ' + result.decisionName);
  if (expectedReasonCode !== undefined) {
    assert.equal(result.reasonCode, expectedReasonCode, 'expected reason ' + expectedReasonCode + ', got ' + result.reasonCode);
  }
}

// ---- Pack/Unpack ----

describe('pack/unpack roundtrip', () => {
  it('roundtrips ALLOW with toState', () => {
    const packed = pack(DECISIONS.ALLOW, REASON_NONE, ST.READY);
    const unpacked = unpack(packed);
    assert.equal(unpacked.decision, DECISIONS.ALLOW);
    assert.equal(unpacked.reasonCode, REASON_NONE);
    assert.equal(unpacked.requiredNext, ST.READY);
  });

  it('roundtrips DENY with missing bit reason', () => {
    const bitIdx = 5; // SIGNER_INDEPENDENT
    const packed = pack(DECISIONS.DENY, bitIdx, ST.REVIEW);
    const unpacked = unpack(packed);
    assert.equal(unpacked.decision, DECISIONS.DENY);
    assert.equal(unpacked.reasonCode, bitIdx);
    assert.equal(unpacked.requiredNext, ST.REVIEW);
  });

  it('roundtrips DENY with illegal-transition', () => {
    const packed = pack(DECISIONS.DENY, REASON_ILLEGAL_TRANSITION, 0);
    const unpacked = unpack(packed);
    assert.equal(unpacked.decision, DECISIONS.DENY);
    assert.equal(unpacked.reasonCode, REASON_ILLEGAL_TRANSITION);
    assert.equal(unpacked.reasonName, 'illegal-transition');
  });
});

// ---- Legal transitions with sufficient evidence ----

describe('legal transitions ALLOW', () => {
  it('backlog -> triage via pickup_manager (no evidence needed)', () => {
    expectAllow(decide(ST.BACKLOG, EV.PICKUP_MANAGER, 0), ST.TRIAGE);
  });

  it('queued -> triage via pickup_manager (no evidence needed)', () => {
    expectAllow(decide(ST.QUEUED, EV.PICKUP_MANAGER, 0), ST.TRIAGE);
  });

  it('triage -> ready via manager_handoff (requires MANAGER_HANDOFF)', () => {
    expectAllow(decide(ST.TRIAGE, EV.MANAGER_HANDOFF, EB.MANAGER_HANDOFF), ST.READY);
  });

  it('ready -> in-progress via pickup_collaborator (no evidence needed)', () => {
    expectAllow(decide(ST.READY, EV.PICKUP_COLLABORATOR, 0), ST.IN_PROGRESS);
  });

  it('in-progress -> testing via collaborator_handoff (COLLABORATOR_HANDOFF + ALL_ACS_PASS)', () => {
    const evidence = EB.COLLABORATOR_HANDOFF | EB.ALL_ACS_PASS;
    expectAllow(decide(ST.IN_PROGRESS, EV.COLLABORATOR_HANDOFF, evidence), ST.TESTING);
  });

  it('testing -> review via admin_handoff (#3051: requires ADMIN_HANDOFF + SIGNER_INDEPENDENT + CI_GREEN + WORKTREE_MERGE_OK)', () => {
    const evidence = EB.ADMIN_HANDOFF | EB.SIGNER_INDEPENDENT | EB.CI_GREEN | EB.WORKTREE_MERGE_OK;
    expectAllow(decide(ST.TESTING, EV.ADMIN_HANDOFF, evidence), ST.REVIEW);
  });

  it('merge authorization (testing -> testing, requires ADMIN_HANDOFF + CI_GREEN + WORKTREE_MERGE_OK + SIGNER_INDEPENDENT)', () => {
    const evidence = EB.ADMIN_HANDOFF | EB.CI_GREEN | EB.WORKTREE_MERGE_OK | EB.SIGNER_INDEPENDENT;
    expectAllow(decide(ST.TESTING, EV.MERGE, evidence), ST.TESTING);
  });

  it('review -> done via consultant_closeout (CONSULTANT_CLOSEOUT + PR_MERGED)', () => {
    const evidence = EB.CONSULTANT_CLOSEOUT | EB.PR_MERGED;
    expectAllow(decide(ST.REVIEW, EV.CONSULTANT_CLOSEOUT, evidence), ST.DONE);
  });

  it('testing -> in-progress via baton_back (#3251: requires BATON_BACK_REASON)', () => {
    expectAllow(decide(ST.TESTING, EV.BATON_BACK, EB.BATON_BACK_REASON), ST.IN_PROGRESS);
  });

  it('cancel from any non-terminal state (requires DISPOSITION_RECORDED)', () => {
    const nonTerminals = [ST.BACKLOG, ST.QUEUED, ST.TRIAGE, ST.READY, ST.IN_PROGRESS, ST.TESTING, ST.REVIEW, ST.DORMANT, ST.DEFERRED];
    for (const state of nonTerminals) {
      expectAllow(decide(state, EV.CANCEL, EB.DISPOSITION_RECORDED), ST.CANCELLED);
    }
  });

  it('epic pause: in-progress -> dormant', () => {
    expectAllow(decide(ST.IN_PROGRESS, EV.EPIC_PAUSE, 0), ST.DORMANT);
  });

  it('epic defer: in-progress -> deferred', () => {
    expectAllow(decide(ST.IN_PROGRESS, EV.EPIC_DEFER, 0), ST.DEFERRED);
  });

  it('resume from dormant -> triage', () => {
    expectAllow(decide(ST.DORMANT, EV.RESUME, 0), ST.TRIAGE);
  });

  it('resume from deferred -> in-progress', () => {
    expectAllow(decide(ST.DEFERRED, EV.RESUME, 0), ST.IN_PROGRESS);
  });
});

// ---- Missing evidence DENY ----

describe('missing evidence DENY with correct missing-bit reason', () => {
  it('triage -> ready without MANAGER_HANDOFF bit', () => {
    const packed = decide(ST.TRIAGE, EV.MANAGER_HANDOFF, 0);
    // Missing bit 0 = MANAGER_HANDOFF
    expectDeny(packed, 0);
  });

  it('in-progress -> testing without COLLABORATOR_HANDOFF', () => {
    // Only have ALL_ACS_PASS, missing COLLABORATOR_HANDOFF (bit 1)
    const packed = decide(ST.IN_PROGRESS, EV.COLLABORATOR_HANDOFF, EB.ALL_ACS_PASS);
    expectDeny(packed, 1); // bit 1 = COLLABORATOR_HANDOFF
  });

  it('in-progress -> testing without ALL_ACS_PASS', () => {
    const packed = decide(ST.IN_PROGRESS, EV.COLLABORATOR_HANDOFF, EB.COLLABORATOR_HANDOFF);
    expectDeny(packed, 4); // bit 4 = ALL_ACS_PASS
  });

  it('#3051 guard: testing -> review without WORKTREE_MERGE_OK', () => {
    const evidence = EB.ADMIN_HANDOFF | EB.SIGNER_INDEPENDENT | EB.CI_GREEN;
    const packed = decide(ST.TESTING, EV.ADMIN_HANDOFF, evidence);
    expectDeny(packed, 8); // bit 8 = WORKTREE_MERGE_OK
  });

  it('#3051 guard: testing -> review without SIGNER_INDEPENDENT', () => {
    const evidence = EB.ADMIN_HANDOFF | EB.CI_GREEN | EB.WORKTREE_MERGE_OK;
    const packed = decide(ST.TESTING, EV.ADMIN_HANDOFF, evidence);
    expectDeny(packed, 5); // bit 5 = SIGNER_INDEPENDENT
  });

  it('review -> done without PR_MERGED', () => {
    const packed = decide(ST.REVIEW, EV.CONSULTANT_CLOSEOUT, EB.CONSULTANT_CLOSEOUT);
    expectDeny(packed, 7); // bit 7 = PR_MERGED
  });

  it('#3251 guard: baton_back without BATON_BACK_REASON', () => {
    const packed = decide(ST.TESTING, EV.BATON_BACK, 0);
    expectDeny(packed, 10); // bit 10 = BATON_BACK_REASON
  });

  it('cancel without DISPOSITION_RECORDED', () => {
    const packed = decide(ST.TRIAGE, EV.CANCEL, 0);
    expectDeny(packed, 9); // bit 9 = DISPOSITION_RECORDED
  });
});

// ---- Illegal transitions ----

describe('illegal transitions DENY', () => {
  it('backlog cannot receive manager_handoff (must go through triage first)', () => {
    expectDeny(decide(ST.BACKLOG, EV.MANAGER_HANDOFF, EB.MANAGER_HANDOFF), REASON_ILLEGAL_TRANSITION);
  });

  it('ready cannot receive collaborator_handoff', () => {
    expectDeny(decide(ST.READY, EV.COLLABORATOR_HANDOFF, 0xFFFF), REASON_ILLEGAL_TRANSITION);
  });

  it('triage cannot receive admin_handoff', () => {
    expectDeny(decide(ST.TRIAGE, EV.ADMIN_HANDOFF, 0xFFFF), REASON_ILLEGAL_TRANSITION);
  });

  it('in-progress cannot receive consultant_closeout', () => {
    expectDeny(decide(ST.IN_PROGRESS, EV.CONSULTANT_CLOSEOUT, 0xFFFF), REASON_ILLEGAL_TRANSITION);
  });

  it('review cannot receive baton_back', () => {
    expectDeny(decide(ST.REVIEW, EV.BATON_BACK, EB.BATON_BACK_REASON), REASON_ILLEGAL_TRANSITION);
  });
});

// ---- Terminal state sinks ----

describe('terminal state sinks (done/cancelled have no outgoing transitions)', () => {
  const terminalStates = [ST.DONE, ST.CANCELLED];
  const allEvents = Object.values(EVENTS);

  for (const termState of terminalStates) {
    for (const event of allEvents) {
      it(STATE_NAMES[termState] + ' + ' + EVENT_NAMES[event] + ' -> DENY illegal', () => {
        const packed = decide(termState, event, 0xFFFF);
        expectDeny(packed, REASON_ILLEGAL_TRANSITION);
      });
    }
  }
});

// ---- isTerminal helper ----

describe('isTerminal helper', () => {
  it('done is terminal', () => assert.equal(isTerminal(ST.DONE), true));
  it('cancelled is terminal', () => assert.equal(isTerminal(ST.CANCELLED), true));
  it('backlog is not terminal', () => assert.equal(isTerminal(ST.BACKLOG), false));
  it('in-progress is not terminal', () => assert.equal(isTerminal(ST.IN_PROGRESS), false));
  it('review is not terminal', () => assert.equal(isTerminal(ST.REVIEW), false));
});

// ---- Extra evidence bits do not block ALLOW ----

describe('extra evidence bits do not block', () => {
  it('triage -> ready with all bits set still ALLOWs', () => {
    expectAllow(decide(ST.TRIAGE, EV.MANAGER_HANDOFF, 0x7FF), ST.READY);
  });
});

// ---- Transition table integrity ----

describe('transition table integrity', () => {
  it('all transitions reference valid states', () => {
    const validStates = new Set(Object.values(STATES));
    for (const row of TRANSITIONS) {
      assert.ok(validStates.has(row.fromState), 'invalid fromState: ' + row.fromState);
      assert.ok(validStates.has(row.toState), 'invalid toState: ' + row.toState);
    }
  });

  it('all transitions reference valid events', () => {
    const validEvents = new Set(Object.values(EVENTS));
    for (const row of TRANSITIONS) {
      assert.ok(validEvents.has(row.event), 'invalid event: ' + row.event);
    }
  });

  it('no terminal state has an outgoing transition', () => {
    for (const row of TRANSITIONS) {
      assert.ok(!isTerminal(row.fromState), 'terminal state ' + row.fromState + ' has outgoing transition');
    }
  });
});
