'use strict';
// Refs #3122 — unit (tdd-pyramid) for the doc-coverage diff-membership replay-eval
// promotion gate: scoring, the precision floor, auto-revoke, and the env kill-switch.
const test = require('node:test');
const assert = require('node:assert');
const path = require('node:path');
const reval = require('../scripts/global/megalint/doc-coverage-diff-replay-eval');

const CORPUS = path.join(__dirname, 'fixtures', 'doc-coverage-diff-corpus.json');

test('replayEval over the committed corpus is promotion-eligible (precision >= 0.85)', () => {
  const result = reval.replayEval(reval.loadCorpus(CORPUS));
  assert.ok(result.n >= 10, 'corpus should carry a meaningful number of labeled cases');
  assert.ok(result.precision >= reval.PROMOTION_PRECISION,
    `precision ${result.precision} should meet the floor`);
  assert.strictEqual(result.promotionEligible, true);
});

test('replayEval scores a known TP and TN correctly', () => {
  const result = reval.replayEval([
    { declared: ['docs/x.md'], paths: ['scripts/foo.js'], expectedInDiff: false }, // TP (gap flagged)
    { declared: ['docs/x.md'], paths: ['docs/x.md'], expectedInDiff: true },        // TN (no gap)
  ]);
  assert.strictEqual(result.truePos, 1);
  assert.strictEqual(result.trueNeg, 1);
  assert.strictEqual(result.precision, 1);
});

test('precision below the floor → NOT promotion-eligible (auto-revoke)', () => {
  // A false positive = the check flags a gap (declared surface absent from the diff)
  // but the label says there is none (expectedInDiff: true). 1 TP + 4 FP → precision 0.2.
  const falsePos = (i) => ({ declared: [`docs/fp${i}.md`], paths: ['unrelated.js'],
    expectedInDiff: true });
  const corpus = [
    { declared: ['docs/real.md'], paths: ['unrelated.js'], expectedInDiff: false }, // TP
    falsePos(1), falsePos(2), falsePos(3), falsePos(4),
  ];
  const r = reval.replayEval(corpus);
  assert.strictEqual(r.truePos, 1);
  assert.strictEqual(r.falsePos, 4);
  assert.ok(r.precision < reval.PROMOTION_PRECISION, `precision ${r.precision} should be below floor`);
  assert.strictEqual(r.promotionEligible, false);
});

test('diffSeverity is blocking (error) on an eligible corpus, advisory below floor', () => {
  reval._resetCache();
  const eligible = reval.loadCorpus(CORPUS);
  assert.strictEqual(reval.diffSeverity({ corpus: eligible }), 'error');
  // all false positives → precision 0 → advisory
  const ineligible = [
    { declared: ['docs/x.md'], paths: ['unrelated.js'], expectedInDiff: true },
    { declared: ['docs/y.md'], paths: ['unrelated.js'], expectedInDiff: true },
  ];
  assert.strictEqual(reval.diffSeverity({ corpus: ineligible }), 'advisory');
});

test('env kill-switch forces advisory even on an eligible corpus (G6 rollback)', () => {
  const eligible = reval.loadCorpus(CORPUS);
  process.env[reval.DISABLE_ENV] = '1';
  try {
    assert.strictEqual(reval.isBlockingPromoted({ corpus: eligible }), false);
    assert.strictEqual(reval.diffSeverity({ corpus: eligible }), 'advisory');
  } finally { delete process.env[reval.DISABLE_ENV]; reval._resetCache(); }
});

test('missing/unreadable corpus fails SAFE to advisory', () => {
  reval._resetCache();
  assert.strictEqual(reval.isBlockingPromoted({ corpusFile: '/no/such/corpus.json' }), false);
  reval._resetCache();
});
