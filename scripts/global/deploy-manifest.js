#!/usr/bin/env node
'use strict';
// deploy-manifest.js (#2914): generate SHA-256 manifest of deployed runtime artifacts.
// Addresses Gap G-09 (deploy artifact integrity / SLSA gap), OWASP ASI07 + ASI10.
// Manifests are stored in inventory/deploy-manifests/<target>.manifest.json (gitignored state).
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');

const MANIFEST_DIR = path.resolve(__dirname, '..', '..', 'inventory', 'deploy-manifests');

/**
 * Recursively collect all files under a directory, sorted for determinism.
 * @param {string} dir @returns {string[]} absolute paths
 */
function collectFiles(dir) {
  const results = [];
  const entries = fs.readdirSync(dir, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name));
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isSymbolicLink()) continue; // skip symlinks — not deployed content
    if (entry.isDirectory()) results.push(...collectFiles(full));
    else if (entry.isFile()) results.push(full);
  }
  return results;
}

/**
 * Compute SHA-256 hex digest of a file's contents.
 * @param {string} filePath @returns {string}
 */
function hashFile(filePath) {
  const content = fs.readFileSync(filePath);
  return crypto.createHash('sha256').update(content).digest('hex');
}

/**
 * Generate a manifest for all files in a target directory.
 * @param {string} targetDir absolute path to deployed directory
 * @param {string} targetName logical name (e.g. 'copilot', 'codex', 'claude')
 * @returns {{ target: string, generated_at: string, file_count: number, entries: object[] }}
 */
function generateManifest(targetDir, targetName) {
  if (!fs.existsSync(targetDir)) {
    throw new Error(`deploy-manifest: target directory does not exist: ${targetDir}`);
  }
  const files = collectFiles(targetDir);
  const entries = files.map((filePath) => ({
    path: path.relative(targetDir, filePath),
    sha256: hashFile(filePath),
  }));
  return {
    schema: 'deploy-manifest/v1',
    target: targetName,
    target_dir: targetDir,
    generated_at: new Date().toISOString(),
    file_count: entries.length,
    entries,
  };
}

/**
 * Write manifest JSON to inventory/deploy-manifests/<targetName>.manifest.json.
 * @param {string} targetName @param {object} manifest @returns {string} written path
 */
function writeManifest(targetName, manifest) {
  fs.mkdirSync(MANIFEST_DIR, { recursive: true });
  const outPath = path.join(MANIFEST_DIR, `${targetName}.manifest.json`);
  fs.writeFileSync(outPath, JSON.stringify(manifest, null, 2) + '\n', 'utf8');
  return outPath;
}

/**
 * Generate and persist a manifest for the given target directory.
 * @param {string} targetDir @param {string} targetName @returns {{ manifest: object, path: string }}
 */
function generateAndWrite(targetDir, targetName) {
  const manifest = generateManifest(targetDir, targetName);
  const outPath = writeManifest(targetName, manifest);
  return { manifest, path: outPath };
}

const TARGET_DIRS = {
  copilot: path.join(process.env.HOME || '/root', '.copilot'),
  codex: path.join(process.env.HOME || '/root', '.codex'),
  claude: path.join(process.env.HOME || '/root', '.claude'),
};

if (require.main === module) {
  const [, , targetArg] = process.argv;
  const validTargets = Object.keys(TARGET_DIRS);
  if (!targetArg || !validTargets.includes(targetArg)) {
    console.error(`Usage: deploy-manifest.js <${validTargets.join('|')}>`);
    process.exit(1);
  }
  const targetDir = TARGET_DIRS[targetArg];
  try {
    const { manifest, path: outPath } = generateAndWrite(targetDir, targetArg);
    console.log(`deploy-manifest: generated ${manifest.file_count} entries → ${outPath}`);
  } catch (err) {
    console.error(`deploy-manifest: error: ${err.message}`);
    process.exit(1);
  }
}

module.exports = { generateManifest, writeManifest, generateAndWrite, collectFiles, hashFile, MANIFEST_DIR, TARGET_DIRS };
