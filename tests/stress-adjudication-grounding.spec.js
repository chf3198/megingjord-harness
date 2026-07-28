// stress-test suite for the web-research grounding producer (#3747). Asserts a chaos /
// fault-injection path (G6 resilience) AND a p99 latency budget (G7 throughput), per the
// test-methodology-matrix stress contract for a NEW side-effect / untrusted-parse surface.
const test = require('node:test');
const assert = require('node:assert');
const { produceGrounding } = require('../scripts/global/adjudication-grounding');

const GOOD = [{ url: 'https://a.co', content: 'x'.repeat(80) }, { url: 'https://b.co', content: 'y'.repeat(80) }];

// Deterministic fault cycle (no wall-clock/random dependence): each mode is an adversarial input.
const FAULTS = [
  () => { throw new Error('ECONNRESET'); },                              // outage
  async () => { throw new Error('AbortError'); },                        // timeout-ish
  async () => ({ ok: false, status: 500 }),                             // provider error
  async () => ({ ok: true, status: 200, json: async () => ({}) }),      // malformed (no results)
  async () => ({ ok: true, status: 200, json: async () => { throw new Error('bad json'); } }), // body parse fail
  async () => ({ ok: true, status: 200, json: async () => ({ results: [{ evil: '<script>' }] }) }), // uncited junk
  async () => ({ ok: true, status: 200, json: async () => ({ results: GOOD }) }),  // valid
];

test('G6 chaos: 700 fault-injected fetches never throw; output is null or valid-cited', async () => {
  for (let i = 0; i < 700; i++) {
    const fetchImpl = FAULTS[i % FAULTS.length];
    const g = await produceGrounding('adversarial decision input', { apiKey: 'k', fetchImpl });
    // Contract: either a fail-safe null, or a citation-bearing object — never a partial/thrown state.
    assert.ok(g === null || (typeof g.grounding === 'string' && Array.isArray(g.sources) && g.sources.every((u) => /^https?:\/\//.test(u))));
  }
});

test('G6 chaos: never returns grounding without at least one cited source URL', async () => {
  for (let i = 0; i < FAULTS.length; i++) {
    const g = await produceGrounding('q', { apiKey: 'k', fetchImpl: FAULTS[i] });
    if (g !== null) assert.ok(g.sources.length >= 1, 'non-null grounding must carry >=1 source');
  }
});

test('G7 p99 latency budget: fast-path stays under 25ms p99 over 200 runs', async () => {
  const good = async () => ({ ok: true, status: 200, json: async () => ({ results: GOOD }) });
  const lat = [];
  for (let i = 0; i < 200; i++) {
    const t0 = process.hrtime.bigint();
    await produceGrounding('grounding perf probe', { apiKey: 'k', fetchImpl: good });
    lat.push(Number(process.hrtime.bigint() - t0) / 1e6);
  }
  lat.sort((a, b) => a - b);
  const p99 = lat[Math.floor(0.99 * (lat.length - 1))];
  assert.ok(p99 < 25, `p99 ${p99.toFixed(2)}ms exceeds 25ms budget`);
});
