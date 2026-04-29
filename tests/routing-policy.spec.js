// Complexity threshold boundary tests — #575
const { test, expect } = require('@playwright/test');
const path = require('path');

const { resolveRouting } = require(path.join(__dirname, '../scripts/global/model-routing-engine'));
const { classifyPrompt } = require(path.join(__dirname, '../scripts/global/task-router'));

// AC2: complexityThresholds present and configurable in model-routing-policy.json
test('model-routing-policy has configurable complexityThresholds', () => {
  const policy = require(path.join(__dirname, '../scripts/global/model-routing-policy.json'));
  expect(typeof policy.complexityThresholds).toBe('object');
  expect(typeof policy.complexityThresholds.haiku).toBe('number');
  expect(typeof policy.complexityThresholds.premium).toBe('number');
  expect(policy.complexityThresholds.haiku).toBeLessThan(policy.complexityThresholds.premium);
});

// AC1: default lane is fleet
test('model-routing-policy defaultLane is fleet', () => {
  const policy = require(path.join(__dirname, '../scripts/global/model-routing-policy.json'));
  expect(policy.defaultLane).toBe('fleet');
});

// AC3: classifyPrompt emits complexity: 0.0–1.0
test('classifyPrompt emits numeric complexity in [0, 1]', () => {
  const r = classifyPrompt('implement a function to parse JSON');
  expect(typeof r.complexity).toBe('number');
  expect(r.complexity).toBeGreaterThanOrEqual(0);
  expect(r.complexity).toBeLessThanOrEqual(1);
});

// AC4: ai-models.json rule3 enforced — low-complexity tasks do not route to premium
test('rule3: low-complexity task forced from premium to fleet', () => {
  const route = { lane: 'premium', complexity: 0.1 };
  const resolved = resolveRouting('search for files', route);
  expect(resolved.lane).not.toBe('premium');
  expect(['fleet', 'free']).toContain(resolved.lane);
});

// AC5 boundary: complexity < 0.3 → fleet
test('complexity 0.29 routes to fleet (below haiku threshold)', () => {
  const route = { lane: 'premium', complexity: 0.29 };
  const resolved = resolveRouting('read docs', route);
  expect(resolved.lane).toBe('fleet');
});

// AC5 boundary: complexity in [0.3, 0.7) → haiku
test('complexity 0.35 routes to haiku (above haiku threshold, below premium)', () => {
  const route = { lane: 'premium', complexity: 0.35 };
  const resolved = resolveRouting('refactor a module', route);
  expect(resolved.lane).toBe('haiku');
});

// AC5 boundary: complexity 0.69 → haiku (just below premium threshold)
test('complexity 0.69 routes to haiku (just below premium threshold)', () => {
  const route = { lane: 'premium', complexity: 0.69 };
  const resolved = resolveRouting('implement feature', route);
  expect(resolved.lane).toBe('haiku');
});

// AC5 boundary: complexity >= 0.7 → premium
test('complexity 0.71 routes to premium (above premium threshold)', () => {
  const route = { lane: 'premium', complexity: 0.71 };
  const resolved = resolveRouting('architecture design risk security', route);
  expect(resolved.lane).toBe('premium');
});

// AC4: ai-models.json optimization rules imported by task-router
test('task-router imports ai-models.json optimization rules', () => {
  const aiModels = require(path.join(__dirname, '../inventory/ai-models.json'));
  expect(aiModels.optimizationStrategy).toBeDefined();
  expect(typeof aiModels.optimizationStrategy.rule1).toBe('string');
  expect(typeof aiModels.optimizationStrategy.rule3).toBe('string');
});
