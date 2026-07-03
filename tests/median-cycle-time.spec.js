'use strict';
// Tests for the F3 velocity-median helper (#3526, Epic #3517 / ADR-020 §D2).
// Fixtures per the ADR: N=0, N<5, N=20, all-same-day, and the worked examples (6d→45, 20d→60).

const assert = require('node:assert/strict');
const { test } = require('node:test');
const {
  cycleDays, medianCycleTime, idleThresholdDays, thresholdFromSamples, FLOOR_45D,
} = require('../scripts/global/median-cycle-time.js');

// Build N samples each spanning `days` days.
function samples(n, days) {
  const out = [];
  for (let i = 0; i < n; i++) {
    const start = new Date(2026, 0, 1 + i).toISOString();
    const end = new Date(2026, 0, 1 + i + days).toISOString();
    out.push({ inProgressAt: start, closedAt: end });
  }
  return out;
}

test('cycleDays computes day span; rejects invalid/degenerate samples', () => {
  assert.equal(cycleDays({ inProgressAt: '2026-01-01', closedAt: '2026-01-07' }), 6);
  assert.equal(cycleDays({ inProgressAt: 'x', closedAt: '2026-01-07' }), null);
  assert.equal(cycleDays({ inProgressAt: '2026-01-07', closedAt: '2026-01-01' }), null); // closed before start
  assert.equal(cycleDays(null), null);
});

test('cold-start: N=0 samples → null median → threshold falls back to FLOOR_45D', () => {
  assert.equal(medianCycleTime([]), null);
  assert.equal(idleThresholdDays(medianCycleTime([])), FLOOR_45D);
  assert.equal(thresholdFromSamples([]), 45);
});

test('cold-start: N<5 valid samples → null median → floor', () => {
  assert.equal(medianCycleTime(samples(4, 10)), null);
  assert.equal(thresholdFromSamples(samples(4, 10)), 45);
});

test('degenerate-median guard: all-same-day closes (median 0) → floor (never trips early)', () => {
  assert.equal(medianCycleTime(samples(20, 0)), null);
  assert.equal(thresholdFromSamples(samples(20, 0)), 45);
});

test('worked example: N=20 median 6d, k=3 → 18 < floor ⇒ threshold = 45', () => {
  assert.equal(medianCycleTime(samples(20, 6)), 6);
  assert.equal(thresholdFromSamples(samples(20, 6)), 45);
});

test('worked example: N=20 median 20d, k=3 → 60 > floor ⇒ threshold = 60', () => {
  assert.equal(medianCycleTime(samples(20, 20)), 20);
  assert.equal(thresholdFromSamples(samples(20, 20)), 60);
});

test('idleThresholdDays: null median → floor; scales with k×median above the floor', () => {
  assert.equal(idleThresholdDays(null), 45);
  assert.equal(idleThresholdDays(6), 45);   // max(45, 18)
  assert.equal(idleThresholdDays(20), 60);  // max(45, 60)
  assert.equal(idleThresholdDays(30, { k: 2 }), 60);
});

test('median ignores invalid samples but still needs ≥5 VALID ones', () => {
  const mixed = [...samples(5, 12), { inProgressAt: 'bad', closedAt: 'bad' }];
  assert.equal(medianCycleTime(mixed), 12);
});
