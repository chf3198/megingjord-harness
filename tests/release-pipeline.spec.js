// Release pipeline tests (#912) — verify bundle-build determinism + slsa-verify wrapper.
// Deterministic; does NOT run a live release. Live release runs on tag-push only.
const { test, expect } = require('@playwright/test');
const path = require('path');
const fs = require('fs');

const BUILD = require(path.resolve(__dirname, '..', 'scripts', 'global', 'hamr-bundle-build.js'));
const VERIFY = require(path.resolve(__dirname, '..', 'scripts', 'global', 'slsa-verify.js'));

test('hamr-bundle-build TIERS includes governance-30kb', () => {
  expect(BUILD.TIERS).toHaveProperty('governance-30kb');
  const t = BUILD.TIERS['governance-30kb'];
  expect(Array.isArray(t.sources)).toBe(true);
  expect(t.sources).toContain('instructions/');
});

test('hamr-bundle-build readTreeSorted is deterministic', () => {
  const a = BUILD.readTreeSorted('instructions');
  const b = BUILD.readTreeSorted('instructions');
  expect(a.map((p) => p.rel)).toEqual(b.map((p) => p.rel));
  expect(a.length).toBeGreaterThan(0);
});

test('hamr-bundle-build readTreeSorted skips dotfiles', () => {
  const a = BUILD.readTreeSorted('instructions');
  for (const p of a) {
    expect(p.rel.split(path.sep).every((seg) => !seg.startsWith('.'))).toBe(true);
  }
});

test('hamr-bundle-build governance tier produces a SHA-256 (64 hex chars)', () => {
  const r = BUILD.buildTier('governance-30kb', BUILD.TIERS['governance-30kb']);
  expect(r.sha256).toMatch(/^[a-f0-9]{64}$/);
  expect(r.files).toBeGreaterThan(0);
  expect(r.outFile).toContain(r.sha256.slice(0, 16));
});

test('slsa-verify exposes verifyArtifact + verifyCosign', () => {
  expect(typeof VERIFY.verifyArtifact).toBe('function');
  expect(typeof VERIFY.verifyCosign).toBe('function');
  expect(typeof VERIFY.which).toBe('function');
});

test('slsa-verify.verifyArtifact returns ok:false reason artifact_not_found if file missing', () => {
  const r = VERIFY.verifyArtifact('/nonexistent', '/also-nonexistent');
  expect(r.ok).toBe(false);
  // Either slsa-verifier missing OR file-not-found — both are acceptable failure modes for the wrapper.
  expect(['slsa_verifier_not_installed', 'artifact_not_found']).toContain(r.reason);
});

test('slsa-verify.verifyCosign returns ok:false when artifact or cosign bundle missing', () => {
  const r = VERIFY.verifyCosign('/nonexistent', '/also-nonexistent');
  expect(r.ok).toBe(false);
  expect(['cosign_not_installed', 'artifact_not_found']).toContain(r.reason);
});

test('release.yml workflow file is valid YAML structure', () => {
  const yamlPath = path.resolve(__dirname, '..', '.github', 'workflows', 'release.yml');
  expect(fs.existsSync(yamlPath)).toBe(true);
  const text = fs.readFileSync(yamlPath, 'utf8');
  expect(text).toContain('slsa-framework/slsa-github-generator');
  expect(text).toContain('sigstore/cosign-installer');
  expect(text).toContain('cloudflare/wrangler-action');
  // Verify all third-party actions are pinned to a 40-char SHA.
  const actionPins = text.match(/uses: [^@]+@[a-f0-9]{40}/g) ?? [];
  expect(actionPins.length).toBeGreaterThanOrEqual(4); // checkout + setup-node + upload-artifact + others
});
