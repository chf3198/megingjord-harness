// Refs #2885 — fleet-dev telemetry test-isolation. Two guarantees, proven WITHOUT touching ~/.megingjord:
// (1) MEGINGJORD_NO_TELEMETRY suppresses the prod write in BOTH defaultEmit surfaces (#2795 gates, #2796
// governor); (2) the guard defaults OFF (the real, non-injected defaultEmit still fires). Every write is
// redirected to a PER-TEST temp dir via MEGINGJORD_TELEMETRY_DIR, so the test reads/writes no shared global
// file (no cross-worker flake) and can never pollute production telemetry. afterEach restores env + removes
// the temp dir even if an assertion throws.
const { test, expect } = require('@playwright/test');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { defaultEmit } = require('../scripts/global/fleet-dev-gates.js');
const { governClass, recordOutcome } = require('../scripts/global/fleet-dev-governor.js');

let tmpDir;
const sizeOf = (file) => (fs.existsSync(file) ? fs.statSync(file).size : 0);
const govFile = () => path.join(tmpDir, 'fleet-dev-governor.jsonl');
const gateFile = () => path.join(tmpDir, 'fleet-dev-telemetry.jsonl');

test.beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'fleet-iso-'));
  process.env.MEGINGJORD_TELEMETRY_DIR = tmpDir; // redirect every write off the shared prod path
});

test.afterEach(() => {
  delete process.env.MEGINGJORD_NO_TELEMETRY;
  delete process.env.MEGINGJORD_TELEMETRY_DIR;
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

test('#2885 AC2 MEGINGJORD_NO_TELEMETRY suppresses the gates defaultEmit write', () => {
  process.env.MEGINGJORD_NO_TELEMETRY = '1';
  defaultEmit({ event: 'isolation-test', big: 'X'.repeat(500) });
  expect(sizeOf(gateFile())).toBe(0); // nothing written under the flag (even to the redirected path)
});

test('#2885 AC2 a governor demotion writes nothing under the flag', () => {
  process.env.MEGINGJORD_NO_TELEMETRY = '1';
  const state = {};
  for (let i = 0; i < 20; i += 1) recordOutcome(state, 'isolation-class', i < 18);
  const out = governClass(state, 'isolation-class'); // 90% → demote → would emit, but flag suppresses it
  expect(out.transition).toBe('demote');
  expect(sizeOf(govFile())).toBe(0);
});

test('#2885 AC2 the guard defaults OFF — the real defaultEmit still fires', () => {
  // No NO_TELEMETRY flag; the redirect is active, so the genuine (non-injected) defaultEmit writes to temp.
  const state = {};
  for (let i = 0; i < 20; i += 1) recordOutcome(state, 'c2', i < 18);
  const out = governClass(state, 'c2'); // exercises the production defaultEmit → redirected temp file
  expect(out.transition).toBe('demote');
  expect(sizeOf(govFile())).toBeGreaterThan(0); // emitted to the redirected path → guard defaults off
});
