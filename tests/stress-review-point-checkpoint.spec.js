'use strict';
// Stress test for the Epic #3425 detection layer (#3429 checkpoint + #3431 sensors).
// Per test-methodology-matrix, a stress spec MUST assert: (1) a chaos / fault-injection path (G6)
// and (2) a p99 latency budget (G7). node:test + node:assert.

const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const checkpoint = require('../scripts/global/review-point-checkpoint.js');
const sensors = require('../scripts/global/friction-sensors.js');

// Trojan-source / exotic chars are CONSTRUCTED from escapes, never written as literal bytes in source
// (keeps the file plain-ASCII so it is not flagged as binary and carries no bidi-override trojan risk).
const BIDI_OVERRIDE = String.fromCharCode(0x202e); // RTL override
const CTRL_BEL = String.fromCharCode(0x07);        // control char

function p99(samples) {
  const sorted = [...samples].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * 0.99))];
}

// CHAOS (G6): a feed full of malformed / adversarial rows must never throw and must skip junk.
test('chaos: checkpoint tolerates malformed + adversarial incidents rows (fault injection)', () => {
  const lines = [];
  for (let i = 0; i < 5000; i++) {
    if (i % 4 === 0) lines.push('{ this is not json');                       // malformed
    else if (i % 4 === 1) lines.push('');                                     // blank (filtered)
    else if (i % 4 === 2) lines.push(JSON.stringify({ event: 'governance.friction', tier: 1,
      pattern_id: `F${BIDI_OVERRIDE}bidi${CTRL_BEL}ctl`, severity: 'low', ts: '2026-06-30T12:00:00Z' }));
    else lines.push(JSON.stringify({ event: 'other', tier: 9 }));            // wrong event/tier
  }
  const file = path.join(os.tmpdir(), `stress-incidents-${process.pid}.jsonl`);
  fs.writeFileSync(file, lines.join('\n') + '\n');
  let out;
  assert.doesNotThrow(() => { out = checkpoint.collectCandidates({ incidentsPath: file }); });
  // only the well-formed friction rows (every 4th) survive; junk + wrong-event rows are skipped
  assert.ok(out.length > 0 && out.length <= 5000 / 4 + 1);
  assert.ok(out.every((c) => c.pattern_id && c.pattern_id !== 'review-point-checkpoint'));
  fs.unlinkSync(file);
});

test('chaos: a missing/unreadable incidents file yields [] (fail-open, never throws)', () => {
  assert.deepEqual(checkpoint.collectCandidates({ incidentsPath: '/no/such/path/incidents.jsonl' }), []);
});

// PERF (G7): p99 of collectCandidates over a large feed must stay under budget.
test('p99 latency: checkpoint candidate-collection over a large feed is under 150ms p99', () => {
  const rows = [];
  for (let i = 0; i < 20000; i++) rows.push(JSON.stringify({ event: 'governance.friction', tier: 1,
    pattern_id: `p${i % 50}`, severity: 'low', ts: '2026-06-30T12:00:00Z' }));
  const file = path.join(os.tmpdir(), `stress-perf-${process.pid}.jsonl`);
  fs.writeFileSync(file, rows.join('\n') + '\n');
  const samples = [];
  for (let run = 0; run < 50; run++) {
    const start = process.hrtime.bigint();
    checkpoint.collectCandidates({ incidentsPath: file });
    samples.push(Number(process.hrtime.bigint() - start) / 1e6);
  }
  const budgetMs = 150;
  assert.ok(p99(samples) < budgetMs, `p99 ${p99(samples).toFixed(1)}ms exceeded ${budgetMs}ms budget`);
  fs.unlinkSync(file);
});

// PERF (G7): the F2 retry detector over a large invocation window stays under budget.
test('p99 latency: F2 retry scan over 10k invocations is under 100ms p99', () => {
  const invs = [];
  for (let i = 0; i < 10000; i++) invs.push({ tool: 'Bash', command: `cmd ${i % 200}` });
  const samples = [];
  for (let run = 0; run < 30; run++) {
    const start = process.hrtime.bigint();
    sensors.detectRetries(invs, { threshold: 3 });
    samples.push(Number(process.hrtime.bigint() - start) / 1e6);
  }
  assert.ok(p99(samples) < 100, `p99 ${p99(samples).toFixed(1)}ms exceeded 100ms budget`);
});
