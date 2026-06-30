'use strict';
// Stress (#1934, Epic #1875 state-mutation surface): ≥1 chaos/fault-injection path (G6) + a p99 budget (G7).
const assert = require('node:assert/strict');
const { test } = require('node:test');
const parity = require('../scripts/global/orchestrator-governance-parity');
const stateCheck = require('../scripts/global/state-store-parity-check');

test('stress G6: concurrent parity reads return a byte-identical state_store map (no corruption)', async () => {
  const runs = await Promise.all(Array.from({ length: 60 }, () => Promise.resolve().then(() => parity.run())));
  const baseline = JSON.stringify(runs[0].observations.stateStore.runtimes);
  for (const r of runs) {
    assert.ok(r.observations.stateStore, 'state_store observation present under concurrency');
    assert.equal(JSON.stringify(r.observations.stateStore.runtimes), baseline,
      'state_store map identical across all concurrent reads');
    assert.equal(r.observations.stateStore.findings.some(f => f.id.startsWith('state-store-unmapped-')), false,
      'no unmapped-runtime finding under concurrency');
  }
});

test('stress G6 chaos: a fault-injected (unmapped) runtime is always detected', () => {
  for (let i = 0; i < 100; i++) {
    const r = stateCheck.run({ stateStore: { runtimes: { copilot: { statePath: 'x', status: 'full' } } },
      runtimes: ['copilot', `injected-rt-${i}`] });
    assert.equal(r.findings.some(f => f.id === `state-store-unmapped-injected-rt-${i}`), true,
      'injected unmapped runtime detected every iteration');
  }
});

test('stress G7: parity scan p99 within 1500ms budget', () => {
  const N = 40; const lat = [];
  for (let i = 0; i < N; i++) {
    const s = process.hrtime.bigint();
    parity.run();
    lat.push(Number(process.hrtime.bigint() - s) / 1e6);
  }
  lat.sort((a, b) => a - b);
  const p99 = lat[Math.max(0, Math.ceil(N * 0.99) - 1)];
  assert.ok(p99 < 1500, `state_store parity scan p99 ${p99.toFixed(1)}ms must be < 1500ms`);
});
