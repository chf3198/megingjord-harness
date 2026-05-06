// Target-aware sandbox launcher audit tests (#1011).
const { test, expect } = require('@playwright/test');
const path = require('path');

const AUDIT = require(path.resolve(__dirname, '..', 'scripts', 'global', 'worktree-governance-audit.js'));

const BRANCHES = [
  'sandbox/copilot',
  'sandbox/codex',
  'sandbox/claude-code',
  'origin/sandbox/codex',
];

test('default audit scope keeps every launcher branch', () => {
  expect(AUDIT.filterBranches(BRANCHES, null)).toEqual(BRANCHES);
  expect(AUDIT.parseTarget(['--json'], {})).toBe(null);
});

test('target audit scope keeps only the requested launcher', () => {
  expect(AUDIT.filterBranches(BRANCHES, 'codex')).toEqual([
    'sandbox/codex',
    'origin/sandbox/codex',
  ]);
  expect(AUDIT.parseTarget(['--target=codex'], {})).toBe('codex');
  expect(AUDIT.parseTarget(['--target', 'claude-code'], {})).toBe('claude-code');
});

test('invalid target is rejected with launcher guidance', () => {
  expect(() => AUDIT.parseTarget(['--target=other'], {})).toThrow(/copilot, codex, claude-code/);
});
