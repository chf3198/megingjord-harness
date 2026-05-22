'use strict';
// Operator-safe branch cleanup policy (dry-run only). Refs #1610.
// Sandbox/ launchers and active leases are never flagged (three-team safety).
const { execSync } = require('child_process');
const leaseRegistry = require('./cross-team-lease-registry');

function sh(cmd) {
  try { return execSync(cmd, { encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] }).trim(); }
  catch { return ''; }
}

function localBranches() {
  return sh('git branch -l').split('\n')
    .map(b => b.trim().replace(/^\*\s*/, ''))
    .filter(b => b && b !== 'main');
}

function isMergedToMain(branch) {
  return sh(`git merge-base --is-ancestor "refs/heads/${branch}" origin/main && echo yes`) === 'yes';
}

function prState(branch) {
  const raw = sh(`gh pr list --head "${branch}" --state all --json number,state --jq '.[0]'`);
  try { return raw ? JSON.parse(raw) : null; } catch { return null; }
}

function orphanedLeases(branches) {
  const reg = leaseRegistry.read(leaseRegistry.DEFAULT_PATH);
  return leaseRegistry.active(reg).filter(l => l.branch && !branches.includes(l.branch));
}

function classify(branch, merged, pr) {
  if (branch.startsWith('sandbox/')) return { state: 'keep-launcher', evidence: 'sandbox launcher' };
  if (merged && pr && pr.state === 'MERGED') return { state: 'merged-clean', evidence: `merged to main; PR #${pr.number} MERGED` };
  if (merged && !pr) return { state: 'merged-no-pr', evidence: 'merged to main; no PR found' };
  if (pr && pr.state === 'CLOSED') return { state: 'closed-pr', evidence: `PR #${pr.number} is CLOSED` };
  if (merged && pr && pr.state === 'OPEN') return { state: 'merged-open-pr', evidence: `merged to main; PR #${pr.number} still OPEN` };
  return { state: 'keep-active', evidence: 'not merged or has active PR' };
}

function commandsFor(branch, state) {
  if (state === 'merged-clean' || state === 'merged-no-pr')
    return [`git branch -d ${branch}`, `git push origin --delete ${branch} || true`];
  if (state === 'closed-pr') return [`git branch -d ${branch}`];
  return [];
}

function plan(overrides = {}) {
  const branches = overrides.branches || localBranches();
  const getIsMerged = overrides.isMergedToMain || isMergedToMain;
  const getPr = overrides.prState || prState;
  const orphans = overrides.leases !== undefined
    ? overrides.leases
    : orphanedLeases(branches);
  const entries = branches.map(branch => {
    const { state, evidence } = classify(branch, getIsMerged(branch), getPr(branch));
    return { branch, cleanupState: state, evidence, commands: commandsFor(branch, state) };
  });
  return {
    generatedAt: new Date().toISOString(), mode: 'dry-run',
    branches: entries,
    orphanedLeases: orphans.map(l => ({ ticket: l.ticket, branch: l.branch, action: 'lease-close' })),
  };
}

function run(argv = process.argv.slice(2)) {
  const report = plan();
  if (argv.includes('--json')) { process.stdout.write(`${JSON.stringify(report, null, 2)}\n`); return report; }
  console.log(`\nBranch Cleanup Plan (dry-run) — ${report.generatedAt}\n`);
  for (const entry of report.branches) {
    if (entry.cleanupState === 'keep-active' || entry.cleanupState === 'keep-launcher') continue;
    console.log(`  [${entry.cleanupState}] ${entry.branch}`);
    console.log(`    evidence: ${entry.evidence}`);
    for (const cmd of entry.commands) console.log(`    > ${cmd}`);
  }
  if (report.orphanedLeases.length) {
    console.log('\nOrphaned leases (branch deleted, lease not closed):');
    for (const lease of report.orphanedLeases) console.log(`  ticket #${lease.ticket}: ${lease.branch}`);
  }
  return report;
}

if (require.main === module) run();
module.exports = { classify, commandsFor, plan };
