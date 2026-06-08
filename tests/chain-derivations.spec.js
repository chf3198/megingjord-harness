'use strict';
const { test } = require('node:test');
const assert = require('node:assert');
const path = require('path');
const cd = require(path.resolve(__dirname, '..', 'scripts', 'global', 'chain-derivations.js'));

test('active_ticket is derived from a ticket branch name', () => {
  assert.strictEqual(cd.activeTicketFromBranch('feat/2722-chain-derivations'), 2722);
  assert.strictEqual(cd.activeTicketFromBranch('fix/5-nav'), 5);
  assert.strictEqual(cd.activeTicketFromBranch('hotfix/99'), 99);
});

test('a non-ticket branch derives null (no false active_ticket)', () => {
  assert.strictEqual(cd.activeTicketFromBranch('main'), null);
  assert.strictEqual(cd.activeTicketFromBranch('feature/no-number'), null);
  assert.strictEqual(cd.activeTicketFromBranch(''), null);
});

test('admin_ops is derived from observable facts, not cache', () => {
  const ops = cd.adminOpsFromFacts({ hasCommit: true, branchPushed: true, prNumber: 2728,
    requiredChecksAllGreen: true, prMerged: true });
  assert.deepStrictEqual(ops, { commit: true, push: true, pr_create: true, ci_green: true, merge: true });
});

test('admin_ops merge is false until the PR is actually merged', () => {
  const ops = cd.adminOpsFromFacts({ hasCommit: true, prNumber: 1, requiredChecksAllGreen: false });
  assert.strictEqual(ops.merge, false);
  assert.strictEqual(ops.ci_green, false);
});

test('a closed+merged issue carrying close-without-merge is flagged for auto-clear', () => {
  const clear = cd.staleAdvisoriesToClear({ state: 'closed', merged: true,
    labels: ['type:task', cd.STALE_CLOSE_WITHOUT_MERGE] });
  assert.deepStrictEqual(clear, [cd.STALE_CLOSE_WITHOUT_MERGE]);
});

test('an open issue with the advisory is NOT cleared (only false positives)', () => {
  const clear = cd.staleAdvisoriesToClear({ state: 'open', merged: false,
    labels: [cd.STALE_CLOSE_WITHOUT_MERGE] });
  assert.deepStrictEqual(clear, []);
});
