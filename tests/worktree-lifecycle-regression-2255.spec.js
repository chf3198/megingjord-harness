const { test, expect } = require('@playwright/test');
const planner = require('../scripts/global/worktree-cleanup-plan');
const inventory = require('../scripts/global/worktree-inventory');
const checks = require('../scripts/global/consultant-checks-lib');

function entry(overrides = {}) {
  return {
    path: '/tmp/wt-2255', branch: 'feat/2255-demo', dirtyCount: 0,
    untrackedCount: 0, ahead: 0, mergedToMain: false, prunable: false,
    locked: false, ...overrides,
  };
}

test('#2255 AC1: clean merged linked worktrees are stale-safe and removable', () => {
  expect(inventory.classify({ branch: 'feat/2255-demo', ticket: 2255, ahead: 0, mergedToMain: true })).toBe('stale-safe');
  const state = planner.classify(entry({ mergedToMain: true }), null);
  expect(state).toBe('merged-clean');
});

test('#2255 AC2: risky or ambiguous worktrees are never auto-removable', () => {
  const cases = [
    entry({ dirtyCount: 1 }),
    entry({ untrackedCount: 1 }),
    entry({ ahead: 1 }),
    entry({ branch: undefined }),
    entry({ branch: 'feat/2255-demo', locked: true }),
    entry({ branch: 'feat/2255-demo', locked: true, lockReason: 'permanent' }),
    entry({ branch: 'feature/no-ticket', mergedToMain: true }),
    entry({ branch: 'wip/unknown', mergedToMain: true }),
  ];
  for (const wt of cases) {
    const state = planner.classify(wt, null);
    expect(state).not.toBe('merged-clean');
    expect(planner.commands(wt, state).join(' ')).not.toContain('worktree remove');
  }
});

test('#2255 AC3: prunable metadata is separated from real removal', () => {
  const wt = entry({ branch: undefined, prunable: true });
  const state = planner.classify(wt, null);
  expect(state).toBe('prune-metadata');
  expect(planner.commands(wt, state)).toEqual(['git worktree prune']);
});

test('#2255 AC4: issue-only lanes bypass branch-name gate paths', () => {
  expect(checks.isIssueOnlyLane('lane:docs-research')).toBe(true);
  expect(checks.isIssueOnlyLane('lane:trivial')).toBe(true);
  expect(checks.isIssueOnlyLane('type:epic')).toBe(true);
  expect(checks.isIssueOnlyLane('lane:code-change')).toBe(false);
});

test('#2255 AC5: planner defaults to dry-run/no-op report mode', () => {
  const report = planner.plan({ inventory: { worktrees: [entry()] }, registry: { version: 1, leases: [] } });
  expect(report.mode).toBe('plan-only');
});
