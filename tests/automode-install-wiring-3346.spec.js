// Refs #3346 — conformance: auto-mode merge authorization is provisioned at host install.
// Asserts the wiring exists (was documented but unimplemented before #3346), carries an
// opt-out, ships the upstream-feedback doc, and that the provisioner contract is intact.
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const read = (rel) => fs.readFileSync(path.join(ROOT, rel), 'utf8');

test('AC1: hamr-activate.sh auto-applies automode-provision at activation', () => {
  const sh = read('scripts/global/hamr-activate.sh');
  assert.match(sh, /automode-provision\.js" --apply/,
    'hamr:activate must invoke automode-provision --apply');
  assert.match(sh, /provision baton auto-mode merge authorization \(#3346\)/);
});

test('AC1: activation carries a documented opt-out env var', () => {
  const sh = read('scripts/global/hamr-activate.sh');
  assert.match(sh, /MEGINGJORD_NO_AUTOMODE_PROVISION/,
    'auto-apply must be skippable via MEGINGJORD_NO_AUTOMODE_PROVISION=1');
});

test('provisioner module contract is intact (#3342 dependency)', () => {
  const provisioner = require('../scripts/global/automode-provision.js');
  for (const fn of ['check', 'apply', 'verify']) {
    assert.equal(typeof provisioner[fn], 'function', `automode-provision must export ${fn}`);
  }
  assert.ok(provisioner.BATON_AUTOMODE && provisioner.BATON_AUTOMODE.autoMode,
    'BATON_AUTOMODE prose block must be present');
});

test('AC2: install runbook documents the IT-infra step + opt-out + feedback link', () => {
  const doc = read('docs/howto/autonomous-closeout-provisioning.md');
  assert.match(doc, /Infra provisioning is IT-owned/i);
  assert.match(doc, /MEGINGJORD_NO_AUTOMODE_PROVISION/);
  assert.match(doc, /claude-code-autonomous-operator-merge-authority\.md/,
    'runbook must link the upstream-feedback doc');
});

test('AC3: runbook documents the pre-#3342 bootstrap path', () => {
  const doc = read('docs/howto/autonomous-closeout-provisioning.md');
  assert.match(doc, /Bootstrap for environments predating #3342/i);
  assert.match(doc, /automode-provision\.js --apply/);
});

test('AC2: upstream Claude Code feedback doc exists with the concrete request', () => {
  const fb = read('docs/feedback/claude-code-autonomous-operator-merge-authority.md');
  assert.match(fb, /non-interactive/i);
  assert.match(fb, /baton sign-off|Consultant/i,
    'feedback must propose honoring an AI Consultant baton sign-off as the review');
});
