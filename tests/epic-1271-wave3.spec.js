'use strict';
const { test, expect } = require('@playwright/test');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const guard = require(path.join(root, 'scripts/global/rate-limit-guard.js'));
const dag = require(path.join(root, 'scripts/global/epic-dependency-dag.js'));
const measuring = require(path.join(root, 'scripts/global/measuring-recheck.js'));

test.describe('C9 #1294 — rate-limit guard', () => {
  test('ETag cache hit returns cached value without consuming budget', async () => {
    const g = new guard.RateLimitGuard({ now: () => 0 });
    g.cache.set('k', 'cached');
    const r = await g.withGuard('k', async () => 'fresh');
    expect(r.hit).toBe(true);
    expect(r.value).toBe('cached');
  });
  test('consumes budget on miss', async () => {
    const g = new guard.RateLimitGuard({ now: () => 0 });
    const r = await g.withGuard('k', async () => 'fresh');
    expect(r.hit).toBe(false);
    expect(g.history.length).toBe(1);
  });
  test('budgets table includes default + bulk + semantic_search', () => {
    expect(guard.BUDGETS.default.perMinute).toBe(80);
    expect(guard.BUDGETS.bulk.perMinute).toBe(50);
    expect(guard.BUDGETS.semantic_search.perMinute).toBe(10);
  });
});

test.describe('C6 #1292 — dependency DAG', () => {
  test('parses text deps', () => {
    const edges = dag.parseTextDeps('Depends-on: #100\nBlocked-by: #200\n');
    expect(edges).toHaveLength(2);
    expect(edges[0].target).toBe(100);
  });
  test('detects cycles', () => {
    const graph = new Map([
      [1, new Set([2])],
      [2, new Set([3])],
      [3, new Set([1])],
    ]);
    expect(dag.detectCycles(graph).length).toBeGreaterThan(0);
  });
  test('no cycles in acyclic DAG', () => {
    const graph = new Map([
      [1, new Set([2])],
      [2, new Set([3])],
      [3, new Set()],
    ]);
    expect(dag.detectCycles(graph)).toEqual([]);
  });
});

test.describe('C7 #1293 — measuring state machine', () => {
  test('parses measuring fields', () => {
    const fields = measuring.parseMeasuringFields('Recheck-after: 2026-05-24\nMeasure-window: 7d\nSensor: HAMR\n');
    expect(fields.recheck_after).toBe('2026-05-24');
    expect(fields.measure_window).toBe('7d');
    expect(fields.sensor).toBe('HAMR');
  });
  test('isOverdue compares dates', () => {
    expect(measuring.isOverdue({ recheck_after: '2026-05-01' }, '2026-05-10')).toBe(true);
    expect(measuring.isOverdue({ recheck_after: '2026-06-01' }, '2026-05-10')).toBe(false);
  });
  test('validates schema completeness', () => {
    const result = measuring.validateMeasuringSchema('Recheck-after: 2026-05-24\n');
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => /Measure-window/.test(e))).toBe(true);
  });
});
