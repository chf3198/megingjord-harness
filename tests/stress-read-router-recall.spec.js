'use strict';
// stress-read-router-recall (#3151, Epic #3147 S4): real multi-process concurrency stress for
// recallMiss (#3130) JSONL append. G6: N concurrent appends -> N intact lines (no lost/torn events).
// G7: a p99 latency budget.
const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawn } = require('child_process');
const { p99 } = require('../scripts/global/benchmark-harness.js');

const RR = path.join(path.resolve(__dirname, '..'), 'scripts/global/read-router.js');
const WORKERS = 20;
const P99_BUDGET_MS = 4000;

/** Spawn one worker process; resolve its wall-clock ms. @param {string} code @returns {Promise<number>} */
function worker(code) {
  return new Promise((resolve) => {
    const startNs = process.hrtime.bigint();
    spawn(process.execPath, ['-e', code], { stdio: 'ignore' }).on('close', () =>
      resolve(Number(process.hrtime.bigint() - startNs) / 1e6)
    );
  });
}

test('stress G6/G7: concurrent recallMiss appends are intact (no lost events) within p99 budget', async () => {
  const jsonl = path.join(os.tmpdir(), `recall-stress-${process.pid}.jsonl`);
  const latencies = await Promise.all(
    Array.from({ length: WORKERS }, (_unused, index) =>
      worker(`require(${JSON.stringify(RR)}).recallMiss('q${index}',${JSON.stringify(jsonl)})`)
    )
  );
  const lines = fs.readFileSync(jsonl, 'utf8').trim().split('\n').filter(Boolean);
  for (const line of lines) JSON.parse(line); // G6: every appended line is intact (no torn write)
  assert.equal(lines.length, WORKERS, 'no lost appends under concurrency');
  assert.ok(p99(latencies) < P99_BUDGET_MS, `p99 ${p99(latencies)}ms < ${P99_BUDGET_MS}ms`);
  fs.unlinkSync(jsonl);
});
