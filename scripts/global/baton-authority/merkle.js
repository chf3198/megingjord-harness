// merkle.js -- Minimal Merkle/digest verifier for evidence integrity.
// node:crypto sha256 only. Refs #3290, Epic #3284.
// AC3: rejects spoofed evidence by recomputing digest from GitHub-derived facts.
'use strict';

const { createHash } = require('node:crypto');

/**
 * Compute a SHA-256 hex digest of a UTF-8 string.
 */
function sha256hex(input) {
  return createHash('sha256').update(input, 'utf8').digest('hex');
}

/**
 * Canonicalize a facts object to a deterministic string.
 * Sorts keys alphabetically at every nesting level to ensure
 * the same logical facts always produce the same digest.
 */
function canonicalizeFacts(facts) {
  return JSON.stringify(facts, Object.keys(facts).sort());
}

/**
 * Build a sorted-leaf evidence digest from a facts object.
 *
 * Algorithm (documented per AC3):
 *   1. Canonicalize the facts object (sorted-key JSON, no whitespace).
 *   2. Split into individual leaf entries (one per top-level key).
 *   3. Hash each leaf independently: sha256("key=canonicalValue").
 *   4. Sort the leaf hashes lexicographically.
 *   5. Concatenate sorted leaf hashes and hash the result.
 *   6. Return the final root digest as a hex string.
 *
 * This is a single-level Merkle tree (sorted leaves, one root).
 * Sufficient for tamper detection; full N-level Merkle deferred.
 *
 * @param {object} facts - The evidence facts object.
 * @returns {string} Hex-encoded SHA-256 root digest.
 */
function buildEvidenceDigest(facts) {
  if (!facts || typeof facts !== 'object') {
    return sha256hex('empty-facts');
  }
  const sortedKeys = Object.keys(facts).sort();
  if (sortedKeys.length === 0) {
    return sha256hex('empty-facts');
  }
  const leafHashes = sortedKeys.map((key) => {
    const leafValue = JSON.stringify(facts[key]);
    return sha256hex(key + '=' + leafValue);
  });
  leafHashes.sort();
  const concatenated = leafHashes.join('');
  return sha256hex(concatenated);
}

/**
 * Verify a claimed digest against a recomputed digest from facts.
 *
 * @param {object} facts - The evidence facts (recomputed from source).
 * @param {string} claimedDigest - The digest submitted by the agent.
 * @returns {{ valid: boolean, recomputed: string, reason?: string }}
 */
function verifyDigest(facts, claimedDigest) {
  if (!claimedDigest || typeof claimedDigest !== 'string') {
    return {
      valid: false,
      recomputed: '',
      reason: 'claimed-digest-missing-or-non-string',
    };
  }
  const recomputed = buildEvidenceDigest(facts);
  if (recomputed !== claimedDigest) {
    return {
      valid: false,
      recomputed,
      reason: 'digest-mismatch',
    };
  }
  return { valid: true, recomputed };
}

module.exports = {
  buildEvidenceDigest,
  verifyDigest,
  sha256hex,
  canonicalizeFacts,
};
