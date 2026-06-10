// Refs #2844 P1-0 child of #2802 — sandbox test-exec orchestrator. Network/process-free: the runner
// is injected, and the real-fs path exercises applyChanges against an os.tmpdir (no git, no spawn).
const { test, expect } = require('@playwright/test');
const fs = require('fs');
const os = require('os');
const path = require('path');
const {
  validateProposedChange, partitionChanges, classifyVerdict,
} = require('../scripts/global/fleet-sandbox-exec.js');
const { applyChanges } = require('../scripts/global/fleet-sandbox-runner.js');

const ROOT = '/repo';
const okRunner = () => ({ exitCode: 0, stdout: 'PASS', stderr: '' });

test('#2844 AC1 partitionChanges rejects absolute and ..-escaping paths', () => {
  const { safe, rejected } = partitionChanges(
    [{ path: 'scripts/a.js', content: 'x' }, { path: '../etc/evil', content: 'y' },
      { path: '/abs/evil', content: 'z' }, { content: 'no-path' }], ROOT);
  expect(safe.map((entry) => entry.path)).toEqual(['scripts/a.js']);
  expect(rejected).toEqual(['../etc/evil', '/abs/evil', '(empty)']);
});

test('#2844 AC1/AC4 unsafe paths short-circuit to untrusted, nothing written', () => {
  let runnerCalls = 0;
  const out = validateProposedChange({
    changes: [{ path: '../escape', content: 'x' }], testCommand: ['true'], root: ROOT,
    runner: () => { runnerCalls += 1; return okRunner(); },
  });
  expect(out.trusted).toBe(false);
  expect(out.reason).toMatch(/unsafe change paths/);
  expect(runnerCalls).toBe(0); // sandbox never created when a path is unsafe
});

test('#2844 AC2/AC3 runner receives only safe changes + the operator testCommand', () => {
  let seen = null;
  const out = validateProposedChange({
    changes: [{ path: 'a.js', content: 'hi' }], testCommand: ['node', '--test'], root: ROOT,
    runner: (args) => { seen = args; return okRunner(); },
  });
  expect(seen.safe).toEqual([{ path: 'a.js', content: 'hi' }]);
  expect(seen.testCommand).toEqual(['node', '--test']);
  expect(out.trusted).toBe(true);
  expect(out.reason).toMatch(/tests passed/);
});

test('#2844 AC4 fail-closed: non-zero exit, timeout, and runner error all → untrusted', () => {
  const fail = validateProposedChange({ changes: [], testCommand: ['x'], root: ROOT,
    runner: () => ({ exitCode: 1, stdout: '', stderr: 'boom' }) });
  expect(fail.trusted).toBe(false);
  expect(fail.reason).toMatch(/exit 1/);
  const timeout = validateProposedChange({ changes: [], testCommand: ['x'], root: ROOT,
    runner: () => ({ timedOut: true, exitCode: null }) });
  expect(timeout.trusted).toBe(false);
  expect(timeout.reason).toMatch(/timed out/);
  const thrown = validateProposedChange({ changes: [], testCommand: ['x'], root: ROOT,
    runner: () => { throw new Error('git missing'); } });
  expect(thrown.trusted).toBe(false);
  expect(thrown.reason).toMatch(/sandbox error: git missing/);
});

test('#2844 validateProposedChange rejects a malformed testCommand', () => {
  expect(() => validateProposedChange({ changes: [], testCommand: [] }))
    .toThrow(/non-empty \[cmd/);
  expect(() => validateProposedChange({ changes: [], testCommand: 'node x' }))
    .toThrow(/non-empty \[cmd/);
});

test('#2844 classifyVerdict only trusts a clean zero-exit', () => {
  expect(classifyVerdict({ exitCode: 0 }).trusted).toBe(true);
  expect(classifyVerdict({ exitCode: 0, rejected: ['p'] }).trusted).toBe(false);
});

test('#2844 AC3 applyChanges writes nested files scoped to the sandbox dir', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sbx-test-'));
  try {
    applyChanges([{ path: 'scripts/global/new.js', content: 'module.exports={}' }], dir);
    const written = fs.readFileSync(path.join(dir, 'scripts/global/new.js'), 'utf8');
    expect(written).toBe('module.exports={}');
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

// #2844 gemini-review HIGH: a pre-existing LEAF symlink in the sandbox must not be followed out.
test('#2844 SECURITY applyChanges does not write through a leaf symlink', () => {
  const base = fs.mkdtempSync(path.join(os.tmpdir(), 'sbx-sym-'));
  const sandbox = path.join(base, 'wt'); fs.mkdirSync(sandbox);
  const outside = path.join(base, 'secret.txt'); fs.writeFileSync(outside, 'ORIGINAL');
  fs.symlinkSync(outside, path.join(sandbox, 'log.txt')); // leaf symlink → outside the sandbox
  try {
    applyChanges([{ path: 'log.txt', content: 'PWNED' }], sandbox);
    expect(fs.readFileSync(outside, 'utf8')).toBe('ORIGINAL'); // target untouched
    expect(fs.lstatSync(path.join(sandbox, 'log.txt')).isSymbolicLink()).toBe(false); // now a real file
    expect(fs.readFileSync(path.join(sandbox, 'log.txt'), 'utf8')).toBe('PWNED');
  } finally {
    fs.rmSync(base, { recursive: true, force: true });
  }
});

// #2844 gemini-review HIGH: a symlinked PARENT dir component must be refused (escape → throw).
test('#2844 SECURITY applyChanges throws on a symlinked parent dir', () => {
  const base = fs.mkdtempSync(path.join(os.tmpdir(), 'sbx-symp-'));
  const sandbox = path.join(base, 'wt'); fs.mkdirSync(sandbox);
  const outside = path.join(base, 'outside'); fs.mkdirSync(outside);
  fs.symlinkSync(outside, path.join(sandbox, 'dir')); // parent symlink → outside the sandbox
  try {
    expect(() => applyChanges([{ path: 'dir/evil.txt', content: 'x' }], sandbox))
      .toThrow(/sandbox escape/);
    expect(fs.existsSync(path.join(outside, 'evil.txt'))).toBe(false); // nothing written outside
  } finally {
    fs.rmSync(base, { recursive: true, force: true });
  }
});
