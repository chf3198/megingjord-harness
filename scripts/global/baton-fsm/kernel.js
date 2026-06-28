// kernel.js — Pure JS reference oracle for the baton FSM.
// NO IO/clock/env/Math.random. Refs #3287, Epic #3284.
'use strict';

const {
  EVIDENCE_BIT_NAMES, EVIDENCE_BIT_COUNT,
  DECISIONS, DECISION_NAMES,
  STATE_NAMES,
  TERMINAL_STATES,
  TRANSITIONS,
} = require('./transitions');

// Packing layout for the i32 verdict:
//   bits [0..3]   = decision (4 bits, values 1-3)
//   bits [4..11]  = reasonCode (8 bits, 0=no-reason, bit-index=missing-bit, 255=illegal)
//   bits [12..19] = requiredNextStateCode (8 bits, the toState on ALLOW)
const REASON_ILLEGAL_TRANSITION = 255;
const REASON_NONE = 0;

/**
 * Pack decision, reasonCode, and requiredNextStateCode into a single i32.
 */
function pack(decision, reasonCode, nextStateCode) {
  return ((decision & 0xF) | ((reasonCode & 0xFF) << 4) | ((nextStateCode & 0xFF) << 12));
}

/**
 * Unpack a packed i32 verdict into its constituent fields.
 */
function unpack(packed) {
  const decision = packed & 0xF;
  const reasonCode = (packed >> 4) & 0xFF;
  const requiredNext = (packed >> 12) & 0xFF;
  let reasonName;
  if (reasonCode === REASON_NONE) {
    reasonName = 'none';
  } else if (reasonCode === REASON_ILLEGAL_TRANSITION) {
    reasonName = 'illegal-transition';
  } else {
    reasonName = EVIDENCE_BIT_NAMES[reasonCode] || ('unknown-bit-' + reasonCode);
  }
  return {
    decision,
    decisionName: DECISION_NAMES[decision] || ('unknown-' + decision),
    reasonCode,
    reasonName,
    requiredNext,
    requiredNextName: STATE_NAMES[requiredNext] || ('unknown-' + requiredNext),
  };
}

/**
 * Pure deterministic decide function.
 * @param {number} stateCode - Current state (STATES enum value).
 * @param {number} eventCode - Event to apply (EVENTS enum value).
 * @param {number} evidenceMask - OR of EVIDENCE_BITS present.
 * @returns {number} Packed i32 verdict.
 */
/**
 * Find the index of the lowest set bit in a bitmask.
 * Used to identify the first missing evidence requirement.
 */
function findFirstSetBit(mask) {
  for (let bitIdx = 0; bitIdx < EVIDENCE_BIT_COUNT; bitIdx++) {
    if (mask & (1 << bitIdx)) return bitIdx;
  }
  return 0;
}

function decide(stateCode, eventCode, evidenceMask) {
  // Terminal states are sinks: no outgoing transitions
  if (TERMINAL_STATES.has(stateCode)) {
    return pack(DECISIONS.DENY, REASON_ILLEGAL_TRANSITION, 0);
  }
  // Find the matching transition row
  let matchedRow = null;
  for (let idx = 0; idx < TRANSITIONS.length; idx++) {
    const row = TRANSITIONS[idx];
    if (row.fromState === stateCode && row.event === eventCode) {
      matchedRow = row;
      break;
    }
  }
  if (!matchedRow) {
    return pack(DECISIONS.DENY, REASON_ILLEGAL_TRANSITION, 0);
  }
  // Check evidence mask against required mask
  const required = matchedRow.requiredMask;
  if ((evidenceMask & required) === required) {
    return pack(DECISIONS.ALLOW, REASON_NONE, matchedRow.toState);
  }
  // First missing required bit (lowest bit index)
  const missing = required & ~evidenceMask;
  return pack(DECISIONS.DENY, findFirstSetBit(missing), matchedRow.toState);
}

module.exports = {
  decide,
  pack,
  unpack,
  REASON_ILLEGAL_TRANSITION,
  REASON_NONE,
};
