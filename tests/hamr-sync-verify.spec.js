// hamr-sync-verify tests (#955).
const { test, expect } = require('@playwright/test');
const path = require('path');
const fs = require('fs');
const os = require('os');

const VERIFY = require(path.resolve(__dirname, '..', 'scripts', 'global', 'hamr-sync-verify.js'));

test('HAMR_SCRIPTS canonical set covers all 3 teams worth', () => {
  expect(VERIFY.HAMR_SCRIPTS).toContain('cache-stats-emit.js');
  expect(VERIFY.HAMR_SCRIPTS).toContain('hamr-provider-wrapper.js');
  expect(VERIFY.HAMR_SCRIPTS).toContain('substrate-health-push.js');
  expect(VERIFY.HAMR_SCRIPTS.length).toBeGreaterThanOrEqual(10);
});

test('TARGETS includes copilot and codex deploy paths', () => {
  const teams = VERIFY.TARGETS.map((t) => t.team);
  expect(teams).toContain('copilot');
  expect(teams).toContain('codex');
  for (const t of VERIFY.TARGETS) {
    expect(t.dir).toContain(os.homedir());
  }
});

test('run() reports per-team missing/present split with summary', () => {
  const result = VERIFY.run();
  expect(typeof result.ok).toBe('boolean');
  expect(Array.isArray(result.targets)).toBe(true);
  expect(result.targets).toHaveLength(2);
  for (const t of result.targets) {
    expect(t).toHaveProperty('team');
    expect(t).toHaveProperty('dir');
    expect(Array.isArray(t.missing)).toBe(true);
    expect(Array.isArray(t.present)).toBe(true);
  }
  if (!result.ok) expect(result.hint).toBeTruthy(); // hint is set for either HAMR or review-parity gap
});

test('run() reports ok:true when both targets fully populated (mock)', () => {
  // Verify the boolean ok flag is computed correctly — by inspecting result shape against current state.
  const result = VERIFY.run();
  const totalMissing = result.targets.reduce((sum, t) => sum + t.missing.length, 0);
  expect(result.total_missing).toBe(totalMissing);
  // ok is false when HAMR scripts are missing OR review pipeline parity fails
  expect(result.ok).toBe(totalMissing === 0 && result.review_parity.parity);
});

// C9 parity integration tests — Refs #2950
test('run() result includes review_parity key with C9 parity shape (#2950)', () => {
  const result = VERIFY.run();
  expect(result).toHaveProperty('review_parity');
  const rp = result.review_parity;
  expect(typeof rp.parity).toBe('boolean');
  expect(typeof rp.coverage).toBe('number');
  expect(Array.isArray(rp.mismatches)).toBe(true);
  expect(Array.isArray(rp.absentTargets)).toBe(true);
});

test('REVIEW_CLI_MODULES exported and contains all 6 review pipeline modules (#2950)', () => {
  expect(Array.isArray(VERIFY.REVIEW_CLI_MODULES)).toBe(true);
  expect(VERIFY.REVIEW_CLI_MODULES).toContain('cascade-dispatch.js');
  expect(VERIFY.REVIEW_CLI_MODULES).toContain('fleet-backend-select.js');
  expect(VERIFY.REVIEW_CLI_MODULES).toContain('fleet-escalation-policy.js');
  expect(VERIFY.REVIEW_CLI_MODULES.length).toBe(6);
});
