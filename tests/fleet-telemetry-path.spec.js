// Refs #2885 — traversal-safety of the fleet-dev telemetry redirect helper (the F3 fix). Pure: no fs, no
// env, no prod-telemetry risk. Proves a '..' path segment in MEGINGJORD_TELEMETRY_DIR is rejected so an
// env-supplied path can never escape via traversal, while a clean dir (even one merely NAMED with dots) is
// honored and only the directory — never the basename — is redirected.
const { test, expect } = require('@playwright/test');
const path = require('path');
const { safeRedirectDir, resolveTelemetryFile } = require('../scripts/global/fleet-telemetry-path.js');

const DEFAULT = '/home/u/.megingjord/fleet-dev-telemetry.jsonl';

test('#2885 F3 safeRedirectDir rejects any traversal segment, accepts clean/dotted dirs', () => {
  expect(safeRedirectDir('/a/../b')).toBeNull();        // mid-path '..' segment
  expect(safeRedirectDir('..')).toBeNull();             // bare '..'
  expect(safeRedirectDir('../escape')).toBeNull();      // leading '..'
  expect(safeRedirectDir('/tmp/x/..')).toBeNull();      // trailing '..'
  expect(safeRedirectDir('C:\\t\\..\\e')).toBeNull();   // backslash-separated traversal
  expect(safeRedirectDir(undefined)).toBeNull();        // unset
  expect(safeRedirectDir('')).toBeNull();               // empty
  expect(safeRedirectDir('/tmp/foo..bar')).toBe('/tmp/foo..bar'); // dots in a name ≠ a '..' segment
  expect(safeRedirectDir('/tmp/run-9')).toBe('/tmp/run-9');       // ordinary dir honored
});

test('#2885 F3 resolveTelemetryFile redirects only the dir, never the basename; falls back when unsafe', () => {
  expect(resolveTelemetryFile(DEFAULT, '/tmp/run-9')).toBe(path.join('/tmp/run-9', 'fleet-dev-telemetry.jsonl'));
  expect(resolveTelemetryFile(DEFAULT, '/a/../etc')).toBe(DEFAULT); // traversal → default path, no escape
  expect(resolveTelemetryFile(DEFAULT, undefined)).toBe(DEFAULT);   // unset → default path
});
