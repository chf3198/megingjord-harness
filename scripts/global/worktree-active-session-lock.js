#!/usr/bin/env node
// worktree-active-session-lock (#1854 AC3) — flock-style session lock for the
// checkout root. Any orchestrator acquires this before any write. Stale-aware:
// PID-checked + heartbeat-aware so a crashed session doesn't permanently lock.
'use strict';

const fs = require('node:fs');
const path = require('node:path');

const LOCK_REL = '.megingjord/active-session.lock';
const STALE_MS = 30 * 60 * 1000;

function lockPath(rootDir) {
  return path.join(rootDir, LOCK_REL);
}

function ensureDir(file) {
  const dir = path.dirname(file);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function readLock(rootDir) {
  const file = lockPath(rootDir);
  if (!fs.existsSync(file)) return null;
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); }
  catch { return null; }
}

function isPidLive(pid) {
  if (!Number.isInteger(pid) || pid <= 0) return false;
  try { process.kill(pid, 0); return true; } catch { return false; }
}

function isStale(lock, now = Date.now()) {
  if (!lock) return false;
  if (!isPidLive(lock.pid)) return true;
  const last = Date.parse(lock.last_heartbeat || lock.acquired_at || '');
  if (!Number.isFinite(last)) return true;
  return (now - last) > STALE_MS;
}

function acquire(rootDir, team, ticket = null, opts = {}) {
  const file = lockPath(rootDir);
  ensureDir(file);
  const existing = readLock(rootDir);
  const now = opts.now ?? Date.now();
  if (existing && !isStale(existing, now)) {
    if (existing.team === team) {
      const refreshed = { ...existing, last_heartbeat: new Date(now).toISOString() };
      fs.writeFileSync(file, JSON.stringify(refreshed, null, 2), 'utf8');
      return { ok: true, refreshed: true, lock: refreshed };
    }
    return { ok: false, reason: 'lock-held-by-other-team', held_by: existing };
  }
  const lock = { team, ticket, pid: process.pid, host: require('node:os').hostname(),
    acquired_at: new Date(now).toISOString(),
    last_heartbeat: new Date(now).toISOString() };
  fs.writeFileSync(file, JSON.stringify(lock, null, 2), 'utf8');
  return { ok: true, acquired: true, lock, replaced_stale: !!existing };
}

function heartbeat(rootDir, team, now = Date.now()) {
  const existing = readLock(rootDir);
  if (!existing || existing.team !== team) return { ok: false, reason: 'no-matching-lock' };
  existing.last_heartbeat = new Date(now).toISOString();
  fs.writeFileSync(lockPath(rootDir), JSON.stringify(existing, null, 2), 'utf8');
  return { ok: true, lock: existing };
}

function release(rootDir, team) {
  const existing = readLock(rootDir);
  if (!existing) return { ok: true, noop: true };
  if (existing.team !== team) return { ok: false, reason: 'lock-not-held-by-this-team',
    held_by: existing };
  fs.unlinkSync(lockPath(rootDir));
  return { ok: true, released: true };
}

module.exports = { acquire, heartbeat, release, readLock, isStale, isPidLive,
  lockPath, LOCK_REL, STALE_MS };
