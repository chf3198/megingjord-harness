'use strict';
// Tests for worktree-rescue.js (Refs #2253).
// Verifies: rescue state taxonomy, report emission, preserve commands,
// quarantine path, and the core safety invariant — no rescue entry ever
// produces a delete/remove command.

const { test, describe, it } = require('node:test');
const assert = require('node:assert/strict');
const rescue = require('../scripts/global/worktree-rescue');

function entry(overrides = {}) {
  return {
    path: '/tmp/devenv-ops-test',
    branch: overrides.branch !== undefined ? overrides.branch : 'feat/1700-demo',
    dirtyCount: 0,
    untrackedCount: 0,
    ahead: 0,
    mainAhead: 0,
    locked: false,
    mergedToMain: false,
    cleanupState: 'quarantine',
    ...overrides,
  };
}

// ── AC1: rescue sub-state taxonomy ───────────────────────────────────────────

test('classifies locked worktree as locked', () => {
  assert.equal(rescue.rescueState(entry({ locked: true })), 'locked');
});

test('classifies sandbox branch as permanent', () => {
  assert.equal(rescue.rescueState(entry({ branch: 'sandbox/copilot' })), 'permanent');
});

test('classifies null branch (detached HEAD) as detached', () => {
  assert.equal(rescue.rescueState(entry({ branch: null })), 'detached');
});

test('classifies branch without ticket number as missing-ticket', () => {
  assert.equal(rescue.rescueState(entry({ branch: 'my-ad-hoc-feature' })), 'missing-ticket');
});

test('classifies dirty worktree (dirtyCount > 0) as dirty', () => {
  assert.equal(rescue.rescueState(entry({ dirtyCount: 3 })), 'dirty');
});

test('classifies untracked worktree (untrackedCount > 0) as untracked', () => {
  assert.equal(rescue.rescueState(entry({ untrackedCount: 2 })), 'untracked');
});

test('classifies worktree with unpushed commits as unpushed', () => {
  assert.equal(rescue.rescueState(entry({ mainAhead: 5 })), 'unpushed');
});

test('classifies ambiguous clean worktree as unknown', () => {
  assert.equal(rescue.rescueState(entry({ mergedToMain: false, mainAhead: 0 })), 'unknown');
});

// ── AC2: rescue report fields ─────────────────────────────────────────────────

test('rescue entry includes required report fields', () => {
  const e = rescue.rescueEntry(entry({ dirtyCount: 1 }));
  assert.ok(typeof e.rescueState === 'string');
  assert.ok(typeof e.riskReason === 'string' && e.riskReason.length > 0);
  assert.ok(typeof e.nextAction === 'string' && e.nextAction.length > 0);
  assert.ok(typeof e.requiresUAT === 'boolean');
  assert.ok(Array.isArray(e.preserveCommands));
  assert.equal(e.ticket, 1700);
});

test('rescue entry infers ticket from branch name', () => {
  assert.equal(rescue.rescueEntry(entry({ branch: 'feat/9999-x' })).ticket, 9999);
  assert.equal(rescue.rescueEntry(entry({ branch: 'my-branch' })).ticket, null);
});

test('rescueReport includes generatedAt, mode, and requiresUAT fields', () => {
  const report = rescue.rescueReport([entry({ dirtyCount: 1 })]);
  assert.ok(typeof report.generatedAt === 'string');
  assert.equal(report.mode, 'rescue-report');
  assert.ok(typeof report.requiresUAT === 'boolean');
  assert.ok(Array.isArray(report.entries));
});

test('rescueReport flags requiresUAT true when any entry needs it', () => {
  const entries = [
    entry({ branch: null }),           // detached → requiresUAT: true
    entry({ dirtyCount: 1 }),          // dirty → requiresUAT: false
  ];
  const report = rescue.rescueReport(entries);
  assert.equal(report.requiresUAT, true);
});

// ── AC3: preserve commands — non-destructive only ────────────────────────────

test('dirty worktree preserve commands reference rescue/ branch, not deletion', () => {
  const e = rescue.rescueEntry(entry({ dirtyCount: 2 }));
  assert.ok(e.preserveCommands.length > 0);
  for (const cmd of e.preserveCommands) {
    assert.ok(!cmd.includes('worktree remove'), `unexpected remove cmd: ${cmd}`);
    assert.ok(!cmd.includes('branch -d'), `unexpected delete cmd: ${cmd}`);
  }
  assert.ok(e.preserveCommands.some(cmd => cmd.includes('rescue/')));
});

