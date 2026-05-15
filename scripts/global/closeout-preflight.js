'use strict';

const { execFileSync } = require('node:child_process');
const megalint = require('./megalint');

function extractIssueFromBranch(branch) {
  const match = String(branch || '').match(/(?:feat|fix|chore|docs|refactor|perf|hotfix)\/(\d+)-/i);
  return match ? Number(match[1]) : null;
}

function currentBranch() {
  return (process.env.CLOSEOUT_PREFLIGHT_BRANCH || execFileSync('git', ['rev-parse', '--abbrev-ref', 'HEAD'], { encoding: 'utf8' })).trim();
}

function readIssue(issueNum) {
  if (process.env.CLOSEOUT_PREFLIGHT_ISSUE_JSON) return JSON.parse(process.env.CLOSEOUT_PREFLIGHT_ISSUE_JSON);
  return JSON.parse(execFileSync('gh', ['issue', 'view', String(issueNum), '--json', 'body,comments,title,labels,state'], { encoding: 'utf8' }));
}

function normalizeComments(comments) {
  return (comments || []).map(comment => ({ body: comment.body || '', user: comment.user ? { login: comment.user.login } : undefined }));
}

function normalizeLabels(labels) {
  return (labels || []).map(label => (typeof label === 'string' ? label : label.name)).filter(Boolean);
}

function toValidatorInput(issue, issueNum, branch) {
  const body = issue.body || '';
  return {
    body,
    comments: normalizeComments(issue.comments),
    labels: normalizeLabels(issue.labels),
    lane: 'lane:code-change',
    prBody: '',
    state: issue.state || 'open',
    ticketRef: issueNum,
    branch,
    isEpic: /\bEPIC\b/i.test(issue.title || '') || /##\s*Epic Summary/i.test(body),
  };
}

function fetchPrBody(branch) {
  try {
    return execFileSync(
      'gh', ['pr', 'view', branch, '--json', 'body', '-q', '.body'],
      { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }
    ).trim();
  } catch { return null; }
}

function run() {
  if (process.env.SKIP_CLOSEOUT_PREFLIGHT === '1') {
    console.log('closeout-preflight: skipped (SKIP_CLOSEOUT_PREFLIGHT=1)');
    return 0;
  }
  const branch = currentBranch();
  const issueNum = extractIssueFromBranch(branch);
  if (!issueNum) {
    console.log('closeout-preflight: skip (no ticket branch)');
    return 0;
  }
  let issue;
  try {
    issue = readIssue(issueNum);
  } catch (error) {
    console.error(`closeout-preflight: unable to load issue #${issueNum}: ${error.message}`);
    return 1;
  }
  const input = toValidatorInput(issue, issueNum, branch);
  const prBody = fetchPrBody(branch);
  if (prBody !== null) input.prBody = prBody;
  const validators = ['manager-handoff', 'consultant-closeout'];
  if (prBody !== null) validators.push('merge-evidence-pr-gate');
  let failed = false;
  for (const name of validators) {
    const r = megalint.run(name, { ...input, issueNumber: issueNum });
    if (!r.ok) {
      failed = true;
      console.error(`closeout-preflight: FAIL [${name}] #${issueNum}`);
      for (const v of r.violations || []) console.error(`  - ${v.rule}: ${v.detail}`);
    }
  }
  if (failed) return 1;
  console.log(`closeout-preflight: PASS #${issueNum}`);
  return 0;
}

if (require.main === module) process.exit(run());

module.exports = { extractIssueFromBranch, readIssue, toValidatorInput, run };