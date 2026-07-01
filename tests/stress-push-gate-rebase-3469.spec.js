// #3469 stress-test -- pre-push gate worktree-enumeration fallback under real git worktrees
// plus fault injection. Asserts: (G6) a rebase/cwd-churn scenario where the committed branch
// lives in a sibling worktree is authorized without a manual state patch; non-repo / garbage
// cwd never throws; (G7) p99 latency budget. Bridges to the Python hook via a driver.
// Refs #3469, #3168, #1975.
const { test, expect } = require('@playwright/test');
const path = require('path');
const os = require('os');
const fs = require('fs');
const { spawnSync } = require('child_process');

const REPO_ROOT = path.resolve(__dirname, '..');
const HOOK_DIR = path.join(REPO_ROOT, 'hooks', 'scripts');

function git(cwd, args) {
  const r = spawnSync('git', args, { cwd, encoding: 'utf8' });
  if (r.status !== 0) throw new Error(`git ${args.join(' ')}: ${r.stderr}`);
  return r.stdout;
}

// Drive any_worktree_commit_ahead(cwd) in the Python hook; returns boolean.
function anyWorktreeAhead(cwd) {
  const driver = `import sys; sys.path.insert(0, ${JSON.stringify(HOOK_DIR)}); ` +
    `import worktree_push_gate as w; print(w.any_worktree_commit_ahead(${JSON.stringify(cwd)}))`;
  const r = spawnSync('python3', ['-c', driver], { encoding: 'utf8' });
  if (r.status !== 0) throw new Error(`python: ${r.stderr}`);
  return r.stdout.trim() === 'True';
}

function makeRepoWithWorktree({ ahead }) {
  const base = fs.mkdtempSync(path.join(os.tmpdir(), 'pg3469-'));
  git(base, ['init', '-q', '-b', 'main']);
  git(base, ['config', 'user.email', 'g@t.local']);
  git(base, ['config', 'user.name', 'gate']);
  fs.writeFileSync(path.join(base, 'f.txt'), 'base\n');
  git(base, ['add', '-A']); git(base, ['commit', '-q', '-m', 'base']);
  const wt = base + '-wt';
  git(base, ['worktree', 'add', '-q', '-b', 'fix/3469-x', wt]);
  if (ahead) {
    fs.writeFileSync(path.join(wt, 'g.txt'), 'work\n');
    git(wt, ['add', '-A']); git(wt, ['commit', '-q', '-m', 'ticket work #3469']);
  }
  return { base, wt };
}

test('stress: push authorized when a sibling worktree holds a commit ahead of base', () => {
  const { base } = makeRepoWithWorktree({ ahead: true });
  try {
    // hook cwd is the "main" checkout (base); the committed branch is in the sibling worktree.
    expect(anyWorktreeAhead(base)).toBe(true);
  } finally { fs.rmSync(base, { recursive: true, force: true }); fs.rmSync(base + '-wt', { recursive: true, force: true }); }
});

test('stress: NOT authorized when no worktree has a commit ahead (anti-over-suppress)', () => {
  const { base } = makeRepoWithWorktree({ ahead: false });
  try {
    expect(anyWorktreeAhead(base)).toBe(false);
  } finally { fs.rmSync(base, { recursive: true, force: true }); fs.rmSync(base + '-wt', { recursive: true, force: true }); }
});

test('stress: chaos / fault-injection cwds never throw and fail closed', () => {
  const chaos = ['/nonexistent/path/xyz', '/tmp', '/dev/null', '/etc', '/proc'];
  for (const cwd of chaos) {
    let out;
    expect(() => { out = anyWorktreeAhead(cwd); }, `must not throw: ${cwd}`).not.toThrow();
    expect(typeof out).toBe('boolean');
    expect(out).toBe(false); // non-repo / no worktree ahead -> fail closed
  }
});

test('stress: any_worktree_commit_ahead p99 latency under 300ms', () => {
  const { base } = makeRepoWithWorktree({ ahead: true });
  try {
    const samples = [];
    for (let i = 0; i < 15; i += 1) {
      const start = Date.now();
      anyWorktreeAhead(base);
      samples.push(Date.now() - start);
    }
    samples.sort((a, b) => a - b);
    const p99 = samples[Math.floor(samples.length * 0.99)];
    console.log(`any_worktree_commit_ahead p99 latency: ${p99}ms (target <300ms)`);
    expect(p99).toBeLessThan(300);
  } finally { fs.rmSync(base, { recursive: true, force: true }); fs.rmSync(base + '-wt', { recursive: true, force: true }); }
});
