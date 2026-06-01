'use strict';
// Tests for extractAIFamily + checkConsultantFamilyIndependence (#2536)
const { test, expect } = require('@playwright/test');
const { extractAIFamily, checkConsultantFamilyIndependence, validate } =
  require('../scripts/global/megalint/signer-fidelity.js');

test('extractAIFamily — claude model → anthropic', () => {
  expect(extractAIFamily('copilot:claude-sonnet-4-6@github')).toBe('anthropic');
});
test('extractAIFamily — gpt model → openai', () => {
  expect(extractAIFamily('codex:gpt-5.4@openai')).toBe('openai');
});
test('extractAIFamily — qwen model → qwen', () => {
  expect(extractAIFamily('fleet:qwen2.5-coder:7b@ollama')).toBe('qwen');
});
test('extractAIFamily — unknown model → unknown', () => {
  expect(extractAIFamily('team:llama3@local')).toBe('unknown');
});
test('same-family consultant+collaborator → advisory cross-family-mismatch', () => {
  const body = [
    'Team&Model: copilot:claude-sonnet-4-6@github',
    'Role: collaborator',
    '---',
    'Team&Model: copilot:claude-sonnet-4-6@github',
    'Role: consultant',
  ].join('\n');
  const violations = checkConsultantFamilyIndependence(body);
  expect(violations).toHaveLength(1);
  expect(violations[0].rule).toBe('cross-family-mismatch');
  expect(violations[0].severity).toBe('advisory');
});
test('different-family consultant+collaborator → no violation', () => {
  const body = [
    'Team&Model: codex:gpt-5.4@openai',
    'Role: collaborator',
    '---',
    'Team&Model: copilot:claude-sonnet-4-6@github',
    'Role: consultant',
  ].join('\n');
  expect(checkConsultantFamilyIndependence(body)).toHaveLength(0);
});
test('validate: same-family advisory does not flip ok to false', () => {
  const body = [
    'Signed-by: Soren Harper',
    'Team&Model: copilot:claude-sonnet-4-6@github',
    'Role: collaborator',
    '---',
    'Signed-by: Soren Vale',
    'Team&Model: copilot:claude-sonnet-4-6@github',
    'Role: consultant',
  ].join('\n');
  const result = validate({ body });
  const cf = result.violations.filter(v => v.rule === 'cross-family-mismatch');
  expect(cf).toHaveLength(1);
  expect(result.ok).toBe(true);
});
test('no consultant or collaborator → no cross-family violation', () => {
  expect(checkConsultantFamilyIndependence('Team&Model: codex:gpt-5@openai\nRole: admin')).toHaveLength(0);
});
