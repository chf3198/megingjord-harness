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
test('detectAdminBypass: merged without review approval → true', () => {
  assert.strictEqual(ame.detectAdminBypass({ merged: true, requiredChecksAllGreen: true, reviewApproved: false }), true);
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