test('unpushed worktree preserve commands push to rescue/ ref', () => {
  const e = rescue.rescueEntry(entry({ mainAhead: 3 }));
  assert.ok(e.preserveCommands.some(cmd => cmd.includes('rescue/')));
  assert.ok(e.preserveCommands.every(cmd => !cmd.includes('branch -D') && !cmd.includes('worktree remove')));
});

test('locked and permanent worktrees have empty preserve commands (no action needed)', () => {
  assert.deepEqual(rescue.rescueEntry(entry({ locked: true })).preserveCommands, []);
  assert.deepEqual(rescue.rescueEntry(entry({ branch: 'sandbox/codex' })).preserveCommands, []);
});

// ── AC4: quarantine path for detached/abandoned ───────────────────────────────

test('quarantinePath returns a quarantine branch name', () => {
  const q = rescue.quarantinePath(entry({ branch: null }));
  assert.ok(q.branch.startsWith('quarantine/'));
  assert.ok(typeof q.reconciliationNote === 'string' && q.reconciliationNote.length > 0);
  assert.ok(Array.isArray(q.commands) && q.commands.length > 0);
});

test('quarantinePath uses ticket number when available', () => {
  const q = rescue.quarantinePath(entry({ branch: 'feat/42-feature' }));
  assert.ok(q.branch.includes('42'), `expected ticket 42 in ${q.branch}`);
});

test('quarantinePath uses unknown for detached HEAD', () => {
  const q = rescue.quarantinePath(entry({ branch: null }));
  assert.ok(q.branch.includes('unknown'));
});

// ── AC5: safety invariant — rescue candidates are NEVER auto-deleted ──────────

const allRescueInputs = [
  ['dirty',          entry({ dirtyCount: 2 })],
  ['untracked',      entry({ untrackedCount: 1 })],
  ['unpushed',       entry({ mainAhead: 4 })],
  ['detached',       entry({ branch: null })],
  ['locked',         entry({ locked: true })],
  ['permanent',      entry({ branch: 'sandbox/copilot' })],
  ['missing-ticket', entry({ branch: 'ad-hoc-branch' })],
  ['unknown',        entry({ mergedToMain: false, mainAhead: 0 })],
];

for (const [label, e] of allRescueInputs) {
  test(`safety invariant: ${label} worktree preserve commands never contain delete/remove`, () => {
    const r = rescue.rescueEntry(e);
    for (const cmd of r.preserveCommands) {
      assert.ok(!cmd.includes('worktree remove'), `[${label}] found 'worktree remove' in cmd`);
      assert.ok(!cmd.includes('branch -d'), `[${label}] found 'branch -d' in cmd`);
      assert.ok(!cmd.includes('branch -D'), `[${label}] found 'branch -D' in cmd`);
      assert.ok(!cmd.includes('rm -rf'), `[${label}] found 'rm -rf' in cmd`);
    }
  });
}

test('rescueReport never includes remove or prune-metadata entries', () => {
  const worktrees = [
    { ...entry({ mergedToMain: true }), cleanupState: 'remove' },
    { ...entry({ dirtyCount: 1 }),      cleanupState: 'quarantine' },
    { ...entry({ branch: 'sandbox/x' }), cleanupState: 'preserve' },
    { ...entry({ prunable: true }),     cleanupState: 'prune-metadata' },
  ];
  const report = rescue.rescueReport(worktrees);
  for (const e of report.entries) {
    assert.notEqual(e.cleanupState, 'remove');
    assert.notEqual(e.cleanupState, 'prune-metadata');
  }
});

// ── all 8 rescue states are reachable ────────────────────────────────────────
test('all 8 rescue sub-states are reachable', () => {
  const states = new Set(allRescueInputs.map(([, e]) => rescue.rescueState(e)));
  const expected = new Set(['dirty', 'untracked', 'unpushed', 'detached', 'locked', 'permanent', 'missing-ticket', 'unknown']);
  assert.deepEqual(states, expected);
});
