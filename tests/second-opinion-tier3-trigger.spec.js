'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { triggerIfNeeded, buildTier3Body, TIER3_LABELS } =
  require('../scripts/global/second-opinion-tier3-trigger.js');

test('triggerIfNeeded: below threshold → no file', () => {
  const r = triggerIfNeeded({
    sourceTicket: 1612, max_abs_delta: 0.5,
    deltas: { G1: 0.5 }, firstScores: { G1: 9 }, secondScores: { G1: 9.5 },
    raterTeamModel: 'fleet:qwen2.5-coder@36gbwinresource',
  });
  assert.equal(r.triggered, false);
  assert.equal(r.reason, 'delta-below-threshold');
});

test('triggerIfNeeded: above threshold → file (dry-run)', () => {
  const r = triggerIfNeeded({
    sourceTicket: 1612, max_abs_delta: 1.5,
    deltas: { G1: 1.5, G2: 0.5 }, firstScores: { G1: 9, G2: 7 },
    secondScores: { G1: 10.5, G2: 7.5 },
    raterTeamModel: 'fleet:qwen2.5-coder@36gbwinresource',
    dryRun: true,
  });
  assert.equal(r.triggered, true);
  assert.equal(r.dry_run, true);
  assert.match(r.title, /Tier-3 anneal/);
  assert.match(r.title, /#1612/);
  assert.match(r.title, /delta=1.5/);
});

test('buildTier3Body: includes source ticket + deltas', () => {
  const body = buildTier3Body({
    sourceTicket: 1234, max_abs_delta: 2.0,
    deltas: { G1: 2.0, G3: 1.0 },
    firstScores: { G1: 5, G3: 8 }, secondScores: { G1: 7, G3: 9 },
    raterTeamModel: 'fleet:qwen2.5-coder@36gbwinresource',
  });
  assert.match(body, /#1234/);
  assert.match(body, /G1: first=5 second=7 delta=2/);
  assert.match(body, /G3: first=8 second=9 delta=1/);
  assert.match(body, /Refs Epic #1612/);
});

test('buildTier3Body: includes Tier-3 contract reference', () => {
  const body = buildTier3Body({ sourceTicket: 1, max_abs_delta: 1.5,
    deltas: {}, firstScores: {}, secondScores: {}, raterTeamModel: 'x' });
  assert.match(body, /Epic #1308/);
  assert.match(body, /actor-critic same-model amplification/);
});

test('TIER3_LABELS includes anneal:tier-3', () => {
  assert.ok(TIER3_LABELS.includes('anneal:tier-3'));
  assert.ok(TIER3_LABELS.includes('priority:P2'));
  assert.ok(TIER3_LABELS.includes('type:bug'));
});
