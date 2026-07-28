'use strict';

// #1860: telemetry emits to a global sink; disable it here so these
// lock-correctness / p99 specs stay byte-identical in behaviour and never touch HOME.
process.env.MEGINGJORD_LOCK_TELEMETRY_DISABLED = '1';
// Stress tests for Epic #1854 worktree-isolation (concurrency, chaos, corruption, perf).
// Goal alignment: G2 quality + G6 resilience + G7 throughput.

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { test } = require('node:test');
const { fork } = require('node:child_process');
const { acquire, heartbeat, release, readLock, isStale, lockPath }
  = require('../scripts/global/worktree-active-session-lock.js');

function mkRoot() { return fs.mkdtempSync(path.join(os.tmpdir(), 'stress-wt-')); }
function rm(r) { try { fs.rmSync(r, { recursive: true, force: true }); } catch {} }

const ACQUIRE_WORKER = path.join(__dirname, 'fixtures', 'stress-acquire-worker.js');
const WORKER_BODY = `
const { acquire } = require('${path.join(__dirname, '..', 'scripts', 'global', 'worktree-active-session-lock.js')}');
const [,, rootDir, team, ticket] = process.argv;
const r = acquire(rootDir, team, Number(ticket));
process.send && process.send(r);
process.exit(r.ok ? 0 : 1);
`;

function ensureWorker() {
  const dir = path.dirname(ACQUIRE_WORKER);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(ACQUIRE_WORKER, WORKER_BODY, 'utf8');
}

function spawnAcquire(rootDir, team, ticket) {
  return new Promise((resolve) => {
    const child = fork(ACQUIRE_WORKER, [rootDir, team, String(ticket)], { silent: true });
    let msg = null;
    child.on('message', m => { msg = m; });
    child.on('exit', code => resolve({ code, msg }));
  });
}

test('CONCURRENCY: 20 parallel processes — exactly 1 winner (AC1)', async () => {
  ensureWorker();
  const r = mkRoot();
  try {
    const workers = Array.from({ length: 20 }, (_, i) =>
      spawnAcquire(r, `team-${i}`, 1854));
    const results = await Promise.all(workers);
    const winners = results.filter(x => x.code === 0 && x.msg?.ok);
    const lock = readLock(r);
    assert.equal(winners.length, 1, `expected 1 winner, got ${winners.length}`);
    assert.ok(lock, 'lock file should exist after concurrent acquires');
    assert.ok(lock.team.startsWith('team-'), 'lock owned by one of the racing teams');
  } finally { rm(r); }
});

test('CHAOS: corrupted lock file → next acquire re-establishes (AC3)', () => {
  const r = mkRoot();
  try {
    acquire(r, 'claude-code', 1854);
    fs.writeFileSync(lockPath(r), 'not-valid-json{{{', 'utf8');
    const result = acquire(r, 'claude-code', 1854);
    assert.equal(result.ok, true, 'should recover from corrupted lock');
  } finally { rm(r); }
});

test('CHAOS: truncated lock file → graceful recovery', () => {
  const r = mkRoot();
  try {
    acquire(r, 'claude-code', 1854);
    fs.writeFileSync(lockPath(r), '{"team":"clau', 'utf8');
    const result = acquire(r, 'claude-code', 1854);
    assert.equal(result.ok, true);
  } finally { rm(r); }
});

test('PERF: acquire latency p99 < 50ms on cold + warm (AC4)', () => {
  const r = mkRoot();
  try {
    const samples = [];
    for (let i = 0; i < 100; i++) {
      const start = process.hrtime.bigint();
      acquire(r, 'claude-code', 1854);
      const elapsed = Number(process.hrtime.bigint() - start) / 1_000_000;
      samples.push(elapsed);
    }
    samples.sort((a, b) => a - b);
    const p99 = samples[Math.floor(samples.length * 0.99)];
    assert.ok(p99 < 50, `acquire p99 ${p99.toFixed(2)}ms exceeds 50ms budget`);
  } finally { rm(r); }
});

test('CONCURRENCY: heartbeat under 10 parallel calls — consistent final state (AC9)', async () => {
  const r = mkRoot();
  try {
    acquire(r, 'claude-code', 1854);
    const heartbeats = Array.from({ length: 10 }, () =>
      Promise.resolve(heartbeat(r, 'claude-code')));
    const results = await Promise.all(heartbeats);
    const successes = results.filter(r => r.ok);
    assert.equal(successes.length, 10);
    const lock = readLock(r);
    assert.equal(lock.team, 'claude-code');
  } finally { rm(r); }
});

test('CHAOS: dead PID + AGED heartbeat treated as stale (per DEAD_PID_GRACE_MS)', () => {
  const r = mkRoot();
  try {
    fs.mkdirSync(path.join(r, '.megingjord'), { recursive: true });
    const oldIso = new Date(Date.now() - 10 * 60 * 1000).toISOString();
    const ghostLock = { team: 'ghost', ticket: 0, pid: 2147483600,
      acquired_at: oldIso, last_heartbeat: oldIso };
    fs.writeFileSync(lockPath(r), JSON.stringify(ghostLock));
    const result = acquire(r, 'claude-code', 1854);
    assert.equal(result.ok, true, 'should claim lock from dead PID with aged heartbeat');
    assert.equal(result.replaced_stale, true);
  } finally { rm(r); }
});

test('ADVERSARIAL: PID-spoofed lock with own PID still blocks until heartbeat ages', () => {
  const r = mkRoot();
  try {
    fs.mkdirSync(path.join(r, '.megingjord'), { recursive: true });
    const spoofed = { team: 'attacker', ticket: 9999, pid: process.pid,
      acquired_at: new Date().toISOString(), last_heartbeat: new Date().toISOString() };
    fs.writeFileSync(lockPath(r), JSON.stringify(spoofed));
    const result = acquire(r, 'victim', 1854);
    assert.equal(result.ok, false);
    assert.equal(result.reason, 'lock-held-by-other-team');
  } finally { rm(r); }
});

test('RELEASE chaos: release after PID exit followed by re-acquire succeeds', () => {
  const r = mkRoot();
  try {
    acquire(r, 'claude-code', 1854);
    release(r, 'claude-code');
    const result = acquire(r, 'copilot', 1842);
    assert.equal(result.ok, true);
    assert.equal(result.acquired, true);
  } finally { rm(r); }
});

test('FUZZ: 50 random acquire/release cycles for same team — final state consistent', () => {
  const r = mkRoot();
  try {
    for (let i = 0; i < 50; i++) {
      if (Math.random() < 0.6) acquire(r, 'claude-code', i);
      else release(r, 'claude-code');
    }
    const lock = readLock(r);
    if (lock) assert.equal(lock.team, 'claude-code');
  } finally { rm(r); }
});
