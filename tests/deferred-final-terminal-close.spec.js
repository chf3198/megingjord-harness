'use strict';

const test = require('node:test');
const assert = require('node:assert');
const mod = require('../scripts/global/deferred-final-terminal-close.js');

function mock({ issueState = 'open', mergedPr = null } = {}) {
  const calls = { update: [], comment: [], query: [] };
  return {
    calls,
    issues: {
      async get() { return { data: { state: issueState } }; },
      async update(args) { calls.update.push(args); },
      async createComment(args) { calls.comment.push(args); },
    },
    search: {
      async issuesAndPullRequests({ q }) {
        calls.query.push(q);
        const items = mergedPr ? [{ number: mergedPr.number, html_url: mergedPr.url, pull_request: {} }] : [];
        return { data: { items } };
      },
    },
  };
}

test('detects closeout header variants', () => {
  assert.equal(mod.hasCloseoutHeader('## CONSULTANT_CLOSEOUT\nverdict: approve'), true);
  assert.equal(mod.hasCloseoutHeader('**CONSULTANT_CLOSEOUT** inline'), true);
  assert.equal(mod.hasCloseoutHeader('plain progress note'), false);
});

test('skip when comment is not a closeout marker', async () => {
  const gh = mock();
  const r = await mod.reconcile({ github: gh, owner: 'o', repo: 'r', issueNumber: 10, commentBody: 'note' });
  assert.equal(r.action, 'skip-non-closeout');
  assert.equal(gh.calls.update.length, 0);
});

test('drift detection: merged deferred-final absent -> no remediation', async () => {
  const gh = mock();
  const r = await mod.reconcile({
    github: gh,
    owner: 'o',
    repo: 'r',
    issueNumber: 11,
    commentBody: '## CONSULTANT_CLOSEOUT\nverdict: approve',
  });
  assert.equal(r.action, 'no-merged-deferred-final');
  assert.equal(gh.calls.update.length, 0);
});

test('remediation: merged deferred-final present -> close + event comment', async () => {
  const gh = mock({ mergedPr: { number: 88, url: 'https://example/pr/88' } });
  const r = await mod.reconcile({
    github: gh,
    owner: 'o',
    repo: 'r',
    issueNumber: 12,
    commentBody: '## CONSULTANT_CLOSEOUT\nverdict: approve',
  });
  assert.equal(r.action, 'closed-after-closeout');
  assert.equal(gh.calls.update[0].state, 'closed');
  assert.match(gh.calls.comment[0].body, /event:goal-failure-escalation/);
  assert.match(gh.calls.query[0], /merge-evidence-deferred-final/);
});
