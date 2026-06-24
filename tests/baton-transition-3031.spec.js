'use strict';
const { test, expect } = require('@playwright/test');
const T = require('../scripts/global/megalint/baton-transition');

test('BATON_TRANSITION passes when Team&Model matches to_team', () => {
  const body = [
    '## BATON_TRANSITION',
    'to_team: codex',
    'Signed-by: Caden Harper',
    'Team&Model: codex:gpt-5.3-codex@codex-cli',
    'Role: collaborator',
  ].join('\n');
  expect(T.validateTransition(body).ok).toBe(true);
});

test('BATON_TRANSITION fails when teams mismatch', () => {
  const body = [
    '## BATON_TRANSITION',
    'to_team: copilot',
    'Signed-by: Caden Harper',
    'Team&Model: codex:gpt-5.3-codex@codex-cli',
    'Role: collaborator',
  ].join('\n');
  expect(T.validateTransition(body).ok).toBe(false);
});
