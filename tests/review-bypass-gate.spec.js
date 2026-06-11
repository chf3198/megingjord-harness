'use strict';
// tdd-pyramid spec for the C7 review-bypass gate JS twin (#2933 / Epic #2926 C7).
const test = require('node:test');
const assert = require('node:assert');
const { isReviewContext, reviewBypassDecision } = require('../scripts/global/hamr-fleet-direct-block');

const paidDetection = { detected: true, suppressed: false, severity: 'paid-bypass', providers: [{ name: 'gemini' }] };
const fleetDetection = { detected: true, suppressed: false, severity: 'fleet-bypass', providers: [{ name: 'ollama' }] };

test('AC1: review context via keyword or MEGINGJORD_REVIEW_CONTEXT=1', () => {
  assert.strictEqual(isReviewContext('curl https://generativelanguage.googleapis.com -d "review this diff"', {}), true);
  assert.strictEqual(isReviewContext('please run an adversarial critique', {}), true);
  assert.strictEqual(isReviewContext('curl https://api.openai.com', { MEGINGJORD_REVIEW_CONTEXT: '1' }), true);
  assert.strictEqual(isReviewContext('npm run build', {}), false);
});

test('AC2: paid-bypass in review context flags advisory by default', () => {
  const d = reviewBypassDecision(paidDetection, 'curl gemini ... rubric review', {});
  assert.strictEqual(d.flag, true);
  assert.strictEqual(d.block, false);
  assert.strictEqual(d.advisory, true);
  assert.deepStrictEqual(d.providers, ['gemini']);
});

test('AC2: paid-bypass in review context BLOCKS under MEGINGJORD_REVIEW_BYPASS_BLOCK=1', () => {
  const d = reviewBypassDecision(paidDetection, 'review via raw gemini', { MEGINGJORD_REVIEW_BYPASS_BLOCK: '1' });
  assert.strictEqual(d.flag, true);
  assert.strictEqual(d.block, true);
});

test('AC2: NOT flagged outside review context (a raw paid call for non-review work)', () => {
  assert.strictEqual(reviewBypassDecision(paidDetection, 'curl https://api.openai.com summarize logs', {}).flag, false);
});

test('AC2: false-positive guard — block flag does NOT over-block non-review paid calls', () => {
  const d = reviewBypassDecision(paidDetection, 'curl https://api.openai.com summarize logs', { MEGINGJORD_REVIEW_BYPASS_BLOCK: '1' });
  assert.strictEqual(d.flag, false);
  assert.strictEqual(d.block, false);
});

test('AC2: fleet-bypass is NOT this gate (stays should_block scope)', () => {
  assert.strictEqual(reviewBypassDecision(fleetDetection, 'review via raw ollama curl', {}).flag, false);
});

test('AC2: suppressed override + no-detection never flag', () => {
  assert.strictEqual(reviewBypassDecision({ ...paidDetection, suppressed: true }, 'review', {}).flag, false);
  assert.strictEqual(reviewBypassDecision({ detected: false }, 'review', {}).flag, false);
  assert.strictEqual(reviewBypassDecision(null, 'review', {}).flag, false);
});
