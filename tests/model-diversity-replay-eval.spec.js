'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { aggregate, replayPR, FP_THRESHOLD, MIN_SAMPLE } =
  require('../scripts/global/model-diversity-replay-eval.js');

test('aggregate: insufficient sample → STAY_ADVISORY', () => {
  const results = Array.from({ length: 10 }, (_, i) => ({ pr: i, ok: true }));
  const a = aggregate(results);
  assert.equal(a.evaluated, 10);
  assert.equal(a.decision, 'STAY_ADVISORY');
  assert.match(a.decision_reason, /insufficient-sample/);
});

test('aggregate: high FP rate → STAY_ADVISORY', () => {
  const results = Array.from({ length: 50 }, (_, i) =>
    i < 40 ? { pr: i, ok: false, violations: [{ rule: 'x' }] } : { pr: i, ok: true });
  const a = aggregate(results);
  assert.equal(a.violations, 40);
  assert.equal(a.fp_rate, 40 / 50);
  assert.equal(a.decision, 'STAY_ADVISORY');
  assert.match(a.decision_reason, /fp-rate-too-high/);
});

test('aggregate: low FP rate above min sample → PROMOTE_TO_REQUIRED', () => {
  const results = Array.from({ length: 50 }, (_, i) =>
    i < 3 ? { pr: i, ok: false, violations: [{ rule: 'x' }] } : { pr: i, ok: true });
  const a = aggregate(results);
  assert.equal(a.fp_rate, 3 / 50);
  assert.ok(a.fp_rate <= FP_THRESHOLD);
  assert.equal(a.decision, 'PROMOTE_TO_REQUIRED');
});

test('aggregate: skipped reasons aggregated', () => {
  const results = [
    { pr: 1, skipped: 'no-refs' },
    { pr: 2, skipped: 'no-comments' },
    { pr: 3, skipped: 'no-refs' },
    { pr: 4, ok: true },
  ];
  const a = aggregate(results);
  assert.equal(a.evaluated, 1);
  assert.equal(a.skipped_by_reason['no-refs'], 2);
  assert.equal(a.skipped_by_reason['no-comments'], 1);
});

test('replayPR: no Refs → skipped', () => {
  const r = replayPR({ number: 1, body: 'no refs here' });
  assert.equal(r.skipped, 'no-refs');
});

test('constants are sane', () => {
  assert.ok(FP_THRESHOLD > 0 && FP_THRESHOLD < 1);
  assert.ok(MIN_SAMPLE >= 20);
});
