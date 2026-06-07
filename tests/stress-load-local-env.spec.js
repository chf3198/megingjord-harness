'use strict';
// #2645: stress tests for the .env hydration shim. Per test-methodology-matrix, a side-effect-bearing
// parser of external input requires stress: >=1 fault-injection path (G6) AND >=1 p99 budget (G7).
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { test } = require('node:test');
const { parseEnv, loadLocalEnv, hydrate } = require('../scripts/global/load-local-env.js');

function percentile(samples, fraction) {
  const sorted = [...samples].sort((left, right) => left - right);
  return sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * fraction))];
}

test('G6 fault-injection: malformed / binary / truncated input never throws and skips bad lines', () => {
  const adversarial = [
    '', '=novalue', 'NOEQUALS', '###', '   ', 'export ', '=', 'a b c=d',
    '\x00\x01\x02binarygarbage', 'X='.padEnd(200000, 'y'), 'GOOD=ok', 'export GOOD2="qq"',
  ].join('\n');
  let result;
  assert.doesNotThrow(() => { result = parseEnv(adversarial); });
  const map = Object.fromEntries(result);
  assert.equal(map.GOOD, 'ok');
  assert.equal(map.GOOD2, 'qq');
  assert.equal(map.NOEQUALS, undefined);
});

test('G6 fault-injection: loadLocalEnv on a huge/garbled .env degrades gracefully (no throw)', () => {
  const huge = Array.from({ length: 50000 }, (_, index) => `K${index}=v${index}`).join('\n')
    + '\n\x00\x00garbage-line-without-equals\n#comment\nLAST=done';
  const file = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'stress2645-')), '.env');
  fs.writeFileSync(file, huge);
  const env = {};
  let res;
  assert.doesNotThrow(() => { res = loadLocalEnv({ env, path: file, quiet: true }); });
  assert.equal(env.LAST, 'done');
  assert.equal(res.filled.length, 50001);
});

test('G7 p99 budget: hydrate of a 5k-key set stays under 25ms p99 over 200 runs', () => {
  const pairs = Array.from({ length: 5000 }, (_, index) => [`P${index}`, `v${index}`]);
  const samples = [];
  for (let run = 0; run < 200; run += 1) {
    const start = process.hrtime.bigint();
    hydrate({}, pairs);
    samples.push(Number(process.hrtime.bigint() - start) / 1e6);
  }
  const p99 = percentile(samples, 0.99);
  assert.ok(p99 < 25, `p99 ${p99.toFixed(2)}ms exceeded 25ms budget`);
});
