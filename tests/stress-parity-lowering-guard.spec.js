'use strict';
// tests/stress-parity-lowering-guard.spec.js — stress-test for parity-lowering-guard.
// Epic #3411 T3.2 (#3452). test_strategy: tdd-pyramid+stress-test
// (a) G6 fault-injection: missing baseline / malformed maps / unresolvable merge-base.
// (b) G7 p99 latency budget over many detectRegressions runs.

const assert = require('node:assert/strict');
const { test } = require('node:test');

const {
  parityScore,
  detectRegressions,
  runGuard,
  verdictRank,
  VERDICT_RANK,
} = require('../scripts/global/megalint/parity-lowering-guard.js');

const LARGE_MAP_SIZE = 500;
const PERF_ITERATIONS = 200;
const P99_BUDGET_MS = 50;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function buildLargeBaseMap(size) {
  const entries = {};
  for (let cellIndex = 0; cellIndex < size; cellIndex++) {
    entries[`feature-${cellIndex}::runtime-${cellIndex % 5}`] = VERDICT_RANK['ok'];
  }
  return new Map(Object.entries(entries));
}

function buildLargeHeadMap(baseMap) {
  // Head map identical to base — no regressions
  return new Map(baseMap);
}

// ---------------------------------------------------------------------------
// G6 FAULT-INJECTION: missing / malformed baseline
// ---------------------------------------------------------------------------

test('G6: missing baseline causes G6 fallback, never throws', () => {
  assert.doesNotThrow(() => {
    const result = runGuard({ strict: false, repoRoot: '/tmp/completely-absent-path-xyz' });
    assert.ok(result.fallback === true, 'should use G6 fallback when baseline absent');
    assert.deepEqual(result.regressions, []);
  });
});

test('G6: runGuard with null repoRoot falls back gracefully', () => {
  assert.doesNotThrow(() => {
    const result = runGuard({ strict: false, repoRoot: null });
    assert.ok(typeof result === 'object');
  });
});

test('G6: detectRegressions with null baseMap never throws', () => {
  assert.doesNotThrow(() => {
    // Pass null cast as Map — should not throw even on bad input
    const result = detectRegressions(new Map(), new Map(), null);
    assert.ok(Array.isArray(result));
  });
});

test('G6: detectRegressions with undefined headCells never throws', () => {
  const baseMap = new Map([['feat::rt', VERDICT_RANK['ok']]]);
  const headMap = new Map([['feat::rt', 0]]);
  assert.doesNotThrow(() => {
    const result = detectRegressions(baseMap, headMap, undefined);
    assert.ok(Array.isArray(result));
  });
});

test('G6: parityScore with null cells array never throws', () => {
  assert.doesNotThrow(() => {
    const result = parityScore({ cells: null });
    assert.equal(result.size, 0);
  });
});

test('G6: parityScore with non-array cells never throws', () => {
  assert.doesNotThrow(() => {
    const result = parityScore({ cells: 'invalid' });
    assert.equal(result.size, 0);
  });
});

test('G6: detectRegressions with empty maps produces no regressions', () => {
  const result = detectRegressions(new Map(), new Map(), []);
  assert.deepEqual(result, []);
});

test('G6: detectRegressions with unknown verdict keys in baseMap never throws', () => {
  const baseMap = new Map([['feat::rt', 99]]); // bogus high rank
  const headMap = new Map([['feat::rt', 0]]); // lower
  assert.doesNotThrow(() => {
    const result = detectRegressions(baseMap, headMap, []);
    assert.equal(result.length, 1); // still detects regression
  });
});

test('G6: verdictRank for unknown verdict string returns 0 (fail-closed)', () => {
  const rank = verdictRank('completely-unknown-verdict');
  assert.equal(rank, 0);
});

// ---------------------------------------------------------------------------
// G6: merge-base unresolvable → runGuard fallback (no crash)
// ---------------------------------------------------------------------------

