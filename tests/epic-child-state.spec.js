// tdd-pyramid unit coverage for the Epic parent-close guard pure logic (#3350).
const { test, expect } = require('@playwright/test');
const path = require('path');
const S = require(path.resolve(__dirname, '..', 'scripts', 'global', 'epic-child-state.js'));

const cand = (over = {}) => ({
  number: 100, title: 't', state: 'open', body: '', nativeParent: null,
  inTaskList: false, parentText: null, ...over,
});

test('assertsParent matches the three #1432 forms only for the right epic', () => {
  expect(S.assertsParent('Refs Epic #3021', 3021)).toBe(true);
  expect(S.assertsParent('Epic: #3021', 3021)).toBe(true);
  expect(S.assertsParent('Parent: #3021', 3021)).toBe(true);
  expect(S.assertsParent('Refs Epic #999', 3021)).toBe(false); // different epic
  expect(S.assertsParent('see also #3021', 3021)).toBe(false); // casual mention
  expect(S.assertsParent('', 3021)).toBe(false);
});

test('openChildUnion counts a cross-ref child only when its body asserts parentage (#1306-safe)', () => {
  const candidates = [
    cand({ number: 3031, body: 'Refs Epic #3021' }),            // cross-ref+assertion
    cand({ number: 9999, body: 'see also #3021' }),             // casual mention -> excluded
    cand({ number: 3021, body: 'Refs Epic #3021' }),            // self -> excluded
  ];
  const open = S.openChildUnion(3021, candidates);
  expect(open.map(c => c.number)).toEqual([3031]);
  expect(open[0].why).toBe('cross-ref+parent-assertion');
});

test('openChildUnion honors task-list, native-parent and Parent-text edges', () => {
  const candidates = [
    cand({ number: 1, inTaskList: true }),
    cand({ number: 2, nativeParent: 3021 }),
    cand({ number: 3, parentText: 'parent-text' }),
    cand({ number: 4, nativeParent: 999 }),                     // wrong parent -> excluded
  ];
  const open = S.openChildUnion(3021, candidates);
  expect(open.map(c => `${c.number}:${c.why}`)).toEqual([
    '1:task-list', '2:native-parent', '3:parent-text',
  ]);
});

test('openChildUnion excludes closed children', () => {
  const open = S.openChildUnion(3021, [cand({ number: 5, state: 'closed', body: 'Refs Epic #3021' })]);
  expect(open).toEqual([]);
});

test('reconcileCloseoutAssertion flags a closeout present while a child is open', () => {
  const r = S.reconcileCloseoutAssertion({
    closeoutBody: 'CONSULTANT_EPIC_CLOSEOUT all children CLOSED #3031',
    openChildNumbers: [3031],
  });
  expect(r.hasCloseout).toBe(true);
  expect(r.mismatch).toBe(true);
  expect(r.falselyAssertedClosed).toEqual([3031]); // named near "CLOSED" but live-open
});

test('reconcileCloseoutAssertion: no closeout => no mismatch', () => {
  const r = S.reconcileCloseoutAssertion({ closeoutBody: 'random comment', openChildNumbers: [3031] });
  expect(r.hasCloseout).toBe(false);
  expect(r.mismatch).toBe(false);
});

test('reconcileCloseoutAssertion: closeout present and zero open => clean', () => {
  const r = S.reconcileCloseoutAssertion({ closeoutBody: 'CONSULTANT_CLOSEOUT done', openChildNumbers: [] });
  expect(r.mismatch).toBe(false);
  expect(r.falselyAssertedClosed).toEqual([]);
});

test('decideReopen: flap-safe — recheck clearing means no reopen (suppression / no loop)', () => {
  expect(S.decideReopen({ initialOpenCount: 3, recheckOpenCount: 0 }).reopen).toBe(false);
  expect(S.decideReopen({ initialOpenCount: 0 }).reopen).toBe(false);
  expect(S.decideReopen({ initialOpenCount: 3, alreadyReopened: true }).reopen).toBe(false);
  expect(S.decideReopen({ initialOpenCount: 3, recheckOpenCount: 3 }).reopen).toBe(true);
});

test('decideReopen: null recheck falls back to initial count', () => {
  const d = S.decideReopen({ initialOpenCount: 2, recheckOpenCount: null });
  expect(d.reopen).toBe(true);
  expect(d.reason).toBe('confirmed-2-open');
});

test('buildIncidentRecord conforms to schema-v3 with the agreed pattern_id', () => {
  const rec = S.buildIncidentRecord(3021, [{ number: 3031 }, { number: 3032 }], '2026-06-29T00:00:00Z');
  expect(rec.version).toBe(3);
  expect(rec.pattern_id).toBe('epic-closed-with-open-children');
  expect(rec.epic).toBe(3021);
  expect(rec.open_children).toEqual([3031, 3032]);
  expect(rec.ts).toBe('2026-06-29T00:00:00Z');
  expect(rec.timestamp).toBe('2026-06-29T00:00:00Z'); // incidents-store keys on .timestamp
  for (const field of ['ts', 'version', 'service', 'env', 'event']) expect(rec[field]).toBeDefined();
});
