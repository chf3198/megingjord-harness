// outage-wal.js — Crash-safe write-ahead log for queued reconcile actions.
// Hash-chained append + monotonic seq + nonce replay-protection (reuses event-log style).
// Idempotent replay: already-applied seq is skipped. Refs #3291, Epic #3284.
'use strict';

const { createHash, randomBytes } = require('node:crypto');
const {
  readFileSync, writeFileSync, existsSync,
  openSync, fsyncSync, closeSync,
} = require('node:fs');

const ZERO_CHAR = '0';
const HASH_LENGTH = 64;
const GENESIS_HASH = ZERO_CHAR.repeat(HASH_LENGTH);

/**
 * Compute a chain hash for a WAL entry.
 * hash = sha256(prevHash + canonicalJSON(action) + seq + nonce)
 */
function computeWalHash(prevHash, action, seq, nonce) {
  const canonical = JSON.stringify(action, Object.keys(action).sort());
  const input = prevHash + canonical + String(seq) + nonce;
  return createHash('sha256').update(input, 'utf8').digest('hex');
}

/**
 * Read WAL entries from a JSONL file.
 * @param {string} walPath
 * @returns {Array<object>}
 */
function readWal(walPath) {
  if (!existsSync(walPath)) return [];
  const content = readFileSync(walPath, 'utf8').trim();
  if (!content) return [];
  return content.split('\n').map((line) => JSON.parse(line));
}

/**
 * Generate a nonce not present in existing set.
 * @param {Set<string>} existingNonces
 * @param {Function} [rngFn] - Optional: returns 16 bytes as hex string.
 * @returns {string}
 */
function generateNonce(existingNonces, rngFn) {
  const generate = rngFn || (() => randomBytes(16).toString('hex'));
  let nonce = generate();
  let attempts = 0;
  const MAX_NONCE_ATTEMPTS = 100;
  while (existingNonces.has(nonce) && attempts < MAX_NONCE_ATTEMPTS) {
    nonce = generate();
    attempts++;
  }
  if (existingNonces.has(nonce)) {
    throw new Error('nonce-collision-after-max-attempts');
  }
  return nonce;
}

/**
 * Append a reconcile action to the WAL with fsync for crash safety.
 * @param {string} walPath - Path to the WAL JSONL file.
 * @param {object} action - The action payload to log.
 * @param {{rngFn?: Function}} [options]
 * @returns {{seq: number, hash: string, nonce: string}}
 */
function appendAction(walPath, action, options = {}) {
  const entries = readWal(walPath);
  const lastEntry = entries.length > 0 ? entries[entries.length - 1] : null;
  const prevHash = lastEntry ? lastEntry.hash : GENESIS_HASH;
  const prevSeq = lastEntry ? lastEntry.seq : -1;
  const nextSeq = prevSeq + 1;
  const existingNonces = new Set(entries.map((ent) => ent.nonce));
  const nonce = generateNonce(existingNonces, options.rngFn);
  const hash = computeWalHash(prevHash, action, nextSeq, nonce);
  const entry = {
    seq: nextSeq,
    nonce,
    hash,
    prev_hash: prevHash,
    action,
    ts: new Date().toISOString(),
  };
  const line = JSON.stringify(entry) + '\n';
  const fileDescriptor = openSync(walPath, 'a');
  try {
    writeFileSync(fileDescriptor, line);
    fsyncSync(fileDescriptor);
  } finally {
    closeSync(fileDescriptor);
  }
  return { seq: nextSeq, hash, nonce };
}

/**
 * Replay WAL entries through applyFn, skipping already-applied seqs.
 * @param {string} walPath
 * @param {Function} applyFn - async (action, seq) => {applied: boolean}
 * @returns {Promise<{replayed: number, skipped: number, errors: Array}>}
 */
async function replayWal(walPath, applyFn) {
  const entries = readWal(walPath);
  let replayed = 0;
  let skipped = 0;
  const errors = [];
  for (const entry of entries) {
    try {
      const result = await applyFn(entry.action, entry.seq);
      if (result && result.applied) {
        replayed++;
      } else {
        skipped++;
      }
    } catch (applyError) {
      errors.push({ seq: entry.seq, error: applyError.message });
    }
  }
  return { replayed, skipped, errors };
}

module.exports = {
  appendAction,
  replayWal,
  readWal,
  computeWalHash,
  generateNonce,
  GENESIS_HASH,
};
