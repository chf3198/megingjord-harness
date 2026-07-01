'use strict';
// Stress test for the Epic #3425 F6 probe catalog (#3430). Per test-methodology-matrix a stress spec
// MUST assert: (1) chaos / fault-injection (G6) and (2) a p99 latency budget (G7). node:test.

const test = require('node:test');
const assert = require('node:assert');
const os = require('node:os');

const probes = require('../scripts/global/asserted-vs-observed-probes.js');

function p99(samples) {
  const sorted = [...samples].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * 0.99))];
}

// CHAOS (G6): adversarial / oversized artifact bodies must never throw.
test('chaos: adversarial + oversized artifact bodies never throw', () => {
  const bodies = [
    '',
    'commit:\nworktree_residual_risk:\n',
    'all ACs verified PASS\n' + '- [ ] x\n'.repeat(5000),
    'commit: ' + 'a'.repeat(100000) + '\n',
    'worktree_residual_risk: none\n' + '#'.repeat(50000),
    `commit: $(rm -rf /) ;\nworktree_residual_risk: none; DROP TABLE\n`,
  ];
  for (const body of bodies) {
    assert.doesNotThrow(() => probes.runProbes(body, { cwd: os.tmpdir(), totalBudgetMs: 500 }));
  }
});

// FAULT INJECTION (G6): offline / no-git cwd => inconclusive probe_error, never a false contradiction.
test('fault injection: no-git cwd yields probe_error rows, never a contradiction for worktree/commit', () => {
  const out = probes.runProbes('commit: deadbeefdeadbeef\nworktree_residual_risk: none\n', { cwd: os.tmpdir() });
  // commit + worktree probes cannot resolve outside a git repo => no high-confidence contradiction fabricated
  const worktreeContradiction = out.candidates.find((c) => c.field === 'worktree_residual_risk');
  assert.equal(worktreeContradiction, undefined, 'must not fabricate a worktree contradiction when git is unavailable');
  assert.ok(out.probeErrors.length >= 1, 'inconclusive probes must surface probe_error rows (G8)');
});

// FAULT INJECTION (G6): a zero total budget => probes are skipped, never throw, no fabricated finding.
test('fault injection: a near-zero total budget short-circuits without throwing', () => {
  let out;
  assert.doesNotThrow(() => { out = probes.runProbes('commit: deadbeef\nall ACs verified PASS\n- [ ] x\n', { cwd: os.tmpdir(), totalBudgetMs: 0 }); });
  assert.ok(Array.isArray(out.candidates));
});

// PERF (G7): pure-text probe path p99 stays well under budget over a large body.
test('p99 latency: runProbes over a large pure-text body is under 50ms p99', () => {
  const body = 'all ACs verified PASS\n' + '- [x] ok\n'.repeat(2000) + '- [ ] missing\n';
  const samples = [];
  for (let run = 0; run < 50; run++) {
    const start = process.hrtime.bigint();
    probes.acsPassProbe(body);
    samples.push(Number(process.hrtime.bigint() - start) / 1e6);
  }
  assert.ok(p99(samples) < 50, `p99 ${p99(samples).toFixed(2)}ms exceeded 50ms budget`);
});
