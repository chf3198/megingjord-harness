const { test, expect } = require('@playwright/test');
const path = require('path');

const gate = require(path.join(
  __dirname,
  '..',
  'scripts',
  'global',
  'baton-independence.js'
));

test('admin gate fails when collaborator and admin use same Team&Model', () => {
  const result = gate.checkAdminIndependence([
    { body: 'COLLABORATOR_HANDOFF\nAI-Team-Model: codex:gpt-5@openai' },
    { body: 'ADMIN_HANDOFF\nAI-Team-Model: codex:gpt-5@openai' },
  ]);
  expect(result.ok).toBe(false);
  expect(result.reason).toBe('same-signer');
});

test('admin gate passes when collaborator and admin use different teams', () => {
  const result = gate.checkAdminIndependence([
    { body: 'COLLABORATOR_HANDOFF\nAI-Team-Model: claude-code:opus@anthropic' },
    { body: 'ADMIN_HANDOFF\nAI-Team-Model: codex:gpt-5@openai' },
  ]);
  expect(result.ok).toBe(true);
  expect(result.reason).toBe('independent');
});

test('signer alias takes precedence over shared Team&Model provenance', () => {
  const result = gate.checkAdminIndependence([
    { body: 'COLLABORATOR_HANDOFF\nAI-Signature: Cora\nAI-Team-Model: codex:gpt-5@openai' },
    { body: 'ADMIN_HANDOFF\nAI-Signature: Nia\nAI-Team-Model: codex:gpt-5@openai' },
  ]);
  expect(result.ok).toBe(true);
  expect(result.collaboratorId).toBe('Cora');
  expect(result.adminId).toBe('Nia');
});

test('role identity accepts legacy Team&Model and Signed-by fields', () => {
  expect(gate.roleIdentity({ body: 'Team&Model: copilot:gpt-5.1@github' }))
    .toBe('copilot:gpt-5.1@github');
  expect(gate.roleIdentity({ body: 'Signed-by: Ada Admin' }))
    .toBe('Ada Admin');
});
