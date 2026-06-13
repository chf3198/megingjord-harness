'use strict';
// tests/deploy-integrity.spec.js (#2914): tdd-pyramid tests for deploy-manifest + verify-deploy.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const crypto = require('node:crypto');

const { generateManifest, writeManifest, collectFiles, hashFile, generateAndWrite } =
  require('../scripts/global/deploy-manifest');
const { verifyDeploy } = require('../scripts/global/verify-deploy');

function makeTmpDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'deploy-integrity-'));
}

function writeFile(dir, relPath, content) {
  const full = path.join(dir, relPath);
  fs.mkdirSync(path.dirname(full), { recursive: true });
  fs.writeFileSync(full, content, 'utf8');
  return full;
}

// ── collectFiles ───────────────────────────────────────────────────────────────

test('collectFiles returns sorted file list', () => {
  const tmp = makeTmpDir();
  writeFile(tmp, 'b.js', 'b');
  writeFile(tmp, 'a.js', 'a');
  writeFile(tmp, 'sub/c.js', 'c');
  const files = collectFiles(tmp);
  const names = files.map((f) => path.relative(tmp, f));
  assert.deepEqual(names, ['a.js', 'b.js', 'sub/c.js']);
});

test('collectFiles skips symlinks', () => {
  const tmp = makeTmpDir();
  writeFile(tmp, 'real.js', 'real');
  fs.symlinkSync(path.join(tmp, 'real.js'), path.join(tmp, 'link.js'));
  const files = collectFiles(tmp);
  const names = files.map((f) => path.basename(f));
  assert.ok(!names.includes('link.js'), 'symlinks must be excluded');
  assert.ok(names.includes('real.js'));
});

// ── hashFile ──────────────────────────────────────────────────────────────────

test('hashFile produces correct SHA-256', () => {
  const tmp = makeTmpDir();
  const content = 'hello deploy integrity';
  const filePath = writeFile(tmp, 'test.txt', content);
  const expected = crypto.createHash('sha256').update(content, 'utf8').digest('hex');
  assert.equal(hashFile(filePath), expected);
});

// ── generateManifest ──────────────────────────────────────────────────────────

test('generateManifest produces correct schema and entry count', () => {
  const tmp = makeTmpDir();
  writeFile(tmp, 'hooks/hook.sh', '#!/bin/bash');
  writeFile(tmp, 'scripts/run.js', 'console.log(1)');
  const manifest = generateManifest(tmp, 'copilot');
  assert.equal(manifest.schema, 'deploy-manifest/v1');
  assert.equal(manifest.target, 'copilot');
  assert.equal(manifest.file_count, 2);
  assert.equal(manifest.entries.length, 2);
  assert.ok(manifest.generated_at);
  const paths = manifest.entries.map((e) => e.path);
  assert.ok(paths.includes('hooks/hook.sh'));
  assert.ok(paths.includes('scripts/run.js'));
});

test('generateManifest throws on missing directory', () => {
  assert.throws(
    () => generateManifest('/nonexistent/path/that/does/not/exist', 'copilot'),
    /does not exist/,
  );
});

test('generateManifest entries each have sha256 field', () => {
  const tmp = makeTmpDir();
  writeFile(tmp, 'file.txt', 'content');
  const manifest = generateManifest(tmp, 'copilot');
  for (const entry of manifest.entries) {
    assert.ok(entry.sha256, `entry ${entry.path} missing sha256`);
    assert.match(entry.sha256, /^[0-9a-f]{64}$/);
  }
});

// ── writeManifest + generateAndWrite ─────────────────────────────────────────

test('writeManifest writes valid JSON to expected path', () => {
  const tmp = makeTmpDir();
  const manifestDir = path.join(tmp, 'manifests');
  const targetDir = path.join(tmp, 'target');
  writeFile(targetDir, 'a.js', 'a');
  const manifest = generateManifest(targetDir, 'codex');
  // Use internal write with override
  fs.mkdirSync(manifestDir, { recursive: true });
  const outPath = path.join(manifestDir, 'codex.manifest.json');
  fs.writeFileSync(outPath, JSON.stringify(manifest, null, 2) + '\n', 'utf8');
  const parsed = JSON.parse(fs.readFileSync(outPath, 'utf8'));
  assert.equal(parsed.target, 'codex');
  assert.equal(parsed.file_count, 1);
});

// ── verifyDeploy: happy path ──────────────────────────────────────────────────

