// tests/stress-test-floor-replay-eval.spec.js — #3105 stress arm of tdd-pyramid+stress-test.
// The replay-eval harness consumes an untrusted corpus (adversarial-input parser); assert a
// fault-injection path (G6) AND a p99 latency budget (G7) per the matrix stress contract.
'use strict';

const { test, expect } = require('@playwright/test');
const evalMod = require('../scripts/global/test-floor-replay-eval');

// ── fault injection (G6): malformed / hostile corpus rows never crash ──

test('stress: malformed corpus rows degrade gracefully, never throw', () => {
  const hostile = [
    { paths: null, declared: null, expectedMeetsFloor: undefined },
    { paths: ['/tmp/$(rm -rf ~)/x.js'], declared: '`whoami`', expectedMeetsFloor: false },
    { paths: [`scripts/global/${'a'.repeat(3000)}.js`], declared: 'tdd-pyramid', expectedMeetsFloor: false },
    {},
    { paths: ['scripts/global/x.js'], declared: 'none', expectedMeetsFloor: 'not-a-bool' },
  ];
  expect(() => evalMod.replayEval(hostile)).not.toThrow();
  expect(() => evalMod.detectDrift(hostile)).not.toThrow();
  const result = evalMod.replayEval(hostile);
  expect(result.n).toBe(hostile.length);
  expect(Number.isFinite(result.precision)).toBe(true);
});

// ── perf budget (G7) ──

test('stress: replayEval over a 3000-case corpus stays under a p99 budget', () => {
  const big = Array.from({ length: 3000 }, (_, index) => ({
    paths: [`scripts/global/mod-${index}${index % 3 === 0 ? '-gate' : ''}.js`],
    declared: index % 2 === 0 ? 'tdd-pyramid' : 'tdd-pyramid+stress-test',
    expectedMeetsFloor: index % 3 !== 0,
  }));
  const samples = [];
  for (let iteration = 0; iteration < 30; iteration += 1) {
    const start = process.hrtime.bigint();
    evalMod.replayEval(big);
    samples.push(Number(process.hrtime.bigint() - start) / 1e6);
  }
  samples.sort((first, second) => first - second);
  const p99 = samples[Math.floor(samples.length * 0.99)];
  expect(p99, `p99 ${p99.toFixed(2)}ms exceeded 150ms for 3000 cases`).toBeLessThan(150);
});
