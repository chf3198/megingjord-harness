'use strict';
// stress-test for the #3766 stuck-state hook bridge (adversarial-input parser surface).
// Asserts: (G6) a chaos/fault-injection corpus never throws and never emits a client-prompt route
// on reversible signals; (G7) a p99 latency budget for the synchronous hook path (must stay well
// inside the Stop-hook timeout). No network — the hook path is classifyDecision (synchronous).
const test = require('node:test');
const assert = require('node:assert');
const B = require('../scripts/global/stuck-state-hook-bridge');

const P99_BUDGET_MS = 20; // synchronous classify path; Stop-hook timeout is 8000ms — huge margin.

function randomSignals(i) {
  const pool = [null, undefined, 0, '', 'x', {}, [], NaN, Infinity, -1, 1e9, { bad: 1 }];
  const pick = (n) => pool[(i * 7 + n) % pool.length];
  return {
    invocations: i % 3 === 0 ? Array.from({ length: (i % 6) }, () => ({ tool: 'Bash', command: `c${i % 2}` })) : pick(1),
    iterationCount: pick(2), tokenBudgetFraction: pick(3), toolErrorCount: pick(4),
    sampledResolutions: i % 4 === 0 ? ['A', 'B', 'C'] : pick(5),
    explicit: pick(6), reversibility: pick(0), blastRadius: pick(1),
  };
}

test('G6 chaos: 5000 adversarial inputs never throw', () => {
  for (let i = 0; i < 5000; i += 1) {
    assert.doesNotThrow(() => B.classifyStuck(randomSignals(i)));
  }
});

test('G6 fault-injection: reversible detected states never route to human-carveout', () => {
  for (let i = 0; i < 2000; i += 1) {
    const r = B.classifyStuck({ ...randomSignals(i), reversibility: 'reversible', blastRadius: 'low' });
    if (r.detected) assert.notEqual(r.route, 'human-carveout');
  }
});

test('G7 p99 latency budget for the synchronous hook path', () => {
  const N = 3000;
  const times = [];
  for (let i = 0; i < N; i += 1) {
    const t0 = process.hrtime.bigint();
    B.classifyStuck(randomSignals(i));
    times.push(Number(process.hrtime.bigint() - t0) / 1e6);
  }
  times.sort((a, b) => a - b);
  const p99 = times[Math.floor(N * 0.99)];
  assert.ok(p99 < P99_BUDGET_MS, `p99 ${p99.toFixed(3)}ms exceeds ${P99_BUDGET_MS}ms budget`);
});
