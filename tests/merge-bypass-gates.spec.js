'use strict';
const test = require('node:test');
const assert = require('node:assert');
const ame = require('../scripts/global/megalint/admin-merge-exception');
const bce = require('../scripts/global/megalint/batch-cancel-evidence');

// ---- AC1: admin-merge-exception ----
test('detectAdminBypass: not merged → false', () => {
  assert.strictEqual(ame.detectAdminBypass({ merged: false }), false);
});
test('detectAdminBypass: merged + all green + approved → false (no bypass)', () => {
  assert.strictEqual(ame.detectAdminBypass({ merged: true, requiredChecksAllGreen: true, reviewApproved: true }), false);
});
test('detectAdminBypass: merged with a non-green required check → true', () => {
  assert.strictEqual(ame.detectAdminBypass({ merged: true, requiredChecksAllGreen: false, reviewApproved: true }), true);
});
// #3347: a clean self-merge (no GitHub review approval, but review is NOT required by
// branch protection) is the normal harness path and must NOT be flagged as a bypass.
test('detectAdminBypass: merged, green, unapproved, review NOT required → false (#3347)', () => {
  assert.strictEqual(ame.detectAdminBypass({ merged: true, requiredChecksAllGreen: true, reviewApproved: false, reviewRequired: false }), false);
});
test('detectAdminBypass: merged, green, unapproved, review REQUIRED → true (#3347)', () => {
  assert.strictEqual(ame.detectAdminBypass({ merged: true, requiredChecksAllGreen: true, reviewApproved: false, reviewRequired: true }), true);
});
test('detectAdminBypass: reviewRequired omitted defaults to not-a-bypass on missing approval (#3347)', () => {
  assert.strictEqual(ame.detectAdminBypass({ merged: true, requiredChecksAllGreen: true, reviewApproved: false }), false);
});
test('computeRequiredChecksGreen: no required contexts → true (nothing to bypass) (#3347)', () => {
  assert.strictEqual(ame.computeRequiredChecksGreen([{ name: 'advisory', conclusion: 'failure' }], []), true);
});
test('computeRequiredChecksGreen: only required contexts count; red advisory ignored (#3347)', () => {
  const runs = [
    { name: 'baton-authority/merge', conclusion: 'success' },
    { name: 'merge-bypass-gates', conclusion: 'failure' },
    { name: 'prose-link-check (advisory)', conclusion: 'failure' },
  ];
  assert.strictEqual(ame.computeRequiredChecksGreen(runs, ['baton-authority/merge']), true);
});
test('computeRequiredChecksGreen: a red REQUIRED context → false (#3347)', () => {
  const runs = [{ name: 'baton-authority/merge', conclusion: 'failure' }];
  assert.strictEqual(ame.computeRequiredChecksGreen(runs, ['baton-authority/merge']), false);
});
test('hasException: label present → true', () => {
  assert.strictEqual(ame.hasException([ame.EXCEPTION_LABEL], ''), true);
});
test('hasException: BLOCKER_NOTE + bypass_reason + approver → true', () => {
  assert.strictEqual(ame.hasException([], 'BLOCKER_NOTE\nbypass_reason: ci flake\napprover: chf3198'), true);
});
test('hasException: partial BLOCKER_NOTE (missing approver) → false', () => {
  assert.strictEqual(ame.hasException([], 'BLOCKER_NOTE\nbypass_reason: x'), false);
});
test('adminMergeExceptionCheck: bypass + no exception → violation', () => {
  const r = ame.adminMergeExceptionCheck({ bypassDetected: true, labels: [], prBody: '' });
  assert.strictEqual(r.ok, false);
  assert.strictEqual(r.violations[0].rule, 'admin-merge-without-exception');
});
test('adminMergeExceptionCheck: bypass + label → ok', () => {
  assert.strictEqual(ame.adminMergeExceptionCheck({ bypassDetected: true, labels: [ame.EXCEPTION_LABEL] }).ok, true);
});
test('adminMergeExceptionCheck: no bypass → ok', () => {
  assert.strictEqual(ame.adminMergeExceptionCheck({ bypassDetected: false }).ok, true);
});
test('admin validate(): adminBypass input + no exception → violation', () => {
  assert.strictEqual(ame.validate({ adminBypass: true, labels: [], prBody: '' }).ok, false);
});

