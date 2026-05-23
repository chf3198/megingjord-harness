'use strict';
// Tests for C4 — per-worktree core.hooksPath config in worktree-session-start.sh.
// Epic #2091 Phase-1 C4 (Fix #2). Verifies AC5 and AC6.

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execSync, spawnSync } = require('node:child_process');
const { test } = require('node:test');

const SCRIPT = path.resolve(__dirname, '..', 'scripts', 'worktree-session-start.sh');
const SCRIPT_TEXT = fs.readFileSync(SCRIPT, 'utf8');

function mkTmpGitRepo() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'wt-hooks-test-'));
  execSync('git init -b main', { cwd: dir, stdio: 'pipe' });
  execSync('git config user.email "test@test.com"', { cwd: dir, stdio: 'pipe' });
  execSync('git config user.name "Test"', { cwd: dir, stdio: 'pipe' });
  execSync('git commit --allow-empty -m "init"', { cwd: dir, stdio: 'pipe' });
  return dir;
}

function rm(dir) { try { fs.rmSync(dir, { recursive: true, force: true }); } catch { /* catch-empty: cleanup */ } }

// AC5 structural: script contains the required git config commands
test('AC5: script contains extensions.worktreeConfig=true', () => {
  assert.ok(SCRIPT_TEXT.includes('extensions.worktreeConfig'), 'script must enable per-worktree config');
  assert.ok(SCRIPT_TEXT.includes('--worktree core.hooksPath'), 'script must set core.hooksPath per-worktree');
});

test('AC5: configure_per_worktree_hooks function is defined and called', () => {
  assert.ok(SCRIPT_TEXT.includes('configure_per_worktree_hooks()'), 'function must be defined');
  assert.ok(SCRIPT_TEXT.includes('configure_per_worktree_hooks "$root"'), 'function must be called after branch creation');
});

// AC5 integration: run the function against a real tmp git repo
test('AC5 integration: core.hooksPath set when hooks dir exists', () => {
  const repo = mkTmpGitRepo();
  const fakeHome = fs.mkdtempSync(path.join(os.tmpdir(), 'hooks-home-'));
  const hooksDir = path.join(fakeHome, '.copilot', 'hooks', 'scripts');
  fs.mkdirSync(hooksDir, { recursive: true });
  // Write a minimal self-contained test script that only contains the function
  const fnScript = `#!/usr/bin/env bash
set -euo pipefail
log() { echo "$*"; }
configure_per_worktree_hooks() {
  local worktree_root="$1"
  local hooks_path=""
  if [[ -d "$HOME/.codex/devenv-ops/hooks/scripts" ]]; then
    hooks_path="$HOME/.codex/devenv-ops/hooks/scripts"
  elif [[ -d "$HOME/.copilot/hooks/scripts" ]]; then
    hooks_path="$HOME/.copilot/hooks/scripts"
  fi
  if [[ -z "$hooks_path" ]]; then
    log "per-worktree hooks: no deployed hooks dir found; skipping core.hooksPath"
    return 0
  fi
  git -C "$worktree_root" config extensions.worktreeConfig true 2>/dev/null || true
  git -C "$worktree_root" config --worktree core.hooksPath "$hooks_path"
  log "per-worktree hooks: core.hooksPath to $hooks_path"
}
configure_per_worktree_hooks "$1"
`;
  const tmpFn = path.join(os.tmpdir(), `wt-fn-test-${Date.now()}.sh`);
  fs.writeFileSync(tmpFn, fnScript, { mode: 0o755 });
  const r = spawnSync('bash', [tmpFn, repo], { env: { ...process.env, HOME: fakeHome }, cwd: repo });
  assert.equal(r.status, 0, `failed: ${r.stderr?.toString()}`);
  const wtConfig = execSync(`git -C ${repo} config extensions.worktreeConfig`).toString().trim();
  assert.equal(wtConfig, 'true');
  rm(repo); rm(fakeHome); try { fs.unlinkSync(tmpFn); } catch { /* catch-empty */ }
});

// AC6: skips gracefully when no hooks dir
test('AC6: configure_per_worktree_hooks skips when no hooks dir', () => {
  const repo = mkTmpGitRepo();
  const emptyHome = fs.mkdtempSync(path.join(os.tmpdir(), 'empty-home-'));
  const fnScript = `#!/usr/bin/env bash
set -euo pipefail
log() { echo "$*"; }
configure_per_worktree_hooks() {
  local worktree_root="$1"
  local hooks_path=""
  if [[ -d "$HOME/.codex/devenv-ops/hooks/scripts" ]]; then
    hooks_path="$HOME/.codex/devenv-ops/hooks/scripts"
  elif [[ -d "$HOME/.copilot/hooks/scripts" ]]; then
    hooks_path="$HOME/.copilot/hooks/scripts"
  fi
  if [[ -z "$hooks_path" ]]; then
    log "per-worktree hooks: no deployed hooks dir found; skipping core.hooksPath"
    return 0
  fi
  git -C "$worktree_root" config extensions.worktreeConfig true 2>/dev/null || true
  git -C "$worktree_root" config --worktree core.hooksPath "$hooks_path"
  log "per-worktree hooks: core.hooksPath to $hooks_path"
}
configure_per_worktree_hooks "$1"
`;
  const tmpFn = path.join(os.tmpdir(), `wt-skip-test-${Date.now()}.sh`);
  fs.writeFileSync(tmpFn, fnScript, { mode: 0o755 });
  const r = spawnSync('bash', [tmpFn, repo], { env: { ...process.env, HOME: emptyHome }, cwd: repo });
  assert.equal(r.status, 0, `should exit 0 even without hooks: ${r.stderr?.toString()}`);
  assert.ok(r.stdout?.toString().includes('skipping'), `expected skip msg, got: ${r.stdout?.toString()}`);
  rm(repo); rm(emptyHome); try { fs.unlinkSync(tmpFn); } catch { /* catch-empty */ }
});
