'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const { guard, detectStrandedWip, isGitOpInProgress } = require('../scripts/global/canonical-main-wip-guard');

test('detectStrandedWip: parses modified + untracked from porcelain', () => {
  const wip = detectStrandedWip(' M scripts/a.js\n?? scripts/new.js\nA  staged.js\n');
  assert.deepStrictEqual(wip.modified, ['scripts/a.js', 'staged.js']);
  assert.deepStrictEqual(wip.untracked, ['scripts/new.js']);
});
test('isGitOpInProgress: true when index.lock present', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'git-op-'));
  assert.strictEqual(isGitOpInProgress(dir), false);
  fs.writeFileSync(path.join(dir, 'index.lock'), '');
  assert.strictEqual(isGitOpInProgress(dir), true);
  fs.rmSync(dir, { recursive: true, force: true });
});
test('guard: skip when not on main', () => {
  assert.strictEqual(guard('/x', { branch: 'feat/1-x' }).action, 'skip-not-main');
});
test('guard: skip when a git op is in progress', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'guard-op-'));
  fs.mkdirSync(path.join(dir, '.git'));
  fs.writeFileSync(path.join(dir, '.git', 'MERGE_HEAD'), '');
  assert.strictEqual(guard(dir, { branch: 'main' }).action, 'skip-git-op');
  fs.rmSync(dir, { recursive: true, force: true });
});
test('guard: clean tree on main → action clean', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'guard-clean-'));
  fs.mkdirSync(path.join(dir, '.git'));
  assert.strictEqual(guard(dir, { branch: 'main', porcelain: '' }).action, 'clean');
  fs.rmSync(dir, { recursive: true, force: true });
});
test('guard enforce: quarantines stranded WIP + restores main clean (integration)', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'guard-enforce-'));
  const g = (...a) => execFileSync('git', a, { cwd: dir });
  g('init', '-q'); g('config', 'user.email', 't@t'); g('config', 'user.name', 't'); g('checkout', '-q', '-b', 'main');
  fs.writeFileSync(path.join(dir, 'tracked.js'), 'v1\n'); g('add', 'tracked.js'); g('commit', '-qm', 'init');
  fs.writeFileSync(path.join(dir, 'tracked.js'), 'v2-foreign\n');       // modified
  fs.writeFileSync(path.join(dir, 'untracked.js'), 'stranded\n');        // untracked
  const res = guard(dir, { branch: 'main', enforce: true, stamp: 'test' });
  assert.strictEqual(res.action, 'quarantined');
  assert.ok(fs.existsSync(res.backup.manifestPath));
  assert.strictEqual(execFileSync('git', ['status', '--porcelain'], { cwd: dir, encoding: 'utf8' }).trim(), '', 'main clean after enforce');
  assert.strictEqual(fs.readFileSync(path.join(dir, 'tracked.js'), 'utf8'), 'v1\n', 'tracked reverted');
  assert.strictEqual(fs.existsSync(path.join(dir, 'untracked.js')), false, 'untracked removed');
  fs.rmSync(dir, { recursive: true, force: true });
});
