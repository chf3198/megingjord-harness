'use strict';
const { test, expect } = require('@playwright/test');
const path = require('node:path');
const fs = require('node:fs');
const os = require('node:os');
const { actuators, runEngine, INITIAL_STATE } = require(
  path.resolve(__dirname, '../scripts/global/actuator-engine.js')
);

function tmpStore() {
  return path.join(os.tmpdir(), `tier-state-${Date.now()}-${Math.random().toString(36).slice(2)}.json`);
}

const NOW_STABLE = new Date('2026-05-09T20:00:00Z').getTime();

test.describe('actuator-engine (#1258 / Epic #1113 AC4)', () => {
  test('A1 tier ladder', () => {
    expect(actuators.A1({ ghs: 1.0, prevState: INITIAL_STATE.actuators, now: NOW_STABLE }).tier).toBe('B');
    expect(actuators.A1({ ghs: 0.7, prevState: INITIAL_STATE.actuators, now: NOW_STABLE }).tier).toBe('B+');
    expect(actuators.A1({ ghs: 0.4, prevState: INITIAL_STATE.actuators, now: NOW_STABLE }).tier).toBe('B+++');
    expect(actuators.A1({ ghs: 0.2, prevState: INITIAL_STATE.actuators, now: NOW_STABLE }).tier).toBe('B++++');
  });

  test('A2: GHS<0.70 escalates from advisory to required', () => {
    const r = actuators.A2({ ghs: 0.65, prevState: INITIAL_STATE.actuators, now: NOW_STABLE });
    expect(r.level).toBe('required');
  });

  test('A2: GHS>=0.70 stays advisory', () => {
    const r = actuators.A2({ ghs: 0.85, prevState: INITIAL_STATE.actuators, now: NOW_STABLE });
    expect(r.level).toBe('advisory');
  });

  test('A3: GHS<0.65 sets handoff_block_required=true', () => {
    const r = actuators.A3({ ghs: 0.6, prevState: INITIAL_STATE.actuators, now: NOW_STABLE });
    expect(r.handoff_block_required).toBe(true);
  });

  test('A4: GHS<0.55 sets consultant_mandatory=true', () => {
    const r = actuators.A4({ ghs: 0.5, prevState: INITIAL_STATE.actuators, now: NOW_STABLE });
    expect(r.consultant_mandatory).toBe(true);
  });

  test('A5: GHS<0.60 sets operator_notification=true', () => {
    const r = actuators.A5({ ghs: 0.55, prevState: INITIAL_STATE.actuators, now: NOW_STABLE });
    expect(r.operator_notification).toBe(true);
  });

  test('A6: GHS<0.75 sets session_reminder=true', () => {
    const r = actuators.A6({ ghs: 0.7, prevState: INITIAL_STATE.actuators, now: NOW_STABLE });
    expect(r.session_reminder).toBe(true);
  });

  test('A7: GHS<0.45 sets anneal_auto_trigger=true', () => {
    const r = actuators.A7({ ghs: 0.4, prevState: INITIAL_STATE.actuators, now: NOW_STABLE });
    expect(r.anneal_auto_trigger).toBe(true);
  });

  test('runEngine persists state file', () => {
    const store = tmpStore();
    runEngine({ ghs: 0.5, sensors: {}, now: NOW_STABLE }, store);
    const data = JSON.parse(fs.readFileSync(store, 'utf8'));
    expect(data).toHaveProperty('actuators');
    expect(data.actuators.A1.tier).toBe('B++');
    expect(data.actuators.A2.level).toBe('required');
    expect(data.ghs_7d).toBe(0.5);
    fs.unlinkSync(store);
  });

  test('runEngine ghs_history appends', () => {
    const store = tmpStore();
    runEngine({ ghs: 0.9, sensors: {}, now: NOW_STABLE }, store);
    runEngine({ ghs: 0.5, sensors: {}, now: NOW_STABLE + 1000 }, store);
    const data = JSON.parse(fs.readFileSync(store, 'utf8'));
    expect(data.ghs_history).toHaveLength(2);
    expect(data.ghs_history[1].value).toBe(0.5);
    fs.unlinkSync(store);
  });

  test('runEngine handles null GHS (stale): no escalation', () => {
    const store = tmpStore();
    runEngine({ ghs: null, sensors: {}, now: NOW_STABLE }, store);
    const data = JSON.parse(fs.readFileSync(store, 'utf8'));
    expect(data.actuators.A1.tier).toBe('B');
    expect(data.actuators.A2.level).toBe('advisory');
    fs.unlinkSync(store);
  });

  test('all 7 actuators exist', () => {
    expect(Object.keys(actuators).sort()).toEqual(['A1', 'A2', 'A3', 'A4', 'A5', 'A6', 'A7']);
  });
});
