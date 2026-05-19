#!/usr/bin/env node
'use strict';
// pre-pr-gate (#1894 Phase-1: #1896 + #1897 + #1902) — local pre-PR gate
// covering three trap classes recurring across both teams in 24h:
// (1) all 4 baton artifacts must exist on linked issue before PR creation
// (2) PR body draft (if available) must contain Refs #N + Closes #N matching
//     branch lead-N (parsed from feat/<N>-... pattern)
// (3) COLLABORATOR_HANDOFF must predate (NOW - 60s) — retroactive-planting
//     check before PR is opened, mirroring server-side evidence-completeness.

const { execFileSync } = require('node:child_process');
const fs = require('node:fs');

const PREDATE_WINDOW_SECONDS = 60;
const ARTIFACTS = ['MANAGER_HANDOFF', 'COLLABORATOR_HANDOFF', 'ADMIN_HANDOFF', 'CONSULTANT_CLOSEOUT'];

function gh(args) {
  try { return execFileSync('gh', args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }); }
  catch (err) { return err.stdout?.toString('utf8') || ''; }
}

function getCurrentBranch() {
  try { return execFileSync('git', ['rev-parse', '--abbrev-ref', 'HEAD'], { encoding: 'utf8' }).trim(); }
  catch { return ''; }
}

function extractLeadTicket(branch) {
  const match = String(branch || '').match(/^(?:feat|fix|hotfix|chore|skill)\/(\d+)-/);
  return match ? Number(match[1]) : null;
}

function fetchIssueComments(ticket) {
  try { return JSON.parse(gh(['issue', 'view', String(ticket), '--json', 'comments'])).comments || []; }
  catch { return []; }
}

function findArtifact(comments, kind) {
  for (let i = comments.length - 1; i >= 0; i -= 1) {
    if ((comments[i].body || '').includes(kind)) return comments[i];
  }
  return null;
}

function checkBatonCompleteness(comments) {
  const missing = ARTIFACTS.filter(kind => !findArtifact(comments, kind));
  return missing.length === 0 ? null : { rule: 'baton-incomplete',
    detail: `Linked issue missing ${missing.length} baton: ${missing.join(', ')}` };
}

function checkPredateWindow(comments, nowMs) {
  const collab = findArtifact(comments, 'COLLABORATOR_HANDOFF');
  if (!collab) return null;
  const age = (nowMs - new Date(collab.createdAt).getTime()) / 1000;
  return age >= PREDATE_WINDOW_SECONDS ? null : { rule: 'predate-window-not-elapsed',
    detail: `COLLAB posted ${age.toFixed(1)}s ago; need ≥${PREDATE_WINDOW_SECONDS}s. Wait ${(PREDATE_WINDOW_SECONDS - age).toFixed(1)}s.` };
}

function checkClosesKeyword(prBodyDraft, leadTicket) {
  if (prBodyDraft === null || prBodyDraft === undefined) return null;
  const refs = new RegExp(`\\bRefs\\s+#${leadTicket}\\b`, 'i').test(prBodyDraft);
  const closes = new RegExp(`\\b(Closes|Fixes|Resolves)\\s+#${leadTicket}\\b`, 'i').test(prBodyDraft);
  const missing = [];
  if (!refs) missing.push(`Refs #${leadTicket}`);
  if (!closes) missing.push(`Closes #${leadTicket}`);
  return missing.length === 0 ? null : { rule: 'pr-body-keyword-missing', detail: `PR body missing: ${missing.join(', ')}` };
}

function check(opts = {}) {
  const branch = opts.branch || getCurrentBranch();
  const leadTicket = opts.leadTicket || extractLeadTicket(branch);
  if (!leadTicket) {
    return { ok: true, skipped: 'non-feat-branch', branch, violations: [] };
  }
  const comments = opts.comments || fetchIssueComments(leadTicket);
  const violations = [];
  const baton = checkBatonCompleteness(comments);
  if (baton) violations.push(baton);
  const predate = checkPredateWindow(comments, opts.now || Date.now());
  if (predate) violations.push(predate);
  const closes = checkClosesKeyword(opts.prBodyDraft, leadTicket);
  if (closes) violations.push(closes);
  return { ok: violations.length === 0, leadTicket, branch, violations };
}

if (require.main === module) {
  const prBodyDraft = process.env.PR_BODY_DRAFT || (process.argv.includes('--body') ?
    fs.readFileSync(process.argv[process.argv.indexOf('--body') + 1], 'utf8') : null);
  const result = check({ prBodyDraft });
  if (process.argv.includes('--json')) process.stdout.write(JSON.stringify(result, null, 2) + '\n');
  else if (result.skipped) process.stdout.write(`pre-pr-gate: SKIP (${result.skipped})\n`);
  else if (result.ok) process.stdout.write(`pre-pr-gate: PASS #${result.leadTicket}\n`);
  else {
    process.stderr.write(`pre-pr-gate: FAIL #${result.leadTicket}\n`);
    for (const violation of result.violations) process.stderr.write(`  - ${violation.rule}: ${violation.detail}\n`);
  }
  process.exit(result.ok ? 0 : 1);
}

module.exports = { check, checkBatonCompleteness, checkPredateWindow, checkClosesKeyword,
  extractLeadTicket, ARTIFACTS, PREDATE_WINDOW_SECONDS };
