// #2619: fleet-unavailable failover routes to free-cloud before paid Haiku.
const { test, expect } = require('@playwright/test');
const path = require('path');
const { execFileSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const { escalationTier } = require(path.join(ROOT, 'scripts', 'global', 'cascade-dispatch.js'));
const POLICY = require(path.join(ROOT, 'scripts', 'global', 'model-routing-policy.json'));

test('availability failures escalate to free-cloud (not paid haiku)', () => {
  expect(escalationTier('ollama_unreachable')).toBe('free-cloud');
  expect(escalationTier('fleet_unavailable')).toBe('free-cloud');
  expect(escalationTier('cascade_script_not_found')).toBe('free-cloud');
  expect(escalationTier('connect ECONNREFUSED 100.91.113.16:11434')).toBe('free-cloud');
  expect(escalationTier('fetch failed')).toBe('free-cloud');
});

test('capability failures step up to paid haiku', () => {
  expect(escalationTier('too_short')).toBe('haiku');
  expect(escalationTier('no_code_structure')).toBe('haiku');
  expect(escalationTier('judge_low_score')).toBe('haiku');
  expect(escalationTier(null)).toBe('haiku'); // unknown -> conservative capability step-up
});

test('policy defines free-cloud as a $0 tier ordered between fleet and haiku', () => {
  const fc = POLICY.models['free-cloud'];
  expect(fc).toBeTruthy();
  expect(fc.costPer1kTokens).toBe(0);
  expect(fc.mult).toBe(0);
  expect(Array.isArray(fc.providers)).toBe(true);
  expect(fc.providers.length).toBeGreaterThan(0);
  const tiers = POLICY.cascade.tiers;
  expect(tiers).toContain('free-cloud');
  // cost-ascending: free-cloud sits after fleet and before haiku
  expect(tiers.indexOf('free-cloud')).toBeGreaterThan(tiers.indexOf('fleet'));
  expect(tiers.indexOf('free-cloud')).toBeLessThan(tiers.indexOf('haiku'));
});

test('task_router.py: cascade-script-not-found availability failure suggests free-cloud', () => {
  const py = [
    'import sys; sys.path.insert(0, "hooks/scripts")',
    'import task_router',
    'task_router._cascade_candidates = lambda: []',  // force availability failure (no script)
    'import json; print(json.dumps(task_router.execute_cascade("hello world test prompt")))',
  ].join('\n');
  const out = execFileSync('python3', ['-c', py], { cwd: ROOT, encoding: 'utf8' });
  const result = JSON.parse(out.trim().split('\n').pop());
  expect(result.escalation_needed).toBe(true);
  expect(result.suggested_tier).toBe('free-cloud');
  expect(result.reason).toBe('cascade_script_not_found');
});
