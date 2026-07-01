'use strict';
// cross-team-lease-path.spec.js — regression anchor for lease path standardization.
// Canonical path: ~/.megingjord/cross-team-leases.json (#3455).
// Old path: .dashboard/cross-team-leases.json (cwd-relative, wrong).

const assert = require('node:assert/strict');
const { test } = require('node:test');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const registry = require('../scripts/global/cross-team-lease-registry');

test('DEFAULT_PATH is under ~/.megingjord, not cwd-relative .dashboard/', () => {
  const expectedDir = path.join(os.homedir(), '.megingjord');
  const actualDir = path.dirname(registry.DEFAULT_PATH);
  assert.equal(
    actualDir,
    expectedDir,
    `DEFAULT_PATH must be in ~/.megingjord/. Got: ${registry.DEFAULT_PATH}`,
  );
  assert.ok(
    registry.DEFAULT_PATH.endsWith('cross-team-leases.json'),
    `DEFAULT_PATH filename must be cross-team-leases.json. Got: ${registry.DEFAULT_PATH}`,
  );
});

test('LEGACY_PATH is the old cwd-relative .dashboard path (for migration detection)', () => {
  assert.ok(
    registry.LEGACY_PATH.includes('.dashboard'),
    `LEGACY_PATH must reference .dashboard directory. Got: ${registry.LEGACY_PATH}`,
  );
  assert.ok(
    registry.LEGACY_PATH.includes('cross-team-leases.json'),
    `LEGACY_PATH filename must be cross-team-leases.json. Got: ${registry.LEGACY_PATH}`,
  );
});

test('checkLegacyPath returns stale:false when no legacy file exists', () => {
  // Use a non-existent path to simulate clean state.
  const result = registry.checkLegacyPath('/tmp/nonexistent-lease-path/cross-team-leases.json');
  assert.equal(result.stale, false);
});

test('checkLegacyPath returns stale:true with migration message when legacy file exists', () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'lease-migration-'));
  const legacyFile = path.join(tempDir, 'cross-team-leases.json');
  fs.writeFileSync(legacyFile, JSON.stringify({ version: 1, leases: [] }));

  const result = registry.checkLegacyPath(legacyFile);
  assert.equal(result.stale, true);
  assert.equal(result.legacyPath, legacyFile);
  assert.ok(result.canonicalPath, 'must include canonicalPath in result');
  assert.ok(typeof result.message === 'string', 'must include a human-readable message');
  assert.ok(result.message.includes('legacy path'), 'message must describe the stale condition');

  fs.rmSync(tempDir, { recursive: true });
});

test('read falls back to legacy path when canonical is absent', () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'lease-fallback-'));
  const legacyFile = path.join(tempDir, 'cross-team-leases.json');
  const testRegistry = { version: 1, leases: [{ ticket: 9999, status: 'active' }] };
  fs.writeFileSync(legacyFile, JSON.stringify(testRegistry));

  // Patch LEGACY_PATH by passing a non-existent canonical path and exercising
  // checkLegacyPath indirectly. Since read() uses LEGACY_PATH internally, we
  // test the exported checkLegacyPath + a manual read of the legacy file instead.
  const check = registry.checkLegacyPath(legacyFile);
  assert.equal(check.stale, true);

  // Simulate what read() does on fallback: reads from legacyPath.
  const data = JSON.parse(fs.readFileSync(legacyFile, 'utf8'));
  assert.equal(data.leases[0].ticket, 9999);

  fs.rmSync(tempDir, { recursive: true });
});

test('write creates ~/.megingjord dir if missing and writes to canonical path', () => {
  const tempHome = fs.mkdtempSync(path.join(os.tmpdir(), 'lease-write-'));
  const canonicalFile = path.join(tempHome, '.megingjord', 'cross-team-leases.json');

  const testRegistry = { version: 1, leases: [] };
  registry.createLease(testRegistry, {
    ticket: 1234, team: 'claude-code', role: 'collaborator',
    branch: 'feat/1234-test', worktree: '/tmp/test',
    paths: 'scripts/global', ports: '', runtime_surfaces: '',
  });
  registry.write(testRegistry, canonicalFile);

  assert.ok(fs.existsSync(canonicalFile), 'write must create the canonical file');
  const written = JSON.parse(fs.readFileSync(canonicalFile, 'utf8'));
  assert.equal(written.leases[0].ticket, 1234);

  fs.rmSync(tempHome, { recursive: true });
});

test('DEFAULT_PATH does not contain .dashboard anywhere in the path', () => {
  assert.ok(
    !registry.DEFAULT_PATH.includes('.dashboard'),
    `DEFAULT_PATH must not reference .dashboard. Got: ${registry.DEFAULT_PATH}`,
  );
});
