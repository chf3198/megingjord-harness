'use strict';
// tests/issue-transition-dispatch.spec.js — coverage for issue-transition.js migration (#1994).
const { test } = require('node:test');
const assert = require('node:assert/strict');

function withStub(stub, fn) {
  const dK = require.resolve('../scripts/global/github-dispatcher');
  const tK = require.resolve('../scripts/global/issue-transition');
  const orig = require.cache[dK];
  delete require.cache[dK];
  require.cache[dK] = { exports: stub };
  delete require.cache[tK];
  try { return fn(require('../scripts/global/issue-transition')); }
  finally { delete require.cache[tK]; if (orig) require.cache[dK] = orig; else delete require.cache[dK]; }
}
function silent(fn) {
  const o = process.stdout.write.bind(process.stdout);
  const e = process.stderr.write.bind(process.stderr);
  process.stdout.write = () => true;
  process.stderr.write = () => true;
  return Promise.resolve(fn()).finally(() => { process.stdout.write = o; process.stderr.write = e; });
}

test('parseArgs surfaces --force and --dry-run extras', () => {
  const m = require('../scripts/global/issue-transition');
  const a = m.parseArgs(['42', 'in-progress', 'testing', '--dry-run']);
  assert.equal(a.issue, '42');
  assert.equal(a.dryRun, true);
  assert.equal(a.force, false);
});

test('validateTransition allows declared transitions', () => {
  const m = require('../scripts/global/issue-transition');
  assert.doesNotThrow(() => m.validateTransition({
    issue: '1', fromStatus: 'in-progress', toStatus: 'testing', force: false,
  }));
});

test('validateTransition rejects illegal pairs without --force', () => {
  const m = require('../scripts/global/issue-transition');
  assert.throws(() => m.validateTransition({
    issue: '1', fromStatus: 'backlog', toStatus: 'done', force: false,
  }), /Invalid transition/);
});

test('nextLabels strips existing status/role + appends new pair', () => {
  const m = require('../scripts/global/issue-transition');
  const out = m.nextLabels(['type:task', 'status:in-progress', 'role:collaborator', 'priority:P2'], 'testing');
  assert.ok(out.includes('status:testing') && out.includes('role:admin'));
  assert.ok(out.includes('type:task') && out.includes('priority:P2'));
  assert.ok(!out.includes('status:in-progress') && !out.includes('role:collaborator'));
});

test('transition --dry-run reads but skips set-labels', async () => {
  const calls = [];
  const stub = { execute: async (op) => {
    calls.push(op);
    return op === 'get-issue'
      ? { ok: true, stdout: JSON.stringify({ labels: [{ name: 'status:in-progress' }], title: 'x' }) }
      : { ok: true };
  } };
  await withStub(stub, async (m) => {
    await silent(() => m.transition(['42', 'in-progress', 'testing', '--dry-run']));
  });
  assert.deepEqual(calls, ['get-issue']);
});

test('transition calls set-labels when not --dry-run', async () => {
  const calls = [];
  const stub = { execute: async (op, p) => {
    calls.push({ op, p });
    return op === 'get-issue'
      ? { ok: true, stdout: JSON.stringify({ labels: [{ name: 'status:testing' }], title: 't' }) }
      : { ok: true };
  } };
  await withStub(stub, async (m) => {
    await silent(() => m.transition(['7', 'testing', 'review']));
  });
  assert.equal(calls.length, 2);
  assert.equal(calls[1].op, 'set-labels');
  assert.ok(calls[1].p.labels.includes('status:review') && calls[1].p.labels.includes('role:consultant'));
});

test('transition throws when from-status does not match current state', async () => {
  const stub = { execute: async (op) => (op === 'get-issue'
    ? { ok: true, stdout: JSON.stringify({ labels: [{ name: 'status:in-progress' }] }) }
    : { ok: true }) };
  await withStub(stub, async (m) => {
    await silent(async () => {
      await assert.rejects(() => m.transition(['1', 'ready', 'in-progress']), /not at status:ready/);
    });
  });
});
