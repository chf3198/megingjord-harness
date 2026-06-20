// #3014 — governance evidence bridge tests (Epic #3008 Phase C).
'use strict';
const { test, expect } = require('@playwright/test');
const bridge = require('../scripts/global/governance-evidence-bridge');
const diag = require('../scripts/global/governance-evidence-diag');

const comments = [
  { body: 'COLLABORATOR_HANDOFF\nchecks_run: 12\nchecks_failed: 0\ncross_family_rating: 95\ntest_strategy: golden-file' },
  { body: 'CONSULTANT_CLOSEOUT\nverdict: approve_for_merge\nrubric_rating: 9\ndrift_score: 0' },
];

test('bridge extracts collaborator and consultant fields', () => {
  const snap = bridge.bridgeFromComments(3008, comments);
  expect(snap.fields.checks_run).toBe(12);
  expect(snap.fields.verdict).toBe('approve_for_merge');
  expect(snap.content_hash).toMatch(/^[0-9a-f]{64}$/);
});

test('diagnose reports missing admin fields', () => {
  const d = diag.diagnoseEvidence(3008, comments);
  expect(d.missing.some((m) => m.role === 'admin')).toBe(true);
});
