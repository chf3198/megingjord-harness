#!/usr/bin/env node
'use strict';
// tier: 1
// worktree-naming-advisory (Epic #2071 C1 #2075; absorbs cancelled C4 #2078 naming value):
// ADVISORY (warn-never-block) check that a branch / worktree-root follows the harness naming
// convention. Two accepted shapes:
//   flat (current):      <type>/<N>-<slug>            e.g. fix/2075-worktree-hygiene
//   per-team namespace:  <team>/<type>/<N>-<slug>     e.g. cc/fix/2075-worktree-hygiene
// type ∈ feat|fix|hotfix|chore|skill ; team ∈ cc|cp|cx|ag. Non-conforming → advisory only.

const TYPES = ['feat', 'fix', 'hotfix', 'chore', 'skill'];
const TEAMS = ['cc', 'cp', 'cx', 'ag'];
const FLAT_RE = new RegExp(`^(${TYPES.join('|')})/(\\d+)-[a-z0-9][a-z0-9-]*$`);
const NS_RE = new RegExp(`^(${TEAMS.join('|')})/(${TYPES.join('|')})/(\\d+)-[a-z0-9][a-z0-9-]*$`);
const PROTECTED = new Set(['main', 'develop', 'HEAD']);

function classifyBranch(branch) {
  const name = String(branch || '').trim();
  if (!name || PROTECTED.has(name)) return { shape: 'protected-or-empty', conforms: true, advisory: null };
  if (NS_RE.test(name)) return { shape: 'per-team-namespace', conforms: true, advisory: null };
  if (FLAT_RE.test(name)) return { shape: 'flat', conforms: true, advisory: null };
  return {
    shape: 'non-conforming', conforms: false,
    advisory: `branch '${name}' does not match <type>/<N>-slug or <team>/<type>/<N>-slug `
      + `(type∈${TYPES.join('|')}, team∈${TEAMS.join('|')}) — advisory only, not blocked`,
  };
}

// Never returns a blocking violation — advisories only (severity: advisory).
function lintBranchName(branch) {
  const result = classifyBranch(branch);
  return { ok: true, advisories: result.advisory ? [{ rule: 'worktree-naming-advisory', severity: 'advisory', detail: result.advisory }] : [], shape: result.shape };
}

if (require.main === module) {
  const { execFileSync } = require('node:child_process');
  let branch = process.argv[2];
  if (!branch) { try { branch = execFileSync('git', ['branch', '--show-current'], { encoding: 'utf8' }).trim(); } catch { branch = ''; } }
  const res = lintBranchName(branch);
  if (res.advisories.length) console.warn(`[worktree-naming-advisory] ${res.advisories[0].detail}`);
  else console.log(`[worktree-naming-advisory] '${branch}' ok (${res.shape})`);
}

module.exports = { classifyBranch, lintBranchName, TYPES, TEAMS };
