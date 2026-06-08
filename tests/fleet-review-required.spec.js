'use strict';
const { test } = require('node:test');
const assert = require('node:assert');
const path = require('path');
const fr = require(path.resolve(__dirname, '..', 'scripts', 'global', 'megalint', 'fleet-review-required.js'));

const VALID = 'cross_family_reviewer: gemini-2.5-flash@google-ai-studio\n'
  + 'cross_family_verdict: ACCEPT - gemini-2.5-flash@google-ai-studio - looks correct\n';
const AUTHOR = 'claude-code:opus@anthropic';

test('a lane not requiring review passes regardless', () => {
  assert.strictEqual(fr.validate({ labels: ['area:dashboard'], closeoutBody: '' }).ok, true);
});

test('review-required lane with no review block is BLOCKED', () => {
  const r = fr.validate({ labels: ['area:governance'], closeoutBody: 'no review here', authorTeamModel: AUTHOR });
  assert.strictEqual(r.ok, false);
  assert.ok(r.violations.some((v) => v.rule === 'fleet-review-missing'));
});

test('a valid cross-family review block passes', () => {
  const r = fr.validate({ labels: ['area:scripts'], closeoutBody: VALID, authorTeamModel: AUTHOR, dispatchRecorded: true });
  assert.deepStrictEqual(r.violations, []);
  assert.strictEqual(r.ok, true);
});

test('a same-family self-review is rejected (cross-family fact)', () => {
  const sameFamily = 'cross_family_reviewer: claude-opus@anthropic\n'
    + 'cross_family_verdict: ACCEPT - claude-opus@anthropic - ok\n';
  const r = fr.validate({ labels: ['area:governance'], closeoutBody: sameFamily, authorTeamModel: AUTHOR });
  assert.ok(r.violations.some((v) => v.rule === 'fleet-review-not-cross-family'));
});

test('a forged block with no dispatch record is rejected (anti-forgery)', () => {
  const r = fr.validate({ labels: ['area:governance'], closeoutBody: VALID, authorTeamModel: AUTHOR, dispatchRecorded: false });
  assert.ok(r.violations.some((v) => v.rule === 'fleet-review-no-dispatch-record'));
});

test('modelFamily maps known model strings', () => {
  assert.strictEqual(fr.modelFamily('gemini-2.5-flash@google-ai-studio'), 'google');
  assert.strictEqual(fr.modelFamily('claude-code:opus@anthropic'), 'anthropic');
  assert.strictEqual(fr.modelFamily('qwen2.5-coder:7b'), 'alibaba');
});
