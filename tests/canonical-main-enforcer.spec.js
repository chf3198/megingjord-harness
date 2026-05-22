// Phase-1 C6 of Epic #2091 — Refs #2107.
// Unit tests for hooks/scripts/canonical_main_enforcer.py.
const { test, expect } = require('@playwright/test');
const path = require('path');
const fs = require('fs');
const os = require('os');
const { spawnSync } = require('child_process');

const REPO_ROOT = path.resolve(__dirname, '..');
const ENFORCER = path.join(REPO_ROOT, 'hooks', 'scripts', 'canonical_main_enforcer.py');

function callEnforcer(fn, ...args) {
  const driver = `import sys; sys.path.insert(0, '${path.dirname(ENFORCER)}'); ` +
    `from canonical_main_enforcer import ${fn}; ` +
    `r = ${fn}(${args.map(a => JSON.stringify(a)).join(', ')}); ` +
    `print(repr(r))`;
  const result = spawnSync('python3', ['-c', driver], { encoding: 'utf8' });
  if (result.status !== 0) throw new Error(`python error: ${result.stderr}`);
  return result.stdout.trim();
}

test('enforcer module exists', () => {
  expect(fs.existsSync(ENFORCER)).toBe(true);
});

test('is_main_checkout returns True for canonical path', () => {
  const main = path.join(os.homedir(), 'devenv-ops');
  expect(callEnforcer('is_main_checkout', main)).toBe('True');
});

test('is_main_checkout returns False for worktree paths', () => {
  expect(callEnforcer('is_main_checkout', path.join(os.homedir(), 'devenv-ops-2107'))).toBe('False');
  expect(callEnforcer('is_main_checkout', path.join(os.homedir(), 'devenv-ops-cc-1234'))).toBe('False');
  expect(callEnforcer('is_main_checkout', path.join(os.homedir(), 'devenv-ops-codex'))).toBe('False');
});

test('is_main_checkout returns False for empty + edge inputs', () => {
  expect(callEnforcer('is_main_checkout', '')).toBe('False');
  expect(callEnforcer('is_main_checkout', '/tmp')).toBe('False');
});

test('is_gitignored returns True for .env (gitignored)', () => {
  expect(callEnforcer('is_gitignored', '.env', REPO_ROOT)).toBe('True');
});

test('is_gitignored returns True for node_modules', () => {
  expect(callEnforcer('is_gitignored', 'node_modules', REPO_ROOT)).toBe('True');
});

test('is_gitignored returns False for tracked README.md', () => {
  expect(callEnforcer('is_gitignored', 'README.md', REPO_ROOT)).toBe('False');
});

test('is_gitignored returns False for empty path', () => {
  expect(callEnforcer('is_gitignored', '', REPO_ROOT)).toBe('False');
});

test('is_tracked returns True for README.md', () => {
  expect(callEnforcer('is_tracked', 'README.md', REPO_ROOT)).toBe('True');
});

test('is_tracked returns True for package.json', () => {
  expect(callEnforcer('is_tracked', 'package.json', REPO_ROOT)).toBe('True');
});

test('is_tracked returns False for .env (gitignored)', () => {
  expect(callEnforcer('is_tracked', '.env', REPO_ROOT)).toBe('False');
});

test('is_tracked returns False for non-existent path', () => {
  expect(callEnforcer('is_tracked', 'nonexistent-file-xyz123.md', REPO_ROOT)).toBe('False');
});

test('evaluate_path ALLOWS .env (gitignored, not tracked)', () => {
  const out = callEnforcer('evaluate_path', '.env', REPO_ROOT);
  expect(out).toMatch(/True/);
  expect(out).toMatch(/allowed/);
});

test('evaluate_path REJECTS README.md (tracked)', () => {
  const out = callEnforcer('evaluate_path', 'README.md', REPO_ROOT);
  expect(out).toMatch(/False/);
  expect(out).toMatch(/tracked/);
});

test('evaluate_path REJECTS untracked-and-not-ignored new file', () => {
  const out = callEnforcer('evaluate_path', 'new-untracked-file.md', REPO_ROOT);
  expect(out).toMatch(/False/);
  expect(out).toMatch(/neither gitignored nor tracked/);
});

test('evaluate_path REJECTS empty path', () => {
  const out = callEnforcer('evaluate_path', '', REPO_ROOT);
  expect(out).toMatch(/False/);
});
