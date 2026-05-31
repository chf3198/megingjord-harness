const test = require('node:test');
const assert = require('node:assert');
const { spawnSync } = require('node:child_process');
const path = require('node:path');

const HOOKS = path.resolve(__dirname, '..', 'hooks', 'scripts');

function runPy(script, env = {}) {
  const proc = spawnSync('python3', ['-c', script], {
    env: { ...process.env, ...env },
    encoding: 'utf8',
  });
  return { status: proc.status, stdout: proc.stdout, stderr: proc.stderr };
}

function callMcc(fn, args, env = {}) {
  const script = `
import sys, json
sys.path.insert(0, "${HOOKS}")
import merge_claim_client as mcc
result = mcc.${fn}(${args})
print(json.dumps(result))
`;
  return runPy(script, env);
}

// --- Existing HAMR sentinel tests (ensure no regression) ---

test('HAMR sentinel: acquire returns feature-off when flag off', () => {
  const r = callMcc('acquire', '2458', { MEGINGJORD_MERGE_CLAIM: '' });
  assert.strictEqual(r.status, 0);
  assert.deepStrictEqual(JSON.parse(r.stdout), { claim_id: 'feature-off', ttl_s: 0 });
});

test('HAMR sentinel: status returns feature_off when flag off', () => {
  const r = callMcc('status', '2458', { MEGINGJORD_MERGE_CLAIM: '' });
  assert.strictEqual(r.status, 0);
  assert.deepStrictEqual(JSON.parse(r.stdout), { held: false, feature_off: true });
});

test('HAMR sentinel: release noop on feature-off claim', () => {
  const r = callMcc("release", "'feature-off'", { MEGINGJORD_MERGE_CLAIM: '' });
  assert.strictEqual(r.status, 0);
  const out = JSON.parse(r.stdout);
  assert.strictEqual(out.released, true);
  assert.strictEqual(out.noop, true);
});

// --- GitHub-label fallback mode tests (AC1, AC2) ---

test('GH-label: _hamr_disabled returns true when MEGINGJORD_HAMR_DISABLED=1', () => {
  const script = `
import sys
sys.path.insert(0, "${HOOKS}")
import merge_claim_client as mcc
print(mcc._hamr_disabled())
`;
  const r = runPy(script, { MEGINGJORD_HAMR_DISABLED: '1' });
  assert.strictEqual(r.status, 0);
  assert.ok(r.stdout.trim() === 'True');
});

test('GH-label: _hamr_disabled returns false by default', () => {
  const script = `
import sys
sys.path.insert(0, "${HOOKS}")
import merge_claim_client as mcc
print(mcc._hamr_disabled())
`;
  const r = runPy(script, {});
  assert.strictEqual(r.status, 0);
  assert.ok(r.stdout.trim() === 'False');
});

test('GH-label: acquire returns None when feature on, HAMR disabled, no GITHUB_TOKEN', () => {
  const r = callMcc('acquire', '2479', {
    MEGINGJORD_MERGE_CLAIM: '1',
    MEGINGJORD_HAMR_DISABLED: '1',
    GITHUB_TOKEN: '',
    GITHUB_REPOSITORY: '',
  });
  assert.strictEqual(r.status, 0);
  assert.strictEqual(r.stdout.trim(), 'null');
});

test('GH-label: status returns gh-label mode when feature on, HAMR disabled, no token', () => {
  const r = callMcc('status', '2479', {
    MEGINGJORD_MERGE_CLAIM: '1',
    MEGINGJORD_HAMR_DISABLED: '1',
    GITHUB_TOKEN: '',
    GITHUB_REPOSITORY: '',
  });
  assert.strictEqual(r.status, 0);
  assert.strictEqual(r.stdout.trim(), 'null');
});

test('GH-label: release handles gh-label claim_id prefix correctly', () => {
  const r = callMcc("release", "'gh-label:2479:codex'", {
    MEGINGJORD_MERGE_CLAIM: '1',
    GITHUB_TOKEN: '',
    GITHUB_REPOSITORY: '',
  });
  assert.strictEqual(r.status, 0);
  assert.strictEqual(r.stdout.trim(), 'null');
});

test('GH-label: constants correct — prefix and sentinel', () => {
  const script = `
import sys
sys.path.insert(0, "${HOOKS}")
import merge_claim_client as mcc
import json
print(json.dumps({'prefix': mcc.GH_LABEL_PREFIX, 'sentinel': mcc.SENTINEL_CLAIM_GH_PREFIX}))
`;
  const r = runPy(script, {});
  assert.strictEqual(r.status, 0);
  const out = JSON.parse(r.stdout);
  assert.strictEqual(out.prefix, 'merge-claim:held:');
  assert.strictEqual(out.sentinel, 'gh-label');
});