// ---- AC2: batch-cancel-evidence ----
test('parseCloses: extracts + dedups Closes/Fixes/Resolves', () => {
  assert.deepStrictEqual(bce.parseCloses('Closes #2375\nFixes #2376\nResolves #2375').sort(), [2375, 2376]);
});
test('isCancelled: resolution:cancelled / status:cancelled / not_planned → true; completed → false', () => {
  assert.strictEqual(bce.isCancelled({ labels: ['resolution:cancelled'] }), true);
  assert.strictEqual(bce.isCancelled({ labels: ['status:cancelled'] }), true);
  assert.strictEqual(bce.isCancelled({ state_reason: 'not_planned' }), true);
  assert.strictEqual(bce.isCancelled({ labels: ['status:done'] }), false);
});
test('batchCancelCheck: single issue (not multi-close) → ok', () => {
  assert.strictEqual(bce.batchCancelCheck([{ number: 1, cancelled: true, comments: [] }]).ok, true);
});
test('batchCancelCheck: multi-close, cancelled without CANCELLATION → violation', () => {
  const r = bce.batchCancelCheck([
    { number: 2375, cancelled: true, comments: [] },
    { number: 2376, cancelled: true, comments: [{ body: 'CANCELLATION: dup' }] },
  ]);
  assert.strictEqual(r.ok, false);
  assert.strictEqual(r.violations.length, 1);
  assert.match(r.violations[0].detail, /#2375/);
});
test('batchCancelCheck: multi-close, all cancelled have CANCELLATION + a completion → ok', () => {
  assert.strictEqual(bce.batchCancelCheck([
    { number: 1, cancelled: true, comments: [{ body: '## CANCELLATION: scope dropped' }] },
    { number: 2, labels: ['status:done'], comments: [] },
  ]).ok, true);
});
test('batchCancelCheck: heading-form `## CANCELLATION (reason)` (no colon) is accepted', () => {
  assert.strictEqual(bce.batchCancelCheck([
    { number: 2076, labels: ['status:cancelled'], comments: [{ body: '## CANCELLATION (Epic #2071 re-scope v3)\n\nGoal invalidated.' }] },
    { number: 2077, labels: ['status:cancelled'], comments: [{ body: '**CANCELLATION** superseded' }] },
  ]).ok, true);
});
test('batch validate(): closingIssues input', () => {
  assert.strictEqual(bce.validate({ closingIssues: [{ number: 1, cancelled: true, comments: [] }, { number: 2 }] }).ok, false);
});

// #3681 (Epic #3679): a required context with NO green run (missing / pending / never
// reported) must count as NOT green — the old filter-over-runs returned true for an absent
// context ([].every===true), so a genuine --admin bypass on a never-green check reported PASS.
test('#3681 computeRequiredChecksGreen: absent required context is NOT green', () => {
  assert.strictEqual(ame.computeRequiredChecksGreen([], ['baton-authority/merge']), false);
});
test('#3681 computeRequiredChecksGreen: pending required context is NOT green', () => {
  assert.strictEqual(ame.computeRequiredChecksGreen(
    [{ name: 'baton-authority/merge', conclusion: null }], ['baton-authority/merge']), false);
});
test('#3681 computeRequiredChecksGreen: all required contexts green → true', () => {
  assert.strictEqual(ame.computeRequiredChecksGreen(
    [{ name: 'ci', conclusion: 'success' }, { name: 'lint', conclusion: 'skipped' }], ['ci', 'lint']), true);
});
test('#3681 no false positive: no required contexts → green (nothing to bypass)', () => {
  assert.strictEqual(ame.computeRequiredChecksGreen([{ name: 'x', conclusion: 'failure' }], []), true);
});

// #3701 AC1: an excepted bypass whose approver resolves to the merging admin is a self-approval.
test('#3701 approverIsIndependent: approver == merger → NOT independent', () => {
  assert.strictEqual(ame.approverIsIndependent('BLOCKER_NOTE\napprover: Cyrus Reyes', 'Cyrus Reyes'), false);
});
test('#3701 approverIsIndependent: distinct approver → independent', () => {
  assert.strictEqual(ame.approverIsIndependent('BLOCKER_NOTE\napprover: Nia Vale', 'Cyrus Reyes'), true);
});
test('#3701 self-approved excepted bypass is BLOCKING (admin-bypass-self-approved)', () => {
  const r = ame.adminMergeExceptionCheck({
    bypassDetected: true,
    prBody: 'BLOCKER_NOTE\nbypass_reason: gate flake\napprover: Cyrus Reyes',
    mergedBy: 'Cyrus Reyes',
  });
  assert.strictEqual(r.ok, false);
  assert.ok(r.violations.map((v) => v.rule).includes('admin-bypass-self-approved'));
});
test('#3701 independent-approver excepted bypass passes (no false positive)', () => {
  const r = ame.adminMergeExceptionCheck({
    bypassDetected: true,
    prBody: 'BLOCKER_NOTE\nbypass_reason: gate flake\napprover: Nia Vale',
    mergedBy: 'Cyrus Reyes',
  });
  assert.strictEqual(r.ok, true);
});
