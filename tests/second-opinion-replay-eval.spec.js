'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { aggregate, replayPR, PRESENT_RATE_THRESHOLD, MIN_SAMPLE } =
  require('../scripts/global/second-opinion-replay-eval.js');

test('aggregate: insufficient sample → STAY_ADVISORY', () => {
  const results = Array.from({ length: 10 }, (_, i) =>
    ({ pr: i, has_second_opinion: true, max_abs_delta: 0, would_escalate: false }));
  const a = aggregate(results);
  assert.equal(a.evaluated, 10);
  assert.match(a.decision, /STAY_ADVISORY/);
  assert.match(a.decision_reason, /insufficient-sample/);
});

test('aggregate: low adoption rate → STAY_ADVISORY_AUTO_FILE_TIER3', () => {
  const results = Array.from({ length: 30 }, (_, i) =>
    ({ pr: i, has_second_opinion: false, max_abs_delta: 0, would_escalate: false }));
  const a = aggregate(results);
  assert.equal(a.with_second_opinion, 0);
  assert.equal(a.decision, 'STAY_ADVISORY_AUTO_FILE_TIER3');
  assert.match(a.decision_reason, /adoption-too-low/);
});

test('aggregate: high adoption rate above min sample → PROMOTE_TO_REQUIRED', () => {
  const results = Array.from({ length: 30 }, (_, i) =>
    ({ pr: i, has_second_opinion: i < 20, max_abs_delta: 0, would_escalate: false }));
  const a = aggregate(results);
  assert.equal(a.with_second_opinion, 20);
  assert.ok(a.present_rate >= PRESENT_RATE_THRESHOLD);
  assert.equal(a.decision, 'PROMOTE_TO_REQUIRED');
});

test('aggregate: would_escalate counted', () => {
  const results = Array.from({ length: 20 }, (_, i) =>
    ({ pr: i, has_second_opinion: true, max_abs_delta: i, would_escalate: i > 1 }));
  const a = aggregate(results);
  assert.equal(a.would_escalate_tier3, 18);
});

test('aggregate: skipped reasons aggregated', () => {
  const results = [
    { pr: 1, skipped: 'no-closeout' },
    { pr: 2, skipped: 'waiver-label' },
    { pr: 3, has_second_opinion: false, max_abs_delta: 0, would_escalate: false },
  ];
  const a = aggregate(results);
  assert.equal(a.evaluated, 1);
  assert.equal(a.skipped_by_reason['no-closeout'], 1);
  assert.equal(a.skipped_by_reason['waiver-label'], 1);
});

test('replayPR: no Refs → skipped', () => {
  const r = replayPR({ number: 1, body: 'no refs' });
  assert.equal(r.skipped, 'no-refs');
});

test('constants are sane', () => {
  assert.ok(PRESENT_RATE_THRESHOLD > 0 && PRESENT_RATE_THRESHOLD < 1);
  assert.ok(MIN_SAMPLE >= 10);
});
