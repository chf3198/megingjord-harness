// HAMR per-role lane preference tests — #2320 (Epic #2299 Phase-1 child 4)
// test_strategy: tdd-pyramid
const { test, expect } = require('@playwright/test');
const path = require('path');

const {
  resolveRouting,
  resolveRolePreference,
  loadPolicy,
} = require(path.join(__dirname, '../scripts/global/model-routing-engine'));

// ── AC1: per_role_lane_preferences block is present in policy ──────────────
test('AC1: model-routing-policy has per_role_lane_preferences block', () => {
  const policy = loadPolicy();
  expect(typeof policy.per_role_lane_preferences).toBe('object');
  const roles = ['manager', 'collaborator', 'admin', 'consultant', 'it', 'red-team'];
  for (const r of roles) {
    expect(policy.per_role_lane_preferences[r]).toBeDefined();
    expect(typeof policy.per_role_lane_preferences[r].low).toBe('string');
    expect(typeof policy.per_role_lane_preferences[r].mid).toBe('string');
    expect(typeof policy.per_role_lane_preferences[r].high).toBe('string');
  }
});

// ── AC2: resolveRolePreference returns correct lane per tier ───────────────
test('AC2: collaborator low-complexity routes to fleet', () => {
  const policy = loadPolicy();
  expect(resolveRolePreference(policy, 'collaborator', 0.1)).toBe('fleet');
});

test('AC2: collaborator mid-complexity routes to fleet', () => {
  const policy = loadPolicy();
  expect(resolveRolePreference(policy, 'collaborator', 0.5)).toBe('fleet');
});

test('AC2: collaborator high-complexity routes to haiku', () => {
  const policy = loadPolicy();
  expect(resolveRolePreference(policy, 'collaborator', 0.8)).toBe('haiku');
});

test('AC2: manager low-complexity routes to fleet', () => {
  const policy = loadPolicy();
  expect(resolveRolePreference(policy, 'manager', 0.1)).toBe('fleet');
});

test('AC2: manager high-complexity routes to premium', () => {
  const policy = loadPolicy();
  expect(resolveRolePreference(policy, 'manager', 0.9)).toBe('premium');
});

test('AC2: consultant mid-complexity routes to haiku', () => {
  const policy = loadPolicy();
  expect(resolveRolePreference(policy, 'consultant', 0.5)).toBe('haiku');
});

test('AC2: consultant high-complexity routes to premium', () => {
  const policy = loadPolicy();
  expect(resolveRolePreference(policy, 'consultant', 0.75)).toBe('premium');
});

test('AC2: it role always routes to fleet across all tiers', () => {
  const policy = loadPolicy();
  expect(resolveRolePreference(policy, 'it', 0.1)).toBe('fleet');
  expect(resolveRolePreference(policy, 'it', 0.5)).toBe('fleet');
  expect(resolveRolePreference(policy, 'it', 0.9)).toBe('fleet');
});

test('AC2: red-team high-complexity routes to haiku (not premium)', () => {
  const policy = loadPolicy();
  expect(resolveRolePreference(policy, 'red-team', 0.8)).toBe('haiku');
});

// ── AC2: resolveRolePreference returns null for unknown/absent role ─────────
test('AC2: resolveRolePreference returns null for unknown role', () => {
  const policy = loadPolicy();
  expect(resolveRolePreference(policy, 'unknown-role', 0.5)).toBeNull();
});

test('AC2: resolveRolePreference returns null when role is null', () => {
  const policy = loadPolicy();
  expect(resolveRolePreference(policy, null, 0.5)).toBeNull();
});

// ── AC2: resolveRouting applies per-role preference via opts.role ──────────
test('AC2: resolveRouting applies collaborator preference via opts.role', () => {
  const route = { lane: 'premium', complexity: 0.5 };
  const resolved = resolveRouting('implement a function', route, { role: 'collaborator' });
  expect(resolved.rolePrefApplied).toBe(true);
  expect(resolved.activeRole).toBe('collaborator');
  // collaborator mid → fleet
  expect(resolved.lane).toBe('fleet');
});

test('AC2: resolveRouting applies manager high-complexity preference', () => {
  const route = { lane: 'fleet', complexity: 0.85 };
  const resolved = resolveRouting('architecture design for multi-team system', route, {
    role: 'manager',
  });
  expect(resolved.rolePrefApplied).toBe(true);
  expect(resolved.lane).toBe('premium');
});

test('AC2: resolveRouting sets rolePrefApplied false when no role given', () => {
  const route = { lane: 'fleet', complexity: 0.5 };
  const resolved = resolveRouting('search for files', route);
  expect(resolved.rolePrefApplied).toBe(false);
  expect(resolved.activeRole).toBeNull();
});

// ── AC2: route.role fallback when opts not provided ────────────────────────
test('AC2: resolveRouting reads role from route.role when opts absent', () => {
  const route = { lane: 'premium', complexity: 0.5, role: 'admin' };
  const resolved = resolveRouting('run CI checks', route);
  expect(resolved.rolePrefApplied).toBe(true);
  expect(resolved.activeRole).toBe('admin');
  // admin mid → fleet
  expect(resolved.lane).toBe('fleet');
});

// ── AC4: policy is structurally valid JSON with required top-level keys ────
test('AC4: policy JSON is structurally valid and cross-runtime consumable', () => {
  const policy = loadPolicy();
  expect(typeof policy.version).toBe('string');
  expect(typeof policy.defaultLane).toBe('string');
  expect(typeof policy.per_role_lane_preferences).toBe('object');
  // All lane values are valid enum members
  const validLanes = new Set(['free', 'fleet', 'haiku', 'premium']);
  const prefs = policy.per_role_lane_preferences;
  for (const role of Object.keys(prefs).filter(k => !k.startsWith('_'))) {
    for (const tier of ['low', 'mid', 'high']) {
      expect(validLanes.has(prefs[role][tier])).toBe(true);
    }
  }
});
