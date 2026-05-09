'use strict';
const { test, expect } = require('@playwright/test');
const path = require('node:path');
const fs = require('node:fs');
const os = require('node:os');
const {
  parseArgs, applyOverride, resetOverride, activeOverrides,
  ALLOWED_ACTUATORS, ALLOWED_TIERS,
} = require(path.resolve(__dirname, '../scripts/global/goal-tier-override.js'));

function tmpStore() {
  return path.join(os.tmpdir(), `overrides-${Date.now()}-${Math.random().toString(36).slice(2)}.json`);
}

test.describe('goal-tier-override (#1261 / Epic #1113 AC7)', () => {
  test('parseArgs returns shape for force-escalate', () => {
    const r = parseArgs(['--actuator', 'A4', '--tier', 'strict', '--reason', 'audit gap', '--until', '2026-06-01']);
    expect(r).toMatchObject({ actuator: 'A4', tier: 'strict', reason: 'audit gap', until: '2026-06-01', reset: false });
  });

  test('parseArgs returns shape for reset', () => {
    const r = parseArgs(['--actuator', 'A1', '--reset', '--reason', 'recovered']);
    expect(r).toMatchObject({ actuator: 'A1', reset: true, reason: 'recovered' });
  });

  test('parseArgs rejects missing reason', () => {
    expect(() => parseArgs(['--actuator', 'A1', '--reset'])).toThrow(/reason/i);
  });

  test('parseArgs rejects invalid actuator', () => {
    expect(() => parseArgs(['--actuator', 'X9', '--reset', '--reason', 'x'])).toThrow(/actuator/i);
  });

  test('applyOverride persists with ISO timestamp', () => {
    const store = tmpStore();
    applyOverride({ actuator: 'A4', tier: 'strict', reason: 'audit gap', until: '2026-06-01' }, store);
    const data = JSON.parse(fs.readFileSync(store, 'utf8'));
    expect(data.entries).toHaveLength(1);
    expect(data.entries[0]).toMatchObject({ actuator: 'A4', tier: 'strict', reason: 'audit gap', until: '2026-06-01' });
    expect(data.entries[0].timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
    fs.unlinkSync(store);
  });

  test('resetOverride appends a reset entry', () => {
    const store = tmpStore();
    applyOverride({ actuator: 'A1', tier: 'strict', reason: 'init' }, store);
    resetOverride({ actuator: 'A1', reason: 'recovered' }, store);
    const data = JSON.parse(fs.readFileSync(store, 'utf8'));
    expect(data.entries).toHaveLength(2);
    expect(data.entries[1].reset).toBe(true);
    fs.unlinkSync(store);
  });

  test('activeOverrides returns latest non-reset, non-expired per actuator', () => {
    const store = tmpStore();
    applyOverride({ actuator: 'A1', tier: 'strict', reason: 'first' }, store);
    applyOverride({ actuator: 'A4', tier: 'strict', reason: 'audit gap', until: '2026-06-01' }, store);
    applyOverride({ actuator: 'A2', tier: 'strict', reason: 'expired', until: '2026-04-01' }, store);
    resetOverride({ actuator: 'A1', reason: 'recovered' }, store);
    const active = activeOverrides(store);
    const keys = active.map(e => e.actuator);
    expect(keys).toContain('A4');
    expect(keys).not.toContain('A1'); // reset
    expect(keys).not.toContain('A2'); // expired
    fs.unlinkSync(store);
  });

  test('activeOverrides returns [] when store missing', () => {
    expect(activeOverrides('/nonexistent/path/overrides.json')).toEqual([]);
  });

  test('ALLOWED_ACTUATORS has 7 entries', () => {
    expect(ALLOWED_ACTUATORS).toHaveLength(7);
    expect(ALLOWED_ACTUATORS).toEqual(expect.arrayContaining(['A1', 'A2', 'A3', 'A4', 'A5', 'A6', 'A7']));
  });

  test('ALLOWED_TIERS includes strict + relaxed', () => {
    expect(ALLOWED_TIERS).toEqual(expect.arrayContaining(['strict', 'relaxed']));
  });
});