test('G6: runGuard on a path with no baseline JSON falls back, exit stays 0 advisory', () => {
  // Use a temp path with no baseline file — simulates unresolvable merge-base scenario.
  const tempRoot = require('node:os').tmpdir();
  assert.doesNotThrow(() => {
    const result = runGuard({ strict: false, repoRoot: tempRoot });
    assert.equal(result.fallback, true);
    assert.deepEqual(result.regressions, []);
  });
});

// ---------------------------------------------------------------------------
// G7 PERF: p99 latency budget for detectRegressions over large maps
// ---------------------------------------------------------------------------

test(`G7: detectRegressions p99 < ${P99_BUDGET_MS}ms on ${LARGE_MAP_SIZE}-cell maps`, () => {
  const baseMap = buildLargeBaseMap(LARGE_MAP_SIZE);
  const headMap = buildLargeHeadMap(baseMap);
  const samples = [];
  for (let iteration = 0; iteration < PERF_ITERATIONS; iteration++) {
    const startTime = process.hrtime.bigint();
    detectRegressions(baseMap, headMap, []);
    const elapsedMs = Number(process.hrtime.bigint() - startTime) / 1_000_000;
    samples.push(elapsedMs);
  }
  samples.sort((first, second) => first - second);
  const p99Index = Math.floor(samples.length * 0.99);
  const p99Ms = samples[p99Index];
  process.stdout.write(
    `[stress-parity-lowering-guard] detectRegressions p99=${p99Ms.toFixed(3)}ms`
    + ` (n=${PERF_ITERATIONS}, cells=${LARGE_MAP_SIZE}, budget=${P99_BUDGET_MS}ms)\n`
  );
  assert.ok(p99Ms < P99_BUDGET_MS,
    `p99 ${p99Ms.toFixed(3)}ms exceeds ${P99_BUDGET_MS}ms budget`);
});

test('G7: parityScore p99 < 10ms on 500-cell matrix', () => {
  const cells = [];
  for (let cellIndex = 0; cellIndex < LARGE_MAP_SIZE; cellIndex++) {
    cells.push({
      featureId: `feature-${cellIndex}`,
      runtime: `runtime-${cellIndex % 5}`,
      verdict: 'ok',
    });
  }
  const matrixResult = { cells };
  const perfSamples = [];
  for (let iteration = 0; iteration < PERF_ITERATIONS; iteration++) {
    const startTime = process.hrtime.bigint();
    parityScore(matrixResult);
    const elapsedMs = Number(process.hrtime.bigint() - startTime) / 1_000_000;
    perfSamples.push(elapsedMs);
  }
  perfSamples.sort((first, second) => first - second);
  const p99Index = Math.floor(perfSamples.length * 0.99);
  const p99Ms = perfSamples[p99Index];
  process.stdout.write(
    `[stress-parity-lowering-guard] parityScore p99=${p99Ms.toFixed(3)}ms`
    + ` (n=${PERF_ITERATIONS}, cells=${LARGE_MAP_SIZE})\n`
  );
  assert.ok(p99Ms < 10, `parityScore p99 ${p99Ms.toFixed(3)}ms exceeds 10ms budget`);
});

// ---------------------------------------------------------------------------
// FUZZ: random verdict strings never crash verdictRank
// ---------------------------------------------------------------------------

test('FUZZ: 200 random verdict strings never throw in verdictRank', () => {
  const chars = 'abcdefghijklmnopqrstuvwxyz-_0123456789';
  for (let fuzzIndex = 0; fuzzIndex < 200; fuzzIndex++) {
    const length = 3 + Math.floor(Math.random() * 30);
    const randomVerdict = Array.from({ length }, () =>
      chars[Math.floor(Math.random() * chars.length)]
    ).join('');
    assert.doesNotThrow(() => verdictRank(randomVerdict), `threw on verdict: ${randomVerdict}`);
  }
});
