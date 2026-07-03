const { test, expect } = require('@playwright/test');
const path = require('path');

const gate = require(path.join(
  __dirname,
  '..',
  'scripts',
  'global',
  'baton-independence.js'
));

// #3532 (Client design decision): independence is decided by the Team&Model TEAM
// segment OR a verified cross-family consensus receipt — NOT by persona surname.
// Tests 3 & 4 below previously asserted the self-satisfiable persona loophole
// (#3518/#3521); they now assert the hardened contract (same-team split FAILS).

test('admin gate fails when collaborator and admin use same Team&Model', () => {
  const result = gate.checkAdminIndependence([
    { body: 'COLLABORATOR_HANDOFF\nAI-Team-Model: codex:gpt-5@openai' },
    { body: 'ADMIN_HANDOFF\nAI-Team-Model: codex:gpt-5@openai' },
  ]);
  expect(result.ok).toBe(false);
  expect(result.reason).toBe('same-team-no-valid-receipt');
});

test('admin gate passes when collaborator and admin use different teams', () => {
  const result = gate.checkAdminIndependence([
    { body: 'COLLABORATOR_HANDOFF\nAI-Team-Model: claude-code:opus@anthropic' },
    { body: 'ADMIN_HANDOFF\nAI-Team-Model: codex:gpt-5@openai' },
  ]);
  expect(result.ok).toBe(true);
  expect(result.reason).toBe('independent-team');
});

test('persona-surname difference alone NO LONGER satisfies independence (#3518)', () => {
  const result = gate.checkAdminIndependence([
    { body: 'COLLABORATOR_HANDOFF\nAI-Signature: Cora\nAI-Team-Model: codex:gpt-5@openai' },
    { body: 'ADMIN_HANDOFF\nAI-Signature: Nia\nAI-Team-Model: codex:gpt-5@openai' },
  ]);
  expect(result.ok).toBe(false);
  expect(result.reason).toBe('same-team-no-valid-receipt');
});

test('distinct aliases with no parseable team also fail (no receipt)', () => {
  const result = gate.checkAdminIndependence([
    { body: 'COLLABORATOR_HANDOFF\nAI-Signature: Cora' },
    { body: 'ADMIN_HANDOFF\nAI-Signature: Nolan\nOpened after COLLABORATOR_HANDOFF aged past the gate.' },
  ]);
  expect(result.ok).toBe(false);
  expect(result.reason).toBe('no-independent-team-no-receipt');
});

test('role identity accepts legacy Team&Model and Signed-by fields', () => {
  expect(gate.roleIdentity({ body: 'Team&Model: copilot:gpt-5.1@github' }))
    .toBe('copilot:gpt-5.1@github');
  expect(gate.roleIdentity({ body: 'Signed-by: Ada Admin' }))
    .toBe('Ada Admin');
});
