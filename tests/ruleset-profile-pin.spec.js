'use strict';
// Epic #3576 W-G (#3581) — ruleset profile pinning (freeze at MANAGER_HANDOFF).
const { test, expect } = require('@playwright/test');
const path = require('node:path');
const pin = require(path.resolve(__dirname, '../scripts/global/ruleset-profile-pin'));
const val = require(path.resolve(__dirname, '../scripts/global/megalint/ruleset-pin'));

test('currentRulesetVersion: numeric from config', () => {
  expect(typeof pin.currentRulesetVersion()).toBe('number');
  expect(pin.currentRulesetVersion()).toBeGreaterThanOrEqual(1);
});
test('resolvePin: explicit pin parsed', () => {
  const r = pin.resolvePin('scope: x\nruleset_version: 2\n');
  expect(r.version).toBe(2); expect(r.pinned).toBe(true); expect(r.optInUplift).toBe(false);
});
test('resolvePin: legacy (no pin) falls back', () => {
  const r = pin.resolvePin('scope: x', { fallbackVersion: 5 });
  expect(r.version).toBe(5); expect(r.pinned).toBe(false);
});
test('resolvePin: opt-in uplift detected', () => {
  expect(pin.resolvePin('ruleset_version: 1\nruleset_uplift: opt-in').optInUplift).toBe(true);
});
test('ruleApplies: rule at/before pin applies; newer rule frozen', () => {
  const p = { version: 2, optInUplift: false };
  expect(pin.ruleApplies({ name: 'r-old', since: 2 }, p)).toBe(true);
  expect(pin.ruleApplies({ name: 'r-new', since: 3 }, p)).toBe(false);
});
test('ruleApplies: security-critical is immediate-effect (ignores freeze)', () => {
  const p = { version: 1, optInUplift: false };
  expect(pin.ruleApplies({ name: 'r-sec', since: 99, securityCritical: true }, p)).toBe(true);
});
test('ruleApplies: opt-in uplift adopts newer rule', () => {
  expect(pin.ruleApplies({ name: 'r-new', since: 9 }, { version: 1, optInUplift: true })).toBe(true);
});
test('validator: flags unpinned MANAGER_HANDOFF, always advisory', () => {
  const r = val.validate({ labels: ['lane:code-change'], comments: [{ body: '## MANAGER_HANDOFF\nscope: x' }] });
  expect(r.violations.some((v) => v.rule === 'ruleset-version-unpinned')).toBe(true);
  expect(r.violations.every((v) => v.severity === 'advisory')).toBe(true);
});
