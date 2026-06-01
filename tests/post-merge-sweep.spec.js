'use strict';
// @megalint:test-discoverability:opt-out — node:test CLI spec; registered via
// `npm run test:post-merge-sweep` + harness-self-test registry (id post-merge-sweep).
// #1911 AC7 — post-merge-sweep unit tests. Mocked GitHub client + zeroed clock;
// never touches real issues, never sleeps wall-clock.
const test = require('node:test');
const assert = require('node:assert');
const sweep = require('../scripts/global/post-merge-sweep.js');

function mockGithub(states) {
  const calls = { update: [], comment: [] };
  const seq = {};
  return {
    calls,
    issues: {
      async get({ issue_number }) {
        const s = states[issue_number];
        if (s === 'throw') throw new Error('API 500');
        const i = (seq[issue_number] = (seq[issue_number] ?? -1) + 1);
        const val = Array.isArray(s) ? s[Math.min(i, s.length - 1)] : s;
        return { data: { state: val } };
      },
      async update(a) { calls.update.push(a); },
      async createComment(a) { calls.comment.push(a); },
    },
  };
}

const fast = { poll: { attempts: 2, intervalMs: 0 }, sleep: async () => {} };

test('AC7: single keyword, target already closed -> no-op', async () => {
  const gh = mockGithub({ 5: 'closed' });
  const r = await sweep.sweep({ github: gh, owner: 'o', repo: 'r', prNumber: 9, prBody: 'Closes #5', ...fast });
  assert.deepStrictEqual(r.citations, [5]);
  assert.strictEqual(r.records[0].action, 'already-closed');
  assert.strictEqual(gh.calls.update.length, 0);
});

test('AC7: multi-keyword all closed -> no-op', async () => {
  const gh = mockGithub({ 1: 'closed', 2: 'closed' });
  const r = await sweep.sweep({ github: gh, owner: 'o', repo: 'r', prNumber: 9, prBody: 'Closes #1\nFixes #2', ...fast });
  assert.deepStrictEqual(r.citations.sort(), [1, 2]);
  assert.ok(r.records.every((x) => x.action === 'already-closed'));
  assert.strictEqual(gh.calls.update.length, 0);
});

test('AC7: multi-keyword, one drifter -> force-closed with audit comment', async () => {
  const gh = mockGithub({ 1: 'closed', 2: 'open' });
  const r = await sweep.sweep({ github: gh, owner: 'o', repo: 'r', prNumber: 42, prBody: 'Closes #1, Resolves #2', ...fast });
  assert.strictEqual(r.records.find((x) => x.number === 2).action, 'force-closed');
  assert.strictEqual(gh.calls.update.length, 1);
  assert.strictEqual(gh.calls.update[0].issue_number, 2);
  assert.strictEqual(gh.calls.update[0].state, 'closed');
  assert.match(gh.calls.comment[0].body, /PR #42/);
});

test('AC7: cited ticket closes during poll window -> no force-close', async () => {
  const gh = mockGithub({ 7: ['open', 'closed'] });
  const r = await sweep.sweep({ github: gh, owner: 'o', repo: 'r', prNumber: 9, prBody: 'Fixes #7', ...fast });
  assert.strictEqual(r.records[0].action, 'closed-after-poll');
  assert.strictEqual(gh.calls.update.length, 0);
});

test('AC2: citations unioned from body + commit messages, de-duped', () => {
  const cites = sweep.collectCitations({ prBody: 'Closes #1', commitMessages: ['fix #2', 'Resolves #1', 'noise'] });
  assert.deepStrictEqual(cites.sort((a, b) => a - b), [1, 2]);
});

test('L2-fleet#1: optional-colon form parses; bare "closes#N" (no space) does not', () => {
  assert.deepStrictEqual(sweep.parseCloseKeywords('Closes: #5 fixes: #6'), [5, 6]);
  assert.deepStrictEqual(sweep.parseCloseKeywords('closes#7 see #8'), []); // neither is a valid GitHub close-link
});

test('AC6: advisory mode -> would-force-close, never closes', async () => {
  const gh = mockGithub({ 3: 'open' });
  const r = await sweep.sweep({ github: gh, owner: 'o', repo: 'r', prNumber: 9, prBody: 'Closes #3', advisoryClose: true, ...fast });
  assert.strictEqual(r.records[0].action, 'would-force-close');
  assert.strictEqual(gh.calls.update.length, 0);
});

test('AC5: audit events emitted only for drift actions', () => {
  const result = { prNumber: 9, records: [
    { number: 1, action: 'already-closed' },
    { number: 2, action: 'force-closed' },
    { number: 3, action: 'skipped-errored', error: 'x' },
  ] };
  const evs = sweep.toAuditEvents(result);
  assert.strictEqual(evs.length, 2);
  assert.ok(evs.every((e) => e.ts && e.service === 'post-merge-sweep'));
});
