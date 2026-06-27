'use strict';
// Refs #3122 — stress-test for the doc-coverage diff-membership replay-eval gate.
// Per the test-methodology matrix, a stress spec asserts (G6) a fault-injection /
// chaos path AND (G7) a p99 latency budget. The diff-verify module carries a perf
// budget (GIT_DIFF_TIMEOUT), so the floor classifier requires stress alongside the
// tdd-pyramid primary.
const test = require('node:test');
const assert = require('node:assert');
const reval = require('../scripts/global/megalint/doc-coverage-diff-replay-eval');

// G6 — fault injection: malformed/adversarial corpus entries must degrade, never throw.
test('chaos: malformed corpus entries do not crash replayEval', () => {
  const garbage = [
    null,
    {},
    { declared: null, paths: null, expectedInDiff: true },
    { declared: ['docs/x.md'], paths: 'not-an-array', expectedInDiff: false },
    { declared: 'not-an-array', paths: ['docs/x.md'] },
    { declared: ['docs/x.md'], paths: ['docs/x.md'], expectedInDiff: 'maybe' },
    { declared: [42, {}, null], paths: [undefined, 'docs/x.md'] },
  ];
  let result;
  assert.doesNotThrow(() => { result = reval.replayEval(garbage); });
  assert.strictEqual(result.n, garbage.length);
  assert.ok(result.precision >= 0 && result.precision <= 1);
});

test('chaos: undefined/empty corpus is treated as no cases (precision defaults to 1)', () => {
  for (const input of [undefined, null, []]) {
    const r = reval.replayEval(input);
    assert.strictEqual(r.n, 0);
    assert.strictEqual(r.promotionEligible, true); // vacuous floor, but isBlockingPromoted gates on a real corpus
  }
});

test('chaos: isBlockingPromoted fails safe to advisory on an unreadable corpus path', () => {
  reval._resetCache();
  assert.strictEqual(reval.isBlockingPromoted({ corpusFile: '/definitely/not/here.json' }), false);
  reval._resetCache();
});

// G7 — p99 latency budget: scoring a large corpus must stay well under budget.
test('perf: replayEval p99 over a 500-case corpus stays under the latency budget', () => {
  const big = Array.from({ length: 500 }, (_v, i) => ({
    declared: [`docs/file${i}.md`],
    paths: i % 2 === 0 ? [`docs/file${i}.md`] : ['scripts/unrelated.js'],
    expectedInDiff: i % 2 === 0,
  }));
  const P99_BUDGET_MS = 250;
  const samples = [];
  for (let run = 0; run < 30; run += 1) {
    const t0 = process.hrtime.bigint();
    reval.replayEval(big);
    samples.push(Number(process.hrtime.bigint() - t0) / 1e6);
  }
  samples.sort((a, b) => a - b);
  const p99 = samples[Math.min(samples.length - 1, Math.ceil(0.99 * samples.length) - 1)];
  assert.ok(p99 < P99_BUDGET_MS, `p99 ${p99.toFixed(1)}ms should be < ${P99_BUDGET_MS}ms`);
});
