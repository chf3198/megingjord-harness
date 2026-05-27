'use strict';
// tests/cross-team-lease-dispatch.spec.js — dispatcher-routing coverage for #1997.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');

function silent(fn) {
  const orig = process.stdout.write.bind(process.stdout);
  process.stdout.write = () => true;
  return Promise.resolve(fn()).finally(() => { process.stdout.write = orig; });
}

function tmpFile() {
  const p = path.join(os.tmpdir(), `lease-${Date.now()}-${Math.random()}.json`);
  fs.writeFileSync(p, `${JSON.stringify({ version: 1, leases: [] })}\n`);
  return p;
}

function withStub(stub, fn) {
  const dKey = require.resolve('../scripts/global/github-dispatcher');
  const lKey = require.resolve('../scripts/global/cross-team-lease');
  const orig = require.cache[dKey];
  delete require.cache[dKey];
  require.cache[dKey] = { exports: stub };
  delete require.cache[lKey];
  try { return fn(require('../scripts/global/cross-team-lease')); }
  finally {
    delete require.cache[lKey];
    if (orig) require.cache[dKey] = orig; else delete require.cache[dKey];
  }
}

test('post() routes through dispatcher execute("add-comment", ...)', async () => {
  const calls = [];
  const stub = { execute: async (op, p) => { calls.push({ op, p }); return { ok: true, provider: 'mcp' }; } };
  await withStub(stub, async (m) => { await m.post(42, 'hello'); });
  assert.equal(calls.length, 1);
  assert.equal(calls[0].op, 'add-comment');
  assert.equal(calls[0].p.issue, '42');
  assert.equal(calls[0].p.body, 'hello');
});

test('post() throws when execute returns ok:false', async () => {
  const stub = { execute: async () => ({ ok: false, provider: 'gh-cli', error: 'auth-required' }) };
  await withStub(stub, async (m) => {
    await assert.rejects(() => m.post(7, 'x'), /add-comment failed via gh-cli: auth-required/);
  });
});

test('run() does NOT call post when --post-comment flag is absent', async () => {
  const file = tmpFile();
  const calls = [];
  const stub = { execute: async (op) => { calls.push(op); return { ok: true }; } };
  await withStub(stub, async (m) => {
    await silent(() => m.run([
      'create', '--ticket', '1', '--team', 'claude-code', '--role', 'collaborator',
      '--branch', 'feat/1-test', '--file', file,
    ]));
  });
  assert.equal(calls.length, 0);
  fs.unlinkSync(file);
});

test('run() calls post when --post-comment is set on a single-result cmd', async () => {
  const file = tmpFile();
  const calls = [];
  const stub = { execute: async (op, p) => { calls.push({ op, p }); return { ok: true }; } };
  await withStub(stub, async (m) => {
    await silent(() => m.run([
      'create', '--ticket', '99', '--team', 'claude-code', '--role', 'collaborator',
      '--branch', 'feat/99-x', '--file', file, '--post-comment', 'true',
    ]));
  });
  assert.equal(calls.length, 1);
  assert.equal(calls[0].p.issue, '99');
  fs.unlinkSync(file);
});

test('run() with list cmd skips post() even when --post-comment is set', async () => {
  const file = tmpFile();
  const calls = [];
  const stub = { execute: async (op) => { calls.push(op); return { ok: true }; } };
  await withStub(stub, async (m) => {
    await silent(() => m.run(['list', '--file', file, '--post-comment', 'true']));
  });
  assert.equal(calls.length, 0);
  fs.unlinkSync(file);
});

test('module exports run, parse, post', () => {
  const m = require('../scripts/global/cross-team-lease');
  assert.equal(typeof m.run, 'function');
  assert.equal(typeof m.parse, 'function');
  assert.equal(typeof m.post, 'function');
});
