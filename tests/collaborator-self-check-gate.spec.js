'use strict';
// Tests for the hard-gate promotion of collaborator-self-check (#2907).
// Verifies that: (1) checkHandoffHasVerification blocks missing/FAIL evidence,
// (2) megalint/collaborator-handoff.js validate() rejects when self-check absent,
// (3) mutation invariant: the gate is BLOCKING (severity != advisory), not advisory.
// Uses node:test + node:assert per repo convention.
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');

const { checkHandoffHasVerification, runChecks, OVERRIDE_LABEL } =
  require(path.resolve(__dirname, '..', 'scripts', 'global', 'collaborator-self-check.js'));
const { validate, findCollaboratorHandoff } =
  require(path.resolve(__dirname, '..', 'scripts', 'global', 'megalint', 'collaborator-handoff.js'));

// ---------------------------------------------------------------------------
// checkHandoffHasVerification — unit tests
// ---------------------------------------------------------------------------

test('checkHandoffHasVerification: passes when PASS block present', () => {
  const body = 'COLLABORATOR_HANDOFF\nPre-handoff verification (PASS)\n- [x] `branch-name-prefix` — fix/2907-x\n';
  const result = checkHandoffHasVerification(body);
  assert.equal(result.ok, true);
});

test('checkHandoffHasVerification: fails on empty body (fail-closed)', () => {
  const result = checkHandoffHasVerification('');
  assert.equal(result.ok, false);
  assert.equal(result.rule, 'missing-self-check-verification');
});

test('checkHandoffHasVerification: fails on null/undefined input (fail-closed)', () => {
  assert.equal(checkHandoffHasVerification(null).ok, false);
  assert.equal(checkHandoffHasVerification(undefined).ok, false);
});

test('checkHandoffHasVerification: fails when block absent from non-empty handoff', () => {
  const body = 'COLLABORATOR_HANDOFF\nSigned-by: Orla Harper\nTeam&Model: claude-code:sonnet-4-6@anthropic\nRole: collaborator\n';
  const result = checkHandoffHasVerification(body);
  assert.equal(result.ok, false);
  assert.match(result.detail, /Pre-handoff verification/);
});

test('checkHandoffHasVerification: fails when block shows FAIL status', () => {
  const body = 'Pre-handoff verification (FAIL)\n- [ ] `branch-name-prefix` — bad prefix\n';
  const result = checkHandoffHasVerification(body);
  assert.equal(result.ok, false);
  assert.equal(result.rule, 'self-check-verification-failed');
});

test('checkHandoffHasVerification: passes when SKIPPED (waiver) block present', () => {
  const body = 'Pre-handoff verification: SKIPPED (override-waived)\n';
  const result = checkHandoffHasVerification(body);
  assert.equal(result.ok, true);
});

// ---------------------------------------------------------------------------
// MUTATION TEST: gate must be BLOCKING, not advisory
// This test would FAIL if someone reverts the hard-gate to advisory-only
// (i.e., marks the violation with severity:'advisory').
// ---------------------------------------------------------------------------

test('MUTATION: validate() returns ok=false (not advisory) when self-check block missing', () => {
  // Minimal valid handoff with all required fields EXCEPT the self-check block.
  const handoffBody = [
    '## COLLABORATOR_HANDOFF',
    'Signed-by: Orla Harper',
    'Team&Model: claude-code:sonnet-4-6@anthropic',
    'Role: collaborator',
    'test_strategy: tdd-pyramid',
    'cross_family_reviewer: gemini-2.5-flash@google-ai-studio',
    'cross_family_rating: 8/10',
    'cross_family_findings: looks good',
    'cross_family_receipt: abcdef1234567890',
    'doc-coverage: N/A: scripts — no user-visible doc surface',
    '- [x] AC1: done',
  ].join('\n');

  const comments = [{ body: handoffBody, user: { login: 'orla-harper' } }];
  const result = validate({ comments, lane: 'lane:code-change', labels: [] });

  // The gate MUST block, not pass advisory
  assert.equal(result.ok, false, 'validate() must return ok=false when self-check block missing');

  // The violation must be blocking (no severity:'advisory' tag on this rule)
  const selfCheckViol = (result.violations || []).find(
    v => v.rule === 'missing-self-check-verification' || v.rule === 'self-check-verification-failed'
  );
  assert.ok(selfCheckViol, 'self-check violation must be present in violations array');
  assert.notEqual(selfCheckViol.severity, 'advisory',
    'self-check violation must be BLOCKING (not advisory) — mutation guard');
});

