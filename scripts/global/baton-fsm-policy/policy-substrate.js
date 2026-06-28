// policy-substrate.js — Decision-logged policy-as-code evaluator.
// Rego-equivalent form: every decision is auditable via decision_log.
// Derives rules from transitions.js so it stays in lockstep with the
// W1a kernel. Refs #3286, Epic #3284.
'use strict';

const {
  STATE_NAMES, EVENT_NAMES,
  EVIDENCE_BITS, EVIDENCE_BIT_NAMES,
  TERMINAL_STATES,
  TRANSITIONS,
} = require('../baton-fsm/transitions');
const {
  REASON_NONE,
  REASON_ILLEGAL_TRANSITION,
} = require('../baton-fsm/kernel');

const POLICY_VERSION = '1.0.0';

/** Describe which evidence bits are present in a mask. */
function describeMask(mask) {
  const names = [];
  for (const [name, bit] of Object.entries(EVIDENCE_BITS)) {
    if (mask & bit) names.push(name.toLowerCase());
  }
  return names;
}

/** Map a reason code to a name, identical to kernel.unpack logic. */
function reasonCodeToName(code) {
  if (code === REASON_NONE) return 'none';
  if (code === REASON_ILLEGAL_TRANSITION) return 'illegal-transition';
  return EVIDENCE_BIT_NAMES[code] || ('unknown-bit-' + code);
}

/** Find the bit index of the lowest set bit. */
function findFirstSetBitIndex(mask) {
  for (let bitIdx = 0; bitIdx < 11; bitIdx++) {
    if (mask & (1 << bitIdx)) return bitIdx;
  }
  return 0;
}

/** Build a standardized result object. */
function buildResult(decision, reason, requiredNext, decisionLog) {
  return {
    decision,
    reason,
    required_next: requiredNext,
    policy_version: POLICY_VERSION,
    decision_log: decisionLog,
  };
}

/** Rule 1: terminal-sink guard. */
function applyTerminalGuard(stateCode, stateName, log) {
  const matched = TERMINAL_STATES.has(stateCode);
  log.push({
    rule_id: 'terminal-sink-guard',
    input: { state: stateName },
    matched,
    verdict: matched ? 'deny' : 'pass',
  });
  return matched;
}

/** Rule 2: transition-lookup. */
function applyTransitionLookup(stateCode, eventCode, inputSummary, log) {
  let matchedRow = null;
  for (let idx = 0; idx < TRANSITIONS.length; idx++) {
    const row = TRANSITIONS[idx];
    if (row.fromState === stateCode && row.event === eventCode) {
      matchedRow = row;
      break;
    }
  }
  log.push({
    rule_id: 'transition-lookup',
    input: inputSummary,
    matched: matchedRow !== null,
    verdict: matchedRow !== null ? 'found' : 'deny',
  });
  return matchedRow;
}

/** Rule 3: evidence-gate check and Rule 4: allow. */
function applyEvidenceGate(matchedRow, evidenceMask, inputSummary, log) {
  const required = matchedRow.requiredMask;
  const satisfied = (evidenceMask & required) === required;
  const toStateName = STATE_NAMES[matchedRow.toState] || 'unknown';
  const entry = {
    rule_id: 'evidence-gate',
    input: { required: describeMask(required), present: describeMask(evidenceMask) },
    matched: !satisfied,
    verdict: satisfied ? 'pass' : 'deny',
  };
  if (!satisfied) {
    const missing = required & ~evidenceMask;
    entry.input.missing = describeMask(missing);
    log.push(entry);
    return buildResult('deny', reasonCodeToName(findFirstSetBitIndex(missing)), toStateName, log);
  }
  log.push(entry);
  log.push({ rule_id: 'allow-transition', input: inputSummary, matched: true, verdict: 'allow' });
  return buildResult('allow', 'none', toStateName, log);
}

/**
 * Evaluate a baton policy decision with a full decision log.
 * Mirrors kernel.decide exactly through four sequential rules.
 */
function evaluatePolicy(stateCode, eventCode, evidenceMask) {
  const decisionLog = [];
  const stateName = STATE_NAMES[stateCode] || 'unknown';
  const eventName = EVENT_NAMES[eventCode] || 'unknown';
  const inputSummary = { state: stateName, event: eventName, evidence: describeMask(evidenceMask) };
  if (applyTerminalGuard(stateCode, stateName, decisionLog)) {
    return buildResult('deny', 'illegal-transition', 'none', decisionLog);
  }
  const matchedRow = applyTransitionLookup(stateCode, eventCode, inputSummary, decisionLog);
  if (!matchedRow) {
    return buildResult('deny', 'illegal-transition', 'none', decisionLog);
  }
  return applyEvidenceGate(matchedRow, evidenceMask, inputSummary, decisionLog);
}

module.exports = { evaluatePolicy, POLICY_VERSION, describeMask };
