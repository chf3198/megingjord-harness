'use strict';

const assert = require('node:assert/strict');
const { test } = require('node:test');
const { classifyTier, evaluate, exitCodeFor, TIERS, ADAPTIVE_THRESHOLD }
  = require('../scripts/global/git-freshness-check.js');

test('classifyTier: ok when all metrics within ok thresholds', () => {
  assert.equal(classifyTier(2, 0.5, 0.5), 'ok');
});

test('classifyTier: advisory when behind 4-10', () => {
  assert.equal(classifyTier(5, 1.5, 1.5), 'advisory');
});

test('classifyTier: pre-handoff-block when behind 11-30', () => {
  assert.equal(classifyTier(20, 5.0, 5.0), 'pre-handoff-block');
});

test('classifyTier: re-scope when behind > 30', () => {
  assert.equal(classifyTier(100, 50, 50), 're-scope');
});

test('classifyTier: re-scope when any single metric exceeds pre-handoff-block', () => {
  assert.equal(classifyTier(5, 50, 1), 're-scope');
  assert.equal(classifyTier(5, 1, 50), 're-scope');
});

test('exitCodeFor: ok=0, advisory=0, pre-handoff-block=1, re-scope=2', () => {
  assert.equal(exitCodeFor('ok'), 0);
  assert.equal(exitCodeFor('advisory'), 0);
  assert.equal(exitCodeFor('pre-handoff-block'), 1);
  assert.equal(exitCodeFor('re-scope'), 2);
});

test('TIERS in correct order (ascending strictness)', () => {
  assert.equal(TIERS[0].name, 'ok');
  assert.equal(TIERS[1].name, 'advisory');
  assert.equal(TIERS[2].name, 'pre-handoff-block');
  assert.equal(TIERS[3].name, 're-scope');
});

test('ADAPTIVE_THRESHOLD default = 10 commits/hour', () => {
  assert.equal(ADAPTIVE_THRESHOLD, 10);
});

test('evaluate: opt-out env var skips evaluation with tier=ok', () => {
  const prior = process.env.MEGINGJORD_REBASE_DISCIPLINE_DISABLED;
  process.env.MEGINGJORD_REBASE_DISCIPLINE_DISABLED = '1';
  try {
    const r = evaluate({ branch: 'feat/test', behind: 1000, velocity: 1000, branchCommits: 1 });
    assert.equal(r.tier, 'ok');
    assert.equal(r.skipped, 'opt-out-env-var');
  } finally {
    if (prior == null) delete process.env.MEGINGJORD_REBASE_DISCIPLINE_DISABLED;
    else process.env.MEGINGJORD_REBASE_DISCIPLINE_DISABLED = prior;
  }
});

test('evaluate: on main branch returns ok with skip reason', () => {
  const r = evaluate({ branch: 'main' });
  assert.equal(r.tier, 'ok');
  assert.equal(r.skipped, 'on-main-or-detached');
});

test('evaluate: HEAD detached returns ok with skip reason', () => {
  const r = evaluate({ branch: 'HEAD' });
  assert.equal(r.tier, 'ok');
});

test('evaluate: injected metrics compute tier correctly (advisory)', () => {
  const r = evaluate({ branch: 'feat/test', behind: 6, branchCommits: 10, velocity: 4 });
  assert.equal(r.tier, 'advisory');
  assert.equal(r.behind, 6);
  assert.equal(r.trunk_velocity, 4);
  assert.equal(r.effective_drift_hours, 1.5);
});

test('evaluate: adaptive_cadence true when velocity > 10/hr', () => {
  const r = evaluate({ branch: 'feat/test', behind: 1, branchCommits: 1, velocity: 15 });
  assert.equal(r.adaptive_cadence, true);
});

test('evaluate: adaptive_cadence false when velocity <= 10/hr', () => {
  const r = evaluate({ branch: 'feat/test', behind: 1, branchCommits: 1, velocity: 5 });
  assert.equal(r.adaptive_cadence, false);
});

test('evaluate: high-velocity does NOT reclassify ok→advisory (cadence only)', () => {
  const r = evaluate({ branch: 'feat/test', behind: 2, branchCommits: 5, velocity: 100 });
  assert.equal(r.tier, 'ok');
  assert.equal(r.adaptive_cadence, true);
});

test('evaluate: behind-by-100 + velocity-100 yields effective_drift=1hr but ratio penalty triggers re-scope', () => {
  const r = evaluate({ branch: 'feat/test', behind: 100, branchCommits: 1, velocity: 100 });
  assert.equal(r.tier, 're-scope');
});

test('evaluate: behind=15 + low velocity stays in pre-handoff-block', () => {
  const r = evaluate({ branch: 'feat/test', behind: 15, branchCommits: 10, velocity: 3 });
  assert.equal(r.tier, 'pre-handoff-block');
});
