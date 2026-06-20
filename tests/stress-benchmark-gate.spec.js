'use strict';
// stress-benchmark-gate (#3150, Epic #3147): dogfoods the Epic's own rule — a *-gate.js surface gets
// a stress spec asserting a chaos/fault path (G6) and a p99/perf budget (G7).
const { test } = require('node:test');
const assert = require('node:assert');
const { runGate } = require('../scripts/global/benchmark-gate.js');

test('stress G7: runGate stays correct + bounded over a 10k-result set (perf budget)', () => {
  const results = Array.from({ length: 10000 }, (_unused, index) => ({
    name: `m${index}`,
    regressed: index % 1000 === 0,
    seeded: false,
  }));
  const start = process.hrtime.bigint();
  const report = runGate({ results });
  const elapsedMs = Number(process.hrtime.bigint() - start) / 1e6;
  assert.equal(report.regressed.length, 10);
  assert.ok(elapsedMs < 100, `p99 budget: ${elapsedMs}ms < 100ms`);
});

test('stress G6: runGate fault path — malformed/partial results never crash', () => {
  const report = runGate({
    results: [null, undefined, {}, { regressed: true }, { regressed: true, seeded: false }],
  });
  assert.equal(report.ok, false);
  assert.equal(report.regressed.length, 2, 'two real regressions; null/undefined/{} ignored');
});
