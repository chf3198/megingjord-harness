// event-log.js — Hash-chained append-only verdict log.
// Replay-protection via monotonic seq + nonce uniqueness. Refs #3287, Epic #3284.
// G4 privacy: verdicts pass through log-redaction before hashing and persistence.
'use strict';

const { createHash, randomBytes } = require('node:crypto');
const { readFileSync, writeFileSync, existsSync } = require('node:fs');

// Wire log-redaction (G4 privacy, Phase-0 S5). Graceful fallback if unavailable.
let redactEventFn = null;
try {
  const logRedaction = require('../log-redaction');
  if (typeof logRedaction.redactEvent === 'function') {
    redactEventFn = logRedaction.redactEvent;
  }
} catch {
  // log-redaction unavailable; no-op fallback (verdict persisted unredacted)
}

/**
 * Apply redaction to a verdict object. Returns the redacted copy.
 * When log-redaction is unavailable, returns the original unchanged (no-op).
 * @param {object} verdict - The verdict object to redact.
 * @returns {object} Redacted verdict (or original if redaction unavailable).
 */
function redactVerdict(verdict) {
  if (!redactEventFn) return verdict;
  const result = redactEventFn(verdict);
  return result.event;
}

/**
 * Compute the chain hash for a verdict entry.
 * hash = sha256(prevHash + canonicalJSON(verdict) + seq + nonce)
 */
function computeEntryHash(prevHash, verdict, seq, nonce) {
  const canonical = JSON.stringify(verdict, Object.keys(verdict).sort());
  const input = prevHash + canonical + String(seq) + nonce;
  return createHash('sha256').update(input, 'utf8').digest('hex');
}

/**
 * Read the existing log entries from a JSONL file.
 * @param {string} logPath - Path to the JSONL log file.
 * @returns {Array<object>} Parsed log entries.
 */
function readLog(logPath) {
  if (!existsSync(logPath)) return [];
  const content = readFileSync(logPath, 'utf8').trim();
  if (!content) return [];
  return content.split('\n').map((line) => JSON.parse(line));
}

/**
 * Generate a unique nonce not colliding with any existing nonce.
 * @param {Set<string>} existingNonces - Nonces already in the log.
 * @returns {string} A unique 32-char hex nonce.
 */
function generateUniqueNonce(existingNonces) {
  let nonce = randomBytes(16).toString("hex");
  let attempts = 0;
  while (existingNonces.has(nonce) && attempts < 100) {
    nonce = randomBytes(16).toString("hex");
    attempts++;
  }
  if (existingNonces.has(nonce)) {
    throw new Error("nonce-collision-after-100-attempts");
  }
  return nonce;
}

/**
 * Append a verdict to the hash-chained log.
 * Enforces MONOTONIC sequence and rejects duplicate/out-of-order seq or reused nonce.
 * G4: verdict is redacted BEFORE hashing so the chain covers the redacted form.
 * @param {string} logPath - Path to the JSONL log file.
 * @param {object} verdict - The verdict object to append.
 * @returns {{seq: number, hash: string, nonce: string}} The appended entry metadata.
 */
function appendVerdict(logPath, verdict) {
  const entries = readLog(logPath);
  const lastEntry = entries.length > 0 ? entries[entries.length - 1] : null;
  const prevHash = lastEntry ? lastEntry.hash : '0'.repeat(64);
  const prevSeq = lastEntry ? lastEntry.seq : -1;
  const nextSeq = prevSeq + 1;
  const existingNonces = new Set(entries.map((entry) => entry.nonce));
  const nonce = generateUniqueNonce(existingNonces);
  // G4: redact verdict BEFORE hashing — chain covers the redacted form
  const redactedVerdict = redactVerdict(verdict);
  const hash = computeEntryHash(prevHash, redactedVerdict, nextSeq, nonce);
  const entry = {
    seq: nextSeq, nonce, hash, prev_hash: prevHash,
    verdict: redactedVerdict, ts: new Date().toISOString(),
  };
  const line = JSON.stringify(entry) + '\n';
  writeFileSync(logPath, line, { flag: 'a' });
  return { seq: nextSeq, hash, nonce };
}

/**
 * Verify the integrity of the entire hash chain.
 * @param {string} logPath - Path to the JSONL log file.
 * @returns {{valid: boolean, entries: number, reason?: string, failedAt?: number}}
 */
function verifyChain(logPath) {
  const entries = readLog(logPath);
  if (entries.length === 0) return { valid: true, entries: 0 };
  const seenNonces = new Set();
  let prevHash = '0'.repeat(64);
  for (let idx = 0; idx < entries.length; idx++) {
    const entry = entries[idx];
    // Monotonic sequence check
    if (entry.seq !== idx) {
      return { valid: false, entries: entries.length, reason: 'non-monotonic-seq', failedAt: idx };
    }
    // Nonce uniqueness check (replay protection)
    if (seenNonces.has(entry.nonce)) {
      return { valid: false, entries: entries.length, reason: 'duplicate-nonce', failedAt: idx };
    }
    seenNonces.add(entry.nonce);
    // Hash chain verification
    if (entry.prev_hash !== prevHash) {
      return { valid: false, entries: entries.length, reason: 'prev-hash-mismatch', failedAt: idx };
    }
    const expected = computeEntryHash(prevHash, entry.verdict, entry.seq, entry.nonce);
    if (entry.hash !== expected) {
      return { valid: false, entries: entries.length, reason: 'hash-mismatch', failedAt: idx };
    }
    prevHash = entry.hash;
  }
  return { valid: true, entries: entries.length };
}

module.exports = {
  appendVerdict,
  verifyChain,
  computeEntryHash,
  readLog,
  redactVerdict,
};
