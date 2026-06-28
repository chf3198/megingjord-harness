#!/usr/bin/env node
// corpus-generate.js — Derives exhaustive W-method conformance corpus from TRANSITIONS.
// Generates legal, guarded, and adversarial fixture files. Refs #3288, Epic #3284.
'use strict';

const { writeFileSync, mkdirSync } = require('node:fs');
const { join } = require('node:path');
const {
  STATES, STATE_NAMES, STATE_COUNT,
  EVENTS, EVENT_NAMES, EVENT_COUNT,
  EVIDENCE_BITS, EVIDENCE_BIT_NAMES,
  DECISIONS,
  TRANSITIONS, TERMINAL_STATES,
} = require('./transitions');
const { decide, unpack, REASON_ILLEGAL_TRANSITION } = require('./kernel');

const CORPUS_DIR = join(__dirname, '..', '..', '..', 'tests', 'fixtures', 'baton-fsm-corpus');

/**
 * Return an array of individual bit positions present in a mask.
 */
function bitPositions(mask) {
  const positions = [];
  for (let bitIdx = 0; bitIdx < 16; bitIdx++) {
    if (mask & (1 << bitIdx)) positions.push(bitIdx);
  }
  return positions;
}

/**
 * Return the human-readable name for an evidence bit by its position index.
 */
function bitName(bitIdx) {
  return EVIDENCE_BIT_NAMES[bitIdx] || ('bit-' + bitIdx);
}

/**
 * Generate legal transition cases (all evidence satisfied, expect ALLOW).
 */
function generateLegalCases() {
  const cases = [];
  for (const row of TRANSITIONS) {
    cases.push({
      name: 'legal_' + STATE_NAMES[row.fromState] + '_' + EVENT_NAMES[row.event],
      state: row.fromState,
      event: row.event,
      evidence: row.requiredMask,
      expected: {
        decision: DECISIONS.ALLOW,
        reason: 'none',
        required_next: row.toState,
      },
    });
  }
  return cases;
}

/**
 * Generate guard-deny cases: for each transition with requiredMask nonzero,
 * omit each required bit individually and expect DENY with that bit as reason.
 */
function generateGuardDenyCases() {
  const cases = [];
  for (const row of TRANSITIONS) {
    if (row.requiredMask === 0) continue;
    const bits = bitPositions(row.requiredMask);
    for (const missingBitIdx of bits) {
      const maskWithout = row.requiredMask & ~(1 << missingBitIdx);
      cases.push({
        name: 'guard_deny_' + STATE_NAMES[row.fromState] + '_' +
              EVENT_NAMES[row.event] + '_missing_' + bitName(missingBitIdx),
        state: row.fromState,
        event: row.event,
        evidence: maskWithout,
        expected: {
          decision: DECISIONS.DENY,
          reason: bitName(missingBitIdx),
          required_next: row.toState,
        },
      });
    }
  }
  return cases;
}

/**
 * Generate illegal-transition cases: every (state, event) pair that has
 * NO transition row, producing DENY with illegal-transition reason.
 */
function generateIllegalCases() {
  const cases = [];
  const transitionSet = new Set(
    TRANSITIONS.map((row) => row.fromState + ':' + row.event)
  );
  for (let stateIdx = 0; stateIdx < STATE_COUNT; stateIdx++) {
    for (let eventIdx = 0; eventIdx < EVENT_COUNT; eventIdx++) {
      const key = stateIdx + ':' + eventIdx;
      if (transitionSet.has(key)) continue;
      cases.push({
        name: 'illegal_' + STATE_NAMES[stateIdx] + '_' + EVENT_NAMES[eventIdx],
        state: stateIdx,
        event: eventIdx,
        evidence: 0,
        expected: {
          decision: DECISIONS.DENY,
          reason: 'illegal-transition',
        },
      });
    }
  }
  return cases;
}

/**
 * Compute the OR of all evidence bit values.
 */
function computeAllBitsMask() {
  return Object.values(EVIDENCE_BITS).reduce(
    function (acc, val) { return acc | val; }, 0
  );
}

/**
 * Generate adversarial cases for force-close and cancel vectors.
 */
