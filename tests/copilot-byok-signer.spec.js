// Regression spec for #3044 — Copilot BYOK signer / Team&Model parity.
// Asserts that copilot:gemini-*, copilot:gpt-4*, and copilot:o[0-9] model
// families produce explicit registry-derived aliases rather than the
// "Nova" default fallback that previously broke admin-gate analyzeComments.
'use strict';
const { test, expect } = require('@playwright/test');
const { execFileSync } = require('child_process');
const path = require('path');
const { canonicalSignerAlias } = require('../scripts/global/signer-alias');

const CLI = path.join(__dirname, '..', 'scripts', 'global', 'agent-signature.js');

function runCli(team, model, role) {
  const env = { ...process.env };
  delete env.HAMR_TEAM;
  delete env.MEGINGJORD_TEAM;
  delete env.HAMR_MODEL;
  delete env.MEGINGJORD_MODEL;
  const out = execFileSync('node', [CLI, '--team', team, '--model', model, '--role', role], {
    encoding: 'utf8',
    env,
  });
  return JSON.parse(out);
}

// -- Gemini family --

test('copilot:gemini-2.5-flash yields Gaia Harper (collaborator)', () => {
  const result = runCli('copilot', 'gemini-2.5-flash', 'collaborator');
  expect(result.signedBy).toBe('Gaia Harper');
  expect(result.role).toBe('collaborator');
});

test('copilot:gemini-2.5-pro yields Gaia Mason (manager)', () => {
  const result = runCli('copilot', 'gemini-2.5-pro', 'manager');
  expect(result.signedBy).toBe('Gaia Mason');
});

test('copilot:gemini-3-flash yields Gaia alias (future Gemini minor versions)', () => {
  const result = runCli('copilot', 'gemini-3-flash', 'collaborator');
  expect(result.signedBy).toBe('Gaia Harper');
});

// -- GPT-4 family --

test('copilot:gpt-4.1 yields Gale Reyes (admin)', () => {
  const result = runCli('copilot', 'gpt-4.1', 'admin');
  expect(result.signedBy).toBe('Gale Reyes');
});

test('copilot:gpt-4o yields Gale alias', () => {
  const result = runCli('copilot', 'gpt-4o', 'collaborator');
  expect(result.signedBy).toBe('Gale Harper');
});

// -- o-series (o1, o3, o4-mini) --

test('copilot:o3 yields Onyx Vale (consultant)', () => {
  const result = runCli('copilot', 'o3', 'consultant');
  expect(result.signedBy).toBe('Onyx Vale');
});

test('copilot:o1 yields Onyx alias', () => {
  const result = runCli('copilot', 'o1', 'collaborator');
  expect(result.signedBy).toBe('Onyx Harper');
});

// -- Non-regression: existing copilot aliases unchanged --

test('copilot:claude-sonnet still maps to Soren', () => {
  const result = runCli('copilot', 'claude-sonnet-4-7', 'collaborator');
  expect(result.signedBy).toBe('Soren Harper');
});

test('copilot:claude-opus still maps to Orion', () => {
  const result = runCli('copilot', 'claude-opus-4-8', 'consultant');
  expect(result.signedBy).toBe('Orion Vale');
});

test('copilot:gpt-5.1-mini still maps to Milo', () => {
  const result = runCli('copilot', 'gpt-5.1-mini', 'collaborator');
  expect(result.signedBy).toBe('Milo Harper');
});

test('copilot:gpt-5-codex still maps to Coda', () => {
  const result = runCli('copilot', 'gpt-5.4-codex', 'collaborator');
  expect(result.signedBy).toBe('Coda Harper');
});

// -- canonicalSignerAlias module API parity --

test('canonicalSignerAlias matches CLI output for gemini', () => {
  const alias = canonicalSignerAlias('copilot', 'collaborator', 'gemini-2.5-flash');
  expect(alias).toBe('Gaia Harper');
});

test('canonicalSignerAlias matches CLI output for gpt-4.1', () => {
  const alias = canonicalSignerAlias('copilot', 'admin', 'gpt-4.1');
  expect(alias).toBe('Gale Reyes');
});

test('canonicalSignerAlias matches CLI output for o3', () => {
  const alias = canonicalSignerAlias('copilot', 'consultant', 'o3');
  expect(alias).toBe('Onyx Vale');
});

// -- None of the new aliases equal "Nova" (the generic default) --

test('gemini alias is not the Nova default', () => {
  const alias = canonicalSignerAlias('copilot', 'collaborator', 'gemini-2.5-flash');
  expect(alias).not.toContain('Nova');
});

test('gpt-4 alias is not the Nova default', () => {
  const alias = canonicalSignerAlias('copilot', 'collaborator', 'gpt-4o');
  expect(alias).not.toContain('Nova');
});

test('o-series alias is not the Nova default', () => {
  const alias = canonicalSignerAlias('copilot', 'collaborator', 'o3');
  expect(alias).not.toContain('Nova');
});
