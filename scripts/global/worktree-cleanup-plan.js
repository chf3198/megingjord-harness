#!/usr/bin/env node
'use strict';

const fs = require('fs');
const leaseRegistry = require('./cross-team-lease-registry');
const worktreeInventory = require('./worktree-inventory');

function ticketFrom(branch = '') {
  const hit = branch.match(/(?:feat|fix|chore|docs|refactor|hotfix)\/(\d+)-/);
  return hit ? Number(hit[1]) : null;
}

function leaseFor(entry, leases) {
  const ticket = ticketFrom(entry.branch);
  return leases.find(lease => lease.branch === entry.branch || lease.ticket === ticket) || null;
}

function classify(entry, lease) {
  const ticket = ticketFrom(entry.branch);
  if (lease) return 'active-lease';
  if (entry.locked) return 'keep-locked';
  if ((entry.branch || '').startsWith('sandbox/')) return 'keep-launcher';
  if (entry.branch && entry.branch !== 'main' && ticket === null) return 'keep-review';
  if (entry.dirtyCount > 0 || entry.untrackedCount > 0 || entry.ahead > 0) return 'preserve-dirty';
  if (entry.openPr) return 'stale-open-pr';
  if (entry.mergedToMain) return 'merged-clean';
  if (entry.prunable) return 'prune-metadata';
  return 'keep-review';
}

function commands(entry, state) {
  if (state === 'merged-clean') return [`git worktree remove ${entry.path}`, `git branch -d ${entry.branch}`];
  if (state === 'prune-metadata') return ['git worktree prune'];
  if (state === 'preserve-dirty') return [
    `git switch -c rescue/${ticketFrom(entry.branch) || 'unknown'}-preserve`,
    'gh pr create --draft --fill',
  ];
  if (state === 'stale-open-pr') return [`gh pr view ${entry.openPr}`, `gh pr comment ${entry.openPr} --body "cleanup review requested"`];
  return [];
}

function plan(input = {}) {
  const inventory = input.inventory || worktreeInventory.inventory();
  const registry = input.registry || leaseRegistry.read(input.leaseFile || leaseRegistry.DEFAULT_PATH);
  const leases = leaseRegistry.active(registry);
  const worktrees = inventory.worktrees.map(entry => {
    const lease = leaseFor(entry, leases);
    const state = classify(entry, lease);
    return { ...entry, ticket: ticketFrom(entry.branch), lease: lease?.ticket || null,
      cleanupState: state, commands: commands(entry, state) };
  });
  return { generatedAt: new Date().toISOString(), mode: 'plan-only', worktrees };
}

function workspace(report) {
  return {
    folders: report.worktrees.filter(w => w.cleanupState === 'active-lease')
      .map(w => ({ name: w.branch || w.path, path: w.path })),
    settings: { 'git.autoRepositoryDetection': 'subFolders' },
  };
}

function run(argv = process.argv.slice(2)) {
  const json = argv.includes('--json');
  const workspaceIndex = argv.indexOf('--workspace');
  const workspacePath = workspaceIndex >= 0 ? argv[workspaceIndex + 1] : null;
  const report = plan();
  if (workspacePath) fs.writeFileSync(workspacePath, `${JSON.stringify(workspace(report), null, 2)}\n`);
  if (json || workspacePath) process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
  else for (const worktree of report.worktrees) {
    console.log(`${worktree.cleanupState.padEnd(15)} ${worktree.branch || 'DETACHED'} ${worktree.path}`);
  }
  return report;
}

if (require.main === module) run();

module.exports = { classify, commands, plan, ticketFrom, workspace };
