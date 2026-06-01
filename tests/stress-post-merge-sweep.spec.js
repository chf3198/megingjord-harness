'use strict';
// @megalint:test-discoverability:opt-out — node:test CLI spec; registered via
// `npm run stress:post-merge-sweep` + harness-self-test registry.
// #1911 stress-test (test-methodology-matrix: side-effect gate + untrusted-input parse).
// Asserts >=1 fault-injection path (G6) and >=1 p99 latency budget (G7).
const test = require('node:test');
const assert = require('node:assert');
const sweep = require('../scripts/global/post-merge-sweep.js');

const fast = { poll: { attempts: 2, intervalMs: 0 }, sleep: async () => {} };

// G6 chaos: a GitHub API fault must NEVER cause a close (mass-close guard, OA2).
test('stress/chaos: API error -> skipped-errored, never closes', async () => {
  let updates = 0;
  const gh = { issues: {
    get: async () => { throw new Error('500 upstream'); },
    update: async () => { updates++; },
    createComment: async () => {},
  } };
  const r = await sweep.sweep({ github: gh, owner: 'o', repo: 'r', prNumber: 1, prBody: 'Closes #9 fixes #10 resolves #11', ...fast });
  assert.strictEqual(r.citations.length, 3);
  assert.ok(r.records.every((x) => x.action === 'skipped-errored'));
  assert.strictEqual(updates, 0);
});

// G6: an intermittent fault on one citation must isolate — others still processed.
test('stress/chaos: intermittent fault isolates per-citation', async () => {
  const closed = [];
  const gh = { issues: {
    get: async ({ issue_number }) => {
      if (issue_number === 2) throw new Error('flaky');
      return { data: { state: 'open' } };
    },
    update: async (a) => { closed.push(a.issue_number); },
    createComment: async () => {},
  } };
  const r = await sweep.sweep({ github: gh, owner: 'o', repo: 'r', prNumber: 1, prBody: 'Closes #1 fixes #2 resolves #3', ...fast });
  assert.strictEqual(r.records.find((x) => x.number === 2).action, 'skipped-errored');
  assert.deepStrictEqual(closed.sort((a, b) => a - b), [1, 3]);
});

// G7 p99 latency budget: keyword parse over an adversarial blob must stay fast.
test('stress/perf: parseCloseKeywords p99 < 25ms over adversarial corpus', () => {
  const blob = 'Closes #1 '.repeat(5000) + 'fixes#nope FIXED #2147483647 '
    + 'x'.repeat(20000) + ' Resolves #'.repeat(100);
  const lat = [];
  for (let i = 0; i < 50; i++) {
    const t = process.hrtime.bigint();
    sweep.parseCloseKeywords(blob);
    lat.push(Number(process.hrtime.bigint() - t) / 1e6);
  }
  lat.sort((a, b) => a - b);
  const p99 = lat[Math.floor(lat.length * 0.99) - 1] ?? lat[lat.length - 1];
  assert.ok(p99 < 25, `p99 ${p99.toFixed(2)}ms exceeds 25ms budget`);
});

// Adversarial correctness: malformed / duplicate / case-mixed input never throws.
test('stress/adversarial: malformed input parses safely + de-dups', () => {
  assert.deepStrictEqual(sweep.parseCloseKeywords(''), []);
  assert.deepStrictEqual(sweep.parseCloseKeywords(null), []);
  assert.deepStrictEqual(sweep.parseCloseKeywords('CLOSES #5 closed #5 fix #5'), [5, 5, 5]);
  assert.deepStrictEqual(sweep.collectCitations({ prBody: 'CLOSES #5', commitMessages: ['fix #5'] }), [5]);
});
