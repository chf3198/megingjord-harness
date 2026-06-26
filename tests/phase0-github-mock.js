'use strict';
// Shared octokit mock for Phase-0->Phase-1 promotion-gate specs (Epic #2678).
// NOT a *.spec.js — the split-test-runner ignores it; specs require it.
//
// issues: { <num>: { state, labels:[names], body } }
// commentsByIssue: { <num>: [{ body }] }
// failGetFor: Set of issue numbers whose issues.get throws (chaos injection).

function makeGithub({ issues = {}, commentsByIssue = {}, failGetFor = new Set() } = {}) {
  const created = [];
  const postedComments = [];
  const updates = [];
  const rest = {
    issues: {
      get: async ({ issue_number }) => {
        if (failGetFor.has(issue_number)) { const e = new Error('injected fault'); e.status = 500; throw e; }
        const i = issues[issue_number];
        if (!i) { const e = new Error('Not Found'); e.status = 404; throw e; }
        return { data: { number: issue_number, state: i.state, body: i.body || '', labels: (i.labels || []).map((n) => ({ name: n })) } };
      },
      listComments: async ({ issue_number }) => ({ data: commentsByIssue[issue_number] || [] }),
      create: async ({ title, body, labels }) => {
        const number = 9000 + created.length;
        created.push({ number, title, body, labels });
        return { data: { number } };
      },
      createComment: async ({ issue_number, body }) => { postedComments.push({ issue_number, body }); return { data: {} }; },
      updateComment: async ({ comment_id, body }) => { postedComments.push({ comment_id, body, update: true }); return { data: {} }; },
      update: async ({ issue_number, state }) => { updates.push({ issue_number, state }); return { data: {} }; },
    },
  };
  const github = { rest, paginate: async (fn, params) => (await fn(params)).data };
  return { github, created, postedComments, updates };
}

function makeCore() {
  const calls = { setFailed: [], warning: [], notice: [] };
  return {
    core: {
      setFailed: (m) => calls.setFailed.push(m),
      warning: (m) => calls.warning.push(m),
      notice: (m) => calls.notice.push(m),
    },
    calls,
  };
}

module.exports = { makeGithub, makeCore };
