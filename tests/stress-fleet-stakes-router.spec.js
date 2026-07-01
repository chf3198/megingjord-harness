'use strict';
// Stress tests for the Fleet Advisor stakes router (Epic #3414 #3484).
// tdd-pyramid+stress-test: >=1 chaos/fault-injection path (G6) + >=1 p99 latency budget (G7).

const assert = require('node:assert/strict');
const { test } = require('node:test');
const router = require('../scripts/global/fleet-stakes-router.js');

function makeRng(seed) {
  let state = seed >>> 0;
  return () => { state = (state * 1664525 + 1013904223) >>> 0; return state / 0xffffffff; };
}

// Exotic fuzz strings written as \u escapes (bidi override, emoji) — never literal bytes.
const BIDI = '‮';
const EMOJI = '🙂';
const JUNK = ['', '   ', ` ${BIDI}`, 'security'.repeat(1000), EMOJI.repeat(500)];

test('chaos — adversarial/garbage prompts never throw and always yield a valid route', () => {
  const rng = makeRng(0xbeef);
  for (let i = 0; i < 3000; i++) {
    const prompt = rng() < 0.3 ? JUNK[Math.floor(rng() * JUNK.length)] : `task ${i} ${BIDI}`;
    const opts = { role: ['manager', 'x', undefined][Math.floor(rng() * 3)], stakes: rng() < 0.2 ? 'weird' : undefined };
    let r;
    assert.doesNotThrow(() => { r = router.resolveFleetRoute(prompt, opts); }, `case ${i}`);
    assert.ok(['high', 'routine'].includes(r.stakes));
    assert.ok(r.model && typeof r.model === 'string');
    assert.ok(['30m', '5m'].includes(r.keepAlive));
  }
});

test('chaos — non-string prompts and null opts degrade safely', () => {
  for (const p of [undefined, null, 42, {}, []]) {
    assert.doesNotThrow(() => router.resolveFleetRoute(p));
    assert.equal(router.classifyStakes(p), 'routine');
  }
});

test('perf — p99 classification budget: 5000 routes complete well under budget', () => {
  const rng = makeRng(7);
  const prompts = Array.from({ length: 5000 }, (_, i) => (rng() < 0.5 ? 'routine coding task ' : 'security architecture ') + i);
  const timings = [];
  for (const p of prompts) {
    const start = process.hrtime.bigint();
    router.resolveFleetRoute(p);
    timings.push(Number(process.hrtime.bigint() - start) / 1e6);
  }
  timings.sort((a, b) => a - b);
  const p99 = timings[Math.floor(timings.length * 0.99)];
  assert.ok(p99 < 5, `p99 ${p99.toFixed(3)}ms exceeds 5ms budget`);
});
