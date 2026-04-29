#!/usr/bin/env node
const { execSync } = require('child_process');

const asJson = process.argv.includes('--json');
const maxBehind = Number(process.env.SANDBOX_MAX_BEHIND || 0);
const sandboxRx = /^sandbox\/(copilot|codex|claude-code)$/;

function run(cmd) {
  return execSync(cmd, { encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] }).trim();
}

function readLocalSandboxBranches() {
  const out = run('git for-each-ref --format="%(refname:short)" refs/heads/sandbox/');
  return out ? out.split('\n').filter(Boolean) : [];
}

function aheadBehind(branch) {
  const out = run(`git rev-list --left-right --count ${branch}...origin/main`);
  const [ahead, behind] = out.split(/\s+/).map(Number);
  return { ahead, behind };
}

function dirtyInBranch(branch) {
  const out = run(`git -c core.quotepath=false status --porcelain --untracked-files=all --branch`);
  const lines = out.split('\n').filter(Boolean);
  const head = lines[0] || '';
  const changed = Math.max(lines.length - 1, 0);
  return head.includes(`## ${branch}`) ? changed : 0;
}

function check() {
  run('git fetch origin --prune');
  const issues = [];
  const branches = readLocalSandboxBranches();
  if (!branches.length) issues.push('No local sandbox/* branches found.');

  for (const branch of branches) {
    if (!sandboxRx.test(branch)) {
      issues.push(`${branch}: invalid sandbox naming.`);
      continue;
    }
    const { ahead, behind } = aheadBehind(branch);
    if (ahead > 0) issues.push(`${branch}: ahead of origin/main by ${ahead} commits.`);
    if (behind > maxBehind) issues.push(`${branch}: behind origin/main by ${behind} commits (max ${maxBehind}).`);
    const dirtyCount = dirtyInBranch(branch);
    if (dirtyCount > 0) issues.push(`${branch}: has ${dirtyCount} local changes while on sandbox launcher.`);
  }

  return {
    checkedBranches: branches.length,
    maxBehind,
    status: issues.length ? 'fail' : 'pass',
    issues,
    runAt: new Date().toISOString(),
  };
}

try {
  const result = check();
  if (asJson) console.log(JSON.stringify(result, null, 2));
  else {
    console.log(`worktree-governance: ${result.status.toUpperCase()} (${result.checkedBranches} branches)`);
    result.issues.forEach(i => console.log(`- ${i}`));
  }
  process.exit(result.status === 'pass' ? 0 : 1);
} catch (error) {
  const message = error?.stderr?.toString().trim() || error.message;
  if (asJson) {
    console.log(JSON.stringify({ status: 'fail', issues: [message], runAt: new Date().toISOString() }, null, 2));
  } else {
    console.error(`worktree-governance: FAIL\n- ${message}`);
  }
  process.exit(1);
}
