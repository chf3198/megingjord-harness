'use strict';
const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const {
  runBenchmark,
  p99,
  runConcurrent,
  isRegressed,
} = require('../scripts/global/benchmark-harness.js');

let counter = 0;
function tmpBaseline() {
  counter += 1;
  return path.join(os.tmpdir(), `bench-${process.pid}-${counter}.json`);
}

test('runBenchmark seeds on first run (no fail, no regression)', async () => {
  const file = tmpBaseline();
  const result = await runBenchmark({
    name: 'tokens',
    metric: () => 1000,
    baselineFile: file,
    budget: 0.1,
  });
  assert.equal(result.seeded, true);
  assert.equal(result.regressed, false);
  assert.equal(result.baseline, 1000);
  fs.unlinkSync(file);
});

test('runBenchmark flags a regression when a lower-better metric worsens beyond budget', async () => {
  const file = tmpBaseline();
  await runBenchmark({ name: 'tokens', metric: () => 1000, baselineFile: file, budget: 0.1 });
  const worse = await runBenchmark({
    name: 'tokens',
    metric: () => 1200,
    baselineFile: file,
    budget: 0.1,
  });
  assert.equal(worse.seeded, false);
  assert.equal(worse.regressed, true, '1200 > 1000*1.1');
  assert.equal(worse.delta, 200);
  fs.unlinkSync(file);
});

test('runBenchmark does not flag within budget; higher-better direction respected', () => {
  assert.equal(isRegressed(1050, 1000, 0.1, 'lower-better'), false);
  assert.equal(isRegressed(800, 1000, 0.1, 'higher-better'), true, 'success-rate dropped');
  assert.equal(isRegressed(1000, 1000, 0.1, 'higher-better'), false);
});

test('p99 returns the 99th percentile (empty -> 0)', () => {
  assert.equal(p99([]), 0);
  const samples = Array.from({ length: 100 }, (_unused, index) => index + 1);
  assert.ok(p99(samples) >= 99);
});

test('runConcurrent runs fn count times in parallel (load facet)', async () => {
  const results = await runConcurrent((index) => index * 2, 5);
  assert.deepEqual(results, [0, 2, 4, 6, 8]);
});
