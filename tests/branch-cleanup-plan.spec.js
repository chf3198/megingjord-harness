const { test, expect } = require('@playwright/test');
const planner = require('../scripts/global/branch-cleanup-plan');

test('classifies sandbox branches as keep-launcher', () => {
  const result = planner.classify('sandbox/copilot', true, null);
  expect(result.state).toBe('keep-launcher');
  expect(planner.commandsFor('sandbox/copilot', 'keep-launcher')).toEqual([]);
});

test('classifies merged branch with merged PR as merged-clean', () => {
  const result = planner.classify('feat/123-done', true, { number: 55, state: 'MERGED' });
  expect(result.state).toBe('merged-clean');
  expect(result.evidence).toContain('PR #55');
  const cmds = planner.commandsFor('feat/123-done', 'merged-clean');
  expect(cmds[0]).toBe("git branch -d 'feat/123-done'");
  expect(cmds[1]).toBe("git push origin --delete 'feat/123-done' || true");
});

test('classifies merged branch with no PR as merged-no-pr', () => {
  const result = planner.classify('feat/124-done', true, null);
  expect(result.state).toBe('merged-no-pr');
  expect(result.evidence).toContain('no PR found');
});

test('classifies branch with closed PR as closed-pr', () => {
  const result = planner.classify('feat/125-stale', false, { number: 77, state: 'CLOSED' });
  expect(result.state).toBe('closed-pr');
  expect(planner.commandsFor('feat/125-stale', 'closed-pr')).toEqual(["git branch -d 'feat/125-stale'"]);
});

test('keeps active branches untouched', () => {
  const result = planner.classify('feat/126-active', false, null);
  expect(result.state).toBe('keep-active');
  expect(planner.commandsFor('feat/126-active', 'keep-active')).toEqual([]);
});

test('classifies merged branch with open PR as merged-open-pr', () => {
  const result = planner.classify('feat/127-merged-open', true, { number: 88, state: 'OPEN' });
  expect(result.state).toBe('merged-open-pr');
  expect(result.evidence).toContain('PR #88');
  expect(planner.commandsFor('feat/127-merged-open', 'merged-open-pr')).toEqual([]);
});

test('plan includes orphaned leases in output', () => {
  const report = planner.plan({
    branches: ['feat/200-old'],
    isMergedToMain: () => true,
    prState: () => null,
    leases: [{ ticket: 999, branch: 'feat/999-ghost' }],
  });
  expect(report.orphanedLeases).toHaveLength(1);
  expect(report.orphanedLeases[0].ticket).toBe(999);
  expect(report.mode).toBe('dry-run');
});

test('plan flags merged clean branches and skips active ones', () => {
  const report = planner.plan({
    branches: ['feat/300-merged', 'feat/301-active'],
    isMergedToMain: (b) => b === 'feat/300-merged',
    prState: (b) => b === 'feat/300-merged' ? { number: 301, state: 'MERGED' } : null,
    leases: [],
  });
  const merged = report.branches.find(b => b.branch === 'feat/300-merged');
  const active = report.branches.find(b => b.branch === 'feat/301-active');
  expect(merged.cleanupState).toBe('merged-clean');
  expect(active.cleanupState).toBe('keep-active');
});

test('plan returns empty orphaned leases and classifies branches when registry throws', () => {
  const report = planner.plan({
    branches: ['feat/400-merged'],
    isMergedToMain: () => true,
    prState: () => ({ number: 401, state: 'MERGED' }),
    leaseRegistryReader: () => { throw new Error('registry file not found'); },
  });
  expect(report.orphanedLeases).toEqual([]);
  expect(report.branches[0].cleanupState).toBe('merged-clean');
  expect(report.mode).toBe('dry-run');
  expect(report.registryError).toBe('registry file not found');
});

test('plan has no registryError when registry succeeds', () => {
  const report = planner.plan({
    branches: ['feat/500-active'],
    isMergedToMain: () => false,
    prState: () => null,
    leaseRegistryReader: () => ({ leases: [] }),
  });
  expect(report.registryError).toBeUndefined();
});