test('verifyDeploy passes when files match manifest', () => {
  const tmp = makeTmpDir();
  const targetDir = path.join(tmp, 'target');
  const manifestDir = path.join(tmp, 'manifests');
  writeFile(targetDir, 'scripts/run.js', 'console.log(1)');
  const manifest = generateManifest(targetDir, 'copilot');
  fs.mkdirSync(manifestDir, { recursive: true });
  fs.writeFileSync(path.join(manifestDir, 'copilot.manifest.json'), JSON.stringify(manifest, null, 2));
  const result = verifyDeploy(targetDir, 'copilot', { manifestDir });
  assert.ok(result.ok, `expected ok but got mismatches=${result.mismatches} missing=${result.missing}`);
  assert.equal(result.mismatches.length, 0);
  assert.equal(result.missing.length, 0);
});

// ── verifyDeploy: hash mismatch ───────────────────────────────────────────────

test('verifyDeploy detects tampered file (hash mismatch)', () => {
  const tmp = makeTmpDir();
  const targetDir = path.join(tmp, 'target');
  const manifestDir = path.join(tmp, 'manifests');
  writeFile(targetDir, 'hook.sh', 'original content');
  const manifest = generateManifest(targetDir, 'copilot');
  fs.mkdirSync(manifestDir, { recursive: true });
  fs.writeFileSync(path.join(manifestDir, 'copilot.manifest.json'), JSON.stringify(manifest, null, 2));
  // Tamper the deployed file
  fs.writeFileSync(path.join(targetDir, 'hook.sh'), 'malicious content', 'utf8');
  const result = verifyDeploy(targetDir, 'copilot', { manifestDir });
  assert.ok(!result.ok);
  assert.ok(result.mismatches.includes('hook.sh'), 'tampered file must appear in mismatches');
});

// ── verifyDeploy: missing file ────────────────────────────────────────────────

test('verifyDeploy detects deleted file', () => {
  const tmp = makeTmpDir();
  const targetDir = path.join(tmp, 'target');
  const manifestDir = path.join(tmp, 'manifests');
  writeFile(targetDir, 'required.js', 'needed');
  const manifest = generateManifest(targetDir, 'copilot');
  fs.mkdirSync(manifestDir, { recursive: true });
  fs.writeFileSync(path.join(manifestDir, 'copilot.manifest.json'), JSON.stringify(manifest, null, 2));
  // Delete the file from the target
  fs.unlinkSync(path.join(targetDir, 'required.js'));
  const result = verifyDeploy(targetDir, 'copilot', { manifestDir });
  assert.ok(!result.ok);
  assert.ok(result.missing.includes('required.js'));
});

// ── verifyDeploy: no manifest ─────────────────────────────────────────────────

test('verifyDeploy returns error when no manifest exists', () => {
  const tmp = makeTmpDir();
  const targetDir = path.join(tmp, 'target');
  const manifestDir = path.join(tmp, 'empty-manifests');
  writeFile(targetDir, 'file.js', 'x');
  const result = verifyDeploy(targetDir, 'copilot', { manifestDir });
  assert.ok(!result.ok);
  assert.ok(result.error, 'should report error when manifest missing');
  assert.match(result.error, /no manifest found/);
});

// ── verifyDeploy: extra files are non-fatal ───────────────────────────────────

test('verifyDeploy allows extra files not in manifest (non-fatal)', () => {
  const tmp = makeTmpDir();
  const targetDir = path.join(tmp, 'target');
  const manifestDir = path.join(tmp, 'manifests');
  writeFile(targetDir, 'tracked.js', 'tracked');
  const manifest = generateManifest(targetDir, 'copilot');
  fs.mkdirSync(manifestDir, { recursive: true });
  fs.writeFileSync(path.join(manifestDir, 'copilot.manifest.json'), JSON.stringify(manifest, null, 2));
  // Add an extra file after manifest generation
  writeFile(targetDir, 'extra.js', 'extra');
  const result = verifyDeploy(targetDir, 'copilot', { manifestDir });
  assert.ok(result.ok, 'extra files should not fail verification');
  assert.ok(result.extra.includes('extra.js'));
});

// ── verifyDeploy: missing target directory ────────────────────────────────────

test('verifyDeploy errors when target directory missing', () => {
  const tmp = makeTmpDir();
  const manifestDir = path.join(tmp, 'manifests');
  fs.mkdirSync(manifestDir, { recursive: true });
  // Write a fake manifest pointing to a non-existent target
  const fakeManifest = { schema: 'deploy-manifest/v1', target: 'copilot',
    generated_at: new Date().toISOString(), file_count: 1,
    entries: [{ path: 'file.js', sha256: 'abc' }] };
  fs.writeFileSync(path.join(manifestDir, 'copilot.manifest.json'), JSON.stringify(fakeManifest));
  const result = verifyDeploy('/nonexistent/deploy/target', 'copilot', { manifestDir });
  assert.ok(!result.ok);
  assert.ok(result.error || result.missing.length > 0);
});
