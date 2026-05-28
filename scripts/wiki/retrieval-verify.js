#!/usr/bin/env node
// scripts/wiki/retrieval-verify.js — content-hash + trust-attestation verification helpers.
// Extracted from retrieval-router.js per readability gate. Refs #2057
'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { parseFrontmatter } = require('./wiki-io');
const { verifyAttestation } = require('./validate-frontmatter');

function sha256Text(text) {
  return crypto.createHash('sha256').update(text).digest('hex');
}

/**
 * Compute sha256 hex digest of a file's raw bytes.
 * @param {string} filePath
 * @returns {string}
 */
function sha256File(filePath) {
  return crypto.createHash('sha256').update(fs.readFileSync(filePath)).digest('hex');
}

/**
 * Verify the content_hash frontmatter field against the actual page body.
 * @param {{ content_hash?: string }} frontmatter
 * @param {string} body - markdown body (post-frontmatter content)
 * @returns {{ ok: boolean, reason?: string }}
 */
function verifyContentHash(frontmatter, body) {
  if (!frontmatter.content_hash) return { ok: true, reason: 'no content_hash -- skip' };
  const actual = sha256Text(body);
  if (actual !== frontmatter.content_hash) {
    return {
      ok: false,
      reason: `content_hash mismatch: recorded=${frontmatter.content_hash} actual=${actual}`,
    };
  }
  return { ok: true };
}

/**
 * Verify the source_sha256 frontmatter field against the source file on disk.
 * Used for Wiki A (code) pages that record source_path + source_sha256.
 * @param {{ source_path?: string, source_sha256?: string }} frontmatter
 * @param {string} repoRoot - absolute path to repo root
 * @returns {{ ok: boolean, reason?: string }}
 */
function verifySourceHash(frontmatter, repoRoot) {
  if (!frontmatter.source_path || !frontmatter.source_sha256) {
    return { ok: true, reason: 'no source_path/source_sha256 -- skip' };
  }
  const absSource = path.join(repoRoot, frontmatter.source_path);
  if (!fs.existsSync(absSource)) {
    return { ok: false, reason: `source file missing: ${frontmatter.source_path}` };
  }
  const actual = sha256File(absSource);
  if (actual !== frontmatter.source_sha256) {
    return {
      ok: false,
      reason: `source_sha256 mismatch: recorded=${frontmatter.source_sha256} actual=${actual}`,
    };
  }
  return { ok: true };
}

// ---- Retrieval-time trust verification ---------------------------------------

/**
 * Run all retrieval-time verifications on one page.
 * @param {{ frontmatter: object, body: string, path: string }} page
 * @param {string} repoRoot - absolute path to repo root
 * @returns {{
 *   content_hash_ok: boolean,
 *   source_hash_ok: boolean,
 *   attestation_ok: boolean,
 *   overall: boolean,
 *   notes: string[]
 * }}
 */
function verifyPage(page, repoRoot) {
  const notes = [];

  const contentResult = verifyContentHash(page.frontmatter, page.body);
  if (!contentResult.ok) notes.push(`content_hash: ${contentResult.reason}`);

  const sourceResult = verifySourceHash(page.frontmatter, repoRoot);
  if (!sourceResult.ok) notes.push(`source_sha256: ${sourceResult.reason}`);

  let attestationOk = true;
  if (page.frontmatter.trust_attestation) {
    const attResult = verifyAttestation(page.frontmatter.trust_attestation, page.body);
    if (!attResult.ok) {
      attestationOk = false;
      notes.push(`trust_attestation: ${attResult.error}`);
    }
  }

  const overall = contentResult.ok && sourceResult.ok && attestationOk;
  return { content_hash_ok: contentResult.ok, source_hash_ok: sourceResult.ok,
    attestation_ok: attestationOk, overall, notes };
}

// ---- Scoring helpers ---------------------------------------------------------
module.exports = { sha256Text, sha256File, verifyContentHash, verifySourceHash, verifyPage };
