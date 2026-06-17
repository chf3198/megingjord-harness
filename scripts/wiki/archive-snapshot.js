#!/usr/bin/env node
// scripts/wiki/archive-snapshot.js — Tier-0 static archive of the Three-Wiki stores
// (#3067 AC4, Epic #3063). Publishes a static .zip of wiki/{code,work-log,wisdom} to
// wiki/archive/static/ with an Ed25519-signed SHA256 manifest, so a last-known-good
// snapshot survives a prolonged gh outage (the >48h ladder rung) and is verifiable
// offline. Signing reuses the sign-frontmatter Ed25519 primitives.
'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { execFileSync } = require('child_process');
const { buildAttestation } = require('./sign-frontmatter');

const ROOT = path.join(__dirname, '../..');
const STATIC_DIR = path.join(ROOT, 'wiki', 'archive', 'static');
const ARCHIVE_DIRS = ['wiki/code', 'wiki/work-log', 'wiki/wisdom'];
const ZIP_NAME = 'wiki-snapshot.zip';
const MANIFEST_NAME = 'wiki-snapshot.manifest.json';

function sha256Hex(buf) { return crypto.createHash('sha256').update(buf).digest('hex'); }

/** Raw 32-byte Ed25519 public key as hex (the trailing bytes of the SPKI DER). */
function publicKeyHex(pub) {
  return pub.export({ type: 'spki', format: 'der' }).subarray(-32).toString('hex');
}

/** Load a configured signing key, else generate an ephemeral one (G5/G6 — no secret required). */
function resolveKey(opts = {}) {
  const raw = opts.privateKeyPem || process.env.WIKI_ARCHIVE_SIGNING_KEY;
  if (raw) {
    const pem = fs.existsSync(raw) ? fs.readFileSync(raw, 'utf8') : raw;
    const priv = crypto.createPrivateKey(pem);
    return { priv, pub: crypto.createPublicKey(priv), ephemeral: false };
  }
  const { privateKey, publicKey } = crypto.generateKeyPairSync('ed25519');
  return { priv: privateKey, pub: publicKey, ephemeral: true };
}

/**
 * Build the signed manifest for a snapshot archive buffer. Pure (no FS) and testable.
 * @param {Buffer} zipBuffer the .zip bytes
 * @param {{signer?:string, privateKeyPem?:string, generatedAt?:string}} [opts]
 */
function buildManifest(zipBuffer, opts = {}) {
  const { priv, pub, ephemeral } = resolveKey(opts);
  const signer = opts.signer || (ephemeral ? 'wiki-archive-ephemeral' : 'wiki-archive');
  const attestation = buildAttestation(zipBuffer, priv, signer);
  return {
    schema: 'tier0-archive/1',
    generated_at: opts.generatedAt || new Date().toISOString(),
    algorithm: 'ed25519',
    ephemeral_key: ephemeral,
    public_key_hex: publicKeyHex(pub),
    files: [{ path: ZIP_NAME, sha256: attestation.signed_payload_hash }],
    attestation,
  };
}

/**
 * Verify a snapshot archive against its manifest (offline). Returns true when the
 * archive's sha256 matches and the Ed25519 signature checks out.
 * @param {Buffer} zipBuffer
 * @param {object} manifest
 */
function verifySnapshot(zipBuffer, manifest) {
  try {
    const expected = manifest.files[0].sha256;
    if (sha256Hex(zipBuffer) !== expected) return false;
    const pub = crypto.createPublicKey({
      key: Buffer.concat([Buffer.from('302a300506032b6570032100', 'hex'),
        Buffer.from(manifest.public_key_hex, 'hex')]),
      format: 'der', type: 'spki',
    });
    return crypto.verify(null, Buffer.from(expected, 'hex'), pub,
      Buffer.from(manifest.attestation.signature_b64, 'base64'));
  } catch { return false; }
}

/** Default zip builder — uses the `zip` CLI (present on ubuntu-latest). */
function defaultZipBuilder(zipPath) {
  if (fs.existsSync(zipPath)) fs.rmSync(zipPath);
  const present = ARCHIVE_DIRS.filter((d) => fs.existsSync(path.join(ROOT, d)));
  execFileSync('zip', ['-rqX', zipPath, ...present], { cwd: ROOT });
}

/**
 * Build and sign the Tier-0 snapshot. zipBuilder is injectable so tests need no `zip` CLI.
 * @param {{staticDir?:string, zipBuilder?:Function, dryRun?:boolean, signer?:string}} [opts]
 */
function snapshot(opts = {}) {
  const staticDir = opts.staticDir || STATIC_DIR;
  fs.mkdirSync(staticDir, { recursive: true });
  const zipPath = path.join(staticDir, ZIP_NAME);
  (opts.zipBuilder || defaultZipBuilder)(zipPath);
  const zipBuffer = fs.readFileSync(zipPath);
  const manifest = buildManifest(zipBuffer, opts);
  if (!opts.dryRun) fs.writeFileSync(path.join(staticDir, MANIFEST_NAME), JSON.stringify(manifest, null, 2));
  return { zipPath, manifestPath: path.join(staticDir, MANIFEST_NAME), sha256: manifest.files[0].sha256, manifest };
}

module.exports = {
  snapshot, buildManifest, verifySnapshot, publicKeyHex, sha256Hex,
  STATIC_DIR, ZIP_NAME, MANIFEST_NAME, ARCHIVE_DIRS,
};

if (require.main === module) {
  const res = snapshot({ dryRun: process.argv.includes('--dry-run') });
  console.log(`archive-snapshot: ${res.zipPath} sha256=${res.sha256.slice(0, 16)} (ephemeral=${res.manifest.ephemeral_key})`);
}
