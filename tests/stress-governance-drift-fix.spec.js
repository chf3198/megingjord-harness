'use strict';

// @megalint:test-discoverability:opt-out — node:test runner spec (run via `node --test`).
// Stress / chaos coverage for the #2989 auto-remediation engine.
// Required by the test-methodology-matrix for state-mutating, side-effect-bearing
// gates: this spec asserts (G6) a fault-injection path AND (G7) a p99 latency budget.

const { test } = require('node:test');
const assert = require('node:assert/strict');
const { applyFixes, rollback } = require('../scripts/global/governance-drift-fix');
const { classifyIssue } = require('../scripts/global/governance-drift-sweep');

const CLOCK = class { toISOString() { return '2026-06-14T00:00:00.000Z'; } };

function openIssueWithResolution(number) {
  return { number, title: 'plain title', state: 'open', labels: [{ name: 'resolution:released' }, { name: 'type:task' }] };
}

// G6 — fault injection: a mid-batch mutate failure must (a) stop the run,
// (b) leave the JSONL log recording ONLY the mutations that actually applied,
// so a subsequent rollback is exact and never over-reverts.
test('G6 chaos: mutate failure mid-batch halts and keeps the log exact', () => {
  const issues = [1, 2, 3, 4, 5].map(openIssueWithResolution);
  const store = [];
  let callCount = 0;
  const result = applyFixes(issues, {
    apply: true,
    classify: classifyIssue,
    runId: 'chaos-run',
    mutate: () => { callCount += 1; if (callCount === 3) throw new Error('injected gh failure'); },
    log: (entry) => store.push(entry),
    clock: CLOCK,
  });

  assert.equal(result.errors.length, 1);
  assert.match(result.errors[0].error, /injected gh failure/);
  assert.equal(store.length, 2, 'only the 2 mutations before the failure are logged');

  // rollback must undo exactly the 2 applied, not all 5
  const undone = [];
  const rb = rollback('chaos-run', {
    mutate: (mutation) => undone.push(mutation),
    log: () => {},
    read: () => store,
    clock: CLOCK,
  });
  assert.equal(rb.rolledBack, 2);
  assert.ok(undone.every((mutation) => mutation.action === 'add-label'));
});

// G6 — rollback resilience: a failure during rollback also halts cleanly.
test('G6 chaos: rollback halts on inverse-mutate failure', () => {
  const store = [
    { run_id: 'r', mode: 'fix', ticket: 1, class: 'D4', action: 'remove-label', label: 'resolution:released' },
    { run_id: 'r', mode: 'fix', ticket: 2, class: 'D4', action: 'remove-label', label: 'resolution:released' },
  ];
  const rb = rollback('r', {
    mutate: () => { throw new Error('inverse failed'); },
    log: () => {},
    read: () => store,
    clock: CLOCK,
  });
  assert.equal(rb.rolledBack, 0);
  assert.equal(rb.errors.length, 1);
});

// G7 — p99 latency budget: planning over a large corpus stays well under budget.
test('G7 perf: plan 2000 issues under p99 budget (dry-run, no IO)', () => {
  const corpus = [];
  for (let index = 0; index < 2000; index += 1) corpus.push(openIssueWithResolution(index));
  const durations = [];
  for (let trial = 0; trial < 20; trial += 1) {
    const start = process.hrtime.bigint();
    applyFixes(corpus, { classify: classifyIssue, mutate: () => {}, log: () => {}, clock: CLOCK });
    durations.push(Number(process.hrtime.bigint() - start) / 1e6);
  }
  durations.sort((first, second) => first - second);
  const p99 = durations[Math.min(durations.length - 1, Math.floor(durations.length * 0.99))];
  assert.ok(p99 < 500, `p99 planning latency ${p99.toFixed(1)}ms must be < 500ms budget`);
});
