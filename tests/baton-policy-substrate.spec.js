// baton-policy-substrate.spec.js
// Contract test: policy-substrate === kernel.decide for all combos.
// tdd-pyramid + contract-test strategy. Refs #3286, Epic #3284.
'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');

const {
  STATES, EVENTS, EVIDENCE_BITS, DECISIONS,
  STATE_NAMES, EVENT_NAMES, EVIDENCE_BIT_NAMES, TRANSITIONS,
} = require('../scripts/global/baton-fsm/transitions');
const { decide, unpack, REASON_ILLEGAL_TRANSITION, REASON_NONE } = require('../scripts/global/baton-fsm/kernel');
const { evaluatePolicy, POLICY_VERSION } = require('../scripts/global/baton-fsm-policy/policy-substrate');

const stateValues = Object.values(STATES);
const eventValues = Object.values(EVENTS);

function buildRepresentativeMasks() {
  const masks = new Set();
  masks.add(0);
  for (const bitVal of Object.values(EVIDENCE_BITS)) {
    masks.add(bitVal);
  }
  for (const row of TRANSITIONS) {
    masks.add(row.requiredMask);
  }
  let allBits = 0;
  for (const bitVal of Object.values(EVIDENCE_BITS)) {
    allBits |= bitVal;
  }
  masks.add(allBits);
  masks.add(EVIDENCE_BITS.COLLABORATOR_HANDOFF | EVIDENCE_BITS.ALL_ACS_PASS);
  masks.add(EVIDENCE_BITS.ADMIN_HANDOFF | EVIDENCE_BITS.SIGNER_INDEPENDENT);
  masks.add(EVIDENCE_BITS.ADMIN_HANDOFF | EVIDENCE_BITS.CI_GREEN | EVIDENCE_BITS.WORKTREE_MERGE_OK);
  masks.add(EVIDENCE_BITS.CONSULTANT_CLOSEOUT | EVIDENCE_BITS.PR_MERGED);
  masks.add(EVIDENCE_BITS.DISPOSITION_RECORDED);
  masks.add(EVIDENCE_BITS.BATON_BACK_REASON);
  return Array.from(masks);
}

const representativeMasks = buildRepresentativeMasks();

function kernelDecisionName(decisionCode) {
  if (decisionCode === DECISIONS.ALLOW) return 'allow';
  if (decisionCode === DECISIONS.DENY) return 'deny';
  if (decisionCode === DECISIONS.ALLOW_ADVISORY) return 'allow_advisory';
  return 'unknown';
}

