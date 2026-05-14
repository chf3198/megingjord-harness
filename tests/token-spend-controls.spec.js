const { test, expect } = require('@playwright/test');
const path = require('path');

const C = require(path.resolve(__dirname, '..', 'scripts', 'global', 'token-spend-controls.js'));

test('compactPrompt removes duplicate lines and shrinks payload', () => {
  const input = 'alpha\nalpha\nbeta\nGoal lens: test\nbeta';
  const out = C.compactPrompt(input, 'free');
  expect(out.stats.duplicateLines).toBeGreaterThan(0);
  expect(out.stats.sentChars).toBeLessThan(out.stats.rawChars);
  expect(out.prompt.includes('alpha')).toBeTruthy();
});

test('compactPrompt applies lane-specific caps', () => {
  const input = 'x'.repeat(9000);
  const free = C.compactPrompt(input, 'free');
  const premium = C.compactPrompt(input, 'premium');
  expect(free.stats.sentChars).toBe(C.MAX_CHARS.free);
  expect(premium.stats.sentChars).toBe(C.MAX_CHARS.premium);
});

test('scopeContext maps lanes to deterministic tier metadata', () => {
  const fleet = C.scopeContext('fleet');
  const premium = C.scopeContext('premium');
  expect(fleet.tier).toBe(C.TIER_BY_LANE.fleet);
  expect(premium.tier).toBe(C.TIER_BY_LANE.premium);
  expect(fleet.sha256).toMatch(/^[a-f0-9]{64}$/);
});
