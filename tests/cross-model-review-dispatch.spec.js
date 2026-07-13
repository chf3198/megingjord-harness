'use strict';
// Unit tests for cross-model-review-dispatch (Epic #3251 #3258 D2): resolve ->
// dispatch -> route; programmatic-only degradation; never hard-fails (AC2).
const assert = require('node:assert/strict');
const { test } = require('node:test');
const { dispatchReview, PROGRAMMATIC_ONLY } =
  require('../scripts/global/cross-model-review-dispatch.js');

const okDispatcher = async () => ({ ok: true, provider: 'gemini',
  content: '```json\n{"findings":[{"id":"F1","blocking":true,"touches_file":true,"summary":"fix"}]}\n```' });
const freeCoverage = () => ({ review_coverage: 'cross-family-free', reviewer: { family: 'google' }, escalate_client_uat: false });

test('dispatchReview resolves grade, dispatches, and routes findings to markers', async () => {
  const out = await dispatchReview({ prompt: 'review', deps: { resolveCoverage: freeCoverage, dispatcher: okDispatcher } });
  assert.equal(out.review_coverage, 'cross-family-free');
  assert.equal(out.route.routed, 1);
  assert.equal(out.findings[0].remediator, 'collaborator');
  assert.equal(out.escalate_client_uat, false);
});

test('dispatchReview short-circuits to programmatic-only when the resolver floors', async () => {
  let dispatched = false;
  const out = await dispatchReview({ prompt: 'x', deps: {
    resolveCoverage: () => ({ review_coverage: 'programmatic-only', reviewer: {}, escalate_client_uat: true }),
    dispatcher: async () => { dispatched = true; return { ok: true, content: 'x' }; } } });
  assert.equal(out.review_coverage, 'programmatic-only');
  assert.equal(out.findings.length, 0);
  assert.equal(out.escalate_client_uat, true);
  assert.equal(dispatched, false); // never dispatched when floored
});

test('dispatchReview degrades to programmatic-only on an empty/failed dispatch', async () => {
  const out = await dispatchReview({ prompt: 'x', deps: {
    resolveCoverage: freeCoverage, dispatcher: async () => ({ ok: false, reason: 'all down' }) } });
  assert.equal(out.review_coverage, 'programmatic-only');
  assert.equal(out.route.routed, 0);
});

test('dispatchReview never throws when the dispatcher throws (fault injection)', async () => {
  const out = await dispatchReview({ prompt: 'x', deps: {
    resolveCoverage: freeCoverage, dispatcher: async () => { throw new Error('boom'); } } });
  assert.equal(out.review_coverage, 'programmatic-only');
});

test('PROGRAMMATIC_ONLY is a well-formed empty envelope', () => {
  const p = PROGRAMMATIC_ONLY();
  assert.equal(p.review_coverage, 'programmatic-only');
  assert.equal(p.route.routed, 0);
  assert.equal(p.escalate_client_uat, true);
});
