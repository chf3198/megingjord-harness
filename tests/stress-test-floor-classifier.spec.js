// tests/stress-test-floor-classifier.spec.js — Epic #1948 Phase-1 re-ship (#3098).
// Stress arm of `tdd-pyramid+stress-test`: the classifier parses untrusted file-path /
// diff input (adversarial-input parser per the test-methodology matrix). Asserts a
// fault-injection path (G6) AND a p99 latency budget (G7) per the matrix stress contract.
'use strict';

const { test, expect } = require('@playwright/test');
const tfc = require('../scripts/global/test-floor-classifier');

// ── fault injection (G6): hostile paths are data, never executed/interpolated ──

test('stress: adversarial/hostile paths are classified as data, never executed', () => {
  const hostile = [
    '/tmp/$(rm -rf ~)/x.js', 'scripts/global/`whoami`.js', '../../etc/passwd',
    `scripts/global/${'a'.repeat(4000)}.js`, 'dashboard/js/ null.js',
    'scripts/global/x.js; echo pwned', 'instructions/..%2f..%2f.md',
  ];
  for (const hostilePath of hostile) {
    expect(() => tfc.surfaceForPath(hostilePath)).not.toThrow();
    expect(() => tfc.reconcile('tdd-pyramid', [hostilePath])).not.toThrow();
  }
  // a 4000-char governance-script path still resolves to the governance-script surface.
  expect(tfc.surfaceForPath(`scripts/global/${'a'.repeat(4000)}.js`).surface).toBe('governance-script');
});

test('stress: empty/null/garbage changeset inputs degrade gracefully', () => {
  expect(tfc.deriveFloor([]).stressRequired).toBe(false);
  expect(tfc.deriveFloor(null).perFile).toEqual([]);
  expect(tfc.reconcile('', []).meetsFloor).toBe(true);
  expect(() => tfc.reconcile(null, ['scripts/global/x.js'])).not.toThrow();
});

// ── perf budget (G7): bounded latency on a large changeset ──

test('stress: deriveFloor over a 2000-file changeset stays under a p99 budget', () => {
  const big = Array.from({ length: 2000 }, (_, index) => `scripts/global/mod-${index}.js`);
  const samples = [];
  for (let iteration = 0; iteration < 50; iteration += 1) {
    const start = process.hrtime.bigint();
    tfc.deriveFloor(big);
    samples.push(Number(process.hrtime.bigint() - start) / 1e6);
  }
  samples.sort((first, second) => first - second);
  const p99 = samples[Math.floor(samples.length * 0.99)];
  expect(p99, `p99 ${p99.toFixed(2)}ms exceeded 50ms for 2000 files`).toBeLessThan(50);
});
