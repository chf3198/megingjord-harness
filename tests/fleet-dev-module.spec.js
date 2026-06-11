// Refs #2806 — fleet-dev module boundary + opt-in tier-3 routing guard (Epic #2791 P1-8). Pure unit tests:
// the gate is offered only when installed ∧ enabled ∧ MINIMUM_TIER >= 3; every fleetless case → baseline.
const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');
const { isModuleInstalled, isModuleEnabled, fleetDevAvailable } = require('../scripts/global/fleet-dev-module.js');
const manifest = require('../config/fleet-dev-module.json');

const ON = { MEGINGJORD_FLEET_DEV_ENABLED: '1' };

test('AC1 manifest: requiredTier 3, opt-in env, non-empty member list', () => {
  expect(manifest.requiredTier).toBe(3);
  expect(manifest.enableEnv).toBe('MEGINGJORD_FLEET_DEV_ENABLED');
  expect(manifest.members.length).toBeGreaterThan(0);
});

test('isModuleInstalled true for the real manifest, false when absent/empty', () => {
  expect(isModuleInstalled(manifest)).toBe(true);
  expect(isModuleInstalled(null)).toBe(false);
  expect(isModuleInstalled({ members: [] })).toBe(false);
});

test('isModuleEnabled honors the opt-in flag (default OFF)', () => {
  expect(isModuleEnabled({}, manifest)).toBe(false);
  expect(isModuleEnabled({ MEGINGJORD_FLEET_DEV_ENABLED: '1' }, manifest)).toBe(true);
  expect(isModuleEnabled({ MEGINGJORD_FLEET_DEV_ENABLED: 'true' }, manifest)).toBe(true);
  expect(isModuleEnabled({ MEGINGJORD_FLEET_DEV_ENABLED: '0' }, manifest)).toBe(false);
});

test('AC2/AC3 fleetDevAvailable: installed + enabled + Tier-3 → available', () => {
  expect(fleetDevAvailable({ manifest, env: { ...ON, MEGINGJORD_MINIMUM_TIER: '3' } }))
    .toEqual({ available: true, reason: 'enabled-tier3' });
});

test('AC2 fleetless defaults → NOT available (unset tier / below-tier / disabled / not-installed)', () => {
  expect(fleetDevAvailable({ manifest, env: { ...ON } }).reason).toBe('minimum-tier-unset');
  expect(fleetDevAvailable({ manifest, env: { ...ON, MEGINGJORD_MINIMUM_TIER: '2' } }).reason).toBe('below-tier-3');
  expect(fleetDevAvailable({ manifest, env: {} }).reason).toBe('module-disabled');
  expect(fleetDevAvailable({ manifest: null, env: { ...ON, MEGINGJORD_MINIMUM_TIER: '5' } }).reason).toBe('module-not-installed');
  for (const env of [{ ...ON }, { ...ON, MEGINGJORD_MINIMUM_TIER: '2' }, {}]) {
    expect(fleetDevAvailable({ manifest, env }).available).toBe(false);
  }
});

test('F1 a manifest cannot enable-by-default: empty/unset env is NEVER enabled (even if enableValues has "")', () => {
  const weak = { members: ['x'], enableEnv: 'X', enableValues: [''] };
  expect(isModuleEnabled({}, weak)).toBe(false);            // unset → '' → still disabled
  expect(isModuleEnabled({ X: '   ' }, weak)).toBe(false);  // whitespace → '' → still disabled
  expect(fleetDevAvailable({ manifest: weak, env: { MEGINGJORD_MINIMUM_TIER: '5' } }).available).toBe(false);
});

test('F2 manifest reads are own-property only (prototype pollution cannot weaken the gate)', () => {
  const polluted = Object.create({ members: ['x'], enableEnv: 'EVIL', enableValues: [''] }); // all INHERITED
  expect(isModuleInstalled(polluted)).toBe(false);                                  // inherited members ignored
  expect(isModuleEnabled({ MEGINGJORD_FLEET_DEV_ENABLED: '1' }, polluted)).toBe(true);  // default key, not EVIL
  expect(isModuleEnabled({ EVIL: '' }, polluted)).toBe(false);                      // inherited enableEnv/values ignored
});

test('AC2 baseline byte-for-byte: the router carries no fleet-dev imports (no dead path)', () => {
  const router = fs.readFileSync(path.join(__dirname, '..', 'scripts', 'global', 'model-routing-engine.js'), 'utf8');
  expect(/fleet-dev|fleetDev|fleet_dev|screenFleetDev/.test(router)).toBe(false);
});

test('AC4 manifest ↔ tier-tag contract: every member exists and declares // tier: 3', () => {
  for (const member of manifest.members) {
    const abs = path.join(__dirname, '..', member);
    expect(fs.existsSync(abs)).toBe(true);
    expect(/^\/\/ tier: 3$/m.test(fs.readFileSync(abs, 'utf8'))).toBe(true);
  }
});
