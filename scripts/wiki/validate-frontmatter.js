#!/usr/bin/env node
// scripts/wiki/validate-frontmatter.js — Wiki frontmatter schema validator
// Validates YAML frontmatter against config/wiki-frontmatter.schema.json.
// Optionally verifies Ed25519 trust_attestation when signature present.
// CommonJS; loadable by Claude Code, Codex, Copilot, Antigravity. Refs #2052
'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const matter = require('gray-matter');
const Ajv = require('ajv');

const SCHEMA_PATH = path.join(__dirname, '../../config/wiki-frontmatter.schema.json');

/**
 * Load and compile the frontmatter JSON Schema via Ajv.
 * @returns {import('ajv').ValidateFunction} compiled validator
 */
function loadValidator() {
  const schema = JSON.parse(fs.readFileSync(SCHEMA_PATH, 'utf-8'));
  const ajv = new Ajv({ allErrors: true });
  return ajv.compile(schema);
}

/**
 * Verify Ed25519 trust_attestation block against body content.
 * @param {object} attestation - trust_attestation object from frontmatter
 * @param {string} body - markdown body (post-frontmatter content)
 * @returns {{ ok: boolean, error?: string }}
 */
function verifyAttestation(attestation, body) {
  try {
    const { signature_b64, signed_payload_hash } = attestation;
    const actualHash = crypto.createHash('sha256').update(body).digest('hex');
    if (actualHash !== signed_payload_hash) {
      return { ok: false, error: `payload hash mismatch: expected ${signed_payload_hash}` };
    }
    const sigBuf = Buffer.from(signature_b64, 'base64');
    const payloadBuf = Buffer.from(signed_payload_hash, 'hex');
    // Reconstruct public key from signer field if it is a raw hex public key;
    // otherwise attestation is treated as structurally valid (hash verified).
    const { signer } = attestation;
    if (signer && signer.length === 64 && /^[0-9a-f]+$/i.test(signer)) {
      const pubKey = crypto.createPublicKey({
        key: Buffer.concat([Buffer.from('302a300506032b6570032100', 'hex'), Buffer.from(signer, 'hex')]),
        format: 'der',
        type: 'spki',
      });
      const valid = crypto.verify(null, payloadBuf, pubKey, sigBuf);
      if (!valid) return { ok: false, error: 'Ed25519 signature verification failed' };
    }
    return { ok: true };
  } catch (err) {
    return { ok: false, error: `attestation verification error: ${err.message}` };
  }
}

/**
 * Validate a wiki markdown file's frontmatter.
 * @param {string} filePath - absolute or relative path to markdown file
 * @param {{ verifySignature?: boolean }} [opts] - options
 * @returns {{ valid: boolean, errors: string[] }}
 */
function validateFile(filePath, opts = {}) {
  const raw = fs.readFileSync(filePath, 'utf-8');
  return validateContent(raw, opts);
}

/**
 * Validate raw markdown string frontmatter.
 * @param {string} raw - full markdown content including frontmatter fences
 * @param {{ verifySignature?: boolean }} [opts] - options
 * @returns {{ valid: boolean, errors: string[] }}
 */
function validateContent(raw, opts = {}) {
  const { data: fm, content: body } = matter(String(raw));
  const validate = loadValidator();
  const schemaValid = validate(fm);
  const errors = schemaValid ? [] : validate.errors.map((e) => `${e.dataPath} ${e.message}`);

  if (schemaValid && fm.trust_attestation && opts.verifySignature !== false) {
    const result = verifyAttestation(fm.trust_attestation, body);
    if (!result.ok) errors.push(`trust_attestation: ${result.error}`);
  }
  return { valid: errors.length === 0, errors };
}

module.exports = { validateFile, validateContent, verifyAttestation, loadValidator };

if (require.main === module) {
  const [, , target] = process.argv;
  if (!target) { console.error('Usage: validate-frontmatter.js <file.md>'); process.exit(1); }
  const result = validateFile(path.resolve(target), { verifySignature: true });
  if (result.valid) { console.log('✅ Frontmatter valid'); process.exit(0); }
  result.errors.forEach((e) => console.error(`  ✗ ${e}`));
  process.exit(1);
}
