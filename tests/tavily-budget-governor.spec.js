'use strict';

const assert = require('node:assert/strict');
const { test } = require('node:test');
const {
  evaluateTavilyBudget,
  defaults,
  DEFAULT_SOFT_CAP_USD,
  DEFAULT_HARD_CAP_USD,
} = require('../scripts/global/tavily-budget-governor.js');

test('defaults fallback when policy missing', () => {
  const d = defaults({});
  assert.equal(d.softCapUsd, DEFAULT_SOFT_CAP_USD);
  assert.equal(d.hardCapUsd, DEFAULT_HARD_CAP_USD);
});

test('under cap uses tavily-paid without alerts', () => {
  const out = evaluateTavilyBudget({ spentUsd: 1.2, policy: { tavilyBudget: { softCapUsd: 3, hardCapUsd: 5 } } });
  assert.equal(out.routeLabel, 'tavily-paid');
  assert.equal(out.softAlert, false);
  assert.equal(out.hardBlocked, false);
  assert.equal(out.budgetDecision.decision, 'ok');
});

test('soft cap emits alert but does not hard-block', () => {
  const out = evaluateTavilyBudget({ spentUsd: 3.1, policy: { tavilyBudget: { softCapUsd: 3, hardCapUsd: 5 } } });
  assert.equal(out.routeLabel, 'tavily-paid');
  assert.equal(out.softAlert, true);
  assert.equal(out.hardBlocked, false);
  assert.equal(out.budgetDecision.decision, 'soft-cap-alert');
});

test('hard cap forces deterministic free fallback', () => {
  const out = evaluateTavilyBudget({ spentUsd: 5.1, policy: { tavilyBudget: { softCapUsd: 3, hardCapUsd: 5 } } });
  assert.equal(out.routeLabel, 'tavily-free');
  assert.equal(out.hardBlocked, true);
  assert.equal(out.fallbackLane, 'free');
  assert.equal(out.budgetDecision.decision, 'hard-cap-fallback');
});
