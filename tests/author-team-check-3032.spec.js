'use strict';
const { test, expect } = require('@playwright/test');
const A = require('../scripts/global/megalint/author-team-check');

test('author-team match passes', () => {
  const r = A.checkComment(
    'Signed-by: X\nTeam&Model: claude-code:opus@anthropic\nRole: manager',
    'chf3198',
  );
  expect(r.ok).toBe(true);
});

test('author-team mismatch fails', () => {
  const r = A.checkComment(
    'Signed-by: X\nTeam&Model: copilot:sonnet@github-copilot\nRole: manager',
    'chf3198',
  );
  expect(r.ok).toBe(false);
  expect(r.violation.rule).toBe('author-team-mismatch');
});
