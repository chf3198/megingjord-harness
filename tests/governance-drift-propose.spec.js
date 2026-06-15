'use strict';

// @megalint:test-discoverability:opt-out — node:test runner spec (run via `node --test`).
// Unit coverage for the #2990 propose-only drift review queue.

const { test } = require('node:test');
const assert = require('node:assert/strict');
const {
  buildProposeQueue,
  PROPOSE_CLASSES,
  PROPOSE_META,
  ALLOWED_LANES,
} = require('../scripts/global/governance-drift-propose');
const { classifyIssue } = require('../scripts/global/governance-drift-sweep');

function labelObjs(names) {
  return names.map((name) => ({ name }));
}

test('PROPOSE_CLASSES is exactly the ambiguous set D1/D2/D6/D7 (disjoint from auto-fix)', () => {
  assert.deepEqual([...PROPOSE_CLASSES].sort(), ['D1', 'D2', 'D6', 'D7']);
  for (const safe of ['D3', 'D4', 'D5', 'D8']) assert.ok(!PROPOSE_CLASSES.includes(safe));
});

test('D2 (in-progress, no role) yields a manager-verdict proposal with rationale + action', () => {
  const issue = { number: 10, title: 'plain', state: 'open', labels: labelObjs(['status:in-progress']) };
  const queue = buildProposeQueue([issue], classifyIssue);
  const d2 = queue.proposals.find((proposal) => proposal.class === 'D2');
  assert.ok(d2);
  assert.equal(d2.mutates, false);
  assert.equal(d2.verdict_required, 'manager');
  assert.ok(d2.rationale.length > 0 && d2.suggested_action.length > 0);
});

test('D6 (dormant Epic, no EPIC_REVIEW) yields a proposal', () => {
  const issue = { number: 11, title: 'epic', state: 'open', labels: labelObjs(['type:epic', 'status:dormant']) };
  const queue = buildProposeQueue([issue], classifyIssue);
  assert.ok(queue.proposals.some((proposal) => proposal.class === 'D6'));
});

test('D7 (stalled coordinator label) yields a consultant-verdict proposal', () => {
  const issue = { number: 12, title: 'x', state: 'open', labels: labelObjs(['coordinator:cross-team-needs-hand-off']) };
  const queue = buildProposeQueue([issue], classifyIssue);
  const d7 = queue.proposals.find((proposal) => proposal.class === 'D7');
  assert.ok(d7);
  assert.equal(d7.verdict_required, 'consultant');
});

test('every proposal is read-only (mutates:false) and routes only to free/fleet lane', () => {
  const issues = [
    { number: 20, title: 'x', state: 'open', labels: [] }, // D1 unlabeled
    { number: 21, title: 'y', state: 'open', labels: labelObjs(['status:in-progress']) }, // D2
    { number: 22, title: 'z', state: 'open', labels: labelObjs(['type:epic', 'status:deferred']) }, // D6
  ];
  const queue = buildProposeQueue(issues, classifyIssue);
  assert.ok(queue.proposals.length >= 3);
  assert.equal(queue.premiumLaneProhibited, true);
  for (const proposal of queue.proposals) {
    assert.equal(proposal.mutates, false);
    assert.ok(ALLOWED_LANES.has(proposal.inference_lane), `lane ${proposal.inference_lane} must be free/fleet`);
    assert.notEqual(proposal.inference_lane, 'premium');
  }
});

test('safe-only corpus produces an empty propose queue', () => {
  // Fully labeled (no D1) + status:testing with role (no D2) + resolution on open (D4) + title prefix (D3).
  // Only auto-fix-safe classes fire, so the propose queue stays empty.
  const issue = {
    number: 30,
    title: 'fix: thing',
    state: 'open',
    labels: labelObjs(['type:task', 'status:testing', 'priority:P2', 'role:admin', 'resolution:released']),
  };
  const queue = buildProposeQueue([issue], classifyIssue);
  assert.equal(queue.total, 0);
  assert.deepEqual(queue.proposals, []);
});

test('buildProposeQueue requires a classify function (fail-closed)', () => {
  assert.throws(() => buildProposeQueue([], null), /classify function is required/);
});

test('every PROPOSE_META lane is in the allowed set', () => {
  for (const cls of PROPOSE_CLASSES) {
    assert.ok(ALLOWED_LANES.has(PROPOSE_META[cls].inference_lane));
  }
});
