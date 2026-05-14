// Tests for the self-symlink guard added in #1540.
// Source-content tests — verify both scripts contain the guard logic
// per the Phase-0 design. The integration scenario (synthetic
// broken self-symlink + bootstrap aborts) is documented in #1539's
// audit artifact; reproducing it here would require a separate git
// worktree fixture which is heavy-weight.

const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');

const REPO = path.resolve(__dirname, '..');
const BOOTSTRAP = path.join(REPO, 'scripts', 'worktree-bootstrap-node-modules.sh');
const SESSION_START = path.join(REPO, 'scripts', 'worktree-session-start.sh');

test('#1540 AC1: bootstrap script contains self-symlink guard', () => {
  const content = fs.readFileSync(BOOTSTRAP, 'utf-8');
  expect(content).toContain('self-symlink guard');
  expect(content).toContain('-L "$main_root/node_modules"');
  expect(content).toContain('readlink -f');
  expect(content).toContain('broken/self-referential symlink');
});

test('#1540 AC1: bootstrap script aborts with non-zero exit when guard fires', () => {
  const content = fs.readFileSync(BOOTSTRAP, 'utf-8');
  // The guard must `exit 1` so callers see a hard failure rather than a
  // silent chain of broken links.
  const guardRegion = content.split('self-symlink guard')[1] || '';
  expect(guardRegion).toContain('exit 1');
});

test('#1540 AC1: session-start script contains the same guard in bootstrap_node_modules', () => {
  const content = fs.readFileSync(SESSION_START, 'utf-8');
  expect(content).toContain('broken/self-symlink');
  expect(content).toContain('-L "$main_root/node_modules"');
});

test('#1540 AC1: session-start guard skips (return 0) instead of exit', () => {
  // In session-start, the bootstrap function is called from a longer
  // session flow; we want it to skip the link step but not kill the
  // whole session script. Return 0 (no link created) is the correct
  // signal here — the rest of session-start can continue.
  const content = fs.readFileSync(SESSION_START, 'utf-8');
  const fnRegion = content.split('bootstrap_node_modules()')[1] || '';
  const guardRegion = fnRegion.split('broken/self-symlink')[1] || '';
  // The guard's branch must `return 0` not `exit`.
  const firstReturnOrExit = guardRegion.match(/(return\s+0|exit\s+\d+)/);
  expect(firstReturnOrExit && firstReturnOrExit[0]).toMatch(/return\s+0/);
});

test('#1540: guard references #1539 and #1548 for traceability', () => {
  const content = fs.readFileSync(BOOTSTRAP, 'utf-8');
  expect(content).toMatch(/#1539/);
  expect(content).toMatch(/#1548/);
});

test('#1548 AC1: node_modules not tracked in git index', () => {
  const { execSync } = require('child_process');
  // From repo root, verify node_modules is no longer in `git ls-files`.
  const result = execSync('git ls-files node_modules', {
    cwd: REPO, encoding: 'utf-8',
  }).trim();
  expect(result).toBe('');
});

test('#1548 AC2: .gitignore covers both directory and symlink forms', () => {
  const content = fs.readFileSync(path.join(REPO, '.gitignore'), 'utf-8');
  // Both `node_modules` (bare, for symlinks) and `node_modules/` (dir form)
  expect(content).toMatch(/^node_modules$/m);
  expect(content).toMatch(/^node_modules\/$/m);
});
