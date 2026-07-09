'use strict';
// @megalint:test-discoverability:opt-out — node:test CLI spec; registered via
// `npm run governance:completion-claim-truth:test` + harness-self-test registry
// (id completion-claim-truth). #1889 AC5/AC6 — pure detection + classification
// unit tests, mocked GitHub client, and an adversarial-input perf budget.
const test = require('node:test');
const assert = require('node:assert');
const v = require('../scripts/global/megalint/completion-claim-truth.js');

// ---- AC5: false-positive avoidance -----------------------------------------

test('AC5: future-tense plan is not a claim ("we\'ll commit shortly")', () => {
  const d = v.detect("We'll add scripts/global/foo.js and merge PR #42 shortly.");
  assert.strictEqual(d.hasClaim, false);
  assert.deepStrictEqual(d.paths, []);
  assert.deepStrictEqual(d.prs, []);
});

test('AC5: prose mention of a path (no claim verb) does not trigger', () => {
  const d = v.detect('See scripts/global/foo.js for the existing behavior and config/bar.yml too.');
  assert.strictEqual(d.hasClaim, false);
  assert.deepStrictEqual(d.paths, []);
});

test('AC5: bare mutation verb with no artifact is not a checkable claim', () => {
  const d = v.detect('Updated the wording and clarified the intent.');
  assert.strictEqual(d.hasClaim, false);
});

test('AC5: URL containing a path-like segment is not mined as a repo path', () => {
  const d = v.detect('Completed; details at https://example.com/scripts/global/foo.js here.');
  assert.strictEqual(d.hasClaim, true); // "Completed" is a strong claim
  assert.deepStrictEqual(d.paths, []);   // ...but the path lived inside a URL
});

// ---- AC5: legitimate-claim recognition (claim + verifiable merge) -----------

test('AC5: legit claim with present path + merged PR yields no violations', () => {
  const d = v.detect('Added scripts/global/bar.js; merged via PR #10.');
  assert.strictEqual(d.hasClaim, true);
  assert.deepStrictEqual(d.paths, ['scripts/global/bar.js']);
  assert.deepStrictEqual(d.prs, [10]);
  const r = v.classify(d, {
    pathPresence: { 'scripts/global/bar.js': true },
    prMergedAt: { 10: '2026-06-01T00:00:00Z' },
  });
  assert.strictEqual(r.ok, true);
  assert.strictEqual(r.violations.length, 0);
});

// ---- AC5: dangling-claim detection -----------------------------------------

test('AC2: cited path absent from default branch HEAD -> dangling-path-claim', () => {
  const d = v.detect('Created scripts/global/ghost.js — remediation actions taken.');
  assert.ok(d.paths.includes('scripts/global/ghost.js'));
  const r = v.classify(d, { pathPresence: { 'scripts/global/ghost.js': false }, prMergedAt: {} });
  assert.strictEqual(r.ok, false);
  assert.strictEqual(r.violations[0].rule, 'dangling-path-claim');
  assert.strictEqual(r.violations[0].path, 'scripts/global/ghost.js');
});

test('AC3: cited PR with null mergedAt -> dangling-pr-claim', () => {
  const d = v.detect('Completed and merged in PR #99.');
  assert.ok(d.prs.includes(99));
  const r = v.classify(d, { pathPresence: {}, prMergedAt: { 99: null } });
  assert.strictEqual(r.ok, false);
  assert.strictEqual(r.violations[0].rule, 'dangling-pr-claim');
  assert.strictEqual(r.violations[0].pr, 99);
});

test('AC3: #N that resolves to an issue (not a PR) is out of scope', () => {
  const d = v.detect('Completed via pull #1889.');
  const r = v.classify(d, { pathPresence: {}, prMergedAt: { 1889: 'not-a-pr' } });
  assert.strictEqual(r.ok, true);
});

test('classify fail-open: unresolved citation is skipped (advisory never fabricates)', () => {
  const d = v.detect('Shipped scripts/global/maybe.js.');
  const r = v.classify(d, { pathPresence: {}, prMergedAt: {} }); // nothing resolved
  assert.strictEqual(r.ok, true);
});

test('seed incident #1874 shape: stale PR reference caught', () => {
  const d = v.detect('ADMIN_HANDOFF: merged via PR #1880.');
  const r = v.classify(d, { pathPresence: {}, prMergedAt: { 1880: null } });
  assert.strictEqual(r.violations.length, 1);
  assert.strictEqual(r.violations[0].pr, 1880);
});

// ---- AC4: run() posts exactly one advisory comment, skips its own ----------

function mockGithub({ present = {}, merged = {} } = {}) {
  const calls = { comments: [] };
  return {
    calls,
    rest: {
      repos: {
        async getContent({ path }) {
          if (present[path]) return { data: {} };
          const err = new Error('Not Found'); err.status = 404; throw err;
        },
      },
      pulls: {
        async get({ pull_number }) {
          if (Object.prototype.hasOwnProperty.call(merged, pull_number)) {
            return { data: { merged_at: merged[pull_number] } };
          }
          const err = new Error('Not Found'); err.status = 404; throw err;
        },
      },
      issues: {
        async createComment(a) { calls.comments.push(a); },
      },
    },
  };
}

function ctx(commentBody, issueNumber = 1889) {
  return {
    repo: { owner: 'chf3198', repo: 'megingjord-harness' },
    payload: {
      comment: { body: commentBody, id: 1, user: { type: 'User' } },
      issue: { number: issueNumber },
      repository: { default_branch: 'main' },
    },
  };
}

test('AC4: run posts advisory for a dangling path claim', async () => {
  const gh = mockGithub({ present: {} });
  await v.run({ github: gh, context: ctx('Created scripts/global/ghost.js — completed.'), core: {} });
  assert.strictEqual(gh.calls.comments.length, 1);
  assert.match(gh.calls.comments[0].body, /completion-claim-truth \(advisory\)/);
  assert.match(gh.calls.comments[0].body, /dangling-path-claim/);
});

test('AC4: run stays silent when claim is backed by ground truth', async () => {
  const gh = mockGithub({ present: { 'scripts/global/bar.js': true }, merged: { 10: '2026-06-01T00:00:00Z' } });
  await v.run({ github: gh, context: ctx('Added scripts/global/bar.js; merged via PR #10.'), core: {} });
  assert.strictEqual(gh.calls.comments.length, 0);
});

test('AC4: run skips its own advisory comment (no feedback loop)', async () => {
  const gh = mockGithub();
  await v.run({ github: gh, context: ctx(`${v.ADVISORY_MARKER}\ncompleted scripts/global/ghost.js`), core: {} });
  assert.strictEqual(gh.calls.comments.length, 0);
});

test('AC4: run is a no-op on comments with no claim language', async () => {
  const gh = mockGithub();
  await v.run({ github: gh, context: ctx('Thanks, this looks reasonable. See scripts/global/foo.js.'), core: {} });
  assert.strictEqual(gh.calls.comments.length, 0);
});

// AC6 adversarial-input stress + perf budget lives in the canonical stress
// path: tests/stress-completion-claim-truth.spec.js (npm run stress:completion-claim-truth).
