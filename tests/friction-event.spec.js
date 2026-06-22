'use strict';
// tdd-pyramid unit coverage for the #3165 friction-event schema + recurrence helpers.
const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const friction = require('../scripts/global/friction-event');
const recurrence = require('../scripts/global/friction-recurrence');

function tmpFile() {
  return path.join(os.tmpdir(), `friction-${process.pid}-${Math.floor(process.hrtime()[1])}.jsonl`);
}

test('buildFrictionEvent produces a valid tier:1 v3 friction event', () => {
  const ev = friction.buildFrictionEvent('worktree-push-gate-commit-desync', {
    team: 'claude-code', runtime: 'claude-code', role: 'admin', surface: 'pretool_guard.py',
    severity: 'medium', workaround: 'gh api DELETE ref',
  }, '2026-06-21T00:00:00Z');
  assert.strictEqual(ev.event, friction.FRICTION_EVENT);
  assert.strictEqual(ev.tier, 1);
  assert.strictEqual(ev.version, 3);
  assert.strictEqual(ev.pattern_id, 'worktree-push-gate-commit-desync');
  assert.strictEqual(ev.severity, 'medium');
  assert.ok(friction.isValidFriction(ev).ok);
});

test('buildFrictionEvent defaults an unknown severity to low', () => {
  const ev = friction.buildFrictionEvent('p', { severity: 'bogus' });
  assert.strictEqual(ev.severity, 'low');
});

test('isValidFriction rejects non-friction / non-tier:1 / missing pattern_id', () => {
  assert.ok(!friction.isValidFriction({ event: 'other', tier: 1, pattern_id: 'x', severity: 'low' }).ok);
  assert.ok(!friction.isValidFriction({ event: friction.FRICTION_EVENT, tier: 2, pattern_id: 'x', severity: 'low' }).ok);
  assert.ok(!friction.isValidFriction({ event: friction.FRICTION_EVENT, tier: 1, severity: 'low' }).ok);
});

test('emitFriction appends a redacted event and redacts secrets', () => {
  const file = tmpFile();
  try {
    const ev = friction.emitFriction('fleet-32b-timeout', {
      team: 'cursor', severity: 'medium', detail: 'token sk-ant-0123456789012345678901234567890123 leaked',
    }, { file });
    assert.ok(!ev.detail.includes('sk-ant-0123456789'), 'secret should be redacted');
    const lines = fs.readFileSync(file, 'utf8').trim().split('\n');
    assert.strictEqual(lines.length, 1);
    const parsed = JSON.parse(lines[0]);
    assert.strictEqual(parsed.pattern_id, 'fleet-32b-timeout');
    assert.strictEqual(parsed.tier, 1);
  } finally {
    fs.rmSync(file, { force: true });
  }
});

test('frictionRecurrenceCandidates qualifies a pattern at count >= 2', () => {
  const events = [
    friction.buildFrictionEvent('p1', { team: 'claude-code', severity: 'low' }),
    friction.buildFrictionEvent('p1', { team: 'claude-code', severity: 'low' }),
    friction.buildFrictionEvent('p2', { team: 'claude-code', severity: 'low' }),
  ];
  const cands = recurrence.frictionRecurrenceCandidates(events);
  const p1 = cands.find((c) => c.pattern_id === 'p1');
  assert.ok(p1, 'p1 should be a candidate (count 2)');
  assert.ok(!cands.find((c) => c.pattern_id === 'p2'), 'p2 (count 1, one team) should not qualify');
});

test('cross-team weighting: a pattern across >= 2 teams is bumped one severity level', () => {
  const events = [
    friction.buildFrictionEvent('preflight-full-suite', { team: 'cursor', severity: 'low' }),
    friction.buildFrictionEvent('preflight-full-suite', { team: 'claude-code', severity: 'low' }),
  ];
  const cands = recurrence.frictionRecurrenceCandidates(events);
  const c = cands.find((x) => x.pattern_id === 'preflight-full-suite');
  assert.strictEqual(c.distinct_teams, 2);
  assert.strictEqual(c.cross_team_weighted, true);
  assert.strictEqual(c.severity, 'high'); // base medium (count 2) bumped to high
});

test('applyFrictionCrossTeamWeighting only touches friction candidates with >= 2 teams', () => {
  const events = [
    friction.buildFrictionEvent('p1', { team: 'cursor' }),
    friction.buildFrictionEvent('p1', { team: 'claude-code' }),
    { event: 'governance.other', pattern_id: 'non-friction', team: 'cursor' },
  ];
  const candidates = [
    { pattern_id: 'p1', severity: 'medium' },
    { pattern_id: 'non-friction', severity: 'medium' },
  ];
  const out = recurrence.applyFrictionCrossTeamWeighting(candidates, events);
  assert.strictEqual(out[0].severity, 'high');
  assert.strictEqual(out[0].cross_team_weighted, true);
  assert.strictEqual(out[1].severity, 'medium'); // non-friction untouched
  assert.strictEqual(out[1].cross_team_weighted, undefined);
});

test('seed catalog loads and contains the confirmed pattern_ids', () => {
  const catalog = friction.loadFrictionCatalog();
  for (const id of ['preflight-full-suite', 'fleet-32b-timeout',
    'worktree-push-gate-commit-desync', 'closeout-pre-push-chicken-egg']) {
    assert.ok(friction.isKnownPattern(id, catalog), `catalog should contain ${id}`);
  }
  assert.ok(!friction.isKnownPattern('not-a-real-pattern', catalog));
});
