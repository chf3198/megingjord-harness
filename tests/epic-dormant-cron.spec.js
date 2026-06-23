// epic-dormant-cron tests (#2920) — Rule E5 dormant review reminder logic.
const { test, expect } = require('@playwright/test');
const path = require('path');
const R = require(path.resolve(__dirname, '..', 'scripts', 'global', 'epic-dormant-review.js'));

const DAY_MS = 86_400_000;
const ago = (days) => new Date(Date.now() - days * DAY_MS).toISOString();

test('hasRecentReview: returns true for EPIC_REVIEW comment within window', () => {
  const comments = [{ body: 'EPIC_REVIEW: stay-dormant', created_at: ago(10) }];
  expect(R.hasRecentReview(comments, 90)).toBe(true);
});

test('hasRecentReview: returns false when EPIC_REVIEW is older than window', () => {
  const comments = [{ body: 'EPIC_REVIEW: stay-dormant', created_at: ago(100) }];
  expect(R.hasRecentReview(comments, 90)).toBe(false);
});

test('hasRecentReview: returns false with no comments', () => {
  expect(R.hasRecentReview([], 90)).toBe(false);
});

test('hasRecentReview: case-insensitive match on epic_review', () => {
  const comments = [{ body: 'epic_review: reclassify', created_at: ago(5) }];
  expect(R.hasRecentReview(comments, 90)).toBe(true);
});

test('needsDormantReview: needed=true when overdue and no review', () => {
  const result = R.needsDormantReview({
    dormantSinceIso: ago(100),
    comments: [],
    reviewAfterDays: 90,
  });
  expect(result.needed).toBe(true);
  expect(result.reason).toBe('overdue-no-review');
  expect(result.ageDays).toBeGreaterThanOrEqual(100);
});

test('needsDormantReview: needed=false when recent review exists', () => {
  const result = R.needsDormantReview({
    dormantSinceIso: ago(100),
    comments: [{ body: 'EPIC_REVIEW: stay-dormant', created_at: ago(30) }],
    reviewAfterDays: 90,
  });
  expect(result.needed).toBe(false);
  expect(result.reason).toBe('recent-review-exists');
});

test('needsDormantReview: needed=false when not yet overdue', () => {
  const result = R.needsDormantReview({
    dormantSinceIso: ago(30),
    comments: [],
    reviewAfterDays: 90,
  });
  expect(result.needed).toBe(false);
  expect(result.reason).toBe('not-overdue');
});

test('needsDormantReview: needed=false when dormantSinceIso unknown', () => {
  const result = R.needsDormantReview({ dormantSinceIso: null, comments: [], reviewAfterDays: 90 });
  expect(result.needed).toBe(false);
  expect(result.reason).toBe('dormant-since-unknown');
});

test('reviewReminderComment: contains EPIC_REVIEW and epic number', () => {
  const comment = R.reviewReminderComment(42, 95, 90);
  expect(comment).toContain('EPIC_REVIEW');
  expect(comment).toContain('#42');
  expect(comment).toContain('95 days');
  expect(comment).toContain('role:manager');
});

test('findDormantSince: returns labeledAt when provided', () => {
  const ts = ago(50);
  expect(R.findDormantSince([], ts)).toBe(ts);
});

test('findDormantSince: falls back to EPIC_AUTO_PAUSE comment timestamp', () => {
  const ts = ago(95);
  const comments = [{ body: '## EPIC_AUTO_PAUSE\n\nEpic #1 ...', created_at: ts }];
  expect(R.findDormantSince(comments, null)).toBe(ts);
});

test('findDormantSince: returns null when no EPIC_AUTO_PAUSE and no labeledAt', () => {
  expect(R.findDormantSince([{ body: 'some comment', created_at: ago(5) }], null)).toBeNull();
});

test('DEFAULT_REVIEW_DAYS defaults to 90', () => {
  delete process.env.EPIC_DORMANT_AFTER_DAYS;
  const fresh = require(path.resolve(__dirname, '..', 'scripts', 'global', 'epic-dormant-review.js'));
  expect(fresh.DEFAULT_REVIEW_DAYS).toBe(90);
});
