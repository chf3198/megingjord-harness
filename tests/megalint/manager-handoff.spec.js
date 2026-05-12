// megalint/manager-handoff tests (#1420, Epic #1407 AC1).
const { test, expect } = require('@playwright/test');
const path = require('path');
const V = require(path.resolve(__dirname, '..', '..', 'scripts', 'global', 'megalint', 'manager-handoff.js'));

const fullHandoff = `**MANAGER_HANDOFF — Cole Mason**
- scope: build foo
- lane: lane:code-change
- test_strategy: tdd-pyramid
- acceptance: AC1-5
- gates: lint, test-evidence`;

test('validate: full MANAGER_HANDOFF passes with all 5 fields', () => {
  const r = V.validate({ comments: [{ body: fullHandoff }] });
  expect(r.ok).toBe(true);
  expect(r.found).toBe(true);
});

test('validate: missing test_strategy reports the violation', () => {
  const body = fullHandoff.replace(/test_strategy:.+\n/, '');
  const r = V.validate({ comments: [{ body }] });
  expect(r.ok).toBe(false);
  expect(r.violations.some(v => v.rule === 'missing-test_strategy')).toBe(true);
});

test('validate: missing gates field reports violation', () => {
  const body = fullHandoff.replace(/gates:.+/, '');
  const r = V.validate({ comments: [{ body }] });
  expect(r.violations.some(v => v.rule === 'missing-gates')).toBe(true);
});

test('validate: no MANAGER_HANDOFF on non-Epic returns ok=true', () => {
  const r = V.validate({ comments: [{ body: 'something else' }] });
  expect(r.ok).toBe(true);
  expect(r.found).toBe(false);
});

test('validate: no MANAGER_HANDOFF on Epic fails', () => {
  const r = V.validate({ comments: [{ body: 'something else' }], isEpic: true });
  expect(r.ok).toBe(false);
  expect(r.violations[0].rule).toBe('epic-manager-handoff-missing');
});

test('validate: lane mismatch detected', () => {
  const r = V.validate({ comments: [{ body: fullHandoff }], lane: 'lane:research' });
  expect(r.ok).toBe(false);
  expect(r.violations.some(v => v.rule === 'lane-mismatch')).toBe(true);
});

test('extractField: pulls value with various prefix formats', () => {
  expect(V.extractField('- scope: foo', 'scope')).toBe('foo');
  expect(V.extractField('scope: bar', 'scope')).toBe('bar');
  expect(V.extractField('* scope:   baz', 'scope')).toBe('baz');
});

test('REQUIRED_FIELDS exposes 5 fields', () => {
  expect(V.REQUIRED_FIELDS.length).toBe(5);
  expect(V.REQUIRED_FIELDS).toContain('scope');
  expect(V.REQUIRED_FIELDS).toContain('test_strategy');
});