function adversarialCloseAndCancel(EB) {
  return [
    { name: 'adversarial_force_close_no_pr_merged',
      state: STATES.REVIEW, event: EVENTS.CONSULTANT_CLOSEOUT,
      evidence: EB.CONSULTANT_CLOSEOUT,
      expected: { decision: DECISIONS.DENY, reason: 'pr_merged' } },
    { name: 'adversarial_cancel_no_disposition',
      state: STATES.IN_PROGRESS, event: EVENTS.CANCEL, evidence: 0,
      expected: { decision: DECISIONS.DENY, reason: 'disposition_recorded' } },
  ];
}

/**
 * Generate adversarial cases for signer-collision and spoofed-evidence vectors.
 */
function adversarialSignerAndSpoofed(EB, allBitsMask) {
  return [
    { name: 'adversarial_signer_collision',
      state: STATES.TESTING, event: EVENTS.ADMIN_HANDOFF,
      evidence: EB.ADMIN_HANDOFF | EB.CI_GREEN | EB.WORKTREE_MERGE_OK,
      expected: { decision: DECISIONS.DENY, reason: 'signer_independent' } },
    { name: 'adversarial_spoofed_terminal_done',
      state: STATES.DONE, event: EVENTS.PICKUP_MANAGER, evidence: allBitsMask,
      expected: { decision: DECISIONS.DENY, reason: 'illegal-transition' } },
    { name: 'adversarial_spoofed_terminal_cancelled',
      state: STATES.CANCELLED, event: EVENTS.RESUME, evidence: allBitsMask,
      expected: { decision: DECISIONS.DENY, reason: 'illegal-transition' } },
  ];
}

/**
 * Generate adversarial cases for stale-state and missing-evidence vectors.
 */
function adversarialStaleAndMissing(EB) {
  return [
    { name: 'adversarial_missing_acs_pass',
      state: STATES.IN_PROGRESS, event: EVENTS.COLLABORATOR_HANDOFF,
      evidence: EB.COLLABORATOR_HANDOFF,
      expected: { decision: DECISIONS.DENY, reason: 'all_acs_pass' } },
    { name: 'adversarial_stale_merge_partial_evidence',
      state: STATES.TESTING, event: EVENTS.MERGE,
      evidence: EB.ADMIN_HANDOFF | EB.CI_GREEN | EB.SIGNER_INDEPENDENT,
      expected: { decision: DECISIONS.DENY, reason: 'worktree_merge_ok' } },
    { name: 'adversarial_baton_back_no_reason',
      state: STATES.TESTING, event: EVENTS.BATON_BACK, evidence: 0,
      expected: { decision: DECISIONS.DENY, reason: 'baton_back_reason' } },
  ];
}

/**
 * Generate adversarial fixture cases that must always DENY.
 */
function generateAdversarialCases() {
  const EB = EVIDENCE_BITS;
  const allBitsMask = computeAllBitsMask();
  return [
    ...adversarialCloseAndCancel(EB),
    ...adversarialSignerAndSpoofed(EB, allBitsMask),
    ...adversarialStaleAndMissing(EB),
  ];
}

/**
 * Generate all corpus categories. Returns an object keyed by category name.
 */
function generateCorpus() {
  return {
    legal: generateLegalCases(),
    'guard-deny': generateGuardDenyCases(),
    illegal: generateIllegalCases(),
    adversarial: generateAdversarialCases(),
  };
}

/**
 * Write corpus JSON files to the given directory.
 */
function writeCorpus(corpusDir) {
  mkdirSync(corpusDir, { recursive: true });
  const corpus = generateCorpus();
  for (const [category, cases] of Object.entries(corpus)) {
    const filePath = join(corpusDir, category + '.json');
    writeFileSync(filePath, JSON.stringify(cases, null, 2) + '\n');
  }
  const totalCount = Object.values(corpus).reduce(
    function (sum, arr) { return sum + arr.length; }, 0
  );
  return { categories: Object.keys(corpus), totalCount };
}

if (require.main === module) {
  const result = writeCorpus(CORPUS_DIR);
  console.log('Corpus generated: ' + result.totalCount + ' cases across ' +
    result.categories.join(', '));
}

module.exports = { generateCorpus, writeCorpus, CORPUS_DIR };
