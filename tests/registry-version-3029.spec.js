'use strict';
const { test, expect } = require('@playwright/test');
const path = require('path');
const fs = require('fs');
const os = require('os');
const Rv = require(path.resolve(__dirname, '..', 'scripts', 'global', 'registry-version.js'));
const Cov = require(path.resolve(__dirname, '..', 'scripts', 'global', 'megalint', 'registry-tuple-coverage.js'));
const Sig = require(path.resolve(__dirname, '..', 'scripts', 'global', 'megalint', 'signer-registry-check.js'));

test('registryVersion hash matches canonical signing surface', () => {
  const reg = Rv.loadRegistry();
  expect(reg.registryVersion).toBe(Rv.computeRegistryHash(reg));
  expect(Rv.verifyRegistryIntegrity(reg).ok).toBe(true);
});

test('registry drift fails closed with re-sign hint', () => {
  const reg = Rv.loadRegistry();
  const bad = { ...reg, registryVersion: 'deadbeefdeadbeef' };
  const drift = Rv.verifyRegistryIntegrity(bad);
  expect(drift.ok).toBe(false);
  expect(drift.reason).toBe('registry-version-drift');
  expect(drift.hint).toContain('registry-version.js --write');
});

test('autoModeCoverage: copilot qwen maps team-specific (not wildcard)', () => {
  const coverage = Cov.checkCoverage();
  expect(coverage.ok).toBe(true);
  expect(coverage.unmapped).toEqual([]);
});

test('copilot:qwen2.5-coder artifact passes alias validation (#3020 class)', () => {
  const body = 'Signed-by: Quenby Harper\nTeam&Model: copilot:qwen2.5-coder@github-copilot\nRole: collaborator';
  const verdict = Sig.validateArtifactAlias(body);
  expect(verdict.ok).toBe(true);
  expect(verdict.expected).toBe('Quenby Harper');
});

test('copilot:claude-sonnet artifact passes with Soren alias', () => {
  const body = 'Signed-by: Soren Harper\nTeam&Model: copilot:claude-sonnet-4-6@github-copilot\nRole: collaborator';
  expect(Sig.validateArtifactAlias(body).ok).toBe(true);
});

test('wildcard-only tuple is flagged unmapped', () => {
  const tmp = path.join(os.tmpdir(), `reg-cov-${Date.now()}.json`);
  const reg = Rv.loadRegistry();
  reg.autoModeCoverage = { copilot: ['totally-unknown-xyz-model'] };
  fs.writeFileSync(tmp, JSON.stringify(reg));
  const coverageResult = Cov.checkCoverage(tmp);
  expect(coverageResult.ok).toBe(false);
  expect(coverageResult.unmapped[0].resolvedTo).toBe('defaultAliasSeed');
  fs.unlinkSync(tmp);
});
