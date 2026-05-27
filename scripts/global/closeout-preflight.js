'use strict';

const { execFileSync } = require('node:child_process');
const megalint = require('./megalint');
const { execute } = require('./github-dispatcher');

function extractIssueFromBranch(branch) {
  const m = String(branch || '').match(/(?:feat|fix|chore|docs|refactor|perf|hotfix)\/(\d+)-/i);
  return m ? Number(m[1]) : null;
}
function currentBranch() {
  return (process.env.CLOSEOUT_PREFLIGHT_BRANCH || execFileSync('git', ['rev-parse', '--abbrev-ref', 'HEAD'], { encoding: 'utf8' })).trim();
}
async function readIssue(issueNum, opts = {}) {
  if (process.env.CLOSEOUT_PREFLIGHT_ISSUE_JSON) return JSON.parse(process.env.CLOSEOUT_PREFLIGHT_ISSUE_JSON);
  const res = await execute('get-issue', { issue: issueNum, json: 'body,comments,title,labels,state' }, opts);
  if (!res.ok) throw new Error(res.error || res.reason || 'issue lookup failed');
  if (res.provider === 'gh-cli') return JSON.parse(res.stdout || '{}');
  const payload = res.result?.issue || res.result;
  if (!payload || typeof payload !== 'object') throw new Error('invalid MCP issue payload');
  return payload;
}
function normalizeComments(comments) {
  return (comments || []).map((c) => ({ body: c.body || '', user: c.user ? { login: c.user.login } : undefined }));
}
function normalizeLabels(labels) {
  return (labels || []).map((l) => (typeof l === 'string' ? l : l.name)).filter(Boolean);
}
function deriveLaneFromLabels(labels) {
  return (labels || []).find((l) => typeof l === 'string' && l.startsWith('lane:')) || 'lane:code-change';
}
function toValidatorInput(issue, issueNum, branch) {
  const body = issue.body || '';
  const labels = normalizeLabels(issue.labels);
  return {
    body, comments: normalizeComments(issue.comments), labels, lane: deriveLaneFromLabels(labels),
    prBody: '', state: issue.state || 'open', ticketRef: issueNum, branch,
    isEpic: /\bEPIC\b/i.test(issue.title || '') || /##\s*Epic Summary/i.test(body),
  };
}
async function fetchPrBody(branch, opts = {}) {
  if (process.env.CLOSEOUT_PREFLIGHT_PR_BODY) return process.env.CLOSEOUT_PREFLIGHT_PR_BODY.trim();
  try {
    const res = await execute('get-pull-request', { issue: branch, json: 'body' }, opts);
    if (!res.ok) return null;
    if (res.provider === 'gh-cli') return (JSON.parse(res.stdout || '{}').body || '').trim();
    const payload = res.result?.pullRequest || res.result || {};
    return typeof payload.body === 'string' ? payload.body.trim() : null;
  } catch { return null; }
}

async function run(opts = {}) {
  if (process.env.SKIP_CLOSEOUT_PREFLIGHT === '1') { console.log('closeout-preflight: skipped (SKIP_CLOSEOUT_PREFLIGHT=1)'); return 0; }
  const branch = currentBranch();
  const issueNum = extractIssueFromBranch(branch);
  if (!issueNum) { console.log('closeout-preflight: skip (no ticket branch)'); return 0; }
  let issue;
  try { issue = await readIssue(issueNum, opts); }
  catch (error) { console.error(`closeout-preflight: unable to load issue #${issueNum}: ${error.message}`); return 1; }
  const input = toValidatorInput(issue, issueNum, branch);
  const prBody = await fetchPrBody(branch, opts);
  if (prBody !== null) input.prBody = prBody;
  const validators = ['manager-handoff', 'consultant-closeout'];
  if (prBody !== null) validators.push('merge-evidence-pr-gate');
  let failed = false;
  for (const name of validators) {
    const r = megalint.run(name, { ...input, issueNumber: issueNum });
    if (r.ok) continue;
    failed = true; console.error(`closeout-preflight: FAIL [${name}] #${issueNum}`);
    for (const v of r.violations || []) console.error(`  - ${v.rule}: ${v.detail}`);
  }
  if (failed) return 1;
  console.log(`closeout-preflight: PASS #${issueNum}`);
  return 0;
}

if (require.main === module) run().then((code) => process.exit(code));

module.exports = { extractIssueFromBranch, readIssue, fetchPrBody, toValidatorInput, run };
