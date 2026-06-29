'use strict';
// tests/epic-parent-resolve.spec.js — tdd-pyramid coverage for #1432.
// Resolver that targets the parent Epic for traceability re-validation when a
// child ticket closes: native Sub-issue parent first, prose fallback second.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const {
  parseParentFromProse, resolveParentNumber, resolveTraceabilityTarget,
} = require('../scripts/global/megalint/epic-parent-resolve');

test('parseParentFromProse resolves the repo convention "Refs Epic #N"', () => {
  assert.equal(parseParentFromProse('... Refs Epic #1407 (closed)'), 1407);
});

test('parseParentFromProse resolves legacy "Epic: #N"', () => {
  assert.equal(parseParentFromProse('Epic: #42\nbody'), 42);
});

test('parseParentFromProse resolves legacy "Parent: #N"', () => {
  assert.equal(parseParentFromProse('Parent: #7'), 7);
});

test('parseParentFromProse returns null when no parent is named', () => {
  assert.equal(parseParentFromProse('orphan ticket, no epic'), null);
});

test('parseParentFromProse is null-safe on missing/non-string body', () => {
  assert.equal(parseParentFromProse(undefined), null);
  assert.equal(parseParentFromProse(null), null);
});

test('resolveParentNumber prefers the native Sub-issue parent over prose', () => {
  assert.equal(resolveParentNumber({ nativeParent: 99, body: 'Refs Epic #5' }), 99);
});

test('resolveParentNumber falls back to prose when no native parent', () => {
  assert.equal(resolveParentNumber({ nativeParent: null, body: 'Epic: #5' }), 5);
});

test('resolveParentNumber ignores a non-positive/non-integer native parent', () => {
  assert.equal(resolveParentNumber({ nativeParent: 0, body: 'Epic: #9' }), 9);
  assert.equal(resolveParentNumber({ nativeParent: -3, body: 'Parent: #9' }), 9);
  assert.equal(resolveParentNumber({ nativeParent: 1.5, body: 'Epic: #9' }), 9);
});

test('resolveParentNumber returns null when neither source resolves', () => {
  assert.equal(resolveParentNumber({ nativeParent: null, body: 'nothing' }), null);
  assert.equal(resolveParentNumber({}), null);
});

test('resolveTraceabilityTarget: an Epic validates itself (kind=self)', () => {
  const out = resolveTraceabilityTarget({ issueNumber: 1407, labels: ['type:epic'] });
  assert.deepEqual(out, { target: 1407, kind: 'self' });
});

test('resolveTraceabilityTarget: a child-close targets the parent (kind=parent)', () => {
  const out = resolveTraceabilityTarget({
    issueNumber: 1432, labels: ['type:task'], nativeParent: 1407,
  });
  assert.deepEqual(out, { target: 1407, kind: 'parent' });
});

test('resolveTraceabilityTarget: child-close resolves parent via prose fallback', () => {
  const out = resolveTraceabilityTarget({
    issueNumber: 1432, labels: ['type:task'], body: 'Refs Epic #1407',
  });
  assert.deepEqual(out, { target: 1407, kind: 'parent' });
});

test('resolveTraceabilityTarget: an orphan non-Epic yields no target (kind=none)', () => {
  const out = resolveTraceabilityTarget({
    issueNumber: 1, labels: ['type:task'], body: 'no parent',
  });
  assert.deepEqual(out, { target: null, kind: 'none' });
});

test('resolveTraceabilityTarget: adversarial body never throws, resolves null', () => {
  const out = resolveTraceabilityTarget({
    issueNumber: 1, labels: ['type:bug'], body: '#### Epic ## #not-a-number Parent:#',
  });
  assert.deepEqual(out, { target: null, kind: 'none' });
});
