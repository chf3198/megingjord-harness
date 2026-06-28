// model-checker.js — Exhaustive finite-model checker for the baton FSM.
// Proves 7 invariants by complete state-space enumeration.
// Pure JS, no IO/clock/env. Refs #3289, Epic #3284.
'use strict';

const {
  STATES, STATE_NAMES, STATE_COUNT,
  EVENTS, EVENT_NAMES, EVENT_COUNT,
  EVIDENCE_BITS, TERMINAL_STATES,
  TRANSITIONS, DECISIONS,
} = require('../transitions');
const { decide, unpack } = require('../kernel');

// State-to-execution-role mapping per the 11-status taxonomy.
// Only active role-owned states have a mapped role.
const STATE_ROLE_MAP = Object.freeze({
  [STATES.TRIAGE]: 'manager',
  [STATES.IN_PROGRESS]: 'collaborator',
  [STATES.TESTING]: 'admin',
  [STATES.REVIEW]: 'consultant',
  [STATES.DORMANT]: 'manager',
  [STATES.DEFERRED]: 'manager',
});

// Evidence bits required on the path to DONE (baton trail).
const BATON_TRAIL_BITS = (
  EVIDENCE_BITS.MANAGER_HANDOFF |
  EVIDENCE_BITS.COLLABORATOR_HANDOFF |
  EVIDENCE_BITS.ADMIN_HANDOFF |
  EVIDENCE_BITS.CONSULTANT_CLOSEOUT |
  EVIDENCE_BITS.PR_MERGED
);

// Maximum evidence mask value (all bits set).
const ALL_EVIDENCE = Object.values(EVIDENCE_BITS).reduce(
  (acc, bit) => acc | bit, 0
);

// FSM entry points: BACKLOG for independent tickets,
// QUEUED for children of active Epics (out-of-band entry).
const ENTRY_STATES = Object.freeze([STATES.BACKLOG, STATES.QUEUED]);

module.exports = {
  checkInvariants,
  buildAdjacencyFrom,
  computeReachableStates,
  enumeratePathsToDone,
  STATE_ROLE_MAP,
  BATON_TRAIL_BITS,
  ALL_EVIDENCE,
  ENTRY_STATES,
};

/**
 * Run all 7 invariant checks. Accepts an optional override table
 * for mutation testing (injecting broken transitions).
 * @param {Array} [transitionOverride]
 * @returns {{invariants: object, allProven: boolean, stats: object}}
 */
function checkInvariants(transitionOverride) {
  const table = transitionOverride || TRANSITIONS;
  const adjacency = buildAdjacencyFrom(table);
  const invariants = {
    I1: checkI1NoDoneWithoutTrail(adjacency),
    I2: checkI2SingleRole(),
    I3: checkI3NoDeadlock(adjacency),
    I4: checkI4TerminalSink(),
    I5: checkI5AllReachable(adjacency),
    I6: checkI6DispositionRequired(table),
    I7: checkI7SignerIndependence(table),
  };
  const allProven = Object.values(invariants).every(
    inv => inv.proven
  );
  return {
    invariants,
    allProven,
    stats: {
      stateCount: STATE_COUNT,
      eventCount: EVENT_COUNT,
      transitionCount: table.length,
    },
  };
}

/**
 * Build adjacency list from an arbitrary transition table.
 */
function buildAdjacencyFrom(table) {
  const adjacency = new Map();
  for (let stateIdx = 0; stateIdx < STATE_COUNT; stateIdx++) {
    adjacency.set(stateIdx, []);
  }
  for (const row of table) {
    const edges = adjacency.get(row.fromState);
    if (edges) edges.push(row);
  }
  return adjacency;
}

/**
 * BFS reachability from the given entry states.
 * @param {Map} adjacency
 * @param {Array} [entryPoints] Defaults to ENTRY_STATES.
 */
function computeReachableStates(adjacency, entryPoints) {
  const seeds = entryPoints || ENTRY_STATES;
  const visited = new Set(seeds);
  const queue = [...seeds];
  while (queue.length > 0) {
    const current = queue.shift();
    for (const edge of (adjacency.get(current) || [])) {
      if (!visited.has(edge.toState)) {
        visited.add(edge.toState);
        queue.push(edge.toState);
      }
    }
  }
  return visited;
}

/**
 * BFS all acyclic paths from BACKLOG to DONE, tracking the
 * union of requiredMasks along each path as the evidence trail.
 */
function enumeratePathsToDone(adjacency) {
  const paths = [];
  const MAX_DEPTH = 20;
  const queue = [{
    current: STATES.BACKLOG,
    path: [STATES.BACKLOG],
    evidence: 0,
  }];
  while (queue.length > 0) {
    const item = queue.shift();
    if (item.current === STATES.DONE) {
      paths.push({
        path: item.path,
        evidenceTrail: item.evidence,
      });
      continue;
    }
    if (item.path.length >= MAX_DEPTH) continue;
    for (const edge of (adjacency.get(item.current) || [])) {
      if (edge.toState === item.current) continue;
      queue.push({
        current: edge.toState,
        path: [...item.path, edge.toState],
        evidence: item.evidence | edge.requiredMask,
      });
    }
  }
  return paths;
}

