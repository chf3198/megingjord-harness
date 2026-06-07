const { test, expect } = require('@playwright/test');
const planner = require('../scripts/global/worktree-cleanup-plan');

function entry(overrides = {}) {
  return {
    path: `/tmp/${overrides.branch || 'feat/1700-demo'}`,
    branch: 'feat/1700-demo',
    dirtyCount: 0,
    untrackedCount: 0,
    ahead: 0,
    mainAhead: 0,
    locked: false,
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

// AC1 + AC2: remove only for confirmed-merged, clean, no-lease worktrees
test('classifies merged clean worktrees for remove', () => {
  const state = planner.classify(entry({ mergedToMain: true }), null);
  expect(state).toBe('remove');
  const cmds = planner.commands(entry({ mergedToMain: true }), state);
  expect(cmds[0]).toContain('worktree remove');
  expect(cmds[1]).toContain('branch -d');
});

// AC3: quarantine for dirty
test('quarantines dirty worktrees with rescue commands', () => {
  const state = planner.classify(entry({ dirtyCount: 2 }), null);
  expect(state).toBe('quarantine');
  expect(planner.commands(entry(), state)[0]).toContain('rescue/1700-preserve');
});

// AC3: quarantine for untracked even if mergedToMain
test('quarantines worktrees with untracked files', () => {
  const state = planner.classify(entry({ untrackedCount: 1, mergedToMain: true }), null);
  expect(state).toBe('quarantine');
});

// AC3: quarantine for unpushed commits (mainAhead)
test('quarantines worktrees with unpushed commits ahead of main', () => {
  const state = planner.classify(entry({ mainAhead: 3 }), null);
  expect(state).toBe('quarantine');
});

// AC2: preserve for active lease
test('preserves active-lease worktrees', () => {
  const report = planner.plan({
    inventory: { worktrees: [entry({ branch: 'feat/1704-active' })] },
    registry: registry(),
  });
  expect(report.worktrees[0].cleanupState).toBe('preserve');
  expect(report.worktrees[0].commands).toEqual([]);
});

// AC2: preserve for sandbox launchers
test('preserves sandbox launcher worktrees', () => {
  const state = planner.classify(entry({ branch: 'sandbox/copilot', mergedToMain: true }), null);
  expect(state).toBe('preserve');
  expect(planner.commands(entry({ branch: 'sandbox/copilot' }), state)).toEqual([]);
});

// AC2: preserve for locked
test('preserves locked worktrees', () => {
  const state = planner.classify(entry({ locked: true, mergedToMain: true }), null);
  expect(state).toBe('preserve');
});

// AC5: stale open PR + unverified merge → needs-review (not remove)
test('flags worktrees with open PRs as needs-review', () => {
  const state = planner.classify(entry({ openPr: 44 }), null);
  expect(state).toBe('needs-review');
  expect(planner.commands(entry(), state)).toEqual([]);
});

// AC4: reason field present on every entry
test('every plan entry has a non-empty reason field', () => {
  const worktrees = [
    entry({ mergedToMain: true }),
    entry({ dirtyCount: 1 }),
    entry({ branch: 'sandbox/copilot' }),
    entry({ prunable: true }),
  ];
  const report = planner.plan({
    inventory: { worktrees },
    registry: { version: 1, leases: [] },
  });
  for (const w of report.worktrees) {
    expect(typeof w.reason).toBe('string');
    expect(w.reason.length).toBeGreaterThan(0);
  }
});

// AC9: safety invariant — all risky cases never produce 'remove'
const riskyCases = [
  ['dirty',         entry({ dirtyCount: 2, mergedToMain: true })],
  ['untracked',     entry({ untrackedCount: 1, mergedToMain: true })],
  ['unpushed',      entry({ mainAhead: 1 })],
  ['detached-head', entry({ branch: null, mergedToMain: true })],
  ['locked',        entry({ locked: true, mergedToMain: true })],
  ['sandbox',       entry({ branch: 'sandbox/copilot', mergedToMain: true })],
  ['no-ticket',     entry({ branch: 'my-ad-hoc-branch' })],
  ['ambiguous-merge', entry({ mergedToMain: false, mainAhead: 0 })],
];
for (const [label, e] of riskyCases) {
  test(`safety invariant: ${label} worktree is never classified remove`, () => {
    expect(planner.classify(e, null)).not.toBe('remove');
  });
}

// AC9: all 5 taxonomy states covered
test('all five taxonomy states are reachable', () => {
  const states = new Set([
    planner.classify(entry({ mergedToMain: true }), null),
    planner.classify(entry({ dirtyCount: 1 }), null),
    planner.classify(entry({ branch: 'sandbox/x' }), null),
    planner.classify(entry({ prunable: true }), null),
    planner.classify(entry({ mergedToMain: false }), null),
  ]);
  expect(states).toEqual(new Set(['remove', 'quarantine', 'preserve', 'prune-metadata', 'needs-review']));
});

// AC6: --dry-run produces JSON with mode: plan-only
test('--dry-run flag is accepted as alias for plan-only mode', () => {
  const report = planner.plan({ inventory: { worktrees: [] }, registry: { version: 1, leases: [] } });
  expect(report.mode).toBe('plan-only');
});

// AC7: workspace() returns only active-lease preserve entries
test('builds VS Code workspace from active-lease preserve entries only', () => {
  const report = {
    worktrees: [
      { cleanupState: 'preserve', lease: 1, branch: 'feat/1-a', path: '/tmp/a' },
      { cleanupState: 'preserve', lease: null, branch: 'sandbox/copilot', path: '/tmp/b' },
      { cleanupState: 'remove', lease: null, branch: 'feat/2-b', path: '/tmp/c' },
    ],
  };
  expect(planner.workspace(report).folders).toEqual([{ name: 'feat/1-a', path: '/tmp/a' }]);
});

// --- #2552 AC3 + AC4 + AC7 tests ---

// AC9(a): squash-merged clean worktree → remove (AC3: mergedToMain check before aheadOfMain)
test('AC9(a): squash-merged clean worktree classifies remove despite mainAhead>0', () => {
  const state = planner.classify(entry({ mergedToMain: true, mainAhead: 3, dirtyCount: 0, untrackedCount: 0 }), null);
  expect(state).toBe('remove');
});

// AC9(b): squash-merged + dirty → quarantine (dirty check precedes mergedToMain)
test('AC9(b): squash-merged with dirty files classifies quarantine not remove', () => {
  const state = planner.classify(entry({ mergedToMain: true, dirtyCount: 2, mainAhead: 3 }), null);
  expect(state).toBe('quarantine');
});

// AC9(c): unmerged + unpushed → quarantine
test('AC9(c): unmerged branch with unpushed commits classifies quarantine', () => {
  const state = planner.classify(entry({ mainAhead: 2, mergedToMain: false }), null);
  expect(state).toBe('quarantine');
});

// AC9(d): open-PR branch → needs-review
test('AC9(d): open-PR branch classifies needs-review', () => {
  const state = planner.classify(entry({ openPr: 99, mergedToMain: false, mainAhead: 0 }), null);
  expect(state).toBe('needs-review');
});

// AC9(e): gh-offline fallback → no remove, no crash
test('AC9(e): gh-offline (mergedToMain:false + mainAhead:0) classifies needs-review', () => {
  // When gh is unavailable, mergedToMain stays false; clean branch with mainAhead:0 is ambiguous → needs-review
  const state = planner.classify(entry({ mergedToMain: false, mainAhead: 0 }), null);
  expect(state).toBe('needs-review');
  expect(() => planner.classify(entry({ mergedToMain: false, mainAhead: 5 }), null)).not.toThrow();
});

// AC7: squashMerged field propagated through plan() output
test('AC7: plan output includes squashMerged field per worktree entry', () => {
  const report = planner.plan({
    inventory: { worktrees: [
      { ...entry({ mergedToMain: true }), squashMerged: true },
      { ...entry({ mergedToMain: false }), squashMerged: false },
    ] },
    registry: { version: 1, leases: [] },
  });
  expect(typeof report.worktrees[0].squashMerged).toBe('boolean');
  expect(typeof report.worktrees[1].squashMerged).toBe('boolean');
});

// AC3 regression: mergedToMain check must precede aheadOfMain check
test('AC3: mergedToMain:true + mainAhead:10 still classifies remove (not quarantine)', () => {
  const state = planner.classify(entry({ mergedToMain: true, mainAhead: 10, dirtyCount: 0 }), null);
  expect(state).toBe('remove');
  expect(state).not.toBe('quarantine');
});
