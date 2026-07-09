'use strict';
const assert = require('node:assert/strict');
const { test } = require('node:test');
const lib = require('../scripts/global/backlog-drift-replay-eval.js');

const corpus = lib.loadCorpus();

test('corpus matches the AC1 schema (ticket_id, goal_text, shipped_artifacts, ground_truth)', () => {
  assert.ok(corpus.length >= 5);
  for (const sample of corpus) {
    assert.equal(typeof sample.ticket_id, 'number');
    assert.equal(typeof sample.goal_text, 'string');
    assert.ok(Array.isArray(sample.shipped_artifacts));
    assert.equal(typeof sample.ground_truth_superseded, 'boolean');
  }
  assert.ok(corpus.some((s) => s.ticket_id === 1899 && s.ground_truth_superseded === true), '#1899 seeded as TP');
  assert.ok(corpus.some((s) => s.ground_truth_superseded === false), 'true-negatives present');
});

test('predict flags #1899 superseded (evidence covers the goal) and empty-evidence not superseded', () => {
  const s1899 = corpus.find((s) => s.ticket_id === 1899);
  assert.equal(lib.predict(s1899).superseded, true);
  assert.equal(lib.predict({ goal_text: 'add dark mode toggle', shipped_artifacts: [] }).superseded, false);
});

test('predict requires BOTH evidence AND goal-coverage — unrelated evidence does not supersede', () => {
  const unrelated = { goal_text: 'offline air-gapped tier-0 provider cascade fallback', shipped_artifacts: [{ id: 1, summary: 'changelog fragment aggregator prepends entries' }] };
  assert.equal(lib.predict(unrelated).superseded, false);
});

test('evaluate reports precision + false-supersede-rate over the corpus', () => {
  const result = lib.evaluate(corpus);
  assert.equal(result.n, corpus.length);
  assert.ok(result.precision >= 0 && result.precision <= 1);
  assert.ok(result.falseSupersedeRate >= 0 && result.falseSupersedeRate <= 1);
  assert.equal(result.tp + result.fp + result.fn + result.tn, corpus.length);
});

test('promotionDecision gates on precision ≥ 0.85 AND false-supersede ≤ 0.05 (no calendar)', () => {
  assert.equal(lib.promotionDecision({ precision: 0.9, falseSupersedeRate: 0.02 }).eligible, true);
  assert.equal(lib.promotionDecision({ precision: 0.9, falseSupersedeRate: 0.2 }).eligible, false); // costly-error ceiling
  assert.equal(lib.promotionDecision({ precision: 0.7, falseSupersedeRate: 0.0 }).eligible, false); // precision floor
});

test('humanGateRequired holds for P1/Epic cancels until the margin is met (AC3)', () => {
  const belowMargin = { precision: 0.5, falseSupersedeRate: 0.1 };
  assert.equal(lib.humanGateRequired(belowMargin, { priority: 'P1' }), true);
  assert.equal(lib.humanGateRequired(belowMargin, { isEpic: true }), true);
  const atMargin = { precision: 1, falseSupersedeRate: 0 };
  assert.equal(lib.humanGateRequired(atMargin, { priority: 'P1' }), false);
});

test('conformalDemote sends low-confidence verdicts to advisory (AC3)', () => {
  assert.equal(lib.conformalDemote(0.2, 0.4), 'advisory');
  assert.equal(lib.conformalDemote(0.9, 0.4), 'apply');
});

test('auditRecord is a versioned observability schema', () => {
  const rec = lib.auditRecord(lib.evaluate(corpus), { ts: '2026-07-09T00:00:00Z', env: 'test' });
  assert.equal(rec.version, 3); assert.equal(rec.schema, 'backlog-drift-replay-eval-v1');
  assert.equal(typeof rec.promotion_eligible, 'boolean');
});
