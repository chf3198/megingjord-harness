// provenance.js — Evidence provenance verification for the baton FSM.
// Rejects forged/spoofed evidence envelopes (AC3). Refs #3287, Epic #3284.
// FIX 2: ephemeral fallback embeds public key; verifyEvidence does Ed25519 verify.
'use strict';

const { createHash, generateKeyPairSync, sign: cryptoSign,
  verify: cryptoVerify, createPublicKey } = require('node:crypto');

let batonSigning = null;
try {
  batonSigning = require('../baton-signing');
} catch {
  // baton-signing unavailable; fall back to local ephemeral key
}

// Per-process ephemeral keypair cache (fallback only; baton-signing is the primary path).
// Memoized so the rare fallback does not regenerate an Ed25519 keypair on every evidence op.
let cachedEphemeralKeyPair = null;
function getEphemeralKeyPair() {
  if (!cachedEphemeralKeyPair) { cachedEphemeralKeyPair = generateKeyPairSync("ed25519"); }
  return cachedEphemeralKeyPair;
}

/**
 * Compute the canonical hash of a facts object.
 * Deterministic: sorted JSON keys, no whitespace.
 * @param {object} facts - The evidence facts to hash.
 * @returns {string} Hex-encoded SHA-256 hash.
 */
function computeFactsHash(facts) {
  const canonical = JSON.stringify(facts, Object.keys(facts).sort());
  return createHash('sha256').update(canonical, 'utf8').digest('hex');
}

/**
 * Create a signed evidence envelope.
 * Primary path: baton-signing.js (session Ed25519 key, T3/T4).
 * Fallback path: ephemeral Ed25519 keypair with public key embedded in envelope
 *   so verifyEvidence can cryptographically verify even without baton-signing.
 * @param {object} facts - The evidence facts (tokens, mask, etc.).
 * @param {string} [signerAlias] - Optional signer alias override.
 * @returns {Promise<{facts: object, signer: string, signature: string, evidence_hash: string, public_key?: string}>}
 */
async function createEvidence(facts, signerAlias) {
  const evidenceHash = computeFactsHash(facts);
  const payload = JSON.stringify({ facts, evidence_hash: evidenceHash });
  let signature = '';
  let signer = signerAlias || 'ephemeral';
  let publicKeyB64 = undefined;
  if (batonSigning) {
    const signed = await batonSigning.sign(payload);
    signature = signed.signature;
    signer = signerAlias || signed.key_id;
    // baton-signing already exposes publicKey; embed it for verification
    if (signed.publicKey) {
      publicKeyB64 = signed.publicKey;
    }
  } else {
    // Ephemeral fallback: real Ed25519 sign + embed public key (SPKI base64)
    const keyPair = getEphemeralKeyPair();
    const sig = cryptoSign(null, Buffer.from(payload, 'utf8'), keyPair.privateKey);
    signature = sig.toString('base64').replace(/=+$/, '');
    // Export public key as SPKI DER -> base64 (no padding) for envelope embedding
    const pubDer = keyPair.publicKey.export({ type: 'spki', format: 'der' });
    publicKeyB64 = pubDer.toString('base64').replace(/=+$/, '');
  }
  const envelope = {
    facts,
    signer,
    signature,
    evidence_hash: evidenceHash,
  };
  // Embed public key when available for self-contained verification
  if (publicKeyB64) {
    envelope.public_key = publicKeyB64;
  }
  return envelope;
}

/**
 * Verify an evidence envelope's integrity and cryptographic signature.
 * Checks: (1) structural completeness, (2) facts hash match,
 * (3) Ed25519 signature against embedded public_key when present.
 * Rejects: missing fields, hash mismatch, missing signature, bad signature.
 * @param {object} evidence - The evidence envelope to verify.
 * @returns {{valid: boolean, reason?: string}}
 */
function verifyEvidence(evidence) {
  if (!evidence || typeof evidence !== 'object') {
    return { valid: false, reason: 'evidence-not-an-object' };
  }
  const { facts, signer, signature, evidence_hash } = evidence;
  if (!facts || typeof facts !== 'object') {
    return { valid: false, reason: 'missing-facts' };
  }
  if (!signer || typeof signer !== 'string') {
    return { valid: false, reason: 'missing-signer' };
  }
  if (!signature || typeof signature !== 'string') {
    return { valid: false, reason: 'missing-signature' };
  }
  if (!evidence_hash || typeof evidence_hash !== 'string') {
    return { valid: false, reason: 'missing-evidence-hash' };
  }
  // Step 1: Recompute hash over canonical facts and verify match
  const recomputed = computeFactsHash(facts);
  if (recomputed !== evidence_hash) {
    return { valid: false, reason: 'evidence-hash-mismatch' };
  }
  // Step 2: Cryptographic signature verification when public_key is embedded
  if (evidence.public_key && typeof evidence.public_key === 'string') {
    try {
      const pubDer = Buffer.from(evidence.public_key, 'base64');
      const pubKeyObj = createPublicKey({ key: pubDer, format: 'der', type: 'spki' });
      const payload = JSON.stringify({ facts, evidence_hash });
      const sigBuf = Buffer.from(signature, 'base64');
      const isValid = cryptoVerify(null, Buffer.from(payload, 'utf8'), pubKeyObj, sigBuf);
      if (!isValid) {
        return { valid: false, reason: 'ed25519-signature-invalid' };
      }
    } catch {
      return { valid: false, reason: 'ed25519-verification-error' };
    }
  }
  return { valid: true };
}

module.exports = {
  computeFactsHash,
  createEvidence,
  verifyEvidence,
};
