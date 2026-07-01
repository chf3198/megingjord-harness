'use strict';
// Stress test for Epic #3425 P1-f (#3433). A stress spec MUST assert (1) chaos / fault-injection (G6)
// and (2) a p99 latency budget (G7). node:test + node:assert.

const test = require('node:test');
const assert = require('node:assert');

const rec = require('../scripts/global/none-vs-candidate-reconciler.js');

function p99(samples) {
  const sorted = [...samples].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * 0.99))];
}

// CHAOS (G6): adversarial none-gaming inputs must never throw and must not let a high candidate pass.
test('chaos: none-gaming variants never throw and a high candidate still triggers a violation', () => {
  const gaming = [
    'flaws_recognized: none',
    'flaws_recognized:   none   ',
    'flaws_recognized: NONE  # nothing to see',
    'flaws_recognized: none-of-your-business',   // must NOT be read as bare none
    'FLAWS_RECOGNIZED: None',
    'flaws_recognized:\n  none',
  ];
  for (const line of gaming) {
    const body = `## ADMIN_HANDOFF\n${line}\nSigned-by: x`;
    let out;
    assert.doesNotThrow(() => { out = rec.reconcile({ body, candidates: [{ pattern_id: 'p', severity: 'high' }] }); });
    // 'none-of-your-business' is NOT a bare none -> treated as a disposed/other value (pass),
    // every genuine bare-none MUST yield a violation against the high candidate.
    if (/none-of-your-business/.test(line)) assert.equal(out.status, 'pass');
    else assert.equal(out.status, 'violation', `bare none must be a violation for: ${line}`);
  }
});

test('chaos: malformed candidate objects never throw', () => {
  const body = '## ADMIN_HANDOFF\nflaws_recognized: none\n';
  assert.doesNotThrow(() => rec.reconcile({ body, candidates: [null, {}, { severity: 'weird' }, { pattern_id: 42 }] }));
});

// PERF (G7): reconciling a none against a huge candidate feed stays under budget.
test('p99 latency: reconcile over a 10k-candidate feed is under 100ms p99', () => {
  const body = '## ADMIN_HANDOFF\nflaws_recognized: none\n';
  const candidates = [];
  for (let i = 0; i < 10000; i++) candidates.push({ pattern_id: `p${i % 100}`, severity: i % 3 === 0 ? 'high' : 'low' });
  const samples = [];
  for (let run = 0; run < 30; run++) {
    const start = process.hrtime.bigint();
    rec.reconcile({ body, candidates, incidentsPath: '/no/such/file' });
    samples.push(Number(process.hrtime.bigint() - start) / 1e6);
  }
  assert.ok(p99(samples) < 100, `p99 ${p99(samples).toFixed(2)}ms exceeded 100ms budget`);
});
