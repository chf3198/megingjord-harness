'use strict';
// Stress tests for the Fleet Advisor Layer-① lint engine (Epic #3414 #3480).
// tdd-pyramid+stress-test: asserts ≥1 chaos/fault-injection path (G6) and ≥1 p99 latency budget (G7).

const assert = require('node:assert/strict');
const { test } = require('node:test');
const engine = require('../scripts/global/fleet-advisor-lint.js');

// Deterministic pseudo-random generator (no Math.random — reproducible fuzz).
function makeRng(seed) {
  let state = seed >>> 0;
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 0xffffffff;
  };
}

/** Build an adversarial probe from a seed: garbage types, huge rosters, mixed reachability. */
function chaosProbe(rng) {
  const hostCount = Math.floor(rng() * 12);
  const hosts = [];
  for (let i = 0; i < hostCount; i++) {
    const modelCount = Math.floor(rng() * 40);
    const models = [];
    for (let j = 0; j < modelCount; j++) {
      models.push({
        name: rng() < 0.5 ? `m${j}:7b` : `m${j}:32b`,
        quant: rng() < 0.5 ? 'Q4_K_M' : null,
        sizeBytes: rng() < 0.3 ? 'not-a-number' : Math.floor(rng() * 30e9),
        sizeVramBytes: rng() < 0.3 ? undefined : Math.floor(rng() * 12e9),
      });
    }
    hosts.push({
      id: rng() < 0.1 ? undefined : `host-${i}`,
      reachable: rng() < 0.6,
      engine: rng() < 0.2 ? null : { name: rng() < 0.5 ? 'ollama' : 'vllm', version: '0.0', minorReleasesBehind: Math.floor(rng() * 9) },
      gpu: rng() < 0.3 ? undefined : { vramTotalMb: rng() < 0.2 ? 'x' : Math.floor(rng() * 64000) },
      models,
      ps: rng() < 0.5 ? models.slice(0, 2) : 'garbage',
      recentFaults: rng() < 0.3 ? ['oom'] : [],
    });
  }
  return { hosts, dispatch: rng() < 0.5 ? null : { keepAliveSet: rng() < 0.5 }, cloud: {}, policy: { hosts: ['ghost'] } };
}

test('chaos — 2000 adversarial probes never throw and always return a valid tier', () => {
  const rng = makeRng(0x9e3779b9);
  const valid = new Set(engine.TIER_ORDER);
  for (let i = 0; i < 2000; i++) {
    const probe = chaosProbe(rng);
    let report;
    assert.doesNotThrow(() => { report = engine.runLint(probe, { now: 1_700_000_000_000 }); }, `probe ${i}`);
    assert.ok(valid.has(report.tier), `probe ${i} tier ${report.tier}`);
    assert.ok(Array.isArray(report.findings));
    assert.ok(report.fingerprint && typeof report.fingerprint.hash === 'string');
  }
});

test('chaos — malformed rule-table path degrades to a probe-error finding, no crash', () => {
  const report = engine.runLint({ hosts: [] }, { now: 1, rulesPath: '/nonexistent/rules.yml' });
  assert.equal(report.tier, 'F0');
  assert.ok(report.findings.some((f) => f.id === 'probe-error'));
});

test('perf — p99 latency budget: a lint run completes well under the 2s design bound', () => {
  const rng = makeRng(42);
  const probes = Array.from({ length: 500 }, () => chaosProbe(rng));
  const timings = [];
  for (const probe of probes) {
    const start = process.hrtime.bigint();
    engine.runLint(probe, { now: 1_700_000_000_000 });
    timings.push(Number(process.hrtime.bigint() - start) / 1e6);
  }
  timings.sort((a, b) => a - b);
  const p99 = timings[Math.floor(timings.length * 0.99)];
  // Design bound is <2000ms including network probes; the pure eval must be far under a 200ms budget.
  assert.ok(p99 < 200, `p99 ${p99.toFixed(2)}ms exceeds 200ms budget`);
});
