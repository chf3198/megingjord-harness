'use strict';
const { test } = require('node:test');
const assert = require('node:assert');
const path = require('path');
const jg = require(path.resolve(__dirname, '..', 'scripts', 'global', 'judgment-gate.js'));

test('a recognized flaw with no decision is blocked', () => {
  assert.strictEqual(jg.flawDecisionMissing('found a flaw in the parser, will look later'), true);
});

test('a recognized flaw WITH an explicit decision passes', () => {
  assert.strictEqual(jg.flawDecisionMissing('found a flaw; decision=file-ticket (#99)'), false);
  assert.strictEqual(jg.flawDecisionMissing('a regression here; no-action-justified: cosmetic'), false);
});

test('text with no flaw mention is not gated', () => {
  assert.strictEqual(jg.flawDecisionMissing('shipped the feature, tests green'), false);
});

test('a mutating tool with no active ticket requires baton entry', () => {
  assert.strictEqual(jg.batonEntryRequired('Edit', false), true);
  assert.strictEqual(jg.batonEntryRequired('Write', false), true);
});

test('a mutating tool WITH an active ticket is allowed', () => {
  assert.strictEqual(jg.batonEntryRequired('Edit', true), false);
});

test('a non-mutating tool never requires baton entry', () => {
  assert.strictEqual(jg.batonEntryRequired('Read', false), false);
  assert.strictEqual(jg.batonEntryRequired('Bash', false), false);
});

test('judgmentGateDecision aggregates both gates', () => {
  const blocked = jg.judgmentGateDecision({ artifactText: 'a bug exists', toolName: 'Write', hasActiveTicket: false });
  assert.strictEqual(blocked.ok, false);
  assert.strictEqual(blocked.violations.length, 2);
  const clean = jg.judgmentGateDecision({ artifactText: 'bug fixed; decision=memory-note-only', toolName: 'Edit', hasActiveTicket: true });
  assert.deepStrictEqual(clean.violations, []);
});
