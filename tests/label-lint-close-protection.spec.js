// Tests for scripts/global/label-lint-close-protection.js (#1515).
// Covers the race-condition fix: status:testing close → auto-transition,
// not reopen, when CONSULTANT_CLOSEOUT exists in the comment trail.
const { test, expect } = require('@playwright/test');
const lib = require('../scripts/global/label-lint-close-protection');

const closeoutComment = (extra = '') => ({
  body: `## CONSULTANT_CLOSEOUT\n\nrubric_rating: 9/10\n\nVerdict: APPROVED.\n${extra}`,
});

test('#1515 AC1: status:testing close with CONSULTANT_CLOSEOUT auto-transitions (the race fix)', () => {
  const result = lib.decide({
    state: 'closed',
    labels: ['type:task', 'status:testing', 'role:admin', 'priority:P1'],
    comments: [closeoutComment()],
  });
  expect(result.action).toBe('auto-transition');
  expect(result.from).toBe('status:testing');
  expect(result.removeLabels).toContain('status:testing');
  expect(result.removeLabels).toContain('role:consultant');
  expect(result.addLabels).toEqual(['status:done', 'resolution:completed']);
  expect(result.reason).toBe('closeout-present-from-status:testing');
});

test('#1515 AC1: status:review close with CONSULTANT_CLOSEOUT still auto-transitions (back-compat)', () => {
  const result = lib.decide({
    state: 'closed',
    labels: ['type:task', 'status:review', 'role:consultant'],
    comments: [closeoutComment()],
  });
  expect(result.action).toBe('auto-transition');
  expect(result.from).toBe('status:review');
  expect(result.reason).toBe('closeout-present-from-status:review');
});

test('#1515 AC2: close without CONSULTANT_CLOSEOUT triggers reopen', () => {
  const result = lib.decide({
    state: 'closed',
    labels: ['type:task', 'status:in-progress', 'role:collaborator'],
    comments: [{ body: '## MANAGER_HANDOFF\n\nNo closeout yet.' }],
  });
  expect(result.action).toBe('reopen');
  expect(result.reason).toBe('no-closeout-in-trail');
});

test('#1515 AC2: closeout present but no valid pre-close label triggers reopen', () => {
  const result = lib.decide({
    state: 'closed',
    labels: ['type:task', 'status:in-progress'],
    comments: [closeoutComment()],
  });
  expect(result.action).toBe('reopen');
  expect(result.reason).toBe('closeout-without-valid-pre-close-label');
});

test('#1515: open issue is a no-op', () => {
  const result = lib.decide({
    state: 'open',
    labels: ['type:task', 'status:in-progress'],
    comments: [],
  });
  expect(result.action).toBe('noop');
  expect(result.reason).toBe('issue-open');
});

test('#1515: already-terminal (status:done) is a no-op even when closed', () => {
  const result = lib.decide({
    state: 'closed',
    labels: ['type:task', 'status:done', 'resolution:completed'],
    comments: [closeoutComment()],
  });
  expect(result.action).toBe('noop');
  expect(result.reason).toBe('already-terminal');
});

test('#1515: status:cancelled is also terminal (no-op, no auto-transition needed)', () => {
  const result = lib.decide({
    state: 'closed',
    labels: ['type:task', 'status:cancelled'],
    comments: [],
  });
  expect(result.action).toBe('noop');
  expect(result.reason).toBe('already-terminal');
});

test('#1515: Epic CONSULTANT_CLOSEOUT_EPIC_CLOSEOUT variant is also recognized', () => {
  const result = lib.decide({
    state: 'closed',
    labels: ['type:epic', 'status:review', 'role:consultant'],
    comments: [{ body: '## CONSULTANT_CLOSEOUT_EPIC_CLOSEOUT\n\nEpic-level rubric.' }],
  });
  expect(result.action).toBe('auto-transition');
});

test('#1515: bold-marker variant `**CONSULTANT_CLOSEOUT` is recognized', () => {
  const result = lib.decide({
    state: 'closed',
    labels: ['status:testing'],
    comments: [{ body: '**CONSULTANT_CLOSEOUT** (inline form)\n\nrubric_rating: 8/10' }],
  });
  expect(result.action).toBe('auto-transition');
});

test('#1515: empty/missing comments array safely handled', () => {
  expect(lib.decide({ state: 'closed', labels: ['status:testing'] }).action).toBe('reopen');
  expect(lib.decide({ state: 'closed', labels: ['status:testing'], comments: null }).action).toBe('reopen');
});

test('#1515: malformed comment entries are skipped (no throw)', () => {
  const result = lib.decide({
    state: 'closed',
    labels: ['status:testing'],
    comments: [null, {}, { body: null }, closeoutComment()],
  });
  expect(result.action).toBe('auto-transition');
});

test('#1515: hasCloseoutComment exported and usable in isolation', () => {
  expect(lib.hasCloseoutComment([closeoutComment()])).toBe(true);
  expect(lib.hasCloseoutComment([{ body: 'no closeout here' }])).toBe(false);
  expect(lib.hasCloseoutComment([])).toBe(false);
});

// #1380: expanded removeLabels — strips ALL status:* labels on auto-transition
test('#1380 auto-transition with lingering status:backlog strips it (not just pre-close label)', () => {
  const result = lib.decide({
    state: 'closed',
    labels: ['type:task', 'status:review', 'status:backlog', 'role:consultant', 'priority:P2'],
    comments: [closeoutComment()],
  });
  expect(result.action).toBe('auto-transition');
  expect(result.removeLabels).toContain('status:review');
  expect(result.removeLabels).toContain('status:backlog');
  expect(result.removeLabels).toContain('role:consultant');
  expect(result.addLabels).toEqual(['status:done', 'resolution:completed']);
});

test('#1380 auto-transition with only expected pre-close label still works (regression)', () => {
  const result = lib.decide({
    state: 'closed',
    labels: ['type:task', 'status:testing', 'role:admin'],
    comments: [closeoutComment()],
  });
  expect(result.action).toBe('auto-transition');
  expect(result.removeLabels).toContain('status:testing');
  expect(result.removeLabels).toContain('role:consultant');
  expect(result.removeLabels).not.toContain('status:backlog');
});
