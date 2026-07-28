'use strict';
// tests/lane-enum.spec.js — Refs #2302 / Epic #2295 P1.1
// Verifies lane-enum.js single source of truth + validator consistency.

const { test, expect } = require('@playwright/test');
const path = require('path');

const laneEnum = require(path.join(__dirname, '..', 'scripts', 'global', 'lane-enum.js'));
const collabHandoff = require(path.join(
  __dirname, '..', 'scripts', 'global', 'megalint', 'collaborator-handoff.js'));
const adminHandoff = require(path.join(
  __dirname, '..', 'scripts', 'global', 'megalint', 'admin-handoff.js'));
const mergeGate = require(path.join(
  __dirname, '..', 'scripts', 'global', 'megalint', 'merge-evidence-pr-gate.js'));
const mergeEvidence = require(path.join(
  __dirname, '..', 'scripts', 'global', 'megalint', 'merge-evidence.js'));

// --- AC1: canonical lane set membership ---

test('LANES exports all canonical lane labels', () => {
  // #3792 (Epic #3789): lane:security-surface added as a full-severity lane.
  const expected = [
    'lane:code-change', 'lane:security-surface', 'lane:docs-research', 'lane:docs-only',
    'lane:config-only', 'lane:trivial', 'lane:research', 'lane:no-code-remediation',
  ];
  expect(laneEnum.LANES).toEqual(expected);
});

test('LANES is frozen (immutable)', () => {
  expect(Object.isFrozen(laneEnum.LANES)).toBe(true);
});

test('LANE_META has an entry for every lane in LANES', () => {
  for (const lane of laneEnum.LANES) {
    expect(laneEnum.LANE_META[lane]).toBeDefined();
    expect(typeof laneEnum.LANE_META[lane].severity).toBe('string');
  }
});

test('lane:code-change has severity full and both handoffs required', () => {
  const meta = laneEnum.LANE_META['lane:code-change'];
  expect(meta.severity).toBe('full');
  expect(meta.collab).toBe(true);
  expect(meta.admin).toBe(true);
});

test('lane:no-code-remediation has severity issue-only and no handoffs', () => {
  const meta = laneEnum.LANE_META['lane:no-code-remediation'];
  expect(meta.severity).toBe('issue-only');
  expect(meta.collab).toBe(false);
  expect(meta.admin).toBe(false);
});

// --- AC2/AC5: LIGHTWEIGHT set semantics ---

test('LIGHTWEIGHT contains exactly 5 reduced-baton lanes', () => {
  const expected = new Set([
    'lane:docs-research', 'lane:docs-only', 'lane:config-only',
    'lane:trivial', 'lane:research',
  ]);
  expect(new Set(laneEnum.LIGHTWEIGHT)).toEqual(expected);
});

test('LIGHTWEIGHT does not include lane:code-change', () => {
  expect(laneEnum.LIGHTWEIGHT).not.toContain('lane:code-change');
});

test('LIGHTWEIGHT does not include lane:no-code-remediation', () => {
  expect(laneEnum.LIGHTWEIGHT).not.toContain('lane:no-code-remediation');
});

test('LIGHTWEIGHT_LANES Set has same membership as LIGHTWEIGHT array', () => {
  for (const lane of laneEnum.LIGHTWEIGHT) {
    expect(laneEnum.LIGHTWEIGHT_LANES.has(lane)).toBe(true);
  }
  expect(laneEnum.LIGHTWEIGHT_LANES.size).toBe(laneEnum.LIGHTWEIGHT.length);
});

test('isLightweight() returns true for all lightweight lanes', () => {
  for (const lane of laneEnum.LIGHTWEIGHT) {
    expect(laneEnum.isLightweight(lane)).toBe(true);
  }
});

test('isLightweight() returns false for lane:code-change', () => {
  expect(laneEnum.isLightweight('lane:code-change')).toBe(false);
});

test('skipHandoff() returns true for no-collab+no-admin lanes', () => {
  // lanes where both collab and admin are false
  const noHandoffLanes = laneEnum.LANES.filter(l => {
    const meta = laneEnum.LANE_META[l];
    return !meta.collab && !meta.admin;
  });
  for (const lane of noHandoffLanes) {
    expect(laneEnum.skipHandoff(lane)).toBe(true);
  }
});

test('skipHandoff() returns false for lane:code-change', () => {
  expect(laneEnum.skipHandoff('lane:code-change')).toBe(false);
});

test('skipHandoff() returns false for lane:config-only (requires admin)', () => {
  // config-only needs admin handoff even though collab is skipped
  expect(laneEnum.skipHandoff('lane:config-only')).toBe(false);
});

test('skipHandoff() returns true for lane:no-code-remediation', () => {
  expect(laneEnum.skipHandoff('lane:no-code-remediation')).toBe(true);
});

test('laneSeverity() returns expected values', () => {
  expect(laneEnum.laneSeverity('lane:code-change')).toBe('full');
  expect(laneEnum.laneSeverity('lane:trivial')).toBe('lightweight');
  expect(laneEnum.laneSeverity('lane:no-code-remediation')).toBe('issue-only');
  expect(laneEnum.laneSeverity('lane:unknown')).toBeNull();
});

// --- AC5: all three validators recognise the same lightweight set ---

test('collaborator-handoff skips all LIGHTWEIGHT lanes', () => {
  for (const lane of laneEnum.LIGHTWEIGHT) {
    const result = collabHandoff.validate({ lane, comments: [] });
    expect(result.ok).toBe(true);
    expect(result.reason).toBe('lightweight-lane-skip');
  }
  // lane:code-change does NOT skip — requires COLLABORATOR_HANDOFF
  const codeChange = collabHandoff.validate({ lane: 'lane:code-change', comments: [] });
  expect(codeChange.ok).toBe(false);
  expect(codeChange.violations[0].rule).toBe('missing-collaborator-handoff');
});

test('admin-handoff skips all LIGHTWEIGHT lanes', () => {
  for (const lane of laneEnum.LIGHTWEIGHT) {
    const result = adminHandoff.validate({ lane, comments: [] });
    expect(result.ok).toBe(true);
    expect(result.reason).toBe('lightweight-lane-skip');
  }
  // lane:code-change requires ADMIN_HANDOFF
  const codeChange = adminHandoff.validate({ lane: 'lane:code-change', comments: [] });
  expect(codeChange.ok).toBe(false);
  expect(codeChange.violations[0].rule).toBe('missing-admin-handoff');
});

test('merge-evidence-pr-gate skips all LIGHTWEIGHT_LANES', () => {
  for (const lane of laneEnum.LIGHTWEIGHT) {
    const result = mergeGate.validate({ labels: [lane], issueNumber: 42, prBody: '' });
    expect(result.ok).toBe(true);
    expect(result.skipped).toMatch(/^lightweight-lane:/);
  }
});

test('merge-evidence skips all LIGHTWEIGHT_LANES', () => {
  for (const lane of laneEnum.LIGHTWEIGHT) {
    const result = mergeEvidence.validate({
      labels: ['status:done', lane], state: 'closed', mergedPRRefs: [],
    });
    expect(result.ok).toBe(true);
    expect(result.skipped).toMatch(/^lightweight-lane:/);
  }
});

test('all validators use identical lightweight set from lane-enum', () => {
  const enumSet = new Set(laneEnum.LIGHTWEIGHT);
  // merge-evidence validators export LIGHTWEIGHT_LANES — verify Set identity
  expect(mergeGate.LIGHTWEIGHT_LANES).toEqual(enumSet);
  expect(mergeEvidence.LIGHTWEIGHT_LANES).toEqual(enumSet);
});
