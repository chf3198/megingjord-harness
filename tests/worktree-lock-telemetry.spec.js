'use strict';
// #1860 concern #2: telemetry for the worktree session lock. Proves valid v3
// emission per lifecycle event, best-effort no-throw semantics, the disable
// flag, and concurrent-append durability (state-mutation stress path, G6/G8).

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { test } = require('node:test');
const { fork } = require('node:child_process');

function mkRoot() { return fs.mkdtempSync(path.join(os.tmpdir(), 'wt-tele-')); }
function rm(r) { try { fs.rmSync(r, { recursive: true, force: true }); } catch {} }
function readLines(file) {
  if (!fs.existsSync(file)) return [];
  return fs.readFileSync(file, 'utf8').split('\n').filter(Boolean).map(JSON.parse);
}
// Fresh require of both modules bound to a per-test telemetry sink.
function withSink(root, fn) {
  const file = path.join(root, 'incidents.jsonl');
  const prevFile = process.env.MEGINGJORD_LOCK_TELEMETRY_FILE;
  const prevDis = process.env.MEGINGJORD_LOCK_TELEMETRY_DISABLED;
  delete process.env.MEGINGJORD_LOCK_TELEMETRY_DISABLED;
  process.env.MEGINGJORD_LOCK_TELEMETRY_FILE = file;
  try { return fn(file); }
  finally {
    if (prevFile === undefined) delete process.env.MEGINGJORD_LOCK_TELEMETRY_FILE;
    else process.env.MEGINGJORD_LOCK_TELEMETRY_FILE = prevFile;
    if (prevDis === undefined) delete process.env.MEGINGJORD_LOCK_TELEMETRY_DISABLED;
    else process.env.MEGINGJORD_LOCK_TELEMETRY_DISABLED = prevDis;
  }
}

const V3_REQUIRED = ['ts', 'version', 'service', 'event', 'env'];

test('emitLockEvent writes a valid event-schema-v3 record', () => {
  const r = mkRoot();
  try {
    withSink(r, (file) => {
      const { emitLockEvent } = require('../scripts/global/worktree-lock-telemetry.js');
      assert.equal(emitLockEvent('acquire', { team: 'claude-code', ticket: 1860 }), true);
      const [ev] = readLines(file);
      for (const f of V3_REQUIRED) assert.ok(ev[f] !== undefined, `missing ${f}`);
      assert.equal(ev.version, 3);
      assert.equal(ev.event, 'worktree.lock.acquire');
      assert.equal(ev.service, 'worktree-session-lock');
      assert.equal(ev.team, 'claude-code');
      assert.ok(['local', 'ci'].includes(ev.env));
    });
  } finally { rm(r); }
});

test('acquire / refuse / release lifecycle each emit a distinct event', () => {
  const r = mkRoot();
  try {
    withSink(r, (file) => {
      const { acquire, release } = require('../scripts/global/worktree-active-session-lock.js');
      acquire(r, 'claude-code', 1860);
      const blocked = acquire(r, 'copilot', 1842);
      assert.equal(blocked.ok, false);
      release(r, 'claude-code');
      const events = readLines(file).map(e => e.event);
      assert.ok(events.includes('worktree.lock.acquire'), 'acquire emitted');
      assert.ok(events.includes('worktree.lock.refuse'), 'refuse emitted');
      assert.ok(events.includes('worktree.lock.release'), 'release emitted');
      const refuse = readLines(file).find(e => e.event === 'worktree.lock.refuse');
      assert.equal(refuse.held_by_team, 'claude-code');
    });
  } finally { rm(r); }
});

test('replace_stale emits with the replaced team recorded', () => {
  const r = mkRoot();
  try {
    withSink(r, (file) => {
      const { acquire, STALE_MS } = require('../scripts/global/worktree-active-session-lock.js');
      fs.mkdirSync(path.join(r, '.megingjord'), { recursive: true });
      const stale = { team: 'copilot', ticket: 1, pid: 999999999,
        acquired_at: new Date(Date.now() - 2 * STALE_MS).toISOString(),
        last_heartbeat: new Date(Date.now() - 2 * STALE_MS).toISOString() };
      fs.writeFileSync(path.join(r, '.megingjord', 'active-session.lock'), JSON.stringify(stale));
      const res = acquire(r, 'claude-code', 1860);
      assert.equal(res.replaced_stale, true);
      const ev = readLines(file).find(e => e.event === 'worktree.lock.replace_stale');
      assert.ok(ev, 'replace_stale emitted');
      assert.equal(ev.replaced_team, 'copilot');
    });
  } finally { rm(r); }
});

