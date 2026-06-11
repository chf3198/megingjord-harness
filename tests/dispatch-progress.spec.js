'use strict';
// tdd-pyramid spec for scripts/global/dispatch-progress.js (#2842 / Epic #2926 C2).
// Covers AC1 (start line + heartbeat + clear-on-settle + propagation) and AC4 (unref / no leak).
const test = require('node:test');
const assert = require('node:assert');
const { withProgress, DEFAULT_INTERVAL_MS } = require('../scripts/global/dispatch-progress');

// A controllable clock: each call returns the next value in the supplied sequence (last value sticks).
function fakeClock(seq) {
  let i = 0;
  return () => seq[Math.min(i++, seq.length - 1)];
}

const delay = (ms) => new Promise((res) => setTimeout(res, ms));

test('default interval is 30s', () => {
  assert.strictEqual(DEFAULT_INTERVAL_MS, 30_000);
});

test('AC1: emits a start line with the label and interval before resolving', async () => {
  const lines = [];
  const result = await withProgress('fleet inference (qwen)', async () => 'answer', {
    write: (l) => lines.push(l),
  });
  assert.strictEqual(result, 'answer'); // AC1: propagates resolved value
  assert.strictEqual(lines.length, 1, 'fast fn → start line only, no heartbeat');
  assert.match(lines[0], /^\[cascade\] fleet inference \(qwen\) — starting \(heartbeat every 30s\)/);
});

test('AC1: emits >=1 heartbeat when fn outlives the interval, with elapsed seconds', async () => {
  const lines = [];
  await withProgress('fleet inference (qwen)', () => delay(45), {
    intervalMs: 10,
    now: fakeClock([0, 30_000, 60_000]), // start=0, first heartbeat reads 30000 -> "30s"
    write: (l) => lines.push(l),
  });
  const beats = lines.filter((l) => /still working/.test(l));
  assert.ok(beats.length >= 1, `expected >=1 heartbeat, got ${beats.length}`);
  assert.match(beats[0], /still working \(30s\)\.\.\./);
});

test('AC1: shows the patience budget when patienceMs is provided', async () => {
  const lines = [];
  await withProgress('fleet inference', () => delay(25), {
    intervalMs: 10,
    patienceMs: 1_500_000, // #2937 fleet-red-team-rate
    now: fakeClock([0, 30_000, 60_000]),
    write: (l) => lines.push(l),
  });
  const beat = lines.find((l) => /still working/.test(l));
  assert.match(beat, /\/ 1500s patience/);
});

test('AC1/AC4: timer is cleared on settle — no heartbeats fire after fn resolves', async () => {
  const lines = [];
  await withProgress('quick', async () => 'x', { intervalMs: 5, write: (l) => lines.push(l) });
  const countAtSettle = lines.length;
  await delay(40); // would fire several heartbeats if the interval leaked
  assert.strictEqual(lines.length, countAtSettle, 'no heartbeat after clearInterval');
});

test('AC4: a SYNCHRONOUS throw from fn still clears the timer (no leak)', async () => {
  const lines = [];
  await assert.rejects(
    // fn throws synchronously (does not return a Promise) — the Promise.resolve().then() wrapper
    // must still route it through .finally so the interval is cleared.
    withProgress('sync-boom', () => { throw new Error('sync fleet error'); }, {
      intervalMs: 5,
      write: (l) => lines.push(l),
    }),
    /sync fleet error/
  );
  const countAtSettle = lines.length;
  await delay(30);
  assert.strictEqual(lines.length, countAtSettle, 'sync-throw path also clears the timer');
});

test('AC1: propagates rejection AND clears the timer', async () => {
  const lines = [];
  await assert.rejects(
    withProgress('boom', async () => { throw new Error('fleet exploded'); }, {
      intervalMs: 5,
      write: (l) => lines.push(l),
    }),
    /fleet exploded/
  );
  const countAtSettle = lines.length;
  await delay(30);
  assert.strictEqual(lines.length, countAtSettle, 'rejection path also clears the timer');
});
