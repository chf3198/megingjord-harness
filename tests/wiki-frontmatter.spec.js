// tests/wiki-frontmatter.spec.js — Frontmatter schema + Ed25519 attestation tests
// test_strategy: tdd-pyramid  Refs #2052
'use strict';

const { test, expect } = require('@playwright/test');
const path = require('path');
const crypto = require('crypto');
const { validateContent, verifyAttestation } = require('../scripts/wiki/validate-frontmatter');
const { buildAttestation, sha256Hex } = require('../scripts/wiki/sign-frontmatter');

const FIXTURES = path.join(__dirname, 'fixtures/wiki-frontmatter');
const fs = require('fs');

function fixture(name) { return fs.readFileSync(path.join(FIXTURES, name), 'utf-8'); }

// --- Schema parseable ---
test('schema loads via require()', () => {
  const schema = require('../config/wiki-frontmatter.schema.json');
  expect(schema.$schema).toContain('json-schema.org');
  expect(schema.required).toContain('content_trust_score');
  expect(schema.required).not.toContain('trust_attestation'); // optional field
});

// --- Valid fixtures ---
test('valid-code.md passes schema', () => {
  const r = validateContent(fixture('valid-code.md'));
  expect(r.valid).toBe(true);
  expect(r.errors).toHaveLength(0);
});

test('valid-wisdom-global.md passes schema', () => {
  const r = validateContent(fixture('valid-wisdom-global.md'));
  expect(r.valid).toBe(true);
});

test('valid-work-log.md with score=0 boundary passes schema', () => {
  const r = validateContent(fixture('valid-work-log.md'));
  expect(r.valid).toBe(true);
});

// --- content_trust_score bounds (≥5 cases) ---
test('score negative fails validation', () => {
  const r = validateContent(fixture('invalid-score-negative.md'));
  expect(r.valid).toBe(false);
  expect(r.errors.some((e) => e.includes('minimum') || e.includes('<= 1') || e.includes('>= 0'))).toBe(true);
});

test('score above 1 fails validation', () => {
  const r = validateContent(fixture('invalid-score-above-one.md'));
  expect(r.valid).toBe(false);
  expect(r.errors.some((e) => e.includes('maximum') || e.includes('<= 1'))).toBe(true);
});

test('score as string fails validation', () => {
  const r = validateContent(fixture('invalid-score-string.md'));
  expect(r.valid).toBe(false);
  expect(r.errors.some((e) => e.includes('type') || e.includes('number'))).toBe(true);
});

test('score NaN (missing field) fails — missing required field', () => {
  const raw = '---\ntitle: T\ntype: code\ncreated: "2026-01-01"\nupdated: "2026-01-01"\n---\nBody';
  const r = validateContent(raw);
  expect(r.valid).toBe(false);
  expect(r.errors.some((e) => e.includes('content_trust_score') || e.includes('required'))).toBe(true);
});

test('score > 1 inline raw fails validation', () => {
  const raw = '---\ntitle: T\ntype: code\ncontent_trust_score: 99\ncreated: "2026-01-01"\nupdated: "2026-01-01"\n---\nBody';
  const r = validateContent(raw);
  expect(r.valid).toBe(false);
});

// --- trust_attestation optional ---
test('missing trust_attestation is accepted (optional)', () => {
  const raw = fixture('valid-wisdom-global.md');
  const r = validateContent(raw, { verifySignature: true });
  expect(r.valid).toBe(true);
});

// --- Ed25519 signature verification ---
test('valid Ed25519 signature verifies correctly', () => {
  const body = '\nSome wiki body content.\n';
  const kp = crypto.generateKeyPairSync('ed25519');
  const rawPub = kp.publicKey.export({ format: 'der', type: 'spki' }).slice(12).toString('hex');
  const att = buildAttestation(body, kp.privateKey, rawPub);
  expect(att.algorithm).toBe('ed25519');
  const result = verifyAttestation(att, body);
  expect(result.ok).toBe(true);
});

test('tampered body causes signature verification failure', () => {
  const body = '\nOriginal content.\n';
  const kp = crypto.generateKeyPairSync('ed25519');
  const rawPub = kp.publicKey.export({ format: 'der', type: 'spki' }).slice(12).toString('hex');
  const att = buildAttestation(body, kp.privateKey, rawPub);
  const result = verifyAttestation(att, '\nTampered content.\n');
  expect(result.ok).toBe(false);
  expect(result.error).toContain('hash mismatch');
});

test('tampered signature_b64 fails verification', () => {
  const body = '\nWiki body.\n';
  const kp = crypto.generateKeyPairSync('ed25519');
  const rawPub = kp.publicKey.export({ format: 'der', type: 'spki' }).slice(12).toString('hex');
  const att = buildAttestation(body, kp.privateKey, rawPub);
  const tampered = { ...att, signature_b64: Buffer.alloc(64).toString('base64') };
  const result = verifyAttestation(tampered, body);
  expect(result.ok).toBe(false);
});

// --- Other schema errors ---
test('missing title fails schema', () => {
  const r = validateContent(fixture('invalid-missing-title.md'));
  expect(r.valid).toBe(false);
});

test('invalid type enum fails schema', () => {
  const r = validateContent(fixture('invalid-type-enum.md'));
  expect(r.valid).toBe(false);
  expect(r.errors.some((e) => e.includes('allowed values') || e.includes('enum'))).toBe(true);
});
