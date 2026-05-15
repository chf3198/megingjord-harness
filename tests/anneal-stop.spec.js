// Unit tests for scripts/global/anneal-stop.js (Epic #1568 AC-5, #1574).
// Pins the stopping rules: max 3 iterations, |delta| <= 0.5, or gates-green.
// Precedence: gates > iter-cap > delta-cap.
const { test, expect } = require('@playwright/test');
const path = require('path');
const A = require(path.resolve(__dirname, '..', 'scripts', 'global', 'anneal-stop.js'));

test('exposes MAX_ITERATIONS=3 and DELTA_CAP=0.5 as module constants', () => {
  expect(A.MAX_ITERATIONS).toBe(3);
  expect(A.DELTA_CAP).toBe(0.5);
});

test('first iteration (no prev_rubric_mean) returns stop=false reason=no-prev', () => {
  const result = A.shouldStop({ iterations: 1, current_rubric_mean: 7.0 });
  expect(result.stop).toBe(false);
  expect(result.reason).toBe('no-prev');
});

test('gates-green wins over every other condition (highest precedence)', () => {
  const result = A.shouldStop({
    iterations: 99,
    prev_rubric_mean: 7.0,
    current_rubric_mean: 9.9,
    deterministic_gates_ok: true,
  });
  expect(result.stop).toBe(true);
  expect(result.reason).toBe('gates');
});

test('iter-cap fires at iterations === MAX_ITERATIONS when gates not green', () => {
  const result = A.shouldStop({
    iterations: 3,
    prev_rubric_mean: 7.0,
    current_rubric_mean: 7.4,
    deterministic_gates_ok: false,
  });
  expect(result.stop).toBe(true);
  expect(result.reason).toBe('iter-cap');
});

test('iter just below cap (iterations=2) continues when no other trip', () => {
  const result = A.shouldStop({
    iterations: 2,
    prev_rubric_mean: 7.0,
    current_rubric_mean: 8.0,
    deterministic_gates_ok: false,
  });
  expect(result.stop).toBe(false);
  expect(result.reason).toBe('continue');
});

test('delta-cap fires when |delta| <= DELTA_CAP', () => {
  const result = A.shouldStop({
    iterations: 2,
    prev_rubric_mean: 8.0,
    current_rubric_mean: 8.4,
    deterministic_gates_ok: false,
  });
  expect(result.stop).toBe(true);
  expect(result.reason).toBe('delta-cap');
});

test('delta just above cap (|delta| = 0.51) continues', () => {
  const result = A.shouldStop({
    iterations: 2,
    prev_rubric_mean: 8.0,
    current_rubric_mean: 8.51,
    deterministic_gates_ok: false,
  });
  expect(result.stop).toBe(false);
  expect(result.reason).toBe('continue');
});

test('precedence: iter-cap wins over delta-cap when both fire', () => {
  const result = A.shouldStop({
    iterations: 3,
    prev_rubric_mean: 8.0,
    current_rubric_mean: 8.4,
    deterministic_gates_ok: false,
  });
  expect(result.stop).toBe(true);
  expect(result.reason).toBe('iter-cap');
});

test('malformed input: missing iterations field defaults to 0 (treated as first iter)', () => {
  const result = A.shouldStop({});
  expect(result.stop).toBe(false);
  expect(result.reason).toBe('no-prev');
});

test('malformed input: non-numeric rubric means yield NaN delta and trigger continue', () => {
  const result = A.shouldStop({
    iterations: 2,
    prev_rubric_mean: 'not a number',
    current_rubric_mean: 'also not',
    deterministic_gates_ok: false,
  });
  expect(result.stop).toBe(false);
  expect(result.reason).toBe('continue');
});

test('telemetrySink is invoked with the decision payload when provided', () => {
  const events = [];
  const sink = payload => events.push(payload);
  A.shouldStop({
    iterations: 3,
    prev_rubric_mean: 7.0,
    current_rubric_mean: 7.4,
    telemetrySink: sink,
  });
  expect(events).toHaveLength(1);
  expect(events[0].reason).toBe('iter-cap');
  expect(events[0].ts).toMatch(/^\d{4}-\d{2}-\d{2}T/);
});

test('telemetrySink that throws does not affect the returned decision', () => {
  const result = A.shouldStop({
    iterations: 3,
    prev_rubric_mean: 7.0,
    current_rubric_mean: 7.4,
    telemetrySink: () => { throw new Error('disk full'); },
  });
  expect(result.stop).toBe(true);
  expect(result.reason).toBe('iter-cap');
});

test('null prev with gates-green still stops on gates (gates precedence beats no-prev)', () => {
  const result = A.shouldStop({
    iterations: 0,
    prev_rubric_mean: null,
    current_rubric_mean: null,
    deterministic_gates_ok: true,
  });
  expect(result.stop).toBe(true);
  expect(result.reason).toBe('gates');
});
