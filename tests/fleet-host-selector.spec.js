'use strict';
// tdd-pyramid unit tests for the F3 least-loaded host selector (Epic #3414 #3486).

const assert = require('node:assert/strict');
const { test } = require('node:test');
const sel = require('../scripts/global/fleet-host-selector.js');

const A = { id: 'a', reachable: true, ps: [1, 2], gpu: { vramFreeMb: 2000 } };
const B = { id: 'b', reachable: true, ps: [], gpu: { vramFreeMb: 8000 } };
const DOWN = { id: 'c', reachable: false };

test('AC1 — picks the least-loaded warm host (fewer resident models)', () => {
  assert.equal(sel.selectLeastLoaded([A, B]).id, 'b');
});

test('AC1 — tie on resident count breaks toward more free VRAM', () => {
  const x = { id: 'x', reachable: true, ps: [1], gpu: { vramFreeMb: 1000 } };
  const y = { id: 'y', reachable: true, ps: [1], gpu: { vramFreeMb: 9000 } };
  assert.equal(sel.selectLeastLoaded([x, y]).id, 'y');
});

test('AC1 — a down peer is skipped (degrade to the reachable host = F2)', () => {
  const posture = sel.resolveHostPosture([A, DOWN]);
  assert.equal(posture.tier, 'F2');
  assert.equal(posture.host.id, 'a');
  assert.deepEqual(posture.peersDown, ['c']);
});

test('AC1 — all hosts down → null host (caller falls to free-cloud)', () => {
  const posture = sel.resolveHostPosture([DOWN, { id: 'd', reachable: false }]);
  assert.equal(posture.host, null);
  assert.equal(posture.tier, 'F0');
});

test('AC1 — two reachable hosts → F3', () => {
  assert.equal(sel.resolveHostPosture([A, B]).tier, 'F3');
});

test('AC1 — deterministic tie-break by id when load is identical', () => {
  const p = { id: 'p', reachable: true, ps: [], gpu: { vramFreeMb: 5000 } };
  const q = { id: 'q', reachable: true, ps: [], gpu: { vramFreeMb: 5000 } };
  assert.equal(sel.selectLeastLoaded([q, p]).id, 'p');
  assert.equal(sel.selectLeastLoaded([p, q]).id, 'p');
});

test('never throws on empty / malformed input', () => {
  for (const bad of [undefined, null, [], [{}], [{ reachable: true }]]) {
    assert.doesNotThrow(() => sel.resolveHostPosture(bad));
  }
  assert.equal(sel.selectLeastLoaded(undefined), null);
});
