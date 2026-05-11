// Shared label-rules evaluator tests (#1307).
const { test, expect } = require('@playwright/test');
const path = require('path');
const R = require(path.resolve(__dirname, '..', 'scripts', 'global', 'label-rules.js'));

const mk = (labels, state = 'open') => ({
  labels: labels.map(name => ({ name })),
  state,
});

test('Epic at status:in-progress with role:manager: NO violation (Rule E3)', () => {
  const v = R.evaluate(mk(['type:epic', 'status:in-progress', 'role:manager', 'area:governance']));
  expect(v.filter(x => /Rule 8/.test(x))).toEqual([]);
  expect(v.filter(x => /Rule E3/.test(x))).toEqual([]);
});

test('Epic at status:in-progress WITHOUT role:manager: Rule E3 violation', () => {
  const v = R.evaluate(mk(['type:epic', 'status:in-progress', 'area:governance']));
  expect(v.some(x => x.includes('Rule E3'))).toBe(true);
});

test('Epic with role:collaborator: invariant violation', () => {
  const v = R.evaluate(mk(['type:epic', 'status:in-progress', 'role:collaborator', 'area:governance']));
  // Rule 2 multiple role or invariant — must flag in some form
  expect(v.some(x => x.includes('Rule E3') || x.includes('Rule 2'))).toBe(true);
});

test('Non-Epic at status:in-progress without role:collaborator: Rule 8 violation', () => {
  const v = R.evaluate(mk(['type:task', 'status:in-progress', 'area:governance']));
  expect(v.some(x => x.includes('Rule 8') && x.includes('role:collaborator'))).toBe(true);
});

test('Non-Epic at status:in-progress with role:collaborator: no Rule 8', () => {
  const v = R.evaluate(mk(['type:task', 'status:in-progress', 'role:collaborator', 'area:governance']));
  expect(v.filter(x => x.includes('Rule 8'))).toEqual([]);
});

test('Closed issue with role:manager (non-archived): Rule 7 violation', () => {
  const v = R.evaluate(mk(['type:task', 'status:done', 'role:manager', 'area:governance'], 'closed'));
  expect(v.some(x => x.includes('Rule 7') && !x.includes('Rule 7b'))).toBe(true);
});

test('Closed issue with role:archived: no Rule 7', () => {
  const v = R.evaluate(mk(['type:task', 'status:done', 'role:archived', 'area:governance'], 'closed'));
  expect(v.filter(x => x.includes('Rule 7:'))).toEqual([]);
});

test('Closed without status:done: Rule 7b violation', () => {
  const v = R.evaluate(mk(['type:task', 'status:in-progress', 'area:governance'], 'closed'));
  expect(v.some(x => x.includes('Rule 7b'))).toBe(true);
});

test('Epic at status:ready: Rule 9 violation', () => {
  const v = R.evaluate(mk(['type:epic', 'status:ready', 'role:manager', 'area:governance', 'lane:code-change']));
  expect(v.some(x => x.includes('Rule 9'))).toBe(true);
});

test('Non-Epic at status:dormant: Rule E5 violation', () => {
  const v = R.evaluate(mk(['type:task', 'status:dormant', 'area:governance']));
  expect(v.some(x => x.includes('Rule E5') && x.includes('Epic-only'))).toBe(true);
});

test('Epic at status:dormant with role:manager: no Rule E5 violation', () => {
  const v = R.evaluate(mk(['type:epic', 'status:dormant', 'role:manager', 'area:governance']));
  expect(v.filter(x => x.includes('Rule E5'))).toEqual([]);
});

test('Issue missing area: Rule 6 violation', () => {
  const v = R.evaluate(mk(['type:task', 'status:in-progress', 'role:collaborator']));
  expect(v.some(x => x.includes('Rule 6'))).toBe(true);
});

test('status:ready missing lane: Rule 10 violation', () => {
  const v = R.evaluate(mk(['type:task', 'status:ready', 'area:governance']));
  expect(v.some(x => x.includes('Rule 10'))).toBe(true);
});

test('Multiple status labels: Rule 1 violation', () => {
  const v = R.evaluate(mk(['type:task', 'status:in-progress', 'status:testing', 'role:collaborator', 'area:governance']));
  expect(v.some(x => x.includes('Rule 1') && x.includes('multiple'))).toBe(true);
});

test('Rule 11 (#1305 AC7): cross-team consult :needed AND :in-progress is mutually exclusive', () => {
  const v = R.evaluate(mk([
    'type:epic', 'status:in-progress', 'role:manager', 'area:governance',
    'consultant:cross-team-needed', 'consultant:cross-team-in-progress',
  ]));
  expect(v.some(x => x.includes('Rule 11') && x.includes('mutually exclusive'))).toBe(true);
});

test('Rule 11: either label alone is OK', () => {
  const v1 = R.evaluate(mk(['type:epic', 'status:in-progress', 'role:manager', 'area:governance', 'consultant:cross-team-needed']));
  const v2 = R.evaluate(mk(['type:epic', 'status:in-progress', 'role:manager', 'area:governance', 'consultant:cross-team-in-progress']));
  expect(v1.filter(x => x.includes('Rule 11'))).toEqual([]);
  expect(v2.filter(x => x.includes('Rule 11'))).toEqual([]);
});
