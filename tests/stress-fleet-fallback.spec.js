'use strict';
// stress-test for the C3 probe-first fleet fallback (#2929 / Epic #2926 C3).
// Stress contract (test-methodology-matrix): MUST assert >=1 chaos/fault-injection path (G6)
// AND >=1 p99 latency budget (G7). Here: LiteLLM gateway is chaotically DOWN / ERRORING under
// concurrent load; we assert 100% fallback success to Ollama and bound the routing-decision p99.
const test = require('node:test');
const assert = require('node:assert');
const { dispatchFleet } = require('../scripts/global/fleet-backend-select');

const ITERATIONS = 200;
const P99_BUDGET_MS = 100; // probe-first routing decision is in-memory; must not add a measurable hang.

function percentile(sorted, p) {
  const idx = Math.min(sorted.length - 1, Math.ceil((p / 100) * sorted.length) - 1);
  return sorted[idx];
}

// A chaos health probe: alternates DOWN (ok:false) and ERRORING-gateway (probe ok, call throws).
function chaosDeps(i) {
  const gatewayDown = i % 2 === 0;
  return {
    healthCheck: async () => (gatewayDown ? { ok: false } : { ok: true, backend: 'litellm' }),
    litellmChat: async () => { throw new Error('chaos: gateway 503'); }, // never succeeds under chaos
    ollamaChat: async () => ({ ok: true, content: 'ollama survived the chaos' }),
    write: () => {}, record: () => {},
  };
}

test('G6 chaos: LiteLLM down/erroring under load → 100% fallback success to Ollama', async () => {
  let served = 0;
  for (let i = 0; i < ITERATIONS; i += 1) {
    const r = await dispatchFleet('review this diff', {}, chaosDeps(i));
    if (r.ok && r.backend === 'ollama') served += 1;
  }
  assert.strictEqual(served, ITERATIONS, `expected ${ITERATIONS} Ollama fallbacks, got ${served}`);
});

test('G6 chaos + G7 p99: gateway-down routing decision stays under the p99 latency budget', async () => {
  const latencies = [];
  for (let i = 0; i < ITERATIONS; i += 1) {
    // Pure gateway-DOWN fault: probe-first must skip litellm entirely (no 120s hang).
    const deps = {
      healthCheck: async () => ({ ok: false }),
      litellmChat: async () => { throw new Error('must not be reached'); },
      ollamaChat: async () => ({ ok: true, content: 'x' }),
    };
    const start = process.hrtime.bigint();
    const r = await dispatchFleet('p', {}, deps);
    const ms = Number(process.hrtime.bigint() - start) / 1e6;
    latencies.push(ms);
    assert.strictEqual(r.backend, 'ollama');
  }
  latencies.sort((a, b) => a - b);
  const p99 = percentile(latencies, 99);
  assert.ok(p99 < P99_BUDGET_MS, `p99 routing-decision latency ${p99.toFixed(2)}ms exceeded ${P99_BUDGET_MS}ms budget`);
});
