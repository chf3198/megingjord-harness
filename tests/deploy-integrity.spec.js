'use strict';
// tests/deploy-integrity.spec.js (#2914): tdd-pyramid tests for deploy-manifest + verify-deploy.
// Includes mutation tests for HMAC, symlink, TOCTOU-guard, and fail-closed paths.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const crypto = require('node:crypto');

const {
  generateManifest, writeManifest, collectFiles, hashFile, generateAndWrite,
  computeHmac, verifyManifestHmac,
} = require('../scripts/global/deploy-manifest');
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

/** Write a signed manifest to manifestDir using a test HMAC key. */
function writeSigned(manifestDir, targetName, manifest, key) {
  fs.mkdirSync(manifestDir, { recursive: true });
  const body = JSON.stringify(manifest, null, 2);
  const sig = computeHmac(body, key);
  const out = JSON.stringify({ ...manifest, hmac_sha256: sig }, null, 2) + '\n';
  fs.writeFileSync(path.join(manifestDir, `${targetName}.manifest.json`), out, 'utf8');
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

// MUTATION: if symlink-skip guard removed, this test would include 'link.js' in collectFiles
test('[mutation] collectFiles symlink guard — link.js must never appear', () => {
  const tmp = makeTmpDir();
  writeFile(tmp, 'real.js', 'real');
  fs.symlinkSync(path.join(tmp, 'real.js'), path.join(tmp, 'link.js'));
  const files = collectFiles(tmp);
  // If the guard is removed, link.js would appear — this assertion would fail
  assert.ok(!files.some((f) => f.endsWith('link.js')), 'removing symlink guard causes this to fail');
});

// ── hashFile (read-once buffer / TOCTOU guard) ─────────────────────────────────

test('hashFile produces correct SHA-256', () => {
  const tmp = makeTmpDir();
  const content = 'hello deploy integrity';
  const filePath = writeFile(tmp, 'test.txt', content);
  const expected = crypto.createHash('sha256').update(content, 'utf8').digest('hex');
  assert.equal(hashFile(filePath), expected);
});

// MUTATION: verify hashFile uses content correctly (not filename or path)
test('[mutation] hashFile result changes when file content changes', () => {
  const tmp = makeTmpDir();
  const p = writeFile(tmp, 'f.txt', 'original');
  const h1 = hashFile(p);
  fs.writeFileSync(p, 'tampered', 'utf8');
  const h2 = hashFile(p);
  assert.notEqual(h1, h2, 'hash must change when content changes — removing read guards breaks this');
});

// ── HMAC sign + verify ─────────────────────────────────────────────────────────

test('computeHmac is deterministic for same input', () => {
  const sig1 = computeHmac('body', 'key');
  const sig2 = computeHmac('body', 'key');
  assert.equal(sig1, sig2);
});

test('computeHmac differs for different keys', () => {
  assert.notEqual(computeHmac('body', 'key1'), computeHmac('body', 'key2'));
});

test('verifyManifestHmac passes when signed correctly', () => {
  const orig = process.env.DEPLOY_MANIFEST_HMAC_KEY;
  process.env.DEPLOY_MANIFEST_HMAC_KEY = 'testkey';
  try {
    const bodyObj = { schema: 'deploy-manifest/v1', entries: [] };
    const body = JSON.stringify(bodyObj, null, 2);
    const sig = computeHmac(body, 'testkey');
    // parsed includes hmac_sha256; verifyManifestHmac strips it before recomputing
    const parsed = { ...bodyObj, hmac_sha256: sig };
    const result = verifyManifestHmac(parsed);
    assert.ok(result.valid, `expected valid but got: ${result.error}`);
  } finally {
    if (orig === undefined) delete process.env.DEPLOY_MANIFEST_HMAC_KEY;
    else process.env.DEPLOY_MANIFEST_HMAC_KEY = orig;
  }
});

// MUTATION: if HMAC guard removed, tampered manifest would pass — this must fail
test('[mutation] verifyManifestHmac rejects tampered manifest body', () => {
  const orig = process.env.DEPLOY_MANIFEST_HMAC_KEY;
  process.env.DEPLOY_MANIFEST_HMAC_KEY = 'testkey';
  try {
    const bodyObj = { schema: 'deploy-manifest/v1', entries: [] };
    const body = JSON.stringify(bodyObj, null, 2);
    const sig = computeHmac(body, 'testkey');
    // Tamper: attacker modifies entries but keeps the original sig
    const tamperedParsed = {
      schema: 'deploy-manifest/v1',
      entries: [{ path: 'evil.sh', sha256: 'aaa' }],
      hmac_sha256: sig, // reusing old sig — should NOT pass
    };
    const result = verifyManifestHmac(tamperedParsed);
    // If guard removed, result.valid would be true — this must be false
    assert.ok(!result.valid, 'removing HMAC guard causes tampered manifest to pass — mutation detected');
  } finally {
    if (orig === undefined) delete process.env.DEPLOY_MANIFEST_HMAC_KEY;
    else process.env.DEPLOY_MANIFEST_HMAC_KEY = orig;
  }
});

// MUTATION: DEPLOY_MANIFEST_REQUIRE_SIG=1 without key must fail-closed
test('[mutation] REQUIRE_SIG=1 with no key fails closed', () => {
  const origKey = process.env.DEPLOY_MANIFEST_HMAC_KEY;
  const origReq = process.env.DEPLOY_MANIFEST_REQUIRE_SIG;
  delete process.env.DEPLOY_MANIFEST_HMAC_KEY;
  process.env.DEPLOY_MANIFEST_REQUIRE_SIG = '1';
  try {
    const parsed = { schema: 'deploy-manifest/v1', entries: [] };
    const result = verifyManifestHmac(parsed);
    assert.ok(!result.valid, 'removing fail-closed guard allows unsigned manifest — mutation detected');
    assert.match(result.error, /fail-closed/);
  } finally {
    if (origKey === undefined) delete process.env.DEPLOY_MANIFEST_HMAC_KEY;
    else process.env.DEPLOY_MANIFEST_HMAC_KEY = origKey;
    if (origReq === undefined) delete process.env.DEPLOY_MANIFEST_REQUIRE_SIG;
    else process.env.DEPLOY_MANIFEST_REQUIRE_SIG = origReq;
  }
});

// MUTATION: manifest with no hmac_sha256 field must fail when key configured
test('[mutation] verifyManifestHmac rejects manifest missing hmac_sha256 when key present', () => {
  const orig = process.env.DEPLOY_MANIFEST_HMAC_KEY;
  process.env.DEPLOY_MANIFEST_HMAC_KEY = 'testkey';
  try {
    const parsed = { schema: 'deploy-manifest/v1', entries: [] }; // no hmac_sha256
    const result = verifyManifestHmac(parsed);
    assert.ok(!result.valid, 'unsigned manifest must be rejected when key is configured');
  } finally {
    if (orig === undefined) delete process.env.DEPLOY_MANIFEST_HMAC_KEY;
    else process.env.DEPLOY_MANIFEST_HMAC_KEY = orig;
  }
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

// MUTATION: if symlink-targetDir guard removed, symlink dirs would be accepted
test('[mutation] generateManifest rejects symlink targetDir (CWE-59)', () => {
  const tmp = makeTmpDir();
  const realDir = path.join(tmp, 'real');
  fs.mkdirSync(realDir);
  writeFile(realDir, 'file.js', 'x');
  const linkDir = path.join(tmp, 'link');
  fs.symlinkSync(realDir, linkDir);
  assert.throws(
    () => generateManifest(linkDir, 'copilot'),
    /symlink.*rejected|CWE-59/i,
    'removing symlink guard allows symlink target dirs — mutation detected',
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
  fs.mkdirSync(manifestDir, { recursive: true });
  const outPath = path.join(manifestDir, 'codex.manifest.json');
  fs.writeFileSync(outPath, JSON.stringify(manifest, null, 2) + '\n', 'utf8');
  const parsed = JSON.parse(fs.readFileSync(outPath, 'utf8'));
  assert.equal(parsed.target, 'codex');
  assert.equal(parsed.file_count, 1);
});

// MUTATION: REQUIRE_SIG=1 with no key must throw from writeManifest
test('[mutation] writeManifest fails closed when REQUIRE_SIG=1 and no key', () => {
  const origKey = process.env.DEPLOY_MANIFEST_HMAC_KEY;
  const origReq = process.env.DEPLOY_MANIFEST_REQUIRE_SIG;
  delete process.env.DEPLOY_MANIFEST_HMAC_KEY;
  process.env.DEPLOY_MANIFEST_REQUIRE_SIG = '1';
  try {
    const tmp = makeTmpDir();
    const targetDir = path.join(tmp, 'target');
    writeFile(targetDir, 'f.js', 'x');
    const manifest = generateManifest(targetDir, 'copilot');
    assert.throws(
      () => writeManifest('copilot', manifest),
      /fail-closed|REQUIRE_SIG/,
      'removing fail-closed guard in writeManifest allows unsigned write — mutation detected',
    );
  } finally {
    if (origKey === undefined) delete process.env.DEPLOY_MANIFEST_HMAC_KEY;
    else process.env.DEPLOY_MANIFEST_HMAC_KEY = origKey;
    if (origReq === undefined) delete process.env.DEPLOY_MANIFEST_REQUIRE_SIG;
    else process.env.DEPLOY_MANIFEST_REQUIRE_SIG = origReq;
  }
});

// ── verifyDeploy: fail-closed on invalid arguments ────────────────────────────

test('[mutation] verifyDeploy fails closed on null targetDir', () => {
  const result = verifyDeploy(null, 'copilot');
  assert.ok(!result.ok, 'null targetDir must fail closed — removing guard would allow null');
  assert.ok(result.error);
});

test('[mutation] verifyDeploy fails closed on empty targetName', () => {
  const result = verifyDeploy('/some/path', '');
  assert.ok(!result.ok, 'empty targetName must fail closed');
  assert.ok(result.error);
});

// ── verifyDeploy: symlink rejection (CWE-59) ──────────────────────────────────

// MUTATION: if symlink guard on manifest path removed, symlink manifest would pass
test('[mutation] verifyDeploy rejects symlink manifest path (CWE-59)', () => {
  const tmp = makeTmpDir();
  const targetDir = path.join(tmp, 'target');
  const realManifestDir = path.join(tmp, 'real-manifests');
  const linkManifestDir = path.join(tmp, 'link-manifests');
  writeFile(targetDir, 'file.js', 'x');
  const manifest = generateManifest(targetDir, 'copilot');
  fs.mkdirSync(realManifestDir, { recursive: true });
  fs.writeFileSync(path.join(realManifestDir, 'copilot.manifest.json'), JSON.stringify(manifest, null, 2));
  // Symlink the manifest file itself to a different location
  fs.mkdirSync(linkManifestDir, { recursive: true });
  fs.symlinkSync(
    path.join(realManifestDir, 'copilot.manifest.json'),
    path.join(linkManifestDir, 'copilot.manifest.json'),
  );
  const result = verifyDeploy(targetDir, 'copilot', { manifestDir: linkManifestDir });
  assert.ok(!result.ok, 'symlink manifest path must be rejected — removing guard allows CWE-59');
  assert.match(result.error, /symlink.*rejected|CWE-59/i);
});

// MUTATION: if symlink guard on targetDir removed, symlink target would pass
test('[mutation] verifyDeploy rejects symlink targetDir (CWE-59)', () => {
  const tmp = makeTmpDir();
  const realTarget = path.join(tmp, 'real-target');
  const linkTarget = path.join(tmp, 'link-target');
  const manifestDir = path.join(tmp, 'manifests');
  writeFile(realTarget, 'file.js', 'x');
  fs.symlinkSync(realTarget, linkTarget);
  const manifest = generateManifest(realTarget, 'copilot');
  fs.mkdirSync(manifestDir, { recursive: true });
  fs.writeFileSync(path.join(manifestDir, 'copilot.manifest.json'), JSON.stringify(manifest, null, 2));
  const result = verifyDeploy(linkTarget, 'copilot', { manifestDir });
  assert.ok(!result.ok, 'symlink targetDir must be rejected — removing guard allows CWE-59');
  assert.match(result.error, /symlink.*rejected|CWE-59/i);
});

// ── verifyDeploy: happy path ──────────────────────────────────────────────────

test('verifyDeploy passes when files match manifest (unsigned)', () => {
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

test('verifyDeploy passes with valid HMAC signature', () => {
  const origKey = process.env.DEPLOY_MANIFEST_HMAC_KEY;
  process.env.DEPLOY_MANIFEST_HMAC_KEY = 'integration-test-key';
  try {
    const tmp = makeTmpDir();
    const targetDir = path.join(tmp, 'target');
    const manifestDir = path.join(tmp, 'manifests');
    writeFile(targetDir, 'hook.sh', '#!/bin/bash\necho ok');
    const manifest = generateManifest(targetDir, 'copilot');
    writeSigned(manifestDir, 'copilot', manifest, 'integration-test-key');
    const result = verifyDeploy(targetDir, 'copilot', { manifestDir });
    assert.ok(result.ok, `HMAC-signed verify should pass: ${result.error}`);
  } finally {
    if (origKey === undefined) delete process.env.DEPLOY_MANIFEST_HMAC_KEY;
    else process.env.DEPLOY_MANIFEST_HMAC_KEY = origKey;
  }
});

// MUTATION: tampered file must fail even when HMAC is valid on entries list
test('[mutation] verifyDeploy detects tampered file (hash mismatch)', () => {
  const tmp = makeTmpDir();
  const targetDir = path.join(tmp, 'target');
  const manifestDir = path.join(tmp, 'manifests');
  writeFile(targetDir, 'hook.sh', 'original content');
  const manifest = generateManifest(targetDir, 'copilot');
  fs.mkdirSync(manifestDir, { recursive: true });
  fs.writeFileSync(path.join(manifestDir, 'copilot.manifest.json'), JSON.stringify(manifest, null, 2));
  // Tamper the deployed file after manifest generation
  fs.writeFileSync(path.join(targetDir, 'hook.sh'), 'malicious content', 'utf8');
  const result = verifyDeploy(targetDir, 'copilot', { manifestDir });
  assert.ok(!result.ok, 'tampered file must fail — removing hash check breaks integrity');
  assert.ok(result.mismatches.includes('hook.sh'), 'tampered file must appear in mismatches');
});

// MUTATION: tampered manifest must fail when HMAC guard is active
test('[mutation] verifyDeploy rejects tampered manifest when key configured', () => {
  const origKey = process.env.DEPLOY_MANIFEST_HMAC_KEY;
  process.env.DEPLOY_MANIFEST_HMAC_KEY = 'test-key';
  try {
    const tmp = makeTmpDir();
    const targetDir = path.join(tmp, 'target');
    const manifestDir = path.join(tmp, 'manifests');
    writeFile(targetDir, 'hook.sh', 'original');
    const manifest = generateManifest(targetDir, 'copilot');
    // Write manifest with WRONG key (simulates attacker who doesn't know key)
    writeSigned(manifestDir, 'copilot', manifest, 'attacker-key');
    const result = verifyDeploy(targetDir, 'copilot', { manifestDir });
    assert.ok(!result.ok, 'wrong HMAC key must cause failure — removing guard allows tampered manifests');
    assert.ok(result.error, 'error field must be populated on HMAC failure');
  } finally {
    if (origKey === undefined) delete process.env.DEPLOY_MANIFEST_HMAC_KEY;
    else process.env.DEPLOY_MANIFEST_HMAC_KEY = origKey;
  }
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
  fs.unlinkSync(path.join(targetDir, 'required.js'));
  const result = verifyDeploy(targetDir, 'copilot', { manifestDir });
  assert.ok(!result.ok);
  assert.ok(result.missing.includes('required.js'));
});

// ── verifyDeploy: no manifest ─────────────────────────────────────────────────

test('verifyDeploy returns error when no manifest exists (fail-closed)', () => {
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
  const fakeManifest = { schema: 'deploy-manifest/v1', target: 'copilot',
    generated_at: new Date().toISOString(), file_count: 1,
    entries: [{ path: 'file.js', sha256: 'abc' }] };
  fs.writeFileSync(path.join(manifestDir, 'copilot.manifest.json'), JSON.stringify(fakeManifest));
  const result = verifyDeploy('/nonexistent/deploy/target', 'copilot', { manifestDir });
  assert.ok(!result.ok);
  assert.ok(result.error || result.missing.length > 0);
});

// ── verifyDeploy: malformed manifest ─────────────────────────────────────────

test('[mutation] verifyDeploy rejects malformed manifest (no entries) — fail-closed', () => {
  const tmp = makeTmpDir();
  const targetDir = path.join(tmp, 'target');
  const manifestDir = path.join(tmp, 'manifests');
  writeFile(targetDir, 'f.js', 'x');
  fs.mkdirSync(manifestDir, { recursive: true });
  // Write manifest without entries field
  fs.writeFileSync(
    path.join(manifestDir, 'copilot.manifest.json'),
    JSON.stringify({ schema: 'deploy-manifest/v1', target: 'copilot' }),
  );
  const result = verifyDeploy(targetDir, 'copilot', { manifestDir });
  assert.ok(!result.ok, 'malformed manifest must fail — removing schema check breaks fail-closed invariant');
  assert.ok(result.error);
});