function kernelReasonName(reasonCode) {
  if (reasonCode === REASON_NONE) return 'none';
  if (reasonCode === REASON_ILLEGAL_TRANSITION) return 'illegal-transition';
  return EVIDENCE_BIT_NAMES[reasonCode] || ('unknown-bit-' + reasonCode);
}
describe('policy-substrate contract with kernel', () => {
  let totalChecked = 0;

  it('POLICY_VERSION is present and is a semver string', () => {
    assert.ok(POLICY_VERSION, 'POLICY_VERSION must be defined');
    assert.match(POLICY_VERSION, /^\d+\.\d+\.\d+$/, 'must be semver');
  });

  it('decision matches kernel.decide for all states x events x representative masks', () => {
    for (const stateCode of stateValues) {
      for (const eventCode of eventValues) {
        for (const mask of representativeMasks) {
          const kernelPacked = decide(stateCode, eventCode, mask);
          const kernelUnpacked = unpack(kernelPacked);
          const policyResult = evaluatePolicy(stateCode, eventCode, mask);
          totalChecked++;
          const expectedDecision = kernelDecisionName(kernelUnpacked.decision);
          assert.equal(
            policyResult.decision,
            expectedDecision,
            'Decision mismatch at state=' + STATE_NAMES[stateCode] +
            ' event=' + EVENT_NAMES[eventCode] + ' mask=' + mask +
            ': policy=' + policyResult.decision + ' kernel=' + expectedDecision
          );
          const expectedReason = kernelReasonName(kernelUnpacked.reasonCode);
          assert.equal(
            policyResult.reason,
            expectedReason,
            'Reason mismatch at state=' + STATE_NAMES[stateCode] +
            ' event=' + EVENT_NAMES[eventCode] + ' mask=' + mask +
            ': policy=' + policyResult.reason + ' kernel=' + expectedReason
          );
          if (kernelUnpacked.reasonCode === REASON_ILLEGAL_TRANSITION) {
            assert.equal(policyResult.required_next, 'none',
              'required_next should be none for illegal-transition');
          } else {
            const expectedNext = STATE_NAMES[kernelUnpacked.requiredNext];
            assert.equal(policyResult.required_next, expectedNext,
              'required_next mismatch at state=' + STATE_NAMES[stateCode] +
              ' event=' + EVENT_NAMES[eventCode] + ' mask=' + mask);
          }
        }
      }
    }
    const expectedMin = stateValues.length * eventValues.length * representativeMasks.length;
    assert.ok(totalChecked >= expectedMin,
      'Expected at least ' + expectedMin + ' checks, got ' + totalChecked);
  });
  it('decision_log is non-empty and ordered for every evaluation', () => {
    const spotCases = [
      { state: STATES.BACKLOG, event: EVENTS.PICKUP_MANAGER, mask: 0 },
      { state: STATES.TRIAGE, event: EVENTS.MANAGER_HANDOFF, mask: EVIDENCE_BITS.MANAGER_HANDOFF },
      { state: STATES.TRIAGE, event: EVENTS.MANAGER_HANDOFF, mask: 0 },
      { state: STATES.DONE, event: EVENTS.CANCEL, mask: EVIDENCE_BITS.DISPOSITION_RECORDED },
      { state: STATES.IN_PROGRESS, event: EVENTS.COLLABORATOR_HANDOFF, mask: EVIDENCE_BITS.COLLABORATOR_HANDOFF | EVIDENCE_BITS.ALL_ACS_PASS },
      { state: STATES.TESTING, event: EVENTS.ADMIN_HANDOFF, mask: 0 },
      { state: STATES.REVIEW, event: EVENTS.CONSULTANT_CLOSEOUT, mask: EVIDENCE_BITS.CONSULTANT_CLOSEOUT | EVIDENCE_BITS.PR_MERGED },
      { state: STATES.IN_PROGRESS, event: EVENTS.EPIC_PAUSE, mask: 0 },
      { state: STATES.READY, event: EVENTS.PICKUP_COLLABORATOR, mask: 0 },
    ];
    for (const testCase of spotCases) {
      const result = evaluatePolicy(testCase.state, testCase.event, testCase.mask);
      assert.ok(Array.isArray(result.decision_log),
        'decision_log must be an array for state=' + testCase.state + ' event=' + testCase.event);
      assert.ok(result.decision_log.length !== 0,
        'decision_log must be non-empty for state=' + testCase.state + ' event=' + testCase.event);
      for (const entry of result.decision_log) {
        assert.ok(entry.rule_id, 'decision_log entry must have rule_id');
        assert.ok('input' in entry, 'decision_log entry must have input');
        assert.ok('matched' in entry, 'decision_log entry must have matched');
        assert.ok('verdict' in entry, 'decision_log entry must have verdict');
      }
      const ruleOrder = ['terminal-sink-guard', 'transition-lookup', 'evidence-gate', 'allow-transition'];
      const logRuleIds = result.decision_log.map((entry) => entry.rule_id);
      let prevIdx = -1;
      for (const ruleId of logRuleIds) {
        const idx = ruleOrder.indexOf(ruleId);
        assert.ok(idx !== -1 || prevIdx === -1, 'Unknown rule_id: ' + ruleId);
        if (idx !== -1) {
          assert.ok(idx >= prevIdx, 'Rules must be in order: ' + ruleId + ' appeared out of sequence');
          prevIdx = idx;
        }
      }
    }
  });

  it('POLICY_VERSION is present on every result', () => {
    const result = evaluatePolicy(STATES.BACKLOG, EVENTS.PICKUP_MANAGER, 0);
    assert.equal(result.policy_version, POLICY_VERSION);
    const denyResult = evaluatePolicy(STATES.DONE, EVENTS.CANCEL, 0);
    assert.equal(denyResult.policy_version, POLICY_VERSION);
  });

  it('reports total sweep count', () => {
    const sweepSize = stateValues.length * eventValues.length * representativeMasks.length;
    assert.ok(sweepSize >= 1000, 'Sweep should cover at least 1000 combinations, got ' + sweepSize);
  });
});
