'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { test } = require('node:test');
const { acquire, heartbeat, release, readLock, isStale, isPidLive, STALE_MS }
  = require('../scripts/global/worktree-active-session-lock.js');

function mkRoot() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'wt-lock-'));
}
function rm(root) { try { fs.rmSync(root, { recursive: true, force: true }); } catch {} }

test('acquire creates lock when none exists', () => {
  const r = mkRoot();
  try {
    const result = acquire(r, 'claude-code', 1854);
    assert.equal(result.ok, true);
    assert.equal(result.acquired, true);
    assert.equal(result.lock.team, 'claude-code');
    assert.equal(result.lock.ticket, 1854);
  } finally { rm(r); }
});

test('acquire by same team refreshes existing lock', () => {
  const r = mkRoot();
  try {
    acquire(r, 'claude-code', 1854);
    const second = acquire(r, 'claude-code', 1854);
    assert.equal(second.ok, true);
    assert.equal(second.refreshed, true);
  } finally { rm(r); }
});

test('acquire by other team rejected when fresh lock exists', () => {
  const r = mkRoot();
  try {
    acquire(r, 'claude-code', 1854);
    const blocked = acquire(r, 'copilot', 1842);
    assert.equal(blocked.ok, false);
    assert.equal(blocked.reason, 'lock-held-by-other-team');
    assert.equal(blocked.held_by.team, 'claude-code');
  } finally { rm(r); }
});

test('acquire replaces stale lock (PID dead + heartbeat aged)', () => {
  const r = mkRoot();
  try {
    fs.mkdirSync(path.join(r, '.megingjord'), { recursive: true });
    const stale = { team: 'copilot', ticket: 1842, pid: 999999999,
      acquired_at: new Date(Date.now() - 2 * STALE_MS).toISOString(),
      last_heartbeat: new Date(Date.now() - 2 * STALE_MS).toISOString() };
    fs.writeFileSync(path.join(r, '.megingjord', 'active-session.lock'),
      JSON.stringify(stale));
    const result = acquire(r, 'claude-code', 1854);
    assert.equal(result.ok, true);
    assert.equal(result.replaced_stale, true);
  } finally { rm(r); }
});

test('heartbeat refreshes last_heartbeat for matching team', () => {
  const r = mkRoot();
  try {
    acquire(r, 'claude-code', 1854, { now: Date.now() - 60000 });
    const result = heartbeat(r, 'claude-code');
    assert.equal(result.ok, true);
  } finally { rm(r); }
});

test('heartbeat refuses for non-matching team', () => {
  const r = mkRoot();
  try {
    acquire(r, 'claude-code', 1854);
    const result = heartbeat(r, 'copilot');
    assert.equal(result.ok, false);
    assert.equal(result.reason, 'no-matching-lock');
  } finally { rm(r); }
});

test('release deletes lock for matching team', () => {
  const r = mkRoot();
  try {
    acquire(r, 'claude-code', 1854);
    const result = release(r, 'claude-code');
    assert.equal(result.ok, true);
    assert.equal(result.released, true);
    assert.equal(readLock(r), null);
  } finally { rm(r); }
});

test('release refuses for other team', () => {
  const r = mkRoot();
  try {
    acquire(r, 'claude-code', 1854);
    const result = release(r, 'copilot');
    assert.equal(result.ok, false);
  } finally { rm(r); }
});

test('isPidLive returns true for own pid', () => {
  assert.equal(isPidLive(process.pid), true);
});

test('isPidLive returns false for invalid pid', () => {
  assert.equal(isPidLive(0), false);
  assert.equal(isPidLive(-1), false);
});

test('isStale: null lock not stale', () => {
  assert.equal(isStale(null), false);
});

test('isStale: dead-PID lock is stale', () => {
  assert.equal(isStale({ pid: 999999999, last_heartbeat: new Date().toISOString() }), true);
});

test('isStale: live PID + recent heartbeat not stale', () => {
  assert.equal(isStale({ pid: process.pid, last_heartbeat: new Date().toISOString() }), false);
});
