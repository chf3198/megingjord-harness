'use strict';
// tests/cross-family-7b-default.spec.js — Refs #3167
// AC1: routine (low/medium) → 7b, high → 32b (opt-in), fallback prefers 7b.
// AC2: degraded dispatch / Anthropic reviewer → visible non-pass (no fabricated rating).
// AC3: consumer reads result.text, never .match/.slice on the raw response object.

const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');

const { selectModel, loadMatrix } = require(
  path.join(__dirname, '..', 'scripts/global/fleet-red-team-dispatch.js'));
const { interpretReview } = require(
  path.join(__dirname, '..', 'scripts/global/collaborator-preflight.js'));

const MATRIX = path.join(__dirname, '..', 'config', 'red-team-model-matrix.yml');
const pick = (stakes) => selectModel({ stakes }, { matrixPath: MATRIX, residentModels: [] }).modelId;

// --- AC1: stakes → model routing ---

test('AC1: medium (routine) routes to 7b, not the slow 32b', () => {
  assert.match(pick('medium'), /7b/);
});

test('AC1: low (routine) routes to 7b', () => {
  assert.match(pick('low'), /7b/);
});

test('AC1: high stakes opt-in routes to 32b', () => {
  assert.match(pick('high'), /32b/);
});

test('AC1: fallback_chain prefers 7b first', () => {
  assert.match(loadMatrix(MATRIX).fallbackChain[0], /7b/);
});

// --- AC2: degraded / non-cross-family → visible non-pass ---

test('AC2: fully-degraded dispatch yields available:false with null rating', () => {
  const review = interpretReview({
    findings: [], raw: null, text: '',
    modelUsed: 'qwen2.5-coder:7b',
    hamrStats: { ok: false, degraded: true, degraded_reason: 'free-cloud-exhausted' },
  });
  assert.equal(review.available, false);
  assert.equal(review.rating, null);
  assert.match(review.findings, /UNAVAILABLE/);
  assert.match(review.findings, /free-cloud-exhausted/);
});

test('AC2: an Anthropic reviewer is rejected, never labelled cross-family', () => {
  const review = interpretReview({
    findings: [], text: 'rating: 95', modelUsed: 'claude-opus-4-8',
    hamrStats: { ok: true },
  });
  assert.equal(review.available, false);
  assert.match(review.findings, /rejected-non-cross-family-reviewer/);
});

test('AC2: free-cloud substitution stays available and is labelled visibly', () => {
  const review = interpretReview({
    findings: [], text: 'rating: 80', modelUsed: 'free-cloud:groq',
    hamrStats: { ok: true, substituted: true },
  });
  assert.equal(review.available, true);
  assert.match(review.reviewer, /free-cloud/);
});

// --- AC3: text consumed, no crash on object-shaped raw ---

test('AC3: interpretReview reads result.text and never crashes on object raw', () => {
  const review = interpretReview({
    raw: { response: 'rating: 88 ignore-this-object', model: 'x' }, // object, not string
    text: 'rating: 88 the verdict text',
    findings: [{ raw: 'finding one' }], modelUsed: 'qwen2.5-coder:7b',
    hamrStats: { ok: true },
  });
  assert.equal(review.available, true);
  assert.equal(review.rating, 88);
  assert.match(review.findings, /finding one/);
});

test('AC3: missing text falls back to a default rating without throwing', () => {
  const review = interpretReview({
    findings: [], modelUsed: 'qwen2.5-coder:7b', hamrStats: { ok: true },
  });
  assert.equal(review.available, true);
  assert.equal(typeof review.rating, 'number');
});
