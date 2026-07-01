// #2094 Phase-1 (C1/C2/C3) — governance bundle producer + fleet-CLOSEOUT parity.
'use strict';
const { test, expect } = require('@playwright/test');
const path = require('path');
const G = require(path.resolve(__dirname, '..', 'scripts', 'global', 'governance-bundle.js'));

const T0 = 1_700_000_000_000; // fixed epoch (no Date.now in assertions)
const FIELDS = {
  checks_run: '15/16', checks_failed: 1, drift_score: '8 (events 8/expected 10)',
  fleet_utilization: '1/2', rubric_rating: '9/10', wiki_health: '163→163',
  autonomy_score: '9/10', // Epic #3391 B3: operator-autonomy dimension in the allow-list
  extra_secret: 'sk-ant-LEAKZ', // must be dropped by the allow-list
};

test('buildBundle: allow-list keeps only mandatory fields; hash verifies (AC-1)', () => {
  const b = G.buildBundle({ issue: 2094, fields: FIELDS, nowMs: T0 });
  expect(Object.keys(b.fields).sort()).toEqual([...G.FIELD_KEYS].sort());
  expect(b.fields.extra_secret).toBeUndefined(); // not in allow-list (G4)
  expect(b.content_hash).toMatch(/^[0-9a-f]{64}$/);
  expect(G.verifyHash(b)).toBe(true);
});

test('AC-3: all mandatory CLOSEOUT fields are populated from the bundle', () => {
  const b = G.buildBundle({ issue: 2094, fields: FIELDS, nowMs: T0 });
  for (const k of ['checks_run', 'checks_failed', 'drift_score', 'fleet_utilization', 'rubric_rating', 'wiki_health']) {
    expect(b.fields[k]).toBeDefined();
  }
});

test('isFresh: fast-TTL window (G6)', () => {
  const b = G.buildBundle({ issue: 2094, fields: FIELDS, nowMs: T0 });
  expect(G.isFresh(b, T0 + 100_000)).toBe(true);      // within 300s
  expect(G.isFresh(b, T0 + 400_000)).toBe(false);     // expired
  expect(G.isFresh(b, T0 - 1000)).toBe(false);        // future-dated
});

test('fleetCloseoutParity (C2/AC-4): valid only with cited hash + fresh + intact', () => {
  const b = G.buildBundle({ issue: 2094, fields: FIELDS, nowMs: T0 });
  const ok = `## CONSULTANT_CLOSEOUT\ngovernance-bundle-hash: ${b.content_hash}\nrubric_rating: 9/10`;
  expect(G.fleetCloseoutParity(ok, b, T0 + 10_000)).toEqual({ ok: true, reason: 'fleet-parity-ok' });
  expect(G.fleetCloseoutParity('no hash here', b, T0).reason).toBe('no-bundle-hash-cited');
  expect(G.fleetCloseoutParity(`governance-bundle-hash: ${'a'.repeat(64)}`, b, T0).reason).toBe('hash-mismatch');
  expect(G.fleetCloseoutParity(ok, b, T0 + 400_000).reason).toBe('bundle-stale-fast-ttl'); // AC-4 fast-TTL BLOCK
  const tampered = { ...b, fields: { ...b.fields, rubric_rating: '10/10' } };
  expect(G.fleetCloseoutParity(ok, tampered, T0).reason).toBe('bundle-hash-invalid');
});

test('closeout-schema wiring (C2): non-fleet unchanged; fleet needs valid bundle', () => {
  const path = require('path');
  const { checkFleetBundleProvenance } = require(path.resolve(__dirname, '..', 'scripts', 'global', 'megalint', 'consultant-closeout.js'));
  const b = G.buildBundle({ issue: 2094, fields: FIELDS, nowMs: T0 });
  const cite = `## CONSULTANT_CLOSEOUT\ngovernance-bundle-hash: ${b.content_hash}`;
  // non-fleet CLOSEOUT (no marker) -> no violations (unchanged standard)
  expect(checkFleetBundleProvenance('## CONSULTANT_CLOSEOUT\nrubric_rating: 9/10', {})).toEqual([]);
  // fleet CLOSEOUT, no bundle supplied -> advisory (unverifiable)
  expect(checkFleetBundleProvenance(cite, {})[0].rule).toBe('fleet-bundle-unverifiable');
  // fleet CLOSEOUT + valid fresh bundle -> no violations
  expect(checkFleetBundleProvenance(cite, { governanceBundle: b, nowMs: T0 + 10_000 })).toEqual([]);
});
