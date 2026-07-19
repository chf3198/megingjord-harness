'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { auditStashes, scanAbandonedWorktrees, emitAdvisories, MAX_STASHES } = require('../scripts/global/worktree-hygiene');
// Branch-naming coverage moved out with the retirement of worktree-naming-advisory (#3811, Epic
// #3807 C3); branch-name enforcement now lives solely in the blocking validate-branch-name.sh +
// branch-name.yml gates, exercised by their own specs.

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

