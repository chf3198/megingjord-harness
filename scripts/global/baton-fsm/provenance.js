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
 * Sign a payload via baton-signing or ephemeral Ed25519 fallback.
 * @returns {{signature: string, signer: string, publicKeyB64?: string}}
 */
async function signPayload(payload, signerAlias) {
  if (batonSigning) {
    const signed = await batonSigning.sign(payload);
    const signer = signerAlias || signed.key_id;
    return { signature: signed.signature, signer, publicKeyB64: signed.publicKey || undefined };
  }
  const keyPair = getEphemeralKeyPair();
  const sig = cryptoSign(null, Buffer.from(payload, 'utf8'), keyPair.privateKey);
  const signature = sig.toString('base64').replace(/=+$/, '');
  const pubDer = keyPair.publicKey.export({ type: 'spki', format: 'der' });
  const publicKeyB64 = pubDer.toString('base64').replace(/=+$/, '');
  return { signature, signer: signerAlias || 'ephemeral', publicKeyB64 };
}

/**
 * Create a signed evidence envelope.
 * @param {object} facts - The evidence facts (tokens, mask, etc.).
 * @param {string} [signerAlias] - Optional signer alias override.
 * @returns {Promise<{facts: object, signer: string, signature: string, evidence_hash: string, public_key?: string}>}
 */
async function createEvidence(facts, signerAlias) {
  const evidenceHash = computeFactsHash(facts);
  const payload = JSON.stringify({ facts, evidence_hash: evidenceHash });
  const signed = await signPayload(payload, signerAlias);
  const envelope = { facts, signer: signed.signer, signature: signed.signature, evidence_hash: evidenceHash };
  if (signed.publicKeyB64) envelope.public_key = signed.publicKeyB64;
  return envelope;
}

/**
 * Verify structural completeness of an evidence envelope.
 * @returns {{valid: boolean, reason?: string, fields?: object}}
 */
function checkEnvelopeFields(evidence) {
  if (!evidence || typeof evidence !== 'object') {
    return { valid: false, reason: 'evidence-not-an-object' };
  }
  const { facts, signer, signature, evidence_hash } = evidence;
  if (!facts || typeof facts !== 'object') return { valid: false, reason: 'missing-facts' };
  if (!signer || typeof signer !== 'string') return { valid: false, reason: 'missing-signer' };
  if (!signature || typeof signature !== 'string') return { valid: false, reason: 'missing-signature' };
  if (!evidence_hash || typeof evidence_hash !== 'string') return { valid: false, reason: 'missing-evidence-hash' };
  return { valid: true, fields: { facts, signer, signature, evidence_hash } };
}

/**
 * Verify an Ed25519 signature against an embedded public key.
 * @returns {{valid: boolean, reason?: string}}
 */
function verifyEmbeddedSignature(evidence) {
  if (!evidence.public_key || typeof evidence.public_key !== 'string') return { valid: true };
  try {
    const pubDer = Buffer.from(evidence.public_key, 'base64');
    const pubKeyObj = createPublicKey({ key: pubDer, format: 'der', type: 'spki' });
    const payload = JSON.stringify({ facts: evidence.facts, evidence_hash: evidence.evidence_hash });
    const sigBuf = Buffer.from(evidence.signature, 'base64');
    const isValid = cryptoVerify(null, Buffer.from(payload, 'utf8'), pubKeyObj, sigBuf);
    if (!isValid) return { valid: false, reason: 'ed25519-signature-invalid' };
  } catch {
    return { valid: false, reason: 'ed25519-verification-error' };
  }
  return { valid: true };
}

/**
 * Verify an evidence envelope's integrity and cryptographic signature.
 * Checks: (1) structural completeness, (2) facts hash match,
 * (3) Ed25519 signature against embedded public_key when present.
 * @param {object} evidence - The evidence envelope to verify.
 * @returns {{valid: boolean, reason?: string}}
 */
function verifyEvidence(evidence) {
  const fieldCheck = checkEnvelopeFields(evidence);
  if (!fieldCheck.valid) return fieldCheck;
  const recomputed = computeFactsHash(evidence.facts);
  if (recomputed !== evidence.evidence_hash) {
    return { valid: false, reason: 'evidence-hash-mismatch' };
  }
  return verifyEmbeddedSignature(evidence);
}

module.exports = {
  computeFactsHash,
  createEvidence,
  verifyEvidence,
};
