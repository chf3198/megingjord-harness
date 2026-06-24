'use strict';
const { test, expect } = require('@playwright/test');
const gate = require('../scripts/global/cross-team-lease-gate');

test('touchesGuarded detects governance paths', () => {
  expect(gate.touchesGuarded(['scripts/global/foo.js'])).toBe(true);
  expect(gate.touchesGuarded(['README.md'])).toBe(false);
});

test('ticketFromBranch parses feat/N-slug', () => {
  expect(gate.ticketFromBranch('feat/3033-atomic-primitives')).toBe(3033);
  expect(gate.ticketFromBranch('main')).toBeNull();
});