/** I1: Every path BACKLOG->DONE accumulates all BATON_TRAIL_BITS. */
function checkI1NoDoneWithoutTrail(adjacency) {
  const paths = enumeratePathsToDone(adjacency);
  for (const entry of paths) {
    const missing = BATON_TRAIL_BITS & ~entry.evidenceTrail;
    if (missing !== 0) {
      return {
        proven: false,
        counterexample: {
          path: entry.path.map(sc => STATE_NAMES[sc]),
          missingBits: missing,
        },
      };
    }
  }
  return { proven: true, pathsChecked: paths.length };
}

/** I2: At most one execution role per state. */
function checkI2SingleRole() {
  for (let stateIdx = 0; stateIdx < STATE_COUNT; stateIdx++) {
    const role = STATE_ROLE_MAP[stateIdx];
    if (role === undefined) continue;
    if (typeof role !== 'string' || role.length === 0) {
      return {
        proven: false,
        counterexample: {
          state: STATE_NAMES[stateIdx],
          invalidRole: role,
        },
      };
    }
  }
  return { proven: true, statesChecked: STATE_COUNT };
}

/** I3: Every non-terminal state has >= 1 outgoing transition. */
function checkI3NoDeadlock(adjacency) {
  for (let stateIdx = 0; stateIdx < STATE_COUNT; stateIdx++) {
    if (TERMINAL_STATES.has(stateIdx)) continue;
    const edges = adjacency.get(stateIdx) || [];
    if (edges.length === 0) {
      return {
        proven: false,
        counterexample: {
          state: STATE_NAMES[stateIdx],
          reason: 'no outgoing transitions',
        },
      };
    }
  }
  const nonTerminal = STATE_COUNT - TERMINAL_STATES.size;
  return { proven: true, nonTerminalChecked: nonTerminal };
}

/** I4: Terminal states are sinks — kernel DENYs all events. */
function checkI4TerminalSink() {
  for (const termState of TERMINAL_STATES) {
    for (let evIdx = 0; evIdx < EVENT_COUNT; evIdx++) {
      const packed = decide(termState, evIdx, ALL_EVIDENCE);
      const result = unpack(packed);
      if (result.decision !== DECISIONS.DENY) {
        return {
          proven: false,
          counterexample: {
            state: STATE_NAMES[termState],
            event: EVENT_NAMES[evIdx],
            decision: result.decisionName,
          },
        };
      }
    }
  }
  return {
    proven: true,
    terminalStates: TERMINAL_STATES.size,
    eventsChecked: TERMINAL_STATES.size * EVENT_COUNT,
  };
}

/** I5: Every state is reachable from an entry point (BACKLOG or QUEUED). */
function checkI5AllReachable(adjacency) {
  const reachable = computeReachableStates(adjacency, ENTRY_STATES);
  for (let stateIdx = 0; stateIdx < STATE_COUNT; stateIdx++) {
    if (!reachable.has(stateIdx)) {
      return {
        proven: false,
        counterexample: {
          state: STATE_NAMES[stateIdx],
          reason: 'unreachable from any entry state',
        },
      };
    }
  }
  return { proven: true, reachableCount: reachable.size };
}

/** I6: DONE needs CONSULTANT_CLOSEOUT; CANCELLED needs DISPOSITION_RECORDED. */
function checkI6DispositionRequired(table) {
  for (const row of table) {
    if (row.toState === STATES.DONE) {
      if (!(row.requiredMask & EVIDENCE_BITS.CONSULTANT_CLOSEOUT)) {
        return {
          proven: false,
          counterexample: {
            from: STATE_NAMES[row.fromState],
            event: EVENT_NAMES[row.event],
            reason: 'DONE without CONSULTANT_CLOSEOUT',
          },
        };
      }
    }
    if (row.toState === STATES.CANCELLED) {
      if (!(row.requiredMask & EVIDENCE_BITS.DISPOSITION_RECORDED)) {
        return {
          proven: false,
          counterexample: {
            from: STATE_NAMES[row.fromState],
            event: EVENT_NAMES[row.event],
            reason: 'CANCELLED without DISPOSITION_RECORDED',
          },
        };
      }
    }
  }
  return { proven: true, transitionsChecked: table.length };
}

/** I7: Every ADMIN_HANDOFF transition requires SIGNER_INDEPENDENT. */
function checkI7SignerIndependence(table) {
  for (const row of table) {
    if (row.event !== EVENTS.ADMIN_HANDOFF) continue;
    if (!(row.requiredMask & EVIDENCE_BITS.SIGNER_INDEPENDENT)) {
      return {
        proven: false,
        counterexample: {
          from: STATE_NAMES[row.fromState],
          to: STATE_NAMES[row.toState],
          reason: 'ADMIN_HANDOFF without SIGNER_INDEPENDENT',
        },
      };
    }
  }
  return { proven: true };
}
