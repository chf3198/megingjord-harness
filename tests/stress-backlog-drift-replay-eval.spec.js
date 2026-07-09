'use strict';
// Stress coverage for the backlog-drift replay-eval promotion gate (#3423, Epic
// #3398 C5). The gate governs whether the guardrail may auto-cancel, so it must be
// robust to adversarial corpus rows and never over-promote.
//   (G6) chaos — malformed/hostile corpus rows never throw and never inflate precision.
//   (G7) p99 latency budget on the eval hot path.
const assert = require('node:assert/strict');
const { test } = require('node:test');
const lib = require('../scripts/global/backlog-drift-replay-eval.js');

test('chaos: malformed corpus rows never throw and never falsely predict superseded (G6)', () => {
  const hostile = [
    { goal_text: null, shipped_artifacts: null, ground_truth_superseded: true },
    { goal_text: '', shipped_artifacts: [{ summary: null }], ground_truth_superseded: false },
    { goal_text: 'x'.repeat(50000), shipped_artifacts: [{ summary: 'y'.repeat(50000) }], ground_truth_superseded: false },
    {}, null, { goal_text: 'aaa', shipped_artifacts: 'not-an-array' },
  ];
  for (const row of hostile) {
    const pred = lib.predict(row || {});
    assert.equal(typeof pred.superseded, 'boolean');
    // Empty/absent goal or non-array evidence must never be flagged superseded.
    if (!row || !row.goal_text || !Array.isArray(row.shipped_artifacts) || !row.shipped_artifacts.length) {
      assert.equal(pred.superseded, false);
    }
  }
  assert.doesNotThrow(() => lib.evaluate(hostile.filter(Boolean)));
});

test('an all-false-positive corpus produces false-supersede > ceiling → NOT promotion-eligible', () => {
  // Evidence that lexically covers the goal but is labeled not-superseded (adversarial mislabels).
  const adversarial = Array.from({ length: 10 }, (_, i) => ({
    ticket_id: i, goal_text: 'alpha beta gamma delta', shipped_artifacts: [{ summary: 'alpha beta gamma delta' }],
    ground_truth_superseded: false,
  }));
  const result = lib.evaluate(adversarial);
  assert.ok(result.fp > 0);
  assert.equal(lib.promotionDecision(result).eligible, false, 'high false-supersede must block promotion');
});

test('shipped corpus is honestly scored (precision + false-supersede computed, not asserted-true)', () => {
  const result = lib.evaluate(lib.loadCorpus());
  // We assert the gate computes a decision; the decision itself is data-driven, not hard-coded.
  const decision = lib.promotionDecision(result);
  assert.equal(typeof decision.eligible, 'boolean');
  assert.ok(result.falseSupersedeRate <= 1 && result.precision <= 1);
});

test('p99 latency budget: evaluate() over a 2k-row corpus < 50ms p99 (G7)', () => {
  const big = Array.from({ length: 2000 }, (_, i) => ({
    ticket_id: i, goal_text: 'inbound reference integrity dangling pointer detection',
    shipped_artifacts: i % 2 ? [{ summary: 'inbound reference integrity dangling pointer' }] : [],
    ground_truth_superseded: i % 2 === 0,
  }));
  const samples = [];
  for (let run = 0; run < 20; run += 1) {
    const t0 = process.hrtime.bigint();
    lib.evaluate(big);
    samples.push(Number(process.hrtime.bigint() - t0) / 1e6);
  }
  samples.sort((a, b) => a - b);
  const p99 = samples[Math.floor(samples.length * 0.99)];
  assert.ok(p99 < 50, `p99=${p99.toFixed(2)}ms exceeds 50ms budget`);
});
