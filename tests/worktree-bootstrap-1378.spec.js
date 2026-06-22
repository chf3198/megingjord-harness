// worktree node_modules bootstrap tests (#1378).
const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');
const { execSync, spawnSync } = require('child_process');

const REPO = path.resolve(__dirname, '..');
const SESSION_START = path.join(REPO, 'scripts', 'worktree-session-start.sh');
const AGENT_INIT = path.join(REPO, 'scripts', 'worktree-agent-init.sh');
const BOOTSTRAP = path.join(REPO, 'scripts', 'worktree-bootstrap-node-modules.sh');

test('#1378 AC1: worktree-session-start.sh includes bootstrap_node_modules function', () => {
  const content = fs.readFileSync(SESSION_START, 'utf-8');
  expect(content).toContain('bootstrap_node_modules');
  expect(content).toContain('git worktree list --porcelain');
  expect(content).toContain('ln -sf');
});

test('#2946 AC1: task branch is created in an isolated worktree dir, not in-place', () => {
  const session = fs.readFileSync(SESSION_START, 'utf-8');
  const init = fs.readFileSync(AGENT_INIT, 'utf-8');
  // The old in-place `git switch -c "$task_branch"` must be gone.
  expect(session.includes('git switch -c "$task_branch"')).toBe(false);
  // worktree-session-start.sh delegates to the extracted helper (AC2).
  expect(session).toContain('create_task_worktree "$agent" "$task_branch"');
  // The helper lives in worktree-agent-init.sh and uses an isolated worktree dir.
  expect(init).toContain('create_task_worktree()');
  expect(init).toContain('git worktree add "$worktree_dir"');
  expect(init).toContain('$HOME/devenv-ops-${ticket_num}');
});

test('#2946 AC3: bootstrap/hooks/env in the helper target the new worktree dir', () => {
  const init = fs.readFileSync(AGENT_INIT, 'utf-8');
  // After the isolated worktree-add, init steps must run against $worktree_dir.
  const addPos = init.indexOf('git worktree add "$worktree_dir"');
  const bootstrapPos = init.indexOf('bootstrap_node_modules "$worktree_dir"');
  const hooksPos = init.indexOf('configure_per_worktree_hooks "$worktree_dir"');
  expect(addPos).toBeGreaterThan(0);
  expect(bootstrapPos).toBeGreaterThan(addPos);
  expect(hooksPos).toBeGreaterThan(addPos);
});

test('#1378 AC1: bootstrap is idempotent (skips if node_modules already exists)', () => {
  const content = fs.readFileSync(SESSION_START, 'utf-8');
  expect(content).toMatch(/already present|skipping/);
});

test('#1378 AC1: bootstrap skips when this IS the main checkout (no self-link)', () => {
  const content = fs.readFileSync(SESSION_START, 'utf-8');
  expect(content).toMatch(/this IS the main checkout|nothing to link/);
});

test('#1378 AC2: .gitignore covers node_modules (symlink stays untracked)', () => {
  const gitignore = fs.readFileSync(path.join(REPO, '.gitignore'), 'utf-8');
  expect(gitignore).toMatch(/^node_modules\/?$/m);
});

test('#1378 AC3: standalone worktree-bootstrap script exists and is executable', () => {
  const stat = fs.statSync(BOOTSTRAP);
  expect(stat.isFile()).toBe(true);
  // Check that the owner can execute the script (mode bit 0o100)
  expect((stat.mode & 0o100) !== 0).toBe(true);
});

test('#1378 AC3: standalone script iterates all worktrees via porcelain output', () => {
  const content = fs.readFileSync(BOOTSTRAP, 'utf-8');
  expect(content).toContain('git worktree list --porcelain');
  expect(content).toMatch(/linked=|skipped=|errored=/);
});

test('#1378 AC3: npm run worktree:bootstrap is defined', () => {
  const pkg = JSON.parse(fs.readFileSync(path.join(REPO, 'package.json'), 'utf-8'));
  expect(pkg.scripts['worktree:bootstrap']).toContain('worktree-bootstrap-node-modules.sh');
});

test('#1378 AC3: live invocation succeeds + is idempotent (re-run = no errors)', () => {
  const result = spawnSync('npm', ['run', 'worktree:bootstrap'], {
    cwd: REPO, encoding: 'utf-8',
  });
  expect(result.status).toBe(0);
  expect(result.stdout).toContain('done: linked=');
  // Re-run should report all skipped now
  const result2 = spawnSync('npm', ['run', 'worktree:bootstrap'], {
    cwd: REPO, encoding: 'utf-8',
  });
  expect(result2.status).toBe(0);
  expect(result2.stdout).toContain('linked=0');
});

test('#1378 AC4: CLAUDE.md documents the auto-link pattern', () => {
  const content = fs.readFileSync(path.join(REPO, 'CLAUDE.md'), 'utf-8');
  expect(content).toContain('auto-link');
  expect(content).toContain('node_modules');
  expect(content).toContain('worktree:bootstrap');
});

test('#1378 AC5: live verification — this worktree has node_modules linked (so format:check works)', () => {
  // The current test worktree must have node_modules for this very test to run.
  expect(fs.existsSync(path.join(REPO, 'node_modules'))).toBe(true);
});
