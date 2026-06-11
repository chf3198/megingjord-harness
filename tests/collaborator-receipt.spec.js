'use strict';
// tests/collaborator-receipt.spec.js — Refs #2904: receipt token format regression.
// Validates H*→H promotion for G-01 (comment integrity) / G-02 (fabrication gap).

const { test, describe } = require('node:test');
const assert = require('node:assert');
const path = require('path');
const { validate } = require(path.join(__dirname, '..', 'scripts', 'global',
  'megalint', 'collaborator-handoff.js'));

const base = `## COLLABORATOR_HANDOFF
Signed-by: Soren Harper
Team&Model: copilot:claude-sonnet-4-6@github
Role: collaborator
cross_family_reviewer: qwen2.5-coder:7b@fleet-tailscale
cross_family_rating: 82/100
cross_family_findings: No issues.
doc-coverage:
  N/A: all surfaces — test only`;

const withReceipt = (r) => base + (r ? `\ncross_family_receipt: ${r}` : '');
const makeInput = body => ({
  lane: 'lane:code-change',
  comments: [{ body, user: { login: 'test' } }],
  labels: [],
});

describe('cross_family_receipt token (#2904)', () => {
  test('missing receipt → blocking violation', () => {
    const r = validate(makeInput(withReceipt(null)));
    assert.ok(!r.ok);
    assert.ok(r.violations.map(v => v.rule).includes('missing-cross-family-receipt'),
      `Expected missing-cross-family-receipt; got: ${r.violations.map(v=>v.rule).join(', ')}`);
  });

  test('non-hex receipt → cross-family-receipt-format violation', () => {
    const r = validate(makeInput(withReceipt('not-hex-value!!!')));
    assert.ok(!r.ok);
    assert.ok(r.violations.map(v => v.rule).includes('cross-family-receipt-format'));
  });

  test('receipt too short (8 chars) → format violation', () => {
    const r = validate(makeInput(withReceipt('abcdef01')));
    assert.ok(!r.ok);
    assert.ok(r.violations.map(v => v.rule).includes('cross-family-receipt-format'));
  });

  test('valid 16-char lowercase hex → no receipt violations', () => {
    const r = validate(makeInput(withReceipt('abcdef0123456789')));
    const receiptViolations = r.violations.filter(v =>
      v.rule.includes('receipt') && v.severity !== 'advisory');
    assert.strictEqual(receiptViolations.length, 0,
      `Unexpected: ${receiptViolations.map(v => v.rule).join(', ')}`);
  });

  test('valid uppercase hex receipt → accepted', () => {
    const r = validate(makeInput(withReceipt('ABCDEF0123456789')));
    const receiptViolations = r.violations.filter(v =>
      v.rule.includes('receipt') && v.severity !== 'advisory');
    assert.strictEqual(receiptViolations.length, 0);
  });

  test('receipt optional on lightweight lane', () => {
    const input = {
      lane: 'lane:trivial',
      comments: [{ body: withReceipt(null), user: { login: 'test' } }],
      labels: [],
    };
    assert.ok(validate(input).ok);
  });
});