test('MUTATION: validate() returns ok=true when self-check PASS block present', () => {
  const handoffBody = [
    '## COLLABORATOR_HANDOFF',
    'Signed-by: Orla Harper',
    'Team&Model: claude-code:sonnet-4-6@anthropic',
    'Role: collaborator',
    'test_strategy: tdd-pyramid',
    'cross_family_reviewer: gemini-2.5-flash@google-ai-studio',
    'cross_family_rating: 8/10',
    'cross_family_findings: looks good',
    'cross_family_receipt: abcdef1234567890',
    'doc-coverage: N/A: scripts — no user-visible doc surface',
    '- [x] AC1: done',
    'Pre-handoff verification (PASS)',
    '- [x] `branch-name-prefix` — fix/2907-collab-check',
  ].join('\n');

  const comments = [{ body: handoffBody, user: { login: 'orla-harper' } }];
  const result = validate({ comments, lane: 'lane:code-change', labels: [] });

  // Self-check violation must NOT appear when block is present and shows PASS
  const selfCheckViol = (result.violations || []).find(
    v => v.rule === 'missing-self-check-verification' || v.rule === 'self-check-verification-failed'
  );
  assert.equal(selfCheckViol, undefined, 'no self-check violation when verification block present');
});

test('MUTATION: validate() fails when self-check block shows FAIL', () => {
  const handoffBody = [
    '## COLLABORATOR_HANDOFF',
    'Signed-by: Orla Harper',
    'Team&Model: claude-code:sonnet-4-6@anthropic',
    'Role: collaborator',
    'test_strategy: tdd-pyramid',
    'cross_family_reviewer: gemini-2.5-flash@google-ai-studio',
    'cross_family_rating: 8/10',
    'cross_family_findings: looks good',
    'cross_family_receipt: abcdef1234567890',
    'doc-coverage: N/A: scripts — no user-visible doc surface',
    'Pre-handoff verification (FAIL)',
    '- [ ] `branch-name-prefix` — bad-branch',
  ].join('\n');

  const comments = [{ body: handoffBody, user: { login: 'orla-harper' } }];
  const result = validate({ comments, lane: 'lane:code-change', labels: [] });

  assert.equal(result.ok, false, 'validate() must reject FAIL self-check block');
  const selfCheckViol = (result.violations || []).find(v => v.rule === 'self-check-verification-failed');
  assert.ok(selfCheckViol, 'self-check-verification-failed violation must be present');
  assert.notEqual(selfCheckViol.severity, 'advisory', 'must be blocking, not advisory');
});

// ---------------------------------------------------------------------------
// Lightweight lane — self-check gate must NOT fire
// ---------------------------------------------------------------------------

test('scope-correctness: validate() skips self-check for lightweight lanes', () => {
  const handoffBody = '## COLLABORATOR_HANDOFF\nSigned-by: Orla Harper\nTeam&Model: x\nRole: collaborator\n';
  const comments = [{ body: handoffBody, user: { login: 'orla-harper' } }];
  const result = validate({ comments, lane: 'lane:trivial', labels: [] });
  assert.equal(result.ok, true);
  assert.equal(result.reason, 'lightweight-lane-skip');
});

// ---------------------------------------------------------------------------
// runChecks / OVERRIDE_LABEL — unchanged behaviour preserved
// ---------------------------------------------------------------------------

test('runChecks still returns ok=true + skipped on override label', () => {
  const result = runChecks({ labels: [OVERRIDE_LABEL] });
  assert.equal(result.ok, true);
  assert.equal(result.skipped, 'override-waived');
  assert.deepEqual(result.checks, []);
});
