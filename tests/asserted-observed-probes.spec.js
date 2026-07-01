'use strict';
// Tests for Epic #3425 P1-c (#3430): the F6 asserted-vs-observed probe catalog, incl. the
// SQUASH-AWARE worktree probe (#3424 regression). Strategy: tdd-pyramid + stress.
// node:test + node:assert.

const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const probes = require('../scripts/global/asserted-vs-observed-probes.js');

function git(cwd, ...args) {
  return execFileSync('git', args, { cwd, encoding: 'utf8',
    env: { ...process.env, GIT_AUTHOR_NAME: 'T', GIT_AUTHOR_EMAIL: 't@t', GIT_COMMITTER_NAME: 'T', GIT_COMMITTER_EMAIL: 't@t' } });
}
function writeFile(dir, name, content) { fs.writeFileSync(path.join(dir, name), content); }

// Build a repo with: main, a SQUASH-MERGED branch (content in main, commit not reachable), and a
// genuinely-UNMERGED branch — each checked out in its own worktree.
function buildFixture() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'f6probe-'));
  const repo = path.join(root, 'repo');
  fs.mkdirSync(repo);
  git(repo, 'init', '-q', '-b', 'main');
  writeFile(repo, 'base.txt', 'base\n'); git(repo, 'add', '-A'); git(repo, 'commit', '-qm', 'base');
  // squash-merged branch
  git(repo, 'checkout', '-q', '-b', 'squashed');
  writeFile(repo, 'feature.txt', 'feature work\n'); git(repo, 'add', '-A'); git(repo, 'commit', '-qm', 'feature');
  git(repo, 'checkout', '-q', 'main');
  git(repo, 'merge', '--squash', 'squashed'); git(repo, 'commit', '-qm', 'squash-merge of squashed');
  // genuinely-unmerged branch
  git(repo, 'checkout', '-q', '-b', 'unmerged');
  writeFile(repo, 'other.txt', 'unmerged work\n'); git(repo, 'add', '-A'); git(repo, 'commit', '-qm', 'unmerged');
  git(repo, 'checkout', '-q', 'main');
  // worktrees so the branches appear in `git worktree list`
  git(repo, 'worktree', 'add', '-q', path.join(root, 'wt-squashed'), 'squashed');
  git(repo, 'worktree', 'add', '-q', path.join(root, 'wt-unmerged'), 'unmerged');
  return { root, repo };
}

test('#3424 regression: squash-merged worktree branch is NOT flagged residual (content-equivalence)', () => {
  const { root, repo } = buildFixture();
  const result = probes.worktreeResidualBranches('main', { cwd: repo });
  assert.equal(result.inconclusive, false);
  assert.ok(!result.residual.includes('squashed'), 'squash-merged branch must be treated as merged');
  assert.ok(result.residual.includes('unmerged'), 'genuinely unmerged branch must be flagged');
  fs.rmSync(root, { recursive: true, force: true });
});

test('worktreeProbe only probes a clean/none claim and yields a high-confidence contradiction', () => {
  const { root, repo } = buildFixture();
  const out = probes.worktreeProbe('worktree_residual_risk: none\n', { cwd: repo, mainRef: 'main' });
  assert.equal(out.confidence, 'high');
  assert.equal(out.contradiction, true); // the 'unmerged' branch contradicts the clean claim
  // a non-clean claim is not probed
  assert.equal(probes.worktreeProbe('worktree_residual_risk: 2 stray worktrees\n', { cwd: repo, mainRef: 'main' }), null);
  fs.rmSync(root, { recursive: true, force: true });
});

test('fail-open: probing outside a git repo yields inconclusive, never a contradiction', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'nogit-'));
  const out = probes.worktreeResidualBranches('main', { cwd: tmp });
  assert.equal(out.inconclusive, true);
  fs.rmSync(tmp, { recursive: true, force: true });
});

test('acsPassProbe flags an all-ACs-pass claim with unticked boxes (high confidence, pure text)', () => {
  const body = 'all ACs verified PASS\n- [x] AC1\n- [ ] AC2\n';
  const out = probes.acsPassProbe(body);
  assert.equal(out.contradiction, true);
  assert.equal(out.confidence, 'high');
  assert.equal(probes.acsPassProbe('all ACs verified PASS\n- [x] AC1\n- [x] AC2\n').contradiction, false);
});

test('field() reads a line-anchored artifact field', () => {
  assert.equal(probes.field('commit: abc123\n', 'commit'), 'abc123');
  assert.equal(probes.field('x: y\n', 'commit'), null);
});

test('runProbes tags F6 candidates with confidence + blocking_eligibility and redacts detail', () => {
  const out = probes.runProbes('commit: deadbeefdeadbeef\nall ACs verified PASS\n- [x] a\n- [ ] b\n', { cwd: os.tmpdir() });
  assert.ok(out.candidates.every((c) => c.class === 'F6' && c.pattern_id === probes.F6_PATTERN_ID));
  assert.ok(out.candidates.every((c) => typeof c.detail === 'string'));
  assert.ok(out.candidates.every((c) => c.confidence === 'high' ? c.blocking_eligible === true : c.blocking_eligible === false));
});

test('a body with no probeable assertions yields no candidates', () => {
  const out = probes.runProbes('## MANAGER_HANDOFF\nscope: x\n', { cwd: os.tmpdir() });
  assert.equal(out.candidates.length, 0);
});
