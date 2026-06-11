// Refs #2799 — anti-Goodhart test-quality monitor (Epic #2791 P1-6). Pure unit tests; MEGINGJORD_NO_TELEMETRY
// guards the recordQualitySample prod write.
process.env.MEGINGJORD_NO_TELEMETRY = '1';
const { test, expect } = require('@playwright/test');
const {
  qualityScore, direction, recordQualitySample, detectGoodhart, goodhartGuardrail,
} = require('../scripts/global/fleet-dev-anti-goodhart.js');

// helper: a sample at a given share + uniform quality level q (all three quality metrics = q).
const sample = (share, q) => ({ share, coverageDelta: q, mutationScore: q, testCodeComplexityRatio: q });

test('qualityScore is a weighted composite; missing metric counts as 0; ratio capped at 1', () => {
  expect(qualityScore(sample(0, 1))).toBeCloseTo(1, 5);
  expect(qualityScore({ coverageDelta: 1 })).toBeCloseTo(0.4, 5); // others missing → 0
  expect(qualityScore({ coverageDelta: 0, mutationScore: 0, testCodeComplexityRatio: 5 })).toBeCloseTo(0.2, 5); // ratio cap
});

test('direction reports up/down/flat with a dead-band', () => {
  expect(direction([0.4, 0.5, 0.6, 0.7])).toBe('up');
  expect(direction([0.9, 0.7, 0.5, 0.3])).toBe('down');
  expect(direction([0.5, 0.5, 0.5, 0.5])).toBe('flat');
});

test('AC1 recordQualitySample routes through the injected emit (no prod write)', () => {
  const seen = [];
  recordQualitySample(sample(0.5, 0.8), { emit: (rec) => seen.push(rec) });
  expect(seen[0]).toMatchObject({ share: 0.5, mutationScore: 0.8 });
});

test('detectGoodhart fail-safe: a thin sample never trips', () => {
  const out = detectGoodhart([sample(0.4, 0.9), sample(0.6, 0.5)]); // < MIN_SAMPLE
  expect(out.tripped).toBe(false);
  expect(out.reason).toBe('insufficient-sample');
});

test('AC4 Goodhart-trip: share rises while quality falls → tripped', () => {
  const window = [sample(0.4, 0.9), sample(0.5, 0.7), sample(0.6, 0.5), sample(0.7, 0.3)];
  const out = detectGoodhart(window);
  expect(out.shareTrend).toBe('up');
  expect(out.qualityTrend).toBe('down');
  expect(out.tripped).toBe(true);
});

test('F1 slow-drift: a slow consistent quality decline under the old dead-band is still caught', () => {
  // quality drifts 0.80→0.74 and share 0.50→0.56 over 10 samples — a half-mean delta would read ~flat.
  const window = Array.from({ length: 10 }, (unused, idx) => sample(0.5 + idx * 0.006, 0.8 - idx * 0.006));
  const out = detectGoodhart(window);
  expect(out.shareTrend).toBe('up');
  expect(out.qualityTrend).toBe('down');
  expect(out.tripped).toBe(true);
});

test('no trip when quality rises with share (both improving)', () => {
  const window = [sample(0.4, 0.3), sample(0.5, 0.5), sample(0.6, 0.7), sample(0.7, 0.9)];
  expect(detectGoodhart(window).tripped).toBe(false);
});

test('no trip when share is flat even if quality falls', () => {
  const window = [sample(0.5, 0.9), sample(0.5, 0.7), sample(0.5, 0.5), sample(0.5, 0.3)];
  expect(detectGoodhart(window).tripped).toBe(false);
});

test('AC2 goodhartGuardrail gates the share metric + emits anneal on a trip', () => {
  const seen = [];
  const window = [sample(0.4, 0.9), sample(0.5, 0.7), sample(0.6, 0.5), sample(0.7, 0.3)];
  const out = goodhartGuardrail(window, { emit: (rec) => seen.push(rec) });
  expect(out.actions).toEqual(['gate-share-metric', 'emit-anneal']);
  expect(seen[0]).toMatchObject({ event: 'fleet-dev-goodhart-trip', action: 'gate-share-metric', tier2_anneal: true });
});

test('goodhartGuardrail no-ops (no actions) when not tripped', () => {
  expect(goodhartGuardrail([sample(0.5, 0.5), sample(0.5, 0.5), sample(0.5, 0.5), sample(0.5, 0.5)]).actions).toEqual([]);
});
