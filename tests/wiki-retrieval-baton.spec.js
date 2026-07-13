'use strict';
// #3761 (Epic #3719): wiki-retrieval grounding wired into the Consultant pre-critique +
// measured token-cost reduction. tdd-pyramid. Deterministic fixture (tests/fixtures/wiki-3761).
const assert = require('node:assert/strict');
const path = require('node:path');
const { test } = require('node:test');
const rb = require('../scripts/wiki/retrieval-baton.js');
const { buildPrompt, critique } = require('../scripts/global/multi-model-critique.js');

const FIXTURE = path.join(__dirname, 'fixtures', 'wiki-3761', 'wiki');
const QUERY = '# consensus receipt independence\nhow is signer independence verified?';

test('estimateTokens ~ chars/4', () => {
  assert.equal(rb.estimateTokens('abcd'), 1);
  assert.equal(rb.estimateTokens('abcde'), 2);
  assert.equal(rb.estimateTokens(''), 0);
});

test('deriveQuery pulls the first heading + head', () => {
  const q = rb.deriveQuery('# My Heading\nsome body text here');
  assert.match(q, /My Heading/);
});

test('groundArtifact measures a real token-cost reduction (top-N << whole store)', () => {
  const g = rb.groundArtifact(QUERY, { wikiDir: FIXTURE, topN: 2 });
  assert.equal(g.tokenCost.candidate_count, 4);
  assert.equal(g.tokenCost.retrieved_count, 2);
  assert.ok(g.tokenCost.retrieval_tokens < g.tokenCost.baseline_tokens, 'retrieval loads fewer tokens');
  assert.ok(g.tokenCost.reduction_ratio > 0 && g.tokenCost.reduction_ratio < 1);
  assert.ok(g.groundingText.length > 0, 'plaintext grounding produced');
});

test('reduction_ratio = (baseline - retrieval)/baseline', () => {
  const g = rb.groundArtifact(QUERY, { wikiDir: FIXTURE, topN: 2 });
  const expected = (g.tokenCost.baseline_tokens - g.tokenCost.retrieval_tokens) / g.tokenCost.baseline_tokens;
  assert.ok(Math.abs(g.tokenCost.reduction_ratio - Math.max(0, expected)) < 0.01);
});

test('fewer topN retrieves fewer pages → same-or-larger reduction', () => {
  const g1 = rb.groundArtifact(QUERY, { wikiDir: FIXTURE, topN: 1 });
  const g2 = rb.groundArtifact(QUERY, { wikiDir: FIXTURE, topN: 3 });
  assert.equal(g1.tokenCost.retrieved_count, 1);
  assert.ok(g2.tokenCost.retrieved_count >= g1.tokenCost.retrieved_count);
  assert.ok(g1.tokenCost.reduction_ratio >= g2.tokenCost.reduction_ratio);
});

test('buildPrompt injects the grounding block when grounding is provided', () => {
  const g = rb.groundArtifact(QUERY, { wikiDir: FIXTURE, topN: 2 });
  const withGround = buildPrompt('ARTIFACT BODY', g);
  const without = buildPrompt('ARTIFACT BODY');
  assert.match(withGround, /RELEVANT WIKI CONTEXT/);
  assert.doesNotMatch(without, /RELEVANT WIKI CONTEXT/);
  assert.ok(withGround.length > without.length);
});

test('critique() grounds the pre-critique + returns the measured tokenCost (models stubbed)', async () => {
  const res = await critique(QUERY, {
    models: [], recordReduction: false, groundOpts: { wikiDir: FIXTURE, topN: 2 },
  });
  assert.ok(res.grounding, 'grounding attached to the critique result');
  assert.equal(res.grounding.tokenCost.retrieved_count, 2);
  assert.ok(res.grounding.tokenCost.reduction_ratio > 0);
});

test('critique({ ground: false }) opts out of grounding (backward-compatible)', async () => {
  const res = await critique(QUERY, { models: [], ground: false });
  assert.equal(res.grounding, null);
});
