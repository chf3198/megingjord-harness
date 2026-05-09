'use strict';
const { test, expect } = require('@playwright/test');
const path = require('node:path');
const sensors = require(path.resolve(__dirname, '../scripts/global/sensors/index.js'));

test.describe('sensors compute() — pure functions (#1257)', () => {
  test('ga: violation count → failure rate, capped at 1.0', () => {
    expect(sensors.ga.compute({ violationCount: 0 }).value).toBe(0);
    expect(sensors.ga.compute({ violationCount: 7 }).value).toBeCloseTo(0.5);
    expect(sensors.ga.compute({ violationCount: 14 }).value).toBe(1);
    expect(sensors.ga.compute({ violationCount: 100 }).value).toBe(1);
  });

  test('ll: failed/total ratio; null on no runs', () => {
    expect(sensors.ll.compute({ runs: [] }).value).toBeNull();
    expect(sensors.ll.compute({ runs: [{ conclusion: 'success' }, { conclusion: 'success' }] }).value).toBe(0);
    expect(sensors.ll.compute({ runs: [{ conclusion: 'failure' }, { conclusion: 'success' }] }).value).toBe(0.5);
  });

  test('cf: goal-misorder/goal-priority match; null on no closeouts', () => {
    expect(sensors.cf.compute({ closeouts: [] }).value).toBeNull();
    expect(sensors.cf.compute({ closeouts: [{ body: 'all good' }] }).value).toBe(0);
    expect(sensors.cf.compute({ closeouts: [
      { body: 'goal-misorder flagged' }, { body: 'all good' },
    ] }).value).toBe(0.5);
  });

  test('pr: goal-lens/goal-priority mention rate', () => {
    expect(sensors.pr.compute({ reviews: [] }).value).toBeNull();
    expect(sensors.pr.compute({ reviews: [{ body: 'goal-lens reordering needed' }] }).value).toBe(1);
    expect(sensors.pr.compute({ reviews: [{ body: 'lgtm' }] }).value).toBe(0);
  });

  test('rp: priority-cause reopen rate', () => {
    expect(sensors.rp.compute({ reopens: [] }).value).toBeNull();
    expect(sensors.rp.compute({ reopens: [{ priorityCause: false }] }).value).toBe(0);
    expect(sensors.rp.compute({ reopens: [
      { priorityCause: true }, { priorityCause: false },
    ] }).value).toBe(0.5);
  });

  test('oo: operator override flag is binary 0/1', () => {
    expect(sensors.oo.compute({ flag: undefined }).value).toBe(0);
    expect(sensors.oo.compute({ flag: false }).value).toBe(0);
    expect(sensors.oo.compute({ flag: true }).value).toBe(1);
  });

  test('aggregator: returns sensorValues object compatible with computeGHS', () => {
    const result = sensors.aggregate({
      violationCount: 7,
      runs: [{ conclusion: 'failure' }, { conclusion: 'success' }],
      closeouts: [{ body: 'goal-misorder' }, { body: 'ok' }, { body: 'ok' }, { body: 'ok' }],
      reviews: [{ body: 'lgtm' }, { body: 'goal-lens' }],
      reopens: [{ priorityCause: true }],
      flag: false,
    });
    expect(result).toMatchObject({
      ga: 0.5, ll: 0.5, cf: 0.25, pr: 0.5, rp: 1, oo: 0,
    });
  });

  test('aggregator: nulls survive aggregation', () => {
    const result = sensors.aggregate({
      violationCount: 0, runs: [], closeouts: [], reviews: [], reopens: [], flag: false,
    });
    expect(result.ga).toBe(0);
    expect(result.ll).toBeNull();
    expect(result.cf).toBeNull();
    expect(result.pr).toBeNull();
    expect(result.rp).toBeNull();
    expect(result.oo).toBe(0);
  });

  test('every sensor exports compute() function', () => {
    for (const key of ['ga', 'll', 'cf', 'pr', 'rp', 'oo']) {
      expect(typeof sensors[key].compute).toBe('function');
    }
  });

  test('every sensor returns {value, evidence} shape', () => {
    expect(sensors.ga.compute({ violationCount: 0 })).toHaveProperty('evidence');
    expect(sensors.ll.compute({ runs: [] })).toHaveProperty('evidence');
    expect(sensors.cf.compute({ closeouts: [] })).toHaveProperty('evidence');
  });
});
