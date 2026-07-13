'use strict';
// Stress test for baton-back-ledger (Epic #3251 #3259): the ledger MUTATES shared
// state (per-ticket jsonl append), so it ships with a stress pass — (G6) concurrent
// append integrity under fault injection, and (G7) a p99 append latency budget. The
// per-ticket file design is exactly what avoids the #3573 monolithic-ledger conflict.
const assert = require('node:assert/strict');
const { test } = require('node:test');
const os = require('node:os');
const fs = require('node:fs');
const path = require('node:path');
const { appendEvent, readEvents } = require('../scripts/global/baton-back-ledger.js');

function tmpDir() { return fs.mkdtempSync(path.join(os.tmpdir(), 'bbl-stress-')); }

test('G6 concurrent appends to one ticket file preserve every line (no corruption)', async () => {
  const dir = tmpDir();
  const N = 200;
  await Promise.all(Array.from({ length: N }, (_, i) => Promise.resolve().then(() =>
    appendEvent(4242, { open: i % 2 === 0, detector: `d${i}`, remediator: 'collaborator', impact: 'baton-back', cycle: i }, { dir }))));
  const evs = readEvents(4242, dir);
  assert.equal(evs.length, N); // every append landed; no interleave corruption
  evs.forEach((e) => { assert.equal(e.service, 'baton-back'); assert.equal(e.ticket, 4242); });
});

test('G6 fault injection: a throwing writeFn degrades to false, never corrupts', () => {
  let calls = 0;
  const flaky = () => { calls += 1; if (calls % 2 === 0) throw new Error('enospc'); };
  const results = Array.from({ length: 20 }, () => appendEvent(1, { open: true }, { writeFn: flaky }));
  assert.ok(results.includes(false)); // some failed
  assert.ok(results.includes(true)); // some succeeded — no throw propagated
});

test('G7 p99 append latency stays under 8ms over 300 appends', () => {
  const dir = tmpDir();
  const samples = [];
  for (let i = 0; i < 300; i += 1) {
    const start = process.hrtime.bigint();
    appendEvent(77, { open: true, detector: `d${i}`, impact: 'hold', remediator: 'manager' }, { dir });
    samples.push(Number(process.hrtime.bigint() - start) / 1e6);
  }
  samples.sort((a, b) => a - b);
  const p99 = samples[Math.floor(samples.length * 0.99)];
  assert.ok(p99 < 8, `p99 ${p99.toFixed(3)}ms exceeded 8ms budget`);
  assert.equal(readEvents(77, dir).length, 300);
});
