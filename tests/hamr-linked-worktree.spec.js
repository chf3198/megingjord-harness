const { test, expect } = require('@playwright/test');
const path = require('path');
const fs = require('fs');
const os = require('os');
const { spawnSync } = require('child_process');

const REPO_ROOT = path.resolve(__dirname, '..');
const ACTIVATE = path.join(REPO_ROOT, 'scripts', 'global', 'hamr-activate.sh');

test('hamr activation succeeds when current checkout is a linked worktree', () => {
  test.skip(fs.statSync(path.join(REPO_ROOT, '.git')).isDirectory(),
    'checkout is not a linked worktree');
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'hamr-home-'));
  try {
    const result = spawnSync('bash', [ACTIVATE], {
      cwd: REPO_ROOT,
      encoding: 'utf8',
      env: {
        ...process.env,
        HOME: home,
        HAMR_TEAM: 'codex',
        HAMR_PROVIDER: 'provider-neutral',
      },
    });
    expect(result.status, result.stderr).toBe(0);
    expect(result.stdout).toContain('HAMR activation complete');
    const cfg = path.join(home, '.codex', 'devenv-ops', 'hamr-config.json');
    expect(JSON.parse(fs.readFileSync(cfg, 'utf8')).team_runtime).toBe('codex');
  } finally {
    fs.rmSync(home, { recursive: true, force: true });
  }
});

test('codex activation does not require Anthropic API key', () => {
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'hamr-home-'));
  const env = { ...process.env, HOME: temp, HAMR_TEAM: 'codex' };
  delete env.ANTHROPIC_API_KEY;
  const result = spawnSync('bash', [ACTIVATE], { cwd: REPO_ROOT, encoding: 'utf8', env });
  fs.rmSync(temp, { recursive: true, force: true });
  expect(result.status, result.stderr).toBe(0);
  expect(result.stdout).not.toContain('ANTHROPIC_API_KEY');
  expect(result.stdout).toContain('OPENAI_API_KEY');
});
