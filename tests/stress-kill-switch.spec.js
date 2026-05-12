// stress-kill-switch tests (#1411, Epic #1398 AC7).
const { test, expect } = require('@playwright/test');
const path = require('path');
const K = require(path.resolve(__dirname, '..', 'scripts', 'global', 'stress-kill-switch.js'));

test('makeKillSwitch: empty state has zero rate and no abort', () => {
  const ks = K.makeKillSwitch();
  expect(ks.rate()).toBe(0);
  expect(ks.shouldAbort()).toBe(false);
});

test('makeKillSwitch: records events and computes per-minute rate', () => {
  const ks = K.makeKillSwitch({ windowMs: 60_000 });
  const t0 = 1_700_000_000_000;
  for (let i = 0; i < 5; i++) ks.record(t0 + i * 1000);
  expect(ks.rate(t0 + 5000)).toBeCloseTo(5);
});

test('shouldAbort fires when rate exceeds threshold', () => {
  const ks = K.makeKillSwitch({ thresholdPerMin: 10, windowMs: 60_000 });
  const t0 = 1_700_000_000_000;
  for (let i = 0; i < 12; i++) ks.record(t0 + i * 100);
  expect(ks.shouldAbort(t0 + 1200)).toBe(true);
});

test('shouldAbort does not fire when rate is below threshold', () => {
  const ks = K.makeKillSwitch({ thresholdPerMin: 10, windowMs: 60_000 });
  const t0 = 1_700_000_000_000;
  for (let i = 0; i < 5; i++) ks.record(t0 + i * 1000);
  expect(ks.shouldAbort(t0 + 5000)).toBe(false);
});

test('events outside window are evicted on record', () => {
  const ks = K.makeKillSwitch({ windowMs: 60_000 });
  const t0 = 1_700_000_000_000;
  ks.record(t0);
  ks.record(t0 + 200_000);
  expect(ks.snapshot().events).toBe(1);
});

test('rolloverToFallback emits stress.kill_switch.trip event with Tier-A target', () => {
  const ev = K.rolloverToFallback('C', 'anneal-rate-exceeded');
  expect(ev.event).toBe('stress.kill_switch.trip');
  expect(ev.from_tier).toBe('C');
  expect(ev.to_tier).toBe('A');
  expect(ev.reason).toBe('anneal-rate-exceeded');
  expect(ev.ts).toMatch(/^\d{4}-\d{2}-\d{2}T/);
});

test('snapshot returns threshold and window metadata for observability', () => {
  const ks = K.makeKillSwitch({ thresholdPerMin: 15, windowMs: 30_000 });
  const snap = ks.snapshot();
  expect(snap.threshold_per_min).toBe(15);
  expect(snap.window_ms).toBe(30_000);
  expect(snap.events).toBe(0);
});

test('default constants exposed and sensible', () => {
  expect(K.DEFAULT_RATE_PER_MIN).toBe(10);
  expect(K.WINDOW_MS).toBe(60_000);
  expect(K.FALLBACK_TIER).toBe('A');
});
