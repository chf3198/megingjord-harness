#!/usr/bin/env node
'use strict';
const { execSync } = require('child_process');
const MAX_BEHIND = Number(process.env.GIT_DRIFT_MAX_BEHIND || 5);
const FRESHNESS_HR = Number(process.env.GIT_DRIFT_FRESHNESS_HOURS || 24);
const VALID_PFX = ['main', 'sandbox', 'release', 'hotfix', 'feat', 'fix'];
const run = cmd => { try { return execSync(cmd, { encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] }).trim(); } catch { return ''; } };
const curBranch = () => run('git rev-parse --abbrev-ref HEAD');
const freshness = () => {
  const branch = curBranch();
  if (branch === 'HEAD') return { status: 'detached', detail: 'HEAD detached' };
  const [prefix] = branch.split('/');
  if (!VALID_PFX.includes(prefix)) return { status: 'invalid-prefix', detail: `prefix "${prefix}" invalid` };
  const out = run(`git rev-list --left-right --count ${branch}...origin/main`);
  if (!out) return { status: 'orphaned', detail: `${branch} orphaned` };
  const [ahead, behind] = out.split(/\s+/).map(Number);
  if (behind > MAX_BEHIND) return { status: 'stale', detail: `behind by ${behind} (max ${MAX_BEHIND})` };
  const ageHours = Math.floor((Date.now() / 1000 - Number(run('git log -1 --format=%ct HEAD'))) / 3600);
  return ageHours > FRESHNESS_HR ? { status: 'old', detail: `${ageHours}h old (limit ${FRESHNESS_HR}h)` } : { status: 'fresh', detail: `${branch} a=${ahead} b=${behind}` };
};
const worktree = () => {
  try {
    const count = run('git worktree list --porcelain').split('\n').filter(Boolean).length;
    if (count <= 1) return { status: 'isolated', detail: 'single worktree' };
    return { status: 'collision', detail: `${count} concurrent worktrees` };
  } catch { return { status: 'unknown', detail: 'unavailable' }; }
};
const target = () => {
  const [prefix] = curBranch().split('/');
  const rules = { release: 'main', hotfix: 'main', sandbox: 'sandbox', feat: 'develop|main|sandbox', fix: 'develop|main|sandbox' };
  return rules[prefix] ? { status: 'compliant', detail: `"${prefix}" compliant` } : { status: 'unknown', detail: `no rule for "${prefix}"` };
};
const compute = () => {
  const sigs = { freshness: freshness(), worktree: worktree(), target: target() };
  const fails = Object.entries(sigs).filter(([, sig]) => !['fresh', 'isolated', 'compliant', 'unknown'].includes(sig.status));
  return { status: fails.length === 0 ? 'PASS' : 'FAIL', timestamp: new Date().toISOString(), signals: sigs, violation_count: fails.length, violations: fails.map(([sig, data]) => ({ signal: sig, ...data })) };
};
if (require.main === module) { const result = compute(); console.log(JSON.stringify(result, null, 2)); process.exit(result.status === 'PASS' ? 0 : 1); }
module.exports = { compute, freshness, worktree, target };


