// transitions.js — SINGLE canonical data table for the baton FSM.
// Pure data + tiny helpers. No IO/clock/env. Refs #3287, Epic #3284.
'use strict';

// 11-status taxonomy (Epic #1828)
const STATES = Object.freeze({
  BACKLOG:      0,
  QUEUED:       1,
  TRIAGE:       2,
  READY:        3,
  IN_PROGRESS:  4,
  TESTING:      5,
  REVIEW:       6,
  DONE:         7,
  CANCELLED:    8,
  DORMANT:      9,
  DEFERRED:    10,
});

const STATE_NAMES = Object.freeze(
  Object.fromEntries(Object.entries(STATES).map(([key, val]) => [val, key.toLowerCase().replace('_', '-')]))
);
const STATE_COUNT = Object.keys(STATES).length;

// Baton events
const EVENTS = Object.freeze({
  PICKUP_MANAGER:        0,
  MANAGER_HANDOFF:       1,
  PICKUP_COLLABORATOR:   2,
  COLLABORATOR_HANDOFF:  3,
  ADMIN_HANDOFF:         4,
  CONSULTANT_CLOSEOUT:   5,
  MERGE:                 6,
  CANCEL:                7,
  BATON_BACK:            8,
  EPIC_PAUSE:            9,
  EPIC_DEFER:           10,
  RESUME:               11,
});

const EVENT_NAMES = Object.freeze(
  Object.fromEntries(Object.entries(EVENTS).map(([key, val]) => [val, key.toLowerCase()]))
);
const EVENT_COUNT = Object.keys(EVENTS).length;

// Evidence bit flags (each is a single bit)
const EVIDENCE_BITS = Object.freeze({
  MANAGER_HANDOFF:       1 << 0,  // 1
  COLLABORATOR_HANDOFF:  1 << 1,  // 2
  ADMIN_HANDOFF:         1 << 2,  // 4
  CONSULTANT_CLOSEOUT:   1 << 3,  // 8
  ALL_ACS_PASS:          1 << 4,  // 16
  SIGNER_INDEPENDENT:    1 << 5,  // 32
  CI_GREEN:              1 << 6,  // 64
  PR_MERGED:             1 << 7,  // 128
  WORKTREE_MERGE_OK:     1 << 8,  // 256
  DISPOSITION_RECORDED:  1 << 9,  // 512
  BATON_BACK_REASON:     1 << 10, // 1024
});

const EVIDENCE_BIT_NAMES = Object.freeze(
  Object.fromEntries(Object.entries(EVIDENCE_BITS).map(([key, val]) => {
    const bitIndex = Math.log2(val);
    return [bitIndex, key.toLowerCase()];
  }))
);
const EVIDENCE_BIT_COUNT = Object.keys(EVIDENCE_BITS).length;

// Decision codes
const DECISIONS = Object.freeze({
  ALLOW:          1,
  DENY:           2,
  ALLOW_ADVISORY: 3,
});

const DECISION_NAMES = Object.freeze(
  Object.fromEntries(Object.entries(DECISIONS).map(([key, val]) => [val, key.toLowerCase()]))
);

// Terminal states — sinks with no outgoing transitions
const TERMINAL_STATES = Object.freeze(new Set([STATES.DONE, STATES.CANCELLED]));

function isTerminal(stateCode) {
  return TERMINAL_STATES.has(stateCode);
}

// Transition table: {fromState, event, toState, requiredMask}
// requiredMask = OR of EVIDENCE_BITS that must ALL be present.
const EB = EVIDENCE_BITS;
const ST = STATES;
const EV = EVENTS;

