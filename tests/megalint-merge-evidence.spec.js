// Tests for scripts/global/megalint/merge-evidence.js (Epic #1486 Phase-1a, #1498).
const { test, expect } = require('@playwright/test');
const rule = require('../scripts/global/megalint/merge-evidence');

const closedDone = (extra = []) => ({
  state: 'closed',
  labels: ['status:done', 'type:task', 'lane:code-change', ...extra],
});

test('#1498 AC1: violation fires when status:done closed with no merged PR refs', () => {
  const result = rule.validate({ ...closedDone(), mergedPRRefs: [] });
  expect(result.ok).toBe(false);
  expect(result.violations[0].rule).toBe('merge-evidence-missing');
  expect(result.violations[0].mergedPRCount).toBe(0);
});

test('#1498 AC1: passes when one or more merged PRs reference the issue', () => {
  const result = rule.validate({ ...closedDone(), mergedPRRefs: [{ number: 1493 }] });
  expect(result.ok).toBe(true);
  expect(result.violations).toHaveLength(0);
  expect(result.mergedPRCount).toBe(1);
});

test('#1498 AC1: open issue is never evaluated (no violation, marked skipped)', () => {
  const result = rule.validate({
    state: 'open', labels: ['status:in-progress', 'type:task', 'lane:code-change'],
    mergedPRRefs: [],
  });
  expect(result.ok).toBe(true);
  expect(result.skipped).toBe('open-issue');
});

test('#1498 AC4: closed type:epic skipped (Epic evaluated via children)', () => {
  const result = rule.validate({
    state: 'closed',
    labels: ['type:epic', 'status:done', 'lane:code-change'],
    mergedPRRefs: [],
  });
  expect(result.ok).toBe(true);
  expect(result.skipped).toBe('epic-evaluated-via-children');
});

test('#1498 AC4: status:cancelled skipped (goal invalidated, not delivered)', () => {
  const result = rule.validate({
    state: 'closed',
    labels: ['status:cancelled', 'type:task', 'lane:code-change'],
    mergedPRRefs: [],
  });
  expect(result.ok).toBe(true);
  expect(result.skipped).toBe('cancelled-not-delivered');
});

test('#1498: closed without status:done (other terminal) is skipped', () => {
  const result = rule.validate({
    state: 'closed', labels: ['type:task', 'lane:code-change'], mergedPRRefs: [],
  });
  expect(result.ok).toBe(true);
  expect(result.skipped).toBe('non-done-terminal');
});

test('#1498 AC5: override label suppresses the violation', () => {
  const result = rule.validate({
    ...closedDone(['merge-evidence-override:approved']),
    mergedPRRefs: [],
  });
  expect(result.ok).toBe(true);
  expect(result.skipped).toBe('override-approved');
});

test('#1498 AC3: lightweight lanes skipped (docs-research)', () => {
  const result = rule.validate({
    state: 'closed',
    labels: ['status:done', 'type:task', 'lane:docs-research'],
    mergedPRRefs: [],
  });
  expect(result.ok).toBe(true);
  expect(result.skipped).toBe('lightweight-lane:lane:docs-research');
});

test('#1498 AC3: lightweight lanes skipped (trivial, docs-only, research)', () => {
  for (const lane of ['lane:trivial', 'lane:docs-only', 'lane:research']) {
    const result = rule.validate({
      state: 'closed', labels: ['status:done', 'type:task', lane], mergedPRRefs: [],
    });
    expect(result.ok).toBe(true);
    expect(result.skipped).toBe(`lightweight-lane:${lane}`);
  }
});

test('#1498 AC2: rule registered in megalint VALIDATORS map and exposed via run()', () => {
  const megalint = require('../scripts/global/megalint');
  expect(megalint.VALIDATORS).toHaveProperty('merge-evidence');
  const result = megalint.run('merge-evidence', {
    state: 'closed',
    labels: ['status:done', 'type:task', 'lane:code-change'],
    mergedPRRefs: [],
  });
  expect(result.ok).toBe(false);
  expect(result.violations[0].rule).toBe('merge-evidence-missing');
});

test('#1498: rule integrates with runAll() — appears in aggregated results', () => {
  const megalint = require('../scripts/global/megalint');
  const result = megalint.runAll({
    state: 'closed',
    labels: ['status:done', 'type:task', 'lane:code-change'],
    body: '## Acceptance Criteria\n- [x] AC1: done',
    comments: [],
    mergedPRRefs: [{ number: 1493 }],
    issueNumber: 1498,
    ticketRef: '#1498',
  });
  expect(result.results['merge-evidence']).toBeDefined();
  expect(result.results['merge-evidence'].ok).toBe(true);
});
