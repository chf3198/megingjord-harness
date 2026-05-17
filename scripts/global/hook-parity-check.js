#!/usr/bin/env node
// hook-parity-check (#1824) — three-way diff to discriminate branch-stale from runtime-drift.
// Closes #1824. Composes with the stress-test prompt as a Step-0 pre-check.
'use strict';

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const REPO_ROOT = path.resolve(__dirname, '..', '..');
const HOOK_DIR = path.join(REPO_ROOT, 'hooks', 'scripts');
const COPILOT_DEPLOY = path.join(os.homedir(), '.copilot', 'hooks', 'scripts');
const CODEX_DEPLOY = path.join(os.homedir(), '.codex', 'devenv-ops', 'hooks');

const TRACKED = ['stop_checks.py', 'stop_reminder.py', 'manager_ticket_gate.py',
  'userprompt_gate.py', 'pretool_guard.py', 'tool_activity.py',
  'repo_detection.py', 'state_store.py'];

function read(file) { try { return fs.readFileSync(file, 'utf8'); } catch { return null; } }

function gitShow(rev, file) {
  try { return execFileSync('git', ['show', `${rev}:${file}`], { cwd: REPO_ROOT, encoding: 'utf8' }); }
  catch { return null; }
}

function diagnose(scriptName) {
  const branch = read(path.join(HOOK_DIR, scriptName));
  const main = gitShow('origin/main', `hooks/scripts/${scriptName}`);
  const copilot = read(path.join(COPILOT_DEPLOY, scriptName));
  const codex = read(path.join(CODEX_DEPLOY, scriptName));
  const deployed = copilot || codex;
  const deployState = (copilot === null && codex === null) ? 'not-deployed' : 'deployed';
  if (deployState === 'not-deployed') {
    return { script: scriptName, diagnosis: 'not-deployed', recommend: 'opt-out path: G5 portability respected; no action needed' };
  }
  const branchMatchMain = branch === main;
  const mainMatchDeployed = main === deployed;
  const branchMatchDeployed = branch === deployed;
  if (branchMatchMain && mainMatchDeployed) return { script: scriptName, diagnosis: 'ok', recommend: null };
  if (!branchMatchMain && mainMatchDeployed) return { script: scriptName, diagnosis: 'branch-stale', recommend: 'git rebase origin/main (or merge main into your branch)' };
  if (branchMatchMain && !mainMatchDeployed) return { script: scriptName, diagnosis: 'runtime-stale', recommend: 'npm run deploy:both:apply' };
  if (!branchMatchMain && !mainMatchDeployed && branchMatchDeployed) return { script: scriptName, diagnosis: 'runtime-and-branch-share-fork', recommend: 'rebase onto main + verify deploy' };
  return { script: scriptName, diagnosis: 'branch-and-runtime-diverged', recommend: 'manual reconciliation; file incident ticket' };
}

function run() {
  const results = TRACKED.map(diagnose);
  const byDiag = {};
  for (const r of results) { (byDiag[r.diagnosis] = byDiag[r.diagnosis] || []).push(r.script); }
  const realDrift = results.some(r => r.diagnosis === 'branch-and-runtime-diverged');
  const runtimeStale = results.some(r => r.diagnosis === 'runtime-stale');
  const exitCode = realDrift ? 2 : (runtimeStale ? 1 : 0);
  return { results, byDiagnosis: byDiag, exitCode };
}

if (require.main === module) {
  // Refresh origin/main reference for accurate comparison.
  try { execFileSync('git', ['fetch', 'origin', 'main', '-q'], { cwd: REPO_ROOT, stdio: 'ignore' }); } catch { /* offline ok */ }
  const out = run();
  if (process.argv.includes('--json')) {
    process.stdout.write(JSON.stringify(out, null, 2) + '\n');
  } else {
    for (const r of out.results) {
      const sym = r.diagnosis === 'ok' ? '✓' : (r.diagnosis === 'branch-stale' ? '↻' : '✗');
      process.stdout.write(`${sym} ${r.script.padEnd(28)} ${r.diagnosis}${r.recommend ? '  → ' + r.recommend : ''}\n`);
    }
    if (out.exitCode === 1) process.stderr.write('\nrun npm run deploy:both:apply to sync runtime\n');
    if (out.exitCode === 2) process.stderr.write('\nREAL DRIFT detected — file an incident ticket\n');
  }
  process.exit(out.exitCode);
}

module.exports = { run, diagnose, TRACKED, HOOK_DIR, COPILOT_DEPLOY, CODEX_DEPLOY };
