const test = require('node:test');
const assert = require('node:assert');
const { execFileSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');

const DEPLOY = path.join(__dirname, '..', 'scripts', 'deploy.sh');

test('deploy.sh accepts --target antigravity (dry-run)', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'deploy-antigravity-'));
  const result = execFileSync('bash', [DEPLOY, '--target', 'antigravity'], {
    env: { ...process.env, HOME: tmp }, encoding: 'utf8',
  });
  assert.match(result, /\(dry run\) Would deploy \.antigravity\//);
});

test('deploy.sh rejects unknown targets', () => {
  try {
    execFileSync('bash', [DEPLOY, '--target', 'unknown-runtime'], {
      encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'],
    });
    assert.fail('expected rejection of unknown target');
  } catch (e) {
    assert.match(e.stdout?.toString() ?? '', /Invalid target/);
  }
});

test('deploy.sh --target antigravity --apply creates ~/.antigravity/', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'deploy-antigravity-apply-'));
  execFileSync('bash', [DEPLOY, '--target', 'antigravity', '--apply'], {
    env: { ...process.env, HOME: tmp }, encoding: 'utf8',
  });
  assert.ok(fs.existsSync(path.join(tmp, '.antigravity')),
    '~/.antigravity/ should exist after apply');
});

test('package.json defines deploy:antigravity script entries', () => {
  const pkg = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'package.json'), 'utf8'));
  assert.ok(pkg.scripts['deploy:antigravity'], 'deploy:antigravity script missing');
  assert.ok(pkg.scripts['deploy:antigravity:apply'], 'deploy:antigravity:apply script missing');
});

test('Usage string lists antigravity as valid target', () => {
  try {
    execFileSync('bash', [DEPLOY, '--bad-arg'], {
      encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'],
    });
    assert.fail('expected non-zero exit');
  } catch (e) {
    assert.match(e.stdout?.toString() ?? '', /antigravity/);
  }
});
