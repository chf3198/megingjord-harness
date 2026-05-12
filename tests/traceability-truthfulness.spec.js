'use strict';
// Tests for epic-traceability-lint and body-ac-truthfulness-lint wiring.
// Epic #1407 AC5+AC6. Golden-file strategy.
const { test, expect } = require('@playwright/test');
const traceability = require('../scripts/global/megalint/epic-ac-traceability.js');
const truthfulness = require('../scripts/global/megalint/body-ac-truthfulness.js');

// ── epic-ac-traceability ─────────────────────────────────────────────

test('traceability: non-epic is always ok', () => {
  const result = traceability.validate({ body: '', labels: ['type:task'] });
  expect(result.ok).toBe(true);
  expect(result.reason).toBe('not-an-epic');
});

test('traceability: epic with <3 ACs and no refs is ok', () => {
  const body = '## ACs\n- [x] AC1: something\n- [x] AC2: other';
  const result = traceability.validate({ body, labels: ['type:epic'], issueNumber: 1 });
  expect(result.ok).toBe(true);
});

test('traceability: epic with 3+ ACs and no refs fails', () => {
  const body = '- [ ] AC1: foo\n- [ ] AC2: bar\n- [ ] AC3: baz';
  const result = traceability.validate({ body, labels: ['type:epic'], issueNumber: 1 });
  expect(result.ok).toBe(false);
  expect(result.violations[0].rule).toBe('epic-body-missing-child-refs');
});

test('traceability: epic with 3+ ACs and refs passes', () => {
  const body = '- [ ] AC1: foo\n- [ ] AC2: bar\n- [ ] AC3: baz\nRefs #10 #11';
  const result = traceability.validate({ body, labels: ['type:epic'], issueNumber: 1 });
  expect(result.ok).toBe(true);
});

test('traceability: epic with known children not mentioned fails', () => {
  const body = '- [ ] AC1: foo\n- [ ] AC2: bar\n- [ ] AC3: baz';
  const result = traceability.validate({
    body,
    labels: ['type:epic'],
    issueNumber: 1,
    linkedChildren: [42, 43],
  });
  expect(result.ok).toBe(false);
  expect(result.violations.some(v => v.rule === 'epic-body-missing-known-children')).toBe(true);
});

test('traceability: self-ref does not count as child ref', () => {
  const body = '- [ ] AC1: foo\n- [ ] AC2: bar\n- [ ] AC3: baz\nParent #1';
  const result = traceability.validate({ body, labels: ['type:epic'], issueNumber: 1 });
  expect(result.ok).toBe(false);
});

// ── body-ac-truthfulness ─────────────────────────────────────────────

test('truthfulness: open issue is always ok', () => {
  const body = '- [ ] AC1: unchecked';
  const result = truthfulness.validate({ body, labels: ['status:backlog'], state: 'open' });
  expect(result.ok).toBe(true);
});

test('truthfulness: closed without status:done is ok', () => {
  const body = '- [ ] AC1: unchecked';
  const result = truthfulness.validate({ body, labels: ['status:cancelled'], state: 'closed' });
  expect(result.ok).toBe(true);
});

test('truthfulness: closed with status:done and all checked is ok', () => {
  const body = '- [x] AC1: done\n- [x] AC2: also done';
  const result = truthfulness.validate({ body, labels: ['status:done'], state: 'closed' });
  expect(result.ok).toBe(true);
});

test('truthfulness: closed status:done with unchecked AC fails', () => {
  const body = '- [x] AC1: done\n- [ ] AC2: NOT done';
  const result = truthfulness.validate({ body, labels: ['status:done'], state: 'closed' });
  expect(result.ok).toBe(false);
  expect(result.violations[0].rule).toBe('unticked-ac-on-terminal');
});

test('truthfulness: no ACs on done ticket is ok', () => {
  const body = 'No checkboxes here. Just prose.';
  const result = truthfulness.validate({ body, labels: ['status:done'], state: 'closed' });
  expect(result.ok).toBe(true);
});
