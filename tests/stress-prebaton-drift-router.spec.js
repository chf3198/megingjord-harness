'use strict';
// Stress coverage for the pre-baton drift router (#3421, Epic #3398 C3). The
// safety-critical invariant: a wrong autonomous cancel is the costly error, so NO
// adversarial / malformed flag may ever route a P1/Epic cancel autonomously.
//   (G6) chaos / fault-injection — hostile flag shapes never auto-cancel + never throw.
//   (G7) p99 latency budget on the routing hot path.
const assert = require('node:assert/strict');
const { test } = require('node:test');
const lib = require('../scripts/global/prebaton-drift-router.js');

test('safety invariant: no hostile flag ever routes a P1/Epic cancel autonomously (G6)', () => {
  const hostile = [
    { ticket: 1, flag: 'superseded', priority: 'p1' }, // lowercase priority
    { ticket: 2, flag: 'superseded', priority: 'P1', isEpic: 'true' }, // string truthy
    { ticket: 3, flag: 'superseded', type: 'epic' },
    { ticket: 4, flag: 'SUPERSEDED', priority: 'P1' }, // case
    { ticket: 5, flag: 'superseded', priority: 'P1', cls: 'PB9' }, // bad class
    { ticket: 6, proposedAction: 'cancel', priority: 'P1' },
    null, {}, { ticket: NaN, flag: 'superseded', priority: 'P1' },
    { ticket: '7', flag: 'superseded', isEpic: true }, // string ticket
  ];
  for (const raw of hostile) {
    const d = lib.route(raw, 't');
    if (d.gate === 'skip') continue;
    // If it's a cancel of a P1/Epic, it MUST be human-gated, never autonomous.
    const f = d.flag;
    if (f.proposedAction === 'cancel' && (f.priority === 'P1' || f.isEpic === true)) {
      assert.equal(d.gate, 'human', `hostile ${JSON.stringify(raw)} must be human-gated`);
      assert.equal(d.seed, null); // never a direct-file cancel path
    }
  }
});

test('lowercase/aliased P1 + epic still trip the human gate (normalization is defensive)', () => {
  assert.equal(lib.route({ ticket: 1, flag: 'superseded', priority: 'p1' }, 't').gate, 'human');
  assert.equal(lib.route({ ticket: 2, flag: 'superseded', type: 'epic' }, 't').gate, 'human');
});

test('router never emits a direct cancel instruction — only seed or humanProposal', () => {
  for (let i = 0; i < 500; i += 1) {
    const d = lib.route({ ticket: i, flag: i % 2 ? 'superseded' : 'partial', priority: i % 3 ? 'P1' : 'P2', isEpic: i % 5 === 0 }, 't');
    assert.ok(['autonomous', 'human', 'skip'].includes(d.gate));
    assert.ok(!('cancelInstruction' in d) && !('cancel' in d));
    if (d.gate === 'human') assert.ok(d.humanProposal && !d.seed);
  }
});

test('p99 latency budget: route() < 1ms p99 over 5k adversarial flags (G7)', () => {
  const samples = [];
  for (let i = 0; i < 5000; i += 1) {
    const raw = { ticket: i, flag: i % 2 ? 'superseded' : 'partial', priority: i % 4 ? 'P1' : 'P3', isEpic: i % 7 === 0, evidence: 'x'.repeat(500) };
    const t0 = process.hrtime.bigint();
    lib.route(raw, '2026-07-09T00:00:00Z', 'test');
    samples.push(Number(process.hrtime.bigint() - t0) / 1e6);
  }
  samples.sort((a, b) => a - b);
  const p99 = samples[Math.floor(samples.length * 0.99)];
  assert.ok(p99 < 1, `p99=${p99.toFixed(4)}ms exceeds 1ms budget`);
});
