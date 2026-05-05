// hamr-periodic-push + install-cron tests (#953).
const { test, expect } = require('@playwright/test');
const path = require('path');
const fs = require('fs');
const { execSync, spawnSync } = require('child_process');

const REPO_ROOT = path.resolve(__dirname, '..');
const PUSH = path.join(REPO_ROOT, 'scripts', 'global', 'hamr-periodic-push.sh');
const INSTALL = path.join(REPO_ROOT, 'scripts', 'global', 'install-cron.sh');

test('both shell scripts exist and are executable', () => {
  for (const f of [PUSH, INSTALL]) {
    expect(fs.existsSync(f)).toBe(true);
    expect(fs.statSync(f).mode & 0o100).toBeTruthy();
  }
});

test('hamr-periodic-push exits 0 even when both pushes fail (graceful)', () => {
  const result = spawnSync('bash', [PUSH], { cwd: REPO_ROOT, encoding: 'utf8',
    env: { ...process.env, PATH: process.env.PATH, OPERATOR_KEY_SEED_B64: '' } });
  expect(result.status).toBe(0);
});

test('install-cron script reports idempotent-skip path on second run', () => {
  // Skip when crontab unavailable (CI containers); test idempotency via marker grep instead.
  const cronAvailable = (() => { try { execSync('command -v crontab', { stdio: 'ignore' }); return true; } catch { return false; } })();
  if (!cronAvailable) {
    expect(fs.readFileSync(INSTALL, 'utf8')).toMatch(/already installed/);
    return;
  }
  // crontab exists: run once + check marker is present, run twice + verify no dup.
  const r1 = spawnSync('bash', [INSTALL], { cwd: REPO_ROOT, encoding: 'utf8' });
  const r2 = spawnSync('bash', [INSTALL], { cwd: REPO_ROOT, encoding: 'utf8' });
  expect(r2.stdout + r2.stderr).toMatch(/already installed/);
  // Cleanup
  try {
    const list = execSync('crontab -l', { encoding: 'utf8' });
    const cleaned = list.split('\n').filter((l) => !l.includes('hamr-periodic-push')).join('\n');
    execSync(`echo "${cleaned}" | crontab -`);
  } catch { /* tolerate cleanup failure */ }
  expect(r1.status).toBe(0);
});

test('hamr-periodic-push log file path is under operator home', () => {
  // Run once to ensure log file exists
  spawnSync('bash', [PUSH], { cwd: REPO_ROOT, encoding: 'utf8' });
  const log = path.join(process.env.HOME, '.megingjord', 'push-log.jsonl');
  expect(fs.existsSync(log)).toBe(true);
});
