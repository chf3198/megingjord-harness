// tests/test-floor-replay-eval.spec.js — #3105 (Epic #1948 P1.3+P1.4+P1.6).
// Strategy: tdd-pyramid. replay-eval calibration, drift detection, audit schema, rollback.
'use strict';

const { test, expect } = require('@playwright/test');
const path = require('path');
const evalMod = require('../scripts/global/test-floor-replay-eval');
const tfc = require('../scripts/global/test-floor-classifier');

// ── P1.3: replayEval over the committed corpus ──

test('replayEval over the committed corpus is calibrated (precision ≥ promotion floor)', () => {
  const result = evalMod.replayEval(evalMod.loadCorpus());
  expect(result.n).toBeGreaterThanOrEqual(10);
  expect(result.precision).toBeGreaterThanOrEqual(evalMod.PROMOTION_PRECISION);
  expect(result.promotionEligible).toBe(true);
});

test('replayEval scores precision/recall from a labeled set', () => {
  const corpus = [
    { paths: ['scripts/global/x-gate.js'], declared: 'tdd-pyramid', expectedMeetsFloor: false }, // TP
    { paths: ['scripts/global/y.js'], declared: 'tdd-pyramid', expectedMeetsFloor: true },        // TN
    { paths: ['scripts/global/z.js'], declared: 'none', expectedMeetsFloor: false },              // TP
  ];
  const result = evalMod.replayEval(corpus);
  expect(result.truePos).toBe(2);
  expect(result.trueNeg).toBe(1);
  expect(result.precision).toBe(1);
});

test('replayEval is not promotion-eligible below the precision floor', () => {
  // Two deliberately mislabeled "ok" cases the classifier correctly flags → false positives.
  const corpus = [
    { paths: ['scripts/global/a-gate.js'], declared: 'tdd-pyramid', expectedMeetsFloor: true },
    { paths: ['scripts/global/b.js'], declared: 'none', expectedMeetsFloor: true },
    { paths: ['scripts/global/c.js'], declared: 'tdd-pyramid', expectedMeetsFloor: true },
  ];
  const result = evalMod.replayEval(corpus);
  expect(result.promotionEligible).toBe(false);
});

test('replayEval handles an empty corpus (vacuous precision = 1)', () => {
  expect(evalMod.replayEval([]).precision).toBe(1);
  expect(evalMod.replayEval(null).n).toBe(0);
});

// ── P1.4: detectDrift ──

test('detectDrift reports the under-declaration rate + flagged items', () => {
  const samples = [
    { paths: ['scripts/global/x-gate.js'], declared: 'tdd-pyramid' }, // below floor
    { paths: ['scripts/global/y.js'], declared: 'tdd-pyramid' },      // ok
    { paths: ['docs/z.md'], declared: 'drift-lint' },                 // ok
  ];
  const out = evalMod.detectDrift(samples);
  expect(out.total).toBe(3);
  expect(out.belowFloor).toBe(1);
  expect(out.driftRate).toBeCloseTo(0.3333, 3);
  expect(out.items[0].gaps.join(' ')).toMatch(/stress-test required/);
});

test('detectDrift on empty input is zero drift', () => {
  expect(evalMod.detectDrift([])).toMatchObject({ total: 0, belowFloor: 0, driftRate: 0 });
});

// ── P1.6: audit schema + rollback ──

test('auditRecord emits a stable versioned schema', () => {
  const record = tfc.auditRecord(tfc.reconcile('tdd-pyramid', ['scripts/global/a-gate.js']), { ts: '2026-06-18T00:00:00Z', ticket: 3105 });
  expect(record.schema).toBe('test-floor-audit-v1');
  expect(record).toMatchObject({ ts: '2026-06-18T00:00:00Z', ticket: 3105, meets_floor: false });
  expect(Array.isArray(record.gaps)).toBe(true);
  expect(record.derived_code_floors).toContain('tdd-pyramid');
});

test('TEST_FLOOR_DISABLED rolls the CLI back to a no-op (exit 0)', () => {
  expect(tfc.isDisabled({ TEST_FLOOR_DISABLED: '1' })).toBe(true);
  expect(tfc.isDisabled({})).toBe(false);
  expect(tfc.runCli(['--declared', 'none', '--files', 'scripts/global/x.js', '--strict'], { TEST_FLOOR_DISABLED: '1' })).toBe(0);
});

// ── regression: the corpus-driven classifier fixes (#3105) ──

test('classifier fix: nested scripts/global/** is a governance-script surface', () => {
  expect(tfc.surfaceForPath('scripts/global/megalint/some-validator.js').surface).toBe('governance-script');
});

test('classifier fix: a python hook is not flagged for missing JS stress-test', () => {
  expect(tfc.reconcile('tdd-pyramid', ['hooks/scripts/pretool_guard.py']).meetsFloor).toBe(true);
});
