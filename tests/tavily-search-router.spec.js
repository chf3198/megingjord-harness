'use strict';

const assert = require('node:assert/strict');
const { test } = require('node:test');
const { routeSearch } = require('../scripts/global/tavily-search-router.js');

test('free-first route is default for eligible request', () => {
  const out = routeSearch({ query: 'repo map', freeEligible: true, correlationId: 'c1' });
  assert.equal(out.provider, 'local-rag');
  assert.equal(out.routeLabel, 'tavily-free');
  assert.equal(out.reason, 'free-first');
  assert.equal(out.observability.correlationId, 'c1');
});

test('policy-allowed Tavily route with budget headroom', () => {
  const out = routeSearch({
    query: 'external docs', freeEligible: false, policyAllowsTavily: true,
    tavilyAvailable: true, spentUsd: 1, policy: { tavilyBudget: { softCapUsd: 3, hardCapUsd: 5 } },
  });
  assert.equal(out.provider, 'tavily');
  assert.equal(out.routeLabel, 'tavily-paid');
  assert.equal(out.reason, 'policy-allowed');
});

test('hard-cap exhaustion falls back to free-cloud deterministically', () => {
  const out = routeSearch({
    query: 'external docs', freeEligible: false, policyAllowsTavily: true,
    tavilyAvailable: true, spentUsd: 7, policy: { tavilyBudget: { softCapUsd: 3, hardCapUsd: 5 } },
  });
  assert.equal(out.provider, 'free-cloud');
  assert.equal(out.routeLabel, 'tavily-free');
  assert.equal(out.reason, 'hard-cap-fallback');
  assert.equal(out.budgetDecision.decision, 'hard-cap-fallback');
});

test('policy block bypasses Tavily and keeps observability fields', () => {
  const out = routeSearch({ query: 'external docs', freeEligible: false, policyAllowsTavily: false });
  assert.equal(out.provider, 'free-cloud');
  assert.equal(out.reason, 'policy-blocked');
  assert.deepEqual(out.observability.decisionOrder, ['free', 'tavily', 'fallback']);
});