test('best-effort: unwritable sink returns false and never throws; acquire still succeeds', () => {
  const r = mkRoot();
  try {
    const prev = process.env.MEGINGJORD_LOCK_TELEMETRY_FILE;
    const prevDis = process.env.MEGINGJORD_LOCK_TELEMETRY_DISABLED;
    delete process.env.MEGINGJORD_LOCK_TELEMETRY_DISABLED;
    // point the sink at a path whose parent is a file (mkdir will fail) -> emit swallows the error
    const bad = path.join(r, 'afile');
    fs.writeFileSync(bad, 'x');
    process.env.MEGINGJORD_LOCK_TELEMETRY_FILE = path.join(bad, 'nested', 'incidents.jsonl');
    try {
      const { emitLockEvent } = require('../scripts/global/worktree-lock-telemetry.js');
      assert.equal(emitLockEvent('acquire', { team: 't' }), false);
      const { acquire } = require('../scripts/global/worktree-active-session-lock.js');
      assert.equal(acquire(r, 'claude-code', 1860).ok, true, 'lock still works despite telemetry failure');
    } finally {
      if (prev === undefined) delete process.env.MEGINGJORD_LOCK_TELEMETRY_FILE;
      else process.env.MEGINGJORD_LOCK_TELEMETRY_FILE = prev;
      if (prevDis !== undefined) process.env.MEGINGJORD_LOCK_TELEMETRY_DISABLED = prevDis;
    }
  } finally { rm(r); }
});

test('MEGINGJORD_LOCK_TELEMETRY_DISABLED=1 short-circuits emission', () => {
  const r = mkRoot();
  try {
    const file = path.join(r, 'incidents.jsonl');
    const prevFile = process.env.MEGINGJORD_LOCK_TELEMETRY_FILE;
    const prevDis = process.env.MEGINGJORD_LOCK_TELEMETRY_DISABLED;
    process.env.MEGINGJORD_LOCK_TELEMETRY_FILE = file;
    process.env.MEGINGJORD_LOCK_TELEMETRY_DISABLED = '1';
    try {
      const { emitLockEvent } = require('../scripts/global/worktree-lock-telemetry.js');
      assert.equal(emitLockEvent('acquire', { team: 't' }), false);
      assert.equal(fs.existsSync(file), false, 'no file written when disabled');
    } finally {
      if (prevFile === undefined) delete process.env.MEGINGJORD_LOCK_TELEMETRY_FILE;
      else process.env.MEGINGJORD_LOCK_TELEMETRY_FILE = prevFile;
      if (prevDis === undefined) delete process.env.MEGINGJORD_LOCK_TELEMETRY_DISABLED;
      else process.env.MEGINGJORD_LOCK_TELEMETRY_DISABLED = prevDis;
    }
  } finally { rm(r); }
});

test('STRESS: 12 concurrent processes appending → all 12 lines land intact', async () => {
  const r = mkRoot();
  const worker = path.join(r, 'emit-worker.js');
  const file = path.join(r, 'incidents.jsonl');
  fs.writeFileSync(worker, `
    process.env.MEGINGJORD_LOCK_TELEMETRY_FILE = ${JSON.stringify(file)};
    delete process.env.MEGINGJORD_LOCK_TELEMETRY_DISABLED;
    const { emitLockEvent } = require(${JSON.stringify(path.join(__dirname, '..', 'scripts', 'global', 'worktree-lock-telemetry.js'))});
    emitLockEvent('acquire', { team: 'team-' + process.argv[2], ticket: Number(process.argv[2]) });
  `);
  try {
    const runs = Array.from({ length: 12 }, (_, i) => new Promise((resolve) => {
      const c = fork(worker, [String(i)], { silent: true });
      c.on('exit', () => resolve());
    }));
    await Promise.all(runs);
    const lines = readLines(file);
    assert.equal(lines.length, 12, `expected 12 intact JSON lines, got ${lines.length}`);
    const teams = new Set(lines.map(l => l.team));
    assert.equal(teams.size, 12, 'each concurrent writer produced a distinct durable record');
  } finally { rm(r); }
});
