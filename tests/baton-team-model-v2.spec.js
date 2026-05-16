'use strict';

const { test, expect } = require('@playwright/test');
const v2 = require('../scripts/global/baton-team-model-v2.js');

test('extractTeam returns team portion of team:model@substrate', () => {
  expect(v2.extractTeam('claude-code:opus-4-7@anthropic')).toBe('claude-code');
  expect(v2.extractTeam('codex:gpt-5@openai')).toBe('codex');
  expect(v2.extractTeam('no-colon')).toBe(null);
  expect(v2.extractTeam(null)).toBe(null);
});

test('Rule 1 passes when self-review team differs from implementation', () => {
  const result = v2.enforceRotationV2({
    roles_observed: {
      implementation: 'claude-code:opus-4-7@anthropic',
      collaborator_self_check: 'codex:gpt-5@openai',
    },
  });
  expect(result.ok).toBe(true);
});

test('Rule 1 fails when self-review uses same team as implementation', () => {
  const result = v2.enforceRotationV2({
    roles_observed: {
      implementation: 'claude-code:opus-4-7@anthropic',
      collaborator_self_check: 'claude-code:sonnet@anthropic',
    },
  });
  expect(result.ok).toBe(false);
  expect(result.violations[0].rule).toBe('rule_1_collab_self_review');
});

test('Rule 2 fails when admin team matches earlier role', () => {
  const result = v2.enforceRotationV2({
    roles_observed: {
      manager: 'claude-code:opus-4-7@anthropic',
      collaborator: 'codex:gpt-5@openai',
      admin: 'claude-code:opus-4-7@anthropic',
    },
  });
  expect(result.ok).toBe(false);
  expect(result.violations[0].rule).toBe('rule_2_admin_diversity');
});

test('Rule 3 fails when consultant team matches earlier role', () => {
  const result = v2.enforceRotationV2({
    roles_observed: {
      manager: 'claude-code:opus@anthropic',
      collaborator: 'codex:gpt-5@openai',
      admin: 'copilot:opus@github-copilot',
      consultant: 'codex:gpt-5@openai',
    },
  });
  expect(result.ok).toBe(false);
  expect(result.violations[0].rule).toBe('rule_3_consultant_independent');
});

test('All 3 rules pass with 4 distinct teams', () => {
  const result = v2.enforceRotationV2({
    roles_observed: {
      manager: 'claude-code:opus@anthropic',
      collaborator: 'codex:gpt-5@openai',
      admin: 'copilot:opus@github-copilot',
      consultant: 'openclaw:qwen2.5@ollama',
    },
  });
  expect(result.ok).toBe(true);
});

test('single-model-fleet operator mode skips enforcement', () => {
  const result = v2.enforceRotationV2({
    operator_mode: 'single-model-fleet',
    roles_observed: {
      manager: 'claude-code:opus@anthropic',
      collaborator: 'claude-code:opus@anthropic',
      admin: 'claude-code:opus@anthropic',
      consultant: 'claude-code:opus@anthropic',
    },
  });
  expect(result.ok).toBe(true);
  expect(result.skipped).toBe('single-model-fleet');
});

test('rotation-required-waived label v2 honored', () => {
  const result = v2.enforceRotationV2({
    labels: ['rotation-required-waived'],
    roles_observed: {
      manager: 'claude-code:opus@anthropic',
      collaborator: 'claude-code:opus@anthropic',
      admin: 'claude-code:opus@anthropic',
    },
  });
  expect(result.ok).toBe(true);
  expect(result.skipped).toBe('v2-waived');
});

test('legacy model-diversity:waived v1 label still honored', () => {
  const result = v2.enforceRotationV2({
    labels: ['model-diversity:waived'],
    roles_observed: { manager: 'a:x@y', collaborator: 'a:x@y', admin: 'a:x@y' },
  });
  expect(result.ok).toBe(true);
  expect(result.skipped).toBe('v1-waived');
});

test('extractRecordsFromComments captures all 5 role records', () => {
  const comments = [
    { body: 'MANAGER_HANDOFF\nTeam&Model: claude-code:opus@anthropic\nRole: manager' },
    { body: 'COLLABORATOR_HANDOFF\nTeam&Model: codex:gpt-5@openai\nRole: collaborator' },
    { body: 'COLLABORATOR_SELF_CHECK\nTeam&Model: openclaw:qwen@ollama\nRole: collaborator' },
    { body: 'ADMIN_HANDOFF\nTeam&Model: copilot:opus@github-copilot\nRole: admin' },
    { body: 'CONSULTANT_CLOSEOUT\nTeam&Model: openclaw:mistral@ollama\nRole: consultant' },
  ];
  const out = v2.extractRecordsFromComments(comments);
  expect(out.manager).toBe('claude-code:opus@anthropic');
  expect(out.collaborator).toBe('codex:gpt-5@openai');
  expect(out.collaborator_self_check).toBe('openclaw:qwen@ollama');
  expect(out.admin).toBe('copilot:opus@github-copilot');
  expect(out.consultant).toBe('openclaw:mistral@ollama');
});

test('end-to-end: 4 distinct teams + self-check from 5th = all rules pass', () => {
  const comments = [
    { body: 'MANAGER_HANDOFF\nTeam&Model: claude-code:opus@anthropic\nRole: manager' },
    { body: 'COLLABORATOR_HANDOFF\nTeam&Model: codex:gpt-5@openai\nRole: collaborator' },
    { body: 'COLLABORATOR_SELF_CHECK\nTeam&Model: openclaw:qwen@ollama\nRole: collaborator' },
    { body: 'ADMIN_HANDOFF\nTeam&Model: copilot:opus@github-copilot\nRole: admin' },
    { body: 'CONSULTANT_CLOSEOUT\nTeam&Model: openclaw:mistral@ollama\nRole: consultant' },
  ];
  const records = v2.extractRecordsFromComments(comments);
  const result = v2.enforceRotationV2({ roles_observed: records });
  expect(result.ok).toBe(true);
  expect(result.violations).toHaveLength(0);
});
