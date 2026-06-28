// evidence-loader-contract.js — Formal evidence-loader contract checker.
// Verifies TOTALITY, DETERMINISM, NO-PARTIAL-EVIDENCE.
// Pure JS, no IO/clock/env. Refs #3289, Epic #3284.
'use strict';

const {
  STATES, STATE_COUNT,
  EVENTS, EVENT_COUNT,
  STATE_NAMES, EVENT_NAMES,
  TERMINAL_STATES,
  TRANSITIONS,
} = require('../transitions');

// Required fields in a valid evidence envelope.
const REQUIRED_ENVELOPE_FIELDS = Object.freeze([
  'facts', 'signer', 'signature', 'evidence_hash',
]);

module.exports = {
  verifyLoaderContract,
  buildCompliantLoader,
  buildBrokenLoader,
  REQUIRED_ENVELOPE_FIELDS,
};

/**
 * Verify a loader function satisfies three formal properties:
 *   TOTALITY:           returns a value for every valid (state, event) pair
 *   DETERMINISM:        same input produces same output across repeated calls
 *   NO-PARTIAL-EVIDENCE: envelope is either structurally complete or explicit absence
 *
 * @param {Function} loaderFn - (stateCode, eventCode) => envelope | null
 * @returns {{pass: boolean, violations: Array<{property: string, detail: object}>}}
 */
function verifyLoaderContract(loaderFn) {
  const violations = [];
  checkTotality(loaderFn, violations);
  checkDeterminism(loaderFn, violations);
  checkNoPartialEvidence(loaderFn, violations);
  return {
    pass: violations.length === 0,
    violations,
  };
}

/**
 * TOTALITY: loader must return a defined value (envelope or null)
 * for every valid (state, event) pair that has a transition.
 */
function checkTotality(loaderFn, violations) {
  for (const row of TRANSITIONS) {
    let result;
    try {
      result = loaderFn(row.fromState, row.event);
    } catch (thrown) {
      violations.push({
        property: 'TOTALITY',
        detail: {
          state: STATE_NAMES[row.fromState],
          event: EVENT_NAMES[row.event],
          threw: String(thrown),
        },
      });
      continue;
    }
    if (result === undefined) {
      violations.push({
        property: 'TOTALITY',
        detail: {
          state: STATE_NAMES[row.fromState],
          event: EVENT_NAMES[row.event],
          reason: 'returned undefined',
        },
      });
    }
  }
}

/**
 * DETERMINISM: calling the loader twice with the same input
 * must produce structurally identical output.
 */
function checkDeterminism(loaderFn, violations) {
  for (const row of TRANSITIONS) {
    let first, second;
    try {
      first = loaderFn(row.fromState, row.event);
      second = loaderFn(row.fromState, row.event);
    } catch {
      continue; // totality check already caught this
    }
    const firstJson = JSON.stringify(first);
    const secondJson = JSON.stringify(second);
    if (firstJson !== secondJson) {
      violations.push({
        property: 'DETERMINISM',
        detail: {
          state: STATE_NAMES[row.fromState],
          event: EVENT_NAMES[row.event],
          first: firstJson,
          second: secondJson,
        },
      });
    }
  }
}

/**
 * Validate a single envelope for completeness.
 * Pushes violations if the envelope is partial (non-null but missing fields).
 */
function validateEnvelopeCompleteness(result, row, violations) {
  if (typeof result !== 'object') {
    violations.push({
      property: 'NO-PARTIAL-EVIDENCE',
      detail: {
        state: STATE_NAMES[row.fromState],
        event: EVENT_NAMES[row.event],
        reason: 'non-null non-object return',
        type: typeof result,
      },
    });
    return;
  }
  for (const field of REQUIRED_ENVELOPE_FIELDS) {
    if (!result[field]) {
      violations.push({
        property: 'NO-PARTIAL-EVIDENCE',
        detail: {
          state: STATE_NAMES[row.fromState],
          event: EVENT_NAMES[row.event],
          missingField: field,
        },
      });
    }
  }
}

/**
 * NO-PARTIAL-EVIDENCE: if loader returns a non-null envelope,
 * all required fields must be present and well-typed.
 * A null return (explicit absence) is acceptable.
 */
function checkNoPartialEvidence(loaderFn, violations) {
  for (const row of TRANSITIONS) {
    let result;
    try {
      result = loaderFn(row.fromState, row.event);
    } catch {
      continue;
    }
    if (result === null) continue;
    validateEnvelopeCompleteness(result, row, violations);
  }
}

/**
 * Reference compliant loader: returns a valid evidence envelope
 * for every transition, with deterministic content.
 */
function buildCompliantLoader() {
  const { createHash } = require('node:crypto');
  return function compliantLoader(stateCode, eventCode) {
    const factsPayload = { state: stateCode, event: eventCode, mask: 0 };
    const canonical = JSON.stringify(factsPayload);
    const hash = createHash('sha256').update(canonical).digest('hex');
    return {
      facts: factsPayload,
      signer: 'compliant-test-loader',
      signature: 'deterministic-sig-' + hash.slice(0, 16),
      evidence_hash: hash,
    };
  };
}

/**
 * Deliberately broken loader that violates all three properties.
 * - TOTALITY: returns undefined for the first transition
 * - DETERMINISM: returns a different signature each call
 * - NO-PARTIAL-EVIDENCE: returns partial envelope (missing signer)
 */
function buildBrokenLoader() {
  let callCount = 0;
  const firstTransition = TRANSITIONS[0];
  return function brokenLoader(stateCode, eventCode) {
    callCount++;
    // Violate TOTALITY for the first transition
    if (stateCode === firstTransition.fromState &&
        eventCode === firstTransition.event) {
      return undefined;
    }
    // Violate DETERMINISM: signature changes each call
    const nonDeterministicSig = 'sig-' + callCount;
    // Violate NO-PARTIAL-EVIDENCE: missing signer field
    return {
      facts: { state: stateCode, event: eventCode, mask: 0 },
      signature: nonDeterministicSig,
      evidence_hash: 'static-hash',
    };
  };
}
