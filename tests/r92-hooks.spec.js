// R9.2 hook automation tests (#934).
const { test, expect } = require('@playwright/test');
const path = require('path');
const fs = require('fs');
const { execSync, spawnSync } = require('child_process');

const REPO_ROOT = path.resolve(__dirname, '..');
const PRE_PUSH = path.join(REPO_ROOT, 'scripts', 'hooks', 'pre-push-branch-check.sh');
const AUDIT = path.join(REPO_ROOT, 'scripts', 'hooks', 'branch-ops-audit.sh');
const INSTALLER = path.join(REPO_ROOT, 'scripts', 'global', 'install-hooks.sh');

test('all three hook scripts exist and are executable', () => {
  for (const f of [PRE_PUSH, AUDIT, INSTALLER]) {
    expect(fs.existsSync(f)).toBe(true);
    expect(fs.statSync(f).mode & 0o100).toBeTruthy();
  }
});

test('pre-push hook exits 0 when local branch matches HEAD', () => {
  const currentBranch = execSync('git rev-parse --abbrev-ref HEAD', { cwd: REPO_ROOT }).toString().trim();
  const stdin = `refs/heads/${currentBranch} abc123 refs/heads/${currentBranch} def456\n`;
  const result = spawnSync(PRE_PUSH, [], { input: stdin, cwd: REPO_ROOT });
  expect(result.status).toBe(0);
});

test('pre-push hook exits 1 when local branch ≠ HEAD', () => {
  const stdin = 'refs/heads/some-other-branch abc123 refs/heads/some-other-branch def456\n';
  const result = spawnSync(PRE_PUSH, [], { input: stdin, cwd: REPO_ROOT });
  expect(result.status).toBe(1);
  expect(result.stdout.toString()).toContain('R9.2.1 violation');
});

// A1 fix (#989): branch-delete refspec uses all-zeros local_sha.
test('pre-push hook exits 0 on branch-delete refspec (all-zero local_sha)', () => {
  const stdin = 'refs/heads/some-other-branch 0000000000000000000000000000000000000000 refs/heads/some-other-branch deadbeef\n';
  const result = spawnSync(PRE_PUSH, [], { input: stdin, cwd: REPO_ROOT });
  expect(result.status).toBe(0);
  expect(result.stdout.toString()).not.toContain('R9.2.1 violation');
});

test('audit script writes JSON-line on post-checkout branch op', () => {
  const auditLog = path.join(process.env.HOME, '.megingjord', 'branch-ops-audit.log');
  const beforeLines = fs.existsSync(auditLog) ? fs.readFileSync(auditLog, 'utf8').split('\n').length : 0;
  spawnSync(AUDIT, ['post-checkout', 'aaa', 'bbb', '1'], { cwd: REPO_ROOT });
  const afterLines = fs.readFileSync(auditLog, 'utf8').split('\n').length;
  expect(afterLines).toBeGreaterThan(beforeLines);
  const lastLine = fs.readFileSync(auditLog, 'utf8').trim().split('\n').pop();
  const parsed = JSON.parse(lastLine);
  expect(parsed.op).toBe('post-checkout');
  expect(parsed.prev).toBe('aaa');
  expect(parsed.new).toBe('bbb');
});

test('audit script skips file-only checkouts (arg3=0)', () => {
  const auditLog = path.join(process.env.HOME, '.megingjord', 'branch-ops-audit.log');
  const before = fs.existsSync(auditLog) ? fs.readFileSync(auditLog, 'utf8') : '';
  spawnSync(AUDIT, ['post-checkout', 'aaa', 'bbb', '0'], { cwd: REPO_ROOT });
  const after = fs.readFileSync(auditLog, 'utf8');
  expect(after).toBe(before);
});

test('audit script writes post-commit record', () => {
  const auditLog = path.join(process.env.HOME, '.megingjord', 'branch-ops-audit.log');
  const beforeLines = fs.existsSync(auditLog) ? fs.readFileSync(auditLog, 'utf8').split('\n').length : 0;
  spawnSync(AUDIT, ['post-commit'], { cwd: REPO_ROOT });
  const afterLines = fs.readFileSync(auditLog, 'utf8').split('\n').length;
  expect(afterLines).toBeGreaterThan(beforeLines);
});
