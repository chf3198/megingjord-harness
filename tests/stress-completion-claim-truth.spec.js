'use strict';
// @megalint:test-discoverability:opt-out — node:test CLI stress spec; registered
// via `npm run stress:completion-claim-truth`. #1889 AC6 — adversarial-input
// parser stress per test-methodology-matrix: asserts a fault-injection/chaos
// path (G6) AND a p99 latency budget (G7). Detection is pure; no network.
const test = require('node:test');
const assert = require('node:assert');
const v = require('../scripts/global/megalint/completion-claim-truth.js');

// G7: p99 latency budget on a 100-line adversarial comment.
test('AC6/G7: detect() p99 < 5ms on a 100-line adversarial comment', () => {
  const adversarial = Array.from({ length: 100 }, (_, i) => {
    const kinds = [
      `Added scripts/global/mod-${i}.js and merged PR #${i}.`,
      `We'll update config/really/deep/nested/path/file-${i}.yaml soon.`,
      `See a/b/c/d/e/f/g/h-${i}.ts for context only.`,
      `Completed; #${i} #${i + 1} PR #${i + 2} pull/${i + 3}`,
      `${'/'.repeat(3)}x.${'y'.repeat(8)} ${'z'.repeat(40)}.js completed`,
    ];
    return kinds[i % kinds.length];
  }).join('\n');

  const iterations = 200;
  const samples = [];
  for (let i = 0; i < iterations; i++) {
    const start = process.hrtime.bigint();
    v.detect(adversarial);
    const end = process.hrtime.bigint();
    samples.push(Number(end - start) / 1e6);
  }
  samples.sort((a, b) => a - b);
  const p99 = samples[Math.min(samples.length - 1, Math.floor(samples.length * 0.99))];
  assert.ok(p99 < 5, `p99 ${p99.toFixed(3)}ms exceeds the 5ms budget`);
});

// G6: fault-injection / chaos path — pathological input must not catastrophically
// backtrack, and malformed resolver maps must not crash classify().
test('AC6/G6: pathological input does not catastrophically backtrack', () => {
  const evil = `${'a/'.repeat(5000)}b.js completed ` + `#${'9'.repeat(50)} ` + 'merged '.repeat(1000);
  const start = process.hrtime.bigint();
  const d = v.detect(evil);
  const elapsed = Number(process.hrtime.bigint() - start) / 1e6;
  assert.ok(elapsed < 50, `pathological detect took ${elapsed.toFixed(1)}ms`);
  assert.strictEqual(typeof d.hasClaim, 'boolean');
});

test('AC6/G6: classify tolerates malformed / missing resolver maps', () => {
  const d = v.detect('Shipped scripts/global/x.js via PR #7.');
  assert.doesNotThrow(() => v.classify(d, {}));
  assert.doesNotThrow(() => v.classify(d, { pathPresence: null, prMergedAt: undefined }));
  assert.doesNotThrow(() => v.classify({ paths: null, prs: null }, { pathPresence: {}, prMergedAt: {} }));
});
