// Refs #2901 — fleet dispatch timeouts wired to config/timeout-policy.json with graceful fallback. Unit
// tests the path-injectable loaders (class-read + fallback) and asserts the heartbeat is torn down.
const { test, expect } = require('@playwright/test');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { loadFleetTimeout } = require('../scripts/global/fleet-red-team-dispatch.js');
const { loadBasicTimeout } = require('../scripts/global/ollama-direct.js');

let dir;
test.beforeEach(() => { dir = fs.mkdtempSync(path.join(os.tmpdir(), 'timeout-')); });
test.afterEach(() => { fs.rmSync(dir, { recursive: true, force: true }); });
const writePolicy = (obj) => { const file = path.join(dir, 'p.json'); fs.writeFileSync(file, JSON.stringify(obj)); return file; };

test('AC1 loadFleetTimeout reads the real policy fleet-red-team-rate class (1200s)', () => {
  expect(loadFleetTimeout()).toBe(1200000);
});

test('AC2 loadBasicTimeout reads the real policy fleet-dispatch-basic class (300s)', () => {
  expect(loadBasicTimeout()).toBe(300000);
});

test('AC1/AC2 a custom policy class value is honored', () => {
  expect(loadFleetTimeout(writePolicy({ classes: { 'fleet-red-team-rate': { ms: 999000 } } }))).toBe(999000);
  expect(loadBasicTimeout(writePolicy({ classes: { 'fleet-dispatch-basic': { ms: 777000 } } }))).toBe(777000);
});

test('AC4 fallback to the prior hardcoded value on a missing/malformed/incomplete policy', () => {
  expect(loadFleetTimeout('/no/such/file.json')).toBe(600000);        // missing → prior 600s
  expect(loadBasicTimeout('/no/such/file.json')).toBe(120000);        // missing → prior 120s
  const bad = path.join(dir, 'bad.json'); fs.writeFileSync(bad, '{ not json');
  expect(loadFleetTimeout(bad)).toBe(600000);                          // malformed → fallback
  expect(loadBasicTimeout(writePolicy({ classes: {} }))).toBe(120000); // class absent → fallback
  expect(loadFleetTimeout(writePolicy({ classes: { 'fleet-red-team-rate': { ms: -5 } } }))).toBe(600000); // non-positive → fallback
});

test('AC3 the dispatch heartbeat is torn down (clearInterval in the finally block)', () => {
  const src = fs.readFileSync(path.join(__dirname, '..', 'scripts', 'global', 'fleet-red-team-dispatch.js'), 'utf8');
  expect(/finally\s*\{[^}]*clearInterval\(heartbeat\)/.test(src)).toBe(true); // never leaks the timer
  expect(src).toContain('HEARTBEAT_INTERVAL_MS = 30_000');
});
