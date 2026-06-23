'use strict';
// Unit tests for the baton-progression continuity guardrail (#2957).
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const {
  checkBatonProgression,
  evaluate,
  emitProgressionIncident,
  STAGE_ORDER,
  INCIDENT_PATTERN_ID,
} = require('../scripts/global/baton-progression-parity.js');

// Build a comment fixture: each entry [STAGE, secondsOffset] -> {body, createdAt}.
const base = Date.parse('2026-06-22T00:00:00Z');
const mk = (entries) =>
  entries.map(([stage, offsetSec]) => ({
    body: `## ${stage}\nbody text`,
    createdAt: new Date(base + offsetSec * 1000).toISOString(),
  }));

test('ordered full chain passes', () => {
  const c = mk([
    ['MANAGER_HANDOFF', 0],
    ['COLLABORATOR_HANDOFF', 10],
    ['ADMIN_HANDOFF', 20],
    ['CONSULTANT_CLOSEOUT', 30],
  ]);
  assert.equal(checkBatonProgression(c), null);
});

test('ordered partial prefix (manager + collaborator) passes', () => {
  const c = mk([
    ['MANAGER_HANDOFF', 0],
    ['COLLABORATOR_HANDOFF', 10],
  ]);
  assert.equal(checkBatonProgression(c), null);
});

test('no artifacts yet passes (nothing to order)', () => {
  assert.equal(checkBatonProgression([{ body: 'random note', createdAt: new Date(base).toISOString() }]), null);
  assert.equal(checkBatonProgression([]), null);
});

test('skipped step (admin present, collaborator absent) is denied', () => {
  const c = mk([
    ['MANAGER_HANDOFF', 0],
    ['ADMIN_HANDOFF', 20],
  ]);
  const v = checkBatonProgression(c);
  assert.ok(v, 'expected a violation');
  assert.equal(v.rule, 'baton-progression-gap');
});

test('skipped manager (collaborator present, manager absent) is denied', () => {
  const c = mk([['COLLABORATOR_HANDOFF', 10]]);
  const v = checkBatonProgression(c);
  assert.equal(v.rule, 'baton-progression-gap');
});

test('out-of-order (collaborator predates manager) is denied', () => {
  const c = mk([
    ['MANAGER_HANDOFF', 50],
    ['COLLABORATOR_HANDOFF', 10],
  ]);
  const v = checkBatonProgression(c);
  assert.equal(v.rule, 'baton-progression-out-of-order');
});

test('latest artifact of a stage wins (re-posted manager handoff)', () => {
  const c = [
    { body: 'MANAGER_HANDOFF v1', createdAt: new Date(base + 100 * 1000).toISOString() },
    { body: 'MANAGER_HANDOFF v2', createdAt: new Date(base + 0).toISOString() },
    { body: 'COLLABORATOR_HANDOFF', createdAt: new Date(base + 50 * 1000).toISOString() },
  ];
  // latest MANAGER is at +100s, COLLAB at +50s -> collab predates latest manager -> denied
  const v = checkBatonProgression(c);
  assert.equal(v.rule, 'baton-progression-out-of-order');
});

// AC2: route-invariance — the decision MUST NOT depend on any model/route/auto-mode hint.
test('parity: evaluate() ignores route/model/auto-mode context', () => {
  const fixtures = [
    mk([['MANAGER_HANDOFF', 0], ['COLLABORATOR_HANDOFF', 10], ['ADMIN_HANDOFF', 20]]),
    mk([['MANAGER_HANDOFF', 0], ['ADMIN_HANDOFF', 20]]),
    mk([['MANAGER_HANDOFF', 50], ['COLLABORATOR_HANDOFF', 10]]),
    [],
  ];
  const contexts = [
    { route: 'auto', model: 'qwen', autoMode: true },
    { route: 'frontier', model: 'claude-opus', autoMode: false },
    { route: 'fleet', model: 'gpt-5.3-codex' },
    undefined,
  ];
  for (const f of fixtures) {
    const truth = checkBatonProgression(f);
    for (const ctx of contexts) {
      assert.deepEqual(
        evaluate(f, ctx),
        truth,
        `route/model context must not change the decision (ctx=${JSON.stringify(ctx)})`,
      );
    }
  }
});

test('emitProgressionIncident writes a v3 record and is swallow-safe', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'bpp-'));
  const incidentsPath = path.join(dir, 'incidents.jsonl');
  const ok = emitProgressionIncident({ rule: 'baton-progression-gap', detail: 'x' }, { incidentsPath, now: base });
  assert.equal(ok, true);
  const line = JSON.parse(fs.readFileSync(incidentsPath, 'utf8').trim());
  assert.equal(line.pattern_id, INCIDENT_PATTERN_ID);
  assert.equal(line.version, 3);
  assert.equal(line.rule, 'baton-progression-gap');

  // unwritable path (parent is a regular file -> ENOTDIR) returns false, never throws
  const blocker = path.join(dir, 'blocker');
  fs.writeFileSync(blocker, 'x');
  const bad = emitProgressionIncident({ rule: 'r', detail: 'd' }, { incidentsPath: path.join(blocker, 'nested', 'x.jsonl') });
  assert.equal(bad, false);
});

test('STAGE_ORDER is the canonical four-role chain', () => {
  assert.deepEqual(STAGE_ORDER, [
    'MANAGER_HANDOFF',
    'COLLABORATOR_HANDOFF',
    'ADMIN_HANDOFF',
    'CONSULTANT_CLOSEOUT',
  ]);
});
