'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { test } = require('node:test');
const { evaluate, pathCovered, isWriteTool, isDestructiveBash, pathRelativeToRoot }
  = require('../scripts/global/worktree-write-intercept.js');

function mkRoot() { return fs.mkdtempSync(path.join(os.tmpdir(), 'wt-int-')); }
function rm(r) { try { fs.rmSync(r, { recursive: true, force: true }); } catch {} }
function writeLock(r, lock) {
  fs.mkdirSync(path.join(r, '.megingjord'), { recursive: true });
  fs.writeFileSync(path.join(r, '.megingjord', 'active-session.lock'),
    JSON.stringify(lock));
}

test('isWriteTool: Write/Edit/MultiEdit/NotebookEdit are writes', () => {
  for (const t of ['Write', 'Edit', 'MultiEdit', 'NotebookEdit']) {
    assert.equal(isWriteTool(t), true, `${t} should be write`);
  }
});

test('isWriteTool: Read/Bash/Grep are not writes', () => {
  for (const t of ['Read', 'Bash', 'Grep', 'Glob']) {
    assert.equal(isWriteTool(t), false, `${t} not write`);
  }
});

test('isDestructiveBash detects rm -rf', () => {
  assert.equal(isDestructiveBash('Bash', { command: 'rm -rf /tmp/x' }), true);
});

test('isDestructiveBash ignores non-destructive Bash', () => {
  assert.equal(isDestructiveBash('Bash', { command: 'ls -la' }), false);
});

test('pathRelativeToRoot returns null for path outside checkout', () => {
  assert.equal(pathRelativeToRoot('/home/user/repo', '/etc/hosts'), null);
});

test('pathRelativeToRoot returns relative path inside checkout', () => {
  assert.equal(pathRelativeToRoot('/home/user/repo', '/home/user/repo/src/x.js'), 'src/x.js');
});

test('pathCovered returns true when path matches lease entry exactly', () => {
  const leases = [{ status: 'active', ticket: 1854, paths: ['scripts/global'] }];
  const r = pathCovered(leases, 1854, 'scripts/global');
  assert.equal(r.covered, true);
});

test('pathCovered returns true when path under lease prefix', () => {
  const leases = [{ status: 'active', ticket: 1854, paths: ['scripts/global'] }];
  const r = pathCovered(leases, 1854, 'scripts/global/foo.js');
  assert.equal(r.covered, true);
});

test('pathCovered returns false when no matching path', () => {
  const leases = [{ status: 'active', ticket: 1854, paths: ['scripts/global'] }];
  const r = pathCovered(leases, 1854, 'instructions/foo.md');
  assert.equal(r.covered, false);
});

test('pathCovered ignores closed leases', () => {
  const leases = [{ status: 'closed', ticket: 1854, paths: ['scripts/global'] }];
  const r = pathCovered(leases, 1854, 'scripts/global/foo.js');
  assert.equal(r.covered, false);
});

test('evaluate: non-write tool allowed unconditionally', () => {
  const r = mkRoot();
  try {
    const decision = evaluate({ tool_name: 'Read', tool_input: { file_path: '/x' } },
      { rootDir: r, registry: { leases: [] } });
    assert.equal(decision.decision, 'allow');
  } finally { rm(r); }
});

test('evaluate: write without session lock returns warn', () => {
  const r = mkRoot();
  try {
    const decision = evaluate({ tool_name: 'Write', tool_input: { file_path: path.join(r, 'x.js') } },
      { rootDir: r, registry: { leases: [] } });
    assert.equal(decision.decision, 'warn');
    assert.equal(decision.reason, 'no-session-lock-held');
  } finally { rm(r); }
});

test('evaluate: write with lock + matching lease allowed', () => {
  const r = mkRoot();
  try {
    writeLock(r, { team: 'claude-code', ticket: 1854, pid: process.pid,
      last_heartbeat: new Date().toISOString() });
    const decision = evaluate(
      { tool_name: 'Write', tool_input: { file_path: path.join(r, 'scripts/global/foo.js') } },
      { rootDir: r, registry: { leases: [
        { status: 'active', ticket: 1854, paths: ['scripts/global'] }] } });
    assert.equal(decision.decision, 'allow');
    assert.equal(decision.reason, 'covered-by-lease');
  } finally { rm(r); }
});

test('evaluate: write with lock but path not in lease returns warn', () => {
  const r = mkRoot();
  try {
    writeLock(r, { team: 'claude-code', ticket: 1854, pid: process.pid,
      last_heartbeat: new Date().toISOString() });
    const decision = evaluate(
      { tool_name: 'Write', tool_input: { file_path: path.join(r, 'instructions/foo.md') } },
      { rootDir: r, registry: { leases: [
        { status: 'active', ticket: 1854, paths: ['scripts/global'] }] } });
    assert.equal(decision.decision, 'warn');
    assert.equal(decision.reason, 'path-not-covered-by-lease');
    assert.match(decision.advice, /add.*instructions\/foo\.md/);
  } finally { rm(r); }
});
