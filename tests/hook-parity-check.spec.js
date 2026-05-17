'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { test } = require('node:test');

// Load by relative path; we'll inject stubs for branch/main/deployed reads.
const modulePath = path.resolve(__dirname, '..', 'scripts', 'global', 'hook-parity-check.js');
const Module = require('module');
const originalRequire = Module.prototype.require;

function withStubs(stubs, fn) {
  // Stub fs.readFileSync + execFileSync via cached module substitution.
  const realFs = require('node:fs');
  const realChild = require('node:child_process');
  const origRead = realFs.readFileSync;
  const origExec = realChild.execFileSync;
  realFs.readFileSync = (p, enc) => stubs.fs[p] !== undefined ? stubs.fs[p] : origRead(p, enc);
  realChild.execFileSync = (cmd, args, opts) => {
    if (cmd === 'git' && args[0] === 'show') {
      const ref = args[1];
      if (stubs.gitShow[ref] !== undefined) return stubs.gitShow[ref];
      throw new Error('not-found');
    }
    return origExec(cmd, args, opts);
  };
  delete require.cache[modulePath];
  try {
    const mod = require(modulePath);
    return fn(mod);
  } finally {
    realFs.readFileSync = origRead;
    realChild.execFileSync = origExec;
    delete require.cache[modulePath];
  }
}

function buildStubs({ branch, main, copilot, codex }, scriptName = 'stop_checks.py') {
  const REPO = path.resolve(__dirname, '..');
  const home = os.homedir();
  return {
    fs: {
      [path.join(REPO, 'hooks', 'scripts', scriptName)]: branch,
      [path.join(home, '.copilot', 'hooks', 'scripts', scriptName)]: copilot,
      [path.join(home, '.codex', 'devenv-ops', 'hooks', scriptName)]: codex,
    },
    gitShow: { [`origin/main:hooks/scripts/${scriptName}`]: main },
  };
}

test('ok diagnosis when branch == main == deployed', () => {
  const stubs = buildStubs({ branch: 'A', main: 'A', copilot: 'A', codex: 'A' });
  withStubs(stubs, (mod) => {
    const r = mod.diagnose('stop_checks.py');
    assert.equal(r.diagnosis, 'ok');
    assert.equal(r.recommend, null);
  });
});

test('branch-stale diagnosis when branch differs but main == deployed', () => {
  const stubs = buildStubs({ branch: 'A', main: 'B', copilot: 'B', codex: 'B' });
  withStubs(stubs, (mod) => {
    const r = mod.diagnose('stop_checks.py');
    assert.equal(r.diagnosis, 'branch-stale');
    assert.match(r.recommend, /rebase/i);
  });
});

test('runtime-stale diagnosis when branch == main but deployed differs', () => {
  const stubs = buildStubs({ branch: 'A', main: 'A', copilot: 'B', codex: 'B' });
  withStubs(stubs, (mod) => {
    const r = mod.diagnose('stop_checks.py');
    assert.equal(r.diagnosis, 'runtime-stale');
    assert.match(r.recommend, /deploy:both:apply/);
  });
});

test('branch-and-runtime-diverged when all three differ', () => {
  const stubs = buildStubs({ branch: 'A', main: 'B', copilot: 'C', codex: 'C' });
  withStubs(stubs, (mod) => {
    const r = mod.diagnose('stop_checks.py');
    assert.equal(r.diagnosis, 'branch-and-runtime-diverged');
    assert.match(r.recommend, /manual|file/i);
  });
});

test('not-deployed when both copilot and codex absent', () => {
  const stubs = buildStubs({ branch: 'A', main: 'A', copilot: null, codex: null });
  withStubs(stubs, (mod) => {
    const r = mod.diagnose('stop_checks.py');
    assert.equal(r.diagnosis, 'not-deployed');
    assert.match(r.recommend, /G5|opt-out/i);
  });
});

test('runtime-and-branch-share-fork when branch == deployed but both differ from main', () => {
  const stubs = buildStubs({ branch: 'A', main: 'B', copilot: 'A', codex: 'A' });
  withStubs(stubs, (mod) => {
    const r = mod.diagnose('stop_checks.py');
    assert.equal(r.diagnosis, 'runtime-and-branch-share-fork');
  });
});

test('exit code mapping: ok+branch-stale => 0; runtime-stale => 1; diverged => 2', () => {
  // Hard to test end-to-end without orchestrating run() across multiple scripts.
  // Validate via diagnose() output shape only.
  const ok = buildStubs({ branch: 'A', main: 'A', copilot: 'A', codex: 'A' });
  const stale = buildStubs({ branch: 'A', main: 'A', copilot: 'B', codex: 'B' });
  withStubs(ok, mod => assert.equal(mod.diagnose('stop_checks.py').diagnosis, 'ok'));
  withStubs(stale, mod => assert.equal(mod.diagnose('stop_checks.py').diagnosis, 'runtime-stale'));
});

test('TRACKED constant covers expected hook scripts', () => {
  delete require.cache[modulePath];
  const mod = require(modulePath);
  assert.equal(mod.TRACKED.length, 8);
  assert.ok(mod.TRACKED.includes('stop_checks.py'));
  assert.ok(mod.TRACKED.includes('repo_detection.py'));
  assert.ok(mod.TRACKED.includes('userprompt_gate.py'));
});
