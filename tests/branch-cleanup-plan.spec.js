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
  expect(cmds[0]).toContain('git branch -d feat/123-done');
  expect(cmds[1]).toContain('git push origin --delete feat/123-done');
});

test('classifies merged branch with no PR as merged-no-pr', () => {
  const result = planner.classify('feat/124-done', true, null);
  expect(result.state).toBe('merged-no-pr');
  expect(result.evidence).toContain('no PR found');
});

test('classifies branch with closed PR as closed-pr', () => {
  const result = planner.classify('feat/125-stale', false, { number: 77, state: 'CLOSED' });
  expect(result.state).toBe('closed-pr');
  expect(planner.commandsFor('feat/125-stale', 'closed-pr')).toEqual(['git branch -d feat/125-stale']);
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
});
