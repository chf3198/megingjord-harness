'use strict';
// tests/collaborator-handoff-cross-family.spec.js
// Refs #2439 — validates cross-family blocking fields + family independence check.

const { test, describe } = require('node:test');
const assert = require('node:assert');
const path = require('path');
const { validate } = require(path.join(__dirname, '..', 'scripts', 'global',
  'megalint', 'collaborator-handoff.js'));

// #3678 (F1, Epic #3679): a cited cross_family_receipt is now ledger-verified. Build a
// genuine 2-family fixture ledger and cite its computed receipt so these tests exercise
// the real contract deterministically (no dependency on the live consensus ledger).
const rc = require(path.join(__dirname, '..', 'scripts', 'global', 'cross-family-receipt.js'));
const os = require('os');
const fs = require('fs');
const FIXTURE_LP = path.join(os.tmpdir(), `xfr-mega-${process.pid}-${Date.now()}.jsonl`);
const _base = { prompt_sha256: 'p'.repeat(64), response_sha256: 'r'.repeat(64) };
rc.appendEntry({ ticket: 2439, kind: 'review', provider: 'groq', family: 'meta', verdict: 'PASS', ts: '2026-07-11T00:00:00Z', ..._base }, FIXTURE_LP);
rc.appendEntry({ ticket: 2439, kind: 'review', provider: 'mistral', family: 'mistral', verdict: 'PASS', ts: '2026-07-11T00:00:01Z', ..._base }, FIXTURE_LP);
const FIXTURE_LEDGER = rc.readLedger(FIXTURE_LP);
fs.unlinkSync(FIXTURE_LP);
const GENUINE_RECEIPT = rc.computeReceipt(FIXTURE_LEDGER.filter(e => e.ticket === 2439 && e.kind === 'review'));

const validBody = `## COLLABORATOR_HANDOFF
Signed-by: Soren Harper
Team&Model: copilot:claude-sonnet-4-6@github
Role: collaborator
worktree_branch: feat/2907-test
worktree_behind_main: 0
cross_family_reviewer: qwen2.5-coder:7b@fleet-tailscale
cross_family_rating: 82/100
cross_family_findings: No major issues found.
cross_family_receipt: ${GENUINE_RECEIPT}
reviewer_family: qwen
doc-coverage:
  N/A: all surfaces — lane test only
Pre-handoff verification (PASS)
- [x] \`branch-name-prefix\` — pass`;

const makeInput = body => ({
  lane: 'lane:code-change',
  comments: [{ body, user: { login: 'test' } }],
  labels: [],
  ledger: FIXTURE_LEDGER, // #3678: deterministic ledger for receipt verification
});

describe('collaborator-handoff cross-family fields (#2439)', () => {
  test('valid cross-family handoff passes', () => {
    const r = validate(makeInput(validBody));
    const blocking = (r.violations || []).filter(v => v.severity !== 'advisory');
    assert.ok(blocking.length === 0, `Expected no blocking violations; got: ${
      blocking.map(v => v.rule).join(', ')}`);
  });

  test('#3678 F1: a fabricated (unledgered) cross_family_receipt is blocking', () => {
    const body = validBody.replace(/cross_family_receipt: [0-9a-f]{16}/, 'cross_family_receipt: deadbeefdeadbeef');
    const r = validate(makeInput(body));
    const rules = r.violations.map(v => v.rule);
    assert.ok(rules.includes('cross-family-receipt-unledgered'), 'fabricated receipt must fail closed at the gate');
    assert.ok(!r.ok, 'handoff with a fabricated receipt must not pass');
  });

  test('missing cross_family_reviewer is blocking', () => {
    const body = validBody.replace(/cross_family_reviewer:[^\n]+\n/, '');
    const r = validate(makeInput(body));
    const rules = r.violations.map(v => v.rule);
    assert.ok(rules.includes('missing-cross-family-reviewer'), 'Expected missing-cross-family-reviewer');
    assert.ok(!r.ok);
  });

  test('missing cross_family_rating is blocking', () => {
    const body = validBody.replace(/cross_family_rating:[^\n]+\n/, '');
    const r = validate(makeInput(body));
    const rules = r.violations.map(v => v.rule);
    assert.ok(rules.includes('missing-cross-family-rating'), 'Expected missing-cross-family-rating');
    assert.ok(!r.ok);
  });

  test('missing cross_family_findings is blocking', () => {
    const body = validBody.replace(/cross_family_findings:[^\n]+\n/, '');
    const r = validate(makeInput(body));
    const rules = r.violations.map(v => v.rule);
    assert.ok(rules.includes('missing-cross-family-findings'), 'Expected missing-cross-family-findings');
    assert.ok(!r.ok);
  });

  test('same-family reviewer is blocking', () => {
    const body = validBody.replace('qwen2.5-coder:7b@fleet-tailscale',
      'claude-haiku-3-5@anthropic');
    const r = validate(makeInput(body));
    const rules = r.violations.map(v => v.rule);
    assert.ok(rules.includes('cross-family-reviewer-same-family'),
      `Expected cross-family-reviewer-same-family; got: ${rules.join(', ')}`);
    assert.ok(!r.ok);
  });

  test('cross-family fields optional on non-code-change lane', () => {
    const input = { lane: 'lane:docs-research', comments: [{ body: validBody }], labels: [] };
    const r = validate(input);
    assert.ok(r.ok, `lane:docs-research should skip cross-family check`);
  });
});
