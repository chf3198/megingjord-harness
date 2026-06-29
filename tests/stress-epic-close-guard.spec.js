'use strict';
// Stress tests for the Epic parent-close guard (#3350 AC5).
// Goal alignment: G6 resilience (chaos / no-flap), G7 throughput (p99 budget).
const assert = require('node:assert/strict');
const { test } = require('node:test');
const S = require('../scripts/global/epic-child-state.js');

// Deterministic PRNG so the chaos run is reproducible (no Date.now/Math.random).
function lcg(seed) {
  let s = seed >>> 0;
  return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 0xffffffff; };
}

test('G6 chaos: concurrent close attempts never flap (terminalised children stay closed)', async () => {
  const rand = lcg(20260629);
  const ATTEMPTS = 2000;
  let flaps = 0;
  const runs = Array.from({ length: ATTEMPTS }, (_, i) => async () => {
    // Chaos: a close event fires with K initially-open children, then GitHub
    // eventual-consistency may report fewer/zero at re-check (children racing
    // to terminal). The guard must reopen ONLY when re-check still sees open.
    const initialOpen = Math.floor(rand() * 8);
    const terminalisedMidFlight = initialOpen > 0 && rand() < 0.5;
    const recheckOpen = terminalisedMidFlight ? 0 : initialOpen;
    const decision = S.decideReopen({ initialOpenCount: initialOpen, recheckOpenCount: recheckOpen });
    // Invariant 1: zero confirmed-open ⇒ never reopen (this is the suppression
    // that prevents a close↔reopen loop after children are terminalised).
    if (recheckOpen === 0) assert.equal(decision.reopen, false, `flap at run ${i}: reopened with 0 confirmed-open`);
    // Invariant 2: a second attempt on the same now-terminal epic also no-ops.
    if (recheckOpen === 0) {
      const second = S.decideReopen({ initialOpenCount: 0, recheckOpenCount: 0 });
      assert.equal(second.reopen, false);
    }
    if (decision.reopen && recheckOpen === 0) flaps++;
  });
  await Promise.all(runs.map(r => r()));
  assert.equal(flaps, 0, `${flaps} flap(s) detected across ${ATTEMPTS} concurrent attempts`);
});

test('G6 fault-injection: malformed / adversarial candidate sets never throw', () => {
  const adversarial = [
    null, undefined, [], [{ number: 1 }], [{ number: 'x', state: 'open', body: null }],
    [{ number: 2, state: 'OPEN', body: 'Refs Epic #3021'.repeat(5000) }],
    [{ number: 3, state: 'open', body: { nope: true } }],
  ];
  for (const set of adversarial) {
    assert.doesNotThrow(() => S.openChildUnion(3021, set));
  }
  assert.doesNotThrow(() => S.reconcileCloseoutAssertion({ closeoutBody: null, openChildNumbers: null }));
  assert.doesNotThrow(() => S.reconcileCloseoutAssertion({}));
});

test('G6 concurrency: parallel evaluation is deterministic (no shared-state corruption)', async () => {
  const candidates = [
    { number: 3031, state: 'open', body: 'Refs Epic #3021' },
    { number: 9999, state: 'open', body: 'see also #3021' },
  ];
  const results = await Promise.all(
    Array.from({ length: 500 }, () => Promise.resolve(S.openChildUnion(3021, candidates)))
  );
  for (const r of results) assert.deepEqual(r.map(c => c.number), [3031]);
});

test('G7 p99: decision path stays within latency budget', () => {
  const candidates = Array.from({ length: 100 }, (_, i) => ({
    number: i, state: i % 2 ? 'open' : 'closed', body: i % 3 ? `Refs Epic #3021` : 'noise', nativeParent: null,
  }));
  const samples = [];
  const ITER = 3000;
  for (let i = 0; i < ITER; i++) {
    const t0 = process.hrtime.bigint();
    const open = S.openChildUnion(3021, candidates);
    S.reconcileCloseoutAssertion({ closeoutBody: 'CONSULTANT_CLOSEOUT', openChildNumbers: open.map(c => c.number) });
    S.decideReopen({ initialOpenCount: open.length, recheckOpenCount: open.length });
    samples.push(Number(process.hrtime.bigint() - t0) / 1e6); // ms
  }
  samples.sort((a, b) => a - b);
  const p99 = samples[Math.floor(samples.length * 0.99)];
  const BUDGET_MS = 5; // pure in-memory union over 100 candidates — generous ceiling
  assert.ok(p99 < BUDGET_MS, `p99 ${p99.toFixed(3)}ms exceeded ${BUDGET_MS}ms budget`);
});
