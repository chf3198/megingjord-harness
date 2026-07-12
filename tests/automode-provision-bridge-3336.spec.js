// Refs #3336 (Option B, consensus-ratified) — committed test-guarded bridge to the
// EFFECTIVE merge-authority mechanism. A permissions.allow rule does NOT gate the
// Claude Code auto-mode classifier (#3342); the autoMode prose block does, and its
// portable home is scripts/global/automode-provision.js. This spec pins the scoped
// baton grant so it cannot be silently removed or weakened (re-scoped AC1 + AC3).
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const prov = require('../scripts/global/automode-provision.js');

const allow = () => prov.BATON_AUTOMODE.autoMode.allow;
const mergeRule = () => allow().find((r) => /Merging a pull request/i.test(r));
const closeRule = () => allow().find((r) => /Closing a GitHub issue/i.test(r));

test('AC1: BATON_AUTOMODE is a valid autoMode prose allow-block', () => {
  assert.ok(prov.BATON_AUTOMODE.autoMode, 'autoMode key present');
  assert.ok(Array.isArray(allow()), 'autoMode.allow is an array');
  assert.ok(allow().includes('$defaults'), 'preserves $defaults');
});

test('AC3: the scoped Admin-merge rule is present and remains scoped', () => {
  const rule = mergeRule();
  assert.ok(rule, 'baton Admin-merge autoMode rule must exist');
  assert.match(rule, /policy:megingjord-baton-closeout-v1/i);
  assert.match(rule, /CONSULTANT_CLOSEOUT/, 'merge gated on CONSULTANT_CLOSEOUT');
  assert.match(rule, /CI\s+checks\s+are\s+green|required CI/i, 'merge gated on green CI');
});

test('AC3: the scoped Consultant-close rule is present', () => {
  const rule = closeRule();
  assert.ok(rule, 'baton Consultant-close autoMode rule must exist');
  assert.match(rule, /policy:megingjord-baton-closeout-v1/i);
  assert.match(rule, /CONSULTANT_CLOSEOUT/);
});

test('AC1: mergeAutoMode installs the rules non-clobbering (deep-merge, dedupe)', () => {
  const existing = { permissions: { allow: ['Bash'] }, autoMode: { allow: ['$defaults', 'pre-existing-rule'] } };
  const merged = prov.mergeAutoMode(existing);
  assert.deepEqual(merged.permissions, { allow: ['Bash'] }, 'sibling keys preserved');
  assert.ok(merged.autoMode.allow.includes('pre-existing-rule'), 'existing autoMode rule preserved');
  assert.ok(merged.autoMode.allow.includes(mergeRule()), 'baton merge rule installed');
  assert.ok(merged.autoMode.allow.includes(closeRule()), 'baton close rule installed');
  const merged2 = prov.mergeAutoMode(merged);
  assert.equal(merged2.autoMode.allow.length, merged.autoMode.allow.length, 'idempotent — no duplicates');
});

test('the committed bridge does NOT rely on a permissions.allow rule (superseded #3342)', () => {
  // The grant lives in autoMode (classifier-effective), not permissions.allow.
  assert.equal(prov.BATON_AUTOMODE.permissions, undefined,
    'BATON_AUTOMODE must not ship a permissions.allow self-merge rule');
});

test('AC2: feature-completion-governance documents the bridge + client-not-approver', () => {
  const fs = require('node:fs');
  const path = require('node:path');
  const doc = fs.readFileSync(
    path.join(__dirname, '..', 'instructions', 'feature-completion-governance.instructions.md'), 'utf8');
  assert.match(doc, /Platform merge-authority bridge/i);
  assert.match(doc, /automode-provision/);
  assert.match(doc, /client is NEVER a merge approver/i);
});

// ---- #3714: closeout-authoring grant clause + decision-routing (AC3/AC4) ----
const closeoutRule = () => allow().find((r) => /Posting \(authoring\) a CONSULTANT_CLOSEOUT/i.test(r));

test('AC3 (#3714): the closeout-authoring grant clause is present', () => {
  const rule = closeoutRule();
  assert.ok(rule, 'baton closeout-authoring autoMode rule must exist');
  assert.match(rule, /policy:megingjord-baton-closeout-v1/i);
  assert.match(rule, /CONSULTANT_CLOSEOUT/);
});

test('AC4 (#3714): closeout clause is scoped — verified cross-family receipt + verdict, anti-self-approval', () => {
  const rule = closeoutRule();
  assert.match(rule, /cross_family_verdict/i, 'gated on cross_family_verdict');
  assert.match(rule, /VERIFIED cross-family consensus receipt/i, 'gated on a VERIFIED committed receipt');
  assert.match(rule, /required CI\s+minus the consultant gate is green/i, 'gated on required CI (minus consultant gate) green');
  assert.match(rule, /anti-self-approval preserved/i, 'preserves anti-self-approval');
  assert.match(rule, /still escalates\/blocks/i, 'no-receipt / same-family closeout still blocks (anti-over-grant)');
});

test('AC3 (#3714): mergeAutoMode installs the closeout clause non-clobbering + idempotent', () => {
  const merged = prov.mergeAutoMode({ autoMode: { allow: ['$defaults'] } });
  assert.ok(merged.autoMode.allow.includes(closeoutRule()), 'closeout clause installed');
  const merged2 = prov.mergeAutoMode(merged);
  assert.equal(merged2.autoMode.allow.length, merged.autoMode.allow.length, 'idempotent — no duplicate');
});

test('AC2 (#3714): decision-routing documents self-post-closeout as autonomously-resolvable, not a client prompt', () => {
  const fs2 = require('node:fs');
  const path2 = require('node:path');
  const dir = path2.join(__dirname, '..', 'instructions');
  const fcg = fs2.readFileSync(path2.join(dir, 'feature-completion-governance.instructions.md'), 'utf8');
  const oic = fs2.readFileSync(path2.join(dir, 'operator-identity-context.instructions.md'), 'utf8');
  for (const [name, doc] of [['feature-completion-governance', fcg], ['operator-identity-context', oic]]) {
    assert.match(doc, /#3714/, name + ' references #3714');
    assert.match(doc, /autonomously[- ]resolvable/i, name + ' classifies self-post as autonomously-resolvable');
    assert.match(doc, /cross_family_verdict|cross-family (consensus )?receipt/i, name + ' cites the receipt independence basis');
    assert.match(doc, /never.{0,40}client|not.{0,40}client prompt|NOT a (?:design|retained)/i, name + ' says not a client prompt');
  }
});
