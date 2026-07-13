'use strict';
// tests/lane-security-surface.spec.js — #3792 (Epic #3789, Phase-0 source #3790)
// Verifies the new full-severity lane:security-surface is registered correctly:
// it inherits the 4-role baton (collab + admin) and the cross_family_receipt
// independence requirement, and is NOT treated as lightweight/handoff-skipping.

const { test, expect } = require('@playwright/test');
const path = require('path');

const laneEnum = require(path.join(__dirname, '..', 'scripts', 'global', 'lane-enum.js'));

test('lane:security-surface is a registered canonical lane', () => {
  expect(laneEnum.LANES).toContain('lane:security-surface');
});

test('lane:security-surface is full severity (4-role baton)', () => {
  expect(laneEnum.laneSeverity('lane:security-surface')).toBe('full');
  const meta = laneEnum.LANE_META['lane:security-surface'];
  expect(meta).toEqual({ severity: 'full', collab: true, admin: true });
});

test('lane:security-surface is NOT lightweight and does NOT skip handoff', () => {
  expect(laneEnum.isLightweight('lane:security-surface')).toBe(false);
  expect(laneEnum.skipHandoff('lane:security-surface')).toBe(false);
  expect(laneEnum.LIGHTWEIGHT).not.toContain('lane:security-surface');
});

test('lane:security-surface parallels lane:code-change severity/handoff shape', () => {
  expect(laneEnum.laneSeverity('lane:security-surface'))
    .toBe(laneEnum.laneSeverity('lane:code-change'));
  expect(laneEnum.skipHandoff('lane:security-surface'))
    .toBe(laneEnum.skipHandoff('lane:code-change'));
});
