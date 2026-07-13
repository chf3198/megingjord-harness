'use strict';
// Unit tests for review-coverage-resolver (Epic #3251 #3260 D5): graded coverage
// disclosure + honest programmatic-only floor + 300s-TTL reachability cache.
const assert = require('node:assert/strict');
const { test } = require('node:test');
const {
  gradeCoverage, probeReachable, resolveCoverage, clearCache, DEFAULT_TTL_MS,
} = require('../scripts/global/review-coverage-resolver.js');

test('gradeCoverage maps reachability + family + tier to the right rung', () => {
  assert.equal(gradeCoverage({ authorFamily: 'anthropic', reviewerFamily: 'google', tier: 'free-cloud', reachable: true }), 'cross-family-free');
  assert.equal(gradeCoverage({ authorFamily: 'anthropic', reviewerFamily: 'google', tier: 'premium', reachable: true }), 'cross-family-paid');
  assert.equal(gradeCoverage({ authorFamily: 'anthropic', reviewerFamily: 'anthropic', tier: 'premium', reachable: true }), 'same-family-paid');
  assert.equal(gradeCoverage({ authorFamily: 'anthropic', reviewerFamily: 'anthropic', tier: 'premium', reachable: true, grounded: true }), 'same-model-grounded-paid');
  assert.equal(gradeCoverage({ reachable: false }), 'programmatic-only');
});

test('probeReachable caches within the 300s TTL and re-probes after expiry', () => {
  clearCache();
  let calls = 0;
  const prober = () => { calls += 1; return true; };
  let clock = 1000;
  const now = () => clock;
  assert.equal(probeReachable('gemini', { now, prober }), true);
  assert.equal(probeReachable('gemini', { now, prober }), true); // cache hit
  assert.equal(calls, 1);
  clock += DEFAULT_TTL_MS + 1; // expire
  probeReachable('gemini', { now, prober });
  assert.equal(calls, 2);
});

test('resolveCoverage returns cross-family-free for a reachable routine surface', () => {
  clearCache();
  const out = resolveCoverage({ paths: ['docs/x.md'], authorFamily: 'anthropic', prober: () => true });
  assert.equal(out.review_coverage, 'cross-family-free');
  assert.equal(out.escalate_client_uat, false);
});

test('resolveCoverage honest floor: unbudgeted paid high-stakes -> programmatic-only + UAT', () => {
  clearCache();
  const out = resolveCoverage({ paths: ['scripts/global/auth.js'], authorFamily: 'anthropic',
    budgetAllowsPaid: false, prober: () => true });
  assert.equal(out.review_coverage, 'programmatic-only');
  assert.equal(out.escalate_client_uat, true);
  assert.equal(out.reason, 'paid-floor-unbudgeted');
});

test('resolveCoverage degrades to programmatic-only when the reviewer is unreachable', () => {
  clearCache();
  const out = resolveCoverage({ paths: ['src/x.js'], authorFamily: 'anthropic', prober: () => false });
  assert.equal(out.review_coverage, 'programmatic-only');
  assert.equal(out.escalate_client_uat, true);
});
