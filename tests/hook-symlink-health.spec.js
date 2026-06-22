// hook-symlink-health.spec.js — #2972 cyclic-symlink operator-lockout guards.
// tdd-pyramid: unit coverage for the cycle detector + self-repair, plus golden
// assertions that the prevention guard (install-hooks.sh) is in place.
const { test, expect } = require('@playwright/test');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const REPO = path.resolve(__dirname, '..');
const {
  classifyPath,
  scanHookHealth,
  repairBrokenLink,
  hookHealthRemediations,
} = require(path.join(REPO, 'scripts', 'global', 'hook-symlink-health.js'));

function mkTmp() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'hook-health-2972-'));
}

test('#2972 AC3: scanHookHealth flags a cyclic (ELOOP) hook symlink', () => {
  const dir = mkTmp();
  const looped = path.join(dir, 'pretool_guard.py');
  // A self-referential symlink: stat() raises ELOOP, the exact #2972 brick.
  fs.symlinkSync(looped, looped);
  const result = scanHookHealth([dir]);
  expect(result.scanned).toBe(1);
  expect(result.broken).toHaveLength(1);
  expect(result.broken[0].reason).toBe('cyclic');
  expect(result.broken[0].path).toBe(looped);
  fs.rmSync(dir, { recursive: true, force: true });
});

test('#2972 AC3: scanHookHealth passes a healthy hook directory', () => {
  const dir = mkTmp();
  fs.writeFileSync(path.join(dir, 'pretool_guard.py'), '# real hook\n');
  fs.writeFileSync(path.join(dir, 'pre-push.sh'), '#!/usr/bin/env bash\n');
  const result = scanHookHealth([dir]);
  expect(result.scanned).toBe(2);
  expect(result.broken).toHaveLength(0);
  fs.rmSync(dir, { recursive: true, force: true });
});

test('#2972 AC3: a valid symlink to a real file is healthy', () => {
  const dir = mkTmp();
  const realFile = path.join(dir, 'src.py');
  fs.writeFileSync(realFile, '# source\n');
  const linkFile = path.join(dir, 'hook.py');
  fs.symlinkSync(realFile, linkFile);
  expect(classifyPath(linkFile)).toBeNull();
  fs.rmSync(dir, { recursive: true, force: true });
});

test('#2972 AC3: a dangling symlink is flagged (not cyclic)', () => {
  const dir = mkTmp();
  const linkFile = path.join(dir, 'hook.py');
  fs.symlinkSync(path.join(dir, 'does-not-exist.py'), linkFile);
  expect(classifyPath(linkFile)).toBe('dangling');
  fs.rmSync(dir, { recursive: true, force: true });
});

test('#2972 AC3: repairBrokenLink removes a cyclic link so re-deploy can recover', () => {
  const dir = mkTmp();
  const looped = path.join(dir, 'pretool_guard.py');
  fs.symlinkSync(looped, looped);
  expect(scanHookHealth([dir]).broken).toHaveLength(1);
  expect(repairBrokenLink(looped)).toBe(true);
  expect(scanHookHealth([dir]).broken).toHaveLength(0);
  fs.rmSync(dir, { recursive: true, force: true });
});

test('#2972 AC3: remediations are emitted for broken links and empty when clean', () => {
  expect(hookHealthRemediations({ scanned: 0, broken: [] })).toHaveLength(0);
  const rem = hookHealthRemediations({ scanned: 1, broken: [{ path: '/x/pretool_guard.py', reason: 'cyclic' }] });
  expect(rem).toHaveLength(1);
  expect(rem[0].capability).toBe('hook_symlink');
  expect(rem[0].advice).toContain('hamr:doctor --fix');
});

test('#2972 AC2: .claude/settings.json PreToolUse commands degrade to allow on an unreadable hook', () => {
  const settings = JSON.parse(fs.readFileSync(path.join(REPO, '.claude', 'settings.json'), 'utf8'));
  const cmds = settings.hooks.PreToolUse.flatMap((g) => g.hooks).map((h) => h.command);
  expect(cmds.length).toBeGreaterThanOrEqual(2);
  for (const cmd of cmds) {
    // Readability probe before exec, and degrade-to-allow (exit 0) when unreadable.
    expect(cmd).toMatch(/\[ -r "\$f" \]/);
    expect(cmd).toContain('exec python3');
    expect(cmd).toContain('exit 0');
    // A healthy hook still enforces — python is exec'd so its block exit propagates.
    expect(cmd).toMatch(/hooks\/scripts\/\w+\.py/);
  }
});

test('#2972 AC1: install-hooks.sh symlink step is idempotent and cycle-safe', () => {
  const sh = fs.readFileSync(path.join(REPO, 'scripts', 'global', 'install-hooks.sh'), 'utf8');
  // Idempotent skip when dst already resolves to src.
  expect(sh).toContain('idempotent skip');
  // Self-referential link refusal (the ELOOP brick guard).
  expect(sh).toContain('refusing self-referential link');
  expect(sh).toMatch(/\[ "\$src" -ef "\$dst" \]/);
  // Clean replace: rm before a fresh symlink rather than a bare `ln -sf`.
  expect(sh).toMatch(/rm -f "\$dst"\s*\n\s*ln -s "\$src" "\$dst"/);
});
