// Unit tests for scripts/global/cross-team-auto-apply.js (#1590 AC3 of #1334).
// Verifies the pure decision helper that detects Manager-authored cross-team
// closeout-request comments and gates auto-application of the
// consultant:cross-team-needed label on Epic tickets.
const { test, expect } = require('@playwright/test');
const path = require('path');
const A = require(path.resolve(__dirname, '..', 'scripts', 'global', 'cross-team-auto-apply.js'));

const EPIC_LABELS = ['type:epic', 'priority:P2', 'role:manager', 'area:governance'];

const validManagerComment = `## MANAGER_HANDOFF\n\nticket: #100\n\nEpic closeout pending. **cross-team Consultant required** for SOX baseline.\n\n${'C'}ONSULTANT_EPIC_CLOSEOUT-pending: posting evidence anchor with PR/issue links + per-AC table.\n\nSigned-by: Orla Mason\nTeam&Model: claude-code:opus-4-7@anthropic\nRole: manager`;

test('isManagerComment detects MANAGER_HANDOFF heading', () => {
  expect(A.isManagerComment('## MANAGER_HANDOFF\n\nticket: #1')).toBe(true);
});

test('isManagerComment detects Role: manager structured field', () => {
  expect(A.isManagerComment('Signed-by: Orla Mason\nRole: manager')).toBe(true);
});

test('isManagerComment returns false for non-manager comments', () => {
  expect(A.isManagerComment('Signed-by: Orla Harper\nRole: collaborator')).toBe(false);
  expect(A.isManagerComment('## COLLABORATOR_HANDOFF\n')).toBe(false);
});

test('isManagerComment returns false for null/empty body', () => {
  expect(A.isManagerComment('')).toBe(false);
  expect(A.isManagerComment(null)).toBe(false);
});

test('isCrossTeamCloseoutRequest requires ALL THREE markers (manager + closeout + trigger phrase)', () => {
  expect(A.isCrossTeamCloseoutRequest(validManagerComment)).toBe(true);
  // missing manager marker
  expect(A.isCrossTeamCloseoutRequest('CONSULTANT_EPIC_CLOSEOUT pending. cross-team Consultant required.\nRole: collaborator')).toBe(false);
  // missing CONSULTANT_EPIC_CLOSEOUT
  expect(A.isCrossTeamCloseoutRequest('Role: manager\ncross-team Consultant required for next phase.')).toBe(false);
  // missing trigger phrase
  expect(A.isCrossTeamCloseoutRequest('Role: manager\nCONSULTANT_EPIC_CLOSEOUT pending. Standard closeout.')).toBe(false);
});

test('isCrossTeamCloseoutRequest is case-insensitive on trigger phrase but case-sensitive on CONSULTANT_EPIC_CLOSEOUT', () => {
  expect(A.isCrossTeamCloseoutRequest('Role: manager\nCONSULTANT_EPIC_CLOSEOUT\nCROSS-TEAM CONSULTANT REQUIRED')).toBe(true);
  // CONSULTANT_EPIC_CLOSEOUT must be uppercase (it is a literal artifact marker)
  expect(A.isCrossTeamCloseoutRequest('Role: manager\nconsultant_epic_closeout\ncross-team Consultant required')).toBe(false);
});

test('isEligibleEpic returns true only when type:epic is present and no cross-team label is set yet', () => {
  expect(A.isEligibleEpic(EPIC_LABELS)).toBe(true);
  expect(A.isEligibleEpic(['type:task', 'priority:P2'])).toBe(false);
  expect(A.isEligibleEpic([...EPIC_LABELS, 'consultant:cross-team-needed'])).toBe(false);
  expect(A.isEligibleEpic([...EPIC_LABELS, 'consultant:cross-team-in-progress'])).toBe(false);
});

test('isEligibleEpic tolerates empty or null labels', () => {
  expect(A.isEligibleEpic([])).toBe(false);
  expect(A.isEligibleEpic(null)).toBe(false);
});

test('decideApply: full match returns apply=true with the target label name', () => {
  const result = A.decideApply({ commentBody: validManagerComment, labels: EPIC_LABELS });
  expect(result.apply).toBe(true);
  expect(result.label).toBe('consultant:cross-team-needed');
  expect(result.reason).toBe('manager-request-matched');
});

test('decideApply: comment matches but issue is not an Epic returns apply=false', () => {
  const result = A.decideApply({ commentBody: validManagerComment, labels: ['type:task'] });
  expect(result.apply).toBe(false);
  expect(result.reason).toBe('issue-not-eligible-epic');
});

test('decideApply: Epic eligible but comment is not a Manager cross-team request returns apply=false', () => {
  const result = A.decideApply({
    commentBody: 'Random comment with no special markers.',
    labels: EPIC_LABELS,
  });
  expect(result.apply).toBe(false);
  expect(result.reason).toBe('comment-not-manager-cross-team-request');
});

test('decideApply: Epic that already has consultant:cross-team-needed returns apply=false (no double-apply)', () => {
  const result = A.decideApply({
    commentBody: validManagerComment,
    labels: [...EPIC_LABELS, 'consultant:cross-team-needed'],
  });
  expect(result.apply).toBe(false);
  expect(result.reason).toBe('issue-not-eligible-epic');
});

test('decideApply: Epic already :in-progress (claim already accepted) returns apply=false', () => {
  const result = A.decideApply({
    commentBody: validManagerComment,
    labels: [...EPIC_LABELS, 'consultant:cross-team-in-progress'],
  });
  expect(result.apply).toBe(false);
  expect(result.reason).toBe('issue-not-eligible-epic');
});

test('decideApply tolerates malformed input (null commentBody, missing labels)', () => {
  expect(A.decideApply({ commentBody: null, labels: EPIC_LABELS }).apply).toBe(false);
  expect(A.decideApply({}).apply).toBe(false);
});

test('TARGET_LABEL constant exported as the canonical label name', () => {
  expect(A.TARGET_LABEL).toBe('consultant:cross-team-needed');
  expect(A.SUPPRESS_LABELS).toContain('consultant:cross-team-needed');
  expect(A.SUPPRESS_LABELS).toContain('consultant:cross-team-in-progress');
});