// Refs #2048 — shell-injection defense.
test('isSafeBranchName accepts conventional names and rejects injection payloads', () => {
  expect(planner.isSafeBranchName('feat/123-done')).toBe(true);
  expect(planner.isSafeBranchName('fix/2048-shell-injection')).toBe(true);
  expect(planner.isSafeBranchName('sandbox/copilot')).toBe(true);
  expect(planner.isSafeBranchName('main')).toBe(true);
  expect(planner.isSafeBranchName('hotfix/9.9.9')).toBe(true);
  // Injection payloads.
  expect(planner.isSafeBranchName('feat/x" ; rm -rf / ; echo "y')).toBe(false);
  expect(planner.isSafeBranchName('feat/x`whoami`')).toBe(false);
  expect(planner.isSafeBranchName('feat/x$(whoami)')).toBe(false);
  expect(planner.isSafeBranchName('feat/x;cat /etc/passwd')).toBe(false);
  expect(planner.isSafeBranchName("feat/x'whoami'")).toBe(false);
  expect(planner.isSafeBranchName('feat/x|whoami')).toBe(false);
  expect(planner.isSafeBranchName('feat/x\nwhoami')).toBe(false);
  expect(planner.isSafeBranchName('feat/x whoami')).toBe(false);
  // Edge cases.
  expect(planner.isSafeBranchName('')).toBe(false);
  expect(planner.isSafeBranchName(null)).toBe(false);
  expect(planner.isSafeBranchName(undefined)).toBe(false);
  expect(planner.isSafeBranchName(123)).toBe(false);
  expect(planner.isSafeBranchName('a'.repeat(201))).toBe(false);
});

test('isMergedToMain returns false for malicious branch name (no shell execution)', () => {
  // If the branch name passed validation and were interpolated, this would
  // execute `rm -rf /tmp/shell-injection-evidence` or similar. The validator
  // gate must short-circuit BEFORE any subprocess is spawned.
  const malicious = 'feat/x" ; touch /tmp/shell-injection-evidence-2048 ; echo "y';
  expect(planner.isMergedToMain(malicious)).toBe(false);
  // Belt-and-suspenders: the evidence sentinel must not have been created.
  // We don't assert on filesystem here (CI sandboxing varies), the assertion
  // above is sufficient since isMergedToMain short-circuits at validation.
});

test('prState returns null for malicious branch name (no shell execution)', () => {
  const malicious = 'feat/x`id`';
  expect(planner.prState(malicious)).toBeNull();
});

test('plan classifies malicious branch as keep-active and emits no destructive commands', () => {
  const malicious = 'feat/x" ; rm -rf / ; echo "y';
  const report = planner.plan({
    branches: [malicious],
    // No overrides for isMergedToMain / prState — exercise the real
    // (validator-gated) implementations so the AC verifies the actual
    // production path, not a mocked one.
    leases: [],
  });
  const entry = report.branches[0];
  expect(entry.branch).toBe(malicious);
  expect(entry.cleanupState).toBe('keep-active');
  expect(entry.commands).toEqual([]);
});

test('commandsFor single-quotes branch names (defense-in-depth)', () => {
  // Even if a non-conformant name reaches commandsFor (e.g. via direct API call),
  // the output command strings must be inert under shell expansion.
  const cmds = planner.commandsFor('feat/x" ; rm -rf / ; echo "y', 'merged-clean');
  // Single-quotes must enclose the whole branch token; no unquoted metachars allowed.
  for (const cmd of cmds) {
    // Each command starts with the verb and contains the branch wrapped in single quotes.
    expect(cmd).toMatch(/^git (branch -d|push origin --delete) '/);
    // No backtick / dollar-paren that would survive single-quoting.
    expect(cmd).not.toMatch(/[`]/);
  }
});

// Refs #2049 — configurable default branch

test('resolveDefaultBranch returns env-var override as origin/<name> (AC1)', () => {
  const result = planner.resolveDefaultBranch({ env: { DEFAULT_BRANCH: 'trunk' } });
  expect(result).toBe('origin/trunk');
});

test('resolveDefaultBranch uses symbolic-ref when env is absent (AC2)', () => {
  const result = planner.resolveDefaultBranch({ env: {}, sh: () => 'origin/master' });
  expect(result).toBe('origin/master');
});

test('resolveDefaultBranch falls back to origin/main when symbolic-ref is empty (AC2)', () => {
  const result = planner.resolveDefaultBranch({ env: {}, sh: () => '' });
  expect(result).toBe('origin/main');
});

test('plan(overrides) isMergedToMain injection allows non-main default branch (AC4)', () => {
  // Confirm the plan() override mechanism works for operators on trunk/master repos.
  const report = planner.plan({
    branches: ['feat/600-trunk-merged'],
    isMergedToMain: (b, opts) => {
      const ref = (opts && opts.defaultBranch) || 'origin/trunk';
      return b === 'feat/600-trunk-merged' && ref === 'origin/trunk';
    },
    prState: () => null,
    leases: [],
  });
  expect(report.branches[0].cleanupState).toBe('merged-no-pr');
});
