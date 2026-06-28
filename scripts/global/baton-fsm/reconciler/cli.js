#!/usr/bin/env node
// cli.js — Thin adapter wiring real gh-backed github client + incidents writer.
// Logic lives in terminal-reconciler, role-drift-janitor, outage-wal.
// Refs #3291, Epic #3284.
'use strict';

const { execSync } = require('node:child_process');
const { writeFileSync, existsSync, mkdirSync } = require('node:fs');
const { join, dirname } = require('node:path');
const { reconcileClose } = require('./terminal-reconciler');
const { sweepTerminalRoles } = require('./role-drift-janitor');
const { replayWal } = require('./outage-wal');

const GH_TIMEOUT_MS = 15000;

const DEFAULT_INCIDENTS_PATH = join(
  process.env.HOME || '/tmp',
  '.megingjord',
  'incidents.jsonl'
);

const DEFAULT_WAL_PATH = join(
  process.env.HOME || '/tmp',
  '.megingjord',
  'reconciler-wal.jsonl'
);

/** Run a gh CLI command and return parsed JSON. */
function ghJson(args) {
  const cmd = 'gh ' + args;
  const output = execSync(cmd, { encoding: 'utf8', timeout: GH_TIMEOUT_MS });
  return JSON.parse(output);
}

/** Run a gh CLI command (no output parsing). */
function ghExec(args) {
  execSync('gh ' + args, { encoding: 'utf8', timeout: GH_TIMEOUT_MS });
}

/** Fetch and normalize an issue from gh CLI. */
function fetchIssue(issueNumber) {
  const raw = ghJson('issue view ' + issueNumber + ' --json number,title,state,labels');
  return {
    number: raw.number,
    title: raw.title,
    state: raw.state,
    labels: (raw.labels || []).map((lbl) => lbl.name || lbl),
  };
}

/** Fetch comments for an issue from gh CLI. */
function fetchComments(issueNumber) {
  const raw = ghJson('issue view ' + issueNumber + ' --json comments');
  return (raw.comments || []).map((cmt) => ({ body: cmt.body || '' }));
}

/** Build the real github client backed by gh CLI. */
function buildGithubClient() {
  return {
    getIssue: fetchIssue,
    listComments: fetchComments,
    reopenIssue(num) { ghExec('issue reopen ' + num); },
    addLabel(num, label) { ghExec('issue edit ' + num + ' --add-label "' + label + '"'); },
    removeLabel(num, label) { ghExec('issue edit ' + num + ' --remove-label "' + label + '"'); },
    comment(num, body) { ghExec('issue comment ' + num + ' --body ' + JSON.stringify(body)); },
  };
}

/** Build an incidents writer that appends JSONL. */
function buildIncidentWriter(incidentsPath) {
  const targetDir = dirname(incidentsPath);
  if (!existsSync(targetDir)) mkdirSync(targetDir, { recursive: true });
  return {
    append(event) {
      const line = JSON.stringify(event) + '\n';
      writeFileSync(incidentsPath, line, { flag: 'a' });
    },
  };
}

/** Handle --reconcile command. */
async function handleReconcile(args, githubClient, incidentWriter) {
  const issueNumber = Number(args[1]);
  if (!issueNumber) {
    console.error('Usage: --reconcile <issue-number>');
    process.exit(1);
  }
  const issue = githubClient.getIssue(issueNumber);
  const result = await reconcileClose(issue, githubClient, incidentWriter);
  console.log(JSON.stringify(result, null, 2));
  return result;
}

/** Handle --sweep-roles command. */
async function handleSweepRoles(args, githubClient, incidentWriter) {
  const applyMode = args.includes('--apply');
  const issueNumbers = args.filter((arg) => /^\d+$/.test(arg)).map(Number);
  const issues = issueNumbers.map((num) => githubClient.getIssue(num));
  const results = await sweepTerminalRoles(
    issues, githubClient, incidentWriter, { dryRun: !applyMode }
  );
  console.log(JSON.stringify(results, null, 2));
  return results;
}

/** Handle --replay-wal command. */
async function handleReplayWal(args, githubClient, incidentWriter) {
  const walPath = args[1] || DEFAULT_WAL_PATH;
  const result = await replayWal(walPath, async (action, seq) => {
    console.log('Replaying seq=' + seq + ' action=' + action.type);
    if (action.type === 'reconcile') {
      const issue = githubClient.getIssue(action.issue);
      await reconcileClose(issue, githubClient, incidentWriter);
      return { applied: true };
    }
    return { applied: false };
  });
  console.log(JSON.stringify(result, null, 2));
  return result;
}

/** Parse CLI arguments and dispatch to the appropriate handler. */
async function main(argv) {
  const args = argv || process.argv.slice(2);
  const command = args[0];
  const githubClient = buildGithubClient();
  const incidentWriter = buildIncidentWriter(DEFAULT_INCIDENTS_PATH);

  const handlers = {
    '--reconcile': handleReconcile,
    '--sweep-roles': handleSweepRoles,
    '--replay-wal': handleReplayWal,
  };
  const handler = handlers[command];
  if (!handler) {
    console.error('Usage: cli.js --reconcile <N> | --sweep-roles [--apply] <N...> | --replay-wal [path]');
    process.exit(1);
  }
  return handler(args, githubClient, incidentWriter);
}

if (require.main === module) {
  main().catch((err) => { console.error(err); process.exit(1); });
}

module.exports = { main, buildGithubClient, buildIncidentWriter };
