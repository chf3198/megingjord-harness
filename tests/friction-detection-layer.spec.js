'use strict';
// Tests for Epic #3425 detection layer (multi-close batch #3429 + #3431 + #3432).
// Strategy: tdd-pyramid (scripts/global pure-function cores). node:test + node:assert.

const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const sensors = require('../scripts/global/friction-sensors.js');
const checkpoint = require('../scripts/global/review-point-checkpoint.js');
const backstop = require('../scripts/global/anneal-decision-backstop.js');

function tmpIncidents(rows) {
  const file = path.join(os.tmpdir(), `incidents-3429-${process.pid}-${Math.floor(rows.length * 7 + 1)}.jsonl`);
  fs.writeFileSync(file, rows.map((r) => JSON.stringify(r)).join('\n') + '\n');
  return file;
}
function friction(pattern, extra = {}) {
  return { event: 'governance.friction', tier: 1, pattern_id: pattern, severity: 'low', ts: '2026-06-30T12:00:00Z', ...extra };
}

// ---------- #3431 F2 retry-counter ----------
test('F2 detectRetries fires at threshold for near-identical invocations', () => {
  const invs = [
    { tool: 'Bash', command: 'npm test' }, { tool: 'Bash', command: 'npm  test' },
    { tool: 'Bash', command: 'npm test ' }, { tool: 'Bash', command: 'ls' },
  ];
  const out = sensors.detectRetries(invs, { threshold: 3 });
  assert.equal(out.length, 1);
  assert.equal(out[0].class, 'F2');
  assert.equal(out[0].pattern_id, sensors.RETRY_PATTERN_ID);
});

test('F2 does not fire below threshold and ignores read-only tools', () => {
  assert.equal(sensors.detectRetries([{ tool: 'Bash', command: 'x' }, { tool: 'Bash', command: 'x' }], { threshold: 3 }).length, 0);
  assert.equal(sensors.detectRetries([{ tool: 'Read', command: 'x' }, { tool: 'Read', command: 'x' }, { tool: 'Read', command: 'x' }]).length, 0);
});

// ---------- #3431 F5 self-correction ----------
test('F5 detects git revert/reset/amend/discard signals', () => {
  for (const cmd of ['git revert HEAD', 'git reset --hard', 'git commit --amend', 'git stash', 'discard_changes: true']) {
    const out = sensors.detectSelfCorrection([{ tool: 'Bash', command: cmd }]);
    assert.ok(out.length >= 1, `expected F5 for: ${cmd}`);
    assert.equal(out[0].class, 'F5');
  }
});

test('F5 detects an Edit explicitly undoing a prior edit', () => {
  const out = sensors.detectSelfCorrection([{ tool: 'Edit', target: 'a.js', undoesPrior: true }]);
  assert.equal(out.length, 1);
});

// ---------- #3431 recurrence escalation ----------
test('low-sev candidate escalates to medium at 3rd same-pattern recurrence', () => {
  const file = tmpIncidents([friction('friction-retry-loop'), friction('friction-retry-loop')]);
  const cand = { pattern_id: 'friction-retry-loop', severity: 'low' };
  const out = sensors.escalateByRecurrence(cand, file);
  assert.equal(out.severity, 'medium');
  assert.equal(out.escalated, true);
  fs.unlinkSync(file);
});

test('low-sev candidate stays low below recurrence threshold', () => {
  const file = tmpIncidents([friction('friction-retry-loop')]);
  assert.equal(sensors.escalateByRecurrence({ pattern_id: 'friction-retry-loop', severity: 'low' }, file).severity, 'low');
  fs.unlinkSync(file);
});

// ---------- #3429 checkpoint ----------
test('checkpoint collects friction candidates from the feed and skips its own run-events', () => {
  const file = tmpIncidents([friction('friction-retry-loop'), friction('review-point-checkpoint'), friction('hamr-bypass-detected', { severity: 'high' })]);
  const out = checkpoint.collectCandidates({ incidentsPath: file });
  assert.equal(out.length, 2, 'self run-events excluded');
  assert.ok(out.some((c) => c.severity === 'high'));
  fs.unlinkSync(file);
});

test('checkpoint windows candidates by sinceTs', () => {
  const file = tmpIncidents([friction('old', { ts: '2026-06-01T00:00:00Z' }), friction('new', { ts: '2026-06-30T23:00:00Z' })]);
  const out = checkpoint.collectCandidates({ incidentsPath: file, sinceTs: '2026-06-15T00:00:00Z' });
  assert.deepEqual(out.map((c) => c.pattern_id), ['new']);
  fs.unlinkSync(file);
});

test('runCheckpoint surfaces candidates + injected probe candidates and tags surface', () => {
  const file = tmpIncidents([friction('friction-retry-loop')]);
  const out = checkpoint.runCheckpoint({ role: 'admin', transition: 'admin', incidentsPath: file,
    probeCandidates: [{ pattern_id: 'F6-worktree-residual', severity: 'high' }], now: '2026-06-30T23:30:00Z' });
  assert.equal(out.surface, 'review-point:admin');
  assert.equal(out.surfacedCount, 2);
  fs.unlinkSync(file);
});

test('FLAW_CAPTURE_DISABLED makes maybeRunCheckpoint a no-op (rollback)', () => {
  const saved = process.env.FLAW_CAPTURE_DISABLED;
  process.env.FLAW_CAPTURE_DISABLED = '1';
  assert.equal(checkpoint.maybeRunCheckpoint({ role: 'manager' }), null);
  if (saved === undefined) delete process.env.FLAW_CAPTURE_DISABLED; else process.env.FLAW_CAPTURE_DISABLED = saved;
});

// ---------- #3432 backstop ----------
test('backstop flags a checkpoint with no disposing artifact (crashed/bypassed baton)', () => {
  const rows = [friction('review-point-checkpoint', { surface: 'review-point:admin' })];
  const out = backstop.reconcileSurfacedVsDisposed(rows, {}); // no artifact for that surface
  assert.equal(out.length, 1);
  assert.equal(out[0].rule, 'review-point-no-artifact');
  assert.equal(out[0].severity, 'advisory');
});

test('backstop passes when the artifact disposed the surfaced candidates', () => {
  const rows = [friction('review-point-checkpoint', { surface: 'review-point:admin' })];
  const out = backstop.reconcileSurfacedVsDisposed(rows, { 'review-point:admin': '## ADMIN_HANDOFF\nflaws_recognized: none\n' });
  assert.equal(out.length, 0);
});

test('backstop maps baton artifacts in a transcript to their review-point surface', () => {
  const map = backstop.artifactsBySurfaceFromTranscript('## MANAGER_HANDOFF\nx\n## ADMIN_HANDOFF\nflaws_recognized: none\n');
  assert.ok(map['review-point:manager']);
  assert.ok(map['review-point:admin']);
});
