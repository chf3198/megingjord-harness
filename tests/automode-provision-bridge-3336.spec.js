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
