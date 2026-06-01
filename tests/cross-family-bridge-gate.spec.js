'use strict';
// Integration tests for C3 (#2538): cross-family bridge gate advisory checks
const { test, expect } = require('@playwright/test');
const { checkCrossFamilyVerdict } = require('../scripts/global/megalint/consultant-closeout.js');
const { checkConsultantFamilyIndependence } = require('../scripts/global/megalint/signer-fidelity.js');

test('checkCrossFamilyVerdict exported from consultant-closeout.js', () => {
  expect(typeof checkCrossFamilyVerdict).toBe('function');
});

test('missing cross_family_verdict → advisory violation', () => {
  const body = `## CONSULTANT_CLOSEOUT
verdict: approve_for_merge
rubric_rating: 8/10.
Signed-by: Soren Vale
Team&Model: copilot:claude-sonnet-4-6@github
Role: consultant`;
  const viols = checkCrossFamilyVerdict(body);
  expect(viols.length).toBe(1);
  expect(viols[0].rule).toBe('cross-family-verdict-missing');
  expect(viols[0].severity).toBe('advisory');
});

test('valid cross_family_verdict → no violation', () => {
  const body = `cross_family_verdict: ACCEPT — qwen2.5-coder:7b@100.0.0.1 — all ACs satisfied`;
  const viols = checkCrossFamilyVerdict(body);
  expect(viols.length).toBe(0);
});

test('malformed cross_family_verdict → hard error', () => {
  const body = `cross_family_verdict: ACCEPT incomplete`;
  const viols = checkCrossFamilyVerdict(body);
  expect(viols.length).toBe(1);
  expect(viols[0].rule).toBe('cross-family-verdict-malformed');
  expect(viols[0].severity).toBeUndefined();
});

test('same-family body → cross-family-mismatch advisory from checkConsultantFamilyIndependence', () => {
  const body = `Team&Model: copilot:claude-sonnet@github\nRole: collaborator\n\nTeam&Model: copilot:claude-opus@github\nRole: consultant`;
  const viols = checkConsultantFamilyIndependence(body);
  expect(viols.length).toBe(1);
  expect(viols[0].severity).toBe('advisory');
});

test('gate emits advisory array (no throw) for missing verdict', () => {
  const trail = `## CONSULTANT_CLOSEOUT\nverdict: approve\nrubric_rating: 8/10.\nSigned-by: X\nTeam&Model: t:m@s\nRole: consultant`;
  const viols = [...checkConsultantFamilyIndependence(trail), ...checkCrossFamilyVerdict(trail)];
  expect(Array.isArray(viols)).toBe(true);
  expect(viols.every(v => v.severity === 'advisory' || v.rule.includes('malformed'))).toBe(true);
});
