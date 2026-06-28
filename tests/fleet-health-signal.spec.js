'use strict';
// tdd-pyramid unit specs for fleet-health-signal (#3305).
const test = require('node:test');
const assert = require('node:assert');
const {
  classifyFleetWindow, buildOutageEvents, emitFleetHealthSignal,
  annotateUtilizationFinding, PATTERN_ID,
} = require('../scripts/global/fleet-health-signal');
const { isValidV3 } = require('../scripts/global/event-schema-v3');

test('classify: outage when fleet UNAVAILABLE and work was attempted', () => {
  const r = classifyFleetWindow({ probeDecision: 'UNAVAILABLE', fleetEligibleAttempts: 4, failovers: 4 });
  assert.strictEqual(r.state, 'outage');
  assert.match(r.reason, /4\/4/);
});

test('classify: no-demand when no fleet-eligible work attempted', () => {
  const r = classifyFleetWindow({ probeDecision: 'UNAVAILABLE', fleetEligibleAttempts: 0 });
  assert.strictEqual(r.state, 'no-demand');
});

test('classify: healthy when reachable and serving demand', () => {
  const r = classifyFleetWindow({ probeDecision: 'AVAILABLE', fleetEligibleAttempts: 3, failovers: 0 });
  assert.strictEqual(r.state, 'healthy');
});

test('classify: outage even with zero recorded failovers if demand existed and unreachable', () => {
  const r = classifyFleetWindow({ probeDecision: 'UNAVAILABLE', fleetEligibleAttempts: 2, failovers: 0 });
  assert.strictEqual(r.state, 'outage');
});

test('buildOutageEvents emits two schema-v3-valid events', () => {
  const c = classifyFleetWindow({ probeDecision: 'UNAVAILABLE', fleetEligibleAttempts: 1, failovers: 1 });
  const { incident, dashboard } = buildOutageEvents(c, { ts: '2026-06-28T00:00:00Z', env: 'test' });
  assert.strictEqual(incident.pattern_id, PATTERN_ID);
  assert.ok(isValidV3(incident).ok, JSON.stringify(isValidV3(incident).errors));
  assert.ok(isValidV3(dashboard).ok, JSON.stringify(isValidV3(dashboard).errors));
});

test('emit: disabled flag is a no-op', () => {
  const prev = process.env.FLEET_HEALTH_SIGNAL_DISABLED;
  process.env.FLEET_HEALTH_SIGNAL_DISABLED = '1';
  try {
    const r = emitFleetHealthSignal({ probeDecision: 'UNAVAILABLE', fleetEligibleAttempts: 5, failovers: 5 });
    assert.strictEqual(r.emitted, false);
    assert.strictEqual(r.state, 'disabled');
  } finally {
    if (prev === undefined) delete process.env.FLEET_HEALTH_SIGNAL_DISABLED;
    else process.env.FLEET_HEALTH_SIGNAL_DISABLED = prev;
  }
});

test('emit: outage writes both signals via injected emitter', () => {
  const writes = [];
  const r = emitFleetHealthSignal(
    { probeDecision: 'UNAVAILABLE', fleetEligibleAttempts: 2, failovers: 2 },
    { emit: (ev, file) => writes.push({ ev, file }), incidentsPath: '/x/i', dashboardPath: '/x/d' },
  );
  assert.strictEqual(r.emitted, true);
  assert.strictEqual(writes.length, 2);
  assert.strictEqual(writes[0].ev.pattern_id, PATTERN_ID);
});

test('emit: no-demand does not emit', () => {
  const writes = [];
  const r = emitFleetHealthSignal({ fleetEligibleAttempts: 0 }, { emit: () => writes.push(1) });
  assert.strictEqual(r.emitted, false);
  assert.strictEqual(writes.length, 0);
});

test('emit: G6 never throws when the injected emitter throws', () => {
  const r = emitFleetHealthSignal(
    { probeDecision: 'UNAVAILABLE', fleetEligibleAttempts: 1, failovers: 1 },
    { emit: () => { throw new Error('disk full'); } },
  );
  assert.strictEqual(r.emitted, false);
  assert.match(r.error, /disk full/);
});

test('annotate: marks outage-caused only when classification is an outage', () => {
  const outage = annotateUtilizationFinding({ share: 0.4 }, { state: 'outage', reason: 'down' });
  assert.strictEqual(outage.outageCaused, true);
  const noDemand = annotateUtilizationFinding({ share: 0.4 }, { state: 'no-demand' });
  assert.strictEqual(noDemand.outageCaused, undefined);
});
