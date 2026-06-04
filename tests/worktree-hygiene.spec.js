'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { auditStashes, scanAbandonedWorktrees, emitAdvisories, MAX_STASHES } = require('../scripts/global/worktree-hygiene');
const { classifyBranch, lintBranchName } = require('../scripts/global/megalint/worktree-naming-advisory');

const NOW = 1_800_000_000;
test('auditStashes: <=2 fresh stashes → no advisory', () => {
  assert.strictEqual(auditStashes([`stash@{0}: x ${NOW}`, `stash@{1}: y ${NOW}`], NOW).length, 0);
});
test('auditStashes: >2 stashes → count advisory', () => {
  const a = auditStashes(['a '+NOW, 'b '+NOW, 'c '+NOW], NOW);
  assert.ok(a.some(s => /stash-count/.test(s)));
});
test('auditStashes: stash older than budget → stale advisory', () => {
  const old = NOW - 8 * 86400;
  assert.ok(auditStashes([`stash@{0}: old ${old}`], NOW).some(s => /stale stash/.test(s)));
});
test('scanAbandonedWorktrees: dir not in git worktree list → advisory', () => {
  const a = scanAbandonedWorktrees(['/home/op/devenv-ops'], ['/home/op/devenv-ops', '/home/op/devenv-ops-999']);
  assert.strictEqual(a.length, 1);
  assert.match(a[0], /devenv-ops-999/);
});
test('scanAbandonedWorktrees: all known → none', () => {
  assert.strictEqual(scanAbandonedWorktrees(['/home/op/devenv-ops'], ['/home/op/devenv-ops']).length, 0);
});
test('emitAdvisories: appends schema-v3 lines to target file', () => {
  const tmp = path.join(os.tmpdir(), `wh-test-${process.pid}.jsonl`);
  try { fs.unlinkSync(tmp); } catch { /* fresh */ }
  emitAdvisories(['adv one'], { file: tmp, ts: '2026-06-04T00:00:00Z' });
  const ev = JSON.parse(fs.readFileSync(tmp, 'utf8').trim());
  assert.strictEqual(ev.service, 'worktree-hygiene');
  assert.strictEqual(ev.event, 'hygiene-advisory');
  fs.unlinkSync(tmp);
});

test('naming: flat + namespace shapes conform; protected ok; bad → advisory (never blocks)', () => {
  assert.strictEqual(classifyBranch('fix/2075-worktree-hygiene').conforms, true);
  assert.strictEqual(classifyBranch('cc/fix/2075-worktree-hygiene').shape, 'per-team-namespace');
  assert.strictEqual(classifyBranch('main').conforms, true);
  const bad = classifyBranch('random-branch');
  assert.strictEqual(bad.conforms, false);
  assert.match(bad.advisory, /advisory only, not blocked/);
  assert.strictEqual(lintBranchName('random-branch').ok, true); // advisory never blocks
  assert.strictEqual(lintBranchName('random-branch').advisories.length, 1);
});
