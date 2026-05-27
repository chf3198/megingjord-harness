const { test, expect } = require('@playwright/test');
const planner = require('../scripts/global/worktree-cleanup-plan');

function entry(overrides = {}) {
  return {
    path: `/tmp/${overrides.branch || 'feat/1700-demo'}`,
    branch: 'feat/1700-demo',
    dirtyCount: 0,
    ahead: 0,
    mergedToMain: false,
    prunable: false,
    ...overrides,
  };
}

function registry() {
  return {
    version: 1,
    leases: [{
      ticket: 1704,
      branch: 'feat/1704-active',
      status: 'active',
      expires_at: '2999-01-01T00:00:00.000Z',
    }],
  };
}

test('classifies merged clean worktrees for removal', () => {
  const state = planner.classify(entry({ mergedToMain: true }), null);
  expect(state).toBe('merged-clean');
  expect(planner.commands(entry({ mergedToMain: true }), state)[0]).toContain('worktree remove');
});

test('preserves dirty or unpushed work with rescue commands', () => {
  const state = planner.classify(entry({ dirtyCount: 2, ahead: 1 }), null);
  expect(state).toBe('preserve-dirty');
  expect(planner.commands(entry(), state)[0]).toContain('rescue/1700-preserve');
});

test('preserves untracked-only work with rescue commands', () => {
  const state = planner.classify(entry({ untrackedCount: 1, mergedToMain: true }), null);
  expect(state).toBe('preserve-dirty');
  expect(planner.commands(entry(), state)[0]).toContain('rescue/1700-preserve');
});

test('keeps active lease worktrees visible', () => {
  const report = planner.plan({
    inventory: { worktrees: [entry({ branch: 'feat/1704-active' })] },
    registry: registry(),
  });
  expect(report.worktrees[0].cleanupState).toBe('active-lease');
  expect(report.worktrees[0].commands).toEqual([]);
});

test('never removes sandbox launcher worktrees', () => {
  const state = planner.classify(entry({ branch: 'sandbox/copilot', mergedToMain: true }), null);
  expect(state).toBe('keep-launcher');
  expect(planner.commands(entry({ branch: 'sandbox/copilot' }), state)).toEqual([]);
});

test('flags stale open PRs for review comments', () => {
  const state = planner.classify(entry({ openPr: 44 }), null);
  expect(state).toBe('stale-open-pr');
  expect(planner.commands(entry({ openPr: 44 }), state)[0]).toBe('gh pr view 44');
});

test('builds VS Code workspace from active leases only', () => {
  const report = {
    worktrees: [
      { cleanupState: 'active-lease', branch: 'feat/1-a', path: '/tmp/a' },
      { cleanupState: 'merged-clean', branch: 'feat/2-b', path: '/tmp/b' },
    ],
  };
  expect(planner.workspace(report).folders).toEqual([{ name: 'feat/1-a', path: '/tmp/a' }]);
});
