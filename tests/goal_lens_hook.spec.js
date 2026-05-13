const { test, expect } = require('@playwright/test');
const { spawnSync } = require('child_process');
const path = require('path');

const hookPath = path.resolve(__dirname, '..', 'hooks', 'scripts', 'goal_lens.py');

function runHook(payload) {
  const result = spawnSync('python3', [hookPath], {
    input: JSON.stringify(payload),
    encoding: 'utf8',
  });
  expect(result.status).toBe(0);
  expect(result.stderr).toBe('');
  return JSON.parse(result.stdout);
}

test('goal lens hook adds anneal awareness for mid-flight recurrence prompts', () => {
  const output = runHook({
    prompt: 'We need to handle a recurring mid-flight self-anneal pattern before cron.',
    role: 'manager',
  });
  expect(output.hookSpecificOutput.additionalContext).toContain('Anneal awareness: if a recurrence pattern is observed mid-flight');
  expect(output.hookSpecificOutput.goalLensTier).toBe('B');
});

test('goal lens hook preserves consultant decision expansion', () => {
  const output = runHook({
    prompt: 'Which architecture should we choose for this governance workflow?',
    role: 'consultant',
  });
  expect(output.hookSpecificOutput.additionalContext).toContain('Decision check: justify any lower-priority override with explicit evidence.');
  expect(output.hookSpecificOutput.additionalContext).toContain('G1 Governance: policy, role, provenance, ticket controls non-negotiable.');
  expect(output.hookSpecificOutput.goalLensTier).toBe('B+');
});