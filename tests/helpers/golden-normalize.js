'use strict';
// golden-normalize.js — canonicalizes scaffold plans/artifacts for content-hash comparison.
// Strips volatile fields so two logically-equivalent plans hash identically regardless of
// machine, timestamp, keypair, or absolute home path. Used by harness-add-runtime-golden.spec.js.

const crypto = require('node:crypto');

// ISO 8601 timestamps (with or without ms, with Z or offset)
const RE_ISO_TIMESTAMP = /\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})/g;

// Unix epoch integers (10 or 13 digits — seconds or ms)
const RE_EPOCH = /\b1[0-9]{9,12}\b/g;

// Absolute home paths like /home/username/... or /Users/username/...
const RE_ABS_HOME = /\/(home|Users)\/[^/\s"',]+/g;

// Tilde home paths like ~/.cursor or ~/devenv-ops
const RE_TILDE_PATH = /~\/[^\s"',]*/g;

// Hex strings that look like HMAC/SHA256 signatures (64 hex chars)
const RE_HEX_SIGNATURE = /\b[0-9a-f]{64}\b/gi;

// Semantic version strings used as registry/catalog versions
const RE_VERSION_FIELD_KEY = /^(registryVersion|catalogVersion|version|schemaVersion)$/;

// Keypair-like fields (public/private key material patterns)
const RE_KEYPAIR_FIELD_KEY = /^(publicKey|privateKey|secretKey|keyId|keyMaterial|crypto_key|signature)$/i;

function scrubString(stringValue) {
  return stringValue
    .replace(RE_ISO_TIMESTAMP, '<TIMESTAMP>')
    .replace(RE_EPOCH, '<EPOCH>')
    .replace(RE_ABS_HOME, '<HOME_PATH>')
    .replace(RE_TILDE_PATH, '<TILDE_PATH>')
    .replace(RE_HEX_SIGNATURE, '<HEX_SIG>');
}

function isVolatileKey(keyName) {
  return RE_VERSION_FIELD_KEY.test(keyName) || RE_KEYPAIR_FIELD_KEY.test(keyName);
}

/**
 * normalize(value) — recursively canonicalize a plan or artifact value.
 * Returns a new value with all volatile fields stripped or replaced with
 * stable sentinels. Arrays are sorted by JSON representation for stability.
 * Deterministic: same logical input always produces the same output.
 */
function normalize(value) {
  if (value === null || value === undefined) return value;

  if (typeof value === 'string') return scrubString(value);

  if (typeof value === 'number') {
    const asString = String(value);
    if (RE_EPOCH.test(asString)) return '<EPOCH>';
    RE_EPOCH.lastIndex = 0; // reset stateful regex
    return value;
  }

  if (Array.isArray(value)) {
    const normalizedItems = value.map(normalize);
    // Sort for stability — plan actions are already ordered by surface but
    // nested arrays (e.g. event lists) may vary in insertion order.
    return normalizedItems.sort((itemA, itemB) =>
      JSON.stringify(itemA).localeCompare(JSON.stringify(itemB))
    );
  }

  if (typeof value === 'object') {
    const result = {};
    for (const [keyName, fieldValue] of Object.entries(value)) {
      if (isVolatileKey(keyName)) {
        result[keyName] = '<REDACTED>';
        continue;
      }
      result[keyName] = normalize(fieldValue);
    }
    return result;
  }

  return value;
}

/**
 * normalizePlan(plan) — normalize a scaffold plan array, preserving surface order.
 * Strips the absolute `file` path (volatile) but keeps `surface`, `op`, `detail`.
 */
function normalizePlan(plan) {
  return plan.map(action => ({
    surface: action.surface,
    op: action.op,
    detail: normalize(action.detail),
  }));
}

/**
 * contentHash(value) — SHA-256 of the canonical JSON of normalize(value).
 * Stable across machines and sessions for logically-equivalent inputs.
 */
function contentHash(value) {
  const canonical = JSON.stringify(normalize(value));
  return crypto.createHash('sha256').update(canonical).digest('hex');
}

/**
 * planContentHash(plan) — content hash of a normalized plan (strips file paths).
 */
function planContentHash(plan) {
  const canonical = JSON.stringify(normalizePlan(plan));
  return crypto.createHash('sha256').update(canonical).digest('hex');
}

module.exports = { normalize, normalizePlan, contentHash, planContentHash, scrubString };
