// hamr-activate tests (#954).
const { test, expect } = require('@playwright/test');
const path = require('path');
const fs = require('fs');
const { spawnSync } = require('child_process');

const REPO_ROOT = path.resolve(__dirname, '..');
const ACTIVATE = path.join(REPO_ROOT, 'scripts', 'global', 'hamr-activate.sh');

test('hamr-activate.sh exists and is executable', () => {
  expect(fs.existsSync(ACTIVATE)).toBe(true);
  expect(fs.statSync(ACTIVATE).mode & 0o100).toBeTruthy();
});

test('hamr-activate.sh runs all 4 steps and exits 0', () => {
  const result = spawnSync('bash', [ACTIVATE], { cwd: REPO_ROOT, encoding: 'utf8' });
  expect(result.status).toBe(0);
  for (const step of ['1/4', '2/4', '3/4', '4/4']) {
    expect(result.stdout).toContain(step);
  }
  expect(result.stdout).toContain('HAMR activation complete');
});

test('hamr-activate.sh reports Worker reachability check', () => {
  const result = spawnSync('bash', [ACTIVATE], { cwd: REPO_ROOT, encoding: 'utf8' });
  expect(result.stdout + result.stderr).toMatch(/Worker (\/healthz reachable|unreachable)/);
});
