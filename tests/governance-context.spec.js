const test = require('node:test');
const assert = require('node:assert/strict');
const { injectGoalContext, shouldInject, buildPrefix, estimateOverheadTokens, PRIORITY_SENTENCE, DECISION_CHECK, GOAL_DEFINITIONS } = require('../scripts/global/governance-context.js');

test('PRIORITY_SENTENCE contains all 10 goal labels', () => {
  for (let i = 1; i <= 10; i++) assert.match(PRIORITY_SENTENCE, new RegExp(`G${i}\\b`));
});

test('DECISION_CHECK mirrors goal_lens.py', () => {
  assert.match(DECISION_CHECK, /justify any lower-priority override/);
});

test('GOAL_DEFINITIONS has 10 entries G1-G10', () => {
  for (let i = 1; i <= 10; i++) assert.ok(GOAL_DEFINITIONS[`G${i}`], `G${i} missing`);
});

test('shouldInject: default true', () => {
  assert.equal(shouldInject({}), true);
});

test('shouldInject: tier=diagnostic skips', () => {
  assert.equal(shouldInject({ tier: 'diagnostic' }), false);
});

test('shouldInject: tier=test skips', () => {
  assert.equal(shouldInject({ tier: 'test' }), false);
});

test('shouldInject: explicit inject_goal_context=false skips', () => {
  assert.equal(shouldInject({ inject_goal_context: false }), false);
});

test('shouldInject: explicit inject_goal_context=true honors', () => {
  assert.equal(shouldInject({ inject_goal_context: true, tier: 'fleet-local' }), true);
});

test('shouldInject: null opts returns false', () => {
  assert.equal(shouldInject(null), false);
});

test('buildPrefix: default omits definitions', () => {
  const p = buildPrefix();
  assert.match(p, /G1 Governance/);
  assert.equal(p.includes('G1 Governance:'), false);  // definitions header
});

test('buildPrefix: includeDefinitions=true adds all 10 definitions', () => {
  const p = buildPrefix({ includeDefinitions: true });
  for (let i = 1; i <= 10; i++) assert.match(p, new RegExp(`G${i} `));
});

test('injectGoalContext: returns {systemPrefix, injected:true} when shouldInject', () => {
  const r = injectGoalContext({});
  assert.equal(r.injected, true);
  assert.ok(r.systemPrefix);
});

test('injectGoalContext: diagnostic tier returns null systemPrefix', () => {
  const r = injectGoalContext({ tier: 'diagnostic' });
  assert.equal(r.injected, false);
  assert.equal(r.systemPrefix, null);
});

test('estimateOverheadTokens: priority-only ~30 tokens', () => {
  assert.equal(estimateOverheadTokens(), 30);
});

test('estimateOverheadTokens: with definitions ~210 tokens', () => {
  assert.equal(estimateOverheadTokens({ includeDefinitions: true }), 210);
});
