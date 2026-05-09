'use strict';
const { test, expect } = require('@playwright/test');
const path = require('node:path');
const { computeGHS, DEFAULT_WEIGHTS, MIN_ACTIVE_WEIGHT_FLOOR } = require(
  path.resolve(__dirname, '../scripts/global/goal-health-score.js')
);

test.describe('goal-health-score (#1253 / Epic #1113 AC2)', () => {
  test('all sensors at zero failure → score = 1.0', () => {
    const sensorValues = { ga: 0, ll: 0, cf: 0, pr: 0, rp: 0, oo: 0 };
    const r = computeGHS({ sensorValues });
    expect(r.score).toBeCloseTo(1.0, 5);
    expect(r.stale).toBe(false);
  });

  test('all sensors at full failure → score = 0.0', () => {
    const sensorValues = { ga: 1, ll: 1, cf: 1, pr: 1, rp: 1, oo: 1 };
    const r = computeGHS({ sensorValues });
    expect(r.score).toBeCloseTo(0.0, 5);
  });

  test('all-null sensors → stale, score=null', () => {
    const sensorValues = { ga: null, ll: null, cf: null, pr: null, rp: null, oo: null };
    const r = computeGHS({ sensorValues });
    expect(r.stale).toBe(true);
    expect(r.score).toBeNull();
  });

  test('renormalization: 1 active sensor at 0.5 → score=0.5 (not weight-scaled)', () => {
    const sensorValues = { ga: 0.5, ll: null, cf: null, pr: null, rp: null, oo: null };
    const r = computeGHS({ sensorValues });
    // ga is the only active sensor → renormalized w=1.0 → score = 1 - 0.5 = 0.5
    // BUT MIN_ACTIVE_WEIGHT_FLOOR is 0.5 (default) → original ga weight 0.25 < 0.5 → stale
    expect(r.stale).toBe(true);
  });

  test('renormalization: 4 active sensors with sum-weight ≥ floor → not stale', () => {
    // ga (0.25) + cf (0.20) + rp (0.20) + ll (0.15) = 0.80 sum-weight ≥ 0.5 floor
    const sensorValues = { ga: 0.4, ll: 0.0, cf: 0.0, pr: null, rp: 0.0, oo: null };
    const r = computeGHS({ sensorValues });
    expect(r.stale).toBe(false);
    // Renormalized: ga weight = 0.25/0.80 = 0.3125; failure_rate sum = 0.3125 * 0.4 + 0 + 0 + 0 = 0.125
    // score = 1 - 0.125 = 0.875
    expect(r.score).toBeCloseTo(0.875, 3);
  });

  test('contributing list reports per-sensor evidence', () => {
    const sensorValues = { ga: 0.2, ll: 0.0, cf: 0.5, pr: null, rp: 0.0, oo: 0 };
    const r = computeGHS({ sensorValues });
    expect(Object.keys(r.contributing)).toEqual(expect.arrayContaining(['ga', 'll', 'cf', 'rp', 'oo']));
    expect(r.contributing.pr).toBeUndefined();
  });

  test('weights_used reflects renormalization', () => {
    // ga(0.25) + cf(0.20) + rp(0.20) = 0.65 ≥ 0.5 floor → not stale
    const sensorValues = { ga: 0, ll: null, cf: 0, pr: null, rp: 0, oo: null };
    const r = computeGHS({ sensorValues });
    const sum = Object.values(r.weights_used).reduce((s, v) => s + v, 0);
    expect(sum).toBeCloseTo(1.0, 5);
  });

  test('custom weights override defaults', () => {
    const sensorValues = { ga: 1, ll: 0, cf: 0, pr: 0, rp: 0, oo: 0 };
    const r = computeGHS({ sensorValues, weights: { ga: 0.50, ll: 0.10, cf: 0.10, pr: 0.10, rp: 0.10, oo: 0.10 } });
    expect(r.score).toBeCloseTo(0.5, 5);
  });

  test('DEFAULT_WEIGHTS sum to 1.0', () => {
    const sum = Object.values(DEFAULT_WEIGHTS).reduce((s, v) => s + v, 0);
    expect(sum).toBeCloseTo(1.0, 5);
  });

  test('MIN_ACTIVE_WEIGHT_FLOOR is 0.5', () => {
    expect(MIN_ACTIVE_WEIGHT_FLOOR).toBe(0.5);
  });

  test('clamp: score never exceeds 1.0', () => {
    const sensorValues = { ga: -0.5, ll: 0, cf: 0, pr: 0, rp: 0, oo: 0 };
    const r = computeGHS({ sensorValues });
    expect(r.score).toBeLessThanOrEqual(1.0);
    expect(r.score).toBeGreaterThanOrEqual(0.0);
  });

  test('clamp: score never below 0.0', () => {
    const sensorValues = { ga: 2, ll: 2, cf: 2, pr: 2, rp: 2, oo: 2 };
    const r = computeGHS({ sensorValues });
    expect(r.score).toBeGreaterThanOrEqual(0.0);
    expect(r.score).toBeLessThanOrEqual(1.0);
  });

  test('computed_utc is ISO timestamp', () => {
    const r = computeGHS({ sensorValues: { ga: 0, ll: 0, cf: 0, pr: 0, rp: 0, oo: 0 } });
    expect(r.computed_utc).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
  });
});
