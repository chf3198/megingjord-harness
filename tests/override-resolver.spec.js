'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const resolver = require('../scripts/global/override-resolver');

function repoWith(overrides) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ovr-'));
  fs.mkdirSync(path.join(dir, '.megingjord'));
  fs.writeFileSync(path.join(dir, '.megingjord', 'overrides.json'), JSON.stringify(overrides));
  return dir;
}

test('resolve rejects Tier-H and keeps Tier-A/C', () => {
  const dir = repoWith({ 'signer-independence': true, doc_coverage_gate_advisory: true, hamr_disabled: true });
  const out = resolver.resolve(dir);
  assert.deepEqual(out.active.sort(), ['doc_coverage_gate_advisory', 'hamr_disabled']);
  assert.equal(out.rejected.length, 1);
  assert.equal(out.rejected[0].control, 'signer-independence');
  assert.equal(out.effective['signer-independence'], undefined);
});

test('activeOverrides enumerates effective keys; empty repo => []', () => {
  assert.deepEqual(resolver.activeOverrides(repoWith({ test_floor_disabled: true })), ['test_floor_disabled']);
  assert.deepEqual(resolver.activeOverrides(os.tmpdir()), []); // no .megingjord here
});

test('auditOverrides emits a valid, redacted schema-v3 override-applied event per active override', () => {
  const dir = repoWith({ push_gates_bypass: true, secret_scan: false });
  const events = resolver.auditOverrides(dir, { dryRun: true });
  assert.equal(events.length, 1); // secret_scan is hard-floor -> rejected, not audited
  assert.equal(events[0].event, 'override-applied');
  assert.equal(events[0].version, 3);
  assert.equal(events[0].override_key, 'push_gates_bypass');
  for (const field of ['ts', 'service', 'env']) assert.ok(events[0][field]);
});
