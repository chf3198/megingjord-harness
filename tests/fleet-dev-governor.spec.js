// Refs #2796 P1-3 of Epic #2791 — escalation-rate governor. Pure, deterministic.
const { test, expect } = require('@playwright/test');
process.env.MEGINGJORD_NO_TELEMETRY = '1'; // #2885: tests must never write prod telemetry
const {
  recordOutcome, governClass, escalationRate, routeClass, classEntry, WINDOW_N,
} = require('../scripts/global/fleet-dev-governor.js');

// Feed `total` outcomes for a class, the first `escalated` of which escalated.
function feed(state, cls, escalated, total) {
  for (let i = 0; i < total; i += 1) recordOutcome(state, cls, i < escalated);
  return state;
}

test('#2796 AC1 the window is velocity-relative — bounded to the last N attempts, not calendar', () => {
  const state = {};
  feed(state, 'area:scripts', 0, WINDOW_N + 30); // 50 attempts
  expect(classEntry(state, 'area:scripts').window.length).toBe(WINDOW_N); // only the last N retained
});

test('#2796 AC1 escalation rate is per-class and isolated', () => {
  const state = {};
  feed(state, 'area:scripts', 2, 20); // 10%
  feed(state, 'area:dashboard', 18, 20); // 90%
  expect(escalationRate(classEntry(state, 'area:scripts'))).toBeCloseTo(0.1, 6);
  expect(escalationRate(classEntry(state, 'area:dashboard'))).toBeCloseTo(0.9, 6);
});

test('#2796 AC1 a too-small sample yields no rate (fail-safe → hold, never demote on noise)', () => {
  const state = {};
  feed(state, 'c', 4, 4); // 4 attempts, all escalated, but < MIN_SAMPLE
  expect(escalationRate(classEntry(state, 'c'))).toBe(null);
  expect(governClass(state, 'c').transition).toBe(null); // holds promoted
  expect(governClass(state, 'c').status).toBe('promoted');
});

test('#2796 AC2 demote a promoted class above 40% escalation', () => {
  const state = {};
  feed(state, 'c', 9, 20); // 45%
  const out = governClass(state, 'c');
  expect(out.transition).toBe('demote');
  expect(out.status).toBe('demoted');
  expect(classEntry(state, 'c').window).toEqual([]); // window reset on transition
});

test('#2796 AC2 hysteresis: the 25–40% band HOLDS (no flap), in either state', () => {
  const promoted = feed({}, 'c', 6, 20); // 30%
  expect(governClass(promoted, 'c')).toMatchObject({ transition: null, status: 'promoted' });
  const demoted = { classes: { c: { status: 'demoted', window: [] } } };
  feed(demoted, 'c', 6, 20); // 30% — still in band
  expect(governClass(demoted, 'c')).toMatchObject({ transition: null, status: 'demoted' });
});

test('#2796 AC2/AC3 re-promote a demoted class only below 25% (data-driven, from shadow outcomes)', () => {
  const state = { classes: { c: { status: 'demoted', window: [] } } };
  feed(state, 'c', 4, 20); // 20% — shadow-run escalation rate dropped (e.g., after a model refresh)
  const out = governClass(state, 'c');
  expect(out.transition).toBe('re-promote');
  expect(out.status).toBe('promoted');
});

test('#2796 AC2 boundary: exactly 40% does NOT demote; exactly 25% does NOT re-promote (strict)', () => {
  const at40 = feed({}, 'c', 8, 20); // 40%
  expect(governClass(at40, 'c').transition).toBe(null);
  const at25 = { classes: { c: { status: 'demoted', window: [] } } };
  feed(at25, 'c', 5, 20); // 25%
  expect(governClass(at25, 'c').transition).toBe(null);
});

test('#2796 AC2 demotion emits a Tier-2 anneal + re-profile signal (observable, G8)', () => {
  const records = [];
  const state = feed({}, 'area:dashboard', 12, 20); // 60%
  governClass(state, 'area:dashboard', { emit: (r) => records.push(r), now: () => 1700000000000 });
  expect(records).toHaveLength(1);
  expect(records[0]).toMatchObject({
    event: 'fleet-dev-class-mis-profiled', tier2_anneal: true, task_class: 'area:dashboard',
    action: 'demote', reprofile_signal: true, ts: 1700000000000,
  });
  expect(records[0].escalation_rate).toBeCloseTo(0.6, 6);
});

test('#2796 a valid epoch-0 timestamp is preserved in telemetry (not coerced to null)', () => {
  const records = [];
  const state = feed({}, 'c', 12, 20);
  governClass(state, 'c', { emit: (r) => records.push(r), now: () => 0 });
  expect(records[0].ts).toBe(0); // 0 is a valid timestamp, not absence
});

test('#2796 AC3 routeClass: promoted runs on fleet; demoted runs escalated + shadow-on-fleet', () => {
  const state = { classes: { p: { status: 'promoted', window: [] }, d: { status: 'demoted', window: [] } } };
  expect(routeClass(state, 'p')).toMatchObject({ onFleet: true, shadowOnFleet: false });
  expect(routeClass(state, 'd')).toMatchObject({ onFleet: false, shadowOnFleet: true });
});
