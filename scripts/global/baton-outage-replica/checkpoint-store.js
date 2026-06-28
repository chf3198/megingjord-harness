// checkpoint-store.js - Persist Ed25519-signed evidence checkpoints from the W1a chain.
// Read-only replica consumes these for verify-only queries during GitHub outage.
// Refs #3294, Epic #3284. Node built-ins only.
'use strict';

const FRESHNESS_DEFAULT_MS = 300000;

/**
 * Create an empty checkpoint store.
 * @param {object} [options]
 * @param {number} [options.freshnessBoundMs] - Max age before a checkpoint is stale.
 * @returns {{checkpoints: Map, freshnessBoundMs: number}}
 */
function createStore(options = {}) {
  const freshnessBoundMs = options.freshnessBoundMs || FRESHNESS_DEFAULT_MS;
  return { checkpoints: new Map(), freshnessBoundMs };
}

/**
 * Validate structural fields of a signed checkpoint.
 * @param {object} checkpoint
 * @returns {{valid: boolean, reason?: string}}
 */
function validateCheckpointFields(checkpoint) {
  if (!checkpoint || typeof checkpoint !== 'object') {
    return { valid: false, reason: 'checkpoint-not-an-object' };
  }
  const requiredStrings = ['chainHeadHash', 'signature', 'publicKey', 'timestamp'];
  for (const field of requiredStrings) {
    if (typeof checkpoint[field] !== 'string' || !checkpoint[field]) {
      const kebab = field.replace(/[A-Z]/g, (ch) => '-' + ch.toLowerCase());
      return { valid: false, reason: 'missing-' + kebab };
    }
  }
  if (typeof checkpoint.chainLength !== 'number') {
    return { valid: false, reason: 'invalid-chain-length' };
  }
  if (!Number.isInteger(checkpoint.chainLength) || checkpoint.chainLength < 0) {
    return { valid: false, reason: 'invalid-chain-length' };
  }
  return { valid: true };
}

/**
 * Cache a signed checkpoint into the store.
 * @param {object} store - The checkpoint store from createStore().
 * @param {object} signedCheckpoint - Ed25519-signed chain-head checkpoint.
 * @returns {{cached: boolean, reason?: string}}
 */
function cacheCheckpoint(store, signedCheckpoint) {
  const fieldCheck = validateCheckpointFields(signedCheckpoint);
  if (!fieldCheck.valid) {
    return { cached: false, reason: fieldCheck.reason };
  }
  const key = signedCheckpoint.chainHeadHash;
  store.checkpoints.set(key, {
    chainHeadHash: signedCheckpoint.chainHeadHash,
    signature: signedCheckpoint.signature,
    publicKey: signedCheckpoint.publicKey,
    timestamp: signedCheckpoint.timestamp,
    chainLength: signedCheckpoint.chainLength,
    cachedAt: new Date().toISOString(),
  });
  return { cached: true };
}

/**
 * Load all checkpoints from the store (newest first by timestamp).
 * @param {object} store - The checkpoint store.
 * @returns {Array<object>} Checkpoints sorted newest-first.
 */
function loadCheckpoints(store) {
  const entries = Array.from(store.checkpoints.values());
  entries.sort((entryA, entryB) => {
    const timeA = new Date(entryA.timestamp).getTime();
    const timeB = new Date(entryB.timestamp).getTime();
    return timeB - timeA;
  });
  return entries;
}

/**
 * Retrieve the latest checkpoint (by timestamp) from the store.
 * @param {object} store - The checkpoint store.
 * @returns {object|null} The newest checkpoint, or null if store is empty.
 */
function getLatestCheckpoint(store) {
  const sorted = loadCheckpoints(store);
  if (sorted.length === 0) return null;
  return sorted[0];
}

/**
 * Check whether a checkpoint is stale relative to a reference time.
 * @param {object} checkpoint - A cached checkpoint.
 * @param {number} freshnessBoundMs - Maximum age in milliseconds.
 * @param {number} [nowMs] - Reference time (default: Date.now()).
 * @returns {boolean} True if the checkpoint is older than the freshness bound.
 */
function isStale(checkpoint, freshnessBoundMs, nowMs) {
  const now = nowMs || Date.now();
  const checkpointTime = new Date(checkpoint.timestamp).getTime();
  return (now - checkpointTime) > freshnessBoundMs;
}

module.exports = {
  createStore,
  cacheCheckpoint,
  loadCheckpoints,
  getLatestCheckpoint,
  isStale,
  FRESHNESS_DEFAULT_MS,
};
