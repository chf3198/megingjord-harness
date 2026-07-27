'use strict';
// #3860 (Epic #3854 GAP-D) — hook-install path portability + dangling-appended-path self-heal.
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const REPO = path.join(__dirname, '..');
const hsh = require(path.join(REPO, 'scripts', 'global', 'hook-symlink-health.js'));

function tmp() { return fs.mkdtempSync(path.join(os.tmpdir(), 'gap-d-')); }

test('scanAppendedPaths detects a dangling embedded abs hook path', () => {
  const dir = tmp();
  const file = path.join(dir, 'pre-push');
  fs.writeFileSync(file, '#!/usr/bin/env bash\n"/nonexistent-xyz/scripts/hooks/pre-push-branch-check.sh" "$@"\n');
  const { dangling } = hsh.scanAppendedPaths([file]);
  assert.strictEqual(dangling.length, 1);
  assert.match(dangling[0].ref, /pre-push-branch-check\.sh$/);
});

test('scanAppendedPaths does NOT flag a live (existing) hook path', () => {
  const live = path.join(REPO, 'scripts', 'hooks', 'pre-push-branch-check.sh');
  assert.ok(fs.existsSync(live), 'fixture: canonical hook script must exist');
  const dir = tmp();
  const file = path.join(dir, 'pre-push');
  fs.writeFileSync(file, `#!/usr/bin/env bash\n"${live}" "$@"\n`);
  assert.strictEqual(hsh.scanAppendedPaths([file]).dangling.length, 0);
});

test('canonicalScriptFor maps a ref to the canonical checkout', () => {
  const r = hsh.canonicalScriptFor('/old/wt/scripts/hooks/pre-push-branch-check.sh', '/canon');
  assert.strictEqual(r, path.join('/canon', 'scripts', 'hooks', 'pre-push-branch-check.sh'));
});

test('healAppendedPath repoints a dangling ref to the canonical script (and rewrites the file)', () => {
  const dir = tmp();
  const file = path.join(dir, 'pre-push');
  const ghost = '/deleted-worktree/scripts/hooks/pre-push-branch-check.sh';
  fs.writeFileSync(file, `#!/usr/bin/env bash\n"${ghost}" "$@"\n`);
  const ok = hsh.healAppendedPath(file, ghost, REPO); // REPO has a real scripts/hooks/pre-push-branch-check.sh
  assert.strictEqual(ok, true);
  const healed = fs.readFileSync(file, 'utf8');
  assert.ok(!healed.includes(ghost), 'ghost path removed');
  assert.ok(healed.includes(path.join(REPO, 'scripts', 'hooks', 'pre-push-branch-check.sh')), 'canonical path written');
});

test('healAppendedPath is fail-closed when the canonical replacement does not exist', () => {
  const dir = tmp();
  const file = path.join(dir, 'pre-push');
  const ghost = '/deleted/scripts/hooks/pre-push-branch-check.sh';
  const before = `#!/usr/bin/env bash\n"${ghost}" "$@"\n`;
  fs.writeFileSync(file, before);
  const ok = hsh.healAppendedPath(file, ghost, '/no-such-canonical-root');
  assert.strictEqual(ok, false);
  assert.strictEqual(fs.readFileSync(file, 'utf8'), before, 'file unchanged when no canonical target');
});

test('install-hooks.sh bakes the CANONICAL checkout path, not the worktree, into the hook', () => {
  const base = tmp();
  const main = path.join(base, 'main');
  // minimal repo with the two hook scripts install-hooks.sh needs
  fs.mkdirSync(path.join(main, 'scripts', 'hooks'), { recursive: true });
  for (const s of ['pre-push-branch-check.sh', 'branch-ops-audit.sh']) {
    fs.writeFileSync(path.join(main, 'scripts', 'hooks', s), '#!/usr/bin/env bash\nexit 0\n', { mode: 0o755 });
  }
  fs.copyFileSync(path.join(REPO, 'scripts', 'global', 'install-hooks.sh'),
    path.join(main, 'scripts', 'global-install-hooks.sh'));
  const git = (args, cwd) => execFileSync('git', args, { cwd, encoding: 'utf8' });
  git(['init', '-q', '-b', 'main'], main);
  git(['config', 'user.email', 't@t'], main); git(['config', 'user.name', 't'], main);
  git(['add', '-A'], main); git(['commit', '-qm', 'init'], main);
  const wt = path.join(base, 'wt-999');
  git(['worktree', 'add', '-q', '-b', 'feat/999-x', wt], main);
  // run the installer FROM the worktree
  execFileSync('bash', [path.join(main, 'scripts', 'global-install-hooks.sh')], { cwd: wt, encoding: 'utf8' });
  // Resolve the worktree's actual git hooks dir (layout-agnostic).
  const hooksDir = execFileSync('git', ['-C', wt, 'rev-parse', '--path-format=absolute', '--git-path', 'hooks'],
    { encoding: 'utf8' }).trim();
  const hook = path.join(hooksDir, 'pre-push');
  assert.ok(fs.existsSync(hook) || fs.lstatSync(hook, { throwIfNoEntry: false }), 'a pre-push hook was written');
  // Fresh worktree => the hook is a SYMLINK to the canonical script; read its target, not content.
  const lst = fs.lstatSync(hook);
  const reference = lst.isSymbolicLink() ? fs.readlinkSync(hook) : fs.readFileSync(hook, 'utf8');
  const canonical = path.join(main, 'scripts', 'hooks', 'pre-push-branch-check.sh');
  assert.ok(reference.includes(canonical),
    `hook must reference the canonical (main) checkout path; got: ${reference}`);
  assert.ok(!reference.includes(path.join(wt, 'scripts', 'hooks')),
    'hook must NOT hardcode the worktree path (GAP-D)');
});
