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
  expect(() => AUDIT.parseTarget(['--target=other'], {})).toThrow(/Invalid target: other/);
  // guidance lists the SSoT runtime set (includes the previously-missing runtimes)
  expect(() => AUDIT.parseTarget(['--target=other'], {})).toThrow(/antigravity/);
  expect(() => AUDIT.parseTarget(['--target=other'], {})).toThrow(/cursor/);
});

// #3642: the sandbox allowlist is sourced from the Epic #3411 runtime-catalog
// SSoT (runtime-descriptor.listRuntimes()), not a hard-coded triple, so it can
// never drift from the team taxonomy again.
const { listRuntimes } = require(path.resolve(__dirname, '..', 'scripts', 'global', 'runtime-descriptor.js'));

test('valid-team set is sourced from the runtime-catalog SSoT', () => {
  const catalog = listRuntimes();
  expect(catalog.length).toBeGreaterThan(0);
  expect(AUDIT.validTargets).toEqual(catalog);
  // the runtimes the stale triple omitted are now first-class
  expect(AUDIT.validTargets).toContain('antigravity');
  expect(AUDIT.validTargets).toContain('cursor');
});

test('every catalog runtime is accepted as a sandbox branch; unknown names rejected', () => {
  for (const rt of listRuntimes()) {
    expect(AUDIT.sandboxRx.test(`sandbox/${rt}`)).toBe(true);
    expect(AUDIT.parseTarget([`--target=${rt}`], {})).toBe(rt);
  }
  // obviously-bad names still fail
  for (const bad of ['sandbox/foo', 'sandbox/', 'sandbox/copilot-x', 'notsandbox/cursor']) {
    expect(AUDIT.sandboxRx.test(bad)).toBe(false);
  }
});
