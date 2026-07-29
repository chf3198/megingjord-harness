'use strict';
// Epic #3576 W-C (#3582) — STRESS: close-atomicity gate under adversarial state + p99 budget.
// Asserts (G6) fault-injection paths never throw/false-pass, and (G7) a p99 latency budget.
const { test, expect } = require('@playwright/test');
const path = require('node:path');
const g = require(path.resolve(__dirname, '../scripts/global/close-atomicity-gate'));

test('chaos: adversarial/malformed states never throw and never false-pass a done-claim', () => {
  const bad = [
    { issueState: 'OPEN', labels: null },
    { issueState: 'CLOSED', labels: ['status:done', 'status:review'] },        // duplicate status
    { issueState: 'CLOSED', labels: ['status:done', 'role:consultant', 'role:admin'] },
    { issueState: undefined, labels: [123, null, 'status:done'] },              // non-string labels
    { issueState: 'CLOSED', labels: Array(5000).fill('role:x') },              // huge label array
    {},                                                                          // empty
  ];
  for (const state of bad) {
    const r = g.completionClaimGuard('done and complete', state);
    expect(typeof r.blocked).toBe('boolean');
    // none of these are a clean terminal state -> a done-claim MUST be blocked
    expect(r.blocked).toBe(true);
  }
});
test('p99 latency budget: completionClaimGuard p99 < 2ms over 5000 calls', () => {
  const state = { issueState: 'CLOSED', labels: ['status:done'], openBatonBack: false };
  const samples = [];
  for (let n = 0; n < 5000; n++) {
    const start = process.hrtime.bigint();
    g.completionClaimGuard('done', state);
    samples.push(Number(process.hrtime.bigint() - start) / 1e6);
  }
  samples.sort((a, b) => a - b);
  const p99 = samples[Math.floor(samples.length * 0.99)];
  expect(p99).toBeLessThan(2);
});
