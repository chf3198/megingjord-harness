'use strict';
// stress-test (G6 fault-injection + G7 p99 budget) for inbound-reference-integrity
// (#3419). Adversarial inbound-ref corpus: regex-hostile bodies, huge inputs,
// malformed items — the scanner must never crash and must stay within budget.
const assert = require('node:assert/strict');
const { test } = require('node:test');
const lib = require('../scripts/global/inbound-reference-integrity.js');

// G6 chaos / fault-injection: malformed, hostile, and pathological inputs.
test('chaos: scanner never throws on adversarial / malformed corpus', () => {
  const hostile = [
    null, undefined, {}, { number: 'x', text: 42 }, { number: 1 },
    { number: 2, text: '#'.repeat(50000) },
    { number: 3, text: 'merge into #3419'.repeat(5000) },
    { number: 4, text: '(((|||\\\\[[[***$$$ merge   into   #3419 \n blocked  by  #3419' },
    { number: 5, text: 'ReDoS bait: ' + 'a '.repeat(20000) + 'blocked by #3419' },
    { number: 3419, text: 'self merge into #3419' },
  ];
  let out;
  assert.doesNotThrow(() => { out = lib.scanInbound(3419, hostile); });
  assert.ok(Array.isArray(out));
  assert.ok(!out.some((o) => o.from === 3419), 'self still excluded under chaos');
  assert.ok(out.some((o) => o.from === 4), 'still detects amid hostile punctuation');
  // degraded builders must not throw either
  assert.doesNotThrow(() => lib.buildCorrectionTask(3419, out));
  assert.doesNotThrow(() => lib.buildIncident(3419, out, '2026-07-09T00:00:00Z', 'test'));
});

// G7 p99 latency budget: 2000-issue backlog scanned well under budget.
test('p99: scan of a 2000-issue backlog stays within the latency budget', () => {
  const big = [];
  for (let i = 0; i < 2000; i += 1) {
    big.push({ number: i + 100, text: `ticket ${i} body with some #${1000 + i} refs and prose`.repeat(20) });
  }
  big.push({ number: 5000, text: 'blocked by #3419' });
  const samples = [];
  for (let run = 0; run < 20; run += 1) {
    const t0 = process.hrtime.bigint();
    const out = lib.scanInbound(3419, big);
    const ms = Number(process.hrtime.bigint() - t0) / 1e6;
    samples.push(ms);
    assert.equal(out.length, 1);
  }
  samples.sort((a, b) => a - b);
  const p99 = samples[Math.min(samples.length - 1, Math.floor(0.99 * samples.length))];
  assert.ok(p99 < 750, `p99 scan latency ${p99.toFixed(1)}ms exceeded 750ms budget`);
});
