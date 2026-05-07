// Wiki hygiene scanner + eval harness tests (#870 + #872).
const { test, expect } = require('@playwright/test');
const path = require('path');
const H = require(path.resolve(__dirname, '..', 'scripts', 'wiki', 'hygiene.js'));
const E = require(path.resolve(__dirname, '..', 'scripts', 'wiki', 'eval-harness.js'));

test('hygiene tokens lowercases and drops short tokens', () => {
  const t = H.tokens('Hello World HAMR_test xy');
  expect(t.has('hello')).toBe(true);
  expect(t.has('hamr')).toBe(true);
  expect(t.has('xy')).toBe(false);
});

test('hygiene jaccard symmetric on identical sets', () => {
  const s = new Set(['a', 'b', 'c']);
  expect(H.jaccard(s, s)).toBe(1);
});

test('hygiene jaccard zero on disjoint sets', () => {
  expect(H.jaccard(new Set(['a']), new Set(['b']))).toBe(0);
});

test('hygiene constants match documented thresholds', () => {
  expect(H.STALE_DAYS).toBe(180);
  expect(H.DUP_TOKEN_OVERLAP).toBe(0.85);
  expect(H.WEAK_LINK_THRESHOLD).toBe(2);
});

test('hygiene scanAll returns all 4 categories', () => {
  const result = H.scanAll();
  expect(result).toHaveProperty('stale');
  expect(result).toHaveProperty('duplicates');
  expect(result).toHaveProperty('orphans');
  expect(result).toHaveProperty('weak_links');
  expect(Array.isArray(result.stale)).toBe(true);
});

test('eval precisionAtK returns hits/k', () => {
  expect(E.precisionAtK(['a', 'b', 'c'], ['a', 'b'], 3)).toBeCloseTo(2 / 3, 2);
  expect(E.precisionAtK(['x', 'y'], ['z'], 5)).toBe(0);
});

test('eval recallAtK returns hits/expected-count', () => {
  expect(E.recallAtK(['a', 'b'], ['a', 'b', 'c'], 5)).toBeCloseTo(2 / 3, 2);
});

test('eval QUALITY_FLOOR matches documented threshold', () => {
  expect(E.QUALITY_FLOOR).toBe(0.40);
  expect(E.PRECISION_AT).toBe(5);
});

test('eval loadGroundTruth returns array of queries', () => {
  const queries = E.loadGroundTruth();
  expect(Array.isArray(queries)).toBe(true);
  if (queries.length) {
    expect(queries[0]).toHaveProperty('q');
    expect(queries[0]).toHaveProperty('expected');
  }
});
