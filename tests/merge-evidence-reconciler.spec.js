// Tests for scripts/global/merge-evidence-reconciler.js (Epic #1486 Phase-1b, #1500).
const { test, expect } = require('@playwright/test');
const reconciler = require('../scripts/global/merge-evidence-reconciler');

const issue = (number, labels = ['status:done', 'type:task', 'lane:code-change']) => ({
  number, title: `Issue ${number}`, state: 'closed', labels,
});

test('#1500 AC2: empty input returns zero-result plan', () => {
  const plan = reconciler.reconcile([]);
  expect(plan.processed).toBe(0);
  expect(plan.violations).toHaveLength(0);
  expect(plan.skipped).toHaveLength(0);
  expect(plan.passed).toHaveLength(0);
  expect(plan.remaining).toBe(0);
});

test('#1500 AC2: items with merged PRs land in passed bucket', () => {
  const plan = reconciler.reconcile([
    { issue: issue(101), mergedPRRefs: [{ number: 901 }] },
  ]);
  expect(plan.passed).toHaveLength(1);
  expect(plan.passed[0].number).toBe(101);
  expect(plan.passed[0].mergedPRCount).toBe(1);
  expect(plan.violations).toHaveLength(0);
});

test('#1500 AC2: items without merged PRs land in violations bucket', () => {
  const plan = reconciler.reconcile([
    { issue: issue(102), mergedPRRefs: [] },
  ]);
  expect(plan.violations).toHaveLength(1);
  expect(plan.violations[0].number).toBe(102);
  expect(plan.violations[0].violations[0].rule).toBe('merge-evidence-missing');
});

test('#1500 AC3: batch-size cap defaults to 20', () => {
  const items = Array.from({ length: 50 }, (_, i) => ({
    issue: issue(200 + i), mergedPRRefs: [],
  }));
  const plan = reconciler.reconcile(items);
  expect(plan.processed).toBe(20);
  expect(plan.remaining).toBe(30);
  expect(plan.violations).toHaveLength(20);
});

test('#1500 AC3: batch-size cap is configurable via opts', () => {
  const items = Array.from({ length: 10 }, (_, i) => ({
    issue: issue(300 + i), mergedPRRefs: [],
  }));
  const plan = reconciler.reconcile(items, { batchSize: 5 });
  expect(plan.processed).toBe(5);
  expect(plan.remaining).toBe(5);
});

test('#1500 AC2: lightweight-lane items skipped (not flagged)', () => {
  const plan = reconciler.reconcile([
    { issue: issue(401, ['status:done', 'lane:docs-research']), mergedPRRefs: [] },
    { issue: issue(402, ['status:done', 'lane:trivial']), mergedPRRefs: [] },
  ]);
  expect(plan.skipped).toHaveLength(2);
  expect(plan.violations).toHaveLength(0);
  expect(plan.skipped[0].reason).toContain('lightweight-lane');
});

test('#1500 AC2: override label suppresses violation', () => {
  const plan = reconciler.reconcile([
    { issue: issue(501, ['status:done', 'type:task', 'lane:code-change',
      'merge-evidence-override:approved']), mergedPRRefs: [] },
  ]);
  expect(plan.skipped).toHaveLength(1);
  expect(plan.skipped[0].reason).toBe('override-approved');
  expect(plan.violations).toHaveLength(0);
});

test('#1500 AC2: type:epic items skipped (evaluated via children)', () => {
  const plan = reconciler.reconcile([
    { issue: issue(601, ['status:done', 'type:epic', 'lane:code-change']), mergedPRRefs: [] },
  ]);
  expect(plan.skipped[0].reason).toBe('epic-evaluated-via-children');
});

test('#1500 AC2: labels can be string array or {name} object array', () => {
  const planA = reconciler.reconcile([
    { issue: { number: 701, title: 't', state: 'closed', labels: ['status:done', 'lane:code-change'] }, mergedPRRefs: [] },
  ]);
  const planB = reconciler.reconcile([
    { issue: { number: 702, title: 't', state: 'closed', labels: [{ name: 'status:done' }, { name: 'lane:code-change' }] }, mergedPRRefs: [] },
  ]);
  expect(planA.violations).toHaveLength(1);
  expect(planB.violations).toHaveLength(1);
});

test('#1500 AC2: non-array items input throws TypeError', () => {
  expect(() => reconciler.reconcile(null)).toThrow(TypeError);
  expect(() => reconciler.reconcile('not-an-array')).toThrow(TypeError);
  expect(() => reconciler.reconcile({})).toThrow(TypeError);
});

test('#1500 AC1: buildComment includes marker + issue number + override hint', () => {
  const body = reconciler.buildComment({ number: 1500 });
  expect(body).toContain(reconciler.COMMENT_MARKER);
  expect(body).toContain('#1500');
  expect(body).toContain('merge-evidence-override:approved');
  expect(body).toContain('Refs #1500');
  expect(body).toContain('Epic #1486');
});

test('#1500: malformed items silently skipped (no throw)', () => {
  const plan = reconciler.reconcile([null, { not_issue: true }, { issue: 'string' }]);
  expect(plan.processed).toBe(3);
  expect(plan.violations).toHaveLength(0);
  expect(plan.passed).toHaveLength(0);
});

// #2372: deferred-final form tests
test('#2372 AC3: deferred-final token in merged PR body treated as passed', () => {
  const plan = reconciler.reconcile([
    {
      issue: issue(999),
      mergedPRRefs: [{ number: 888, body: 'merge-evidence-deferred-final: #999\nRefs #999' }],
    },
  ]);
  expect(plan.passed).toHaveLength(1);
  expect(plan.violations).toHaveLength(0);
});

test('#2372 AC3: hasDeferredFinalEvidence returns false for wrong issue number', () => {
  const refs = [{ body: 'merge-evidence-deferred-final: #998' }];
  expect(reconciler.hasDeferredFinalEvidence(refs, 999)).toBe(false);
  expect(reconciler.hasDeferredFinalEvidence(refs, 998)).toBe(true);
});

test('#2372 AC3: hasDeferredFinalEvidence is case-insensitive', () => {
  const refs = [{ body: 'MERGE-EVIDENCE-DEFERRED-FINAL: #42' }];
  expect(reconciler.hasDeferredFinalEvidence(refs, 42)).toBe(true);
  expect(reconciler.hasDeferredFinalEvidence(refs, 43)).toBe(false);
});

test('#2372 AC3: empty mergedPRRefs with no body = violation (cannot detect)', () => {
  const plan = reconciler.reconcile([
    { issue: issue(888), mergedPRRefs: [] },
  ]);
  expect(plan.violations).toHaveLength(1);
});
