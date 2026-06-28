'use strict';
// stress-test for fleet-health-signal (#3305) — composes with tdd-pyramid per the
// test-methodology-matrix (state-mutation surface). Asserts a chaos/fault-injection
// path (G6) and a p99 latency budget (G7).
const test = require('node:test');
const assert = require('node:assert');
const {
  classifyFleetWindow, emitFleetHealthSignal,
} = require('../scripts/global/fleet-health-signal');

const ITERATIONS = 5000;

// Deterministic pseudo-random so the chaos path is reproducible (no Math.random).
function lcg(seed) {
  let s = seed % 2147483647;
  if (s <= 0) s += 2147483646;
  return () => (s = (s * 16807) % 2147483647) / 2147483647;
}

test('chaos: faulty emitter (throw/timeout-shaped) never crashes the signal (G6)', () => {
  const rnd = lcg(1337);
  let survived = 0;
  for (let i = 0; i < ITERATIONS; i += 1) {
    const roll = rnd();
    const emit = () => {
      if (roll < 0.5) throw new Error('chaos: emitter exploded');
      return undefined;
    };
    const r = emitFleetHealthSignal(
      { probeDecision: 'UNAVAILABLE', fleetEligibleAttempts: 1 + (i % 9), failovers: i % 4 },
      { emit, incidentsPath: '/dev/null/i', dashboardPath: '/dev/null/d' },
    );
    // Always a structured result, never a throw, regardless of emitter chaos.
    assert.ok(r && typeof r.state === 'string');
    survived += 1;
  }
  assert.strictEqual(survived, ITERATIONS);
});

test('p99 latency budget: classify stays under 1ms p99 (G7)', () => {
  const samples = new Array(ITERATIONS);
  for (let i = 0; i < ITERATIONS; i += 1) {
    const start = process.hrtime.bigint();
    classifyFleetWindow({
      probeDecision: i % 3 === 0 ? 'UNAVAILABLE' : 'AVAILABLE',
      fleetEligibleAttempts: i % 11, failovers: i % 5,
    });
    const end = process.hrtime.bigint();
    samples[i] = Number(end - start) / 1e6; // ms
  }
  samples.sort((a, b) => a - b);
  const p99 = samples[Math.floor(ITERATIONS * 0.99)];
  assert.ok(p99 < 1.0, `p99 classify latency ${p99.toFixed(4)}ms exceeded 1ms budget`);
});
