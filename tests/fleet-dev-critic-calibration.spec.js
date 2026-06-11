// Refs #2799 — critic-calibration loop (Epic #2791 P1-6). Pure unit tests for precision / prove-it
// acceptance / post-refresh drift and the degradation trip (AC3/AC4).
const { test, expect } = require('@playwright/test');
const {
  calibrationStats, acceptanceRate, verdictDrift, detectCriticDrift,
} = require('../scripts/global/fleet-dev-critic-calibration.js');

const pair = (criticFlag, humanFlag) => ({ criticFlag, humanFlag });
const repeat = (one, times) => Array.from({ length: times }, () => one);

test('calibrationStats computes confusion matrix + precision/recall', () => {
  const stats = calibrationStats([pair(true, true), pair(true, false), pair(false, true), pair(false, false)]);
  expect(stats).toMatchObject({ tp: 1, fp: 1, fn: 1, tn: 1 });
  expect(stats.precision).toBeCloseTo(0.5, 5);
  expect(stats.recall).toBeCloseTo(0.5, 5);
});

test('calibrationStats: no positives → precision null (no divide-by-zero)', () => {
  expect(calibrationStats([pair(false, false), pair(false, true)]).precision).toBeNull();
  expect(calibrationStats([]).n).toBe(0);
});

test('acceptanceRate is accepted/total; empty → null', () => {
  expect(acceptanceRate([{ accepted: true }, { accepted: true }, { accepted: false }])).toBeCloseTo(2 / 3, 5);
  expect(acceptanceRate([])).toBeNull();
});

test('verdictDrift counts flipped verdicts; absent current key is a flip; empty baseline → null', () => {
  expect(verdictDrift({ a: 'reject', b: 'accept', c: 'accept' }, { a: 'reject', b: 'reject', c: 'accept' })).toBeCloseTo(1 / 3, 5);
  expect(verdictDrift({ a: 'reject' }, {})).toBe(1); // missing → flip
  expect(verdictDrift({}, {})).toBeNull();
});

test('detectCriticDrift: a healthy critic is NOT degraded (>= MIN_SAMPLE evidence)', () => {
  const pairs = [...repeat(pair(true, true), 14), pair(false, false), pair(true, false)]; // 16 pairs, precision 14/15≈0.93
  const out = detectCriticDrift({ pairs, proveItOutcomes: repeat({ accepted: true }, 4),
    baselineVerdicts: { a: 'reject', b: 'reject', c: 'reject' }, currentVerdicts: { a: 'reject', b: 'reject', c: 'reject' } });
  expect(out.degraded).toBe(false);
  expect(out.actions).toEqual([]);
});

test('AC4 critic-drift-trip: precision below floor → degraded + anneal/recalibrate', () => {
  const seen = [];
  // 3 TP, 13 FP over 16 pairs → precision 0.19 < 0.7 floor, n=16 >= MIN_SAMPLE
  const pairs = [...repeat(pair(true, true), 3), ...repeat(pair(true, false), 13)];
  const out = detectCriticDrift({ pairs }, { emit: (rec) => seen.push(rec) });
  expect(out.degraded).toBe(true);
  expect(out.reasons).toContain('precision-below-floor');
  expect(out.actions).toEqual(['emit-anneal', 'recalibrate']);
  expect(seen[0]).toMatchObject({ event: 'fleet-dev-critic-degraded', action: 'recalibrate', tier2_anneal: true });
});

test('AC3 low prove-it acceptance OR high post-refresh drift each degrade', () => {
  expect(detectCriticDrift({ proveItOutcomes: [{ accepted: false }, { accepted: false }, { accepted: true }] }).reasons)
    .toContain('proveit-acceptance-below-floor');
  const drift = detectCriticDrift({ baselineVerdicts: { a: 'r', b: 'r', c: 'r' }, currentVerdicts: { a: 'a', b: 'a', c: 'r' } });
  expect(drift.reasons).toContain('post-refresh-verdict-drift');
});

test('fail-safe: thin precision sample (< MIN_SAMPLE) does not trip on precision', () => {
  const out = detectCriticDrift({ pairs: [pair(true, false), pair(true, false)] }); // n=2, precision 0 but thin
  expect(out.reasons).not.toContain('precision-below-floor');
  expect(out.degraded).toBe(false);
});

test('NO fail-open: a starved metric pipeline surfaces insufficient-data, NOT silent-healthy', () => {
  // prove-it stopped emitting + no pairs + no drift inputs → every check is "unknown", not "ok".
  const out = detectCriticDrift({ proveItOutcomes: [{ accepted: true }] }); // 1 outcome < MIN_PROVEIT_SAMPLES
  expect(out.status).toEqual({ precision: 'insufficient-data', acceptance: 'insufficient-data', drift: 'insufficient-data' });
  expect(out.insufficientData).toBe(true); // caller must NOT treat degraded:false as healthy here
  expect(out.degraded).toBe(false);
});
