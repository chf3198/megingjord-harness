'use strict';

const { execFileSync } = require('node:child_process');
const megalint = require('./megalint');
const { execute } = require('./github-dispatcher');
const batonBack = require('./baton-back');

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

// #3657: local changed-file set — the pre-push analogue of CI's pulls.listFiles.
// Feeds collaborator-handoff doc-coverage diff-verify + changelog-fragment-presence
// so both run at the SAME strictness CI uses. Best-effort: [] (or the env override,
// for tests) on any git error; downstream diff-verify is advisory so [] never
// false-blocks a legitimate push.
function localChangedFiles() {
  if (process.env.CLOSEOUT_PREFLIGHT_PR_FILES !== undefined) {
    return process.env.CLOSEOUT_PREFLIGHT_PR_FILES.split(',').map((s) => s.trim()).filter(Boolean);
  }
  try {
    const base = execFileSync('git', ['merge-base', 'HEAD', 'origin/main'], { encoding: 'utf8' }).trim();
    return execFileSync('git', ['diff', '--name-only', '--diff-filter=ACMR', base, 'HEAD'], { encoding: 'utf8' })
      .split('\n').map((s) => s.trim()).filter(Boolean);
  } catch { return []; }
}

// #3169: deferred-final flow — the CONSULTANT_CLOSEOUT is meant to cite the PR,
// which does not exist at first push. Forcing the consultant-closeout check at
// pre-push inverts the baton (teams post the closeout before the PR). Defer the
// consultant-closeout check to PR-open: require it only once the PR exists, OR
// validate an already-posted closeout if a team posts one early. Downstream
// enforcement (required CI consultant-gate, merge-evidence-pr-gate, and the
// pretool_guard merge-recorded close gate) keeps the closeout mandatory before
// merge and issue close, so deferral relaxes ordering, never enforcement.
// Match an actual CONSULTANT_CLOSEOUT *artifact* (a comment whose body carries the
// artifact header), NOT a prose mention of the string — other baton artifacts
// (MANAGER_HANDOFF, EDD, COLLABORATOR_HANDOFF) routinely reference "CONSULTANT_CLOSEOUT"
// in their text, which an unanchored match would wrongly treat as a posted closeout.
const CLOSEOUT_ARTIFACT_RE = /(?:^|\n)\s*(?:##\s*)?CONSULTANT_CLOSEOUT\b/i;
function hasCloseoutComment(comments) {
  return (comments || []).some((c) => CLOSEOUT_ARTIFACT_RE.test(c.body || ''));
}

// #3328: a posted COLLABORATOR_HANDOFF *artifact* (header on its own line), not a
// prose mention inside another artifact. Anchored like CLOSEOUT_ARTIFACT_RE so a
// MANAGER_HANDOFF that names "COLLABORATOR_HANDOFF" in its scope text never trips it.
const COLLAB_HANDOFF_ARTIFACT_RE = /(?:^|\n)\s*(?:\*\*|##\s*)?COLLABORATOR_HANDOFF\b/i;
function hasCollaboratorHandoff(comments) {
  return (comments || []).some((c) => COLLAB_HANDOFF_ARTIFACT_RE.test(c.body || ''));
}

// #3657 shift-left CI parity: the automatic pre-push gate now runs the SAME
// baton-artifact validators CI's baton-gates runs, at the SAME strictness, gated on
// the same artifact-presence conditions — so artifact-FORMAT errors (the #3631
// cascade: cross_family_receipt underscore, worktree_behind_main, missing changelog
// fragment, per-AC/verification block, doc-coverage surface-as-key) fail BEFORE
// PR-open instead of one-by-one at CI. Once a COLLABORATOR_HANDOFF is posted the
// full collaborator-handoff validator runs (superset of the #3328 doc-coverage
// slice); doc-coverage is retained for its granular message. CI-OWNED rules below
// are the cross-family ledger-membership ANTI-FORGERY checks (#3678 F1) that need
// the merge-time consensus evidence bundle — they remain hard-blocking at CI and
// the merge FSM, so deferring them LOCALLY scopes the shift-left gate to the format
// class and is NOT parity-lowering of the anti-forgery gate.
const CI_OWNED_RULES = new Set(['cross-family-receipt-unledgered', 'cross-family-receipt-ledger-tampered']);
function selectPreflightValidators(prExists, closeoutAlreadyPosted, collaboratorHandoffPosted) {
  const validators = ['manager-handoff'];
  if (collaboratorHandoffPosted) validators.push('doc-coverage', 'collaborator-handoff');
  const enforceCloseoutNow = prExists || closeoutAlreadyPosted;
  if (enforceCloseoutNow) validators.push('consultant-closeout');
  if (prExists) validators.push('merge-evidence-pr-gate');
  return { validators, closeoutDeferred: !enforceCloseoutNow };
}

// #3657: changelog-fragment-presence is a hard CI gate for lane:code-change with no
// local pre-push parity (the #3691 named instance: a bad fragment shipped and
// surfaced only at CI). Run the SAME validator once the collaborator handoff is
// posted — the point the fragment is required (collaborator-preflight enforces it
// before COLLABORATOR_HANDOFF), and earlier than CI's PR-open check — resolving the
// ticket from the branch when no PR body exists yet. Returns true when it blocks.
function changelogParityBlocks(input, prBody, issueNum) {
  const res = megalint.run('changelog-fragment-presence',
    { labels: input.labels, prBody: prBody || `Refs #${issueNum}`, prFiles: input.prFiles });
  if (res.ok) return false;
  console.error(`closeout-preflight: FAIL [changelog-fragment] #${issueNum} — ${res.reason}`);
  return true;
}

// #3657: signer-fidelity is a per-artifact hard CI check; run it locally over each
// posted baton artifact body so alias / Team&Model / role defects fail before
// PR-open. Only posted artifacts are checked, so pre-artifact pushes never false-fail.
const ARTIFACT_RES = [
  /(?:^|\n)\s*(?:\*\*|##\s*)?MANAGER_HANDOFF\b/i,
  COLLAB_HANDOFF_ARTIFACT_RE,
  /(?:^|\n)\s*(?:\*\*|##\s*)?ADMIN_HANDOFF\b/i,
  CLOSEOUT_ARTIFACT_RE,
];
function signerParityBlocks(comments, issueNum) {
  let blocked = false;
  for (const re of ARTIFACT_RES) {
    const hit = (comments || []).find((c) => re.test(c.body || ''));
    if (!hit) continue;
    const res = megalint.run('signer-fidelity', { body: hit.body });
    const blocking = (res.violations || []).filter((v) => v.severity !== 'advisory' && !CI_OWNED_RULES.has(v.rule));
    if (!blocking.length) continue;
    blocked = true; console.error(`closeout-preflight: FAIL [signer-fidelity] #${issueNum}`);
    for (const v of blocking) console.error(`  - ${v.rule}: ${v.detail}`);
  }
  return blocked;
}

// Baton-back close-gate invariant (#3257): a ticket may not close while a
// baton-back marker is still open on the timeline. Enforce only when the
// closeout itself is being enforced (not deferred), so it gates close-time,
// not ordinary intermediate pushes. Returns true when the gate blocks.
function batonBackGateBlocks(comments, closeoutDeferred, issueNum) {
  if (closeoutDeferred || !batonBack.anyOpen(comments)) return false;
  console.error(`closeout-preflight: FAIL [baton-back-close-gate] #${issueNum} — open baton-back marker; remediate + clear before close`);
  return true;
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
  input.prFiles = localChangedFiles();
  const prBody = await fetchPrBody(branch, opts);
  if (prBody !== null) input.prBody = prBody;
  const collaboratorHandoffPosted = hasCollaboratorHandoff(input.comments);
  const { validators, closeoutDeferred } = selectPreflightValidators(
    prBody !== null, hasCloseoutComment(input.comments), collaboratorHandoffPosted);
  if (closeoutDeferred) {
    console.log(`closeout-preflight: consultant-closeout deferred to PR-open (deferred-final flow; no PR yet) #${issueNum}`);
  }
  let failed = batonBackGateBlocks(input.comments, closeoutDeferred, issueNum);
  for (const name of validators) {
    const result = megalint.run(name, { ...input, issueNumber: issueNum });
    // #3657: filter CI-owned anti-forgery rules from the LOCAL verdict (still hard at CI).
    const violations = (result.violations || []).filter((v) => !CI_OWNED_RULES.has(v.rule));
    const blocking = violations.filter((v) => v.severity !== 'advisory');
    if (!blocking.length) continue;
    failed = true; console.error(`closeout-preflight: FAIL [${name}] #${issueNum}`);
    for (const violation of blocking) console.error(`  - ${violation.rule}: ${violation.detail}`);
  }
  // #3657: parity checks that need tailored inputs (not the shared issue input).
  // Both gate on a posted COLLABORATOR_HANDOFF — the lifecycle point the fragment /
  // signer set is required — so pre-artifact pushes are never false-failed.
  if (collaboratorHandoffPosted && changelogParityBlocks(input, prBody, issueNum)) failed = true;
  if (collaboratorHandoffPosted && signerParityBlocks(input.comments, issueNum)) failed = true;
  if (failed) return 1;
  console.log(`closeout-preflight: PASS #${issueNum}`);
  return 0;
}

if (require.main === module) run().then((code) => process.exit(code));

module.exports = { extractIssueFromBranch, readIssue, fetchPrBody, toValidatorInput, run,
  hasCloseoutComment, hasCollaboratorHandoff, selectPreflightValidators, batonBackGateBlocks,
  localChangedFiles, changelogParityBlocks, signerParityBlocks, CI_OWNED_RULES };
