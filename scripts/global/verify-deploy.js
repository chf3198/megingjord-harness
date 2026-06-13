#!/usr/bin/env node
'use strict';
// verify-deploy.js (#2914): compare deployed runtime artifacts against a stored SHA-256 manifest.
// Exits 0 if all hashes match; exits 1 on any mismatch or missing file. Pre-deploy integrity check.
// Addresses Gap G-09, OWASP ASI07 + ASI10, EU AI Act Art.15.
const fs = require('node:fs');
const path = require('node:path');
const { hashFile, collectFiles, MANIFEST_DIR, TARGET_DIRS } = require('./deploy-manifest');

/**
 * Verify a target directory against a stored manifest.
 * @param {string} targetDir absolute path to deployed directory
 * @param {string} targetName logical name (e.g. 'copilot')
 * @param {{ manifestDir?: string }} opts
 * @returns {{ ok: boolean, mismatches: string[], missing: string[], extra: string[], manifest: object }}
 */
function verifyDeploy(targetDir, targetName, opts = {}) {
  const manifestDir = opts.manifestDir || MANIFEST_DIR;
  const manifestPath = path.join(manifestDir, `${targetName}.manifest.json`);

  if (!fs.existsSync(manifestPath)) {
    return { ok: false, mismatches: [], missing: [], extra: [], manifest: null,
      error: `no manifest found at ${manifestPath} — run deploy-manifest first` };
  }

  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  if (!manifest.entries || !Array.isArray(manifest.entries)) {
    return { ok: false, mismatches: [], missing: [], extra: [], manifest,
      error: 'manifest malformed: missing entries array' };
  }

  if (!fs.existsSync(targetDir)) {
    return { ok: false, mismatches: [], missing: manifest.entries.map((e) => e.path), extra: [], manifest,
      error: `target directory does not exist: ${targetDir}` };
  }

  const expectedMap = new Map(manifest.entries.map((e) => [e.path, e.sha256]));
  const actualFiles = collectFiles(targetDir);
  const actualMap = new Map(actualFiles.map((f) => [path.relative(targetDir, f), f]));

  const mismatches = [];
  const missing = [];
  for (const [relPath, expectedHash] of expectedMap) {
    if (!actualMap.has(relPath)) {
      missing.push(relPath);
    } else {
      const actualHash = hashFile(actualMap.get(relPath));
      if (actualHash !== expectedHash) mismatches.push(relPath);
    }
  }

  // Extra files present in target but not in manifest are noted (informational, not a failure)
  const extra = [];
  for (const relPath of actualMap.keys()) {
    if (!expectedMap.has(relPath)) extra.push(relPath);
  }

  const ok = mismatches.length === 0 && missing.length === 0;
  return { ok, mismatches, missing, extra, manifest };
}

if (require.main === module) {
  const [, , targetArg] = process.argv;
  const validTargets = Object.keys(TARGET_DIRS);
  if (!targetArg || !validTargets.includes(targetArg)) {
    console.error(`Usage: verify-deploy.js <${validTargets.join('|')}>`);
    process.exit(1);
  }
  const targetDir = TARGET_DIRS[targetArg];
  const result = verifyDeploy(targetDir, targetArg);

  if (result.error) {
    console.error(`verify-deploy [${targetArg}]: ${result.error}`);
    process.exit(1);
  }
  if (result.ok) {
    const count = result.manifest.file_count;
    console.log(`verify-deploy [${targetArg}]: OK — ${count} file(s) match manifest`);
    if (result.extra.length) {
      console.log(`  info: ${result.extra.length} extra file(s) not in manifest (not a failure)`);
    }
    process.exit(0);
  }
  console.error(`verify-deploy [${targetArg}]: INTEGRITY FAILURE`);
  for (const p of result.mismatches) console.error(`  HASH MISMATCH: ${p}`);
  for (const p of result.missing) console.error(`  MISSING:       ${p}`);
  process.exit(1);
}

module.exports = { verifyDeploy };
