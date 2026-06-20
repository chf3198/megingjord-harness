'use strict';
// stress-governance-qa-cache (#3151, Epic #3147 S4): real multi-process concurrency stress for the
// qa-cache (#3142). G6: concurrent put never corrupts the store. G7: a p99 latency budget. Surfaces
// the read-modify-write survival rate (the improvable metric; file-locking is a tracked follow-on).
const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawn } = require('child_process');
const { p99 } = require('../scripts/global/benchmark-harness.js');

const QA = path.join(path.resolve(__dirname, '..'), 'scripts/global/governance-qa-cache.js');
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

test('stress G6/G7: concurrent put never corrupts the store; survival + p99 measured', async () => {
  const store = path.join(os.tmpdir(), `qa-stress-${process.pid}.json`);
  const latencies = await Promise.all(
    Array.from({ length: WORKERS }, (_unused, index) =>
      worker(`require(${JSON.stringify(QA)}).put('q${index}','a${index}',${JSON.stringify(store)})`)
    )
  );
  const parsed = JSON.parse(fs.readFileSync(store, 'utf8')); // G6: complete, valid JSON (no torn write)
  const survived = Object.keys(parsed).length;
  assert.ok(survived >= 1 && survived <= WORKERS, `survival in [1,${WORKERS}]: ${survived}`);
  assert.ok(p99(latencies) < P99_BUDGET_MS, `p99 ${p99(latencies)}ms < ${P99_BUDGET_MS}ms`);
  fs.unlinkSync(store);
});
