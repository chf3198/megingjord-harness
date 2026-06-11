'use strict';
// stress-test for the C4 escalation invariant (#2930 / Epic #2926 C4).
// Stress contract: >=1 chaos/fault-injection path (G6) AND >=1 p99 latency budget (G7).
// Chaos = a sustained OUTAGE (availability failures under load) + a mixed availability/capability
// storm; the metric asserted is the D4 guarantee: premium-on-outage == 0.
const test = require('node:test');
const assert = require('node:assert');
const cb = require('../scripts/global/circuit-breaker');
const { escalate } = require('../scripts/global/fleet-escalation-policy');

const ITERATIONS = 500;
const P99_BUDGET_MS = 50;

function percentile(sorted, p) {
  const idx = Math.min(sorted.length - 1, Math.ceil((p / 100) * sorted.length) - 1);
  return sorted[idx];
}

test('G6 chaos OUTAGE: 500 availability failures → premium count == 0 (D4 metric)', () => {
  const breaker = cb.create();
  let premiumCount = 0; let freeCloudCount = 0;
  for (let i = 0; i < ITERATIONS; i += 1) {
    const reason = i % 3 === 0 ? 'ollama_unreachable' : (i % 3 === 1 ? 'fetch failed' : 'circuit-open');
    const d = escalate({ reason, currentTier: 'fleet', breaker, nowMs: i });
    if (d.tier === 'premium') premiumCount += 1;
    if (d.tier === 'free-cloud') freeCloudCount += 1;
  }
  assert.strictEqual(premiumCount, 0, 'premium-on-outage MUST be 0');
  assert.strictEqual(freeCloudCount, ITERATIONS, 'every outage failure routes to the $0 free-cloud tier');
});

test('G6 chaos MIXED storm: capability failures may reach premium ONLY from free-cloud, never from an outage', () => {
  const breaker = cb.create();
  for (let i = 0; i < ITERATIONS; i += 1) {
    const availability = i % 2 === 0;
    const reason = availability ? 'ollama_unreachable' : 'judge_low_score';
    // Capability decisions originate from whatever tier currently served; simulate fleet vs free-cloud.
    const currentTier = availability ? 'fleet' : (i % 4 === 1 ? 'free-cloud' : 'fleet');
    const d = escalate({ reason, currentTier, breaker, nowMs: i });
    if (d.failureClass === 'availability') assert.notStrictEqual(d.tier, 'premium', 'no premium from availability');
    if (d.tier === 'premium') assert.strictEqual(currentTier, 'free-cloud', 'premium only from free-cloud capability fail');
  }
});

test('G7 p99: escalate() decision latency stays under budget under load', () => {
  const breaker = cb.create();
  const latencies = [];
  for (let i = 0; i < ITERATIONS; i += 1) {
    const start = process.hrtime.bigint();
    escalate({ reason: 'ollama_unreachable', currentTier: 'fleet', breaker, nowMs: i });
    latencies.push(Number(process.hrtime.bigint() - start) / 1e6);
  }
  latencies.sort((a, b) => a - b);
  const p99 = percentile(latencies, 99);
  assert.ok(p99 < P99_BUDGET_MS, `p99 escalate latency ${p99.toFixed(3)}ms exceeded ${P99_BUDGET_MS}ms`);
});
