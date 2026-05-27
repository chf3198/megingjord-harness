'use strict';
// tests/github-dispatcher-set-labels.spec.js — coverage for the new set-labels op (#1994 AC2).
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { executeSetLabels, execute, toolName, dispatch } = require('../scripts/global/github-dispatcher');

function fakeRunner(programmedResponses) {
  const calls = [];
  const runner = async (file, args, opts) => {
    calls.push({ file, args, input: opts && opts.input });
    const head = programmedResponses.shift();
    if (head && head.throw) throw new Error(head.throw);
    return head || { stdout: '', stderr: '' };
  };
  runner.calls = calls;
  return runner;
}

test('executeSetLabels: auto-discovers repo via gh repo view when not supplied', async () => {
  const runner = fakeRunner([
    { stdout: 'owner/repo\n', stderr: '' },
    { stdout: '[]', stderr: '' },
  ]);
  const r = await executeSetLabels({ issue: 42, labels: ['status:done'] }, runner);
  assert.equal(r.ok, true);
  assert.equal(r.provider, 'gh-cli');
  assert.deepEqual(runner.calls[0].args, ['repo', 'view', '--json', 'nameWithOwner', '-q', '.nameWithOwner']);
  assert.deepEqual(runner.calls[1].args, [
    'api', 'repos/owner/repo/issues/42/labels', '-X', 'PUT', '--input', '-',
  ]);
  assert.equal(runner.calls[1].input, JSON.stringify({ labels: ['status:done'] }));
});

test('executeSetLabels: skips repo-discovery when repo provided', async () => {
  const runner = fakeRunner([{ stdout: '', stderr: '' }]);
  await executeSetLabels({ issue: 7, labels: [], repo: 'a/b' }, runner);
  assert.equal(runner.calls.length, 1);
  assert.deepEqual(runner.calls[0].args, [
    'api', 'repos/a/b/issues/7/labels', '-X', 'PUT', '--input', '-',
  ]);
});

test('executeSetLabels: propagates repo-lookup failure', async () => {
  const runner = fakeRunner([{ throw: 'gh-not-installed' }]);
  const r = await executeSetLabels({ issue: 1, labels: [] }, runner);
  assert.equal(r.ok, false);
  assert.match(r.error, /repo-lookup: gh-not-installed/);
});

test('executeSetLabels: propagates PUT failure', async () => {
  const runner = fakeRunner([
    { stdout: 'o/r', stderr: '' },
    { throw: '403 Forbidden' },
  ]);
  const r = await executeSetLabels({ issue: 1, labels: [] }, runner);
  assert.equal(r.ok, false);
  assert.match(r.error, /403 Forbidden/);
});

test('executeSetLabels: empty labels array sends {labels:[]} (full-clear semantics)', async () => {
  const runner = fakeRunner([{ stdout: '', stderr: '' }]);
  await executeSetLabels({ issue: 9, labels: [], repo: 'o/r' }, runner);
  assert.equal(runner.calls[0].input, JSON.stringify({ labels: [] }));
});

test('execute("set-labels", ...) routes through executeSetLabels in CLI mode', async () => {
  const runner = fakeRunner([{ stdout: '', stderr: '' }]);
  const r = await execute('set-labels', { issue: 1, labels: ['x'], repo: 'o/r' }, {
    env: { MEGINGJORD_MCP_DISABLED: '1' }, cliRunner: runner,
  });
  assert.equal(r.ok, true);
  assert.equal(runner.calls[0].args[0], 'api');
});

test('toolName + dispatch surface the new set-labels operation', () => {
  assert.equal(toolName('set-labels', 'mcp'), 'mcp__github__update_issue');
  assert.equal(toolName('set-labels', 'gh-cli'), 'gh api PUT labels');
  const d = dispatch('set-labels', { MEGINGJORD_MCP_DISABLED: '1' });
  assert.equal(d.ok, true);
  assert.equal(d.provider, 'gh-cli');
});
