// Tests for scripts/global/circuit-breaker.js (#1279).
const { test, expect } = require('@playwright/test');
const cb = require('../scripts/global/circuit-breaker');

test('#1279 AC1: create() returns closed breaker with defaults', () => {
  const b = cb.create();
  expect(b.state).toBe(cb.STATES.closed);
  expect(b.consecutiveFailures).toBe(0);
  expect(b.threshold).toBe(cb.DEFAULT_THRESHOLD);
  expect(b.coolOffMs).toBe(cb.DEFAULT_COOL_OFF_MS);
});

test('#1279 AC1: create() honors custom threshold and coolOffMs', () => {
  const b = cb.create({ threshold: 3, coolOffMs: 1000 });
  expect(b.threshold).toBe(3);
  expect(b.coolOffMs).toBe(1000);
});

test('#1279 AC1: closed state lets requests pass through', () => {
  const b = cb.create();
  expect(cb.canPass(b, 0)).toBe(true);
});

test('#1279 AC1: consecutive failures below threshold keep state closed', () => {
  const b = cb.create({ threshold: 3 });
  cb.recordFailure(b, 100);
  cb.recordFailure(b, 200);
  expect(b.state).toBe(cb.STATES.closed);
  expect(b.consecutiveFailures).toBe(2);
});

test('#1279 AC1: hitting threshold opens the breaker', () => {
  const b = cb.create({ threshold: 3 });
  cb.recordFailure(b, 100);
  cb.recordFailure(b, 200);
  cb.recordFailure(b, 300);
  expect(b.state).toBe(cb.STATES.open);
  expect(b.openedAt).toBe(300);
});

test('#1279 AC1: open state rejects requests before cool-off', () => {
  const b = cb.create({ threshold: 1, coolOffMs: 1000 });
  cb.recordFailure(b, 100);
  expect(b.state).toBe(cb.STATES.open);
  expect(cb.canPass(b, 500)).toBe(false);
  expect(cb.canPass(b, 999)).toBe(false);
});

test('#1279 AC1: open → half-open transition after cool-off elapses', () => {
  const b = cb.create({ threshold: 1, coolOffMs: 1000 });
  cb.recordFailure(b, 100);
  expect(cb.canPass(b, 1100)).toBe(true);
  expect(b.state).toBe(cb.STATES.halfOpen);
});

test('#1279 AC1: half-open + success → closed (counter reset)', () => {
  const b = cb.create({ threshold: 1, coolOffMs: 1000 });
  cb.recordFailure(b, 100);
  cb.canPass(b, 1100); // transitions to half-open
  cb.recordSuccess(b);
  expect(b.state).toBe(cb.STATES.closed);
  expect(b.consecutiveFailures).toBe(0);
});

test('#1279 AC1: half-open + failure → open (cool-off restarts)', () => {
  const b = cb.create({ threshold: 1, coolOffMs: 1000 });
  cb.recordFailure(b, 100);
  cb.canPass(b, 1100); // half-open
  cb.recordFailure(b, 1200);
  expect(b.state).toBe(cb.STATES.open);
  expect(b.openedAt).toBe(1200);
});

test('#1279 AC1: success in closed state resets consecutiveFailures', () => {
  const b = cb.create({ threshold: 3 });
  cb.recordFailure(b, 100);
  cb.recordFailure(b, 200);
  expect(b.consecutiveFailures).toBe(2);
  cb.recordSuccess(b);
  expect(b.consecutiveFailures).toBe(0);
  expect(b.state).toBe(cb.STATES.closed);
});

test('#1279 AC1: non-consecutive failures restart accumulation toward threshold', () => {
  const b = cb.create({ threshold: 3 });
  cb.recordFailure(b, 100);
  cb.recordFailure(b, 200);
  cb.recordSuccess(b);
  cb.recordFailure(b, 300);
  expect(b.state).toBe(cb.STATES.closed);
  expect(b.consecutiveFailures).toBe(1);
});

test('#1279 AC1: status() emits state snapshot for telemetry', () => {
  const b = cb.create({ threshold: 2, coolOffMs: 500 });
  cb.recordFailure(b, 100);
  const s = cb.status(b);
  expect(s.state).toBe(cb.STATES.closed);
  expect(s.consecutiveFailures).toBe(1);
  expect(s.openedAt).toBe(0);
  cb.recordFailure(b, 200);
  expect(cb.status(b).state).toBe(cb.STATES.open);
  expect(cb.status(b).openedAt).toBe(200);
});

test('#1279 AC2: integration — recovers cleanly from a burst then partial-fail then full-recover', () => {
  const b = cb.create({ threshold: 3, coolOffMs: 1000 });
  // burst of failures opens it
  for (let i = 0; i < 3; i++) cb.recordFailure(b, 100 + i * 10);
  expect(b.state).toBe(cb.STATES.open);
  // wait → half-open
  expect(cb.canPass(b, 1500)).toBe(true);
  // partial fail
  cb.recordFailure(b, 1500);
  expect(b.state).toBe(cb.STATES.open);
  expect(b.openedAt).toBe(1500);
  // wait again → half-open → success → closed
  expect(cb.canPass(b, 2700)).toBe(true);
  cb.recordSuccess(b);
  expect(b.state).toBe(cb.STATES.closed);
  expect(b.consecutiveFailures).toBe(0);
});

test('#1279: STATES constants exported and frozen', () => {
  expect(cb.STATES.closed).toBe('closed');
  expect(cb.STATES.open).toBe('open');
  expect(cb.STATES.halfOpen).toBe('half-open');
  expect(() => { cb.STATES.foo = 'bar'; }).toThrow();
});
