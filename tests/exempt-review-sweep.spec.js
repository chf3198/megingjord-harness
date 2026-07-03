'use strict';
// Tests for the F3 exempt-review decision core (#3526, Epic #3517 / ADR-020 §D2).
// Covers threshold gating, SHADOW rollout, the #2920/D1 edge cases, and surface-only I0.

const assert = require('node:assert/strict');
const { test } = require('node:test');
const {
  decideExemptReview, SIGNAL_LABEL, SHADOW_INCIDENT,
} = require('../scripts/global/exempt-review-sweep.js');

const enforce = { idleDays: 60, thresholdDays: 45, dormant: false, closeEligible: false, labelPresent: false, shadow: false };

test('idle beyond threshold (enforce) → apply signal:exempt-review + queue (never closes)', () => {
  const r = decideExemptReview(enforce);
  assert.equal(r.action, 'apply');
  assert.equal(r.label, SIGNAL_LABEL);
  assert.equal(r.queue, '#2990');
  assert.notEqual(r.close, true);
});

test('SHADOW rollout: idle beyond threshold but shadow mode → shadow-log, NO label', () => {
  const r = decideExemptReview({ ...enforce, shadow: true });
  assert.equal(r.action, 'shadow-log');
  assert.equal(r.incident, SHADOW_INCIDENT);
  assert.equal(r.label, undefined);
});

test('within threshold → no-op', () => {
  const r = decideExemptReview({ ...enforce, idleDays: 30 });
  assert.equal(r.action, 'no-op');
});

test('debounce: idle + label already present → debounce', () => {
  const r = decideExemptReview({ ...enforce, labelPresent: true });
  assert.equal(r.action, 'debounce');
});

test('edge (a): status:dormant present → skip (defer to #2920)', () => {
  const r = decideExemptReview({ ...enforce, dormant: true });
  assert.equal(r.action, 'skip');
  assert.match(r.reason, /2920/);
});

test('edge (b): became dormant while carrying exempt-review → clear (auto-hand-off to #2920)', () => {
  const r = decideExemptReview({ ...enforce, dormant: true, labelPresent: true });
  assert.equal(r.action, 'clear');
  assert.equal(r.label, SIGNAL_LABEL);
});

test('edge (c): signal:close-eligible present → skip (D1 already surfaced)', () => {
  const r = decideExemptReview({ ...enforce, closeEligible: true });
  assert.equal(r.action, 'skip');
});

test('fail-safe: missing/invalid threshold → no-op (never surface on bad input)', () => {
  assert.equal(decideExemptReview({ ...enforce, thresholdDays: 0 }).action, 'no-op');
  assert.equal(decideExemptReview({ ...enforce, thresholdDays: undefined }).action, 'no-op');
  assert.equal(decideExemptReview({ ...enforce, idleDays: 'x' }).action, 'no-op');
});

test('surface-only I0: decideExemptReview NEVER returns a close/reopen action', () => {
  const ALLOWED = new Set(['no-op', 'skip', 'clear', 'shadow-log', 'apply', 'debounce']);
  for (const idleDays of [0, 30, 60, 999])
    for (const thresholdDays of [0, 45, 60])
      for (const dormant of [true, false])
        for (const closeEligible of [true, false])
          for (const labelPresent of [true, false])
            for (const shadow of [true, false]) {
              const r = decideExemptReview({ idleDays, thresholdDays, dormant, closeEligible, labelPresent, shadow });
              assert.ok(ALLOWED.has(r.action), `unexpected action ${r.action}`);
              assert.notEqual(r.close, true);
            }
});
