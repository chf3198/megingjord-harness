'use strict';
// #3053 stress: adversarial-input + perf budget for the merge-precondition parser
// (new surface parsing untrusted ADMIN_HANDOFF comment bodies).
// G6 chaos: malformed/hostile inputs never crash, always return an array.
// G7 perf: p99 over a large corpus stays within budget.
const test = require('node:test');
const assert = require('node:assert');
const { checkMergePrecondition, parseRating } = require('../scripts/global/megalint/admin-merge-precondition');

const HOSTILE = [
  '', 'admin_review_rating:', 'admin_review_rating: notanumber',
  'admin_review_rating: 93'.repeat(5000), 'admin_review_rating: 999999999999',
  ' admin_review_rating: 95 ', 'admin_review_rating:\n93',
  '>= 93 admin_review_rating: 94 heredoc', 'fence admin_review_rating: 100 fence',
  'ADMIN_REVIEW_RATING : 97', null, undefined,
];
const FACTS = [undefined, {}, { ciGreen: true, prMerged: false }, { ciGreen: false }];

test('G6 chaos: hostile inputs never throw, always return array', () => {
  for (const b of HOSTILE) {
    for (const facts of FACTS) {
      const out = checkMergePrecondition(b, { lane: 'lane:code-change', facts });
      assert.ok(Array.isArray(out), 'returns array for hostile body');
    }
  }
});

test('G7 perf: p99 <= 2ms/call over 20k adversarial iterations', () => {
  const body = 'admin_review_rating: 96\n' + 'x>=93 '.repeat(200);
  const N = 20000, samples = [];
  for (let i = 0; i < N; i++) {
    const t = process.hrtime.bigint();
    checkMergePrecondition(body, { lane: 'lane:code-change', facts: { ciGreen: true, prMerged: false } });
    samples.push(Number(process.hrtime.bigint() - t) / 1e6);
  }
  samples.sort((a, b) => a - b);
  const p99 = samples[Math.floor(N * 0.99)];
  assert.ok(p99 <= 2, `p99=${p99.toFixed(4)}ms exceeds 2ms budget`);
});

test('parseRating is total over hostile input', () => {
  for (const b of HOSTILE) assert.doesNotThrow(() => parseRating(b));
});
