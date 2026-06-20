'use strict';
const { test } = require('node:test');
const assert = require('node:assert');
const {
  runGate,
  regressions,
  missingBenchmarkSuites,
} = require('../scripts/global/benchmark-gate.js');

test('regressions excludes seed runs', () => {
  const results = [
    { name: 'a', regressed: true, seeded: true },
    { name: 'b', regressed: true, seeded: false },
    { name: 'c', regressed: false, seeded: false },
  ];
  const reg = regressions(results);
  assert.equal(reg.length, 1);
  assert.equal(reg[0].name, 'b');
});

test('missingBenchmarkSuites flags required surfaces lacking a suite', () => {
  assert.deepEqual(missingBenchmarkSuites(['x', 'y'], ['x']), ['y']);
  assert.deepEqual(missingBenchmarkSuites(['x'], ['x']), []);
});

test('runGate ok when no regression and no missing suite', () => {
  const report = runGate({
    results: [{ name: 'a', regressed: false, seeded: false }],
    required: ['a'],
    present: ['a'],
  });
  assert.equal(report.ok, true);
});

test('runGate fails on a regression', () => {
  const report = runGate({
    results: [
      { name: 'b', regressed: true, seeded: false, value: 1200, baseline: 1000, delta: 200 },
    ],
  });
  assert.equal(report.ok, false);
  assert.equal(report.regressed.length, 1);
});

test('runGate fails on a missing suite', () => {
  const report = runGate({ results: [], required: ['qa-cache'], present: [] });
  assert.equal(report.ok, false);
  assert.equal(report.missing[0], 'qa-cache');
});

test('runGate is resilient to empty/missing input', () => {
  assert.equal(runGate().ok, true);
});

test('missingBenchmarkSuites edge cases (empty required/present, all-missing)', () => {
  assert.deepEqual(missingBenchmarkSuites([], ['x']), []);
  assert.deepEqual(missingBenchmarkSuites(['a', 'b'], []), ['a', 'b']);
  assert.deepEqual(missingBenchmarkSuites(undefined, undefined), []);
});

test('BENCHMARK_GATE_DISABLED=1 is a rollback no-op (passes regardless)', () => {
  const prior = process.env.BENCHMARK_GATE_DISABLED;
  process.env.BENCHMARK_GATE_DISABLED = '1';
  const report = runGate({
    results: [{ name: 'b', regressed: true, seeded: false }],
    required: ['x'],
    present: [],
  });
  assert.equal(report.ok, true, 'disabled gate passes');
  assert.equal(report.disabled, true);
  if (prior === undefined) delete process.env.BENCHMARK_GATE_DISABLED;
  else process.env.BENCHMARK_GATE_DISABLED = prior;
});
