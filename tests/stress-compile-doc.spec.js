'use strict';
// stress-compile-doc (#3151, Epic #3147 S4): real multi-process concurrency stress for compile-doc
// (#3129). G6: concurrent compile to one out path yields a complete, valid entry (no torn write).
// G7: a p99 latency budget.
const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawn } = require('child_process');
const { p99 } = require('../scripts/global/benchmark-harness.js');

const CD = path.join(path.resolve(__dirname, '..'), 'scripts/wiki/compile-doc.js');
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

test('stress G6/G7: concurrent compile to one out path yields a complete valid entry within p99', async () => {
  const src = path.join(os.tmpdir(), `cd-src-${process.pid}.md`);
  fs.writeFileSync(src, '# Doc\n\nlead paragraph\n\n## Section A\n## Section B\n');
  const out = path.join(os.tmpdir(), `cd-out-${process.pid}.md`);
  const code = `const m=require(${JSON.stringify(CD)});const fs=require('fs');fs.writeFileSync(${JSON.stringify(out)}, m.compileDoc(${JSON.stringify(src)}, fs.readFileSync(${JSON.stringify(src)},'utf8')).body)`;
  const latencies = await Promise.all(Array.from({ length: WORKERS }, () => worker(code)));
  const body = fs.readFileSync(out, 'utf8'); // G6: complete entry, no torn write
  assert.match(body, /source_sha256: [0-9a-f]{64}/, 'has full provenance');
  assert.match(body, /## Outline/, 'has outline');
  assert.ok(p99(latencies) < P99_BUDGET_MS, `p99 ${p99(latencies)}ms < ${P99_BUDGET_MS}ms`);
  fs.unlinkSync(src);
  fs.unlinkSync(out);
});
