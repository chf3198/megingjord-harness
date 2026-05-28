const test = require('node:test');
const assert = require('node:assert');
const { execFileSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');

function runSync(syncPath, env, args = []) {
  try {
    const stdout = execFileSync('bash', [syncPath, ...args], {
      env,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    return { code: 0, stdout, stderr: '' };
  } catch (e) {
    return {
      code: e.status ?? -1,
      stdout: e.stdout?.toString() ?? '',
      stderr: e.stderr?.toString() ?? '',
    };
  }
}

function makeFakeCheckout(parent, name) {
  const root = path.join(parent, name);
  fs.mkdirSync(path.join(root, 'scripts'), { recursive: true });
  const sourceSync = path.join(__dirname, '..', 'scripts', 'sync.sh');
  fs.copyFileSync(sourceSync, path.join(root, 'scripts', 'sync.sh'));
  fs.chmodSync(path.join(root, 'scripts', 'sync.sh'), 0o755);
  fs.mkdirSync(path.join(root, '.copilot-fake', 'skills'), { recursive: true });
  return root;
}

test('sync.sh refuses canonical-main write without override flag', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'sync-canonical-'));
  const fakeMain = makeFakeCheckout(tmp, 'devenv-ops');
  const env = { ...process.env, HOME: tmp };
  const result = runSync(path.join(fakeMain, 'scripts', 'sync.sh'), env);
  assert.strictEqual(result.code, 2, 'exit code 2 expected');
  assert.match(result.stderr, /canonical-main read-only/);
  assert.match(result.stderr, /allow-canonical-write/);
});

test('sync.sh permits canonical-main write with --allow-canonical-write override', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'sync-canonical-allow-'));
  const fakeMain = makeFakeCheckout(tmp, 'devenv-ops');
  const env = { ...process.env, HOME: tmp };
  const result = runSync(
    path.join(fakeMain, 'scripts', 'sync.sh'),
    env,
    ['--allow-canonical-write', '--dry-run']
  );
  assert.notStrictEqual(result.code, 2,
    'override flag should bypass canonical-main refusal; got refusal exit-2');
});

test('sync.sh permits write from a worktree path (devenv-ops-<suffix>)', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'sync-worktree-'));
  const fakeWorktree = makeFakeCheckout(tmp, 'devenv-ops-2355');
  const env = { ...process.env, HOME: tmp };
  const result = runSync(
    path.join(fakeWorktree, 'scripts', 'sync.sh'),
    env,
    ['--dry-run']
  );
  assert.notStrictEqual(result.code, 2,
    'worktree path should not be classified as canonical main');
});

test('sync.sh permits --dry-run from canonical main (introspection allowed)', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'sync-dry-canonical-'));
  const fakeMain = makeFakeCheckout(tmp, 'devenv-ops');
  const env = { ...process.env, HOME: tmp };
  const result = runSync(
    path.join(fakeMain, 'scripts', 'sync.sh'),
    env,
    ['--dry-run']
  );
  assert.notStrictEqual(result.code, 2,
    'dry-run from canonical main should not trip the refusal (no writes happen)');
});
