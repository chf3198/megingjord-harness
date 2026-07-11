'use strict';
// #3058: Regression anchor — merge-before-handoff predicate (Epic #3051).
// Three scenarios: (a) green+reviewed(>=93) unmerged → blocked;
// (b) after merge → passes; (c) red-CI → NOT forced to merge.

const { test, describe } = require('node:test');
const assert = require('node:assert');
const path = require('path');
const { validate } = require(path.join(__dirname, '..', 'scripts', 'global',
  'megalint', 'admin-handoff.js'));

// Shared fixtures — independence uses a cross_family_receipt to satisfy
// the #3672 hardened independence gate (advisory at posting time).
const collabBody = `## COLLABORATOR_HANDOFF
Signed-by: Soren Harper
Team&Model: copilot:claude-sonnet-4-6@github
Role: collaborator
cross_family_reviewer: qwen2.5-coder:7b@fleet-tailscale
cross_family_rating: 82/100
cross_family_findings: ok`;

function adminBody(rating) {
  return `## ADMIN_HANDOFF
Signed-by: Orla Reyes
Team&Model: claude-code:claude-sonnet-4-6@anthropic
Role: admin
reviewer_family_verified: pass
cross_family_receipt: f13dab455194e746
admin_review_rating: ${rating}
worktree_cleanup: stale-safe`;
}

function makeInput(opts = {}) {
  const aBody = opts.adminBody || adminBody(opts.rating || 95);
  return {
    lane: 'lane:code-change',
    comments: [
      { body: collabBody, user: { login: 'harper' } },
      { body: aBody, user: { login: 'reyes' } },
    ],
    labels: [],
    issueNumber: 3053,
    facts: opts.facts || {},
  };
}

describe('merge-before-handoff predicate (#3053/#3058)', () => {

  test('(a) green + reviewed(>=93) + unmerged → BLOCKED', () => {
    const input = makeInput({
      rating: 95,
      facts: { ciGreen: true, prMerged: false },
    });
    const r = validate(input);
    const rules = r.violations.map(v => v.rule);
    assert.ok(rules.includes('admin-handoff-without-merge'),
      `Expected admin-handoff-without-merge; got: ${rules.join(', ')}`);
    const v = r.violations.find(v => v.rule === 'admin-handoff-without-merge');
    assert.notStrictEqual(v.severity, 'advisory',
      'Should be BLOCKING when facts are available');
    assert.ok(!r.ok, 'validate should fail');
  });

  test('(b) green + reviewed(>=93) + merged → PASSES', () => {
    const input = makeInput({
      rating: 95,
      facts: { ciGreen: true, prMerged: true },
    });
    const r = validate(input);
    const mergeViolations = r.violations.filter(
      v => v.rule === 'admin-handoff-without-merge');
    assert.strictEqual(mergeViolations.length, 0,
      'No merge-precondition violation when PR is merged');
  });

  test('(c) red CI → NOT flagged (never forced to merge)', () => {
    const input = makeInput({
      rating: 95,
      facts: { ciGreen: false, prMerged: false },
    });
    const r = validate(input);
    const mergeViolations = r.violations.filter(
      v => v.rule === 'admin-handoff-without-merge');
    assert.strictEqual(mergeViolations.length, 0,
      'Red CI must NOT trigger merge-before-handoff');
  });

  test('rating below 93 → not flagged', () => {
    const input = makeInput({
      rating: 85,
      facts: { ciGreen: true, prMerged: false },
    });
    const r = validate(input);
    const mergeViolations = r.violations.filter(
      v => v.rule === 'admin-handoff-without-merge');
    assert.strictEqual(mergeViolations.length, 0,
      'Rating below threshold should not trigger merge check');
  });

  test('no rating field → not flagged', () => {
    const noRating = `## ADMIN_HANDOFF
Signed-by: Orla Reyes
Team&Model: claude-code:claude-sonnet-4-6@anthropic
Role: admin
reviewer_family_verified: pass
cross_family_receipt: f13dab455194e746
worktree_cleanup: stale-safe`;
    const input = makeInput({ adminBody: noRating,
      facts: { ciGreen: true, prMerged: false } });
    const r = validate(input);
    const mergeViolations = r.violations.filter(
      v => v.rule === 'admin-handoff-without-merge');
    assert.strictEqual(mergeViolations.length, 0);
  });

  test('offline-graceful: no facts → advisory (not blocking)', () => {
    const input = makeInput({ rating: 95, facts: {} });
    const r = validate(input);
    const v = r.violations.find(
      v => v.rule === 'admin-handoff-without-merge');
    assert.ok(v, 'Should emit advisory when facts unavailable');
    assert.strictEqual(v.severity, 'advisory');
    // The merge-precondition violation is advisory; other validators
    // (independence) may still block — we only assert merge behavior here.
    const mergeBlocking = r.violations.filter(
      v => v.rule === 'admin-handoff-without-merge' && v.severity !== 'advisory');
    assert.strictEqual(mergeBlocking.length, 0,
      'Merge-precondition must be advisory when facts unavailable');
  });

  test('lightweight lane skips entirely', () => {
    const input = makeInput({ rating: 95,
      facts: { ciGreen: true, prMerged: false } });
    input.lane = 'lane:trivial';
    const r = validate(input);
    assert.ok(r.ok, 'Trivial lane should skip all checks');
  });
});
