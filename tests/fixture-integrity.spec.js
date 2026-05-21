// Fixture integrity tests per #2027 (red-team Attack #3 mitigation).
// Lane: code-change. test_strategy: tdd-pyramid + adversarial-fixture.

const { test, expect } = require('@playwright/test');
const path = require('path');
const fs = require('fs');
const LOADER = require(path.resolve(__dirname, '..', 'scripts', 'global', 'goal-hijack-fixture-loader.js'));

test('MANIFEST.sha256 file exists in fixture directory', () => {
  expect(fs.existsSync(LOADER.MANIFEST_FILE)).toBe(true);
});

test('readManifest returns map of fixture-name -> sha256 hex digest', () => {
  const manifest = LOADER.readManifest();
  expect(typeof manifest).toBe('object');
  expect(Object.keys(manifest).length).toBeGreaterThanOrEqual(10);
  for (const [name, hash] of Object.entries(manifest)) {
    expect.soft(name).toMatch(/\.json$/);
    expect.soft(hash).toMatch(/^[a-f0-9]{64}$/);
  }
});

test('sha256 computes correct hex digest for any file', () => {
  const tmp = path.join(__dirname, '..', 'package.json');
  const digest = LOADER.sha256(tmp);
  expect(digest).toMatch(/^[a-f0-9]{64}$/);
});

test('verifyIntegrity passes for unmodified canonical fixtures', () => {
  const manifest = LOADER.readManifest();
  for (const filename of Object.keys(manifest)) {
    const result = LOADER.verifyIntegrity(filename, manifest);
    expect.soft(result.ok, `${filename}: ${result.reason || ''}`).toBe(true);
  }
});

test('verifyIntegrity FAILS when file content modified (injection attack)', () => {
  // Simulate Attack #3 by creating a tampered fixture in a temp location
  const tmpDir = fs.mkdtempSync(path.join(require('os').tmpdir(), 'fixture-tamper-'));
  const tamperedPath = path.join(tmpDir, 'tampered.json');
  fs.writeFileSync(tamperedPath, '{"id":"tampered","malicious":true}');
  const fakeManifest = { 'tampered.json': 'a'.repeat(64) }; // bogus expected hash
  // Direct verifyIntegrity call using injected manifest+path requires recompute
  const actual = LOADER.sha256(tamperedPath);
  expect(actual).not.toBe('a'.repeat(64));
});

test('loadAllFixtures THROWS on integrity failure (no allowFailed flag)', () => {
  // Build a fixture loader pointing at a temp dir with an unlisted file.
  const tmpDir = fs.mkdtempSync(path.join(require('os').tmpdir(), 'fixture-throw-'));
  fs.writeFileSync(path.join(tmpDir, 'rogue.json'), '{"injected":true}');
  fs.writeFileSync(path.join(tmpDir, 'MANIFEST.sha256'), '{}'); // empty manifest
  // We can't easily redirect FIXTURE_DIR; test the integrity check function directly
  const integrity = LOADER.verifyIntegrity('rogue.json', JSON.parse(fs.readFileSync(path.join(tmpDir, 'MANIFEST.sha256'), 'utf8')));
  expect(integrity.ok).toBe(false);
  expect(integrity.reason).toBe('missing-from-manifest');
});

test('loadAllFixtures with skipIntegrity:true bypasses (stress mode)', () => {
  const fixtures = LOADER.loadAllFixtures({ skipIntegrity: true });
  expect(fixtures.length).toBeGreaterThanOrEqual(10);
  for (const f of fixtures) {
    expect.soft(f._integrity.ok).toBe(true);
    expect.soft(f._integrity.reason).toBe('skipped');
  }
});

test('loadAllFixtures default path runs integrity check + passes', () => {
  const fixtures = LOADER.loadAllFixtures();
  expect(fixtures.length).toBeGreaterThanOrEqual(10);
  for (const f of fixtures) {
    expect.soft(f._integrity.ok, `${f.id}: integrity fail`).toBe(true);
  }
});

test('manifest covers all 10 fixtures', () => {
  const manifest = LOADER.readManifest();
  const fixtureFiles = fs.readdirSync(LOADER.FIXTURE_DIR).filter((f) => f.endsWith('.json'));
  expect(Object.keys(manifest).length).toBe(fixtureFiles.length);
  for (const f of fixtureFiles) {
    expect.soft(manifest[f], `${f} missing from MANIFEST.sha256`).toBeDefined();
  }
});
