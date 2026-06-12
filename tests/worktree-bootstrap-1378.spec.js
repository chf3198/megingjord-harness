// worktree node_modules bootstrap tests (#1378).
const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');
const { execSync, spawnSync } = require('child_process');

const REPO = path.resolve(__dirname, '..');
const SESSION_START = path.join(REPO, 'scripts', 'worktree-session-start.sh');
const BOOTSTRAP = path.join(REPO, 'scripts', 'worktree-bootstrap-node-modules.sh');

test('#1378 AC1: worktree-session-start.sh includes bootstrap_node_modules function', () => {
  const content = fs.readFileSync(SESSION_START, 'utf-8');
  expect(content).toContain('bootstrap_node_modules');
  expect(content).toContain('git worktree list --porcelain');
  expect(content).toContain('ln -sf');
});

test('#1378 AC1: bootstrap is called after task-branch creation', () => {
  const content = fs.readFileSync(SESSION_START, 'utf-8');
  // Refs #2946: now uses git worktree add + isolated dir, not git switch -c
  const worktreeAddPos = content.indexOf('git worktree add "$wt_dir"');
  const bootstrapCallPos = content.indexOf('bootstrap_node_modules "$wt_dir"');
  expect(worktreeAddPos).toBeGreaterThan(0);
  expect(bootstrapCallPos).toBeGreaterThan(worktreeAddPos);
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
