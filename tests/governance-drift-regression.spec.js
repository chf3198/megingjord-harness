'use strict';

// @megalint:test-discoverability:opt-out — node:test runner spec (run via `node --test`).
// #2991 — consolidated regression + SAFETY-BOUNDARY suite for the governance drift
// sweeper. Covers the cross-surface cases the per-module specs (#2989/#2990) do not:
// scan output-shape contract, a fix->rollback round-trip that restores state, the
// audit-log JSONL schema, and the no-code-remediation / tracked-file-write boundary.

const { test } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');

const sweep = require('../scripts/global/governance-drift-sweep');
const fix = require('../scripts/global/governance-drift-fix');
const propose = require('../scripts/global/governance-drift-propose');

const ROOT = path.resolve(__dirname, '..');
const LOGS_DIR = path.join(ROOT, 'logs');
const CLOCK = class { toISOString() { return '2026-06-14T00:00:00.000Z'; } };

function labelObjs(names) {
  return names.map((name) => ({ name }));
}

// AC1 — scan output shape contract.
test('AC1 scan: buildReport returns per-class counts, details, and a status verdict', () => {
  const issues = [
    { number: 1, title: 'fix: x', state: 'open', labels: labelObjs(['resolution:released']) }, // D3 + D4 + D1
  ];
  const report = sweep.buildReport(issues);
  assert.equal(report.mode, 'scan');
  assert.equal(report.premiumLaneProhibited, true);
  for (const id of ['D1', 'D2', 'D3', 'D4', 'D5', 'D6', 'D7', 'D8']) {
    assert.ok(id in report.counts, `counts missing ${id}`);
    assert.ok(id in report.details, `details missing ${id}`);
  }
  assert.equal(report.status, report.totalDrift === 0 ? 'pass' : 'fail');
});

// AC2 — fix -> rollback round-trip restores the original label state.
test('AC2 round-trip: applying then rolling back restores the original labels', () => {
  // simulated GitHub label store keyed by ticket
  const store = new Map([[1, new Set(['resolution:released', 'type:task', 'status:done'])]]);
  const before = new Set(store.get(1));
  const log = [];
  const applyMutate = (mutation) => {
    const labels = store.get(mutation.ticket);
    if (mutation.action === 'remove-label') labels.delete(mutation.label);
    else if (mutation.action === 'add-label') labels.add(mutation.label);
  };
  const issues = [{ number: 1, title: 'plain', state: 'open', labels: labelObjs([...before]) }];
  fix.applyFixes(issues, {
    apply: true, classify: sweep.classifyIssue, runId: 'rt', mutate: applyMutate,
    log: (entry) => log.push(entry), clock: CLOCK,
  });
  assert.ok(!store.get(1).has('resolution:released'), 'D4 fix removed the resolution label');

  fix.rollback('rt', { mutate: applyMutate, log: () => {}, read: () => log, clock: CLOCK });
  assert.deepEqual([...store.get(1)].sort(), [...before].sort(), 'rollback restored original labels');
});

// AC4 — audit-log entry schema contract.
test('AC4 audit-log: every applied entry carries the required schema fields', () => {
  const log = [];
  const issues = [{ number: 2, title: 'plain', state: 'open', labels: labelObjs(['resolution:released', 'type:task', 'status:done']) }];
  fix.applyFixes(issues, {
    apply: true, classify: sweep.classifyIssue, runId: 'schema', mutate: () => {},
    log: (entry) => log.push(entry), clock: CLOCK,
  });
  assert.ok(log.length >= 1);
  for (const entry of log) {
    for (const field of ['run_id', 'started_at', 'actor', 'mode', 'ticket', 'class', 'action', 'reversible']) {
      assert.ok(field in entry, `audit entry missing '${field}'`);
    }
    assert.equal(entry.mode, 'fix');
  }
});

// AC3 + AC5 — no-code-remediation boundary: the sweep writes ONLY to gitignored logs/,
// never a tracked source path.
test('AC3/AC5 safety: all three sweep artifact paths resolve under gitignored logs/', () => {
  for (const artifactPath of [sweep.REPORT_FILE, fix.MUTATION_LOG, propose.QUEUE_FILE]) {
    const rel = path.relative(ROOT, artifactPath);
    assert.ok(rel.startsWith(`logs${path.sep}`), `${rel} must live under logs/ (issue-only / no tracked write)`);
  }
});

test('AC3 safety: the fix + propose modules expose no tracked-file writer', () => {
  // The only filesystem writers are the log/queue appenders, both targeting logs/.
  // Neither module should export a generic file-write or a gh-mutation helper as public API
  // beyond the audited mutate path.
  assert.equal(typeof propose.writeQueue, 'function'); // writes ONLY QUEUE_FILE (asserted above)
  assert.ok(!('writeSource' in fix) && !('writeTracked' in fix));
  assert.ok(!('mutateRepo' in propose) && !('writeSource' in propose));
});

// propose surface stays read-only.
test('propose: every queue proposal is read-only (mutates:false)', () => {
  const issues = [{ number: 3, title: 'x', state: 'open', labels: labelObjs(['status:in-progress']) }];
  const queue = propose.buildProposeQueue(issues, sweep.classifyIssue);
  assert.ok(queue.proposals.length >= 1);
  for (const proposal of queue.proposals) assert.equal(proposal.mutates, false);
});
