#!/usr/bin/env node
'use strict';
// tier: 1
// ticket-activate.js (#3045): Copilot-invokable CLI that writes the shared
// active_ticket governance state used by the pretool ticket-gate. Requires a
// real linked GitHub issue AND a ticket-conforming branch; refuses otherwise.
// Mirrors the state shape used by hooks/scripts/state_store.py.
//
// Usage: node scripts/global/ticket-activate.js --ticket N [--cwd /path] [--json]

const crypto = require('node:crypto');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const BRANCH_RE = /^(?:feat|fix|hotfix|chore|skill)\/(\d+)(?:-|$)/;
const STATE_ROOT = path.join(os.homedir(), '.copilot', 'hooks', 'state');
const GIT_TIMEOUT_MS = 5000;
const GH_TIMEOUT_MS = 15000;

function parseArgs(argv) {
  const args = { ticket: null, cwd: process.cwd(), json: false };
  for (let idx = 0; idx < argv.length; idx++) {
    if (argv[idx] === '--ticket' && argv[idx + 1]) {
      args.ticket = Number(argv[++idx]);
    } else if (argv[idx] === '--cwd' && argv[idx + 1]) {
      args.cwd = argv[++idx];
    } else if (argv[idx] === '--json') {
      args.json = true;
    }
  }
  return args;
}

function repoKey(cwd) {
  return crypto.createHash('sha1').update(cwd).digest('hex').slice(0, 16);
}

function sessionShort() {
  const env = process.env.MEGINGJORD_SESSION_ID || '';
  if (env) return env.slice(0, 8);
  const sidFile = path.join(os.homedir(), '.megingjord', 'session.id');
  try {
    const raw = fs.readFileSync(sidFile, 'utf8').trim();
    return raw ? raw.slice(0, 8) : 'nosession';
  } catch { return 'nosession'; }
}

function statePaths(cwd) {
  const key = repoKey(cwd);
  const session = sessionShort();
  return {
    session: path.join(STATE_ROOT, `repo-${key}-${session}.json`),
    nosession: path.join(STATE_ROOT, `repo-${key}-nosession.json`),
  };
}

function loadStateFile(filePath) {
  try {
    const raw = fs.readFileSync(filePath, 'utf8');
    const parsed = JSON.parse(raw);
    return typeof parsed === 'object' && parsed !== null ? parsed : {};
  } catch { return {}; }
}

function saveStateFile(filePath, state) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  const tmp = `${filePath}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(state, null, 2), { encoding: 'utf8' });
  fs.renameSync(tmp, filePath);
}

function currentBranch(cwd) {
  try {
    return execFileSync('git', ['-C', cwd, 'rev-parse', '--abbrev-ref', 'HEAD'],
      { encoding: 'utf8', timeout: GIT_TIMEOUT_MS }).trim();
  } catch { return null; }
}

function verifyIssue(ticketNum, cwd) {
  try {
    const out = execFileSync('gh', ['issue', 'view', String(ticketNum), '--json', 'number,state'],
      { cwd, encoding: 'utf8', timeout: GH_TIMEOUT_MS });
    const data = JSON.parse(out);
    return data && typeof data.number === 'number' && data.state !== 'CLOSED'
      ? { ok: true, number: data.number, state: data.state }
      : { ok: false, reason: `issue #${ticketNum} is closed or not found` };
  } catch (err) {
    return { ok: false, reason: `gh issue view failed: ${err.message}` };
  }
}

// Validate activation preconditions: positive ticket, ticket-shaped branch that
// matches, and a real (non-closed) linked issue. Returns {ok,ticket,branch} or {ok:false,reason}.
function validateActivation(opts) {
  const { ticket, cwd } = opts;
  if (!ticket || !Number.isFinite(ticket) || ticket <= 0) {
    return { ok: false, reason: 'invalid or missing --ticket N (positive integer required)' };
  }
  const branch = currentBranch(cwd);
  if (!branch) {
    return { ok: false, reason: 'could not determine current git branch (not a git repo?)' };
  }
  const branchMatch = BRANCH_RE.exec(branch);
  if (!branchMatch) {
    return { ok: false,
      reason: `branch "${branch}" is not ticket-shaped; rename to feat/${ticket}-slug or fix/${ticket}-slug first` };
  }
  if (Number(branchMatch[1]) !== ticket) {
    return { ok: false, reason: `branch ticket #${branchMatch[1]} does not match --ticket ${ticket}` };
  }
  const issue = verifyIssue(ticket, cwd);
  return issue.ok ? { ok: true, ticket, branch } : { ok: false, reason: issue.reason };
}

function activate(opts) {
  const pre = validateActivation(opts);
  if (!pre.ok) return pre;
  const { ticket, branch } = pre;
  const { cwd } = opts;
  const paths = statePaths(cwd);
  for (const filePath of [paths.session, paths.nosession]) {
    const state = loadStateFile(filePath);
    state.cwd = cwd;
    state.active_ticket = ticket;
    state.active_branch = branch;
    if (!state.roles) state.roles = {};
    state.roles.manager = true;
    saveStateFile(filePath, state);
  }
  return { ok: true, ticket, branch, stateFiles: [paths.session, paths.nosession] };
}

module.exports = { activate, parseArgs, repoKey, sessionShort, statePaths, currentBranch };

if (require.main === module) {
  const args = parseArgs(process.argv.slice(2));
  const result = activate({ ticket: args.ticket, cwd: args.cwd });
  if (args.json) {
    process.stdout.write(JSON.stringify(result, null, 2) + '\n');
  } else if (result.ok) {
    process.stdout.write(`ticket-activate: active_ticket=${result.ticket} branch=${result.branch} state written\n`);
  } else {
    process.stderr.write(`ticket-activate: refused — ${result.reason}\n`);
    process.exit(1);
  }
}
