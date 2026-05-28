#!/usr/bin/env node
// scripts/wiki/sign-frontmatter.js — Attach Ed25519 trust_attestation to wiki page.
// Generates ephemeral key pair, signs body hash, writes trust_attestation block.
// For production use, supply --key-file <private-key.pem> to use a persistent key.
// CommonJS; Refs #2052
'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const matter = require('gray-matter');

/**
 * Compute SHA-256 hex digest of a string.
 * @param {string} text - input text
 * @returns {string} hex digest
 */
function sha256Hex(text) {
  return crypto.createHash('sha256').update(text).digest('hex');
}

/**
 * Sign the body of a wiki page and return the attestation object.
 * @param {string} body - markdown body (post-frontmatter content)
 * @param {crypto.KeyObject} privateKey - Ed25519 private key
 * @param {string} signer - signer identity string
 * @returns {{ algorithm: string, signer: string, signature_b64: string, signed_payload_hash: string }}
 */
function buildAttestation(body, privateKey, signer) {
  const signed_payload_hash = sha256Hex(body);
  const payloadBuf = Buffer.from(signed_payload_hash, 'hex');
  const sigBuf = crypto.sign(null, payloadBuf, privateKey);
  return {
    algorithm: 'ed25519',
    signer,
    signature_b64: sigBuf.toString('base64'),
    signed_payload_hash,
  };
}

/**
 * Load an Ed25519 private key from a PEM file.
 * @param {string} keyPath - path to PEM file
 * @returns {crypto.KeyObject}
 */
function loadPrivateKey(keyPath) {
  const pem = fs.readFileSync(keyPath, 'utf-8');
  return crypto.createPrivateKey(pem);
}

/**
 * Sign a wiki markdown file in-place with an Ed25519 trust_attestation block.
 * @param {string} filePath - path to markdown file
 * @param {{ keyFile?: string, signer?: string }} [opts] - options
 * @returns {{ filePath: string, signed_payload_hash: string, signer: string }}
 */
function signFile(filePath, opts = {}) {
  const raw = fs.readFileSync(filePath, 'utf-8');
  const { data: fm, content: body } = matter(raw);

  let privateKey;
  let signerIdentity;
  if (opts.keyFile) {
    privateKey = loadPrivateKey(opts.keyFile);
    const pubKey = crypto.createPublicKey(privateKey);
    const rawPub = pubKey.export({ format: 'der', type: 'spki' }).slice(12).toString('hex');
    signerIdentity = opts.signer || rawPub;
  } else {
    const kp = crypto.generateKeyPairSync('ed25519');
    privateKey = kp.privateKey;
    const rawPub = kp.publicKey.export({ format: 'der', type: 'spki' }).slice(12).toString('hex');
    signerIdentity = opts.signer || rawPub;
  }

  fm.trust_attestation = buildAttestation(body, privateKey, signerIdentity);
  const updated = matter.stringify(body, fm);
  fs.writeFileSync(filePath, updated);
  return { filePath, signed_payload_hash: fm.trust_attestation.signed_payload_hash, signer: signerIdentity };
}

module.exports = { signFile, buildAttestation, loadPrivateKey, sha256Hex };

if (require.main === module) {
  const args = process.argv.slice(2);
  const target = args.find((a) => !a.startsWith('--'));
  const keyFlag = args.indexOf('--key-file');
  const signerFlag = args.indexOf('--signer');
  if (!target) { console.error('Usage: sign-frontmatter.js <file.md> [--key-file <pem>] [--signer <id>]'); process.exit(1); }
  const opts = {};
  if (keyFlag !== -1) opts.keyFile = args[keyFlag + 1];
  if (signerFlag !== -1) opts.signer = args[signerFlag + 1];
  const result = signFile(path.resolve(target), opts);
  console.log(`✅ Signed ${result.filePath}`);
  console.log(`   signer: ${result.signer}`);
  console.log(`   payload_hash: ${result.signed_payload_hash}`);
}
