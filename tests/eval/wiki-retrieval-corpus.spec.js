'use strict';
// #3760 (Epic #3719 P1-b): the committed labeled retrieval corpus is well-formed and the shipped
// eval-harness runs against it, recording the true baseline (no parallel eval). test_strategy: eval-harness.
const assert = require('node:assert/strict');
const { test } = require('node:test');
const corpus = require('../../scripts/wiki/eval-ground-truth.json');

test('corpus is A/B/C-labeled and well-formed', () => {
  assert.ok(Array.isArray(corpus.queries) && corpus.queries.length >= 10, 'corpus must have >=10 queries');
  const wikis = new Set();
  for (const q of corpus.queries) {
    assert.ok(typeof q.q === 'string' && q.q.length > 0, 'each query has q');
    assert.ok(Array.isArray(q.expected) && q.expected.length > 0, 'each query has non-empty expected');
    assert.ok(['A', 'B', 'C'].includes(q.wiki), `wiki label A/B/C (got ${q.wiki})`);
    wikis.add(q.wiki);
  }
  // corpus must cover all three wikis (A=code, B=work-log, C=wisdom)
  assert.deepEqual([...wikis].sort(), ['A', 'B', 'C'], 'corpus covers A/B/C');
});

test('eval-harness reuses this corpus and produces a measured baseline (not the mythical 0.12)', async () => {
  const { runEval } = require('../../scripts/wiki/eval-harness.js');
  const r = await runEval();
  assert.equal(r.ok, true);
  assert.equal(r.queries, corpus.queries.length, 'harness ran the committed corpus (no parallel eval)');
  assert.ok(typeof r.mean_precision === 'number' && r.mean_precision >= 0 && r.mean_precision <= 1);
  assert.ok(typeof r.mean_recall === 'number');
  // Regression sentinel: the true baseline is materially above the invented 0.12 figure.
  assert.ok(r.mean_precision > 0.12, `true baseline (${r.mean_precision}) must exceed the mythical 0.12`);
});
