// Tests for scripts/global/consultant-activation-decision.js (#1541).
const { test, expect } = require('@playwright/test');
const dec = require('../scripts/global/consultant-activation-decision');

const closeoutComment = () => ({ body: '## CONSULTANT_CLOSEOUT\n\nrubric_rating: 9/10\n\nVerdict: APPROVED.' });
const someOtherComment = () => ({ body: '## MANAGER_HANDOFF\n\n- scope: ...' });

test('#1541 AC1: closed issue skips (already terminal)', () => {
  const result = dec.decide({
    state: 'closed', labels: ['status:testing', 'role:admin'], comments: [],
  });
  expect(result.action).toBe('skip');
  expect(result.reason).toBe('issue-closed-terminal');
});

test('#1541 AC1: status:done label skips (label-lint already auto-transitioned)', () => {
  const result = dec.decide({
    state: 'open', labels: ['status:done', 'resolution:completed'], comments: [],
  });
  expect(result.action).toBe('skip');
  expect(result.reason).toBe('already-terminal-label');
});

test('#1541 AC1: status:cancelled label skips', () => {
  const result = dec.decide({
    state: 'open', labels: ['status:cancelled'], comments: [],
  });
  expect(result.action).toBe('skip');
  expect(result.reason).toBe('already-terminal-label');
});

test('#1541 AC1: closeout in trail skips (the core race-fix path)', () => {
  // This is the exact race scenario: label-lint auto-transitioned to
  // status:done, then post-merge-automation fetched stale labels showing
  // status:testing. The closeout-in-trail check catches it.
  const result = dec.decide({
    state: 'open', labels: ['status:testing', 'role:admin'],
    comments: [closeoutComment()],
  });
  expect(result.action).toBe('skip');
  expect(result.reason).toBe('closeout-already-posted');
});

test('#1541 AC1: status not testing skips (existing behavior preserved)', () => {
  const result = dec.decide({
    state: 'open', labels: ['status:in-progress', 'role:collaborator'], comments: [],
  });
  expect(result.action).toBe('skip');
  expect(result.reason).toBe('not-at-status-testing');
});

test('#1541 AC1: standard activation path still works', () => {
  const result = dec.decide({
    state: 'open', labels: ['status:testing', 'role:admin'], comments: [someOtherComment()],
  });
  expect(result.action).toBe('activate');
  expect(result.addLabels).toEqual(['status:review', 'role:consultant']);
  expect(result.removeLabelsMatching).toBeInstanceOf(RegExp);
});

test('#1541 AC1: removeLabelsMatching regex captures status:* and role:admin', () => {
  const result = dec.decide({
    state: 'open', labels: ['status:testing', 'role:admin'], comments: [],
  });
  const re = result.removeLabelsMatching;
  expect(re.test('status:testing')).toBe(true);
  expect(re.test('status:in-progress')).toBe(true);
  expect(re.test('role:admin')).toBe(true);
  expect(re.test('role:collaborator')).toBe(false);
  expect(re.test('priority:P1')).toBe(false);
  expect(re.test('area:scripts')).toBe(false);
});

test('#1541: hasCloseoutComment recognizes ## CONSULTANT_CLOSEOUT header', () => {
  expect(dec.hasCloseoutComment([{ body: '## CONSULTANT_CLOSEOUT\n\nx' }])).toBe(true);
});

test('#1541: hasCloseoutComment recognizes **CONSULTANT_CLOSEOUT** bold form', () => {
  expect(dec.hasCloseoutComment([{ body: '**CONSULTANT_CLOSEOUT** inline\n\nx' }])).toBe(true);
});

test('#1541: hasCloseoutComment recognizes EPIC variant', () => {
  expect(dec.hasCloseoutComment([{ body: '## CONSULTANT_CLOSEOUT_EPIC_CLOSEOUT\n\nx' }])).toBe(true);
});

test('#1541: hasCloseoutComment ignores non-closeout comments', () => {
  expect(dec.hasCloseoutComment([
    { body: '## MANAGER_HANDOFF\n\n- scope: ...' },
    { body: 'A discussion comment mentioning CONSULTANT_CLOSEOUT in prose' },
  ])).toBe(false);
});

test('#1541: malformed comment entries handled safely', () => {
  expect(dec.hasCloseoutComment([null, {}, { body: null }, closeoutComment()])).toBe(true);
  expect(dec.hasCloseoutComment([])).toBe(false);
  expect(dec.hasCloseoutComment(null)).toBe(false);
});

test('#1541 AC1: priority order — closed state wins over closeout-in-trail', () => {
  // Both conditions hold; closed-state check runs first.
  const result = dec.decide({
    state: 'closed', labels: ['status:testing'], comments: [closeoutComment()],
  });
  expect(result.reason).toBe('issue-closed-terminal');
});

test('#1541 AC1: priority order — terminal-label wins over closeout-in-trail', () => {
  const result = dec.decide({
    state: 'open', labels: ['status:done'], comments: [closeoutComment()],
  });
  expect(result.reason).toBe('already-terminal-label');
});
