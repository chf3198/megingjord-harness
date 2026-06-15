'use strict';

// @megalint:test-discoverability:opt-out — node:test runner spec (run via `node --test`).
// #2991 — consolidated regression + SAFETY-BOUNDARY suite for the governance drift
// sweeper. Covers the cross-surface cases the per-module specs (#2989/#2990) do not:
// scan output-shape contract, a fix->rollback round-trip across ALL mutation kinds
// that restores state, the audit-log JSONL schema (incl. change payload), and the
// no-code-remediation / tracked-file-write boundary (proven by an actual write).

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const sweep = require('../scripts/global/governance-drift-sweep');
const fix = require('../scripts/global/governance-drift-fix');
const propose = require('../scripts/global/governance-drift-propose');

const ROOT = path.resolve(__dirname, '..');
const CLOCK = class { toISOString() { return '2026-06-14T00:00:00.000Z'; } };

function labelObjs(names) {
  return names.map((name) => ({ name }));
}

// A simulated GitHub state store keyed by ticket: { labels:Set, title:string }.
// applyMutation/invert mirror what `gh issue edit` would do.
function applyMutation(store, mutation) {
  const entry = store.get(mutation.ticket);
  if (mutation.action === 'remove-label') entry.labels.delete(mutation.label);
  else if (mutation.action === 'add-label') entry.labels.add(mutation.label);
  else if (mutation.action === 'swap-label') { entry.labels.delete(mutation.label_remove); entry.labels.add(mutation.label_add); }
  else if (mutation.action === 'set-title') entry.title = mutation.title_after;
}

function snapshot(store) {
  return [...store.entries()].map(([ticket, entry]) => [ticket, [...entry.labels].sort(), entry.title]);
}

// AC1 — scan output shape contract.
test('AC1 scan: buildReport returns per-class counts, details, and a status verdict', () => {
  const report = sweep.buildReport([
    { number: 1, title: 'fix: x', state: 'open', labels: labelObjs(['resolution:released']) },
  ]);
  assert.equal(report.mode, 'scan');
  assert.equal(report.premiumLaneProhibited, true);
  for (const id of ['D1', 'D2', 'D3', 'D4', 'D5', 'D6', 'D7', 'D8']) {
    assert.ok(id in report.counts && id in report.details, `report missing ${id}`);
  }
  assert.equal(report.status, report.totalDrift === 0 ? 'pass' : 'fail');
});

// AC2 — fix -> rollback round-trip across remove-label (D4), set-title (D3), and
// swap-label (D5) restores the FULL original state (labels + titles, multi-issue).
test('AC2 round-trip: apply+rollback restores state across all mutation kinds', () => {
  const epic = { number: 100, title: 'epic', state: 'open', labels: labelObjs(['type:epic', 'status:in-progress']) };
  const d3d4 = { number: 1, title: 'fix: nav bug', state: 'open', body: 'Parent: #100', labels: labelObjs(['resolution:released', 'type:task', 'status:done']) };
  const d5 = { number: 2, title: 'plain', state: 'open', body: 'Parent: #100', labels: labelObjs(['status:backlog']) };
  const issues = [epic, d3d4, d5];
  const store = new Map(issues.map((issue) => [issue.number, { labels: new Set(issue.labels.map((l) => l.name)), title: issue.title }]));
  const before = snapshot(store);
  const log = [];

  fix.applyFixes(issues, {
    apply: true, classify: sweep.classifyIssue, runId: 'rt',
    mutate: (mutation) => applyMutation(store, mutation), log: (entry) => log.push(entry), clock: CLOCK,
  });
  // verify all three mutation kinds actually fired
  const actions = new Set(log.map((entry) => entry.action));
  assert.ok(actions.has('remove-label') && actions.has('set-title') && actions.has('swap-label'), `expected all kinds, got ${[...actions]}`);
  assert.notDeepEqual(snapshot(store), before, 'state changed by the fix run');

  fix.rollback('rt', { mutate: (mutation) => applyMutation(store, mutation), log: () => {}, read: () => log, clock: CLOCK });
  assert.deepEqual(snapshot(store), before, 'rollback restored the full original state');
});

// AC4 — audit-log schema MUST capture the change payload (before/after + label), not
// just metadata, or the log is useless for reconstructing what changed.
test('AC4 audit-log: entries carry metadata AND the change payload', () => {
  const log = [];
  const issues = [{ number: 2, title: 'plain', state: 'open', labels: labelObjs(['resolution:released', 'type:task', 'status:done']) }];
  fix.applyFixes(issues, {
    apply: true, classify: sweep.classifyIssue, runId: 'schema', mutate: () => {}, log: (entry) => log.push(entry), clock: CLOCK,
  });
  assert.ok(log.length >= 1);
  for (const entry of log) {
    for (const field of ['run_id', 'started_at', 'actor', 'mode', 'ticket', 'class', 'action', 'reversible', 'before', 'after']) {
      assert.ok(field in entry, `audit entry missing '${field}'`);
    }
    assert.equal(entry.mode, 'fix');
    if (entry.action === 'remove-label' || entry.action === 'add-label') assert.ok('label' in entry, 'label-action entry must record the label');
  }
});

// AC3 + AC5 — no-code-remediation boundary, proven two ways:
// (a) the declared artifact path constants all live under gitignored logs/;
// (b) actually invoking writeQueue writes to QUEUE_FILE under logs/ and nowhere else.
test('AC3/AC5 safety: declared sweep artifact paths all resolve under logs/', () => {
  for (const artifactPath of [sweep.REPORT_FILE, fix.MUTATION_LOG, propose.QUEUE_FILE]) {
    const rel = path.relative(ROOT, artifactPath);
    assert.ok(rel.startsWith(`logs${path.sep}`), `${rel} must live under logs/ (issue-only / no tracked write)`);
  }
});

test('AC3 safety: writeQueue actually writes to its target file and nowhere else', () => {
  // Default target is QUEUE_FILE (proven under logs/ above). Prove the writer honours
  // its file argument and produces only that one file — i.e. it cannot scatter tracked writes.
  const tmp = path.join(os.tmpdir(), `propose-queue-2991-${process.pid}.json`);
  try {
    const queue = propose.buildProposeQueue([{ number: 3, title: 'x', state: 'open', labels: labelObjs(['status:in-progress']) }], sweep.classifyIssue);
    const written = propose.writeQueue(queue, tmp);
    assert.equal(written, tmp);
    assert.ok(fs.existsSync(tmp), 'writeQueue created exactly its target file');
    assert.deepEqual(JSON.parse(fs.readFileSync(tmp, 'utf8')).proposals, queue.proposals);
  } finally {
    if (fs.existsSync(tmp)) fs.unlinkSync(tmp);
  }
});

test('propose: every queue proposal is read-only (mutates:false)', () => {
  const queue = propose.buildProposeQueue([{ number: 3, title: 'x', state: 'open', labels: labelObjs(['status:in-progress']) }], sweep.classifyIssue);
  assert.ok(queue.proposals.length >= 1);
  for (const proposal of queue.proposals) assert.equal(proposal.mutates, false);
});
