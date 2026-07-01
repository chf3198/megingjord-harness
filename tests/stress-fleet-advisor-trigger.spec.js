'use strict';
// Stress tests for the Fleet Advisor trigger (Epic #3414 #3483): chaos (G6) + p99 (G7).

const assert = require('node:assert/strict');
const { test } = require('node:test');
const trig = require('../scripts/global/fleet-advisor-trigger.js');

function makeRng(seed) {
  let s = seed >>> 0;
  return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 0xffffffff; };
}

test('chaos — 3000 adversarial trigger inputs never throw and never spend tokens on unchanged', async () => {
  const rng = makeRng(0xd1ce);
  for (let i = 0; i < 3000; i++) {
    const hash = `h${Math.floor(rng() * 3)}`;
    const cache = rng() < 0.3 ? null : { hash: `h${Math.floor(rng() * 3)}`, ts: Math.floor(rng() * 2000) };
    const report = { tier: 'F2', fingerprint: { hash }, findings: [] };
    let aiCalls = 0;
    let out;
    await assert.doesNotReject(async () => {
      out = await trig.runTrigger({
        runLint: () => report, runAiPass: async () => { aiCalls++; return {}; },
        cache, now: 1000, staleMs: 100000,
      });
    }, `case ${i}`);
    if (out.status === 'skipped-unchanged') assert.equal(aiCalls, 0);
  }
});

test('perf — p99 shouldRunAiPass budget over 5000 checks is well under budget', () => {
  const rng = makeRng(5);
  const timings = [];
  for (let i = 0; i < 5000; i++) {
    const start = process.hrtime.bigint();
    trig.shouldRunAiPass(`h${i % 4}`, { hash: `h${i % 3}`, ts: i }, { now: i + 500, staleMs: 1000 });
    timings.push(Number(process.hrtime.bigint() - start) / 1e6);
  }
  timings.sort((a, b) => a - b);
  assert.ok(timings[Math.floor(timings.length * 0.99)] < 5);
});
