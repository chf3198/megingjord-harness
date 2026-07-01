'use strict';
// Tests for the F6 superseded-resolution apply-decision (#3525, Epic #3517 / ADR-020 §D3).
// Covers all six false-positive controls + the fail-closed (I0) invariant.

const assert = require('node:assert/strict');
const { test } = require('node:test');
const {
  decideSupersededResolution, createsCycle,
  RESOLUTION_LABEL, CONTESTED_LABEL, APPEALS_QUEUE,
} = require('../scripts/global/superseded-resolution.js');

const confirmed = { confirmed: true };
const okRef = (n) => ({ number: n, exists: true });

test('happy path: confirmed verdict + resolvable ref -> apply-superseded + close', () => {
  const r = decideSupersededResolution({
    target: { number: 100 }, verdict: confirmed, supersededByRef: okRef(200),
  });
  assert.equal(r.action, 'apply-superseded');
  assert.equal(r.close, true);
  assert.equal(r.resolutionLabel, RESOLUTION_LABEL);
  assert.equal(r.supersededBy, 200);
  assert.equal(r.bodyLine, 'SUPERSEDED_BY: #200');
});

test('control 4 reversibility: apply carries reopenOn=#M so it auto-reopens if #M reopens', () => {
  const r = decideSupersededResolution({
    target: { number: 100 }, verdict: confirmed, supersededByRef: okRef(200),
  });
  assert.equal(r.reopenOn, 200);
});

test('control 1 two-signal: confirmed but no ref -> contested (never close)', () => {
  const r = decideSupersededResolution({
    target: { number: 100 }, verdict: confirmed, supersededByRef: null,
  });
  assert.equal(r.action, 'route-contested');
  assert.equal(r.close, false);
  assert.equal(r.label, CONTESTED_LABEL);
  assert.equal(r.queue, APPEALS_QUEUE);
});

test('control 2 evidence-guard: ref that does not resolve/exist -> contested', () => {
  const r = decideSupersededResolution({
    target: { number: 100 }, verdict: confirmed, supersededByRef: { number: 200, exists: false },
  });
  assert.equal(r.action, 'route-contested');
  assert.equal(r.close, false);
});

test('control 3 self-supersession: #M is the item itself -> contested', () => {
  const r = decideSupersededResolution({
    target: { number: 100 }, verdict: confirmed, supersededByRef: okRef(100),
  });
  assert.equal(r.action, 'route-contested');
  assert.match(r.reason, /self-supersession/);
});

test('control 3 self-supersession: #M is a descendant -> contested', () => {
  const r = decideSupersededResolution({
    target: { number: 100, descendants: [101, 102] }, verdict: confirmed, supersededByRef: okRef(101),
  });
  assert.equal(r.action, 'route-contested');
  assert.match(r.reason, /descendant/);
});

test('control 5 appeals path: explicitly contested verdict -> contested + #2990 queue', () => {
  const r = decideSupersededResolution({
    target: { number: 100 }, verdict: { confirmed: true, contested: true }, supersededByRef: okRef(200),
  });
  assert.equal(r.action, 'route-contested');
  assert.equal(r.queue, APPEALS_QUEUE);
});

test('control 6 acyclic-guard: 2-cycle (A->B while B->A) -> contested', () => {
  // Existing edge 200 -> 100 already recorded; proposing 100 -> 200 closes the cycle.
  const r = decideSupersededResolution({
    target: { number: 100 }, verdict: confirmed, supersededByRef: okRef(200),
    edges: [[200, 100]],
  });
  assert.equal(r.action, 'route-contested');
  assert.match(r.reason, /cycle/);
});

test('control 6 acyclic-guard: longer cycle A->B->C->A -> contested', () => {
  const r = decideSupersededResolution({
    target: { number: 1 }, verdict: confirmed, supersededByRef: okRef(2),
    edges: [[2, 3], [3, 1]],
  });
  assert.equal(r.action, 'route-contested');
});

test('acyclic-guard allows a valid DAG chain (A->B->C, propose C->D) -> apply', () => {
  const r = decideSupersededResolution({
    target: { number: 3 }, verdict: confirmed, supersededByRef: okRef(4),
    edges: [[1, 2], [2, 3]],
  });
  assert.equal(r.action, 'apply-superseded');
});

test('I0 fail-closed: unconfirmed verdict -> no-op (no signal)', () => {
  const r = decideSupersededResolution({
    target: { number: 100 }, verdict: { confirmed: false }, supersededByRef: okRef(200),
  });
  assert.equal(r.action, 'no-op');
  assert.equal(r.close, false);
});

test('I0 fail-closed: malformed/degraded input -> no-op, never apply-close', () => {
  for (const bad of [null, {}, { target: {} }, { target: { number: 1 } }, { verdict: confirmed }]) {
    const r = decideSupersededResolution(bad);
    assert.equal(r.action, 'no-op');
    assert.equal(r.close, false);
  }
});

test('createsCycle: pure helper detects self-loop and mutual edges', () => {
  assert.equal(createsCycle([], 1, 1), true);
  assert.equal(createsCycle([[2, 1]], 1, 2), true);
  assert.equal(createsCycle([[1, 2]], 2, 3), false);
});

test('I0 fail-closed: malformed edges never throw and do not force apply (cross-family finding #1)', () => {
  // Degraded edge sets must be tolerated, not throw — else I0 is bypassed by an exception.
  for (const bad of ['nope', 42, [[1]], [null], [[1, 2, 3]], [{ from: 1 }]]) {
    assert.doesNotThrow(() => createsCycle(bad, 1, 2));
  }
  const r = decideSupersededResolution({
    target: { number: 100 }, verdict: confirmed, supersededByRef: okRef(200), edges: 'garbage',
  });
  // garbage edges are ignored (no spurious cycle); with all real controls passing -> apply.
  assert.equal(r.action, 'apply-superseded');
});
