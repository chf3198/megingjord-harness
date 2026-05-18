'use strict';

const assert = require('node:assert/strict');
const { test } = require('node:test');
const { findStale, expireStale, commentBlockForLease, STALE_THRESHOLD_HOURS }
  = require('../scripts/global/worktree-lease-heartbeat.js');

const HOUR_MS = 60 * 60 * 1000;

function mkLease(overrides = {}) {
  return { ticket: 1854, team: 'claude-code', branch: 'feat/x', status: 'active',
    created_at: new Date().toISOString(), last_seen: new Date().toISOString(),
    ...overrides };
}

test('findStale: empty registry returns empty', () => {
  assert.deepEqual(findStale({ leases: [] }), []);
});

test('findStale: fresh lease not stale', () => {
  const lease = mkLease();
  assert.deepEqual(findStale({ leases: [lease] }), []);
});

test(`findStale: lease with last_seen >${STALE_THRESHOLD_HOURS}h ago is stale`, () => {
  const now = Date.now();
  const stale = mkLease({ last_seen: new Date(now - (STALE_THRESHOLD_HOURS + 1) * HOUR_MS).toISOString() });
  const result = findStale({ leases: [stale] }, now);
  assert.equal(result.length, 1);
  assert.equal(result[0].ticket, stale.ticket);
});

test('findStale: closed lease ignored regardless of age', () => {
  const now = Date.now();
  const old = mkLease({ status: 'closed',
    last_seen: new Date(now - (STALE_THRESHOLD_HOURS + 1) * HOUR_MS).toISOString() });
  assert.deepEqual(findStale({ leases: [old] }, now), []);
});

test('findStale: missing last_seen falls back to created_at', () => {
  const now = Date.now();
  const lease = mkLease({ last_seen: undefined,
    created_at: new Date(now - (STALE_THRESHOLD_HOURS + 2) * HOUR_MS).toISOString() });
  const result = findStale({ leases: [lease] }, now);
  assert.equal(result.length, 1);
});

test('expireStale: flips status + records expiry metadata', () => {
  const now = Date.now();
  const stale = mkLease({ last_seen: new Date(now - 50 * HOUR_MS).toISOString() });
  const result = expireStale({ leases: [stale] }, now);
  assert.equal(result.expired.length, 1);
  assert.equal(stale.status, 'expired');
  assert.equal(stale.expiry_reason, 'heartbeat-timeout');
  assert.ok(stale.expired_at);
});

test('expireStale: leaves fresh leases untouched', () => {
  const lease = mkLease();
  const result = expireStale({ leases: [lease] });
  assert.equal(result.expired.length, 0);
  assert.equal(lease.status, 'active');
});

test('commentBlockForLease includes ticket + reason + timestamps', () => {
  const lease = mkLease({ expired_at: new Date().toISOString() });
  const block = commentBlockForLease(lease);
  assert.match(block, /CROSS_TEAM_LEASE_EXPIRE/);
  assert.match(block, /#1854/);
  assert.match(block, /heartbeat-timeout/);
});

test(`STALE_THRESHOLD_HOURS is ${STALE_THRESHOLD_HOURS} (matches AC5)`, () => {
  assert.equal(STALE_THRESHOLD_HOURS, 24);
});
