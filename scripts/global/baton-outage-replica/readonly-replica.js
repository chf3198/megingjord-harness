// readonly-replica.js - Verify-only API for outage-mode baton evidence queries.
// DESIGN: deliberately read-only. During a GitHub outage it serves VERIFY-ONLY
// queries from cached Ed25519-signed evidence checkpoints. It can NEVER authorize
// a merge or close (terminals stay fail-closed). A read-write replica would break
// fail-closed, so read-only is a correctness choice, not a gap.
// Refs #3294, Epic #3284. Node built-ins only.
'use strict';

const { createPublicKey, verify: cryptoVerify } = require('node:crypto');

const TERMINAL_DENY = Object.freeze({
  authorized: false,
  reason: 'replica-is-read-only-terminals-fail-closed',
});

/**
 * Create a read-only replica instance.
 * @param {object} store - A checkpoint store from checkpoint-store.js.
 * @param {object} [options]
 * @param {number} [options.freshnessBoundMs] - Override checkpoint freshness bound.
 * @returns {object} The replica instance (store + config).
 */
function createReplica(store, options = {}) {
  const freshnessBoundMs = options.freshnessBoundMs || store.freshnessBoundMs;
  return { store, freshnessBoundMs, mode: 'verify-only' };
}

/**
 * Verify an Ed25519 signature on a payload using a base64-encoded SPKI public key.
 * @param {string} payload - The signed payload string.
 * @param {string} signatureB64 - Base64 signature.
 * @param {string} publicKeyB64 - Base64 SPKI public key.
 * @returns {boolean} True if signature is valid.
 */
function verifySignature(payload, signatureB64, publicKeyB64) {
  try {
    const pubDer = Buffer.from(publicKeyB64, 'base64');
    const pubKeyObj = createPublicKey({ key: pubDer, format: 'der', type: 'spki' });
    const sigBuf = Buffer.from(signatureB64, 'base64');
    return cryptoVerify(null, Buffer.from(payload, 'utf8'), pubKeyObj, sigBuf);
  } catch {
    return false;
  }
}

/**
 * Check whether a checkpoint is stale.
 * @param {object} checkpoint
 * @param {number} freshnessBoundMs
 * @param {number} [nowMs]
 * @returns {boolean}
 */
function checkpointIsStale(checkpoint, freshnessBoundMs, nowMs) {
  const now = nowMs || Date.now();
  const cpTime = new Date(checkpoint.timestamp).getTime();
  return (now - cpTime) > freshnessBoundMs;
}

/**
 * Verify a verdict against cached checkpoints. Checks:
 *   1. The verdict has a valid Ed25519 signature (if publicKey provided).
 *   2. The verdict's chain hash matches a known checkpoint head.
 *   3. The matched checkpoint is not stale.
 *
 * This function ONLY verifies. It never authorizes any terminal action.
 *
 * @param {object} replica - The replica from createReplica().
 * @param {object} verdict - A signed verdict with chainHeadHash, signature, publicKey, payload.
 * @param {object} [options]
 * @param {number} [options.nowMs] - Override current time for staleness check.
 * @returns {{valid: boolean, reason?: string}}
 */
function verifyVerdict(replica, verdict, options = {}) {
  if (!verdict || typeof verdict !== 'object') {
    return { valid: false, reason: 'verdict-not-an-object' };
  }
  if (!verdict.chainHeadHash || typeof verdict.chainHeadHash !== 'string') {
    return { valid: false, reason: 'missing-chain-head-hash' };
  }
  // Signature verification when public key is provided
  if (verdict.publicKey && verdict.signature && verdict.payload) {
    const sigValid = verifySignature(verdict.payload, verdict.signature, verdict.publicKey);
    if (!sigValid) {
      return { valid: false, reason: 'bad-signature' };
    }
  }
  // Look up the chain head in cached checkpoints
  const checkpoint = replica.store.checkpoints.get(verdict.chainHeadHash);
  if (!checkpoint) {
    return { valid: false, reason: 'partial-proof' };
  }
  // Staleness check
  const nowMs = options.nowMs || Date.now();
  if (checkpointIsStale(checkpoint, replica.freshnessBoundMs, nowMs)) {
    return { valid: false, reason: 'stale-digest' };
  }
  return { valid: true };
}

/**
 * Verify a claimed chain head against the latest cached checkpoint.
 * @param {object} replica - The replica from createReplica().
 * @param {string} claimedHead - The hash to verify.
 * @param {object} [options]
 * @param {number} [options.nowMs] - Override current time for staleness check.
 * @returns {{valid: boolean, reason?: string}}
 */
function verifyChainHead(replica, claimedHead, options = {}) {
  if (!claimedHead || typeof claimedHead !== 'string') {
    return { valid: false, reason: 'invalid-claimed-head' };
  }
  const checkpoint = replica.store.checkpoints.get(claimedHead);
  if (!checkpoint) {
    return { valid: false, reason: 'unknown-chain-head' };
  }
  const nowMs = options.nowMs || Date.now();
  if (checkpointIsStale(checkpoint, replica.freshnessBoundMs, nowMs)) {
    return { valid: false, reason: 'stale-digest' };
  }
  return { valid: true };
}

/**
 * TERMINAL STUB: authorize a merge. ALWAYS returns authorized:false.
 * This is a deliberate fail-closed design (AC2). The read-only replica
 * can never authorize a terminal action.
 * @returns {{authorized: boolean, reason: string}}
 */
function authorizeMerge() {
  return TERMINAL_DENY;
}

/**
 * TERMINAL STUB: authorize a close. ALWAYS returns authorized:false.
 * This is a deliberate fail-closed design (AC2). The read-only replica
 * can never authorize a terminal action.
 * @returns {{authorized: boolean, reason: string}}
 */
function authorizeClose() {
  return TERMINAL_DENY;
}

/**
 * Reconcile a cached head against a newly observed head after reconnect.
 * NEVER authorizes under uncertainty (AC3 reconnect-conflict).
 * If the cached head diverges from the observed head, returns defer-to-truth.
 * @param {object} replica - The replica from createReplica().
 * @param {string} cachedHead - The head hash from the cached checkpoint.
 * @param {string} observedHead - The newly observed head hash from the live source.
 * @returns {{action: string, reason?: string}}
 */
function reconcileHeads(replica, cachedHead, observedHead) {
  if (!cachedHead || !observedHead) {
    return { action: 'defer-to-truth', reason: 'missing-head-value' };
  }
  if (cachedHead === observedHead) {
    return { action: 'consistent', reason: 'heads-match' };
  }
  // Divergence detected: never authorize under uncertainty
  return { action: 'defer-to-truth', reason: 'reconnect-conflict-cached-diverges-from-observed' };
}

module.exports = {
  createReplica,
  verifyVerdict,
  verifyChainHead,
  authorizeMerge,
  authorizeClose,
  reconcileHeads,
  TERMINAL_DENY,
};
