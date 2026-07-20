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

// #3826: build a VALID plan-rating fixture — a real 2-family PASS receipt over an
// in-memory hash-chained ledger + the committed PLAN_RATING comment that binds it.
// Green-path specs attach `.comment` to the Epic and pass `.ledger` to resolve().
const rc = require('../scripts/global/cross-family-receipt');
function buildLedger(entries) {
  let prev = '';
  const all = [];
  for (const e of entries) {
    const seq = all.filter((x) => x.ticket === e.ticket && x.kind === e.kind).length;
    const full = { ...e, seq };
    full.chain = rc.chainHash(prev, full);
    prev = full.chain;
    all.push(full);
  }
  return all;
}
function validPlanRating(epicNumber, o = {}) {
  const median = o.median ?? 93;
  const families = o.families ?? 3;
  const gwet = o.gwet ?? 0.71;
  const base = { ticket: epicNumber, kind: 'review', verdict: 'PASS', ts: '2026-01-01T00:00:00Z',
    prompt_sha256: rc.sha(`plan-rating-${epicNumber}`) };
  const ledger = buildLedger([
    { ...base, provider: 'groq', family: 'meta', response_sha256: rc.sha(`meta-${epicNumber}`) },
    { ...base, provider: 'mistral', family: 'mistral', response_sha256: rc.sha(`mistral-${epicNumber}`) },
  ]);
  const receipt = rc.computeReceipt(ledger.filter((e) => e.ticket === epicNumber && e.kind === 'review'));
  const comment = { body: `## PLAN_RATING\nplan_rating_receipt: ${receipt}\nplan_rating_median: ${median}\n`
    + `plan_rating_distinct_families: ${families}\nplan_rating_gwet_ac1: ${gwet}` };
  return { comment, ledger, receipt };
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

module.exports = { makeGithub, makeCore, validPlanRating, buildLedger };
