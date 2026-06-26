'use strict';
// tdd-pyramid for baton-back.js (Epic #3251 P1-a #3257).
const test = require('node:test');
const assert = require('node:assert');
const bb = require('../scripts/global/baton-back');

test('routeRemediation: file fix -> collaborator baton-back', () => {
  assert.deepStrictEqual(bb.routeRemediation({ touchesFile: true }),
    { remediator: 'collaborator', impact: 'baton-back' });
});

test('routeRemediation: own artifact/git-op -> current role block-in-place', () => {
  assert.deepStrictEqual(bb.routeRemediation({ ownArtifactOrGitOp: true, currentRole: 'admin' }),
    { remediator: 'admin', impact: 'block-in-place' });
});

test('routeRemediation: governance metadata -> manager hold', () => {
  assert.deepStrictEqual(bb.routeRemediation({ governanceMetadata: true }),
    { remediator: 'manager', impact: 'hold' });
});

test('routeRemediation: environmental -> override (no baton-back)', () => {
  assert.deepStrictEqual(bb.routeRemediation({ environmental: true }),
    { remediator: null, impact: 'override' });
});

test('routeRemediation: unclassified blocking -> manager hold (never silent pass)', () => {
  assert.strictEqual(bb.routeRemediation({}).impact, 'hold');
});

test('close-gate invariant: cannot close while open', () => {
  const m = bb.openMarker({ touchesFile: true }, { detector: 'ci' });
  assert.strictEqual(bb.isOpen(m), true);
  assert.strictEqual(bb.closeGateAllows(m), false);
});

test('clearMarker: clears only when the detector passes', () => {
  const m = bb.openMarker({ touchesFile: true }, { detector: 'ci' });
  assert.strictEqual(bb.clearMarker(m, false).open, true);
  const cleared = bb.clearMarker(m, true);
  assert.strictEqual(cleared.open, false);
  assert.strictEqual(bb.closeGateAllows(cleared), true);
});

test('nextCycle: bounded, non-blocking escalation past maxCycles', () => {
  let m = bb.openMarker({ touchesFile: true }, { detector: 'ci' }); // cycle 1
  m = bb.nextCycle(m); // 2
  assert.strictEqual(m.escalate, false);
  m = bb.nextCycle(m); // 3
  assert.strictEqual(m.escalate, false);
  m = bb.nextCycle(m); // 4 > 3
  assert.strictEqual(m.escalate, true);
  assert.strictEqual(m.escalation.blocking, false);
  assert.strictEqual(m.escalation.park, 'status:deferred');
  assert.strictEqual(m.escalation.pattern_id, 'baton-back-nonconverging');
});
