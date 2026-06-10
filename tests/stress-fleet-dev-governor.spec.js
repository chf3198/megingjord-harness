// Stress tests for #2796 escalation governor — anti-flap / oscillation chaos (the hysteresis invariant)
// + adversarial input (G6) + a p99 budget (G7). Pure, deterministic.
const { test, expect } = require('@playwright/test');
const {
  recordOutcome, governClass, routeClass, classEntry, WINDOW_N,
} = require('../scripts/global/fleet-dev-governor.js');

function feed(state, cls, escalated, total) {
  for (let i = 0; i < total; i += 1) recordOutcome(state, cls, i < escalated);
  return state;
}

test('#2796 ANTI-FLAP: a class hovering in the 25–40% band never oscillates over many cycles', () => {
  const state = {};
  let transitions = 0;
  for (let cycle = 0; cycle < 50; cycle += 1) {
    // alternate 30% and 35% — both inside the hold band; status must never change
    feed(state, 'c', cycle % 2 ? 6 : 7, 20);
    const out = governClass(state, 'c');
    if (out.transition) transitions += 1;
  }
  expect(transitions).toBe(0); // hysteresis band → zero flapping
  expect(routeClass(state, 'c').status).toBe('promoted');
});

test('#2796 ANTI-FLAP: demote→re-promote needs a FULL fresh window each way (no instant flip-back)', () => {
  const state = {};
  feed(state, 'c', 18, 20); // 90% → demote
  expect(governClass(state, 'c').status).toBe('demoted');
  // window was reset; a single good shadow attempt must NOT re-promote (needs MIN_SAMPLE + <25%)
  recordOutcome(state, 'c', false);
  expect(governClass(state, 'c').transition).toBe(null);
  expect(governClass(state, 'c').status).toBe('demoted');
});

test('#2796 CHAOS: an all-escalate then all-clean stream converges, never thrashes mid-stream', () => {
  const state = {};
  feed(state, 'c', 20, 20); // 100% → demote
  expect(governClass(state, 'c').status).toBe('demoted');
  feed(state, 'c', 0, 20); // 0% shadow → re-promote
  expect(governClass(state, 'c').status).toBe('promoted');
  feed(state, 'c', 20, 20); // 100% again → demote
  expect(governClass(state, 'c').status).toBe('demoted');
});

test('#2796 CHAOS: malformed/empty state + unknown class never throw (default promoted)', () => {
  for (const bad of [{}, { classes: null }, { classes: {} }, undefined]) {
    expect(() => governClass(bad || {}, 'x')).not.toThrow();
    expect(governClass(bad || {}, 'x').status).toBe('promoted'); // unknown class defaults promoted
    expect(routeClass(bad || {}, 'x').onFleet).toBe(true);
  }
});

test('#2796 CHAOS: a __proto__ task-class name is an own-property class, not prototype pollution', () => {
  const state = {};
  feed(state, '__proto__', 18, 20);
  expect(governClass(state, '__proto__').status).toBe('demoted'); // handled as a normal class key
  expect(classEntry({}, 'anything').status).toBe('promoted'); // prototype not polluted
});

test('#2796 PERF: recordOutcome + governClass p99 < 1ms over a full window', () => {
  const samples = [];
  for (let iter = 0; iter < 3000; iter += 1) {
    const state = {};
    const start = process.hrtime.bigint();
    feed(state, 'c', 9, WINDOW_N);
    governClass(state, 'c');
    samples.push(Number(process.hrtime.bigint() - start) / 1e6);
  }
  samples.sort((first, second) => first - second);
  expect(samples[Math.floor(samples.length * 0.99)]).toBeLessThan(1);
});
