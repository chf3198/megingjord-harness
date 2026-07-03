'use strict';
// Stress spec for the F3 velocity-median helper (#3526, Epic #3517 / ADR-020 §D2).
// Asserts a p99 latency budget (G7) and a fault-injection/chaos path (G6) per the
// test-methodology-matrix stress contract.

const assert = require('node:assert/strict');
const { test } = require('node:test');
const { medianCycleTime, thresholdFromSamples } = require('../scripts/global/median-cycle-time.js');

function bigSamples(n) {
  const out = [];
  for (let i = 0; i < n; i++) {
    out.push({ inProgressAt: new Date(2026, 0, 1 + (i % 300)).toISOString(),
      closedAt: new Date(2026, 0, 1 + (i % 300) + (i % 40)).toISOString() });
  }
  return out;
}

test('G7 perf budget: median over a large sample set stays under p99 budget', () => {
  const samples = bigSamples(5000);
  const runs = 200;
  const times = [];
  for (let i = 0; i < runs; i++) {
    const t0 = process.hrtime.bigint();
    thresholdFromSamples(samples);
    times.push(Number(process.hrtime.bigint() - t0) / 1e6); // ms
  }
  times.sort((a, b) => a - b);
  const p99 = times[Math.floor(runs * 0.99)];
  assert.ok(p99 < 50, `p99 ${p99.toFixed(2)}ms exceeded 50ms budget`);
});

test('G6 chaos: malformed / adversarial samples never throw and never fabricate a threshold', () => {
  const chaos = [
    null, undefined, 42, 'nope', {}, { inProgressAt: null, closedAt: null },
    { inProgressAt: 'not-a-date', closedAt: 'also-bad' },
    { inProgressAt: '2026-02-01', closedAt: '2026-01-01' }, // closed before start
    { closedAt: '2026-03-01' }, { inProgressAt: '2026-03-01' },
  ];
  assert.doesNotThrow(() => medianCycleTime(chaos));
  // Too few VALID samples ⇒ cold-start ⇒ floor (45), never a spurious velocity threshold.
  assert.equal(medianCycleTime(chaos), null);
  assert.equal(thresholdFromSamples(chaos), 45);
  assert.doesNotThrow(() => thresholdFromSamples('garbage'));
  assert.equal(thresholdFromSamples('garbage'), 45);
});