const TRANSITIONS = Object.freeze([
  // backlog -> triage: Manager picks up
  { fromState: ST.BACKLOG,     event: EV.PICKUP_MANAGER,       toState: ST.TRIAGE,      requiredMask: 0 },
  // queued -> triage: Manager picks up child of active Epic
  { fromState: ST.QUEUED,      event: EV.PICKUP_MANAGER,       toState: ST.TRIAGE,      requiredMask: 0 },
  // triage -> ready: Manager handoff
  { fromState: ST.TRIAGE,      event: EV.MANAGER_HANDOFF,      toState: ST.READY,       requiredMask: EB.MANAGER_HANDOFF },
  // ready -> in-progress: Collaborator picks up
  { fromState: ST.READY,       event: EV.PICKUP_COLLABORATOR,  toState: ST.IN_PROGRESS,  requiredMask: 0 },
  // in-progress -> testing: Collaborator handoff (all ACs pass)
  { fromState: ST.IN_PROGRESS, event: EV.COLLABORATOR_HANDOFF, toState: ST.TESTING,      requiredMask: EB.COLLABORATOR_HANDOFF | EB.ALL_ACS_PASS },
  // testing -> review: Admin handoff (#3051 worktree-merge precondition)
  { fromState: ST.TESTING,     event: EV.ADMIN_HANDOFF,        toState: ST.REVIEW,       requiredMask: EB.ADMIN_HANDOFF | EB.SIGNER_INDEPENDENT | EB.CI_GREEN | EB.WORKTREE_MERGE_OK },
  // merge authorization event (testing -> testing, state unchanged)
  { fromState: ST.TESTING,     event: EV.MERGE,                toState: ST.TESTING,      requiredMask: EB.ADMIN_HANDOFF | EB.CI_GREEN | EB.WORKTREE_MERGE_OK | EB.SIGNER_INDEPENDENT },
  // review -> done: Consultant closeout
  { fromState: ST.REVIEW,      event: EV.CONSULTANT_CLOSEOUT,  toState: ST.DONE,         requiredMask: EB.CONSULTANT_CLOSEOUT | EB.PR_MERGED },
  // baton_back: Admin returns to Collaborator (#3251)
  { fromState: ST.TESTING,     event: EV.BATON_BACK,           toState: ST.IN_PROGRESS,  requiredMask: EB.BATON_BACK_REASON },
  // cancel: any non-terminal -> cancelled
  { fromState: ST.BACKLOG,     event: EV.CANCEL,               toState: ST.CANCELLED,    requiredMask: EB.DISPOSITION_RECORDED },
  { fromState: ST.QUEUED,      event: EV.CANCEL,               toState: ST.CANCELLED,    requiredMask: EB.DISPOSITION_RECORDED },
  { fromState: ST.TRIAGE,      event: EV.CANCEL,               toState: ST.CANCELLED,    requiredMask: EB.DISPOSITION_RECORDED },
  { fromState: ST.READY,       event: EV.CANCEL,               toState: ST.CANCELLED,    requiredMask: EB.DISPOSITION_RECORDED },
  { fromState: ST.IN_PROGRESS, event: EV.CANCEL,               toState: ST.CANCELLED,    requiredMask: EB.DISPOSITION_RECORDED },
  { fromState: ST.TESTING,     event: EV.CANCEL,               toState: ST.CANCELLED,    requiredMask: EB.DISPOSITION_RECORDED },
  { fromState: ST.REVIEW,      event: EV.CANCEL,               toState: ST.CANCELLED,    requiredMask: EB.DISPOSITION_RECORDED },
  { fromState: ST.DORMANT,     event: EV.CANCEL,               toState: ST.CANCELLED,    requiredMask: EB.DISPOSITION_RECORDED },
  { fromState: ST.DEFERRED,    event: EV.CANCEL,               toState: ST.CANCELLED,    requiredMask: EB.DISPOSITION_RECORDED },
  // Epic-only: in-progress -> dormant
  { fromState: ST.IN_PROGRESS, event: EV.EPIC_PAUSE,           toState: ST.DORMANT,      requiredMask: 0 },
  // Epic-only: in-progress -> deferred
  { fromState: ST.IN_PROGRESS, event: EV.EPIC_DEFER,           toState: ST.DEFERRED,     requiredMask: 0 },
  // Epic-only: dormant -> triage on resume
  { fromState: ST.DORMANT,     event: EV.RESUME,               toState: ST.TRIAGE,       requiredMask: 0 },
  // Epic-only: deferred -> in-progress when blocker clears
  { fromState: ST.DEFERRED,    event: EV.RESUME,               toState: ST.IN_PROGRESS,  requiredMask: 0 },
]);

function findTransition(fromState, event) {
  return TRANSITIONS.find(
    (row) => row.fromState === fromState && row.event === event
  ) || null;
}

module.exports = {
  STATES, STATE_NAMES, STATE_COUNT,
  EVENTS, EVENT_NAMES, EVENT_COUNT,
  EVIDENCE_BITS, EVIDENCE_BIT_NAMES, EVIDENCE_BIT_COUNT,
  DECISIONS, DECISION_NAMES,
  TERMINAL_STATES, isTerminal,
  TRANSITIONS,
  findTransition,
};
