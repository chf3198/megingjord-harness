'use strict';
// tests/admin-handoff-cross-family.spec.js — Refs #2510

const { test, describe, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert');
const path = require('path');
const { validate } = require(path.join(__dirname, '..', 'scripts', 'global',
  'megalint', 'admin-handoff.js'));

const collabBody = `## COLLABORATOR_HANDOFF
Signed-by: Soren Harper
Team&Model: copilot:claude-sonnet-4-6@github
Role: collaborator
cross_family_reviewer: qwen2.5-coder:7b@fleet-tailscale
cross_family_rating: 82/100
cross_family_findings: ok`;

// #3672: this same-team (copilot) fixture targets only the #2510 cross-family-REVIEWER
// check, so it cites a cross_family_receipt to satisfy signer-independence (which #3672
// now actively enforces on `## ADMIN_HANDOFF` headers). At posting time the megalint has
// no issue context to ledger-verify the receipt, so independence is advisory here — the
// CI consensus-receipt-check + merge gate do the blocking verification.
const adminBody = `## ADMIN_HANDOFF
Signed-by: Soren Reyes
Team&Model: copilot:claude-sonnet-4-6@github
Role: admin
reviewer_family_verified: pass
cross_family_receipt: 0123456789abcdef`;

const makeInput = (aBody, cBody) => ({
  lane: 'lane:code-change',
  comments: [
    { body: cBody || collabBody, user: { login: 'harper' } },
    { body: aBody || adminBody, user: { login: 'reyes' } },
  ],
  labels: [],
});

describe('admin-handoff cross-family check (#2510)', () => {
  beforeEach(() => { delete process.env.CROSS_FAMILY_ADMIN_GATE_ADVISORY; });
  afterEach(() => { delete process.env.CROSS_FAMILY_ADMIN_GATE_ADVISORY; });

  test('valid cross-family handoff passes', () => {
    const r = validate(makeInput());
    const blocking = (r.violations || []).filter(v => v.severity !== 'advisory');
    assert.strictEqual(blocking.length, 0,
      `Expected no blocking; got: ${blocking.map(v => v.rule).join(', ')}`);
    assert.ok(r.ok);
  });

  test('same-family reviewer is blocking', () => {
    const sameFamily = collabBody.replace('qwen2.5-coder:7b@fleet-tailscale',
      'claude-haiku@anthropic');
    const r = validate(makeInput(adminBody, sameFamily));
    const rules = r.violations.map(v => v.rule);
    assert.ok(rules.includes('cross-family-reviewer-same-family'),
      `Expected cross-family-reviewer-same-family; got: ${rules.join(', ')}`);
    assert.ok(!r.ok);
  });

  test('same-family becomes advisory with CROSS_FAMILY_ADMIN_GATE_ADVISORY=1', () => {
    process.env.CROSS_FAMILY_ADMIN_GATE_ADVISORY = '1';
    const sameFamily = collabBody.replace('qwen2.5-coder:7b@fleet-tailscale',
      'claude-haiku@anthropic');
    const r = validate(makeInput(adminBody, sameFamily));
    const blocking = (r.violations || []).filter(v => v.severity !== 'advisory');
    assert.strictEqual(blocking.length, 0, 'Feature-flag should make violation advisory');
    assert.ok(r.ok);
  });

  test('cross-family check skipped on lightweight lane', () => {
    const sameFamily = collabBody.replace('qwen2.5-coder:7b@fleet-tailscale', 'claude-haiku@anthropic');
    const r = validate({ lane: 'lane:trivial', comments: makeInput(adminBody, sameFamily).comments });
    assert.ok(r.ok, 'trivial lane should skip cross-family check');
  });

  test('no collaborator handoff does not cause crash', () => {
    const input = {
      lane: 'lane:code-change',
      comments: [{ body: adminBody, user: { login: 'reyes' } }],
      labels: [],
    };
    const r = validate(input);
    assert.ok(r !== null);
  });
});
